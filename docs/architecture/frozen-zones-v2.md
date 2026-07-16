# Frozen Zones v2 — Карта неприкасаемых зон
*Описание:* 30 файлов, ~6,932 строк, 23% проекта — что frozen и почему.
*Дата:* 2026-07-16
*Статус:* ✅ АКТУАЛЬНО

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

### ❄️ Conditional frozen (можно retire по системе)

| Файл | Статус | Когда retire |
|------|:------:|:-------------|
| `src/bridges/audio.bridge.ts` | ❄️ | После Central Bridge + verification |
| `src/bridges/mode.bridge.ts` | ❄️ | Готов wrapper (mode-events.ts) |
| `src/bridges/loop.bridge.ts` | ❄️ | Готов wrapper (loop-events.ts) |
| `src/bridges/lyrics.bridge.ts` | ❄️ | Готов wrapper (lyrics-events.ts) |
| `src/bridges/markers.bridge.ts` | ❄️ | Готов wrapper (markers-events.ts) |
| `src/bridges/blocks.bridge.ts` | ❄️ | Готов wrapper (blocks-events.ts) |
| `src/bridges/trigger.bridge.ts` | ❄️ | Готов wrapper (trigger-events.ts) |
| `src/bridges/takes.bridge.ts` | ❄️ | Готов wrapper (takes-events.ts) |
| Остальные 13 bridges | ❄️ | По одному, как exercise (+1 уже сделан) |

### 🟢 Не frozen (можно менять)

| Область | Файлы |
|:--------|-------|
| EventBus | `src/foundation/event-bus/*` |
| Central Bridge | `src/foundation/reactions/*` |
| initRegistry | `src/foundation/registry/*` |
| EngineV3 | `src/audio/engine-v3/*` |
| Stores | `src/stores/*` (42 stores) |
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
