# ⚖️ GO_001 · ПИТЧ-to-V3 · ВЕРДИКТ ЦЕПИ · 2026-08-26
> Цепь: 001(Ювелир) → 002(Адвокат) → 001(защита) → 009(Суд). Модель: `opencode/hy3-free`. Брифинг `SYNC-MAC-TO-HUB-2026-08-26a.md`.

## ИТОГ (вердикт 009)
- **ПОДКЛЮЧЕНИЕ питча (pitch-connect-guard) = РЕШЕНО** — GUARDED/OPT-IN, обратимо, НЕ трогает frozen и 18 строк флипа M3-GO. Условие: green CI (tsc=306/vitest=772) + нетронутый frozen.
- **КАЧЕСТВО (автотюн, ложные октавы) = ОТЛОЖЕНО** (post-m3). Guard = «питч идёт», не «питч верный».
- **Якоря 9/9 ЗАЧТЕНЫ** (п. (b) под условием green CI).

## СУТЬ (001 jewel)
Питч-to-V3 = перенос детектора нот с V2-шины на общий mic, чтобы Notes наполнялось при V3. Сейчас Notes пусто (детектор привязан к V2-клетке). Рекомендация: ПОДКЛЮЧЕНИЕ = guard в скоуп M3-GO; КАЧЕСТВО = дескоуп.

## 002 (Адвокат) — ТРЕБУЕТ ПАТЧА
Нашёл в коде: `pitch-engine.ts` УЖЕ transport-agnostic (`initFromMic`/`initFromNode`); **PitchBus НЕ существует**; скрытый хард-баг `pitch.store.ts:45`/`pitch-visual-bridge.ts:17` зовут несуществующий `PitchEngine.get()/init()` (падает TypeError вне V2/V3); `MicSourceV3` реален (НЕ frozen) но не в графе; `router.micInput` — пустой GainNode. 7 усилений: (1) PitchBus реальный модуль; (2) детектор строго `MicSourceV3.acquire()/release()` без своего getUserMedia + error-бейдж; (3) liveness-guard 1500ms; (4) vocal через `StemOrchestrator.get('vocals').outputNode`; (5) AudioWorklet + запрет `initFromNode(router.micInput)`/тапа после `_micDelay`; (6) decouple frozen (`getAudioContext()`, убрать `window.audioEngine.*`); (7) перепроверить root-cause (dead get()/init()).

## 001 (защита) — 7/7 ПРИНЯТО
MICRO-ПАК «pitch-connect-guard»:
- NEW: `PitchBus.ts` (Observable<PitchFrame>), `PitchLivenessGuard.ts` (таймер 1500ms), `vocalSource.ts` (READ-ONLY аксессор `StemOrchestrator.get('vocals').outputNode`).
- EDIT (не-frozen): `MicSourceV3.ts` (acquire/release+worklet→PitchBus), `PitchEngine.ts` (retarget + safe-shim get()/init()), `pitch.store.ts` (бинд PitchBus), `PitchTab.tsx` (getAudioContext, убрать window.audioEngine.*, запрет initFromNode), Notes UI (fallback/error-бейдж).
- НЕ ТРОГАЕТ: frozen `AudioEngineV2`/`HybridPipelineService`/`bridges`, 18 строк флипа.
- Гарантия: Notes НЕ silent-empty (mic/vocal/liveness/error). Объём ~350–450 строк, 8 файлов (согласен: НЕ «18 строк»).

## 009 (Суд) — РЕШЕНО + АЛЬТЕРНАТИВА
**Вариант, который никто не предложил:** т.к. `pitch-engine` УЖЕ transport-agnostic, полный PitchBus (~400 строк) ИЗБЫТОЧЕН. Минимальный путь = оставить PitchEngine, добавить **только** safe-shim `get()/init()` + тонкий retarget на `MicSourceV3`/`VocalNode` (**~60–80 строк, 2 файла**). Альтернатива-2: серверный питч (stream→server→pitch), снимает клиентский риск ценой латентности. Суд рекомендует минимальный путь (экономия ×5–7).

## РЕЗОЛЮЦИЯ ДЛЯ БОССА/ЦЕНТРА
1. **ПОДКЛЮЧЕНИЕ = РЕШЕНО** (GUARDED/OPT-IN) — рекомендую минимальный путь 009 (~60–80 строк), не полный PitchBus.
2. **КАЧЕСТВО = ОТЛОЖЕНО** (post-m3).
3. До флипа M3-GO: измерить Notes на живом V3 (гейт), починить dead get()/init().
→ Следующий шаг: Mac проектирует MICRO-PACK (минимальный вариант), Hub применяет (canon 306/772), если Босс/Центр аппрувит OPT-IN.
