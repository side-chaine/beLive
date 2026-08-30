# MICRO-PACK · ПАКЕТ C: СНОС МЁРТВОГО КОДА (dead-code) · 2026-08-30
**Автор:** 707 (независимая верификация + прогоны) · Стресс: 002 (прогон #1) · Фураж: DEAD-CODE-MANIFEST-301
**Статус:** ЧЕРНОВИК-ГОТОВ · ЖДЁТ 🔴 Никиты (пакет C в STEPS) · Исполняет Оператор (007) — ПОСЛЕ ARC-2e (диспатч 200 от 18:55)
**HEAD-SSOT на момент сборки:** `9b6bf83` · канон: tsc=293 🔴 · vitest=801 🟢 · PARITY PASS 🟢

## Двойная верификация (прогон #1, 15:28)
| Слой | Метод | Результат |
|---|---|---|
| 707 независимый | word-boundary grep по src (SSH, ПК) | **28/28 мёртвых подтверждено, 0 живых** |
| 002 стресс | 5 «особых случаев» | 3 ДЕРЖИТ + 2 ТРЕБУЕТ ПАТЧА (RecordingPanel, CatalogBillyChat) |

## Состав пакета C (для 🔴 Никиты)
1. **25 файлов — снос чистый** (двойная верификация 707+002, 0 импортёров): BackendState.ts, PitchModule.tsx, featureFlag.ts и остальные 22 из манифеста 301.
2. **RecordingPanel.tsx — ТРЕБУЕТ ПАТЧА:** сносить **парой с RecordingPanel.module.css** (мёртвая пара вне манифеста 301; единственный импортёр css — сам файл :2; функция записи закрыта дважды: PresenterDock.tsx:44-47 + stem-reactive.ts:43).
3. **CatalogBillyChat.tsx — отдельное 🔴:** НЕ дубль BillyChatModule (обёртка AiExpertPanel vs собственный чат с quick-questions/skill-registry); **единственное тело идеи 008 «Билли в каталоге»**. Kill = похоронить продукт-идею; shelved = каскадный снос 4 файлов (skill-registry.ts + BillyMessageRenderer.tsx + css, импортирует только он :4-5 — вне манифеста 301). Слово Никиты.
4. **pitch.store.ts — НЕ в пакете:** после сноса PitchModule+usePitch станет test-only → кандидат волны 2 (зафиксировано в open-seams кадастра).

## Порядок исполнения (Оператор 007, после ARC-2e и 🔴)
1. `git rm` 25 файлов манифеста (список: DEAD-CODE-MANIFEST-2026-08-30.md §1, минус RecordingPanel/CatalogBillyChat)
2. `git rm` RecordingPanel.tsx + RecordingPanel.module.css (пара)
3. Гейты: tsc=293 (0 дельты) · vitest=801 (0 NEW) · frozen-guard GREEN · PARITY PASS
4. CatalogBillyChat — отдельно по 🔴 (kill/shelved), вне этого пакета

## НЕЛЬЗЯ (002, зафиксировано)
- НЕ сносить CatalogBillyChat в общем пакете (идея 008 жива в доках — kill/shelved решает Никита)
- НЕ править frozen-зону (AudioEngineV2/patchV1/track.orchestrator/bridges/*)
- pitch.store.ts остаётся до волны 2
