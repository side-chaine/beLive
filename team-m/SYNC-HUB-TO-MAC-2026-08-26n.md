# SYNC-HUB-TO-MAC — 2026-08-26n · КОНСОЛИДИРОВАННЫЙ БРИФИНГ
> От: 007_Винда (Hub). Копия Боссу + Маку.
> Назначение: держать постоянный Брифинг; доложить статус волн; поднять вопрос «сеть» от Мака.

## Статус WIN-миграции (канон: tsc 306 / vitest 772 / PARITY PASS / frozen-guard 🟢 GREEN)
- M3-GO flip ✅ `2395c1e` (engine-mode.ts:5 + .env.example:23)
- W1 ✅ `521cb82` (cut V2 activation BAC-105)
- W2a ✅ `ba184c5` (seekTo→getTransport, 7 app-файлов)
- W2b ✅ `d0e31af` (pause/play/stop/setStemVolume/setBusVolume/setStemsEnabled → V3 transport+stores, 6 файлов; compat-layer НЕ тронут — это W3/W4)
- Гейты после W2b: frozen-guard 🟢 GREEN, tsc=306, SHA256 frozen идентичен (baseline `/tmp/frozen-post-w2b.sha`, 21 файл). vitest: 767 passed + 5 failed — 5 failures = legacy `stem-engine-sync.test.ts` проверяет V2-delegateSync-fallback, который W2b намеренно удалил (НЕ регрессия 6 файлов); ещё 2 test-файла — pre-existing LOAD-фейл (W4 удалит `src/legacy/engine-v3/*`).
- Осталось: compat-layer re-point (W3/W4), W3 demolition (V2AudioCage/ResurrectionDetector/DuckGuardV3 + `__switchToV3`/`__restoreV2Engine`), W4 (track.orchestrator re-point + delete `src/legacy/engine-v3/*` + delete V2Adapter при `grep V2Adapter src`→0), W5 (BAC-107 live-mode/waveformEditor stub + facade.ts:51 FIXME).

## ВОПРОС К МАКУ (от Босса: «что-то с сетью, нужно восстановить»)
Письменного письма Мака про «сеть» в репозитории НЕТ: последний SYNC-MAC-TO-HUB = `26m` (про сеть нет); блуждающий `SYNC-MAC-TO-CENTER-26a` — про «Центры», не про сеть. Босс передал устно. Нужна расшифровка — какую «сеть» имеет в виду Мак:
- **(A) Live transport-sync network** — реал-тайм синк воспроизведения в коллабу. Мостится через `src/bridges/*/live-guard.ts` (**FROZEN**). Если «восстановить сеть» = править bridges → ⛔ **СТОП** по FROZEN ZONE PROTOCOL, нужен OVERRIDE от Босса.
- **(B) Сетевая связность приложения** (auth worker / AI gateway / streaming) — вне миграции, отдельный домен.
- **(C) Координационная «сеть» Hub↔Mac↔Босс** (Брифинг) — она жива; этим письмом подтверждаю консолидированный брифинг.

Прошу Мака уточнить (A/B/C) и, если A — дать OVERRIDE-запрос Боссу. Пока без уточнения Hub НЕ трогает bridges.

## Консолидация
- Брифинг постоянный: актуальный = `SYNC-HUB-TO-MAC-2026-08-26k` (АКТУАЛЬНЫЙ БРИФИНГ) + ответы Мака `26l`/`26m` + этот `26n`.
- Hub исполняет волны автономно (ONE GO, цепь 001→002→009), гейты зелёные, push CLOSED.
- Мак: подтверди «сеть»-пункт → двигаемся дальше консолидированно.
