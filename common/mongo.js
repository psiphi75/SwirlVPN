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
 * mongo.js
 *
 * A simple mongo wrapper.
 */

/*jslint node:true*/
'use strict';

var mongoose = require('mongoose');
var mongoSchema = require('../mongo/schema');
var db;
var cm;

/**
 * Connect to the mongo database
 * @param cmSchema
 * @rerturns db - the connection to the db
 */
exports.connect = function connectMongo(_cm, callback) {

    cm = _cm;
    db = mongoose.createConnection(cm.getMongoURL());

    db.on('open', function dbConnectionOpened(err) {
        if (!err) {
            cm.log.debug('Connected to MongoDB: ' + cm.getMongoURL());
        } else {
            cm.log.error('ERROR: An error occurred connecting to MongoDB ('+cm.getMongoURL()+'): ' +err);
        }
        callback(err, db);
    });

    db.on('error', function dbConnectionError(err) {
        cm.log.error('ERROR: ', err);
    });

    return db;
};

/**
 * Use a mongoDB schema and return the model
 * @param schemaName
 * @returns the mongoDB model
 */
exports.addSchema = function addSchema(schemaName) {

    var schema = mongoSchema[schemaName];

    /* Create the model that we can interact with the userAccounts collection */
    var model = db.model(schemaName.toLowerCase(), schema);
    return model;
};