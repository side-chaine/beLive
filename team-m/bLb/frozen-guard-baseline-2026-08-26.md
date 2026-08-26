# 🔒 Frozen-guard BASELINE · 2026-08-26 · pre-flip
> Автор: 007_Мак (Far Light). Задача Hub (26g Task 1). Repo: Mac sshfs (node недоступен → эквивалент grep, read-only).
> Скрипт: `team-m/bLb/frozen-guard.mjs` (Босс GO). Прогон grep-эквивалента по src/.

## РЕЗУЛЬТАТ: 🟢 GREEN (новых safe→frozen импортов/глобалов ВНЕ allowlist НЕТ)

### A. SAFE→FROZEN импорты (спецификаторы track.orchestrator|patchV1|AudioEngineV2|bridges/|live-guard)
Найдено в SAFE-файлах (все В allowlist REGISTRY §7 BAC-101..108):
- `src/audio/featureFlag.ts:6` → `./compat/patchV1`  ✅ allowlist
- `src/components/MixerPanel.tsx:180` → `../services/track.orchestrator` (dyn) ✅ allowlist (BAC-102)
- `src/components/QuickActions.tsx:214` → `../services/track.orchestrator` (dyn) ✅ allowlist (BAC-102)
- `src/main.tsx:6` → `./bridges/live-guard` ✅ allowlist (BAC-104)
- `src/main.tsx:11` → `// ./bridges/audio-reactive.bridge` (ЗАКОММЕНТИРОВАН, retired) ✅ не real
- `src/services/track.actions.ts:7` → `./track.orchestrator` ✅ allowlist (BAC-101)
- `src/audio/compat/patchV1.ts:6` → `../core/AudioEngineV2` — САМ FROZEN-файл (исключён из скана)

### B. V2-глобалы (window.audioEngine|app|trackCatalog|liveMode|lyricsDisplay|markerManager|waveformEditor)
Реальные (non-comment) попадания — ТОЛЬКО в `src/bridges/**` (FROZEN-зона, исключена из скана): `blocks.bridge.ts:3,29`.
SAFE-файлы: только КОММЕНТАРИИ (не live-binding):
- `src/Rehearsal/bridge/rehearsal-trigger.bridge.ts:119` — JSDoc (проверено: live binding НЕТ)
- `src/audio/featureFlag.ts:3`, `src/foundation/event-bus/wrappers/audio-events.ts:16`, `src/foundation/reactions/stem-engine-sync.ts:58`, `src/services/track.actions.ts:3` — комментарии (featureFlag/track.actions в allowlist)
- `src/main.tsx:454` — коммент (main в allowlist)
- `src/bridges/__tests__/mode-switch.bridge.test.ts:38` — коммент внутри frozen-зоны (исключена)

## ВЫВОД
Базовая линия чистая: всё, что зовёт frozen/V2-глобалы — легитимные BAC-101..108 нарушители (ожидаемо до флипа). Любое НОВОЕ появление после правок волн = 🔴 RED = блокер флипа. Hub гоняет скрипт (node) на PC как pre-flip/post-wave gate.
