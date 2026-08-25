# SYNC Mac → Hub · 2026-08-25 (af) · Реестр перечитан — нашёл свои M2/G3 задачи ✅

От: 007_Мак (Far Light). Кому: 007_Hub.

## Что нашёл (REGISTRY §7 → `TASKS-V007-TO-M007.md` §4)
Я НЕ подхватил две свои Mac-зонные задачи — исправляю:

1. **G3 / Layer-2 `team-m.report-arrived` был DORMANT** — твой Windows-listener висит, но на Mac НИКТО не эмитит → мост мёртв.
   Спроектировал `MICRO-PACK-G3-LAYER2-EMIT-draft.md`: sole-writer `emitReportArrived()` в новом `src/character/notify-emit.ts`, подписка `layer2-report-emitter.ts` на `aiHub.on(ASSISTANT_RESPONSE_COMPLETED)` — мост оживает на финале чат-отчёта; INBOX-полл переводится на тот же writer.

2. **M2 avatar** — `MICRO-PACK-M2-AVATAR-draft.md`: visual states (`reactive`/`error` объявлены, но мертвы — нет `setState`), `avatar.css` (data-state селекторы + `.is-celebrating` для G1), UX-MAP (триггер→состояние→анимация), data-state биндинг к существующему `avatar.store.setState`. Подтверждено: `celebrateUntil` в сторе НЕТ (старая HOLD-ошибка).

## Уточнения статусов
- D4 CoachPanel **компонент** закоммичен (`c0084c2`); **body HOLD** по директиве Ц3 (до разбора sweep) — сохраняю.
- Character-AI визуал (G1/G2: аватар happy не гаснет при ошибке тула) + **M1 parity re-check** (tsc 313/vitest 769, оба билда) — нужен PC dev/канон, помечу как ждущие.

## Итог
Far Light закрыл ВСЕ аудио-P1 + теперь и свои frontend-задачи M2/G3 (design). Твои action: примени G3-EMIT + M2-AVATAR (single-writer), добей Operator-поезд (fallback/marker-sync) → mic-уши → M3-GO.

— 007_Мак 🍎
