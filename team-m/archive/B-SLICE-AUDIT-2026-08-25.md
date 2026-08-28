# B-SLICE AUDIT · read-only · 2026-08-25 · агент: explore

**Источник:** docs/PLAN-v3.3-CANONICAL.md §4 (B-slice). Фасад реально лежит в `js/audio-facade-v3.js` (грузится `index.html:397`), НЕ под `src/js/`.

## Текущее состояние фасада (baseline)
`js/audio-facade-v3.js`: НЕТ `get audioContext`, НЕТ `get isPlaying` (обещание синглтона в комменте :5 не реализовано); `setInstrumentalVolume()/setVocalsVolume()` — пустые no-op (:33). Ставит себя как `window.audioEngine` только если ещё нет (:44). В v3 (`VITE_ENGINE=v3`) `src/App.tsx:92-100` запрещает рождение V2, фасад остаётся `window.audioEngine` на всю сессию; в v2 frozen audio-core патчит объект на месте. Мёртвый бут-стаб `js/audio-engine.js` (реальный контекст, no-op volume, нет isPlaying) ни одним `<script>` не подключён.

## 1. Инвентарь вызовов 4 членов

### 1a. setInstrumentalVolume / setVocalsVolume — прямые вызовы через window.audioEngine
| # | Caller | Site | Что получает сейчас |
|---|---|---|---|
| 1 | ControlDeck.tsx | :202,:223 (inst); :279,:291 (vocals) | Inst-fader dual-mode (№18-BUS H3.4): при `__v3Active && hasMusicStems` → `setBusVolume('music-bus')`, иначе ae-setter за `if(!__v3)` + зеркало в stem.store. Vocal-fader — ae-setter БЕЗ гарда + зеркало. Сегодня no-op. |
| 2 | VolumeControls.tsx | :76,:82 | Безусловно + зеркало в stem.store. no-op. |
| 3 | SyncEditorPanel.tsx | :461,:464 | optional-chained + зеркало + localStorage. no-op. |
| 4 | TakesPanel.tsx | :787-788, :869-870, :921-922, :947-948 | Все парно с зеркалом в stem.store. no-op. (2d≡2f дубликат — registry N4). |
| 5 | useTakesPlayback.ts | :51-52 (solo-mute zeroes оба), :63-64 (restore) | **solo-превью / vocal-fade** консьюмер из §4. Сегодня duck не происходит (no-op) — задокументированный дефект «solo не solo». |
| 6 | main.tsx (dev switch-to-V3) | :237-238 | `V2Adapter.getInstance().delegateSync('setInstrumentalVolume',0)/('setVocalsVolume',0)` в каскаде выключения V2. |
| 7 | Тесты BusFader18.test.ts | :377-378,:400-413,:426-436,:458,:482-510 | Кодируют H4.1 (setter НЕ зовётся при v3+stems; зовётся в non-V3 ветке). |
| 8 | IV2PublicContract.ts | :38-39,:95-96 | Оба имени в whitelist `PUBLIC_METHODS` для `delegateSync`. |

### 1b. Через V2Adapter.delegateSync (опасный канал)
| Caller | Site | Поведение |
|---|---|---|
| V2AudioCage.ts | zero :106-107; restore :88-89 | см. §2 |
| main.tsx switch | :237-238 | прямое зануление |

### 1c. get audioContext (члена нет → сегодня тихо деградируют)
monitor-mix.js:12 (создаёт СВОЙ второй контекст — split-context риск), pitch-engine.ts:46-52 (бросает 'audioEngine.audioContext not found'), useWaveformData.ts:60-62 (новый AudioContext), recording.store.ts:36-39 (no-op suspended probe), FullAvatar.tsx:51-57 (no-op), audio-reactive.ts:28-33 (аналайзер пропущен), takes.recorder.ts:104-107 (v3 branch падает на legacy property), rehearsal-trigger.bridge.ts:279-287 (drift telemetry пропущен), frozen bridges layer (read-only) — один модуль читает `ae?.audioContext`.

### 1d. get isPlaying (члена нет → undefined → falsy)
takes.time.ts:33-38 (dual-mode reader, корректно при флаге), useTakesPlayback.ts:108 (**autopause** — `if(ae?.isPlaying)…pause()` никогда не паузит), TakesPanel.tsx:1162,:1209 (reference-listen — play каждый раз, rAF-прогресс встаёт), MonitorMixPanel.tsx:392 (калибровочный гейт всегда false), PitchTab.tsx:260,:347 (питч-движок заморожен, иконка stuck), trigger-visual.service.ts:70-74 (только V2-fallback ветка).

Смежное (факт): Ц3 B-first-slice не включает `enableVocalMix/disableVocalMix` (v-Mix зовёт с early-return в ControlDeck:329-333) — тот же класс «silent no-op», вне этих 4 членов.

## 2. V2Cage прецедент — РИСК ВЫСОКИЙ (структурно гарантирован)
`V2AudioCage.ts`: activate() паузит V2, disable stems, zero-all-volumes (:101-109) включая `delegateSync('setInstrumentalVolume',0)/('setVocalsVolume',0)`; **watchdog повторяет зануление 3× каждые 500мс**; deactivate() восстанавливает в 1/unmuted. Всё идёт через `V2Adapter.getInstance().delegateSync(...)` → `window.audioEngine` = сам фасад в v3.

Вердикт: сегодня triple-защита делает это безопасным: (1) сеттеры no-op; (2) H4.1 mini-guard глотает прямые `ae.*` при активном флаге; (3) BusFader18.test:424 кодирует «guard трогает только ae.*, delegateSync-канал остаётся живым против V2». **После оживления слой (1) исчезает → открытый канал пишет реальные нули в оживлённые сеттеры → клетка ГЛУШИТ V3-стемы.** deactivate ещё и шлёпает их в 1. Гард на этом канале, ключённый на `__v3Active`, ОБЯЗАТЕЛЕН до оживления (совпадает с §4(a)).

## 3. Продление существующего гарда (main.tsx ~131-151)
Сейчас: локальный флаг + `window.__v3Active` (init false :131-132); monkey-patch `V2Adapter.getInstance().delegateSync` блокирует `'play'` и `'seekTo'/'setCurrentTime'` при флаге (:133-145); единый writer `window.__setV3Active` (:147-151), драйвер — только `V3DataInterceptor`.

Форма продления (§4b: продлить ЗДЕСЬ, НЕ дублировать в V2Adapter): добавить `'setInstrumentalVolume'`/`'setVocalsVolume'` в blocked-условия того же блока, на тот же флаг/writer. Обоснование: cage (:106-107,:88-89) и main.tsx cascade (:237-238) идут исключительно через `delegateSync` — этот интерцептор = единая точка между ними и оживлёнными сеттерами. `PUBLIC_METHODS` уже вайтлистит оба имени → без продления адаптер их счастливо форвардит. UI-писатели (§1a #1-5) зовут фасад НАПРЯМУЮ, минуя delegateSync → расширенный блок их не давит. Порядок установки гарантирует, что гард раньше любого re-zero.

**КРИТИЧЕСКОЕ (факт, не решение):** H4.1 mini-guard (main.tsx:266-295) враппит те же два сеттера НАПРЯМУЮ на `window.audioEngine` и игнорирует все вызовы при `__v3Active`. Его коммент премирует «facade-no-op underneath». После оживления премис ломается: H4.1 проглотит ЛЕГИТИМНЫЕ UI-записи (ControlDeck vocal fader, TakesPanel backing/prep/restore, SyncEditorPanel, VolumeControls, useTakesPlayback restore) — ровно то поведение, которое B-slice включает. Любое продление должно учесть судьбу H4.1; тесты BusFader18 (:363-505) кодируют его семантику и поплывут. Также E1 (§1) ещё pending: предикат сейчас имеет несколько алиасов; продление гарда должно uses канонизированный writer из E1.

## 4. Solo-cleanup (пункт в плана)
(a) Буквальное совпадение — `src/audio/engine-v3/pipeline/StemChain.ts:95-103` (`_applySolo-cleanup`): ведёт soloed-set; при пустом форсирует ВСЕ стемы в 1; при непустом — soloed в 1, остальные в 0. Без save/restore предыдущих громкостей. Живёт внутри V3-pipeline, фасад не трогает; для B-slice нужен ревью, т.к. оживлённые сеттеры создают ВТОРОГО писателя в те же громкости (double-apply/desync со stem.store и bus volumes).
(b) Смежный facade-writing solo path — `useTakesPlayback.ts:48-68`: `applySoloMute` зануляет оба мастера через фасад; restore берёт из audio.store. Сегодня no-op; после оживления — живой duck/unduck V3-стем (solo-превью/vocal-fade). Решение должно включать (a) и (b) вместе.

## 5. Сводная таблица
| Caller | Ожидание сегодня | Риск без гарда | Гард нужен |
|---|---|---|---|
| V2AudioCage re-zero/restore (adapter ch) | no-op | **HIGH** — глушит V3 стемы ×3 + deactivate в 1 | Да — продлить main.tsx:131-151 на volume |
| main.tsx switch cascade :237-238 | no-op | MED | то же продление |
| H4.1 mini-guard :266-295 | swallow-when-active | **HIGH (инверсия)** — давит легит UI-записи | Reconcile/remove премис; поправить BusFader18 |
| ControlDeck inst fader :202/:223 | no-op, уже `!__v3`-guarded | LOW | Нет (self-guarded) |
| ControlDeck vocal fader :279/:291 | no-op | MED — живой writer | Дизайном, не delegateSync |
| VolumeControls/SyncEditorPanel/TakesPanel Effects | no-op | MED — живые writers, double-write со stem.store | Verify no double-apply |
| useTakesPlayback soloMute/restore | no-op (дефект) | ИНТЕНДЕД | Координить со StemChain solo mask |
| TakesPanel listen loop / autopause / MonitorMixPanel / PitchTab / trigger-visual | undefined/false | БЕНЕФИЦИАРЫ | Нет |
| monitor-mix.js / useWaveformData | свой контекст | MED — дубли контексты | audioContext синглтон |
| pitch-engine / recording.store / FullAvatar / audio-reactive / rehearsal-trigger / takes.recorder | тихая деградация | LOW-MED | Нет (бенефициары) |

**Комплаенс:** read-only; frozen-path файлы не названы (описаны как «frozen audio-core (read-only per protocol)» / «frozen bridges layer»); `_`-поля — только описательно, кроме цитаты плана «`_applySolo-cleanup`».
