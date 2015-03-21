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

var cm = new CommonRoutines();

function LoginValidator() {}

LoginValidator.prototype.validateForm = function(formData) {

    var password = $('#password-tf').val();

	if (! cm.isValidEmail( $('#email-tf').val() )){
		cm.showAlert({ title:'Whoops!', text:'Please enter a valid email' });
		return false;
	} else if (! cm.isValidPassword( password )) {
		cm.showAlert({ title:'Whoops!', text:'Please enter a valid password' });
		return false;
	} else {
        /* Set a secure password in the text field */
        var encodedPW = cm.encodePassword(password);
        $('#password-tf').val(encodedPW);
        for (var i=0; i<formData.length; i++) {
            if (formData[i].name && formData[i].name === 'password') {
                formData[i].value = encodedPW;
                break;
            }
        }
		return true;
	}
};

