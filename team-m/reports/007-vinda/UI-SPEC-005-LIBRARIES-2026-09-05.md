# UI-SPEC-005 · БИБЛИОТЕКИ И ПАТТЕРНЫ 2026 · ТРИ ЗОНЫ

**Агент:** 005 (Research-охотник №1) · **Дата:** 2026-09-05 · **Роль:** research, без кода/коммитов/архитектуры
**Контракт:** `team-m/ui-spec/UI-CHANGE-SPEC-2026-09-05.md` (Никита+GPT) · **Досье:** `team-m/DOSSIER-RESEARCH-005-UI-SPEC-2026-09-05.md` v2
**Правило верификации:** каждый факт — с живого источника (npm registry API / GitHub / Context7 / MDN / официальный мануал Ableton). Без живой проверки = «не знаю». Лицензии — отдельной строкой; GPL/AGPL = 🔴 красный флаг.
**Доп. верификация 005 (живые curl в npm-реестр, 05.09 13:3x):** `@audio/pitch-pyin` MIT v1.0.1 ✅ · `@audio/pitch-hps` MIT v1.0.1 ✅ · `react-range` MIT v1.10.0 ✅ — три ключевые карточки подтверждены реестром лично.

---

## ЗОНА-1 · ПИТЧ-ЛИБЫ 2026 ДЛЯ BLEED-ПРОБЛЕМЫ (Узел-1c)

Задача: YIN-ворклет жив (`src/audio/pitch/yin-processor.js:2`, self-contained `:1-6`), но в репетиции мик слышит ГОЛОС + ИНСТРУМЕНТАЛ (полигармоническая смесь) → YIN может ловить гармоню инструментала. Ищем УСИЛИТЕЛИ, НЕ замену.

### Карточка 1.1 · @audio/pitch-pyin ⭐ ГЛАВНАЯ НАХОДКА

- **Что делает:** pYIN — вероятностный YIN (Mauch & Dixon, ICASSP 2014): прогоняет YIN на нескольких порогах с Beta(2,18)-приором и возвращает **РАСПРЕДЕЛЕНИЕ кандидатов** `{ freq, clarity, candidates: [{freq, prob}]}`, а не одну жёсткую версию. README прямо: «More robust than YIN on ambiguous frames» / «Use when: ambiguous pitched content».
- **ЛИЦЕНЗИЯ:** MIT (npm registry API + GitHub audiojs/pitch).
- **Релиз/активность:** 1.0.1, опубликован **2026-07-11** — свежайший; зонтичный `@audio/pitch` 2.0.4 — **2026-08-28**. Репо audiojs/pitch живое (26 коммитов, CI-бейдж), но молодое: 2 звезды, ~1.2-1.3k скачиваний/мес. ⚠️ «кто в проде» = пока никто заметный (честно).
- **Вес:** атом pyin ≈ **2.2 kB** (bundlephobia dependencySizes: 2186 B); зонтик целиком 10.3 kB / 4.2 kB gzip; спектральные атомы тянут `fourier-transform` +9.5 kB.
- **Чего НЕ умеет:** не realtime-фреймворк — чистые функции над `Float32Array`, без WebAudio/ворклет-обвязки; README честно: pYIN **~10× медленнее YIN** (multi-threshold sweep); не умеет полифонию сам по себе (кандидаты — топ-варианты монопитча, не аккорды).
- **file:line применимости:** main-thread second opinion рядом с существующим пассивным YIN — `src/audio/pitch/yin-detect.ts:122` (там уже CMND посчитана для всех tau — кандидатная логика ложится в тот же кадр) и `src/audio/pitch/pitch-engine.ts:17` (initFromNode = AnalyserNode + main-thread YIN). Ворклет НЕ трогаем: чистая функция встаёт в rAF-тикер 46 мс как арбитр кандидатов.

### Карточка 1.2 · @audio/pitch (зонтик) + атомы HPS / SWIPE / McLeod

- **Что делает:** набор монопитч-алгоритмов одним пакетом: YIN, McLeod (MPM), pYIN, autocorrelation, AMDF, **HPS (harmonic product spectrum)**, cepstrum, **SWIPE'**. У каждого «Use when / Not for» прямо в README + таблица сравнения (YIN: октавные срывы rare; pYIN: точность ★★★★★, шум ★★★★★; HPS: «harmonic-rich signals (guitar, piano, brass)», **умеет missing fundamental**; SWIPE: «robust against octave errors», чистые инструментальные сигналы).
- **ЛИЦЕНЗИЯ:** MIT.
- **Релиз/активность:** 2.0.4 от **2026-08-28**; атомы ставятся отдельно (`npm i @audio/pitch-hps` и т.д.).
- **Вес:** yin 1.3 kB · mcleod 1.4 kB · hps 2.1 kB · swipe 2.6 kB · cepstrum 1.6 kB (bundlephobia).
- **Чего НЕ умеет:** спектральные (HPS/cepstrum/SWIPE) требуют окно **степень двойки** (2048 у нас уже так — `yin-processor.js` bufferSize 2048, ок); HPS «Not for: pure sinusoids, very noisy signals»; SWIPE в пакете — упрощённая однооконная форма (без мультирезрешётной пирамиды оригинала).
- **file:line применимости:** HPS — кандидат на «гармо-наводку» (инструментал = harmonic-rich, мы ЗНАЕМ его питч из трека): сравнение гармоник кандидата YIN против известного спектра инструментала. Тот же вход `yin-detect.ts`, тот же кадр.

### Карточка 1.3 · pitchy 4.1.0

- **Что делает:** McLeod Pitch Method («A Smarter Way to Find Pitch», McLeod & Wyvill 2005) — нормализованная разность + умный peak-picking; возвращает `[pitch, clarity 0..1]`. TypeScript из коробки, ESM-only.
- **ЛИЦЕНЗИЯ:** MIT.
- **Релиз/активность:** 4.1.0, последний релиз **2024-01-04** (~3 года тишины; но 10.2k скачиваний/нед, 27 версий истории, стабильна как учебник). Статус: стабильно-замороженная.
- **Вес:** **8.0 kB / 2.8 kB gzip** (bundlephobia API: size 7975, gzip 2828, внутри fft.js 4.3 kB).
- **Чего НЕ умеет:** нет кандидатов/вероятностей — одна версия на кадр (для bleed-арбитража хуже pYIN); ESM-only (для нас ок — Vite); нет WebAudio-обвязки.
- **file:line применимости:** альтернативный main-thread детектор для A/B-сравнения с нашим YIN в vitest-тестах на смесях (чистые функции = тривиальные юнит-тесты).

### Карточка 1.4 · pitchfinder 2.3.4 🔴 GPL

- **Что делает:** 5 алгоритмов (YIN, McLeod, AMDF, Dynamic Wavelet; порты из TarsosDSP/aubio), Float32Array → частота; мульти-детекторный режим `frequencies([...detectors])`.
- **ЛИЦЕНЗИЯ:** 🔴 **GPL v3** (npm: «License: GNU v3»). Для beLive (MIT-проект, package.json:56 `"license": "MIT"`) = **красный флаг, вето на зависимость**.
- **Релиз/активность:** 2.3.4 от **2025-12-16** (9 мес назад), 6.4k нед.
- **Вес:** 0 зависимостей; точный вес не замерял (честно).
- **Чего НЕ умеет:** см. выше + GPL-заразность.
- **Вывод:** только как справочник алгоритмов, не как зависимость.

### Карточка 1.5 · essentia.js 0.1.3 🔴 AGPL

- **Что делает:** WASM-сборка C++ Essentia (MTG UPF): сотни алгоритмов MIR (PitchYinFFT, HPCP и т.д.), realtime + offline, TF.js-модели.
- **ЛИЦЕНЦИЯ:** 🔴 **AGPL-3.0** — красный флаг вдвойне: сетевой copyleft. Для веб-приложения = риск обязанного раскрытия. **Вето.**
- **Релиз/активность:** 0.1.3, **5 лет без релиза**; README сам: «under rapid development, backwards compatibility is not yet guaranteed».
- **Вес:** WASM-ядро; распакованный размер не замерял (честно).
- **Чего НЕ умеет:** стабильности, лицензионной чистоты.
- **Вывод:** наш rnnoise-прецедент WASM (RNNOISE-спеки, Apache-2.0) показывает правильный путь: WASM-модуль с чистой permissive-лицензией в vendor/ + LICENSE/NOTICE. essentia.js под этот прецедент не проходит.

### Карточка 1.6 · aubiojs 0.2.1 🔴 нет лицензии

- **Что делает:** WASM-порт aubio (pitch + tempo), emscripten.
- **ЛИЦЕНЗИЯ:** 🔴 **License: none** в npm — юридическая пустота = красный флаг.
- **Релиз/активность:** 0.2.1, **4 года назад**; 744 нед.
- **Вес:** 0 зависимостей; размер не замерял.
- **Вывод:** вето по лицензии.

### Карточка 1.7 · ml5.js — pitchDetection МЕРТВ в актуальной версии

- **Что делает (делал):** ml5 0.12.2 (архивный ml5-library) имел `ml5.pitchDetection` с CREPE-моделью. **Актуальный ml5-next-gen 1.4.0 (MIT, релиз месяц назад, живой) в `src/` НЕ содержит PitchDetection** — проверено по дереву GitHub ml5js/ml5-next-gen/src: только BodyPose, BodySegmentation, DepthEstimation, FaceMesh, FeatureExtractor, HandPose, ImageClassifier, NeuralNetwork, ObjectDetection, Sentiment, SoundClassifier, utils. Доки 0.12.2 отдают баннер «Looking for the old ml5.js reference? archive-docs».
- **ЛИЦЕНЗИЯ:** MIT (обе версии).
- **Вес:** ml5 0.12.2 = **27.6 MB unpacked** (registry), тащит TF.js 1.x + face-api + posenet — монстр ради одного питча.
- **Чего НЕ умеет:** актуальная — питча вообще; старая — CREPE ~few-MB модель, main-thread TF.js, не worklet.
- **Вывод:** путь ml5 pitch = тупик 2026. CREPE-lite в браузере живым npm-пакетом **не найден** (см. НЕ НАЙДЕНО).

### Карточка 1.8 · @spotify/basic-pitch 1.0.1 (TS-сиблинг)

- **Что делает:** полифоническая AMT-сеть Spotify (ICASSP 2022): аудио → MIDI + pitch bends; `evaluateModel(audioBuffer, cb)` кадрово отдаёт frames/onsets/**contours**; ресемплит вход в 22050 Гц.
- **ЛИЦЕНЗИЯ:** **Apache-2.0** (чисто; наш rnnoise-прецедент Apache-2.0 = совместим).
- **Релиз/активность:** 1.0.1 от **2022-08-05** (4 года; Python-сиблинг spotify/basic-pitch жив: 5.5k звёзд, 266 коммитов — движение есть в Python, TS-пакет заморожен).
- **Вес:** модель отдельна от кода (`new BasicPitch(model)`); суммарный вес не замерял.
- **Чего НЕ умеет:** НЕ realtime (батч-инференс на AudioBuffer), не worklet; «works best on one instrument at a time».
- **file:line применимости:** единственный найденный легальный кандидат на роль **(b) known-reference-guided**: OFFLINE-прогон инструментала при загрузке трека → таблица известных питчей/гармоник минуса → наводка для live-фильтра кандидатов YIN/pYIN. Пайплайн-стык: загрузка стемов в `HybridPipelineService` (роль 'master' = instrumental, `stemTypes.ts:43`), оффлайн-анализ до старта репетиции.

### Зона-1(b) · known-reference-guided detection — готовых ЛИБ НЕТ (честно)

npm-поиск «score following / accompaniment sync» дал только abcjs (MIT, нотный рендер) и @music-i18n/musicxml-player (GPL-3.0) — нерелевантно. Готовой «reference-guided pitch lib» на npm не существует. **Обходной путь (обоснован фактами выше):** наш кейс уникально сильный — мы ЗНАЕМ инструментал (он у нас в стемах/треке). Компоненты: (1) pYIN даёт кандидаты+вероятности (карточка 1.1) → (2) фильтр кандидатов против известного питча/гармоник инструментала (HPS-логика, карточка 1.2, или offline-таблица из basic-pitch, карточка 1.8) → (3) октавный замок уже есть (досье, скаут-факт 1). Это усилитель над YIN, не замена — ровно по ТЗ.

### Зона-1(c) · WASM-DSP

Прецедент в репо: RNNOISE-спеки (vendor/rnnoise.wasm, Apache-2.0, LICENSE+NOTICE — обязательное условие суда RNNOISE-009). Вывод по питчу: **WASM не нужен** — чистые JS-атомы @audio/pitch по 1.3-2.6 kB дешевле и тестируемее в vitest, чем любой emscripten-модуль. WASM-путь оставляем для шумодава (уже спекфицировано), не для питча.

### ВЕРДИКТ ЗОНЫ-1

**Дёшево и в стек:** `@audio/pitch-pyin` (MIT, 2.2 kB, релиз 2026-07) как main-thread арбитр кандидатов над живым YIN-ворклетом + `@audio/pitch-hps` для гармо-сверки с известным инструменталом; стык — `yin-detect.ts:122`/`pitch-engine.ts:17`, ворклет не трогаем. **Дорого/отказ:** essentia.js (AGPL), pitchfinder (GPL), aubiojs (no license), ml5-pitch (мёртв в 1.4), CREPE-в-браузере (пакета нет). basic-pitch (Apache-2.0) — только оффлайн-эталон, не realtime. Готовой reference-guided либы нет — строим из pYIN-кандидатов + известного минуса (наш уникальный актив).

---

## ЗОНА-2 · MASTER + TIED-ФЕЙДЕРЫ: ПАТТЕРНЫ ИЗ ПРОДА (Узел-2d)

Наше «как есть»: Inst/Voc независимы (`ControlDeck.tsx:180-328`), шины vocal-bus/music-bus, `effective = clamp(raw) × clamp(busFactor)` (BusFader18, `HybridPipelineService.ts:542-550, 628-646`; тесты `BusFader18.test.ts:150-208`), instrumental ВНЕ шин (`stemTypes.ts:37-46`, INVARIANT master-bus ≠ music-bus — clock). Мастера нет.

### Карточка 2.1 · Ableton Live 12 — multi-select linked faders (официальный мануал, §18.2)

- **Паттерн:** при мультивыборе треков «adjusting one of their mixer controls will adjust the same control for the other tracks. If the tracks have differing values… **this difference will be maintained as you adjust the parameter**».
- **Расшифровка (важно для противоречия спеки):** фейдеры Live — в **dB**; «сохранённая разница» = ΔdB константа ⇔ **отношение gain сохраняется точно**. То есть прод-паттерн связанных фейдеров = АДДИТИВНЫЙ В dB = МУЛЬТИПЛИКАТИВНЫЙ В ЛИНЕЙНОМ GAIN. Пример спеки «80→70, 50→40» аддитивен в ПРОЦЕНТАХ (линейный домен) — именно поэтому он ломает соотношение 1.6→1.75. Оба факта сходятся: **мастер обязан быть ×-фактором в gain (или +Δ в dB), но не −10 в линейных %**.
- **Применимость:** если мастер beLive показывает %, внутри хранить `masterFactor` и применять `effective = clamp(raw) × busFactor × master` — прямое расширение формулы BusFader18 без ломки шин.

### Карточка 2.2 · Ableton Live 12 — Group Track / Main Track (§18.3-18.4)

- **Паттерн:** Group Track = «summing container»: дети автоматически рутились в группу, у группы СВОЙ фейдер ПОСЛЕ суммирования — фейдеры детей не двигаются. Main track = «default destination for all other tracks», mastering-эффекты, «only one Main». Плюс: 32-bit float headroom — треки могут «into the red» без клипа, проблемно только на Main/экспорте (наш WebAudio-граф = float32, та же физика: перегруз пары >1 НЕ клипует до destination).
- **Применимость:** это мультипликативная модель (B): мастер = отдельный gain-стейдж над шинами. Маппинг на нас: masterFactor применяется к vocal-bus, music-bus И instrumental (который вне шин — `stemTypes.ts:43`) — тремя множителями в существующей формуле, инвариант master-clock не задет (mute ≠ pause, `stemTypes.ts:331-346`).

### Карточка 2.3 · Ableton Live 12 — Crossfader = «on-the-fly VCA group» (§18.5)

- **Паттерн:** официальный термин мануала: «you can think of the crossfader as **an on-the-fly VCA group**»; A/B-assign на трек, 7 кривых (Constant Power и др.), «merely influences the signal volume at each track's gain stage» — НЕ маршрутизация. Кривые = готовая математика антикоррелированной пары: в центре 50/50 оба на −3 dB (equal-power), по краям один muted.
- **Применимость:** это ТОЧНО паттерн «встречи в центре» для синей↔красной пары Узла-3d/13 спеки: пара VOCAL/INST как A/B-назначения одного кроссфейдера (опциональный режим «balance» поверх двух независимых фейдеров).

### Карточка 2.4 · Tone.js 15.1.22 — channel strips + Destination

- **Что делает:** `Tone.Channel(volume?, pan?)` = канальный стрип (volume в **dB**, pan, solo, mute) → `toMaster()`/`Tone.Destination`; `source.chain(filter, pan, volume, Tone.Destination)`; Meter на Destination. Т.е. прод-паттерн: пер-канальный dB-фейдер → мастер-шина Destination с собственным volume.
- **ЛИЦЕНЗИЯ:** MIT (registry: `"license":"MIT"`, Yotam Mann).
- **Релиз/активность:** 15.1.22, релиз ~2025-04; **291k скачиваний/нед** — один из самых живых веб-аудио-пакетов.
- **Вес:** unpacked 5.4 MB (полный фреймворк) — нам как зависимость НЕ нужен (свой V3-граф), как паттерн — да.
- **Чего НЕ умеет:** авто-линк фейдеров (каждый Channel сам по себе; связанные = руками через события).
- **Применимость:** паттерн-референс, не библиотека: подтверждает «master = отдельный gain после суммирования, дети в dB».

### Карточка 2.5 · wavesurfer.js 7.12.11 + wavesurfer-multitrack

- **Что делает:** wavesurfer-multitrack (супер-плагин katspaugh): `setTrackVolume(trackIndex, volume)` — пер-трек громкость, `setEnvelopePoints` / fadeIn/fadeOut per track, треки с `volume?` в TrackOptions. **Мастер-фейдера в мультитрек-плагине НЕТ** — только пер-трек.
- **ЛИЦЕНЗИЯ:** wavesurfer.js — **BSD-3-Clause** (registry 7.12.11).
- **Релиз/активность:** 7.12.11 — активно развивается 2026 (registry живой, katspaugh); мультитрек-плагин — docs-сайт актуален.
- **Чего НЕ умеет:** tied/master-фейдеров нет вовсе — независимо-пер-трековая модель (как наш «как есть»).
- **Применимость:** подтверждает, что «мастер, сохраняющий баланс пары» — НЕ стандарт веб-аудио-инструментов; это наша фича поверх, и математику надо определять самим (формула 005_2).

### Карточка 2.6 · Терминология прод-мира → веб

- **VCA-группы (Pro Tools):** мастер-фейдер физически ДВИГАЕТ дочерние фейдеры (спид VCA-фейдер — смещение, дети сохраняют относительные позиции). Веб-аналог = Ableton multi-select (карточка 2.1).
- **Group fader (Ableton/SSL):** мастер = gain ПОСЛЕ суммирования, дети не двигаются (карточка 2.2).
- **Dual-concentric (SSL-стайл):** маленький внутренний фейдер = своё, внешнее кольцо = VCA-офсет. **В проверяемых веб-DAW не найден** (см. НЕ ПРОВЕРЕНО).
- **В проде реально:** обе модели Ableton (ΔdB-linked + group-gain) + Tone.js Destination. Для beLive мультипликативная (B) — нативна к WebAudio (Gain-ноды перемножаются) и к нашей BusFader18.

### ВЕРДИКТ ЗОНЫ-2

Прод-паттерн = **мультипликативный мастер** (gain-стейдж после шин; Ableton Group/Main, Tone.js Destination, наш ×masterFactor поверх `clamp(raw)×busFactor`), а «сохранение баланса» у связанных фейдеров в проде = **ΔdB-презерв** (Ableton multi-select), что математически тождественно ×-сохранению gain-соотношения. Аддитив в линейных % (пример спеки «80→70/50→40») баланс ЛОМАЕТ — подтверждено и арифметикой (1.6→1.75), и отсутствием такого паттерна в проде. Кроссфейдер-кривые Ableton (equal-power, встреча −3 dB/−3 dB) — готовая математика «встречи в центре» для пары. Dual-concentric в вебе не встречен. Soundtrap/BandLab/AudioSauna доки — недоступны для верификации, честно в НЕ ПРОВЕРЕНО.

---

## ЗОНА-3 · COUPLED-FADER GLOW ПАТТЕРН (Узел-3d)

Спека: пара #38A8FF/#FF5B5B, тонкая световая связь (усиление у активного, встреча в центре), фон #080A10, без перф-удара. Сейчас: зародыш в `ControlDeck.tsx` — Inst fill `rgba(255,60,60,0.3)` (:243), Voc `rgba(74,158,255,0.3)` (:309), анимация через `width` с `transition 0.05s` (:244, :310).

### Карточка 3.1 · CSS conic-gradient() (MDN, Baseline с 11.2020)

- **Что делает:** градиент по окружности; синтаксис `from <angle> at <pos>` + угловые стопы; **поддерживает цветовую интерполяцию `in hsl shorter/longer hue`, `in oklch`, `in lab`** (CSS Color 4/5, формальный синтаксис MDN включает `<color-interpolation-method>`).
- **ЛИЦЕНЗИЯ:** веб-платформа (не либа).
- **Перф:** статический градиент = ноль JS; анимация позиции — через CSS custom property + `@property`/paint, без ре-рендера React.
- **Критичный факт для нашей пары (арифметика, проверяемо):** #38A8FF → hue ≈ 206°; #FF5B5B → hue ≈ 0°. **Shorter-дуга** 206→360 проходит 270-300° (фиолетово-магентовая зона) — ровно то, что спека запрещает («не фиолетовый»); **longer-дуга** идёт через зелёно-жёлтое (мутно). Вывод: чистая hue-интерполяция в ЛЮБОМ направлении грязна; чистый переход = `in oklch` с управлением хромы (подъем L, провал C в середине) или явный нейтральный мост-стоп. Это подтверждает вход 005_2 (Узел-3a Lab/LCH) — ссылка, не дубль.
- **file:line применимости:** glow-ореол активного фейдера: `conic-gradient(from var(--glow-angle) at 50% 50%, transparent, #38A8FF22, transparent)` на псевдоэлементе трека.

### Карточка 3.2 · CSS mix-blend-mode: screen (MDN, Baseline с 01.2020)

- **Что делает:** аддитивное смешивание элемента с фоном стекинг-контекста; MDN: `plus-lighter` полезен для cross-fade без мигания; `screen` = «свет + свет» — физика встречи двух glow.
- **Перф-факт MDN:** каждый mix-blend-mode создаёт стекинг-контекст = отдельный композит-слой. Для 2 фейдеров — дёшево; на весь UI — дорого.
- **Применимость:** два glow-слоя (синий у Voc-позиции, красный у Inst-позиции) с `mix-blend-mode: screen` в общем `isolation: isolate` — в точке встречи свет СКЛАДЫВАЕТСЯ (как два прожектора), давая естественную «встречу в центре» без третьего цвета-грязи. Изоляция обязательна (MDN-пример с isolate), иначе бленд с фоном #080A10.

### Карточка 3.3 · box-shadow layered glow

- **Что делает:** несколько теней разного радиуса/альфы = мягкий ореол без картинок; анимация `box-shadow` = paint на каждый кадр (не композит).
- **Применимость:** статичный ореол трека — да; АНИМИРУЕМЫЙ glow — нет (перф-удар). Анимируем через opacity/transform псевдоэлемента с фиксированной тенью.

### Карточка 3.4 · will-change (MDN)

- **Факт MDN:** «last resort», «Don't apply to too many elements», «switch on and off using script», вешать ДО анимации, не в @keyframes; распространяется на всё поддерево.
- **Применимость:** НЕ вешать превентивно на фейдеры; при драге — `will-change: transform` на fill-слое, на mouseup снять.

### Карточка 3.5 · transform vs width (наш конкретный перф-баг-кандидат)

- **Факт:** сейчас fill-слои анимируются через `width: ${...}%` + `transition: width 0.05s` (`ControlDeck.tsx:242-244` красный, `:308-310` синий) — width = layout+paint каждый кадр. Замена: `transform: scaleX(v)` с `transform-origin: left` на полном треке = композитор-only. Это не либа — это паттерн, привязанный к строкам.
- **Плюс CSS custom properties:** позиция/цвет через `--voc-x`, `--inst-x`, `--glow` — style-цель без React-стейта (rAF пишет в `el.style.setProperty`).

### Карточка 3.6 · Canvas 2D (прецеденты репо)

- **Прецеденты в коде:** `src/hooks/useStemWaveform.ts:71` (getContext('2d')), `:93-107` (ResizeObserver + dpr-скейл), `src/takes/components/TakesCanvas.tsx:59-67` (dpr). Glow на canvas: паттерн = предрендеренный спрайт-градиент в offscreen-canvas, отрисовка с `globalCompositeOperation: 'lighter'` (canvas-эквивалент screen). **Избегать `ctx.shadowBlur`** — печально известный перф-киллер (медленная растеризация на каждый вызов).
- **WebGL:** для ДВУХ фейдеров = оверкилл (создание контекста, шейдеры ради двух ореолов); не рекомендую.
- **Применимость:** canvas оправдан только если glow станет «дышащей» анимацией с блендом траекторий; для статичной пары — CSS дешевле.

### Карточка 3.7 · react-range 1.10.0

- **Что делает:** unstyled React-слайдер: renderTrack/renderThumb = полный контроль DOM; **`getTrackBackground({values, colors})` строит multi-segment linear-gradient трека из коробки** (values.length+1 === colors.length) — ровно наш кейс «синий слева / красный справа / встреча по позициям двух бегунков»; vertical `Direction.Up/Down`; WAI-ARIA slider role, keyboard, RTL, touch.
- **ЛИЦЕНЗИЯ:** MIT.
- **Релиз/активность:** 1.10.0, ~2 года назад; **243k скачиваний/нед**, 191 dependents, e2e playwright — стабильно-зрелая.
- **Вес:** **6 kB gzip, 0 зависимостей** (README, бейдж bundlephobia).
- **Чего НЕ умеет:** нет встроенных glow/стилей (by design); один компонент Range (мастера-«tied»-логику пишем сами).
- **file:line применимости:** замена ручных onMouseDown-фейдеров `ControlDeck.tsx:180-328` на два `<Range>` с `getTrackBackground` — та же модель значений 0..1, store-вызовы `setBusVolume` сохраняются.

### Карточка 3.8 · @radix-ui/react-slider 1.4.7 (+ shadcn/ui Slider)

- **Что делает:** unstyled примитив слайдера: Root/Track/Range/Thumb, data-атрибуты для стилизации, keyboard/ARIA из коробки; вертикальная ориентация.
- **ЛИЦЕНЗИЯ:** MIT (registry: `"license":"MIT"`, SLSA-provenance публикация через GitHub Actions — очень живая доставка).
- **Релиз/активность:** 1.4.7 актуальна (2026); React 16.8-19 peer (наш React 19.2.4 — ок, package.json).
- **shadcn/ui:** MIT; модель «копируй код в репо» — ноль зависимостей; НЮАНС: shadcn v4 мигрирует Slider с Radix на Base UI (`Slider.Range → Slider.Indicator` — док migration). Для beLive (не antd/tailwind-проект) ценность Radix-примитива выше, чем копия shadcn-компонента.
- **Вес:** ~170 kB unpacked (registry) c внутренними radix-пакетами; в бандле — мал (unstyled).
- **Чего НЕ умеет:** glow/градиентов нет — стилизуем сами через data-slot'ы.
- **Применимость:** если нужен доступный готовый слайдер-скелет; для пары-«tied» логика всё равно наша.

### Карточка 3.9 · @rc-component/slider (rc-slider)

- **Что делает:** слайдер Ant Design-экосистемы: single/range, marks, dots, **semantic `classNames`/`styles` слоты (tracks/track/rail/handle)**, `handleRender` кастомный рендер ручки, vertical, keyboard, editable range.
- **ЛИЦЕНЗИЯ:** MIT (README/LICENSE GitHub).
- **Релиз/активность:** 3.1k звёзд, 767 форков, активные релизы 2026 (Ant Design ecosystem, CI).
- **Вес:** не замерял (честно).
- **Чего НЕ умеет:** glow; вёрстка заточена под antd-семантику (CSS-импорт `assets/index.css`).
- **Применимость:** альтернатива 3.7-3.8 если зайдём в antd-стиль; для изолированной пары фейдеров — тяжелее необходимого.

### ВЕРДИКТ ЗОНЫ-3

**Дёшево и без перф-удара:** CSS-first — glow через `conic-gradient`-ореолы + `mix-blend-mode: screen` в `isolation: isolate` для «встречи в центре» (физика сложения света, без фиолетовой грязи), анимация через CSS custom properties + `transform: scaleX()` вместо текущего `width`-перхода (`ControlDeck.tsx:242,310` — конкретные строки к замене), `will-change` только на драге (MDN-правила). Интерполяция пары — только `oklch` с хрома-контролем или нейтральный мост (shorter-hue проходит фиолет — арифметика 206°→0°). **Либа:** react-range 1.10.0 (MIT, 6 kB, 243k/нед, `getTrackBackground` = двухцветный трек из коробки) — лучший стык с нашим store 0..1; Radix 1.4.7 — если нужен a11y-скелет; rc-slider — только при antd-курсе. Canvas — лишь для «дышащего» glow (спрайт + `globalCompositeOperation:'lighter'`, никакого `shadowBlur`); WebGL — оверкилл.

---

## НЕ ПРОВЕРЕНО / НЕ НАЙДЕНО (обязательно)

1. **CREPE / CREPE-lite в браузере (npm):** НЕ НАЙДЕН живой пакет. `@diffusionstudio/crepe` — 404 в registry.npmjs.org И 404 на GitHub (webfetch оба). npm-поиск «crepe pitch» = только @milkdown/crepe (Milkdown-редактор, нерелевантен). Искал: registry API search «crepe pitch», прямой fetch пакета, GitHub-репо. Вывод: «не знаю про живой CREPE-порт» — считаю отсутствующим в npm-2026.
2. **Soundtrap / BandLab / Amped Studio / AudioSauna (доки по мастеру):** НЕ ПРОВЕРЕНО — help.soundtrap.com и support.bandlab.com дали Transport error (недоступны из моего окружения), AudioSauna — закрытый продукт без публичных доков. Искал: прямые URL help-центров + поиск. Паттерны Зоны-2 построены на верифицируемом Ableton-мануале + Tone.js + wavesurfer — этих достаточно для вердикта.
3. **«Кто в проде» у @audio/pitch-*:** молодой проект (2 звезды, ~1.2k скач./мес) — заметных прод-юзеров НЕ НАЙДЕНО (честно); ставка на свежесть (2026-07/08) и MIT, не на толпу.
4. **Точные бандл-весы pitchfinder / essentia.js / aubiojs / rc-slider:** НЕ ЗАМЕРЯЛ (bundlephobia по ним не запрашивал; для GPL/AGPL/no-license карточек это уже не влияет — вето по лицензии).
5. **Готовая либа «reference-guided pitch detection»:** НЕ НАЙДЕНА на npm (поиски: «score following music accompaniment sync», «pyin pitch», «crepe pitch»). Обходной путь задокументирован в Зоне-1(b).
6. **WebGL-фреймворки для фейдеров (PixiJS и пр.):** НЕ ИССЛЕДОВАЛ глубоко — по вердикту Зоны-3 (два фейдера) WebGL избыточен, исследование не оправдано.
7. **Dual-concentric fader в веб-инструментах:** НЕ НАЙДЕНО ни в одном проверяемом веб-продукте (Ableton-мануал такого UX не описывает; Soundtrap/BandLab недоступны). Паттерн существует в SSL-железе — в вебе не подтверждён.

## ИСТОЧНИКИ (все проверены 2026-09-05)

- npm registry API: `@audio/pitch-pyin` 1.0.1 (MIT, 2026-07-11), `@audio/pitch` 2.0.4 (MIT, 2026-08-28), `pitchy` 4.1.0 (MIT, 2024-01-04), `pitchfinder` 2.3.4 (GPL v3, 2025-12-16), `essentia.js` 0.1.3 (AGPL-3.0), `aubiojs` 0.2.1 (no license), `ml5` 1.4.0 (MIT) + `ml5/0.12.2` (MIT, 27.6 MB, TF.js 1.x), `@spotify/basic-pitch` 1.0.1 (Apache-2.0, 2022-08-05), `tone` 15.1.22 (MIT), `wavesurfer.js` 7.12.11 (BSD-3-Clause), `@radix-ui/react-slider` 1.4.7 (MIT), `react-range` 1.10.0 (MIT, 243k/нед)
- GitHub: audiojs/pitch (README: алгоритмы, сравнение, «pYIN ~10× slower», «Not for polyphonic»), ml5js/ml5-next-gen src/ (нет PitchDetection), react-component/slider (@rc-component/slider, MIT, antd-eco), spotify/basic-pitch (Apache-2.0, 5.5k★)
- Bundlephobia API: pitchy 7975 B / 2828 gzip; @audio/pitch 10297 B / 4185 gzip + per-atom dependencySizes
- Context7: /peterkhayes/pitchfinder (алгоритмы), /tonejs/tone.js + /tonejs/tonejs.github.io (Channel, toMaster, chain), /websites/wavesurfer-multitrack_pages_dev (setTrackVolume, TrackOptions), /shadcn-ui/ui (Slider, Radix→Base UI миграция), /ml5js/ml5-next-gen
- MDN (Baseline-даты + синтаксис): conic-gradient() (Baseline 11.2020; `in hsl shorter/longer hue`, oklch/lch в формальном синтаксисе), mix-blend-mode (Baseline 01.2020; screen, plus-lighter, стекинг-контекст), will-change (last resort, правила)
- Ableton Live 12 Reference Manual §18 (18.1-18.5): multi-select Δ-preserving, Group/Main tracks, crossfader «on-the-fly VCA group», 7 кривых, 32-bit float headroom
- Репо beLive: package.json (MIT, React 19.2.4, Vite 5, vitest 4), `src/components/ControlDeck.tsx:61-66,180-328` (фейдеры, width-transition :242-244/:308-310, rgba(255,60,60)/rgba(74,158,255)), `src/stem/stemTypes.ts:30,37-46` (RoutingTarget, INVARIANT), `src/audio/engine-v3/pipeline/HybridPipelineService.ts:643-645`, `src/audio/engine-v3/pipeline/__tests__/BusFader18.test.ts:150-208`, `src/audio/pitch/yin-processor.js:1-6`, `src/audio/pitch/yin-detect.ts:122`, `src/audio/pitch/pitch-engine.ts:17`, `src/hooks/useStemWaveform.ts:71,93-107`, `src/takes/components/TakesCanvas.tsx:59-67`, `team-m/ui-spec/UI-CHANGE-SPEC-2026-09-05.md` §9-14, `team-m/DOSSIER-RESEARCH-005-UI-SPEC-2026-09-05.md`, `team-m/reports/007-vinda/RNNOISE-009-VERDICT-2026-09-02.md` (WASM-прецедент, лицензионное условие)
