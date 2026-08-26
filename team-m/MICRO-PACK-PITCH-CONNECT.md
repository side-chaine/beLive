# 📦 MICRO-PACK-PITCH-CONNECT (minimal) · design · 007_Мак → 007
> Цель: подключить Notes/питч к V3 ДО флипа M3-GO как GUARD (чтобы после flip Notes не пустовало). Стратегия Босса: flip-first, optimize-later. КАЧЕСТВО (автотюн) ОТЛОЖЕНО в post-m3.
> Источник: GO_001 (001→002→001→009) + коррекция Босса (80% детекций точны, глюки 20-30% — НЕ системная ошибка). 009 инсайт: pitch-engine УЖЕ transport-agnostic → полный PitchBus (~400 строк) избыточен, хватит safe-shim + retarget.
> СТАТУС: DESIGN (Far Light). НЕ ПРИМЕНЯТЬ без OPT-IN Босса + green CI (tsc=306/vitest=772).

## ЯКОРЯ (обязательные, из вердикта 009)
- (a) frozen `AudioEngineV2`/`HybridPipelineService`/`bridges` НЕ трогать.
- (b) канон 306/772 не сломать (только pitch-слои).
- (c) `MicSourceV3` НЕ frozen.
- (d) single-mic-owner: строго `MicSourceV3.acquire()/release()`, без своего `getUserMedia`.
- (e) liveness/error: при сбое acquire → `status:'error'`+бейдж, не тишина.
- (f) vocal через публичный `StemOrchestrator.get('vocals').outputNode` (read-only).
- (g) AudioWorklet сохранить; ЗАПРЕТ `initFromNode(router.micInput)` (пустой GainNode).
- (h) decouple: `getAudioContext()` + убрать `window.audioEngine.*`.

## ФАКТЫ ИЗ КОДА (recon 002/001)
- `src/audio/pitch/pitch-engine.ts`: уже transport-agnostic (`initFromMic`/`initFromNode`); `_getContext()` читает `window.audioEngine.audioContext` + `ae.microphoneStream` (frozen-контракт!).
- `src/components/PitchTab.tsx`: `:241-242,254` берёт `window.audioEngine.vocalsGain`+`ae.stems`; `:309` мик через `initFromMic()` (собственный getUserMedia — НАРУШАЕТ single-mic-owner).
- `src/features/pitch/pitch.store.ts:45` + `src/audio/pitch/pitch-visual-bridge.ts:17`: вызывают НЕСУЩЕСТВУЮЩИЙ `PitchEngine.get()`/`init()` → TypeError вне V2/V3 (root-cause части пустоты Notes).
- `src/audio/engine-v3/services/MicSourceV3.ts`: реален (НЕ frozen), `acquire()/release()` refcount, НО не подключён к графу.
- `src/audio/core/audioContext.ts`: `getAudioContext()` — единый контекст.

## ПАК (минимальный, ~60–80 строк, 2–3 файла)

### F1 · `src/audio/pitch/pitch-engine.ts` (+~40 строк)
- `_getContext()` → `return getAudioContext();` (импорт из `audio/core/audioContext`).
- `+ get(): PitchEngine` — safe-shim: возвращает синглтон (lazy `new PitchEngine()`), НЕ бросает (чинит root-cause `pitch.store.ts:45`/`pitch-visual-bridge.ts:17`).
- `+ init(opts?): PitchEngine` — safe-shim: форвардит на `retarget`/дефолт, НЕ бросает.
- `+ retarget(source: AudioNode, kind:'mic'|'vocal')` — обёртка над существующим `initFromNode(source)`; гарантирует AudioWorklet-путь (НЕ `router.micInput`). Вокальный источник НЕ мутирует пайплайн (read-only node).

### F2 · `src/components/PitchTab.tsx` (+~30 строк)
- Импорт `MicSourceV3` + `StemOrchestrator` (read-only `get('vocals')?.outputNode`).
- `useEffect` (mount): `const stream = await MicSourceV3.acquire(); const src = getAudioContext().createMediaStreamSource(stream); engine.retarget(src,'mic');` — при `MicAcquireError` → `store.setStatus('error')` + бейдж (не silent).
- Вокал (если `StemOrchestrator.get('vocals')?.outputNode` доступен): `engine.retarget(vocalNode,'vocal')` как 2-й источник.
- УДАЛИТЬ чтение `window.audioEngine.{vocalsGain,stems,microphoneStream}`; заменить на MicSourceV3/StemOrchestrator.
- Assert/guard: запрет вызова `initFromNode(router.micInput)` (пустой GainNode → тишина).
- cleanup: `MicSourceV3.release()` на анмаунте (refcount).

### F3 (опц.) · `src/features/pitch/pitch.store.ts:45`
- `PitchEngine.get()` уже safe-shim (F1) → просто убедиться, что бинд идёт на `engine.subscribe()`/retarget, а не на мёртвый путь.

## ТЕСТЫ (минимум)
1. `PitchEngine.get()`/`init()` НЕ бросают TypeError (юнит).
2. На живом V3: `MicSourceV3.acquire()` → Notes заполняются кадрами (интеграционный smoke, Босс меряет ушами).
3. `MicAcquireError` → `status:'error'` (не silent-empty).
4. Ровно один `getUserMedia` (refcount MicSourceV3) — проверка single-mic-owner.

## РИСКИ
- Frozen-bridge compat: `pitch-visual-bridge.ts` дёргает `init()` — safe-shim возвращает инстанс, не throw.
- Latency: retarget использует существующий worklet-node, не ScriptProcessor.
- Vocal node lifecycle: `get('vocals')` может быть undefined до загрузки стема → retarget просто не аттачит 2-й источник (mic покрывает).

## ПРИМЕНЕНИЕ (007, Near Light)
1. Босс аппрувит OPT-IN. 2. 007 применяет F1/F2 (canon 306/772 GREEN). 3. Босс меряет Notes на живом V3 ДО флипа M3-GO (гейт). 4. Флип → Notes не пустует. КАЧЕСТВО (автотюн) — отдельным паком post-m3.
