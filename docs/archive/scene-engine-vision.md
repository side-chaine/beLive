# beLive Scene Engine — Vision Document

**Status:** Concept → Architecture Research  
**Version:** 0.1  
**Authors:** Nikita Side-Chaine (Product) 
**Date:** 2026-03-16  
**Related:** belive-2.0-scope.md, architecture-map-2.1.md

---

## Core Philosophy

> **ZIP — это не архив. Это портативная музыкальная среда.**

Кто создал трек — создал среду.  
Кто открыл трек — вошёл в эту среду.  
beLive рендерит то что внутри.

beLive = сосуд.  
ZIP = наполнение и цвет этого сосуда.  
Каждый ZIP может перекрасить beLive в любой вайб.

---

## ZIP как экосистемная единица

### Сейчас
```
track.zip
  instrumental.mp3
  vocals.mp3
  lyrics.txt
  export.json
  alignment.json
```

### beLive 2.0 target
```
track.zip
  instrumental.mp3
  vocals.mp3
  lyrics.txt
  export.json
  alignment.json
  scene.json          ← вайб трека
  assets/
    bg-main.jpg       ← фон сцены
    artist-1.jpg      ← фото артиста
    artist-2.jpg      ← ротация фото
  palette.json        ← цветовая система
```

### beLive 2.x extended
```
track.zip
  ... (все выше)
  takes/
    verse-1-take-1.webm   ← записи студента
    chorus-take-2.webm
  exercises/
    exercise-1.json       ← задания от педагога
    exercise-2.json
  notes.json              ← пометки педагога
  album-meta.json         ← если часть альбома
```

### beLive 3.x vision
```
track.zip или album.zip
  ... (все выше)
  多个треков (альбом целиком)
  fan-scene.json          ← сцена от фанатов
  community-assets/       ← артворк от сообщества
```

---

## Центральная плашка как сцена

Плашка с текстом — не просто контейнер для слов.  
Это **сцена выступления**.

### Слоевая архитектура

```
┌─────────────────────────────────────────────┐
│  СЛОЙ 3: Передний план                      │
│  Лёгкие частицы, световые акценты           │
│  Только max/ultra tier                      │
├─────────────────────────────────────────────┤
│  СЛОЙ 2: ПЛАШКА (главная сцена)             │
│  ┌───────────────────────────────────────┐  │
│  │  Текст + Word Sync                    │  │
│  │  Цвет рамки = цвет блока (TrackMap)   │  │
│  │  Backdrop blur / полупрозрачность     │  │
│  │  Форма реагирует на смену блока       │  │
│  └───────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│  СЛОЙ 1: Задний план                        │
│  Анимированный фон (волны, градиент)        │
│  Синхронизирован с бочкой/музыкой           │
│  Фото артиста (статично или ротация)        │
│  Не мешает читать текст                     │
└─────────────────────────────────────────────┘
```

### Принцип гармонии слоёв

Каждый слой **слушает** другие и не мешает им.

- Задний план = атмосфера, не солист
- Плашка = сцена, не стена
- Текст = главный герой всегда

Если текст читается с трудом — сцена настроена неправильно.

---

## Trigger Integration

Существующие CSS vars уже готовы к работе со сценой:

```css
/* Дыхание фона в ритм слова */
.scene-background {
  filter: brightness(calc(1 + var(--bl-word-progress, 0) * 0.08));
}

/* Фото артиста реагирует на активную строку */
.artist-photo {
  opacity: calc(var(--bl-line-active, 0) * 0.2 + 0.8);
}

/* Пульс при смене блока */
.scene-background[data-block-changed="true"] {
  animation: block-pulse 0.4s ease-out;
}

/* Волны под плашкой в ритм бочки */
.scene-waves {
  transform: scaleY(calc(1 + var(--bl-beat-energy, 0) * 0.15));
}
```

**Принцип:** только `transform` и `opacity` — compositor-only, GPU, нет нагрузки на CPU.

---

## Цветовая система

### TrackMap как источник палитры

Блоки уже имеют цвета:
- Verse = зелёный
- Chorus = красный  
- Bridge = синий
- и т.д.

Это можно использовать как **seed для всей сцены**:

```
Verse (зелёный) → предлагаем зелёно-бирюзовую гамму
Chorus (красный) → предлагаем красно-оранжевую гамму
Bridge (фиолетовый) → предлагаем сине-фиолетовую гамму
```

### Цветовые принципы для beLive

```
Analogous colors     → покой, подходит для Rehearsal
Complementary        → энергия, подходит для Concert
Triadic              → вайб, подходит для Karaoke
Monochromatic + акцент → минимализм, всегда безопасно
```

### Готовые сочетания (стартовый набор)
```
"Бирюзовое море"    → #006D77 + #83C5BE + #FFDDD2 + тёмный текст
"Ночной неон"       → #0D0D0D + #FF2D55 + #FFFFFF
"Золотой час"       → #2D1B00 + #FF9F1C + #FFBF69 + #FFFFFF
"Минимал"           → #1A1A1A + #FFFFFF + один цвет акцента
"Лес"               → #1A2F1A + #4CAF50 + #E8F5E9
```

---

## AI Промт-Конструктор для фонов

Пользователь описывает вайб → beLive помогает создать фон.

### Флоу

```
1. Пользователь вводит:
   "бирюзовое море, минимализм, тёмный текст"

2. beLive конструирует промт:
   "Minimalist background, teal ocean waves, 
    dark aesthetic, suitable for text overlay, 
    no faces, ambient mood, 4K, --ar 16:9"

3. Пользователь вставляет промт в Grok Imagine / Midjourney / DALL-E

4. Скачивает результат → загружает в beLive

5. beLive сохраняет в assets/ и обновляет scene.json
```

### Заготовленные промт-шаблоны

beLive предлагает готовые шаблоны по жанрам:

```
Rock / Metal    → "dramatic dark background, electric energy..."
Pop             → "bright colorful gradients, modern aesthetic..."
Jazz            → "warm vintage tones, smoky atmosphere..."
Classical       → "elegant marble, deep blacks and golds..."
Electronic      → "neon grid, cyber aesthetic, dark background..."
Soul / R&B      → "warm amber tones, velvet texture..."
```

---

## Performance Tiers для сцены

```
LITE
  └─ Статичное изображение фона
  └─ Без анимации
  └─ Фото артиста статично

BALANCED  
  └─ Лёгкий параллакс на фоне
  └─ Fade transitions при смене блока
  └─ Фото артиста с crossfade

MAX
  └─ Полный параллакс
  └─ Trigger-driven атмосфера
  └─ Анимированные акценты на плашке

ULTRA
  └─ Всё из MAX
  └─ Частицы / световые эффекты
  └─ Возможно короткие WebM loops (pre-rendered)
```

---

## Performance Safety Doctrine

### Safe (всегда использовать)
- transform (translate, scale, rotate)
- opacity

### Caution (использовать осторожно, проверять на слабом железе)
- filter: brightness()
- filter: contrast()

### Danger (не использовать в Scene v1)
- backdrop-filter (очень дорого на Intel Iris)
- filter: blur() на больших областях
- mix-blend-mode на нескольких слоях
- full-screen animated blur
- layered glow fields
- per-word motion на всей сцене

---

## Package Manifest

Каждый beLive ZIP должен содержать
один canonical файл belive-package.json:

{
  "formatVersion": 2,
  "track": {
    "title": "...",
    "artist": "..."
  },
  "audio": {
    "instrumental": "instrumental.mp3",
    "vocals": "vocals.mp3"
  },
  "lyrics": {
    "text": "lyrics.txt",
    "markers": "export.json",
    "wordSync": "alignment.json"
  },
  "scene": {
    "descriptor": "scene.json",
    "assetsPath": "assets/"
  }
}

Без этого файла import = угадывание по именам.
С этим файлом import = детерминированный.

---

## UI Stability Doctrine

Сцена меняет вайб — но не ломает воркфлоу.

Strongly mutable (меняется со сценой):
  - background, artist photo
  - palette, plate style
  - viewport composition

Mildly mutable (лёгкие акценты):
  - UI accent color
  - glow тон кнопок

STABLE (никогда не меняется):
  - геометрия контролов
  - позиция навигации
  - TrackMap структура
  - dock bar layout

Принцип: muscle memory пользователя
должно работать в любой сцене.

---

## Scene Lab — песочница

Инструмент для разработки и для пользователей.

```
Открывается из: Styles → Scene → "Edit Scene"

Показывает:
  └─ Плашку с тестовым текстом
  └─ Все параметры сцены справа
  └─ Preview в реальном времени
  └─ Слайдер tier (lite / balanced / max / ultra)

Позволяет:
  └─ Загрузить фон
  └─ Выбрать/загрузить фото артиста
  └─ Настроить палитру
  └─ Включить/выключить триггеры
  └─ Выбрать пресет

Сохранить:
  └─ Записать в scene.json текущего трека
  └─ Сохранить как пресет для других треков
```

---

## Scene Descriptor — JSON контракт v1

```json
{
  "sceneVersion": 1,
  "layout": "center",
  "background": {
    "type": "image",
    "src": "assets/bg-main.jpg",
    "motion": "drift-slow",
    "parallax": 0.3
  },
  "artist": {
    "enabled": true,
    "photos": ["assets/artist-1.jpg", "assets/artist-2.jpg"],
    "position": "right",
    "transition": "crossfade",
    "interval": 8000
  },
  "palette": {
    "primary": "#1a1a2e",
    "accent": "#e94560",
    "text": "#ffffff",
    "glow": "#e9456044"
  },
  "blockBindings": {
    "chorus": {
      "accentBoost": 1.2,
      "backgroundShift": true
    },
    "bridge": {
      "dimBackground": 0.85
    }
  },
  "triggers": {
    "beatPulse": true,
    "wordBreath": true,
    "blockTransition": "fade",
    "lineActive": "glow"
  },
  "tierFallbacks": {
    "lite": {
      "motion": "none",
      "triggers": {}
    },
    "balanced": {
      "motion": "drift-slow",
      "triggers": {
        "blockTransition": "fade"
      }
    }
  }
}
```

---

## Implementation Roadmap

### Scene v1 — Wow без сложности
```
→ Загрузка фона из ZIP
→ Фото артиста справа (статично)
→ Palette из scene.json применяется к CSS vars
→ Layout shift (center / side-artist)
→ Tier-aware: lite = статика, остальные = drift
Результат: beLive визуально другой продукт
```

### Scene v2 — Редактор
```
→ Scene Lab (песочница)
→ Выбор из пресетов
→ Загрузка своего фото/фона
→ Настройка палитры
→ Preview в реальном времени
```

### Scene v3 — Конструктор
```
→ AI промт-конструктор для фонов
→ Trigger-to-animation привязки
→ Полный Layer Editor
→ Экспорт сцены как отдельного пресета
→ Sharing сцен через Telegram
```

---

## Ключевые принципы для Архитекторов

```
1. Текст всегда читаем
   Сцена обнимает текст, не борется с ним

2. Compositor-only анимации
   Только transform и opacity — GPU, без CPU

3. Declarative не imperative
   scene.json описывает вайб, не кодирует поведение

4. Prepared offline, cheap runtime
   Тяжёлая работа (генерация фонов) — офлайн
   Runtime — только рендер готовых assets

5. TrackMap как цветовой источник
   Цвета блоков → seed для всей палитры сцены

6. Гармония слоёв
   Каждый слой знает своё место
   Ни один не кричит громче текста
```

---

## Открытые вопросы для исследования

```
1. Как хранить scene assets в IDB?
   (binary data, размеры, лимиты)

2. Как организовать assets/ внутри ZIP
   без конфликтов имён между треками?

3. Оптимальный формат фона:
   JPG (маленький) vs WebP (лучше) vs AVIF (современный)?

4. Depth map для фото артиста:
   AI-generated офлайн или CSS tricks?

5. Beat detection для волн:
   audio-reactive bridge уже есть — как подключить к сцене?

6. Scene Lab в каком режиме открывается первым?
   Rehearsal only или все режимы?
```

---

## One-Line Vision

**beLive — это сосуд. ZIP наполняет его и перекрашивает в любой вайб.
Каждый трек = своя музыкальная среда. Пользователь входит в мир трека, не в утилиту.**
