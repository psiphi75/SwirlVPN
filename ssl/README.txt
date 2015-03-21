
CONFIG_TODO:
Here you need to generate the security keys.  Read the OpenVPN documentation
on how to generate keys.

The following folders have different key requirements:

SwirlVPN/ssl/keygen-mongo-connection
    This contains generator for communication between the regional VPN servers
    and the master server.  This connection is up all the time.

SwirlVPN/ssl/keys-mongo-connection
    This contains the keys for the master server (master) and the regional
    servers (slave). These keys need to be copied to the OpenVPN folder.  The
    following files are required:
        ca.crt
        ca.key
        dh1024.pem
        ta.key
        master.crt
        master.csr
        master.key
        slave.crt
        slave.csr
        slave.key

SwirlVPN/ssl/keygen-swirlvpn-connection
    The SwirlVPN keygen server will use this directory to generate the keys for
    each user when they first create a user account.  This key then remains with
    the user to use.  The following keys need to be put into the appropriate
    OpenVPN config folder.
        ca.crt
        server.crt
        server.key
        dh1024.pem
        ta.key
    see SwirlVPN/cloudInstall/app_config/etc/openvpn/openvpn-server.conf_TEST



See also:
  SwirlVPN/cloudInstall/51_VPN_openvpn_create_keys.sh