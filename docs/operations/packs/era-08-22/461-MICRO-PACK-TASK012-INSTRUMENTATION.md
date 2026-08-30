# 461-MICRO-PACK · TASK-012 · ИНСТРУМЕНТАЦИЯ СИНХРОНИЗАЦИИ ЗАПИСИ (только логи, поведение НЕ меняется)

**Цель:** собрать реальные мс по всей цепочке capture→buffer→trim→store→playback, чтобы данные решили между гипотезами H2 (срез головы буфера через startOffset) и H1 (outputLatency), и объяснили warm-up первых тейков.

## EDIT 1 · src/takes/components/TakesControlStrip.tsx — при ARM (рядом существующего TRIM-BASIS лога ~:298/325)
Добавить ОДИН console.log сразу после строки с `[Takes] Recorder armed early...`:
```
        const _ac = getAudioContext();
        console.log('[REC-SYNC·ARM]', {
          engineNow: +(getPlaybackTime?.() ?? 0).toFixed(1),
          blockStart,
          baseLatency: _ac?.baseLatency,
          outputLatency: _ac?.outputLatency,
          inputLatency: (_ac as any)?.inputLatency,
          sampleRate: _ac?.sampleRate,
          ts: Math.round(performance.now()),
        });
```
(если getPlaybackTime/getAudioContext уже импортированы в файле — использовать как есть; если какого-то нет — добавить import из '../takes/takes.time' / '../../audio/core/audioContext' соответственно)

## EDIT 2 · src/takes/takes.recorder.ts — при COMMIT (v3-ветка, где буфер становится тейком)
Добавить лог в момент завершения записи (после получения финального AudioBuffer/blob, до/рядом с finishRecording вызовом):
```
      console.log('[REC-SYNC·COMMIT]', {
        bufferDurSec: +(buf?.duration ?? 0).toFixed(3),
        sampleRate: buf?.sampleRate,
        length: buf?.length,
        ts: Math.round(performance.now()),
      });
```
(имя локальной переменной с буфером подставить по факту файла)

## EDIT 3 · src/takes/hooks/useTakesPlayback.ts — расширить существующий GEN-SRC-START (~:226)
OLD:
```
      console.log(`[GEN-SRC-START] REACHED startOffset=${startOffset.toFixed(3)} gain=${gain.gain.value} gen=${gen} cur=${previewGenRef.current}`);
```
NEW:
```
      console.log(`[GEN-SRC-START] REACHED startOffset=${startOffset.toFixed(3)} = trimStart(${(trimStart ?? 0).toFixed(3)}) + engineOffset(${engineOffsetSec.toFixed(3)}) | transportT=${(getPlaybackTime() ?? -1).toFixed(3)} timeRangeStart=${timeRange.startTime} gain=${gain.gain.value} gen=${gen} cur=${previewGenRef.current}`);
```

## VERIFICATION
tsc 314 (diff IDENTICAL) · vitest files 61/63, tests 749/749. Только console.log, поведение не меняется. FROZEN-OK: все три файла не frozen.
```
