# 🔬 VOCARENA-FULL-DISSECTION · полный разбор vocarena.ru для команды beLive

**Дата:** 2026-09-17 · **Источник:** Никита нашёл vocarena.ru — онлайн-школа голоса нового поколения (© 2026, ИП Тихонов А.А., Алматы).
**Диспетчер:** 007 (разведка+упаковка) · **Исполнители:** 5 скаутов (tech-stack + pitch-deep + stems + ai-coach + games-progress).
**Назначение:** вход для прогонов зон B06 (Pitch), B02 (Quest), B01 (Hub/AI-Coach), B09 (Catalog/Stems). Все решения разложены на атомы — бери и применяй.
**Метод:** JS-бандлы сайта (Vite+React, ~1.1 МБ index.js + чанки) скачаны, деобфусцированы, разобраны до строк кода. Без логина/пейволла — только публичные страницы + статический анализ бандлов.

---

## 0. ОБЩАЯ АРХИТЕКТУРА VOCARENA

| Слой | Технология |
|---|---|
| Фреймворк | React + Vite (хэши имён `__vite__mapDeps`) |
| Роутинг | TanStack Router (file-based routes) |
| Данные | TanStack Query (staleTime 5 мин) |
| Бэкенд | TanStack Start Server Functions (`/_serverFn/<id>`, ndjson) + Supabase (auth GoTrue, DB, Storage, Realtime) |
| Иконки | Phosphor |
| Аналитика | flock.js |
| WASM / ML | **НЕТ** (0 совпадений `.wasm`, нет ONNX/TFLite/TF.js/CREPE/basic-pitch) |
| AudioWorklet | **НЕ используется** (только feature-detect строка) |
| Аудио-путь | main-thread `requestAnimationFrame` + `AnalyserNode.getFloatTimeDomainData()` |

**Главный вывод:** Vocarena доказывает, что production-ready vocal training app работает на **чистом JS DSP без WASM и ML**. Наш YIN в beLive — тот же класс алгоритмов, но мы используем AudioWorklet (лучше latency).

---

## 1. PITCH-ДЕТЕКЦИЯ (ядро — функция `HG`)

### 1.1 YIN-алгоритм (index.js, функция HG)

```js
function HG(t, e, n) { // t=Float32Array, e=sampleRate, n=RMS-gate
  // RMS-гейт
  if (sqrt(sum(t[i]*t[i])/len) < n) return {freq:-1, rms:i, clarity:0};
  
  // tauMin/tauMax из частотных границ
  const o = max(2, floor(e/1200));      // K_=1200 Гц → tauMin=36 @44.1к
  const c = min(len>>1, ceil(e/80));     // G_=80 Гц → tauMax=551 @44.1к
  
  // CMNDF (кумулятивная нормализованная разностная функция)
  u[0]=1; let h=0;
  for(S=1; S<c; S++) {
    let x=0;
    for(E=0; E<len-S; E++) { d=t[E]-t[E+S]; x+=d*d; }
    h+=x;
    u[S] = h>0 ? x*S/h : 1;
  }
  
  // Абсолютный порог 0.15 + fallback глобальный минимум
  const m=0.15; let v=-1;
  for(S=o; S<c; S++) if(u[S]<m) { while(S+1<c && u[S+1]<u[S]) S++; v=S; break; }
  if(v===-1) { /* global min search */ }
  
  // Параболическая интерполяция
  p = v + (u[v+1]-u[v-1]) / (2*(2*u[v]-u[v+1]-u[v-1]));
  
  // Жёсткий диапазон [80..1200] Гц — выход за пределы = freq:-1
  if(freq<80 || freq>1200) return {freq:-1};
  
  // Clarity = 1 - cmnd[best]
  return {freq: sr/p, rms, clarity: max(0,min(1, 1-u[v]))};
}
```

### 1.2 Сравнение с beLive yin-detect.ts

| Параметр | Vocarena `HG` | beLive `yin-detect.ts` | Δ |
|---|---|---|---|
| threshold | **0.15** | 0.15 | идентично |
| RMS gate | **0.003** (распевки) / 0.005 (тюнер) | **0.01** | у нас ×3 жёстче |
| tauMin | `floor(sr/1200)` = 36 @44.1к | фикс. **11** (~4 кГц потолок) | их динамический лучше для вокала |
| tauMax | `min(len/2, ceil(sr/80))` | `len/2` | их ограничивает снизу 80Гц |
| Частотные границы | **жёсткий invalid** если ∉[80,1200] | clamp + **октавное сворачивание** (×2/÷2) | наша стратегия спасает октавы, их — выкидывает |
| Октавный замок | **нет** | да (`_octLock`) | наше преимущество |
| Автокалибровка | **нет** (80-1200 фикс) | да (`_autoCal` 75-600/150-1200) | наше преимущество, но S7-баг |
| Сглаживание | mean-5 (распевки) / median+mean-7 (тюнер) | медиана-5 | среднее агрессивнее, медиана устойчивее |
| clarity/confidence | `1-cmnd[best]` | `1-cmnd[te]` | идентичная формула |
| При te=-1 | fallback global min → **всё равно возвращает pitch** | fallback minTau → **возвращает pitch** | одинаковый баг! |
| fftSize | 2048 (распевки) / 4096 (тюнер) | 2048 | тюнер точнее за CPU |

### 1.3 Post-processing

**Распевки (VG hook):**
```js
midi = 12*log2(freq/440)/log2(2) + 69;
buffer.push(midi); if(buffer.length>5) buffer.shift();
smoothedMidi = buffer.reduce((a,b)=>a+b,0)/buffer.length; // MEAN, не медиана!
```

**Тюнер (отдельный $e):**
```js
buffer.push(freq); if(buffer.length>7) buffer.shift();
medianResult = sortAndMedian(buffer);
meanResult = buffer.reduce(...)/buffer.length;
finalFreq = (medianResult + meanResult) / 2; // ГИБРИД медиана+среднее
```

**Approximate-ярус (clarity 0.55-0.62):**
- clarity ≥ 0.55 → voiced (рисовать ноту)
- clarity 0.55-0.62 → `approximate=true` (серая нитка на графике)
- clarity < 0.55 → unvoiced (не рисовать, буфер очищается)
- Холд последнего питча до 120мс при потере freq

### 1.4 Voice-гейт

```
voiced = freq > 0 AND clarity >= 0.55
unvoiced = иначе (буфер среднего очищается, dwell прерывается)
```

Взаимодействие RMS + clarity: если `rms < gate` → `HG` возвращает `freq:-1, clarity:0` → кадр unvoiced. Если `rms >= gate` но `clarity < 0.55` → approximate (серый трейл, не копится dwell).

---

## 2. SCORING-ДВИЖОК (тренажёр распевок)

### 2.1 Коридоры точности (в центах)

```js
const deviationCents = Math.abs((userMidi - (targetMidi + transpose)) * 100);

if (deviationCents <= 12)  → perfect  (вес 1.0)
if (deviationCents <= 25)  → close    (вес 0.6)
if (deviationCents <= 50)  → ok       (вес 0.3)
if (deviationCents > 50)   → miss     (вес 0, время теряется)
```

**Сравнение с нашим коридором A-7 (±33/±50ц):**
- Их perfect ≤12¢ = JND нетренированного слуха (Singing Carrots подтверждает ±12ц слышно всем)
- Их close ≤25¢ = наш внутренний коридор ±33ц (ближе, чем их 25)
- Их ok ≤50¢ = наш внешний коридор ±50ц = RPA-канон индустрии
- **Разница:** они считают ВЗВЕШЕННЫЙ балл, мы пока просто «совпало/не совпало» (строгое равенство строк нот)

### 2.2 Dwell-механика (удержание)

```js
// Аккумуляторы (Map: noteId → ms)
perfectMsAccum.set(noteId, prev + tickMs);  // если ≤12¢
closeMsAccum.set(noteId, prev + tickMs);    // если ≤25¢
okMsAccum.set(noteId, prev + tickMs);        // если ≤50¢

// Условия:
tickMs = delta * playbackRate;               // clamped [0..100] мс
micFresh = (now - lastMicTime) < 260;         // свежесть микрофона

// Итог ноты при прохождении конца:
weightedSum = perfect*1.0 + close*0.6 + ok*0.3;
score = round(weightedSum / durationMs * 100); // 0..100
hitThreshold = max(durationMs * 0.6, 150);      // ZG=0.6, qG=150
isHit = (perfect + close + ok) >= hitThreshold;  // НЕВЗВЕШЕННАЯ сумма ≥ dwell
```

**Ключевое:** балл (score) и попадание (hit) — **ДВЕ ОТДЕЛЬНЫЕ метрики**!
- score = качество (взвешенное)
- hit = факт засчитывания (невзвешенное время в коридоре ≥ 60% длительности ИЛИ ≥ 150мс)

**Условия сброса:**
- Молчание (rms < gate) → буфер очищается, dwell прерывается
- Свежесть микрофона < 260мс → не копится (защита от хвостов)
- Смена ноты → переключение аккумулятора (без гистерезиса между нотами)

### 2.3 Цикл/фраза

```js
cycleHits / cycleCount * 100 = live-процент попадания
final: {score, perfectRatio, closeRatio, okRatio, notesTotal}
```

Штраф за miss: нота `hit:false`, рисуется красной с вабблом `3*sin(4π*x)*(1-x)` на 240мс, не инкрементирует cycleHits.

---

## 3. ВИЗУАЛЬНЫЙ РЕНДЕР (pitchHistory)

### 3.1 Canvas 2D (не SVG/WebGL)

- Основной `<canvas>` + кэшированный offscreen `<canvas>` для статичной сетки (ключ кэша = размер + midi-диапазон + тема)
- Буфер истории: 3 секунды, кап 240 элементов
- Скорость скролла: 132 px/сек

### 3.2 Классификация кривой (4 Path2D)

```js
class = approximate ? "approx" :
        deviation <= 12 ? "perfect" :
        deviation <= 25 ? "close" : "off";

// perfect: lineWidth=4.5, strokeStyle=X.perfect
// close:   lineWidth=3,   strokeStyle=X.close
// off:     lineWidth=2,   strokeStyle=X.off
// approx:  lineWidth=2.2, strokeStyle=X.trailApprox (серый)
```

Последняя точка — белая, если моложе 250мс.

### 3.3 Коридор отображения

```js
// Диапазон песни ±3 полутона, мин. ширина 16
minMidi = song.minMidi + transpose - 3;
maxMidi = song.maxMidi + transpose + 3;
range = max(16, maxMidi - minMidi);
center = round((minMidi + maxMidi) / 2 / 2) * 2; // округление до чётного
```

Вертикальная линия «сейчас» на 30% от левого края (70% — будущее).

### 3.4 Нотные пилюли

- Текст слога внутри пилюли
- Активная нота = primary цвет
- judged-hit = perfect + «✓» + pop-анимация `scale(1 + 0.12*sin(π*x/260))`
- miss = off + ваббл
- Ряды-полутона: чёрные клавиши `{1,3,6,8,10}`, зебра, подсветка «до»

### 3.5 Тюнер (отдельный рендер)

- 6 секунд истории
- Авто-диапазон ±(range/2+7) по последним 200 сэмплам, мин. ширина 14
- Glow на perfect-сегментах: shadowBlur 12, `#34ff9a`
- Жёлтый ≤25¢, красный >25¢

### 3.6 Render-throttling

- Отрисовка не чаще 32мс в rAF
- `data-perf="lite"` → DPR=1, без троттлинга
- iOS: sampleIntervalMs=40мс

---

## 4. STEM-РАЗДЕЛИТЕЛЬ (/tools/stems)

### 4.1 Архитектура: серверная (НЕ клиентская)

- Клиент = только React-UI загрузки/скачивания
- Движок сепарации целиком на сервере (Supabase)
- **Нет** OfflineAudioContext/WASM/ONNX/Demucs/Spleeter в клиентских бандлах

### 4.2 Поток

```
SHA-256 файла → RPC-проверка дубликата (file_hash)
→ signed-URL для загрузки в бакет audio-lab
→ RPC создания job (audio_jobs: source_path, filename, file_hash, duration_sec)
→ поллинг каждые 7с + Supabase Realtime postgres_changes
→ готово → signed-URL вокала/минуса → плеер + download
```

### 4.3 Лимиты

- Форматы: MP3/WAV/M4A (`accept="audio/*"`)
- Размер: **40 МБ** максимум
- Хранение: **48 часов** (TTL `expires_at`)
- Время: 1-3 минуты
- Пейволл: Pro/Premium

### 4.4 Вердикт для beLive

Не паттерн для live-сепарации (у нас стемы готовые из B09). Полезные идеи:
- Дедуп по SHA-256 (повторная загрузка того же трека = мгновенный результат)
- TTL хранения с авто-инвалидацией
- Async job + Realtime уведомления вместо тяжёлого поллинга

---

## 5. AI-ТРЕНЕР (/ai-assistant)

### 5.1 LLM-бэкенд

- Полностью серверный (TanStack Start Server Functions, ndjson)
- **0 упоминаний** OpenAI/Anthropic/Claude/GPT/Whisper в клиентских бандлах
- Клиент вызывает `sendMessage({message, conversationId, devPremium})`
- Free = 3 сообщения/день

### 5.2 Токен-протокол встраивания упражнений (КЛЮЧЕВОЙ ПАТТЕРН)

LLM возвращает текст с маркерами:
```
[[exercise:<uuid>]]  → карточка упражнения (название, категория, аудио-плеер, демо, видео)
[[video:<uuid>]]     → встроенное видео
[[ask]]              → кнопка «Ответить ниже ↓»
[[range]]            → виджет определения диапазона (запись 30с, клиентский детект)
[[record]]           → виджет «Спой — я послушаю» (запись 5-120с, разбор)
```

Клиент парсит regex'ом и рендерит **интерактивные карточки прямо в сообщении чата** (не ссылки!).

Карточка упражнения содержит:
- Название + категория›подкатегория
- Встроенный аудио-плеер (`PracticePlayer`: materialId, audioUrl, defaultSemitones)
- Кнопки: «🎧 Демо», «🎬 Видео-разбор» (lazy), «Открыть материал», «Открыть в тренажёре» (если есть midi_url)

### 5.3 Контекст тренера

Знает голосовой профиль пользователя: пол, диапазон (low/high), уровень. Кэширует все материалы категорий (Дыхание/Распевки/Дикция/Психология/Глоссарий) под UUID-карту.

### 5.4 Ввод с микрофона в чате

MediaRecorder (webm/opus, fallback mp4/mpeg), blob ≥ 2КБ → multipart POST `/api/transcribe` → серверный ASR → `{text}`. Провайдер ASR скрыт.

### 5.5 Ошибки API

`premium_required / free_daily_ai / profile_incomplete / rate_limited / ai_credits_exhausted / ai_unavailable`

---

## 6. VOICE COACH (/voice-coach, «Живой разбор»)

### 6.1 Запись

- GlobalRecorder: MediaRecorder `audio/webm;codecs=opus`, 96 kbps
- Минимум 5 сек, авто-стоп 120 сек
- WebAudio AnalyserNode (fftSize 2048) + клиентский детект высоты (**библиотека pitchy**: `findPitch(buffer, sampleRate)`, порог уверенности 0.9, 60-1500 Гц, конвертация в MIDI)
- Фреймы питча собираются **на клиенте**

### 6.2 Двухфазная аналитика

**Фаза 1 (мгновенная, клиентские метрики → сервер):**
```js
{
  durationSeconds,
  voicedRatio,          // доля вокализированных кадров
  pitchStability,       // стабильность питча
  meanPitchHz,          // средняя частота
  pitchRangeSemitones,  // диапазон в полутонах
  loudnessRms,          // громкость
  loudnessStability,    // стабильность громкости
  estimatedBreathPerMin // оценка дыхания/мин
}
```

**Фаза 2 (асинхронная, серверная):**
- Опциональный аплоад raw-аудио: signed URL через Supabase Storage
- Создание сессии → `{sessionId, creditsSpent}`
- Async-разбор → `summary + strengths[] + weaknesses[] + recommendations[]`
- **TTS-озвучка разбора** («Разбор готов · списано N кр.»)

### 6.3 UI разбора

Карточка сессии: дата, длительность, кредиты, плеер записи, бейдж «анализ» (пока в очереди), кнопка «Разбор» (TTS), «Подробно» (summary + «Что круто» + «Над чем поработать» + «Что попробовать дальше»).

### 6.4 TTS-персоны

4 голоса: Сара / Матильда / Георгий / Лиам. UUID `voice_id` (ElevenLabs-стиль). Превью в Supabase bucket `voice-samples`. Выбор пишется в профиль (`coach_voice_id`).

### 6.5 Кредиты

Free = 1 обзор/месяц. Pro = 200 обзоров/месяц. Квотирование: `monthlyQuota / monthlyBalance / purchasedBalance`.

---

## 7. ГЕЙМИФИКАЦИЯ (/game)

### 7.1 Игра «Точность» (10 уровней)

Типы задач:
| Тип | Описание | Уровень |
|---|---|---|
| hold_note | Удержи ноту в ±N¢ | 1 «Первая нота» |
| match_note | Услышь и повтори | 3 |
| interval | Спой интервал от тоники | 5 |
| sequence | Последовательность нот | 7 |
| glide | Плавный переход (глиссандо) | 8 |

Толерантность: ±50¢ (начальные) → **±20¢ (Босс, ур.10)**.

### 7.2 Формула скоринга

```js
basePoints = max(20, round(100 * (1 - |error| / toleranceCents)));
if (|error| <= 10¢) bonus *= 1.5;  // "perfect"
if (completedFasterThan(holdMs*0.7 + 250)) += 30;  // speed bonus
comboMultiplier = min(3, prev + 0.1);  // сброс при промахе
finalHitPoints = round(basePoints * comboMultiplier);
timeBonus = remainingSeconds * 20;
```

### 7.3 Динамическая транспозиция

Уровни транспонируются под диапазон пользователя:
```js
randomOffset = fitInRange([low+2, high-4] semitones);
```

### 7.4 Игра «Интервалы»

24 интервала вверх и вниз от тоники (12 полутонов × 2 направления). Спой интервал — игра засчитает.

### 7.5 Pitch-детекция в играх

- **NSDF-подобная автокорреляция** (НЕ pitchfinder-библиотека напрямую, но API-совместима)
- FFT: 4096, minVolume: -40 dB
- clarity threshold: ≥0.55 (тюнер) / ≥0.9 (RangeDetector калибровки)
- Диапазон: 60-1500 Hz → MIDI 24-84
- Параболическая интерполяция

---

## 8. ПРОГРЕСС (/stats)

### 8.1 Локальный progressStore (localStorage)

- `unlockedLevel` (default 1)
- `completedAt` (map: levelId → timestamp)
- `bestScores` (map: levelId → score)
- Кнопка «Сбросить прогресс» → `progressStore.reset()`

### 8.2 Серверный tracking (Supabase)

Каждая завершённая игра: `{durationSeconds, source:"game", reference:"accuracy:ID"}`

### 8.3 Ачивки (серверные)

| Код | Условие |
|---|---|
| game_first_win | Первое прохождение любого уровня |
| game_perfect_pitch | 10+ нот с ошибкой ≤10¢ |
| game_combo_master | Комбо ≥3 подряд |
| game_speedrunner | Завершено за <50% времени |
| game_grand_master | Уровень >10 |

Отображение: `AchievementToast` компонент.

---

## 9. КАЛИБРОВКА ДИАПАЗОНА (RangeDetector)

### 9.1 Процесс (30 секунд)

1. getUserMedia → запись
2. Каждый кадр: getFloatTimeDomainData → NSDF-автокорреляция → clarity ≥ 0.9, 60-1500 Hz
3. Валидные ноты → MIDI (24-84) → массив
4. После 30 секунд: сортировка → **5-й и 95-й перцентили** = low/high
5. Вывод: «Диапазон: Do3 — Sol5»
6. Сохранение в профиль: `vocal_range_low`, `vocal_range_high`

### 9.2 Профиль голоса

```js
{ sex, vocal_range_low, vocal_range_high, vocal_level }
```

Всё клиентское — сервер не анализирует калибровку.

---

## 10. СВОДНАЯ ТАБЛИЦА: VOCARENA vs beLive

| Аспект | Vocarena | beLive (текущее) | beLive (план прогона) | Δ |
|---|---|---|---|---|
| Детектор | YIN main-thread rAF | YIN AudioWorklet + main-thread | YIN/pYIN AudioWorklet | ✅ наш Worklet лучше latency |
| fftSize | 2048/4096 | 2048 | 2048 | ≈ |
| Gate | 0.003/0.005 | 0.01 | TBD | ⚠️ наш жёстче |
| tauMin | dynamic floor(sr/1200)=36 | fixed 11 | TBD | их лучше для вокала |
| Октивный замок | нет | да | да | ✅ наше преимущество |
| Автокалибровка | нет | да (S7-баг) | да (фикс S7) | ✅ наше, но починить |
| Scoring | weighted P/C/O + dwell | strict equality | ±33/±50¢ + dwell | план совпадает |
| Dwell | max(60%, 150мс) | нет | CONFIRM_FRAMES=3≈138мс | ≈ совпадает |
| Визуал | Canvas 2D, 4 Path2D | PianoKeyboard (DOM) | Canvas/Sci-fi HUD | новый рендер |
| Коридор | 12/25/50¢ | 33/50¢ | 12/25/50¢ или 33/50¢ | 🔴 решение Никиты |
| Alignment | нет (только realtime) | нет | media-time + tolerance | наш уникальный слой |
| Reference | нет сравнения с треком | vocalReferenceTap | offline JSON + lookup | наш уникальный слой |
| AI-чат | LLM + [[tokens]] | Billy (ai-tools) | Billy + pitch-data | стык B01+B06 |
| Stem | server-side batch | готовые из B09 | готовые | разные подходы |
| Калибровка | 30с, 5th/95th percentile | autoCal (баг S7) | TBD | их метод надёжнее |
| Games | 10 уровней + интервалы | Quest (B02) | Quest + scoring | стык B02+B06 |

---

## 11. АТОМЫ ДЛЯ КОМАНДЫ beLive (что забираем)

### Для B06 (Pitch):
1. **Формула балла** `(P·1+C·0.6+O·0.3)/dur·100` + отдельный hit `≥max(60%,150мс)` — внедрить в scoring-слой P2
2. **4 класса кривой** (perfect/close/off/approx) с разными lineWidth/color — основа sci-fi визуала
3. **Canvas 2D + offscreen-cache** — паттерн рендера pitchHistory
4. **Approximate-ярус** (clarity 0.55-0.62 = серый трейл) + холд 120мс
5. **Gate 0.003** — проверить, не слишком ли наш 0.01 режет тихий вокал
6. **tauMin=floor(sr/1200)** — рассмотреть динамический вместо фикс 11
7. **Калибровка 5th/95th percentile** — замена/дополнение нашему autoCal (фикс S7)
8. **Render-throttling 32мс** + DPR=1 lite mode

### Для B01 (Hub/AI-Coach):
9. **Токен-протокол `[[exercise:<id>]]`** — LLM эмитит маркеры, клиент рендерит карточки (сильнее tool_calls для UX)
10. **Запись в чате `[[record]]`** — тренер просит спеть → MediaRecorder → разбор
11. **Двухфазная аналитика** (мгновенные метрики → async AI-разбор + TTS)
12. **TTS-персоны** — выбираемый голос тренера
13. **Кредитная система** с понятными ошибками

### Для B02 (Quest):
14. **10 уровней точности** с динамической транспозицией под диапазон
15. **Комбо-мультипликатор** (×0.1 за хит, макс ×3)
16. **Speed-bonus** за быстрое прохождение
17. **5 типов задач** (hold/match/interval/sequence/glide)
18. **Ачивки** (5 базовых кодов, AchievementToast)
19. **Динамическая транспозиция** `[low+2, high-4]`

### Для B09 (Catalog):
20. **Дедуп по SHA-256** при загрузке треков
21. **TTL хранения** с авто-инвалидацией

---

## 12. ЧЕГО У VOCARENA НЕТ (наши уникальные преимущества)

1. **Alignment с эталоном трека** — они сравнивают с целевой нотой упражнения, мы — с реальной вокальной дорожкой песни (сложнее, но ценнее)
2. **AudioWorklet** — они на main-thread rAF, мы на audio thread (меньше latency, не блокирует UI)
3. **Стены VIS-14 (pYIN-голосование)** — они используют vanilla YIN без защиты от октавных ошибок; наш C-контур с Beta(2,18) потенциально стабильнее
4. **Subharmonic ratio (гроул/скрим USP)** — у них нет метрик искажённого вокала; наш subScore/noiseScore = уникальное конкурентное преимущество
5. **TrackMap-aware alignment** — привязка к музыкальным секциям песни
6. **Кастомизация дизайна** (слово Никиты) — у них фиксированный UI

---

*Собрано 007 из 5 скаут-отчётов. Все данные верифицированы grep-ом по JS-бандлам vocarena.ru. Код beLive не читался, frozen-зоны не упоминались.*

— 007 · 17.09.2026 · полный разбор vocarena.ru сдан 📋🔬
