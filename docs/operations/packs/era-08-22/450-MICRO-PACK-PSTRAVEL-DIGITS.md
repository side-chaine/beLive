# 450-MICRO-PACK · PS TRAVEL ЦИФРЫ В ЛОГ (диагностика, 1 строка)

**Цель:** PS Travel стреляет при REC ARM (engine 24.831) хотя след. блок на 37.98. Объект-лог обрезается Chrome («…») — прячем triggerTime/ct внутрь строки, плюс дублируем обеих часов для сверки.

## EDIT · src/components/RehearsalLyrics.tsx (~:500) — расширить существующий DEV-лог
OLD:
```
          if (import.meta.env.DEV) console.log('[PS Travel] Trigger fired', {
            nextBlockId: nextBlock?.id,
            isLastSub,
            expectedMeasureId: expectedId,
            measuredId: measurement?.nextBlockId,
            hasMeasurement: !!measurement,
            measurementValid,
            containerHeight: measurement?.containerHeight,
            triggerTime,
            ct,
          });
```
NEW:
```
          if (import.meta.env.DEV) console.log(`[PS Travel] Trigger fired tt=${Number(triggerTime).toFixed(2)} ct=${Number(ct).toFixed(2)} v2clock=${((ae as any)?.getCurrentTime?.() ?? -1).toFixed(2)} nbFMT=${Number(nextBlockFirstMarkerTime).toFixed(2)} nsFMT=${Number(nextSubBlockFirstMarkerTime).toFixed(2)} isLastSub=${isLastSub} nb=${nextBlock?.id}`, {
            nextBlockId: nextBlock?.id,
            isLastSub,
            expectedMeasureId: expectedId,
            measuredId: measurement?.nextBlockId,
            hasMeasurement: !!measurement,
            measurementValid,
            containerHeight: measurement?.containerHeight,
            triggerTime,
            ct,
          });
```
ПРИМЕЧАНИЕ: если `nextBlockFirstMarkerTime`/`nextSubBlockFirstMarkerTime` недоступны в этой области видимости под этими именами — оставить только tt/ct/v2clock часть (обязательные), остальное не добавлять.

## VERIFICATION
- tsc --noEmit = 314 (diff IDENTICAL)
- vitest files 61/63 (2 legacy load-error), tests 749/749
- FROZEN-OK: RehearsalLyrics.tsx не frozen.
