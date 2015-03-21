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
/*global $,LoginValidator,LoginController,EmailValidator,CommonRoutines */

$(document).ready(function(){

	var lv = new LoginValidator();
	var lc = new LoginController();
    var cm = new CommonRoutines();

// main login form //

	$('#login-form').ajaxForm({
		beforeSubmit : function(formData, jqForm, options){
			return lv.validateForm(formData);
		},
		success	: function(responseText, status, xhr, $form){
			if (status == 'success') window.location.href = '/account_details';
		},
		error : function(e){
			cm.showAlert({title:'Login Failure', text:'Please check your username and/or password'});
			$('#password-tf').val('');
		}
	});
	$('#email-tf').focus();

// login retrieval form via email //

	var ev = new EmailValidator();

	$('#get-credentials-form').ajaxForm({
		url: '/lost_password',
		beforeSubmit : function(formData, jqForm, options){
			if ( cm.isValidEmail($('#email-modal-tf').val() )) {
				ev.hideEmailAlert();
				return true;
			}	else{
				ev.showEmailAlert('<b> Error!</b> Please enter a valid email address');
				return false;
			}
		},
		success	: function(responseText, status, xhr, $form){
			ev.showEmailSuccess('Check your email on how to reset your password.');
		},
		error : function(){
			ev.showEmailAlert('Sorry. There was a problem, please try again later.');
		}
	});

});