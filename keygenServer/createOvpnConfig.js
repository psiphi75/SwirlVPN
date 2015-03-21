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
 * createOvpnConfig.js
 *
 * This creates the OpenVPN config files and saves them to the DB.
 *
 * CONFIG_TODO: You need to add the OpenVPN "OpenVPN Static key V1" and
 * "Certificate", see below.
 */


/*jslint node:true*/
'use strict';


/* Import our configuration settings */
var cm              = require('../common');
var mongo           = require('../common/mongo');
var async           = require('async');

var ovpnConfigs;

var IP_LIST_PLACEHOLDER = '[[REPLACE_ME]]';
var config =
    '# This is the configuration file that binds you to our VPN servers.\n' +
    '\n' +
    '# WARNING: This file contains a secret key that you must keep safe.  It is like\n' +
    '#          a password.  The best thing is just to keep this file to yourself and\n' +
    '#          don\'t share it.  We will never ask you for this information.\n\n' +
    'client\n' +
    'dev tun\n' +
    'proto udp\n' +
    'nobind\n' +
    'script-security 1\n' +
    'persist-key\n' +
    'persist-tun\n' +
    IP_LIST_PLACEHOLDER + '\n' +
    'comp-lzo yes\n' +
    'auth-nocache\n' +

    /* TA */
    '\nkey-direction 1\n' +
    'remote-cert-tls server\n' +
    '<tls-auth>\n' +
    '-----BEGIN OpenVPN Static key V1-----\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' +
    '-----END OpenVPN Static key V1-----\n' +
    '</tls-auth>\n\n' +

    /* CA */

    '<ca>\n' +
    '-----BEGIN CERTIFICATE-----\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF\n' +
    '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456=\n' +
    '-----END CERTIFICATE-----\n' +
    '</ca>\n\n';


var db = mongo.connect(cm, createSchemas);

/*
 * set up the schema.
 */
function createSchemas() {

    ovpnConfigs = mongo.addSchema('ovpnConfig');
    addConfigFiles();

}



var calls = [];
var regions = cm.cfg('server:regions');

/**
 * This function is called when async.parallel ends
 */
function funcDone(err) {
    /* this code will run after all calls finished the job or
       when any of the calls passes an error */
    if (err) {

        cm.log.error('ERROR: ', err);
        return err;
    }

    closeDB();

}

/**
 *  Remove all entries from the collection, then add the updated config files.
 */
function addConfigFiles() {

    /* First remove the objects in the collection */
    ovpnConfigs.remove({}, function(err) {

        if (err) {
            cm.log.error('ERROR: something nasty happened removing the collection items: ' + err);
            closeDB();
            return;
        }

        regions.forEach(saveRegionalConf);

        /*
         * call the inserts to the DB
         */
        async.parallel(calls, funcDone);

    });
}

/**
 * Close the connection to the database.
 */
function closeDB() {
    db.close(function (err) {
        if (err) {
            cm.log.error('ERROR: closing connection to mongo.');
        }
    });
}

/**
 * Save the data to the DB
 * @param region - the given region (string)
 */
function saveRegionalConf(region) {

    calls.push(function(callback) {

        /* Now get the list of ip addresses */
        var socketList = cm.cfg('ovpnServer:servers:' + region + ':sockets');
        var socketString = '\n# ' + region + '\n';
        for (var s in socketList) {
            socketString += 'remote ' + socketList[s] + '\n';
        }

        /* Plug it all into the regional config file */
        var regionalConfig = config.replace(IP_LIST_PLACEHOLDER, socketString);

        /* Save to DB */
        var configFile = new ovpnConfigs({region:region, file:regionalConfig});
        configFile.save(function (err) {
            if (err) {
                callback('ERROR: something nasty happened saving the data: ' + err);
            } else {
                cm.log.info('SAVED: ' + region);
                callback(null);
            }

        });
    });

}
