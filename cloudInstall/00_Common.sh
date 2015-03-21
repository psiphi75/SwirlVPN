#!/bin/bash -u

###############################################################################
#
#    SwirlVPN is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    SwirlVPN is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with SwirlVPN.  If not, see <http://www.gnu.org/licenses/>.
#
###############################################################################

###############################################################################
#
# Common requirements and setting up the environement variables.
#
###############################################################################

# CONFIG_TODO: This is the main script configuration file and many config options
#              are here.

# CONFIG_TODO: Some of these script that call this file will SSH into the remote
#              server to install stuff.  You need SSH .PEM configured and working
#              such that this can work successfully.  Once you have the PEM file
#              in place you can use a command like:
#              >  ssh au_prod
#              and you will connect to the 'au_prod' server without needing a
#              password.

# CONFIG_TODO:
PROJECT_NAME="SwirlVPN"
PROJECT_DIR=`pwd | grep -oh ".*${PROJECT_NAME}"`
SOURCE_DIR=${PROJECT_DIR}/cloudInstall

# CONFIG_TODO: Set the domain.
VV_DOMAIN="swirlvpn.com"
VV_DOMAIN_WWW="www.${VV_DOMAIN}"

# CONFIG_TODO: The IP of the website.  Requried for IP tables.
WEBSITE_IP="123.123.123.123"

# The 'this_server_env_vars.sh' file contains all the variable for this server
THIS_SERVER_CMD_FILE="this_server_env_vars.sh"
THIS_SERVER_CMD=$SOURCE_DIR/$THIS_SERVER_CMD_FILE
if [ ! -e $THIS_SERVER_CMD ]; then
    echo "ERROR: $THIS_SERVER_CMD does not exist"
else
    source $THIS_SERVER_CMD
fi

# CONFIG_TODO: This list of hosts we can connect to e.g ch1.swirlvpn.com.
HOST_LIST=" au ch ca "

# Just keep this on TEST.  The point of this to the target install system.  It
# was supposed to install to different environements differently.  But found that
# it is just as easy to keep one environment type and manage change using git.
TARGET_APP=TEST
SRC_ROOT_DIR=$SOURCE_DIR/app_config
COMMON_LOG_DIR=/var/log/server

# Variables for ZIPROXY
ZIPROXY_CONF=/etc/ziproxy/ziproxy.conf
ZIPROXY_LOG_DIR=$COMMON_LOG_DIR/ziproxy
ZIPROXY_PORT=8080

# Variables for OpenVPN
OPENVPN_SH=./50_VPN_openvpn.sh
OPENVPN_CONF_DIR=/etc/openvpn

# CONFIG_TODO: Create all the directories and files.  The files are created using
#              standard OpenVPN way, by creating a Cert, Key, Diffy Helmann, etc.
#              See the file '51_VPN_openvpn_create_keys.sh'.  It contains a script
#              that is not easy to automate.
OPENVPN_KEYGEN_DIR=$OPENVPN_CONF_DIR/keygen-swirlvpn-connection
OPENVPN_KEY_DIR=$OPENVPN_CONF_DIR/keys-swirlvpn-connection
OPENVPN_INDEX_ATTR=$OPENVPN_KEY_DIR/index.txt.attr
OPENVPN_CERT_TA_KEY=$OPENVPN_KEY_DIR/ta.key
OPENVPN_CERT_CA_CRT=$OPENVPN_KEY_DIR/ca.crt
OPENVPN_CERT_CA_KEY=$OPENVPN_KEY_DIR/ca.key
OPENVPN_CERT_DH_PEM=$OPENVPN_KEY_DIR/dh1024.pem
OPENVPN_CERT_SERVER_CRT=$OPENVPN_KEY_DIR/server.crt
OPENVPN_CERT_SERVER_KEY=$OPENVPN_KEY_DIR/server.key

# CONFIG_TODO:  As above
OPENVPN_VPC_KEY_DIR=$OPENVPN_CONF_DIR/keys-vpc-connection
OPENVPN_VPC_CERT_TA_KEY=$OPENVPN_VPC_KEY_DIR/ta.key
OPENVPN_VPC_CERT_CA_CRT=$OPENVPN_VPC_KEY_DIR/ca.crt
OPENVPN_VPC_CERT_CA_KEY=$OPENVPN_VPC_KEY_DIR/ca.key
OPENVPN_VPC_CERT_DH_PEM=$OPENVPN_VPC_KEY_DIR/dh1024.pem
OPENVPN_VPC_CERT_MASTER_CRT=$OPENVPN_VPC_KEY_DIR/master.crt
OPENVPN_VPC_CERT_MASTER_KEY=$OPENVPN_VPC_KEY_DIR/master.key
OPENVPN_VPC_CERT_SLAVE_CRT=$OPENVPN_VPC_KEY_DIR/slave.crt
OPENVPN_VPC_CERT_SLAVE_KEY=$OPENVPN_VPC_KEY_DIR/slave.key

OPENVPN_SERVER_CONF=$OPENVPN_CONF_DIR/openvpn-server.conf
OPENVPN_VPC_MASTER_CONF=$OPENVPN_CONF_DIR/openvpn-vpc-master.conf
OPENVPN_VPC_SLAVE_CONF=$OPENVPN_CONF_DIR/openvpn-vpc-slave.conf

OPENVPN_SCRIPT_DIR=$OPENVPN_CONF_DIR/scripts
OPENVPN_SCRIPT_AUTH=ovpn.sh

# CONFIG_TODO: Create this file, read the instructions in the file for the details.
OPENVPN_MGMT_PW_FILE=$OPENVPN_CONF_DIR/mgmnt-pw-file
OPENVPN_LOG_DIR=$COMMON_LOG_DIR/openvpn
OPENVPN_LOG_STATUS=$OPENVPN_LOG_DIR/status.log

# VPN network device, 'tun' or 'tap'
DEV=tun

# Startup Script
BOOT_SCRIPT=/etc/rc.local

# iptables stuff
IPTABLES_SAVE_FILE=/etc/iptables.rules
INIT_SCRIPT_DIR=/etc/init.d
IPTABLES_INIT_SCRIPT=iptablesload.sh

CRON_D_EMPTY_FILE="/var/spool/cron/crontabs/ubuntu"

# Rsyslog files
SYSLOG_BASE_CONF="/etc/rsyslog.conf"
SYSLOG_VV_LOGS_CONF="/etc/rsyslog.d/10-SwirlVPN-Logs.conf"
SYSLOG_MASTER_CONF="/etc/rsyslog.d/20-SwirlVPN-Master.conf"
SYSLOG_SLAVE_CONF="/etc/rsyslog.d/30-SwirlVPN-SendToMaster.conf"
SYSLOG_DEFAULT_CONF="/etc/rsyslog.d/50-default.conf"

# Check to see if we are in an AWS instance, then set up the VV variables
EC2_METADATA_EXEC='/usr/bin/ec2metadata'
if [ "$EC2_METADATA_EXEC" = "`which $EC2_METADATA_EXEC`" ];
then
    IS_AWS_EC2='Y'
    export VV_SERVER_UID=`$EC2_METADATA_EXEC --instance-id`
    export VV_PUB_IP=`    $EC2_METADATA_EXEC --public-ipv4`
    export VV_INT_IP=`    $EC2_METADATA_EXEC --local-ipv4`
    export VV_A_ZONE=`    $EC2_METADATA_EXEC --availability-zone`

    case $VV_A_ZONE in
    ap-northeast-1*)
        export VV_REGION="Tokyo"
        ;;
    ap-southeast-1*)
        export VV_REGION="Singapore"
        ;;
	ap-southeast-2*)
        export VV_REGION="Sydney"
        ;;
	eu-west-1*)
        export VV_REGION="Dublin"
        ;;
	sa-east-1*)
        export VV_REGION="Sao Paulo"
        ;;
	us-east-1*)
        export VV_REGION="Virginia"
        ;;
	us-west-1*)
        export VV_REGION="California"
        ;;
	us-west-2*)
        export VV_REGION="Oregon"
        ;;
    *)
        echo "Availibility zone not found"
    esac
else
    IS_AWS_EC2='N'
    export VV_SERVER_UID="NON_EC2_SERVER_$RANDOM$RANDOM$RANDOM"
    export VV_PUB_IP="127.0.0.1"
    export VV_INT_IP="127.0.0.1"
    export VV_REGION="Test"
fi


###############################################################################
#
# CheckSudo: Make sure we are root, otherwise exit.
#
###############################################################################
function CheckSudo {
    if [ "$(id -u)" != "0" ]; then
	    echo "ERROR (CheckSudo): You need logged in as root."  1>&2
	    exit -1
    fi
}

###############################################################################
#
# GetSourceFile:Get the directory of the source configuration file. This will
#               point to the PROD or TEST configuration files.  If the source
#               file does not exist, it will error and exit.
#       param1: The full path of the target (sic) configuration file.
#
###############################################################################
function GetSourceFile {

    local TRG_FILE=$1
    local VERSION=$2
    local SRC_FILE_1=$SRC_ROOT_DIR/${TRG_FILE}_${VERSION}
    local SRC_FILE_2=$SRC_ROOT_DIR/${TRG_FILE}

    if [ -e $SRC_FILE_1 ]
    then
        echo $SRC_FILE_1
    else
        # Fall back to a normally named file
        if [ -e $SRC_FILE_2 ]
	    then
	        echo $SRC_FILE_2
	    else
	        echo "ERROR (GetSourceFile): Expected source config file '$SRC_FILE' does not exist." 1>&2
	        exit -1
	    fi
    fi
}

###############################################################################
#
# InstallConfFile: Install the configuration file.
#          param1: the full path of the target configuration file.
#          param2: the file postfix modifier.
#
# TODO: We need to enable hooks in the config files to change some of the default
#       settings.  Like the closest DNS server.
###############################################################################
function InstallConfFile {

    CheckSudo

    # The first parameter is the target file.
    local TRG_FILE=$1

    # Check if we have 2 parameters
    if [ $# -eq 2 ]
    then
        local VERSION=$2
    else
        local VERSION=$TARGET_APP
    fi

    # We can then lookup the source file
    local SRC_FILE=`GetSourceFile $TRG_FILE $VERSION`

    # Check if the backup "ORIG" file exists, don't overwrite if it does
    local TRG_FILE_ORIG=${TRG_FILE}_ORIG
    if [ ! -e $TRG_FILE_ORIG ]
    then
        if [ -e $TRG_FILE ]
        then
            cp  $TRG_FILE  $TRG_FILE_ORIG
        fi
    fi

    # Check that the source configuration file exists
    # install the configuration file
    cp  --dereference  $SRC_FILE  $TRG_FILE
    if [ $? != 0 ]
    then
        echo "ERROR (InstallConfFile): Configuration file "$SRC_FILE" not installed"
        exit -1
    fi
    echo "Installed '$TRG_FILE'"
}


###############################################################################
#
# InstallInitScript: Install the script that should always been run on boot.
#     param: the full path of the script
#
###############################################################################
function InstallInitScript {

    CheckSudo

    local TRG_SCRIPT=$INIT_SCRIPT_DIR/$1

    InstallConfFile $TRG_SCRIPT
    chmod +x $TRG_SCRIPT

    # Just get the filename from the path
    TRG_SCRIPT_FILENAME=$(basename $TRG_SCRIPT)

    # Now register that the script should be run on startup
    update-rc.d $TRG_SCRIPT_FILENAME defaults 98 02
}


###############################################################################
#
# AptInstall: Install the given packages.
#     params: the list of packages to install.
#
###############################################################################
function AptInstall {

    CheckSudo

    apt-get -y install $@

    if [ $? -gt 0 ]; then
        echo "ERROR (AptInstall): apt-get failed install"  1>&2
    fi
}


###############################################################################
#
# startNodeServer: Start a node server using supervisor, such that when it
#                  crashes it automatically restarts.
#          params: $1 the name of the server.
#                  $2 (optional) the name of the directory.
#
###############################################################################

function startNodeServer {

    SERVER_NAME=$1
    SERVER_DIR=$2
    if [ -z $SERVER_DIR ]; then
        SERVER_DIR=$SERVER_NAME
    fi
    SERVER_LOG_FILE=$COMMON_LOG_DIR/$SERVER_NAME

    cd $PROJECT_DIR/$SERVER_DIR

    supervisor -q ${SERVER_NAME}.js &>> $SERVER_LOG_FILE &
    PID=$!
    echo "$SERVER_NAME started.  PID:$!"

    # Wait until the log is created
    #while [ ! -f $SERVER_LOG_FILE ]; do sleep 0.1; done

}

###############################################################################
#
# startNodeServerDebugger: Same as startNodeServer, but in debug mode
#          params: $1 the name of the server.
#                  $2 (optional) the name of the directory.
#
###############################################################################

function startNodeServerDebugger {

    SERVER_NAME=$1
    SERVER_DIR=$2
    if [ -z $SERVER_DIR ]; then
        SERVER_DIR=$SERVER_NAME
    fi
    SERVER_LOG_FILE=$COMMON_LOG_DIR/$SERVER_NAME

    cd $PROJECT_DIR/$SERVER_DIR

    node-debug -p 8123 ${SERVER_NAME}.js &
    PID=$!
    echo "$SERVER_NAME started.  PID:$!"

}


###############################################################################
#
# Check the arguments.  For each XZ_Module bash script you can use the
# following parameters:
#   V_INSTALL - install the module
#   V_CONFIGURE - (re)configure the module
#   V_START / V_STOP - If it is a server restart/start/stop the service
#
###############################################################################

V_INSTALL="N"
V_CONFIGURE="N"
V_STOP="N"
V_START="N"

# No Arguments is default, mean CONFIGURE, STOP and START
if [ $# -eq 0 ]
then
    V_CONFIGURE="Y"
    V_STOP="Y"
    V_START="Y"
fi

if [[ "$@" == *INSTALL* ]]
then
    V_INSTALL="Y"
fi

if [[ "$@" == *CONFIGURE* ]]
then
    V_CONFIGURE="Y"
    V_START="Y"
    V_STOP="Y"
fi

if [[ "$@" == *STOP* ]]
then
    V_STOP="Y"
fi

# This includes "RESTART"
if [[ "$@" == *START* ]]
then
    V_START="Y"
    V_STOP="Y"
fi

if [[ "$@" == *ALL* ]]
then
    V_INSTALL="Y"
    V_CONFIGURE="Y"
    V_START="Y"
    V_STOP="Y"
fi


###############################################################################
#
#                         Utilitly / Other functions
#
###############################################################################


function usage {
    echo '
Usage: 91_Provision_RegionalServer.sh [REGION] [SERVER]
where
    REGION: is the region e.g. au, ch, ca
    SERVER: is the server URL or IP address

'
}

function echoGreen {
    MSG=$1
    echoGreenFG
    echo $MSG
    echoWhiteFG
}
function echoRedFG {
    echo -en "\E[31m"
}
function echoWhiteFG {
    echo -en "\E[m"
}
function echoGreenFG {
    echo -en "\E[32m"
}



# Run a command or script on the remote server
function runRemoteCmd {

    CMD=$1

    case "$VENDOR" in
    AWS)
        ssh -o "StrictHostKeyChecking no" -i $PEM_FILE $REMOTE_USER@$SERVER "$CMD"
        ;;
    softronics)
        CMD_SSH="ssh $REMOTE_USER@$SERVER"
        ;;
    default)
        echo "Oops, didn't expect to get here"
        exit -1
        ;;
    esac
}

# Run a command or script on the remote server
function runRemoteCmd_simple {

    PEM_FILE=$1
    CMD=$2

    ssh $PEM_FILE "$CMD"

}