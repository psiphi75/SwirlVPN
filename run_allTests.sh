#!/bin/bash

################################################################################
# This script will run all the tests.  It is good for checking code changes
# before deploying.
################################################################################

source cloudInstall/00_Common.sh

NUM_FAILED_TESTS=0

# Set the server parameter to Testing
export VV_SERVER_TYPE="Testing"
export APP=$VV_SERVER_TYPE

#
# Function to run the test and print out the results.  If the test returns a
# non-zero value we have an error.  We keep a track of this.
#
function testIt {
    echo "********************************************************************************"
    echo "*********************************  $1  *****************************"
    echo "********************************************************************************"
    node ${1}.js
    RESULT=$?
 	let NUM_FAILED_TESTS=$NUM_FAILED_TESTS+$RESULT
}

echo "Starting tests..."
cd tests

testIt "testAccountManager"
testIt "testKeygen"
testIt "testRegionalServer"
testIt "testCountUser"

# Ignore SSL certificate errors on last test
NODE_TLS_REJECT_UNAUTHORIZED=0 testIt "testWebserver"

cd ..

if [ $NUM_FAILED_TESTS = 0 ]; then
	echo
	echo "     **** All tests passed ****"
	echo
else
	echo
	echo "     **** $NUM_FAILED_TESTS tests failed ****"
	echo
fi

exit $NUM_FAILED_TESTS