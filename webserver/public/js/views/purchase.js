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
/*global $,PurchaseValidator,pricingData,CommonRoutines */

$(document).ready(function(){

    var pv = new PurchaseValidator();
    var cm = new CommonRoutines();

    /**************************************************************
     *
     *     This section deals with the slider and it's changes
     *
     **************************************************************/

    /** Set the default value for slider, in units of the slider */
    var defaultValue=90;
    var customAmountData = $('#amount-data');
    var customAmountDataPrice = $('#amount-data-price');
    var customAmountDataID = $('#amount-data-id');

    function setAmountData(num) {
        var gbValue = roundFloat(pricingData[num][0], 1);
        customAmountData.text(gbValue + ' GB');
    }
    function setAmountPrice(num) {
        var price = roundFloat(pricingData[num][1], 2);
        customAmountDataPrice.text('$' + price);
    }
    function setAmountID(num) {
        customAmountDataID.text(num);
    }
    function roundFloat(num, num_digits) {
        var big10 = Math.pow(10, num_digits);
        return parseFloat(Math.round(num * big10) / big10).toFixed(num_digits);
    }

    /* Set the values of the custom price / data */
    setAmountData(defaultValue);
    setAmountPrice(defaultValue);
    setAmountID(defaultValue);


    /* Enable the custom plan slider */
    var sliderElement = $('#sl1');
    sliderElement.slider({
        formater: function(value) {
            return 'Current value: ' + value;
        }
    });

    sliderElement.on('slideStop', sliderStopped);
    sliderElement.on('slide', sliderChanged);


    function sliderChanged(slideEvent) {
        setAmountData(slideEvent.value);
        setAmountPrice(slideEvent.value);
        setAmountID(slideEvent.value);
    }

    function sliderStopped(slideEvent) {
        sliderChanged(slideEvent);

        var activeThis = $('#btn-data-plan-custom');
        btnHighlight(activeThis, 'data-plan');
    }

    /**************************************************************
     *
     *           This section deals with the button clicks
     *
     **************************************************************/

    /* Selection for a data plan */
    $('.btn-data-plan').on('click', function() {
        btnHighlight(this, 'data-plan');
    });

    /* Selection for the payment method */
    $('.btn-payment-method').on('click', function() {
        btnHighlight(this, 'payment-method');
    });

    /* Clicks for the sign-up and login buttons */
    $('#btn-sign-up').on('click', function() {
        window.location.href = '/signup';
    });
    $('#btn-login').on('click', function() {
        window.location.href = '/login';
    });

    /* Highlight the given button and update the hidden payment form */
    function btnHighlight(activeThis, btnType) {

        /* Highlight the current button and deactivate all others */
        var $activeThis = $( activeThis );
        $activeThis.addClass( 'active' );

        $('.btn-' + btnType).each(function() {
            if ( ! $activeThis.is(this)) {
                $( this ).removeClass( 'active' );
            }
        });

        /* update the hidden form */
        if (btnType === 'data-plan') {
            updateHiddenForm(activeThis, 'data-plan-name');
            updateHiddenForm(activeThis, 'data-plan-gb');
            updateHiddenForm(activeThis, 'data-plan-price');
            updateHiddenForm(activeThis, 'data-plan-id');
        } else if (btnType === 'payment-method') {
            updateHiddenForm(activeThis, 'payment-method-name');
        }
    }



    /* A generic function to change the values in the payment form */
    function updateHiddenForm(activeThis, selectorName) {
        var val = $(activeThis).find('.btn-' + selectorName).text();
        $('#payment-form-' + selectorName).val(  val  );
    }

    /* Set the "Next" button to waiting */
    function setWaitingButton(showImage) {

        var btn = $($('#btn-next')[0]);
        var newHtml;
        if (showImage === true) {
            newHtml = '<img src="/img/waitbutton-loading.gif">';
            btn.addClass('disabled');
        } else {
            newHtml = 'Next';
            btn.removeClass('disabled');
        }
        btn.html(newHtml);
    }


    $('#payment-form').ajaxForm({
        beforeSubmit : function(formData, jqForm, options) {

            var result = pv.validateForm();

            if (result === true) {
                setWaitingButton(true);
            }
            return result;
        },
        success: function (result) {
            window.location.href = result.vendorPaymentURL;
        },
        error: function(response){
            setWaitingButton(false);
            cm.showAlert({
                title: 'Error:  There was a problem.',
                text: 'Please try again.<br><br>Error: ' + response.responseText
            });
        }
    });

});