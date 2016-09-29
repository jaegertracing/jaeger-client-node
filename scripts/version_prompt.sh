#!/bin/bash
read -p "Choose the number matching the version bump you want:
         1.) major
         2.) minor
         3.) patch
" -n 1 -r
echo    # (optional) move to a new line
if [[ $REPLY =~ ^[1]$ ]]; then
    echo "major"
elif [[ $REPLY =~ ^[2]$ ]]; then
    echo "minor"
elif [[ $REPLY =~ ^[3]$ ]]; then
    echo "patch"
else
    echo "$REPLY is not an option!"
fi
