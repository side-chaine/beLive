# stress-holes-verdict · адversarial-проверка топ-3 P1 · Ф002 Стресс-тестер (Far Light) · 2026-08-25

> Объект атаки: `MIGRATION-HOLES.md` (7×P1/8×P2) + драфты `holes-draft-{audio,sync,mic}.md`.
> Метод: воспроизведение по точным сценариям вызовов file:line на живом дереве (READ-ONLY src/, sshfs).
> Калибровка runtime: `.env` → `VITE_ENGINE='v3'` ⇒ **No-Birth**: `window.audioEngine` = чистый no-op фасад
> (`js/audio-facade-v3.js:44`, `index.html:397`; `App.tsx:93-100` tryActivateV2 не зовёт).

---

## 1. «Phantom methods»: setStemPan/setStemsMode в whitelist при отсутствии в frozen V2

### Воспроизведение (сценарий вызовов)
```
UI отсутствует (см. ниже), но механика:
useStemStore.setState({stemPans}) ← merge при load (audio-events.ts:147-153 / audio.bridge.ts:207-213)
  → subscribe (stem-engine-sync.ts:59) → diffAndApply
    → v2-ветка :195  safeDelegate(v2,'setStemPan',id,pan)
    → cold-start :259 safeDelegate(v2,'setStemPan',id,pan)  // пуш ВСЕХ стемов при буте
      → V2Adapter.delegateSync (V2Adapter.ts:51)
        → :52 PUBLIC_METHODS.has('setStemPan') = TRUE (IV2PublicContract.ts:90)
        → :57 (v2 as any)['setStemPan']?.(...) → undefined, БЕЗ throw, БЕЗ log
      → safeDelegate catch не срабатывает (stem-engine-sync.ts:277-283 ловит только throw)
= полная тишина во всех слоях.
```

### Код-доказательство
- **Метода нет в V2**: grep `setStemPan|setStemsMode` по `src/audio/core/AudioEngineV2.ts` → 0 совпадений; grep `StereoPanner|.pan|panNode` по всему `src/audio/core/` → 0. Pan-графа в V2 не существует ВООБЩЕ. `patchV1.ts` (dual-env патч фасада) тоже не копирует таких методов — их неоткуда брать.
- **Whitelist содержит фантомы**: `IV2PublicContract.ts:33,34` (интерфейс) и `:90,91` (PUBLIC_METHODS) — оба имени присутствуют.
- **Тихий optional-call**: `V2Adapter.ts:57` и `:66` — `(v2 as any)[method]?.(...args)`; отсутствие метода = молчаливый `undefined`. `safeDelegate` (stem-engine-sync.ts:277-283) логирует ТОЛЬКО при throw — а throw нет.
- **Кто реально зовёт**: `delegateSync('setStemPan')` — только stem-engine-sync.ts:195 (diff-ветка V2) и :259 (cold-sync, пушит дефолтные нули всех стемов при каждом буте в v2-режиме). `delegateSync('setStemsMode')` — **0 вызовов во всём репо** (grep: имя живёт только в whitelist и интерфейсе).
- **Кто пишет pan в store**: продакшн-писателей ненулевого pan НЕТ. `useStemStore.setStemPan` (stem.store.ts:260) вызывается только из теста (`stem/__tests__/stem.store.test.ts:54`). Merge-пути инициализируют pan нулями (audio-events.ts:144, audio.bridge.ts:204). Pan-фижера/knob'а в UI нет (grep по *.tsx → 0).
- **stemsMode до движка не доходит никогда**: `EngineStateSnapshot` (stem-engine-sync.ts:35-43) не содержит stemsMode; diffAndApply его не маршрутизирует — режим живёт только в store/UI.
- Контр-пример дрейфа в другую сторону (сверка с P2-строкой сводки): `setBusVolume` есть в frozen V2 (`AudioEngineV2.ts:1059`), но НЕ в whitelist → `safeDelegate(v2,'setBusVolume')` (stem-engine-sync.ts:154) кидает «unknown public method» → catch → console.warn. Т.е. дрейф whitelist двусторонний, но режимы отказа разные (warn vs полная тишина).

### Вердикт: **PARTIAL**
Механизм подтвержден полностью: фантомные имена в контракте + optional-call = гарантированный тихий no-op без единого лога, в обоих режимах. Но заявленное последствие «pan/mode умирают молча» сегодня НЕ имеет жертвы: в V2 pan никогда не существовал аппаратно, UI-писателя pan нет (только тесты), `setStemsMode` через адаптер не зовётся никем, а в v3-ветке pan отброшен документированно (коммент FR-007, stem-engine-sync.ts:192). Это мина, а не активный подрыв.

### Уточнение severity: **P1 → P2**
Латентный contract-drift + дефект API-дизайна (тихий optional-call вместо explicit throw). Становится P1 автоматически, как только появится pan-фейдер или первый вызов setStemsMode через адаптер. Фикс дешёвый: `throw` вместо `?.()` в delegateSync/delegateAsync + тест «whitelist ⊆ AudioEngineV2.prototype» (заодно закроет обратный дрейф setBusVolume/getBusVolume/awaitStemReady).

---

## 2. «Fallback dead-zone»: fail HybridPipelineService.init → app немое до reload

### Воспроизведение (сценарий вызовов)
```
Бут (shipped-конфиг VITE_ENGINE=v3):
index.html:397 → js/audio-facade-v3.js ставит no-op фасад (:30-41 play/pause/stop/seekTo/loadTrack = {})
App.tsx:93-100 → engineMode==='v3' → tryActivateV2 ПРОПУЩЕН (No-Birth, __v2BirthCount=0)
main.tsx:154-158 → import HybridPipelineService → new → await pipeline.init() → THROW (WASM/worklet/любая причина)
main.tsx:190-192 → catch → ТОЛЬКО console.warn('[AETHER] ❌ … varispeed fallback')
  ⇒ НЕ выполнены: transport.attachPipeline (:170), interceptor.attachPipeline (:175),
    window.__belive.pipeline (:179) — interceptor._pipeline навсегда null.

Юзер открывает трек:
before-track-change (main.tsx:298) → interceptor.loadTrack(record) (main.tsx:322)
  V3DataInterceptor.ts:71 transport.stop(); :72 orchestrator.disposeAll()
  :92-102 decode ОК → :105 generation-check ОК
  :111 `if (this._pipeline)` FALSE → :123-124 orchestrator.addStem(id,buffer) (стемы легли в оркестратор)
  :146 ГЕЙТ `if (this._pipeline && loadedStems.length>0)` = FALSE ⇒ ПРОПУЩЕНО ВСЁ:
        cage.activate() ❌  __setV3Active(true) ❌  transport.play(offset) ❌
  :190 `if (loadedStems.length>0)` TRUE ⇒ track-loaded публикуется (EventBus :206 + document :212)
  main.tsx:348-363 публикуются trackUrls → волны/маркеры рендерятся. UI показывает «готов».

Юзер жмёт Space (useKeyboardShortcuts.ts:81):
  guard `__v3Active || (state!=='idle' && stems>0)` = FALSE (флаг false, transport.state='idle' после :71)
  → V2-ветка :89-95: __loadingV3 уже false (Interceptor:182) → delegateSync('play')
    → V2Interceptor пропускает (флаг false, main.tsx:136) → фасад.play() = {} → ТИШИНА.
Стрелки — тот же предикат (:46/:56-65) → delegateSync('seekTo') → no-op.
Клик по волне — предикат false → publishSeek двигает плейхед ВИЗУАЛЬНО, звука нет.
```

### Код-доказательство
- **Retry отсутствует**: grep `HybridPipelineService` по src/ — единственный продакшн-бут main.tsx:156-158; повторной попытки нет нигде.
- **Альтернативный путь восстановления отсутствует**: `belive:v3-activation-failed` (Interceptor:176, слушается AudioCrashModal/useAudioContextHealth) эмиттится ТОЛЬКО из rollback внутри шага 8 (:166-178) — при `_pipeline=null` шаг 8 недостижим ⇒ краш-сигнал не всплывает никогда. Varispeed-активация (transport.play по уже лежащим в orchestrator буферам) не написана, хотя данные для неё в dead-zone УЖЕ загружены (:123-124).
- **`__setV3Active`**: пишется только из Interceptor:68 (false)/152 (true)/169 (rollback-false) и main.tsx:148-151; в dead-zone остаётся false навсегда ⇒ V2Interceptor слеп, loop/position-sync предикаты уходят в v2-ветку (см. holes-draft-sync §4).
- **Фасад**: все транспортные методы — пустые функции (`js/audio-facade-v3.js:30-32,36-37`); реального V2 в No-Birth не существует (App.tsx:98-100) — фолбэковаться не на кого.
- **track-loaded при этом публикуется**: гейт публикации (:190) проверяет только `loadedStems.length>0`, не наличие pipeline — UI честно считает трек загруженным.
- **main.tsx:364-366**: sibling того же класса — catch loadTrack-fail пишет warn («V2 continues playing»), что в No-Birth ложь: ни V2, ни V3 не играют; автоплей-интент теряется молча.

### Вердикт: **CONFIRMED**
Ровно как в сводке: fail init → стемы декодированы и лежат в orchestrator, track-loaded опубликован, UI «готов», но ни клетка, ни флаг, ни автостарт не выполнены; вся транспортная поверхность (Space/arrows/wave-click) уходит в no-op фасад. Продуктового пути оживления нет — только dev-консоль `__v3play`/`__switchToV3` (продакшн-вызовов 0, grep) или reload.

### Уточнение severity: **P1 подтверждён**, с двумя сужениями рамки
1. Зависимость от конфига: в dual-env (VITE_ENGINE≠v3) tryActivateV2 патчит фасад реальным V2 (App.tsx:94-97 → featureFlag.ts:23) → `track.orchestrator.ts:477 ae.play()` живёт → приложение НЕ немое. Dead-zone — эксклюзив shipped v3-No-Birth конфига (он и есть прод).
2. Probability низкая (fail init на буте), Impact максимальный (полная тишина без единого сообщения пользователю; единственный лог — DEV-console.warn). Рекомендация из драфта верна и дешева: при `_pipeline=null` после успешного decode делать varispeed-активацию (addStem уже сделан → transport.play + `__setV3Active(true)`), либо честно гасить track-loaded и диспатчить `belive:v3-activation-failed`.

---

## 3. «Event-surface»: microphone/vocalmix-state-changed эмиттит только V2

### Воспроизведение (сценарий вызовов)
```
Эмиттеры (grep по всему src/, полный список совпадений имён событий):
  'microphone-state-changed' ← MicrophoneManager._emitState (:143-148), зовут enable(:50)/disable(:58)/setVolume(:107)
  'vocalmix-state-changed'   ← AudioEngineV2._emitVocalMix (:1553-1557), зовут enable/disableVocalMix (:1548-1549)
  ДРУГИХ эмиттеров НЕТ. v3-поверхности молчат:
  MonitorRouter.setMicEnabled (:272-278) / setMicMonitor / setVMix — только AudioParam-рампы, 0 dispatch
  MicSourceV3.acquire/release — 0 dispatch
  ControlDeck v3-ветки — 0 dispatch (см. ниже)

Ловят: audio.bridge.ts:220-221 (❄ retired) и wrappers/audio-events.ts:163-176 (живой путь,
  кормится через BridgeFacade monkey-patch dispatchEvent, facade.ts:144-159)
  → пишут useAudioStore.micEnabled/vocalMixEnabled.
Читают: ControlDeck:70-71, TrackInfo:13-14, VolumeControls:66-67, MixerPanel:123.

В v3 юзер кликает PRIMARY тумблеры (ControlDeck):
  VMix :350-360 → router.setVMix(next) + setState({vocalMixEnabled:next}) → return  (событие не нужно)
  🎤  :386-424 → MicSourceV3.acquire + monitorRouter.setMicMonitor + setMicEnabled(store-action :72)
  ⇒ store обновляется НАПРЯМУЮ — тумблеры самосогласованы БЕЗ событий.
```

### Код-доказательство
- Единственность эмиттеров подтверждена исчерпывающим grep обоих имён по src/: 19 совпадений = 2 эмиттера + консьюмеры/типизация/карта facade.ts:23-24. v3-источников тех же событий НЕТ.
- **Где рассинхрон всё-таки есть (реальные жертвы):**
  1. `practice-session.store.ts:127-134` (restore после практики): `ae?.enableVocalMix?.()` — no-op фасада; рядом `setVocalMixEnabled(snapshot)` — стор ПЕРЕВЕРНУЛСЯ, `router.setVMix` неозван ⇒ бейдж «VMix ON» при фактическом OFF-роутинге (и наоборот). Рассинхрон слышимый (стерео-разводка).
  2. `TakesPanel.tsx:1009-1017,1030-1038` (автоматизация упражнений listen-phase + restore): тот же dual-write «ae-no-op + прямой setState» ⇒ расхождение лейбла и роутинга на время упражнения и после него.
  3. `takes.recorder.ts:73-88`: v3-запись берёт стрим через `MicSourceV3.acquire()` МИМО стора — 🎤 в ControlDeck показывает OFF при живом (горячем!) микрофоне во время записи тейка.
  4. `VolumeControls.tsx:86-112`: enable-ветки зарежены `engineMode==='v3' → return` с комментом «тост/бейдж», которого НЕТ (тихий return); disable-ветки (:89,:103) не зарежены вовсе → no-op без события и без записи стора ⇒ кнопки мёртвые, второй контрол-сурфейс врёт первому.
- playback-rate-changed: v3-источник (V3StatePublisher:94-97) публикует только в EventBus, document-подписчики его не видят (отдельная P3-строка драфта-audio — подтверждаю чтением).

### Вердикт: **PARTIAL**
Факт «эмиттит только V2» — CONFIRMED (исчерпывающе). Но заголовочный вывод «тумблеры в v3 рассинхронизированы» в лобовой формулировке REFUTED для основных тумблеров: ControlDeck 🎤/VMix сознательно идут мимо событий прямыми записями в store и потому самосогласованы. Рассинхрон реален, но на других поверхностях: legacy-writers (practice-restore, exercise-автоматизация), рекордерный тракт (mic горяч при «OFF») и мёртвый VolumeControls.

### Уточнениеseverity: **P1 → P2**
Живые деградации точечные (лейбл-vs-роутинг после практики/упражнений; индикатор микрофона во время записи), основной UX-тракт тумблеров работает. Фикс системный и дешёвый: публиковать оба события из v3-писателей (ControlDeck/MonitorEngine — по образцу V3StatePublisher:131) ИЛИ перевести legacy-writers на store-канал (store → sync-слой), убрав прямые `ae.*`-вызовы. До фикса задокументировать «mic горяч во время записи при OFF-индикаторе» как known-issue.

---

## Сводка вердиктов

| # | Hole | Вердикт | Severity было → стало |
|---|---|---|---|
| 1 | Phantom methods (setStemPan/setStemsMode) | **PARTIAL** (механизм ✅, жертв нет) | P1 → **P2** (latent trap) |
| 2 | Fallback dead-zone (pipeline init fail) | **CONFIRMED** (в shipped v3-No-Birth; в dual-env не воспроизводится) | **P1** остаётся |
| 3 | Event-surface mic/vmix | **PARTIAL** (эмиттеры ✅ только-V2; primary-тумблеры самосогласованы) | P1 → **P2** |

Приоритет стресс-рекомендация команде: №2 — единственный из трёх с катастрофическим исходом и нулевой наблюдаемостью; чинится varispeed-активацией либо честным fail-событием. №1 решается одним throw в V2Adapter + whitelist-тестом (закрывает и обратный дрейф). №3 — миграция legacy-writers на store-канал, новых событий можно не вводить, если все писатели идут через store.

*READ-ONLY соблюдён: src/ не тронут, коммитов нет.*
