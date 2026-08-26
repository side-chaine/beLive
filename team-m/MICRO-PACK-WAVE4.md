# 🌊 MICRO-PACK-WAVE4 · orchestrator re-point + legacy/V2Adapter delete · handoff (design, FIXED per 009)
> Источник: FINAL-ROADMAP-draft.md §2 + вериф. 009 (26h). Применяет: Hub(007) post-M3-GO. Frozen: НЕ трогать (читаем/не правим тело).
> Якоря: канон 306/770; V2Adapter удаляется ТОЛЬКО после grep→0 (W2 сделала ре-поинт); legacy-путь ИСПРАВЛЕН; live-guard НЕ перемещать (frozen, byte-identical).

## ЦЕЛЬ
Разорвать последние safe→frozen связи + удалить мёртвый legacy/V2Adapter (leaves-first).

## ПРАВИТЬ (SAFE)
- 6 потребителей `src/services/track.actions.ts:7` → re-point на V3 (engine-v3 surface), убрать импорт orchestrator.
- `src/components/MixerPanel.tsx:180` + `src/components/QuickActions.tsx:214` dyn-import `track.orchestrator` → удалить/заменить на V3.
- `src/services/track.actions.ts` — перестаёт звать orchestrator (frozen НЕ правим).
- **V2Adapter.ts** — удалить ТОЛЬКО если `grep -rln "V2Adapter" src` → 0 (W2 ре-поинтила 17 импортёров). Иначе СТОП (tsc 306 упадёт). Гейт W4 обязан проверять этот grep.
- **legacy (ИСПРАВЛЕН путь):** `src/legacy/engine-v3/*` (**8 файлов**, BAC-112) — удалить. НЕ `src/audio/engine-v3/legacy/*` (такой директории НЕТ).

## НЕ ТРОГАТЬ (Frozen, byte-identical)
`track.orchestrator.ts`, `patchV1.ts`, `AudioEngineV2.ts`, `src/bridges/**` (вкл. `live-guard`). **live-guard НЕ перемещать** — файл остаётся под `bridges/`, импорт в `main.tsx:6` легитимен (allowlist). Исключить live-guard из процедуры релокации.

## ГЕЙТ
1. канон 306/770 + PARITY PASS.
2. boot-smoke CDP V1/V5.
3. SHA256 frozen ДО/ПОСЛЕ идентичен (live-guard на месте → инвентарь совпадает).
4. ⛔-отчёт Ц3.
5. `grep -rlE "(import|from).*(track\.orchestrator|patchV1)" src` среди SAFE → 0.
6. `grep -rln "V2Adapter" src` → 0 (файл удалён); `src/legacy/engine-v3/*` удалён (8 файлов).

## ТЕСТЫ
- 6 потребителей + MixerPanel/QuickActions на V3 (интегра-смоук).
- V2Adapter удалён без tsc-падения (grep 0 доказан).
- Frozen-guard: BAC-101/102 уходят из allowlist (файлы больше не зовут frozen) → скрипт сузить allowlist после волны.

## СТАТУС
Дизайн (FIXED). Применение — post-M3-GO (R6).
