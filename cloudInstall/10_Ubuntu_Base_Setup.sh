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

###############################################################################
#
#                                 Update system
#
###############################################################################

source 00_Common.sh

if [ $V_INSTALL == "Y" ]
then

    apt-get update
    apt-get -y upgrade

    # Generate locales, this fixes some warning messages
    # CONFIG_TODO: May want to set this
    locale-gen en_NZ.UTF-8
    dpkg-reconfigure locales

    echo "Etc/UTC" | tee /etc/timezone
    dpkg-reconfigure --frontend noninteractive tzdata

    #
    # setup terminal
    #
    InstallConfFile $TERM_BASHRC


    mkdir $COMMON_LOG_DIR
    chmod a+rwx $COMMON_LOG_DIR

    #
    # Start the server on boot
    #
    InstallConfFile $BOOT_SCRIPT

fi
