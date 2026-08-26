# 🌊 MICRO-PACK-WAVE2 · delegateSync re-point · handoff (design)
> Источник: FINAL-ROADMAP-draft.md §2 Этап 3 Волна 2 (001, вериф. 002/009). Применяет: Hub(007) post-M3-GO. Frozen: НЕ трогать.
> Якоря: канон 306/770; V2Interceptor-wrap НЕ сносить, пока жив хоть один из 13 caller; после пака — Frozen-guard GREEN.

## ЦЕЛЬ
Перенаправить `delegateSync` с V2-поверхности на V3 (leaves-first). 13 caller-файлов (инвентарь Волн 2 = 13, Д-5). Пока жив хоть один caller → V2Interceptor-wrap НЕ удалять (сохраняем совместимость до последнего потребителя).

## ПРАВИТЬ (SAFE-файлы, 13 caller)
- 13 caller-файлов delegateSync (точный список снять grep'ом `delegateSync` в src на момент исполнения; Д-5 координата birth-счётчика App.tsx:97/:99).
- Каждый caller: заменить V2-delegateSync вызов на V3-эквивалент (engine-v3 surface) без изменения сигнатуры/поведения наружу.
- V2Interceptor-wrap: помечать `@deprecated`, оставить до Волны 4 (после смерти последнего caller).

## НЕ ТРОГАТЬ (Frozen)
Все frozen-файлы; `track.orchestrator.ts` режется в Волне 4, не здесь.

## ГЕЙТ ВОЛНЫ
1. канон-гейт 306/770 + PARITY PASS.
2. boot-smoke CDP V1/V5.
3. SHA256-инвентарь frozen ДО/ПОСЛЕ идентичен.
4. ⛔-отчёт Ц3.
5. `grep -rn "delegateSync" src` → все оставшиеся вызовы указывают на V3-surface (0 на V2-interceptor-wrap, кроме осознанного deprecated).

## ТЕСТЫ
- delegateSync на V3-surface: интегра-смоук (синк state доезжает до V3).
- Регресс: 13 caller не падают (зеркало потребителей из 002).
- Frozen-guard: 0 новых.

## СТАТУС
Дизайн готов. Применение — post-M3-GO (R6). До GO — подготовка.
