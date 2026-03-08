import { useModeStore } from '../stores/mode.store';
import { useAudioStore } from '../stores/audio.store';

// ─── Volume Policy ────────────────────────────────────
const VOLUME_STORAGE_KEY = 'bl-rehearsal-volumes';

function applyVolumePolicy(mode: string) {
  const ae = (window as any).audioEngine;
  if (!ae) return;

  const self = applyVolumePolicy as any;
  const prevMode: string | undefined = self._lastMode;

  if (prevMode === mode) return;

  const clamp01 = (v: any) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 1;
    const normalized = n > 1 ? n / 100 : n;
    return Math.max(0, Math.min(1, normalized));
  };

  const saveRehearsalVolumes = () => {
    const st = useAudioStore.getState();
    const payload = {
      vocalsVolume: clamp01(st.vocalsVolume ?? 1),
      instrumentalVolume: clamp01(st.instrumentalVolume ?? 1),
    };
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {}
    return payload;
  };

  const loadRehearsalVolumes = () => {
    try {
      const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const voc = (parsed as any).vocalsVolume ?? (parsed as any).vocals;
      const inst = (parsed as any).instrumentalVolume ?? (parsed as any).instrumental;
      return {
        vocalsVolume: clamp01(voc ?? 1),
        instrumentalVolume: clamp01(inst ?? 1),
      };
    } catch (e) {
      return null;
    }
  };

  // 1) If leaving rehearsal -> SAVE BEFORE any muting
  if (prevMode === 'rehearsal' && mode !== 'rehearsal') {
    saveRehearsalVolumes();
  }

  // 2) Apply policy
  if (mode === 'karaoke' || mode === 'concert' || mode === 'live') {
    setTimeout(() => {
      ae.setVocalsVolume?.(0);
      ae.setInstrumentalVolume?.(1);
      useAudioStore.setState({ vocalsVolume: 0, instrumentalVolume: 1 });
    }, 100);
  } else if (mode === 'rehearsal') {
    const restored = loadRehearsalVolumes() ?? { vocalsVolume: 1, instrumentalVolume: 1 };
    setTimeout(() => {
      ae.setVocalsVolume?.(restored.vocalsVolume);
      ae.setInstrumentalVolume?.(restored.instrumentalVolume);
      useAudioStore.setState({
        vocalsVolume: restored.vocalsVolume,
        instrumentalVolume: restored.instrumentalVolume,
      });
    }, 100);
  }

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

  document.addEventListener('mode-changed', onModeChanged);
  syncMode(); // initial sync

  const observer = new MutationObserver(() => syncMode());
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  return () => {
    observer.disconnect();
    document.removeEventListener('mode-changed', onModeChanged);
  };
}

