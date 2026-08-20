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

/** Идёт ли воспроизведение: V3-state при активном V3, иначе V2.isPlaying. */
export function isPlaying(): boolean {
  if ((window as any).__v3Active) {
    return getTransport()?.state === 'playing';
  }
  return !!(window as any).audioEngine?.isPlaying;
}
