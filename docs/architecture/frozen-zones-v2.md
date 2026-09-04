# Frozen Zones v2 — Карта неприкасаемых зон
> 🔓 Эра замка ЗАВЕРШЕНА (03.09, D-3): `frozen-manifest.json` + `check-frozen.mjs` упразднены; охрану несут ливнесс-гейты G-1/G-2/G-4 (`verify:reach=121`, `verify:ci`). Период замка 01-03.09: 5 волн, −7 187 строк, V2 = 0 живых строк.
**Вся frozen-зона снесена** (Волны A: patchV1 · B: track.orchestrator · C: 15 мостов · D-1: AudioEngineV2-созвездие · D-2: live-guard/liveMode · D-3: замок). Живой транспорт-слой — V3 (см. `audio-engine.md`). Эра-архив: git-история.
*Дата:* 2026-07-17 (обновлён после bridge retirement wave)
*Статус:* 🔓 ЗАВЕРШЕНО (замок упразднён 03.09) — тело ниже: исторический срез эпохи

---

## Классификация

### ❄️ Permanent frozen (никогда не трогать)

Эти файлы — ядро аудио-движка. Работают через V2Adapter (read-only).

| Файл | Строк | Причина |
|------|:-----:|---------|
| `src/audio/core/AudioEngineV2.ts` | 2,178 | Транспортный монолит. Чинить нельзя — EngineV3 заменит |
| `src/audio/compat/patchV1.ts` | 162 | ❄️→🗑 **удалён 01.09, Волна A** (де-фриз GO Никиты 12:00; мёртвый экспорт patchV1WithV2; OVERRIDE). SHA — в frozen-manifest.json истории |
| `src/audio/core/StemPlayer.ts` | ~200 | Загрузка стемов. V3 StemPlayerV3 готов |
| `src/audio/core/AudioLoader.ts` | ~150 | Декодинг аудио |
| `src/audio/core/VocalMix.ts` | ~150 | Stereo routing. VocalMixV3 в Фазе 6 |
| `src/audio/core/MicrophoneManager.ts` | ~100 | Микрофон. MicrophoneV3 в Фазе 6 |
| `src/audio/core/audioContext.ts` | 28 | AudioContext singleton |
| `src/services/track.orchestrator.ts` — 🗑 удалён 01.09, Волна B (0 импортёров; 1:1-копия живёт track.loader.ts; OVERRIDE). SHA — история манифеста |
| `js/*.js` (5 файлов) | ~1,000 | Legacy boundary shells |

### 🔄 Bridges-прочие (операционный канон src/bridges/ = 1 файл: live-guard (guard-зона; 15 graveyard-мостов снесены Волной C 01.09, graveyard пуст) — см. 🔒-строку выше)

> ⚠️ Ниже — мосты ДРУГИХ зон (blockEditor/Rehearsal/stem-reactive), НЕ каталог src/bridges/. Каталог src/bridges/ полностью в манифесте (15 graveyard-мостов снесены Волной C; graveyard пуст).

| Файл | Статус | Примечание |
|------|:------:|------------|
| `src/blocks/bridge/blockEditor.service.ts` | 🟢 | ex-bridge → service, 5 monkey-patches |
| `src/Rehearsal/bridge/rehearsal-trigger.bridge.ts` | ❄️ | До V3 AudioContext |
| `src/bridges/live-guard.ts` | 🟢 | Security guard, не bridge |

**все 15 graveyard-мостов снесены Волной C (01.09); остался live-guard (guard)**

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
| AUDIO 🎧 | AudioEngineV2 (+patchV1 до 01.09) | engine-v3/ (11 модулей) | 30% |
| SYNC ⏱ | 7 bridges | sync/*, triggers/*, blocks/* | 10% |
| DATA 📦 | track.orchestrator (снесён Волной B; приёмщик — track.loader.ts) | idb.service, upload.service | 5% |
| NETWORK 🌐 | — | Все workers | 0% |
| AI 🤖 | — | Все billy-модули | 0% |
| AUTH 🔐 | — | Все auth модули | 0% |
| SURFACES 📺 | takes.bridge | Все surface-компоненты | 5% |
| FOUNDATION 🏗️ | — | EventBus, Central Bridge, Registry | 0% |

## Принцип работы с frozen

```
1. НЕ ПРАВИТЬ frozen файлы — никогда
2. ЧИТАТЬ через V2Adapter (мост V2↔V3)
3. СТРОИТЬ NEW параллельно — Central Bridge, EventBus, EngineV3
4. RETIRE когда новое полностью заменяет старое
5. УДАЛИТЬ frozen когда grep показывает 0 использований
```
