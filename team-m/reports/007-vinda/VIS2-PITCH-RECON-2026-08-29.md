# VIS-2 · RECON: подключён ли ПИЧ к V3
- Дата: 2026-08-29
- HEAD: a691c2f
- Роль: explore (быстрый). Только чтение кода, без правок.
- Контекст: ENGINE_MODE='v3' (src/engine-mode.ts:4-5, дефолт). V2-бутстрап вырезан (js/audio-engine.js не грузится в index.html, patchV1WithV2 нигде не вызывается).

## ВЕРДИКТ: НЕТ
Питч к V3 не подключён. Более того — в V3-режиме «мёртвы» ОБА источника (и мик, и вокал-трек), потому что модуль пича читает V2-эровые глобали `window.audioEngine.{audioContext|vocalsGain|stems}`, которых у V3-фасада нет. Реальный V3-граф (HybridPipelineService/StemChain) питчем вообще не трогается.

## Цепочка аудио (file:line)

### Источник в pitch-engine (факт, а не предположение)
- `src/audio/pitch/pitch-engine.ts:46-52` — `_getContext()` берёт `ctx` только из `(window as any).audioEngine.audioContext`; при отсутствии бросает `Error('audioEngine.audioContext not found')`.
- `src/audio/pitch/pitch-engine.ts:65-75` — `initFromMic()` берёт мик-стрим из `window.audioEngine.microphoneStream` (либо `getUserMedia`).
- `src/audio/pitch/pitch-engine.ts:111-143` — `initFromNode(sourceNode)` — пассивный тап AnalyserNode; источник целиком определяет вызывающий код (сам по себе НЕ обращается к V3).
- Вывод к Вопросу 1: мик-детекция идёт от `(window.)audioEngine` (V2-контракт), трековый вокал — от узла, который ей передаёт PitchTab. НИКАКОГО обращения к V3-графу (StemChain/HybridPipelineService) в pitch-engine НЕТ.

### Кто даёт узел для вокала (PitchTab)
- `src/components/PitchTab.tsx:234-265` — эффект инита вокал-движка. Берёт `const vocalsGain = ae?.vocalsGain` и `const aeHasVocals = ae?.stems?.has('vocals')` из `window.audioEngine` (PitchTab.tsx:235,241-242).
- `src/components/PitchTab.tsx:245-254` — `if (!vocalsGain || !aeHasVocals) return false;` → создаёт `new PitchEngine()` + `eng.initFromNode(vocalsGain)` только если эти V2-поля живы.
- `src/components/PitchTab.tsx:309` — мик-движок: `eng.initFromMic()` (→ _getContext → window.audioEngine.audioContext).

### Что такое window.audioEngine в V3
- `index.html:397` грузит `js/audio-facade-v3.js`. `js/audio-engine.js` (где `window.audioEngine = new AudioEngine()`, строка 33) в index.html НЕ загружается (V2-бутстрап вырезан).
- `js/audio-facade-v3.js:81` — `if (!window.audioEngine) window.audioEngine = facade;`. Итого в V3 `window.audioEngine` = ЭТОТ V3-фасад.
- `js/audio-facade-v3.js:8-79` — фасад НЕ имеет `audioContext`, `vocalsGain`, `stems` (есть только getCurrentTime/play/pause/loadTrack-заглушка/hybridEngine/getStemAnalyser-заглушка и т.п.).
- `src/audio/compat/patchV1.ts:9` (`patchV1WithV2`) НИГДЕ не вызывается в проде → V2-движок не создаётся, `window.audioEngine` не дополняется V2-полями.

### Следствие (Вопросы 1-3)
- Вопрос 1: pitch-engine берёт аудио исключительно из `window.audioEngine` (мик) и из узла, переданного PitchTab (вокал = `window.audioEngine.vocalsGain`). НЕ из V3-графа. В V3 оба этих источника пусты.
- Вопрос 2: `activatePitchBridge` (`src/audio/pitch/pitch-visual-bridge.ts:9`) вызывается ТОЛЬКО из `src/stores/pitch.store.ts:70` внутри `startPitch` (без проверки ENGINE_MODE). `startPitch` дёргается из `src/components/PitchModule.tsx:104-105` (кнопка). ВВ_ том же `pitch.store.ts:45,49` стоит `PitchEngine.get()` и `engine.init()` — у класса `PitchEngine` нет ни статического `get()`, ни метода `init()` (см. pitch-engine.ts), поэтому этот путь (PitchModule) падает сам по себе независимо от режима. Мост ведёт только на legacy `window.pianoKeyboard` (`pitch-visual-bridge.ts:10-21`), данных из V3 в него не поступает.
- Вопрос 3: `vocalColor` в PitchTab питается от вокал-движка (`useStableVocalData`, PitchTab.tsx:123,339), который создаётся только при наличии `window.audioEngine.vocalsGain`+`stems` (PitchTab.tsx:241-245). В V3 фасад этих полей не имеет → `tryInit()` возвращает false → вокал-движок не создаётся → `vocalColor`/вокал-пич МЁРТВ. Мик-движок тоже МЁРТВ: `initFromMic`→`_getContext` бросает «audioEngine.audioContext not found» (pitch-engine.ts:49), т.к. фасад не даёт AudioContext.

## Что живо/что мёртво в V3
- МИК-детекция (getUserMedia → worklet YIN): МЁРТВА в V3. Причина — `_getContext()` падает на отсутствии `window.audioEngine.audioContext` (pitch-engine.ts:46-52). Жива ТОЛЬКО в V2-режиме, где window.audioEngine — реальный V2-движок.
- ВОКАЛ-ТРЕК детекция (pitch вокала трека): МЁРТВА в V3. Причина — `window.audioEngine.vocalsGain`/`stems` отсутствуют на V3-фасаде (PitchTab.tsx:241-245).
- Реальный V3-граф (HybridPipelineService._stretchMeters['vocals'] / getStemAnalyser('vocals'), HybridPipelineService.ts:600-602) питчем НЕ используется.
- Итог: в V3 пич полностью не функционален (оба канала мертвы) — сильнее гипотезы «mic жив, vocal мёртв».

## Файлы для ARC-2 (список + что менять — БЕЗ правок)
1. `src/audio/pitch/pitch-engine.ts` (строки 46-52 `_getContext`, 65-75 мик-стрим) — добавить фолбэк на V3-шаренный `getAudioContext()` (src/audio/core/audioContext.ts:12-17) и брать мик-стрим из `MicSourceV3.acquire()` (src/audio/engine-v3/services/MicSourceV3.ts:33) вместо `window.audioEngine.microphoneStream`.
2. `src/components/PitchTab.tsx` (строки 234-265, ключ 241-254) — заменить источник вокал-движка `window.audioEngine.vocalsGain`/`stems` на V3-аналайзер `window.__belive.pipeline.getStemAnalyser('vocals')` (HybridPipelineService.ts:600); при отсутствии pipeline — грациозный no-op.
3. `src/audio/engine-v3/pipeline/HybridPipelineService.ts` (строка 600 `getStemAnalyser`) — это целевой V3 vox-тап (AnalyserNode пост-fader вокала); убедиться, что он экспонирован/доступен для pitch (сейчас читается через `window.__belive.pipeline`).
4. `src/audio/engine-v3/services/MicSourceV3.ts` (строка 33 `acquire`) — целевой V3 мик-источник для `initFromMic`.
5. `src/audio/core/audioContext.ts` (строки 12-17 `getAudioContext`) — шаренный V3 AudioContext как фолбэк для `_getContext`.
6. `src/stores/pitch.store.ts` (строки 41-49 `startPitch`/`PitchEngine.get()`/`engine.init()`, 70 `activatePitchBridge`) — убрать несуществующие `get()`/`init()`; сделать вызов `activatePitchBridge`/инит движка ENGINE_MODE-осознанным и вести на V3-источники; мост сейчас бьёт только в legacy `window.pianoKeyboard`.
7. `js/audio-facade-v3.js` (строки 8-79, 81) — опционально: добавить совместимые геттеры `audioContext`/`vocalsGain`/`stems` (проброс к V3-графу), чтобы не ломать читающие `window.audioEngine` модули; это заплатка, основное решение — пункты 1-2.

## Прямой вход в ARC-2 миграции
- Задача «подключить пич к V3» = переключить источники пича с `window.audioEngine` (V2-контракт) на V3-граф: мик → `MicSourceV3`, вокал → `HybridPipelineService.getStemAnalyser('vocals')`, AudioContext → `getAudioContext()`. Файлы-мишени: pitch-engine.ts, PitchTab.tsx, pitch.store.ts (пункты 1,2,6).
