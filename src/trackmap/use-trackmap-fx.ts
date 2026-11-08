import { useCallback, useEffect, useRef, useState } from 'react';
import { useTrackStore } from '../stores/track.store';
import { useTrackMapStore } from './trackmap.store';
import {
  pickTrackMapFx,
  TRACKMAP_FX_BY_ID,
  type TrackMapFx,
  type TrackMapFxId,
} from './trackmap-fx.registry';

/**
 * TrackMap FX runner.
 *
 * One job: decide *when* the strip blinks and *which* effect runs, then hand the
 * component a plain data object (effect id + per-wagon delays). The component
 * stays a dumb renderer — everything visual is CSS.
 *
 * Trigger policy (taste decisions, easy to change later):
 *   - Blink when the strip first appears for a track — i.e. the moment the track
 *     loads / the rehearsal surface mounts, NOT on `play`. Play can happen before
 *     blocks reach the store, and that used to swallow the presentation entirely.
 *   - Pause → play does NOT re-blink; a signature moment must not become noise.
 *   - Manual replay: `playTrackMapFx('cascade')` from anywhere (dev console, presets).
 */

export interface TrackMapFxRun {
  fxId: TrackMapFxId | null;
  /** index-aligned with rendered wagons; ms */
  delays: number[];
  /** total effect length, ms — drives --tm-fx-duration */
  durationMs: number;
  /** 0..1 */
  intensity: number;
}

const IDLE: TrackMapFxRun = { fxId: null, delays: [], durationMs: 0, intensity: 1 };

// ── manual trigger channel ──────────────────────────────────────────────────
type FxListener = (fx: TrackMapFx) => void;
const listeners = new Set<FxListener>();

/** Fire an effect right now. Omit `id` for a random one. */
export function playTrackMapFx(id?: TrackMapFxId): void {
  const fx = id ? TRACKMAP_FX_BY_ID[id] : pickTrackMapFx(null);
  if (!fx) return;
  listeners.forEach(l => l(fx));
}

let devBridgeInstalled = false;
/** Dev-only console bridge: `trackmapFx.play('spark')`, `trackmapFx.dim('solo')`. */
function installDevBridge(): void {
  if (devBridgeInstalled || typeof window === 'undefined') return;
  devBridgeInstalled = true;
  (window as unknown as Record<string, unknown>).trackmapFx = {
    play: (id?: TrackMapFxId) => playTrackMapFx(id),
    list: () => Object.keys(TRACKMAP_FX_BY_ID),
    dim: (mode: 'off' | 'soft' | 'solo') => useTrackMapStore.getState().setDimMode(mode),
    intensity: (v: number) => useTrackMapStore.getState().setFxIntensity(v),
    select: (ids: string[]) => useTrackMapStore.getState().setSelection(ids),
  };
}

export function useTrackMapFx(total: number): TrackMapFxRun {
  const trackId = useTrackStore(s => s.currentTrack?.id ?? null);
  const fxEnabled = useTrackMapStore(s => s.fxEnabled);
  const intensity = useTrackMapStore(s => s.fxIntensity);
  /** Дедуп презентации. Трек может быть ещё не выбран (id === null) — тогда
   *  ключ фиксированный, и полоса всё равно мигнёт ровно один раз. */
  const trackKey = trackId ?? '__no-track__';

  const [run, setRun] = useState<TrackMapFxRun>(IDLE);
  const lastFxRef = useRef<TrackMapFxId | null>(null);
  const blinkedForTrackRef = useRef<string | null>(null);
  const totalRef = useRef(total);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const seedRef = useRef(1);

  totalRef.current = total;

  /**
   * Start an effect. Goes through `fxId: null` first so that replaying the SAME
   * effect still restarts the CSS animation (animation-name none → tmX).
   */
  const startFx = useCallback((fx: TrackMapFx) => {
    const count = totalRef.current;
    if (count === 0) return;

    seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0;
    const seed = seedRef.current;
    lastFxRef.current = fx.id;

    setRun(prev => ({ ...prev, fxId: null }));
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setRun({
        fxId: fx.id,
        delays: Array.from({ length: count }, (_, i) => fx.delay(i, count, seed)),
        durationMs: fx.durationMs,
        intensity: useTrackMapStore.getState().fxIntensity,
      });
    });
  }, []);

  // Manual channel (also covers presets / future "replay" button).
  useEffect(() => {
    if (import.meta.env.DEV) installDevBridge();
    const listener: FxListener = (fx) => startFx(fx);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, [startFx]);

  // Auto-clear once the animation window is over.
  useEffect(() => {
    if (run.fxId === null) return;
    const maxDelay = run.delays.reduce((m, d) => Math.max(m, d), 0);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => setRun(prev => ({ ...prev, fxId: null })),
      run.durationMs + maxDelay + 120,
    );
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [run.fxId, run.durationMs, run.delays]);

  // Presentation trigger: the strip itself appearing IS the moment.
  //
  // Никита 06.11: презентация должна идти сразу при загрузке трека и переходе в
  // режим репетиции, а не по факту нажатия play. Раньше триггером был переход
  // isPlaying false→true — и он терялся, если play случался ДО того, как блоки
  // пришли в стор (полоса в этот момент рендерит null), либо если трек уже играл.
  // Поэтому теперь ждём только появления вагонов и один раз мигаем на трек.
  useEffect(() => {
    if (!fxEnabled || total === 0) return;
    const key = trackKey;
    if (blinkedForTrackRef.current === key) return;

    blinkedForTrackRef.current = key;
    startFx(pickTrackMapFx(lastFxRef.current));
  }, [total, trackKey, fxEnabled, startFx]);

  // Keep intensity live without restarting the animation.
  useEffect(() => {
    setRun(prev => (prev.intensity === intensity ? prev : { ...prev, intensity }));
  }, [intensity]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return run;
}
