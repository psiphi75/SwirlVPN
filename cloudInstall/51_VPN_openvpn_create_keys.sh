
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
# Now we need to make the keys
#
################################################################################

# CONFIG_TODO: This script helps you build all the certs and keys for OpenVPN.
#              You need to read the comments and manually do some stuff.
#
# Certificates:
# Private keys:
# If you've created the certificates on the server, it's a good idea to encrypt
# it or move it off the server. In any case, do not lose the:
#  - ca.key: others will be able to connect to your server.
#  - server.key: MITM (Man In The Middle) is possible.
#
# Client certs:
#  - ca.crt: for verifying the certificates
#  - server.crt: for verifying the server and communicating with it
#  - ta.key: for hardening the security
#  - you.crt: to identify yourself with the server
#  - you.key: it's like your password, file permissions should be 400 (read-only for owner)
#
# Filename        Needed By                   Purpose                     Secret
# --------        ---------                   -------                     ------
# ca.crt          server + all clients        Root CA certificate         NO
# ca.key          key signing machine only    Root CA key                 YES
# dh{n}.pem       server only                 Diffie Hellman parameters   NO
# server.crt      server only                 Server Certificate          NO
# server.key      server only                 Server Key                  YES
# client1.crt     client1 only                Client1 Certificate         NO
# client1.key     client1 only                Client1 Key                 YES
# client2.crt     client2 only                Client2 Certificate         NO
# client2.key     client2 only                Client2 Key                 YES
# client3.crt     client3 only                Client3 Certificate         NO
# client3.key     client3 only                Client3 Key                 YES

#
# Steps are as follows.
#

############ Step 1) copy the files locally ##################
# >$ cd Projects/VPNing/ssl/
# >$ mkdir keygen
# >$ cd keygen
# >$ cp -r /usr/share/doc/openvpn/examples/easy-rsa/2.0/* .
# >$ ln -s openssl-1.0.0.cnf openssl.cnf
# >$ gedit vars  ==> update all the settings to match our config


############ Step 2) Build the server keys ##################
# Build the server keys
source vars
./clean-all
./build-ca
./build-key-server server
./build-dh
openvpn --genkey --secret ta.key
mv ta.key ../KEY_DIR

#### Building client key not required
#### Build the client keys
###source vars
###./build-key client
###


############ Step 3) Copy the files to distribution folder ##################
# >$ TRGDIR=~/VPNing/app_config/etc/openvpn/
# >$ cp keys/server.crt     $TRGDIR/server.crt_TEST
# >$ cp keys/server.key     $TRGDIR/server.key_TEST
# >$ cp keygen/ta.key       $TRGDIR/ta.key_TEST
# >$ cp keys/dh1024.pem     $TRGDIR/dh1024.pem_TEST
# >$ cp keys/ca.crt         $TRGDIR/ca.crt_TEST
cp keys/server.crt     $TRGDIR/server.crt_TEST
cp keys/server.key     $TRGDIR/server.key_TEST
cp keygen/ta.key       $TRGDIR/ta.key_TEST
cp keys/dh1024.pem     $TRGDIR/dh1024.pem_TEST
cp keys/ca.crt         $TRGDIR/ca.crt_TEST



