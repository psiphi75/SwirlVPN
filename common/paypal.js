/******************************************************************************
 *                                                                            *
 *    SwirlVPN is free software: you can redistribute it and/or modify        *
 *    it under the terms of the GNU General Public License as published by    *
 *    the Free Software Foundation, either version 3 of the License, or       *
 *    (at your option) any later version.                                     *
 *                                                                            *
 *    SwirlVPN is distributed in the hope that it will be useful,             *
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of          *
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           *
 *    GNU General Public License for more details.                            *
 *                                                                            *
 *    You should have received a copy of the GNU General Public License       *
 *    along with SwirlVPN.  If not, see <http://www.gnu.org/licenses/>.       *
 *                                                                            *
 ******************************************************************************/

/**
 * paypal.js
 *
 * This is the PayPal interface.
 *
 * TODO: Add NOSHIPPING support, see:
 *     https://github.com/paypal/PayPal-node-SDK/issues/6#issuecomment-63317852
 */

/*jslint node:true*/
'use strict';

var paypal_api = require('paypal-rest-sdk');
var cm;
var am;

var vendorName;
var purchaseLogfile;

/*
 * This function must be called.
 */
exports.init = function init(_am, _cm) {
    am = _am;
    cm = _cm;

    var config_opts = cm.cfg('payment:paypal:config_opts');
    paypal_api.configure(config_opts);

    vendorName                  = cm.cfg('payment:paypal:vendorName');
    purchaseLogfile             = cm.cfg('purchase:logFile');
};

 /**
  * Lightly validate the purchaseDetails and send the invoice to bitpay.
  * @param  {object}   purchaseDetails The purchasing details.
  * @param  {Function} callback        Standard callback
  */
 exports.createAndSendInvoice = function createAndSendInvoice(purchaseDetails, callback) {

    try {

        cm.assertHasProperty(purchaseDetails, 'valueUSD');
        cm.assertHasProperty(purchaseDetails, 'bytesPurchased');
        cm.assertHasProperty(purchaseDetails, 'purchaseId');
        cm.assertHasProperty(purchaseDetails, 'name');
        cm.assertHasProperty(purchaseDetails, 'email');
        cm.assertHasProperty(purchaseDetails, 'userId');

    } catch (err) {
        cm.error('ERROR: paypal: createAndSendInvoice(): ', err);
        callback(err, null);
        return;
    }

    /*
     *   Prepare the payment POST JSON
     */
    var bytesStr = cm.bytesToSize(purchaseDetails.bytesPurchased, 1);
    var create_payment_json = {
        intent: 'sale',
        payer: {
           payment_method: 'paypal'
        },
        redirect_urls: cm.cfg('payment:paypal:redirect_urls'),
        transactions: [{
            amount: {
                currency: 'USD',
                total: purchaseDetails.valueUSD
            },
            description: 'Payment for Swirl VPN plan: ' + purchaseDetails.name + ' (' + bytesStr + ')'
        }]
    };

    paypal_api.payment.create(create_payment_json, function (err, paypalResponse) {
        if (err) {

            cm.log.error('ERROR: paypal_api.payment.create(): ', err);
            callback('An error occurred connecting to PayPal, please try again');

        } else {

            /* Success, let's parse the response */
            processPayPalResponse(purchaseDetails, paypalResponse, callback);

        }
    });

};


/**
 * This will process the response from the initial request to bitpay.
 * @param  {object}   purchaseDetails The purchase - gets updated inline.
 * @param  {object}   bitpayResponse  The actual result from bitpay.  This will be merged into purchaseDetails
 * @param  {Function} callback        cb(null) if all is okay.
 */
function processPayPalResponse(purchaseDetails, paypalResponse, callback) {

    try {

        cm.assertHasProperty(paypalResponse, 'id');
        cm.assertHasProperty(paypalResponse, 'state');
        cm.assertHasProperty(paypalResponse, 'intent');
        cm.assertHasProperty(paypalResponse, 'payer');
        cm.assertHasProperty(paypalResponse.payer, 'payment_method');
        cm.assertHasProperty(paypalResponse, 'links');

    } catch (err) {
        cm.log.error('ERROR: createAndSendInvoice(): (err, paypalResponse): ', err, paypalResponse);
        callback(err, paypalResponse);
        return;
    }

    /* Extract the REDIRECT field */
    var redirectUrl;
    for(var i=0; i < paypalResponse.links.length; i++) {
        var link = paypalResponse.links[i];
        if (link.method === 'REDIRECT') {
            redirectUrl = link.href;
            break;
        }
    }

    /* Update Purchase Details with the extra information */
    purchaseDetails.status = 'pending payment confirmation';
    purchaseDetails.paymentDetails = {
        method           : vendorName,
        vendorPaymentId  : paypalResponse.id,
        vendorPaymentURL : redirectUrl,
        vendor           : vendorName,
        valueUSD         : purchaseDetails.valueUSD,
        currency         : 'USD',
        valueCurrency    : purchaseDetails.valueUSD,
        invoiceURL       : redirectUrl,
        vendorStatus     : paypalResponse.state
    };

    callback(null);

}



/**
 * Parse the invoice to see if it has been paid, then set the purchase to paid.
 * @param  {object}   bitpayPost The POST from bitpay.
 * @param  {Function} callback   The standard callback
 */
var fs = require('fs');
exports.completePayment = completePayment;
function completePayment(paypalPayerId, paymentId, callback) {

    /* Save the purchase to a log */
    fs.appendFile(purchaseLogfile, '\nupdateInvoiceState():' + new Date() + ':' + paypalPayerId + '; ' + paymentId, function (err) {
        if (err) {
            cm.log.error('ERROR: updateInvoiceState(): writing to purchase log: ' + purchaseLogfile);
        }
    });

    var details = { 'payer_id': paypalPayerId };
    paypal_api.payment.execute(paymentId, details, function(err, obj){


        if (err) {
            callback(err);
        } else {
            var paymentDetails = {
                method           : vendorName,
                currency         : obj.transactions[0].amount.currency,
                vendorStatus     : obj.state,
                valueCurrency    : parseFloat(obj.transactions[0].amount.total),
                valueUSD         : parseFloat(obj.transactions[0].amount.total),
                vendorPaymentId  : obj.id,
                vendor           : vendorName,
                invoiceURL       : ''
            };
            am.updatePurchaseStatus(paymentDetails, callback);
        }
    });

}