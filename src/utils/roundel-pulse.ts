/**
 * Roundel link: the top "bL" button and the deck play/pause button are twins.
 * A click on either one sends a short light pulse across BOTH rims.
 *
 * Deliberately a plain DOM CustomEvent instead of a store / context:
 *   - zero dependencies, so the startup splash keeps its tiny module graph;
 *   - the two components stay fully decoupled (different subtrees, different
 *     lifecycles: the splash copy is decorative and never subscribes).
 */
export type RoundelOrigin = 'bl' | 'play' | 'keyboard';

const EVENT = 'belive:roundel-pulse';
type PulseDetail = { origin: RoundelOrigin; seq: number };

let seq = 0;
let lastAt = 0;

export function emitRoundelPulse(origin: RoundelOrigin): void {
  seq += 1;
  lastAt = performance.now();
  window.dispatchEvent(
    new CustomEvent<PulseDetail>(EVENT, { detail: { origin, seq } }),
  );
}

export function onRoundelPulse(listener: (origin: RoundelOrigin) => void): () => void {
  const handler = (e: Event) => {
    listener((e as CustomEvent<PulseDetail>).detail?.origin ?? 'play');
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/**
 * Feed mode unmounts the deck, so a pulse sent by "bL" can arrive while the
 * play roundel does not exist yet. When that twin mounts again it claims the
 * pending signal (3 s freshness window) and answers with the same flash.
 * Returns the pulse seq, or null when there is nothing fresh to deliver.
 */
export function claimRecentPulse(ttlMs = 3000): number | null {
  if (lastAt === 0 || performance.now() - lastAt > ttlMs) {return null;}
  return seq;
}
