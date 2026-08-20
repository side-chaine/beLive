# 📋 SONNET-REPORT-13: DUO-first стратегия V3

**Дата:** 2026-07-27
**Автор:** 007 (координатор)
**Для:** Соннет (архитектор Agent_202)
**Статус:** Фаза 1 готова к применению (5 MICRO-PACKs, уверенность 95%)

---

## Часть 1 — Наблюдения пользователя

### Логи: что видно

**V3 загружается корректно:**
```
[StretchPool] ✅ 7/7 instances active
[HybridPipeline] ✅ Init. Stretch: 7/7
[V3DataInterceptor] ✅ Pipeline: 7 stems loaded
[V2Cage] ✅ Cage active — V2 silenced
[V3DataInterceptor] 🎯 Auto-play V3 at 5.5s
[AETHER] ✅ V3 pipeline gains restored to 1.0
```

**7 DIAG логов идут сразу (MP-24 — Promise.all работает ✅):**
```
[DIAG] instrumental | instance:true | isActive:true | stretchGain:true | poolActive:7 | rate:1
[DIAG] vocals | ...
[DIAG] bass | ...
[DIAG] drums | ...
[DIAG] guitar | ...
[DIAG] other | ...
[DIAG] keys | ...
```

**Все 7 стемов стартуют параллельно (Promise.all):**
```
[RECON-1] StretchInstance:stretch-0 | start(offset=5.50, rate=1.000) ✅ resolved
[RECON-1] StretchInstance:stretch-1 | start(offset=5.50, rate=1.000) ✅ resolved
...
[RECON-1] StretchInstance:stretch-6 | start(offset=5.50, rate=1.000) ✅ resolved
```

**Space play/pause работает корректно:**
```
[KEYBOARD] Space pressed  →  [TRACE-PLAY]  →  7× DIAG  →  ✅ play() success
[KEYBOARD] Space pressed  →  [TRACE-PAUSE]
```

**Play offset накапливается (seek не работает, V3 играет с того же места при перезапуске):**
- Первый play: offset=5.50s
- Второй: offset=22.28s
- Третий: offset=25.61s

### Симптомы (пользователь, verbatim)

1. **"на индикаторах микшера пусто"** — Mixer UI не показывает уровни V3 (читает из V2, который заглушен V2AudioCage)
2. **"звук идет с небольшими прерываниями"** — когда открыты другие вкладки. После перезагрузки (только beLive) — звук шёл без прерываний.
3. **"навигация не работает! BPM не работает!"** — duration=0 → все UI фичи мёртвы
4. **"слышно синхронно звучит инструментал со стэмами! все синхронно!"** — V3 играет синхронно! ✅ Десинхрон ударных побеждён (MP-24)
5. **"слегка флэнжерит"** — возможная причина: **double audio** (V2+V3 оба играют) или фазовые артефакты наложения. Нужна диагностика.
6. **"скорее всего RAM не тянет"** — 7/7 stretch instances, 7 stems в Bus A, Chrome с другими вкладками → 1.7GB → прерывания
7. **CORS ошибка** на `belive-feed-bot.workers.dev` — не влияет на аудио, но блокирует каталог

### Вывод из наблюдений

**V3 работает, звук есть, синхронность есть.** Но:
- **RAM — главный лимит.** 7/7 stretch + 7 stems = ~1.7GB. На 2013 MBP с другими вкладками — прерывания.
- **duration=0 убивает UI.** Пользователь не видит прогресс, не может seek, не меняет BPM.
- **Mixer пуст** — V3 не публикует метры/уровни в UI.
- **Лёгкий флэнжер** — требует диагностики (double audio? phase?).

---

## Часть 2 — Исследование команды

### На чём мы были (MP-19..MP-24)

| MP | Фикс | Результат |
|:---|------|:---------:|
| MP-19 | FR-014 Kill (instrumental→0 на паузе) | ✅ |
| MP-21 | Transport Lock (Promise chain mutex) | ✅ |
| MP-22 | Await pipeline.play() | ✅ |
| MP-23 | Orchestrator guard (`if (!this._pipeline)`) | ❌ RAM не упал |
| MP-24 | Promise.all (параллельный старт 7 стемов) | ✅ Десинхрон ударных ушёл |

### Полный аудит 001→002→001→009

**Проблема A — 1.7GB RAM**

*001 (Architect) исходно:* MP-23 сэкономил 0 байт. Orchestrator НЕ держал параллельную копию (disposeAll() вызывается ДО guard). RAM = float32 × 7 stems × ~55MB = ~385MB AudioBuffer + ~385-500MB WASM + ~400-600MB React = **1.2-1.7GB — ожидаемый working set.**

*002 (Stress-Test) атака:* 002 ошибся в битности (думал 16bit = 27.5MB/стем, реально float32 = 55MB/стем). **001 был прав.**

*001 Defence:*** ❌ REJECT. Float32 × 2ch × 4bytes = 55MB/stem. 002 неправ.

*009 Verifier:* **✅ A1 REJECT подтверждён.** RAM — архитектурная цена V3, не утечка.

---

**Проблема B — НЕТ UI-фич (B1a duration=0)**

*001:* **Корень всех проблем.** TransportV3.duration → orchestrator.duration → 0 (orchestrator пуст после MP-23). Progress bar скрыт, seek сломан, BPM не работает, 4 цепочки разорваны.

*002:* B1a решение 001 (pipelineController.duration) сломано — `HybridPipelineService.duration` возвращает 0 всегда. **002 прав.**

*001 Defence:*** **✅ ACCEPT CRITICAL.** Нужна реализация duration в HybridPipelineService + TransportV3.

*009:* **✅ B1a подтверждён.** 🔴 P0.

---

**Проблема C — Space не реагирует**

*001:* keyboard handler проверяет `orchestrator.all().length > 0` → FALSE → zombie path (MP-18) спасает, но путает play/pause при suspend.

*002:* C2 (pause guard) создаёт deadlock. C3 уже есть в коде. C1 требует ctx getter.

*001 Defence:* C2 **RETRACTED** (deadlock). C3 **RETRACTED** (already in code). C1 **ACCEPTED** — нужен getter.

*009:* **✅ Тройной баг:** duration=0 + keyboard guard + AudioContext suspend.

---

### Новая стратегия: DUO-first (решение 007)

Пользователь предложил: **V3 работает с BPM и всеми режимами V2 — иначе бессмысленно. Откатиться к DUO (instrumental + vocals), не пытаться сделать FULL сразу.**

**Почему FULL-first была ошибкой:**
- 7 WASM stretch инстансов = ~500MB
- 7 stems × ~55MB AudioBuffer = ~385MB
- 7 точек синхронизации, race condition, десинхрон
- duration=0 убивает UI одинаково для 2 и 7 стемов

**DUO-first (2 stems):**
- 2 WASM stretch инстанса = ~140MB
- 2 stems × ~55MB = ~110MB
- **Total для DUO: ~600-750MB** (вместо 1.2-1.7GB)
- 2 точки синхронизации — тривиально
- duration = max(instrumental.duration, vocals.duration) — 2 проверки

---

### 5 MICRO-PACKs для Фазы 1 DUO

*Разработаны через 001→002→001→009. Все FM от 002 обработаны. Уверенность 95%.*

| MP | Фикс | Файл | Строк |
|:---|:----:|:----:|:----:|
| **MP-27** | `TransportV3.isAudioContextRunning` — ctx getter (включая 'suspended') | `TransportV3.ts` | +6 |
| **MP-28** | Safety net: 5s timeout + ghost sound kill + V2 play после краша + `__loadingV3` флаг | `V3DataInterceptor.ts` | ~30 |
| **MP-26** | Keyboard guard: единый V3 блок (было 2) + `__v3Active`/`__loadingV3` guard + все V2 вызовы в try/catch + V3 seek в try/catch | `useKeyboardShortcuts.ts` | ~40 |
| **MP-25** | `HybridPipelineService.duration` = max(stems) + кэш `_lastKnownDuration`. `TransportV3.duration` = pipelineController first | `HybridPipelineService.ts`, `TransportV3.ts` | ~20 |
| **MP-29** | `MAX_STRETCH_INSTANCES=3` (было 7), `StretchSlot=0|1|2`, `instrumental:0` priority | `StretchInstancePool.ts` | ~15 |

**Порядок:** MP-27 → MP-29 (параллельно) → MP-28 → MP-26 → MP-25

### 🔴 CRITICAL FM, решённые в исправлениях (002 → 001 Defence)

| FM | Описание | Исправление |
|:--:|:---------|:------------|
| В1 | keyboard: `transport` null при `__v3Active` → V2+V3 double audio | ✅ `__v3Active` guard перед V2 fallback |
| В2 | Race: V3 загружается, V2 стартует, cage бьёт через 100ms → gap | ✅ `__loadingV3` флаг в начале/конце loadTrack |
| В3 | V2 fallback без try/catch → Uncaught exception убивает клавиатуру | ✅ Все V2 вызовы обёрнуты |
| В4 | V3 seek с пустым orchestrator не тестирован → может упасть | ✅ try/catch на V3 seek |
| C1 | C2 (pause guard) → deadlock при suspended ctx | ❌ RETRACTED |
| C2 | MP-28: `await play` никогда не зарезолвится (WASM deadlock) | ✅ 5s timeout через `Promise.race` |
| C3 | MP-28: частичный старт стемов → ghost sound | ✅ `pipeline.stop()` в catch |
| C4 | MP-28: deactivate cage без V2 play → gap тишины | ✅ `V2Adapter.delegateSync('play')` после deactivate |
| D1 | MP-25: duration = 0 при reset между треками → UI дёргается | ✅ Кэш `_lastKnownDuration` |
| E1 | MP-29: StretchSlot=0..6, старый код может использовать слот 5 | ✅ Тип StretchSlot = 0\|1\|2 (TypeScript не скомпилирует слот 5) |
| E2 | 7 existing crash bugs (V2 fallback без try/catch) | ✅ Все V2 вызовы в try/catch (MP-26) |

### TransportBar.handleSeek (не вошло в Фазу 1)

**Найдено (002):** TransportBar (строка 41) тоже проверяет `orchestrator.all().length > 0`. После MP-25 duration будет виден, но seek кликом на прогресс-бар будет уходить в V2 (который заглушен). **Нужен отдельный MP в Фазе 2.**

**Аналогично сломаны 6 guard'ов:**
- `TransportBar.tsx:41` — handleSeek
- `position-sync.ts:42` — syncCurrentTime guard
- `loop-events.ts:27, 52` — loop restart
- `stem-engine-sync.ts:23` — rate sync
- `useKeyboardShortcuts.ts:45, 74` — keyboard (чинится MP-26)
- `trigger-visual.service.ts:55` — визуальные триггеры

### position-sync race

Каждые 100ms position-sync перезаписывает `currentTime` из V2 (который заглушен) — затирая корректное 60Hz значение от V3StatePublisher. **Нужен фикс guard в Фазе 2.**

---

### 005 (Booster) — signalsmith-stretch + BPM

**Context7: 8 вызовов (4 resolve + 4 query)** ✅

| Вывод | Статус |
|-------|:------:|
| signalsmith-stretch — оптимален для DUO | ✅ |
| `schedule({rate, semitones: 0})` корректно меняет rate без pitch | ✅ |
| **`adjustPrevious: true`** — добавить для плавных rate переходов | 🆕 Фаза 2 |
| Rate range 0.5–2.0 по документации (beLive 0.25–4.0 — риск) | ⚠️ |
| Streaming для DUO не нужен (~136MB для 2 stems) | ✅ |
| BPM формула: `rate = targetBPM / originalBPM` | 🗓 Фаза 2 |
| Альтернативы stretch (SoundTouchJS, Rubber Band) — слабее | ✅ signalsmith best |

### Разведка V2 — BPM/rate механизм

| Вывод | Статус |
|-------|:------:|
| V2 НЕ использует BPM — только scalar playbackRate (0.25-4.0) | ✅ |
| V3 уже корректно re-anchor позицию при rate change (HybridClock) | ✅ |
| V3StatePublisher уже публикует ratechange в EventBus | ✅ |
| RateThrottler (20Hz) уже защищает WASM от спама | ✅ |
| preservePitch — WASM stretch делает автоматически (semitones=0) | ✅ |

---

### ❄️ Frozen Zone

Ни один файл из frozen зоны не затронут:
- `src/audio/core/AudioEngineV2.ts` ❄️
- `src/audio/compat/patchV1.ts` ❄️
- `src/bridges/*` ❄️
- `src/services/track.orchestrator.ts` ❄️

**Все изменения** — в engine-v3, hooks, event-bus (не frozen).

---

### Typecheck

`npx tsc --noEmit` — **0 новых ошибок** в engine-v3. Pre-existing ошибки только в:
- `takes/` (15)
- `triggers/` (3)
- `theme/` (2)
- `test/` (2)
- `legacy/engine-v3/` (6 — cannot find module, deprecated dir)

---

## 📊 Итоговая карта

| Проблема | Диагноз | Фикс | Статус |
|:---------|:--------|:-----|:------:|
| RAM 1.7GB | **Архитектурная цена** 7× float32 + 7× WASM + React | DUO-first (2 stems = ~700MB) | 🟡 Фаза 1 |
| duration=0 | Pipeline активен, orchestrator пуст | MP-25: max(stems) + pipeline controller | 🔴 P0 готов |
| Keyboard Space | 6 guard'ов проверяют orchestrator | MP-26: `__v3Active` + try/catch | 🔴 P0 готов |
| V3 crash → тишина | Нет safety net | MP-28: timeout + rollback + V2 restart | 🔴 P0 готов |
| Mixer пуст | V3 не публикует метры | Отдельный трек (Фаза 2) | 🟡 |
| Флэнжер | ? Double audio? Фаза? | Нужна диагностика | 🟡 |
| position-sync race | V2 polling затирает V3 60Hz | Фикс guard (Фаза 2) | 🟡 |
| TransportBar seek | Тот же guard orchestrator | Отдельный MP (Фаза 2) | 🟡 |
| BPM | rate change есть, UI не тестирован | MP-25 даст duration → BPM заработает | 🔴 P0 |

---

## 📁 Файлы

- **MACRO-PACK:** `docs/MACRO-PACK-DUO-PHASE1.md` (5 MP, готов к оператору)
- **Стратегия:** `docs/STRATEGY-V3-DUO-FIRST.md`
- **Логи:** `~/Desktop/beLive_Context/039-POST-MP23-MP24-LOGS.md`
- **Логи свежие:** в этом документе, Часть 1
