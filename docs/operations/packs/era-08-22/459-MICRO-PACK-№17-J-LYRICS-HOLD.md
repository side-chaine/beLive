# 459-MICRO-PACK · №17-J · ТЕКСТ ДЕРЖИТСЯ НА БЛОКЕ ЗАПИСИ

**Директива юзера:** «Почему не держит куплет либо тот текущий блок, в котором ведется запись?» — во время записи (и после неё) LYRICS-вид не должен улетать за песней. Песня может играть дальше, но текст стоит на блоке записи, пока юзер сам не кликнет другой блок.

## EDIT 1 · src/takes/takes.store.ts — пин блока записи в сторе
1a. К интерфейсу состояния (рядом `activeBlockId: string | null;`, :9) добавить:
```
    pinnedBlockId: string | null;
```
1b. В начальное состояние (рядом `activeBlockId: null,` :53):
```
    pinnedBlockId: null,
```
1c. В `startRecording` (сейчас `startRecording: (blockId, slot) => set({ isRecording: true, recordingSlot: slot, activeBlockId: blockId })`, :71-75):
```
    startRecording: (blockId, slot) => set({
      isRecording: true,
      recordingSlot: slot,
      activeBlockId: blockId,
      pinnedBlockId: blockId,
    }),
```
1d. Рядом с `setActiveBlock` добавить экшн:
```
    clearPinnedBlock: () => set({ pinnedBlockId: null }),
```
1e. В обёртку `setActiveBlock` (сейчас там TRACE-лог из 449 + `set({ activeBlockId: blockId })`) добавить ОПЦИОНАЛЬНЫЙ второй аргумент и сброс пина при явном действии:
```
    setActiveBlock: (blockId, opts?: { fromUser?: boolean }) => {
      ...существующий DEV-лог без изменений...
      if (opts?.fromUser) set({ pinnedBlockId: null });
      set({ activeBlockId: blockId });
    },
```
(если типизация ругнётся на второй аргумент — расширить сигнатуру типа экшена в интерфейсе: `setActiveBlock: (blockId: string, opts?: { fromUser?: boolean }) => void;`)

## EDIT 2 · src/components/WagonTrain.tsx — оба клика = fromUser:true
В `handleWagonClick` И `handleSubBlockClick` заменить:
```
        setActiveBlock(block.id);
```
на:
```
        setActiveBlock(block.id, { fromUser: true });
```
(оба места; строки :106/:108 и внутри субблока)

## EDIT 3 · src/components/RehearsalLyrics.tsx — PS Travel не летает при пине/записи
3a. Добавить импорт (рядом других stores-импортов):
```
import { useTakesStore } from '../takes/takes.store';
```
3b. Внутри rAF-тика PS Travel, СРАЗУ ПЕРЕД условием `if (ct >= triggerTime && ...)`, вставить ранний выход:
```
      // №17-J: держим текст на блоке записи — не путешествуем во время/после записи,
      // пока юзер сам не сменит блок (пин в takes.store). Песня играет — текст стоит.
      const _ts = useTakesStore.getState();
      if (_ts.isRecording || _ts.pinnedBlockId) {
        rafId = requestAnimationFrame(tick);
        return;
      }

```
(не забыть продолжить цикл `rafId = requestAnimationFrame(tick); return;` — кадры идут, триггер молчит)

## ЧТО НЕ ТРОГАЕМ
TakesPanel (G/A часы, пин-arm эффект, G/B follow), E-публикации, H.

## VERIFICATION (канон А4)
tsc 314 (diff IDENTICAL) · vitest files 61/63 (2 legacy load-error), tests 749/749. FROZEN-OK: все три файла не frozen.

## ОЖИДАЕМЫЙ РЕТЕСТ
Запись куплета: текст СТОИТ на куплете весь тейк и после стопа (даже если песня ушла в прихорус). Клик чипа/субблока → текст+панель переходят и остаются. Без записи всё как раньше (текст следует за песней).
