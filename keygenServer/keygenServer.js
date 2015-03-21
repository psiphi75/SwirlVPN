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

/**
 * keygenServer.js
 *
 * This is the key generation server.  This server opens a port and listens to
 * requests.  When a request comes, it will generate a key based on a UserId.
 *
 */

/*jslint node:true*/
'use strict';

/* Import our configuration settings */
var cm      = require('../common');
var keygen  = require('./runPkitool').keygen;

var express = require('express');
var bodyParser = require('body-parser');

cm.log.error('BOOTING: ', new Date());


/*
 * Now we can start with the server
 */

var server = express();
server.use(bodyParser());

/*
 * Set up the server to listen to the given keygen server URL.
 */
server.post(cm.cfg('keygenServer:url'), function (req, res) {

    cm.log.debug('New keygen request received: ' + req.ip);

    // Parse the JSON request, make sure it's okay.
    try {
        // Make sure it contains the objects
        cm.assertHasProperty(req.body, 'userId');

    } catch (err) {
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.end();
        cm.log.error('ERROR: Client sent bogus json. Error: ' + err);
        return;
    }

    // We have the userId, now we just need to generate the key.
    keygen(req.body.userId, function (keyData) {

        res.writeHead(200, {'Content-Type': 'text/json'});
        res.write(keyData);
        res.end();

    });
});

/*
 * ... and now we start the server
 */
server.listen(cm.cfg('keygenServer:port'));
cm.log.info('Server running at http://' + cm.cfg('keygenServer:host') + ':' + cm.cfg('keygenServer:port'));

