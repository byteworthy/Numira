#!/bin/sh
# wait-for-it.sh: Wait for services to be ready before starting the application
# Usage: ./wait-for-it.sh [options] host:port [-s] [-- command args]
# Options:
#   -h HOST | --host=HOST       Host or IP to check
#   -p PORT | --port=PORT       TCP port to check
#   -t TIMEOUT | --timeout=TIMEOUT  Timeout in seconds, zero for no timeout
#   -q | --quiet                Don't output any status messages
#   -s | --strict               Only execute subcommand if the test succeeds
#   -- COMMAND ARGS             Execute command with args after the test finishes

set -e

# Default values
TIMEOUT=15
QUIET=0
STRICT=0
HOSTS=""

# Process arguments
while [ $# -gt 0 ]
do
  case "$1" in
    *:* )
    HOST=$(printf "%s\n" "$1"| cut -d : -f 1)
    PORT=$(printf "%s\n" "$1"| cut -d : -f 2)
    HOSTS="$HOSTS $HOST:$PORT"
    shift 1
    ;;
    -q | --quiet)
    QUIET=1
    shift 1
    ;;
    -s | --strict)
    STRICT=1
    shift 1
    ;;
    -t)
    TIMEOUT="$2"
    if [ "$TIMEOUT" = "" ]; then break; fi
    shift 2
    ;;
    --timeout=*)
    TIMEOUT="${1#*=}"
    shift 1
    ;;
    --)
    shift
    CLI="$@"
    break
    ;;
    --help)
    usage
    ;;
    *)
    echo "Unknown argument: $1"
    usage
    exit 1
    ;;
  esac
done

# Check if any hosts were specified
if [ -z "$HOSTS" ]; then
  echo "Error: No hosts were specified."
  exit 1
fi

# Function to check if a host:port is available
wait_for() {
  HOST=$1
  PORT=$2
  
  if [ $QUIET -eq 0 ]; then
    echo "Waiting for $HOST:$PORT..."
  fi
  
  start_ts=$(date +%s)
  while :
  do
    nc -z $HOST $PORT >/dev/null 2>&1
    result=$?
    if [ $result -eq 0 ]; then
      if [ $QUIET -eq 0 ]; then
        echo "$HOST:$PORT is available"
      fi
      break
    fi
    
    current_ts=$(date +%s)
    elapsed_time=$((current_ts - start_ts))
    
    if [ $TIMEOUT -gt 0 ] && [ $elapsed_time -gt $TIMEOUT ]; then
      if [ $QUIET -eq 0 ]; then
        echo "Timeout occurred after waiting $TIMEOUT seconds for $HOST:$PORT"
      fi
      if [ $STRICT -eq 1 ]; then
        exit 1
      fi
      break
    fi
    
    sleep 1
  done
  
  return $result
}

# Wait for each host:port
for HOST_PORT in $HOSTS; do
  HOST=$(echo $HOST_PORT | cut -d: -f1)
  PORT=$(echo $HOST_PORT | cut -d: -f2)
  wait_for $HOST $PORT
done

# Execute the command if provided
if [ ! -z "$CLI" ]; then
  if [ $QUIET -eq 0 ]; then
    echo "Executing command: $CLI"
  fi
  exec $CLI
else
  if [ $QUIET -eq 0 ]; then
    echo "No command specified, exiting"
  fi
  exit 0
fi
