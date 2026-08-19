#!/bin/bash
# beLive — импорт IDB (треки) из основного Chrome-профиля в тестовый CDP-профиль
# Использование: ./import-idb.sh [профиль] [origin]
set -e
PROFILE="${1:-C:\\Users\\nikit\\AppData\\Local\\Temp\\chrome-belive-cdp}"
ORIGIN="${2:-http_localhost_3000}"
SRC="/mnt/c/Users/nikit/AppData/Local/Google/Chrome/User Data/Default/IndexedDB"
DST_LINUX="/mnt/c/Users/nikit/AppData/Local/Temp/$(basename "${PROFILE//\\\\//}" | tr -d '\\')"

# Нормализуем Windows-профиль в Linux-путь
WIN_PROFILE="${PROFILE//\\//}"
DST="/mnt/c/$(echo "$WIN_PROFILE" | sed 's/^C://')/Default/IndexedDB"

echo "Импорт IDB $ORIGIN в профиль $PROFILE"
mkdir -p "$DST"
[ -d "$SRC/${ORIGIN}.indexeddb.leveldb" ] && cp -r "$SRC/${ORIGIN}.indexeddb.leveldb" "$DST/" || echo "нет leveldb для $ORIGIN"
[ -d "$SRC/${ORIGIN}.indexeddb.blob" ] && cp -r "$SRC/${ORIGIN}.indexeddb.blob" "$DST/" || echo "нет blob для $ORIGIN"
echo "Готово: $(du -sh "$DST" 2>/dev/null | awk '{print $1}') в $DST"
