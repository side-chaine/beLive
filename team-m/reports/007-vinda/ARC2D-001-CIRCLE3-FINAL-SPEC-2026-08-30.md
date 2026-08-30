# ARC-2D · Круг-3 · 001 (CEO Co-Architect «Ювелир») · ФИНАЛЬНАЯ СПЕКА (MICRO-PACK для Operator) · 2026-08-30

**HEAD `d024a41` · вход: tsc=293 🔴 · vitest=779+0int+0load 🟢 (66 файлов) · PARITY PASS 🟢**
**Выход-таргет: tsc=293 (0 дельты) · vitest=801 (+22, 0int, 0load) · 67 файлов · PARITY PASS · frozen 0**

## ОТВЕТЫ НА УДАРЫ (по номерам, принял/опроверг/уточнил):

- **У-2 ПРИНЯТ (главный).** Publish `__belive.transport` внутри async-IIFE после pipeline-init = глухой фасад в degraded-режиме (early return main.tsx при 3× WASM-fail → publish никогда, transport жив, varispeed играет, сеть молчит). Патч: publish синхронно в bootAether сразу после `getTransport()` (:91), ДО `if (!transport) return`. Прецедент-паттерн `__tp`:188; `__belive` не типизирован в env.d.ts → `window as any` → tsc-дельта 0. См. S1.
- **У-4 ПРИНЯТ.** Подтверждён точнее: transport.seek:204 no-op при `'ended'`; interceptor авто-стартует play при загрузке (V3DataInterceptor) → `'ended'` — реальный стейт студента mid-session; сценарий «seek no-op → play() → clock.seek(0) → студент с 0, учитель с t» воспроизводим. Патч (решение-2 из моего Круга-1, теперь в slice): `playWithWatchdog(offset?)` + вызов `this.playWithWatchdog(2, t)` в `applyPlayPauseSeek` (:221). Файл `src/Rehearsal/bridge/rehearsal-trigger.bridge.ts` НЕ frozen; правка обоснована в Круге-1 (Риск-2) и подтверждена 002 — условие диспатча «правки Rehearsal-bridge только если обоснованы в Круге-1» выполнено. Из `'paused'` offset игнорируется (TransportV3 докстринг :122-124 — resume с точки паузы) → паузнувшийся студент не пострадает; из `'ended'` — старт с t.
- **У-7 ПРИНЯТ частично, решение по каждому страдальцу:**
  - `attachProgramSource` — **НАПОЛНЯЕМ** (1 строка → `__belive.monitorRouter.attachProgramSource(node)`, MonitorRouter:276 уже умеет: `node.connect(this._captureGain)`). Чинит живой баг: useTakesPlayback:162 зовёт без engineMode-гейта; сегодня превью таке звучит (gain→destination :172), но НЕ попадает в program-capture → запись экрана (recording.store → getProgramCaptureStream) теряет таке-дорожку. V2-parity: patchV1:47 уже транслирует. Риск-нюанс: `detachProgramSource` остаётся пустышкой (см. S2) — stopped source молчит, зомби-нода безвредна.
  - `enableVocalMix/disableVocalMix` — **ОСТАВЛЯЕМ ПУСТЫШКАМИ, честно документируем** (строка в S2-таблице): TakesPanel:1012 reference-listen зовёт `ae.disableVocalMix?.()` + `useAudioStore.setState({ vocalMixEnabled: false })` → в V3 vmix-тапы подключены постоянно (main.tsx:158-159), UI показывает «выключено» при звучащем mix — **UI-ложь, известное отсечение**. Наполнение требует дизайна toggle-API (`MonitorRouter.setVMix(on)` существует, но семантика «reference-listen глушит mix» — продуктовое решение + ControlDeck:368/VolumeControls:90 тоже зовут) → ARC-2e, строка в «Требует решения».
- **У-8 ПРИНЯТ.** «~12» было занижено; разложение по путям (путь = тест) даёт **X=22 → 779+22=801** (верх рекомендованного окна 002: 799..801). Список кейсов — S3, каждая строка исполнима без интерпретаций.
- **У-1 — СОГЛАСЕН, вычеркнут 002 корректно:** `initialOffset ?? 0` + HybridClock.seek `Math.max(0, t)` — NaN-входа нет; resume из paused игнорирует offset по докстрингу :122-124 (мною проверено в TransportV3:130-134).
- **У-5 — СОГЛАСЕН с вычёркиванием; setLoop/clearLoop РЕШАЮ: НАПОЛНЯЕМ с новым обоснованием.** Моё старое обоснование (loop.bridge:70 rAF-прыжки) мертво — loop.bridge RETIRED (main.tsx:316 закомментирован). Новое: живой потребитель **loop-events.ts:52-63** — v3-детект `__v3Active || (t3.state !== 'idle' && t3.orchestrator.all().length > 0)`. Edge живого прогона: **стемы загружены, но `state === 'idle'`** (пользователь нажал stop / loop ставится до play) → v3-детект false → V2-ветка `ae.setLoop(s,e)` :62. Пустышка вернёт `false` → rAF-fallback, который на idle-времени (getCurrentTime=0 < loopEndTime) — мёртвый холостой цикл, engine-loop не установится. Наполнение вернёт `true` → `transport.setLoop(s,e)` (stems+clock+reseek, TransportV3:256-268) → при последующем play() луп работает сразу. В основном V3-прогоне (state ≠ idle) фасадный setLoop не зовётся вовсе (идёт t3.setLoop мимо) — инертно, безвредно. Плюс контракт IV2PublicContract:61 `setLoop(): boolean` — ложь `false` при живом transport хуже правды `true`. **Наполняем → true; обоснование = loop-events.ts:62 edge «стемы есть + idle», НЕ loop.bridge.**
- **У-6 — СОГЛАСЕН, вычеркнут корректно:** CSP-мет нет, jsdom не применяет CSP, ?raw-прецедент BusFader18:22 в каноне. Нюанс принят в S3 как ОБЯЗАТЕЛЬНАЯ механика: `delete window.audioEngine` в beforeEach (guard :81 иначе молча не переустанавливает) + кейс-22 на сам инвариант.

## S1 main.tsx publish (строка вставки + код):

**Файл:** `src/main.tsx`, функция `bootAether()`.
**Точка вставки:** сразу после строки `const transport = getTransport()` (~:91), ДО `if (!transport) return` (~:92). Синхронно, вне async-IIFE — принцип 002-У2: *«`__belive.*` публикуется в точке создания объекта, не в точке успеха зависимой подсистемы»*.

**Код (2 строки, паттерн :169/:170):**
```ts
const transport = getTransport()
;(window as any).__belive = (window as any).__belive || {}
;(window as any).__belive.transport = transport
if (!transport) return // V2 not available
```
Пояснение: `window as any` — единственный легальный паттерн: `__belive` не типизирован в env.d.ts (там только `__eventBus`), идентичный прецедент уже сидит в каноне (:170 pipeline тем же паттерном) → **tsc-дельта 0**. `transport` уже used ниже (:95+) → noUnusedLocals не задет. Guard `if (!transport) return` остаётся ПОСЛЕ publish: при null-transport публикаем null — гейт фасада `b?.transport` корректно даёт resolve-пустышки (см. S3-19), это правильная семантика «V2 not available». Пересозданий transport нет (singleton `_sharedTransport`, engine-v3/index.ts:36-44, dispose никем не зовётся) → публикация одноразова навсегда.

## S2 фасад-таблица (метод → цель → код-скетч; заполняемые/оставленные с обоснованием):

**Файл:** `js/audio-facade-v3.js` (вне tsconfig → BLB-26, правки не видят tsc). Гейты: `t = window.__belive && window.__belive.transport`, `p = window.__belive && window.__belive.pipeline`, `r = window.__belive && window.__belive.monitorRouter` — читаются в момент вызова, не при eval (гонки с boot нет).

### НАПОЛНЯЕМ (20 позиций: 18 методов + 2 свойства; текущие живые getCurrentTime-апгрейд + attachProgramSource)

| # | Метод фасада | Целевой вызов | Код-скетч (гейты `__belive.transport?.` / `__belive.pipeline?.`) | Возврат |
|---|---|---|---|---|
| 1 | `getCurrentTime()` — АПГРЕЙД | `transport.currentTime` (TransportV3:82, clock, мгновенный, loop-aware) → fallback `__belive.currentTime` → 0 | `try { const t = window.__belive && window.__belive.transport; const tc = t && typeof t.currentTime === 'number' && Number.isFinite(t.currentTime) ? t.currentTime : null; if (tc !== null) return tc; const c = window.__belive && window.__belive.currentTime; return (typeof c === 'number' && Number.isFinite(c)) ? c : 0; } catch { return 0; }` | number |
| 2 | `play(offset?)` | `transport.play(offset)` | `try { const t = window.__belive && window.__belive.transport; return t ? t.play(offset) : Promise.resolve(); } catch { return Promise.resolve(); }` | Promise (resolved без transport — hijack-контракт :327 `.catch`) |
| 3 | `pause()` | `transport.pause()` | `try { const t = window.__belive && window.__belive.transport; return t ? t.pause() : Promise.resolve(); } catch { return Promise.resolve(); }` | Promise |
| 4 | `stop()` | `transport.stop()` | `try { const t = window.__belive && window.__belive.transport; if (t) t.stop(); } catch {}` | void |
| 5 | `seekTo(t)` | `transport.seek(Number(t))` | `try { const tr = window.__belive && window.__belive.transport; if (tr && typeof t === 'number' && Number.isFinite(t)) tr.seek(t); } catch {}` | void |
| 6 | `setCurrentTime(t)` | `transport.seek(Number(t))` — alias | тот же скетч, что seekTo | void |
| 7 | `setPlaybackRate(r)` | `transport.setPlaybackRate(r)` | `try { const t = window.__belive && window.__belive.transport; if (t && typeof r === 'number' && Number.isFinite(r) && r > 0) t.setPlaybackRate(r); } catch {}` | void |
| 8 | `getPlaybackRate()` | `transport.playbackRate` | `try { const t = window.__belive && window.__belive.transport; return (t && typeof t.playbackRate === 'number') ? t.playbackRate : 1; } catch { return 1; }` | number (1 fallback) |
| 9 | `playbackRate` свойство НОВОЕ | `transport.playbackRate` | `get playbackRate() { try { const t = window.__belive && window.__belive.transport; return (t && typeof t.playbackRate === 'number') ? t.playbackRate : 1; } catch { return 1; } }` | number (1 fallback) |
| 10 | `audioContext` свойство НОВОЕ | `pipeline.ctx` (HPS `get ctx()`) | `get audioContext() { try { const p = window.__belive && window.__belive.pipeline; return (p && p.ctx) || null; } catch { return null; } }` | ctx \| null |
| 11 | `setStemVolume(id, v)` | `pipeline.setStemVolume(id, v)` | `try { const p = window.__belive && window.__belive.pipeline; p?.setStemVolume?.(id, v); } catch {}` | void |
| 12 | `setStemMute(id, m)` | `pipeline.setStemMuted(id, m)` — **ИМЯ ДРУГОЕ** | `try { const p = window.__belive && window.__belive.pipeline; p?.setStemMuted?.(id, m); } catch {}` | void |
| 13 | `setStemSolo(id, s)` | `pipeline.soloStem(id, s)` — **ИМЯ ДРУГОЕ** | `try { const p = window.__belive && window.__belive.pipeline; p?.soloStem?.(id, s); } catch {}` | void |
| 14 | `getStemMeterLevel(id)` | `pipeline.getStemMeterLevel(id)` | `try { const p = window.__belive && window.__belive.pipeline; return (p && typeof p.getStemMeterLevel === 'function') ? (p.getStemMeterLevel(id) ?? 0) : 0; } catch { return 0; }` | number (0 fallback) |
| 15 | `getStemAnalyser(id)` | `pipeline.getStemAnalyser(id)` (HPS:600, post-fader) | `try { const p = window.__belive && window.__belive.pipeline; return (p && typeof p.getStemAnalyser === 'function') ? (p.getStemAnalyser(id) ?? null) : null; } catch { return null; }` | analyser \| null |
| 16 | `setInstrumentalVolume(v)` | `pipeline.setStemVolume('instrumental', v)` — 1:1 стем-гейн | скетч №11 с id='instrumental' | void |
| 17 | `setVocalsVolume(v)` | `pipeline.setStemVolume('vocals', v)` — 1:1 | скетч №11 с id='vocals' | void |
| 18 | `setLoop(s, e)` | `transport.setLoop(s, e)` (stems+pipeline+clock+reseek, :256-268) | `try { const t = window.__belive && window.__belive.transport; if (!t) return false; t.setLoop(s, e); return true; } catch { return false; }` | **boolean true** |
| 19 | `clearLoop()` | `transport.clearLoop()` (:270-278) | `try { const t = window.__belive && window.__belive.transport; if (!t) return false; t.clearLoop(); return true; } catch { return false; }` | **boolean true** |
| 20 | `attachProgramSource(node, opts)` — У-7 | `monitorRouter.attachProgramSource(node)` (MonitorRouter:276 → `node.connect(_captureGain)`) | `try { const r = window.__belive && window.__belive.monitorRouter; r?.attachProgramSource?.(node, opts); } catch {}` | void |

Примечания к наполнению: `seekTo/setCurrentTime` при `'ended'`-студенте остаются no-op на уровне фасада — лечение У-4 идёт Rehearsal-патчем (см. ОТВЕТЫ У-4), НЕ фасадным workaround'ом (фасад не знает контекста «seek+play серии»; перегрузка seekTo авто-play = autoplay-регрессия на scrub — отвергнуто). `play()` без transport → **resolved** Promise — это resolve-контракт hijack (rehearsal-trigger:327 `.catch`, hijack :130-134 `return result`); reject сломал бы broadcast-порядок.

### ОСТАВЛЯЕМ ПУСТЫШКАМИ (осознанно; контракт return-типов сохранён)

| Метод | Обоснование (проверено кодом) |
|---|---|
| `loadTrack()` → `Promise.resolve()` | V3-загрузка = `before-track-change` → V3DataInterceptor (main.tsx:229); наполнить = двойная загрузка. track.loader:273/:313 его await'ит → resolve обязателен, семантика no-op корректна |
| `setStemsEnabled()` | нет V3-эквивалента (стемы = store + per-stem gains); вызовы либо frozen (audio.bridge:52 — V2-мир), либо гейтнуты `__v3Active` (MixerPanel:150) |
| `setStemPan()`, `setStemsMode()` | нет HPS/transport-эквивалента вовсе (IPipelineController не имеет pan/mode) |
| `setMicrophoneVolume()`, `enable/disableMicrophone()` | mic = MicSourceV3/MonitorRouter домен; все живые вызовы гейтнуты `engineMode !== 'v3'` (takes.recorder:75-98, TakesControlStrip:176, recording.store:50-53, VolumeControls); volume-API вне scope → ARC-2e |
| `enableVocalMix()/disableVocalMix()` — У-7 | V2-bus концепт; V3 vmix-тапы подключены постоянно в boot (main.tsx:158-159), toggle-API нет. **Задокументированное отсечение с UI-ложью: TakesPanel:1012 reference-listen показывает vocalMixEnabled=false при звучащем mix** → строка в «Требует решения», наполнение = ARC-2e (продуктовое решение по MonitorRouter.setVMix) |
| `detachProgramSource()` | MonitorRouter — static graph «0 disconnect» (TC-2C, шапка файла): detach-метода НЕТ by design. Последствие наполненного attach: stopped-source gain остаётся подключённым к _captureGain — молчит, безвреден (зомби-нода). Honest debt, ARC-2e |
| `ensureInstrumentalBuffer()` → null | потребители (takes) в v3-ветке ранний return (TakesPanel:501-528) и/или читают `__belive.pipeline` напрямую (takes.duck:23-48) |

## S3 тесты (список кейсов, число X):

**Файл НОВЫЙ:** `src/audio/audio-facade-v3.test.ts`. Механика (по BusFader18:22-прецеденту): `import facadeSrc from '../../js/audio-facade-v3.js?raw'` → в `beforeEach`: `delete window.audioEngine; (window as any).__belive = undefined; new Function(facadeSrc)()` (guard :81 требует delete — ОБЯЗАТЕЛЬНО, иначе повторный eval молча не переустанавливает). Мок: `(window as any).__belive = { transport: { play: vi.fn(() => Promise.resolve()), pause: vi.fn(() => Promise.resolve()), stop: vi.fn(), seek: vi.fn(), setPlaybackRate: vi.fn(), setLoop: vi.fn(), clearLoop: vi.fn(), playbackRate: 1.25, currentTime: 10.5 }, pipeline: { ctx: fakeCtx, setStemVolume: vi.fn(), setStemMuted: vi.fn(), soloStem: vi.fn(), getStemMeterLevel: vi.fn(() => 0.5), getStemAnalyser: vi.fn(() => fakeAnalyser) }, monitorRouter: { attachProgramSource: vi.fn() }, currentTime: 9.9 }`. strict-чистота: мок `__belive` через `(window as any)` — прецедент stem-engine-sync.test:63.

**Точный список 22 кейсов:**
1. `play` делегирует: `play(5)` → `transport.play` called with 5, возвращает resolved Promise.
2. `pause` делегирует: `pause()` → `transport.pause` called, resolved Promise.
3. `stop` делегирует: `stop()` → `transport.stop` called.
4. seek-пара: `seekTo(42)` → `transport.seek` с 42; `setCurrentTime(42)` → `transport.seek` с 42 (2 asserts, один кейс — alias-инвариант).
5. `setPlaybackRate(0.85)` → `transport.setPlaybackRate` с 0.85.
6. rate-пара: `getPlaybackRate()` → 1.25 И свойство `playbackRate` → 1.25 (2 asserts).
7. свойство `audioContext` → строго `pipeline.ctx` (identity `toBe(fakeCtx)`).
8. null-гейты (без `__belive` вовсе): `audioContext` → null, `playbackRate` → 1, `getPlaybackRate()` → 1, `getStemMeterLevel('x')` → 0, `getStemAnalyser('x')` → null, `getProgramCaptureStream()` → null (6 asserts, один кейс «пустой мир»).
9. `setStemVolume('drums', 0.3)` → `pipeline.setStemVolume` с ('drums', 0.3).
10. имя-мэппинг: `setStemMute('drums', true)` → **`pipeline.setStemMuted`** с ('drums', true) — ловит регрессию имени.
11. имя-мэппинг: `setStemSolo('drums', false)` → **`pipeline.soloStem`** с ('drums', false).
12. шины-прокси: `setInstrumentalVolume(0.4)` → `setStemVolume('instrumental', 0.4)`; `setVocalsVolume(0.6)` → `setStemVolume('vocals', 0.6)` (2 asserts).
13. `getStemMeterLevel('drums')` → 0.5.
14. `getStemAnalyser('drums')` → fakeAnalyser (identity).
15. getCurrentTime-приоритет: при transport.currentTime=10.5 и __belive.currentTime=9.9 → **10.5** (не 50ms-кэш).
16. getCurrentTime-fallback: без transport, кэш 9.9 → 9.9; без `__belive` вовсе → 0 (2 asserts).
17. `setLoop(1, 2)` → возвращает **true**, `transport.setLoop` called с (1, 2).
18. `clearLoop()` → возвращает **true**, `transport.clearLoop` called.
19. hijack-resolve-контракт: без `__belive` — `play()` возвращает Promise и НЕ reject (`.then`-resolved, `typeof === 'object'`); `pause()` аналогично resolved (2 asserts; ловит молчаливую подмену resolve→reject, ломающую hijack `.catch`).
20. `attachProgramSource(gain, { kind: 'preview' })` → `monitorRouter.attachProgramSource` called (У-7: таке-превью в program-capture).
21. инертность пустышек: `loadTrack()` → resolved Promise; `enableVocalMix()/disableVocalMix()/setStemsEnabled()/setStemPan()/setStemsMode()/setMicrophoneVolume()/detachProgramSource()` — не бросают (тихий вызов), `ensureInstrumentalBuffer()` → resolved (8 asserts, один кейс «пустышки инертны»).
22. hijack-инвариант guard :81: pre-patch (`window.audioEngine = { marker: 'patched' }`) → повторный eval НЕ затирает (identity сохранён `toBe`); симметрично: `delete window.audioEngine` → eval → свежий экземпляр (`getCurrentTime !== oldRef`) (2 asserts).

**Число X = 22 → 779 + 22 = 801.** Окно допуска 793..801 (если Operator сольёт asserts в кейсы 4/6/8/12/16/19/21 — не ниже 20: гейт-тесты и имя-мэппинги обязательны по отдельным кейсам 10/11/19/22).

## S4 КАНОН-ИНВАРИАНТ (числа + СТОП):

- **tsc = 293, ДЕЛЬТА 0.** Проверки: main.tsx-строка через `(window as any)` — прецедент :170 в каноне; тест-файл strict-чист (`(window as any)` паттерн, `?raw` покрыт `types: ["vite/client"]`). Никаких новых типов в env.d.ts НЕ добавлять.
- **vitest = 801 (779+22), файлов 66 → 67 (`src/audio/audio-facade-v3.test.ts`), int = 0, load = 0.**
- **PARITY PASS** (V2-мир/frozen не тронуты: правки только main.tsx +1 publish-строка, фасад JS вне tsc-scope, Rehearsal-файл не frozen).
- **Frozen = 0 правок** (`AudioEngineV2.ts`, `patchV1.ts`, `src/bridges/*`, `track.orchestrator.ts` — diff пуст).
- **СТОП-условия (любое сработало — стоп, доклад Боссу):** tsc > 293 (любая новая ошибка); vitest < 793 или > 801; int > 0 или load > 0; diff в frozen-zone непуст; PARITY FAIL; кейс 22 (hijack-инвариант) красный — он защищает rehearsal-hijack от «мост молча исчез».

## САМОКРИТИКА:

- **Сеть у студента (главный смоук):** publish теперь синхронный → даже при 3× pipeline-fail (varispeed-fallback) фасад жив: play/seek/rate идут через transport. До патча — сеть глухая при играющем локальном звуке (У-2). Остаточный риск: degraded-режим без стемов (`__belive.transport` = null при getAudioContext-throw) → resolve-пустышки = консистентное «state без звука», не хуже текущего.
- **Varispeed:** setPlaybackRate/playbackRate через transport → throttler + clock синхронно (:245); getPlaybackRate-гейт возвращает 1 до boot — vclock.anchor на пустышке не отличается от текущего поведения.
- **Таке-запись:** attachProgramSource наполнен → превью таке попадает в program-capture (чинит баг). НОВЫЙ риск: превью теперь слышно В записи параллельно с программой — это V2-parity (patchV1:47), желаемое. detach-пустышка → зомби-gain в capture-графе — молчит, микроскопический debt.
- **Loop:** фасадный setLoop инертен в основном V3-прогоне (t3.setLoop мимо фасада); в edge «стемы + idle» наполнение даёт engine-backed loop вместо холостого rAF. Регрессии нет: loop-events V2-ветка глушит fallback при `applied === true` — а там, где applied=true, transport.setLoop реально применился.
- **У-4 Rehearsal-патч:** из `'paused'` offset игнорируется (resume с паузы) — паузнувшийся студент не прыгнет; из `'ended'` — старт с t. Риск микро: playWithWatchdog-сигнатура меняется — второй параметр; все существующие вызовы (`playWithWatchdog()` без аргументов) сохраняют семантику благодаря default-параметрам.
- **Тесты:** все 22 кейса — чистый jsdom (fakeCtx/fakeAnalyser — plain objects), ни одного WebAudio-вызова; повторный eval + delete в beforeEach закрывает ложнозелёность guard :81.

## Требует решения CEO/Босса:

1. **Publish-строка в main.tsx (:91, 2 строки, НЕ frozen)** — рекомендую GO без правки фасада-фолбэка через `__getTransport?.()`: дебаг-канал консоли как основа фасада хрупок; канонический канал — `__belive.*`. tsc-дельта 0, тестов main.tsx нет. Если Босс против правки main.tsx — STOP на S1, фасад деградирует к У-2-сценарию в degraded-режиме.
2. **Студент-ended-кейс (У-4): правка rehearsal-trigger.bridge.ts (+2 строки: сигнатура playWithWatchdog + вызов с t) — ВКЛЮЧАЮ в ARC-2d slice.** Обосновано в Круге-1 (Риск-2/решение-2), подтверждено 002 (У-4 ЖИВ). Без него смоук «учитель seek после конца трека → студент с той же позиции» НЕ пройдёт (студент с 0).
3. **attachProgramSource — наполняю в этом slice (решение принято, У-7): 1 строка, чинит потерю таке-дорожки в записи экрана, V2-parity.** detachProgramSource остаётся пустышкой (static-graph MonitorRouter) — осознанное debt, ARC-2e.
4. **enableVocalMix/disableVocalMix + setMicrophoneVolume — ОТКЛАДЫВАЮ в ARC-2e** (нужно продуктовое решение по vmix-toggle через MonitorRouter.setVMix и mic-volume-аудит MicSourceV3/MonitorRouter). UI-ложь TakesPanel:1012 задокументирована в S2 честно, как отсечение.

— 001 «Ювелир» · Круг-3 FINAL · ARC-2d · 2026-08-30 · HEAD d024a41
