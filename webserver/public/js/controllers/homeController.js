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

function HomeController() {

    var cm = new CommonRoutines();

// bind event listeners to button clicks //
    var that = this;

// handle user logout //
    $('#btn-logout').click(function(){ that.attemptLogout(); });

// confirm account deletion //
    $('#account-form-btn-delete').click(function(){
        cm.showConfirm({
                       title: 'Delete Account',
                       text: 'Are you sure you want to delete your account?',
                       yesText: 'Delete!',
                       noText: 'Cancel',
                   });
    });

// handle account deletion //
    $('#modal-confirm .submit').click(function(){
        that.deleteAccount();
    });

    this.deleteAccount = function()    {
        $('#modal-confirm').modal('hide');
        $.ajax({
            url: '/delete',
            type: 'POST',
            data: { userId: $('#userId').val()},
            success: function(data){
                cm.showAlert({
                    title: 'Success!',
                    text: 'Your account has been deleted.<br>Redirecting you back to the homepage.',
                    redirect: '/'
                });            },
            error: function(jqXHR){
                console.log(jqXHR.responseText+' :: '+jqXHR.statusText);
            }
        });
    };

    this.attemptLogout = function()    {
        $.ajax({
            url: '/logout',
            type: 'POST',
            data: {logout : true},
            success: function(data){
                cm.showAlert({
                    title: 'Success!',
                    text: 'You are now logged out.<br>Redirecting you back to the homepage.',
                    redirect: '/'
                });
            },
            error: function(jqXHR){
                console.log(jqXHR.responseText+' :: '+jqXHR.statusText);
            }
        });
    };
}
