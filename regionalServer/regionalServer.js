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
 * regionalServer.js
 *
 * This is where the fun happens on the regional server.  This service will
 * continuously run and monitor OpenVPN via a telnet interface as well as
 * monitoring the OpenVPN Log.
 *
 * The Telnet interface is used to kill user sessions and boot users when they
 * have used all their data.
 *
 * The Status Log reader will see which users are connected, then communicate
 * these to the master server.  The master server will respond with which ones
 * should be booted.
 *
 */


/*jslint node:true*/
'use strict';

var request         = require('request');

/* Import our configuration settings */
var cm              = require('../common');
var async           = require('async');

var ovpnConnection;
var secretKey = cm.cfg('ovpnServer:webservice:key');
var webserviceHost = cm.cfg('ovpnServer:webservice:host');
var webservicePort = cm.cfg('ovpnServer:webservice:port');

var webserviceUpdateURL = 'http://' + webserviceHost + ':' + webservicePort + cm.cfg('ovpnServer:webservice:routes:vpn-update-stats');
var countUserBytes = require('./countUserBytes');
countUserBytes.init(cm);

cm.log.error('BOOTING: ', new Date());


async.series([
        startOvpnTelnetManagement,
        setupOvpnReader,
    ]);


/**
 * Start the telnet session with the OpenVPN management server
 */
function startOvpnTelnetManagement(callback) {

    var net = require('net');
    var socket = {
        host : cm.cfg('ovpnServer:ovpnProcess:managementInterface:ip'),
        port : cm.cfg('ovpnServer:ovpnProcess:managementInterface:port')
    };
    var loginPW  = cm.cfg('ovpnServer:ovpnProcess:managementInterface:password') + '\n\r';

    ovpnConnection = net.connect(socket, function() {
        cm.log.debug('Connected to OpenVPN management server');
    });

    ovpnConnection.on('data', function(buf) {
        var data = buf.toString();
        if (data === 'ENTER PASSWORD:') {
            ovpnConnection.write(loginPW);

            /* By now we should be connected */
            callback(null);
        }

        /* Don't print out the standard */
        if (data[0] !== '>') {
            cm.log.debug('ovpnConnection: ' + data);
        }
    });

    /* This activity should never be called, let's restart server when it is */
    ovpnConnection.on('end', function() {
        cm.log.error('ERROR: Disconnected from OpenVPN management server');
        process.exit(-1);
    });

    /* This activity should never be called, let's restart server when it is */
    ovpnConnection.on('error', function(err) {
        cm.log.error('ERROR: Unable to connect to OpenVPN management server: ' + err);
        process.exit(-1);
    });

}


/**
 * Disconnect users from OpenVPN.
 * @param userList - list of users.
 */
function bootVpnUsers(userIdListToBoot) {
    for (var user in userIdListToBoot) {
        var userId = userIdListToBoot[user];
        cm.log.info('booting user with userId: ' + userId);
        ovpnConnection.write('kill ' + userId + '\n\r');
        countUserBytes.removeUser(userId);
    }
}



// Sample from the OpenVPN status.log file:
//    TITLE,OpenVPN 2.2.1 x86_64-linux-gnu [SSL] [LZO2] [EPOLL] [PKCS11] [eurephia] [MH] [PF_INET6] [IPv6 payload 20110424-2 (2.2RC2)] built on Feb 13 2013
//    TIME,Thu Aug  8 10:20:24 2013,1375957224
//    HEADER,CLIENT_LIST,Common Name,Real Address,Virtual Address,Bytes Received,Bytes Sent,Connected Since,Connected Since (time_t)
//    CLIENT_LIST,88goNcBQ0T9nGsIBXyx4br7ZjNw4E1fj,103.9.42.133:14702,10.8.0.5,21302,6844,Thu Aug  8 10:19:14 2013,1375957154
//    HEADER,ROUTING_TABLE,Virtual Address,Common Name,Real Address,Last Ref,Last Ref (time_t)
//    ROUTING_TABLE,be:7c:49:97:99:82,88goNcBQ0T9nGsIBXyx4br7ZjNw4E1fj,103.9.42.133:14702,Thu Aug  8 10:19:17 2013,1375957157
//    GLOBAL_STATS,Max bcast/mcast queue length,0
//    END
function setupOvpnReader(callback) {

    var fs = require('fs');
    var ovpnStatusLog     = cm.cfg('ovpnServer:ovpnProcess:logs:status');
    var ovpnStatusLogFreq = cm.cfg('ovpnServer:ovpnProcess:logs:frequency');

    /* Read the log files on a regular basis */
    /* Can actually get this via telnet session to management console of OpenVPN, and write the string: 'status' */
    setInterval(function () {
        fs.readFile(ovpnStatusLog, 'utf8', readOvpnStatusLog);
    }, ovpnStatusLogFreq);


    /**
     * Read the OpenVPN status log file and then call the update the user stats function.
     * @param err
     * @param textFile - the data from the log file
     */
    function readOvpnStatusLog(err, textFile) {
        if (err) {
            cm.fatalError(err, cm.getEnvVars(cm));
            return;
        }
        var userList = parseStatusLog(textFile);
        updateUserStats(userList);
    }


    /**
     * Update the account management DB with the user stats.
     * @param userList - the list of users connected to OpenVPN
     */
    function updateUserStats(userList) {


        /* TODO: Update only when the number of bytes change for a given user (maybe even if it changes more than 1MB)
         *       This will significantly reduce the connections to the DB. */
        var noUsers = userList.length === 0;

        if (!noUsers) {

            var body = {
                key   : secretKey,
                users : userList
            };

            var options = {
                body: body,
                json: true
            };

            /* Send the request */
            request.post(webserviceUpdateURL, options, function(error, response, body) {
                if (!error) {
                    bootVpnUsers(body);
                }
            });

        }
    }


    /**
     * This function will parse the status log and return an object array of logged in users.
     * @param textFile - the text data returned from reading the openVPN status log.
     * @returns userList - the list of user data.
     */
    function parseStatusLog(textFile) {

        var lines = textFile.toString().split('\n');
        var userList = [];
        var userIdList = [];

        for (var i=0; i<lines.length; i++) {
            var words = lines[i].split(',');

            if (words.length > 0  &&  words[0] === 'CLIENT_LIST') {
                var userId = words[1];
                var assignedIP = words[3];
                var user = {
                        userId            : userId,
                     /* clientIP          : words[2], */
                        assignedIP        : assignedIP,
                        bytesFromClient   : parseInt(words[4], 0),
                        bytesToClient     : parseInt(words[5], 0),
                        dateConnectedUnix : parseInt(words[7], 0),
                        bytesToClientSaved        : countUserBytes.getUsersbytesToClientSaved(userId, assignedIP)
                };
                userIdList.push(userId);
                userList.push(user);
            }
        }

        /* Reset the userList */
        countUserBytes.updateUserList(userIdList);

        return userList;
    }

    callback(null);
}
