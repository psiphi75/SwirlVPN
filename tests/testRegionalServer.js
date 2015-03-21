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
 * Test the regional server:
 *  - add user to DB
 *  - simulate openVPN post
 */

/*jslint node:true*/
'use strict';

/* Import our configuration settings */
var cm = require('../common');
var schemas = require('../mongo/schema');

var test = require('tap').test;
var mongoose = require('mongoose');
var request = require('request');
var async = require('async');

var userAccounts;
var connsActive;

var vpnConnectionURL  = 'http://' + cm.cfg('ovpnServer:webservice:host');
    vpnConnectionURL += ':' + cm.cfg('ovpnServer:webservice:port');
    vpnConnectionURL += '/vpn-connections';

var db;

var numTestsFailed=0;
function testFailed() {
    numTestsFailed++;
}

var testUserWithBytes = {
        isActive        : true,
        userId          : 'testUserWithBytes',
        bytesToClient   : 0,
        bytesFromClient : 0,
        bytesToClientSaved: 0,
        bytesPurchased  : 20000,
        activationCode  : '',
        password        : 'xyz',
        email           : 'SOMEONE+1@gmail.com'
};
var testUserWithoutBytes0Conn = {
        isActive        : true,
        userId          : 'testUserWithoutBytes0Conn',
        bytesToClient   : 0,
        bytesToClientSaved: 0,
        bytesFromClient : 0,
        bytesPurchased  : 0,
        activationCode  : '',
        password        : 'xyz',
        email           : 'SOMEONE+2@gmail.com'
};
var testUserWithoutBytes1Conn = {
        isActive        : true,
        userId          : 'testUserWithoutBytes1Conn',
        bytesToClient   : 0,
        bytesToClientSaved: 0,
        bytesFromClient : 0,
        bytesPurchased  : 1000,
        activationCode  : '',
        password        : 'xyz',
        email           : 'SOMEONE+3@gmail.com'
};
var testUserWithoutBytes2Conn = {
        isActive        : true,
        userId          : 'testUserWithoutBytes2Conn',
        bytesToClient   : 0,
        bytesToClientSaved: 0,
        bytesFromClient : 0,
        bytesPurchased  : 1000,
        activationCode  : null,
        password        : 'xyz',
        email           : 'SOMEONE+4@gmail.com'
};

var testingUserIds = ['testUserWithBytes', 'testUserWithoutBytes0Conn', 'testUserWithoutBytes1Conn', 'testUserWithoutBytes2Conn'];

var testingConnsActive = [{
            userId:             'testUserWithoutBytes2Conn',
            isActive:           true,
            bytesToClient:      450,
            bytesToClientSaved: 0,
            bytesFromClient:    50,
            dateConnected:      new Date('2013-07-14T23:36:16Z'),
            dateConnectedUnix:  1373844976,
            dateDisconnected:   null,
            dateLastActivity:   new Date('2013-07-14T23:36:15Z'),
            disconnectedReason: null,
            clientIP:           '114.23.244.34',
            assignedIP:         null,
            serverNetDev:       'tap0',
        },{
            userId:             'testUserWithoutBytes2Conn',
            isActive:           false,
            bytesToClient:      550,
            bytesToClientSaved: 0,
            bytesFromClient:    50,
            dateConnected:      new Date('2013-07-14T23:36:15Z'),
            dateConnectedUnix:  1373844975,
            dateDisconnected:   new Date('2013-07-14T23:39:15Z'),
            dateLastActivity:   new Date('2013-07-14T23:39:15Z'),
            disconnectedReason: null,
            clientIP:           '114.23.244.34',
            assignedIP:         null,
            serverNetDev:       'tap0',
        },{
            userId:             'testUserWithoutBytes1Conn',
            isActive:           true,
            bytesToClient:      850,
            bytesToClientSaved: 0,
            bytesFromClient:    50,
            dateConnected:      new Date('2013-07-14T23:36:15Z'),
            dateConnectedUnix:  1373844975,
            dateDisconnected:   null,
            dateLastActivity:   new Date('2013-07-14T23:36:15Z'),
            disconnectedReason: null,
            clientIP:           '114.23.244.34',
            assignedIP:         null,
            serverNetDev:       'tap0',
}];

/**
 * Add a user for testing purposes
 * @param userData - the user object
 */
function addUserToDB(userData, callback) {
    userAccounts.create(userData, callback);
}

/**
 * Add a user for testing purposes
 * @param userData - the user object
 */
function addConnsToDB(conns, callback) {
    connsActive.create(conns, callback);
}


/**
 * Delete the old connections used for testing.
 */
function deleteOldTestData(callback) {

    var numCollections = 2;
    deleteCollection(userAccounts);
    deleteCollection(connsActive);

    /**
     * For each collection type remove the test data.
     */
    function deleteCollection(Collection) {

        Collection.remove({ userId: { $in : testingUserIds } }, function (err) {
            if (err) {
                testFailed();
                throw 'ERROR removing user: ' + err;
            }
            if (--numCollections === 0) {
                callback(err);
            }
        });
    }
}


//            ######## ########  ######  ########       ##
//               ##    ##       ##    ##    ##        ####
//               ##    ##       ##          ##          ##
//               ##    ######    ######     ##          ##
//               ##    ##             ##    ##          ##
//               ##    ##       ##    ##    ##          ##
//               ##    ########  ######     ##        ######


/**
 * Get the database up and running.  Fill it with a standard user that we will use during the testing.
 */
test('\nTest connection to the DB', function(t) {


    db = mongoose.createConnection(cm.getMongoURL());

    db.on('open', function dbConnectionOpened(err) {

        if (err) {

            t.ok(false, 'Could not connect to to database');
            cm.log.error(err);
            t.end();
            testFailed();
            return;

        } else {

            t.ok(true, 'Connected to database: ' + cm.cfg('db:name'));

        }

        /*
         *
         * Compile the schema
         *
         */

        /* Create the model that we can interact with the userAccounts collection */
        try {

            userAccounts  = db.model('useraccounts', schemas.userAccounts);
            connsActive   = db.model('connectionsActive', schemas.connectionsActive);

        } catch (ex) {
            t.ok(false, 'Could not convert schema to model: ' + ex);
            t.end();
            return;
        }
        t.ok(true, 'Schema converted to model okay');

        /*
         * Delete all old test users and connections
         */
        deleteOldTestData(function addUsersToDBCallback() {

            /*
             * Add users to DB
             */
            async.parallel([
                            async.apply(addUserToDB, testUserWithBytes),
                            async.apply(addUserToDB, testUserWithoutBytes0Conn),
                            async.apply(addUserToDB, testUserWithoutBytes1Conn),
                            async.apply(addUserToDB, testUserWithoutBytes2Conn),
                            async.apply(addConnsToDB, testingConnsActive)
                            ], function () {
                                t.end();
                            });
        });


    });

    db.on('error', function dbConnectionError(err) {
        cm.log.error(err);
        testFailed();
    });

});


//            ######## ########  ######  ########      #######
//               ##    ##       ##    ##    ##        ##     ##
//               ##    ##       ##          ##                ##
//               ##    ######    ######     ##         #######
//               ##    ##             ##    ##        ##
//               ##    ##       ##    ##    ##        ##
//               ##    ########  ######     ##        #########


/*
 * Test that a user can login via VPN by simulating a connection.
 * @param t
 * @param userCanLogin
 * @param postData
 * @param userId
*/
function testUserVPNConnection(t, userCanLogin, userId, callback) {

    var body = {
        key:                        cm.cfg('ovpnServer:webservice:key'),
        userId:                     userId,
        bytesFromClient:            0,
        bytesToClient:              0,
        bytesToClientSaved:         0,
        networkDev:                 'tap0',
        scriptType:                 'client-connect',
        signal:                     '',
        timeUnix:                   1373844975,
        assignedIP:                 '10.8.0.99',
        clientIP:                   '114.23.244.34',
        clientIPv6:                 '',
        server: {
            hostname : require('os').hostname()
        }
    };

    var options = {
        body: body,
        json: true,
        timeout: 1000
    };

    /* Send the request */
    request.post(vpnConnectionURL, options, function(error, response, body) {
        if (error) {
            t.ok(false, 'Error returned when posting login: ' + error);
            testFailed();
        } else if (response.statusCode !== 200) {
            if (userCanLogin) {
                t.ok(false, 'User denied login, when they should be able to login: ' + userId);
                testFailed();
            } else {
                t.ok(true, 'User denied login.');
            }
        } else {
            t.ok(true, 'User authorised to login.');
        }
        callback(null);
    });
}


/*
 *
 * Regional server: simulate connect
 *
 */
test('\nTest regional - user connect', function(t) {

    /* Simulate connection */
    async.series([
        async.apply(testUserVPNConnection, t, true,  testUserWithBytes.userId),
        async.apply(testUserVPNConnection, t, false, testUserWithoutBytes0Conn.userId),
        async.apply(testUserVPNConnection, t, true,  testUserWithoutBytes1Conn.userId),
        async.apply(testUserVPNConnection, t, false, testUserWithoutBytes2Conn.userId)
        ], function () {
            t.end();
        }
    );

});


//            ######## ########  ######  ########      #######
//               ##    ##       ##    ##    ##        ##     ##
//               ##    ##       ##          ##               ##
//               ##    ######    ######     ##         #######
//               ##    ##             ##    ##               ##
//               ##    ##       ##    ##    ##        ##     ##
//               ##    ########  ######     ##         #######


/**
 * Test that a user can disconnect via VPN by simulating a user update.
 * @param t
 * @param userId - the userId to use
 * @param shouldBeSuccess - true if we are expecting success
 * @param callback
 */
function testUserStatusUpdate(t, postBody, expectError, callback) {

    var webserviceHost = cm.cfg('ovpnServer:webservice:host');
    var webservicePort = cm.cfg('ovpnServer:webservice:port');

    var webserviceUpdateURL = 'http://' + webserviceHost + ':' + webservicePort + '/vpn-update-stats';

    var options = {
        body: postBody,
        json: true,
        timeout: 1000
    };

    /* Send the request */
    request.post(webserviceUpdateURL, options, function(error, response, body) {
        if (error && expectError) {
            t.ok(true, 'Error when incorrect key provided: ' + error);
        } else if (response && response.statusCode !== 200) {
            t.ok(false, 'Non-200 status code retured: ' + response.statusCode);
            testFailed();
        } else {
            /* One user should be booted */
            if (body && body.length === 1 && body[0] === 'testUserWithoutBytes2Conn'  && !expectError) {
                t.ok(true, 'User has been booted:' + body[0]);
            } else {
                t.ok(false, 'User was not booted or something else, body=' + body);
                testFailed();
            }
        }
        callback(null);
    });
}


/*
 *
 * Regional server: simulate user updte
 *
 */
test('\nTest regional - user update status', function(t) {

    var bodyWrongSecretKey = {
        key   : 'MyWrongKey',
        users : []
    };

    var body = {
        key   : cm.cfg('ovpnServer:webservice:key'),
        users : [
            {
                userId      : 'testUserWithBytes',
                assignedIP  : '10.8.0.99',
                bytesToClient:      950,
                bytesFromClient:    50,
                bytesToClientSaved:         0,
                dateConnectedUnix : 1373844975
            },
            {
                userId      : 'testUserWithoutBytes2Conn',
                assignedIP  : '10.8.0.99',
                bytesToClient:      1000*1000*1000*1000 - 50,
                bytesToClientSaved:         0,
                bytesFromClient:    50,
                dateConnectedUnix : 1373844975
            }
        ]
    };

    async.series([
                    async.apply(testUserStatusUpdate, t, bodyWrongSecretKey, true),
                    async.apply(testUserStatusUpdate, t, body, false)
                    ], function () { t.end(); } );

});


//            ######## ########  ######  ########     ##
//               ##    ##       ##    ##    ##        ##    ##
//               ##    ##       ##          ##        ##    ##
//               ##    ######    ######     ##        ##    ##
//               ##    ##             ##    ##        #########
//               ##    ##       ##    ##    ##              ##
//               ##    ########  ######     ##              ##


/**
 * Test that a user can disconnect via VPN by simulating a disconnection.
 * @param t
 * @param userId - the userId to use
 * @param shouldBeSuccess - true if we are expecting success
 * @param callback
 */
function testUserVPNDisconnection(t, userId, shouldBeSuccess, callback) {

    var body = {
        key:                cm.cfg('ovpnServer:webservice:key'),
        userId:             userId,
        bytesFromClient:      4564,
        bytesToClient:          5436,
        bytesToClientSaved:         0,
        networkDev:         'tap0',
        scriptType:         'client-disconnect',
        signal:             'ping-exit',
        timeUnix:           1373844975,
        assignedIP:         '10.8.0.2',
        clientIP:           '114.23.244.34',
        clientIPv6:         '',
        server: {
            hostname : require('os').hostname()
        }
    };

    var options = {
        body: body,
        json: true,
        timeout: 1000
    };

    /* Send the request */
    request.post(vpnConnectionURL, options, function(error, response, body) {
        if (error) {
            t.ok(false, 'Error returned when posting login: ' + error);
            testFailed();
        } else if (response.statusCode !== 200) {
            t.ok(!shouldBeSuccess, 'Non-200 status code retured: ' + response.statusCode);
            if (shouldBeSuccess) {
                testFailed();
            }
        } else {
            t.ok(shouldBeSuccess, 'User disconnected: ' + userId);
        }
        callback(null);
    });
}

/*
 *
 * Regional server: simulate disconnect
 *
 */
test('\nTest regional - user disconnect', function(t) {

    /* Simulate disconnection */
    async.parallel([
                    async.apply(testUserVPNDisconnection, t, testUserWithBytes.userId, true),
                    async.apply(testUserVPNDisconnection, t, testUserWithoutBytes0Conn.userId, false),
                    async.apply(testUserVPNDisconnection, t, testUserWithoutBytes1Conn.userId, true),
                    async.apply(testUserVPNDisconnection, t, testUserWithoutBytes2Conn.userId, true)
                    ], function () { t.end(); } );

});



//            ######## ########  ######  ########     ########
//               ##    ##       ##    ##    ##        ##
//               ##    ##       ##          ##        ##
//               ##    ######    ######     ##        #######
//               ##    ##             ##    ##              ##
//               ##    ##       ##    ##    ##        ##    ##
//               ##    ########  ######     ##         ######


test('\nTest disconnecting from the DB', function(t) {

    deleteOldTestData(function (){
        db.close(function (err) {
            if (err) {
                t.ok(false, 'Error closing db.');
                testFailed();
            } else {
                t.ok(true, 'DB closed okay.');
            }
            t.end();
            process.exit(numTestsFailed);
        });
    });
});
