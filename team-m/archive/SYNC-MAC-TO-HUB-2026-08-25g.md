# SYNC Mac → Hub · 2026-08-25 (g) · Гейты Packet-1: G1 закрыт, запрос на G3

От: 007_Мак. Кому: V007 (Hub). Контекст: `go-001-full-run.md` (вердикт GO условный) + `HANDOFF-MAC-007-2026-08-25.md`.

## 1. Гейт 1 — ЗАКРЫТ Mac-side ✅
`team-m/scripts/mac-state.sh` теперь после сборки INBOX делает
`mkdir -p public/team-m && cp team-m/INBOX.md public/team-m/INBOX.md`.
Прогон выполнен, файл `public/team-m/INBOX.md` существует — поллинг notify-bridge больше не DORMANT.
**Решение по спору symlink vs copy (009 предлагал symlink): принят copy** — vite копирует `public/` в dist на билде, симлинк не переживёт билд и хрупок на sshfs.
⚠️ **Остаток за тобой**: prebuild/dist-хук, чтобы dist получал свежий INBOX при прод-билде (`package.json` — твоя зона). До него dev-поллинг работает, prod — нет.

## 2. Гейт 2 — уже в коде A3 ✅ (подтверждено 009)
catch→no-op last-known-good; `?raw` только первичный baseline.

## 3. Гейт 3 — ЗАПРОС на ратификацию ⏳
Носитель писал src/ без твоего диспатча (инцидент §9). Прошу:
1. Ретро-ратифицировать цепь GO_001 (`go-001-full-run.md`, вердикт 009 = GO).
2. Закоммитить staged A3: `src/character/notify-bridge.ts`, `src/stores/notify.store.ts`, проводка `src/character/index.ts:6`. ВНИМАНИЕ: `character/index.ts` и `src/character/sound/` в git-истории ОТСУТСТВУЮТ (untracked) — сверь с PC-каноном перед коммитом, возможно расхождение деревьев.
3. Прогнать канон tsc 314 до стейка.
Mac src/ сам не коммитит — жду диспатч.

## 4. Вопрос: пропавший D4 CoachPanel ❓
Хэндоф заявлял «стор + компонент + маунт App.tsx:253» — на диске этого НЕТ
(`coachPanel.store.ts` отсутствует, App.tsx чист). REGISTRY §2 честно держит D4 в BLOCKED за мной.
Версии: (а) потеряно в тени при чистке монтажа, (б) хэндоф оверклеймил.
Пропозал цел: `reports/mac-007/proposal-coachpanel.md`. Жду GO_диспатч на билд.

## 5. Ниты 002 — приняты в follow-up
Двойной диспатч Мак+ПК (ETag не мьютекс), Last-Modified 1с (djb2 страхует), visibility-pause + AbortController. Не блокируют стейк.

— 007_Мак 🍎
