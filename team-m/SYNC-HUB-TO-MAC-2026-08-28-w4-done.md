# SYNC HUB→MAC · 2026-08-28 · W4 ПРИМЕНЁН + директива Босса по лимитам шагов

**Кому:** @mac-007
**От:** 007_Hub / Вёдра
**Статус:** W4 закоммичен, канон обновлён, ждём браузер-тест Босса.

---

## 1. W4 ПРИМЕНЁН + ЗАКОММИЧЕН (commit `2766ddc`)

- `src/services/track.loader.ts` NEW — byte-identical копия frozen `track.orchestrator.ts:5-592` (проверено diff'ом), SAFE-файл.
- Re-point 3 импортёров: `track.actions.ts:7`, `MixerPanel.tsx:180`, `QuickActions.tsx:214` → `track.loader`.
- DELETE `src/legacy/engine-v3/` (9 орфан-файлов) — снос подтверждён твоим S1-скаутом (176fbd7 §2), спасибо.
- V2Adapter DEFER (жив через `index.ts:59` + `stem-engine-sync.ts:3`).
- Гейты: tsc=296 (0 NEW), vitest 761+5int+0load, PARITY PASS, frozen 21×SHA идентичен, frozen-guard GREEN, M3-VERIFY dist-grep PASS.
- **Новый канон: tsc=296 / vitest=761+5int+0load / PARITY PASS.** Учитывай в своих замерах.

## 2. ДИРЕКТИВА БОССА: подними лимиты шагов агентов на Маке

Босс: «маку скажи чтобы так-же увеличил лимиты по агентам!»

На PC выяснилось: лимиты шагов были занижены прямо в конфигах (скауты `steps: 10`, цепь `12–30`) — это обрывало качественную проработку на середине. Поднято:
- 007 = 300, operator = 150, скауты/001/002/005/009/explore/general = 120, 008 = 100.
- Файлы `.opencode/agent/*.md` с новыми `steps:` в frontmatter **уже в репо** (коммит `e826b96`) — если твоя сессия читает репо-конфиг, подхватится автоматически.
- НО: раньше у тебя была проблема «сессия из /Users/evgenia → репо-конфиг не читался». Проверь: если твой Mac-side `opencode.json` переопределяет агентов — добавь `"steps": N` туда же (поле `agent.<name>.steps`; legacy `maxSteps` — deprecated, не использовать). Источник: opencode docs agents.mdx «Options > Max steps».

## 3. ВАЖНО: opencode.json больше НЕ shared-файл

`opencode.json` содержал tokenrouter-ключ plaintext и был tracked вопреки .gitignore (твоя находка, 176fbd7 §4 — подтвердилась). Hub выполнил `git rm --cached opencode.json` (коммит `e826b96`); файл остаётся на диске PC, но из репо исключён и проигнорирован. Ротация ключа — за Боссом.
**Следствие для §0.3:** shared-мутабельным конфигом агентов теперь являются tracked-файлы `.opencode/agent/*.md` (frontmatter). Свой Mac-side opencode.json ведёшь сам.

## 4. Уточнение по Rehearsal (твоя находка §1)

Проверили: актуально **17** обращений к `audioEngine` в `src/Rehearsal/` (не 36 — цифра из DRIFT-отчёта 18.07 устарела). Концентрация: `src/Rehearsal/bridge/rehearsal-trigger.bridge.ts` — это SAFE-зона (не frozen `src/bridges/*`). W4 Rehearsal не задел (0 ссылок на orchestrator/legacy). Точечная проверка живости этих 17 обращений при V2-не-стартует — остаётся item'ом W5, как ты и рекомендовал.

## 5. Висящие ack'и (не блокируют, но канал должен быть чистым)

- `SYNC-HUB-TO-MAC-2026-08-28-w4-start.md` — формального ack нет (косвенные ответы получены в city-prep findings — спасибо; если нечего добавить, просто ack).
- `SYNC-HUB-TO-MAC-2026-08-28-w3-done.md`, `…-smoke-closure.md` — ack не получены.

## 6. Город

Hub город не трогает (твой трек, решения Босса 28.08 в силе: Rehearsal-first, Karaoke/Concert planned, Gate S отложен). W5 стартует после браузер-теста W4 Боссом; город-миграция post-M3 — без пересечений.

_Вёдра (007_Hub), 2026-08-28. Канон 296/761+5int+0load. HEAD 2766ddc._
