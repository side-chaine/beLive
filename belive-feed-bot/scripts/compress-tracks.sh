#!/bin/bash
# scripts/compress-tracks.sh
# Сжатие треков >50MB до 128kbps для Telegram Bot API (лимит 50MB)
#
# Использование:
#   chmod +x scripts/compress-tracks.sh
#   ./scripts/compress-tracks.sh ~/Desktop/Linkin\ Park/
#
# Зависимости: ffmpeg, zip
# Установка: brew install ffmpeg

TRACK_DIR="${1:-$HOME/Desktop/Linkin Park}"
TEMP_DIR="/tmp/belive-compress"
OUTPUT_DIR="$TRACK_DIR/compressed"

mkdir -p "$TEMP_DIR" "$OUTPUT_DIR"

echo "🔧 Сжатие треков >50MB до 128kbps"
echo "📁 Папка: $TRACK_DIR"
echo "📁 Выход: $OUTPUT_DIR"
echo ""

# Команда find для поиска ZIP >50MB
find "$TRACK_DIR" -name "*.zip" -type f -size +50M | while read zipfile; do
    basename=$(basename "$zipfile")
    name="${basename%.zip}"
    size=$(stat -f%z "$zipfile" 2>/dev/null || stat -c%s "$zipfile" 2>/dev/null)
    sizeMB=$(echo "scale=1; $size/1048576" | bc)
    
    echo "📦 $basename ($sizeMB MB)..."
    
    # Распаковка
    unzip -o -q "$zipfile" -d "$TEMP_DIR/$name" 2>/dev/null
    
    # Сжатие каждого MP3
    for mp3 in "$TEMP_DIR/$name"/*.mp3; do
        if [ -f "$mp3" ]; then
            mp3name=$(basename "$mp3")
            ffmpeg -y -i "$mp3" -b:a 128k -map a:0 "$TEMP_DIR/${name}_compressed.mp3" 2>/dev/null
            mv -f "$TEMP_DIR/${name}_compressed.mp3" "$mp3"
        fi
    done
    
    # Запаковка
    cd "$TEMP_DIR/$name"
    zip -q -j "$OUTPUT_DIR/$basename" *.mp3
    cd "$OLDPWD"
    
    newSize=$(stat -f%z "$OUTPUT_DIR/$basename" 2>/dev/null || stat -c%s "$OUTPUT_DIR/$basename" 2>/dev/null)
    newSizeMB=$(echo "scale=1; $newSize/1048576" | bc)
    
    echo "   ✅ $basename → $newSizeMB MB"
    echo ""
    
    # Очистка
    rm -rf "$TEMP_DIR/$name" "$TEMP_DIR/${name}_compressed.mp3"
done

# Итог
echo "═"
echo "📊 ГОТОВО:"
ls -lh "$OUTPUT_DIR"/*.zip 2>/dev/null | awk '{print "   " $5 " " $NF}' || echo "   (нет файлов)"
echo ""
echo "📌 Теперь загрузи сжатые файлы:"
echo "   npx tsx scripts/bulk-upload.ts \"$OUTPUT_DIR\""
