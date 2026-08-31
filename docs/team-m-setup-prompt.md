# ПРОМТ ДЛЯ КОМАНДЫ МАКА (M007) — настройка Cross-Team Sync

> 🗄️ **HISTORICAL (redirect 30.08):** этот док закрыт. Живая правда — `team-m/SHARED-REGISTRY.md §0`. Карта вердиктов — `team-m/DOC-SYNC-MAP-2026-08-30.md`.

> Скопируй этот текст и дай агенту на Маке (M007). Он поднимет свою часть синхрона
> в ЖИВОМ монтаже `~/beLive-pc` (который указывает на ПК-репозиторий).
> Важно: писать ТОЛЬКО в живой монтаж, иначе файлы не дойдут до ПК.

---

## Задача
Настроить со стороны Мака самодостаточный канал синхрона: Мак-агенты (дизайн/макеты/…)
по завершении задачи кидают MD-отчёт в общую папку, и сторона Windows (V, ПК) автоматически
видит «решение от Мака готово» через файл `team-m/INBOX.md`.

## Фундамент на ПК уже есть (проверено)
На ПК: репозиторий — git ✅, `docs/SYNC-PROTOCOL.md` ✅, хук `update-repo-state.sh` ✅ (работает).
Ранний ложный негатив «ничего нет» был потому, что монтаж `~/beLive-pc` был не поднят.
=> **Сначала убедись, что монтаж ЖИВОЙ.**

## Шаг 0 — проверь живой монтаж
```
cd ~/beLive-pc
git rev-parse --is-inside-work-tree   # должно быть: true
ls docs/SYNC-PROTOCOL.md              # должен быть виден
```
Если НЕ видно — смонтируй заново (`sshfs bepc:/home/nikit/projects/beLive ~/beLive-pc ...`)
и повтори. БЕЗ живого монтажа дальше не продолжай.

## Шаг 1 — структура
```
mkdir -p team-m/scripts team-m/reports
touch team-m/reports/.gitkeep
```

## Шаг 2 — скрипт `team-m/scripts/mac-report.sh`
```bash
#!/usr/bin/env bash
# mac-report.sh <agent> <task> [status]
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

## Следующие шаги
<!-- что нужно от V-стороны / блокеры -->
EOF
echo "created: $FILE"
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" add "$FILE"
  git -C "$ROOT" commit -m "mac($AGENT): report $TASK ($STATUS)" >/dev/null && echo "committed"
fi
"$ROOT/team-m/scripts/mac-state.sh"
```
```
chmod +x team-m/scripts/mac-report.sh
```

## Шаг 3 — скрипт `team-m/scripts/mac-state.sh`
```bash
#!/usr/bin/env bash
# mac-state.sh — пересобирает team-m/INBOX.md из всех отчётов team-m/reports/
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[ -d "$ROOT/.git" ] || ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
INBOX="$ROOT/team-m/INBOX.md"
REPORTS="$ROOT/team-m/reports"
mkdir -p "$REPORTS"
{
  echo "# Mac Team — INBOX (авто, не редактировать вручную)"
  echo ""
  echo "_Обновлено: $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
  echo ""
  echo "| agent | task | status | updated |"
  echo "|--------|------|--------|---------|"
  count=0
  while IFS= read -r -d '' f; do
    a="$(grep -m1 '^agent:' "$f" | sed 's/^agent:[[:space:]]*//')"
    t="$(grep -m1 '^task:' "$f" | sed 's/^task:[[:space:]]*//')"
    s="$(grep -m1 '^status:' "$f" | sed 's/^status:[[:space:]]*//')"
    u="$(grep -m1 '^updated:' "$f" | sed 's/^updated:[[:space:]]*//')"
    echo "| $a | $t | $s | $u |"
    count=$((count+1))
  done < <(find "$REPORTS" -name '*.md' -print0)
  echo ""
  echo "_Всего отчётов: $count_"
} > "$INBOX"
echo "INBOX updated: $INBOX ($count reports)"
```
```
chmod +x team-m/scripts/mac-state.sh
```

## Шаг 4 — `team-m/SYNC-HANDOFF.md` (заметка для V)
```
# Sync Handoff (Mac → Windows)
- Мак пишет отчёты в team-m/reports/<agent>/<task>.md (фронтматтер: agent/task/status/updated).
- После каждого отчёта запускается mac-state.sh → обновляет team-m/INBOX.md.
- V-сторона (ПК) читает team-m/INBOX.md по sshfs и видит готовые решения Мака.
- НЕ трогать root REPO-STATE.md (его ведёт ПК-хук) — триггер живёт в team-m/INBOX.md.
```

## Шаг 5 — конвенция отчёта (фронтматтер ОБЯЗАТЕЛЬНО)
```
---
agent: design-agent
task: hero-section
status: done | wip | blocked
updated: 2026-08-24T12:00:00+00:00
---
```

## Шаг 6 — тест-демонстрация (докажи, что канал работает)
```
cd ~/beLive-pc
./team-m/scripts/mac-report.sh design-agent sample-task done
./team-m/scripts/mac-state.sh
cat team-m/INBOX.md      # должен показать строку про design-agent / sample-task
```
Затем на ПК (Windows) Никита открывает `team-m/INBOX.md` (виден по монтажу) → видит
«Mac: design-agent / sample-task — done». Канал замкнут. Можно коммитить папку team-m/.

## ⚠️ Frozen Zone — НЕ ТРОГАТЬ
`src/audio/core/AudioEngineV2.ts`, `src/audio/compat/patchV1.ts`, `src/bridges/*`,
`src/services/track.orchestrator.ts`, приватные поля `_`. Пиши ТОЛЬКО в `team-m/` и `docs/`.

## Что дальше
- Мак-агенты (design/layout) по завершении задачи вызывают `mac-report.sh` → отчёт + INBOX обновлён.
- V (ПК) видит INBOX.md мгновенно через монтаж.
- Layer-2 (звук/аватар-нотификация) — отдельный раунд, не сейчас.
