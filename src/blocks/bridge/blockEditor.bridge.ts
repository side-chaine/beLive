// beLive — Block Editor Bridge (Legacy → React Store)
// Sprint 36 | Intercepts legacy ModalBlockEditor callers
// Pattern: Bridge Interception (same as sync.bridge, live-guard)
//
// Legacy callers:
//   SyncEditorPanel.tsx:348  → window.modalBlockEditorInstance.show()
//   ControlPanel.tsx:29      → new window.ModalBlockEditor()
// Both do: init(text, trackInfo, onSave, onCancel) → show()

import { useBlockEditorStore } from '../store/blockEditor.store';
import { getTrack, updateTrackField } from '../../services/idb.service';
import { useTrackStore } from '../../stores/track.store';

/**
 * Proxy class that replaces legacy ModalBlockEditor.
 * init() stores args, show() opens React modal via store.
 */
class BlockEditorProxy {
  private _text = '';
  private _trackInfo: any = null;
  private _onSave: any = null;
  private _onCancel: any = null;
  private _wasInit = false;

  init(
    lyricsText: string,
    trackInfo: any,
    onSaveCallback?: any,
    onCancelCallback?: any
  ) {
    this._text = lyricsText || '';
    this._trackInfo = trackInfo;
    this._onSave = onSaveCallback || null;
    this._onCancel = onCancelCallback || null;
    this._wasInit = true;
  }

  async show() {
    // If show() called without init() — pull current track data from IDB
    if (!this._wasInit || !this._text) {
      await this._loadCurrentTrack();
    }

    useBlockEditorStore.getState().open(
      this._text,
      this._trackInfo,
      this._onSave,
      this._onCancel
    );

    // Reset init flag so next show() without init() re-loads
    this._wasInit = false;
  }

  hide() {
    useBlockEditorStore.getState().close();
  }

  /** Pull current track data from legacy globals */
  private async _loadCurrentTrack() {
    const w = window as any;
    const ld = w.lyricsDisplay;

    // Get current track from React store + IDB
    const meta = useTrackStore.getState().currentTrack;
    const trackId = meta ? Number(meta.id) : null;
    const track = trackId ? await getTrack(trackId) : null;

    this._trackInfo = track || { id: trackId };

    // Get lyrics text — try multiple sources
    if (track?.lyricsOriginalContent) {
      this._text = track.lyricsOriginalContent;
    } else if (track?.lyrics) {
      this._text = track.lyrics;
    } else if (ld?.lyrics && Array.isArray(ld.lyrics)) {
      this._text = ld.lyrics.join('\n');
    } else if (ld?.fullText) {
      this._text = ld.fullText;
    } else {
      this._text = '';
    }

    // Build save callback that matches waveform-editor pattern
    this._onSave = async (editedBlocks: any, newLyricsText: string) => {
      if (trackId) {
        await updateTrackField(Number(trackId), { blocksData: editedBlocks, lyrics: newLyricsText });
        document.dispatchEvent(new CustomEvent('blocks-applied', { detail: { trackId, blocksCount: editedBlocks?.length || 0 } }));
        if (ld?.loadImportedBlocks) {
          ld.loadImportedBlocks(editedBlocks, newLyricsText, true);
        }
        if (w.markerManager?.updateMarkerColors) {
          w.markerManager.updateMarkerColors();
        }
      }
    };

    this._onCancel = null;
  }
}

// ── Patch waveformEditor ──────────────────────────────────────

function patchWaveformEditor(): void {
  const w = window as any;
  const we = w.waveformEditor;
  if (!we) {
    setTimeout(patchWaveformEditor, 300);
    return;
  }

  // Pre-set modalBlockEditor to our proxy
  // → _openNewBlockEditor's guard `if (!this.modalBlockEditor)` will skip
  //   creating the original instance from lexical scope
  we.modalBlockEditor = new BlockEditorProxy();

  // Belt-and-suspenders: wrap _openNewBlockEditor to force proxy
  // even if something clears the cached instance
  const orig = we._openNewBlockEditor;
  if (typeof orig === 'function') {
    we._openNewBlockEditor = async function (this: any, ...args: any[]) {
      this.modalBlockEditor = new BlockEditorProxy();
      return orig.apply(this, args);
    };
  }
}

// ── Init ─────────────────────────────────────────────────────

let initialized = false;

export function initBlockEditorBridge(): void {
  if (initialized) return;
  initialized = true;

  const w = window as any;

  // Replace constructor globally — any future `new ModalBlockEditor()` gets Proxy
  w.ModalBlockEditor = BlockEditorProxy;

  // Pre-create the instance that track-catalog uses
  w.modalBlockEditorInstance = new BlockEditorProxy();

  // Patch waveformEditor (may need to poll if not ready yet)
  patchWaveformEditor();
}
