import React from 'react';
import s from '../MonitorMixPanel.module.css';

export function CalibrationDrum({ value, onChange, disabled }: { value: number; onChange: (ms: number) => void; disabled?: boolean }) {
  const drumRef = React.useRef<HTMLDivElement>(null);
  const isDraggingRef = React.useRef(false);
  const dragStartXRef = React.useRef(0);
  const dragStartValueRef = React.useRef(0);
  const onChangeRef = React.useRef(onChange);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || !drumRef.current) return;

      const deltaX = e.clientX - dragStartXRef.current;
      const rect = drumRef.current.getBoundingClientRect();
      const msPerPixel = 500 / rect.width;
      const deltaMs = -deltaX * msPerPixel;
      const rawValue = dragStartValueRef.current + deltaMs;
      const snappedValue = Math.round(rawValue / 5) * 5;
      const clampedValue = Math.max(0, Math.min(500, snappedValue));

      onChangeRef.current(clampedValue);
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartValueRef.current = value;
  };

  const ticks = [];
  for (let ms = 0; ms <= 500; ms += 5) {
    const isMajor = ms % 25 === 0;
    const isLandmark = ms % 50 === 0;
    ticks.push({ ms, isMajor, isLandmark });
  }

  const totalTicks = ticks.length;
  const currentTickIndex = value / 5;
  const tickSpacingPercentage = 100 / (totalTicks - 1);
  const stripOffset = 50 - (currentTickIndex * tickSpacingPercentage);

  return (
    <div
      ref={drumRef}
      className={`${s.calibrationDrum} ${disabled ? s.calibrationDrumDisabled : ''}`}
      onPointerDown={disabled ? undefined : handlePointerDown}
    >
      <div className={s.centerMarker} />

      <div
        className={s.tickStrip}
        style={{ transform: `translateX(${stripOffset}%)` }}
      >
        {ticks.map((tick) => (
          <div
            key={tick.ms}
            className={`${s.tick} ${tick.isLandmark ? s.tickLandmark : tick.isMajor ? s.tickMajor : s.tickMinor}`}
            style={{ left: `${(tick.ms / 500) * 100}%` }}
          >
            {tick.isLandmark && (
              <span className={s.tickLabel}>{tick.ms}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
