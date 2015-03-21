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

function AccountValidator(){

    cm = new CommonRoutines();

// build array maps of the form inputs & control groups //

    this.formFields    = [$('#email-tf'), $('#password-tf')];
    this.controlGroups = [$('#email-cg'), $('#password-cg')];
}

AccountValidator.prototype.validateForm = function(formData)
{
    var password = $('#password-tf').val();

    var errList = [];
    for (var i=0; i < this.controlGroups.length; i++) this.controlGroups[i].removeClass('has-error');
    if ( ! cm.isValidEmail(this.formFields[0].val())) {
        this.controlGroups[0].addClass('has-error');
        errList.push('Please Enter A Valid Email');
    }
    if ( ! cm.isValidPassword(this.formFields[1].val())) {
        this.controlGroups[1].addClass('has-error');
        errList.push('Password Should Be At Least 6 Characters');
    } else {
        /* Set a secure password in the text field */
        var encodedPW = cm.encodePassword(password);
        $('#password-tf').val(encodedPW);
        for (var x=0; x<formData.length; x++) {
            if (formData[x].name && formData[x].name === 'password') {
                formData[x].value = encodedPW;
                break;
            }
        }
    }
    if (errList.length) cm.showErrors({
                                    title: 'Error!',
                                    text: 'Please correct the following problems :',
                                    errors: errList
                                });
    return errList.length === 0;
};

AccountValidator.prototype.validateFormForUpdate = function()
{
    var errList = [];
    for (var i=0; i < this.controlGroups.length; i++)
        this.controlGroups[i].removeClass('has-error');

    if (this.formFields[0].val() === '' && this.formFields[1].val() === '') {

        this.controlGroups[0].addClass('has-error');
        this.controlGroups[1].addClass('has-error');
        errList.push('Please enter a new email or new password.');

    } else {

        if ( this.formFields[0].val() !== '' && ! cm.isValidEmail(this.formFields[0].val())) {
            this.controlGroups[0].addClass('has-error');
            errList.push('Please Enter A Valid Email');
        }
        if ( this.formFields[1].val() !== '' && ! cm.isValidPassword(this.formFields[1].val())) {
            this.controlGroups[1].addClass('has-error');
            errList.push('Password Should Be At Least 6 Characters');
        }

    }
    if (errList.length) cm.showErrors({
                                    title: 'Error!',
                                    text: 'Please correct the following problems :',
                                    errors: errList
                                });
    return errList.length === 0;
};