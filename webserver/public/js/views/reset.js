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
/*global $,ResetValidator,CommonRoutines */

$(document).ready(function(){

	var rv = new ResetValidator();
    var cm = new CommonRoutines();

	$('#set-password-form').ajaxForm({
		beforeSubmit : function(formData, jqForm, options) {
            rv.hideAlert();
			return rv.validateForm( formData );


		},
		success	: function(responseText, status, xhr, $form) {
			rv.showSuccess('Your password has been reset.');
			setTimeout(function(){ window.location.href = '/'; }, 3000);
		},
		error : function(){
			rv.showAlert('I\'m sorry something went wrong, please try again.');
		}
	});

	$('#set-password').modal('show');
	$('#set-password').on('shown', function(){ $('#password-tf').focus(); });

});