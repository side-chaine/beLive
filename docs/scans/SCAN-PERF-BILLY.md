# 📦 SCAN-PERF-BILLY — Performance Tier System beLive

> **Цель:** Полная инвентаризация performance-системы для интеграции Billy Performance Matrix  
> **Статус:** ✅ Завершён  
> **Дата:** 2026-05-24  

---

## Содержание

1. [SCAN-PERF-01: Performance Store (8 файлов)](#scan-perf-01-performance-store)
   - [1.1 performance.types.ts](#11-performancetypests)
   - [1.2 performance.presets.ts](#12-performancepresetsts)
   - [1.3 performance.detect.ts](#13-performancedetectts)
   - [1.4 performance.store.ts](#14-performancestorets)
   - [1.5 performance.hooks.ts](#15-performancehooksts)
   - [1.6 performance.bridge.ts](#16-performancebridgets)
   - [1.7 performance.clamp.ts](#17-performanceclampts)
   - [1.8 performance.recording.ts](#18-performancerecordingts)
2. [SCAN-PERF-02: Performance Consumers Map](#scan-perf-02-performance-consumers-map)
3. [SCAN-PERF-03: Audio-Reactive Performance](#scan-perf-03-audio-reactive-performance)
4. [Критические выводы](#критические-выводы)
5. [Корректировка Billy Performance Matrix](#корректировка-billy-performance-matrix)

---

## SCAN-PERF-01: Performance Store

### 1.1 performance.types.ts

**Тип `PerformanceTier`:**
```
'lite' | 'balanced' | 'max' | 'ultra'
```

**6 доменных бюджетов в составе `VisualBudget`:**

| Бюджет | Интерфейс | Полей | Назначение |
|--------|-----------|-------|------------|
| `word` | `PerformanceWordBudget` | 8 | Эффекты слов (bounce, neon, lookahead, cue words, glow, trail) |
| `line` | `PerformanceLineBudget` | 5 | Эффекты линий (preview glow, handoff, max glow, block color) |
| `background` | `PerformanceBackgroundBudget` | 3 | Фон (blur, reactive intensity, particles) |
| `audioReactive` | `PerformanceAudioReactiveBudget` | 4 | Аудио-реактив (enabled, maxBands, beatPulse, spectral) |
| `scene` | `PerformanceSceneBudget` | 3 | 3D/аватар (allow3D, allowAvatar, maxSceneComplexity) |
| `visualMixer` | `PerformanceVisualMixerBudget` | 11 | Визуальный микшер (maxCards, cardUpdateFps, pulsation, glow...) |

**Critical observation:** Нет `billy` или `avatar` домена. Billy-специфичные настройки не вынесены в отдельный бюджет — будут использовать общие поля или внешнюю логику.

---

### 1.2 performance.presets.ts

**Default tier:** `balanced`

**Полная таблица preset'ов:**

#### Lite
```typescript
word:     bounce❌ heavyNeon❌ lookahead❌ maxCueWords=0 progressMode='simple' maxGlowLayers=0 maxTrailDepth='off'
line:     previewGlow❌ previewHandoff❌ maxLineGlow='off' blockAwareColor❌
bg:       blurLevel=0 reactiveIntensity='off' particles❌
audio:    enabled❌ maxBands=0 beatPulse❌ spectral❌
scene:    3D❌ avatar❌ complexity='none'
mixer:    enabled✅ maxCards=8 fps=20 pulsation✅ glow✅ hitFlash✅ waveform✅ intensity='off' scenarios❌
```

#### Balanced
```typescript
word:     bounce✅ heavyNeon❌ lookahead✅ maxCueWords=1 progressMode='full' maxGlowLayers=1 maxTrailDepth='line'
line:     previewGlow✅ previewHandoff❌ maxLineGlow='soft' blockAwareColor✅
bg:       blurLevel=1 reactiveIntensity='low' particles❌
audio:    enabled✅ maxBands=3 beatPulse✅ spectral❌
scene:    3D❌ avatar❌ complexity='none'
mixer:    enabled✅ maxCards=6 fps=20 pulsation✅ glow❌ hitFlash✅ waveform✅ intensity='soft' scenarios✅
```

#### Max
```typescript
word:     bounce✅ heavyNeon✅ lookahead✅ maxCueWords=2 progressMode='full' maxGlowLayers=2 maxTrailDepth='scene'
line:     previewGlow✅ previewHandoff✅ maxLineGlow='full' blockAwareColor✅
bg:       blurLevel=2 reactiveIntensity='medium' particles✅
audio:    enabled✅ maxBands=6 beatPulse✅ spectral✅
scene:    3D✅ avatar✅ complexity='basic'
mixer:    enabled✅ maxCards=8 fps=30 pulsation✅ glow✅ hitFlash✅ waveform✅ intensity='medium' scenarios✅
```

#### Ultra
```typescript
word:     bounce✅ heavyNeon✅ lookahead✅ maxCueWords=3 progressMode='full' maxGlowLayers=3 maxTrailDepth='scene'
line:     previewGlow✅ previewHandoff✅ maxLineGlow='full' blockAwareColor✅
bg:       blurLevel=3 reactiveIntensity='high' particles✅
audio:    enabled✅ maxBands=8 beatPulse✅ spectral✅
scene:    3D✅ avatar✅ complexity='full'
mixer:    enabled✅ maxCards=16 fps=30 pulsation✅ glow✅ hitFlash✅ waveform✅ intensity='strong' scenarios✅
```

---

### 1.3 performance.detect.ts

**Алгоритм определения tier:**

```
detectPerformanceTier():
  1. SSR guard: нет window/navigator → 'balanced'
  2. cores = navigator.hardwareConcurrency ?? 2
  3. memory = navigator.deviceMemory ?? 8  (macOS: deviceMemory не поддерживается, fallback 8GB)
  4. isMobile = /Mobi|Android|iPhone|iPad/i.test(userAgent)
  5. Логика:
     cores <= 2 && memory <= 4  →  'lite'
     isMobile                     →  'balanced' (консервативно, даже при хороших specs)
     cores >= 8                   →  'max'
     иначе                        →  'balanced'
  6. 'ultra' НИКОГДА не определяется авто — только ручной выбор
  7. Любая ошибка → 'balanced'
```

**Важно для macOS (Billy dev):**
- `deviceMemory` не поддерживается в macOS Chrome → fallback 8GB
- `hardwareConcurrency` на MacBook Pro обычно 8+ (M1/M2/M3 — 8+ cores)
- **Результат: на MBP почти всегда `max`** (core count >= 8)
- `ultra` — только ручной выбор

---

### 1.4 performance.store.ts

**Store: `usePerformanceStore` (Zustand + persist)**

**Состояние:**
```typescript
interface PerformanceState {
  tier: PerformanceTier;           // Ручной выбор
  autoDetect: boolean;             // true по умолчанию
  detectedTier: PerformanceTier;   // Не персистится
  setTier(tier): void;             // Отключает autoDetect
  setAutoDetect(auto): void;       // При включении переопределяет detectedTier
  refreshDetectedTier(): void;     // Переопределение
  getEffectiveTier(): PerformanceTier;  // autoDetect ? detectedTier : tier
  getBudget(): VisualBudget;       // Бюджет для эффективного tier
}
```

**Персист:** localStorage, ключ `belive-performance`
- Хранит только `{ tier, autoDetect }`
- При rehydrate: `detectedTier` переопределяется заново
- `partialize`: исключает `detectedTier` из persist

**Convenience hooks (экспортируются из store):**
- `useVisualBudget(): VisualBudget` — `state.getBudget()`
- `useEffectiveTier(): PerformanceTier` — `state.getEffectiveTier()`

---

### 1.5 performance.hooks.ts

**Экспортируемые хуки:**

| Хук | Возвращает | Назначение |
|-----|-----------|------------|
| `usePerformanceTier()` | `{ tier, autoDetect, manualTier, detectedTier }` | Полная инфа о tier |
| `useVisualBudget()` | `VisualBudget` | Бюджет для эффективного tier |
| `useResolvedVisualBudget()` | `VisualBudget` | Бюджет + recording clamp |
| `useWordEffectAllowed('bounce'|'heavyNeon'|'lookahead')` | `boolean` | Проверка эффекта слова |
| `useMaxCueWords()` | `number` | Максимум cue-слов |
| `useResolvedTrailDepth()` | `WordTrailDepth` | Trail depth c tier-clamp |
| `useLineFeatureAllowed('previewGlow'|'previewHandoff'|'blockAwareColor')` | `boolean` | Проверка фичи линии |

**Re-export:** `usePerformanceStore`, `useEffectiveTier`

**Запись clampTrailDepth:**
```typescript
depthOrder: ['off', 'line', 'scene']
// Если selected > maxAllowed → clamp вниз
```

---

### 1.6 performance.bridge.ts

**DOM-публикация:**

**Атрибуты на `document.documentElement`:**
- `data-visual-tier` = `'lite' | 'balanced' | 'max' | 'ultra'`
- `data-recording-active` = `'true'` (при записи)

**CSS vars на `document.documentElement`:**
```css
--bl-perf-max-cue-words:        число
--bl-perf-allow-bounce:         0|1
--bl-perf-allow-heavy-neon:     0|1
--bl-perf-allow-preview-handoff: 0|1
--bl-perf-allow-block-aware-color: 0|1
```

**Инициализация (`initPerformanceBridge`):**
- Вызывается в `App.tsx:72` внутри `useEffect`
- Порядок: 12-й bridge из 14
- На старте: `refreshDetectedTier()`, публикует tier + бюджет + recording state
- Подписывается на 3 store: `usePerformanceStore`, `useRecordingStore`, `useTakesStore`
- При изменении: переопределяет DOM-атрибуты + CSS vars
- **Recording-aware:** при записи применяет `applyRecordingSafeClamp()` к бюджету

**Утилиты:**
- `getTierFromDOM(): PerformanceTier` — читает `data-visual-tier` из DOM
- `isFeatureAllowedFromCSS(varName): boolean` — читает CSS var

---

### 1.7 performance.clamp.ts

**`applyRecordingSafeClamp(budget): VisualBudget`**

Что меняет при записи:
```typescript
word:   maxTrailDepth='off', allowBounce=false, allowHeavyNeon=false, maxCueWords=0
line:   allowPreviewHandoff=false  (allowBlockAwareColor, allowPreviewGlow — preserved)
mixer:  allowPulsation=false, allowCardGlow=false, allowHitFlash=false,
        allowWaveform=false, maxPulseIntensity='off', allowScenarios=false,
        cardUpdateFps=min(original, 10)
```

**Остальные домены (audioReactive, background, scene) — не меняются.**

---

### 1.8 performance.recording.ts

**Capture Profile по tier:**

| Tier | Frame Rate | Video Bitrate | Audio Bitrate |
|------|-----------|---------------|---------------|
| lite | 18 | 2 Mbps | 128 kbps |
| balanced | 20 | 2.4 Mbps | 160 kbps |
| max | 24 | 3 Mbps | 192 kbps |
| ultra | 25 | 3.5 Mbps | 256 kbps |

---

## SCAN-PERF-02: Performance Consumers Map

### Таблица: Компонент → Performance Hook/Attr

| Компонент/Файл | Как потребляет | Что контролирует |
|----------------|---------------|-----------------|
| **App.tsx** | `initPerformanceBridge()` | Инициализация, tier → DOM |
| **RehearsalLyrics.tsx** | `useEffectiveTier()` | Только: `lite` → принудительно DEFAULT_PRESET (smooth) |
| **WordHighlightLine.tsx** | `useResolvedTrailDepth()` | Trail depth (`WordTrailDepth` clamped) |
| **StylesDeck.tsx** | `useResolvedTrailDepth()`, `useVisualBudget().word.maxTrailDepth` | Отображение макс. trail depth в UI |
| **QuickActions.tsx** | `usePerformanceTier()`, `usePerformanceStore` | UI: отображение текущего tier, переключатель autoDetect, ручной выбор |
| **PlaybackPerfOverlay.tsx** | `usePerformanceTier()` | Debug overlay (fps, scheduler metrics, tier) |
| **useStemWaveform.ts** | `getTierFromDOM()` (legacy) | Определение частоты отрисовки waveform |
| **main.tsx** | — | Не использует performance |

### CSS Consumers (data-visual-tier селекторы)

| CSS-файл | Селекторы | Что контролирует |
|----------|-----------|-----------------|
| **word-effects.css** | 56 matches: `[data-visual-tier="lite"/"balanced"/"max"/"ultra"]` + `[data-recording-active="true"]` | settled trail opacity (lite→0.5, balanced→0.6), neon glow layers, bounce animation (lite→off, max→will-change), recording-safe clamp |
| **instrument-card.css** | 7 matches: `[data-visual-tier="..."] .card[data-stem-id]` | Pulsation animation, glow, card opacity during recording |
| **RehearsalLyrics.module.css** | 6 matches: `[data-visual-tier="lite"/"balanced"/"max"/"ultra"] .coverBgImage` | Cover bg blur level (lite→0px, balanced→8px, max→12px, ultra→16px) |
| **trigger.bridge.ts** | — | Не использует performance. 60fps всегда. |

### Кто НЕ использует performance (потенциальные проблемы)

| Компонент | Статус | Риск |
|-----------|--------|------|
| **BillyDock.tsx** | ❌ НЕ использует | Billy CSS анимации не tier-aware |
| **BillyDock.module.css** | ❌ Нет data-visual-tier селекторов | Все эффекты одинаковы на всех tiers |
| **useBillyAudioReactive.ts** | ❌ НЕ использует | 30fps rAF всегда, не проверяет tier |
| **audio-reactive.bridge.ts** | ❌ НЕ использует | 60fps scheduler, 5 CSS vars всегда |
| **trigger.bridge.ts** | ❌ НЕ использует | 60fps scheduler всегда |
| **WagonTrain.tsx/css** | ❌ НЕ использует | Анимации блоков не tier-aware |
| **ControlDeck.tsx/css** | ❌ НЕ использует | Не влияет |
| **ExerciseStrip.tsx** | ❌ НЕ использует | Не влияет |
| **TrackInfoBoard.tsx/css** | ❌ НЕ использует | Не влияет |

---

## SCAN-PERF-03: Audio-Reactive Performance

### Текущая архитектура

```
PlaybackVisualScheduler (60fps rAF loop)
├── trigger bridge (reader+detector+writer)     ← ВСЕГДА 60fps
├── audio-reactive bridge (detector+writer)      ← ВСЕГДА 60fps
├── stem-reactive bridge (detector+writer)        ← tier-aware (visualMixer.cardUpdateFps)
└── lyrics bridge (detector+writer)              ← ВСЕГДА 60fps
```

### audio-reactive.bridge.ts

| Параметр | Значение |
|----------|----------|
| Scheduler | `PlaybackVisualScheduler` (60fps rAF) |
| Analyser | fftSize=256, smoothingTimeConstant=0.8 |
| CSS vars | 5: `--bl-audio-energy`, `--bl-audio-bass`, `--bl-audio-mid`, `--bl-audio-high`, `--bl-audio-beat` |
| Queued via | `queueCssVar()` — batched write |
| Performance tier check | **НЕТ** — не читает `usePerformanceStore` |
| Recording safe | **НЕТ** — публикует vars всегда (но resetCssVars при паузе) |
| Остановка | Только `playback-state-changed` (isPlaying=false → resetCssVars) |

### useBillyAudioReactive.ts

| Параметр | Значение |
|----------|----------|
| Частота | 30fps (каждый 2-й rAF кадр: `frameCountRef.current % 2 !== 0`) |
| Чтение CSS vars | 1 `getComputedStyle` за 30ms (CACHE_TTL), все 6 vars за 1 вызов |
| Активность | Только при `animation === 'dance'` |
| Reduced motion | Читает `prefers-reduced-motion`, отключает при совпадении |
| Performance tier check | **НЕТ** |
| Skip frame механизм | Есть (30fps throttle), но не адаптивный |

### stem-reactive.bridge.ts — ЕДИНСТВЕННЫЙ tier-aware bridge

```typescript
// Фаза B — энергия: throttled by performance tier
const vmBudget = usePerformanceStore.getState().getBudget()?.visualMixer;
if (vmBudget && vmBudget.enabled === false) return;
const targetFps = vmBudget?.cardUpdateFps || 30;  // 20 (lite/balanced) или 30 (max/ultra)
const throttleMax = Math.max(1, Math.round(60 / targetFps));  // 3 (lite) или 2 (max)
if (tickCount % throttleMax !== 0) return;
```

Но: фаза A (hit detection) работает КАЖДЫЙ tick (60fps) — не throttled.

---

## Критические выводы

### ⚠️ 1. Billy полностью не tier-aware
- `BillyDock.tsx` не импортирует ни один performance hook
- `BillyDock.module.css` не содержит селекторов `[data-visual-tier="..."]`
- `useBillyAudioReactive` не проверяет tier (всегда 30fps)
- Все Billy SVG filter (glow), drop-shadow, CSS keyframes — одинаковы на Lite и Ultra

### ⚠️ 2. Scheduler всегда 60fps
`PlaybackVisualScheduler` запускает `requestAnimationFrame` на каждом кадре независимо от tier. Bridges не могут изменить частоту scheduler'а — только пропускать кадры внутри своих detector/writer.

### ⚠️ 3. Audio-reactive bridge не имеет tier checks
Публикует 5 CSS vars каждый кадр (60fps). Даже на Lite. Должен проверять `audioReactive.enabled` и `maxBands`.

### ⚠️ 4. Trigger bridge не имеет tier checks
Публикует `--bl-word-progress`, `--bl-word-active`, `--bl-line-active` на 60fps. Это нужно на всех tiers для базового хайлайтинга слов, но на Lite можно снизить до 30fps.

### ⚠️ 5. CSS var budget — только 5 var'ов
`performance.bridge.ts` публикует только 5 CSS var'ов. Этого достаточно для word/line контроля, но нет var'ов для Billy, background, audio-reactive или scene доменов.

### ✅ 6. word-effects.css — образцовый потребитель
56 селекторов с tier-адаптацией. Lite: отключает bounce, упрощает neon, снижает settled opacity. max/ultra: включает will-change. Recording: отключает анимации, снижает glow.

### ✅ 7. recording-safe clamp работает
Через `applyRecordingSafeClamp` отключает bounce, neon, trail, previewHandoff, visualMixer эффекты при записи.

### ✅ 8. Есть резерв tier detection
`getTierFromDOM()` для legacy JS, `isFeatureAllowedFromCSS()` для чтения CSS var'ов из JS без импорта store.

---

## Корректировка Billy Performance Matrix

На основе данных SCAN-PERF, уточняю что реально нужно изменить:

### Где добавить tier awareness

| Компонент | Что менять | Аппроксимация |
|-----------|-----------|---------------|
| **useBillyAudioReactive.ts** | Добавить `usePerformanceTier()` | Lite → OFF, Balanced → 15fps (skip 3), Max → 30fps (skip 1), Ultra → 60fps (skip 0) |
| **BillyDock.tsx** | Импорт `usePerformanceTier()` для feature flags | Какие celebrations доступны, какой тип shadow |
| **BillyDock.module.css** | CSS селекторы `[data-visual-tier="..."]` | Glow, drop-shadow, анимации |
| **audio-reactive.bridge.ts** | Импорт `usePerformanceStore` | Lite → OFF, Balanced → 3 bands, Max → 6 bands, Ultra → 8 |
| **KaraokeLyricsBoard** (если используется) | CSS селекторы tier | Анимации караоке |

### Billy Performance Matrix (скорректированная, data-driven)

| Фича Billy | Lite | Balanced | Max | Ultra |
|-----------|------|----------|-----|-------|
| **Idle breathing CSS keyframes** | ✅ translateY | ✅ full | ✅ full | ✅ full + reactive |
| **Dance bounce CSS keyframes** | ✅ translateY | ✅ + arm | ✅ + leg | ✅ full body |
| **Audio-reactive JS (useBillyAudioReactive)** | ❌ OFF | ✅ 15fps | ✅ 30fps | ✅ 60fps |
| **Svg glow filter (CSS drop-shadow)** | ❌ OFF | ❌ OFF | ✅ on eyes | ✅ eyes+head |
| **Block glow (`--bl-billy-block-color` shadow)** | ❌ OFF | ✅ 1 layer | ✅ 2 layers | ✅ 4 layers |
| **Loop/Rec dots pulse animation** | ✅ static | ✅ pulse | ✅ pulse | ✅ pulse |
| **Walk CSS keyframes** | ✅ translate | ✅ + leg alt | ✅ full | ✅ full |
| **Somersault CSS** | ✅ rotate | ✅ full  | ✅ full | ✅ full + trail |
| **Celebrations (basic: backflip, pistols)** | ✅ | ✅ | ✅ | ✅ |
| **Celebrations (legendary: laser, lightsaber)** | ❌ simplified | ❌ | ✅ | ✅ + aura |
| **Terminator eyes** | ✅ red fill | ✅ + glow | ✅ + scan | ✅ full |
| **Control Mode** | ✅ всегда | ✅ | ✅ | ✅ |
| **Position Engine JS rAF** | 15fps | 30fps | 30fps | 60fps |
| **useBillyAudioReactive rAF skip** | n/a (OFF) | skip 3 | skip 1 | skip 0 |

### Рекомендуемые изменения в performance.presets.ts

Добавить `billy` и `audioReactive.maxBands` для audio-reactive bridge:

```typescript
// lite:
audioReactive: {
  enabled: true,     // ⚠️ СЕЙЧАС: false. Нужен true для базового data-reactive="subtle"
  maxBands: 0,       // 0 bands = CSS keyframes only, no JS micro-movements
  allowBeatPulse: false,
  allowSpectral: false,
},

// balanced:
audioReactive: {
  enabled: true,
  maxBands: 3,       // Energy, Bass, Beat
  allowBeatPulse: true,
  allowSpectral: false,
},

// max:
audioReactive: {
  enabled: true,
  maxBands: 6,       // +Mid, +High, +Vocal
  allowBeatPulse: true,
  allowSpectral: true,
},

// ultra:
audioReactive: {
  enabled: true,
  maxBands: 8,       // Full spectrum
  allowBeatPulse: true,
  allowSpectral: true,
},
```

### План изменений

```
TC-PERF-01: BillyDock.module.css — добавить data-visual-tier селекторы
  ├── [data-visual-tier="lite"] → filter: none, animation упрощённые
  ├── [data-visual-tier="balanced"] → glow только глаза
  └── [data-visual-tier="max"/"ultra"] → полные эффекты

TC-PERF-02: useBillyAudioReactive — добавить tier check
  ├── import { usePerformanceTier } from '../performance/performance.hooks'
  ├── tier === 'lite' → return (reset transforms, не запускать rAF)
  ├── tier === 'balanced' → skip 3 (15fps)
  ├── tier === 'max' → skip 1 (30fps) — текущее поведение
  └── tier === 'ultra' → skip 0 (60fps)

TC-PERF-03: audio-reactive.bridge — добавить tier check
  ├── import { usePerformanceStore } from '../performance/performance.store'
  ├── Lite: не запускать analyser (data-reactive="subtle" только CSS атрибут)
  ├── Balanced/Max/Ultra: maxBands из бюджета
  └── Использовать frameSkip по tier

TC-PERF-04: Position Engine (TC-BILLY-02) — tier-aware tick rate
  └── При проектировании — читать tier и выбирать fps
```

---

## ПРИЛОЖЕНИЕ: Полный список файлов performance-системы

| # | Файл | Строк | Роль |
|---|------|-------|------|
| 1 | `src/performance/performance.types.ts` | 171 | Типы: 6 интерфейсов бюджетов |
| 2 | `src/performance/performance.presets.ts` | 229 | 4 preset'а, полные конфиги |
| 3 | `src/performance/performance.detect.ts` | 67 | Детекция железа (cores, memory, mobile) |
| 4 | `src/performance/performance.store.ts` | 182 | Zustand store + persist + 2 convenience hooks |
| 5 | `src/performance/performance.hooks.ts` | 206 | 7 публичных хуков + re-export |
| 6 | `src/performance/performance.bridge.ts` | 282 | DOM-публикация (атрибуты + CSS vars) |
| 7 | `src/performance/performance.clamp.ts` | 60 | Recording-safe clamp |
| 8 | `src/performance/performance.recording.ts` | 75 | Capture profile по tier |
| — | `src/performance/performance.store.test.ts` | 101 | Тесты store |
| — | `src/performance/performance.clamp.test.ts` | 78 | Тесты clamp |
