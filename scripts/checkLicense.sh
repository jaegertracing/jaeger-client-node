#!/bin/bash
LICENSE="Licensed under the Apache License"

results=`grep -L -r --include \*.js --exclude-dir node_modules --exclude-dir dist "$LICENSE" ./`
if [ ${#results} -eq 0 ]; then
	echo "No missing headers"
else
	echo "License headers are required in the following files:"
	echo "$results"
	exit 1
fi
