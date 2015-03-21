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
/*global $,CommonRoutines */

var cm;
function PurchaseValidator() {

    cm = new CommonRoutines();

}


PurchaseValidator.prototype.validateForm = function() {

    var errList = [];

    /* Check the user is logged in */
    var $usrSignedIn = $('#btn-logout').length === 1;
    if ($usrSignedIn === false) {
        errList.push('You must be signed in to make a purchase.');
    }

    /* Check the plans */
    var $activePlan = $('.btn-data-plan').filter('.active');
    var numberPlans = $activePlan.length;

    if (numberPlans === 0) {
        errList.push('Please select a data plan.');
    } else if (numberPlans > 1) {
        errList.push('Somehow you selected more than one plan, please select only one and try again.');
    }

    /* Check the payment method */
    var $paymentMethod = $('.btn-payment-method').filter('.active');
    var numberPaymentMethods = $paymentMethod.length;

    if (numberPaymentMethods === 0) {
        errList.push('Please select a payment method.');
    } else if (numberPaymentMethods > 1) {
        errList.push('Somehow you selected more than one payment method, please select only one and try again.');
    }

    /* Show errors if there are some */
    if (errList.length) cm.showErrors({
	                                title: 'An error has occurred!',
	                                text: 'You have the following problems, please correct them:',
	                                errors: errList
                                });
    return errList.length === 0;

};