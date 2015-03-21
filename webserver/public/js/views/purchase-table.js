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

'use strict';
/*global $,tableData,CommonRoutines */

$(document).ready(function() {

    var cm = new CommonRoutines();

    if (location.hash === '#PurchaseConfirmation') {
        /* Get the most recent purchase */
        var purchaseDetails = tableData[0];
        showPurchaseDataModal(purchaseDetails, 'Thank you for your purchase!!!');
        removeHash();
    }

    $('.clickableRow').click(function() {
        var id = this.id;
        var purchaseDetails = tableData[id];
        showPurchaseDataModal(purchaseDetails);
    });

    function showPurchaseDataModal(purchaseDetails, titleText) {

        var $m = $('#modal-display-data');
        $m.modal({ show : false, keyboard : true, backdrop : true });

        if (typeof(titleText) === 'string') {
            $m.find('.modal-title').html(titleText);
        }

        $m.find('#planName').html('<b>Plan Name:</b>&nbsp;&nbsp;&nbsp; ' + purchaseDetails.name);
        $m.find('#purchaseDate').html('<b>Purchase Date:</b>&nbsp;&nbsp;&nbsp; '      + formatDate(purchaseDetails.datePurchased));
        $m.find('#expiryDate').html('<b>Expiry Date:</b>&nbsp;&nbsp;&nbsp; '          + formatDate(purchaseDetails.dateExpires));
        $m.find('#purchaseStatus').html('<b>Status:</b>&nbsp;&nbsp;&nbsp; '           + purchaseDetails.status);
        $m.find('#bytesPurchased').html('<b>Bytes Purchased:</b>&nbsp;&nbsp;&nbsp; '  + cm.bytesToSize(purchaseDetails.bytesPurchased, 1));
        $m.find('#bytesRemaining').html('<b>Bytes Used:</b>&nbsp;&nbsp;&nbsp; '       + cm.bytesToSize(purchaseDetails.bytesUsed, 1));
        $m.find('#paymentDetails').html('<b>Paymenet Details:</b>&nbsp;&nbsp;&nbsp; ' + getObjectAsHTML(purchaseDetails.paymentDetails));

        $m.modal('show');
    }

    function formatDate(dt) {
        var d = new Date(dt).toLocaleDateString();
        var t = new Date(dt).toLocaleTimeString();
        return d + ' ' + t;
    }

    function removeHash () {

        /* IE9 and lower does not support pushState */
        if (history.pushState) {
            history.pushState('', document.title, window.location.pathname + window.location.search);
        }
    }

    function getObjectAsHTML(obj) {
        var result = '<ul>';
        for (var key in obj) {
            var value = obj[key];
            result += '<li><b>' + key + ':</b>&nbsp;&nbsp;' + value + '</li>';
        }

        return result + '</ul>';
    }

});