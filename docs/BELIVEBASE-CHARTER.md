# 🏛 Устав города beLiveBase

**Версия:** 0.1 (2026-07-24)
**Статус:** ✅ ПРИНЯТ — основа архитектуры beLiveBase
**Метафора:** Город. Каждый модуль = здание. EventBus = дороги. Данные = грузы.
**Место:** `docs/BELIVEBASE-CHARTER.md` — живой документ, обновляется с каждой стройкой

---

## Преамбула

beLiveBase — не папка с файлами. Это **город**, в котором:
- Каждое здание знает своё назначение
- Дороги (EventBus) связывают районы, но не заставляют их знать друг друга
- У каждого здания есть **паспорт** — кто отвечает, что делает, куда подключено
- Технологии внутри зданий можно менять — город продолжает работать

---

## 🗺 Карта города (текущая)

```
                    🚦 ТРАНСПОРТНАЯ СТАНЦИЯ
                    (EventBus — центр связи)
                    ╱       ╱    ╲       ╲
                   ╱       ╱      ╲       ╲
          ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
          │  🏭   │ │  🚂   │ │  🖥   │ │  🎤   │
          │  DSP  │ │Transport│ │  UI   │ │Practice│
          │ Factory│ │ Center │ │District│ │ Center │
          └────────┘ └────────┘ └────────┘ └────────┘
               ╲          ╱         ╱
                ╲        ╱        ╱
               ┌──────────────┐
               │   🗄 Library  │
               │   (Data)      │
               └──────────────┘
```

---

## 🏢 Районы города (домены)

### 1. 🚂 Transport Center
**Код:** `src/audio/engine-v3/core/`
**Назначение:** Время. Play/Pause/Seek. Clock.
**Технологии:** HybridClock, TransportV3, StemOrchestrator
**Закон:** НЕ знает про DSP, UI, Storage. Только события.
**Паспорт:** ✅ Есть (TransportV3.ts — чистый, 253 строки)

### 2. 🏭 DSP Factory
**Код:** `src/audio/engine-v3/` (SignalsmithAdapter + Pipeline)
**Назначение:** Обработка звука. Stretch. Pitch. Loop.
**Технологии:** Signalsmith-stretch, AudioWorklet
**Закон:** Любой алгоритм можно заменить без правки Transport.
**Состояние:** 🏗 Строится — нужен PipelineMode, ILoopStrategy

### 3. 🚦 Event Station (Станция)
**Код:** `src/foundation/event-bus/`
**Назначение:** Все коммуникации между районами.
**Технологии:** EventBus, typed channels, BridgeFacade
**Закон:** Никто не знает друг друга напрямую. Все через станцию.
**Паспорт:** ✅ Есть (34 файла, 6 каналов, 27 событий)
**Состояние:** 🔄 Миграция — BridgeFacade ещё работает (Strangler Fig)

### 4. 🗄 Library (Библиотека)
**Код:** `src/stores/`, `src/services/`, `src/foundation/`
**Назначение:** Данные. Треки. Стемы. IDB. Настройки.
**Технологии:** Zustand, IndexedDB
**Закон:** Никакой audio logic. Только данные.

### 5. 🖥 UI District
**Код:** `src/components/`, `src/App.tsx`
**Назначение:** Интерфейс. Визуализация. Контролы.
**Технологии:** React 19, Zustand
**Закон:** НЕ знает AudioWorklet. Знает только события станции.

### 6. 🎤 Practice Center
**Код:** `src/practice/`, `src/Rehearsal/`, `src/exercises/`
**Назначение:** Режимы: Репетиция, Концерт, Караоке, Loop Learn
**Технологии:** WebRTC, Signaling, WS
**Закон:** Подключается к станции, не лезет в DSP.

### 7. 🤖 AI District
**Код:** `src/ai/`, `src/billy/`
**Назначение:** AI-функции: Coach, Billy, генерация
**Технологии:** AI Hub, Gateway, OpenRouter
**Закон:** Пока пустырь. Дороги проложены (EventBus). Застройка — следующий квартал.

### 8. ☁️ Cloud Gateway
**Код:** `gateway/` (корень проекта), Cloudflare Workers
**Назначение:** Синхронизация, бэкапы, облачные функции
**Технологии:** Cloudflare Workers, Durable Objects

### 9. 🎛 Monitor Tower
**Код:** `src/audio/engine-v3/monitor/`
**Назначение:** Маршрутизация. Микширование. V3 → MonitorRouter.
**Технологии:** MonitorRouter, MonitorEngine

### 10. 🎚 Stem Depot
**Код:** `src/audio/engine-v3/stems/`
**Назначение:** Хранение и управление стемами.
**Технологии:** StemPlayerV3, DuckGuardV3Native

---

## 📋 Паспорт модуля (шаблон)

У каждого здания (модуля) есть паспорт. Без паспорта здание не существует.

```markdown
## 🏢 [Название]
**Район:** [District]
**Код:** `src/path/to/module/`
**Технологии:** [React, Signalsmith, Zustand...]

### Назначение
[Что делает. Одна фраза.]

### Отвечает за
- [Список ответственности]

### НЕ отвечает за
- [Что НЕ делает. Важно!]

### Входы (подписки)
- `event-name` → что происходит

### Выходы (публикации)
- `event-name` → когда публикует

### Владелец
[Имя / Команда]

### Статус
✅ Стабильно | 🏗 Строится | 🗑 На слом | ⏸ Законсервировано
```

---

## ⚖️ Законы города (архитектурные принципы)

### Закон 1: Изоляция
**Transport не знает DSP. UI не знает AudioWorklet.**
Каждый район занимается своим делом и не лезет в соседний.

### Закон 2: Заменяемость
**Любой алгоритм можно заменить без переписывания Transport и UI.**
Сегодня Signalsmith — завтра AI Stretch. Transport всё равно.

### Закон 3: EventBus — единственная дорога
**Никаких секретных троп.** Если модуль A хочет что-то сказать модулю B — только через EventBus. Прямые вызовы запрещены (кроме constructor DI).

### Закон 4: Паспорт обязателен
**Нет паспорта — нет модуля.** Каждый модуль документирует свои границы: входы, выходы, ответственность.

### Закон 5: Технология — деталь реализации
**Названия модулей = роль, не технология.** Не `SignalsmithAdapter`, а `StretchEngine`. Не `ZustandStore`, а `PlaybackState`.

---

## 🚦 Дорожная сеть (EventBus)

### 6 магистралей (каналов)

```
Audio    🎵 — 9 событий (play, pause, rate, track...)
Track   💿 — 2 события (before-change, load-failed)
Catalog 📚 — 4 события (track-saved, tracks-changed...)
Sync    🔄 — 8 событий (blocks-applied, active-line-changed...)
UI      🖥 — 3 события (mode-changed...)
Practice 🎤 — 1 событие (с 6 под-состояниями)
```

### Как выглядит движение

```
🏭 DSP Factory                      🚂 Transport Center
     │                                     │
     │ AudioBus.playbackRateChanged()      │ dispatch('ratechange')
     └──────────────┬──────────────────────┘
                    │
                    ▼
            🚦 Event Station
                    │
            ┌───────┼───────┐
            ▼               ▼
     🖥 UI District    🗄 Library
     (rate slider)     (playbackRate в store)
```

---

## 📊 Текущее состояние города

| Район | Статус | Что нужно |
|-------|--------|-----------|
| 🚦 Event Station | ✅ Работает | Добавить `playback-rate-changed` вызов (MP-1) |
| 🚂 Transport Center | ✅ Работает | Убрать `_pitchChain` (Фаза A). PipelineMode |
| 🏭 DSP Factory | 🏗 Строится | PipelineMode, ILoopStrategy, rename → StretchEngine |
| 🎛 Monitor Tower | ✅ Работает | — |
| 🎚 Stem Depot | ✅ Работает | — |
| 🖥 UI District | 🏗 Ждёт EventBus | Подписаться на rate-changed |
| 🗄 Library | ✅ Работает | — |
| 🎤 Practice Center | ✅ Работает | — |
| 🤖 AI District | 🏗 Пустырь | Следующий квартал |
| ☁️ Cloud Gateway | ✅ Работает | — |

### На слом 🗑
| Здание | Почему |
|--------|--------|
| SoundTouch (pitch/) | Заменён Signalsmith |
| Bridges (bridges/) | Заменены EventBus (Starbase 2.0) |
| DuckGuardV3 (singleton) | Мёртвый код |
| main.tsx SoundTouch тесты | 430 строк мусора |

---

## 🎬 Для YouTube: экскурсии по городу

### Формат выпуска

```
"beLiveBase: Новая архитектура / Открытие района / Новый завод"

🏗 Старый цех закрывается
   → SoundTouch уезжает, Signalsmith заезжает

🚦 Новая магистраль
   → EventBus rate-changed теперь работает

🏭 Открытие DSP Factory
   → PipelineMode, ILoopStrategy, StretchEngine
```

### Визуальные элементы
- **Районы** — цветные блоки с иконками
- **Дороги** — линии между районами (EventBus)
- **Паспорт модуля** — карточка с характеристиками
- **Статус стройки** — ✅ 🏗 🗑 ⏸
- **Анимация** — старый модуль уезжает, новый заезжает

---

## 🔜 Ближайшие стройки

| Что | Район | Приоритет |
|-----|-------|-----------|
| 🚦 EventBus rate integration (MP-1) | Event Station | 🔴 Немедленно |
| 🗑 Чистка main.tsx (MP-2) | Весь город | 🔴 Немедленно |
| 🗑 Снос PitchChain | Transport Center | 🟡 Дни 3-5 |
| 🏗 PipelineMode | DSP Factory | 🟡 Дни 3-5 |
| 🏗 ILoopStrategy | DSP Factory | 🟡 Дни 3-5 |
| 🔬 REGIME 3 Spike | DSP Factory | ⚪ R&D |
| 🤖 AI District застройка | AI District | ⚪ Следующий квартал |

---

*Конец Устава. Город строится. 🚀*
