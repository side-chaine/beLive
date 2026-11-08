// beLive — Post-upload flow (pure resolver + thin orchestrator)
// A/B pack: no sync.store/auto-lyrics.service imports here by design.

export type PostUploadFlowAction = 'open-blocks' | 'open-sync' | 'none';

export interface PostUploadFlowInput {
  trackId?: number | string | null;
  hasLyrics?: boolean;
  /** Convenience alternative to hasLyrics — empty/whitespace means no lyrics */
  lyrics?: string | null;
  hasBlocks?: boolean;
  hasMarkers?: boolean;
  origin?: 'json' | 'lrc' | 'plain' | string;
  confidence?: number | null;
  dataVersion?: number | null;
  editorOpen?: boolean;
  feed?: boolean;
  showActive?: boolean;
  featureActive?: boolean;
}

export interface PostUploadFlowResolution {
  action: PostUploadFlowAction;
  reason: string;
}

export interface PostUploadFlowDeps {
  loadTrack: (index: number, opts?: { autoplay?: boolean }) => Promise<void> | void;
  openBlockEditor: (opts?: { onSaved?: () => void; onCancel?: () => void }) => boolean | void;
  openSync?: () => boolean | void;
  onSaved?: () => void;
  onCancel?: () => void;
}

/**
 * Pure decision function. No window/IDB access.
 * High confidence = JSON origin OR confidence >= 0.8 OR dataVersion === 2.
 * Missing/undefined confidence is NOT trusted (?? 0).
 */
export function resolvePostUploadFlow(input: PostUploadFlowInput): PostUploadFlowResolution {
  const hasLyrics = input.hasLyrics
    ?? (typeof input.lyrics === 'string' && input.lyrics.trim().length > 0);
  const hasBlocks = input.hasBlocks === true;
  const hasMarkers = input.hasMarkers === true;
  const confidence = input.confidence ?? 0;

  if (input.trackId === undefined || input.trackId === null || input.trackId === '') {
    return { action: 'none', reason: 'no-track' };
  }
  if (!hasLyrics) {
    return { action: 'none', reason: 'no-lyrics' };
  }
  if (input.feed || input.showActive || input.featureActive) {
    return { action: 'none', reason: 'blocked' };
  }
  if (input.editorOpen) {
    return { action: 'none', reason: 'editor-open' };
  }

  // No structure at all — the user must build blocks first.
  if (!hasBlocks && !hasMarkers) {
    return { action: 'open-blocks', reason: 'no-structure' };
  }
  // Markers without blocks — LRC-in-ZIP / partial import: blocks are the missing half.
  if (!hasBlocks && hasMarkers) {
    return { action: 'open-blocks', reason: 'markers-without-blocks' };
  }
  // Blocks without markers — the missing half is timing/sync.
  if (hasBlocks && !hasMarkers) {
    return { action: 'open-sync', reason: 'blocks-without-markers' };
  }

  // Both present — only high confidence counts as "ready".
  const highConfidence = input.origin === 'json'
    || input.dataVersion === 2
    || confidence >= 0.8;

  if (!highConfidence) {
    return { action: 'open-blocks', reason: 'low-confidence' };
  }

  return { action: 'none', reason: 'high-confidence' };
}

let _inFlight = false;

/**
 * Thin orchestrator: resolve → find index in tc.tracks → await load (unless current)
 * → re-check id → open editor/sync. In-flight calls return 'busy'.
 */
export async function openPostUploadFlow(
  input: PostUploadFlowInput,
  deps: PostUploadFlowDeps,
): Promise<'opened' | 'busy' | 'blocked'> {
  if (_inFlight) {return 'busy';}
  _inFlight = true;

  try {
    const resolution = resolvePostUploadFlow(input);
    if (resolution.action === 'none') {return 'blocked';}

    const trackId = input.trackId;
    const tc = (window as any).trackCatalog;
    const tracks: any[] = Array.isArray(tc?.tracks) ? tc.tracks : [];
    const index = tracks.findIndex(t => String(t.id) === String(trackId));
    if (index < 0) {return 'blocked';}

    const currentIdx = tc.currentTrackIndex;
    const current = currentIdx >= 0 && currentIdx < tracks.length ? tracks[currentIdx] : null;
    const isCurrent = !!current && String(current.id) === String(trackId);

    if (!isCurrent) {
      await deps.loadTrack(index, { autoplay: false });

      const afterIdx = tc.currentTrackIndex;
      const after = afterIdx >= 0 && afterIdx < tracks.length ? tracks[afterIdx] : null;
      if (!after || String(after.id) !== String(trackId)) {
        return 'blocked';
      }
    }

    if (resolution.action === 'open-blocks') {
      const result = deps.openBlockEditor({
        onSaved: deps.onSaved,
        onCancel: deps.onCancel,
      });
      return result === false ? 'blocked' : 'opened';
    }

    if (!deps.openSync) {return 'blocked';}
    const result = deps.openSync();
    return result === false ? 'blocked' : 'opened';
  } finally {
    _inFlight = false;
  }
}
