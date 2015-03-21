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
 * bitpay.js.
 *
 * Code for BitPay payment handling.
 */

/*jslint node:true*/
'use strict';

var https = require('https');
var cm;
var am;

var invoiceCurrency;
var notificationURL;
var defaultTransactionSpeed;
var notificationEmail;
var apiKey;
var vendorName;
var purchaseLogfile;
var method;
var paymentURL;

exports.init = function init(_am, _cm) {
    am = _am;
    cm = _cm;

    notificationURL             = cm.getWebserverURL() + cm.cfg('payment:bitpay:notificationURL');
    invoiceCurrency             = cm.cfg('payment:bitpay:invoiceCurrency');
    defaultTransactionSpeed     = cm.cfg('payment:bitpay:defaultTransactionSpeed');
    notificationEmail           = cm.cfg('payment:bitpay:notificationEmail');
    apiKey                      = cm.cfg('payment:bitpay:apiKey');
    vendorName                  = cm.cfg('payment:bitpay:vendorName');
    purchaseLogfile             = cm.cfg('purchase:logFile');
    method                      = cm.cfg('payment:bitpay:method');
    paymentURL                  = cm.cfg('payment:bitpay:paymentURL');

    /* Every hour check all the payments are paid */
    setInterval(function () {
        am.findOutstandingVendorPaymentIds(function (err, outstandingInvoiceIdList) {
            if (err) return;
            getUpdatesFromBitpay(outstandingInvoiceIdList);
        });
    }, 3600*1000);
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
        cm.log.error('ERROR: createAndSendInvoice(): ', err);
        callback(err, null);
        return;
    }

    var bytesStr = cm.bytesToSize(purchaseDetails.bytesPurchased, 1);
    var bitpayInvoicePost = {
        price :                 purchaseDetails.valueUSD,
        currency :              invoiceCurrency,

        /* Optional payment notification fields */
        posData :
            'purchaseId:' + purchaseDetails.purchaseId +
            ',userId:'    + purchaseDetails.userId,
        transactionSpeed :      defaultTransactionSpeed,
        fullNotifications :     true,
        notificationEmail :     notificationEmail,

        /* Optional Buyer Information fields */
        orderID :               purchaseDetails.purchaseId,
        itemDesc :              'Plan: ' + purchaseDetails.name + ' (' + bytesStr + ')',
        itemCode :              bytesStr,
        physical :              false,

        /* buyer details */
        buyerEmail : purchaseDetails.email
    };

    if (process.env.NODE_ENV !== 'development') {
        bitpayInvoicePost.notificationURL = notificationURL;
    }

    sendInvoice(bitpayInvoicePost, function createAndSendInvoiceCB(err, bitpayResponse) {

        if (err) {
            cm.log.error('ERROR: createAndSendInvoiceCB(): ', err);
        }
        processBitpayResponse(purchaseDetails, bitpayResponse, callback);
    });

};


/**
 * This will process the response from the initial request to bitpay.
 * @param  {object}   purchaseDetails The purchase - gets updated inline.
 * @param  {object}   bitpayResponse  The actual result from bitpay.  This will be merged into purchaseDetails
 * @param  {Function} callback        cb(null) if all is okay.
 */
function processBitpayResponse(purchaseDetails, bitpayResponse, callback) {

    try {

        cm.assertHasProperty(bitpayResponse, 'id');
        cm.assertHasProperty(bitpayResponse, 'url');
        cm.assertHasProperty(bitpayResponse, 'posData');
        cm.assertHasProperty(bitpayResponse, 'status');
        cm.assertHasProperty(bitpayResponse, 'price');
        cm.assertHasProperty(bitpayResponse, 'currency');
        cm.assertHasProperty(bitpayResponse, 'btcPrice');

    } catch (err) {
        cm.log.error('ERROR: createAndSendInvoice(): (err, bitpayResponse): ', err, bitpayResponse);
        callback(err, bitpayResponse);
        return;
    }

    /* Update Purchase Details with the extra information */
    purchaseDetails.status = 'pending payment confirmation';
    purchaseDetails.paymentDetails = {
        method           : method,
        vendorPaymentId  : bitpayResponse.id,
        vendorPaymentURL : paymentURL + bitpayResponse.id,
        vendor           : vendorName,
        valueUSD         : bitpayResponse.price,
        currency         : bitpayResponse.currency,
        valueCurrency    : bitpayResponse.btcPrice,
        invoiceURL       : bitpayResponse.url,
        vendorStatus     : bitpayResponse.status
    };


    callback(null);

}



/**
 * This creates the request to send to BitPay.
 * @param  {object}   newInvoice The invoice object
 * @param  {Function} callback   Standard callback, get called on success / error
 */
function sendInvoice(newInvoice, callback) {

    var options = {
        host: 'bitpay.com',
        port: 443,
        path: '/api/invoice/',
        method: 'POST',
        auth: apiKey + ':',
        agent: false,
        rejectUnauthorized: true,
    };

    var req = https.request(options, function (res) {
        receiveJSON(res, callback);
    });

    req.on('error', function(err) {
        callback({error: {type: 'socketError', message: err.message}}, null);
    });

    /* Send the invoice to bitpay */
    req.setHeader('Content-Type', 'application/json');
    var str = JSON.stringify(newInvoice);
    req.setHeader('Content-Length', str.length);
    req.end(str);
}


/**
 * Parse the invoice to see if it has been paid, then set the purchase to paid.
 * @param  {object}   bitpayPost The POST from bitpay.
 * @param  {Function} callback   The standard callback
 */
var fs = require('fs');
exports.updateInvoiceState = updateInvoiceState;
function updateInvoiceState(bitpayPost, callback) {

    /* Save the purchase to a log */
    fs.appendFile(purchaseLogfile, '\nupdateInvoiceState():' + new Date() + ':' +JSON.stringify(bitpayPost), function (err) {
        if (err) {
            cm.log.error('ERROR: updateInvoiceState(): writing to purchase log: ' + purchaseLogfile);
        }
    });

    var paymentDetails = {
        method           : 'Bitcoin',
        currency         : 'BTC',
        vendorStatus     : bitpayPost.status,
        valueCurrency    : bitpayPost.btcPrice,
        valueUSD         : bitpayPost.price,
        vendorPaymentId  : bitpayPost.id,
        vendor           : vendorName,
        invoiceURL       : bitpayPost.url
    };

    am.updatePurchaseStatus(paymentDetails, callback);

}



function getUpdatesFromBitpay(outstandingInvoiceIdList) {

    var options = {
        hostname: 'bitpay.com',
        port: 443,
        method: 'GET',
        auth: apiKey + ':',
        agent: false,
        rejectUnauthorized: true,
    };

    outstandingInvoiceIdList.forEach(function (bitpayInvoiceId, i) {

        options.path = '/api/invoice/' + bitpayInvoiceId;

        /* Spread the requests to bitpay over time */
        setTimeout(function () {

            var req = https.get(options, function (res) {
                receiveJSON(res, function (err, bitpayPost) {
                    if (err) return;
                    updateInvoiceState(bitpayPost, function(){});
                });
            });

            req.on('error', function(err) {
                cm.log.error('ERROR: ', {error: {type: 'socketError', message: err.message}});
            });
        }, i * 500);

    });

}

function receiveJSON(res, callback) {
    var data = '';

    res.on('data', function(chunk) {
        data += chunk;
    });

    res.on('end', function() {
        var obj=null, err=null;
        try {
            obj = JSON.parse(data);
        } catch(e) {
            err = {error: {type: 'parsingError', message: 'Error parsing server response'}};
        }
        callback(err, obj);
    });

}