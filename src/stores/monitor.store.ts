import { create } from 'zustand';
import { useDeckStore } from './deck.store';

/* -------- types -------- */
export interface MonitorDevice {
  deviceId: string;
  label: string;
}

export interface MonitorState {
  /* UI */
  /** @deprecated Panel visibility owned by dock. Kept for compat. */
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
  autoIntroOn: boolean;
  autoIntroLevel: number;      // 0-1
  autoPreChorusOn: boolean;
  autoPreChorusLevel: number;  // 0-1
  autoOutroOn: boolean;
  autoOutroLevel: number;      // 0-1

  /* back vocal - UI only */
  backVocalMasterOn: boolean;
  backVocalMasterLevel: number;  // 0-1
  backVocalIntroOn: boolean;
  backVocalIntroLevel: number;   // 0-1
  backVocalVerseOn: boolean;
  backVocalVerseLevel: number;   // 0-1
  backVocalPreChorusOn: boolean;
  backVocalPreChorusLevel: number; // 0-1
  backVocalChorusOn: boolean;
  backVocalChorusLevel: number;    // 0-1
  backVocalBridgeOn: boolean;
  backVocalBridgeLevel: number;    // 0-1
  backVocalOutroOn: boolean;
  backVocalOutroLevel: number;     // 0-1

  /* line up - UI only */
  lineUpStatus: 'idle' | 'ready' | 'testing' | 'synced' | 'stale' | 'estimated';
  lineUpDelayMs: number;
  lineUpDeviceLabel: string;
  lineUpCalibratedAt: number;
  testInProgress: boolean;
  wasPlayingBeforeTest: boolean;
  calibrationMode: 'sound' | 'live' | null;
  preSessionDelayMs: number;
  preSessionWasPlaying: boolean;
  lineUpSource: 'pulse' | 'voc';  // UI-only source selector preference

  /* tap session - UI only assist layer */
  tapSessionActive: boolean;
  tapCount: number;
  tapJitter: number | null;
  tapConfidence: 'high' | 'medium' | 'low' | null;
  tapResultMs: number | null;

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
  enable: (opts?: { skipMic?: boolean }) => Promise<void>;
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
  setAutoIntro: (on: boolean) => void;
  setAutoIntroLevel: (v: number) => void;
  setAutoPreChorus: (on: boolean) => void;
  setAutoPreChorusLevel: (v: number) => void;
  setAutoOutro: (on: boolean) => void;
  setAutoOutroLevel: (v: number) => void;
  setBackVocalMaster: (on: boolean) => void;
  setBackVocalMasterLevel: (v: number) => void;
  setBackVocalIntro: (on: boolean) => void;
  setBackVocalIntroLevel: (v: number) => void;
  setBackVocalVerse: (on: boolean) => void;
  setBackVocalVerseLevel: (v: number) => void;
  setBackVocalPreChorus: (on: boolean) => void;
  setBackVocalPreChorusLevel: (v: number) => void;
  setBackVocalChorus: (on: boolean) => void;
  setBackVocalChorusLevel: (v: number) => void;
  setBackVocalBridge: (on: boolean) => void;
  setBackVocalBridgeLevel: (v: number) => void;
  setBackVocalOutro: (on: boolean) => void;
  setBackVocalOutroLevel: (v: number) => void;

  /* line up - UI only */
  setLineUpStatus: (s: 'idle' | 'ready' | 'testing' | 'synced' | 'stale' | 'estimated') => void;
  setLineUpDelayMs: (ms: number) => void;
  setLineUpDeviceLabel: (label: string) => void;
  setLineUpCalibratedAt: (ts: number) => void;
  setTestInProgress: (inProgress: boolean) => void;
  setWasPlayingBeforeTest: (wasPlaying: boolean) => void;
  setCalibrationMode: (mode: 'sound' | 'live' | null) => void;
  setPreSessionDelayMs: (ms: number) => void;
  setPreSessionWasPlaying: (playing: boolean) => void;
  setLineUpSource: (source: 'pulse' | 'voc') => void;

  /* tap session - UI only assist layer */
  setTapSessionActive: (active: boolean) => void;
  setTapCount: (count: number) => void;
  setTapJitter: (jitter: number | null) => void;
  setTapConfidence: (conf: 'high' | 'medium' | 'low' | null) => void;
  setTapResultMs: (ms: number | null) => void;
  resetTapSession: () => void;
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
    autoVerseLevel: 0.3,
    autoChorusOn: false,
    autoChorusLevel: 0.3,
    autoBridgeOn: false,
    autoBridgeLevel: 0.3,
    autoIntroOn: false,
    autoIntroLevel: 0.3,
    autoPreChorusOn: false,
    autoPreChorusLevel: 0.3,
    autoOutroOn: false,
    autoOutroLevel: 0.3,
    hallVolume: 1,
    monitorVolume: 1,
    devices: [],

    /* back vocal - UI only defaults */
    backVocalMasterOn: false,
    backVocalMasterLevel: 0.3,
    backVocalIntroOn: false,
    backVocalIntroLevel: 0.3,
    backVocalVerseOn: false,
    backVocalVerseLevel: 0.3,
    backVocalPreChorusOn: false,
    backVocalPreChorusLevel: 0.3,
    backVocalChorusOn: false,
    backVocalChorusLevel: 0.3,
    backVocalBridgeOn: false,
    backVocalBridgeLevel: 0.3,
    backVocalOutroOn: false,
    backVocalOutroLevel: 0.3,

    /* line up - UI only defaults */
    lineUpStatus: 'idle',
    lineUpDelayMs: 200,
    lineUpDeviceLabel: '',
    lineUpCalibratedAt: 0,
    testInProgress: false,
    wasPlayingBeforeTest: false,
    calibrationMode: null,
    preSessionDelayMs: 0,
    preSessionWasPlaying: false,
    lineUpSource: 'pulse',  // Default to pulse

    /* tap session - UI only defaults */
    tapSessionActive: false,
    tapCount: 0,
    tapJitter: null,
    tapConfidence: null,
    tapResultMs: null,

    /* --- UI --- */
    toggleOpen: () => {
      const deck = useDeckStore.getState();
      const isMonitorActive = deck.activeTabId === 'monitor' && deck.expanded;
      if (isMonitorActive) {
        deck.clearTab();
      } else {
        deck.setTab('monitor');
        get().refreshDevices();
      }
    },
    setOpen: (v: boolean) => {
      if (v) {
        useDeckStore.getState().setTab('monitor');
        get().refreshDevices();
      } else {
        const deck = useDeckStore.getState();
        if (deck.activeTabId === 'monitor') {
          deck.clearTab();
        }
      }
    },

    /* --- bridge sync --- */
    syncFromLegacy: (s) => set(s),
    setDevices: (d) => set({ devices: d }),

    /* --- actions → legacy --- */
    enable: async (opts?: { skipMic?: boolean }) => {
      set({ enabled: true });
      const mix = getMix();
      if (mix) await mix.enable(opts);
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
    setAutoIntro: (on) => {
      set({ autoIntroOn: on });
      const mix = getMix();
      if (mix) mix.setAutoIntro(on);
    },
    setAutoIntroLevel: (v) => {
      set({ autoIntroLevel: v });
      const mix = getMix();
      if (mix) mix.setAutoIntroLevel(v);
    },
    setAutoPreChorus: (on) => {
      set({ autoPreChorusOn: on });
      const mix = getMix();
      if (mix) mix.setAutoPreChorus(on);
    },
    setAutoPreChorusLevel: (v) => {
      set({ autoPreChorusLevel: v });
      const mix = getMix();
      if (mix) mix.setAutoPreChorusLevel(v);
    },
    setAutoOutro: (on) => {
      set({ autoOutroOn: on });
      const mix = getMix();
      if (mix) mix.setAutoOutro(on);
    },
    setAutoOutroLevel: (v) => {
      set({ autoOutroLevel: v });
      const mix = getMix();
      if (mix) mix.setAutoOutroLevel(v);
    },

    /* --- back vocal actions (UI-only, no engine integration) --- */
    setBackVocalMaster: (on) => {
      set({
        backVocalMasterOn: on,
        backVocalIntroOn: on,
        backVocalVerseOn: on,
        backVocalPreChorusOn: on,
        backVocalChorusOn: on,
        backVocalBridgeOn: on,
        backVocalOutroOn: on,
      });
    },
    setBackVocalMasterLevel: (v) => {
      const clamped = Math.max(0, Math.min(1, v));
      set({
        backVocalMasterLevel: clamped,
        // Note: Do NOT propagate to per-block levels — preserve relative offsets
      });
    },
    setBackVocalIntro: (on) => set({ backVocalIntroOn: on }),
    setBackVocalIntroLevel: (v) => set({ backVocalIntroLevel: Math.max(0, Math.min(1, v)) }),
    setBackVocalVerse: (on) => set({ backVocalVerseOn: on }),
    setBackVocalVerseLevel: (v) => set({ backVocalVerseLevel: Math.max(0, Math.min(1, v)) }),
    setBackVocalPreChorus: (on) => set({ backVocalPreChorusOn: on }),
    setBackVocalPreChorusLevel: (v) => set({ backVocalPreChorusLevel: Math.max(0, Math.min(1, v)) }),
    setBackVocalChorus: (on) => set({ backVocalChorusOn: on }),
    setBackVocalChorusLevel: (v) => set({ backVocalChorusLevel: Math.max(0, Math.min(1, v)) }),
    setBackVocalBridge: (on) => set({ backVocalBridgeOn: on }),
    setBackVocalBridgeLevel: (v) => set({ backVocalBridgeLevel: Math.max(0, Math.min(1, v)) }),
    setBackVocalOutro: (on) => set({ backVocalOutroOn: on }),
    setBackVocalOutroLevel: (v) => set({ backVocalOutroLevel: Math.max(0, Math.min(1, v)) }),

    /* --- line up actions (UI-only) --- */
    setLineUpStatus: (s) => set({ lineUpStatus: s }),
    setLineUpDelayMs: (ms) => set({ lineUpDelayMs: ms }),
    setLineUpDeviceLabel: (label) => set({ lineUpDeviceLabel: label }),
    setLineUpCalibratedAt: (ts) => set({ lineUpCalibratedAt: ts }),
    setTestInProgress: (inProgress) => set({ testInProgress: inProgress }),
    setWasPlayingBeforeTest: (wasPlaying) => set({ wasPlayingBeforeTest: wasPlaying }),
    setCalibrationMode: (mode) => set({ calibrationMode: mode }),
    setPreSessionDelayMs: (ms) => set({ preSessionDelayMs: ms }),
    setPreSessionWasPlaying: (playing) => set({ preSessionWasPlaying: playing }),
    setLineUpSource: (source) => set({ lineUpSource: source }),

    /* --- tap session actions (UI-only assist layer) --- */
    setTapSessionActive: (active) => set({ tapSessionActive: active }),
    setTapCount: (count) => set({ tapCount: count }),
    setTapJitter: (jitter) => set({ tapJitter: jitter }),
    setTapConfidence: (conf) => set({ tapConfidence: conf }),
    setTapResultMs: (ms) => set({ tapResultMs: ms }),
    resetTapSession: () => set({
      tapSessionActive: false,
      tapCount: 0,
      tapJitter: null,
      tapConfidence: null,
      tapResultMs: null,
    }),

    /* --- output volumes --- */
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
