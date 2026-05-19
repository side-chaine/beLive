import { useModeStore } from '../stores/mode.store';
import { useStemStore } from '../stem/stem.store';
import { BUILTIN_STEMS, MODE_STEM_POLICIES } from '../stem/stemTypes';
import type { StemRole, ModeStemPolicy } from '../stem/stemTypes';

// ─── Volume Policy (Observer) ────────────────────────────
// W4b: Generalized for N stems — applies MODE_STEM_POLICIES per role.
// Rehearsal save/restore moved to mode-switch.bridge (command path).
// This bridge observes mode changes and confirms volumes.

/** Map stem role → policy volume field (shared logic) */
function getRolePolicyVolume(role: StemRole, policy: ModeStemPolicy): number {
  switch (role) {
    case 'master': return policy.musicGroup;
    case 'music': return policy.musicGroup;
    case 'vocal': return policy.leadVocal;
    case 'backing': return policy.backingVocal;
    case 'effect': return policy.musicGroup;
  }
}

const VOLUME_STORAGE_KEY = 'bl-rehearsal-volumes';

function loadRehearsalVolumesFromStorage(): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // v2 format: { v: 2, stemVolumes: {...} }
    if (parsed.v === 2 && parsed.stemVolumes) {
      const result: Record<string, number> = {};
      for (const [key, val] of Object.entries(parsed.stemVolumes as Record<string, unknown>)) {
        const n = Number(val);
        result[key] = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
      }
      return result;
    }

    // v1 format: { instrumentalVolume: 0.8, vocalsVolume: 0.5 }
    if (parsed.instrumentalVolume !== undefined || parsed.vocalsVolume !== undefined) {
      const clamp = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1; };
      return {
        instrumental: clamp(parsed.instrumentalVolume ?? 1),
        vocals: clamp(parsed.vocalsVolume ?? 1),
      };
    }

    return null;
  } catch (_) { return null; }
}

function applyVolumePolicy(mode: string) {
  const ae = (window as any).audioEngine;
  if (!ae) return;

  const self = applyVolumePolicy as any;
  const prevMode: string | undefined = self._lastMode;

  if (prevMode === mode) return;

  const policy = MODE_STEM_POLICIES[mode];
  if (!policy) { self._lastMode = mode; return; }

  // Observer: apply policy after short delay to let command bridge settle
  setTimeout(() => {
    const st = useStemStore.getState();

    if (mode === 'rehearsal') {
      // Restore from localStorage (command bridge already saved)
      const saved = loadRehearsalVolumesFromStorage();
      for (const stemId of st.loadedStems) {
        const vol = saved?.[stemId] ?? 1;
        try { ae.setStemVolume?.(stemId, vol); } catch (_) {}
        useStemStore.getState().setStemVolume(stemId, vol);
      }
    } else {
      // Karaoke / Concert / Live: apply MODE_STEM_POLICIES per stem role
      for (const stemId of st.loadedStems) {
        const def = BUILTIN_STEMS[stemId];
        const role: StemRole = def?.role ?? 'music';
        const vol = getRolePolicyVolume(role, policy);
        try { ae.setStemVolume?.(stemId, vol); } catch (_) {}
        useStemStore.getState().setStemVolume(stemId, vol);
      }
    }
  }, 100);

  self._lastMode = mode;
}

export function initModeBridge(): () => void {
  const syncMode = () => {
    const body = document.body.className;
    let mode: 'concert' | 'karaoke' | 'rehearsal' | 'live' | undefined;

    if (body.includes('mode-concert')) mode = 'concert';
    else if (body.includes('mode-karaoke')) mode = 'karaoke';
    else if (body.includes('mode-rehearsal')) mode = 'rehearsal';
    else if (body.includes('mode-live')) mode = 'live';

    if (mode) {
      useModeStore.setState({ mode });
      applyVolumePolicy(mode);
    }
  };

  const onModeChanged = () => syncMode();

  window.addEventListener('mode-changed', onModeChanged);
  syncMode(); // initial sync

  const observer = new MutationObserver(() => syncMode());
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  return () => {
    observer.disconnect();
    window.removeEventListener('mode-changed', onModeChanged);
  };
}

