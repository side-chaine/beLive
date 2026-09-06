# 013 — HANDOFF: Новая архитектура BPM/Pitch (для нового архитектора)

**От:** 007_1.9
**Кому:** Новому архитектору (GPT/Sonnet)
**Тема:** V3 живёт, SoundTouch мёртв, Signalsmith — кандидат. Нужен Spike.

---

## Краткая история вопроса

### V3 — что это?

V3 — это **звуковой движок beLive**, спроектированный Sonnet. Он управляет 7 стемами:

```
StemPlayerV3[7] → DuckGuard → FaderGain → MonitorRouter → destination
```

V3 **работает стабильно**. Это архитектура "как стемы играют вместе". Его внедряли поверх legacy AudioEngineV2 (frozen) через Strangler Fig — десятки раундов, Mode Switch arbiter, adapter'ы.

**V3 не меняем. Он хороший. Он остаётся.**

### SoundTouch — что с ним

SoundTouch — это **одна маленькая деталь** внутри V3, которая должна была делать pitch preservation.

```
MonitorRouter → PitchChain (2× WSOLA) → destination
```

**SoundTouch сломан.** Доказано. Тема закрыта:

| Файл | Содержание |
|:-----|:-----------|
| `009-DECISION-RECORD-SOUNDTOUCH-CLOSED.md` | Вердикт архитектора. Root cause: `calculateEffectiveRateAndTempo()` переключает порядок стадий по знаку `_rate` |
| `097-PVPROBE-ROOT-CAUSE.md` | Probe data — pipeline math верен, но структурное ограничение библиотеки |
| `SONNET-PACK.md` | Полный пакет Sonnet (16 файлов кода) |
| `SONNET-PACK-v2-SUPPLEMENT.md` | Дополнение — double-processing гипотеза опровергнута архитектором |

**Коротко:** SoundTouch меняет порядок стадий для rate<1.0, и обе реализации (WSOLA и PhaseVocoder) ломаются на этом. Это не баг интеграции, а свойство публичного API библиотеки.

### Что сейчас в проде

**Option C — Varispeed-only.** Работает. `source.playbackRate = rate`. Питч НЕ сохраняется для rate<1.0, но трек играет. Это безопасная позиция — ничего не сломано, можно не спешить.

SoundTouch в коде — отключён. PitchChain удалён из TransportV3. Processor'ы висят мёртвым грузом (их удалим после подтверждения замены).

### Кандидат: Signalsmith Stretch

| Файл | Содержание |
|:-----|:-----------|
| `010-MACRO-SIGNALSMITH-ANALYSIS.md` | Полный анализ Signalsmith: API, post-mix архитектура, B-APGE alignment, SignalsmithAdapterService |
| `011-COMPLETE-LANDSCAPE.md` | Все 9 библиотек: npm/GitHub/Context7 данные, weighted scoring, Synthesis Matrix |
| `012-MACRO-TOP3.md` | **MACRO-PACK с топ-3 рекомендацией** |

**Signalsmith — лидер:**
- MIT лицензия ✅
- WASM + AudioWorklet (нативный AudioNode) ✅
- Встроенный loop (`schedule({ loopStart, loopEnd })`) ✅
- Встроенный seek (`schedule({ input: position })`) ✅
- `inputTime` + `setUpdateInterval` для lyrics sync ✅
- 13,614 загрузок/нед, 525 ⭐
- Context7: High reputation, 459 code snippets

**Архитектура post-mix (1 инстанс вместо 7):**

```
БЫЛО (SoundTouch):
  MonitorRouter → PitchChain (2× WSOLA) → destination
                   ⚠️ 2 инстанса, per-bus

СТАЛО (Signalsmith):
  MonitorRouter → Signalsmith → destination
                   ✅ 1 инстанс, post-mix

ВЕСЬ V3 БЕЗ ИЗМЕНЕНИЙ:
  StemPlayerV3[7] ✅
  DuckGuard ✅
  FaderGain ✅
  MonitorRouter ✅
  TransportV3 ✅
  stem-engine-sync ✅
  V2Adapter ✅
```

### Резервные варианты (если Signalsmith не взлетит)

| Библиотека | Почему резерв |
|:-----------|:--------------|
| `@audio/stretch-wsola` | MIT, pure JS, 14KB. Нет WASM — ниже риск, но выше CPU |
| `rubberband-wasm` | GPLv2. Лучшее качество (benchmark 92.3), но нужна коммерческая лицензия |
| `@descript/kali` | LGPL, заброшен с 2021, main-thread only — не рекомендую |

---

## Текущая архитектура (ты должен это знать)

### Где лежит код

```
src/audio/engine-v3/
├── core/
│   ├── TransportV3.ts          — ✅ жив, SoundTouch отключён
│   ├── StemOrchestrator.ts     — ✅ жив
│   └── IV2PublicContract.ts    — ✅ жив
├── stems/
│   ├── StemPlayerV3.ts         — ✅ жив
│   └── stem-engine-sync.ts     — ✅ жив (Mode Switch 1.8)
├── pitch/                      — 🗑 SoundTouch, подлежит удалению
│   ├── PitchChain.ts           — SoundTouch routing (139 строк)
│   ├── PitchNode.ts            — SoundTouchNode wrapper (86 строк)
│   ├── soundtouch-processor.js — 2063 строки DSP
│   └── phase-vocoder-processor.js — 2471 строка PV DSP
└── stretch/                    — 🆕 Новая папка (для SignalsmithAdapterService)
```

### Frozen zones (НЕ ТРОГАТЬ)
- `src/audio/core/AudioEngineV2.ts` ❄️
- `src/audio/compat/patchV1.ts` ❄️
- `src/services/track.orchestrator.ts` ❄️
- `src/bridges/*` ❄️ (все 22 retired)
- `js/*.js` ❄️
- Приватные поля `_` ❄️

### V3 progress
- ✅ Звук, управление, фейдеры, метры — **работает**
- ✅ Mode Switch → V3 arbiter — **работает** (1.8)
- ✅ BPM меняется через varispeed — **работает** (Option C)
- ❌ Pitch preservation для rate<1.0 — **не решено** (SoundTouch закрыт)
- ⏳ 73 V2 calls — **10% сделано**
- ⏳ Q1 (V3 своя AudioContext vs FR-004) — **ждёт**

---

## Что требует решения прямо сейчас

**Нужен Spike: Signalsmith Reality Check.**

Не миграция. Не удаление SoundTouch. Просто 6 вопросов:

1. Можно ли непрерывно воспроизводить поток в AudioWorklet?
2. Работает ли изменение скорости 0.5×–1.5× без слышимого pitch drift?
3. Работают ли loop без щелчков?
4. Не ломается ли seek?
5. Какая реальная загрузка CPU на 2013 MacBook Pro (i7-4558U)?
6. Какова задержка?

**Если 5/6 — да → планируем Фазу 1 (адаптер).**
**Если нет → остаёмся на varispeed-only (уже в проде).**

---

## Референсы (все файлы на ~/Desktop/beLive_Context/)

### Главные (прочитай в первую очередь)

| Файл | Зачем |
|:-----|:------|
| `_007-state.md` | **ВСЯ история** — 955 строк хроники всех сессий. § "1.8" (стр.634), "1.9" (стр.741), "Decision Record" (стр.785), "PhaseVocoder root cause" (стр.826), "SoundTouch CLOSED" (стр.870) |
| `009-DECISION-RECORD-SOUNDTOUCH-CLOSED.md` | **Почему SoundTouch закрыт** — root cause, вердикт архитектора |
| `012-MACRO-TOP3.md` | **Моя рекомендация** — топ-3, API, план интеграции, риски |

### Архитектура V3

| Файл | Зачем |
|:-----|:------|
| `000-FULL-BASE.md` | Полный контекст проекта (783 строки) |
| `AETHER-V3-SPEC.md` | Спецификация V3 |
| `002-MACRO-MODE-SWITCH-ARBITER/002-MACRO.md` | Mode Switch → V3 arbiter (1.8) |
| `008-DECISION-RECORD-V3-FINAL.md` | Финальное решение по V3 |
| `V2-V3-COMPARISON.md` | Сравнение V2 и V3 |
| `POLISH-BACKLOG.md` | Что осталось доделать |

### SoundTouch (история вопроса)

| Файл | Зачем |
|:-----|:------|
| `097-PVPROBE-ROOT-CAUSE.md` | Root cause analysis — pipeline math |
| `097-CONTEXT-FOR-1.9.md` | Контекст для принятия решения |
| `SONNET-PACK.md` | Полный пакет для Sonnet (16 файлов) |
| `SONNET-PACK-v2-SUPPLEMENT.md` | Дополнение — опровержение double-processing |
| `003-EXPERIMENT-2X-WSOLA/` | Эксперимент 2× WSOLA |
| `004-BYPASS-TEST-RESULTS.md` | Bypass test — SoundTouchNode исправен |
| `007-MACRO-SOUNDTOUCH-REMOVAL/` | План удаления SoundTouch |
| `FOR-SONNET-SOUNDTOUCH-CLOSED.md` | Сообщение Sonnet: тред закрыт |

### Signalsmith (кандидат)

| Файл | Зачем |
|:-----|:------|
| `010-MACRO-SIGNALSMITH-ANALYSIS.md` | Полный анализ Signalsmith + API |
| `011-COMPLETE-LANDSCAPE.md` | Все 9 библиотек, weighted scoring |
| `012-MACRO-TOP3.md` | MACRO-PACK: топ-3 рекомендация |

### V3 Engine код (на диске)

| Файл | Строк |
|:-----|:------|
| `src/audio/engine-v3/core/TransportV3.ts` | ~123 |
| `src/audio/engine-v3/core/StemOrchestrator.ts` | ~200 |
| `src/audio/engine-v3/core/IV2PublicContract.ts` | ~85 |
| `src/audio/engine-v3/stems/StemPlayerV3.ts` | ~200 |
| `src/audio/engine-v3/stems/stem-engine-sync.ts` | ~117 |
| `src/audio/engine-v3/pitch/PitchChain.ts` | ~139 (🗑 на удаление) |
| `src/audio/engine-v3/pitch/PitchNode.ts` | ~86 (🗑 на удаление) |
| `src/audio/engine-v3/pitch/soundtouch-processor.js` | ~2063 (🗑 на удаление) |
| `src/audio/engine-v3/pitch/phase-vocoder-processor.js` | ~2471 (🗑 на удаление) |

---

## Что я жду от тебя

1. **Прочитать** ключевые файлы (особенно 009, 012, 010)
2. **Оценить** Signalsmith как кандидата — согласен/не согласен?
3. **Предложить** план Spike — как за 1-2 дня проверить 6 вопросов
4. **Сказать** — GO на Spike или есть сомнения?

---

## Контакты

Весь контекст на `~/Desktop/beLive_Context/`. Если нужно что-то ещё — скажи, 007 найдёт.

**Файл:** `~/Desktop/beLive_Context/013-HANDOFF-NEW-ARCHITECT.md`
