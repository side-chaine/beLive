# Frozen Zones v2 — Карта неприкасаемых зон
> 🔒 Механизм охраны (с 01.09, FG-CI): `frozen-manifest.json` + `npm run verify:frozen` (CI). Манифест = операционный канон (19 файлов).
**4 зоны · 19 файлов** (AudioEngineV2 + patchV1 + track.orchestrator + 16 мостов), ~5 299 строк (wc-факт 01.09)
*Дата:* 2026-07-17 (обновлён после bridge retirement wave)
*Статус:* ⚠️ ЧАСТИЧНО АКТУАЛЬНО — 19/22 bridges retired, актуальный список ниже

---

## Классификация

### ❄️ Permanent frozen (никогда не трогать)

Эти файлы — ядро аудио-движка. Работают через V2Adapter (read-only).

| Файл | Строк | Причина |
|------|:-----:|---------|
| `src/audio/core/AudioEngineV2.ts` | 2,178 | Транспортный монолит. Чинить нельзя — EngineV3 заменит |
| `src/audio/compat/patchV1.ts` | 162 | V1→V2 совместимость. Умрёт вместе с V2 |
| `src/audio/core/StemPlayer.ts` | ~200 | Загрузка стемов. V3 StemPlayerV3 готов |
| `src/audio/core/AudioLoader.ts` | ~150 | Декодинг аудио |
| `src/audio/core/VocalMix.ts` | ~150 | Stereo routing. VocalMixV3 в Фазе 6 |
| `src/audio/core/MicrophoneManager.ts` | ~100 | Микрофон. MicrophoneV3 в Фазе 6 |
| `src/audio/core/audioContext.ts` | 28 | AudioContext singleton |
| `src/services/track.orchestrator.ts` | 592 | 21-step load pipeline. Будет заменён Saga pattern |
| `js/*.js` (5 файлов) | ~1,000 | Legacy boundary shells |

### 🔄 Bridges (3 осталось — не frozen)

| Файл | Статус | Примечание |
|------|:------:|------------|
| `src/blocks/bridge/blockEditor.service.ts` | 🟢 | ex-bridge → service, 5 monkey-patches |
| `src/Rehearsal/bridge/rehearsal-trigger.bridge.ts` | ❄️ | До V3 AudioContext |
| `src/bridges/live-guard.ts` | 🟢 | Security guard, не bridge |

**22/22 bridges RETIRED** — все frozen bridges.
**1 переклассифицирован:** trigger.bridge → trigger-visual.service 🟢
**2 осталось на диске:** stem-reactive.bridge (❄️, в процессе retire), rehearsal-trigger.bridge (❄️, до V3 AudioContext)

### 🟢 Не frozen (можно менять)

| Область | Файлы |
|:--------|-------|
| EventBus | `src/foundation/event-bus/*` |
| Central Bridge | `src/foundation/reactions/*` |
| initRegistry | `src/foundation/registry/*` |
| EngineV3 | `src/audio/engine-v3/*` |
| Stores | `src/stores/*` (~44 stores) |
| Components | `src/components/*`, `src/catalog/*` |

## Статус по цехам

| Цех | Frozen | Не frozen | % |
|:---:|:------:|:---------:|:-:|
| AUDIO 🎧 | AudioEngineV2, patchV1 | engine-v3/ (11 модулей) | 30% |
| SYNC ⏱ | 7 bridges | sync/*, triggers/*, blocks/* | 10% |
| DATA 📦 | track.orchestrator | idb.service, upload.service | 5% |
| NETWORK 🌐 | — | Все workers | 0% |
| AI 🤖 | — | Все billy-модули | 0% |
| AUTH 🔐 | — | Все auth модули | 0% |
| SURFACES 📺 | takes.bridge | Все surface-компоненты | 5% |
| FOUNDATION 🏗️ | — | EventBus, Central Bridge, Registry | 0% |

## Принцип работы с frozen

```
1. НЕ ПРАВИТЬ frozen файлы — никогда
2. ЧИТАТЬ через V2Adapter (единственный bridge к V2)
3. СТРОИТЬ NEW параллельно — Central Bridge, EventBus, EngineV3
4. RETIRE когда новое полностью заменяет старое
5. УДАЛИТЬ frozen когда grep показывает 0 использований
```
