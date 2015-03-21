#!/bin/bash

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

source 00_Common.sh

# These are the scripts that will be run on the server
SCRIPT_LIST=$( cat << EOF
    10_Ubuntu_Base_Setup.sh
    20_NodeJS.sh
    50_VPN_openvpn.sh
    60_Ziproxy_Setup.sh
    70_IPTables.sh
    81_rsyslog.sh
EOF
)


REMOTE_USER=ubuntu
REGION=$1
SERVER=$2

###############################################################################
##                               Do some checks
###############################################################################

# Check we have a PEM file
SSH_DIR=$HOME/.ssh
PEM_FILE="$SSH_DIR/${REGION}_prod.pem"
CORRECT_HOST=`echo "$HOST_LIST" | grep -oh "\ $REGION\ " | grep -oh "$REGION"`
if [ -z $CORRECT_HOST ]; then
    echo -e "\n\n*** ERROR: Make sure you have the correct REGION set ***\n"
    usage
    exit -1
fi

# Check the server is in the 'server_list.txt' and get the vendor
SERVER_LIST_FILE="server_list.txt"
SERVER_LINE=`grep "$REGION $SERVER" "$SERVER_LIST_FILE"`
if [ -z "$SERVER_LINE" ]; then
    echo -e "\n\n*** ERROR: Unable to find the server ($SERVER) in the server file ($SERVER_LIST_FILE) ***\n"
    exit -1
fi
VENDOR=`echo $SERVER_LINE | cut -d \  -f 3`


# Check we have a server and can ping it.
ping -c 1 -n -W 10 $SERVER &> /dev/null
PING_RESULT=$?
if [ $PING_RESULT != 0 ]; then
    echo -e "\n\n*** ERROR: Unable to ping the server ($SERVER), make sure you have the correct SERVER ***\n"
    usage
    exit -1
fi

# Check Scripts exists and are executable
for SCRIPT in $SCRIPT_LIST; do
    if [ ! -x $SCRIPT ]; then
        echo -e "\n\n*** ERROR: The script \"$SCRIPT\" is not found -or- it is not executable  ***\n"
        usage
        exit -1
    fi
done




###############################################################################
##                 Propagate the files to the remote server
###############################################################################

echoGreen "Propagating files
"
# Make the SwirlVPN directory on remote server
runRemoteCmd 'mkdir -p $HOME/SwirlVPN/cloudInstall'

# runRemoteCmd "echo '\#!/bin/bash'                               > \$HOME/$THIS_SERVER_CMD_FILE"
runRemoteCmd "echo 'export NODE_ENV=production'               >> \$HOME/$THIS_SERVER_CMD_FILE"
runRemoteCmd "echo 'export VV_SERVER_TYPE=\"RegionalServer\"' >> \$HOME/$THIS_SERVER_CMD_FILE"
runRemoteCmd "echo 'export VV_REGION=\"${REGION^^}1\"'        >> \$HOME/$THIS_SERVER_CMD_FILE"
runRemoteCmd "chmod 700    \$HOME/$THIS_SERVER_CMD_FILE"

cd $PROJECT_DIR
./propagate.sh $REGION $SERVER
cd $SOURCE_DIR


###############################################################################
##                 Now we run the INSTALL option for all scripts
###############################################################################

DEPLOY_STAGES="INSTALL CONFIGURE"

for STAGE in $DEPLOY_STAGES; do

    for SCRIPT in $SCRIPT_LIST; do

        echoGreen "Running $SCRIPT  $STAGE"
        runRemoteCmd "cd /home/ubuntu/SwirlVPN/cloudInstall;  sudo ./$SCRIPT  $STAGE"

    done

done


###############################################################################
##                               Start the server
###############################################################################

echoGreen "Starting server"
runRemoteCmd "NODE_ENV='production' VV_SERVER_TYPE='RegionalServer' ./start_server.sh"

runRemoteCmd "sudo reboot"

