# MICRO-PACK · СНОС-30 (H-2 ×18 + H-6 ×12) · 2026-09-06 · GO Никиты (queue 11:45)

**Основа:** TRIAGE-51-007 + arch-scout верификация 06.09 (0 тест-импортёров, 0 прод-импортёров, CaptureWorklet мёртв подтверждён: addModule-строк нет, потребитель impulse-test-harness.ts удалён ранее). GO: «снос-батчи 30 (по GO, probe:bundle + чистка hold-листа)».
**Канон до:** tsc=184 · vitest 812/68 · reach: 121 = 70 ex + 51 hold + 0 viol · HEAD 7a55ec8.

## СПИСОК НА СНОС (30 файлов, rm)

**H-2 diagnostics (18):**
src/audio/engine-v3/diagnostics/208-block-b-r4-verifier.mjs
src/audio/engine-v3/diagnostics/286-007-E1E7-VERIFIER.mjs
src/audio/engine-v3/diagnostics/289-007-GATEKEEPER-B2.mjs
src/audio/engine-v3/diagnostics/289-007-runner-v6.4-v49.console.js
src/audio/engine-v3/diagnostics/290-007-deriver-v3.mjs
src/audio/engine-v3/diagnostics/305-007-N9-FIXE1-MATRIX.mjs
src/audio/engine-v3/diagnostics/CaptureWorklet.ts
src/audio/engine-v3/diagnostics/gate2-pc-verifier.mjs
src/audio/engine-v3/diagnostics/run-gate2-pc-diagnostics-v6.32.3.browser.js
src/audio/engine-v3/diagnostics/run-gate2-pc-diagnostics-v6.32.3.console.js
src/audio/engine-v3/diagnostics/run-gate2-pc-diagnostics-v6.32.4.browser.js
src/audio/engine-v3/diagnostics/run-impulse-diagnostics-v6.32.2.console.js
src/audio/engine-v3/diagnostics/run-impulse-diagnostics-v6.32.3-audit-r2.console.js
src/audio/engine-v3/diagnostics/run-impulse-diagnostics-v6.32.3-audit-r3.console.js
src/audio/engine-v3/diagnostics/run-impulse-diagnostics-v6.32.3-audit.console.js
src/audio/engine-v3/diagnostics/run-impulse-diagnostics-v6.32.4-audit-r4.2-pilot.console.js
src/audio/engine-v3/diagnostics/run-impulse-diagnostics-v6.32.4-audit-r4.2.console.js
src/audio/engine-v3/diagnostics/run-impulse-diagnostics-v6.32.4-audit-r4.console.js

**H-6 dead (12):**
src/components/NowPlaying.tsx
src/components/TrackInfo.tsx
src/components/onboarding/OnboardingStep.tsx
src/exercises/index.ts
src/foundation/event-bus/wrappers/index.ts
src/foundation/event-bus/wrappers/mode-switch-events.ts
src/foundation/event-bus/wrappers/rehearsal-trigger-writer.ts
src/js/main.js
src/services/lrc-parser.service.ts
src/services/monitor.state.ts
src/stem/index.ts
src/triggers/index.ts

## НЕ ТРОГАТЬ
- JSON-манифесты diagnostics (сироты, отдельный шаг) · root js/ (5 живых legacy) · H-1c (8) · H-3 (6) · H-4 (4) · H-5 (3) · DuplicateAudioRouteChecker.ts + его тест (ЖИВОЙ, импортируется HybridPipelineService.ts:25)

## HOLD-LIST ЧИСТКА (тем же коммитом!)
scripts/reach-holdlist.json: удалить все 30 записей снесённых файлов (18 H-2 + 12 H-6). Остаётся 21: 8 H-1c + 6 H-3 + 4 H-4 + 3 H-5.

## ПОРЯДОК
1. probe:bundle ДО сноса (baseline, вывод сохранить)
2. rm 30 файлов
3. holdlist: 51 → 21 записи
4. probe:bundle ПОСЛЕ (сверка с baseline: снесённые не в бандле — вывод не должен показать новых потерь)
5. Приёмки

## ПРИЁМКИ
① node scripts/verify-reach.mjs → «0 violations · hold: 21 (8 H-1c · 6 H-3 · 4 H-4 · 3 H-5) · excluded (H-1 tests): 70 · stale: 0», exit 0
② npx tsc --noEmit | grep -c "error TS" → 184 · vitest run → 812/68/0int
③ probe:bundle после = baseline-честность (снесённые отсутствовали в бандле и ДО)
④ npm run build → success
