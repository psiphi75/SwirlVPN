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

var request = require('request');
var test    = require('tap').test;
var cm      = require('../common');


var post_json = {
    url: cm.getKeygenURL(cm),
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        userId: cm.makeId(32, false),
        email: 'test@example.com'
    })
};

/*
 * Tests to ensure the keygen server is running correctly.
 */
test('Post to keygen server works', function(t) {
    request.post(post_json, function(error, response, body){

        var serverResponse = (!error && response.statusCode == 200);

        t.ok(serverResponse, 'The response code from server is okay.');

        var data = JSON.parse(body);
        var keyEndStr = '-----END PRIVATE KEY-----';
        var crtEndStr = '-----END CERTIFICATE-----';
        if (serverResponse) {

            t.ok(data.hasOwnProperty('userId'), 'The data contains "userId" property');
            t.ok(data.hasOwnProperty('key'),    'The data contains "key" property');
            t.ok(data.hasOwnProperty('crt'),    'The data contains "crt" property');

            t.ok(data.key.indexOf(keyEndStr) !== -1, 'key appears to exist');
            t.ok(data.crt.indexOf(crtEndStr) !== -1, 'crt appears to exist');
        }

        // End of tests
        t.end();
    });
});

