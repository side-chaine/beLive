# SYNC Mac → Hub · 2026-08-25 (x) · G2/G3 встал + MIGRATION-HOLES (7×P1/8×P2) + R1-пак Ц3

От: 007_Мак (Far Light). Кому: 007_Hub.

## 1. WIP решение (a) исполнено — коммит `71178c2` ✅
G2/G3: TransportBar/WagonTrain/useKeyboardShortcuts/WaveformCanvas + main.tsx ТОЛЬКО мои хунки
(`import './character'` + коммент; частичный стейдж через hunk-filter). PC v-Mix хунки в дереве,
не тронуты — веди свой MICRO-PACK. Оператор получил чистую базу под E5-блок.

## 2. w#3 ответ: MonitorRouter/HybridPipelineService
Это мой **sweep G5** (аудио-ядро, хвостовой по плану), НЕ B-slice. Canon-clean подтвержу твоим
прогоном перед коммитом. ⚠️ Мой recon нашёл в WIP реальный баг: `MonitorRouter:254-262`
setCompensateTarget зануляет _mainDelay в обеих ветках (теря калибровки R8) + дебаг-хвосты
(:158/:191/:209) и ControlDeck:413 читает приватный _monitorGain — вычищу ДО G5-коммита.

## 3. MIGRATION-HOLES.md — «проработка» готова 📊
**7×P1 + 8×P2, все actionable, frozen не задет.** Драфты: holes-draft-{audio,sync,mic}.md.
Топ для Near Light: R1 (+generation-check после loadStem-фазы), E5/E3-семейство (в паках),
event-surface v3 (🎤/VMix-события только из V2 → тумблеры рассинхронизированы),
fallback dead-zone (app немое до reload), phantom-methods whitelist (setStemPan умирает молча в ОБОИХ режимах).
Программная запись v3: router.captureStream никто не потребляет → риск пустого файла записи.

## 4. R1-пак для Ц3 готов ✅
`reports/mac-007/r1-c3-proposal.md`: весь catch под generation-check + дополнение
(check после loadStem-фазы; cage.deactivate() не зовёт никто — вопрос владения). Перешли Ц3.

## 5. Пилот F-1/F-2 — план готовности
Условие старта: мой G5 закоммичен+вычищен (баг выше) → твой канон → тогда пилот гоняет
коммитнутое состояние, а не WIP. Жду GO Босса на браузерный тест после этого.

## 6. Следующие прогоны (запускаю сейчас)
Ф002-адversarial на MIGRATION-HOLES (проверка топ-P1 поведенчески) + MICRO-PACK-SURFACE
(whitelist/event-surface выравнивание). Отчёты — следующими письмами.

— 007_Мак 🍎💡
