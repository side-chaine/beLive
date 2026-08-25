#!/usr/bin/env bash
# mac-state.sh — пересобирает team-m/INBOX.md из всех отчётов team-m/reports/
# Гейт 1 (002): синк INBOX → public/team-m/INBOX.md (copy, НЕ symlink — vite
# копирует public/ в dist на билде; симлинк не переживёт билд/sshfs).
# Устойчив к отчётам БЕЗ фронтматтера (пустые поля вместо падения).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[ -d "$ROOT/.git" ] || ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
INBOX="$ROOT/team-m/INBOX.md"
REPORTS="$ROOT/team-m/reports"
mkdir -p "$REPORTS"
field() { grep -m1 "^$1:" "$1" 2>/dev/null | sed "s/^$1:[[:space:]]*//" || true; }
{
  echo "# Mac Team — INBOX (авто, не редактировать вручную)"
  echo ""
  echo "_Обновлено: $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
  echo ""
  echo "| agent | task | status | updated |"
  echo "|--------|------|--------|---------|"
  count=0
  while IFS= read -r -d '' f; do
    a="$(field agent "$f")"; t="$(field task "$f")"; s="$(field status "$f")"; u="$(field updated "$f")"
    [ -z "$a" ] && a="$(basename "$(dirname "$f")")"
    [ -z "$t" ] && t="$(basename "$f" .md)"
    [ -z "$s" ] && s="—"
    echo "| $a | $t | $s | $u |"
    count=$((count+1))
  done < <(find "$REPORTS" -name '*.md' -print0)
  echo ""
  echo "_Всего отчётов: $count"
} > "$INBOX"
PUBLIC_DIR="$ROOT/public/team-m"
mkdir -p "$PUBLIC_DIR" && cp "$INBOX" "$PUBLIC_DIR/INBOX.md"
echo "INBOX updated: $INBOX ($count reports)"
echo "Gate-1 sync: $PUBLIC_DIR/INBOX.md"
