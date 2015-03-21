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
#                      Install and configure master server
#
#############################################################################

source 00_Common.sh

#############################################################################
#
# Setup AWStats.  AWStats is a logger for your web traffic.  But Google Analytics
# is much better and free.
#
#############################################################################
AWSTATS_FILEDIR="$COMMON_LOG_DIR/awstats"
AWSTATS_CONF="/etc/awstats/awstats.www.swirlvpn.com.conf"
AWSTATS_OUTPUT=$AWSTATS_FILEDIR/awstats.html
# CONFIG_TODO: Need to manually add the next bash line as a cronjob
# NOTE: to edit cron job use "sudo crontab -u ubuntu -e"
AWSTATS_CMD="/usr/bin/perl /usr/bin/awstats -config=$VV_DOMAIN_WWW -update -output -staticlinks > $AWSTATS_OUTPUT"
AWSTATS_CRON_CMD="*/5 * * * * $AWSTATS_CMD"


if [ "$V_INSTALL" == "Y" ]
then

    apt-get update

    AptInstall mongodb-server
    InstallConfFile /etc/mongodb.conf

    # Install AWStats
    AptInstall awstats
    mkdir $AWSTATS_FILEDIR
    chmod a+rw $AWSTATS_FILEDIR

fi


if [ "$V_CONFIGURE" == "Y" ]
then

    InstallConfFile $AWSTATS_CONF
    InstallConfFile $CRON_D_EMPTY_FILE
    echo "$AWSTATS_CRON_CMD"  >  $CRON_D_EMPTY_FILE

fi


if [ "$V_STOP" == "Y" ]
then
    service mongodb stop
fi

if [ "$V_START" == "Y" ]
then

    service mongodb start
fi

