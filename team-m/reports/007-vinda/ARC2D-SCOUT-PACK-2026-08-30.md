# ARC-2D SCOUT PACK · фасад audio-facade-v3.js → V3-пайплайн · 2026-08-30

**БАЗА: HEAD `d024a41` · 30.08 · собрал 007 (личная разведка; explore-скаут упал — модель hy3-free недоступна)**
**Канон: tsc=293 🔴 · vitest=779+0int+0load 🟢 (66 файлов) · PARITY PASS 🟢 · V3=дефолт**

---

## 1. Фасад целиком (`js/audio-facade-v3.js`, 82 строки, vanilla JS, ВНЕ tsconfig → BLB-26)

| Метод | Строка | Статус | Что дёргает |
|---|---|---|---|
| `getCurrentTime()` | :12-17 | ✅ РЕАЛ | `window.__belive.currentTime` (V3StatePublisher:88-89, 50ms tick) |
| `get hybridEngine` | :21-29 | ✅ РЕАЛ (_urls) | `__belive.trackUrls` (main.tsx публикует Blob URLs) |
| `play/pause/stop` | :30 | ❌ ПУСТЫШКА | — |
| `seekTo/setCurrentTime` | :31 | ❌ ПУСТЫШКА | — |
| `loadTrack` | :32 | ❌ ПУСТЫШКА (resolve) | — |
| `setInstrumentalVolume/setVocalsVolume/setMicrophoneVolume` | :33 | ❌ ПУСТЫШКА | — |
| `setStemVolume/setStemsEnabled/setStemMute/setStemSolo/setStemPan/setStemsMode` | :34 | ❌ ПУСТЫШКА | — |
| `getStemMeterLevel→0/getStemAnalyser→null` | :35 | ❌ ПУСТЫШКА | — |
| `getStemAudioBuffer(stemId)` | :36-43 | ✅ РЕАЛ | `__belive.pipeline.chainA.stems.get(stemId).getBuffer()` |
| `awaitStemReady(stemId, timeout)` | :44-64 | ✅ РЕАЛ | poll pipeline.chainA.stems |
| `enableMicrophone/disableMicrophone` | :65 | ❌ ПУСТЫШКА | — |
| `enableVocalMix/disableVocalMix` | :66 | ❌ ПУСТЫШКА | — |
| `getPlaybackRate(){return 1}/setPlaybackRate(){}` | :67 | ❌ ПУСТЫШКА | — |
| `attachProgramSource/detachProgramSource` | :68 | ❌ ПУСТЫШКА | — |
| `getProgramCaptureStream()` | :71-76 | ✅ РЕАЛ | `__belive.monitorRouter.captureStream.stream` |
| `ensureInstrumentalBuffer→null` | :77 | ❌ ПУСТЫШКА | — |
| `setLoop(){false}/clearLoop(){false}` | :78 | ❌ ПУСТЫШКА | — |
| **ОТСУТСТВУЕТ:** `audioContext` (шапка :5 сама требует — M1(342) незакрыт), `playbackRate`-геттер (нужен BRG-3: `vclock.anchor(t, ae?.playbackRate ?? 1)`), `stems`/`vocalsGain`/`microphoneStream` (V2-интерфейс, читают PitchTab:241-245/pitch-engine:46-52) | | | |

Установка: `:81` `if (!window.audioEngine) window.audioEngine = facade` — в index.html:397, ДО marker-manager.js (:400) и monitor-mix.js (:402) — eval-порядок шапки :3 соблюдён.

## 2. Потребители `window.audioEngine` (полный список, 55 файлов; топ-живые в V3)

**Реально читают transport-методы (оживают при наполнении):**
- `src/services/track.actions.ts:58` `w.audioEngine.stop()` (deleteTrack) · `:160` (clearAllTracks) — **живой путь** (вызывается из UI)
- `src/Rehearsal/bridge/rehearsal-trigger.bridge.ts` :37/:64/:76/:123 (hijack) · :126-128 `ae.play.bind/pause.bind/seekTo.bind` · :127/:131/:132 патч play/pause/seekTo · :201 `ae?.setStemVolume?.()` · :207 `ae?.setPlaybackRate?.()` · :216 · :220/:242 `vclock.anchor(t, ae?.playbackRate ?? 1)` · :281 `ae?.audioContext` — **Rehearsal-мост: пустышки = сетевые команды молча no-op** (мост «работает», но не играет у студента)
- `src/foundation/reactions/stem-engine-sync.ts` — НЕ фасад: `__belive.pipeline` напрямую (:135-:219) — эталон правильного паттерна
- `src/audio/compat/patchV1.ts` / `src/services/track.orchestrator.ts` / `src/bridges/*` — FROZEN, читают для V2-мира, НЕ трогаем
- `js/marker-manager.js`, `js/monitor-mix.js` — vanilla-JS легаси, читают getCurrentTime (уже реален)

**V2-интерфейсные читатели (НЕ оживут от фасада, это ARC-2e):** PitchTab.tsx:241-245 (`vocalsGain`+`stems.has('vocals')`), pitch-engine.ts:46-52 (`audioContext`+`microphoneStream`), FullAvatar, RehearsalBackground, useBackgroundManagers, mode-switch.service, trigger-visual.service, useStemWaveform, MonitorMixPanel, VolumeControls, InstrumentStrip, BpmControl, MixerPanel, QuickActions, takes/*, sync/*, catalog.store, exercise.interruption, practice/recording.stores, track-events/loop-events/markers-events/rehearsal-trigger-writer wrappers, audio-reactive — большинство либо гейтованы `ae?.` optional-chaining, либо сидят на `__belive.pipeline` напрямую.

## 3. `window.__belive` — назначение

- `HybridPipelineService.ts:119` — `if (!w.__belive) w.__belive = {}` (при init пайплайна) + пайплайн кладёт себя (grep `__belive.pipeline` — конструктор/инжект)
- `V3StatePublisher.ts:88-89,123-124` — `currentTime` (50ms)
- `V3StatePublisher` — также `trackUrls` (main.tsx публикует)
- `main.tsx` — `transport` (TransportV3 инстанс, `:191 transport.play(offset)` — авто-старт)
- `stem-reactive.ts:55,92` — читают `__belive.pipeline.getStemAnalyser/getStemMeterLevel` напрямую
- Фасад `:38/:50` читает `__belive.pipeline` → гарантированно назначен ДО первого обращения фасада (фасад ставится в index.html:397 до boot React; методы вызываются в рантайме после init пайплайна)

## 4. Мэппинг фасад → HPS (имена/сигнатуры РАЗНЫЕ — таблица)

| Фасад-имя | HPS-имя | Сигнатура HPS | Примечание |
|---|---|---|---|
| `play()` | `play(offset, rate)` | `async play(offset: number, rate: number)` :276 | transport-lock внутри; офсеты/rate обязательны |
| `pause()` | `pause()` | `async pause()` :338 | ✓ |
| `stop()` | `stop()` | `stop(): void` :357 | ✓ |
| `seekTo(t)` | `seek(time, rate)` | `async seek(time, rate)` :365 | ИМЯ И СИГНАТУРА ОТЛИЧАЮТСЯ |
| `setCurrentTime(t)` | `seek(time, rate)` | — | дубль seekTo |
| `setStemVolume(id,v)` | `setStemVolume(id, v)` | ✓ :531 | ✓ 1:1 |
| `setStemMute(id,mut)/setStemSolo` | `setStemMuted(id,m)` :559 / `soloStem(id,s)` :564 | ✓ | фасад имена setStemMute ≠ HPS setStemMuted |
| `getStemMeterLevel` | `getStemMeterLevel` :571 | `(): number` | ✓ 1:1 |
| `getStemAnalyser` | `getStemAnalyser` :600 | `(): AnalyserNode|null` | ✓ 1:1 |
| `setLoop()`/`clearLoop()` | `setLoop(start,end)` :443 / `clearLoop()` :449 | фасад `return false` | HPS void |
| `setPlaybackRate(r)` | `setPlaybackRate(rate)` :417 | ✓ 1:1 | обновляет `_currentRate` + stretchPool |
| **`getPlaybackRate`/`playbackRate`** | **НЕТ в HPS** — rate живёт в `TransportV3.clock.playbackRate` (геттер :103-104 `get playbackRate(): number`); HPS `_currentRate` приватное | | BRG-3-канал: facade должен читать `__belive.transport.playbackRate` (TransportV3:103) |
| **`audioContext`** | **HPS `get ctx()`** :134-135 (публичный, F-1 (431)) | `get ctx(): AudioContext` | — |

**Rate-источник:** `TransportV3.ts:103` `get playbackRate() { return this.clock.playbackRate }` — синхронно обновляется (`:42`, `:68` — «clock.playbackRate обновляется синхронно ДО throttled-коллбэка»). Transport-инстанс публикуется в `__belive.transport` (main.tsx), V3DataInterceptor/V3StatePublisher держат ссылку.

## 5. Rehearsal BRG-2/3/4 (строки, что молчит сегодня)

- **BRG-2:** `rehearsal-trigger.bridge.ts:126-128` — `ae.play.bind(ae)` — на пустышке `play(){}` bind жив (no-op функция), **не падает, но и не играет**. hijack патчит `:127 play`, `:131 pause`, `:132 seekTo` — патч на пустышках = broadcastTransport шлёт network-события «play» без звука. Retry-loop `:124` (setTimeout 500ms) ждёт `ae` — фасад уже стоит, retry не спасает от пустышек.
- **BRG-3:** `:39`, `:220`, `:242` — `vclock.anchor(t, ae?.playbackRate ?? 1)` — свойства нет → всегда 1 → после Tempo Ladder студент уплывает линейно.
- **BRG-4:** `:281` — `if (Math.abs(driftMs) > 100 && ae?.audioContext)` — свойства нет → кросс-чек дрифта слеп навсегда.
- **BRG-5:** студент шлёт только sync-request (роль student не hijack'ает :116) — дельта питча студента не доедет (архитектурный, не фасад).

## 6. Boot-порядок

`index.html:397` facade → `:400` marker-manager → `:402` monitor-mix. V2-`audio-engine.js` НЕ подключён в index.html (вырезан W3) → `:81` `if (!window.audioEngine)` ВСЕГДА true → фасад ставится в V3-режиме всегда. Pipeline назначается позже (main.tsx boot) — фасад-методы читают `__belive.pipeline` в момент вызова (не при eval) → гонки нет.

## 7. Тесты фасада/__belive

Фасад НЕ покрыт тестами (vanilla js вне include). `__belive` мокается в: `stem-engine-sync.test.ts:63,71,84`, `BusFader18.test.ts:126`, pitch-store.test (наш новый). window.audioEngine мокается в bridges-тестах (audio.bridge.test, mode-switch.bridge.test) и live-trail-controller.test. **Новых тестов на фасад в каноне нет — тест-файл фасада будет ПЕРВЫМ** (js/ вне include → отдельный подход: либо тест-харнесс через jsdom+import, либо решение цепи — тестировать только через потребителей).

## 8. Поверхность эффекта

Оживают при наполнении: Rehearsal-мост целиком (play/pause/seekTo/setStemVolume/setPlaybackRate → сеть реально рулит), vclock anchor (Tempo Ladder), track.actions stop (сегодня stop() на пустышке = **трек молчит после deleteTrack/clearAll** — но в V3 transport.stop уже происходит через `before-track-change` event от track.loader — надо проверить, не дублируем ли), marker-manager/monitor-mix (getCurrentTime уже жив). Грубо: **3 крит-пути + 8 вторичных**. PitchTab/pitch-engine не оживут (нужны vocalsGain/stems/microphoneStream — это ARC-2e отдельным решением: фасад предоставляет audioContext, а питч-модуль переводим на `__belive.pipeline` напрямую).

— 007 · 30.08 · скаут-пакет ARC-2d
