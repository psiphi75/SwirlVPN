#!/bin/bash

################################################################################
# This script will start all the services required for this type of server to
# run.  It will figure out what type of server it is supposed to be and load the
# appropriate services.
################################################################################

source cloudInstall/00_Common.sh
echo $VV_SERVER_TYPE

if [[ $1 == *DEBUG_WEBSERVER* ]]; then
    DEBUG_WEBSERVER="1"
    echoGreen "DEBUG_WEBSERVER enabled"
elif [[ $1 == *DEBUG_MASTERSERVER* ]]; then
    DEBUG_MASTERSERVER="1"
    echoGreen "DEBUG_MASTERSERVER enabled"
elif [[ $1 == *DEBUG_KEYGEN_SERVER* ]]; then
    DEBUG_KEYGEN_SERVER="1"
    echoGreen "DEBUG_KEYGEN_SERVER enabled"
elif [[ $1 == *DEBUG_REGIONALSERVER* ]]; then
    DEBUG_REGIONALSERVER="1"
    echoGreen "DEBUG_KEYGEN_SERVER enabled"
else
    DEBUG_WEBSERVER="0"
    DEBUG_REGIONALSERVER="0"
    DEBUG_MASTERSERVER="0"
    DEBUG_KEYGEN_SERVER="0"
fi

KEYGEN_WAIT_TIME=1

# FIXME: This is crude, should not require this, it would be covered by running
# as daemon.
if [ -n "`ps -A | grep node`" ]; then
    killall node

    if [ -n "`ps -A | grep nodejs`" ]; then
        killall nodejs
    fi
fi

# This is the mongo DB, we need to start the OpenVPN connection
if [[ $VV_SERVER_TYPE == *MongoDB* ]]; then
	if [ -z "`ps -A | grep mongod`" ]; then
	    echo "FATAL: MongoDB is not running"
	fi
fi


# Loads any new keys to the database
if [[ $VV_SERVER_TYPE == *createOvpnConfig* ]]; then
    echo "Running createOvpnConfig.js"
    cd $PROJECT_DIR/keygenServer
    APP="CreateOvpnConfig" node createOvpnConfig.js
fi


# The keygen server
if [[ $VV_SERVER_TYPE == *KeyGen* ]]; then
    echo "Starting keygen server"

    if [[ $DEBUG_KEYGEN_SERVER == 1 ]]; then
        APP="KeyGenServer" startNodeServerDebugger keygenServer
        KEYGEN_WAIT_TIME=10
    else
        APP="KeyGenServer" startNodeServer keygenServer
    fi
fi


# Start the regional server
if [[ $VV_SERVER_TYPE == *RegionalServer* ]]; then
    echo "Starting RegionalServer"

    if [[ $DEBUG_REGIONALSERVER == 1 ]]; then
        APP="RegionalServer" startNodeServerDebugger regionalServer
    else
        APP="RegionalServer" startNodeServer regionalServer
    fi
fi


# Start the master webservice server
if [[ $VV_SERVER_TYPE == *MasterWebservice* ]]; then
    echo "Starting MasterWebservice"

    if [[ $DEBUG_MASTERSERVER == 1 ]]; then
        APP="MasterWebservice" startNodeServerDebugger masterWebservice regionalServer
    else
        APP="MasterWebservice" startNodeServer masterWebservice regionalServer
    fi
fi


# Start the webserver
if [[ $VV_SERVER_TYPE == *Webserver* ]]; then
    echo "Starting webserver"

    # Wait a bit until the keygen server is up
    sleep $KEYGEN_WAIT_TIME

    # This function will call the web-server warmup script, it will warm up the
    # cache, at the same time pre-compiling the data.
    function warmUpWebserver {
        WAIT_TIME=3
        echo "Warming up webserver cache in $WAIT_TIME seconds"
        sleep $WAIT_TIME
        cd $PROJECT_DIR/tests
        ./testWebserverBasic.sh
    }
    # warmUpWebserver &

    # Now run the webserver
    if [[ $DEBUG_WEBSERVER == "1" ]]; then
        APP="Webserver" startNodeServerDebugger webserver
    else
        APP="Webserver" startNodeServer webserver
    fi

    sleep 2
fi

sleep 2
