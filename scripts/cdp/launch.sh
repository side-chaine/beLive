#!/bin/bash
# beLive — запуск видимого Windows Chrome с CDP (remote-debugging) для браузерного тестирования
# Использование: ./launch.sh [port] [url]
set -e
PORT="${1:-9222}"
URL="${2:-http://localhost:3000/beLive/}"
PROFILE="C:\\Users\\nikit\\AppData\\Local\\Temp\\chrome-belive-cdp"

CHROME="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
[ -f "$CHROME" ] || CHROME="/mnt/c/Users/nikit/AppData/Local/Google/Chrome/Application/chrome.exe"
[ -f "$CHROME" ] || { echo "Chrome не найден"; exit 1; }

# Убить старый тестовый Chrome, если слушает порт
PID=$(netstat.exe -ano 2>/dev/null | tr -d '\0' | strings | grep ":$PORT " | grep LISTENING | awk '{print $NF}' | head -1)
[ -n "$PID" ] && taskkill.exe /F /PID "$PID" >/dev/null 2>&1 && echo "Убил старый Chrome (PID $PID)"
sleep 2

echo "Запускаю Chrome: CDP :$PORT | профиль $PROFILE"
nohup "$CHROME" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE" \
  --window-size=1500,950 \
  --no-first-run --no-default-browser-check \
  "$URL" > /tmp/opencode/chrome-cdp.log 2>&1 &

echo "Chrome PID: $!"
sleep 8
echo "CDP готов: http://127.0.0.1:$PORT"
