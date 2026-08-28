#!/usr/bin/env bash
# mac-report.sh <agent> <task> [status]
# Мак-агент кидает MD-отчёт в drop-zone; V-сторона видит его через sshfs-монтаж.
set -euo pipefail
AGENT="${1:?usage: mac-report.sh <agent> <task> [status]}"
TASK="${2:?usage: mac-report.sh <agent> <task> [status]}"
STATUS="${3:-done}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[ -d "$ROOT/.git" ] || ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
REPORT_DIR="$ROOT/team-m/reports/$AGENT"
mkdir -p "$REPORT_DIR"
FILE="$REPORT_DIR/$TASK.md"
TS="$(date -u +%Y-%m-%dT%H:%M:%S+00:00)"
[ -f "$FILE" ] && { echo "already exists: $FILE"; exit 0; }
cat > "$FILE" <<EOF
---
agent: $AGENT
task: $TASK
status: $STATUS
updated: $TS
---
## Что сделано
<!-- опиши результат, артефакты, ссылки на файлы в репозитории -->

## Что нужно от V007
<!-- что ожидаешь от Windows-стороны: ревью / применение / верификация -->

## Блокеры
<!-- нет / что мешает -->

## Текущий статус
<!-- wip | done | blocked + краткий контекст -->
EOF
echo "created: $FILE"
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" add "$FILE"
  git -C "$ROOT" commit -m "mac($AGENT): report $TASK ($STATUS)" >/dev/null && echo "committed"
fi
"$ROOT/team-m/scripts/mac-state.sh"
