import { getTransport } from './engine-v3';

/**
 * Single source of truth for play / pause.
 *
 * The Space shortcut and the deck roundel BOTH go through this module, so a
 * pointer and the keyboard can never disagree about what "toggle" means.
 * Kept byte-for-byte behaviourally identical to the original keyboard handler:
 * V3 path is guarded by `__v3Active` OR the orchestrator-stems guard, and V2
 * falls through to the plain transport calls.
 */
export function togglePlayback(): void {
  const transport = getTransport();
  const v3Path = !!transport && (
    (window as any).__v3Active ||
    (transport.state !== 'idle' && transport.orchestrator.all().length > 0)
  );

  if (v3Path && transport) {
    if (transport.state === 'playing') {
      void transport.pause();
    } else if (transport.isAudioContextRunning ?? true) {
      void transport.play();
    }
    return;
  }

  // V2 / no stems loaded — original fallback, unchanged.
  if (transport?.state === 'playing') transport.pause();
  else transport?.play();
}
