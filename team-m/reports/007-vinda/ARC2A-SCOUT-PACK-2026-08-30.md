# ARC-2a SCOUT PACK — VIS-19 (фикс несуществующих PitchEngine.get()/init())

**БАЗА:** HEAD `d99609a` · 30.08 · V3 = дефолт · КАНОН-СНЭПШОТ: tsc=296 🔴 (в т.ч. VIS-19 TS2339), vitest=761 passed 🟢, PARITY PASS 🟢

> ⚠️ **КОРРЕКЦИЯ КАНОН-СНЭПШОТА (факт по файлу, а не по описанию):**
> Класс `PitchEngine` НЕ «имеет ТОЛЬКО `initFromMic`/`initFromNode`» и у него ЕСТЬ `destroy()`.
> Проверено: `git show d99609a:src/audio/pitch/pitch-engine.ts` (рабочее дерево == HEAD, `git status` чист для 4 файлов).
> Реально ОТСУТСТВУЮТ: **статический `get()`** и **инстансный `init()`** — вот корень VIS-19.
> Grep `static` по pitch-engine.ts → **0 совпадений** (никаких статических методов вообще).
> `destroy()` — инстансный метод, существует на **строке 207**.

---

## 1. pitch.store.ts — карта (строки → что происходит)

Файл целиком — 97 строк. Zustand-store, модульные (вне store) переменные для подписок.

- **8-24** `interface PitchState` — поля состояния:
  `status: PitchStatus`, `error: string|null`, `frequency: number|null`, `note: string|null`, `midi: number|null`, `cents: number`, `confidence: number`, `isSinging: boolean`; действия `startPitch: () => Promise<void>`, `stopPitch: () => void`.
  *(Поля `pitchEnabled` НЕТ — см. п.6 про тест.)*
- **26** `let _unsub: (() => void) | null = null;` — модульная подписка на engine.
- **27** `let _bridgeCleanup: (() => void) | null = null;` — cleanup моста.
- **28-29** `let _lastUpdate = 0;` / `const THROTTLE_MS = 100; /* 10Hz */`
- **31-40** `create<PitchState>(...)` начальное состояние: `status:'idle'`, остальное `null/0/false`.
- **41-43** `startPitch: async () => { const s = get(); if (s.status === 'running' || s.status === 'starting') return;`
- **45** ❌ `const engine = PitchEngine.get();` — БИТО: статического `get()` нет (TS2339).
- **46** `set({ status: 'starting', error: null });`
- **49** ❌ `await engine.init();` — БИТО: инстансного `init()` нет (TS2339).
- **51-68** `engine.subscribe((msg: WorkletMessage) => { ... })` — throttled 100ms обработчик: `type==='pitch'` → set frequency/note/midi/cents/confidence/isSinging:true; `silence`/`no_pitch` → `isSinging:false`. Результат `_unsub = engine.subscribe(...)`.
- **70** `_bridgeCleanup = activatePitchBridge();` — мост к legacy pianoKeyboard.
- **71** `set({ status: 'running' });`
- **72-77** `catch (err)` → `set({ status: 'error', error: ... })`.
- **80-82** `stopPitch: () => { _unsub?.(); _unsub = null;`
- **83-84** `_bridgeCleanup?.(); _bridgeCleanup = null;`
- **85** ❌ `PitchEngine.get().destroy();` — БИТО по `get()` (сам `destroy()` как инстансный метод существует).
- **86-95** сброс состояния в `idle/null/0/false`.

**Сигнатура startPitch (что должен делать по фактам кода):** на вход ничего не принимает; гвард по `status`; создаёт engine, инитиt, подписывается (throttle 100ms), активирует bridge, ставит `running`; при ошибке `error`. Источник (mic vs node) в store НЕ указан — код зовёт `engine.init()` (несущ.), значит выбор ложится на фикс (см. п.7). Возвращает `Promise<void>`.

---

## 2. PitchEngine API (метод:строка, сигнатура, примечание)

Файл `src/audio/pitch/pitch-engine.ts`, `export class PitchEngine` на **строке 20**. Конструктор **не определён** → no-arg default. `grep "static"` → **0 совпадений** (нет статических методов, в т.ч. `get`).

| Метод | Строка | Сигнатура | Примечание |
|---|---|---|---|
| (constructor) | 20 | `new PitchEngine()` | аргументов нет; `ring = new PitchRingBuffer(300)` (21) |
| `status` (getter) | 40 | `get status(): PitchStatus` | возвращает `_status` |
| `_getContext()` | 46 | `private _getContext(): AudioContext` | читает `(window).audioEngine.audioContext` (47-48); **бросает** `'audioEngine.audioContext not found'` (49) |
| `initFromMic()` | 56 | `async initFromMic(): Promise<void>` | режим A (AudioWorklet). Берёт `window.audioEngine.microphoneStream` если live (66-69) иначе `getUserMedia` (71); `ctx.resume()` (62); строит HP/LP + `AudioWorkletNode('yin-processor')` (93); `status='running'` |
| `initFromNode()` | 111 | `async initFromNode(sourceNode: AudioNode): Promise<void>` | режим B (AnalyserNode + YIN, main-thread). `ctx.resume()` (117); `createAnalyser()` (122); `setInterval(...,46)` (132); `status='running'` |
| `destroy()` | 207 | `destroy(): void` | **СУЩЕСТВУЕТ** (инстансный). Чистит worklet/lp/hp/analyser/timer, стопает stream если `_ownStream` (223-226), обнуляет поля, `ring.clear()`, `status='idle'`. ⚠️ **НЕ чистит `_listeners` (Set, 30)** — подписчики остаются в сете |
| `retarget()` | 246 | `async retarget(newSource: AudioNode): Promise<void>` | hot-swap node-источника (только passive-режим, guard `status!=='running'` возврат) |
| `pause()` | 265 | `pause(): void` | `clearInterval(_timer)` если running |
| `resume()` | 272 | `resume(): void` | перезапуск `setInterval` если analyser/ctx есть |
| `subscribe()` | 282 | `subscribe(fn: PitchListener): () => void` | `this._listeners.add(fn)`; возвращает remover `() => { _listeners.delete(fn) }` |
| `_onMsg()` | 289 | `private _onMsg(msg: WorkletMessage)` | push в `ring` (pitch) + `forEach` всем `_listeners` |

**ОТСУТСТВУЕТ (корень VIS-19):**
- `static get(): PitchEngine` — нет (grep `static` пуст, в классе нет). 3 сайта вызова (п.1:45, п.1:85, п.3:17).
- `init(): Promise<void>` (инстансный) — нет. 1 сайт вызова (п.1:49).

Точный счёт VIS-19 TS2339: 3 × `Property 'get' does not exist on type 'typeof PitchEngine'` (pitch.store.ts:45, pitch.store.ts:85, pitch-visual-bridge.ts:17) + 1 × `Property 'init' does not exist on type 'PitchEngine'` (pitch.store.ts:49).

---

## 3. pitch-visual-bridge.ts — карта

Файл целиком — 32 строки.

- **9** `export function activatePitchBridge(): () => void {`
- **10** `const piano = (window as any).pianoKeyboard;` — legacy клавиатура.
- **11-14** guard: если нет `piano` или нет `piano.feedExternalPitch` → `console.warn('[PitchBridge] legacy pianoKeyboard not found')` и `return () => {}` (noop).
- **16** `piano.externalMode = true;` — выключает legacy Pitchy.
- **17** ❌ `const engine = PitchEngine.get();` — БИТО: статического `get()` нет.
- **19-25** `engine.subscribe((msg) => { if ('pitch') piano.feedExternalPitch(frequency, confidence); else if ('silence'/'no_pitch') piano.clearExternalPitch(); })`.
- **27-31** возвращает cleanup: `unsub(); piano.externalMode = false; piano.clearExternalPitch();`.

**Что делает / зачем engine:** мост React→legacy. Подписывается на сообщения engine и кормит ими `window.pianoKeyboard`. ⚠️ engine ему НУЖЕН ТОТ ЖЕ ЭКЗЕМПЛЯР, что создал store (иначе подписка пойдёт на другой, неинициализированный engine и pianoKeyboard ничего не получит).

---

## 4. Сайты вызовов (кто → что → живой ли путь в V3)

- **startPitch** — единственный живой вызов:
  - `src/components/PitchModule.tsx:104` `const startPitch = usePitchStore(s => s.startPitch);`
  - `src/components/PitchModule.tsx:121` `onClick={running ? stopPitch : startPitch}` (кнопка `● Start` / `■ Stop`, :119-125). **ЖИВОЙ UI-путь.** ENGINE_MODE-гейта в PitchModule НЕТ.
  - Других вызовов `startPitch` в `src/` нет (grep).
- **stopPitch** — `PitchModule.tsx:105` (selector), `:121` (onClick). Только оттуда.
- **activatePitchBridge** — вызывается **ТОЛЬКО** из `src/stores/pitch.store.ts:70` (внутри `startPitch`). Больше нигде.
- **PitchTab.tsx** — `startPitch`/`stopPitch` НЕ зовёт. Вместо этого создаёт СВОИ engine через `new PitchEngine()`:
  - `PitchTab.tsx:252` `const eng = new PitchEngine();` + `eng.initFromNode(vocalsGain)` (vocal, guarded `ae?.vocalsGain` + `ae?.stems?.has('vocals')`, :241-245).
  - `PitchTab.tsx:307` `const eng = new PitchEngine();` + `eng.initFromMic()` (mic, по флагу `micActive`, :295-315).
  - Это отдельный живой путь (визуализатор таба), НЕ через store. В V3 `window.audioEngine.vocalsGain`/`stems` могут отсутствовать → vocal-ветка пропускается (return false, :245).
- **PianoKeyboard / ControlDeck** — вызовов `startPitch`/`stopPitch`/`activatePitchBridge` не найдено (grep).

---

## 5. Паттерны создания engine в проекте (2-3 примера)

1. **PitchTab.tsx — `new` внутри компонента, хранение в ref, lifecycle на useEffect:**
   - `:252` `const eng = new PitchEngine();` (vocal) + cleanup `eng.destroy()` в return useEffect (:287).
   - `:307` `const eng = new PitchEngine();` (mic) + cleanup `eng.destroy()` (:319).
   - Паттерн: инстанс создаётся лениво в эффекте, живёт пока активен флаг/доступен источник, уничтожается в cleanup.
2. **MicSourceV3 (`src/audio/engine-v3/services/MicSourceV3.ts`) — обычный класс, `new` + refcount:**
   - `:19` `export class MicSourceV3 {` constructor `:25` (читает localStorage deviceId).
   - Владеет mic-стримом, раздаёт через `acquire()/release()` с `_refCount` (:33-53) — инстансный, без глобального синглтона в самом классе.
3. **HybridPipelineService — создаётся один раз при bootstrap и вывешивается на `window.__belive.pipeline` (синглтон-на-окне):**
   - `src/main.tsx:125` `const pipeline = new HybridPipelineService(ctx);`
   - `src/main.tsx:170` `;(window as any).__belive.pipeline = pipeline;`
   - Потребители берут через `(window as any).__belive.pipeline` (напр. `src/takes/takes.duck.ts:26,48`).

Вывод по паттерну: «`new` + локальное владение» (PitchTab) и «`new` один раз + window-синглтон» (HybridPipelineService) — оба варианта НЕ используют статический `get()`. PitchEngine сейчас НИГДЕ не создавался как синглтон (кроме несуществующего `get()`).

---

## 6. Тесты pitch

- **`src/stores/__tests__/medium-stores.test.ts:15-22`** — блок `describe('pitch.store')`:
  - `:18` `beforeEach(() => usePitchStore.setState({ pitchEnabled: false }));`
  - `:20` `expect(usePitchStore.getState().pitchEnabled).toBe(false);`
  - ⚠️ Поле `pitchEnabled` **отсутствует** в текущем `PitchState` (см. п.1:8-24) — тест ссылается на несуществующее поле (zustand позволяет runtime-setState, но тип не совпадает; vitest через esbuild не типчекает → проходит).
  - **`startPitch`/`stopPitch` НЕ вызываются** (grep по файлу: только import + describe + beforeEach + 1 assert). То есть тест НЕ задействует сломанный путь — если бы дёргал `startPitch`, упал бы на `PitchEngine.get()`.
- Других pitch-тестов, дёргающих store, не найдено (grep `pitch` по `src/**/__tests__/**` → только этот блок). Копия `NEW-SONNET-MEGA-PACK.md` — не реальный тест.

---

## 7. Lifecycle-риски перевеса на `new PitchEngine()`

Факты (без предложений дизайна):

- **a) Чем инитировать в store.** В store нет доступного node-источника (vocalsGain живёт в `window.audioEngine` V2 / V3-pipeline, не в store). Единственный рабочий из доступного API — `initFromMic()` (сам берёт стрим: `window.audioEngine.microphoneStream` или `getUserMedia`, :66-74). То есть `startPitch` логично ведёт на mic-режим; `engine.init()` (нынешний код) заменяется на `initFromMic()`.
- **b) Зависимость bridge от ТОГО ЖЕ экземпляра.** `pitch-visual-bridge.ts:17` сам делает `PitchEngine.get()`. Если store перейдёт на `new PitchEngine()` (свой инстанс), а bridge продолжит звать `PitchEngine.get()` (или свой `new`), он подпишется на **другой, неинициализированный** engine → `window.pianoKeyboard` не получит питч (мост «молчит»). Фактическая связность: bridge должен получать engine store-а (тот же инстанс), иначе данные не дойдут.
- **c) Cleanup / double-subscribe.** `stopPitch` делает `_unsub?.()` (п.1:81) до `destroy()` — ок. Но `destroy()` (п.2:207) **не очищает `_listeners`** (Set, :30) — если engine НЕ уничтожается (только pause), старые подписчики висят. При перевесе важно дёргать `_unsub` перед `destroy`.
- **d) Риск ДВОЙНОГО создания engine.** PitchTab УЖЕ создаёт свои `new PitchEngine()` (vocal :252 + mic :307), независимо от store. Перевес store на `new PitchEngine()` добавит **третий** инстанс. Прямого конфликта состояния нет (engine изолированы), НО: store-кнопка (mic через `initFromMic`) + PitchTab-mic (`initFromMic`, по `micActive`) могут одновременно дёрнуть `getUserMedia`/захват микрофона, если оба пути активны.
- **e) `_getContext()` требует `window.audioEngine.audioContext`** (п.2:47-49) — бросает, если нет. В V3-дефолт-режиме наличие `window.audioEngine.audioContext` — фактическая предпосылка: без неё `initFromMic()` упадёт в catch store-а → `status:'error'`. (Нужно проверить агентам 001/002: есть ли `window.audioEngine` в V3-режиме.)
- **f) Контекст `destroy` по факту СУЩЕСТВУЕТ** (п.2:207) — значит `PitchEngine.get().destroy()` (п.1:85) ломается ТОЛЬКО по `get()`; после перевеса на `new PitchEngine()` вызов `.destroy()` на инстансе будет валиден.

---

*СОБРАНО explore-агентом (разведка). Файлы не изменялись (правило №0). HEAD `d99609a` подтверждён `git show` по всем 4 файлам.*
