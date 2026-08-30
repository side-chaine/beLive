# MICRO-PACK 419 — Takes: единый V3-aware источник времени (фикс записи take)

## Контекст (диагноз 007)
Пользователь: на вкладке Quest при записи take 1 «показала 30, какое-то значение». Причина — вся takes-подсистема живёт на V2-тайминге, а V3-фон (Cage) закейджил V2:

1. `V2Adapter.delegateSync('seekTo', ...)` — **блокируется** V2Interceptor'ом при активном V3 (`main.tsx:131-141`, лог: `[V2Interceptor] 🚫 V2.seekTo() blocked — V3 is active`) → pre-roll seek не срабатывает, запись стартует не с начала блока.
2. `ae.getCurrentTime()` — **замёрз** (V2 закейджен) → countdown/trim-вычисления неверны, timeCheck `ct >= blockEnd` не останавливает запись вовремя → запись режется safety-timeout'ом `(blockDuration + 5) * 1000` → take длиной ~30с («30»).

Паттерн уже одобрен: C21 (TakesPanel.tsx:617-621) + WaveformCanvas.tsx:438-446. Этот пак распространяет его на весь takes-флоу.

## Шаг 1 — Новый файл `src/takes/takes.time.ts`

```ts
/**
 * Единый источник времени/seek для takes-флоу (V3-aware).
 * V3-фон закейджил V2: ae.getCurrentTime() замёрз, V2.seekTo блокируется V2Interceptor.
 * Когда V3 активен — время из V3StatePublisher (window.__belive.currentTime),
 * seek через TransportV3 (паттерн C21 / WaveformCanvas:438-446).
 */
import { getTransport } from '../audio/engine-v3';
import { V2Adapter } from '../audio/engine-v3/V2Adapter';

/** Текущее время воспроизведения: V3-тайм при активном V3, иначе V2. */
export function getPlaybackTime(): number {
  const v3t = (window as any).__belive?.currentTime;
  if ((window as any).__v3Active && v3t !== undefined) return v3t;
  return (window as any).audioEngine?.getCurrentTime?.() ?? 0;
}

/** Seek: через TransportV3 при активном V3, иначе через V2Adapter. */
export function seekTo(t: number): void {
  if ((window as any).__v3Active) {
    try { void getTransport()?.seek(Math.max(0, t)); } catch {}
    return;
  }
  try { V2Adapter.getInstance().delegateSync('seekTo', t); } catch {}
}
```

## Шаг 2 — `src/takes/components/TakesControlStrip.tsx`

1. Строка 18: заменить импорт
   `import { V2Adapter } from '../../audio/engine-v3/V2Adapter';`
   →
   `import { getPlaybackTime, seekTo } from '../takes.time';`
   (V2Adapter в этом файле больше нигде не используется — проверено; getTransport остаётся для `play()` на :188.)

2. Строка 187:
   `try { V2Adapter.getInstance().delegateSync('seekTo', preRollStart) } catch {}`
   →
   `try { seekTo(preRollStart) } catch {}`

3. ВСЕ вхождения (5 шт — replaceAll; строки 206, 296, 479, 533, 566):
   `const ct = ae.getCurrentTime?.() ?? 0;`
   →
   `const ct = getPlaybackTime();`

4. Строка 251:
   `const engineNow = ae.getCurrentTime?.() ?? effectiveTimeRange.startTime;`
   →
   `const engineNow = getPlaybackTime() || effectiveTimeRange.startTime;`

5. Строка 291:
   `ae.getCurrentTime?.()?.toFixed(3));`
   →
   `getPlaybackTime().toFixed(3));`

## Шаг 3 — `src/takes/components/TakesPanel.tsx`

1. Строка 33: заменить импорт
   `import { V2Adapter } from '../../audio/engine-v3/V2Adapter';`
   →
   `import { getPlaybackTime, seekTo } from '../takes.time';`
   (V2Adapter в этом файле больше нигде не используется — проверено; НЕ трогать :617-621 — фикс C21, он корректен и оставлен как есть.)

2. Строка 1093:
   `try { V2Adapter.getInstance().delegateSync('seekTo', range.startTime) } catch {}`
   →
   `try { seekTo(range.startTime) } catch {}`

3. Строка 1146:
   `const currentTime = ae.getCurrentTime?.() ?? 0;`
   →
   `const currentTime = getPlaybackTime();`

4. Строка 1356:
   `try { V2Adapter.getInstance().delegateSync('seekTo', t) } catch {};`
   →
   `try { seekTo(t) } catch {};`

## Шаг 4 — `src/takes/hooks/useTakesPlayback.ts`

1. Строка 5: заменить импорт
   `import { V2Adapter } from '../../audio/engine-v3/V2Adapter';`
   →
   `import { getPlaybackTime, seekTo } from '../takes.time';`
   (V2Adapter в этом файле больше нигде не используется — проверено; локальные `ae` НЕ удалять — используются для `attachProgramSource` :158 и др.)

2. Строка 174:
   `try { V2Adapter.getInstance().delegateSync('seekTo', timeRange.startTime) } catch {};`
   →
   `try { seekTo(timeRange.startTime) } catch {};`

3. Строка 198:
   `(ae.getCurrentTime?.() ?? timeRange.startTime)`
   →
   `(getPlaybackTime() || timeRange.startTime)`

## Шаг 5 — `src/takes/waveform/live-trail-controller.ts`

1. Добавить импорт (в блок импортов, рядом с существующими из './'):
   `import { getPlaybackTime } from '../takes.time';`

2. Строка 204:
   `const currentTime = ae.getCurrentTime?.() ?? 0;`
   →
   `const currentTime = getPlaybackTime();`

3. **УДАЛИТЬ строку 189** (объявление `const ae = (window as any).audioEngine;`) — после замены `ae` больше нигде не используется, иначе TS6133 (noUnusedLocals).

## Верификация (007)
- `npx tsc --noEmit` → должен остаться 314 ошибок (базовый уровень).
- `npx vitest run` → 746/749 (3 pre-existing).
- Frozen-проверка: затронуты только `src/takes/**` — ни один frozen-файл.
- git diff — только перечисленные строки.
- Коммит: `C22: takes: единый V3-aware источник времени (getPlaybackTime/seekTo)` + имя файла отчёта 420 в message.