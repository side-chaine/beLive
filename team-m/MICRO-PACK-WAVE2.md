# 🌊 MICRO-PACK-WAVE2 · delegateSync + V2Adapter re-point · handoff (design, FIXED per 009)
> Источник: FINAL-ROADMAP-draft.md §2 + вериф. 009 (26h). Применяет: Hub(007) post-M3-GO. Frozen: НЕ трогать.
> Якоря: канон 306/772; V2Interceptor-wrap + V2Adapter НЕ удалять, пока жив хоть один caller; Frozen-guard GREEN.

## ЦЕЛЬ
Re-point ВСЕХ потребителей V2-поверхности на V3 (leaves-first). 009 нашёл: `delegateSync` в **21** файле, `V2Adapter` импортируют **17** файлов вне engine-v3 (не только delegateSync). Оба класса ре-поинтим здесь; удаляем V2Adapter только в W4 (после grep→0).

## ПРАВИТЬ (SAFE)
- **delegateSync** (21 caller, точный список grep'ом): заменить V2-delegateSync на V3-surface (сигнатура/поведение снаружи не меняются).
- **V2Adapter** (26 импортёров (факт: grep -rln "V2Adapter" src = 26) вне engine-v3, известные: `main.tsx:129–136`, `MonitorRouter.ts:266`, `DuckGuardV3.ts:27`, `foundation/*`, `components/*`, `hooks/*`, `takes.time`, `legacy/*`, `WaveformCanvas`, …): ре-поинт `V2Adapter.getInstance()/getV2Engine()` на V3-эквивалент. Файл `V2Adapter.ts` НЕ удалять (удаление — в W4 после `grep -rln "V2Adapter" src` → 0).
- `V2Interceptor-wrap`: пометить `@deprecated`, оставить до последнего caller.

## НЕ ТРОГАТЬ (Frozen)
`track.orchestrator.ts` (режется в W4, не здесь). Все frozen read-only.

## ГЕЙТ
1. канон 306/772 + PARITY PASS.
2. boot-smoke CDP V1/V5.
3. SHA256 frozen ДО/ПОСЛЕ идентичен.
4. ⛔-отчёт Ц3.
5. `grep -rln "delegateSync" src` → все вызовы на V3-surface (0 на V2-interceptor-wrap, кроме deprecated).
6. `grep -rln "V2Adapter" src` → только `src/audio/engine-v3/V2Adapter.ts` (сам файл), импортёров 0 (готов к удалению в W4).

## ТЕСТЫ
- delegateSync/V2Adapter на V3: интегра-смоук (state доезжает).
- Регресс: 21+17 caller не падают (зеркало потребителей из 009).
- Frozen-guard: 0 новых.

## СТАТУС
Дизайн (FIXED). Применение — post-M3-GO (R6).
