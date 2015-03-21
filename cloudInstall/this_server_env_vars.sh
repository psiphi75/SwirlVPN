#!/bin/bash

# This file will be run on server start, it is unique to each server.  It will not be overwritten.
# CONFIG_TODO:  This needs to manually added to each server

export NODE_ENV=development
export VV_SERVER_TYPE="createOvpnConfig Webserver RegionalServer KeyGen MongoDB MasterWebservice"
#export VV_SERVER_TYPE="RegionalServer"
export VV_REGION="TEST"
