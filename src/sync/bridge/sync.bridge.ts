import { useSyncStore } from '../store/sync.store';
import { useAudioStore } from '../../stores/audio.store';
import { switchMode } from '../../bridges/mode-switch.bridge';
import { getTrack } from '../../services/idb.service';
import { useTrackStore } from '../../stores/track.store';

/**
 * Sync Bridge — intercepts legacy waveformEditor.show/hide/toggle
 * so all existing buttons (#sync-btn, QuickActions, ControlPanel)
 * automatically open React SyncEditorPanel instead of legacy UI.
 *
 * Pattern: same as live-guard.ts (patch legacy API → React store)
 */
export function initSyncBridge(): () => void {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let patched = false;

  const patch = (): boolean => {
    const wfe = (window as any).waveformEditor;
    if (!wfe || patched) return patched;

    // Save originals for potential cleanup
    const originalShow = wfe.show?.bind(wfe);
    const originalHide = wfe.hide?.bind(wfe);
    const originalToggle = wfe.toggle?.bind(wfe);

    // Patch: show → React openSync (legacy DOM stays hidden)
    wfe.show = () => {
      // Auto-switch to Rehearsal mode
      const body = document.body;
      const isRehearsal = body.classList.contains('rehearsal-mode')
        || body.classList.contains('mode-rehearsal');
      if (!isRehearsal) {
        // Save current volumes BEFORE mode switch
        try {
          const st = (window as any).__zustand_audio?.getState?.()
            || { instrumentalVolume: 1, vocalsVolume: 1 };
          localStorage.setItem('bl-rehearsal-volumes', JSON.stringify({
            vocalsVolume: st.vocalsVolume ?? 1,
            instrumentalVolume: st.instrumentalVolume ?? 1,
          }));
        } catch(e) {}
        switchMode('rehearsal');
      }
      useSyncStore.getState().openSync();
    };

    // Patch: hide → React closeSync
    wfe.hide = () => {
      useSyncStore.getState().closeSync();
    };

    // Patch: toggle → React toggle
    wfe.toggle = () => {
      const { open, openSync, closeSync } = useSyncStore.getState();
      if (open) {
        closeSync();
      } else {
        // Auto-switch to Rehearsal mode
        const body = document.body;
        const isRehearsal = body.classList.contains('rehearsal-mode')
          || body.classList.contains('mode-rehearsal');
        if (!isRehearsal) {
          try {
            const st = (window as any).__zustand_audio?.getState?.()
              || { instrumentalVolume: 1, vocalsVolume: 1 };
            localStorage.setItem('bl-rehearsal-volumes', JSON.stringify({
              vocalsVolume: st.vocalsVolume ?? 1,
              instrumentalVolume: st.instrumentalVolume ?? 1,
            }));
          } catch(e) {}
          switchMode('rehearsal');
        }
        openSync();
      }
    };

    patched = true;
    // Expose audio store for volume sync
    (window as any).__zustand_audio = useAudioStore;
    return true;
  };

  // Try immediately, poll if waveformEditor not ready yet
  if (!patch()) {
    intervalId = setInterval(() => {
      if (patch() && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }, 200);
  }

  // Cleanup
  return () => {
    if (intervalId) clearInterval(intervalId);
  };
}


/**
 * Direct entry point for React components to open Sync Editor.
 * Handles vocals preload + delegates to patched waveformEditor.show().
 * Replaces legacy pattern: getElementById('sync-btn').click()
 */
export async function requestOpenSync(): Promise<void> {
  const wfe = (window as any).waveformEditor;
  if (!wfe) {
    console.warn('[SyncBridge] waveformEditor not available');
    return;
  }


  // 2. Open via patched show() — handles mode switch + store.openSync()
  wfe.show();
}


/**
 * Direct entry point for React components to close Sync Editor.
 * Handles legacy cleanup: restore vocals, restore rehearsal mode.
 * Dispatches 'sync-editor-closed' so app.js handler runs cleanup.
 */
export function requestCloseSync(): void {
  // 1. Close React UI
  useSyncStore.getState().closeSync();

  // 2. Dispatch legacy event so app.js restores vocals/mode
  try {
    document.dispatchEvent(new CustomEvent('sync-editor-closed'));
  } catch (e) {
    console.warn('[SyncBridge] Failed to dispatch sync-editor-closed:', e);
  }
}
