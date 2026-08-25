# E1 PREDICATE INVENTORY · read-only · 2026-08-25 · агент: explore

**Цель:** E1 canonization (plan §1 E1, M3-GO step 5). Предикат-алиасы: `__v3Active`, `isV3Active`, `isV3Master`.

## 1. WRITER SITES (production)
| # | Site | Function | Writes |
|---|------|----------|--------|
| W1 | `src/main.tsx:132` | `bootAether()` (:88) | init `= false` |
| W2 | `src/main.tsx:150` | `window.__setV3Active` (:148–151) | `= active`; + module-local `_v3Active` (:149) |

Sole driver of W2: `src/audio/engine-v3/integration/V3DataInterceptor.ts` — `:68` `__setV3Active?.(false)`, `:152` `__setV3Active(true)` (Zombie Kill Switch), `:169` `__setV3Active(false)` (rollback).
Alias writers: `isV3Active` — **0 writers** (getter `TransportV3.ts:98` return `_pipelineController!==null`); `isV3Master` — **0 writers** (pure fn `stem-engine-sync.ts:21-25`). Non-prod writers: test fixtures only (BusFader18.test.ts, stem-engine-sync.test.ts).

## 2. READER SITES (28 direct window-flag reads в 16 файлах)
- `main.tsx:279` (H4.1 mini-guard :271–295), `useKeyboardShortcuts.ts:46/:58/:81/:89`, `loop-events.ts:27/:52/:92`, `audio-events.ts:76/:112`, `position-sync.ts:45`, `trigger-visual.service.ts:55`, `TransportBar.tsx:41`, `WagonTrain.tsx:107/:132`, `WaveformCanvas.tsx:440`, `MixerPanel.tsx:149`, `ControlDeck.tsx:63/:65/:195/:216`, `takes.time.ts:12/:25/:34/:42`, `RehearsalLyrics.tsx:494`, `TakesPanel.tsx:676`, `TakesControlStrip.tsx:312` (DEV telemetry).
- Alias reads: `isV3Master` ×3 internal (`stem-engine-sync.ts:24/:74/:122/:227`); `isV3Active` getter has **0 consumers**.

## 3. Mapping plan §1 inventory → predicate
| Plan item | Resolved | Predicate | Note |
|---|---|---|---|
| loop-events ×3 | loop-events.ts:27/:52/:92 | `__v3Active` | exact |
| 389-G1..G4 | anchor НЕ резолвится в текущем дереве (файл:389 нет); кандидаты: keyboard :46/:58/:81/:89 | `__v3Active` | flagged |
| A-G5/G6 | audio-events.ts:76/:112 (audio-events wrapper, 2 сайта) | `__v3Active` | best-candidate |
| MixerPanel | MixerPanel.tsx:149 | `__v3Active` | exact |
| 8+ readers «:373» | anchor НЕ резолвится; счёт подтверждён (28 readers) | `__v3Active` | count OK, line-anchor flagged |
| +1 сайт от C28 | C28 micro-pack НЕ содержит predicate; кандидат TakesControlStrip.tsx:312 | `__v3Active` | unverified |

`isV3Master`/`isV3Active` НЕ входять в plan-inventory семейства.

## 4. Columns «какой режим / умирает на M5»
- Dual-condition guards (keyboard, TransportBar, WagonTrain, trigger-visual, WaveformCanvas, loop/position/stem-sync) — ОБА режима; V2-arm исчезает на M3.
- Time/rate readers (takes.time, TakesPanel, RehearsalLyrics, TakesControlStrip:312) — V3-primary + V2-cache fallback; V2-arm конец M3.
- audio-events :76/:112 — guard осмыслен только пока V2-routing жив → цель истекает M3.
- MixerPanel:149, ControlDeck :63+ — оба режима, legacy-arm M3.
- main.tsx:279 (H4.1) — судьба связана с B-slice revival + H4.1 extension (неопр. из кода).
- delegateSync interceptor reads (:136/:140) — V2-recovery-class channel, истекает с удалением V2 (M3).
- TransportV3.isV3Active getter (:98) — 0 consumers; `isV3Master` — коллапсирует в константу после удаления V2 (M3).

## 5. Canonical writer — ВЕРИФИЦИРОВАН
**`main.tsx:150` (внутри `window.__setV3Active`) — единственный production writer.** Все 3 перехода (true/false/rollback) только через него, драйвер — `V3DataInterceptor.loadTrack`. Конфликтов/дубль-writer НЕТ. 13 test-fixture writes в 2 файлах (обходят `__setV3Active`, не обновляют `_v3Active` twin) — benign.

## 6. Interaction с delegateSync guard (:131–151) и H4.1 (:266–295)
1. Dual source of truth: interceptor читает `_v3Active` (module-local), все остальные — `window.__v3Active`; синхронизированы только в `__setV3Active` closure. Canon-writer должен сохранить пару.
2. Interceptor блокирует только `'play'/'seekTo'/'setCurrentTime'`; volume проходят. Cage достигает legacy engine через тот же `delegateSync` chokepoint → управляется интерцептором, не H4.1.
3. H4.1 враппит 4 метода на `window.audioEngine` (:290–293) на window-flag, premise «facade no-op in v3» (B-SLICE-AUDIT: после revival ломается, глотает легит UI-записи; BusFader18:363–505 поплывут).
4. E1 coupling: любое продление гарда «must use E1-canonicalized writer»; план §4(b) — продлить main.tsx:132–142, НЕ дублировать в V2Adapter. B-slice guard + «+1 сайт C28» → один и тот же canon-таргет.
5. Frozen: потребляет predicate только через published window flag; dist bundle несёт идентичный single-writer shape. Frozen-файлы не открывались.

**Unresolved для Ц3:** литералы `389-G1..G4` и `:373` не резолвятся в текущее дерево; C28-attribution «+1 сайт» не подтверждается C28 micro-pack.

— explore · read-only
