#!/bin/bash
#
# Local HTTP server for beLive on port 5501 (copy for parallel run)
# To make it executable: chmod +x start-local-5501.command
# Then double-click in Finder or run from terminal.

LOG_FILE="/tmp/belive-http-5501.log"
PORT=5501

echo "Starting beLive local server on port $PORT. Logging to $LOG_FILE"
echo "----------------------------------------------------" > "$LOG_FILE"
date >> "$LOG_FILE"
echo "----------------------------------------------------" >> "$LOG_FILE"

# Check if Python is available
if command -v python3 &> /dev/null
then
    echo "Python 3 found. Starting server with python3 -m http.server $PORT" | tee -a "$LOG_FILE"
    (cd "$(dirname "$0")" && python3 -m http.server $PORT >> "$LOG_FILE" 2>&1 &)
elif command -v python &> /dev/null
then
    echo "Python 2 found. Starting server with python -m SimpleHTTPServer $PORT" | tee -a "$LOG_FILE"
    (cd "$(dirname "$0")" && python -m SimpleHTTPServer $PORT >> "$LOG_FILE" 2>&1 &)
else
    echo "Python not found. Attempting to use http-server (Node.js)." | tee -a "$LOG_FILE"
    if command -v http-server &> /dev/null
    then
        echo "http-server found. Starting server with http-server -p $PORT" | tee -a "$LOG_FILE"
        (cd "$(dirname "$0")" && http-server -p $PORT >> "$LOG_FILE" 2>&1 &)
    else
        echo "Error: Neither Python nor http-server found. Please install Python or Node.js (npm install -g http-server)." | tee -a "$LOG_FILE"
        read -p "Press any key to exit."
        exit 1
    fi
fi

SERVER_PID=$!
echo "Server started with PID: $SERVER_PID" | tee -a "$LOG_FILE"

# Wait a moment for the server to start
sleep 1

# Open the browser
BROWSER_URL="http://localhost:$PORT/index.html"
echo "Opening browser to $BROWSER_URL" | tee -a "$LOG_FILE"

if command -v open &> /dev/null; then
    open "$BROWSER_URL"
elif command -v xdg-open &> /dev/null; then
    xdg-open "$BROWSER_URL"
elif command -v start &> /dev/null; then
    start "$BROWSER_URL"
else
    echo "Could not open browser automatically. Please navigate to $BROWSER_URL" | tee -a "$LOG_FILE"
fi

echo "Local server is running. Close this terminal window to stop the server." | tee -a "$LOG_FILE"
wait $SERVER_PID
echo "Server stopped." | tee -a "$LOG_FILE"


