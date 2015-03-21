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

################################################################################
#
# This is the core monitoring script.  It will connect via OpenVPN to a server
# and report all connections to AWS Cloud Watch.  If monitoring fails Cloud
# Watch will notice that no connection has been logged and trigger an alarm.
#
################################################################################

# Redirect stdout and stderr to the log files
THIS_SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
cd "$THIS_SCRIPT_DIR"
LOG=/var/log/server/checkOpenVPNisUp.log
exec >  >(tee -a $LOG)
exec 2> >(tee -a $LOG >&2)


# The number of attempts to try, when the value is 2, it attempts 2 tries.
ATTEMPTS=2

###############################################################################
#                           Get the secret keys
###############################################################################

# CONFIG_TODO: Add the AWS Secret Keys here

export AWS_ACCESS_KEY_ID="--- AWS ACCESS KEY ---"
export AWS_SECRET_ACCESS_KEY="--- AWS SECRET ACCESS KEY ----"
export AWS_DEFAULT_REGION="ap-southeast-2"

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

function setAWS_Metric_Value {

    SERVER=$1
    AWS_METRIC_VALUE=$2

    aws cloudwatch put-metric-data --namespace "OpenVPN Connection"             \
                                   --metric-name "$SERVER"                      \
                                   --unit None                                  \
                                   --value $AWS_METRIC_VALUE
}

###############################################################################
#             The function that tests the connection
#
# This will create an OpenVPN connection, if it does not connect within
# $TIMEOUT seconds, then it is considered a failure.  Success is determined
# when $OPENVPN_OK_TEXT is printed out.
###############################################################################

function checkConnection {

    SERVER=$1
    N=$2                # This counts the number of times we run this function
    OPENVPN_CMD="openvpn --config SwirlVPN-${SERVER}.ovpn"
    OPENVPN_OK_TEXT="Initialization Sequence Completed"
    TIMEOUT=15
	DATE=`date -u +"%Y-%m-%d %H:%M UTC"`

    OVPN_RESULT=`timeout $TIMEOUT $OPENVPN_CMD`
	RESULT=`echo "$OVPN_RESULT" | grep -oh "$OPENVPN_OK_TEXT"`


    if [ -z "$RESULT" ]; then
        echo "$DATE:ERROR (attempt $N): Unable to connect to OpenVPN server: ${SERVER}"
        echo "$OVPN_RESULT"

        if [ $N == 1 ]; then
            setAWS_Metric_Value $SERVER 0
        else
            let N=N-1
            checkConnection $SERVER $N
        fi
    else
        echo "$DATE:Success: Connected to ${SERVER}"
        setAWS_Metric_Value $SERVER 1
    fi

}


###############################################################################
#             The main server test loop
###############################################################################

# CONFIG_TODO: Change these to the list of server names you want to monitor
SERVER_LIST="Sydney Dublin California StGallen Singapore SaoPaulo Virginia"

for SERVER in $SERVER_LIST
do
    checkConnection $SERVER $ATTEMPTS &
    sleep 60
done

