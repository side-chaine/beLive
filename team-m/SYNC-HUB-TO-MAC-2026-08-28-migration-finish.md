# SYNC HUB→MAC · 28.08 · 🏁 МИГРАЦИЯ V2→V3 ФИНИШИРОВАНА

## Статус
Волны W1-W5 + W6 hygiene-фронт применены и закоммичены на `backup/win-V3-finish_2-2026-08-23`.
Коммиты дня: `e826b96` (baseline хвостов) → `2766ddc` (W4) → `18cb248` (W5) → `8f0b3ad` (W6) + docs-коммиты.
Город-коммиты Мака (`7a71e09`, `64ad8ae`, `fb8f291`, …) учтены, src/ не тронут, город не трогаем.

## Финальный канон
- tsc=296 (0 NEW во всех волнах) / vitest=761 passed + 5 intentional + 0 load-fail (63 файла) / PARITY PASS
- frozen 21×SHA256 идентичен во всех волнах; frozen-guard GREEN
- waveformEditor в src = ровно 2 строки, обе frozen (mode-switch.bridge.ts:354, track.orchestrator.ts:88)
- Runtime-импортов frozen track.orchestrator = 0 (живая копия = track.loader.ts, W4)

## Смоки Босса (записи в PARITY-LEDGER)
W3-SMOKE (фейдеры/music-bus/other) ✅ · W4-SMOKE (track.loader/queueTrackJump/seek/track-switch) ✅ · W5-SMOKE (Block Editor вход) ✅.
Решение Босса: внутреннее редактирование блоков в модалке доделывается в bLb.

## Ключевые решения цепей (для города)
- Block Editor МИГРИРОВАН, не убит: `openBlockEditor()` в blockEditor.service.ts, источник трека = каталог `tc.currentTrackIndex` (store-индекс протухает после Shift+Arrow — доказано 002).
- auto-open sync-editor после upload = мёртвая фича (revival только через новый V3-сервис, не через window-глобал).
- installLiveGuard в main.tsx сохранён (мёртвая инсталл-точка frozen-моста live-guard).

## Очередь эпохи bLb (не блокирует, для планирования города)
1. GUARD-36: markers-out-of-bounds CRITICAL при загрузке трека (lyrics-events.ts:71) — расследование контракта маркеров.
2. CORS feed-bot воркера для localhost (внешний фикс CF worker).
3. BAC-109 console-гигиена (~363 правок, нужна logger-политика).
4. V2Adapter DEFER (4 импортёра: index.ts:59, stem-engine-sync.ts:3, position-sync.ts:38, takes.time.ts:22).
5. app.store.ts @deprecated (8 живых импортёров — нужна миграция, не снос).
6. Rehearsal-аудит: 17 audioEngine-обращений в rehearsal-trigger.bridge.ts; опасность :64-66 `ae?.play?.().catch()` (play()→undefined при ae=фасад).
7. Внутренности Block Editor (решение Босса: bLb).
8. Остаток mic-уши-сессии; closure-строки 6/7/11 (частично покрыты ручными смоками); бандл-файл строка 1.

## Админ
- `opencode.json` больше НЕ shared-файл (git rm --cached в e826b96): агентский конфиг синхронизируется через tracked `.opencode/agent/*.md` (steps 120-300 уже там). Mac-side opencode.json Mac правит сам (директива Босса: поднять лимиты шагов).
- Push CLOSED до отдельного GO Босса.

## Ждём от Мака
Ack этого синка + статус города bLb (что нужно от Hub'а в эпоху bLb).
