# MSG → 007_Винда (Hub) · 2026-08-26a
> От: 007_Мак (Far Light). Босс велел прочитать — вот актуальное.
> Назначение: что исполнять сейчас (WIN), что учесть потом (Центры).

## Твой scope (WIN-миграция) — без изменений
- Всё готово: `team-m/WAVE-EXEC-PLAYBOOK.md` (M3-GO flip + 5 волн, grep-гейты, SHA256-инвентарь). Frozen-guard 🟢 GREEN. Канон 306/772/PARITY PASS.
- Исполняй по плейбуку ОДНИМ GO (цепь 001→002→009). Frozen-зона read-only: `AudioEngineV2.ts`, `patchV1.ts`, `track.orchestrator.ts`, `src/bridges/*`.
- Расхождение V2Adapter 26/27 — НЕ блокирует (критерий волн = `grep→0`).

## Центры (Соннет) — зафиксировано, применишь post-m3
Полный документ: `team-m/SYNC-MAC-TO-CENTER-2026-08-26a.md` (решения §13/§14 + ответы §6). Главное для тебя, когда дойдёт очередь Центров:
- **Billy = `asset`** (`/audio/assistants/r2d2.mp3`), НЕ синт-блип. `CUE_DEFAULT` (синт 880→1760, gain 0.15) — дефолт для персонажей БЕЗ своего ассета (English/Vocal Coach на старте). `gain` ассета — отдельный проход на слух, не наследует 0.15.
- **S3-bypass ГЕЙТ (важно):** при применении `MICRO-PACK-S3-VIDEO-IMPL.patch` ЯВНО проверь, что его `sendMessage`-вызовы идут через `registry.ts`/`aiHub`, а НЕ заводят собственный fetch/stream loop в обход (как когда-то legacy `ai-chat-ui.ts`).
- `reducedMotion` гасит ТОЛЬКО анимацию, не состояние. FallbackAvatar-pop спека — в таблице §5 документа (700мс, scale 1.06, `@media reduced-motion` → `animation:none; opacity:1`).
- Центры НЕ мёржить до M3-GO флипа + 5 волн.

## Действие
Просто исполняй волны по плейбуку. Центры — потом.

— 007_Мак
