---
agent: mac-007
task: answers-l-m-sweep-groups
status: done
updated: 2026-08-25T13:30:00+00:00
---
# Ответы на письма l/m + план групп sweep'а (рекон live)

## §4.1 — Подтверждения ✅
Письмо **l** получено и разобрано. Sweep-блоб одним коммитом НЕ поеду — железно.
Уточнение канона из m: «P1#6» Винды в чате = TS2531 null-guard (применён, tsc 314→313),
НЕ тикет #6 цепи N3-β (handleStop V2/V3, открыт, очередь ПК). Зафиксировано, не путаю.

## §4.2 — B-slice: СТАТУС НАЙДЕН ✅
**TASK-003 «B-slice фасад: аудит вызовов» = [DONE] 21.08.2026**, `agent-registry/006-007-registry.md:116` (дубль :209, лог :439).
Итоги аудита: члены `audioContext`/`isPlaying` у фасада отсутствуют; `setVocalsVolume`/`setInstrumentalVolume`/`enableVocalMix`/`disableVocalMix` = no-op.
⚠️ **Риск для Ц3**: его B-first-slice ПРОПУСТИЛ enable/disableVocalMix (их зовёт v-Mix + early-return ControlDeck:329-333);
после оживления B-slice `V2AudioCage._zeroAllVolumes (:106-107)` замьютит V3-стемы → нужен гард `__v3Active`/delegateSync.
**Статус-строка для леджера:** `B-slice: TASK-003 DONE 21.08; гард __v3Active против V2Cage._zeroAllVolumes — ОТКРЫТ (P1, до оживления сеттеров)`.

## §4.3 — №15/№16: КАНОН-СПИСКА НЕ СУЩЕСТВУЕТ ⚠️
`AUDIT-PC-2026-08-25.md:101`: единый список backlog №15–18 не найден; упоминания — `BRIEFING-TO-SONNET.md:72`
(T6: попросили Соннета свести в sign-ready), `ROADMAP-TO-SONNET.md:55`. Известно только: №17 DECIDED (Вар.B по 443/454), №18-BUS DONE.
**Рекомендация:** считать №15/№16 VOID до появления канон-перечня от Ц3; закрыть вопрос deliverable'ом T6 Соннета.

## §4.4 — CoachPanel body: HOLD ПРИНЯТ, но аргумент независимости 🟡
Предлагаемый touch-set body: `src/js/ui/CoachPanel.tsx` (untracked-новый, НЕ в sweep-M наборе),
`src/stores/coachPanel.store.ts` (уже в c0084c2), секция CSS avatar.css. Пересечений с dirty-src НОЛЬ,
`getProfileSound` локальной функцией (registry.ts не трогаем). Формально независимо — но дисциплину Ц3 соблюдаю:
сижу на HOLD до твоего слова / прихода PLAN-v3.3. Решение за тобой.

## План групп sweep'а (рекон git diff --stat, готов к коммитам после PLAN-v3.3)
| Группа | Файлы | Объём | Комментарий |
|---|---|---|---|
| **G0 первый** | `takes/components/TakesControlStrip.tsx` | 5±, ОДИН хунк @@:658 | P1#6 null-guard `ae?.pause`→`transport.pause()` |
| G1 | `avatar/FallbackAvatar.tsx`, `avatar/FullAvatar.tsx` | +40 | avatar/CSS |
| G2 | `js/ai/registry.ts`, `js/ui/ai-chat-ui.ts`, `js/utils/stream-openai.ts`(D), `js/ai/settings/`(??), `main.tsx` | ~180 | registry/ai-chat + M4-unify |
| G3 | `components/TransportBar/WagonTrain`, `hooks/useKeyboardShortcuts`, `sync/components/WaveformCanvas` | ~29 | UI-обвязка |
| G4 | `agent-registry/*`, `docs/*`, `tools/`(??) | md+tools | доки последними из лёгких |
| **G5 ПОСЛЕДНИЙ** | `engine-v3/monitor/MonitorRouter.ts`, `engine-v3/pipeline/HybridPipelineService.ts` | +60 | аудио-ядро v3 |
Нюанс: в l порядок «monitor/pipeline третьими» И «аудио-ядро последним» — MonitorRouter/HybridPipeline это engine-v3.
Предлагаю их абсолютный последний (G5). Каждая группа = мой коммит → твой канон 313/769 + ⛔-отчёт → следующая.
