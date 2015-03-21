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
 * email-dispatcher.js
 *
 * This module puts together the various emails.  You can format emails, configure
 * the smtp host, turn on/off email delivery (good for testing).  Each email
 * sent should come through this module.
 *
 */

/*jslint node:true*/
'use strict';

/* Import our configuration settings */
var cm              = require('./index');
var emailjs         = require('emailjs/email');
var querystring     = require('querystring');
var emailLayout     = require('./emailLayout');
var cfgSMTP         = cm.cfg('smtp');
var supportEmail    = cfgSMTP.supportEmail;
var adminEmail      = cfgSMTP.adminEmail;
var emailLoginName  = cfgSMTP.emailLoginName;
var sendEmail       = cfgSMTP.sendEmail;

var EM = {};
module.exports = EM;

EM.server = emailjs.server.connect({
    host           : cfgSMTP.host,
    user           : emailLoginName,
    password       : cfgSMTP.password,
    ssl            : true
});

function sendEmailFunction(options, callback) {
    if (sendEmail) {
        EM.server.send(options, callback);
    } else {
        cm.log.debug('Email has been configured to not send!!!');
    }
}


/**
 * Password Reset
 */
EM.dispatchResetPasswordLink = function dispatchResetPasswordLink(account, callback) {

    var emContent = composeResetPasswordLinkEmail(account);

    sendEmailFunction({
        from         : supportEmail,
        replyTo      : supportEmail,
        to           : account.email,
        subject      : 'Password Reset',
        text         : emContent.text,
        attachment   : [{data:emContent.html, alternative:true}]
    }, callback );
};
function composeResetPasswordLinkEmail(account) {

    /* Build the password reset link */
    var query = {
            'e': account.email,
            'c': account.passwordResetCode
    };
    var link  = cm.getWebserverURL();
        link += cm.cfg('webserver:links:passwordReset');
        link += '?' + querystring.stringify(query);

    var emContent = new emailLayout.EmailContent();

    emContent.addContentTitle('Swirl VPN password reset requested');
    emContent.addContentBlurb('You have requested for your Swirl VPN login password to be reset. Click on the link below, or copy it into your browser to reset you password:');
    emContent.addContentSubTitle('Click link to reset your password:');
    emContent.addContentLink(link);

    return emContent.done();
}


/**
 * Activate Account email
 */
EM.dispatchEmailActivateAccount = function dispatchEmailActivateAccount(account, callback) {

    var emContent = composeEmailActivateAccount(account);

    sendEmailFunction({
        from         : supportEmail,
        replyTo      : supportEmail,
        to           : account.email,
        subject      : 'Swirl VPN Account activation',
        text         : emContent.text,
        attachment   : [{data:emContent.html, alternative:true}]
    }, callback );
};
function composeEmailActivateAccount(account) {

    /* Build the email confirmation link */
    var query = {
            'e': account.email,
            'c': account.activationCode
    };
    var link  = cm.getWebserverURL();
        link += cm.cfg('webserver:links:accountActivate');
        link += '?' + querystring.stringify(query);


    var emContent = new emailLayout.EmailContent();

    emContent.addContentTitle('Swirl VPN Account activation');
    emContent.addContentBlurb('You have just signed up for Swirl VPN, before you can purchase data you need to verify your email ' +
                                         'address.  Click on the link below, or copy it into your browser:');
    emContent.addContentSubTitle('Click the link below to activate your account:');
    emContent.addContentLink(link);
    emContent.addContentBlurb('You can sign-in at any time to download you Swirl VPN configuration files.');

    emContent.addContentBlurb('Below are the connection instructions for:');
    emContent.addHTML(
        '<ul>'+
            '<li>&nbsp;&nbsp;&nbsp; <a href="' + cm.getWebserverURL() + cm.cfg('webserver:links:docs_android') + '">Android</a></li> ' +
            '<li>&nbsp;&nbsp;&nbsp; <a href="' + cm.getWebserverURL() + cm.cfg('webserver:links:docs_iphone')  + '">iPhone / iPad</a></li> ' +
            '<li>&nbsp;&nbsp;&nbsp; <a href="' + cm.getWebserverURL() + cm.cfg('webserver:links:docs_windows') + '">Microsoft Windows</a></li> ' +
            '<li>&nbsp;&nbsp;&nbsp; <a href="' + cm.getWebserverURL() + cm.cfg('webserver:links:docs_linux')   + '">Linux</a></li>' +
        '</ul>'
    );
    emContent.addText(
        '    - Android           : ' + cm.getWebserverURL() + cm.cfg('webserver:links:docs_android') + '\n' +
        '    - iPhone            : ' + cm.getWebserverURL() + cm.cfg('webserver:links:docs_iphone')  + '\n' +
        '    - Microsoft Windows : ' + cm.getWebserverURL() + cm.cfg('webserver:links:docs_windows') + '\n' +
        '    - Linux             : ' + cm.getWebserverURL() + cm.cfg('webserver:links:docs_linux')
    );

    return emContent.done();

}


/**
 * Activate Account email
 */
EM.dispatchOvpnFile = function dispatchOvpnFile(details, callback) {

    var emContent = composeEmailOvpnFile(details);

    sendEmailFunction({
        from         : supportEmail,
        replyTo      : supportEmail,
        to           : details.email,
        subject      : 'Swirl VPN configuration file',
        text         : emContent.text,
        attachment   : [{data:emContent.html, alternative:true},
                        {data:details.data, type: details.type, name: details.filename}]
    }, callback );
};
function composeEmailOvpnFile(details) {

    var emContent = new emailLayout.EmailContent();

    emContent.addContentTitle('Your Swirl VPN configuration file is attached');
    emContent.addContentBlurb('You have requested your Swirl VPN configuration file, it is attached to this email.');
    emContent.addContentBlurb('Instructions on connecting to Swirl VPN can be found here: ');
    emContent.addContentLink(cm.getWebserverURL() + cm.cfg('webserver:links:faq'));
    emContent.addContentBlurb('<b>Important:</b> You should delete this email once you have saved the configuraiton file.');

    return emContent.done();
}



/**
 * User submitted comment email.  Sent to support.
 */
EM.dispatchEmailComment = function dispatchEmailComment(commentData, callback) {
    var emailContent = {
            from         : supportEmail,
            replyTo      : supportEmail,
            to           : supportEmail,
            subject      : 'Comment Submitted by user',
            text         : 'email: '   + commentData.email + '\n' +
                           'subject: ' + commentData.subject + '\n' +
                           'comment: ' + commentData.comment + '\n'
        };
    sendEmailFunction(emailContent, callback);
};


/**
 * A fatal error occurred, inform the admin by email.
 */
EM.dispatchFatalErrorOccurredEmail = function dispatchFatalErrorOccurredEmail(details) {

    var emailContent;

    try {
        emailContent = {
                from         : adminEmail,
                to           : adminEmail,
                subject      : 'FATAL: ' + details.errorMessage,
                text         : 'A fatal error occurred on a server:\n\t' + JSON.stringify(details,null,4).replace(/\\n/g,'\u000A')
            };
        sendEmailFunction(emailContent);
    } catch(ex) {
        console.error('More than fatal error occured: ' + ex);
        /* Try again in case of failure */
        emailContent  = {
                from         : adminEmail,
                to           : adminEmail,
                subject      : 'FATAL: MORE FATAL - could not even create fatal message',
                text         : 'Could not even compose email'
            };
        sendEmailFunction(emailContent);
    }

};


/**
 * A server booted, inform the admin by email.
 */
EM.dispatchServerBootedEmail = function dispatchServerBootedEmail(details) {

    var emailContent;

    try {
        emailContent = {
                from         : adminEmail,
                to           : adminEmail,
                subject      : 'SERVER BOOT: ' + details.serverType + ' - ' + details.region,
                text         : 'The server booted:\n\t' + JSON.stringify(details,null,4).replace(/\\n/g,'\u000A')
            };
        sendEmailFunction(emailContent);
    } catch(ex) {
        console.error('Fatal error occured: ' + ex);
    }

};



/*
 * Create and Send Purchase confirmation.
 */


EM.dispatchPurchaseConfirmation = function dispatchPurchaseConfirmation(details) {
    var emContent = composeEmailPurchaseConfirmation(details);
    sendEmailFunction({
        from         : supportEmail,
        replyTo      : supportEmail,
        to           : details.email,
        subject      : 'Swirl VPN Purchase Confirmation',
        text         : emContent.text,
        attachment   : [{data:emContent.html, alternative:true}]
    }, function(){} );
};
function composeEmailPurchaseConfirmation(details) {

    var link  = cm.getWebserverURL();
        link += cm.cfg('webserver:links:accountDetails');

    var emContent = new emailLayout.EmailContent();

    emContent.addContentTitle('Swirl VPN Purchase Confirmation');
    emContent.addContentBlurb('We can confirm that the purchase you made recently has been successful.');
    emContent.addContentSubTitle('Purchase details:');
    emContent.addContentBlurb('&nbsp;&nbsp;&nbsp;&nbsp;   <b>Bytes Purchased:</b>&nbsp;&nbsp; ' + cm.bytesToSize(details.purchase.bytesPurchased,1));
    emContent.addContentBlurb('&nbsp;&nbsp;&nbsp;&nbsp;   <b>Price (USD):</b>&nbsp;&nbsp; $' + cm.prettyNum(details.pricePaid, 2));
    emContent.addContentBlurb('&nbsp;&nbsp;&nbsp;&nbsp;   <b>Method:</b>&nbsp;&nbsp; ' + details.purchase.paymentDetails.method);
    if (details.purchase.paymentDetails.invoiceURL.length > 0) {
        emContent.addContentLinkWithPreText('&nbsp;&nbsp;&nbsp;&nbsp;   <b>Invoice URL:</b>&nbsp;&nbsp; ', details.purchase.paymentDetails.invoiceURL);
    }
    emContent.addContentBlurb('&nbsp;&nbsp;&nbsp;&nbsp;   <b>Order Id:</b>&nbsp;&nbsp; ' + details.purchase.paymentDetails.vendorPaymentId);
    emContent.addContentBlurb('&nbsp;&nbsp;&nbsp;&nbsp;   The data associated with this purchase expires in ' + cm.getTimeToExpiry(details.purchase.dateExpires));

    emContent.addContentSubTitle('Click the link below to view your account details:');
    emContent.addContentLink(link);
    emContent.addContentBlurb('Thank you for your purchase.  Please let us know if you have any questions.');

    return  emContent.done();
}


/*
 * Remind the user when they are low on credit.
 */
EM.dispatchLowDataReminder = function dispatchLowDataReminder(details) {
    var emContent = composeEmailLowDataReminder(details);
    sendEmailFunction({
        from         : supportEmail,
        replyTo      : supportEmail,
        to           : details.email,
        subject      : 'Swirl VPN Low Data Reminder',
        text         : emContent.text,
        attachment   : [{data:emContent.html, alternative:true}]
    }, function(err, obj){
    } );
};
function composeEmailLowDataReminder(details) {

    var accountLink  = cm.getWebserverURL();
        accountLink += cm.cfg('webserver:links:accountDetails');
    var purchaseLink  = cm.getWebserverURL();
        purchaseLink += cm.cfg('webserver:links:purchase');

    var emContent = new emailLayout.EmailContent();

    emContent.addContentTitle('Swirl VPN Low Data Reminder');
    emContent.addContentBlurb('Hi, we just want to remind you that you are running low on data.  You only have ' +
                               cm.bytesToSize(Math.max(0, details.bytesBalance),1) + ' remaining.');
    emContent.addContentBlurb('But you can easily top up your data by purchasing more:');
    emContent.addContentLink(purchaseLink);
    emContent.addContentBlurb('Click the link below to view your account details:');
    emContent.addContentLink(accountLink);
    emContent.addContentBlurb('Please let us know if you have any questions.');

    return  emContent.done();
}