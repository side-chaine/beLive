---
agent: mac-007
task: gates-g1-letter-v007
status: done
updated: 2026-08-25T10:30:00+00:00
---
# Гейты Packet-1: G1 закрыт Mac-side, письмо V007 отправлено

## Гейт 1 (002) — DONE (Mac-side)
`team-m/scripts/mac-state.sh`: после сборки INBOX добавлен синк
`mkdir -p public/team-m && cp team-m/INBOX.md → public/team-m/INBOX.md`.
**Copy, не symlink** — vite копирует `public/` в dist на билде; симлинк не переживёт билд и хрупок на sshfs.
Проверено прогоном: `public/team-m/INBOX.md` создан (см. SYNC-MAC-TO-HUB-2026-08-25g).
Остаток гейта 1 за V007: prebuild/dist-хук (package.json — зона Hub).

## Гейт 2 — уже в коде A3 (подтверждено 009)
catch→no-op last-known-good; `?raw` только первичный baseline.

## Гейт 3 — запрос к V007 (в письме g)
Ретро-ратификация §9 + коммит staged A3 (`notify-bridge.ts`, `notify.store.ts`, `character/index.ts`) + канон tsc 314 до стейка. Mac src/ сам не коммитит.

## Попутно вскрыто
Хэндоф заявлял D4 CoachPanel (стор+компонент+маунт App.tsx:253) — на диске НЕТ
(`coachPanel.store.ts` отсутствует, в App.tsx импорта/маунта нет). Вопрос V007:
потеря в тени или оверклейм? Пропозал готов (`proposal-coachpanel.md`), жду диспатч.
