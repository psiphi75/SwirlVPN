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
# Install and configure AWS CloudWatch.
#
#############################################################################

source 00_Common.sh

if [ "$V_INSTALL" == "Y" ]
then

	AptInstall python-pip
	pip install awscli

	#write out current crontab
	crontab -l > mycron

    CRONJOB="*/5 * * * * /bin/bash /home/ubuntu/SwirlVPN/monitoring/checkOpenVPNisUp.sh"

    # Check the entry does not exist and add it.
	if [ -z "`cat mycron | grep 'checkOpenVPNisUp'`" ]; then
    	echo "$CRONJOB" >> mycron
	else
        echo "CRON entry already exists, not adding a new one."
    fi

	#install new cron file
	crontab mycron
	rm mycron

fi
