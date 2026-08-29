#!/usr/bin/env bash
# generate-sri.sh — пересчёт SRI-хэшей для CDN-скриптов MediaPipe (ADR-0008).
#
# Зачем: SRI и закреплённая версия обязательны ВМЕСТЕ. Хэш считается от файла
# конкретной версии; обновил версию — пересчитай хэш, иначе браузер откажется
# грузить скрипт (и приложение упадёт, а не «просто без проверки»).
#
# Использование:
#   bash scripts/generate-sri.sh            # напечатать готовые теги
#   bash scripts/generate-sri.sh > /tmp/tags.html
#
# Требует: curl, node, сеть (registry.npmjs.org + cdn.jsdelivr.net).
set -euo pipefail

cd "$(dirname "$0")/.."

SPECS=(
  "camera_utils/camera_utils.js"
  "control_utils/control_utils.js"
  "drawing_utils/drawing_utils.js"
  "face_detection/face_detection.js"
  "face_mesh/face_mesh.js"
  "hands/hands.js"
  "pose/pose.js"
  "holistic/holistic.js"
  "selfie_segmentation/selfie_segmentation.js"
)

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail=0

for spec in "${SPECS[@]}"; do
  pkg="${spec%%/*}"
  file="${spec#*/}"

  # 1. Версия из npm-реестра
  ver="$(curl -sL -m 20 "https://registry.npmjs.org/@mediapipe/${pkg}/latest" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{process.stdout.write(JSON.parse(d).version||'')}catch(e){}})")"

  if [ -z "$ver" ]; then
    echo "SKIP  ${pkg}: версия недоступна" >&2
    fail=1
    continue
  fi

  url="https://cdn.jsdelivr.net/npm/@mediapipe/${pkg}@${ver}/${file}"

  # 2. Файл с закреплённой версией
  if ! curl -sfL -m 60 "$url" -o "${TMP}/${pkg}.js"; then
    echo "SKIP  ${pkg}: не скачался" >&2
    fail=1
    continue
  fi

  size="$(wc -c < "${TMP}/${pkg}.js" | tr -d ' ')"
  if [ "$size" -lt 1000 ]; then
    echo "SKIP  ${pkg}: подозрительно маленький файл (${size} байт)" >&2
    fail=1
    continue
  fi

  # 3. sha384 → base64
  hash="$(node -e "
    const c = require('crypto'), f = require('fs');
    process.stdout.write('sha384-' + c.createHash('sha384').update(f.readFileSync('${TMP}/${pkg}.js')).digest('base64'));
  ")"

  echo "OK    ${pkg}@${ver}  $(( size / 1024 )) KB" >&2
  echo "<script src=\"${url}\" integrity=\"${hash}\" crossorigin=\"anonymous\"></script>"
done

if [ "$fail" -ne 0 ]; then
  echo "" >&2
  echo "⚠️  Некоторые пакеты пропущены — не вставляйте результат в index.html," >&2
  echo "    пока все девять не будут OK." >&2
  exit 1
fi
