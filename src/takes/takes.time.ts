/**
 * Единый источник времени/seek для takes-флоу (V3-aware).
 * V3-фон закейджил V2: ae.getCurrentTime() замёрз, V2.seekTo блокируется V2Interceptor.
 * Когда V3 активен — время из V3StatePublisher (window.__belive.currentTime),
 * seek через TransportV3 (паттерн C21 / WaveformCanvas:438-446).
 */
import { getTransport } from '../audio/engine-v3';

/** Текущее время воспроизведения: свежее V3-clock при активном V3, иначе V2. */
export function getPlaybackTime(): number {
  if ((window as any).__v3Active) {
    // Свежее время: TransportV3.currentTime (clock, геттер), БЕЗ 50мс-кэша __belive.currentTime
    const fresh = getTransport()?.currentTime;
    if (fresh !== undefined) return fresh;
    const cached = (window as any).__belive?.currentTime;
    if (cached !== undefined) return cached;
    return 0;
  }
  return (window as any).audioEngine?.getCurrentTime?.() ?? 0;
}

/** Seek: через TransportV3 при активном V3, иначе через V2Adapter. */
export function seekTo(t: number): void {
  if ((window as any).__v3Active) {
    try { void getTransport()?.seek(Math.max(0, t)); } catch {}
    return;
  }
  try { getTransport()?.seek(t); } catch {}
}

/** Идёт ли воспроизведение: V3-state при активном V3, иначе V2.isPlaying. */
export function isPlaying(): boolean {
  if ((window as any).__v3Active) {
    return getTransport()?.state === 'playing';
  }
  return !!(window as any).audioEngine?.isPlaying;
}

/** Скорость воспроизведения: TransportV3 при активном V3, иначе V2.setPlaybackRate. */
export function setRate(rate: number): void {
  if ((window as any).__v3Active) {
    try { getTransport()?.setPlaybackRate(rate); } catch {}
    return;
  }
  try { (window as any).audioEngine?.setPlaybackRate?.(rate); } catch {}
}
