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
# Install and configure ziproxy
#
#############################################################################

source 00_Common.sh


if [ "$V_INSTALL" == "Y" ]
then

    AptInstall ziproxy

    mkdir --parent $ZIPROXY_LOG_DIR
    chown ziproxy.ziproxy $ZIPROXY_LOG_DIR
    chmod a+rx $ZIPROXY_LOG_DIR

fi


if [ "$V_CONFIGURE" == "Y" ]
then

    InstallConfFile $ZIPROXY_CONF

fi

if [ "$V_STOP" == "Y" ]
then
    /etc/init.d/ziproxy stop
    # wait for ziproxy to actually shut down
    sleep 1
fi

if [ "$V_START" == "Y" ]
then

    # restart ziproxy
    /etc/init.d/ziproxy start

fi
