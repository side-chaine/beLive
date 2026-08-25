# STRESS-P2-VERDICT · adversarial по 4 P2 из MIGRATION-HOLES.md · 2026-08-25 · 007_Мак (Ф002 Стресс-тестер)

> Метод: каждый тезис атакован сценарием → трассировкой кода (фактические строки на диске, не из дыр-листа) → вердикт.
> READ-ONLY src/ соблюдён. Анализ статический. Санкция письма z.

---

## 1. «Whitelist дрейф» setBusVolume — DOWNGRADE (P2 → P2-latent, живых жертв нет)

Сценарий атаки: юзер в V2-режиме двигает bus-фейдер → меняется store.busVolumes → stem-engine-sync isV2-ветка зовёт safeDelegate('setBusVolume') → throw + warn-swallow. Кто страдает в UI?

Код-доказательство:
- Дрейф реален механически: setBusVolume есть в frozen V2 (AudioEngineV2.ts:1059), ОТСУТСТВУЕТ в PUBLIC_METHODS (IV2PublicContract.ts:79-109) → delegateSync кидает `unknown public method` (V2Adapter.ts:52-53) → глотается c warn (stem-engine-sync.ts:154 → :277-283).
- НО: единственные писатели store.busVolumes во всём src — ControlDeck.tsx:198 и :219, оба за runtime-гардом `if (__v3 && hasMusicStems)` (:196, :217; гейт :64-65). При __v3Active=false красный фейдер идёт через забеллистенный ae.setInstrumentalVolume(v) + зеркало setStemVolume (:199-205, :220-226) — мимо busVolumes целиком.
- Следствие: ветка isV2 → safeDelegate('setBusVolume') (stem-engine-sync.ts:153-155) недостижима для текущего графа вызовов: writer активен только при __v3=true, а при __v3=true isV3Master() истинен (stem-engine-sync.ts:21-25) → работает V3-ветка с pipeline.setBusVolume (HybridPipelineService.ts:538), не isV2.
- Нюанс: даже добавление в whitelist не лечит v3-env до master — window.audioEngine там фасад (js/audio-facade-v3.js), у него setBusVolume нет вообще → optional-call `(v2)[method]?.()` = тихий no-op (V2Adapter.ts:57).
- Cold-start не жертва: applyAll/coldSync никогда не применяли busVolumes (stem-engine-sync.ts:226-263 цикла по busVolumes нет), а в V2-сессии store.busVolumes пуст (stem.store.ts:139).

Вердикт: DOWNGRADE. Дрейф подтверждён, но жертв в UI сегодня НЕТ (писатель зарезечен __v3Active). Ловушка для будущего v2-side писателя busVolumes + демонстрация двойного дрейфа (whitelist ↔ фасад). P2-latent, фикс одной строкой при ближайшем касании whitelist'а.

---

## 2. «Program-capture без хозяина» — CONFIRMED (цепочка проверена целиком)

Сценарий атаки: кто реально потребляет program-capture и что оказывается в файле записи в v3?

Код-доказательство (полная цепочка):
- Потребитель program-capture ровно один: recording.store.ts:42 `ae?.getProgramCaptureStream?.() ?? null`; достигается из PresenterDock.tsx:310 и RecordingPanel.tsx:19 (кнопка записи выступления — достижима из UI).
- V2-режим: работает — frozen getProgramCaptureStream() (AudioEngineV2.ts:2031-2039); preview/mic аттачатся через attachProgramSource (AudioEngineV2.ts:2046-2062; зовёт useTakesPlayback.ts:174).
- V3-режим: window.audioEngine = фасад js/audio-facade-v3.js: attachProgramSource() {} no-op (:39), getProgramCaptureStream ОТСУТСТВУЕТ целиком → audioStream=null (recording.store.ts:42) → tracks только video (:60-65) → MediaRecorder всё равно создаётся (:73) → файл webm БЕЗ аудиодорожки и без единого warning'а. Guard `ae?.microphone && …` (:46) проскакивает молча — у фасада нет microphone.
- router.captureStream (MonitorRouter.ts:36, node :96, граф :127-128) — консьюмеров НОЛЬ во всём src: DeviceManager берёт только monitorStream/mainStream (main.tsx:108). Метод router.attachProgramSource (MonitorRouter.ts:272-275; в дыр-листе :281 — строка дрейфанула) — тоже ноль вызывающих: preview в v3 = фасад-no-op (useTakesPlayback.ts:174) + прямой connect ctx.destination (:184), т.е. даже гипотетический читатель router.captureStream получил бы стемы БЕЗ take-preview.
- Легаси CaptureBusV3.getStream() (src/legacy/engine-v3/CaptureBusV3.ts:32) зовёт delegateSync('getProgramCaptureStream') — метода нет в PUBLIC_METHODS → гарантированный throw; сам CaptureBusV3 никем не импортируется (мёртв вдвойне).

Вердикт: CONFIRMED. В v3 запись программы не «в риске», а уже сломана end-to-end: producer бесхозный (router.captureStream никто не читает), consumer получает null и молча пишет видео без звука. Ремонт: publish router.captureStream в фасад/__belive ИЛИ честная блокировка кнопки в v3 по образцу ControlDeck.tsx:363-366.

---

## 3. «MicSourceV3 acquire race» — CONFIRMED (достижима; окно = первый permission-промпт)

Сценарий атаки: параллельность требует двух acquire в полёте. Кто вообще зовёт acquire?

Код-доказательство:
- Звонящие: takes.recorder.ts:82 (кнопка REC, TakesControlStrip.tsx:183-185) и ControlDeck.tsx:400 (тумблер 🎤). Третьи пути — setDevice (MicSourceV3.ts:51-60, свой hazard перезаписи, но не gUM-гонка). Мьютекса НЕТ: ни in-flight мемоизации в MicSourceV3.acquire (:32-42), ни общего pending-флага между ControlDeck/TakesControlStrip (grep _pending/inFlight/acquirePending — 0); у ControlDeck локальный React-state micEnabled, у REC-кнопки свой.
- Механика гонки: acquire() инкрементит _refCount ДО await (:33), проверка `if (this._stream)` (:34) у обоих проходит (null) → два getUserMedia (:72/:78). _stream — last-writer-wins; release() (:45-48) при refCount→0 останавливает треки ТОЛЬКО финального _stream (_stop :62-65). Первый стрим — осиротевший LIVE: треки не остановлены, индикатор микрофона ОС горит до перезагрузки страницы.
- Достижимость: реалистична при первом включении — браузерный permission-промпт держит окно секунды, юзер успевает ткнуть и 🎤, и REC (оба клика не блокируются друг другом). При живом стриме окно сужается до мс, но не исчезает.

Вердикт: CONFIRMED. Параллельность достижима через два независимых UI-входа без общего замка; утечка hardware-stream до reload. Фикс дешёвый: in-flight Promise-мемоизация в acquire() (хранить промис, не стрим).

---

## 4. «takes.recorder build-time гейт» — CONFIRMED (ядро) + REFUTED (subclaim про чужой ctx)

Сценарий атаки: что ломается конкретно при runtime-фолбэке VITE_ENGINE=v3 → pipeline упал?

Код-доказательство:
- Гейт действительно build-time: `import.meta.env.VITE_ENGINE ?? 'v2'` (takes.recorder.ts:70), runtime __v3Active игнорируется. Таких гейтов ещё 8: TakesControlStrip.tsx:172,554 · TakesPanel.tsx:499,555 · VolumeControls.tsx:91,105 · MixerPanel.tsx:139,309 · App.tsx:93 · recording.store.ts:48.
- Конкретное ломание при runtime-фолбэке: pipeline.init() падает → catch в main.tsx:190-192, а __belive.micSource публикуется ВНУТРИ try после init (main.tsx:178-180) → micSource НЕ существует. takes.recorder.start(): src undefined → `_lastError='mic-source-unavailable'`, console.error, тихий return (:76-80). Итог: запись тейков hard-dead во всём приложении, хотя V2-плейбек может быть жив — фолбэка на V2-mic-ветку (:89-96) нет никогда, env решает раз и навсегда.
- Контракт ошибок разъехался: v3-ветка РЕШАЕТСЯ (return) с _lastError (:77,:85), v2-ветка THROW'ит ('AudioEngine not available' :69, 'Raw mic stream not available' :98). Единственный текущий звонящий контракт обрабатывает: TakesControlStrip.tsx:183-191 проверяет recorder.lastError после await → юзеру честная ошибка mic. Так что сегодня это не data-corruption, а (а) мёртвая фича в fallback dead-zone (усугубляет P1 main.tsx) и (б) ловушка для будущих звонящих, которые не знают про lastError и сочтут resolve за успех.
- Subclaim «ctx-фолбэк прибьёт analyser чужим AudioContext» (takes.recorder.ts:105-108) — REFUTED как недостижимый: pipeline.ctx и micSource публикуются атомарно одним try-блоком (main.tsx:178-181). Если micSource есть — pipeline.ctx есть; если pipeline упал — v3-ветка вышла раньше строки ctx. Резервный `ae.audioContext ?? ae._audioContext` у фасада отсутствует (js/audio-facade-v3.js — ни того ни другого) → ctx=undefined → guard :108 просто пропускает analyser (мёртвая волна = нет waveform, запись не страдает).

Вердикт: CONFIRMED ядро (build-time гейт против runtime state machine; жертва — запись тейков в runtime-фолбэке, без V2-fallback; дивергентный контракт ошибок — ловушка на будущее), REFUTED частность про analyser/чужой ctx. Лечится заменой гейта на runtime-признак (`__belive.micSource` / `__v3Active`).

---

## Бонус: DuckGuardV3 / RehearsalTriggerWriter — оба DEAD, CONFIRMED

- DuckGuardV3 (src/audio/engine-v3/DuckGuardV3.ts:14): getInstance()/new — только в собственном файле (:16-18) и __tests__/duck-guard.test.ts. Продукционных инстанцирований и импортов: 0. Контракт-ловушка подтверждена вдобавок: _snapshot() читает getSync('loadedStems')/'stemVolumes.*' (DuckGuardV3.ts:55-58) — их нет в PUBLIC_GETTERS (IV2PublicContract.ts:72-76) → throw при первом duck().
- RehearsalTriggerWriter (src/foundation/event-bus/wrappers/rehearsal-trigger-writer.ts:21): класс экспортирован, импортов/инстанцирований во всём src: 0.
- ВАЖНО не перепутать: DuckGuardV3Native — ЖИВОЙ (StemPlayerV3.ts:74 `new DuckGuardV3Native(...)`), в утиль не сдавать.

## Итоговая таблица

| # | Позиция | Вердикт | Коррекция |
|---|---|---|---|
| 1 | Whitelist drift setBusVolume | DOWNGRADE → P2-latent | writer'ов вне __v3-гарда нет; ветка stem-engine-sync:154 недостижима сегодня |
| 2 | Program-capture без хозяина | CONFIRMED | в v3 уже сломано: recording.store пишет video-only молча; router.captureStream/CaptureBusV3 бесхозные |
| 3 | MicSourceV3 acquire race | CONFIRMED | достижима (🎤 + REC, окно permission-промпта); orphaned live stream до reload |
| 4 | takes.recorder build-time гейт | CONFIRMED (+REFUTED subclaim ctx) | фолбэк = запись тейков мертва без V2-fallback; silent-return сейчас абсорбирован lastError-чеком |
| Б | DuckGuardV3 / RehearsalTriggerWriter | CONFIRMED dead | 0 продакшн-инстанцирований; DuckGuardV3Native живой — не трогать |

Статистика: 2×CONFIRMED, 1×CONFIRMED+частичный REFUTED, 1×DOWNGRADE. Frozen-нарушений: 0.

