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

################################################################################
#
# Setup openvpn - based on https://help.ubuntu.com/12.04/serverguide/openvpn.html,
# and mainly http://blog.it4me.se/?p=464
#
################################################################################

source 00_Common.sh


if [ "$V_INSTALL" == "Y" ]
then

    AptInstall openvpn openssl

    rm -rf $OPENVPN_CONF_DIR/*

    # This will create an openvpn conf file (of which none exists to start with)
    adduser --no-create-home --disabled-password --disabled-login --gecos "" openvpn

    # Create the folder for key generation
    mkdir $OPENVPN_KEY_DIR
    chown openvpn.openvpn $OPENVPN_KEY_DIR
    chmod 700 $OPENVPN_KEY_DIR

    # This file is installed such that we can create multiple certificates
    # with the same common name.
    mkdir --parent $OPENVPN_KEY_DIR
    InstallConfFile $OPENVPN_INDEX_ATTR

fi

################################################################################
#
# Now we need to install the keys
#
################################################################################
if [ "$V_CONFIGURE" == "Y" ]
then

    # make the log dir
    mkdir $OPENVPN_LOG_DIR
    chown openvpn.openvpn $OPENVPN_LOG_DIR
    chmod a+rx $OPENVPN_LOG_DIR

    # Create the status log and make it readable
    touch $OPENVPN_LOG_STATUS
    chmod a+r $OPENVPN_LOG_STATUS

    # Delete the old conf files
    rm $OPENVPN_CONF_DIR/*conf

    # install the config file
    InstallConfFile $OPENVPN_SERVER_CONF

    # install the keys - server
    InstallConfFile $OPENVPN_CERT_CA_CRT
    InstallConfFile $OPENVPN_CERT_DH_PEM
    InstallConfFile $OPENVPN_CERT_SERVER_CRT
    InstallConfFile $OPENVPN_CERT_SERVER_KEY
    InstallConfFile $OPENVPN_CERT_TA_KEY

    # Set up the user authentication script and make it executable.
    mkdir --parent $OPENVPN_SCRIPT_DIR
    InstallConfFile $OPENVPN_SCRIPT_DIR/$OPENVPN_SCRIPT_AUTH
    chmod u+x $OPENVPN_SCRIPT_DIR/$OPENVPN_SCRIPT_AUTH
    chown openvpn.openvpn $OPENVPN_SCRIPT_DIR/$OPENVPN_SCRIPT_AUTH

    # Install the password file
    InstallConfFile $OPENVPN_MGMT_PW_FILE

    # Install the VPC config files
    mkdir $OPENVPN_VPC_KEY_DIR
    if [ "$VV_SERVER_TYPE" == "RegionalServer" ]; then
        InstallConfFile $OPENVPN_VPC_SLAVE_CONF
    else
        InstallConfFile $OPENVPN_VPC_MASTER_CONF
    fi

    InstallConfFile $OPENVPN_VPC_CERT_CA_CRT
    InstallConfFile $OPENVPN_VPC_CERT_DH_PEM
    InstallConfFile $OPENVPN_VPC_CERT_MASTER_CRT
    InstallConfFile $OPENVPN_VPC_CERT_MASTER_KEY
    InstallConfFile $OPENVPN_VPC_CERT_SLAVE_CRT
    InstallConfFile $OPENVPN_VPC_CERT_SLAVE_KEY
    InstallConfFile $OPENVPN_VPC_CERT_TA_KEY

    # Make everything private
    chmod go-rw -R ${OPENVPN_CONF_DIR}/*
    chown openvpn.openvpn -R  ${OPENVPN_CONF_DIR}/*

fi

if [ "$V_STOP" == "Y" ]
then
    # Now we can start OpenVPN
    # CONFIG_TODO: test with 'ifconfig tun0' and there should be a network device present
    /etc/init.d/openvpn stop
fi

if [ "$V_START" == "Y" ]
then
    /etc/init.d/openvpn start
fi

################################################################################
#
# Test the setup
#
################################################################################

TEST_IF=`ifconfig ${DEV}0`
if [ $? -ne 0 ]
then
    echo "ERROR: expected net (tun0) device not found."
    exit -1
fi

ping -c 1 google.com &> /dev/null
if [ $? -ne 0 ]
then
    echo "ERROR: could not ping."
    exit -1
fi


