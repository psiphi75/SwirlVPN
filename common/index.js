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
 * index.js
 *
 * A standard NodeJS index.js file.  We put together the "common" module here.
 *
 * We also ensure some environment variables are set, these are mandatory.
 */

/*jslint node:true*/
'use strict';

/**
 * Check the environment is correctly set up.
 */
var red = '\u001b[31m';
var whitebg = '\u001b[47m';
var reset = '\u001b[0m';
var beep = '\u0007';
console.log(beep);

if (typeof(process.env.NODE_ENV) === 'undefined') {
    process.env.NODE_ENV = 'development';
}
switch(process.env.NODE_ENV) {
    case 'development':
        console.log(red + whitebg + 'WARNING: In development mode.' + reset);
        break;

    case 'testing':
        console.log(red + whitebg + 'WARNING: In testing mode.' + reset);
        break;

    case 'production':
        console.log(red + 'WARNING: In production mode.' + reset);
        break;

    default:
        console.log('The environment variable "NODE_ENV" has not been set or set incorrectly. The value is: ' + process.env.NODE_ENV);
        process.exit(-1);
}

if (typeof(process.env.NODE_ENV) === 'undefined') {
    process.env.APP = 'uknown';
}
if (typeof(process.env.VV_SERVER_TYPE) === 'undefined') {
    process.env.VV_SERVER_TYPE = 'uknown';
}



/**
 * Export all modules for common functions
 */
var utils                   = require('./utils');

/* Get the absolute path of the project */
var path                    = require('path');
var projectPath             = path.resolve('..');
exports.projectPath         = projectPath;
exports.getAbsPath          = function (relPath) {
                                  return path.resolve(projectPath, relPath);
                              };



/* syslog logging */
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'testing') {
    utils.log = console;
    utils.log.debug = console.log;
} else {
    var SysLogger               = require('ain2');
    utils.log = new SysLogger({
                                    tag: process.env.APP,
                                    port: utils.cfg('log:rsyslog:port')
                              });
}
exports.log                 = utils.log;


/* Our internal functions */
exports.cfg                 = utils.cfg;
exports.makeId              = utils.makeId;
exports.assertHasProperty   = utils.assertHasProperty;
exports.getURIParams        = utils.getURIParams;
exports.getKeygenURL        = utils.getKeygenURL;
exports.fatalError          = utils.fatalError;
exports.getEnvVars          = utils.getEnvVars;
exports.getServerDetails    = utils.getServerDetails;
exports.t_unix2iso          = utils.t_unix2iso;
exports.parseIntParam       = utils.parseIntParam;
exports.prettyBytesInMB     = utils.prettyBytesInMB;
exports.prettyNum           = utils.prettyNum;
exports.fmtDate             = utils.fmtDate;
exports.getDateForWebLog    = utils.getDateForWebLog;
exports.getMongoURL         = utils.getMongoURL;
exports.getWebserverURL     = utils.getWebserverURL;
exports.listHasString       = utils.listHasString;
exports.getTimeIn24Hr       = utils.getTimeIn24Hr;
exports.getTimeOneHourAgo   = utils.getTimeOneHourAgo;
exports.setToHappen         = utils.setToHappen;
exports.genericCB           = utils.genericCB;
exports.getExpiryDate       = utils.getExpiryDate;
exports.$in                 = utils.$in;
exports.objectGetFields     = utils.objectGetFields;
exports.getTimeToExpiry     = utils.getTimeToExpiry;
exports.bytesToSize         = utils.bytesToSize;