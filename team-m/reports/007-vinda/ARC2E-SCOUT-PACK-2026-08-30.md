# ARC-2E SCOUT PACK · питч на V3-тапы + vmix-тоггл + mic-volume · 2026-08-30

**БАЗА: HEAD `9b6bf83` · 30.08 · собрал 007 лично (разведка по живому дереву)**
**Канон: tsc=293 🔴 · vitest=801+0int+0load 🟢 (67 файлов) · PARITY PASS 🟢 · V3=дефолт**
**Контекст прогона:** ARC-2a (singleton+initFromMic) и ARC-2d (фасад: audioContext/playbackRate/транспорт) УЖЕ в каноне.

---

## 1. ТЕКУЩЕЕ СОСТОЯНИЕ ПИТЧА (после ARC-2a/2d)

### mic-ветка (pitch.store → PitchEngine.get().initFromMic) — ожила наполовину:
- `_getContext()` (pitch-engine.ts:60-64): `ae?.audioContext` → **фасад ARC-2d даёт pipeline.ctx** ✅
- `initFromMic` (:66-111): сначала ищет `ae?.microphoneStream` (:71-73) — **в фасаде НЕТ** → fallback на `navigator.mediaDevices.getUserMedia` (:74-77, R9: echoCancellation:false, noiseSuppression:false, autoGainControl:false, `_ownStream=true`) → **mic-питч уже работает через собственный getUserMedia** ✅
- Кнопка: PitchModule.tsx:104-105 (startPitch/stopPitch) — НО PitchModule НЕ смонтирован (grep: только self-refs); в UI жив PitchTab (deck/modules.ts:101, id 'pitch'/'Notes') со СВОИМ mic-движком (`new PitchEngine()` :307 + initFromMic) — **два mic-дути: store (одиночный, кнопка мертва UI-шно) и PitchTab (живой)**. Двойной getUserMedia при параллельном запуске = риск (в V3 `_getContext` больше не бросает — контекст есть → оба могут жить → 2 стрима!). REGISTRY-мина из ARC-2a (комментарий в store:49) актуальна как никогда.

### vocal-ветка (PitchTab.tryInit :241-265) — МЕРТВА в V3:
- Читает `ae?.vocalsGain` (:241) + `ae?.stems?.has('vocals')` (:242) — **V2-интерфейс, фасад НЕ даёт** → tryInit false → вокал-питч не инициализируется.
- Лечение: переподключить на V3-тап `pipeline.getStemAnalyser('vocals')` (HPS:599-600) ИЛИ `pipeline.chainA.stems.get('vocals')` — но Спор Q6 (Hy4): тап `_stretchMeters` — post-**stretch**, НЕ фейдеронезависимый (fftSize=256, :102/:238); для питч-детекции нужен fftSize≥2048 (как в initFromNode:133 `fftSize=2048`).
- `initFromNode(sourceNode)` (:111+): создаёт свой AnalyserNode fftSize=2048, smoothing=0 — **источник = ЛЮБОЙ AudioNode**: можно дать ему GainNode стема 'vocals' (chainA.stems.get('vocals').outputNode/gain) или САМ стем-узел.
- `retarget(newSource)` (:252+): hot-swap при уже-running движке (PitchTab зовёт при повторном tryInit :248).

### Питч-виз PianoKeyboard:
- `pitch-visual-bridge.ts:17` (activatePitchBridge → singleton store-путь) → `window.pianoKeyboard` — **0 присвоений в src** (мёртвый легаси-destination) → bridge = noop (guard :11-14). Данные питча из store идут только в подписку store (:51) — UI-потребитель = кто? (usePitch hook → PitchModule — не смонтирован) → **store-питч-данные сегодня никому не видны**.
- PitchTab рисует питч сам (subscribe :123/:198 → стейт-чипы) — живой UI-путь.

### События:
- `playback-state-changed` (PitchTab:274-277 resume/pause vocal-движка) — V3StatePublisher шлёт ✅ (это V3-событие).
- `track-fully-loaded` (:270) — V3DataInterceptor эмитит ✅.

## 2. VMIX-ТОГГЛ (e-цель из roadmap: «vmix-тоггл»)

- V2: enableVocalMix/disableVocalMix (AudioEngineV2:1548-1550, FROZEN) через patchV1 → фасад.
- V3: **MonitorRouter.setVMix НЕТ как единого тоггла**, есть В-Мix-граф: `vmixCenterIn/:26, vmixVocalIn/:29, vmixMicIn/:31, _vmixMerger/:32, _vmixMaster/:33 (0.0=OFF)`, `_vmixMicGate/:46-47 (TASK-015b: 0.0 only in V-Mix)`.
- UI-потребители: ControlDeck.tsx:357-368 (`ae.disableVocalMix()` при toggle-off + `useAudioStore.setState({vocalMixEnabled:false})`), VolumeControls.tsx:90, TakesPanel:1012 (reference-listen: UI-ложь — зовёт disableVocalMix, тапы остаются подключёнными).
- **Семантический вопрос для 001:** «reference-listen глушит mix» — продуктовое решение (из ARC-2d отсечений). Для V3-тоггла кандидат: `_vmixMaster.gain` (0.0=OFF / 1.0=ON) ИЛИ подключение/отключение vmix-входов. V-Mix-граф под monitor-comfort transform (FR-008), не program truth — глушить его = глушить монитор, не сигнал.

## 3. MIC-VOLUME (e-цель из roadmap)

- V2: setMicrophoneVolume (AudioEngineV2:1220, FROZEN) через patchV1:34.
- V3: mic живёт в MicSourceV3 (владелец стрима, acquire/release; main.tsx:173 `__belive.micSource`) + MonitorRouter.micInput (маршрут в монитор). **Единого mic-gain-узла нет** — VolumeControls/ControlDeck пишут `micVolume` в audio.store (:11,:40), но дальше он никуда не идёт в V3 (движковый потребитель отсутствует — «мик-канал отсечён», REGISTRY).
- Мины: G14 (monitor-gain переживает stop→restore), F-2 (stream → router.micInput, БЕЗ дефолтного _micDelay — R9-стрим), TASK-015b (_vmixMicGate — иммунен к 🎤).
- Питч mic-fallback (:74-77) создаёт СВОЙ стрим — вне MicSourceV3 → два параллельных getUserMedia в V3 (store-кнопка + PitchTab-mic + takes.recorder:76 через acquire) — координатор-владелец стрима нарушается (инвариант «один getUserMedia» из mic-race-фикса 82e1c76).

## 4. ТЕСТЫ ПИТЧА СЕЙЧАС

- `src/stores/__tests__/pitch-store.test.ts` — 4 кейса ARC-2a (singleton, poison, порядок).
- PitchTab: 0 тестов (компонент). PitchEngine: 0 тестов (класс). pitch-visual-bridge: 0.
- vitest-канон: 801/67 → таргет ARC-2e = +N кейсов.

## 5. ЭТАЛОН-ПАТТЕРНЫ (для дизайна 001)

- Тапы движка: `_stretchMeters` (per-stem, fftSize=256, post-stretch) / `_vocalHallMeter` (pre-fader vocal-hall, fftSize=256) — оба НЕ для питча (fftSize).
- initFromNode-паттерн: собственный analyser fftSize=2048 на ЛЮБОМ sourceNode → для фейдеронезависимости источник должен быть ДО gain-стема (какой узел? chainA.stems.get('vocals') — .outputNode? .gainNode? — 001 должен решить, сверяясь со StemChain/StemPlayerV3 API).

— 007 · 30.08 · скаут-пакет ARC-2e
