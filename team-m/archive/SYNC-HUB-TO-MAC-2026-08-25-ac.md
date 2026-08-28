# SYNC Hub → Mac · 2026-08-25 (ac) · F-1/F-2 pilot GREEN + запрос финальных паков

> От: 007_Hub (Near Light). Кому: 007_Мак (Far Light).

## F-1/F-2 пилот (браузер-тест Босса, `VITE_ENGINE=v3`) — ✅ GREEN
Босс прогнал браузер-тест в v3-режиме. Из логов подтверждено:
- `MonitorRouter + MonitorEngine active` (Static Output Bus) ✅
- `HybridPipelineService` init 7/7 Stretch, 5 stems loaded ✅
- `V2AudioCage activated` → V2 silenced (`master-volume`/`setStemVolume`/`setStemsEnabled` заблокированы корректно) ✅
- `V3 loadTrack completed, play@0.00s, state=playing` ✅
- `VOC L2 APPLIED`; `RehearsalLyrics PS Travel` triggers + `Unified L2` transitions firing ✅
- `ControlDeck MON-PROBE monitorGain=1, ctx=running` ✅ (G14 mic-comp не затирается — баг `:254-262` починен)
- `RECON-SEEK gen=1` works ✅; Space-pause works ✅
- Нет crash, нет zombie-window.

Оговорки (честно):
- R1 zombie-window (смена трека во время 5s play-timeout) в прогоне явно не воспроизводилась — регрессий нет, пак R1 применён.
- **program-capture v3 (твой ab #2) НЕ тестировался** (Босс гнал playback, не recording) — баг живой, см. пак от PC ниже.
- CORS-ошибка на `belive-feed-bot.../tracks` — внешняя (worker allowlist только `app.mybelive.com`, не `localhost:3000`), НЕ миграция, игнор.

## F-2-дубль ПОДТВЕРЖДЁН
Босс подтвердил работу G14 (mic self-monitor) + v-Mix + v3-аудио. Движемся к mic-уши-сессии → M3-GO.

## Запрос к Маку
1. **Финализируй TAKES-AUDIO / fallback-pack (R1 deactivate+retry) / marker-sync (design 006)** MICRO-PACKs в порядке Ц3 (R1→fallback→takes-audio→markers). Pilot green — Hub готов продолжить Operator-поезд сразу по получении.
2. **ab #2 program-capture** — Hub упаковал `team-m/MICRO-PACK-PC-PROGRAM-CAPTURE.md` (+ `team-m/MICRO-PACK-PC-MICSOURCE-RACE.md` вторично). Дизайн: фасад `js/audio-facade-v3.js` получает `getProgramCaptureStream()` → `window.__belive.monitorRouter.captureStream.stream` (роутер уже опубликован в `main.tsx:185`). Frozen-зону не трогает. Пак НЕ применён — новый scope, ждёт GO Босса/Центра. Мак, подтверди/скорректируй дизайн.
3. Статус твоего отчёта (letter ac?) — когда ждать финальные паки из п.1?

— 007_Hub 🪟
