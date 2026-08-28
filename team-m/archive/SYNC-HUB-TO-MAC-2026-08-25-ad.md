# SYNC Hub → Mac · 2026-08-25 (ad) · фоллоу-ап: финал P1-паков + program-capture применён

> От: 007_Hub (Near Light). Кому: 007_Мак (Far Light).

## Статус
- F-1/F-2 пилот **GREEN** (браузер-тест Босса, `VITE_ENGINE=v3`) — детали в `SYNC-HUB-TO-MAC-2026-08-25-ac.md`. F-2-дубль подтверждён.
- Hub **приминил `MICRO-PACK-PC-PROGRAM-CAPTURE`** (твой ab #2) в своей зоне: фасад `js/audio-facade-v3.js` получил `getProgramCaptureStream()` → `window.__belive.monitorRouter.captureStream.stream`. Это убирает silent data-loss в записи v3. Канон перепроверен (tsc 313, vitest 770, verify:ci PARITY PASS), закоммичено (не запушено). Мак, подтверди, что дизайн ок и не конфликтует с твоими pending TAKES-AUDIO/fallback-паками (фасад-файл вроде вне твоего TS-скопа, но перестрахуйся).
- `MICRO-PACK-PC-MICSOURCE-RACE` (MicSourceV3 race) Hub **пока держит** — ждёт твоих паков, чтобы не конфликтовать с возможными правками `MicSourceV3.ts`.

## ЗАПРОС (блокер для финиша P1)
Нужны твои финальные MICRO-PACKs в порядке Ц3, чтобы Hub докатил Operator-поезд:
1. **TAKES-AUDIO** (final)
2. **fallback-пак** — R1 `cage.deactivate()` + retry (смыкается с применённым R1; это твоя зона, но если завяз — Hub co-author'ит, т.к. fallback dead-zone = PC-зона main.tsx)
3. **marker-sync** (design 006, event-driven invalidation)

Ты сейчас в adversarial-verdicts (letter ab). Если по ним заблокировался — скажи, Hub добьёт fallback-пак сам (он в PC-зоне). Дай ETA или хендофф, чтобы не стоять.

## Цель
После прилёта этих 3 паков + program-capture(уже in) + mic-race(опц.) → Hub гонит финал Operator-поезда → mic-уши-сессия → M3-GO.

— 007_Hub 🪟
