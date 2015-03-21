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
 * countUserBytes.js
 *
 * This will tail the Ziproxy access log and parse the contents.
 *
 * TODO:  Note, access logs need to be enabled, and then we need to delete the
 *        log once we are done with it.
 *
 * In theory we could also do this on the master webservice side since all logs
 * are sent the main server.  But we do this here since it is simpler and will
 * be more real-time.
 */

/*jslint node:true*/
'use strict';

var cm;
var tail;

/**
 * Index of users with the number of bytesToClientSaved.
 * As we parse the access log, we increase the bytesToClientSaved value.
 * @type {Object}
 */
var userList = {};

exports.init = function(_cm) {
    cm = _cm;

    var Tail = require('tail').Tail;
    tail = new Tail(cm.cfg('log:ziproxy:access'));

    tail.on('line', function(line) {
        parseLine(line);
    });

    tail.on('error', function(error) {
        cm.log.error('ERROR: tail.on(): ', error);
    });
};

/* Add a new userId / localIP combination (overwrites users if they exist) */
function addUser(userId, localIP) {

    if(userExistsByIP(localIP)) {

        /* Existing user, don't overwrite bytes saved */
        userList[localIP].userId = userId;
        userList[localIP].touched = true;

    } else {

        /* A new user */
        userList[localIP] = {
            userId : userId,
            bytesToClientSaved : 0,
            touched : true
        };

    }
    return true;
}

function addUserByIP(localIP) {
    userList[localIP] = {
        userId : null,
        bytesToClientSaved : 0,
        touched : false
    };
    return true;
}

exports.updateUserList = function(_userList) {

    /* 1) Mark all users as being untouched */
    for (var u in userList) {
        userList[u].touched = false;
    }

    /* 2) Add each user, this overwrites existing users */
    for (var i=0; i<_userList.length; i++) {
        var user = _userList[i];
        addUser(user.userId, user.assignedIP);
    }

    /* 3) delete all the "untouched" users */
    for (var u2 in userList) {
        if ( ! userList[u2].touched) {
            delete userList[u2];
        }
    }
};

exports.getUsersbytesToClientSaved = function(userId) {
    var result = userList[userId];
    if (typeof(result) === 'undefined') {
        cm.log.error('ERROR: tail::getUserBytes(): strange value for userList[userId]: ', result);
        return 0;
    }
    return result.bytesToClientSaved;
};

exports.getUserList = function () {
    return userList;
};

exports.close = function (){
    tail.unwatch();
};



/* Example output
TIME    PROCESS_TIME    ADDRESS FLAGS   ORIGINAL_SIZE   SIZE_AFTER_(RE)COMPRESSION  METHOD  URL
0       1               2       3       4               5                           6       7
1402372959.505  335 10.8.0.10   T   4393    4393    GET http://google.co.nz
1402373434.433  90000   10.8.0.38   Z   0   0   ?   ?
1402373435.099  90000   10.8.0.38   Z   0   0   ?   ?
1402373436.076  90000   10.8.0.38   Z   0   0   ?   ?
1402372960.597  476 10.8.0.10   T   2731    2731    GET http://www.google.co.nz
1402372961.199  418 10.8.0.10   T   3131    3131    GET http://www.google.co.nz
1402373440.856  11687   10.8.0.38   T   1749    1749    GET http://www.google.com
*/
exports.parseLine = parseLine;
function parseLine(line) {
    var words = line.split(' ');

    var beforeSize = parseInt(words[4]);
    var afterSize  = parseInt(words[5]);
    var method     = words[6];

    /* nothing worth recording happened if we return here */
    if (beforeSize === 0 || beforeSize == afterSize || method !== 'GET') {
        return 0;
    }

    /* Update the bytes used per user */
    var localIP = words[2];
    if (!userExistsByIP(localIP)) {
        addUserByIP(localIP);
    }
    var bytesToClientSaved = beforeSize - afterSize;
    userList[localIP].bytesToClientSaved += bytesToClientSaved;
    return bytesToClientSaved;
}


function userExistsByIP(localIP) {
    return typeof(userList[localIP]) != 'undefined';
}