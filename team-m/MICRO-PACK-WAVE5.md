# 🌊 MICRO-PACK-WAVE5 · EXEC FINAL v2 (chain 28.08: 001 реверификация → 002 ТРЕБУЕТ ПАТЧА → 009 РЕШЕНО с условиями)
> SUPERSEDED: шапка FINAL 26h и прежний scope. Канон: tsc=296 / vitest=761+5int+0load (63 файла) / PARITY PASS, HEAD ≥1a41187 (city-коммиты Мака src/ не трогают). Frozen: НЕ трогать. Все якоря — СИМВОЛ-базированные (номера строк могут дрейфовать, искать по символу).

## ЦЕЛЬ
Финализация v3-only: снос мёртвых stub'ов + дефиниции `__restoreV2Engine` + .bak-мусора; BAC-107 закрыт; BAC-110 задокументирован. **Block Editor — МИГРИРУЕТСЯ, НЕ убивается** (решение 009 по продуктовому вопросу).

## ПРАВКА-1 · src/main.tsx
- Удалить импорт `registerLiveModeStub` (:9) и `registerWaveformEditorStub` (:10).
- Удалить вызовы `registerLiveModeStub()` / `registerWaveformEditorStub()` (:318/:319, искать по символу).
- **СОХРАНИТЬ:** `installLiveGuard` импорт (:6) + вызов (:320) — 009: гард мёртв после сноса stubs, но это инсталл-точка frozen-моста live-guard, нулевой риск, оставить. `__setV3Active?.(false)` не трогать.

## ПРАВКА-2 · DELETE stubs
- `src/services/live-mode.stub.ts`, `src/services/waveform-editor.stub.ts`.

## ПРАВКА-3 · ОБЯЗАТЕЛЬНАЯ МИГРАЦИЯ Block Editor (патч 002, уточнён 009)
Stub `_openNewBlockEditor` (waveform-editor.stub.ts :34-152) — ЕДИНСТВЕННЫЙ вход в живой BlockEditorModal. Перед сносом перенести:
1. В `src/services/blockEditor.service.ts` создать `export function openBlockEditor()`: логика 1:1 из stub `_openNewBlockEditor` — guard'ы (нет трека/каталога → error-нотификация), RTF-парс (`window.parsingService.rtfToText` — точный API сверить при чтении stub), авто-нарезка блоков (boundary `припев|проигрыш` + аккумулятор 2 строк), save-колбэк (`saveLyricsBlocks` + `lyricsDisplay.loadImportedBlocks` + `markerManager.updateMarkerColors` + success/error-нотификации).
2. Терминальный вызов — **прямой** `useBlockEditorStore.getState().open(...)` (сигнатуру взять из `src/stores/blockEditor.store.ts`, сверить при чтении). Путь выбран по 009: без Proxy.
3. Прямой путь осиротит: класс `BlockEditorProxy`, `window.ModalBlockEditor` assignment, `initBlockEditorService` + его вызов `main.tsx:323`, блок `patchWaveformEditor` (def :105, retry :109, тело :103-150, вызов :168, коммент :167). **Перед удалением проверить grep'ом 0 читателей:** `grep -rn "ModalBlockEditor\|initBlockEditorService" src js` → только blockEditor.service.ts + main.tsx:323 + stubs. Затем удалить всё перечисленное.
4. Репоинт двух кнопок на `openBlockEditor()`: `src/components/ControlPanel.tsx:29` (`w.waveformEditor?._openNewBlockEditor?.()`) и `src/components/SyncEditorPanel.tsx:902`. Гард `lyricsDisplay?.lyrics?.length` у ControlPanel :25 сохранить.
5. `BlockEditorModal` в `App.tsx:222` — НЕ трогать (остаётся, читает store).

## ПРАВКА-4 · src/foundation/event-bus/facade.ts
- Удалить FIXME коммент :51-52, заменить одной строкой: `// camera-permission-resolved: мёртво с W5 (0 dispatchers / 0 subscribers); mapping сохранён для UI-поверхности eventBus.`
- Mapping :53 оставить.

## ПРАВКА-5 · js/audio-facade-v3.js
- Удалить :8-10 (коммент + `_v2Engine` capture + def `__restoreV2Engine`). Фасад :12+ (getCurrentTime, hybridEngine, install-guard `if (!window.audioEngine)` :85) — НЕ трогать.

## ПРАВКА-6 · src/audio/engine-v3/integration/V3StatePublisher.ts (BAC-110 = документация)
- Placeholder-коммент :128-131 заменить документацией факта (состав подтверждён 009, проверка 5):
  `playback-state-changed` потребляют: 7 window-листенеров — 4 FROZEN (lyrics.bridge:171, audio.bridge:149, audio-reactive.bridge:132, stem-reactive.bridge:251) + 3 safe (PitchTab:277, trigger-visual.service:208, stem-reactive.ts:167); dual-dispatcher: V3StatePublisher:133 (V3) + AudioEngineV2.ts:1962 (FROZEN V2); facade.ts:21 dual-publish в eventBus → 6 подписчиков (audio-events:28, takes-events:26, position-sync:51, lyrics-events:166, audio-reactive:138, rehearsal-trigger-writer:76).
- `dispatchEvent` :133 — **НЕ трогать**.

## ПРАВКА-7 · DELETE мусор (находки Мака, 176fbd7)
- `src/audio/engine-v3/SignalsmithAdapterService.bak.ts` — ВНИМАНИЕ: tsconfig `include:["src"]` → файл компилируется в канон 296; после удаления tsc может снизиться — дельту задокументировать в отчёте.
- `src/components/RehearsalLyrics.module.css.bak`.
- `landing/` — НЕ существует (исключено 009).

## ВНЕ W5 (НЕ трогать)
BAC-109 console-гигиена (363 правок, defer в отдельную волну с logger-политикой) · V2Adapter.ts (DEFER: жив через index.ts:59, stem-engine-sync.ts:3, position-sync.ts:38, takes.time.ts:22) · app.store.ts (8 живых импортёров) · Rehearsal-аудит (опасность rehearsal-trigger.bridge.ts:64-66 `ae?.play?.().catch()` — отдельная задача) · wording «V2 continues» · BAC-111 доки · installLiveGuard · все frozen · V2-комментарии (retain-класс).

## ГЕЙТЫ (до коммита, все обязательны)
- G1 tsc: 0 NEW ошибок; дельту от 296 задокументировать (ожидается снижение после .bak).
- G2 vitest: 761 passed + 5 intentional + 0 load-fail (63 файла).
- G3 `npm run verify:ci` → PARITY PASS.
- G4 `sha256sum -c /tmp/opencode/frozen-pre-v3active.sha` → 21 OK + `node team-m/bLb/frozen-guard.mjs` → GREEN.
- N1 `grep -rn "_openNewBlockEditor" src` → 0.
- N2 `grep -rn "registerLiveModeStub\|registerWaveformEditorStub\|live-mode\.stub\|waveform-editor\.stub" src` → 0.
- N3 `grep -rn "__restoreV2Engine" src js` → 0.
- N4 `grep -rn "saveLyricsBlocks" src` → только def track.actions.ts + blockEditor.service.ts.
- N5 `grep -rn "patchWaveformEditor" src` → 0.
- N6 `grep -rn "window.liveMode =" src` → 0.
- N7 `grep -rn "ModalBlockEditor" src js` → 0.
- P1/P2 (ручной smoke Босса, после коммита): кнопки «Blocks» (ControlPanel + SyncEditorPanel) открывают BlockEditorModal, save пишет блоки; mode-switch без ошибок при waveformEditor===undefined; загрузка трека без регрессий.

## РИСК-НОТЫ
- ПРАВКА-3 — единственная правка с переносом логики; всё остальное = удаление мёртвого кода.
- Все читатели `window.waveformEditor`/`window.liveMode` null-safe (проверено 001+002+009: mode-switch.service:236, track.loader:88, track.actions:71/173, blockEditor.store:369, notification.ts:21, frozen mode-switch.bridge:355, track.orchestrator:89 — read-only).
- `camera-permission-resolved`: 0 подписчиков (подтверждено 002+009).
- W11 auto-lyrics-skip: stub.show() пуст уже сейчас → поведенчески no-op, не регрессия.
- frozen-guard латентный дефект (allowlist `waveformEditor.stub.ts` ≠ реальное имя) — известно, не блокер.

## СТАТУС
EXEC FINAL v2 — РЕШЕНО с условиями (009, 28.08). Применение: Hub→Operator, коммит Hub'ом после гейтов + P1/P2 smoke Босса.
