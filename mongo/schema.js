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
 * schema.js
 *
 * This is the Mongo DB schema.  Although Mongo DB is schemaless, we apply a
 * schema using mongoose, a NodeJS wrapper for Mongo.  Mongoose is awesome.
 *
 * This schema gives details of how things are done.
 *
 * TODO: Refactor such that the purchases and connectionsActive are sub
 *       documents of userAccounts.  I found that this would be most logical.
 *       This keeps the archives seperate and the working documents in one
 *       collection.  Which means we would query a lot less.
 */

/*jslint node:true*/
'use strict';

var mongoose            = require('mongoose');
var cm                  = require('../common');

var defaultBytesBalance = cm.cfg('purchase:defaultBytesBalance');
var serverRegions       = cm.cfg('server:regions');
var validPurchaseStatuses = cm.cfg('purchase:statuses');
var validMethodTypes    = cm.cfg('purchase:method:types');
var reminderDefault     = cm.cfg('user:reminderDefault');

/* Valid emails */
var emailRegexp         = /^([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22))*\x40([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d))*$/;


/**
 * Schema to store user data in mongoDB.
 */
module.exports.userAccounts = new mongoose.Schema({
    userId:             { type: String, indexed: true, unique: true, required: true, 'default': cm.makeId },          /*  the user id, we use a random hash */
    email:              { type: String, indexed: true, unique: true, lowercase: true, match: emailRegexp, required: true },    /* the email address */
    password:           { type: String, required: true },                   /* Password, hashed and salted */
    passwordResetCode:  { type: String,  'default': cm.makeId },            /* The reset code used when requesting a new password by email */
    activationDate:     { type: Date },                                     /* Date the account was activated */
    activationCode:     { type: String,  'default': cm.makeId },            /* Activation code as sent by email, null if account activated */
    isActive:           { type: Boolean, 'default': false },                /* Shows the user is active (emailed activated and not deleted), we do a soft delete */
    dateCreated:        { type: Date, indexed: true,    'default': Date.now }, /* The date the user was created - index is required for /printUsers */
    dateLastLogin:      { type: Date },                                     /* The last time the user logged in to webserver */
    invalidPWCount:     { type: Number,  'default': 0 },                    /* Count the number of invalid login attempts to webserver */
    lastIP:             { type: String },                                   /* The actual IP of the user */
    bytesPurchased:     { type: Number, required: true, 'default': defaultBytesBalance },     /* the bytes purchased by the user. */
    bytesToClient:      { type: Number,                 'default': 0 },     /* The bytes used, but only those in archives */
    bytesToClientSaved: { type: Number,                 'default': 0 },     /* The bytes that were saved (due to ziproxy compression) */
    bytesFromClient:    { type: Number,                 'default': 0 },     /* The bytes used, but only those in archives */
    keys: {                                                                 /* The keys related to this user */
        crt:              { type: String },
        key:              { type: String }
    },
    reminder:           {
        remindMe :      { type: Boolean, 'default': true, required: true }, /* Do we remind the user or not */
        remindAt :      { type: Number, 'default': reminderDefault.val, required: true },    /* At how many bytes we remind the user */
        reminded :      { type: Boolean, 'default': false, required: true } /* True if the user has already been reminded - so we don't remind them twice */
    },
    connectionKey:      { type: String, 'default': cm.makeId },             /* This is a unique ID for the user.  It allows them to query without logging in */
});


/**
 *  Our connections schema to keep a track of clients connected via openVPN.
 */
var connectionsActive;
module.exports.connectionsActive = connectionsActive = new mongoose.Schema({
    userId:             { type: String,  required: true, indexed: true },
    bytesToClient:      { type: Number,  'default': 0 },        /* The bytes used while connected and sent to the user */
    bytesToClientSaved: { type: Number,  'default': 0 },        /* The bytes that were saved (due to ziproxy compression) */
    bytesFromClient:    { type: Number,  'default': 0 },        /* The bytes used while connected and coming from the user */
    dateConnected:      { type: Date,    required: true },      /* Date the connection was activated */
    dateConnectedUnix:  { type: Number,  required: true },      /* The Unix time (in seconds) a user was connected.  Together with userID, this can be used as an ID of the connenction */
    dateDisconnected:   { type: Date },                         /* Date the connection was disconnected */
    dateLastActivity:   { type: Date,    required: true },      /* The date/time we last saw some activity on this connection */
    disconnectedReason: { type: String },                       /* Reason for the disconnection, openvpn provides many reasions.  We may add reasons on top of this. */
    clientIP:           { type: String,  required: true },      /* IP v4 of client */
    clientIPv6:         { type: String },                       /* IP v6 of client */
    assignedIP:         { type: String,  required: true },      /* The IP address the user was assigned */
    serverNetDev:       { type: String },                       /* The network dev on the server (e.g. tap0 ) */
    serverHostname:     { type: String,  required: true }
});


/**
 *  Our connections schema to keep a track of clients connected via openVPN.
 */
module.exports.connectionsArchived  = new mongoose.Schema({
    userId:             { type: String,  required: true, indexed: true },
    bytesToClient:      { type: Number,  required: true },      /* The bytes used while connected */
    bytesFromClient:    { type: Number,  required: true },
    dateConnected:      { type: Date,    required: true },      /* Date the connection was activated */
    dateDisconnected:   { type: Date,    required: true },      /* Date the connection was disconnected */
    disconnectedReason: { type: String  },                      /* Reason for the disconnection, openvpn provides many reasions.  We may add reasons on top of this. */
    clientIP:           { type: String  },                      /* IP v4 of client */
    assignedIP:         { type: String  },                      /* The IP address the user was assigned */
    serverHostname:     { type: String  }
});


/**
 * This collection stores the general configuration files for the client.  One configuration file per region.  This
 * is not the raw configuration file, but user's key and crt need to be appended to it.
 */
module.exports.ovpnConfig = new mongoose.Schema({
    region: { type: String, 'enum': serverRegions },
    file:   { type: String }
});


/**
 * Purchases made
 */
module.exports.purchases = new mongoose.Schema({
    userId:             { type: String, required: true, indexed: true },    /* The user */
    purchaseId:         { type: String, required: true, indexed: true, default:cm.makeId },    /* Unique Id */
    datePurchased:      { type: Date, 'default': Date.now },                /* The date the purchase was made */
    dateExpires:        { type: Date, 'default': cm.getExpiryDate, indexed: true },    /* The date this purchase expires */
    dateClosed:         { type: Date },                                     /* The date this purchase was closed (expired) */
    promotionCode:      { type: String },                                   /* Users can enter a promotion code, it will be stored here */
    status:             { type: String, 'default': 'new', indexed: true, validation:cm.$in(validPurchaseStatuses) },  /* The current status of the purchase */
    bytesPurchased:     { type: Number, required: true },                   /* The amount of bytes the user purchased */
    bytesUsed:          { type: Number, 'default': 0 },                     /* The amount of bytes used for this purchase - normally 0, until the purchase is used up/expired */
    name:               { type: String, required: true },                   /* The name of the purchase when the user first bought it */
    paymentDetails: {
        method:             { type: String, required: true, validation:cm.$in(validMethodTypes) },               /* The method of payment used, eg */
        currency:           { type: String },                               /* The currency used to make the payment */
        valueCurrency:      { type: Number },                               /* The value in the original currency*/
        valueUSD:           { type: Number },                               /* The value in USD */
        vendorStatus:       { type: String },                               /* The status as provided by the vendor */
        vendorPaymentId:    { type: String },                               /* The unique payment ID provided by the vendor */
        vendor:             { type: String },                               /* The name of the vendor (this may be the same as the method) */
        invoiceURL:         { type: String }                                /* The URL to the invoice - or a message to the user */
    }
});
