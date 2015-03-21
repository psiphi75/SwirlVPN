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

function LoginController()
{

// bind event listeners to button clicks //

	$('#login-form #forgot-password').click(function(){ $('#get-credentials').modal('show');});

// automatically toggle focus between the email modal window and the login form //

    $('#get-credentials').on('shown.bs.modal', function(){
    	$('#email-modal-tf').focus();
    });
	$('#get-credentials').on('hidden.bs.modal', function(){
		$('#email-tf').focus();
	});

}