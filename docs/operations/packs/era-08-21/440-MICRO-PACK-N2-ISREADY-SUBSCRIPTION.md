# 440-MICRO-PACK — N2: реактивность takes-слота (подписка на данные, не на функцию)

**Автор:** 007 · **Цель:** Ц3-рулинг 439 (N2 применяем немедленно) · **Статус:** к применению Оператором
**Target:** `src/takes/components/TakesControlStrip.tsx` (НЕ frozen)
**Канон верификации:** tsc 314 (diff IDENTICAL) · vitest files 61/63, tests 749/749

---

## ROOT CAUSE (доказано трейсом 439)
- `TakesControlStrip.tsx:38` подписывается на **стабильную ссылку функции**: `useTakesStore(s => s.getBlockTakes)`.
- `:78` берёт данные вызовом `getBlockTakes(activeBlockId)` — но поскольку компонент подписан на функцию (которая никогда не меняется), **он НЕ ре-рендерится при коммите тейка** → `blockTakes`/`isReady` stale до внешнего пуша (Space/keyboard).
- Следствие (юзер, 439): тейк не показан и не кликабелен сразу после записи; нужен Space, чтобы форсировать ре-рендер. Это N2, и оно же закрывает N3(α) («показ тейка после записи на текущем блоке»).

## EXACT CHANGE
**1) Line 38** — заменить подписку на функцию подпиской на данные (`blockTakesMap`, как в TakesPanel.tsx:48):
```
OLD:  const getBlockTakes = useTakesStore(s => s.getBlockTakes);
NEW:  const blockTakesMap = useTakesStore(s => s.blockTakesMap);
```
(строка 39 `const getNextEmptySlot = useTakesStore(s => s.getNextEmptySlot);` остаётся без изменений)

**2) Line 78** — брать данные из подписки, сохранив fallback `emptyBlockTakes`:
```
OLD:  const blockTakes = getBlockTakes(activeBlockId);
NEW:  const blockTakes = blockTakesMap[activeBlockId] ?? useTakesStore.getState().getBlockTakes(activeBlockId);
```

## RATIONALE / ЗАЩИТА ОТ РЕГРЕССА
- Подписка на `blockTakesMap` (стабильная ссылка; заменяется только когда обновляются тейки блока) → компонент ре-рендерится при коммите тейка → `blockTakes`/`isReady` обновляются немедленно.
- Fallback `?? useTakesStore.getState().getBlockTakes(activeBlockId)` вызывается ТОЛЬКО в render когда entry undefined (не внутри селектора) ⇒ НЕТ infinite re-render loop (важно: НЕ делать `s => s.getBlockTakes(activeBlockId)` в селекторе, т.к. `emptyBlockTakes` аллоцирует новый объект каждый вызов).
- НЕ удалять/менять другие `s.getBlockTakes(activeBlockId)` внутри селекторов на ~449/697/782 (используют параметр `s`, не затронуты).

## CONSTRAINTS
- Файл НЕ frozen. НЕ трогать frozen: AudioEngineV2.ts, patchV1.ts, bridges/*, track.orchestrator.ts, любые `_` приватные.
- НЕ коммитить (решение о коммите — на вехе, см. политику). Оставить изменённое дерево, отчитаться.

## VERIFY (Оператор)
1. `npx tsc --noEmit` → 314 ошибок; `git diff` множества tsc-ошибок должен быть IDENTICAL базовому (новых от этого файла нет). При новых — минимально поправить в этом же файле.
2. `npx vitest run` → files 61/63, tests 749/749 (0 failed). Сообщить числа.
3. Вернуть точный `git diff` и числа верификации.

## PROOF-OF-CHANGE (браузерный ретест юзера — НЕ Оператор)
ДО фикса (439 §3): `[TAKE-CLICK] slot=0 isReady=false` → тихой no-op, нужен Space.
ПОСЛЕ фикса: клик по свежезаписанному тейку → `[TAKE-CLICK] slot=0 isReady=true` на ПЕРВОМ клике (без Space) → `[PLAY-TAKE]` → `[GEN-SRC-START] REACHED gain=1` → звук. Плюс юзер слышит без возврата на блок.
