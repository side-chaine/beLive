# WAVEC-001 · КРУГ-3 · ФИНАЛЬНАЯ СПЕКА v2 ВОЛНЫ C (001)

**001 = CEO-Архитектор · финал · 2026-09-02 · HEAD 59b2709 · канон: tsc=290 (8 в мостах) · vitest 808/69 (5 тестов в мостах) · frozen 17/17.**

## 0. ИНТЕГРАЦИЯ (все удары 002 приняты, спорных нет)
У-1 allowlist-7 внутрь манифеста → PASS на HEAD достижим · У-2 takes-запись (retired-before-C, inBoot) · У-3 шапка mode-switch-events в #15 · У-4 сигнал-правило «≥1 из 4» · У-5 main.tsx:63 → манифест · У-6 describe в #15 · усиления: inBoot-поле, allowlist/knownGaps в манифесте, Δ=retiredAt:sha-аудит.

## 1. КОММИТ #0 (PREP, без сносов; гейт PASS на HEAD до #1)

> **⚠️ ПОПРАВКА 009-СУДА (внесена 007, вердикт РЕШЕНО С УСЛОВИЯМИ):** манифест = **20 записей, не 18** (условие-1) и **allowlist = 7 ключей + practice:*, не «8»** (условие-2). Детали: `WAVEC-009-VERDICT-2026-09-02.md`. Спека ниже скорректирована.

**bridge-manifest.json (корень), 20 записей:** 15 graveyard {id, bridge, wrapper, status: dual-fire, inBoot, retiredAt: null, testsRemoved[], knownGaps[], notes} + live-guard {live, inBoot:true} + rehearsal-trigger {live, вне C} + takes {retired-before-C, wrapper: takes-events, inBoot:true} + **exercise-events {live, inBoot:true}** (main.tsx:18/:61 — живая обёртка в буте, открытие Суда) + **block-editor-events {orphaned-wrapper}** (wrappers/index.ts:16, 0 init-вызовов — класс mode-switch-events, открытие Суда). residueAllowlist внутри: **7 ключей (track-saved, catalog-close, save-track-markers, loop-set, loopcompleted, block-scenes-loaded, camera-permission-resolved) + prefix practice:*** — sync-editor-closed НЕ включать (его нет в LEGACY_EVENT_MAP, facade.ts:31 — «8» = мёртвая запись).
**verify-bridge-parity.ts v2:** эталон = манифест (glob-скан умирает); сигнал-правило = eventBus.subscribe | addEventListener | scheduler.register | knownGap:true (plate — единственный knownGap:true); allowlist из манифеста (хардкод :23 умирает); retired-запись → мост отсутствует + обёртка имеет сигнал (анти-вакуум).
**main.tsx:63:** «10 GREEN» → «wrapper-init registry · эталон: bridge-manifest.json».
Гейт #0: tsc 290 · vitest 808/69 · frozen 17/17 · parity-v2 PASS на HEAD.

## 2. ПЛАН 15 СНОСОВ (порядок audio-пилот → SAFE-9 → tsc-хвост → mode-switch)
| # | мост | tsc после | vitest после | тест-файл | обёртка | knownGaps |
|---|---|---|---|---|---|---|
| 1 | audio | 290 | 806/68 | audio.bridge.test.ts | audio-events | — |
| 2 | blocks | 290 | 806/68 | — | blocks-events | — |
| 3 | loop | 290 | 806/68 | — | loop-events | — |
| 4 | mode | 290 | 806/68 | — | mode-events | — |
| 5 | time-sync | 290 | 806/68 | — | position-sync | — |
| 6 | cover-theme | 290 | 806/68 | — | cover-events | TODO-стабы |
| 7 | plate | 290 | 806/68 | — | plate-events | IDB-TODO, knownGap:true |
| 8 | markers | 290 | 806/68 | — | markers-events | нет real-time subscribe |
| 9 | textStyle | 290 | 806/68 | — | text-style-events | нет applyFont |
| 10 | track | 290 | 806/68 | — | track-events | object-URL coverArt |
| 11 | audio-reactive | 289 | 806/68 | — | audio-reactive | wrapper-DIFF обязателен |
| 12 | lyrics | 288 | 806/68 | — | lyrics-events | — |
| 13 | stem-reactive | 287 | 806/68 | — | stem-reactive | сигнал = scheduler+DOM |
| 14 | monitor | 286 | 806/68 | — | monitor-events | persist монтировал только мост (:93) |
| 15 | mode-switch | 282 | 803/67 | mode-switch.bridge.test.ts | mode-switch-events (orphaned) | шапка+describe+конвой |

Каждый снос = атомарная четвёрка (мост + тест-файл [если есть] + минус frozen-graveyard-SHA + статус-флип манифеста retiredAt:sha).

## 3. КОММИТ #15 (ФИНАЛ, ОДНИМ коммитом с конвоем)
Снос mode-switch + шапка mode-switch-events.ts:7-8 («wrapper = dead code, кандидат retire Волной D») + wrappers.smoke.test.ts describe :8/:17/:25 → -events-имена + DOC-конвой v2.1 (пост-урок B+).

## 4. СТОП-ГЕЙТЫ
По коммиту: атомарная четвёрка · tsc/vitest = бегущим Δ · verify:frozen PASS (graveyard −1) · parity-v2 PASS · 0 новых внешних импортов · 0 импортёров снесённого моста (grep до сноса).
Финал волны: tsc 282 · vitest 803/67 · frozen guard2/graveyard0 · PARITY · src/bridges/ = live-guard only · манифест полон.

## 5. RESIDUE (вне Волны C)
monitor.state.ts (транзитивный труп после #14) · rehearsal-trigger-writer.ts (ребус 301) · mode-switch-events.ts (кандидат retire D) · 7 residue-ключей LEGACY_EVENT_MAP + camera (facade.ts:51) — чистка следующей волной, facade в C НЕ трогать.

## 6. РИСКИ
Паритет-v2 = единая точка отказа (митигация: PASS на HEAD в #0 + пилот #1) · monitor #14 re-verify 0 внешних persist-маунтов перед сносом · замок: каждый коммит = ровно graveyard−1.

— 001 · круг-3 финал · для 009-Суда · АЛЬТЕРНАТИВА-Y (батч) отвергнута: атомарный след + прецедент dual-fire
