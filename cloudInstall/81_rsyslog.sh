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

#############################################################################
#
# Install and configure rsyslog
#
#############################################################################

source 00_Common.sh

if [ "$V_CONFIGURE" == "Y" ]
then

    rm /etc/rsyslog.d/*

    InstallConfFile $SYSLOG_BASE_CONF
    InstallConfFile $SYSLOG_VV_LOGS_CONF
    if [ "$VV_SERVER_TYPE" == "RegionalServer" ]; then
        InstallConfFile $SYSLOG_SLAVE_CONF
    else
        InstallConfFile $SYSLOG_MASTER_CONF
    fi
    InstallConfFile $SYSLOG_DEFAULT_CONF

    chmod a+r -R $COMMON_LOG_DIR/*

fi

if [ "$V_STOP" == "Y" ]
then
    service rsyslog stop
fi

if [ "$V_START" == "Y" ]
then
    service rsyslog start
fi
