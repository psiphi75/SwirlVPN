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
#                                Install NodeJS
#
#############################################################################

source 00_Common.sh

if [ "$V_INSTALL" == "Y" ]
then

    # Legacy provides sym link to "node"
    AptInstall nodejs-legacy npm

    # Supervisor is used to automagically restart node when it crashes
    npm install supervisor -g

fi


