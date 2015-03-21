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
/*global $ */

function EmailValidator() {

// bind this to _local for anonymous functions //

    var _local = this;

// modal window to allow users to request credentials by email //
    _local.retrievePassword = $('#get-credentials');
    _local.retrievePassword.modal({ show : false, keyboard : true, backdrop : 'static' });
    _local.retrievePasswordAlert = $('#get-credentials .alert');
    _local.retrievePassword.on('show.bs.modal', function(){
        $('#get-credentials-form').resetForm();
        _local.retrievePasswordAlert.hide();
    });

}

EmailValidator.prototype.showEmailAlert = function(m)
{
    this.retrievePasswordAlert.attr('class', 'alert alert-error');
    this.retrievePasswordAlert.html(m);
    this.retrievePasswordAlert.show();
};

EmailValidator.prototype.hideEmailAlert = function()
{
    this.retrievePasswordAlert.hide();
};

EmailValidator.prototype.showEmailSuccess = function(m)
{
    this.retrievePasswordAlert.attr('class', 'alert alert-success');
    this.retrievePasswordAlert.html(m);
    this.retrievePasswordAlert.fadeIn(500);
};