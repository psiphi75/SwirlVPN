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

function ContactValidator(){

// build array maps of the form inputs & control groups //

    this.formFields    = [$('#email-tf'), $('#subject-tf'), $('#comment-tf')];
    this.controlGroups = [$('#email-cg'), $('#subject-cg'), $('#comment-cg')];

}


ContactValidator.prototype.validateForm = function()
{
    var errList = [];
    for (var i=0; i < this.controlGroups.length; i++) {
        this.controlGroups[i].removeClass('has-error');
    }
    if ( ! cm.isValidEmail( this.formFields[0].val() )) {
        this.controlGroups[0].addClass('has-error');
        errList.push('Please enter a valid email address');
    }
    if ( ! cm.isValidSubject( this.formFields[1].val() )) {
        this.controlGroups[1].addClass('has-error');
        errList.push('Please select a subject');
    }
    if ( ! cm.isValidString( this.formFields[2].val(), 5)) {
        this.controlGroups[2].addClass('has-error');
        errList.push('Please enter a reasonable comment');
    }
    if (errList.length) cm.showErrors({
                                        title: 'Error',
                                        text: 'Please correct the following problems :',
                                        errors: errList
                                      });
    return errList.length === 0;
};