#!/bin/bash

#TODO: Make this more dynamic
#CONFIG_TODO: Set upt the IP here
PUBLIC_IP=123.123.123.123
PUBLIC_IP=localhost:8889
function get {
    URL=https://${PUBLIC_IP}$1
    curl -s -o /dev/null --insecure "$URL"
}

get /
get /faq
get /pricing
get /contact
get /account_update
get /account_details
get /signup
get /login
get /getOvpnConf
get /js/controllers/homeController.js
get /js/controllers/loginController.js
get /js/controllers/signupController.js
get /css/style.styl
get /js/form-validators/accountValidator.js
get /js/form-validators/contactValidator.js
get /js/form-validators/emailValidator.js
get /js/form-validators/loginValidator.js
get /js/form-validators/resetValidator.js
get /views/contact.js
get /views/home.js
get /views/login.js
get /views/reset.js
get /views/signup.js
get /vendor/css/bootstrap.min.css
get /vendor/js/bootstrap.min.js
get /vendor/js/jquery.min.js
get /vendor/js/jquery.form.js
get /vendor/fonts/ubuntu.woff

