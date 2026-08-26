# 🌊 MICRO-PACK-WAVE4 · orchestrator/bridges/legacy · handoff (design)
> Источник: FINAL-ROADMAP-draft.md §2 Этап 3 Волна 4 (001, вериф. 002/009). Применяет: Hub(007) post-M3-GO. Frozen: НЕ трогать (читаем/переносим, не правим тело).
> Якоря: канон 306/770; V2Adapter умирает ЗДЕСЬ (последний вызыватель умер в Волне 2, Д-3); live-guard переносится осознанно; после пака — Frozen-guard GREEN (BAC-101..102 из allowlist уходят).

## ЦЕЛЬ
Разорвать последние safe→frozen связи (leaves-first): re-point 6 потребителей `track.actions.ts:7`; дин-импорты `MixerPanel.tsx:180`/`QuickActions.tsx:214`; `track.orchestrator.ts`; `bridges/*` (live-guard переносится осознанно); `src/audio/engine-v3/legacy/*` + `V2Adapter.ts` (умер здесь).

## ПРАВИТЬ (SAFE-файлы)
- 6 потребителей `track.actions.ts:7` → re-point на V3 (engine-v3 surface), убрать импорт orchestrator.
- `MixerPanel.tsx:180` + `QuickActions.tsx:214` dynamic import `track.orchestrator` → удалить/заменить на V3.
- `track.actions.ts` — перестаёт звать orchestrator (но сам orchestrator frozen НЕ правим).
- `bridges/*` (кроме live-guard): dead-code под замком — зачистить НЕЛЬЗЯ (FROZEN-БЛОК), оставить/пометить; live-guard перенести осознанно (НЕ в frozen).
- `src/audio/engine-v3/legacy/*` + `V2Adapter.ts` — удалить (последний вызыватель умер в Волне 2, Д-3).

## НЕ ТРОГАТЬ (Frozen)
`track.orchestrator.ts` (тело), `patchV1.ts`, `AudioEngineV2.ts`, `bridges/*` (как frozen-блок) — read-only.
**КРИТИЧНО:** никаких правок внутри frozen. Frozen-guard не должен показать ИЗМЕНЕНИЯ в frozen (SHA256 инвентарь идентичен).

## ГЕЙТ ВОЛНЫ
1. канон-гейт 306/770 + PARITY PASS.
2. boot-smoke CDP V1/V5.
3. SHA256-инвентарь frozen ДО/ПОСЛЕ идентичен (frozen не тронут).
4. ⛔-отчёт Ц3.
5. `grep -rnE "(import|from).*(track\.orchestrator|patchV1)" src` среди SAFE → 0 (frozen сами не считаются).
6. V2Adapter.ts удалён; `grep -rn "V2Adapter" src` → 0.

## ТЕСТЫ
- 6 потребителей + MixerPanel/QuickActions работают на V3 surface (интегра-смоук).
- Frozen-guard: BAC-101/102 уходят из allowlist-нарушений (файлы больше не зовут frozen) — скрипт обновить allowlist после волны.
- Регресс: ear/stem не сломаны.

## СТАТУС
Дизайн готов. Применение — post-M3-GO (R6). До GO — подготовка.
