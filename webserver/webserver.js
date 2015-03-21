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
 * The main WebServer code.  This is where is all begins.  This and all the sub
 * directories and their files serve the static pages as well as dynamic content.
 */


/*jslint node:true*/
'use strict';

var express     = require('express');
var app         = express();
var minify      = require('express-minify');
var am = require('../common/account-manager');
    am.init({ loadOvpnConfig:true, initPurchasing: true }, function(){});
var cm          = require('../common');
var fs          = require('fs');

/* Connect handlers for ExpressJS v4.0+ */
var bodyParser       = require('body-parser');
var logger           = require('morgan');
var methodOverride   = require('method-override');
var cookieParser     = require('cookie-parser');
var session          = require('express-session');
var compress         = require('compression');
var errorHandler     = require('errorhandler');
var mongoStore       = require('connect-mongo')(session);
var stylus           = require('stylus');
var path             = require('path');
var favicon          = require('serve-favicon');

/* Date and time offsets */
var oneDay      = 24*3600*1000;
var oneWeek     = oneDay * 7;
var oneWeekStr  = (oneWeek/1000).toString();
var oneYear     = oneDay * 365;

cm.log.error('BOOTING: ', new Date());
console.log('BOOTING: ', new Date());



/**
 * Test the necessary servers are up
 */
(function testKeygenServerUp() {

    var keygenPost = {
        url: cm.getKeygenURL(cm),
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            userId:   'bogusUser',
            email:    'bogusEmail'
        })
    };

    /*
     * Send the data to the keygen server, then parse it to make sure all is OK!
     */
    require('request').post(keygenPost, function(error, response, body) {

        var fatalMessage = 'Keygen server not responding';

        /* Parse the response */

        if (error || response.statusCode !== 200) {
            cm.log.error('ERROR: Error fetching data from keyserver');
            cm.fatalError(fatalMessage, cm.getEnvVars(cm));
            return;
        } else {
            cm.log.info('It seems the keygen server is up and running.');
        }

    });
})();

/**
 * Set the cache control for static objects.
 */
function fnSetCacheControl(req, res, next) {
    if(req.url.indexOf('/css/')    === 0  ||
       req.url.indexOf('/fonts/')  === 0  ||
       req.url.indexOf('/img/')    === 0  ||
       req.url.indexOf('/js/')     === 0  ||
       req.url.indexOf('/vendor/') === 0)  {
            res.setHeader('Cache-Control', 'public, max-age=' + oneWeekStr);
            res.setHeader('Expires', new Date(Date.now() + oneWeek).toUTCString());
    }
    return next();
}


/*************************************************************
 *
 *                   Configure the server
 *
 *************************************************************/


app.set('port', cm.cfg('webserver:httpsPort'));
app.set('views', path.join(__dirname, 'server/views'));
app.set('view engine', 'jade');
app.locals.pretty = false;
app.use(favicon(path.join(__dirname, '/public/favicon.ico')));

/* Setup the log format */
logger.token('user', function(req, res) {
    var user = '-';
    if (req.session && req.session.user) {
        user = req.session.user;
    }
    return user.email;
});
logger.token('date', cm.getDateForWebLog);
app.use(logger({
    stream: fs.createWriteStream(cm.cfg('webserver:accessLog'), {flags: 'a'}),
    format: ':remote-addr - :user [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
        }));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(compress());

app.use(stylus.middleware(path.join(__dirname, 'public')));

/* Minify CSS & JS, use mem cache not file cache */
app.use(minify(cm.cfg('webserver:minify_rules')));
app.use(session({
    store: new mongoStore({
        url: cm.getMongoURL() + '/' + cm.cfg('db:sessions:name')
    }, function () {
        // See: https://github.com/kcbanner/connect-mongo/pull/58#issuecomment-32148111
        console.log('db connection open');
    }),
    secret: cm.cfg('db:sessions:secret'),
    maxAge  : new Date(Date.now() + oneYear),
    expires : new Date(Date.now() + oneYear),
}));
app.use(methodOverride());


var env = process.env.NODE_ENV || 'development';
switch (env) {

    case 'production':
        app.use(fnSetCacheControl);
        app.use(express.static(__dirname + '/public', { maxAge: oneWeekStr }));
        break;

    case 'testing':
        app.use(fnSetCacheControl);
        app.use(express.static(__dirname + '/public', { maxAge: oneWeekStr }));
        break;

    case 'development':
        app.use(express.static(__dirname + '/public'));
        app.use(errorHandler());
        app.locals.pretty = true;
        break;
}


/**
 * Our router, this is where all the stuff happens.
 */
var am;
require('./server/router')(app, cm, am);


/**
 * Set up the HTTPS server.
 */
var https = require('https');
var fs    = require('fs');

var httpsOptions = {
    ca:   fs.readFileSync(cm.cfg('webserver:ssl:ca')),
    key:  fs.readFileSync(cm.cfg('webserver:ssl:key')),
    cert: fs.readFileSync(cm.cfg('webserver:ssl:cert'))
};

var httpsServer = https.createServer(httpsOptions, app);
httpsServer.listen(cm.cfg('webserver:httpsPort'), function(){
    cm.log.info('Express HTTPS server listening on port ' + cm.cfg('webserver:httpsPort'));
});


/**
 * Set up plain http server to just redirect to https
 */
var redir = express();
redir.all('*', function(req, res){
    res.redirect(cm.getWebserverURL() + req.url);
});
redir.listen(cm.cfg('webserver:httpPort'), function() {
    cm.log.info('Redirecting all HTTP requests to HTTPS');
});

