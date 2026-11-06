import { useAudioStore } from '../stores/audio.store';
import { togglePlayback } from '../audio/transport-control';
import { RoundelFace } from './RoundelFace';

/**
 * Interactive deck roundel. `useAudioStore.isPlaying` is the canonical UI state:
 * V3StatePublisher writes it on EVERY transport `statechange`, so the icon can
 * never claim "playing" when the transport failed to start. No optimistic flip
 * on purpose — an `idle -> ready` event would overwrite it in the same tick
 * anyway, and a failed `play()` would otherwise leave a stuck pause icon.
 *
 * The click goes through the SAME toggle used by the Space shortcut.
 */
export function DeckPlayPause() {
  const isPlaying = useAudioStore((s) => s.isPlaying);
  return <RoundelFace playing={isPlaying} onClick={togglePlayback} />;
}
