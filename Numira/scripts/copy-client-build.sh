#!/bin/bash
# Script to copy client build if it exists
mkdir -p /app/client/build
if [ -d "/tmp/client-build" ] && [ "$(ls -A /tmp/client-build)" ]; then
  cp -r /tmp/client-build/* /app/client/build/
  echo "Client build copied successfully"
else
  echo "No client build found, skipping"
fi
