# 460-MICRO-PACK · №17-K · ХОЛД ВИДА НА БЛОКЕ ЗАПИСИ (текст + чипы)

**Проблема:** PS Travel заглушен (J ✅), но `displayBlock` (RehearsalLyrics:138) и `activeBlock` чипов (WagonTrain:33) считаются от `activeLineIndex` (позиции песни) → при пересечении границы текст+чипы улетали в след. блок во время/после записи.

**Фикс:** оба memo при активном `pinnedBlockId` (ставится в startRecording, снят только кликом юзера {fromUser:true} — уже в J) возвращают ЗАПИНЕННЫЙ блок. Песня играет — вид стоит.

## EDIT 1 · src/components/RehearsalLyrics.tsx — displayBlock memo (~:138)
OLD:
```
  const displayBlock = useMemo(() => {
    const candidate = activeBlock ?? (hasBlocks ? blocks[0] : null);
```
NEW:
```
  const displayBlock = useMemo(() => {
    // №17-K: пин блока записи — текст держится на блоке записи, не следует за песней.
    // Пин ставит startRecording, снимает только явный клик юзера ({fromUser:true}).
    const _pinnedId = useTakesStore.getState().pinnedBlockId;
    const _held = _pinnedId ? blocks.find(b => b.id === _pinnedId) : null;
    if (_held) {
      prevBlockRef.current = _held;
      return _held;
    }
    const candidate = activeBlock ?? (hasBlocks ? blocks[0] : null);
```
(остальное тело memo без изменений; useTakesStore уже импортирован с J)

## EDIT 2 · src/components/WagonTrain.tsx — activeBlock memo (~:33)
OLD:
```
  const activeBlock = useMemo(
    () => getActiveBlock(activeLineIndex, blocks),
    [activeLineIndex, blocks]
  );
```
NEW:
```
  const activeBlock = useMemo(
    () => {
      // №17-K: пин блока записи — подсветка чипа держится на блоке записи
      const pinned = useTakesStore.getState().pinnedBlockId;
      if (pinned) {
        const held = blocks.find(b => b.id === pinned);
        if (held) return held;
      }
      return getActiveBlock(activeLineIndex, blocks);
    },
    [activeLineIndex, blocks]
  );
```
(useTakesStore уже импортирован в WagonTrain :9)

## VERIFICATION (канон А4)
tsc 314 (diff IDENTICAL) · vitest files 61/63 (2 legacy load-error), tests 749/749. FROZEN-OK: оба файла не frozen.

## ОЖИДАЕМЫЙ РЕТЕСТ
Запись куплета: ТЕКСТ + ПОДСВЕТКА ЧИПА + панель — всё стоит на Verse 1 весь тейк и после стопа (позиция песни может уехать в прихорус — неважно). Клик любого чипа/субблока → переход + пин снят → далее обычный режим. Без записи — как раньше.
