import { create } from 'zustand';

/* -------- types -------- */
export interface MonitorDevice {
  deviceId: string;
  label: string;
}

export interface MonitorState {
  /* UI */
  open: boolean;

  /* engine state (synced from legacy) */
  enabled: boolean;
  routeMainEnabled: boolean;
  includeMusic: boolean;
  musicLevel: number;          // 0-1
  vocalToMain: boolean;
  vocalHallLevel: number;      // 0-1
  delayMs: number;             // 0-1000
  compensateOn: 'monitor' | 'main';
  outputDeviceId: string;
  mainDeviceId: string;

  /* auto-mix */
  autoVerseOn: boolean;
  autoVerseLevel: number;      // 0-1
  autoChorusOn: boolean;
  autoChorusLevel: number;     // 0-1
  autoBridgeOn: boolean;
  autoBridgeLevel: number;     // 0-1

  /* output volumes */
  hallVolume: number;           // 0-1 mainBranchGain
  monitorVolume: number;        // 0-1 monitorGain

  /* devices list */
  devices: MonitorDevice[];
}

export interface MonitorActions {
  toggleOpen: () => void;
  setOpen: (v: boolean) => void;

  /* sync from legacy (called by bridge) */
  syncFromLegacy: (s: Partial<MonitorState>) => void;
  setDevices: (d: MonitorDevice[]) => void;

  /* actions → legacy engine */
  enable: () => Promise<void>;
  disable: () => void;
  setOutputDevice: (id: string) => Promise<void>;
  setMainOutputDevice: (id: string) => Promise<void>;
  setRouteMain: (on: boolean) => Promise<void>;
  setDelayMs: (ms: number) => void;
  setCompensateTarget: (t: 'monitor' | 'main') => void;
  setIncludeMusic: (on: boolean) => void;
  setMusicLevel: (v: number) => void;
  setVocalToMain: (on: boolean) => void;
  setVocalHallLevel: (v: number) => void;
  setAutoVerse: (on: boolean) => void;
  setAutoVerseLevel: (v: number) => void;
  setAutoChorus: (on: boolean) => void;
  setAutoChorusLevel: (v: number) => void;
  setAutoBridge: (on: boolean) => void;
  setAutoBridgeLevel: (v: number) => void;
  setHallVolume: (v: number) => void;
  setMonitorVolume: (v: number) => void;
  testPulse: () => Promise<void>;
  refreshDevices: () => Promise<void>;
}

/* -------- helper -------- */
const getMix = (): any =>
  (window as any).app?.monitorMix ?? (window as any).monitorMix;

/* -------- store -------- */
export const useMonitorStore = create<MonitorState & MonitorActions>(
  (set, get) => ({
    /* --- initial state --- */
    open: false,
    enabled: false,
    routeMainEnabled: false,
    includeMusic: false,
    musicLevel: 0.15,
    vocalToMain: false,
    vocalHallLevel: 0.2,
    delayMs: 120,
    compensateOn: 'monitor',
    outputDeviceId: '',
    mainDeviceId: '',
    autoVerseOn: false,
    autoVerseLevel: 0.1,
    autoChorusOn: false,
    autoChorusLevel: 0.3,
    autoBridgeOn: false,
    autoBridgeLevel: 0.25,
    hallVolume: 1,
    monitorVolume: 1,
    devices: [],

    /* --- UI --- */
    toggleOpen: () => {
      const next = !get().open;
      set({ open: next });
      if (next) get().refreshDevices();
    },
    setOpen: (v) => set({ open: v }),

    /* --- bridge sync --- */
    syncFromLegacy: (s) => set(s),
    setDevices: (d) => set({ devices: d }),

    /* --- actions → legacy --- */
    enable: async () => {
      set({ enabled: true });
      const mix = getMix();
      if (mix) await mix.enable();
    },
    disable: () => {
      set({ enabled: false });
      const mix = getMix();
      if (mix) mix.disable();
    },
    setOutputDevice: async (id) => {
      set({ outputDeviceId: id });
      const mix = getMix();
      if (mix) await mix.setOutputDevice(id);
    },
    setMainOutputDevice: async (id) => {
      set({ mainDeviceId: id });
      const mix = getMix();
      if (mix) await mix.setMainOutputDevice(id);
    },
    setRouteMain: async (on) => {
      set({ routeMainEnabled: on });
      const mix = getMix();
      if (mix) await mix.setRouteMain(on);
    },
    setDelayMs: (ms) => {
      set({ delayMs: ms });
      const mix = getMix();
      if (mix) mix.setDelayMs(ms);
    },
    setCompensateTarget: (t) => {
      set({ compensateOn: t });
      const mix = getMix();
      if (mix) mix.setCompensateTarget(t);
    },
    setIncludeMusic: (on) => {
      set({ includeMusic: on });
      const mix = getMix();
      if (mix) mix.setIncludeMusic(on);
    },
    setMusicLevel: (v) => {
      set({ musicLevel: v });
      const mix = getMix();
      if (mix) mix.setMusicLevel(v);
    },
    setVocalToMain: (on) => {
      set({ vocalToMain: on });
      const mix = getMix();
      if (mix) mix.setVocalToMain(on);
    },
    setVocalHallLevel: (v) => {
      set({ vocalHallLevel: v });
      const mix = getMix();
      if (mix) mix.setVocalHallLevel(v);
    },
    setAutoVerse: (on) => {
      set({ autoVerseOn: on });
      const mix = getMix();
      if (mix) mix.setAutoVerse(on);
    },
    setAutoVerseLevel: (v) => {
      set({ autoVerseLevel: v });
      const mix = getMix();
      if (mix) mix.setAutoVerseLevel(v);
    },
    setAutoChorus: (on) => {
      set({ autoChorusOn: on });
      const mix = getMix();
      if (mix) mix.setAutoChorus(on);
    },
    setAutoChorusLevel: (v) => {
      set({ autoChorusLevel: v });
      const mix = getMix();
      if (mix) mix.setAutoChorusLevel(v);
    },
    setAutoBridge: (on) => {
      set({ autoBridgeOn: on });
      const mix = getMix();
      if (mix) mix.setAutoBridge(on);
    },
    setAutoBridgeLevel: (v) => {
      set({ autoBridgeLevel: v });
      const mix = getMix();
      if (mix) mix.setAutoBridgeLevel(v);
    },
    setHallVolume: (v) => {
      set({ hallVolume: v });
      const mix = getMix();
      const node = mix?.mainBranchGain;
      if (node?.gain) {
        node.gain.linearRampToValueAtTime(v, mix.audioContext?.currentTime + 0.02 || 0);
      }
    },
    setMonitorVolume: (v) => {
      set({ monitorVolume: v });
      const mix = getMix();
      const node = mix?.monitorGain;
      if (node?.gain) {
        node.gain.linearRampToValueAtTime(v, mix.audioContext?.currentTime + 0.02 || 0);
      }
    },
    testPulse: async () => {
      const mix = getMix();
      if (mix) await mix.testPulse();
    },
    refreshDevices: async () => {
      const mix = getMix();
      if (!mix) return;
      try {
        let outs: MediaDeviceInfo[] = await mix.listOutputs();
        const noLabels = !outs?.length || outs.every((d: MediaDeviceInfo) => !d.label);
        if (noLabels && navigator.mediaDevices?.getUserMedia) {
          try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            outs = await mix.listOutputs();
          } catch { /* permission denied — use what we have */ }
        }
        set({
          devices: (outs || []).map((d: MediaDeviceInfo) => ({
            deviceId: d.deviceId,
            label: d.label || (d.deviceId === 'default'
              ? 'System default'
              : `Device …${d.deviceId.slice(-4)}`),
          })),
        });
      } catch (e) {
        console.warn('[monitor.store] refreshDevices failed', e);
      }
    },
  })
);
