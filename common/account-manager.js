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
 * account-manager.js
 *
 * This code is used by a few services:
 *   - The Web Server
 *   - The Regional Server
 *   - The Master Server
 *
 * It contains all user account management functions.  Such as adding a user,
 * counting there data usage, authenticating user for VPN, autheticating user
 * for WebSite, purchasing of data.
 *
 * TODO: This code could be refactored, suggested into purchasing, web user,
 *       and VPN user.  Even abstracing the DB layer would help, but it would
 *       be best to refactor the DB user schema first.
 */

/*jslint node:true*/
'use strict';

/* Import our configuration settings */
var cm                      = require('../common');
var mongo                   = require('../common/mongo');

var crypto                  = require('crypto');
var request                 = require('request');
var async                   = require('async');

var salt                    = cm.cfg('db:userAccounts:salt');

/* Mongo DB and Collections */
var db;
var userAccounts;
var connsArchived;
var connsActive;
var purchases;

var regionalConfFiles = [];

/**
 * Information that is required by the function for user data.
 */
var userSelection_BasicInfo = 'userId email isActive';
var userSelection_AccountInfo = userSelection_BasicInfo +
                                ' password passwordResetCode activationDate ' +
                                'activationCode dateCreated dateLastLogin invalidPWCount reminder';
var userSelection_KeyInfo   = userSelection_BasicInfo + ' keys';

var purchasesStatusPending = cm.cfg('purchase:statusPending');
var purchasesStatusOpen    = cm.cfg('purchase:statusOpen');
var purchasesStatusClosed  = cm.cfg('purchase:statusClosed');




/*******************************************************************************************************************
      #### ##    ## #### ######## ####    ###    ##       ####  ######     ###    ######## ####  #######  ##    ##
       ##  ###   ##  ##     ##     ##    ## ##   ##        ##  ##    ##   ## ##      ##     ##  ##     ## ###   ##
       ##  ####  ##  ##     ##     ##   ##   ##  ##        ##  ##        ##   ##     ##     ##  ##     ## ####  ##
       ##  ## ## ##  ##     ##     ##  ##     ## ##        ##   ######  ##     ##    ##     ##  ##     ## ## ## ##
       ##  ##  ####  ##     ##     ##  ######### ##        ##        ## #########    ##     ##  ##     ## ##  ####
       ##  ##   ###  ##     ##     ##  ##     ## ##        ##  ##    ## ##     ##    ##     ##  ##     ## ##   ###
      #### ##    ## ####    ##    #### ##     ## ######## ####  ######  ##     ##    ##    ####  #######  ##    ##

 *******************************************************************************************************************/


/**
 * Initialise the connection to the DB
 * @param options - { loadOvpnConfig: true/false } set to true to load the configurations from DB
 */
exports.init = function init(options, callback) {

    db = mongo.connect(cm, createSchemas);

    function createSchemas() {

        /*
         * Compile the userAccount schema
         */
        userAccounts  = mongo.addSchema('userAccounts');
        connsArchived = mongo.addSchema('connectionsArchived');
        connsActive   = mongo.addSchema('connectionsActive');
        purchases     = mongo.addSchema('purchases');

        initPurchasing();

        /* Set the options values to false if not provided */
        if (typeof(options) === 'undefined') {
            options = { loadOvpnConfig : false, initPurchasing: false };
        }

        if (options.initPurchasing) {
            purchases.findExpiringIn24Hours();
        }

        /*
         * Now compile the ovpnConfigs schema
         */
        if (options.loadOvpnConfig) {
            var ovpnConfigs = mongo.addSchema('ovpnConfig');

            /* Load the regional config files to memory */
            getRegionalConfigFiles(ovpnConfigs, findUserWithoutKeysAndPopulate);
        }

        callback(null);

    }


    /**
     * This function will populate the keygen data if it did not exist for a user.
     * This is only necessary as a fallback if the keygen server was not running.
     */
    function findUserWithoutKeysAndPopulate() {
        var query = {
                keys: { $exists: false },
        };
        userAccounts.find(query, userSelection_BasicInfo, function findUserWithoutKeysAndPopulateCB(err, userList) {
            if (err) {
                cm.log.error('ERROR: findUserWithoutKeysAndPopulateCB(): An error occurred finding the user list.');
            }
            if (userList && userList.length > 0) {
                cm.log.info('findUserWithoutKeysAndPopulateCB(): Some user keys were missing, am patching.');
                for (var i=0; i<userList.length; i++) {
                    generateKeysAndConfig(userList[i]);
                }
            }
        });
    }
};


/**
 * Close the database.
 */
exports.closeDb = function closeDb() {
    db.close();
};


/**
 * Some getter functions
 */
exports.getUserAccounts = function getUserAccounts() {
    return userAccounts;
};
exports.getConnsArchived = function getConnsArchived() {
    return connsArchived;
};
exports.getConnsActive = function getConnsActive() {
    return connsActive;
};
exports.getPurchases = function getPurchases() {
    return purchases;
};



/**
 * Get the configuration files from the DB and load them into 'regionalConfFiles[]'
 */
function getRegionalConfigFiles(ovpnConfigs, callback) {

    var regions = cm.cfg('server:regions');
    var r='';

    for (r in regions) {

        var region = regions[r];

        ovpnConfigs.findOne({region: region}, fnHandleRegionalConfigFilesResult);
    }
    callback();

    function fnHandleRegionalConfigFilesResult(err, confData) {
        if (err) {
            cm.log.error('ERROR: fnHandleRegionalConfigFilesResult(): An error occurred getting ovpn Conf data: ' + err);
        } else {
            regionalConfFiles[confData.region] = confData.file;
            cm.log.debug('fnHandleRegionalConfigFilesResult(): Added region to config file: ' + confData.region);
        }
    }
}


/*******************************************************************************************************************

      ##      ## ######## ########   ######  #### ######## ########    ##     ##  ######  ######## ########
      ##  ##  ## ##       ##     ## ##    ##  ##     ##    ##          ##     ## ##    ## ##       ##     ##
      ##  ##  ## ##       ##     ## ##        ##     ##    ##          ##     ## ##       ##       ##     ##
      ##  ##  ## ######   ########   ######   ##     ##    ######      ##     ##  ######  ######   ########
      ##  ##  ## ##       ##     ##       ##  ##     ##    ##          ##     ##       ## ##       ##   ##
      ##  ##  ## ##       ##     ## ##    ##  ##     ##    ##          ##     ## ##    ## ##       ##    ##
       ###  ###  ######## ########   ######  ####    ##    ########     #######   ######  ######## ##     ##

*******************************************************************************************************************/


/**
 *  Automatically login if session matches the user (user once clicked 'Remember me')
 */
exports.autoLogin = function autoLogin(user, callback) {
    /* Check user session exists */
    userAccounts.findOne({userId: user.userId, isActive: true}, userSelection_AccountInfo, function autoLoginCB(e, o) {

        if (o && user.password === o.password) {

            callback(null, o);

        } else {

            callback('No persistant user session');

        }
    });

};

/**
 *  Manually login - user entered email and password
 */
exports.manualLogin = function manualLogin(email, password, ip, callback) {

    userAccounts.findOne({email: email /*, isActive: true*/}, userSelection_AccountInfo, function manualLoginCB(e, usr) {

        if (usr === null) {

            callback('active user not found: ' + email);

        } else {

            validatePassword(password, usr.password, function validatePWCB(err, res) {
                if (res) {
                    callback(null, usr);
                    usr.invalidPWCount = 0;
                    usr.dateLastLogin = new Date();
                    usr.save(function updateUserOnManualLoginCB(err) {
                        if (err) {
                            cm.log.error('ERROR: updateUserOnManualLoginCB():'+err);
                        }
                    });
                } else {

                    callback('invalid-password');
                    cm.log.info('updateUserOnManualLoginCB(): Invalid login: (userId, IP): (' + usr.userId + ', ' + ip + ')');
                    setInvalidLoginAttempt(usr.userId);

                }
            });
        }
    });
};


/**
 * Create a new user account
 */
exports.addNewAccount = function addNewAccount(newUser, callback) {

    userAccounts.findOne({email:newUser.email}, userSelection_AccountInfo, function addNewAccountCB(e, o) {
        if (o) {
            callback('addNewAccount(): email-taken: '+ newUser.email);
        } else {
            addUser();
        }
    });


    function addUser() {

        /* Replace the already hashed (by client) password and hash it again. */
        newUser.password = encodePassword(newUser.password);

        /* Save to DB */
        var user = new userAccounts(newUser);
        user.save(function newUserSaveCB(er, usr) {
            if (er) {
                callback('unable to create new user');
            } else {
                purchases.createFreePurchase(usr, callback);
            }
        });

        /* Now we generate the keys and config file in the background */
        generateKeysAndConfig(user);

    }
};


/**
 * updateAccount
 * This will update the user given by the userId
 * @param userUpdates - JSON of user details that describe the user updates:
 *                               {'userId', 'newEmail' (new e-mail), 'newPassword' (new password)}
 */
exports.updateAccount = function updateAccount(userUpdates, callback) {

    var newEmail = userUpdates.newEmail;
    var newPassword = userUpdates.newPassword;
    var userId = userUpdates.userId;
    if (typeof(newEmail)    === 'undefined') newEmail    = '';
    if (typeof(newPassword) === 'undefined') newPassword = '';

    /* This query will check if a user does not have the same email address */
    var query = {
        email   :  newEmail.toLowerCase(),
        userId  :  { $ne: userUpdates.userId }
    };

    userAccounts.findOne(query, userSelection_AccountInfo, function updateAccountCB(err, data) {

        if (data) {
            callback('Email exists');
        } else {
            updateEmailAndPassword(callback);
        }
    });


    function updateEmailAndPassword(callback2) {

        userAccounts.findOne({userId:userId}, userSelection_AccountInfo, function(err, usr) {

            if (err) {
                callback2(err);
                return;
            }
            if (usr === null) {
                callback2('updateEmailAndPasswordCB: user not found');
                return;
            }

            if (newEmail    !== '') usr.email    = newEmail;
            if (newPassword !== '') usr.password = encodePassword(newPassword);

            usr.save(callback2);

        });

    }

};



/**
 * updateUserReminder
 * This will update the reminder values of the user.
 * @param userUpdates - JSON of user details that describe the user updates:
 *                               { userId, reminderChange : { remindMe, remindAt }}
 */
var reminderOptions = cm.cfg('user:reminderOptions');
exports.updateUserReminder = function updateUserReminder(updates, callback) {

    try {
        cm.assertHasProperty(updates, 'userId');
        cm.assertHasProperty(updates, 'reminderChange');
        cm.assertHasProperty(updates.reminderChange, 'remindMe');
        cm.assertHasProperty(updates.reminderChange, 'remindAt');
    } catch (err) {
        callback('The updates object does not have the correct attributes.');
        return null;
    }

    var query = { userId: updates.userId };
    var set = { $set : {
        reminder : {
            remindMe : updates.reminderChange.remindMe,
            remindAt : getBytesFromReminderSize(updates.reminderChange.remindAt)
            }
        }
    };

    userAccounts.findOneAndUpdate(query, set, function updateAccountCB(err, usr) {
        if (err) {
            callback('updateUserReminder(): Error updating reminderChange');
        } else {
            callback(null);
        }
    });


    function getBytesFromReminderSize(size) {
        for(var key in reminderOptions) {
            var reminder = reminderOptions[key];
            if (size === reminder.str) {
                return reminder.val;
            }
        }
        return null;
    }

};


/**
 * getOvpnConfFile
 * @param userId
 * @param callback
 */
exports.getOvpnConfFile = function getOvpnConfFile(userId, region, callback) {
    userAccounts.findOne({ userId:userId /*, isActive: true */}, userSelection_KeyInfo, function getOvpnConfFileCB(err, user) {
        if (err) {
            callback('Could not find user');
        } else {
            if (!user.keys  ||  !user.keys.crt) {
                callback('Keys not generated yet, please try again later.');
            } else {
                compileUserConfFile(user, region, callback);
            }
        }
    });
};

/**
 * updatePassword
 * This will update the password, this is called during the 'forget password' process
 * @param userId - the userId of the user
 * @param newPass - the new password of the user
 * @param resetCode - the reset code that is required by the user
 */
exports.updatePassword = function updatePassword(email, newPass, passwordResetCode, callback)
{

    var hashedPassword = encodePassword(newPass);

    userAccounts.findOneAndUpdate({ email: email, /*isActive: true, */ passwordResetCode:passwordResetCode },
                                  { password:hashedPassword, passwordResetCode:null },
                                  callback);
};

/**
 * Deactivate a given account.
 * @param userId - the userId
 * @param callback - the callback to run at the end
 */
exports.deactivateAccount = function deactivateAccount(userId, callback) {

    userAccounts.update({ userId: userId },
                        { password: 'deactivated', isActive : false },
                        callback);

};

/**
 * activateAccount
 * activate the account for first use.
 * @param email - the email of the user.
 * @param activationCode - a unique code that exists in the DB only until the user has clicked on the link.
 */
exports.activateAccount = function activateAccount(email, activationCode, callback) {

    userAccounts.findOneAndUpdate({ email: email, isActive: false, activationCode: activationCode },
                                  { isActive: true, activationCode: '', activationDate: new Date() },
                                  callback);
};

exports.getAccountByEmail = function getAccountByEmail(email, callback)
{
    userAccounts.findOne({email: email/*, isActive: true*/}, userSelection_AccountInfo, callback);
};

exports.getAccountByEmailAndSetPWResetCode = function getAccountByEmail(email, callback)
{
    var resetCode = cm.makeId();
    userAccounts.findOneAndUpdate({email: email/*, isActive: true*/},
                                  {passwordResetCode: resetCode },
                         function (err, usr) {
                             if (err) {
                                 callback('An error occurred' + err, null);
                             } else if (!usr) {
                                 callback('User not found', null);
                             } else {
                                 callback(null, usr);
                             }
                         });
};


exports.getUserConnectionKey = function getUserConnectionKey(userId, callback) {
    userAccounts.findOne({userId: userId/*, isActive: true*/}, {connectionKey:1, _id:0}, callback);
};


/**
 * Return all the user data in one object
 * @param  {String}   userId   The userId
 * @param  {Function} callback A typical callback
 */
exports.getAllUserData = function getAllUserData(userId, callback) {
    userAccounts.findOne({userId:userId}, function (err1, usr) {
        getUsersOpenConnections([userId], function (err2, connsActive) {
            getUsersArchivedConnections([userId], function (err3, connsArchived) {
                purchases.findByStatus(userId, cm.cfg('purchase:statuses'), function (err4, purchaseList) {

                    var result = {
                        /* user data */
                        _id: usr._id,
                        userId: usr.userId,
                        email: usr.email,
                        password: usr.password,
                        bytesFromClient: usr.bytesFromClient,
                        bytesToClient: usr.bytesToClient,
                        bytesToClientSaved: usr.bytesToClientSaved,
                        bytesPurchased: usr.bytesPurchased,
                        isActive: usr.isActive,
                        invalidPWCount: usr.invalidPWCount,
                        dateCreated: usr.dateCreated,
                        activationCode: usr.activationCode,
                        passwordResetCode: usr.passwordResetCode,

                        /* user object data */
                        connsActive : connsActive,
                        connsArchived : connsArchived,
                        purchaseList : purchaseList
                    };

                    callback(err4, result);
                });
            });
        });
    });
};


/**
 * Get the account details (bytes used and purchases) for the user.
 * @param  {String}   userId   The User ID
 * @param  {Function} callback The standard callback
 */
var viewAllowedPurchaseFields = cm.cfg('purchase:ui:allowedFields');
exports.getAccountDetails = function getAccountDetails(userId, callback) {

    purchases.updateState(userId, null, function (err1, num, userByteStats){
        if (err1) {
            cm.log.error('ERROR: getAccountDetailsCB(): ', err1);
        }
        if (userByteStats === null) {
            cm.log.error('ERROR: getAccountDetailsCB(): userByteStats not found for userId: ' + userId);
            userByteStats = {};
        }

        purchases.getAll(userId, function getAccountDetailsCB2(err2, purchaseList) {
            if (err2) {
                cm.log.error('ERROR: getAccountDetailsCB2(): ', err2);
                callback(err2, null);
                return;
            }

            /* We need to reverse the purchases so the latest are on top */
            purchaseList.reverse();

            /* Prepare the account details */
            for(var i=purchaseList.length-1; i>=0; i--) {
                var purchase = purchaseList[i];
                purchase.timeToExpiry     = cm.getTimeToExpiry(purchase.dateExpires);
                purchase.bytesUsedHR      = cm.bytesToSize(purchase.bytesUsed, 1);
                purchase.bytesPurchasedHR = cm.bytesToSize(purchase.bytesPurchased, 1);
                purchase.bytesRemaining   = purchase.bytesPurchased - purchase.bytesUsed;
                purchase.bytesRemainingHR = cm.bytesToSize(purchase.bytesRemaining, 1);
            }

            var accountDetails = userByteStats;
            accountDetails.purchaseList = cm.objectGetFields(purchaseList, viewAllowedPurchaseFields);

            /* Get the user reminder details */
            userAccounts.findOne({userId:userId}, 'reminder', function (err3, user) {
                callback(err3, accountDetails, user.reminder);
            });

        });
    });
};




/******************************************************************************************************************************************

      ##     ## ########  ##    ##        ######   #######  ##    ## ##    ## ########  ######  ######## ####  #######  ##    ##  ######
      ##     ## ##     ## ###   ##       ##    ## ##     ## ###   ## ###   ## ##       ##    ##    ##     ##  ##     ## ###   ## ##    ##
      ##     ## ##     ## ####  ##       ##       ##     ## ####  ## ####  ## ##       ##          ##     ##  ##     ## ####  ## ##
      ##     ## ########  ## ## ##       ##       ##     ## ## ## ## ## ## ## ######   ##          ##     ##  ##     ## ## ## ##  ######
       ##   ##  ##        ##  ####       ##       ##     ## ##  #### ##  #### ##       ##          ##     ##  ##     ## ##  ####       ##
        ## ##   ##        ##   ###       ##    ## ##     ## ##   ### ##   ### ##       ##    ##    ##     ##  ##     ## ##   ### ##    ##
         ###    ##        ##    ##        ######   #######  ##    ## ##    ## ########  ######     ##    ####  #######  ##    ##  ######

*******************************************************************************************************************************************/


/**
 * Gets the total number of bytes used by a user
 * @param data - contains userId - the user to lookup
 * @param callback(err, obj) - where object is the { bytesToClient, bytesFromClient, bytesPurchased, bytesBalance }
 */
exports.vpnUserGetRemainingBytes = vpnUserGetRemainingBytes;
function vpnUserGetRemainingBytes(userId, callback) {

    userAccounts.findOne({userId: userId/*, isActive: true*/}, function (err, user) {
        vpnUserGetRemainingBytesCB(err, user, callback);
    });
}

/**
 * Same as 'vpnUserGetRemainingBytes()', but requires UserConnectionKey - persistant login.
 */
exports.vpnUserGetRemainingBytes_ByUserConnectionKey = function vpnUserGetRemainingBytes_ByUserConnectionKey(userConnectionKey, callback) {
    userAccounts.findOne({connectionKey: userConnectionKey}, {keys:0}, function (err, user) {
        vpnUserGetRemainingBytesCB(err, user, callback);
    });
};

function vpnUserGetRemainingBytesCB(err, user, callback) {

    if (err) {
        callback(err);
        return;
    }

    if (user === null) {
        callback('vpnUserGetRemainingBytesCB(): User not found');
        return;
    }

    /* Now get the bytes used in all recent connections */
    connsActive.find( { userId: user.userId }, function userAccountsAggCB(e, conns) {

        if (e) {
            callback('Error: could not calculate connectionBytes: ' + e);
        } else {

            var bytesStats = getUserByteStats(user, conns);

            callback(null, bytesStats, user, conns);
        }
    });
}

/**
 * Checks if the user has bytes left.
 * @param data - JSON that contains connection information
 * @param callback(err) - sets 'err' to null if user is okay to login, otherwise err contains connection
 *                        error message.
 */
exports.vpnUserApproveLoginAndConnect = function vpnUserApproveLoginAndConnect(data, callback) {

    vpnUserGetRemainingBytes(data.userId, function vpnUserApproveLoginAndConnectCB(err, byteStats) {

        if (err) {
            callback(err);
            return;
        }

        if (byteStats.bytesBalance > 0) {

            /* Okay to VPN - user has bytes left */
            callback(null, data);

            /* Now add the details to the DB as a connection for the user */
            vpnUserAddConnection(data, function vpnUserGetRemainingBytesCB(err){
                if (err) {
                    cm.log.error('ERROR: vpnUserGetRemainingBytesCB(): ' + err);
                }
            });

        } else {
            callback('User has no bytes left, userId: ' + data.userId);
        }
    });
};


/**
 * This will add a user connection to the userAccounts collection for the given userId
 * @param data
 */
exports._vpnUserAddConnection = vpnUserAddConnection;
function vpnUserAddConnection(data, callback) {

    var userId = data.userId;
    var connection = {
        userId:             userId,
        isActive:           true,
        bytesToClient:      0,
        bytesFromClient:    0,
        dateConnected:      data.timeISO,
        dateConnectedUnix:  data.timeUnix,
        dateDisconnected:   null,
        dateLastActivity:   data.timeISO,
        disconnectedReason: null,
        clientIP:           data.clientIP,
        clientIPv6:         data.clientIPv6,
        assignedIP:         data.assignedIP,
        serverNetDev:       data.networkDev,
        /* serverIP:           data.server.ip,     */
        /* serverRegion:       data.server.region, */
        serverHostname:     data.server.hostname
    };

    if (data.server.hostname === null) cm.log.error('ERROR: vpnUserAddConnection(): data.server.hostname is null: data.server=', data.server);

    /* Now insert it into the database */
    userAccounts.findOne({userId: userId}, function vpnUserAddConnectionCB(err, usr) {

        if (err) {
            callback('vpnUserAddConnectionCB(): There was an error: ' + err);
        } else if (usr === null) {
            callback('vpnUserAddConnectionCB(): Could not find user: ' + JSON.stringify(connection));
        } else {
            connsActive.create(connection, function addConnectionCB(e, o) {
                if (e) {
                    callback('addConnectionCB(): Could not save connections to user: (userId: ' + userId + '):  ' + JSON.stringify(data) + '\n' + e);
                } else {
                    callback(null, o);
                }
            });
        }
    });
}


/**
 * This will find and update a connection for a user
 * @param userId - the user Id of the user
 * @param dateConnectedUnix - the date the connection was started
 * @param updates - a JSON describing the fields to be updated.
 * @param callback - the callback that will be called to handle the response
 */
function updateActiveConnection(userId, dateConnectedUnix, updates, callback) {
    var query = {
            userId: userId,
            dateConnectedUnix: dateConnectedUnix
    };
    connsActive.findOneAndUpdate(query, updates, function updateActiveConnectionCB(err, usr_connection) {
        if (err) {
            callback('updateActiveConnectionCB(): ' + err);
        } else if (usr_connection === null) {
            callback('updateActiveConnectionCB() - user not found when one was expected: ' + userId);
        } else {
            callback(null, usr_connection);
        }
    });
}


/**
 * When a user gets disconnected then we call this.
 * @param data - the object data posted by openvpn
 * @param callback
 */
exports.vpnUserDisconnected = vpnUserDisconnected;
function vpnUserDisconnected(data, callback) {
    closeConnection(data.userId, data.timeUnix, data.signal, data.bytesFromClient, data.bytesToClient, callback);
}


/**
 * Close a connection, then archive that connection.  Then update the bytesUsed element.
 */
function closeConnection(userId, timeUnix, disconnectedReason, bytesToClient, bytesFromClient, callback) {

    var query = {
        userId : userId,
        dateConnectedUnix : timeUnix
    };
    var now = new Date();
    var updates = {
        dateDisconnected : now,
        dateLastActivity : now,
        disconnectedReason : disconnectedReason,
        bytesToClient    : bytesToClient,
        bytesFromClient  : bytesFromClient
    };

    /* This value is not provided when we disconnect from the VPN.  So we need to hoist it from the active query. */
    var bytesToClientSaved = 0;

    connsActive.findOneAndUpdate(query, updates, function (err, conn) {
        if (err) {
            cm.log.error('ERROR: updateAndCloseActiveConnection(): ', err);
        }

        if (conn !== null) {
            bytesToClientSaved = conn.bytesToClientSaved;
        }
        archiveActiveConnection(conn, updateUserBytesUsed);
    });



    function updateUserBytesUsed(err) {
        if (err) {
            callback(err);
        } else {
            userAccounts.update({userId:userId}, {
                $inc : {
                    bytesToClient : bytesToClient,
                    bytesFromClient : bytesFromClient,
                    bytesToClientSaved : bytesToClientSaved
                }
            }, function updateUserBytesUsedCB(err, obj) {
                if (err) {
                    cm.log.error('ERROR:updateUserBytesUsedCB(): ', err);
                }
                callback(err, obj);
            });
        }
    }
}


/**
 * Take an active connection (conn) and:
 *   1) Archive it
 *   2) On success of archiving, delete it from the active connections.
 */
function archiveActiveConnection(conn, callback) {
    if (conn) {
        connsArchived.create(conn, function archiveConnectionCB(err1) {
            if (err1) {
                callback(err1, null);
            } else {
                connsActive.remove({ _id: conn._id }, function closeActiveConnectionCB(err2) {
                    if (err2) {
                        cm.log.error('ERROR: closeActiveConnectionCB(): ', err2);
                    }
                    callback(err2, null);
                });
            }
        });
    } else {
        callback('ERROR: archiveActiveConnection(): Connection not provided');
    }
}

/**
 * When a user has been reminded, we only want to send them one email.
 * @param {[type]} userId [description]
 */
function setUserHasBeenReminded(userId, hasBeenReminded) {
    userAccounts.update({ userId: userId },
                        { 'reminder.reminded' : hasBeenReminded },
                        function (err) {
                            if (err) {
                                cm.log.error('ERROR: setUserHasBeenReminded(): ', err);
                            }
                        });
}


/**
 * Update the user stats.  Return the list of users that need to be disconnected.
 * @param userList - a list of users' data { userId, assignedIP, bytesToClient, bytesFromClient, dateConnectedUnix }
 * @param callback(err, usersToBoot) - list of users to boot from OpenVPN.
 * @return userIdListToBoot - an array of userId, these users can be disconnected.
 */
exports.vpnUserUpdateStats = function vpnUserUpdateStats(userList, callback) {

    /* When a user's byte balance is 0 or negative, then we add the userId to this array */
    var userIdListToBoot = [];
    var errorOccurred = false;
    var numComplete = userList.length;

    if (typeof(numComplete) !== 'number') {
        cm.log.error('ERROR: vpnUserUpdateStats(): userList error', userList);
    }

    for (var i=0; i<userList.length; i++) {
        var usr = userList[i];
        var updates = {
                $set: {
                    assignedIP: usr.assignedIP,
                    bytesToClient : usr.bytesToClient,
                    bytesToClientSaved : usr.bytesToClientSaved,
                    bytesFromClient : usr.bytesFromClient,
                    dateLastActivity: new Date()
                }
        };

        updateActiveConnection(usr.userId, usr.dateConnectedUnix, updates, vpnUserUpdateStatsCallback);
    }

    /**
     * Once we found the user with the given query, we then calculate the remaining bytes.
     * @param err
     * @param usr
     */
    function vpnUserUpdateStatsCallback(err, conn) {
        if(err) {
            cm.log.error('ERROR: vpnUserUpdateStatsCallback(): ' + err);
            errorOccurred = true;
        } else {

            var userId = conn.userId;
            userAccounts.findOne({ userId : userId }, function (e, usr) {

                if (conn && usr) {
                    var userByteStats = getUserByteStats(usr, conn);

                    /* Check if we need to boot the user */
                    if (userByteStats.isOverBalance) {
                        userIdListToBoot.push(userId);

                        purchases.updateState(userId, userByteStats, function (){});
                    }

                    /* Check if we need to send the user an email to say their account is low */
                    if (userByteStats.reminderTrigger) {

                        /* Only send notification if the user has not been reminded */
                        if ( usr.reminder.reminded === false ) {
                            em.dispatchLowDataReminder({email:usr.email, bytesBalance : userByteStats.bytesBalance });
                            setUserHasBeenReminded(userId, true);
                        }

                    }
                }

                if (--numComplete === 0) {
                    if (errorOccurred) {
                        callback(err, null);
                    } else {
                        callback(null, userIdListToBoot);
                    }
                }
            });

        }
    }
};


/**
 * For all users find the ones with closed connections.
 * @param callback
 */
exports.getAllArchivedConnections = getAllArchivedConnections;
function  getAllArchivedConnections(callback) {
    getConnectionsByState(null, false, callback);
}

/**
 * For a list of users, get the a list of closed connections
 * @param userList[]
 * @param callback
 */
exports.getUsersArchivedConnections = getUsersArchivedConnections;
function  getUsersArchivedConnections(userList, callback) {
    getConnectionsByState(userList, false, callback);
}

/**
 * For a list of users, get the a list of open (active) connections
 * @param userList[]
 * @param callback
 */
exports.getUsersOpenConnections = getUsersOpenConnections;
function  getUsersOpenConnections(userList, callback) {
    getConnectionsByState(userList, true, callback);
}


/**
 * Generic function to get the users based on the "isActive" state.
 * @param userList[] - this list of users
 * @param isActiveVal - the value of the 'isActive' element.
 */
function getConnectionsByState(userList, isActiveVal, callback) {

    /* Nothing in, Nothing out */
    if (typeof(userList) === 'undefined') {
        callback(null, []);
        return;
    }

    /* Convert to array if we are given only one userList object */
    if (typeof(userList) === 'string') {
        userList = [userList];
    }

    /* Nothing in, Nothing out */
    if (userList !== null && userList.length === 0) {
        callback(null, []);
        return;
    }

    var query;

    /* If userList is null, then we are selecting all users */
    if (userList === null) {
        query = {};
    } else {
        query = {
            userId : { $in : userList },
        };
    }

    var connCollection;
    if (isActiveVal) {
        connCollection = connsActive;
    } else {
        connCollection = connsArchived;
    }

    connCollection.find(query, filterResultsCB);

    /*
     * Remove the documents we don't need.
     *
     * Ideally, we would not require this function, but Mongo DB will only return the first operator
     * when you use the $elemMatch projection.
     *
     */
    function filterResultsCB(err, conns) {

        if (err || conns === null) {
            callback(err, null);
            return;
        }

        callback(null, conns);
    }
}


/************************************************************************************************

      ########  ##     ## ########   ######  ##     ##    ###     ######  #### ##    ##  ######
      ##     ## ##     ## ##     ## ##    ## ##     ##   ## ##   ##    ##  ##  ###   ## ##    ##
      ##     ## ##     ## ##     ## ##       ##     ##  ##   ##  ##        ##  ####  ## ##
      ########  ##     ## ########  ##       ######### ##     ##  ######   ##  ## ## ## ##   ####
      ##        ##     ## ##   ##   ##       ##     ## #########       ##  ##  ##  #### ##    ##
      ##        ##     ## ##    ##  ##    ## ##     ## ##     ## ##    ##  ##  ##   ### ##    ##
      ##         #######  ##     ##  ######  ##     ## ##     ##  ######  #### ##    ##  ######

**************************************************************************************************/


var purchaseLogfile = cm.cfg('purchase:logFile');
var fs = require('fs');


/**
 * Create the purchasing functions and apply them to the purchasing object/class.
 */
function initPurchasing() {


    function purchaseIsOpen(purchase) {
        return purchasesStatusOpen.indexOf(purchase.status) >= 0;
    }
    function purchaseIsClosed(purchase) {
        return purchasesStatusClosed.indexOf(purchase.status) >= 0;
    }

    /**
     * Find and return all pending purchases.
     * @param  {String} userId The user
     * @return {Object}        The list of pending purhcases (sorted by dateExpires descending)
     */
    purchases.findPending = function(userId, callback) {
        purchases.findByStatus(userId, purchasesStatusPending, { dateExpires : 1 }, callback);
    };

    /**
     * Find the pending orders given the vendorPaymentId
     * @param  {string}   vendorPaymentId The VendorPayment ID
     * @param  {Function} callback        A standard callback
     */
    purchases.findPendingByVendorPaymentId = function(vendorPaymentId, callback) {
        purchases.findOne({'paymentDetails.vendorPaymentId': vendorPaymentId}, cm.genericCB('findPendingByVendorPaymentIdCB', callback));
    };

    /**
     * Find and return all open purchases.
     * @param  {String} userId The user
     * @return {Object}        The list of open purhcases (sorted by dateExpires descending)
     */
    purchases.findOpen = function(userId, callback) {
        purchases.findByStatus(userId, purchasesStatusOpen, { dateExpires : 1 }, callback);
    };

    /**
     * Find and return all closed purchases.
     * @param  {String} userId The user
     * @return {Object}        The list of closed purhcases (sorted by dateActive descending)
     */
    purchases.findClosed = function(userId, callback) {
        purchases.findByStatus(userId, purchasesStatusClosed, { dateClosed : 1 }, callback);
    };

    /**
     * Find and return all purchases by the list of statuses given.
     * @param  {String}     userId      The user
     * @param  {[String]}   statusList  Array of statuses
     * @param  {Object}     sortorder   (Optional) The sort order of purchases
     * @return {Object}                 The list of purchases (sorted by dateActive descending)
     */
    purchases.findByStatus = function(userId, statusList, sortorder, callback) {

        if (typeof(userId) !== 'string') {
            callback('findByStatus(): userId is not a string', null);
        }

        if (typeof(sortorder) === 'function') {
            callback = sortorder;
            sortorder = { dateExpires : 1 };
        }

        var query = {
            userId: userId,
            status: {
                $in: statusList
            }
        };
        var sort = {
            sort : sortorder
        };

        purchases.find(query, null, sort, cm.genericCB('findByStatusCB', callback));
    };

    /**
     * Get all the purchases, in the given order:
     *   - Closed  (sorted by dateClosed)
     *   - Open    (sorted by dateExpires)
     *   - Pending (sorted by dateExpires)
     */
    purchases.getAll = function(userId, callback) {

        purchases.findPending(userId, function (err0, pendingPurchases) {

            if (err0) {
                cm.log.error('ERROR: getAll()-findPending:',err0);
            }
            if (pendingPurchases === null) {
                pendingPurchases = [];
            }

            purchases.findOpen(userId, function (err1, openPurchases){
                if (err1) {
                    cm.log.error('ERROR: getAll()-findOpen:',err1);
                }
                if (openPurchases === null) {
                    openPurchases = [];
                }
                purchases.findClosed(userId, function (err2, closedPurchases){
                    if (err2) {
                        cm.log.error('ERROR: getAll()-findClosed:',err2);
                    }
                    if (closedPurchases === null) {
                        closedPurchases = [];
                    }

                    callback(err2, closedPurchases.concat(openPurchases).concat(pendingPurchases));
                });
            });
        });

    };




    /**
     * Sum of the 'bytesPurchased' on all the open purchases
     */
    purchases.sumBytesPurchasedForOpen = function(userId, callback) {

        var bytesPurchased = 0;

        /* Sum open purchases using bytesPurchased */
        purchases.findOpen(userId, function sumBytesPurchasedForOpenCB(err, purchaseList) {
            if (err) {
                cm.log.error('ERROR: sumBytesPurchasedForOpenCB(): ', err);
            } else {
                for (var i=0; i < purchaseList.length; i++) {
                    bytesPurchased += purchaseList[i].bytesPurchased;
                }
            }
            callback(err, bytesPurchased);
        });

    };

    /**
     * Sum of the 'bytesUsed' on all the closed purchases
     */
    purchases.sumBytesUsedForClosed = function(userId, callback) {

        var bytesUsed = 0;

        /* Sum closed purchases using bytesUsed */
        purchases.findClosed(userId, function sumBytesUsedForClosedCB(err, purchaseList) {
            if (err) {
                cm.log.error('ERROR: sumBytesUsedForClosedCB(): ', err);
            } else {
                for (var i=0; i < purchaseList.length; i++) {
                    bytesUsed += purchaseList[i].bytesUsed;
                }
            }

            callback(err, bytesUsed);
        });
    };


    /**
     * Find all purchases about to expire and run the function at the expiry time.
     * If options is provided and setUpCronJob=false, then we wait until all purchases
     * have expired.
     */
    purchases.findExpiringIn24Hours = function(options, callback) {

        if (typeof(options) === 'undefined') {
            options = { setUpCronJob : true };
            callback = function () {};
        }

        /* Run this function every 24 hours */
        if (options.setUpCronJob) {
            setTimeout(purchases.findExpiringIn24Hours, cm.cfg('purchase:expiryCheckFrequency'));
        }

        var query = {
            status : {
                $in : purchasesStatusOpen
            },
            dateExpires: {
                $lt: cm.getTimeIn24Hr()
            }
        };

        purchases.find(query, function findExpiringIn24HoursCB(err, purchaseList) {
            if (err) {
                cm.log.error('ERROR: findExpiringIn24HoursCB(): ', err);
                return;
            }

            var len = purchaseList.length;
            if (len === 0) {
                callback();
            }

            purchaseList.forEach(function (purchase) {
                cm.setToHappen(timedExpiry, purchase.dateExpires);

                function timedExpiry() {
                    purchases.setExpired(purchase, function (err) {
                        if (--len === 0) {
                            callback();
                        }
                    });
                }
            });
        });
    };


    /**
     * Set the given purchase to 'expired'.  When a purchase expires we need to calculate the remaining
     * bytes and subtract this from the total purchased, since potentially not all the bytes were used.
     */
    purchases.setExpired = function(purchase, callback) {
        if (typeof(purchase) === 'undefined') {
            callback('Purchase is not defined', null);
            return;
        }

        /* Check purchase is not already closed */
        if ( purchaseIsClosed(purchase) ) {
            callback('Purchase is already closed: _id=' + purchase._id, null);
            return;
        }

        /* Update the purchase */
        purchases.getRemainingBytesUsed(purchase, doSetExpired);

        function doSetExpired(err, bytesCalc) {
            purchase.status = 'expired';
            purchase.dateClosed = new Date();
            purchase.bytesUsed = bytesCalc.bytesUsed;
            purchase.save(function (err2, obj) {

                if (err2) {
                    cm.log.error('ERROR: doSetExpired(): ',err2);
                }

                /* Update the user account, if necessary */
                if (bytesCalc.remainingBytesUsed > 0) {
                    userAccounts.findOneAndUpdate(
                        { userId: purchase.userId },
                        { $inc : { bytesPurchased: -bytesCalc.remainingBytesUsed } },
                        function setExpiredUpdateAccCB(err3, usr) {
                            if (err3) {
                                cm.log.error('ERROR: setExpiredUpdateAccCB(): ' + purchase.userId, err);
                            }
                            getAndMakeActivePurchase(purchase.userId, callback);
                        }
                    );

                } else {
                    getAndMakeActivePurchase(purchase.userId, callback);
                }
            });
        }

    };

    /**
     * Set the given purchase to 'used'.
     */
    purchases.setUsed = function(purchase, callback) {

        /* Check purchase is not already closed */
        if ( purchaseIsClosed(purchase) ) {
            callback('Purchase is already closed: _id=' + purchase._id, null);
            return;
        }

        /* Update the purchase */
        purchase.status = 'used';
        purchase.dateClosed = new Date();
        purchase.bytesUsed = purchase.bytesPurchased;
        purchase.save(function (err, savedPurchase) {
            if (err) {
                cm.log.error('ERROR: setUsedCB(): ', err);
                callback(err, null);
                return;
            }
            getAndMakeActivePurchase(purchase.userId, function (err2, obj) {
                callback(err2, savedPurchase);
            });
        });
    };


    /**
     * Get the remaining bytes when we take into consideration all the bytes used.  Before we close
     * a purchase or view a purchase online we need to make sure count the bytesUsed on that
     * purchase correctly.  This function will calculate the bytesUsed for this purpose, as well as the
     * bytesRemaining.
     * @return {Object} The 'bytesUsed' and 'remainingBytesUsed'
     */
    purchases.getRemainingBytesUsed = function(purchase, callback) {

        var result = {
            bytesUsed : 0,
            remainingBytesUsed : 0
        };

        /* The bytesUsed for this purchase is the totalBytesUsed minus the
           sum of the closed purchases, with a limit of the bytesPurchased of this
           purchase. */
        purchases.sumBytesUsedForClosed(purchase.userId, function getRemainingBytesUsedCB(err, sumBytesUsedForClosed) {

            if (err) {
                cm.log.error('ERROR: getRemainingBytesUsedCB(): ', err);
                callback(err);
                return;
            }

            vpnUserGetRemainingBytes(purchase.userId, function getRemainingBytesUsedCB2(err2, userByteStats) {
                if (err2) {
                    cm.log.error('ERROR: getRemainingBytesUsedCB2(): ', err);
                    callback(err);
                    return;
                }

                var userBytesUsed = 0;
                if (userByteStats !== null) {
                    userBytesUsed = userByteStats.bytesUsed;
                }

                /* Caclulate and save the bytesUsed */
                result.bytesUsed = userBytesUsed - sumBytesUsedForClosed;
                result.bytesUsed  = Math.min(result.bytesUsed, purchase.bytesPurchased);

                /* Subtract the remainder from the bytes used */
                result.remainingBytesUsed = purchase.bytesPurchased - result.bytesUsed;

                callback(err, result);

            });

        });
    };

    /**
     * Update the state of all purchases.  This will traverse all purchases and close those that
     * need to be.
     * @param  {String}   userId        The userId
     * @param  {Object}   userByteStats The byte stats as provided by the getUserByteStats() function
     * @param  {Function} callback      Returns the number of purchases closed.
     */
    purchases.updateState = function(userId, userByteStats, callback) {

        /* If userByteStats is not set, then we need to go get it */
        if (userByteStats === null) {
            updateBytesPurchased(userId, function (err1, bytesPurchased) {
                vpnUserGetRemainingBytes(userId, function (err2, byteStats, usr, conns) {
                    userByteStats = byteStats;
                    doUpdate(null, callback);
                });
            });
        } else {
            doUpdate(null, callback);
        }


        function doUpdate(err, doUpdateCallback) {

            purchases.getAll(userId, cm.genericCB('updateState-getAllPurchases', function(err, allPurchases) {
                if (err) return;

                var totalBytesUsed = userByteStats.bytesUsed;
                var cummulativeSumBytesUsed = 0;

                var purchasesToClose = [];

                for (var i=0; i<allPurchases.length; i++) {
                    var purchase = allPurchases[i];

                    if (purchaseIsClosed(purchase)) {
                        cummulativeSumBytesUsed += purchase.bytesUsed;

                        /* Test the closed purchases */
                        if (cummulativeSumBytesUsed > totalBytesUsed) {
                            cm.log.error('ERROR: updateState(): There is a problem with the state of the purchases.');
                        }

                    } else if (purchaseIsOpen(purchase)) {
                        cummulativeSumBytesUsed += purchase.bytesPurchased;

                        /* Find the purchases to close */
                        if (cummulativeSumBytesUsed <= totalBytesUsed) {
                            purchasesToClose.push(purchase);
                        }
                    }
                }

                async.map(purchasesToClose, purchases.setUsed, function(err, results) {
                    if (err) {
                        cm.log.error('ERROR: updateState()-async.map: ', err);
                    }
                    doUpdateCallback(err, purchasesToClose.length, userByteStats);
                });
            }));
        }
    };


    var defaultBytesBalance = cm.cfg('purchase:defaultBytesBalance');
    /**
     * Set up a free purchase with the defualt values, then save it.
     * @param  {object}   usr      The user
     * @param  {Function} callback [description]
     */
    purchases.createFreePurchase = function(usr, callback) {
        var freePurchase = {
                              userId:             usr.userId,
                              bytesPurchased:     defaultBytesBalance,
                              name:               'Free',
                              paymentDetails: {
                                  method:             'Free'
                              }
                          };

        savePurchase(freePurchase, function (err, purchase) {
            callback(err, usr);
        });
    };

}



/**
 * Given valid purchase details, save a purchase to the database.
 * @param  {Object}   purchaseDetails The purchase details using the valid schema.
 * @param  {Function} callback        Standard callback
 */
exports.savePurchase = savePurchase;
function savePurchase(purchaseDetails, callback) {

    var purchase = new purchases(purchaseDetails);
    purchase.save(function savePurchaseSaveCB(err, savedPurchase) {

        if (err) {
            cm.log.error('ERROR: savePurchaseSaveCB: Unable to save purchaseDetails: ', err);
            callback(err, savedPurchase);
            return;
        }

        var userId = purchaseDetails.userId;

        /* Clear the user has been reminded flag */
        setUserHasBeenReminded(userId, false);

        /* Update the purchases */
        getAndMakeActivePurchase(userId, function getAndMakeActivePurchaseCB(err) {
            if (err) {
                cm.log.error('ERROR: getAndMakeActivePurchaseCB', err);
            }
            updateBytesPurchased(userId, function(){
                callback(err, savedPurchase);
            });
        });
    });
}


/**
 * Find all purchases and make one active if there is not one
 * @param  {String} userId          The user to search
 * @return {Object} activeStatus    The active status
 */
function getAndMakeActivePurchase(userId, callback) {

    /* Find and return the active purchase */
    purchases.findByStatus(userId, ['active'], function getAndMakeActivePurchaseFindByStatusCB(err, purchaseList) {
        if (err) {
            cm.log.error('ERROR: getAndMakeActivePurchaseFindByStatusCB', err);
            callback(err);
        } else if (purchaseList.length > 1) {
            cm.log.error('ERROR: getAndMakeActivePurchaseFindByStatusCB(): More than one active purchase found.');
            callback(null, purchaseList[0]);
        } else if (purchaseList.length === 1) {
            callback(null, purchaseList[0]);
        } else {

            /* If here, then no active purchase, we have to make one */
            purchaseList = purchases.findByStatus(userId, ['new'], function getAndMakeActivePurchaseFindByStatusNewPurchCB(err, newPurchaseList){
                if (err) {
                    cm.log.error('ERROR: getAndMakeActivePurchaseFindByStatusNewPurchCB', err);
                    callback(err);
                } else if (newPurchaseList.length > 0) {
                    newPurchaseList[0].status = 'active';
                    newPurchaseList[0].save();
                    callback(null, newPurchaseList[0]);
                } else {

                    /* No Open purchases found */
                    callback(null, null);
                }
            });
        }
    });

}


/**
 * Update the 'bytesUsed' field in userAccounts collection.  This the sum of all bytesUsed on old connections
 * and the sum of 'bytesPurchased' on the new/active connections.
 * @param  {String} userId          The user.
 * @param {Function} callback     bytesPurchased  The new value of bytesPurchased for the user.
 */
function updateBytesPurchased(userId, callback) {

    var newBytesPurchased = 0;

    purchases.sumBytesPurchasedForOpen(userId, function(err,  bytesPurchased) {

    newBytesPurchased += bytesPurchased;

    purchases.sumBytesUsedForClosed(userId, function(err,  bytesUsed) {

    newBytesPurchased += bytesUsed;
    callback(null, newBytesPurchased);

    userAccounts.findOneAndUpdate({userId:userId}, {bytesPurchased:newBytesPurchased}, function updateBytesPurchasedUpdateUserAccCB(err) {
        if (err) {
            cm.log.error('ERROR: updateBytesPurchasedUpdateUserAccCB: ', err);
        }
    });
    });
    });
}



/**
 * Check if the post made by the user to select the GB and price of an option is valid.
 * @param  {object}  body The POST body in object form
 * @return {object}       null if there was a problem.  The updated object (based on the post) if all was okay.
 */
var pricingData = cm.cfg('purchase:pricingData');
var methodTypesList = cm.cfg('purchase:method:types');
exports.isValidPurchasePost = function isValidPurchasePost(req) {

    var body = req.body;

    var purchaseDetails = {};

    try {

        cm.assertHasProperty(req, 'session');
        cm.assertHasProperty(req.session.user, 'userId');
        cm.assertHasProperty(req.session.user, 'email');

    } catch (err) {
        cm.log.error('ERROR: isValidPurchasePost(): ', err);
        return null;
    }

    if (typeof(body) !== 'object') {
        cm.log.error('ERROR: isValidPurchasePost(): invalid body: ', body);
        return null;
    }
    if (typeof(body['plan-name']) !== 'string') {
        cm.log.error('ERROR: isValidPurchasePost(): invalid body[\'plan-name\']: ', body['plan-name']);
        return null;
    }
    if (typeof(body['plan-gb']) !== 'string') {
        cm.log.error('ERROR: isValidPurchasePost(): invalid body[\'plan-gb\']: ', body['plan-gb']);
        return null;
    }
    if (typeof(body['plan-price']) !== 'string') {
        cm.log.error('ERROR: isValidPurchasePost(): invalid body[\'plan-price\']: ', body['plan-price']);
        return null;
    }
    if (typeof(body['plan-id']) !== 'string') {
        cm.log.error('ERROR: isValidPurchasePost(): invalid body[\'plan-id\']: ', body['plan-id']);
        return null;
    }

    /* Now check the price, id and gb all match */
    try {
        var id = body['plan-id'];
        var element = pricingData[id];
        var validGB = Math.round(element[0] * 10) / 10.0;
        var validPrice = element[1];

        if (typeof(validPrice) !== 'number') {
            cm.log.error('ERROR: isValidPurchasePost(): validPrice is not valid: id = ', id);
            return null;
        }
        if (typeof(validGB) !== 'number') {
            cm.log.error('ERROR: isValidPurchasePost(): validGB is not valid: id =  ', id);
            return null;
        }

        var bodyGB = parseFloat(body['plan-gb'].match(/[0-9\.]*/)[0]);
        if (bodyGB !== validGB) {
            cm.log.error('ERROR: isValidPurchasePost(): validGB is not the value expected: body, element, expectedValue =  ', body, element, validGB);
            return null;
        }

        var bodyPrice = parseFloat(body['plan-price'].match(/\$([0-9\.]*)/)[1]);
        if (bodyPrice !== validPrice) {
            cm.log.error('ERROR: isValidPurchasePost(): validPrice is not the value expected: body, element, expectedValue =  ', body, element, validPrice);
            return null;
        }

        purchaseDetails.id = id;
        purchaseDetails.valueUSD = validPrice;
        purchaseDetails.bytesPurchased = validGB * 1024 * 1024 * 1024;
        purchaseDetails.name = body['plan-name'];
        purchaseDetails.purchaseId = cm.makeId();
        purchaseDetails.userId = req.session.user.userId;
        purchaseDetails.email = req.session.user.email;

    } catch (err) {
        cm.log.error('ERROR: isValidPurchasePost(): error occurred finding pricing details: ', err, body);
        return null;
    }

    /* Check the payment method */
    if (methodTypesList.indexOf(body.method) === -1) {
        cm.log.error('ERROR: isValidPurchasePost(): payment method is not valid: ', body);
        return null;
    }
    purchaseDetails.method = body.method;

    return purchaseDetails;

};






var paymentCompleteStatusList  = cm.cfg('payment:bitpay:paymentCompleteStatusList').concat(cm.cfg('payment:paypal:paymentCompleteStatusList'));
var paymentCancelledStatusList = cm.cfg('payment:bitpay:paymentCancelledStatusList').concat(cm.cfg('payment:paypal:paymentCancelledStatusList'));
function paymentStatusIsCancelled(status) {
    return paymentCancelledStatusList.indexOf(status) >= 0;
}
function paymentStatusIsComplete(status) {
    return paymentCompleteStatusList.indexOf(status) >= 0;
}

exports.updatePurchaseStatus = function updatePurchaseStatus(paymentDetails, callback) {
    purchases.findPendingByVendorPaymentId(paymentDetails.vendorPaymentId, function (err1, purchase) {

        if (err1) {
            cm.log.error('ERROR: updatePurchaseStatus() err1: ', err1);
            callback(err1, null);
            return;
        }
        if (purchase === null) {
            cm.log.error('ERROR: updatePurchaseStatus(): Purchase not found, paymentDetails= ', paymentDetails);
            callback('Purchase not found', null);
            return;
        }

        /* Payment timed out or was cancelled */
        if (paymentStatusIsCancelled(paymentDetails.vendorStatus)) {
            purchase.status = 'cancelled';
        }

        /* Payment status is complete - need to check if the correct payment was made */
        if (paymentStatusIsComplete(paymentDetails.vendorStatus)) {
            if (purchase.status === 'pending payment confirmation') {

                purchase.status = 'new';

                /* Update the details, adjust GB if necessary */
                var pricePaid = paymentDetails.valueUSD;

                /* Update the vendor status and save */
                purchase.paymentDetails.vendorStatus = paymentDetails.vendorStatus;
                purchase.paymentDetails.valueUSD = pricePaid;

                /* Now send the confirmation email */
                sendUserPaymentConfirmationEmail(purchase.userId, {
                    purchase  : purchase,
                    pricePaid : pricePaid,
                });
            }
        }

        purchase.paymentDetails = paymentDetails;
        purchase.save(function (err, obj) {
            if (err) {
                cm.log.error('ERROR: updatePurchaseStatus(): ', err);
            }
            callback(err, obj);
        });

    });
};


var em = require('../common/email-dispatcher');
function sendUserPaymentConfirmationEmail(userId, details) {

    userAccounts.findOne({userId: userId}, {email:1}, function (err, usr) {

        if (err) {
            cm.log.error('ERROR: setPurchaseToPaid(): ', err);
            return;
        }
        details.email = usr.email;
        em.dispatchPurchaseConfirmation(details);
    });
}

function findPaymentByStatus(statusList, callback) {

    purchases.find({
        'status' : {
            $in : statusList
        },
        datePurchased : {
            $lt : cm.getTimeOneHourAgo()
        }
    }, function (err, purchaseList) {
        if (err) {
            cm.log.error('ERROR: findPaymentByVendorStatus(): ', err);
        }
        callback(err, purchaseList);
    });
}

exports.findOutstandingVendorPaymentIds = function findOutstandingPayments(callback) {

    findPaymentByStatus(purchasesStatusPending, function (err, purchaseList) {
        if (err) {
            callback(err, null);
            return;
        }
        var outstandingVendorPaymentIdList = [];
        for (var i=0; i<purchaseList.length; i++) {
            var purchase = purchaseList[i];
            outstandingVendorPaymentIdList.push(purchase.paymentDetails.vendorPaymentId);
        }
        callback(null, outstandingVendorPaymentIdList);
    });

};

/************************************************************************************************************************

      ##     ## ######## #### ##          ######## ##     ## ##    ##  ######  ######## ####  #######  ##    ##  ######
      ##     ##    ##     ##  ##          ##       ##     ## ###   ## ##    ##    ##     ##  ##     ## ###   ## ##    ##
      ##     ##    ##     ##  ##          ##       ##     ## ####  ## ##          ##     ##  ##     ## ####  ## ##
      ##     ##    ##     ##  ##          ######   ##     ## ## ## ## ##          ##     ##  ##     ## ## ## ##  ######
      ##     ##    ##     ##  ##          ##       ##     ## ##  #### ##          ##     ##  ##     ## ##  ####       ##
      ##     ##    ##     ##  ##          ##       ##     ## ##   ### ##    ##    ##     ##  ##     ## ##   ### ##    ##
       #######     ##    #### ########    ##        #######  ##    ##  ######     ##    ####  #######  ##    ##  ######

 ************************************************************************************************************************/


/**
 * Given a user object (connections and all) we can calculate bytes used so far.
 * @param user - the user object
 * @returns the bytes used as To/From object
 */
function calcUserTotalBytesUsed(conns) {
    var bytesToClient = 0;
    var bytesToClientSaved = 0;
    var bytesFromClient = 0;

    if (typeof(conns) === 'undefined') {
        /* This means user has not established a connection */
        bytesToClient = 0;
        bytesToClientSaved = 0;
        bytesFromClient = 0;
    } else if (typeof(conns.length) === 'undefined') {
        /* The conns object is an object */
        bytesToClient      = conns.bytesToClient;
        bytesToClientSaved = conns.bytesToClientSaved;
        bytesFromClient    = conns.bytesFromClient;
    } else {
        /* The conns object is an array of objects */
        for (var i = conns.length - 1; i >= 0; i--) {
            bytesToClient      += conns[i].bytesToClient;
            bytesToClientSaved += conns[i].bytesToClientSaved;
            bytesFromClient    += conns[i].bytesFromClient;
        }
    }

    return {
       bytesToClient      : bytesToClient,
       bytesToClientSaved : bytesToClientSaved,
       bytesFromClient    : bytesFromClient
   };
}

/**
 * Given an active connection object we can calculate the byte balance.
 * @param user - the user object
 * @returns { bytesToClient, bytesFromClient, bytesUsed, bytesPurchased, bytesBalance, isOverBalance }
 */
function getUserByteStats(user, conns) {

    /* Get the active connection bytes used */
    var userByteStats = calcUserTotalBytesUsed(conns);
    var oldBytesBalance = user.bytesPurchased - (user.bytesToClient + user.bytesFromClient);

    /* Now add on the archived connection count */
    userByteStats.bytesToClient   += user.bytesToClient;
    userByteStats.bytesToClientSaved += user.bytesToClientSaved;
    userByteStats.bytesFromClient += user.bytesFromClient;
    userByteStats.bytesUsed        = userByteStats.bytesToClient + userByteStats.bytesFromClient;

    /* Then calculate the rest */
    userByteStats.bytesPurchased = user.bytesPurchased;
    userByteStats.bytesBalance   = user.bytesPurchased - (userByteStats.bytesToClient + userByteStats.bytesFromClient);
    userByteStats.isOverBalance  = (userByteStats.bytesBalance <= 0);

    /* Check if we need to email the user.  This happens when the reminder bytes is between the values oldBytesBalance and newBytesBalance */
    if (user.reminder) {
        userByteStats.reminderTrigger = (user.reminder.remindMe &&
                                         userByteStats.bytesBalance < user.reminder.remindAt &&
                                                                      user.reminder.remindAt < oldBytesBalance);
    }

    return userByteStats;
}


/**
 * @param callback
 */
var querystring = require('querystring');
exports.getAllUsersForPrinting = function getAllUsersForPrinting(callback) {
    userAccounts.find(
        {},
        'email activationDate dateCreated dateLastLogin invalidPWCount isActive bytesPurchased bytesToClient bytesToClientSaved bytesFromClient',
        { sort: { dateCreated : -1 } },
        function(err, userList) {
            if (typeof(userList) === 'object') {

                for (var i=0; i<userList.length; i++) {

                    userList[i].activationDateFmt=cm.fmtDate(userList[i].activationDate);
                    userList[i].dateCreatedFmt=cm.fmtDate(userList[i].dateCreated);
                    userList[i].dateLastLoginFmt=cm.fmtDate(userList[i].dateLastLogin);

                    /* Convert the email to a clickable emailQuery such that we can click on a user */
                    userList[i].emailQuery = querystring.stringify({e:userList[i].email});

                    /* Add the bytesUsed property to the user */
                    var bytesUsed = calcUserTotalBytesUsed(userList[i]);
                    userList[i].bytesToClientHR = cm.bytesToSize(bytesUsed.bytesToClient, 1);
                    userList[i].bytesToClientSavedHR = cm.bytesToSize(bytesUsed.bytesToClientSaved, 1);
                    userList[i].bytesFromClientHR = cm.bytesToSize(bytesUsed.bytesFromClient, 1);
                    userList[i].bytesPurchasedHR = cm.bytesToSize(userList[i].bytesPurchased, 1);
                }
            }
            callback(err, userList);
    });
};


exports.getOneUserForPrinting = function getOneUserForPrinting(userEmail, callback) {
    userAccounts.findOne({ email: userEmail },
                         { keys: 0, password: 0 },
                         function(err, userDetails) {
                            userDetails.bytesPurchasedHR = cm.bytesToSize(userDetails.bytesPurchased,2);
                            userDetails.bytesToClientHR = cm.bytesToSize(userDetails.bytesToClient,2);
                            userDetails.bytesToClientSavedHR = cm.bytesToSize(userDetails.bytesToClientSaved,2);
                            userDetails.bytesFromClientHR = cm.bytesToSize(userDetails.bytesFromClient,2);
                            callback(err, userDetails);
                         });
};



/***************************************************************************************************
 *
 *                                            Private Methods
 *
 ***************************************************************************************************/


/**
 * Get the user keys and store them in the config file.
 */
function generateKeysAndConfig(user) {

    cm.log.debug('generateKeysAndConfig(): Creating Keys for user: ' + user.userId);

    var post = {
        url: cm.getKeygenURL(cm),
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            userId:   user.userId,
            // email:    user.email
        })
    };

    /*
     * Send the data to the keygen server, then save it in the DB
     */
    request.post(post, function onPostCB(error, response, body) {

        /* Parse the response */
        if (error || response.statusCode !== 200) {
            cm.log.error('ERROR: onPostCB(): Error fetching data from keyserver :' + error);
            return;
        }

        var data = JSON.parse(body);

        if (!data.hasOwnProperty('userId') || !data.hasOwnProperty('key') || !data.hasOwnProperty('crt')) {
            cm.log.error('ERROR: onPostCB(): Error fetching data from keyserver: Some properties are missing');
            return;
        }
        if (data.userId !== user.userId) {
            cm.log.error('ERROR: onPostCB(): Error fetching data from keyserver: userId does not match');
            return;
        }

        /* Save to db */

        user.keys = {
            crt:              data.crt,
            key:              data.key
        };

        user.save(function userSaveCB(e) {
            if (e) {
                cm.log.error('ERROR: userSaveCB(): There was an error saving to database: ' + e);
            }
        });
    });
}


/**
 * Create the user configuration file.  We simply need to append the user private key and user certificate
 * to the existing regionalConf file.
 *
 * @param user - user details from DB
 * @param region - the region to generate this for
 * @param callback - we run this when all is done
 */
function compileUserConfFile(user, region, callback) {

    var userConfFile = regionalConfFiles[region];

    if (userConfFile === undefined) {
        callback('compileUserConfFile(): Server error - region not found: "' + region + '"');
        return;
    }
    userConfFile += '\n\n<key>\n' + user.keys.key + '</key>\n';
    userConfFile += '\n\n<cert>\n' + user.keys.crt + '</cert>\n';
    callback(null, userConfFile);
}


/**
 * Increment the invalid login count when an incorrect password is used.
 * @param userId
 */
function setInvalidLoginAttempt(userId) {

    userAccounts.findOneAndUpdate({userId: userId}, { $inc: { invalidPWCount: 1 } }, function setInvalidLoginAttemptCB(err) {
        if (err) {
            cm.log.error('ERROR: setInvalidLoginAttemptCB(): unable to increment "invalidPWCount": ' + err);
        }
    });
}


/* encryption & validation methods */

function validatePassword(plainPass, hashedPass, callback) {
    var validHash = encodePassword(plainPass);
    callback(null, hashedPass === validHash);
}


function encodePassword(passwordText) {
    var hash = CryptoJS.MD5(passwordText + salt);
    for (var i=0;i<500;i++) {
        hash = CryptoJS.SHA256(hash.toString(CryptoJS.enc.Base64) + i);
    }
    return hash.toString(CryptoJS.enc.Base64);
}




/***************************************************************************************************************
 *                                                                                                             *
 *                                                                                                             *
 *                                        Crypto Stuff - to mask passowrd on the client                        *
 *                                                                                                             *
 *                                                                                                             *
 ***************************************************************************************************************/

/* Have not modified the code below, so we just dump it here. */

/*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
/* SHA-256 (SHA2) */
var CryptoJS=CryptoJS||function(h,s){var f={},t=f.lib={},g=function(){},j=t.Base={extend:function(a){g.prototype=this;var c=new g;a&&c.mixIn(a);c.hasOwnProperty("init")||(c.init=function(){c.$super.init.apply(this,arguments)});c.init.prototype=c;c.$super=this;return c},create:function(){var a=this.extend();a.init.apply(a,arguments);return a},init:function(){},mixIn:function(a){for(var c in a)a.hasOwnProperty(c)&&(this[c]=a[c]);a.hasOwnProperty("toString")&&(this.toString=a.toString)},clone:function(){return this.init.prototype.extend(this)}},
q=t.WordArray=j.extend({init:function(a,c){a=this.words=a||[];this.sigBytes=c!=s?c:4*a.length},toString:function(a){return(a||u).stringify(this)},concat:function(a){var c=this.words,d=a.words,b=this.sigBytes;a=a.sigBytes;this.clamp();if(b%4)for(var e=0;e<a;e++)c[b+e>>>2]|=(d[e>>>2]>>>24-8*(e%4)&255)<<24-8*((b+e)%4);else if(65535<d.length)for(e=0;e<a;e+=4)c[b+e>>>2]=d[e>>>2];else c.push.apply(c,d);this.sigBytes+=a;return this},clamp:function(){var a=this.words,c=this.sigBytes;a[c>>>2]&=4294967295<<
32-8*(c%4);a.length=h.ceil(c/4)},clone:function(){var a=j.clone.call(this);a.words=this.words.slice(0);return a},random:function(a){for(var c=[],d=0;d<a;d+=4)c.push(4294967296*h.random()|0);return new q.init(c,a)}}),v=f.enc={},u=v.Hex={stringify:function(a){var c=a.words;a=a.sigBytes;for(var d=[],b=0;b<a;b++){var e=c[b>>>2]>>>24-8*(b%4)&255;d.push((e>>>4).toString(16));d.push((e&15).toString(16))}return d.join("")},parse:function(a){for(var c=a.length,d=[],b=0;b<c;b+=2)d[b>>>3]|=parseInt(a.substr(b,
2),16)<<24-4*(b%8);return new q.init(d,c/2)}},k=v.Latin1={stringify:function(a){var c=a.words;a=a.sigBytes;for(var d=[],b=0;b<a;b++)d.push(String.fromCharCode(c[b>>>2]>>>24-8*(b%4)&255));return d.join("")},parse:function(a){for(var c=a.length,d=[],b=0;b<c;b++)d[b>>>2]|=(a.charCodeAt(b)&255)<<24-8*(b%4);return new q.init(d,c)}},l=v.Utf8={stringify:function(a){try{return decodeURIComponent(escape(k.stringify(a)))}catch(c){throw Error("Malformed UTF-8 data");}},parse:function(a){return k.parse(unescape(encodeURIComponent(a)))}},
x=t.BufferedBlockAlgorithm=j.extend({reset:function(){this._data=new q.init;this._nDataBytes=0},_append:function(a){"string"==typeof a&&(a=l.parse(a));this._data.concat(a);this._nDataBytes+=a.sigBytes},_process:function(a){var c=this._data,d=c.words,b=c.sigBytes,e=this.blockSize,f=b/(4*e),f=a?h.ceil(f):h.max((f|0)-this._minBufferSize,0);a=f*e;b=h.min(4*a,b);if(a){for(var m=0;m<a;m+=e)this._doProcessBlock(d,m);m=d.splice(0,a);c.sigBytes-=b}return new q.init(m,b)},clone:function(){var a=j.clone.call(this);
a._data=this._data.clone();return a},_minBufferSize:0});t.Hasher=x.extend({cfg:j.extend(),init:function(a){this.cfg=this.cfg.extend(a);this.reset()},reset:function(){x.reset.call(this);this._doReset()},update:function(a){this._append(a);this._process();return this},finalize:function(a){a&&this._append(a);return this._doFinalize()},blockSize:16,_createHelper:function(a){return function(c,d){return(new a.init(d)).finalize(c)}},_createHmacHelper:function(a){return function(c,d){return(new w.HMAC.init(a,
d)).finalize(c)}}});var w=f.algo={};return f}(Math);
(function(h){for(var s=CryptoJS,f=s.lib,t=f.WordArray,g=f.Hasher,f=s.algo,j=[],q=[],v=function(a){return 4294967296*(a-(a|0))|0},u=2,k=0;64>k;){var l;a:{l=u;for(var x=h.sqrt(l),w=2;w<=x;w++)if(!(l%w)){l=!1;break a}l=!0}l&&(8>k&&(j[k]=v(h.pow(u,0.5))),q[k]=v(h.pow(u,1/3)),k++);u++}var a=[],f=f.SHA256=g.extend({_doReset:function(){this._hash=new t.init(j.slice(0))},_doProcessBlock:function(c,d){for(var b=this._hash.words,e=b[0],f=b[1],m=b[2],h=b[3],p=b[4],j=b[5],k=b[6],l=b[7],n=0;64>n;n++){if(16>n)a[n]=
c[d+n]|0;else{var r=a[n-15],g=a[n-2];a[n]=((r<<25|r>>>7)^(r<<14|r>>>18)^r>>>3)+a[n-7]+((g<<15|g>>>17)^(g<<13|g>>>19)^g>>>10)+a[n-16]}r=l+((p<<26|p>>>6)^(p<<21|p>>>11)^(p<<7|p>>>25))+(p&j^~p&k)+q[n]+a[n];g=((e<<30|e>>>2)^(e<<19|e>>>13)^(e<<10|e>>>22))+(e&f^e&m^f&m);l=k;k=j;j=p;p=h+r|0;h=m;m=f;f=e;e=r+g|0}b[0]=b[0]+e|0;b[1]=b[1]+f|0;b[2]=b[2]+m|0;b[3]=b[3]+h|0;b[4]=b[4]+p|0;b[5]=b[5]+j|0;b[6]=b[6]+k|0;b[7]=b[7]+l|0},_doFinalize:function(){var a=this._data,d=a.words,b=8*this._nDataBytes,e=8*a.sigBytes;
d[e>>>5]|=128<<24-e%32;d[(e+64>>>9<<4)+14]=h.floor(b/4294967296);d[(e+64>>>9<<4)+15]=b;a.sigBytes=4*d.length;this._process();return this._hash},clone:function(){var a=g.clone.call(this);a._hash=this._hash.clone();return a}});s.SHA256=g._createHelper(f);s.HmacSHA256=g._createHmacHelper(f)})(Math);

/* MD5 */
var CryptoJS=CryptoJS||function(s,p){var m={},l=m.lib={},n=function(){},r=l.Base={extend:function(b){n.prototype=this;var h=new n;b&&h.mixIn(b);h.hasOwnProperty("init")||(h.init=function(){h.$super.init.apply(this,arguments)});h.init.prototype=h;h.$super=this;return h},create:function(){var b=this.extend();b.init.apply(b,arguments);return b},init:function(){},mixIn:function(b){for(var h in b)b.hasOwnProperty(h)&&(this[h]=b[h]);b.hasOwnProperty("toString")&&(this.toString=b.toString)},clone:function(){return this.init.prototype.extend(this)}},
q=l.WordArray=r.extend({init:function(b,h){b=this.words=b||[];this.sigBytes=h!=p?h:4*b.length},toString:function(b){return(b||t).stringify(this)},concat:function(b){var h=this.words,a=b.words,j=this.sigBytes;b=b.sigBytes;this.clamp();if(j%4)for(var g=0;g<b;g++)h[j+g>>>2]|=(a[g>>>2]>>>24-8*(g%4)&255)<<24-8*((j+g)%4);else if(65535<a.length)for(g=0;g<b;g+=4)h[j+g>>>2]=a[g>>>2];else h.push.apply(h,a);this.sigBytes+=b;return this},clamp:function(){var b=this.words,h=this.sigBytes;b[h>>>2]&=4294967295<<
32-8*(h%4);b.length=s.ceil(h/4)},clone:function(){var b=r.clone.call(this);b.words=this.words.slice(0);return b},random:function(b){for(var h=[],a=0;a<b;a+=4)h.push(4294967296*s.random()|0);return new q.init(h,b)}}),v=m.enc={},t=v.Hex={stringify:function(b){var a=b.words;b=b.sigBytes;for(var g=[],j=0;j<b;j++){var k=a[j>>>2]>>>24-8*(j%4)&255;g.push((k>>>4).toString(16));g.push((k&15).toString(16))}return g.join("")},parse:function(b){for(var a=b.length,g=[],j=0;j<a;j+=2)g[j>>>3]|=parseInt(b.substr(j,
2),16)<<24-4*(j%8);return new q.init(g,a/2)}},a=v.Latin1={stringify:function(b){var a=b.words;b=b.sigBytes;for(var g=[],j=0;j<b;j++)g.push(String.fromCharCode(a[j>>>2]>>>24-8*(j%4)&255));return g.join("")},parse:function(b){for(var a=b.length,g=[],j=0;j<a;j++)g[j>>>2]|=(b.charCodeAt(j)&255)<<24-8*(j%4);return new q.init(g,a)}},u=v.Utf8={stringify:function(b){try{return decodeURIComponent(escape(a.stringify(b)))}catch(g){throw Error("Malformed UTF-8 data");}},parse:function(b){return a.parse(unescape(encodeURIComponent(b)))}},
g=l.BufferedBlockAlgorithm=r.extend({reset:function(){this._data=new q.init;this._nDataBytes=0},_append:function(b){"string"==typeof b&&(b=u.parse(b));this._data.concat(b);this._nDataBytes+=b.sigBytes},_process:function(b){var a=this._data,g=a.words,j=a.sigBytes,k=this.blockSize,m=j/(4*k),m=b?s.ceil(m):s.max((m|0)-this._minBufferSize,0);b=m*k;j=s.min(4*b,j);if(b){for(var l=0;l<b;l+=k)this._doProcessBlock(g,l);l=g.splice(0,b);a.sigBytes-=j}return new q.init(l,j)},clone:function(){var b=r.clone.call(this);
b._data=this._data.clone();return b},_minBufferSize:0});l.Hasher=g.extend({cfg:r.extend(),init:function(b){this.cfg=this.cfg.extend(b);this.reset()},reset:function(){g.reset.call(this);this._doReset()},update:function(b){this._append(b);this._process();return this},finalize:function(b){b&&this._append(b);return this._doFinalize()},blockSize:16,_createHelper:function(b){return function(a,g){return(new b.init(g)).finalize(a)}},_createHmacHelper:function(b){return function(a,g){return(new k.HMAC.init(b,
g)).finalize(a)}}});var k=m.algo={};return m}(Math);
(function(s){function p(a,k,b,h,l,j,m){a=a+(k&b|~k&h)+l+m;return(a<<j|a>>>32-j)+k}function m(a,k,b,h,l,j,m){a=a+(k&h|b&~h)+l+m;return(a<<j|a>>>32-j)+k}function l(a,k,b,h,l,j,m){a=a+(k^b^h)+l+m;return(a<<j|a>>>32-j)+k}function n(a,k,b,h,l,j,m){a=a+(b^(k|~h))+l+m;return(a<<j|a>>>32-j)+k}for(var r=CryptoJS,q=r.lib,v=q.WordArray,t=q.Hasher,q=r.algo,a=[],u=0;64>u;u++)a[u]=4294967296*s.abs(s.sin(u+1))|0;q=q.MD5=t.extend({_doReset:function(){this._hash=new v.init([1732584193,4023233417,2562383102,271733878])},
_doProcessBlock:function(g,k){for(var b=0;16>b;b++){var h=k+b,w=g[h];g[h]=(w<<8|w>>>24)&16711935|(w<<24|w>>>8)&4278255360}var b=this._hash.words,h=g[k+0],w=g[k+1],j=g[k+2],q=g[k+3],r=g[k+4],s=g[k+5],t=g[k+6],u=g[k+7],v=g[k+8],x=g[k+9],y=g[k+10],z=g[k+11],A=g[k+12],B=g[k+13],C=g[k+14],D=g[k+15],c=b[0],d=b[1],e=b[2],f=b[3],c=p(c,d,e,f,h,7,a[0]),f=p(f,c,d,e,w,12,a[1]),e=p(e,f,c,d,j,17,a[2]),d=p(d,e,f,c,q,22,a[3]),c=p(c,d,e,f,r,7,a[4]),f=p(f,c,d,e,s,12,a[5]),e=p(e,f,c,d,t,17,a[6]),d=p(d,e,f,c,u,22,a[7]),
c=p(c,d,e,f,v,7,a[8]),f=p(f,c,d,e,x,12,a[9]),e=p(e,f,c,d,y,17,a[10]),d=p(d,e,f,c,z,22,a[11]),c=p(c,d,e,f,A,7,a[12]),f=p(f,c,d,e,B,12,a[13]),e=p(e,f,c,d,C,17,a[14]),d=p(d,e,f,c,D,22,a[15]),c=m(c,d,e,f,w,5,a[16]),f=m(f,c,d,e,t,9,a[17]),e=m(e,f,c,d,z,14,a[18]),d=m(d,e,f,c,h,20,a[19]),c=m(c,d,e,f,s,5,a[20]),f=m(f,c,d,e,y,9,a[21]),e=m(e,f,c,d,D,14,a[22]),d=m(d,e,f,c,r,20,a[23]),c=m(c,d,e,f,x,5,a[24]),f=m(f,c,d,e,C,9,a[25]),e=m(e,f,c,d,q,14,a[26]),d=m(d,e,f,c,v,20,a[27]),c=m(c,d,e,f,B,5,a[28]),f=m(f,c,
d,e,j,9,a[29]),e=m(e,f,c,d,u,14,a[30]),d=m(d,e,f,c,A,20,a[31]),c=l(c,d,e,f,s,4,a[32]),f=l(f,c,d,e,v,11,a[33]),e=l(e,f,c,d,z,16,a[34]),d=l(d,e,f,c,C,23,a[35]),c=l(c,d,e,f,w,4,a[36]),f=l(f,c,d,e,r,11,a[37]),e=l(e,f,c,d,u,16,a[38]),d=l(d,e,f,c,y,23,a[39]),c=l(c,d,e,f,B,4,a[40]),f=l(f,c,d,e,h,11,a[41]),e=l(e,f,c,d,q,16,a[42]),d=l(d,e,f,c,t,23,a[43]),c=l(c,d,e,f,x,4,a[44]),f=l(f,c,d,e,A,11,a[45]),e=l(e,f,c,d,D,16,a[46]),d=l(d,e,f,c,j,23,a[47]),c=n(c,d,e,f,h,6,a[48]),f=n(f,c,d,e,u,10,a[49]),e=n(e,f,c,d,
C,15,a[50]),d=n(d,e,f,c,s,21,a[51]),c=n(c,d,e,f,A,6,a[52]),f=n(f,c,d,e,q,10,a[53]),e=n(e,f,c,d,y,15,a[54]),d=n(d,e,f,c,w,21,a[55]),c=n(c,d,e,f,v,6,a[56]),f=n(f,c,d,e,D,10,a[57]),e=n(e,f,c,d,t,15,a[58]),d=n(d,e,f,c,B,21,a[59]),c=n(c,d,e,f,r,6,a[60]),f=n(f,c,d,e,z,10,a[61]),e=n(e,f,c,d,j,15,a[62]),d=n(d,e,f,c,x,21,a[63]);b[0]=b[0]+c|0;b[1]=b[1]+d|0;b[2]=b[2]+e|0;b[3]=b[3]+f|0},_doFinalize:function(){var a=this._data,k=a.words,b=8*this._nDataBytes,h=8*a.sigBytes;k[h>>>5]|=128<<24-h%32;var l=s.floor(b/
4294967296);k[(h+64>>>9<<4)+15]=(l<<8|l>>>24)&16711935|(l<<24|l>>>8)&4278255360;k[(h+64>>>9<<4)+14]=(b<<8|b>>>24)&16711935|(b<<24|b>>>8)&4278255360;a.sigBytes=4*(k.length+1);this._process();a=this._hash;k=a.words;for(b=0;4>b;b++)h=k[b],k[b]=(h<<8|h>>>24)&16711935|(h<<24|h>>>8)&4278255360;return a},clone:function(){var a=t.clone.call(this);a._hash=this._hash.clone();return a}});r.MD5=t._createHelper(q);r.HmacMD5=t._createHmacHelper(q)})(Math);

/* Base64 Encoding */
(function(){var h=CryptoJS,j=h.lib.WordArray;h.enc.Base64={stringify:function(b){var e=b.words,f=b.sigBytes,c=this._map;b.clamp();b=[];for(var a=0;a<f;a+=3)for(var d=(e[a>>>2]>>>24-8*(a%4)&255)<<16|(e[a+1>>>2]>>>24-8*((a+1)%4)&255)<<8|e[a+2>>>2]>>>24-8*((a+2)%4)&255,g=0;4>g&&a+0.75*g<f;g++)b.push(c.charAt(d>>>6*(3-g)&63));if(e=c.charAt(64))for(;b.length%4;)b.push(e);return b.join("")},parse:function(b){var e=b.length,f=this._map,c=f.charAt(64);c&&(c=b.indexOf(c),-1!=c&&(e=c));for(var c=[],a=0,d=0;d<
e;d++)if(d%4){var g=f.indexOf(b.charAt(d-1))<<2*(d%4),h=f.indexOf(b.charAt(d))>>>6-2*(d%4);c[a>>>2]|=(g|h)<<24-8*(a%4);a++}return j.create(c,a)},_map:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="}})();
