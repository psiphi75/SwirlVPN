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
 * masterWebservice.js
 *
 * This WebService runs on the master server cluster.  It monitors the ports and
 * regional servers will connect to it.  The regional server will request
 * authorisation for a user to connect.  This authorisation is made by a simple
 * wget call.  See fnVPNconnections().
 *
 * Sucess will return a 200 return code and failure will return a different
 * code.
 *
 * This WebService will also list for regional servers to check if a user has
 * used up all of their bytes allocation (see fnUserUpdateStats() ).  If this
 * happens, the user will be booted from the VPN connection.
 *
 * We use very basic token to ensure the incoming requests are not fraudulent.
 * Although the connection between the regional and master server is via and
 * OpenVPN tunnel, it ensures hackers with access to one node cannot connect
 * to the master node.
 */


/*jslint node:true*/
'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var app = express();

var cm = require('../common');
var am = require('../common/account-manager');
    am.init({ loadOvpnConfig:false }, function(){});

cm.log.error('BOOTING: ', new Date());

/*
 * Start express webservice
 */
app.use(bodyParser());

securePost(app, cm.cfg('ovpnServer:webservice:routes:vpn-connections'), fnVPNconnections);
securePost(app, cm.cfg('ovpnServer:webservice:routes:vpn-update-stats'), fnUserUpdateStats);

app.listen(cm.cfg('ovpnServer:webservice:port'));


var secretKey = cm.cfg('ovpnServer:webservice:key');
var allowed_ip_range = cm.cfg('ovpnServer:webservice:allowed_ip_range');


/*
 * Handle user connection and disconnections.
 */
function fnVPNconnections(err, req, res, data) {

    if (err) {
        /* Silently drop the request */
        return;
    }

    data.timeISO = cm.t_unix2iso(data.timeUnix);

    /* Check the request type */
    switch (data.scriptType) {
        case 'client-connect':
            checkvpnUserApproveLoginAndConnect(req, res, data);
            break;
        case 'client-disconnect':
            vpnUserDisconnect(req, res, data);
            break;
        default:
            cm.log.error('ERROR: Unexpected scriptType: ' + data.scriptType + ', from IP: ' + req.ip);
            res.send('Unexpected scriptType:', 400);
    }
}


/*
 * Handle user statistic updates.
 */
function fnUserUpdateStats(err, req, res, data) {

    if (err) {
        /* Silently drop the request */
        return;
    }

    var userList = data.users;
    am.vpnUserUpdateStats(userList, function(err, userIdListToBoot) {
        if (!err) {
            res.send(userIdListToBoot, 200);
        } else {
            res.send('Something not so good occurred', 500);
        }
    });
}


/**
 * Checks the user exists and has bytes in their balance.  Returns status code 200 if
 * the login was successful, status code 401 (Unauthorised) if the user is refused.
 * @param req - the request info
 * @param res - the result info to send back
 * @param data - the data related to the connection
 */
function checkvpnUserApproveLoginAndConnect(req, res, data) {
    am.vpnUserApproveLoginAndConnect(data, function checkvpnUserApproveLoginAndConnectCB(err) {
        if (err === null) {
            res.send(200, 'Ok');
            cm.log.debug('User approved VPN log in, userId: ' + data.userId);
        } else {
            res.send(401, 'Not Ok');
            cm.log.error('ERROR: checkvpnUserApproveLoginAndConnectCB(): ' + err);
        }
    });
}


/**
 * Deletes a user connection record in the DB.
 * @param req - the request info
 * @param res - the result info to send back
 * @param data - the data related to the connection
 */
function vpnUserDisconnect(req, res, data) {
    am.vpnUserDisconnected(data, function (e) {
        if (e === null) {
            res.send(200, 'Ok');
            cm.log.info('user disconnected, userId: ' + data.userId);
        } else {
            res.send(401, 'Not Ok');
            cm.log.error('ERROR: vpnUserDisconnect(): error updating user records, userId: ' + data.userId);
        }
    });
}


/**
 * This function wraps all routes for the webservice, it ensures we handle requests
 * from the correct IP range and ensure the calling functions have the correct key.
 * @param  {String}   route    The route of the webservice call
 * @param  {Function} callback The callback function
*/
function securePost(app, route, callback) {

    app.post(route, function (req, res) {

        /* Make sure the request is coming from an expected IP address */
        if(! strStartsWith(req.ip, allowed_ip_range)) {
            cm.log.error('SECURITY ERROR: webservice:post to /: request from unknown ip: ', req.ip, allowed_ip_range);
            callback('There was an error', req, res, null);
            return;
        }

        /* Check the key */
        var req_key = req.body.key;

        if (req_key !== secretKey) {
            cm.log.error('SECURITY ERROR: webservice:post to /: incorrect key supplied: ', req_key);
            callback('There was an error', req, res, null);
            return;
        }

        var data = req.body;

        callback(null, req, res, data);

    });
}

/**
 * Returns true if the searchStr starts with startStr
 * @param  {String} searchStr The string being searched
 * @param  {String} startStr  The start string
 * @return {Boolean}
 */
function strStartsWith(searchStr, startStr) {
    return searchStr.indexOf(startStr) === 0;
}