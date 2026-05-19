# BELIVE-HUB
> Центральная карта проекта beLive. Все связи. Все агенты. Актуальный статус.

**Текущая волна:** W11 + W12 — Auto-Lyrics + Cover Art
**Последнее обновление:** 2026-04-19

---

## 🧠 АГЕНТЫ

| Агент | Роль | Context Pack |
|-------|------|--------------|
| Билли | Product/Release Manager | [[BILI-CONTEXT]] |
| Центр№ | Архитектор (открывается под задачу) | [[ARCH-BASE]] + TASK-XXX |
| Qoder | Code Operator (Оператор+007) | правила вшиты в Qoder |

---

## 🚨 P0 — SHIP BLOCKERS

- [[P0-RECORDING-CAPTURE]] — Preview audio не захватывается в запись 🔴
- [[P0-TEMPO-RATE]] — tempoRate не применяется в listen steps 🔴

➡️ Полный дашборд: [[SHIP-READINESS]]

---

## 🗺️ АРХИТЕКТУРА — МАСТЕР ДОКУМЕНТЫ

### Ядро системы
- [[architecture-map-2.1]] — **ГЛАВНЫЙ** — полная архитектурная карта
- [[interaction-schema-2.1]] — как система взаимодействует в рантайме
- [[Onboarding Route 2.1]] — маршрут онбординга нового специалиста
- [[audio-engine]] — аудио движок, транспорт, стемы
- [[sync-system]] — синхронизация текста и маркеров
- [[zip-pipeline]] — ZIP экспорт/импорт pipeline (cover art offline, lyricsOriginalContent)
- [[n-stem-architecture]] — N-стем архитектура (миксер)

### Реактивный слой
- [[reactive-lyrics-foundation]] — реактивные лирики, триггеры
- [[styles-system]] — система стилей текста
- [[performance-quality-system]] — производительность, тиры

### Takes & Exercises
- [[takes-system]] — запись, сравнение, практика
- [[exercises-system]] — квесты, рецепты, упражнения
- [[quest-scenario-system]] — генераторы сценариев
- [[scenario-stage-state-model]] — стейт-машина сценариев
- [[practice-experience-layer]] — UX практики
- [[quest-entry-surface]] — точка входа в квесты
- [[quest-authoring-flow]] — создание квестов
- [[quest-persistence-sh...]] — персистентность квестов
- [[quest-scenario-road...]] — roadmap квестов
- [[tempo-scenario-current-truth]] — текущий статус Tempo Scenario

### Split / Monitor
- [[monitor-mix-v2]] — Split система, AutoMix
- [[split-working-map]] — рабочая карта Split

### Специфика
- [[marker-system-spec]] — маркеры M1/M2
- [[block-first-lyrics-sync]] — синхронизация блок-first
- [[control-surface-sema...]] — семантика контрольной поверхности
- [[scene-engine-vision]] — видение сцен движка
- [[recording-capture-sy...]] — система захвата/записи

---

## 📋 ЧЕКПОИНТЫ И ОТЧЁТЫ

- [[checkpoint-reactive-l...]] — чекпоинт: реактивные лирики v1
- [[research-council-verdict]] — вердикт исследовательского совета
- [[responsiveness-recovery]] — восстановление отзывчивости
- [[optimization-wave-1]] — оптимизации волны 1
- [[audit-docs-vs-code]] — аудит документации vs код
- [[Pitch-Integration-Rep...]] — отчёт интеграции Pitch
- [[recording-capture-sy...]] — исследование системы записи

---

## 🚀 ТЕКУЩИЕ ЗАДАЧИ

### W11 — Auto-Lyrics (lrclib + Genius)
**Статус:** Частично выполнено
**Цель:** Автоматический sync lyrics без ручного редактора
**Task Pack:** [[TASK-W11]]

### W12 — Cover Art + Dynamic Theming
**Статус:** Планирование
**Цель:** Обложка трека = источник цветовой темы UI
**Task Pack:** [[TASK-W12]]

---

## 🧩 СВЯЗИ МЕЖДУ СЛОЯМИ

```
AudioEngineV2 (транспорт)
    ↓
lyrics.bridge + markers.bridge (синхронизация)
    ↓
wordSync.store + lyrics.store (данные)
    ↓
TriggerEngine → TriggerBridge (реактивность)
    ↓
CSS vars → WordHighlightLine (рендер)
    ↓
RehearsalLyrics / KaraokeLyricsBoard / LiveSubtitle
```

---

## ❄️ ЗАМОРОЖЕНО — НЕ ТРОГАТЬ

- AudioEngineV2 как транспортный авторитет
- Маркерный backbone для активной строки
- Аддитивная word-sync архитектура
- Cue/fill семантическое разделение
- Bridge слой как постоянная архитектура
- Performance как отдельный policy domain

---

## 📦 CONTEXT PACKS

- [[BILI-CONTEXT]] — для Билли (глобальный уровень)
- [[ARCH-BASE]] — база для любого Архитектора
- [[SHIP-READINESS]] — дашборд готовности к релизу
- [[P0-RECORDING-CAPTURE]] — P0 баг: запись
- [[P0-TEMPO-RATE]] — P0 баг: tempo
