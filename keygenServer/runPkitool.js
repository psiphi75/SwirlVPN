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
 * runPkitool.js
 *
 * This does the work for the keygenServer.  It will run the OpenSSL pkitool,
 * which takes arguments (in the format of environement variables) and generates
 * a public and private key for the user.
 *
 */

/*jslint node:true*/
'use strict';

/* Import our configuration settings */
var cm          = require('../common');
var spawn       = require('child_process').spawn;
var fs          = require('fs');

/* Variables for the key generation */
var keygenExec              = cm.cfg('keygenServer:pkitool:executable');
var keygenKeySize           = cm.cfg('keygenServer:pkitool:keysize');
var keygenExpiry            = cm.cfg('keygenServer:pkitool:expiryDays');
var keygenExecPath          = cm.getAbsPath(cm.cfg('keygenServer:pkitool:execRelPath'));
var keygenKeystorePath      = cm.getAbsPath(cm.cfg('keygenServer:pkitool:keystoreRelPath'));
var keygenOpensslConf       = cm.getAbsPath(cm.cfg('keygenServer:pkitool:opensslConfRelPath'));


/**
 * Delete a file from the file system.
 * @param filename - the file to delete.
 */
function deleteFile(filename) {
    fs.unlink(filename, function (err) {
        if (err) {
            cm.log.error('ERROR: Unable to delete file: ' + filename);
        }
    });
}


/**
 * Generate the keys for the given user, then run the callback to return the data and a JSON.
 * @param responseCallback - the callback that will return the data to the user.
 */
exports.keygen = function(userId, responseCallback) {

    /*
     * Run the pkitool that comes with openvpn.  Wait until it finishes, then
     * return the data to the user.
     */
    var options = {
        cwd: keygenExecPath,
        env: getKeygenEnv(userId)
    };

    /* Add the spawn to a queue and wait */
    spawnAndWait(keygenExec, userId, options, responseCallback);

};

function pkitoolDoneFunction(code, userId, responseCallback) {

    cm.log.debug('return code: ', code);

    // 2) Read the keys from file
    var filePrefix = keygenKeystorePath + '/' + userId;

    var keyData = {
          userId: userId,
          key: fs.readFileSync(filePrefix + '.key', {encoding:'ascii'}),
          crt: fs.readFileSync(filePrefix + '.crt', {encoding:'ascii'})
    };

    if ((keyData.crt.length === 0   ||   keyData.key.length === 0) && userId !== 'bogusUser') {
        cm.log.error('ERROR: CRT or KEY length is zero. userId: ', userId);
    }

    cm.log.info('Created key for userId: ' + userId);

    // 3) Return data to the requestor
    responseCallback(JSON.stringify(keyData));

    // 4) Clean up the keys from disk
    deleteFile(filePrefix + '.key');
    deleteFile(filePrefix + '.crt');
    deleteFile(filePrefix + '.csr');
}


/**
 * This will return the parameters required to run the key generation script.
 *
 * @param userId - the user's name (common name for openvpn)
 * @returns {JSON list of parameters}
 */
function getKeygenEnv(userId) {

    var msg;

    if (!userId.length) {
        msg = 'userId length is zero.';
        cm.log.error('ERROR: ', msg);
        throw msg;
    }

    var env = {
            KEY_DIR:      keygenKeystorePath,
            KEY_CONFIG:   keygenOpensslConf,
            KEY_SIZE:     keygenKeySize,
            CA_EXPIRE:    keygenExpiry,
            KEY_EXPIRE:   keygenExpiry,
            KEY_COUNTRY:  '',
            KEY_PROVINCE: '',
            KEY_CITY:     '',
            KEY_ORG:      '',
            KEY_EMAIL:    userId,
            KEY_CN:       userId,            // Common Name
            KEY_NAME:     userId,
            KEY_OU:       ''
        };
    return env;
}


/* We need to create a queue for running the key gen.  In rare cases when two
   keys are generated at the same time, it will fail.  This will cause all keys
   generated to fail until the problem is fixed.  The problem is that the ssl
   pkitool can only generate one key at once */
var spawnQueue = [];
var spawnInProgress = false;
function spawnAndWait(exec, userId, options, responseCallback) {
    spawnQueue.push({
        exec : exec,
        userId : userId,
        options : options,
        responseCallback: responseCallback
    });
    spawnNext();
}
function spawnNext() {

    if (spawnQueue.length === 0 || spawnInProgress) {
        return;
    }

    /* Get the item at the front of the queue */
    var item = spawnQueue[0];

    /* Remove the item from the front of the queue */
    spawnQueue.splice(0, 1);

    spawnInProgress = true;

    var s = spawn(item.exec, [item.userId], item.options);

    s.on('error', handleSpawnError);
    s.on('exit', handleSpawnResult(item.userId, item.responseCallback));

}

function handleSpawnError(err) {
    cm.log.error(err);

    /* Call the next spawn item */
    spawnInProgress = false;
    spawnNext();
}

function handleSpawnResult(userId, responseCallback) {
    return function (code) {

        /* Call the code we want to run */
        pkitoolDoneFunction(code, userId, responseCallback);

        /* Call the next spawn item */
        spawnInProgress = false;
        spawnNext();
    };
}