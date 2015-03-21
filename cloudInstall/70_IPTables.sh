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
# Start the IP Tables.  The is key for routing traffic to Ziproxy and to the
# Internet for clients.
#
################################################################################

source 00_Common.sh

I="iptables -A INPUT"
O="iptables -A OUTPUT"
F="iptables -A FORWARD"
NAT_PRE="iptables -t nat -A PREROUTING"
NAT="iptables -t nat -A POSTROUTING"

I6="ip6tables -A INPUT"
O6="ip6tables -A OUTPUT"
F6="ip6tables -A FORWARD"

# What port to listen for TCP pings
TCP_PING_PORT=443

function stop_iptables {

    # Clear the tables
    iptables -F
    iptables -F -t nat
    iptables -X
    iptables -Z

}

function start_iptables {

    # Allow SSH
    $I --protocol tcp --dport 22 --jump ACCEPT

    # Route port TCP 80 through proxy, rest (see later) get routed directly to internet
    $NAT_PRE -i ${DEV}+ -m tcp -p tcp --dport 80 -j REDIRECT --to-ports $ZIPROXY_PORT

    # All other traffic (not port 80) needs to be routed to internet
    $NAT -s 10.8.0.0/16 -o eth0 -j MASQUERADE

    # Drop all SMTP traffic - reduce SPAM
    $O -s 10.8.0.0/16 -p tcp --dport 25 -j DROP

    # For webserver redirect ports to 80/443, means we can run things as non-root.
    if [[ "$VV_SERVER_TYPE" == *Webserver* ]]; then
        if [ "$NODE_ENV" == "development" ]; then
            # Development: For trying to access on webserver on local host (i.e. the development environment)
            iptables -t nat -A OUTPUT -p tcp -d 127.0.0.1 --dport 80 -j REDIRECT --to-ports 8888
            iptables -t nat -A OUTPUT -p tcp -d 127.0.0.1 --dport 443 -j REDIRECT --to-ports 8889
        else
            # Production: For accessing the webserver on from the web (production)
            $NAT_PRE -i eth0 -p tcp --dport 80 -j REDIRECT --to-port 8888
            $NAT_PRE -i eth0 -p tcp --dport 443 -j REDIRECT --to-port 8889

            # Route those connected to CH VPN server directly to webserver
            $NAT_PRE -i ${DEV}+ -p tcp -d ${WEBSITE_IP} --dport 443 -j REDIRECT --to-port 8889
        fi
    fi

    # OpenVPN: All UDP traffice to 443 will be redirected to port 1194 (Default OpenVPN port)
    $NAT_PRE -i eth0 -p udp --dport 443 -j REDIRECT --to-port 1194


    # Enable port forwarding
    echo 1 > /proc/sys/net/ipv4/ip_forward

}

if [ "$V_CONFIGURE" == "Y" ]
then

    stop_iptables

    start_iptables

    # Save the iptables for reuse during next boot.
    iptables-save > $IPTABLES_SAVE_FILE

    # Install the config file for iptables such that it is available at boot.
    InstallInitScript $IPTABLES_INIT_SCRIPT

fi


if [ "$V_STOP" == "Y" ]
then
    stop_iptables
fi


if [ "$V_START" == "Y" ]
then
    stop_iptables
    start_iptables
fi

# Show the iptables to the end user.
iptables -nL -t nat
