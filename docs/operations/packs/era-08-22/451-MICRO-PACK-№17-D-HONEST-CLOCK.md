# 451-MICRO-PACK · №17-D · PS TRAVEL НА ЧЕСТНЫЕ ЧАСЫ ТРАНСПОРТА

**Root cause (доказан трейсом 450):** `__belive.currentTime` (кэш V3StatePublisher) НЕ сбрасывается при внутренних seek'ах (REC-preroll через `HybridPipelineService.seek`, возврат после превью) — `publishSeek()` зовётся только из клика по чипу (WagonTrain:99). Итог: часы уехали на +8.9с…+17.7с от транспорта (транспорт=20.014, часы=28.89→37.69), PS Travel «досрочно» долетал до след. блока → юзер видел переброс текста во время записи. Панель тейков при этом уже починена пином (447) — [SET-BLOCK] в ретесте молчал.

**Фикс:** PS Travel читает ЧЕСТНОЕ время `TransportV3.currentTime` (то же, что дал корректные 20.014 в TRIM-BASIS), кэш/V2 — только fallback. Паттерн = `takes.time.getPlaybackTime()`.

## EDIT 1 · src/components/RehearsalLyrics.tsx — импорт
OLD:
```
import { MAX_SUB_BLOCK_LINES } from '../slot-matrix/slot-matrix.utils';
```
NEW:
```
import { MAX_SUB_BLOCK_LINES } from '../slot-matrix/slot-matrix.utils';
import { getTransport } from '../audio/engine-v3';
```

## EDIT 2 · src/components/RehearsalLyrics.tsx (~:480) — источник ct
OLD:
```
      // №17-C: V2-clock заморожен при активном V3 (E1-family; parity с C21/418 TakesPanel)
      const v3t = (window as any).__belive?.currentTime;
      const ct = (window as any).__v3Active && v3t !== undefined ? v3t : (ae?.getCurrentTime?.() ?? 0);
```
NEW:
```
      // №17-D: __belive.currentTime ДРЕЙФУЕТ (publishSeek не зовётся на внутренних seek'ах,
      // доказано трейсом: транспорт 20.0, часы 28.9/37.7). Честное время = TransportV3.currentTime;
      // кэш публикатора и V2 — только fallback (паттерн takes.time.getPlaybackTime).
      const t3 = getTransport()?.currentTime;
      const ct = (window as any).__v3Active && typeof t3 === 'number'
        ? t3
        : ((window as any).__belive?.currentTime ?? ae?.getCurrentTime?.() ?? 0);
```

## VERIFICATION
- tsc --noEmit = 314 (diff IDENTICAL)
- vitest files 61/63 (2 legacy load-error), tests 749/749
- FROZEN-OK: RehearsalLyrics.tsx не frozen; движок не трогаем.

## ОЖИДАЕМЫЙ ЛОГ ПОСЛЕ ФИКСА
При записи тейка на блоке X: `[PS Travel]` МОЛЧИТ (ct≈движок, tt далеко). Строчка появляется только когда транспорт реально подходит к границе блока (~за 1с) — легитимный pre-scroll.

## СИСТЕМНАЯ ЗАМЕТКА ДЛЯ Ц3 (вне скоупа этого пака)
Тот же дрейфующий кэш едят ДРУГИЕ потребители `__belive.currentTime` (например playhead в TakesPanel — паттерн C21/418). Системный фикс = `publishSeek(newTime)` внутри `TransportV3/HybridPipelineService.seek()` — предложить отдельным паком №17-E после санакции Ц3.
