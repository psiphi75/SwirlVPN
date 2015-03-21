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
 * config.js
 *
 * This is where all the magic ingredients are stored.  All configuration
 * options are stored here.
 *
 * For production the options are stored in the "config" variable.  For test
 * and development environements, these options can be overridden in the
 * "test_overrides" and "dev_overrides" variables, respectively.
 *
 * Each config option has comments.
 *
 * CONFIG_TODO: This is the main configuration file.  Most configuration options
 *              are here.  However, search all files for "CONFIG_TODO" for
 *              alternate config options.
 */

/*jslint node:true*/
'use strict';

/**
 * The production configuration options.  If we are running the development
 * system, then these get overridden.
 */
var config = {

    /*
     * For each user we generate a new private key.  The user can download this
     * key and use it connect to SwirlVPN.  This key is dynamically generated.
     * The keygenServer creates the keys, the settings below describe where the
     * keygenServer resides and how to access it.
     *
     * pkitool is the tool used by OpenVPN to generate keys.  It is a
     * commandline tool that uses OpenSSL to generate a secure key.  The key
     * details can be set here.
     */
    keygenServer: {
        host      : '127.0.0.1',
        port      : 1337,
        url       : '/NewClientKey',
        pkitool   : {
            execRelPath           : './ssl/keygen-swirlvpn-connection',
            opensslConfRelPath    : './ssl/keygen-swirlvpn-connection/openssl.cnf',
            keystoreRelPath       : './ssl/keys-swirlvpn-connection',
            executable            : 'pkitool',
            keysize               : '1024',
            expiryDays            : '3650'
        }
    },

    /*
     * The logging options are set here.  These options are for reading the logs,
     * so you need to have the logs set correctly using the options.
     */
    log: {

        /* We use rsyslogd to write to logs.  These logs get sent to the
         * given (typically the master) server on the given port. */
        rsyslog : {
            port : 1514,
            host : 'ch1.swirlvpn.com'
        },

        /* We read the Ziproxy logs to determine how much a user's data is
         * compressed.
         */
        ziproxy : {
            access : '/var/log/server/ziproxy/access.log'
        }
    },

    /* User account defaults.  Determines the default settings of the users. */
    user: {
        /* The User Id length that will be stored in the DB as userId */
        uidLength : 32,

        /* When to send the user reminders, the users can choose from these
           options on the home page */
        reminderOptions : [
            { str:   '0 MB', val :                  0 },
            { str:  '50 MB', val :   50 * 1024 * 1024 },
            { str: '250 MB', val :  250 * 1024 * 1024 },
            { str:   '1 GB', val : 1024 * 1024 * 1024 },
        ],
        reminderDefault : { str: '50 MB', val : 50 * 1024 * 1024 }
    },

    /* Connection information to connect to the master Mongo DB, all session
     * and user data it stores */
    db: {
        host      : '127.0.0.1',
        port      : 27017,
        name      : 'master',
        userAccounts : {
            /* Name of the useraccounts collection */
            name             : 'useraccounts',
            /* The password salt we use */
            salt             : '#### Add some random text here and never change it ####',
            /* The email address that identifies the admin user, this user has
               special priviliges */
            adminEmail       : 'admin@swirlvpn.com'
        },
        /* The Sessions DB that stores the web user session token is using Mongo.
           This contains the session name and session secret key */
        sessions : {
            name      : 'sessions',
            secret    : '#### Add some random text here ####'
        }
    },

    /* The webserver details, including ports we run on */
    webserver : {
        /* The IP address of the webserver */
        host      : '123.123.123.123',

        /* The http/https ports we listen on - we use iptables to re-route to
           port 80/443.  The Node.JS webserver will run on these ports. */
        httpPort  : 8888,
        httpsPort : 8889,
        domain    : 'www.swirlvpn.com',

        /* The routes for the website */
        links : {
            home                    : '/',
            faq                     : '/faq',
            docs_android            : '/documentation/vpn_for_android',
            docs_iphone             : '/documentation/vpn_for_iphone',
            docs_linux              : '/documentation/vpn_for_linux',
            docs_windows            : '/documentation/vpn_for_windows',
            pricing                 : '/pricing',
            contact                 : '/contact',
            passwordReset           : '/reset_password',
            passwordForgot          : '/lost_password',
            accountActivate         : '/activate_account',
            accountUpdate           : '/account_update',
            accountUpdateReminder   : '/account_update_reminder',
            accountDetails          : '/account_details',
            accountCreate           : '/signup',
            accountLogin            : '/login',
            accountLogout           : '/logout',
            accountDelete           : '/delete',
            getOvpnConf             : '/getOvpnConf',
            getRegionList           : '/getRegionList',
            policiesPrivacy         : '/policies/privacy',
            policiesTos             : '/policies/tos',
            features                : '/features',
            sitemap                 : '/sitemap',
            purchase                : '/purchase',
            purchaseConfirmBitcoin  : '/purchaseConfirmBitcoin',
            purchaseConfirmPaypal   : '/purchaseConfirmPaypal',
            purchaseCancelledPaypal : '/purchaseCancelledPaypal',
            getConnectionKey        : '/getConnectionKey',
            getUserByteStats        : '/getUserByteStats',

            /* API routes */
            apiGetServerDetails     : '/api/ServerDetails',
        },

        /* The name of the file that users download */
        ovpnConfFilename            : 'SwirlVPN',
        ovpnConfFileExt             : '.ovpn',

        /* awstat is used to parse the webserver access logs to monitor webserver usage */
        accessLog                   : '/var/log/server/webserver-access.log',
        awstatsFile                 : '/var/log/server/awstats/awstats.html',

        /* SSL key details */
        ssl   : {
            ca    : '../ssl/website/swirlvpn_com.ca-bundle',
            key   : '../ssl/website/swirlvpn_com.key',
            cert  : '../ssl/website/swirlvpn_com.crt'
        },

        /* Rules for minifying CSS and JS.  We minify and cache. */
        minify_rules : {
            js_match: /javascript/,
            css_match: /css/,
            stylus_match: /stylus/,
            cache: __dirname + '/../webserver/public/.static_cache',
            blacklist: [/\.min\.(css|js)$/, /jquery\-2\.0\.3\.js/]

        },

        /* The captcha public and private keys */
        reCaptcha : {
            publicKey : '#### Get public key from Google ####',
            privateKey: '#### Get private key from Google ####'
        }
    },

    /* The email details such that we can send emails to the user and to the
       admin.  Including "from" email address. */
    /* You will want to setup an SMTP relay service (e.g. gmail) */
    smtp : {
        host              : '#### Email Host provider ####',
        emailLoginName    : '#### Email Host login name ####',   /* API Key */
        password          : '#### Email Host login password ####',   /* Secret */

        /* The "from" address for user email from the server */
        supportEmail      : 'SwirlVPN Support <support@swirlvpn.com>',

        /* Emergancy emails get sent here */
        adminEmail        : 'SwirlVPN Admin <admin@swirlvpn.com>',

         /* Set to false and the emails will not send - good for testing */
        sendEmail         : true
    },

    /* These are the OpenVPN servers we have running.  When a server is
     * changed/added/removed, these details need to be updated */
    server : {
        /* Computer friendly names for the regions */
        regions             : ['StGallen',              'Sydney',            'California',],

        /* Human friendly names for the regions */
        regionDescs         : ['St Gallen, Switzerland', 'Sydney, Australia',  'California, USA'],

        /* The types of servers we have */
        serverTypes         : ['Regional',          /* Don't know what this one is? */
                               'RegionalServer',    /* A server that is the main connection point for VPN users */
                               'Webserver',         /* The server is a web server */
                               'OpenVPN',           /* The server runs OpenVPN for the users */
                               'Ziproxy',           /* The server runs Ziproxy */
                               'KeyGen',            /* The server generates the keys for the users - must be only one server */
                               'MongoDB'],          /* The server runs mongo db */

        /* How often we probe the server for system stastics monitoring details (seconds) */
        monitoringFreq: 60, /* seconds */

        /* Ping Port */
        regionalServerPingPort: 1443
    },


    /* The individual OpenVPN Server details */
    ovpnServer : {

        /* The OpenVPN process is managed by the regional server using a telnet
         * interface.  This interface will deliver information into the status
         * log at a given period.  This managementInterface has a password and
         * needs to be set in OpenVPN.
         */
        ovpnProcess       : {
            logs : {
                status    : '/var/log/server/openvpn/status.log',

                /* How often we read the status log an report back to the main server */
                frequency : 30 * 1000 /* milliseconds */
            },
            managementInterface: {
                password  : '#### This password needs to be the same as in OpenVPN. See mgmnt-pw-file. ####',
                port      : 9091,
                ip        : '127.0.0.1'
            }
        },

        /* The list of servers.  This is used for the connection keys for users
           to connect to SwirlVPN. For each "regions" in the server object above
           you need to add the name below as a server listing. */
        servers : {
            StGallen : {
                sockets    : ['ch1.swirlvpn.com 443', 'ch2.swirlvpn.com 443', 'ch3.swirlvpn.com 443', 'ch4.swirlvpn.com 443']
            },
            Sydney : {
                sockets    : ['au1.swirlvpn.com 443', 'au2.swirlvpn.com 443', 'au3.swirlvpn.com 443', 'au4.swirlvpn.com 443']
            },
            California : {
                sockets    : ['ca1.swirlvpn.com 443', 'ca2.swirlvpn.com 443', 'ca3.swirlvpn.com 443', 'ca4.swirlvpn.com 443']
            },
        },

        /* The Regional Server connects to the master server via a WebService. */
        webservice : {

            /* To avoid forgeries, we have a private key that is required to
               make a connection.  This 'key' variable below is the same one
               used on the master and regional servers. */
            key: '#### Webservice secret key ####',

            /* Where the master server is located.  This is typically at the
               end of an OpenVPN tunnel */
            host: '10.10.0.1',
            port: 8881,
            allowed_ip_range: '10.10.0.', /* For master server only */
            routes : {
                'vpn-connections'  : '/vpn-connections',
                'vpn-update-stats' : '/vpn-update-stats'
            }
        }
    },

    /* Environment variables that we use and exepct to be used */
    environmentVariables : {
        environment   : 'NODE_ENV',
        appType       : 'APP',
        serverType    : 'VV_SERVER_TYPE'
    },

    /* Purchasing details */
    purchase : {

        /* The different methods of payment available, used to identify the source
           of the purchase*/
        method : {
            types : ['Bitcoin', 'PayPal', 'Free', 'Voucher']
        },

        /* The initial bytes balance new users get (for free) */
        defaultBytesBalance   : 250 * 1024 * 1024,

        /* How long the bytes balance lasts */
        expiryDays : 365,

        /* How often to check for newly expired  */
        expiryCheckFrequency : 24*3600*1000,
        /*
          The types of statuses allowed for a purchase document:
            - new : A purchase that has not yet been used.
            - active : A purchase that currently is being used.
            - expired : A purchase that has expired - time since purchase has expired.
            - used : A purchase where all the bytes have been used up.
            - deleted : if for any reason we need to delete purchase.
            - cancelled : the payment was cancelled.
         */
        statuses     : ['pending payment confirmation', 'new', 'active', 'expired', 'used', 'deleted', 'cancelled'],
        statusPending: ['pending payment confirmation'],     /* This status is required for bitcoin which takes a while to confirm payment */
        statusOpen   : ['new', 'active'],
        statusClosed : ['expired', 'used', 'deleted', 'cancelled'],

        /* Where the purchase log is saved */
        logFile      : getUserHome() + '/purchase.log',

        /* User Interface details for purchases */
        ui: {
            tableHeaders : [ { title:'Data Plan',   fieldName: 'name',              caption:'The name of the data plan' },
                             { title:'Data Total',  fieldName: 'bytesPurchasedHR',  caption:'The amount of data first available with the item' },
                             { title:'Data Used',   fieldName: 'bytesUsedHR',       caption:'The amount of data already used for this item' },
                             { title:'Expiry',      fieldName: 'timeToExpiry',      caption:'When the given item expires' },
                             { title:'Status',      fieldName: 'status',            caption:'The status of the item' } ],
            allowedFields : ['datePurchased', 'dateExpires', 'dateClosed', 'status', 'bytesPurchased', 'bytesUsed', 'name',
                             'timeToExpiry', 'bytesPurchasedHR', 'bytesUsedHR', 'bytesRemaining', 'bytesRemainingHR',
                             { name : 'paymentDetails', fields: ['method', 'currency', 'valueOrigCurrency']} ]

        },

        /*
         * This is an array that contains the pricing data.  It is sent to the UI, we need to check it on purchase.
         *     format: [[bytes (GB), cost ($)], ...]
         */
        pricingData : [ [1,1],[1.2,1.17],[1.4,1.34],[1.6,1.5],[1.8,1.66],[2,1.81],[2.2,1.95],[2.4,2.09],[2.6,2.22],[2.8,2.35],[3,2.47],
                        [3.2,2.6],[3.4,2.71],[3.6,2.83],[3.8,2.94],[4,3.04],[4.2,3.15],[4.4,3.25],[4.6,3.35],[4.8,3.44],[5,3.54],[5.25,3.65],
                        [5.5,3.76],[5.75,3.87],[6,3.98],[6.25,4.08],[6.5,4.18],[6.75,4.28],[7,4.37],[7.25,4.47],[7.5,4.56],[7.75,4.65],[8,4.74],
                        [8.25,4.82],[8.5,4.91],[8.75,4.99],[9,5.08],[9.25,5.16],[9.5,5.24],[9.75,5.32],[10,5.4],[10.5,5.55],[11,5.7],[11.5,5.85],
                        [12,6],[12.5,6.14],[13,6.28],[13.5,6.42],[14,6.56],[14.5,6.7],[15,6.84],[15.5,6.97],[16,7.1],[16.5,7.24],[17,7.37],
                        [17.5,7.5],[18,7.63],[18.5,7.76],[19,7.89],[19.5,8.02],[20,8.15],[21,8.41],[22,8.67],[23,8.93],[24,9.18],[25,9.44],
                        [26,9.7],[27,9.95],[28,10.21],[29,10.47],[30,10.73],[31,10.99],[32,11.25],[33,11.51],[34,11.77],[35,12.03],[36,12.29],
                        [37,12.55],[38,12.81],[39,13.08],[40,13.34],[41,13.6],[42,13.87],[43,14.13],[44,14.4],[45,14.66],[46,14.93],[47,15.2],
                        [48,15.46],[49,15.73],[50,16],[51,16.27],[52,16.54],[53,16.81],[54,17.08],[55,17.35],[56,17.62],[57,17.89],[58,18.16],
                        [59,18.43],[60,18.7],[61,18.98],[62,19.25],[63,19.52],[64,19.79],[65,20.07],[66,20.34],[67,20.62],[68,20.89],[69,21.17],
                        [70,21.44],[71,21.72],[72,21.99],[73,22.27],[74,22.54],[75,22.82],[76,23.09],[77,23.37],[78,23.65],[79,23.92],[80,24.2],
                        [81,24.48],[82,24.76],[83,25.03],[84,25.31],[85,25.59],[86,25.87],[87,26.15],[88,26.42],[89,26.7],[90,26.98],[91,27.26],
                        [92,27.54],[93,27.82],[94,28.1],[95,28.38],[96,28.66],[97,28.94],[98,29.22],[99,29.5],[100,29.78],[101,30.06],[102,30.34],
                        [103,30.62],[104,30.9],[105,31.18],[106,31.46],[107,31.74],[108,32.02],[109,32.3],[110,32.59],[111,32.87],[112,33.15],[113,33.43],
                        [114,33.71],[115,33.99],[116,34.27],[117,34.56],[118,34.84],[120,35.4],[122,35.97],[124,36.53],[126,37.1],[128,37.66],[130,38.23],
                        [132,38.79],[134,39.36],[136,39.93],[138,40.49],[140,41.06],[142,41.63],[144,42.19],[146,42.76],[148,43.33],[150,43.89],[152,44.46],
                        [154,45.03],[156,45.6],[158,46.17],[160,46.74],[162,47.3],[164,47.87],[166,48.44],[168,49.01],[170,49.58],[172,50.15],[174,50.72],
                        [176,51.29],[178,51.86],[180,52.43],[182,53],[184,53.57],[186,54.14],[188,54.71],[190,55.28],[192,55.85],[194,56.42],[196,56.99],
                        [198,57.56],[200,58.13]
                      ]
    },

    payment : {

        /*
         * The BitPay payment details.  Details related to the BitPay documentation */
         */
        bitpay : {
            vendorName : 'BitPay',
            vendorHome : 'https://bitpay.com',
            method:     'Bitcoin',
            invoicePostURL : 'https://bitpay.com/api/invoice',
            invoiceCurrency : 'USD',
            validPaymentStatus : [ 'new', 'paid', 'confirmed', 'complete', 'expired', 'invalid' ],
            paymentInProgress : [ 'new', 'paid', 'confirmed' ],
            paymentCompleteStatusList : [ 'confirmed', 'complete' ],
            paymentCancelledStatusList : [ 'expired', 'invalid' ],
            notificationURL: '/#### Create your own ####',                       /* Where bitpay will post their confirmations */
            defaultTransactionSpeed: 'medium',
            notificationEmail: 'admin@swirlvpn.com',
            apiKey: '#### BitPay API key ####',
            paymentURL : '/purchaseConfirmBitcoin?vendorPaymentId=',
        },

        /*
         * The PayPal purchases details
         */
        paypal : {
            vendorName : 'PayPal',
            config_opts: {
                mode : 'live',
                client_id: '#### PayPal client ID ####',
                client_secret : '#### PayPal client secret ####',
            },
            redirect_urls: {
                return_url: 'https://www.swirlvpn.com/purchaseConfirmPaypal',
                cancel_url: 'https://www.swirlvpn.com/purchaseCancelledPaypal'
            },
            validPaymentStatus : [ 'created', 'approved', 'failed', 'pending', 'canceled', 'expired' ],
            paymentInProgress : [ 'pending', 'created' ],
            paymentCompleteStatusList : [ 'approved' ],
            paymentCancelledStatusList : [ 'failed', 'canceled', 'expired' ]

        }
    }
};

/**
 * The configuration overrides for the development system
 */
var dev_overrides = {
    webserver : {
        host      : '127.0.0.1',
        domain    : 'localhost',
        minify_rules : {
            blacklist: [/.*\.js/,/.*\.css/]
        }
    },
    smtp : {
        sendEmail         : false
    },
    server : {
        regions       : ['Sydney',            'Test'],
        regionDescs   : ['Sydney, Australia', 'Test'],
    },
    ovpnServer : {
        servers : {
            Sydney : {
                sockets    : ['127.0.0.1 443', '127.0.0.1 443', '127.0.0.1 443', '127.0.0.1 443']
            },
            Test : {
                sockets    : ['127.0.0.1 443', '127.0.0.1 443', '127.0.0.1 443', '127.0.0.1 443']
            }
        },
        webservice : {
            host: 'localhost',
            allowed_ip_range: '127.0.0.1'
        }
    },
    purchase : {
        expiryCheckFrequency: 500, /* Every 2 seconds */
    },
    payment : {
        bitpay : {
            apiKey: '#### BitPay api key ####',
            defaultTransactionSpeed: 'high',
        },
        paypal : {
            config_opts: {
                mode : 'sandbox',
                client_id: '#### PayPal DEVELOPER client ID ####',
                client_secret   : '#### PayPal DEVELOPER client secret ####'
            },
            redirect_urls: {
                return_url: 'https://localhost:8889/purchaseConfirmPaypal',
                cancel_url: 'https://localhost:8889/purchaseCancelledPaypal'
            },
        }
    }
};

/**
 * The configuration overrides for the test system
 */
var test_overrides = {
    webserver : {
        /* The IP address of the webserver */
        host      : '### TEST server IP ###',
        domain    : 'testwww.swirlvpn.com',
    },
    server : {
        regions       : ['Sydney'],
        regionDescs   : ['Sydney, Australia'],
    },
    ovpnServer : {
        servers : {
            Sydney : {
                sockets    : ['testwww.swirlvpn.com 443']
            }
        },
    },
    payment : {
        bitpay : {
            apiKey: '### Bit pay API KEY for testing ###'
        }
    }
};


/* Configuration system */
var nconf                   = require('nconf');

/* Set overrides */
if (process.env.NODE_ENV === 'development') {
    nconf                   = nconf.overrides(dev_overrides);
} else if (process.env.NODE_ENV === 'testing') {
    nconf                   = nconf.overrides(test_overrides);
}

/* Set default values */
nconf                       = nconf.env();
nconf                       = nconf.argv();
nconf                       = nconf.defaults(config);

/**
 * This is a wrapper function that simplifies the lookup of a config string.  It will crash the
 * current node process if a config was incorrectly looked up.
 * @param  {string} configKeyStr The config option, in nconf format.
 * @return {object}              The config object, can be string or JSON style object.
 */
exports.cfg = function cfg(configKeyStr) {

    /* Make sure the input key is valid */
    if (!configKeyStr || configKeyStr.length === 0) {
        throw new Error('config key string is 0 length');
    }

    /* Lookup the config value */
    var configVal = nconf.get(configKeyStr);

    /* Now check we found the config value okay */
    if (!configVal) {
        throw new Error('config value was not found: ' + configKeyStr);
    }

    return configVal;
};

function getUserHome() {
   return process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
}
