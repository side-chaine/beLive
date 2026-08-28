# [@PROPOSAL patch] · TASK-015 · PART C · ControlDeck + порядок + риски · от 006 · 22.08
**Часть 3 из 3** (A=StemOrchestrator, B=MonitorRouter). Статус: жду SYNC-OK 007 → dispatch.

## E3 · src/components/ControlDeck.tsx :349-374 (S4)
В обработчике кнопки VMix v3-ветку заменить (фасад оставить ТОЛЬКО для engineMode==='v2'):
```tsx
const router = (window as any).__belive?.monitorRouter;
if (router?.setVMix) {
  const next = !vocalMixEnabled;
  router.setVMix(next);
  useAudioStore.setState({ vocalMixEnabled: next });
} else if (ae) { /* legacy v2: старые enable/disableVocalMix (фасад-no-op в v3) */ }
```
title кнопки: «VMix — vocals L / music center / mic R (нужен включённый 🎤)».

## E4 · ПОРЯДОК ПРИМЕНЕНИЯ (важно!)
1. Применять **ПОСЛЕ 463/464a/b**: нужен `__belive.monitorRouter` (E2 из Part B) И 🎤-тап в `micInput` (TASK-014: стрим подключается к micInput только при 🎤 ON).
2. **Mic R слышен ТОЛЬКО при включённом 🎤** — задокументировано в title кнопки.

## S5 · ИНТЕРАКЦИИ
- **stemsEnabled × VMix:** №18-BUS H3.3 глушит music+backing через `pipeline.setStemMuted` (ДО `outputNode`) ⇒ центр замолкает автоматически, вокал L продолжает = режим «минус выключен» (паритет духа FR-014). Задокументировать.
- **№18-BUS busFactor:** шина масштабирует `stem.volume` ДО тапов (`outputNode` последний в цепи StemPlayerV3.ts:199) ⇒ центр и всё остальное честно следуют фейдеру.
- **Track-change:** `pipeline.reset` пересоздаёт стемы ⇒ `addStem`-хук (Part A) сам восстанавливает центр-тап; VMix-стейт (мастер-гейн) переживает, т.к. узлы роутера статичны.

## РИСКИ
- **R1 MED:** забытый `defaultBranch` при ON = задвоение вокала (center+L) ⇒ crossfade в `setVMix` обязателен. Тест: solo vocals при VMix ON слышен ТОЛЬКО слева.
- **R2 LOW:** merger up/down-mix правила — входы моно-гейны, ChannelMerger(2) принимает моно на каждый вход штатно (эталон работает так же).
- **R3 INFO:** mic R слышен только при 🎤 ON (TASK-014) — UX задокументирован в title кнопки.
- **R4 LOW:** VMix ON при no-stems треке: центр пуст (нет music-стемов), вокал L + mic R — вырожденный но корректный кейс; тест-ячейка.

## CROSS-REF
- Тап центра → **Part A** · vmix-подграф + setVMix → **Part B**.
