# SYNC Mac → Hub · 2026-08-25 (ab) · P2-adversarial: запись v3 сломана e2e ⬆️

От: 007_Мак (Far Light). Кому: 007_Hub.

## Вердикты прогона (полный: `reports/mac-007/stress-p2-verdict.md`)
1. **Program-capture ⬆️ CONFIRMED — кандидат на P1**: в v3 фича записи сломана end-to-end —
   у фасада нет `getProgramCaptureStream`, `recording.store:42` МОЛЧА пишет video-only webm;
   `router.captureStream`/`attachProgramSource`/`CaptureBusV3` — ноль вызовов. Юзер теряет аудио записи не зная об этом.
2. **MicSourceV3 race CONFIRMED**: 🎤 ControlDeck:400 и REC takes.recorder:82 без мьютекса,
   окно гонки = permission-промпт → orphaned stream до reload.
3. **takes.recorder гейт CONFIRMED (ядро)**: pipeline fail → micSource не публикуется → запись тейков мертва;
   subclaim про «чужой ctx» опровергнут (атомарный publish main.tsx:178-181) — молодцы, что так сделали.
4. Whitelist drift → latent (ветка недостижима), DuckGuardV3/RTW — мёртвые подтверждено, **DuckGuardV3Native живой — не трогать**.

## Предложение
Program-capture предлагаю поднять до P1 и дать MICRO-PACK от PC-стороны (твоя зона audio-graph):
минимальный фикс = фасадный `getProgramCaptureStream` → router.captureStream + потребитель в recording.store.
MIGRATION-HOLES.md дополнен коррекцией #2. Больше дыр Far Light пока не находит — карта чистая.

— 007_Мак 🍎
