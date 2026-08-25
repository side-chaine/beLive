# mac-007 — MICRO-PACK-SURFACE: выравнивание V2↔v3 API-поверхности и event-surface

**Роль:** Ф001 Со-Архитектор · **Дата:** 2026-08-25 · **Репо:** beLive-pc (READ-ONLY по src/, отчёт — единственный файл)
**Design-only. Не коммитить.** Устраняет класс «молча no-op» из holes-draft-audio.md §1 (топ-1/топ-3) и §1 event-строку (топ-4).
**Поправка путей против брифа:** `V2Adapter.ts` и `IV2PublicContract.ts` живут в `src/audio/engine-v3/` (не `integration/`); frozen V2 — `src/audio/core/AudioEngineV2.ts`, mic — `src/audio/core/MicrophoneManager.ts`. Все ссылки ниже — по факту.

---

## §1 Whitelist-гигиена

### 1.1 Сверка PUBLIC_METHODS (28) с реальной поверхностью frozen V2

Реальная публичная поверхность снята grep'ом prototype-методов/геттеров `AudioEngineV2.ts` (frozen ❄). patchV1.ts поверхность НЕ расширяет (только подмена instance на window.audioEngine).

| # | метод в PUBLIC_METHODS | в frozen V2? | живой консьюмер delegate* | вердикт |
|---|---|---|---|---|
| 1 | `play` | ✅ :1619 | useKeyboardShortcuts:94, MonitorMixPanel:566,628, rehearsal-writer† | **оставить** |
| 2 | `pause` | ✅ :1705 | MonitorMixPanel:410, keyboard:94 | **оставить** |
| 3 | `stop` | ✅ :2108 | main.tsx:201,240 | **оставить** |
| 4 | `seekTo` | ✅ :1735 | 10+ call-sites (takes.time:29, TransportBar:49, WaveformCanvas:445…) | **оставить** |
| 5 | `setCurrentTime` | ✅ :1718 | rehearsal-writer† | **оставить** (живая пара к seekTo) |
| 6 | `getCurrentTime` | ✅ :1714 | main.tsx:226, keyboard:62 | **оставить** |
| 7 | `setStemVolume` | ✅ :1088 | stem-engine-sync:142,250; main.tsx:235; DuckGuardV3:71,85 | **оставить** |
| 8 | `setStemsEnabled` | ✅ :128 | stem-engine-sync:211,261; main.tsx:239 | **оставить** |
| 9 | `setStemMute` | ✅ :1105 | stem-engine-sync:167,253; main.tsx:234; DuckGuardV3:86 | **оставить** |
| 10 | `setStemSolo` | ✅ :1121 | stem-engine-sync:186,256 | **оставить** |
| 11 | `setStemPan` | ❌ **фантом** | stem-engine-sync:195,259 (единственный — сам источник P1) | **УДАЛИТЬ** (+интерфейс :33) |
| 12 | `setStemsMode` | ❌ **фантом** | консьюмеров 0 | **УДАЛИТЬ** (+интерфейс :34) |
| 13 | `getStemMeterLevel` | ✅ :1186 | (metering-path) | **оставить** |
| 14 | `getStemAnalyser` | ✅ :1204 | pipeline-first wrappers fallback | **оставить** |
| 15 | `getStemAudioBuffer` | ✅ :1230 | (waveform-path) | **оставить** |
| 16 | `setInstrumentalVolume` | ✅ :1212 | main.tsx:237 (cage) | **оставить** |
| 17 | `setVocalsVolume` | ✅ :1216 | main.tsx:238 (cage) | **оставить** |
| 18 | `enableMicrophone` | ✅ :1534 | mic-v2 путь | **оставить** |
| 19 | `disableMicrophone` | ✅ :1535 | mic-v2 путь | **оставить** |
| 20 | `enableVocalMix` | ✅ :1548 | ControlDeck:367 (v2-fallback) | **оставить** |
| 21 | `disableVocalMix` | ✅ :1549 | ControlDeck:367 (v2-fallback) | **оставить** |
| 22 | `getPlaybackRate` | ✅ :1597 | — | **оставить** (парность к set) |
| 23 | `attachProgramSource` | ✅ :2046 | capture-путь | **оставить** |
| 24 | `detachProgramSource` | ✅ :2068 | capture-путь | **оставить** |
| 25 | `ensureInstrumentalBuffer` | ✅ :1248 | loader-путь | **оставить** |
| 26 | `setLoop` | ✅ :1301 | loop-wrappers v2-fallback | **оставить** |
| 27 | `clearLoop` | ✅ :1313 | loop-wrappers v2-fallback | **оставить** |
| 28 | `setPlaybackRate` | ✅ :1588 | rehearsal-writer†; (useTakesPlayback зовёт мимо адаптера — отдельный пак) | **оставить** |
| + | `setBusVolume` | ✅ :1059 | stem-engine-sync:154 (**сейчас THROW unknown → warn → bus-фейдеры №18 мертвы в v2**) | **ДОБАВИТЬ** (+интерфейс) |
| − | `getBusVolume` (:1070), `getDuration` (:1737), `toggleStemMute/Solo`, `getMicrophoneState`, `captureStream`❗dep, `getProgramCaptureStream`, `awaitStemReady`, `reset/dispose`, on*-подписки… | ✅ есть в V2 | живых adapter-консьюмеров НЕТ (только мёртвый src/legacy/engine-v3) | **НЕ добавлять** — политика demand-driven |

† rehearsal-trigger-writer — мёртвый класс (0 импортов, holes §1 строка 8); не считается живым консьюмером.

### 1.2 Политика на будущее: single source of truth ТИПОМ

Контракт дрейфует, потому что `PUBLIC_METHODS: ReadonlySet<string>` никак не связан с классом. Правило (в IV2PublicContract.ts):

```ts
import type { AudioEngineV2 } from '../core/AudioEngineV2' // type-only: runtime-зависимости нет
export type V2PublicMethod = keyof AudioEngineV2           // ← единственный источник истины

export const PUBLIC_METHODS: ReadonlySet<V2PublicMethod> = new Set<V2PublicMethod>([ ... ])
```

Эффект: опечатка/фантом (`'setStemPan'`) = **ошибка компиляции**, а не молчаливая дыра. Обратное направление (метод есть в V2, нет в whitelist) типом не ловится сознанно — это фича (см. политику добавления):

> **Правило входа в whitelist:** метод добавляется только при (a) доказательстве существования на frozen-прототипе (даёт тип) И (b) наличии ≥1 живого консьюмера с file:line в комментарии. Никаких «добавим про запас».
> **Тест-parity (Guardian):** unit-тест пробегает PUBLIC_METHODS и asserts `typeof AudioEngineV2.prototype[m] === 'function'`; плюс reverse-check для критичной пары bus: `typeof prototype.setBusVolume === 'function'`. Ловит рассинхрон при будущих правках frozen-класса.

Аналогично PUBLIC_GETTERS: убрать `'currentTime'` (ловушка: у V2 нет такого геттера — getSync('currentTime') вечно undefined; main.tsx:225 уже документирует обход «currentTime не геттер!» через delegateSync('getCurrentTime')). Живые потребители геттеров — `'duration'` (keyboard:63), `'isPlaying'` (keyboard:93) — остаются, оба существуют как настоящие prototype-getters (V2 :1603,:1604).

---

## §2 Fail-loud вместо silent

Корень класса: `(v2 as any)[method]?.(...args)` — optional-call съедает отсутствие метода. Точные правки V2Adapter.ts:

**delegateSync (:55-58)** было:
```ts
const v2 = this.getV2Engine()
if (!v2) throw new Error('[V2Adapter] V2 not available')
return (v2 as any)[method]?.(...args)
```
будет:
```ts
const v2 = this.getV2Engine()
if (!v2) throw new Error('[V2Adapter] V2 not available')
const fn = (v2 as any)[method]
if (typeof fn !== 'function') {
  const msg = `[V2Adapter] phantom method '${method}': in PUBLIC_METHODS but missing on engine`
  if (import.meta.env.DEV) throw new Error(msg)
  console.warn(msg)
  return undefined
}
return fn.call(v2, ...args)
```

**delegateAsync (:64-67)** — тот же паттерн:
```ts
const fn = (v2 as any)[method]
if (typeof fn !== 'function') {
  const msg = `[V2Adapter] phantom method '${method}': in PUBLIC_METHODS but missing on engine`
  if (import.meta.env.DEV) throw new Error(msg)
  console.warn(msg)
  return Promise.resolve(undefined)
}
const result = fn.call(v2, ...args)
```

Семантика: DEV — throw (ловится существующими try/catch консьюмеров и превращается в их warn-ветку = видимость без падения UI); PROD — warn+undefined (старое поведение + журнал). После удаления фантомов из whitelist ветка почти недостижима — она страховка от рассинхрона контракт↔билд (stale facade js/-слоя).

**getSync (:44)** — свойство может отсутствовать так же тихо; оставить как есть (геттеры теперь whitelisted-типом), но добавить комментарий: «отсутствующий getter вернёт undefined — см. историю 'currentTime'».

**Потребитель pan (stem-engine-sync.ts)** — после удаления из whitelist `safeDelegate('setStemPan')` станет throw→warn на каждое движение фейдера (спам). Гасим один раз:

было (:193-197):
```ts
for (const id of Object.keys(current.stemPans)) {
  if (current.stemPans[id] !== prev.stemPans[id]) {
    if (isV2) safeDelegate(v2, 'setStemPan', id, current.stemPans[id])
  }
}
```
будет:
```ts
for (const id of Object.keys(current.stemPans)) {
  if (current.stemPans[id] !== prev.stemPans[id]) {
    if (isV2) warnPanUnsupported() // FR-007: pan не поддержан ни в v2-контракте, ни в v3-routing
  }
}
```
и то же в applyAll (:258-260) — цикл по pan заменить на однократный `warnPanUnsupported()` (если `Object.keys(state.stemPans).length > 0`). Хелпер module-level:
```ts
let _panWarned = false
function warnPanUnsupported(): void {
  if (_panWarned) return
  _panWarned = true
  console.warn('[StemEngineSync] stem pan not supported by any engine (FR-007) — fader is inert')
}
```
Итого: панорама из «молча сломана» переходит в «честно объявлена неподдержанной» до появления FR-007-reversal пака.

---

## §3 Event-surface v3: владельцы и подписчики

Проблема (holes §1 строка 6): в v3 `microphone-state-changed` / `vocalmix-state-changed` не эмиттит никто; `playback-rate-changed` эмиттится в eventBus, но не в document → нативные document-слушатели слепы.

### 3.1 Владелец — минимальный и правильный: граф (MonitorRouter), НЕ UI

UI-владелец (ControlDeck) воспроизводит класс дрейфа: любой новый вызов setVMix/setMicMonitor мимо тумблера (AutoMixController, шорткаты, deviceManager) снова рассинхронизирует store. Владелец состояния — тот, кто его меняет: `MonitorRouter` держит _monitorGain/_vmixMaster. Публикация document-CustomEvent (те же имена/payload, что у V2) даёт бесплатную развозку обеими сетями: patched dispatchEvent (facade.ts:144-158, инициализация main.tsx:62 — раньше любого движка) → eventBus → audio-events wrapper → store; и напрямую нативным document-слушателям (паттерн bridges/practice-session).

Правки MonitorRouter.ts (рядом с dumpState :162):
```ts
private _emitState(event: string, detail: Record<string, unknown>): void {
  document.dispatchEvent(new CustomEvent(event, { detail }))
}
```
- `setMicMonitor(:167)` — последней строкой: `this._emitState('microphone-state-changed', { enabled: on, volume })` (payload-форма 1:1 с MicrophoneManager._emitState :143-148 / types.ts:23).
- `setVMix(:195)` — последней строкой: `this._emitState('vocalmix-state-changed', { enabled: on })` (форма types.ts:22).

### 3.2 Следствие: store снова single-writer

ControlDeck перестаёт писать store руками (сегодня :358/:396/:418 — второй writer рядом с wrapper'ом):
- :358 `useAudioStore.setState({ vocalMixEnabled: next })` → удалить;
- :396 `setMicEnabled(false)` → удалить;
- :418 `setMicEnabled(true)` → удалить.
Store обновится через router-событие → facade → audio-events.ts:163-176 (уже существует). Задержка один микротаск, визуально незаметна.

### 3.3 playback-rate-changed: документ-паритет у существующего владельца

Владельцев не меняем — V3StatePublisher уже хозяин rate в v3. publishRateChange (:94-97) было:
```ts
eventBus.publish(EventBusChannel.Audio, 'playback-rate-changed', { rate });
useAudioStore.getState().setPlaybackRate(rate);
```
будет — добавить document-dispatch (паритет с _onStateChange:131, целевой потребитель practice-session.store.ts:469 — нативный document-листенер, в v3 сейчас слеп):
```ts
eventBus.publish(EventBusChannel.Audio, 'playback-rate-changed', { rate });
document.dispatchEvent(new CustomEvent('playback-rate-changed', { detail: { rate } })); // intentional dual-fire (facade re-publish); consumers idempotent — прецедент interceptor track-loaded
useAudioStore.getState().setPlaybackRate(rate);
```
Dual-fire осознанный (house-прецедент holes §1 строка 10): все текущие подписчики идемпотентны (setState тем же значением; sync-cascade повторно ставит тот же rate).

### 3.4 Список подписчиков (после пака)

| событие | эмиттеры v2 (frozen) | эмиттеры v3 (после пака) | подписчики |
|---|---|---|---|
| `microphone-state-changed` | MicrophoneManager:144 | **MonitorRouter.setMicMonitor** | facade→audio-events:168→store.micEnabled/micVolume; document-натативы (bridges-паттерн) |
| `vocalmix-state-changed` | AudioEngineV2._emitVocalMix:1554 | **MonitorRouter.setVMix** | facade→audio-events:163→store.vocalMixEnabled |
| `playback-rate-changed` | AudioEngineV2:1592 (document) | V3StatePublisher:95 (eventBus+store) + **document-dispatch** | audio-events:158→store.playbackRate→sync-cascade; practice-session.store:469; ai-tools.ts:872 (реестр имён) |

Не трогаем в этом паке (зафиксировано как известные непаритетности v3, отдельные решения): `track-stem-ready`/`track-fully-loaded` (v3 атомарная загрузка — док-контракт, holes строка 6), program-capture владелец (holes строка 5, отдельный пак).

---

## §4 Edits — полная таблица правок

| # | file:line | было | будет |
|---|---|---|---|
| E1 | src/audio/engine-v3/IV2PublicContract.ts:33 | `setStemPan(stemId: string, pan: number): void` | *(удалено)* |
| E2 | src/audio/engine-v3/IV2PublicContract.ts:34 | `setStemsMode(mode: 'performance'\|'studio'): void` | *(удалено)* |
| E3 | src/audio/engine-v3/IV2PublicContract.ts:90 | `'setStemPan',` | *(удалено)* |
| E4 | src/audio/engine-v3/IV2PublicContract.ts:91 | `'setStemsMode',` | *(удалено)* |
| E5 | src/audio/engine-v3/IV2PublicContract.ts:79 | `ReadonlySet<string> = new Set([` | `ReadonlySet<V2PublicMethod> = new Set<V2PublicMethod>([` + import type + export type (§1.2) |
| E6 | src/audio/engine-v3/IV2PublicContract.ts:87 (после setStemsEnabled) | — | `setBusVolume(busId: RoutingTarget, volume: number): void` в интерфейсе (RoutingTarget — type-import из V2) |
| E7 | src/audio/engine-v3/IV2PublicContract.ts:109 (конец Set) | — | `'setBusVolume',` |
| E8 | src/audio/engine-v3/IV2PublicContract.ts:75 | `'currentTime', // через геттер…` | *(удалено; комментарий: используйте delegateSync('getCurrentTime'))* |
| E9 | src/audio/engine-v3/V2Adapter.ts:57 | `return (v2 as any)[method]?.(...args)` | typeof-check + DEV throw / PROD warn (§2) |
| E10 | src/audio/engine-v3/V2Adapter.ts:66 | `const result = (v2 as any)[method]?.(...args)` | тот же typeof-check (§2) |
| E11 | src/foundation/reactions/stem-engine-sync.ts:195 | `if (isV2) safeDelegate(v2,'setStemPan',id,…)` | `if (isV2) warnPanUnsupported()` |
| E12 | src/foundation/reactions/stem-engine-sync.ts:258-260 | for-цикл applyAll pan → safeDelegate | однократный `warnPanUnsupported()` при len>0 |
| E13 | src/foundation/reactions/stem-engine-sync.ts (module-level, после MUSIC_STEMS:33) | — | хелпер `_panWarned/warnPanUnsupported()` (§2) |
| E14 | src/audio/engine-v3/monitor/MonitorRouter.ts:162-164 (после dumpState) | — | `_emitState(event,detail)` хелпер |
| E15 | src/audio/engine-v3/monitor/MonitorRouter.ts:176 (последняя строка setMicMonitor) | — | `this._emitState('microphone-state-changed',{enabled:on,volume})` |
| E16 | src/audio/engine-v3/monitor/MonitorRouter.ts:209 (после dumpState в setVMix) | — | `this._emitState('vocalmix-state-changed',{enabled:on})` |
| E17 | src/components/ControlDeck.tsx:358 | `useAudioStore.setState({ vocalMixEnabled: next });` | *(удалено — single-writer через событие)* |
| E18 | src/components/ControlDeck.tsx:396 | `setMicEnabled(false);` | *(удалено)* |
| E19 | src/components/ControlDeck.tsx:418 | `setMicEnabled(true);` | *(удалено)* |
| E20 | src/audio/engine-v3/integration/V3StatePublisher.ts:95 | eventBus.publish rate | + `document.dispatchEvent(new CustomEvent('playback-rate-changed',{detail:{rate}}))` + комментарий intentional dual-fire |

Затронуто: 5 actionable-файлов. **Frozen не задет:** AudioEngineV2.ts ❄, MicrophoneManager.ts ❄, patchV1.ts ❄, src/bridges/* ❄, js/* ❄. Отдельные паки (не здесь): удаление src/legacy/engine-v3 (0 живых импортов), useTakesPlayback solo/rate restore (E5-семейство), DuckGuardV3/rehearsal-writer cleanup.

Новые тесты (Guardian, engine-v3/__tests__):
- T1 whitelist-parity: каждый m ∈ PUBLIC_METHODS ⇒ `typeof AudioEngineV2.prototype[m]==='function'` (после E5 компиляция уже ловит, тест — страховка от `as const`-прогонов);
- T2 fail-loud: mock-engine без метода ⇒ DEV-throw / PROD-warn+undefined (V2Adapter);
- T3 event-owner: `router.setMicMonitor(true,.8)`/`setVMix(true)` ⇒ CustomEvent на document с точными payload (spy на dispatchEvent).

---

## §5 Risks + Frozen-check

| риск | оценка | митигация |
|---|---|---|
| DEV-throw ломает поток, живший на silent undefined | низкий: все вызовы адаптера уже в try/catch либо за safeDelegate | throw только DEV; PROD warn+undefined; прогон канона |
| V2ResurrectionDetector/main-guard оборачивают delegateSync (main.tsx:135, Detector:103) — наш throw пролетает сквозь обёртки | ок по конструкции: обёртки прокидывают оригинал после записи факта; catch-политика потребителей неизменна | verify-пункт CDP-3 |
| Router-эмиттеры до подписки audio-events (ранний setVMix при буте) — событие потеряно, store останется default до первого тумблера | низкий: VMix/mic переключаются только пользователем после монтирования UI | CDP-4: reload→toggle→проверка store |
| Удаление прямых store-писем ControlDeck меняет тайминг UI-отклика на ~1 микротак | косметика | ручной клик-тест тумблеров |
| dual-fire rate → двойной sync-cascade | идемпотентно (тот же rate) | комментарий intentional dual-fire; наблюдение за логами |
| `RoutingTarget` type-import утянет runtime? | нет — `import type` стирается | tsc проверит |
| getSync остаётся stringly-typed для GETTERS | принято (вне скоупа микро-пака) | зафиксировано в §1.2 политике |

Frozen-check: таблица правок §4 не содержит src/audio/core/**, src/audio/compat/**, src/bridges/**, js/**. Единственный файл с правом читать V2 (V2Adapter) правится в рамках своей роли.

---

## §6 Verify (Near Light)

Автотест:
1. Канон 313/769 — зелёный, без новых skip.
2. `tsc` — 0 новых ошибок; контрольный негатив: временно вернуть `'setStemPan'` в Set ⇒ ожидаемая ошибка типов (T1-демо, откатить).
3. T1–T3 (§4) зелёные.

Консоль/CDP (VITE_ENGINE=v3, dual-env бут):
4. Бут чист: 0 новых варнов; `[RECON-3]` строки без ошибок.
5. CDP: клик 🎤 ON → `document` получил `microphone-state-changed {enabled:true}` ; `__belive`-store `micEnabled===true`; OFF → зеркально. Ровно одно событие на клик (нет дублей от UI-плеча).
6. CDP: клик VMix → `vocalmix-state-changed {enabled:true}` ровно один; тумблер отражает состояние после reload+click (R-early-mitigation).
7. CDP: сменить темп (0.75x) → `playback-rate-changed` в eventBus **и** document; practice-session-слушатель получает detail.rate===0.75.
8. DEV-only: из консоли `V2Adapter.getInstance().delegateSync('setStemPan', 'vocals', 1)` ⇒ throw `unknown public method` (не phantom-branch); `delegateSync('setBusVolume','main',0.5)` в v2-режиме ⇒ выполняется без warn (фейдер №18 ожил).
9. Движение pan-фейдера в v2-режиме ⇒ ровно ОДИН `[StemEngineSync] stem pan not supported…` на сессию (не спам).
10. Уши mic-сессии: включить монитор → в наушниках мик слышен с компенсацией задержки (без двойки/фантома), toggle OFF/ON без залипания; VMix ON — вокал L/центр music/мик R, OFF — возврат стерео-balance; громкости bus-фейдеров №18 в v2-режиме audible.

— mac-007 / MICRO-PACK-SURFACE-draft. READ-ONLY соблюдён: изменения только в team-m/reports/mac-007/.
