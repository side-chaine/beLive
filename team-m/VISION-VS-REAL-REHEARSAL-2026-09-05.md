# 🔬 FORENSIC: ВИЗИЯ (мокап ChatGPT) vs РЕАЛЬНОСТЬ (Chrome-скрин) vs ЖИВОЕ «СЕЙЧАС»
**006 (Cline · GLM 5.3 Flash) · 2026-09-05 · Режим Rehearsal · по задаче Никиты «изучаем нижнюю панель»**

## 📦 Три кадра дела

| Кадр | Путь | Что это |
|---|---|---|
| 1. ВИЗИЯ | `C:\Users\nikit\Downloads\ChatGPT Image 5 сент. 2026 г., 10_08_37.png` | Мокап ChatGPT от 10:08 — «каким должен быть Rehearsal» |
| 2. РЕАЛЬНОСТЬ | `C:\Users\nikit\OneDrive\Изображения\Screenshots\chrome_n2cxSKdT1N.jpg` | Живой Chrome-скрин ~10:08 — «как есть сегодня» (From the Inside) |
| 3. СЕЙЧАС | `agent-browser\webbridge-probe-19-live-now.jpg` | Мой кадр через мост: Breaking the Habit, Chorus 3, пауза на «Tonight» (заимствована вкладка юзера, tabId 690395293) |

## 🧬 ГЕНЕЗИС ВИЗИИ — доказан
Мокап скопировал из реального скрина ДО ПИКСЕЛЯ: текст караоке «Heavy thoughts sift through dust and the lies», тайминг **0:35 / 2:55**, **BPM 105**, все 8 секций (Verse 1…Chorus 3) с их цветами и ∞, верхние пилюли Concert/Karaoke/bL/Rehearsal/Live. **Вывод: ChatGPT строил визию ПОВЕРХ реального скрина.** Значит мокап — это не фантазия, а ТЗ-приращение к текущему UI.

## ✅ СОВПАДАЕТ 1:1 (не трогать)
Верхний бар · ряд секций с лупами · центральный караоке-стейдж · большая оранжевая кнопка Play/Pause · Каталог справа вверху.

## ➕ ВИЗИЯ ДОБАВЛЯЕТ (новые зоны)

| Зона визии | Содержимое | Семя в реале? |
|---|---|---|
| **ЛЕВАЯ панель** | Профиль (Nikita, Lv 12, «Artist • Learner • Creator», motto) + 3 кольца (72% Vocal Skill / 28 Tracks / 136 Hours) + Track Progress 48% + **Practice Plan** (5 шагов: Breath Control ✓, Verse 1 85% ▶, Pre-Chorus, Chorus 1, Dynamics) + CTA «Start Next Exercise» | Частично: табы Quest/Styles/Notes (@e35/@e38/@e39) |
| **ПРАВАЯ панель — AI Coach** | Чат с Online-статусом, **карточка Suggested Exercise** («Release Tension in High Notes · 2 min ▶»), кнопки **Exercises / Tips / Explain / Next Part**, поле «Ask me anything...» | СЕМЯ: 🤖 @e40 в доке + Билли @e49 |
| **Killers-фича визии** | «Can we slow it down a bit?» → Coach **САМ ставит 85 BPM** (степпер −/+) → AI с руками, а не только словами | BPM-чипы сегодня StaticText (не клик), темп ±5% @e41/@e42 |

## ➖ ВИЗИЯ ТЕРЯЕТ (в реале есть, в мокапе исчезло)

| Элемент | В реале | Комментарий |
|---|---|---|
| Undo / Redo | @e23/@e24 | В мокапе спрятаны под «•••» |
| Record, Metronome, Volume | @e29/@e30/@e31–@e33 | Тоже спрятаны — транспорт свёрнут до ⏸ |
| Док-строка: Studio/Quest/Show/Split/Styles/Notes/🤖 (7+) | @e34–@e40 | В мокапе 5 пунктов (Studio/Quest/Split/Show/•••) |
| **Маскот** (чёрный человечек справа) | Живой, на обоих реальных кадрах | В визии потерян |
| Кодировка караоке | **прошедшие — цветные** (зелёные в Verse 1 / красные в Chorus 3), **текущая — белая**, **следующая — жёлтая** | В мокапе всё серое + белое — кодировка потеряна (гипотеза: цвет прошедших = цвет секции) |
| Inst/Voc 100, VMix OFF, mic OFF, Sync, B/P/M | док-строка (кандидаты @e41–@e43 для B/P/M) | В мокапе нет |

## 🗺 НИЖНЯЯ ПАНЕЛЬ РЕАЛА (мост-карта, 2 ряда)
**Ряд-транспорт:** Undo @e23 · Redo @e24 · [105 BPM · 4/4 · C#m/12A — StaticText] · Prev @e25 · **Play/Pause @e26** · Next @e27 · Stop @e28 · Record @e29 · Metronome @e30 · Mute @e31 · Volume @e32 (=100) · Позиция @e33.
**Ряд-док:** Studio @e34 · Quest @e35 · Show @e36 · Split @e37 · Styles @e38 · Notes @e39 · 🤖 @e40 · темп −5% @e41 · 100% @e42 · VMix @e44 · 🎤 @e45 · Sync @e46 · DNA @e47 · Expand @e48 · Билли @e49 · GetSongBPM @e50. Секции с ∞: @e7–@e22.

## 📌 БЭКЛОГ ИЗ ВИЗИИ
- **P1 — семена (проверить живьём):** что уже умеет 🤖/Билли (@e40/@e49); Quest-прогресс; Styles/Notes.
- **P2 — новые зоны:** левая панель прогресса (кольца/план/CTA); AI-Coach с действиями (setTempo/упражнения).
- **P3 — полировка:** свёртка транспорта, док 5→, waveform под таймлайном, возврат маскота в визию.

## 🔒 Правила сессии (директивы Никиты)
Анти-петля: 2-3 попытки → вопрос юзеру. Yandex-first: вкладку bL одолжить (`find_tab` с ПОЛНЫМ URL), новых не открывать. Chrome — под задачи юзера.

---

# 🖥 КОНСОЛЬНАЯ ФИКСАЦИЯ (11:40–11:45 · evaluate-зонды через мост · GO от Никиты)

## Каркас
`#app-root` + `#bg-scene-a`/`#bg-scene-b` (кроссфейд фонов). Чистый React (фибры на компонентах), НЕ Next.js (`window.__NEXT_DATA__` отсутствует), title «beLive - Трансляции для музыкантов».

## React-компоненты (по фибрам) + CSS-модули
- **WagonTrain** — ряд секций: `_wagon_1fmnl_23` ×8 + `_loopToggle_1fmnl_224` «Start loop» (∞)
- **TransportPanel** — `bl-pill`/`bl-pill--dim/--record/--metronome`/`bl-tbtn`/`bl-play`/`bl-stop`/`bl-volume__mute`
- **ControlDeck** — табы `_tab_z05dv_31` (Studio/Quest/Show/Split/Styles/Notes/🤖/Sync/DNA) + `_tabsToggle_z05dv_54` «Expand dock» (▾)
- **BpmButtons** — `_section_1j23j_69`: `_side_` −5 / `_center_` 100% / `_side_` +5
- **BillyDock** — `_root_1bn76_4`, состояние `_idle_1bn76_202`
- **ModeButtons** — `btn-concert/btn-karaoke/btn-rehearsal/btn-live`; **QuickActions** — Catalog/Гость

## Точные aria/title-метры (расшифровка «B P M»!)
- Экранные «B P M» = **темп-тройка**: «Замедлить темп на 5%» / «Сбросить к оригинальному темпу» (`bmp-btn bpm-value-btn`) / «Ускорить темп на 5%» — класс `bmp-btn` (опечатка разработчиков: bmp вместо bpm — сохранить как пасхалку!)
- **scale-btn ×3**: Уменьшить шрифт / Сбросить масштаб / Увеличить шрифт (масштаб текста караоке — в визии отсутствует, в реале есть!)
- unified-btn: **Play / Operator / «Синхронизация текста и музыки»**
- VMix title: «VMix — vocals L / music center / mic R (нужен включённый 🎤)»
- Inst-фейдер title: «V3-stems: Inst-фейдер = уровень минуса (music-bus); no-stems: инструментал-мастер (как в V2)» — документ архитектуры в DOM!
- Voc title: «Vocals volume». BPM-чипы: `bl-pill--static`, aria «BPM»/«Размер» (StaticText, некликабельны)

## Каталог v2 (в DOM)
tab-btn: Плейлисты(active)/История/Тренды · toggle: Поиск/Upload Track · 💾 Сохранить трек / ❌ Отмена · 📥 Import Markers · btn-danger «Удалить все треки из каталога» · `catalog-v2-close-btn`

## AI-окно (скрытое: `ai-chat-window hidden`)
«AI Оператор» + `ai-status-indicator` + `ai-model-switch-btn` («Сменить модель»!) + `ai-voice-btn` «Голосовой ввод» + `INPUT.ai-chat-input` placeholder «Спроси меня что-нибудь...» + `ai-send-btn`. Сообщений: 0. Второй input: `search-input` «Поиск треков...»

## Караоке-математика (_slotContainer_yf9xl_41 / _line_yf9xl_80)
Прошедшие: `color(srgb 0.966 0.427 0.387 / 0.707)` — красный @70% · Текущая: `rgb(255,255,255)` · (следующая жёлтая — вне кадра при паузе в конце секции)

## Панели ControlDeck (innerText-тур с автовозвратом: Quest→Styles→Notes→Quest ✓)
- **Styles — ПУСТА** (контента нет) · **Notes = вокальный диапазон**: «🎤 Mic · vocal · C2 C3 C4 C5 C6» — живая семяшка для Practice Plan из визии! · Quest-панель при свёрнутом доке тоже пуста (▾ = док свёрнут)

## 🔥 ГЛАВНОЕ ОТКРЫТИЕ (probe-22): Quest-панель = кокпит практики
При возврате на вкладку Quest **док развернулся**, открыв панель: **волна трека (canvas)** с зумом по секции **«Verse 1 · 0:33.68–0:38»** (секция привязана к волне с точностью до сотых!) + кнопки **Bookmark(s) / COMPARISON / ORI / 50% / ↓ / M** + **три слота Take 1 / Take 2 / Take 3 с «+ RECORD»** + глазки Билли на волне справа. **Это ЖИВОЕ СЕМЯ Practice Plan + Track Progress из визии** — полпути уже сделано разработчиками. Экспанд произошёл при клике-возврате Quest (либо параллельным кликом Никиты) — поведение «таб Quest ⇒ разворачивает док с волной/тейками» зафиксировано как факт.

## 🐛 Баг-кандидат №1
Таймер транспорта: **«474:53 / 3:16»** при треке 3:16 — счётчик позиции уходит в астрал (похоже, копит время сессии с загрузки страницы, а не позицию трека).

## 🤖 Билли — анти-петля 3/3 → стоп (по директиве Никиты)
Попытки: 1) bridge `click [class*=_root_1bn76]` → попал в DIV, _idle; 2) `button[...]` → **not found: Билли — `div[role=button]`**; 3) полный pointer-секвенс (pointerdown→click) + focus + Enter → `_idle`, окно `hidden`, msgs:0. **Вывод: открытие гейтится на isTrusted/нативных событиях → нужен настоящий клик юзера**; после него дамп чата мгновенный (окно уже в DOM).

## Артефакты (agent-browser\)
`diag-e1..e4.json` (сырые зонды) · `snap-1125.json` (рефы: @e1 Concert … @e8 Start loop …) · `webbridge-probe-20/21/22-billy*.jpg`

---

# 📡 M/N-СЕРИЯ ЗАМЕРОВ (11:58–12:01 · финал по GO Никиты)

## M1 · Билли
`_idle`, окно `hidden` — юзер ещё не кликал. Держится анти-петля 3/3.

## M2 · Аудио-архитектура
**media-элементов НОЛЬ** (0 `<audio>/<video>`) — весь звук на **WebAudio**. В `window` открыты: `audioEngine`, `PitchDetector` (статика: `forFloat32Array/forFloat64Array/forNumberArray`), `__beliveBridgeFacade` (event-bus-обёртка: `init/destroy/subscribeOnce`, патчит `add/remove/dispatch`, `_subs/_strongRefs`), `beLiveSwitchMode()` (function), `__belive`, `__BELIVE_BOOTED__=true`.

## M5 · Canvas
Два: **930×135** (волна Quest-панели) + 300×150 (дефолт). Док-тоггл `_tabsToggle_z05dv_54` = «▾».

## M3+N2 · Таймер: два в DOM
Видимый **`bl-progress-led__time` = «474:53 / 3:16»** — при паузе ЗАМОРОЖЕН (тик-тест 2.5 c: нулевая дельта) + невидимый «0:00 / 0:00» (пустой класс, шаблон?).

## ✅ N4 · РАЗГАДКА БАГА
`__belive.currentTime` = **28493.26966499998 с = ровно 474:53**! Счётчик копит время **от загрузки страницы** (~04:07, совпадает с uptime) и **не сбрасывается/не переанкеруется при смене трека**; при паузе замирает. Отображается как позиция → мусор «474:53 / 3:16». Корень для кода: clock не переанкеруется при `loadTrack`/`seek` (ср. `transport._seekGeneration`, `pipeline._currentOffset`).

## 🗝 N1+N4 · ПОЛНАЯ API-ПОВЕРХНОСТЬ (для управления из консоли/моста)
- **`window.audioEngine` — 36 собственных методов:** `getCurrentTime, play, pause, stop, seekTo, setCurrentTime, loadTrack, setInstrumentalVolume, setVocalsVolume, setMicrophoneVolume, setStemVolume, setStemsEnabled, setStemMute, setStemSolo, setStemPan, setStemsMode, getStemMeterLevel, getStemAnalyser, getStemAudioBuffer, awaitStemReady, enableMicrophone, disableMicrophone, enableVocalMix, disableVocalMix, setPlaybackRate, getPlaybackRate, attachProgramSource, detachProgramSource, getProgramCaptureStream, ensureInstrumentalBuffer, setLoop, clearLoop` + свойства `hybridEngine, audioContext, playbackRate`
- **`__belive.transport` (proto):** `state, currentTime, duration, loopEnabled/loopStart/loopEnd, playbackRate, isV3Active, isAudioContextRunning, orchestrator, play, pause, stop, seek, setPlaybackRate, setLoop, clearLoop, attachPipeline, dispose` + внутренние `_state, _seekGeneration, _pipelineController, _rateThrottler, _appliedRate, _lastTrackDuration, clock, stems, ctx`
- **`__belive.stemOrchestrator`:** `stems, masterClockStemId, onTrackEnded, _programOut, _vocalHall, _vmixCenter`
- **`__belive.pipeline`:** `_chainA/_chainB` (A/B-цепи), `_stretchPool` (тайм-стретч), `_loopStrategy`, `_outputGain`, `_busAGain/_busBGain`, `_activeBackend/_intendedBackend/_isCrossfading` (**кроссфейд бэкендов**), `_stemRawVolumes, _busVolumes, _crashedStems, _deadStems, _stemMuted`, `_vocalHallSend/_vocalHallMeter/_vocalHallTarget/_vocalHallSource` (вокальный «зал»)
- **`__belive.monitorRouter`:** `programInput, vocalHallInput, micInput, vmixCenterIn, vmixVocalIn, vmixMicIn, _vmixMerger, _vmixMaster, captureStream, monitorStream, mainStream, _mainDelay, _micDelay, _monitorGain, _vmixMicGate, _monitorMaster, _hallMaster, _musicGain, _vocalHallGain, _captureGain, _micCompensationMs, _mainCompensationMs` (**компенсация латентности мика!**)
- **`__belive.deviceManager`:** `_monitorEl, _mainEl, _devices, monitorStream, mainStream`; `routeCheck` — не вскрывался; `trackUrls` — объект

## N3 · DATA-МОДЕЛЬ (data-атрибуты DOM)
Секции: `data-block-type="verse"`, `data-active`, `data-in-loop`, `data-has-sub-blocks`, root `data-reactive="true"`. Строки караоке: **`data-line-index=51`**, **`data-slot-id="auto-block-7-1-5"` (авто-маркеры! стык с «📥 Import Markers»)**, `data-active`, `data-block-type="chorus"`, **`data-word-fx-mode="underline"`**, `data-is-preview`, `data-grow-cue`, `data-line-next`, `data-reactive-words`.

## 💡 Вывод для команды
Приложение полностью управляемо через `window.audioEngine` + `window.__belive.*` БЕЗ DOM-хаков — мост отдаёт `evaluate` на живую вкладку; это легальный лифт для всех агентов (см. отчёт в реестре 12:0x).
