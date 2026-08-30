# MICRO-PACK 422 — Takes: pre-roll не протухает, countdown по свежему engine-time (М1–М5)

## Контекст (диагноз 007, одобрен Ц3 421)
Баг: при записи take countdown 3-2-1 не показывается, запись стартует молча с опозданием (~1.83с в блок).
**Механизм (подтверждён кодом и логом):**
1. `recorder.start()` (:193) стоит **ПОСЛЕ** seek+play (:187-188) и занимает ~4.8с (cold init MediaRecorder/stream-tap — именно эти 4.8с видны в логе между `seek(17.05)` и `TRIM-BASIS 21.882`). Всё это время трек играет от pre-roll-позиции.
2. Countdown-цикл стартует после этого и читает `getPlaybackTime()` → `__belive.currentTime` — **кэш V3StatePublisher (20fps, задержка до 50мс)**. Позиция уже ≥ startTime → `left ≤ 0.05` → мгновенный resolve → оверлей не рендерится (React-батч).
3. Ц3-катч М1: wall-clock countdown сломает tempoRate (rate≠1). Решение: engine-time + свежее время.

**М4-аудит (двойной getUserMedia):** НЕ подтверждён — `enableMicrophone()` единственный в :177, ДО seek. Виновник 4.8с — `recorder.start()` (после seek). В паке: recorder.start() переносится ДО seek + добавляется телеметрия для точного замера.

---

## Шаг 1 — `src/takes/takes.time.ts` (правки в существующем файле)

**1a.** Заменить функцию `getPlaybackTime`:
```ts
/** Текущее время воспроизведения: свежее V3-clock при активном V3, иначе V2. */
export function getPlaybackTime(): number {
  if ((window as any).__v3Active) {
    // Свежее время: TransportV3.getCurrentTime() (clock), БЕЗ 50мс-кэша __belive.currentTime
    const fresh = getTransport()?.getCurrentTime?.();
    if (fresh !== undefined) return fresh;
    const cached = (window as any).__belive?.currentTime;
    if (cached !== undefined) return cached;
    return 0;
  }
  return (window as any).audioEngine?.getCurrentTime?.() ?? 0;
}
```

**1b.** Добавить в конец файла функцию `setRate` (М3):
```ts
/** Скорость воспроизведения: TransportV3 при активном V3, иначе V2.setPlaybackRate. */
export function setRate(rate: number): void {
  if ((window as any).__v3Active) {
    try { getTransport()?.setPlaybackRate(rate); } catch {}
    return;
  }
  try { (window as any).audioEngine?.setPlaybackRate?.(rate); } catch {}
}
```

---

## Шаг 2 — `src/takes/components/TakesControlStrip.tsx`

**2a.** Строка 18, импорт:
`import { getPlaybackTime, seekTo } from '../takes.time';`
→
`import { getPlaybackTime, seekTo, setRate } from '../takes.time';`

**2b.** Строки 165-170 (блок setPlaybackRate) заменить:
```ts
      // Only force 1.0 playback rate if NOT a tempo-aware training record
      if (typeof ae.setPlaybackRate === 'function' && !tempoRate) {
        ae.setPlaybackRate(1);
      } else if (typeof ae.setPlaybackRate === 'function' && tempoRate) {
        ae.setPlaybackRate(tempoRate);
      }
```
→
```ts
      // Rate: единый роутинг V3/V2 (М3) — tempoRate через TransportV3 при V3-фоне
      setRate(tempoRate ?? 1);
```

**2c.** Перестановка блоков (ГЛАВНЫЙ ФИКС). Заменить строки 180-196 целиком:
```ts
      // Detect line-scoped record stage: reduce pre-roll to 0 for line-range-scoped transactions
      const isLineScopedRecord = currentStep?.scope?.lineRange !== undefined;
      const effectivePreRoll = isLineScopedRecord ? 0 : PRE_ROLL_SEC;
      
      // Pre-roll seek and playback
      const preRollStart = Math.max(0, effectiveTimeRange.startTime - effectivePreRoll);
      const actualPreRoll = effectiveTimeRange.startTime - preRollStart;
      try { seekTo(preRollStart) } catch {}
      getTransport().play();
      
      // Start recorder AFTER seek+play — engine is now at preRollStart position
      const recorder = new TakesRecorder();
      recorderRef.current = recorder;
      await recorder.start();
      
      // Store start time for trim calculation
      const recorderStartedAt = performance.now();
```
→
```ts
      // Detect line-scoped record stage: reduce pre-roll to 0 for line-range-scoped transactions
      const isLineScopedRecord = currentStep?.scope?.lineRange !== undefined;
      const effectivePreRoll = isLineScopedRecord ? 0 : PRE_ROLL_SEC;
      
      // 🔧 422: recorder стартует ПЕРВЫМ (cold init MediaRecorder может занять секунды).
      // Пока он инициализируется, трек НЕ трогаем — pre-roll не протухает.
      const recorderInitStart = performance.now();
      const recorder = new TakesRecorder();
      recorderRef.current = recorder;
      await recorder.start();
      const recorderInitMs = performance.now() - recorderInitStart;
      
      // Store start time for trim calculation (база blob — СРАЗУ после старта рекордера)
      const recorderStartedAt = performance.now();
      
      // Pre-roll seek and playback — только после готовности рекордера
      const preRollStart = Math.max(0, effectiveTimeRange.startTime - effectivePreRoll);
      const actualPreRoll = effectiveTimeRange.startTime - preRollStart;
      const seekStart = performance.now();
      try { seekTo(preRollStart) } catch {}
      getTransport().play();
      const seekMs = performance.now() - seekStart;
```

**2d.** Countdown-блок (М1+М2): заменить строки 198-243 целиком:
```ts
      // Countdown UX (if pre-roll > 0.5s)
      if (actualPreRoll > 0.5) {
        setCountdown(Math.ceil(actualPreRoll));
        onCountdownChange?.(Math.ceil(actualPreRoll));
        await new Promise<void>((resolve) => {
          let remaining = Math.ceil(actualPreRoll);
          let vocalFadeScheduled = false;
          let stalenessStrikes = 0;
          const maxStalenessStrikes = 1;
          const wallStartMs = performance.now();
          const wallTimeoutMs = (actualPreRoll / (tempoRate ?? 1) + 2.5) * 1000;
          const tick = () => {
            const ct = getPlaybackTime();
            const left = Math.max(0, effectiveTimeRange.startTime - ct);
            // М2: staleness-гвард — если позиция УЖЕ внутри блока (pre-roll протух)
            if (ct > effectiveTimeRange.startTime + 0.05 && stalenessStrikes < maxStalenessStrikes) {
              stalenessStrikes++;
              try { seekTo(preRollStart) } catch {}
              countdownRef.current = requestAnimationFrame(tick);
              return;
            }
            if (left <= 0.05) { 
              setCountdown(null); 
              onCountdownChange?.(null);
              resolve(); 
              return; 
            }
            // М1: wall-clock ТОЛЬКО страховка (не источник цифры)
            if (performance.now() - wallStartMs > wallTimeoutMs) {
              setCountdown(null);
              onCountdownChange?.(null);
              useTakesStore.getState().cancelRecording();
              onRecordAbort?.(`Синхронизация pre-roll не удалась. Попробуй ещё раз.`);
              return;
            }
            const nc = Math.ceil(left);
            if (nc !== remaining) { 
              remaining = nc; 
              setCountdown(remaining); 
              onCountdownChange?.(remaining);
            }
            
            // Smooth vocal fade in final countdown window (one-shot per countdown)
            if (!vocalFadeScheduled && left <= 1.0) {
              vocalFadeScheduled = true;
              try {
                const vocalsGain = (ae as any).stems?.get?.('vocals')?.gainNode;
                if (vocalsGain && vocalsGain.gain && typeof vocalsGain.gain.linearRampToValueAtTime === 'function') {
                  const ctx = (ae as any).audioContext;
                  if (ctx) {
                    const targetVocal = 0;
                    const fadeEndTime = ctx.currentTime + left;
                    vocalsGain.gain.linearRampToValueAtTime(targetVocal, fadeEndTime);
                  }
                }
              } catch (_) {
                // Fallback: if vocalsGain unavailable, continue without fade
              }
            }
            
            countdownRef.current = requestAnimationFrame(tick);
          };
          countdownRef.current = requestAnimationFrame(tick);
        });
      }
```

**2e.** TRIM-BASIS лог — телеметрия (М4). В объекте :266-280 добавить поля. Заменить:
```ts
      if (import.meta.env.DEV) console.log('[TRIM-BASIS]', {
        blockId: activeBlockId,
        slot,
        blockStart: effectiveTimeRange.startTime,
        engineNow,
        rawDeltaSec,
        rawDeltaMs,
        wasClippedBefore,
        wallDeltaSec,
        computedTrim,
        oldTrim,
        fixDeltaMs,
        tempoRate,
        takeKind,
      });
```
→
```ts
      if (import.meta.env.DEV) console.log('[TRIM-BASIS]', {
        blockId: activeBlockId,
        slot,
        blockStart: effectiveTimeRange.startTime,
        engineNow,
        rawDeltaSec,
        rawDeltaMs,
        wasClippedBefore,
        wallDeltaSec,
        computedTrim,
        oldTrim,
        fixDeltaMs,
        tempoRate,
        takeKind,
        v3Active: (window as any).__v3Active,
        recorderInitMs,
        seekMs,
      });
```

**2f.** handleStop — сброс rate (М3-parity). В начале handleStop, после `setCountdown(null)` строки:
```ts
    if (countdownRef.current) { cancelAnimationFrame(countdownRef.current); countdownRef.current = null; }
    setCountdown(null);
    onCountdownChange?.(null);
```
→ добавить строку после них:
```ts
    if (countdownRef.current) { cancelAnimationFrame(countdownRef.current); countdownRef.current = null; }
    setCountdown(null);
    onCountdownChange?.(null);
    setRate(1); // М3: восстановить rate после записи (V3 и V2)
```

**2g.** Props-интерфейс: в `interface TakesControlStripProps` добавить:
```ts
  onRecordAbort?: (message: string) => void;
```
и в деструктуризации props (строка ~31): добавить `onRecordAbort,`.

**2h.** Deps массивы: у `handleRecord` useCallback deps (:313) добавить `onRecordAbort`; у `handleStop` deps (:673) добавить ничего не надо (setRate — модульный импорт, стабилен).

---

## Шаг 3 — `src/takes/components/TakesPanel.tsx`

**3a.** Новый state (рядом с :84 `countdownOverlay`):
```ts
  const [countdownOverlay, setCountdownOverlay] = React.useState<number | null>(null);
```
после него добавить:
```ts
  const [recordAbortMsg, setRecordAbortMsg] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!recordAbortMsg) return;
    const t = window.setTimeout(() => setRecordAbortMsg(null), 3500);
    return () => window.clearTimeout(t);
  }, [recordAbortMsg]);
```

**3b.** REC-бейдж + abort-плашка: ПОСЛЕ блока COUNTDOWN OVERLAY (:1403-1426), добавить:
```tsx
          {/* REC BADGE (М5): явный фидбек записи */}
          {isRecording && (
            <div
              data-no-seek
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                zIndex: 30,
                background: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,70,70,0.6)',
                borderRadius: 10,
                padding: '6px 14px',
                pointerEvents: 'none',
              }}
            >
              <span style={{
                width: 12, height: 12, borderRadius: '50%',
                background: '#ff4646',
                animation: 'beliveRecPulse 1s ease-in-out infinite',
              }} />
              <span style={{
                fontSize: 15, fontWeight: 900, color: '#ff4646',
                letterSpacing: '0.08em',
              }}>
                REC
              </span>
            </div>
          )}

          {/* ABORT NOTIFICATION (М2): никогда молча */}
          {recordAbortMsg !== null && (
            <div
              data-no-seek
              style={{
                position: 'absolute',
                top: 64,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 30,
                background: 'rgba(40,10,10,0.92)',
                border: '1px solid rgba(255,70,70,0.7)',
                borderRadius: 10,
                padding: '10px 18px',
                color: '#ffb0b0',
                fontSize: 14,
                fontWeight: 700,
                pointerEvents: 'none',
              }}
            >
              {recordAbortMsg}
            </div>
          )}
```
Если в проекте уже есть ключевые кадры `@keyframes beliveRecPulse` — не создавать дубль; если нет — бейдж работает без пульсации (статичная точка) — допустимо.

**3c.** Подключить проп: в месте вызова `<TakesControlStrip ... onCountdownChange={setCountdownOverlay}` (:1537) добавить `onRecordAbort={setRecordAbortMsg}`.

---

## Верификация (007)
- `npx tsc --noEmit` → 314 (база).
- `npx vitest run` → 746/749 (3 pre-existing).
- Frozen: только `src/takes/**` — frozen не тронуты.
- git diff — только перечисленные изменения.
- Коммит: `C23: takes: 422 — recorder до seek, countdown по свежему engine-time, staleness-гвард, setRate, REC-бейдж` + `(423-REPORT)` в message.