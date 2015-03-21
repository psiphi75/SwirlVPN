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
/*global $,AccountValidator,CommonRoutines,Recaptcha */

$(document).ready(function(){

    var av = new AccountValidator();
    var cm = new CommonRoutines();

    $('#account-form').ajaxForm({
        beforeSubmit : function(formData, jqForm, options) {
            return av.validateForm(formData);
        },
        success : function(responseText, status, xhr, $form) {
            if (status == 'success') {
                cm.showAlert({
                    title:'Success',
                    text: 'You have been sent a registration email, please click the "Confirm Registration" link.',
                    redirect:'/account_details'
                });
            }
            return true;
        },
        error : function(e) {
            if (e.responseText === 'email-taken') {
                cm.showInvalidEmail();
            } else if (e.responseText === 'reCaptcha-failure') {
                cm.showReCaptchaFailure();
            }
            Recaptcha.reload();
            $('#password-tf').val('');

        }
    });

    $('#email-tf').focus();

});