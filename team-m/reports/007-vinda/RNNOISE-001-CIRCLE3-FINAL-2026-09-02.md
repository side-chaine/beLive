# RNNOISE-001 · Круг-3 · ФИНАЛ «RNNOISE-FINAL» v1.0 — мик-шумодав (rnnoise-wasm, jitsi Apache-2.0)

Дата: 2026-09-02 · Роль: 001 Архитектор · Канон: tsc=290 · vitest 808+0int+0load (69 файлов) · HEAD 23bed3d
Frozen: AudioEngineV2.ts, patchV1.ts, bridges/*, track.orchestrator.ts — не задеты (проверено по списку файлов ниже).
Статус: спека имплементационно-готова для 009. Все патч-условия 002 внесены.

## РЕШЕНИЕ

MicSourceV3 = расширение существующего владельца стрима (не сервис): acquire() возвращает denoised-стрим, когда шумодав ON и WASM жив; сырой стрим остаётся внутренним (REC — через acquireRaw). Четыре патча 002 вшиты: **UI-гейт тоггла при refCount=0**, **connect-after-ready**, **гвард 48kHz через wasm-fail-путь**, **wasmUrl через processorOptions**. Рантайм-тоггл под живыми потребителями исключён by design (не «починен» — запрещён).

## ОТВЕТ НА СТРЕСС 002 (по каждому)

| Пункт 002 | Вердикт | Действие в финале |
|---|---|---|
| FM-1 тоггл под живыми потребителями | **ПРИНЯТО** | UI-гейт refCount=0 + no-op-гвард в setDenoise (②e) |
| FM-2 wasm-fail после подключения = вечная тишина | **ПРИНЯТО** | connect-after-ready: ноды коннектятся только после 'ready' (②c) |
| FM-3 44.1kHz без гварда | **ПРИНЯТО** | sampleRate!==48000 → тот же тихо-деградационный путь, что wasm-fail (②d) |
| FM-4 dispose-порядок → утечка worklet | **ПРИНЯТО** | Порядок в _stop() + RN-8 ассертит disconnect-список (②f) |
| FM-5 setDevice при живом REC | **ПРИНЯТО частично** | Pre-existing баг (не введён спекой): known-issue задокументирован, RN-4 ассертит живость raw-треков; фикс = отдельная задача, не этот круг |
| FM-6 import.meta в ворклете → прод-404 | **ПРИНЯТО** | processorOptions.wasmUrl из main-потока (①); моё цитирование yin-паттерна в круг-1 было ошибочным — паттерн живёт в pitch-engine.ts:122 (main), не в ворклете |
| FM-7 UI-pending | **ПРИНЯТО** | Обязательный pending-стейт кнопки на время _wasmReady (⑤) |
| FM-8 acquireRaw при null | **ПРИНЯТО** | acquireRaw = внутренний acquire(), вернуть raw (②b) |
| FM-9 rnnoiseDelayMs занижен | **ПРИНЯТО** | Константа 10.67мс (кадр модели 480, не worklet-квант 128); диапазон 10.67–21.33; калибровка импульсом при имплементации (④) |
| Удар-6 addModule без кэша | **ПРИНЯТО** | Module-level флаг по образцу pitch-engine.ts:8 (②a) |
| Удар-10 ретрай после fail | **ПРИНЯТО** | _wasmReady=null при fail (②g) |
| G14-знак | **ПОДТВЕРЖДЕНО** | −= (001 и 002 согласны); диспатч-«+=» отвергнут физикой. Моё число 2.7–5.3мс было ошибкой — исправлено на 10.67–21.33 |

Отклонений нет. 002 прав по всем пунктам; ядро круг-1 (расширение, единый refcount, raw-REC, lazy-WASM) выжило без изменений.

## СТРУКТУРА (финальная)

### ① Новый файл `src/audio/engine-v3/services/rnnoise-processor.js` (~50 строк, plain JS)
Уточнение круг-1: **.js, не .ts** — прецедент yin-processor.js (222 строки, тот же каталог-паттерн); tsc его не видит.
- `registerProcessor('rnnoise-processor', …)`; constructor(processorOptions) берёт **wasmUrl из processorOptions** (НЕ import.meta — FM-6): `fetch(wasmUrl) → WebAssembly.instantiate → port.postMessage({type:'ready'})`; fail → `postMessage({type:'wasm-fail'})`.
- process(): FIFO-буфер 128-сэмпловых квантов → кадры **480 сэмплов** (кадр модели rnnoise, native 48k) → wasm-denoise → output. Глубина FIFO=1 (10.67мс).
- port.onmessage `{type:'dispose'}` → освобождение wasm-инстанса.

### ② Правки `src/audio/engine-v3/services/MicSourceV3.ts` (не frozen)
Новые поля: `_denoiseEnabled=false`, `_graph:{src,worklet,gain,dest}|null`, `_denoisedStream`, `_wasmReady:Promise<boolean>|null`, `_denoiseGen=0`, module-level `_rnnoiseModuleLoaded=false`.

- **a) addModule-кэш**: `new URL('./rnnoise-processor.js', import.meta.url)` → addModule один раз (образец pitch-engine.ts:121-124, флаг :8).
- **b) acquireRaw(): Promise<MediaStream>** — внутренне полный acquire() (refcount + _open при null → REC-first работает, FM-8), возвращает `this._stream` (raw). Правка takes.recorder.ts:84: `src.acquire()` → `src.acquireRaw()`. REC-инвариант: архивная правда, до обработки.
- **c) setDenoise(on): Promise<boolean> + connect-after-ready (FM-1/FM-2)**:
  - Гвард: `_refCount>0` → no-op + warn (программный вызов); UI-кнопка disabled при refCount>0 (⑤). Тоггл = только при мёртвом графе.
  - ON: `_denoiseGen++`; addModule (кэш) → создать ноды: createMediaStreamSource(raw), AudioWorkletNode(ctx,'rnnoise-processor',{processorOptions:{wasmUrl}}), gain=1.0, MediaStreamAudioDestinationNode — **все созданы, НО source не подключён**; wasmUrl = `new URL('../vendor/rnnoise.wasm', import.meta.url).href` (main-поток, корректный прецедент pitch-engine.ts:122).
  - Await 'ready' (с gen-гвардом) → **только тогда** connect: src→worklet→gain→dest; `_denoisedStream = dest.stream`.
  - 'wasm-fail' → разбор нод без подключения, `_denoiseEnabled=false`, `_wasmReady=null` (ретрай, удар-10), console.warn + CustomEvent `denoise-state-changed {enabled:false, reason}` (прецедент E15/E19, MonitorRouter.ts:171/:204). Потребители получают raw — **живы всегда**.
  - OFF: crossfade 20ms (прецедент MonitorRouter.ts:180-185) → disconnect графа → acquire возвращает raw.
- **d) Гвард 48k (FM-3)**: в setDenoise ON: `ctx.sampleRate !== 48000` → тот же путь, что wasm-fail (тихая деградация + event + warn). Считаем jitsi-сборку НЕ конвертирующей (вывод 002-⑥). Resampler запрещён каноном.
- **e) acquire() :33-47**: инвариант — возвращает `_denoisedStream` ⇔ `_denoiseEnabled && _graph жив`; иначе raw. Сигнатура не меняется → pitch-engine.ts:86 и ControlDeck.tsx:401 слепы (ноль правок потребления).
- **f) _stop() :67-70 — dispose-порядок (FM-4)**: (1) disconnect всех нод графа, (2) worklet.port.postMessage({type:'dispose'}), (3) raw tracks.stop(), (4) `_denoisedStream=null`.
- **g) setDevice :56-65**: _stop() сносит граф; _open() пересоздаёт с тем же _denoiseEnabled (connect-after-ready заново). Состояние опции переживает смену устройства.

### ③ Потребители — ноль правок потребления
- pitch-engine.ts:86 — acquire уже отдаёт denoised; YIN получает чистый сигнал (меньше ложных питчей). Не правим.
- ControlDeck.tsx:401-411 (мик-монитор) — не правим; vmix-тап MonitorRouter (micInput) — denoised автоматически.
- takes.recorder.ts:84 — единственная правка: acquireRaw() (②b).

### ④ G14-патч — `MonitorRouter.ts` (не frozen)
- Константа в шапке: `const RNNOISE_DELAY_MS = 10.67` (1 кадр 480@48k; FIFO=2 → 21.33; калибровка импульсом при имплементации).
- Constructor: подписка на `denoise-state-changed` → `_rnnoiseActive` (прецедент bridge-compat-событий :171/:204).
- setMicMonitor :165-167: `const compMs = Math.max(0, ((ctx.outputLatency||0)*1000) − (this._rnnoiseActive ? RNNOISE_DELAY_MS : 0))` → `_micCompensationMs = compMs` (:166) → delayTime (:167). Хранение в _micCompensationMs делает :247/:256 (setDelayMs/setCompensateTarget) консистентными автоматически.

### ⑤ UI — `ControlDeck.tsx`
Кнопка шумодава рядом с 🎤 (паттерн VMix :370-384): **disabled при refCount>0** (FM-1) **и на время _wasmReady** (FM-7, pending-стейт «включается…» 100-300ms первого fetch). Слушает `denoise-state-changed` для синхронизации статуса (в т.ч. wasm-fail → OFF).

### ⑥ `src/audio/engine-v3/vendor/rnnoise.wasm` (~90KB) + `vendor/rnnoise-LICENSE` (Apache-2.0) + атрибуция в NOTICE. Рядом с SignalsmithStretch.mjs — прецедент vendor-зоны. Лениво: грузится только при ON, в основной чанк не попадает.

## G14 — ФИНАЛЬНАЯ ФОРМУЛА

```
micDelay = max(0, outputLatency·1000 − RNNOISE_DELAY_MS)   // RNNOISE_DELAY_MS = 10.67 (FIFO=1)
```
Числа (outputLatency ≈ 43мс на проводе): FIFO=1 → **32.33мс**; FIFO=2 (21.33) → **21.67мс**. Вариант «+=» (диспатч): 53–64мс → рассинхрон 20–42мс — за порогом слышимости, отвергнут. rnnoiseDelay = кадр модели 480 сэмплов (10мс) + буферизация ≥4 квантов ворклета = 10.67мс минимум; константа консервативна, точное значение — импульс-калибровка в круге имплементации (задача 009, ассерт RN-7 обеих границ).

## ТЕСТЫ — 12 (файл `src/audio/engine-v3/services/__tests__/MicSourceV3Denoise.test.ts`)

1. **RN-1**: setDenoise(true) при refCount=0 → граф построен после 'ready', acquire возвращает denoised (≠raw), refcount=1
2. **RN-2**: acquireRaw → raw (треки ≠ denoised); REC-first (refCount=0, _stream=null) не падает (FM-8)
3. **RN-3**: setDenoise(false) при живом графе → acquire raw, граф disconnected, refcount сохранён
4. **RN-4**: setDevice при denoise ON → граф пересоздан (connect-after-ready), состояние пережило смену; **ассерт: raw-треки живы при refCount>0** (FM-5)
5. **RN-5**: wasm-fail → enabled=false, event off, acquire raw, НЕ throw; **ретрай**: повторный ON делает новый fetch (FM-10)
6. **RN-6**: гонка setDenoise в in-flight acquire → gen-гвард, один граф, refcount-баланс
7. **RN-7**: G14 — setMicMonitor при denoise ON → delayTime = max(0, compMs−10.67)/1000; **ассерт обеих границ** (10.67→32.33; 21.33→21.67)
8. **RN-8**: release→0 → dispose-порядок: все ноды (src, worklet, gain, dest) disconnected, worklet получил {type:'dispose'}, _denoisedStream=null (FM-4)
9. **RN-9**: setDenoise при refCount>0 → no-op + warn, граф не тронут (FM-1)
10. **RN-10**: ctx.sampleRate=44100 → тихая деградация (путь wasm-fail), event off, acquire raw (FM-3)
11. **RN-11**: AudioWorkletNode создан с processorOptions.wasmUrl (абсолютный URL); в исходнике ворклета нет import.meta (FM-6)
12. **RN-12**: connect-after-ready — src НЕ подключён до 'ready'; fail → подключение никогда, потребитель получает raw (FM-2)

Моки: mockAudioContext.ts (существующий, `__tests__/`) + MockMediaStreamAudioDestinationNode + заглушка AudioWorkletNode (port-объект, управляемые 'ready'/'wasm-fail'). Юнит-уровень; интеграционных нет (фаза-1).

## tsc-ДЕЛЬТА (формулировка 005_2)

Новые файлы: rnnoise-processor.js (plain JS — вне tsc-графа, как yin-processor.js), MicSourceV3Denoise.test.ts (чистый TS), rnnoise.wasm (бинарник). Правки: MicSourceV3.ts, MonitorRouter.ts, ControlDeck.tsx, takes.recorder.ts — типизированы, публичные сигнатуры не меняются (acquire() прежний; новые методы acquireRaw/setDenoise). **Δ новых ошибок от новых файлов = 0; tsc остаётся 290.** vitest: +12 → ~820, 0int/0load.

## ПОЧЕМУ МИНИМАЛЬНО

1. Ноль правок потребления: acquire() меняет возвращаемое — pitch-engine/ControlDeck/vmix слепы; одна точка изменения вместо трёх.
2. Один владелец стрима: расширение MicSourceV3 сохраняет канон refcount (82e1c76); сервис MicGraphV3 = второй refcount + вторая setDevice-ветка.
3. Патчи 002 переиспользуют существующие механизмы: гвард 48k идёт по пути wasm-fail (ноль новых веток), processorOptions = уже существующий корректный прецедент в правильном месте, UI-гейт = одна кнопка disabled вместо event-переподключений.

## ЦЕНА/РИСК

- **Тоггл только при refCount=0** — осознанный трейд: пользователь выключит 🎤/REC перед шумодавом. Клейм «рантайм-тоггл» снят.
- **+10.67–21.33мс на мик-путь**: самоконтроль компенсирован G14; YIN нечувствителен; vmix-тап без delay-узлов (TASK-015) — мик в vmix опоздает на rnnoiseDelay, допустимо (мониторинг).
- **setDevice+REC** — known-issue (pre-existing): смена устройства при живой записи рвёт трек; вне этого круга, RN-4 ассертит живость raw-треков.
- **Первый ON = fetch 100–300мс** — закрыт pending-стейтом (FM-7).
- **Патенты**: jitsi Apache-2.0 + Xiph no-patent-claims; LICENSE в vendor + NOTICE обязателен.

## АЛЬТЕРНАТИВА-Y

Event-переподключение потребителей при тоггле (вместо UI-гейта): отвергнута — +2 движущиеся части (ControlDeck + pitch-engine слушают смену стрима), закрывает только FM-1, оставляя FM-2; гейт закрывает оба одной кнопкой.

## 🔴 БОССУ (обновлённый)

1. **G14 решён**: знак −= (001+002 единодушны, «+=» диспатча отвергнут физикой — рассинхрон 20–42мс). Формула: `max(0, outputLatency·1000 − 10.67)` → 32.33мс при 43мс. Константу подтвердить/откалибровать импульсом у 009.
2. **Рантайм-тоггл = гейт refCount=0**: шумодав переключается только при мёртвом мик-графе. Если Босс хочет тоггл под живыми потребителями — это event-переподключение, +2 движущиеся части, отдельное решение.
3. **44.1kHz**: считаем jitsi-сборку НЕ конвертирующей; не-48k-системы получают тихую деградацию (шумодав OFF, warn). Resampler не тащим.
4. **setDevice+REC** — known-issue вне круга: RN-4 ассертит живость raw-треков; фикс семантики setDevice = отдельная задача (назначь, если горит).
5. **Default OFF** + pending-UI первого ON. Если default ON при живом WASM — одна строка в конструкторе, скажи.
6. **REC-фаза-2** (denoised через MediaStreamDestination) не спроектирована здесь — acquireRaw не станет мёртвым кодом: фаза-1 держит REC на raw как архивную правду.
