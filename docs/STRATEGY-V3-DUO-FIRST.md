# 🎯 Стратегия V3: DUO-first

**Дата:** 2026-07-27
**Автор:** 007 (координатор)
**Для:** 001 (CEO), 002 (Stress-Test), 005 (Booster), 009 (Verifier), вся команда
**Статус:** Новая стратегия — откат от FULL-first к DUO-first

---

## 🏛️ Anchored Summary (на чём стоим)

### Что сделано
- **MP-19..MP-24** применены — V3 стабильно играет звук, нет десинхрона ударных
- **V2AudioCage** заглушает V2 при активном V3
- **V3DataInterceptor** загружает трек в pipeline + orchestrator с MP-23 guard
- **V3StatePublisher** публикует currentTime 60Hz + state/rate события
- **TransportV3 + HybridPipelineService** — play/pause/seek работают

### Проблемы после MP-23/MP-24
1. **1.7GB RAM** — не упал, это working set (float32 × 7 stems + WASM + React)
2. **Нет UI-фич** — seek, progress bar, block nav, BPM сломаны при V3
3. **Space не реагирует** после возвращения на вкладку

### Корень всех зол (верифицировано 009)
- **B1a:** `HybridPipelineService.duration = 0` → TransportV3.duration = 0 → UI думает "нет трека"
- **B1b.1:** Keyboard shortcuts проверяют `orchestrator.all().length > 0` — пусто при pipeline
- **Edge 1:** V3 crash → V2 заглушен (V2AudioCage) → тишина

### ❄️ Frozen Zone — НЕ ТРОГАТЬ
- `src/audio/core/AudioEngineV2.ts`
- `src/audio/compat/patchV1.ts`
- `src/bridges/*`
- `src/services/track.orchestrator.ts`
- Все приватные поля `_`

---

## 🧠 Новая стратегия: DUO-first

### Почему FULL-first была ошибкой
Мы пытались сделать V3 для 7 стемов сразу — и утонули в сложности:
- WASM × 7 инстансов = 500MB
- Десинхрон × 7 = 7 возможностей для race
- Pipeline Bus A + B = 2 цепи × 7 stems
- MemoryMonitor не успевает чистить
- duration = 0 — и UI мёртв

**FULL можно, но не сейчас.** Сначала V3 должен доказать, что работает для DUO.

### Что такое DUO
- **instrumental (master-clock)** — длительность, тайминг, блоки
- **vocals** — основной вокал
- Всё. 2 стема. Всё остальное — потом.

### Почему DUO-first выигрывает
| Аспект | FULL (7 stems) | DUO (2 stems) | Экономия |
|--------|:--------------:|:--------------:|:--------:|
| AudioBuffer RAM | ~385MB | **~110MB** | -70% |
| WASM stretch | ~385-500MB | **~110-140MB** | -70% |
| Stretch слоты | 7 | **2-3** | ×2.5 |
| Race conditions | 7× | **2×** | легче |
| duration геттер | max из 7 | **max из 2** | тривиально |
| V2 fallback | 7 stems = сложно | **2 stems = просто** | да |

### Цель
**V3 для DUO работает с BPM и всеми режимами, с которыми работает V2.** Иначе V3 не нужен.

---

## 🗺 Маршрут (Route)

### Фаза 1 — DUO стабилизация (эта неделя)

| # | Задача | Ответственный | Описание |
|---|--------|--------------|----------|
| 1 | **B1a: duration** | 001 → 005 → Operator | Реализовать `HybridPipelineService.duration` = max( instrumental.duration, vocals.duration ) |
| 2 | **B1b.1: keyboard guard** | 001 → Operator | Keyboard shortcuts: вместо `orchestrator.all().length > 0` — проверять `__v3Active` |
| 3 | **C1: ctx getter** | 001 → Operator | Добавить `TransportV3.isAudioContextRunning` |
| 4 | **Edge 1: safety net** | 001 → Operator | Сбрасывать `__v3Active` в catch loadTrack() |
| 5 | **MAX_STRETCH_INSTANCES=3** | 001 → Operator | Стянуть с 7 до 3 (для DUO хватит 2 + запас) |
| 6 | **BPM integration** | 001/002/005 → исследовать | Как V2 делает BPM? Как V3 должен делать BPM? |

**Результат Фазы 1:** DUO-треки работают с seek, progress bar, блоками, BPM. RAM ~600-750MB.

### Фаза 2 — FULL подготовка (после стабилизации DUO)

| # | Задача | Ответственный |
|---|--------|--------------|
| 7 | **A3: clearBuffers при eviction** | 001 → Operator |
| 8 | **MemoryMonitor: loop + короткие треки** | 001 → Operator |
| 9 | **Stream-загрузка (chunked)** | 001 → 005 → исследовать |
| 10 | **V2 fallback полный** | 001 → 002 → спроектировать |

### Фаза 3 — FULL

Когда DUO стабилен на production — расширять на 3, 4, 5…7 stems.

---

## 🔬 Что исследовать команде

### 001 (Architect)
- **BPM в V3:** как V2 синхронизирует BPM с position? Где `rate change` применяется к position-sync?
- **TransportV3.clock:** HybridClock.getCurrentTime() учитывает ли playbackRate?
- **`src/audio/engine-v3/core/HybridClock.ts`** — прочитать, понять
- **`src/foundation/event-bus/wrappers/position-sync.ts`** — полный реверс-инжиниринг

### 002 (Stress-Test)
- **Failure modes DUO:** что ломается с 2 стемами при BPM change?
- **Rate change + loop:** BPM меняется на середине loop — что делает WASM?
- **Space + BPM + seek:** все 3 одновременно — chain reaction
- **AudioContext suspend при BPM change**

### 005 (Booster)
- **Context7:** `resolve-library-id` + `query-docs` для `signalsmith-stretch` — как правильно менять rate/pitch онлайн
- Альтернативы stretch для DUO (меньше RAM)
- **BPM-to-rate mapping** в других аудио-плеерах
- **Streaming AudioBuffer** — можно ли не загружать весь файл?

### 009 (Verifier)
- Верифицировать каждое изменение Фазы 1 до мержа
- **DOC-CHECK:** Обновить `docs/architecture/transport-v3.md` и `docs/architecture/audio-engine.md`
- Проверить что frozen-зоны не затронуты

---

## 📋 Ключевые файлы для исследования

### engine-v3 core
- `src/audio/engine-v3/core/TransportV3.ts` — play/pause/stop, duration, state
- `src/audio/engine-v3/core/HybridClock.ts` — currentTime, suspend/resume
- `src/audio/engine-v3/core/StemOrchestrator.ts` — duration, setOutputRouting
- `src/audio/engine-v3/core/types.ts` — TransportState

### pipeline
- `src/audio/engine-v3/pipeline/HybridPipelineService.ts` — duration=0, play/pause, startMemoryMonitor, reset
- `src/audio/engine-v3/pipeline/StretchInstancePool.ts` — MAX=7, STRETCH_PRIORITY, assign()
- `src/audio/engine-v3/pipeline/StretchInstance.ts` — manageMemory, chunkedLoad, clearBuffers
- `src/audio/engine-v3/pipeline/IPipelineController.ts` — интерфейс

### integration
- `src/audio/engine-v3/integration/V3DataInterceptor.ts` — loadTrack, MP-23 guard
- `src/audio/engine-v3/integration/V3StatePublisher.ts` — tickLoop, _onStateChange
- `src/audio/engine-v3/integration/V2AudioCage.ts` — как глушит V2

### event-bus + UI
- `src/foundation/event-bus/wrappers/position-sync.ts` — guard logic
- `src/hooks/useKeyboardShortcuts.ts` — Space handler
- `src/stores/audio.store.ts` — useAudioStore

### Документация
- `docs/architecture/transport-v3.md` — ❌ STALE (описывает архитектуру до pipeline)
- `docs/architecture/audio-engine.md` — ❌ STALE (7 modules → сейчас ~15+)

---

## ❄️ Frozen Zone (напоминание)

**Ни один агент** не предлагает менять:
- `src/audio/core/AudioEngineV2.ts`
- `src/audio/compat/patchV1.ts`
- `src/bridges/*`
- `src/services/track.orchestrator.ts`
- Приватные поля `_`

Эти файлы — **только для чтения и анализа**. Любое упоминание их в контексте изменения → **АВТОМАТИЧЕСКИЙ СТОП** → вопрос пользователю.

---

## 🎯 Условие успеха

**V3 работает с DUO-треками так же хорошо, как V2 работает со всеми треками:**
- ✅ Seek (перемотка)
- ✅ Progress bar (видит длительность, движется)
- ✅ Block navigation (переход по маркерам)
- ✅ BPM change (rate меняет скорость без искажения pitch)
- ✅ Space play/pause (всегда, с любой вкладки)
- ✅ RAM < 800MB для DUO
- ✅ V2 fallback при V3 crash (без тишины)

**Когда это готово — можно расширять на FULL.**

---

## 💬 Цитата пользователя

> *"Я думаю ошибка того что мы долго стоим на этой проблеме заключается в том что мы хотим все и сразу! а это не работает! изначально мы и делали все на DUO но потом расширили на FULL и конечно теперь все хотим делать на FULL"*
> *"Нам нужно сделать так чтобы V3 работал спокойно с BPM и всеми режимами с которыми работает V2 — иначе это все бессмысленно!"*

---
