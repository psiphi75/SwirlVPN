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

/*jslint node:true*/
'use strict';

var test    = require('tap').test;
var cm      = require('../common');
var cub     = require('../regionalServer/countUserBytes');

cm.log.error = function(){};
cub.init(cm);

var inputUserList = [
    {
        userId     : 'UserID_1',
        assignedIP : '1.0.0.1'
    }, {
        userId     : 'UserID_2',
        assignedIP : '1.0.0.2'
    }
];


test('Add, remove and get some users', function(t) {

    /* Parse some lines */
    t.equal(cub.parseLine(testLine1), 0, 'Parse line 1');
    t.equal(cub.parseLine(testLine2), 0, 'Parse line 2');
    t.equal(cub.parseLine(testLine3), 0, 'Parse line 3');
    t.equal(cub.parseLine(testLine4), 0, 'Parse line 4');
    t.equal(cub.parseLine(testLine5), 20, 'Parse line 5');
    t.equal(cub.parseLine(testLine6), 0, 'Parse line 6');
    t.equal(cub.parseLine(testLine7), 0, 'Parse line 7');
    t.equal(cub.parseLine(testLine8), 1, 'Parse line 8');
    t.deepEqual(cub.getUserList(), { '1.0.0.2': { userId: null, bytesToClientSaved: 20, touched: false },
                                     '1.0.0.3': { userId: null, bytesToClientSaved: 1, touched: false } }, 'User list after some parsing');

    /* Update the user list, this will remove the 1.0.0.3 user */
    cub.updateUserList(inputUserList);
    t.deepEqual(cub.getUserList(), { '1.0.0.2': { userId: 'UserID_2', bytesToClientSaved: 20, touched: true },
                                     '1.0.0.1': { userId: 'UserID_1', bytesToClientSaved: 0, touched: true } }, 'User list after updateUserList()');

    /* Check the bytesToClientSaved for each  */
    t.equal(cub.getUsersbytesToClientSaved('1.0.0.1'), 0, 'Balance of first user');
    t.equal(cub.getUsersbytesToClientSaved('1.0.0.2'), 20, 'Balance of second user');
    t.equal(cub.getUsersbytesToClientSaved('1.0.0.99'), 0, 'Balance of some random user');

    cub.close();

    t.end();

});

var testLine1 = '1402372959.505 335 1.0.0.2 T 4393 4393 GET http://google.co.nz';
var testLine2 = '1402373434.433 90000 1.0.0.2 Z 0 0 ? ?';
var testLine3 = '1402373435.099 90000 1.0.0.2 Z 0 0 ? ?';
var testLine4 = '1402373436.076 90000 1.0.0.2 Z 0 0 ? ?';
var testLine5 = '1402372960.597 476 1.0.0.2 T 25 5 GET http://www.google.co.nz';
var testLine6 = '1402372961.199 418 1.0.0.1 T 3131 3131 GET http://www.google.co.nz';
var testLine7 = '1402373440.856 11687 1.0.0.1 T 1749 1749 GET http://www.google.com';
var testLine8 = '1402373436.076 90000 1.0.0.3 Z 1 0 GET http://www.google.co.nz/';

