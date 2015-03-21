# SwirlVPN

SwirlVPN is a VPN service optimised for Mobile Phones.  This source code
repository contains the source for creating such a service.  It includes:
 - Web Server: a web server with user account creation/managment.
 - Regional Server: a VPN server that runs a remote VPN node, there can be many
                    of these running, this is to where the users connect their
                    VPN sessions to.
 - Master Server: a master server that Regional Servers communicate with to
                  authorise users

The technology is built using:
 - Node.JS as the primary server platform.  Node relies on:
    - ExpressJS - using Jade
    - Mongoose (for MongoDB connectivity)
 - MongoDB as the database
 - OpenVPN as the VPN technology


## Configuration

The configuration is mostly in the "./common/config.js" folder.  If there
are any other configuration options, these can be found by searching for
"CONFIG_TODO".

## Overview of setup

The diagram below shows how SwirlVPN looks when it is setup.  The IP range
10.8.0.* marks the internal network of the SwirlVPN servers, client traffic
does not move through this network, it is only for server-to-server comms.
The 10.10.0.* network range is what the VPN clients get assigned when they
connect.


![Image of SwirlVPN configuration](https://github.com/psiphi75/SwirlVPN/doc/SwirlVPN.png)


## License
SwirlVPN is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

SwirlVPN is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with SwirlVPN.  If not, see <http://www.gnu.org/licenses/>.

