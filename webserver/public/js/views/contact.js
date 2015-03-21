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
/*global $,ContactValidator, CommonRoutines*/

$(document).ready(function(){

    var cv = new ContactValidator();
    var cm = new CommonRoutines();

    $('#contact-form').ajaxForm({
        beforeSubmit : function(formData, jqForm, options){
            var formOk = cv.validateForm();
            if (formOk) {
                cm.showAlert({
                    title:'Comment Submitted',
                    text:'Thank you, your comment has been submitted, we will try to respond as soon as possible.',
                    redirect:'/'
                });
            }
            return formOk;
        },
        success : function(responseText, status, xhr, $form){
            return true;
        },
        error : function(e){
            cm.showAlert({
                    title:'Error',
                    text:'There was an error submitting your comment, please try again later.'
            });
        }
    });
    $('#email-tf').focus();

});

