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
 * router.js
 *
 * This is the main routing page.  All routes are here.
 */

/*jslint node:true*/
'use strict';

/* Import our configuration settings */
var em = require('../../common/email-dispatcher');

module.exports = function(app, cm, am) {

    /* Populate these values for use later */
    var regions         = cm.cfg('server:regions');
    var regionDescs     = cm.cfg('server:regionDescs');

    /* Redirect from swirlvpn.com to www.swirlvpn.com */
    if (process.env.NODE_ENV === 'production') {
        app.get('/*', function(req, res, next) {
            if (req.headers.host.match(/^www/) !== null ) {
                // We're okay, continue to next route
                next();
            } else {
                /* CONFIG_TODO: Add your website here */
                res.redirect('https://www.swirlvpn.com/' + req.url);
            }
        });
    }

    app.get(cm.cfg('webserver:links:docs_iphone'), function(req, res) {
        res.render('documentation/iphone', {title: 'Swirl VPN for iPhone', user:req.session.user});
    });
    app.get(cm.cfg('webserver:links:docs_windows'), function(req, res) {
        res.render('documentation/windows', {title: 'Swirl VPN for Windows', user:req.session.user});
    });
    app.get(cm.cfg('webserver:links:docs_linux'), function(req, res) {
        res.render('documentation/linux', {title: 'Swirl VPN for Linux', user:req.session.user});
    });
    app.get(cm.cfg('webserver:links:policiesPrivacy'), function(req, res) {
        res.render('policyPrivacy', {title: 'Privacy Policy', user:req.session.user});
    });
    app.get(cm.cfg('webserver:links:policiesTos'), function(req, res) {
        res.render('policyTOS', {title: 'Terms and Conditions', user:req.session.user});
    });
    app.get(cm.cfg('webserver:links:features'), function(req, res) {
        res.render('features', {title: 'Features', user:req.session.user});
    });
    app.get(cm.cfg('webserver:links:sitemap'), function(req, res) {
        res.render('sitemap', {title: 'Site Map', user:req.session.user});
    });

    /**
     * main login page
     */
    app.get(cm.cfg('webserver:links:home'), function(req, res) {
        res.render('home', {title: 'VPN optimized for mobile devices', user:req.session.user});
    });
    app.get(cm.cfg('webserver:links:faq'), function(req, res) {
        res.render('faq', {title: 'Frequently Asked Questions', user:req.session.user});
    });
    app.get(cm.cfg('webserver:links:pricing'), function(req, res) {
        res.render('pricing', {title: 'Pricing', user:req.session.user});
    });
    app.get(cm.cfg('webserver:links:contact'), function(req, res) {
        res.render('contact', {title: 'Contact', user:req.session.user});
    });
    app.post(cm.cfg('webserver:links:contact'), function(req, res) {
        var commentData = {
            email    : req.param('email'),
            subject  : req.param('subject'),
            comment  : req.param('comment')
        };

        res.send('Your comment has been submitted, thank you.', 200);
        /* Now send out activation email to user */
        em.dispatchEmailComment(commentData, function(err){
            /* this callback takes a moment to return */
            /* should add an ajax loader to give user feedback  */
            if (err) {
                console.log('dispatchEmailComment(): There was an error submitting a comment:', err);
                cm.log.error('There was an error submitting a comment:', err);
            }
        });

    });

    app.get(cm.cfg('webserver:links:accountLogin'), function(req, res) {

        /* attempt automatic login */
        if (req.session.user && req.session.autoLogin) {
            am.autoLogin(req.session.user, function(err, userObj) {
                if (userObj !== null){
                    req.session.user = getSimpleSessionInfo(userObj);
                    res.redirect(cm.cfg('webserver:links:accountDetails'));
                } else {
                    cm.log.error(err);
                    res.render('login', { title: 'Please Login To Your Account', user: req.session.user});
                }
            });
        } else {
            res.render('login', { title: 'Please Login To Your Account', user: req.session.user });
        }
    });

    /**
     * Handle login post request
     */
    app.post(cm.cfg('webserver:links:accountLogin'), function(req, res){

        var email = req.param('email').toLowerCase();
        var password = req.param('password');

        doManualLogin(req, res, email, password);

    });

    function doManualLogin(req, res, email, password, setRememberMe) {

        am.manualLogin(email, password, req.ip, function(e, userObj) {
            if ( e ) {

                cm.log.error('ERROR: doManualLogin():', e);
                res.send(e, 401);

            } else {

                req.session.user = getSimpleSessionInfo(userObj);
                if (setRememberMe || req.param('remember-me') === 'on') {
                    req.session.autoLogin = true;
                }

                res.send('ok', 200);

            }
        });
    }

    /**
     * User is logged in - view account details
     */
    var purchaseTableHeaders = cm.cfg('purchase:ui:tableHeaders');
    var reminderOptions = cm.cfg('user:reminderOptions');
    app.get(cm.cfg('webserver:links:accountDetails'), function(req, res) {

        /* User needs to be logged in */
        if (!req.session.user) {
            res.redirect(cm.cfg('webserver:links:accountLogin'));
            return;
        }

        var user = req.session.user;
        am.getAccountDetails(user.userId, function(err, accountDetails, userReminder) {
            if (err) {
                cm.log.error('ERROR: Could not get account data - "getAccountDetails()" failed: ' + err);
                res.render('basicMessage', {
                        title: 'Server Error',
                        user: user,
                        msg: 'Something wicked happened:\n\n' + err + '\n\n<a = href="/">Click here to return home.</a>',
                        link: null
                  });

            } else {
                var percentSavings = (accountDetails.bytesToClientSaved / accountDetails.bytesToClient * 100).toFixed(1) + ' %';

                /* Handle the "0 / 0" case */
                percentSavings = (accountDetails.bytesToClient === 0)   ?   '0 %'   :   percentSavings;

                res.render('account_details', {
                    title : 'Account Details',
                    user : user,
                    regions: regions,
                    regionDescs: regionDescs,
                    userDataAvail: cm.prettyBytesInMB(accountDetails.bytesBalance),
                    userDataUsed:  cm.prettyBytesInMB(accountDetails.bytesToClient + accountDetails.bytesFromClient),
                    userDataSavingsPercent:  percentSavings,
                    purchaseTable: {
                        headers : purchaseTableHeaders,
                        data : accountDetails.purchaseList
                    },
                    remindMe: userReminder.remindMe,
                    remindAt: userReminder.remindAt,
                    reminderOptions: reminderOptions
                });
            }
        });
    });

    /**
     * User is logged in - view account update screen
     */
    app.get(cm.cfg('webserver:links:accountUpdate'), function(req, res) {

        if (!req.session.user) {
            res.redirect(cm.cfg('webserver:links:accountLogin'));
        } else {
            res.render('account_update', {
                title : 'Control Panel',
                user : req.session.user
            });
        }
    });


    /**
     * User is logged in - posts from account update screen
     */
    app.post(cm.cfg('webserver:links:accountUpdate'), function(req, res){

        if (!req.session.user){
            res.send('Ooops, server error', 500);
            return;
        }

        var userId = req.session.user.userId;

        if (typeof(userId) !== 'undefined') {

            am.updateAccount({
                newEmail           : req.param('email'),
                newPassword        : req.param('password'),
                userId             : userId
            }, function(e, userObj){
                if (e){
                    cm.log.error('ERROR: error-updating-account: ', e, userId);
                    res.send('error-updating-account', 500);
                } else {
                    req.session.user = getSimpleSessionInfo(userObj);
                    res.send('ok', 200);
                }
            });
        } else {
            cm.log.error('SECURITY ERROR: Server error, did not expect to get here');
            res.send('Ooops, server error', 500);
        }
    });




    /**
     * User is logged in - posts from account update screen
     */
    app.post(cm.cfg('webserver:links:accountUpdateReminder'), function(req, res){

        if (!req.session.user){
            res.send('Ooops, server error', 500);
            return;
        }

        var userId = req.session.user.userId;
        var reminderChange = req.body;

        if (typeof(userId) !== 'undefined') {

            am.updateUserReminder({
                userId             : userId,
                reminderChange     : reminderChange
            }, function(e, o){
                if (e){
                    cm.log.error('ERROR: error-updating-account: ', e, userId);
                    res.send('error-updating-account', 500);
                } else {
                    res.send('ok', 200);
                }
            });
        } else {
            cm.log.error('SECURITY ERROR: Server error, did not expect to get here');
            res.send('error-updating-account', 500);
        }
    });


    /**
     * Send the regions as a list to a logged in user.  This is only required for the Mobile
     * App web interface.
     */
    var regionList = cm.cfg('server:regionDescs').join(';');
    app.get(cm.cfg('webserver:links:getRegionList'), function(req, res) {

        /* User needs to be logged in */
        if (!req.session.user) {
            res.redirect(cm.cfg('webserver:links:accountLogin'));
            return;
        }

        res.send(regionList, 200);

    });

    /**
     * Send the regions as a list to a logged in user.  This is only required for the Mobile
     * App web interface.
     */
    var serverDetailList = [];
    var regionNameList = cm.cfg('server:regions');
    var regionDescList = cm.cfg('server:regionDescs');
    var regionSocketList = cm.cfg('ovpnServer:servers');
    for (var r in regionNameList) {
        var regionName = regionNameList[r];
        var regionDesc = regionDescList[r];
        var socketList = regionSocketList[regionName].sockets;

        var serverDetail = {};
        serverDetail = {
            regionName     : regionName,
            regionDesc     : regionDesc,
            sockets        : socketList
        };

        serverDetailList.push(serverDetail);
    }
    app.get(cm.cfg('webserver:links:apiGetServerDetails'), function(req, res) {

        /* User needs to be logged in */
        if (!req.session.user) {
            res.redirect(cm.cfg('webserver:links:accountLogin'));
            return;
        }

        res.send(serverDetailList, 200);

    });


    /**
     * This is where the user needs to download the OpenVPN configuration file.
     */
    var ovpnFilename = cm.cfg('webserver:ovpnConfFilename');
    var ovpnFileExt  = cm.cfg('webserver:ovpnConfFileExt');
    app.get(cm.cfg('webserver:links:getOvpnConf'), function(req, res) {

        var region  = req.query.region;
        var asEmail = (req.query.as_email === 'true');

        /* User needs to be logged in */
        if (!req.session.user) {
            res.redirect(cm.cfg('webserver:links:accountLogin'));
            return;
        }

        var userId = req.session.user.userId;
        am.getOvpnConfFile(userId, region, function(err, obj) {
            if (err){
                cm.log.error('ERROR: error-getting-ovpn-config: ' + err);
                res.send('error-getting-ovpn-config', 500);
            } else {
                /* Do we send it as an email or let the browser download it */
                var details = {
                        email   : req.session.user.email,
                        data    : obj,
                        filename: ovpnFilename + '-' + region + ovpnFileExt,
                        type    : 'application/octet-stream'
                };
                if (asEmail) {
                    res.render('basicMessage', { title: 'Email sent',
                                                 user: req.session.user,
                                                 msg: 'The file has been sent via email, please check your email.  You are being redirected back you Account Details screen',
                                                 link: cm.cfg('webserver:links:accountDetails')
                              });

                    em.dispatchOvpnFile(details, function(err){
                        if (err) {
                            res.send('email-server-error', 500);
                            for (var k in err) {
                                console.log('dispatchOvpnFile() error : ', k, err[k]);
                                cm.error('error : ', k, err[k]);
                            }
                        }
                    });
                } else {
                    res.set('Content-Type',        details.type);
                    res.set('Content-Disposition', 'attachment;filename="' + details.filename + '"');
                    res.send(details.data, 200);
                }
            }
        });
    });

    /**
     * Logout
     */
    app.get(cm.cfg('webserver:links:accountLogout'), function(req, res){

        /* User needs to be logged in */
        if (!req.session.user) {
            res.redirect(cm.cfg('webserver:links:accountLogin'));
            return;
        }

        req.session.destroy(function(e) {
            if (e) {
                cm.log.error('ERROR: ', e);
            }
            res.render('basicMessage', { title: 'You have logged out',
                                      user: null,
                                      msg: 'You have logged out.  Please wait while you are redirected to the home page.',
                                      link: cm.cfg('webserver:links:home')
                                    });
        });
    });


    /*
     * Send the user their connection key.
     */
    app.get(cm.cfg('webserver:links:getConnectionKey'), function(req, res) {

        /* User needs to be logged in */
        if (!req.session.user) {
            res.render('404', { title: 'Page Not Found', user: req.session.user});
            return;
        }

        am.getUserConnectionKey(req.session.user.userId, function(err, usr) {
            if (err) {
                res.send('An error occurred', 500);
                cm.log.error('getConnectionKey(): An error occurred:', err);
            }
            res.send(usr.connectionKey, 200);
        });

    });

    /*
     *  Send the user the necessary statistics.
     */
    app.post(cm.cfg('webserver:links:getUserByteStats'), function(req, res) {

        var connectionKey = req.param('connectionKey');
        cm.log.info('connectionKey=',connectionKey);

        am.vpnUserGetRemainingBytes_ByUserConnectionKey(connectionKey, function (err, bytesStats, user, conns) {
            if (err) {
                cm.log.error('ERRPR: vpnUserGetRemainingBytes_ByUserConnectionKeyCB() :', err);
                res.send('An error occurred', 500);
            } else if (bytesStats === null) {
                cm.log.error('ERRPR: bytesStats is null :');
                res.send('An error occurred', 500);
            } else {
                cm.log.info('Ok :', err);
                res.send((bytesStats.bytesToClient + bytesStats.bytesFromClient) + ';' + bytesStats.bytesPurchased + ';' + user.reminder.remindMe + ';' + user.reminder.remindAt, 200);
            }
        });
    });

    /**
     * Create new account
     */
    app.get(cm.cfg('webserver:links:accountCreate'), function(req, res) {
        if (req.session.user) {
            res.render('basicMessage', { title: 'You are logged in!',
                user: req.session.user,
                msg: 'Please log out before creating an account, you are being redirected to the home screen.',
                link: cm.cfg('webserver:links:home')
              });
        } else {
            res.render('signup', { title: 'Signup', user: req.session.user });
        }
    });



    var fs = require('fs');
    var Recaptcha = require('recaptcha').Recaptcha;
    var reCaptchaPublicKey = cm.cfg('webserver:reCaptcha:publicKey');
    var reCaptchaPrivateKey = cm.cfg('webserver:reCaptcha:privateKey');
    app.post(cm.cfg('webserver:links:accountCreate'), function(req, res){


        var data = {
            remoteip:  req.connection.remoteAddress,
            challenge: req.body.recaptcha_challenge_field,
            response:  req.body.recaptcha_response_field
        };
        var recaptcha = new Recaptcha(reCaptchaPublicKey, reCaptchaPrivateKey, data);

        recaptcha.verify(function(success, error_code) {
            if (success) {
                createAccountAndLogin(false);
            }
            else {
                res.send('reCaptcha-failure', 400);
                cm.log.error('reCapture failed: ', req.param('email').toLowerCase());
            }
        });


        function createAccountAndLogin() {

            var email        = req.param('email').toLowerCase();
            var password     = req.param('password');

            am.addNewAccount({
                email         : email,
                password      : password,
            }, function(e, userObj){
                if (e){
                    res.send('email-taken or device-already-registered', 400);
                } else {

                    doManualLogin(req, res, email, password, true);


                    /* Now send out activation email to user */
                    em.dispatchEmailActivateAccount(userObj, function(e){
                        /* this callback takes a moment to return           */
                        /* should add an ajax loader to give user feedback  */
                        cm.log.info('Email sent: ', userObj.email);
                        if (e) {
                            cm.log.error({
                                email       : req.param('email').toLowerCase(),
                                password    : req.param('password')
                            });
                            for (var k in e) {
                                cm.log.error('ERROR: ', k, e[k]);
                            }

                        }
                    });
                }
            });
        }

    });


    /**
     * Password reset process, this is where the reset-password email links to.
     */
    app.post(cm.cfg('webserver:links:passwordForgot'), function(req, res){
        /* look up the user's account via their email  */
        var email = req.param('email').toLowerCase();
        am.getAccountByEmailAndSetPWResetCode(email, function(err, usr){
            if (usr){
                res.send('ok', 200);
                em.dispatchResetPasswordLink(usr, function(err){
                    /* this callback takes a moment to return  */
                    /* should add an ajax loader to give user feedback  */
                    if (err) {
                        cm.log.error('ERROR - dispatchResetPasswordLink(): ',err);
                        for (var k in err) {
                            cm.log.error('ERROR: ', k, err[k]);
                        }
                    }
                });
            } else {
                res.send('user email not found', 400);
            }
        });
    });


    /**
     * User request for password reset
     *  - set the 'session.reset' variable which we can use later.
     */
    app.get(cm.cfg('webserver:links:passwordReset'), function(req, res) {

        var email = req.query.e;

        if (typeof(email) !== 'undefined') {
            email = email.toLowerCase();
        }
        var passwordResetCode = req.query.c;
        req.session.reset = { email:email, passwordResetCode:passwordResetCode };
        res.render('reset', { title : 'Reset Password', user:req.session.user });
    });


    /**
     * Reset password  - user enter details.
     *  - 'session.reset' stores the user details
     */
    app.post(cm.cfg('webserver:links:passwordReset'), function(req, res) {

        var newPass = req.param('password');
        if (typeof(req.session.reset) === 'undefined') {
            res.send('unable to update password', 500);
            cm.log.error('A password reset error occurred. req.session.user = ', req.session.user);
            return;
        }
        var email             = req.session.reset.email;
        var passwordResetCode = req.session.reset.passwordResetCode;

        /* destroy the session immediately after retrieving the stored email  */
        req.session.destroy();
        am.updatePassword(email, newPass, passwordResetCode, function(e, o){
            if (o){
                res.send('ok', 200);
            } else {
                res.send('unable to update password', 500);
            }
        });
    });

    /**
     * Link for activating account
     */
    app.get(cm.cfg('webserver:links:accountActivate'), function(req, res) {
        var email = req.query.e;

        if (typeof(email) !== 'undefined') {
            email = email.toLowerCase();
        }
        var code = req.query.c;

        if (email  &&  code) {
            am.activateAccount(email, code, function(err, userObj){
                if (err){
                    res.render('basicMessage', {
                        title: 'Server Error',
                        user: req.session.user,
                        msg: 'Something wicked happened:\n\n' + err + '\n\n<a = href="/">Click here to return home.</a>',
                        link: null
                  });
                } if (userObj === null) {
                    res.render('basicMessage', {
                        title: 'Account already activated',
                        user: req.session.user,
                        msg: 'You have already activated your account.',
                        link: null
                    });
                } else {
                    req.session.user = getSimpleSessionInfo(userObj);
                    res.render('basicMessage', { title: 'Account activation successful',
                                                 user:  req.session.user,
                                                 link: cm.cfg('webserver:links:accountLogin'),
                                                 msg: 'You are being automatically redirected to login screen.'});
                }
            });
        } else {
            res.send('Unable to activate account, or account already activated', 500);
        }

    });


    /**
     * Delete the account, as requested by user.
     */
    app.post(cm.cfg('webserver:links:accountDelete'), function(req, res){

        /* User needs to be logged in */
        if (!req.session.user) {
            res.send('record not found', 500);
            return;
        }

        am.deactivateAccount(req.session.user.userId, function(err){
            if (!err){
                req.session.destroy(function(err2) {
                    if (err2) {
                        cm.log.error('ERROR: ',err2);
                    }
                    res.send('ok', 200);
                });
            }    else{
                res.send('record not found', 500);
            }
        });
    });


    /*************************************************************************************
     *                                  Purchasing routes
     *************************************************************************************/

    var pricingData = cm.cfg('purchase:pricingData');
    app.get(cm.cfg('webserver:links:purchase'), function(req, res){
        res.render('purchase', { title: 'Purchase Data', user: req.session.user,  pricingData: pricingData});
    });

    /* User has selected the plan and payment method, this handles the POST to start the purchase process */
    var bitpay = require('../../common/bitpay');
    bitpay.init(am, cm);
    var paypal = require('../../common/paypal');
    paypal.init(am, cm);
    app.post(cm.cfg('webserver:links:purchase'), function(req, res) {

        /* User needs to be logged in */
        if (!req.session.user) {
            res.redirect(cm.cfg('webserver:links:accountLogin'));
            return;
        }

        var purchaseDetails = am.isValidPurchasePost(req);
        var paymentMethodFn;
        var paymentMethodStr;

        if (purchaseDetails && purchaseDetails.method) {

            paymentMethodStr = purchaseDetails.method.toLowerCase();

            switch (paymentMethodStr) {

                case 'bitcoin':
                    paymentMethodFn = bitpay;
                    break;

                case 'paypal':
                    paymentMethodFn = paypal;
                    break;

                default:
                    res.send('Ooops, something funky happened! (err101) "' + purchaseDetails.method + '"" is not a valid payment method', 404);
                    return;
            }

        } else {
            res.send('Ooops, something funky happened! (err102)', 404);
            return;
        }

        paymentMethodFn.createAndSendInvoice(purchaseDetails, function (err) {
            if (err) {
                res.send('Ooops, something funky happened! (err103)', 404);
            } else {

                am.savePurchase(purchaseDetails, function (err2, obj) {
                    if (err2) {
                        res.send('Ooops, something funky happened! (err104)', 404);
                    } else {

                        /* Save the payment Id to the session */
                        req.session.user.paymentId = purchaseDetails.paymentDetails.vendorPaymentId;

                        /* Then redirect the user to PayPal */
                        res.send({
                                vendorPaymentURL : purchaseDetails.paymentDetails.vendorPaymentURL,
                                method : paymentMethodStr
                            }, 200);
                    }
                });
            }
        });


    });


    app.get(cm.cfg('webserver:links:purchaseConfirmBitcoin'), function(req, res) {

        /* User needs to be logged in */
        if (!req.session.user) {
            res.redirect(cm.cfg('webserver:links:accountLogin'));
            return;
        }

        var vendorPaymentId  = req.query.vendorPaymentId;

        if (typeof(vendorPaymentId) === 'string') {
            var purchases = am.getPurchases();
            purchases.findPendingByVendorPaymentId(vendorPaymentId, function (err, purchase) {
                if (err || purchase === null) {
                    res.send('Unable to find that payment ID');
                    cm.log.error('ERROR: purchaseConfirmBitcoin/: Unable to find that payment ID', vendorPaymentId);
                } else {
                    res.render('purchaseConfirmBitcoin', {
                        vendorPaymentId : vendorPaymentId,
                        paymentDetailsPlan: purchase.name,
                        paymentDetailsBytesPurchasedHR: cm.bytesToSize(purchase.bytesPurchased, 1),
                        paymentDetailsValueUSDHR: '$' + cm.prettyNum(purchase.paymentDetails.valueUSD, 2),
                        paymentDetailsValueCurrencyHR: cm.prettyNum(purchase.paymentDetails.valueCurrency, 6),
                    });
                }
            });

        } else {
            render404(req, res);
        }

    });

    /*************************************************************************************
     *        BitPay Update Purchase Route - BitPay will use this to update payments
     *************************************************************************************/
    app.post(cm.cfg('payment:bitpay:notificationURL'), function(req, res) {

        bitpay.updateInvoiceState(req.body, function bitpayPOSTcallback(err, obj) {
            if (err) {
                cm.log.error('ERROR: bitpayPOSTcallback(): ', err);
                return;
            }
        });

        res.send('Ok', 200);

    });


    /*************************************************************************************
     *           PayPal Update Purchase Route - user gets sent here from paypal
     *************************************************************************************/
    app.get(cm.cfg('webserver:links:purchaseConfirmPaypal'), function(req, res) {

        var paypalPayerId = req.query.PayerID;
        var paymentId = req.session.user.paymentId;

        req.session.user.paymentId = undefined;

        paypal.completePayment(paypalPayerId, paymentId, function paypalConfirmCB(err, purchase) {
            if (err) {
                cm.log.error('ERROR: paypalConfirmCB(): ', err);
                res.render('basicMessage', { title: 'Error with purchase',
                                             user:  req.session.user,
                                             link: cm.cfg('webserver:links:accountDetails'),
                                             msg: 'There was an error processing your payment.  Please contact support@swirlvpn.com. ERROR: ' + err.response.message});

            } else {


                res.render('purchaseConfirmPaypal', {
                        vendorPaymentId : purchase.paymentDetails.vendorPaymentId,
                        paymentDetailsPlan: purchase.name,
                        paymentDetailsBytesPurchasedHR: cm.bytesToSize(purchase.bytesPurchased, 1),
                        paymentDetailsValueUSDHR: '$' + cm.prettyNum(purchase.paymentDetails.valueUSD, 2),
                        paymentDetailsValueCurrencyHR: cm.prettyNum(purchase.paymentDetails.valueCurrency, 6),
                    });
            }
        });

    });

    app.get(cm.cfg('webserver:links:purchaseCancelledPaypal'), function(req, res) {

        req.session.user.paymentId = undefined;
        res.render('basicMessage', { title: 'PayPal purchase cancelled',
                                     user:  req.session.user,
                                     link: cm.cfg('webserver:links:accountDetails'),
                                     msg: 'Your PayPal purchase was cancelled'});

    });


    /*************************************************************************************
     *                                     Admin stuff
     *
     * This is not the cleanest solution and breaks when there are many users.  These
     * routes allow access for the admin user to do things.  You need to be logged in
     * as the admin user to do these things.
     *************************************************************************************/

    app.get('/logger.js', function(req, res) {
        res.send('Ok', 401);

        cm.log.error('CLIENT ERROR: ', JSON.stringify(req.query, null, 4) );
    });


    var adminUserEmail = cm.cfg('db:userAccounts:adminEmail');
    app.get('/printUsers', function(req, res) {
        if (typeof(req.session.user) === 'undefined') {
            render404(req, res);
            return;
        }
        var email = req.session.user.email;
        if (typeof(email) !== 'undefined' && email === adminUserEmail) {
            am.getAllUsersForPrinting(function(err, userList) {
                if (err) {
                    res.send('an error occurred: ' + err);
                } else {
                    res.render('printUsers', { title: 'Admin - user list', user: req.session.user, userList: userList});
                }
            });
        } else {
            render404(req, res);
        }
    });

    /* Post here and get a specific user's details */
    app.get('/printUserDetails', function(req, res) {
        if (typeof(req.query.e) === 'undefined') {
            render404(req, res);
            return;
        }
        var userEmail = req.query.e.toLowerCase();
        var email = req.session.user.email;
        if (typeof(email) !== 'undefined' && email === adminUserEmail) {
            am.getOneUserForPrinting(userEmail, function(err, userDetails) {
                if (err) {
                    res.send('an error occurred: ' + err);
                } else {
                    res.render('printUserDetails', { title: 'Admin - user', user: req.session.user, userDetails: userDetails});
                }
            });
        } else {
            render404(req, res);
        }
    });

    /* Post here and get a specific user's details */
    app.get('/getStats', function(req, res) {
        if (typeof(req.session.user) === 'undefined') {
            render404(req, res);
            return;
        }
        var email = req.session.user.email;
        if (typeof(email) !== 'undefined' || email === adminUserEmail) {
            res.sendfile(cm.cfg('webserver:awstatsFile'));
        } else {
            render404(req, res);
        }
    });


    app.get('*', function(req, res) {
        render404(req, res);
    });

    function render404(req, res) {
        res.status(404);
        res.render('404', { title: 'Page Not Found', user: req.session.user});
    }
};


function getSimpleSessionInfo(userObj) {

    if (!userObj) {
        return null;
    } else {
        return {
            email  :   userObj.email,
            userId :   userObj.userId,
            isActive : userObj.isActive
        };
    }
}