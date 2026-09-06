# RNNOISE-001 · Круг-1 · СКОУП+ДИЗАЙН мик-шумодава (rnnoise-wasm, jitsi Apache-2.0)

Дата: 2026-09-02 · Роль: 001 Архитектор · Канон: tsc=290 · vitest 808+0int+0load · HEAD 23bed3d
Frozen: AudioEngineV2.ts, patchV1.ts, bridges/*, track.orchestrator.ts — НЕ трогаем. RNNoise = новый код + точечные правки MicSourceV3 (не frozen), MonitorRouter (не frozen), pitch-engine, ControlDeck, main.tsx.

## РЕШЕНИЕ (суть)

MicGraphV3 = **расширение MicSourceV3** (не сервис): MicSourceV3 уже владеет стримом и refcount, а шумодав — это обработка между acquire и потребителями. MicSourceV3.acquire() начинает возвращать **denoised MediaStream** (когда RNNoise включён), а сырой стрим остаётся внутренним. Потребители (питч-ворклет, монитор/vmix, REC) не меняют код потребления — меняется только источник. REC остаётся на сыром пути (архивная правда) через отдельный accessor.

## СТРУКТУРА (под-задачи)

### ① RnnoiseWorklet — новый файл `src/audio/engine-v3/services/RnnoiseWorklet.ts` (~30 строк)
- WASM грузится **внутри** AudioWorkletGlobalScope (паттерн jitsi): `fetch(wasmUrl) → WebAssembly.instantiate` в processor-коде, НЕ через addModule-параметры. Прецедент WASM-URL: audio-analysis.service.ts:115 (`@libraz/libsonare/wasm?url`), Vite-URL addModule: pitch-engine.ts:122-124.
- Интерфейс: `class RnnoiseProcessor extends AudioWorkletProcessor` — process() копирует input[0][0]→output[0][0] через WASM-denoise, frame 128 сэмплов (native rnnoise = 48kHz; см. РИСК-4).
- WASM-файл: `src/audio/engine-v3/vendor/rnnoise.wasm` (рядом с SignalsmithStretch.mjs — прецедент vendor-зоны). Загрузка в ворклет: `new URL('../vendor/rnnoise.wasm', import.meta.url)` — Vite резолвит и в dev, и в build (тот же механизм, что yin-processor.js:122).

### ② MicGraphV3 — расширение MicSourceV3 (файл остаётся `services/MicSourceV3.ts`)
Решение: **расширение, не сервис**. Почему: acquire/release/refcount/setDevice уже канон; отдельный MicGraphV3-сервис дублировал бы refcount и создал вторую точку владения стримом (гонки). Шумодав = опция внутри владельца.
- `MicSourceV3.ts:33-47` acquire(): после `_open()` — если `_denoiseEnabled` и граф жив, возвращаем `this._denoisedStream` вместо `this._stream`. Инвариант: acquire возвращает denoised-стрим ⇔ шумодав ON и WASM жив.
- Новые поля: `_denoiseEnabled=false`, `_graph: {src, worklet, gain, dest} | null`, `_denoisedStream: MediaStream | null`, `_wasmReady: Promise<boolean> | null`.
- `_open()` :72-88: после getUserMedia — если `_denoiseEnabled`, строим граф `stream→createMediaStreamSource→RnnoiseWorklet→denoisedGain→MediaStreamAudioDestinationNode` (denoised-gain=1.0). WASM-инициация ленива: первый включённый acquire.
- `setDenoise(on: boolean)`: ON → строит граф на живом стриме (или откладывает до первого acquire); OFF → crossfade 20ms (прецедент MonitorRouter:180-185) → disconnect графа, acquire возвращает сырой стрим. Тоггл в рантайме = пересборка только графа, НЕ стрима.
- `setDevice` :56-65: `_stop()` закрывает и граф (disconnect + worklet.port.postMessage({type:'dispose'})); `_open()` пересоздаёт с тем же `_denoiseEnabled` — состояние опции переживает смену устройства.
- REC-путь: новый accessor `getRawStream(): MediaStream | null` — takes.recorder.ts:77-80 остаётся на сыром стриме (архивная правда). Правка takes.recorder.ts:77: `src.acquire()` → `src.getRawStreamOrAcquire()` (см. ③).

### ③ Переключение потребителей
- **Питч-ворклет** (pitch-engine.ts:81-86): acquire уже возвращает denoised-стрим — **код pitch-engine не меняется**. initFromMic берёт стрим у micSource; когда шумодав ON, YIN получает уже чистый сигнал (лучше для детекции: меньше ложных pitch на шуме). Это главный выигрыш расширения vs сервис: ноль правок в pitch-engine.
- **Монитор/vmix** (ControlDeck.tsx:401-408): `src.acquire()` → `createMediaStreamSource(stream)` → `router.micInput` — уже получает denoised, код не меняется. `__micMonitorNode`-слот :393/:406 остаётся.
- **REC** (takes.recorder.ts:77): точечная правка — берёт raw. Новый метод MicSourceV3: `acquireRaw(): Promise<MediaStream>` — тот же refcount, но возвращает `this._stream` (сырой). REC-инвариант: записываем то, что слышал микрофон, до обработки.
- **vmix-тап** (MonitorRouter:156): питается от micInput — denoised автоматически. Ноль правок.

### ④ G14-патч — MonitorRouter.ts:161-172 (не frozen)
- `setMicMonitor` :165: `const compMs = outputLatency*1000` → `compMs += rnnoiseDelayMs` (пак: compMs+=rnnoiseDelayMs).
- **🔴 РАСХОЖДЕНИЕ с диспатчем 007**: в выжимке «compMs+=rnnoiseDelayMs» — но по физике G14 компенсация = **задержать** мик в наушниках, чтобы он не опережал playback. RNNoise добавляет мику задержку ⇒ чтобы синхронность сохранилась, `_micDelay` должен **уменьшиться**: `compMs -= rnnoiseDelayMs` (с clamp ≥0). Знак зависит от того, что считает «компенсацией» G14: если rnnoiseDelayMs уже входит в outputLatency-замер — правка не нужна вовсе. Решение за 002: измерить фактическую задержку тракта с включённым RNNoise; формула в отчёте — `delayTime = max(0, compMs − rnnoiseDelayMs)`. Если диспатчер имел в виду «добавить к измеренной компенсации» — тогда +=, но тогда мик в наушниках опоздает на 2×rnnoiseDelay. Требую подтверждения знака у 007/Босса до имплементации.
- rnnoiseDelayMs ≈ frame 128/48000 × (глубина FIFO ворклета, у jitsi ~1-2 фрейма) ≈ 2.7-5.3ms — на грани слышимости; патч мал, но честен.

### ⑤ Bypass-тоггл + фолбэк
- Тоггл: `MicSourceV3.setDenoise(on)` (②) + UI-кнопка в ControlDeck (рядом с 🎤, паттерн VMix-кнопки :370-384). Default OFF (шумодав = опция).
- Фолбэк: WASM не грузится (fetch/instantiate reject внутри ворклета) → ворклет шлёт `port.postMessage({type:'wasm-fail'})` → MicGraphV3 ловит, disconnect графа, `_denoiseEnabled=false`, acquire возвращает сырой стрим. **НЕ падение**: тихая деградация + console.warn + CustomEvent `denoise-state-changed` (прецедент E15/E19 bridge-compat :171, :204). UI показывает тоггл OFF.
- Гонка «тоггл в момент in-flight acquire»: gen-гвард по образцу pitch-engine `_initGen` :44/:72 — setDenoise инкрементит gen, acquire-резолв с чужим gen → rebuild графа.

### ⑥ ТЕСТЫ — 8 новых (файл `src/audio/engine-v3/services/__tests__/MicSourceV3Denoise.test.ts`)
1. `RN-1: setDenoise(true) до acquire → acquire возвращает denoised-стрим (≠ raw), refcount=1`
2. `RN-2: acquireRaw → raw-стрим; REC-путь не проходит через worklet (raw.getTracks() ≠ denoised.getTracks())`
3. `RN-3: setDenoise(false) при живом графе → acquire возвращает raw, граф disconnected, refcount сохранён`
4. `RN-4: setDevice при denoise ON → граф пересоздан на новом стриме, denoise-состояние пережило смену`
5. `RN-5: WASM-fail (ворклет postMessage wasm-fail) → acquire возвращает raw, denoiseEnabled=false, события denoise-state-changed=off, НЕ throw`
6. `RN-6: гонка — setDenoise в in-flight acquire → gen-гвард, один граф, refcount-баланс acquire/release`
7. `RN-7: G14 — setMicMonitor при denoise ON → _micDelay.delayTime = max(0, compMs − rnnoiseDelayMs)` (после подтверждения знака)
8. `RN-8: release до 0 при живом графе → граф dispose вместе со стримом (нет утечки worklet/WASM)`
Моки: MockAudioContext.ts (существующий) + MockMediaStreamAudioDestinationNode + заглушка AudioWorkletNode (port-объект). Интеграционных нет — фаза-1 юнит-уровень.

## ПОЧЕМУ МИНИМАЛЬНО
1. **Ноль правок в pitch-engine и ControlDeck-мик-путь**: acquire() меняет возвращаемое — потребители слепы к шумодаву. Одна точка изменения вместо трёх.
2. **Один владелец стрима**: расширение MicSourceV3 сохраняет канон refcount (82e1c76) — сервис MicGraphV3 создал бы второй refcount и вторую точку setDevice-обработки.
3. **Ноль новых сущностей уровня приложения**: 1 ворклет-файл + 1 WASM в vendor + правки 4 существующих файлов. REC через MediaStreamDestination — фаза-2, не тащим.

## ЦЕНА/РИСК
- **Latency-бюджет**: +2.7-5.3ms на мик-путь (1-2 фрейма 128). Для самоконтроля компенсируется G14-патчем; для питча несущественно (YIN не чувствителен к 5ms). vmix-путь без delay-узлов (MonitorRouter:154) — мик в vmix опоздает на rnnoiseDelayMs; допустимо (vmix = мониторинг, не запись).
- **Refcount-гонки**: acquire возвращает denoised, но refcount один на стрим — гонок нет; единственное окно — тоггл в in-flight (закрыт gen-гвардом RN-6).
- **Бандл**: rnnoise.wasm ~90KB (jitsi-сборка) — грузится лениво (только при ON), в основной чанк не попадает (динамический URL-импорт в ворклет).
- **Патент Xiph**: rnnoise-wasm jitsi = Apache-2.0, но RNNoise-модель от Xiph — патентная политика Xiph «no patent claims» покрывает; LICENSE-файл в vendor обязателен + атрибуция в NOTICE. Юр. чистота = Apache-2.0 + Xiph MIT-дух, риск низкий.
- **Sample-rate**: rnnoise native 48kHz; при ctx 44.1kHz нужен ресемпл или 48k-стрим — jitsi-ворклет самодостаточен (внутри WASM-конверсия), но 002 должен проверить сборку на 44.1k (РИСК-4 из ①).

## АЛЬТЕРНАТИВА-Y
Отдельный MicGraphV3-сервис, владеющий графом и реэкспортирующий стрим: отвергнута — дублирует refcount MicSourceV3, требует правок во всех трёх потребителях и второй setDevice-ветки; вычислительной разницы ноль, движущихся частей больше.

## 🔴 БОССУ (списком)
1. Знак G14-патча: `compMs −= rnnoiseDelayMs` (мой расчёт) vs `+=` (диспатч) — нужно решение до имплементации; иначе мик в наушниках рассинхронится на 2×delay.
2. Sample-rate 44.1kHz: проверить jitsi-rnnoise-wasm сборку (native 48k) — если нет конверсии, нужен resampler-ворклет (+1 движущаяся часть, лучше не надо).
3. REC-путь: подтверждаю raw (архивная правда) — но фаза-2 (REC через MediaStreamDestination) уже спроектирована под denoised-выход; следить, чтобы acquireRaw не стал мёртвым кодом.
4. Default OFF — шумодав как опция: UI-тоггл добавляет кнопку в ControlDeck; если Босс хочет default ON при живом WASM — скажи, это одна строка в MicSourceV3-конструкторе.
5. 90KB WASM ленив — бандл не растёт; но первый ON даёт fetch-задержку ~100-300ms — тоггл должен показывать «включается…» состояние (UI-нюанс для 002).
