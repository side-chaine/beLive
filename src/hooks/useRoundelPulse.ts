import { useCallback, useEffect, useRef, useState } from 'react';
import {
  claimRecentPulse,
  emitRoundelPulse,
  onRoundelPulse,
  type RoundelOrigin,
} from '../utils/roundel-pulse';

/** Delay on the OTHER twin: the light reads as travelling down/up the axis. */
const ECHO_DELAY_MS = 90;

/**
 * `pulseKey` changes on every pulse — use it as a React `key` on the pulse
 * layer so the CSS animation restarts cleanly without `offsetWidth` hacks.
 * `pulseActive` unmounts the layer after the animation, leaving no dead nodes.
 * `fire()` emits for both twins (the emitter is also a subscriber).
 */
export function useRoundelPulse(origin: RoundelOrigin, enabled = true) {
  const [pulseKey, setPulseKey] = useState(0);
  const [pulseActive, setPulseActive] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) {return;}
    const pending = timers.current;
    const start = () => {
      setPulseKey((k) => k + 1);
      setPulseActive(true);
    };

    // Deliver a pulse that arrived while this twin was unmounted (feed mode).
    if (claimRecentPulse() !== null) {start();}

    const off = onRoundelPulse((from) => {
      // Own click answers immediately, the far twin echoes 90 ms later.
      const delay = from === origin ? 0 : ECHO_DELAY_MS;
      pending.push(window.setTimeout(start, delay));
    });

    return () => {
      off();
      pending.forEach(window.clearTimeout);
    };
  }, [enabled, origin]);

  const fire = useCallback(() => {
    if (enabled) {emitRoundelPulse(origin);}
  }, [enabled, origin]);

  const endPulse = useCallback(() => setPulseActive(false), []);

  return { pulseKey, pulseActive, fire, endPulse };
}
