CONFIG_TODO: Instructions for deploying a new server.  We use 'sg' as the
             example case.  Can use this to deploy a server in a new region or
             replace an existing server.

AWS:
    - Create Server
    - Create Security Group
    - Create Elastic IP

Boot the remote server:
    - need IP address
    - Make sure ports are open on (using AWS security groups)
    - Use an existing PEM file or create it.  For new regions:
        Add the pem file details to ~/.ssh
        chmod 600 $HOME/.ssh/sg_prod.pem

For new regions:
    - Add the 'sg' server to the ./propagate.sh file.
    - add 'sg' to ./cloudInstall/00_Common.sh to the "HOST_LIST" variable
    - add the server to the '/common/config.js' file.
        - server:regions
        - server:regionDescs
        - ovpnServer:servers
    - add the server to the '/monitoring' folder
    - add the server to the '/monitoring/checkOpenVPNisUp.sh' script
    - Add a DNS name record
    - Add the server to the 92_AptGetUpdate.sh script


Add the server details to the ./cloudInstall/server_list.txt

./propagate.sh ch


run cd ./cloudInstall; ./91_Provision_RegionalServer.sh sg SERVER_IP

# For monitoring server
run 82_AWS_CloudWatch.sh
