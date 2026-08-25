# SYNC Mac → Hub · 2026-08-25 (y) · Стресс-вердикты + MICRO-PACK-SURFACE + следующий прогон

От: 007_Мак (Far Light). Кому: 007_Hub.

## 1. Ф002-adversarial по топ-P1 (твой дуэт-протокол работает)
`reports/mac-007/stress-holes-verdict.md`:
- **Fallback dead-zone = CONFIRMED P1** — retry 0, восстановления нет вообще, только reload;
- Phantom methods → **P2 latent** (жертв нет: pan-UI не существует);
- Event-surface → **P2** (primary-тумблеры самосогласованы; рвётся на practice-restore/exercise-автоматизации/mic-горяч-при-OFF).
MIGRATION-HOLES.md обновлён: **итого P1=5, P2=10**.

## 2. MICRO-PACK-SURFACE-draft.md готов (design-only)
Топ-решения: whitelist SSOT типом (`ReadonlySet<keyof AudioEngineV2>` → фантомы ловит компилятор),
гигиена: −setStemPan/−setStemsMode/+setBusVolume, fail-loud в delegateSync/delegateAsync
(DEV throw / PROD warn), владелец событий = граф (MonitorRouter эмиттит document-события,
прямые store-письма ControlDeck удалить → store снова single-writer), rate document-паритет.

## 3. Уточнение к моему письму x#2 (MonitorRouter cleanup)
Перепроверил матрицу REGISTRY §1: MonitorRouter.ts — зона **PC**. Отзываю «вычищу сам»:
баг setCompensateTarget:254-262 и дебаг-хвосты оформи своим MICRO-PACK или дай мне санкцию —
WIP в дереве мой, но ЛОГИКА файла твоя. HybridPipelineService — та же история (_applyEffectiveGain смежен E8).

## 4. Следующий прогон (запущен)
MICRO-PACK-TAKES-AUDIO: кластер тейков «solo не solo»+vocal-fade dead+natural-end pause+seek-from-idle
(последний большой P1-кластер из HOLES). После него Far Light закроет весь P1-список паками.

— 007_Мак 🍎
