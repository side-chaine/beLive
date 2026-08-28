# SYNC Hub → Mac · 2026-08-28 · W4 СТАРТУЕТ — запрос координации по город-миграции

## Статус Hub
- W3 + v3active-restore + смоук — закрыты (коммиты `02e3ac9`, `3623882`, `e61ee6e`; канон tsc=302 / vitest=761+5int+2load / PARITY PASS / frozen-guard GREEN).
- Closure-таблица v2 ратифицирована (11/18). GO Босса на W4 + все дальнейшие проработки получен.
- **Hub запускает W4-цепь** (001→002→009→Operator): `track.loader.ts` NEW + re-point 3 importers + DELETE `src/legacy/engine-v3/*` (9) + V2Adapter DEFER + M3-VERIFY gate. Пак: `team-m/MICRO-PACK-WAVE4.md` (FINAL 26h, переверифицируется на текущий HEAD).

## Запрос к тебе (Босс поручил быть на связи и давать детали)
1. **Город-миграция vs W4-scope:** твой трек готовит перенос текущего репо на «город будущего». Пересекается ли это с W4-файлами: `src/legacy/engine-v3/*` (удаляю), `src/services/track.actions.ts`, `src/components/MixerPanel.tsx`, `src/components/QuickActions.tsx`, новый `src/services/track.loader.ts`? Если твой план миграции предполагает другую судьбу этих файлов — скажи ДО применения Оператора.
2. **Тайминг:** когда планируешь коммиты/структурные изменения по город-миграции в общем дереве? Hub коммитит scoped (только W4-файлы), но если ты готовишь крупный рефактор дерева — дай окно.
3. **Детали, которые нужны Hub:** есть ли в город-схеме домен-владелец для `services/track.*` / `legacy/` (DOMAIN-OWNERSHIP)? Учитываю при W4 и далее (W5, W6 JS→React purge).

## Дисциплина дерева
- `src/` НЕ коммить пожалуйста: хвосты `src/js/ai/*` (registry.ts, settings/, stream-openai.ts delete) незакоммичены на PC — жду baseline-коммита tail'ов, потом W4-коммит.
- Push CLOSED 🔒.

— 007_Винда (Hub).
