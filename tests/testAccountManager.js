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

var am      = require('../common/account-manager');
var cm      = require('../common');
var async   = require('async');

var userAccounts;
var connsArchived;
var connsActive;
var purchases;

var testingUserIds = ['userNewNeverConnected', 'connectedWithBalance', 'connectedWithBalance2Conns', 'connectedOverBalance', 'connectingFirstTime', 'purchaseTestUser', 'purchaseTestUser2'];

var numTestsFailed=0;
function testFailed() {
    numTestsFailed++;
}
function testQuit() {
    setTimeout(function () { process.exit(numTestsFailed); }, 2000);
}


/**
 * Initialise the account manager.
 */
am.init({ loadOvpnConfig:false,initPurchasing: true }, runAccManTests);

/**
 * This is the main testing function it will get called as a callback one the DB is initalised.
 * @param err           - DB initialisation errors
 * @param userAccounts  - The userAccounts schema
 */
function runAccManTests() {

    userAccounts  = am.getUserAccounts();
    connsArchived = am.getConnsArchived();
    connsActive   = am.getConnsActive();
    purchases     = am.getPurchases();

    /* Start checking for expired purchases */
    purchases.findExpiringIn24Hours();

    async.series([
                  deleteOldTestData,
                  startTestVpnUserGetRemainingBytes,
                  startTestVpnUserApproveLoginAndConnect,
                  startTestUpdateConnection,
                  startTestAddConnection,
                  startTestDisconnection,
                  startTestConnectionArchiving,
                  startTestVpnUserGetBytesBalance,
                  startTestPurchaseSave,
                  startDetailedPurchaseTests,

                  function (callback) {
                      deleteOldTestData(function () {
                          am.closeDb();
                          callback();
                          testQuit();
                      });
                  }]);
}


//            ######## ########  ######  ########       ##
//               ##    ##       ##    ##    ##        ####
//               ##    ##       ##          ##          ##
//               ##    ######    ######     ##          ##
//               ##    ##             ##    ##          ##
//               ##    ##       ##    ##    ##          ##
//               ##    ########  ######     ##        ######


function startTestVpnUserGetRemainingBytes(testDoneCallback) {

    console.log('\n**********  TEST 1 :: vpnUserGetRemainingBytes *************');
    resetAndPopulateDb(testIt);

    function testIt(testData) {

        async.series([
                        async.apply(testVpnUserGetRemainingBytes, testData.users.userNewNeverConnected.userId, 0, 1),
                        async.apply(testVpnUserGetRemainingBytes, testData.users.connectedWithBalance.userId,  2100, 2),
                        async.apply(testVpnUserGetRemainingBytes, testData.users.connectedOverBalance.userId,  100 + defaultBytesBalance - 5, 3),
                        async.apply(testVpnUserGetRemainingBytes, testData.users.connectingFirstTime.userId,   0, 4)
                        ], function () {
                            testDoneCallback(null);
                        });


        /**
         * Run a test for a function, that requires an object, and has a callback: fn(myVar, function(err, obj) { ... })
         * @param inputObj  - the value to pass to the function.
         * @param testCallback - the callback which will confirm if the test ran okay
         * @param callback - the callback once the test is done.
         */
        function testVpnUserGetRemainingBytes(inputObj, expectedVal, testCount, callback) {
            am.vpnUserGetRemainingBytes(inputObj, function (err, testVal) {
                outputTestResults(err, testVal.bytesFromClient + testVal.bytesToClient, expectedVal, testCount, callback);
            });
        }
    }
}


//            ######## ########  ######  ########      #######
//               ##    ##       ##    ##    ##        ##     ##
//               ##    ##       ##          ##                ##
//               ##    ######    ######     ##         #######
//               ##    ##             ##    ##        ##
//               ##    ##       ##    ##    ##        ##
//               ##    ########  ######     ##        #########


function startTestVpnUserApproveLoginAndConnect(testDoneCallback) {

    console.log('\n**********  TEST 2 :: vpnUserApproveLoginAndConnect *************');
    resetAndPopulateDb(testIt);

    function testIt(testData) {

        async.series([
                        async.apply(testFnVarCbCb, user2Data(testData.users.userNewNeverConnected, connNew), callbackTestNoErr),
                        async.apply(testFnVarCbCb, user2Data(testData.users.connectedWithBalance, connNew),  callbackTestNoErr),
                        async.apply(testFnVarCbCb, user2Data(testData.users.connectedOverBalance, connNew),  callbackTestErr),
                        async.apply(testFnVarCbCb, user2Data(testData.users.connectingFirstTime, connNew),   callbackTestNoErr)
                        ],
                        function () {
                            setTimeout(testDoneCallback, 200);
                        });

        /**
         * Run a test for a function, that requires an object, and has a callback: fn(myVar, function(err, obj) { ... })
         * @param testObj  - the object to pass to the function.
         * @param testCallback - the callback which will confirm if the test ran okay
         * @param callback - the callback once the test is done.
         */
        function testFnVarCbCb(inputObj, testCallback, callback) {
            am.vpnUserApproveLoginAndConnect(inputObj, function (err, obj) {
                testCallback(err, obj, callback);
            });
        }

        /**
         * This callback will pass the test when there is an error
         */
        function callbackTestErr(err, obj, callback) {
            if (err) {
                console.log('Okay - We got the error we were expecting.');
            } else {
                console.log('Not Okay - We expected an error here, there must be a problem.');
                testFailed();
            }
            callback(null); // go to next test
        }

        /**
         * This callback will pass the test when there is no error
         */
        function callbackTestNoErr(err, obj, callback) {
            if (err) {
                console.log('Not Okay - There was an error when there was not meant to be one: ' + err);
                testFailed();
            } else {
                console.log('Okay');
            }
            callback(null); // go to next test
        }
    }
}

//            ######## ########  ######  ########      #######
//               ##    ##       ##    ##    ##        ##     ##
//               ##    ##       ##          ##               ##
//               ##    ######    ######     ##         #######
//               ##    ##             ##    ##               ##
//               ##    ##       ##    ##    ##        ##     ##
//               ##    ########  ######     ##         #######


function startTestUpdateConnection(testDoneCallback) {

    console.log('\n**********  TEST 3 :: vpnUserUpdateStats *************');
    resetAndPopulateDb(testIt);

    function testIt(testData) {

        /*
         * Set up the data
         */
        /* connectedWithBalance: Has two connections */
        var user1Test1 = {
                userId      : testData.users.connectedWithBalance.userId,
                assignedIP  : '9.9.9.9',
                bytesToClient : 0,
                bytesToClientSaved : 0,
                bytesFromClient: 0,
                dateConnectedUnix : testData.connsActive[0].dateConnectedUnix
        };
        var user1Test2 = {
                userId      : testData.users.connectedWithBalance.userId,
                assignedIP  : '9.9.9.9',
                bytesToClient : testData.connsActive[0].bytesToClient,
                bytesToClientSaved : 0,
                bytesFromClient: 10,
                dateConnectedUnix : testData.connsActive[0].dateConnectedUnix
        };
        var user1Test3 = {
                userId      : testData.users.connectedWithBalance.userId,
                assignedIP  : '9.9.9.9',
                bytesToClient   : defaultBytesBalance,
                bytesToClientSaved : 0,
                bytesFromClient : testData.connsActive[0].bytesToClient,
                dateConnectedUnix : testData.connsActive[0].dateConnectedUnix
        };
        /* connectingFirstTime: Has one connection */
        var user2Test1 = {
                userId      : testData.users.connectingFirstTime.userId,
                assignedIP  : '9.9.9.9',
                bytesToClient   : testData.connsActive[5].bytesToClient,
                bytesToClientSaved : 0,
                bytesFromClient : 2,
                dateConnectedUnix : testData.connsActive[5].dateConnectedUnix
        };
        var user2Test2 = {
                userId      : testData.users.connectingFirstTime.userId,
                assignedIP  : '9.9.9.9',
                bytesToClient   : defaultBytesBalance,
                bytesToClientSaved : 0,
                bytesFromClient : 0,
                dateConnectedUnix : testData.connsActive[5].dateConnectedUnix
        };
        /* connectedWithBalance2Conns: Has two active connections */
        var user3Test1 = {
                userId      : testData.users.connectedWithBalance2Conns.userId,
                assignedIP  : '9.9.9.9',
                bytesToClient   : testData.connsActive[1].bytesToClient,
                bytesToClientSaved : 0,
                bytesFromClient : 2,
                dateConnectedUnix : testData.connsActive[1].dateConnectedUnix
        };
        var user3Test2 = {
                userId      : testData.users.connectedWithBalance2Conns.userId,
                assignedIP  : '9.9.9.9',
                /* This will push the user over the limit */
                bytesToClient   : testData.connsActive[2].bytesToClient,
                bytesToClientSaved : 0,
                bytesFromClient : 100,
                dateConnectedUnix : testData.connsActive[2].dateConnectedUnix
        };

        /*
         * Run the tests
         */
        async.series([
                        async.apply(testVpnUserUpdateStats, [user1Test1], [], 1),
                        async.apply(testVpnUserUpdateStats, [user1Test2], [], 2),
                        async.apply(testVpnUserUpdateStats, [user1Test3], [user1Test3.userId], 3),
                        async.apply(testVpnUserUpdateStats, [user2Test1], [], 4),
                        async.apply(testVpnUserUpdateStats, [user3Test1], [], 5),
                        async.apply(testVpnUserUpdateStats, [user3Test2, user2Test2], [user3Test2.userId, user2Test2.userId], 6)
                        ],
                        function () {
                            testDoneCallback(null);
                        });

        /**
         * Run a test for a function, that requires an object, and has a callback: fn(myVar, function(err, obj) { ... })
         * @param inputObj  - the value to pass to the function.
         * @param testCallback - the callback which will confirm if the test ran okay
         * @param requiredVal - the value we expect to be there
         * @param testCount - the test sequence number
         * @param callback - the callback once the test is done.
         */
        function testVpnUserUpdateStats(inputObj, requiredVal, testCount, callback) {
            am.vpnUserUpdateStats(inputObj, function (err, testVal) {
                outputTestResults(err, testVal, requiredVal, testCount, callback);
            });
        }
    }
}


//            ######## ########  ######  ########     ##
//               ##    ##       ##    ##    ##        ##    ##
//               ##    ##       ##          ##        ##    ##
//               ##    ######    ######     ##        ##    ##
//               ##    ##             ##    ##        #########
//               ##    ##       ##    ##    ##              ##
//               ##    ########  ######     ##              ##


/**
 * Test vpnUserApproveLoginAndConnect() and the connection data added, then count the number of active connections for that user.
 */
function startTestAddConnection(testDoneCallback) {

    console.log('\n**********  TEST 4 :: vpnUserApproveLoginAndConnect - connections added *************');
    resetAndPopulateDb(testIt);

    function testIt() {

        /* Create the test data */
        var num_test_connections = 3;
        var connection_data = [];

        /* Copy the test data */
        for (var i=0; i<=num_test_connections; i++) {
            connection_data[i] = {
                    timeISO:        'Sun Nov 10 05:46:00 2013',
                    timeUnix:       1384062360 + i,
                    clientIP:      '1.2.3.4',
                    clientIPv6:    null,
                    assignedIP:   '10.8.0.2',
                    networkDev:     'tap0',
                    server: {
                        ip:         '58.1.2.3',
                        region:     'Test',
                        hostname:   'test-server'
                    }
            };
        }

        /* setup the userId */
        connection_data[0].userId = 'connectedWithBalance';
        connection_data[1].userId = 'userNewNeverConnected';
        connection_data[2].userId = 'connectedWithBalance2Conns';

        async.series([
                        async.apply(testResult_vpnUserAddConnection, connection_data[0], 2, 1),
                        async.apply(testResult_vpnUserAddConnection, connection_data[1], 1, 2),
                        async.apply(testResult_vpnUserAddConnection, connection_data[2], 3, 3)
                        ],
                        function () {
                            testDoneCallback(null);
                        });

        /**
         * Call the _vpnUserAddConnection() function and test it's result.
         * @param fnToTest - the function we will test.
         * @param inputObj  - the value to pass to the function.
         * @param testCallback - the callback which will confirm if the test ran okay
         * @param testCount - the test sequence number
         * @param callback - the callback once the test is done.
         */
        function testResult_vpnUserAddConnection(inputObj, expectedVal, testCount, callback) {

            am._vpnUserAddConnection(inputObj, function testResultVpnUserAddConnectionCB(err) {

                am.getUsersOpenConnections([inputObj.userId], function getUsersOpenConnectionsCB(err2, conns) {
                    if (err2) {
                        console.log('ERROR: getUsersOpenConnectionsCB(): ', err2);
                        testFailed();
                    }

                    var testVal = (typeof(conns) === 'undefined') ? 0 : conns.length;

                    outputTestResults(err, testVal, expectedVal, testCount, callback);
                });
            });
        }
    }
}

//            ######## ########  ######  ########     ########
//               ##    ##       ##    ##    ##        ##
//               ##    ##       ##          ##        ##
//               ##    ######    ######     ##        #######
//               ##    ##             ##    ##              ##
//               ##    ##       ##    ##    ##        ##    ##
//               ##    ########  ######     ##         ######


/**
 * Test vpnUserDisconnected() - disconnect a user, then check that the number of isActive connections has reduced.
 */
function startTestDisconnection(testDoneCallback) {

    console.log('\n**********  TEST 5 :: vpnUserDisconnected - disconnecting user connections *************');
    resetAndPopulateDb(testIt);

    function testIt() {
        async.series([
                      async.apply(testResult_vpnUserDisconnected, 'connectedOverBalance',       1334567891, 1, 1),
                      async.apply(testResult_vpnUserDisconnected, 'connectingFirstTime',        1334567890, 1, 2),
                      async.apply(testResult_vpnUserDisconnected, 'connectedWithBalance',       1334567891, 2, 3),
                      async.apply(testResult_vpnUserDisconnected, 'connectedWithBalance2Conns', 1334567890, 1, 4)
                      ],
                      function () {
                            testDoneCallback(null);
                      });
    }

    /**
     * Call the _vpnUserAddConnection() function and test it's result.
     * @param fnToTest - the function we will test.
     * @param inputObj  - the value to pass to the function.
     * @param testCallback - the callback which will confirm if the test ran okay
     * @param testCount - the test sequence number
     * @param callback - the callback once the test is done.
     */
    function testResult_vpnUserDisconnected(userId, timeUnix, expectedVal, testCount, callback) {

        connsActive.findOne({userId:userId, dateConnectedUnix:timeUnix }, function(err, conn) {

            var data = {
                    signal          : 'test',
                    bytesFromClient : 200,
                    bytesToClient   : 100,
                    bytesToClientSaved : 0,
                    userId          : conn.userId,
                    timeUnix        : conn.dateConnectedUnix,
            };

            am.vpnUserDisconnected(data, function testResultVpnUserDisconnectedCB(err) {

                am.getUsersArchivedConnections([userId], function getUsersOpenConnectionsCB(err2, conns) {
                    if (err2) {
                        console.log('ERROR: getUsersOpenConnectionsCB(): ', err2);
                    }

                    var testVal = (typeof(conns) === 'undefined') ? 0 : conns.length;
                    outputTestResults(err, testVal, expectedVal, testCount, callback);

                });
            });
        });
    }
}



//            ######## ########  ######  ########     #######
//               ##    ##       ##    ##    ##       ##     ##
//               ##    ##       ##          ##       ##
//               ##    ######    ######     ##       ########
//               ##    ##             ##    ##       ##     ##
//               ##    ##       ##    ##    ##       ##     ##
//               ##    ########  ######     ##        #######


/**
 * Test startTestConnectionArchiving() - make sure there are no isActive=false and make sure all items have been archived.
 *
 * IMPORTANT: This must be run after the 'startTestDisconnection', since it relies on the modified data.
 *
 * It does the following:
 *  1) Clears the archiveConnections documents
 *  2) Runs the archiving of all connections
 *  3) Tests we have the right number of archived connections per user
 */
function startTestConnectionArchiving(testDoneCallback) {

    console.log('\n**********  TEST 6 :: archiveUserConnections - archiving user connections *************');


    async.series([
                    async.apply(testResult_archiveUserConnections, 'connectingFirstTime',        1, 1),
                    async.apply(testResult_archiveUserConnections, 'connectedOverBalance',       1, 2),
                    async.apply(testResult_archiveUserConnections, 'userNewNeverConnected',      0, 3),
                    async.apply(testResult_archiveUserConnections, 'connectedWithBalance',       2, 4),
                    async.apply(testResult_archiveUserConnections, 'connectedWithBalance2Conns', 1, 5)
                 ],
                 function () {
                    testDoneCallback(null);
                 }
    );


    /**
     * Call the archiveUserConnections() function and test it's result.
     * @param fnToTest - the function we will test.
     * @param inputObj  - the value to pass to the function.
     * @param testCount - the test sequence number
     * @param callback - the callback once the test is done.
     */
    function testResult_archiveUserConnections(userId, expectedVal, testCount, callback) {
        am.getUsersArchivedConnections(userId, function testGetArchivedConnectionsCB(err, archivedConns) {
            outputTestResults(err, archivedConns.length, expectedVal, testCount, callback);
        });
    }
}


//         ######## ########  ######  ########    ########
//            ##    ##       ##    ##    ##       ##    ##
//            ##    ##       ##          ##           ##
//            ##    ######    ######     ##          ##
//            ##    ##             ##    ##         ##
//            ##    ##       ##    ##    ##         ##
//            ##    ########  ######     ##         ##


function startTestVpnUserGetBytesBalance(testDoneCallback) {

    console.log('\n**********  TEST 7 :: vpnUserGetRemainingBytes - repeated *************');


    async.series([
                    async.apply(testVpnUserGetRemainingBytes, 'userNewNeverConnected', 0, 1),
                    async.apply(testVpnUserGetRemainingBytes, 'connectedWithBalance',  2000 + 300, 2),
                    async.apply(testVpnUserGetRemainingBytes, 'connectedOverBalance',  defaultBytesBalance - 5 + 300, 3),
                    async.apply(testVpnUserGetRemainingBytes, 'connectingFirstTime',   0 + 300, 4)
                    ], function () {
                        testDoneCallback(null);
                    });


    /**
     * Run a test for a function, that requires an object, and has a callback: fn(myVar, function(err, obj) { ... })
     * @param inputObj  - the value to pass to the function.
     * @param testCallback - the callback which will confirm if the test ran okay
     * @param callback - the callback once the test is done.
     */
    function testVpnUserGetRemainingBytes(inputObj, expectedBalance, testCount, callback) {
        am.vpnUserGetRemainingBytes(inputObj, function (err, testVal) {
            outputTestResults(err, testVal.bytesToClient + testVal.bytesFromClient, expectedBalance, testCount, callback);
        });
    }
}



//         ######## ########  ######  ########      ####
//            ##    ##       ##    ##    ##       ##    ##
//            ##    ##       ##          ##       ##    ##
//            ##    ######    ######     ##         ####
//            ##    ##             ##    ##       ##    ##
//            ##    ##       ##    ##    ##       ##    ##
//            ##    ########  ######     ##         ####


/**
 * Save a purchase and get it back.  Ensure the results are the same.
 */
var countBytesPurchased = {};
var purchaseTestData;
function startTestPurchaseSave(testDoneCallback) {

    console.log('\n**********  TEST 8 :: startTestPurchaseSave - Save a purchase *************');
    resetAndPopulateDb(testIt);

    function testIt(testData) {
        purchaseTestData = testData.purchases;

        var tests = [];

        for (var key in testData.purchases) {
            tests.push(async.apply(testSavePurchase, testData.purchases[key], tests.length+1));
        }
        async.series(tests,
                     function () {
                          testDoneCallback(null);
                     });


        /**
         * Run a test for a function, that requires an object, and has a callback: fn(myVar, function(err, obj) { ... })
         * @param inputObj  - the value to pass to the function.
         * @param testCallback - the callback which will confirm if the test ran okay
         * @param callback - the callback once the test is done.
         */
        function testSavePurchase(testPurchase, testCount, callback) {

            /* Keep a track of the bytesPurchased per user */
            var userId = testPurchase.userId;
            var expectedStatus = 'active';
            if (typeof(countBytesPurchased[userId]) === 'undefined') {
                countBytesPurchased[userId] = testPurchase.bytesPurchased;
            } else {
                countBytesPurchased[userId] += testPurchase.bytesPurchased;
                expectedStatus = 'new';
            }


            am.savePurchase(testPurchase, function (err, savedPurchase) {
                purchases.findOne({_id: savedPurchase._id}, function(e, purchase) {

                    /* Test the purchase object is as we expect */
                    outputTestResults(err, purchase, testPurchase, testCount + 0.1, function(){});

                    /* Simple test on expiry date */
                    outputTestResults(err, purchase.dateExpires > purchase.datePurchased, true, testCount + 0.2, function(){});

                    /* Ensure the datePurchased is in the last second */
                    var datePurchased = purchase.datePurchased;
                    var now = new Date();
                    var nowMinus1sec = now - 1 * 1000;
                    outputTestResults(err, nowMinus1sec < datePurchased && datePurchased < now, true, testCount + 0.3, function(){});

                    /* Ensure the status is new */
                    outputTestResults(err, purchase.status, expectedStatus, testCount + 0.4, function(){});

                    /* Test that bytesPurchased is correct */
                    userAccounts.findOne({userId: testPurchase.userId}, function (err, obj) {

                        outputTestResults(err, obj.bytesPurchased, countBytesPurchased[userId], testCount + 0.5, callback);
                    });
                });
            });
        }
    }
}


//         ######## ########  ######  ########      ####
//            ##    ##       ##    ##    ##       ##    ##
//            ##    ##       ##          ##       ##    ##
//            ##    ######    ######     ##         ######
//            ##    ##             ##    ##             ##
//            ##    ##       ##    ##    ##       ##    ##
//            ##    ########  ######     ##         ####


/**
 * Some specific purchase tests.
 */
function startDetailedPurchaseTests(testDoneCallback) {

    console.log('\n**********  TEST 9 :: startDetailedPurchaseTests - Specific purchase tests *************');

    /* Keep a track of which expired purchase we should be testing */
    var purchObjI = 0;

// connectingFirstTime-6 -> findExpiringIn24Hours
// connectingFirstTime-6 -> wait 2 seconds
// connectingFirstTime-6 -> testExpired
// connectingFirstTime-7 -> vpnUserUpdateStats (+100 bytesUsed)
// connectingFirstTime-7 -> testExpired
// connectingFirstTime-8 -> vpnUserUpdateStats (+5000 bytesUsed)
// connectingFirstTime-8 -> testExpired

    async.series([

                      async.apply(testSetToUsed, 1, 1),

                      /*
                       * Test purchase #6 - 10 bytes used.  All is lost.
                       */

                      /* Call the findExpringIn24Hours and start it, then wait a wee while for it to apply */
                      async.apply(setExpiryDate, purchaseTestData, 6),
                      async.apply(purchases.findExpiringIn24Hours, { setUpCronJob : false }),
                      async.apply(testCheckExpired, 6, 0, 2),
                      async.apply(testUserBytesPurchased, 6, 43210-10, 3),

                      /*
                       * Test purchase #7 - 90 bytes used.  110 bytes lost due to expiry.
                       */

                      /* Add bytes to the user's usage, then expire the purchase */
                      async.apply(setExpiryDate, purchaseTestData, 7),
                      async.apply(testAddBytesAndExpire,  7,  90, 90, 4),
                      async.apply(testUserBytesPurchased, 7, 43210-10-110, 5),

                      /*
                       * Test purchase #8 - Use all bytes and more.
                       */
                      async.apply(setExpiryDate, purchaseTestData, 8),
                      async.apply(testAddBytesAndExpire,  8, 50000, 3000, 6),
                      async.apply(testUserBytesPurchased, 8, 43210-10-110, 7),

                      async.apply(testPurchaseUpdateState, 10, 250, 8),

                  ], function () {
                      testDoneCallback(null);
                  });


    /**
     * Run a test for a function, that requires an object, and has a callback: fn(myVar, function(err, obj) { ... })
     * @param inputObj  - the value to pass to the function.
     * @param testCallback - the callback which will confirm if the test ran okay
     * @param callback - the callback once the test is done.
     */
    function testSetToUsed(testId, testCount, callback) {

        var testPurchase = purchaseTestData[testId];

        purchases.findOpen(testPurchase.userId, function(err1, purchase) {
            if (err1) {
              console.log('An error occurred: ', err1);
            }

            /* Set the purchase to used */
            purchases.setUsed(purchase[0], function (err2, purchObj2) {
                outputTestResults(err2, purchObj2.status, 'used', testCount + 0.1, function(){});

                /* Set the purchase to used again - this should cause an error */
                purchases.setUsed(purchObj2, function (err3) {
                    outputTestResults(null, err3 !== null && typeof(err3) !== 'undefined', true, testCount + 0.2, function(){});

                    /* Set the purchase to used again - this should cause an error */
                    purchases.setExpired(purchObj2, function (err4) {

                        checkActivePurchase(purchObj2, testCount + 0.3, function (){});

                        outputTestResults(!err4, err4 !== null && typeof(err4) !== 'undefined', true, testCount + 0.4, callback);

                    });
                });
            });
        });
    }

    function testCheckExpired(testId, expectedBytesUsedOnPurchase, testCount, callback) {

        var testPurchase = purchaseTestData[testId];

        purchases.findByStatus(testPurchase.userId, ['expired'], function (err1, purchObj1) {

            checkActivePurchase(purchObj1, testCount + 0.1, function (){});

            /* Test that the correct bytesUsed value is set on the purchase */
            outputTestResults(err1, purchObj1[purchObjI].bytesUsed, expectedBytesUsedOnPurchase, testCount + 0.2, function(){});

            /* Test the purchase is how expected */
            setTimeout(function() {
                outputTestResults(err1, purchObj1[purchObjI++], testPurchase, testCount + 0.3, callback);
            }, 200);

        });
    }

    /**
     *  This test does the following:
     *    - updates the active connection
     *    - sets the expiry date for the purchase
     *    - waits for the expiry date to happened
     *    - finds that the purchase actually expired
     *    - checks the balance of bytesUsed to ensure all is okay.
     */
    function testAddBytesAndExpire(testId, bytesToClient, expectedBytesUsedOnPurchase, testCount, callback) {

        var testPurchase = purchaseTestData[testId];

        var userConnectionDetails = {
            userId              : 'purchaseTestUser',
            dateConnectedUnix   : 1334567890,
            assignedIP          : '123.123.123.123',
            bytesToClient       : bytesToClient,
            bytesToClientSaved : 0,
            bytesFromClient     : 0
        };


        /* Update an active connection */
        am.vpnUserUpdateStats([userConnectionDetails], function () {

            purchases.findExpiringIn24Hours({ setUpCronJob : false }, function () {

                  purchases.findByStatus(testPurchase.userId, ['expired', 'used'], function (err1, purchObj1) {
                      checkActivePurchase(purchObj1, testCount + 0.1, function (){});

                      /* Ensure the purchase bytes used are as expected */
                      outputTestResults(err1, purchObj1[purchObjI].bytesUsed, expectedBytesUsedOnPurchase, testCount + 0.2, function(){});


                      setTimeout(function() {
                          /* Ensure the purchase objects are the same */
                          outputTestResults(err1, purchObj1[purchObjI++], testPurchase, testCount + 0.3, callback);
                      }, 200);
                  });
              });
        });
    }

    /* There should always one and only one active purchse */
    function checkActivePurchase(purchaseList, testCount, callback) {
        var numActivePurchases = 0;
        var numNewPurchases = 0;
        for (var i=0; i<purchaseList.length; i++) {
            if (purchaseList[i].status === 'active') {
                numActivePurchases++;
            }
            if (purchaseList[i].status === 'new') {
                numNewPurchases++;
            }
        }
        var activePurchaseTestPass = true;

        if (numActivePurchases > 1) {
            activePurchaseTestPass = false;
        }
        if (numNewPurchases >= 1 && numActivePurchases === 0) {
            activePurchaseTestPass = false;
        }

        outputTestResults(null, activePurchaseTestPass, true, testCount, callback);
    }

    /*
     * Given a testId, this will test if the bytesPurchased field on the user is correct.
     */
    function testUserBytesPurchased(testId, expectedBytesUsedOnUser, testCount, callback) {

        var userId = purchaseTestData[testId].userId;

        am.getAllUserData(userId, function (err, usrData) {
            outputTestResults(null, usrData.bytesPurchased, expectedBytesUsedOnUser, testCount, callback);
        });
    }

    /*
     * Test the 'updateState()' function
     */
    function testPurchaseUpdateState(testId, bytesUsed, testCount, callback) {

        var userId = purchaseTestData[testId].userId;
        var userByteStats = {
           bytesUsed : bytesUsed
        };

        purchases.updateState(userId, userByteStats, function (err1, numPurchasesClosed) {

            /* Make sure we have the correct number of purchases updated */
            outputTestResults(err1, numPurchasesClosed, 2, testCount + 0.1, function (){});

            purchases.getAll(userId, function(err2, purchaseList) {
                checkActivePurchase(purchaseList,  testCount + 0.2, callback);
            });

        });
    }
}





/*
        ##     ## ######## #### ##          ######## ##     ## ##    ##  ######  ######## ####  #######  ##    ##  ######
        ##     ##    ##     ##  ##          ##       ##     ## ###   ## ##    ##    ##     ##  ##     ## ###   ## ##    ##
        ##     ##    ##     ##  ##          ##       ##     ## ####  ## ##          ##     ##  ##     ## ####  ## ##
        ##     ##    ##     ##  ##          ######   ##     ## ## ## ## ##          ##     ##  ##     ## ## ## ##  ######
        ##     ##    ##     ##  ##          ##       ##     ## ##  #### ##          ##     ##  ##     ## ##  ####       ##
        ##     ##    ##     ##  ##          ##       ##     ## ##   ### ##    ##    ##     ##  ##     ## ##   ### ##    ##
         #######     ##    #### ########    ##        #######  ##    ##  ######     ##    ####  #######  ##    ##  ######
 */


/**
 * This callback will pass the when testVal === expectedVal
 */
function outputTestResults(err, testVal, expectedVal, testCount, callback) {

    if (err) {
        console.log('Test ' + testCount + ': Not Okay - There was an error: ' + err);
        testFailed();
        callback(null);
        return;
    }

    /* Test Objects */
    if (typeof(expectedVal) === 'object') {
        if (0 === testObjects(expectedVal, testVal)) {
            console.log('Test ' + testCount + ': Okay - Objects are equal');
        } else {
            expectedVal = JSON.stringify(expectedVal, undefined, 4);
            testVal = JSON.stringify(testVal, undefined, 4);
            console.log('Test ' + testCount + ': Not Okay - The given values were not equal: (expectedValue != testVal): ("' + expectedVal + '" != "' + testVal + '")');
            testFailed();
        }

        callback(null);
        return;
    }

    /* Test Values */
    if (testVal === expectedVal) {
        console.log('Test ' + testCount + ': Okay - Values are equal');
    } else {
        console.log('Test ' + testCount + ': Not Okay - The given values were not equal: (expectedValue != testVal): ("' + expectedVal + '" != "' + testVal + '")');
        testFailed();
    }
    callback(null);
}


/**
 * Checks to see that all the items in the LHobj are present and equal in the RHobj
 * @param  {Object} LHobj The left-hand object
 * @param  {Object} RHobj The right-hand object
 * @return {number}       Number of differences
 */
function testObjects(LHobj, RHobj) {

    /* If the LH and RH types are not the same we have a problem */
    if (typeof(LHobj) !== typeof(RHobj)) {
        // console.log('NEQ: typeof ',typeof(LHobj), typeof(RHobj));
        return 1;
    }

    /* Sort the object if it is an array */
    if (LHobj instanceof Array) {
        LHobj.sort();
        RHobj.sort();
    }

    /* Continue recursion if LHobj is an obj */
    if (typeof(LHobj) === 'object') {
        var numProblems = 0;
        for (var LHkey in LHobj) {
            var LH_subObj = LHobj[LHkey];
            var RH_subObj = RHobj[LHkey];
            numProblems += testObjects(LH_subObj, RH_subObj);
        }
        return numProblems;
    }



    /* If we are here, the LH and RH objects are left nodes */
    if (LHobj === RHobj) {
        return 0;
    } else {
        // console.log('NEQ: ',LHobj, RHobj);
        return 1;
    }

}


/**
 * Populate the mongo DB with the test data.
 * @param callback
 */
function resetAndPopulateDb(callback) {

    var testData = getTestData();

    /* Count the number of objects we save */
    var notSaved = 0;

    resetCollection(userAccounts,  testData.users);
    resetCollection(connsArchived, testData.connsArchived);
    resetCollection(connsActive,   testData.connsActive);

    /**
     * For each collection type remove the old and add the new.
     */
    function resetCollection(Collection, data) {

        notSaved += Object.keys(data).length;

        Collection.remove({ userId: { $in : testingUserIds } }, function add2dbCallback(e) {
            if (e) {
                throw 'ERROR removing user: ' + e;
            }
            for(var u in data) {
                var obj = data[u];
                addUserToDB(new Collection(obj));
            }
        });

        /**
         * Remove data first if they are there.  Otherwise add them to the DB.
         */
        function addUserToDB(obj) {
            obj.save(function(err) {
                if(err){
                    throw 'ERROR occured, exiting: ' + err;
                } else {
                    if(--notSaved === 0) {
                        callback(testData);
                    }
                }
            });
        }
    }
}


/**
 * Delete the old connections used for testing.
 */
function deleteOldTestData(callback) {

    var numCollections = 4;

    deleteCollection(userAccounts);
    deleteCollection(connsActive);
    deleteCollection(connsArchived);
    deleteCollection(purchases);

    /**
     * For each collection type remove the test data.
     */
    function deleteCollection(Collection) {

        Collection.remove({ userId: { $in : testingUserIds } }, function (err) {
            if (err) {
                throw 'ERROR removing user: ' + err;
            }
            if (--numCollections === 0) {
                callback(err);
            }
        });
    }
}

/*
          ##     ##  ######  ######## ########         ######  ######## ######## ##     ## ########
          ##     ## ##    ## ##       ##     ##       ##    ## ##          ##    ##     ## ##     ##
          ##     ## ##       ##       ##     ##       ##       ##          ##    ##     ## ##     ##
          ##     ##  ######  ######   ########         ######  ######      ##    ##     ## ########
          ##     ##       ## ##       ##   ##               ## ##          ##    ##     ## ##
          ##     ## ##    ## ##       ##    ##        ##    ## ##          ##    ##     ## ##
           #######   ######  ######## ##     ##        ######  ########    ##     #######  ##
*/


var os = require('os');
var defaultBytesBalance = cm.cfg('purchase:defaultBytesBalance');
var unixtime = 1334567890;
var connNew = {
        bytesToClient:      0,
        bytesFromClient:    0,
        bytesToClientSaved : 0,
        dateConnected:  '2012-04-16T09:18:10.000Z',
        dateConnectedUnix: 1334567890,
        dateLastActivity: '2012-04-16T09:18:10.000Z',
        clientIP:       '1.2.3.4',
        assignedIP:     '10.8.0.2',
        serverNetDev:   'tap0',
        serverHostname: os.hostname()
};

/* 100 bytes used connection */
var connActive1 = {
        bytesToClient:      100,
        bytesToClientSaved : 0,
        bytesFromClient:    0,
        dateConnected: '2012-04-16T09:18:11.000Z',
        dateConnectedUnix: 1334567891,
        dateLastActivity: '2012-04-16T09:18:11.000Z',
        clientIP:       '1.2.3.4',
        assignedIP:     '10.8.0.2',
        serverNetDev:   'tap0',
        serverHostname: os.hostname()
};
/* Just below the limit */
var connActive2 = {
        bytesToClient:      defaultBytesBalance - 5,
        bytesToClientSaved : 0,
        bytesFromClient:    0,
        dateConnected: '2012-04-16T09:18:12.000Z',
        dateConnectedUnix: 1334567892,
        dateLastActivity: '2012-04-16T09:18:12.000Z',
        clientIP:       '1.2.3.4',
        assignedIP:     '10.8.0.2',
        serverNetDev:   'tap0',
        serverHostname: os.hostname()
};
var connNotActive = {
        bytesToClient:      2000,
        bytesToClientSaved : 0,
        bytesFromClient:    0,
        userId: 'connectedWithBalance',
        disconnectedReason: 'Testing',
        dateConnected: '2012-04-16T09:18:13.000Z',
        dateDisconnected: '2012-04-16T09:18:43.000Z',
        clientIP:       '1.2.3.4',
        assignedIP:     '10.8.0.2',
        serverNetDev:   'tap0',
        serverHostname: os.hostname()
};

function getTestData() {

    var connsActive = [];

    var conn1 = clone(connActive1);
    conn1.userId = 'connectedWithBalance';
    connsActive.push(conn1);

    var conn2 = clone(connNew);
    conn2.userId = 'connectedWithBalance2Conns';
    connsActive.push(conn2);

    var conn3 = clone(connActive2);
    conn3.userId = 'connectedWithBalance2Conns';
    connsActive.push(conn3);

    var conn4 = clone(connActive1);
    conn4.userId = 'connectedOverBalance';
    connsActive.push(conn4);

    var conn5 = clone(connActive2);
    conn5.userId = 'connectedOverBalance';
    connsActive.push(conn5);

    var conn6 = clone(connNew);
    conn6.userId = 'connectingFirstTime';
    connsActive.push(conn6);

    var conn7 = clone(connNew);
    conn7.userId = 'purchaseTestUser';
    connsActive.push(conn7);

    var conn8 = clone(connNotActive);
    conn8.bytesToClient = 250;
    conn8.userId = 'purchaseTestUser2';

    var users = {
            userNewNeverConnected : {
                bytesToClient: 0,
                bytesToClientSaved : 0,
                bytesFromClient: 0,
                bytesPurchased: defaultBytesBalance,
                dateCreated: cm.t_unix2iso(unixtime-30),
                email: 'SOMEONE+userNewNeverConnected@gmail.com',
                isActive: true,
                userId: 'userNewNeverConnected',
                password: 'xyz'
            },
            connectedWithBalance : {
                bytesToClient: 2000,
                bytesToClientSaved : 0,
                bytesFromClient: 0,
                bytesPurchased: defaultBytesBalance,
                dateCreated: cm.t_unix2iso(unixtime-30),
                email: 'SOMEONE+connectedWithBalance@gmail.com',
                isActive: true,
                userId: 'connectedWithBalance',
                password: 'xyz'
            },
            connectedWithBalance2Conns : {
                bytesToClient: 0,
                bytesToClientSaved : 0,
                bytesFromClient: 0,
                bytesPurchased: defaultBytesBalance,
                dateCreated: cm.t_unix2iso(unixtime-30),
                email: 'SOMEONE+connectedWithBalance2Conns@gmail.com',
                isActive: true,
                userId: 'connectedWithBalance2Conns',
                password: 'xyz'
            },
            connectedOverBalance : {
                bytesToClient: 0,
                bytesToClientSaved : 0,
                bytesFromClient: 0,
                bytesPurchased: defaultBytesBalance,
                dateCreated: cm.t_unix2iso(unixtime-30),
                email: 'SOMEONE+connectedOverBalance@gmail.com',
                isActive: true,
                userId: 'connectedOverBalance',
                password: 'xyz'
            },
            connectingFirstTime : {
                bytesToClient: 0,
                bytesToClientSaved : 0,
                bytesFromClient: 0,
                bytesPurchased: defaultBytesBalance,
                dateCreated: cm.t_unix2iso(unixtime-30),
                email: 'SOMEONE+connectingFirstTime@gmail.com',
                isActive: true,
                userId: 'connectingFirstTime',
                password: 'xyz'
            },
            purchaseTestUser : {
                bytesToClient: 0,
                bytesToClientSaved : 0,
                bytesFromClient: 0,
                bytesPurchased: 43210,
                dateCreated: cm.t_unix2iso(unixtime-30),
                email: 'SOMEONE+purchaseTestUser@gmail.com',
                isActive: true,
                userId: 'purchaseTestUser',
                password: 'xyz'
            },
            purchaseTestUser2 : {
                bytesToClient: 250,
                bytesToClientSaved : 0,
                bytesFromClient: 0,
                bytesPurchased: 43210,
                dateCreated: cm.t_unix2iso(unixtime-30),
                email: 'SOMEONE+purchaseTestUser2@gmail.com',
                isActive: true,
                userId: 'purchaseTestUser2',
                password: 'xyz'
            },
    };
    return {users:users, connsActive:connsActive, connsArchived:[connNotActive, conn8], purchases: getTestPurchaseDataSet()};
}

/**
 * Use the user and connection to create a data object
 * @param user
 * @param connection
 */
function user2Data(user, connection) {

    return {
            userId:          user.userId,
            bytesFromClient: connection.bytesFromClient,
            bytesToClient:   connection.bytesToClient,
            bytesToClientSaved : 0,
            networkDev:      connection.serverNetDev,
            scriptType:      'x?',
            signal:          'x?',
            timeUnix:        connection.dateConnectedUnix,
            timeISO:         connection.dateConnected,
            assignedIP:      connection.assignedIP,
            clientIP:        connection.clientIP,
            clientIPv6:      connection.clientIP,
            server:        {
                ip:     '127.0.0.1',
                region: 'Test',
                hostname: os.hostname()
            }
    };
}



function clone(obj) {
    // Handle the 3 simple types, and null or undefined
    if (null === obj || 'object' !== typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        var copy1 = new Date();
        copy1.setTime(obj.getTime());
        return copy1;
    }

    // Handle Array
    if (obj instanceof Array) {
        var copy2 = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy2[i] = clone(obj[i]);
        }
        return copy2;
    }

    // Handle Object
    if (obj instanceof Object) {
        var copy3 = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr))
                copy3[attr] = clone(obj[attr]);
        }
        return copy3;
    }

    throw new Error('Unable to copy obj! Its type isnt supported.');
}


/*******************************************************************************************************************************************

      ########  ##     ## ########   ######  ##     ##    ###     ######  ########        ######  ######## ######## ##     ## ########
      ##     ## ##     ## ##     ## ##    ## ##     ##   ## ##   ##    ## ##             ##    ## ##          ##    ##     ## ##     ##
      ##     ## ##     ## ##     ## ##       ##     ##  ##   ##  ##       ##             ##       ##          ##    ##     ## ##     ##
      ########  ##     ## ########  ##       ######### ##     ##  ######  ######          ######  ######      ##    ##     ## ########
      ##        ##     ## ##   ##   ##       ##     ## #########       ## ##                   ## ##          ##    ##     ## ##
      ##        ##     ## ##    ##  ##    ## ##     ## ##     ## ##    ## ##             ##    ## ##          ##    ##     ## ##
      ##         #######  ##     ##  ######  ##     ## ##     ##  ######  ########        ######  ########    ##     #######  ##

*******************************************************************************************************************************************/

/**
 * Setup the test purchases.  Note the following fields don't require values, since their defaults are set.
 *   - bytesUsed
 *   - datePurchased
 *   - dateExpires
 *   - status
 */



function getTestPurchaseDataSet() {
    var purchData = {};
    var id = 1;

    createTestPurchaseDataEntry('userNewNeverConnected',      defaultBytesBalance, 'Free', null, 0, 0);  /* Gets set to 'used' using setUsed(), then try to set expired - should not work */
    createTestPurchaseDataEntry('connectedWithBalance',       defaultBytesBalance, 'Bitcoin', null, 0, 0);
    createTestPurchaseDataEntry('connectingFirstTime', defaultBytesBalance, 'Free', null, 0, 0);
    createTestPurchaseDataEntry('connectedOverBalance', -100 +defaultBytesBalance, 'Free', null, 0, 0);
    createTestPurchaseDataEntry('connectedOverBalance',                       100, 'Credit Card', 'USD', 1, 1);
    createTestPurchaseDataEntry('purchaseTestUser',                         10, 'Free', null, 0, 0);  /* Gets set to expired using the dateExpires */
    createTestPurchaseDataEntry('purchaseTestUser',                        200, 'Free', null, 0, 0);  /* Gets set to expired using the dateExpires, but 1/2 bytesUsed are  */
    createTestPurchaseDataEntry('purchaseTestUser',                       3000, 'Free', null, 0, 0);
    createTestPurchaseDataEntry('purchaseTestUser',                      40000, 'Free', null, 0, 0);
    createTestPurchaseDataEntry('purchaseTestUser2',                       100, 'Free', null, 0, 0);
    createTestPurchaseDataEntry('purchaseTestUser2',                       100, 'Free', null, 0, 0);
    createTestPurchaseDataEntry('purchaseTestUser2',                       100, 'Free', null, 0, 0);

    purchData[6].dateExpires = new Date(Date.now() + 1000 * 1000 + 24*3600*1000);
    purchData[7].dateExpires = new Date(Date.now() + 2000 * 1000 + 24*3600*1000);
    purchData[8].dateExpires = new Date(Date.now() + 3000 * 1000 + 24*3600*1000);
    purchData[9].dateExpires = new Date(Date.now() + 4000 * 1000 + 24*3600*1000);

    function createTestPurchaseDataEntry(userId, bytesPurchased, method, currency, valueOrig, valueUSD) {
        purchData[id++] = {
                              userId:             userId,
                              bytesPurchased:     bytesPurchased,
                              name:               'Testing',
                              paymentDetails: {
                                  method:             method,
                                  currency:           currency,
                                  valueCurrency:      valueOrig,
                                  valueUSD:           valueUSD
                              }
                          };
    }
    return purchData;
}

/* Set expires date in x seconds - and start the expiring search */
function setExpiryDate(purchData, testId, callback) {

    purchases.findOne({
            userId:purchData[testId].userId,
            status : { $in : ['active', 'new']},
            bytesPurchased: purchData[testId].bytesPurchased
          }, function (err, purch)  {
              purch.dateExpires = new Date(Date.now()-1000);
              purch.save(callback);
    });
}



