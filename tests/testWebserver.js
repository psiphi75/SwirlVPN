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
 * Test the webserver:
 *  - Create user, check DB
 *  - Get log-in link (from DB) Login as user
 *  - Change user details
 *  - Try to change other user's details
 *  - TODO: Delete a user
 *  - TODO: Reset password link
 *  - TODO: Make this more modular, we should just be able to 'add user', 'delete user', etc
 */

/*jslint node:true*/
'use strict';

/* Import our configuration settings */
var cm              = require('../common');
var test            = require('tap').test;
var mongo           = require('../common/mongo');
var request         = require('request');
var querystring     = require('querystring');
var crypto          = require('crypto');

/* Try to bust this email account */
var commonEmail     = 'SOMEONE+75@gmail.com';
var uidLength       = cm.cfg('user:uidLength');
var salt            = cm.cfg('db:userAccounts:salt');
var userAccounts;
var db;

function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}
function saltAndHash(password) {
    return md5(password + salt);
}

var numTestsFailed=0;
function testFailed() {
    numTestsFailed++;
}

//cm.getWebserverURL()
var webserverURL = 'https://localhost:8889';

/*
 * Get the database up and running.  Fill it with a standard user that we will use during the testing.
 */
test('\nTest connection to the DB', function(t) {

    /*
     *
     * Connect to DB and test the schema
     *
     */
    db = mongo.connect(cm, createSchemas);

    function createSchemas() {

        /* Create the model that we can interact with the userAccounts collection */
        userAccounts = mongo.addSchema('userAccounts');

        /*
         *
         * Create a new account - we will try to create a user with a standard email.
         *
         */
        userAccounts.findOne({email: commonEmail}, function(err, obj) {

            if (err) {
                t.ok(false, 'An error occured');
                testFailed();
                t.end();
                return null;
            }

            if (obj) {
                t.ok(true, 'Standard user exists, not adding: '+ commonEmail);
                t.end();
                return null;
            }

            t.ok(true, 'Standard user does not exist, adding now');

            /*
             *
             * Add the standard user
             *
             */
            var userDetails = {
                    isActive        : true,
                    userId          : cm.makeId(uidLength, false),
                    bytesPurchased  : 20000,
                    activationCode  : '',
                    password        : cm.makeId(uidLength, false),
                    email           : commonEmail
            };
            var user = new userAccounts(userDetails);

            user.save(function (err) {
                if (err) {
                    t.ok(false, 'An error occurred creating a user: ' + err);
                    testFailed();
                } else {
                    t.ok(true, 'Created standard user.');
                }
                t.end();
            });
        });
    }
});


/*
 *
 * Webserver: add a user via the webserver.
 *
 */
test('\nTest webserver - user create / validate', function(t) {

    var url = webserverURL + cm.cfg('webserver:links:accountCreate');
    var email = null;

    /*
     *
     * get the signup page, get the cookie and then create a new user
     *
     */
    request.get(url, function(error, response, body) {

        if (error) {
            t.ok(false, 'Error connecting to webserver (make sure iptables redirecting to port 8889): ' + error);
            testFailed();
            t.end();
            return;
        }
        t.ok(true, 'Connected to webserver: ' + url);

        email = 'SOMEONE+' + cm.makeId(10, false).toLowerCase() + '@gmail.com';

        var cookie = response.headers['set-cookie'][0].split(';')[0].split('=')[1];
        var password = 'mypass';
        var post = {
                headers: {
                    Cookie: 'connect.sid=' + cookie
                },
                form : {
                    email: email,
                    password: password
                }
            };

        /*
         * Create a new user via post
         */
        request.post(url, post,  testNewUserPost);
    });

    /**
     * Test that a POST for a new user was successful
     */
    function testNewUserPost(error, response, body) {

        /* Test the response */
        if (error) {
            t.ok(false, 'testNewUserPost(): There was an error: ' + error);
            testFailed();
            t.end();
            return;
        }

        if (response.statusCode !== 200) {
            t.ok(false, 'testNewUserPost(): Abnormal status code: ' + response.statusCode);
            testFailed();
            t.end();
            return;
        }

        t.ok(true, 'New User: Status code 200 - okay: ' + email);

        /* Test the DB for the new user */
        userAccounts.findOne({email: email}, testDbForNewUser);
    }

    /**
     * Check the DB and see if we have the new user in it
     */
    function testDbForNewUser(err, obj) {

        var user = obj.toObject();

        if (err  ||  user === null  || user === undefined) {
            t.ok(false, 'Error finding new user in DB');
            testFailed();
            t.end();
            return;
        }

        t.ok(true, 'Found user in DB: ' + user.email);
        t.equal(user.userId.length, uidLength, 'userId created okay');
        t.notOk(user.isActive, 'User set as not-active --- good');

        /* Now send a request to activate user */
        var query = {
                'e': user.email,
                'c': user.activationCode
            };

        url  = webserverURL;
        url += cm.cfg('webserver:links:accountActivate');
        url += '?' + querystring.stringify(query);

        /* Wait some short time for user activation, this is required because the keygen
         * takes some time (< 100ms). */
        setTimeout(function() {
            request.get(url, activateUser);
        }, 500);
    }


    /**
     * Activate the given user, based on the response
     */
    function activateUser(error, response, body) {

        if (error  ||  response.statusCode !== 200) {
            t.ok(false, 'An error occurred activating user. error=' + error + ', response=' + response.statusCode);
            testFailed();
            t.end();
            return;
        }

        /* Extract the user email and use this to test DB */
        var userEmail = cm.getURIParams(response.request.uri.query).e;
        t.ok(true, 'User activation link worked for: ' + userEmail);

        /* Test that the user is actually activated */
        userAccounts.findOne({email: userEmail}, testUserActivated);

    }

    /**
     * Test that a user has been activated
     */
    function testUserActivated(err, activatedUser) {

        var user = activatedUser.toObject();

        if (err) {
            t.ok(false, 'Finding activated user.');
            testFailed();
        } else {

            t.ok(user.isActive, 'User activated okay');
            t.ok(user.activationCode.length === 0, 'Activation code has been reset');
        }

        // End of tests
        t.end();

        /* Carry on and do the next tests */
        nextTests(user);
    }

});

/*
 * Next block of tests, this is called once the tests above complete.
 * - Login
 * - get config
 * - Update email
 * - Update password
 * - Delete account
 */
function nextTests(user) {

    test('\nTest webserver - user login / update / delete', function(t) {

        /*
         *
         * Login screen
         *
         */
        var url = webserverURL;

        request.get(url, function(error, response, body) {

            if (error  ||  response.statusCode !== 200) {
                t.ok(false, 'Error connecting to webserver: ' + error);
                testFailed();
                t.end();
                return;
            }
            t.ok(true, 'Connected to webserver: ' + url);

            var post = {
                    form : {
                        email: user.email,
                        password: 'WRONG PASSWORD'
                    }
            };

            /* Change to login */
            url += cm.cfg('webserver:links:accountLogin');

            /*
             *
             * Do the login -- this login is fake login with wrong password
             *
             */
            request.post(url, post,  function(error, response, body) {

                if (error) {
                    t.ok(false, 'An error occurred: ' + error);
                    testFailed();
                }
                else if (response.statusCode === 200) {
                    t.ok(false, 'User able to logged in with incorrect password: ' + url);
                    testFailed();
                } else {
                    t.ok(true, 'Login denied for: ' + post.form.email);
                }

                /*
                 *
                 * 2nd login - let's use the correct password
                 *
                 */
                post.form.password = 'mypass';
                request.post(url, post,  function(error, response, body) {

                    if (error  ||  response.statusCode !== 200) {
                        t.ok(false, 'Error logging in to webserver: ' + error);
                        testFailed();
                    } else {
                        t.ok(true, 'Login accepted: ' + url);
                    }

                    /*
                     *
                     * Now we get the config file
                     *
                     */
                    url = webserverURL + cm.cfg('webserver:links:getOvpnConf') + '?region=Sydney';

                    setTimeout(function() {
                        request.get(url,  function(error, response, body) {

                            if (error) {
                                t.ok(false, 'Error getting ovpn config: ' + error);
                                testFailed();
                            } else if (response.statusCode !== 200) {
                                t.ok(false, 'Error in reponse code - getting ovpn config: ' + response.statusCode);
                                testFailed();
                            } else {
                                t.ok(true, 'Got openvpn config, it\'s length is: ' + body.length);
                            }

                            /*
                             *
                             * Now we update the email - to an existing email - should be revoked
                             *
                             */
                            var post = {
                                    form : {
                                        userId  : user.userId,
                                        email   : commonEmail,
                                        password: 'mypass'
                                    }
                            };

                            url = webserverURL + cm.cfg('webserver:links:accountUpdate');
                            request.post(url, post,  function(error, response, body) {

                                if (error) {
                                    t.ok(false, 'An error occurred updating the email: ' + error);
                                    testFailed();
                                } else if (response.statusCode === 200) {
                                    t.ok(false, 'Oops, user was able to overwrite email from another account (or something)');
                                    testFailed();
                                } else {
                                    t.ok(true, 'Denied ability to change email to another');
                                }


                                /*
                                 *
                                 * Now we update the email - to a new email and new password
                                 *
                                 */
                                post.form.email = 'SOMEONE+' + cm.makeId(10, false).toLowerCase() + '@gmail.com';
                                post.form.password = 'mynewpass';

                                request.post(url, post,  function(error, response, body) {
                                    if (response.statusCode !== 200) {
                                        t.ok(false, 'Could not update email for some reason: ' + url);
                                        testFailed();
                                    } else {
                                        t.ok(true, 'Updated email okay, changed to: ' + post.form.email);
                                    }

                                    /* Check DB to see everything is updated okay */
                                    var query = { userId: user.userId, password: saltAndHash(post.password) };
                                    userAccounts.findOne(query, function(e, o) {
                                        if (o === null) {
                                            t.ok(false, 'Email and password not found');
                                            testFailed();
                                        } else {
                                            t.ok(true, 'Email and password updated okay');
                                        }
                                    });

                                    // End the testing
                                    t.end();

                                });
                            });
                        });
                    },1000);
                });
            });
        });
    });
}




test('\nTest all links', function(t) {

    var linkIgnoreList = ['/activate_account'];

    var async = require('async');
    var linkObj = cm.cfg('webserver:links');
    var linkList = [];
    for (var key in linkObj) {

        /* These are post requests that don't require testing */
        switch (key) {
            case 'passwordForgot':
            case 'accountUpdateReminder':
            case 'accountDelete':
            case 'getUserByteStats':
            case 'purchaseConfirmPaypal':
            case 'purchaseCancelledPaypal':
                continue;
        }

        /* Otherwise test it */
        linkList.push(linkObj[key]);
    }
    async.map(linkList, testURL, function (err) {t.end();});

    function testURL(url, callback) {

        if (linkIgnoreList.indexOf(url) >= 0) {
            callback();
            return;
        }

        url = webserverURL + url;
        request.get(url, function(error, response, body) {

            if (error) {
                t.ok(false, 'An error occurred access the page: ' + url + ' : ' + error);
                testFailed();
            } else if (response.statusCode !== 200) {
                t.ok(false, 'The page returned an error: ' + url);
                testFailed();
            } else {
                t.ok(true, 'OK - ' + url);
            }
            callback();
        });
    }
});


test('\nTest disconnecting from the DB', function(t) {
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