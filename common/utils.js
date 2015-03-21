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
 * utils.js
 *
 * Utility functions used for SwirlVPN.
 * Pretty much anything that is used more than once in different parts of the
 * code ends up here.
 */


/*jslint node:true*/
'use strict';

var os = require('os');
var cfg = require('./config').cfg;
exports.cfg = cfg;

var log;
exports.log = log;

process.on('uncaughtException', function(err) {

    var stack;
    if (!err || !err.stack) {
        stack = new Error().stack;
    } else {
        stack = err.stack;
    }

    console.error('CRITICAL ERROR: ', new Date(), stack);

    if (log && log.error) {
        log.error ('CRITICAL ERROR: ', new Date(), stack);
    }
});

/**
 * Assert that an object has a given property.  Throw an error if not.
 * @param obj - the object to test.
 * @param property - the property in the object to look for.
 */
exports.assertHasProperty = function assertHasProperty(obj, property) {
    if (!obj.hasOwnProperty(property)) {
        throw 'Object does not contain the property: ' + property;
    }
};


/**
 * This will make a random string given length.
 * @param len (optional) - the number of random characters.
 * @param includeSpecialChars (optional) - whether special characters should be included like "." and "_"
 * @returns {String}
 */
var uidLength = cfg('user:uidLength');
exports.makeId = function makeId(len, includeSpecialChars) {

    if (typeof(len) === 'undefined') {
        len = uidLength;
        includeSpecialChars = false;
    }
    var text = '';
    var possible;

    if (includeSpecialChars) {
        possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789....___';
    } else {
        possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    }

    var l = possible.length;

    for( var i=0; i < len; i++ )
        text += possible.charAt(Math.floor(Math.random() * l));

    return text;
};


/**
 * If this server is running the MongoDB, return true.
 * @returns {Boolean}
 */
function isDBserver() {
    return process.env.VV_SERVER_TYPE.indexOf('MongoDB') !== -1;
}
function isWebserver() {
    return process.env.VV_SERVER_TYPE.indexOf('Webserver') !== -1;
}


/**
 * Nicely format the mongo DB url for easy connection
 * @returns the URL for the connection to mongoDB
 */
exports.getMongoURL = function getMongoURL() {

    var dbHostname = cfg('db:host');
    var url = 'mongodb://';
    if (isDBserver()) {
        url += 'localhost:';
    } else {
        url += dbHostname +  ':';
    }
    url += cfg('db:port') + '/';
    url += cfg('db:name') + '/';
    return url;
};



/**
 * Nicely format the webserver url for easy connection
 * @returns the URL for the connection for users
 */
exports.getWebserverURL = function getWebserverURL() {
    return 'https://' + cfg('webserver:domain');
};


/**
 * Get the paramaters from the URI provided and return them as an object
 * @param uri - the uri in standard format
 */
exports.getURIParams = function getURIParams(uri) {
    var uriParams;
    var match;
    var pl     = /\+/g;  // Regex for replacing addition symbol with a space
    var search = /([^&=]+)=?([^&]*)/g;
    var decode = function (s) { return decodeURIComponent(s.replace(pl, ' ')); };

    uriParams = {};

    while ((match = search.exec(uri)) !== null) {
        uriParams[decode(match[1])] = decode(match[2]);
    }
    return uriParams;
};


/**
 * Run this if something fatal happened.  This will make an audible been (if running console is active)
 * and send an email to the admin.
 */

exports.fatalError = function fatalError(message, serverDetails) {

    /* Message and a beep */
    if (typeof(log) !== 'undefined' && typeof(log.error) !== 'undefined') {
        log.error('fatalError(): Something wicked happened: ' + message);
        log.error('\u0007');
    }

    /* Send our fatal error message as email */
    var details = {
            serverDetails: serverDetails,
            errorMessage: message,
            stack: new Error().stack
    };
    var em = require('./email-dispatcher');
    em.dispatchFatalErrorOccurredEmail(details);

};

/**
 * Generate the keygen URL so we can connect to it.
 */
exports.getKeygenURL = function getKeygenURL(cm) {
    var url;
    var keygenHostname = cm.cfg('keygenServer:host');
    url  = 'http://';
    if (keygenHostname === process.env.VV_PUB_IP) {
        url += 'localhost:';
    } else {
        url += keygenHostname +  ':';
    }
    url += cm.cfg('keygenServer:port');
    url += cm.cfg('keygenServer:url');

    return url;
};




exports.getServerDetails = function getServerDetails(cm) {
    var server;
    server = getEnvVars(cm);
    server.hostname = os.hostname();
    return server;
};

/**
 * Gets all the necessary environment variables.  If one does not exist, then we will crash the server.
 */
exports.getEnvVars = getEnvVars;

function getEnvVars(cm) {

    var envVarList = cm.cfg('environmentVariables');
    var cfgVars = {};

    for (var cfgVarKey in envVarList) {

        var envVarName = envVarList[cfgVarKey];

        /* Populate the object which contains the environment variables as values */
        var envVarValue = process.env[envVarName];

        if (envVarValue === undefined) {
            cm.fatalError('Environment Variable not defined: ' + envVarName, {});
        } else {

            /* Create an array from the serverType - one server can have many types */
            if (cfgVarKey === 'serverType') {
                envVarValue = envVarValue.split(' ');
            }

            cfgVars[cfgVarKey] = envVarValue;
        }

    }

    return cfgVars;
}


/**
 * Convert the unix time to ISO time.
 * @param ut - unix time (in seconds)
 * @returns ISODate - ISO date format
 */
exports.t_unix2iso = function t_unix2iso(ut) {
    return (new Date(ut * 1000)).toISOString();
};

exports.getUnixUTC = function getUnixUTC() {
    return Math.round(new Date.now() / 1000, 0);
};


/**
 * Parse a parameter to get out an integer.  Return 0 if no valid integer found.
 * @param req   - the request
 * @param param - the name of the param in the request
 * @returns     - an integer
 */
exports.parseIntParam = function parseIntParam(req, param) {
    var s = req.param(param);
    if (s === undefined || s === null) {
        return 0;
    }
    if (s.length === 0) {
        return 0;
    }
    return parseInt(s, 0);
};


/**
 * Convert a number in bytes (e.g 1234567234.12) to a string '1177.4'
 * @param numBytes - the number in bytes
 * @returns - the string
 */
var bytesToMB        = 1 / (1024 * 1024);
exports.prettyBytesInMB = function prettyBytesInMB(numBytes) {
    return prettyNum(numBytes * bytesToMB, 1);
};

/**
 * Create a pretty string from a number
 * @param  {Number} num The number to output
 * @param  {Number} dp  The number of decimal points
 * @return {string}     The pretified number
 */
exports.prettyNum = prettyNum;
function prettyNum(num, dp) {
    return ( num ).toFixed(dp);
}

/**
 * Prettify a date in the future (make it fuzzy).
 * @param  {Date}   date        The date to make fuzzy
 * @param  {Date}   compareDate (Optional) The reference date to compare this to (now(), if not supplied)
 * @return {String}             The fuzzy date
 */
exports.getTimeToExpiry = function getTimeToExpiry(date, compareDate) {

    if (typeof(compareDate) === 'undefined') {
        compareDate = new Date();
    }
    var dateDiff = (date - compareDate) / 1000;
    var agoStr = '';
    if (dateDiff < 0) {
        dateDiff = -dateDiff;
        agoStr = ' ago';
    }

    /* We have a date in the future */

    var timeInDays = dateDiff / 24 / 3600;

    if (timeInDays > 366) {
        return prettyNum(timeInDays / 365, 1) + ' years' + agoStr;
    }

    if (timeInDays >= 2) {
        return prettyNum(timeInDays, 0) + ' days' + agoStr;
    }

    var hours = timeInDays * 24;
    var minutes = Math.floor((timeInDays - Math.floor(timeInDays)) * 60);
    return prettyNum(hours, 0) + ' hours ' + prettyNum(minutes, 0) + ' minutes' + agoStr;

};


/**
 * Pretty print the date.
 */
exports.fmtDate = function fmtDate(dt) {

    if (typeof dt !== 'object') return;
    var nd = new Date(dt);
    var y = nd.getFullYear();
    var m = fmt10(nd.getMonth()+1);
    var d = fmt10(nd.getDate());
    var h = fmt10(nd.getHours());
    var mn = fmt10(nd.getMinutes());
    var s = fmt10(nd.getSeconds());
    return (y + '-' + m + '-' + d + ' ' + h + ':' + mn + ':' + s);

    function fmt10(n) {
        return n < 10 ? '0' + n : '' + n;
    }
};

/**
 * This set of functions allow for neat formating for the date for the webserver access log file.
 */
var month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function padt(number, length){
    var str = '' + number;
    while (str.length < length) {
        str = '0' + str;
    }
    return str;
}

var timeZoneOffset = new Date().getTimezoneOffset();
timeZoneOffset = ((timeZoneOffset<0? '+':'-') +
          padt(parseInt(Math.abs(timeZoneOffset / 60), 0), 2) +
          padt(Math.abs(timeZoneOffset % 60), 2));

exports.getDateForWebLog = getDateForWebLog;
function getDateForWebLog(req, res) {
    var d = new Date();
    function pad(x) {
        return (x < 10) ? '0'+x : ''+x;
    }
    return pad(d.getUTCDate()) + '/' + month_names[d.getUTCMonth()] + '/' + d.getUTCFullYear() + ':' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + ' ' + timeZoneOffset;
}


/**
 * Check if the list has the given string
 */
exports.listHasString = function listHasString(list, str) {
    return list.indexOf(str) !== -1;
};

/**
 * Return the time in 24 hours from now.
 */
exports.getTimeIn24Hr = function getTimeIn24Hr() {

    var date = new Date();
    date.setDate(date.getDate() + 1);
    return date;
};

/**
 * Return the time from 1 hour ago.
 */
exports.getTimeOneHourAgo = function getTimeOneHourAgo() {

    var date = new Date();
    date.setHours(date.getHours() - 1);
    return date;
};

/**
 * setTimeout, but at a given date/time
 * @param {Function} fn     The function to run
 * @param {Date}     date   The date to run it at
 */
exports.setToHappen = function setToHappen(fn, date) {

    var newTime = date.getTime() - (new Date()).getTime();
    if (newTime < 0) {
        fn();
    } else {
        setTimeout(fn, newTime);
    }
};


/**
 * A function that creates a generic callback
 * @param  {String}   fnName   The name of the calling function.
 * @param  {Function} callback The standard callback to pass.
 * @param  {Object}   logger   If you want a different log level (than stderr).
 * @return {Function}          The actuall callback that will be run.
 */
exports.genericCB = function genericCB(fnName, callback, logger) {

    return fnGenericCB;

    function fnGenericCB(err, obj) {
        if (err) {
            if (typeof(logger) === 'undefined') {
                logger = log.error;
            }
            logger(fnName + '(): ', err);
        }

        /* Execute the callback if it is defined */
        if (typeof(callback) === 'function') {
            callback(err, obj);
        }
    }
};

/**
 * Get the default expiry date of a purchase based on the given date (if provideded). If
 * not provided then use Now and the current date.
 * @param  {Date} date (optional) The date to make the basis on.
 * @return {Date}      The expiry date
 */
var purchaseExpiryDays  = cfg('purchase:expiryDays');
exports.getExpiryDate = function getExpiryDate(date) {

    if (typeof(date) === 'undefined') {
        date = new Date();
    }

    var expiryDate = new Date(date);
    expiryDate.setDate(date.getDate() + purchaseExpiryDays);

    return expiryDate;

};

/**
 * This returns a validation function that validates a given element matches an element in an array.
 */
exports.$in = function $in(array) {

    if (typeof(array) === 'undefined') throw 'You must provide an array to test';
    if (! array instanceof Array) throw 'You must provide an array to test';

    return testElementIsInArray;

    function testElementIsInArray(element) {
        if (typeof(element) === 'undefined') return false;
        return array.indexOf(element) >= 0;
    }

};


/**
 * Given an object, this function will copy all the field names provided by this object
 * @param  {object} object     The object to copy
 * @param  {array}  fieldNames The field names to copy
 * @return {object}            The copy of the original object, with only the defined fields.
 */
exports.objectGetFields = function objectGetFields(object, fieldNames) {

    if (Array.isArray(object)) {
        var returnArr = [];
        for (var i=0; i<object.length; i++) {
            returnArr.push(objectGetFields(object[i], fieldNames));
        }
        return returnArr;
    }

    var returnObj = {};
    var element;
    for(var j=0; j<fieldNames.length; j++) {
        var key = fieldNames[j];

        /* Recurse into sub-objects */
        if (typeof(key) === 'object') {
            returnObj[key.name] = objectGetFields(object[key.name], key.fields);
            continue;
        }

        /* Make sure the element exists */
        element = object[key];
        if (typeof(element) === 'undefined') {
            continue;
        }

        returnObj[key] = element;
    }
    return returnObj;
};


/**
 * Convert number of bytes into human readable format
 *
 * @param integer bytes     Number of bytes to convert
 * @param integer precision Number of digits after the decimal separator
 * @return string
 */
exports.bytesToSize = function bytesToSize(bytes, precision) {
    var kilobyte = 1024.0;
    var megabyte = kilobyte * 1024.0;
    var gigabyte = megabyte * 1024.0;
    var terabyte = gigabyte * 1024.0;

    if ((bytes >= 0) && (bytes < kilobyte)) {
        return bytes + ' B';

    } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
        return (bytes / kilobyte).toFixed(precision) + ' kB';

    } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
        return (bytes / megabyte).toFixed(precision) + ' MB';

    } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
        return (bytes / gigabyte).toFixed(precision) + ' GB';

    } else if (bytes >= terabyte) {
        return (bytes / terabyte).toFixed(precision) + ' TB';

    } else {
        return bytes + ' B';
    }
};

