/**
 * beLive AudioEngine v2 — Main Facade.
 * Hybrid architecture: fetch for reliable loading, <audio> for playback.
 * Fixes blob:null bug. Preserves pitch on tempo change.
 */

import { getAudioContext, ensureResumed } from './audioContext';
import { StemPlayer } from './StemPlayer';
import { VocalMix } from './VocalMix';
import { MicrophoneManager } from './MicrophoneManager';
import type { StemRole, StemLoadMap, RoutingTarget } from '../../stem/stemTypes';
import { ROLE_ROUTING, BUILTIN_STEMS, SOFT_RESYNC_DEFAULTS, LOOP_PRE_SEEK_MAX_MS, LOOP_PRE_SEEK_DURATION_RATIO, LOOP_PRE_SEEK_TIMEOUT_MS } from '../../stem/stemTypes';

interface LoadTrackOptions {
  /** If true, resolve after instrumental loads. Other stems load in background via hot-plug. */
  progressive?: boolean;
  /** Current stemsEnabled state — controls hot-plug volume policy (★3) */
  stemsEnabled?: boolean;
}

export class AudioEngineV2 {
  // === Stems ===
  readonly stems: Map<string, StemPlayer> = new Map();

  // === Modules ===
  readonly vocalMix: VocalMix;
  readonly microphone: MicrophoneManager;

  // === State ===
  private _isPlaying = false;
  private _duration = 0;
  private _loadAbort: AbortController | null = null;
  private _loadGeneration = 0;
  private _phase2Abort: AbortController | null = null; // ★2 Phase 2 abort
  private _stemsEnabled: boolean = false;              // ★3 Hot-plug volume policy

  // === Events ===
  private _onTrackLoadedCallbacks: Function[] = [];
  private _onPositionUpdateCallbacks: Function[] = [];
  private _onBothEndedCallbacks: Function[] = [];
  private _positionInterval: ReturnType<typeof setInterval> | null = null;

  // === Loop ===
  private _loopActive = false;
  private _loopStart = 0;
  private _loopEnd = 0;
  private _loopCheckInterval: ReturnType<typeof setInterval> | null = null;

  // === Two-phase loop pre-seek (W1b, revised with Variant F gain-mute) ===
  /** Whether followers have been pre-seeked and are ready at loopStart */
  private _followersPreloaded = false;
  /** Boolean guard: prevents multiple _schedulePreSeek calls per loop cycle */
  private _preSeekScheduled = false;
  /** Stems currently in gain-mute phase during pre-seek (drift monitor skips them) */
  private _preSeekSilencedStems: Set<string> = new Set();
  /** Per-stem saved volume before gain-mute (for smooth restore) */
  private _preSeekSavedVolumes: Map<string, number> = new Map();
  /** Timestamp of last loop jump — drift monitor blackout */
  private _lastLoopJumpTime = 0;
  /** Minimum loop duration (seconds) to use pre-seek. Below this, lightweight jump only. */
  private static readonly _LOOP_PRE_SEEK_MIN_DURATION = 0.3; // 300ms
  /** Minimum time (ms) between loop jumps — prevents interval spam */
  private static readonly _LOOP_JUMP_COOLDOWN_MS = 80;
  /** Loop jump counter — for log throttling */
  private _loopJumpCount = 0;
  /** Blackout period after loop jump — drift monitor must not fire */
  private readonly _LOOP_RESYNC_BLACKOUT_MS = 800;
  /** Timeout handle for Phase 1 seeked-event timeout */
  private _loopPreSeekWaitTimeout: ReturnType<typeof setTimeout> | null = null;

  // === Playback rate ===
  private _playbackRate = 1.0;

  // === Track URLs (for WaveformEditor compat + N-stem) ===
  private _trackUrls: Record<string, string> = {};

  /** Per-stem role assignments (determines routing via ROLE_ROUTING) */
  private _stemRoles: Record<string, StemRole> = {};

  /** Master volume gain node — separate from clock-tap for mute invariant (A2.25) */
  private _masterVolumeGain: GainNode | null = null;

  /** Stem mute state — tracked here for solo/mute logic + master invariant */
  private _stemMutes: Record<string, boolean> = {};

  /** Stem solo state — when any stem is soloed, non-soloed stems are muted */
  private _stemSolos: Record<string, boolean> = {};

  /** Group-aware soft resync: tracks which group buses have active soft resync */
  private _softResyncInProgress: Map<string, Set<string>> = new Map(); // bus → Set<stemId> (W9-DRIFT-001: tier-based concurrent)

  /** Stems currently being soft-resynced (stemId → playbackRate deviation) */
  private _softResyncRates: Map<string, number> = new Map();

  // === Transport hardening state (Phase 0 scaffolding) ===
  private _transportGen = 0;
  private _lastSeekTime = 0;
  private _softResyncTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastHardResyncTime = 0;
  private readonly _SYNC_BLACKOUT_FLOOR = 80;
  private readonly _SYNC_BLACKOUT_MAX = 500;
  private readonly _HARD_RESYNC_COOLDOWN_MS = 1500;

  // === First-seek stabilization baseline (TC-046R) ===
  private _firstSeekDone = false;

  /** True while _atomicResumeFromSeek is in progress — drift monitor must not fire */
  private _resyncInProgress = false;

  // === Group Bus Architecture (W3) ===
  /** Bus gain nodes: one per RoutingTarget. Parallel taps — NOT in the direct signal path. */
  private _buses: Map<RoutingTarget, { gainNode: GainNode; stemIds: Set<string> }> = new Map();

  /** Raw per-stem volume (0-1) — BEFORE bus multiplier. Separated from gainNode.gain for effective gain formula. */
  private _stemVolumes: Record<string, number> = {};

  /** Raw per-bus volume (0-1). Applied as multiplier to all stems in bus via _applyEffectiveGain(). */
  private _busVolumes: Partial<Record<RoutingTarget, number>> = {};

  // === Metering (W5) ===
  /** Per-stem AnalyserNodes for VU meters — parallel taps from gainNode (NOT in signal path) */
  private _analysers: Map<string, AnalyserNode> = new Map();
  // TC-13-08: Cached Float32Array buffers — eliminates ~1.68MB/sec GC pressure
  private _meterBuffers: Map<string, Float32Array> = new Map();

  /** ★9 Sync stemsEnabled from UI — called by MixerPanel toggle.
   *  Without this, _stemsEnabled becomes stale when user toggles during load. */
  public setStemsEnabled(enabled: boolean): void {
    this._stemsEnabled = enabled;
  }

  /**
   * TC-8.6B: Load additional stems on-demand (when user enables Stems toggle).
   * Reads stemsData from StemLoadMap, loads each stem,
   * hot-plugs into playing graph, emits events.
   */
  public async loadAdditionalStems(additionalStems: StemLoadMap): Promise<string[]> {
    const loadedIds: string[] = [];
    const entries = Object.entries(additionalStems);

    if (entries.length === 0) return loadedIds;

    const gen = this._loadGeneration;
    const signal = this._loadAbort?.signal ?? new AbortController().signal;

    console.log(`🔄 [gen=${gen}] On-demand loading ${entries.length} stems`);

    const results = await Promise.allSettled(
      entries.map(async ([id, entry]) => {
        const stem = new StemPlayer(id);
        const skipDecode = entry.role !== 'vocal';

        if (entry.data) {
          await stem.loadFromArrayBuffer(entry.data, entry.type || 'audio/mpeg', signal, skipDecode);
        } else if (entry.url) {
          await stem.load(entry.url, signal, skipDecode);
        } else {
          throw new Error(`StemLoadEntry '${id}' has neither url nor data`);
        }

        if (gen !== this._loadGeneration) {
          stem.disconnect();
          stem.dispose();
          throw new DOMException('Load superseded', 'AbortError');
        }

        this.stems.set(id, stem);
        this._stemRoles[id] = entry.role;
        this._stemMutes[id] = false;
        this._stemSolos[id] = false;

        // ★3 stemsEnabled-aware hot-plug
        this._hotPlugStem(id);

        document.dispatchEvent(new CustomEvent('track-stem-ready', {
          detail: { stemId: id, role: entry.role }
        }));

        return id;
      })
    );

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        loadedIds.push(result.value);
        console.log(`✅ [gen=${gen}] On-demand: ${entries[i][0].toUpperCase()} loaded`);
      } else {
        console.warn(`⚠️ On-demand: Stem '${entries[i][0]}' failed:`, result.reason?.message ?? result.reason);
      }
    });

    if (loadedIds.length > 0) {
      this.stems.forEach((stem, id) => {
        const blobUrl = stem.cleanBlobUrl;
        if (blobUrl) this._trackUrls[id] = blobUrl;
      });

      // TC-13-08: Reconnect analysers for newly loaded stems
      this._reconnectAnalysers();

      const allLoadedIds = Array.from(this.stems.keys());
      const hasVocals = this.stems.has('vocals');

      document.dispatchEvent(new CustomEvent('track-fully-loaded', {
        detail: { duration: this._duration, loadedStems: allLoadedIds, hasVocals }
      }));

      console.log(`🏁 [gen=${gen}] On-demand complete: ${loadedIds.length} stems loaded`);
    }

    return loadedIds;
  }

  constructor() {
    this.vocalMix = new VocalMix();
    this.microphone = new MicrophoneManager();
    console.log('🚀 AudioEngine v2 (Hybrid) initialized');
  }

  // W9-DRIFT-001: Tier-based concurrent soft resync limit
  private _getMaxConcurrentResync(): number {
    const count = this.stems.size;
    if (count <= 4) return 1;   // lite
    if (count <= 6) return 2;   // balanced
    if (count <= 8) return 4;   // max (7 stems → 4 concurrent)
    return 8;                    // ultra
  }

  // ============================================================
  // LOADING
  // ============================================================

  /**
   * Load a track with stems.
   *
   * Backward compatible: loadTrack(iUrl, vUrl) still works.
   * Extended: loadTrack(iUrl, vUrl, { drums: {url, role:'music'}, ... })
   *
   * @returns duration + list of loaded stem IDs + hasVocals (legacy compat)
   */
  async loadTrack(
    instrumentalUrl: string,
    vocalsUrl: string | null = null,
    additionalStems?: StemLoadMap,
    options?: LoadTrackOptions
  ): Promise<{ duration: number; loadedStems: string[]; hasVocals: boolean }> {
    const gen = ++this._loadGeneration;
    this._firstSeekDone = false;

    if (this._loadAbort) {
      this._loadAbort.abort();
    }
    this._loadAbort = new AbortController();
    const signal = this._loadAbort.signal;

    // ★2 Abort previous Phase 2 if track switches mid-load
    if (this._phase2Abort) {
      this._phase2Abort.abort();
    }
    this._phase2Abort = new AbortController();

    // ★3 Cache stemsEnabled for hot-plug volume decisions
    this._stemsEnabled = options?.stemsEnabled ?? false;

    ++this._transportGen;
    this._clearSoftResync();

    this._isPlaying = false;
    this._stopPositionUpdates();
    this._stopLoopCheck();
    this._loopActive = false;
    this._loopStart = 0;
    this._loopEnd = 0;
    this.stems.forEach(stem => {
      try { stem.disconnect(); } catch (_) {}
      stem.dispose();
    });
    this.stems.clear();

    // Reset N-stem state
    this._trackUrls = {};
    this._stemRoles = {};
    this._stemMutes = {};
    this._stemSolos = {};
    this._masterVolumeGain = null;
    // W3: Reset bus state (bus gainNodes will be recreated in _rebuildFullRouting)
    this._buses.forEach(bus => { try { bus.gainNode.disconnect(); } catch (_) {} });
    this._buses.clear();
    // W3.2: Reset volume state for new track
    this._stemVolumes = {};
    this._busVolumes = {};
    // W5: Reset analysers
    this._analysers.forEach(a => { try { a.disconnect(); } catch (_) {} });
    this._analysers.clear();
    // TC-13-08: Reset meter buffer cache
    this._meterBuffers.clear();

    // Register master stem (instrumental)
    this._trackUrls['instrumental'] = instrumentalUrl;
    this._stemRoles['instrumental'] = 'master';

    // Register vocals if provided
    if (vocalsUrl) {
      this._trackUrls['vocals'] = vocalsUrl;
      this._stemRoles['vocals'] = 'vocal';
    }

    // Register additional stems
    if (additionalStems) {
      for (const [id, entry] of Object.entries(additionalStems)) {
        if (entry.url) this._trackUrls[id] = entry.url;
        this._stemRoles[id] = entry.role;
      }
    }

    // W10-003: W7.3 auto-mute REMOVED — stems mode button now controls instrumental mute
    // Old W7.3 code:
    // if (additionalStems && Object.keys(additionalStems).length > 0) {
    //   this._stemVolumes['instrumental'] = 0;
    //   console.log('[AudioEngineV2] W7.3: instrum auto-muted — stems present, use fader to unmute');
    // }

    try {
      // ── Load instrumental (master clock) first ──
      const instStem = new StemPlayer('instrumental');
      await instStem.load(instrumentalUrl, signal, true);  // skipDecode — instrumental audioBuffer unused, waveform decodes lazily

      if (gen !== this._loadGeneration) {
        console.debug(`🛑 [gen=${gen}] Stale after instrumental load, disposing`);
        instStem.disconnect();
        instStem.dispose();
        throw new DOMException('Load superseded', 'AbortError');
      }

      this.stems.set('instrumental', instStem);
      this._duration = instStem.duration;

      // Create master volume gain (mute invariant A2.25)
      const ctx = getAudioContext();
      this._masterVolumeGain = ctx.createGain();
      this._masterVolumeGain.gain.value = 1; // unity
      // Rewire: sourceNode → gainNode (clock tap) → masterVolumeGain → bus
      instStem.gainNode.connect(this._masterVolumeGain);

      console.log(`✅ [gen=${gen}] INSTRUMENTAL loaded: ${this._duration.toFixed(2)}s`);

      // ═══════════════════════════════════════════════════════
      // NON-PROGRESSIVE PATH (backward compatible)
      // ═══════════════════════════════════════════════════════
      if (!options?.progressive) {
        const otherStemsToLoad: Array<{ id: string; url?: string; data?: ArrayBuffer; type?: string; role: StemRole }> = [];

        if (vocalsUrl) {
          otherStemsToLoad.push({ id: 'vocals', url: vocalsUrl, role: 'vocal' });
        }

        if (additionalStems) {
          for (const [id, entry] of Object.entries(additionalStems)) {
            // ★1 Duplicate vocals guard — vocalsUrl takes priority
            if (id === 'vocals' && vocalsUrl) {
              console.warn(`[AudioEngineV2] vocalsUrl provided — skipping additionalStems.vocals`);
              continue;
            }
            if (entry.url) this._trackUrls[id] = entry.url;
            otherStemsToLoad.push({ id, url: entry.url, data: entry.data, type: entry.type, role: entry.role });
          }
        }

        const loadResults = await Promise.allSettled(
          otherStemsToLoad.map(async ({ id, url, data, type, role }) => {
            const stem = new StemPlayer(id);
            const skipDecode = role !== 'vocal';
            if (data) {
              await stem.loadFromArrayBuffer(data, type || 'audio/mpeg', signal, skipDecode);
            } else if (url) {
              await stem.load(url, signal, skipDecode);
            } else {
              throw new Error(`StemLoadEntry '${id}' has neither url nor data`);
            }
            return { id, stem, role };
          })
        );

        const loadedStems: string[] = ['instrumental'];
        let hasVocals = false;

        for (let i = 0; i < loadResults.length; i++) {
          const result = loadResults[i];
          const { id, role } = otherStemsToLoad[i];

          if (result.status === 'fulfilled') {
            if (gen !== this._loadGeneration) {
              result.value.stem.disconnect();
              result.value.stem.dispose();
              throw new DOMException('Load superseded', 'AbortError');
            }

            this.stems.set(id, result.value.stem);
            this._stemRoles[id] = role;
            this._stemMutes[id] = false;
            this._stemSolos[id] = false;
            loadedStems.push(id);

            if (id === 'vocals') hasVocals = true;

            console.log(`✅ [gen=${gen}] ${id.toUpperCase()} loaded: ${result.value.stem.duration.toFixed(2)}s`);
          } else {
            if (id === 'vocals') {
              console.warn(`⚠️ Vocals load failed, instrumental-only mode:`, result.reason?.message ?? result.reason);
            } else {
              console.warn(`⚠️ Stem '${id}' load failed:`, result.reason?.message ?? result.reason);
            }
          }
        }

        if (gen !== this._loadGeneration) {
          console.debug(`🛑 [gen=${gen}] Stale before routing`);
          throw new DOMException('Load superseded', 'AbortError');
        }

        this._programSources.clear();
        this._rebuildFullRouting();
        this.stems.forEach(s => s.setPlaybackRate(this._playbackRate));
        this._notifyTrackLoaded(loadedStems, hasVocals);

        return { duration: this._duration, loadedStems, hasVocals };
      }

      // ═══════════════════════════════════════════════════════
      // PROGRESSIVE PATH — Phase 1: instrumental only
      // ═══════════════════════════════════════════════════════
      this._programSources.clear();
      this._rebuildFullRouting(); // ✅ Safe with instrumental-only (SCAN-8.V1)
      this.stems.forEach(s => s.setPlaybackRate(this._playbackRate));

      // TC-10.5: Do NOT mute instrumental during Phase 1.
      // Instrumental plays normally until Phase 2 completes and stems are ready.
      // TC-10.1 (Phase 2 complete) handles mute/unmute after stems load.
      // This prevents "vocals only" gap during track switch.

      const phase1Stems = ['instrumental'];
      this._notifyTrackLoaded(phase1Stems, false);

      console.log(`🚀 [gen=${gen}] Phase 1 complete: instrumental only → playback ready`);

      // ★2 Fire-and-forget Phase 2 with abort signal
      this._runPhase2(gen, this._phase2Abort!.signal, vocalsUrl, additionalStems);

      return { duration: this._duration, loadedStems: phase1Stems, hasVocals: false };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.debug(`🛑 [gen=${gen}] Load aborted/superseded`);
      }
      throw err;
    }
  }

  // ============================================================
  // ROUTING
  // ============================================================

  // ============================================================
  // ROUTING (W1a: three-method decomposition)
  // ============================================================

  /**
   * Full routing rebuild — called ONLY at loadTrack().
   * Disconnects everything, reconnects based on StemRole routing.
   */
  private _rebuildFullRouting(): void {
    const ctx = getAudioContext();
    const masterGains: GainNode[] = [];  // master-bus stems (instrumental)
    const musicGains: GainNode[] = [];   // music-bus stems
    const vocalGains: GainNode[] = [];   // vocal-bus stems (vocal + backing)
    const fxGains: GainNode[] = [];      // fx-bus stems (future)

    // STEP 0 (W3): Disconnect and clear old bus gain nodes
    this._buses.forEach(bus => { try { bus.gainNode.disconnect(); } catch (_) {} });
    this._buses.clear();

    // STEP 0.5 (W3): Create fresh bus gain nodes for this track
    const busIds: RoutingTarget[] = ['master-bus', 'music-bus', 'vocal-bus', 'fx-bus'];
    for (const busId of busIds) {
      const gainNode = ctx.createGain();
      gainNode.gain.value = 1; // unity — summing point for program capture (W3.4)
      this._buses.set(busId, { gainNode, stemIds: new Set() });
      // Init bus volume to 1.0 if not already set (preserves existing value across rebuilds)
      if (this._busVolumes[busId] === undefined) {
        this._busVolumes[busId] = 1;
      }
    }

    // STEP 1: Disconnect all stems from their current destinations.
    // IMPORTANT: For instrumental, we only disconnect _masterVolumeGain from
    // its downstream destination — NOT instStem.gainNode from _masterVolumeGain.
    // That connection (established in loadTrack) must survive rebuilds.
    this.stems.forEach((stem, id) => {
      if (id === 'instrumental' && this._masterVolumeGain) {
        // Only disconnect the downstream end of masterVolumeGain
        try { this._masterVolumeGain.disconnect(); } catch (_) {}
      } else {
        stem.disconnect();
      }

      const role = this._stemRoles[id];
      const bus = role ? ROLE_ROUTING[role] : 'music-bus'; // default fallback

      // Track which stem belongs to which bus (W3)
      const busEntry = this._buses.get(bus);
      if (busEntry) busEntry.stemIds.add(id);

      // Init stem volume to 1.0 if not already set
      if (this._stemVolumes[id] === undefined) {
        this._stemVolumes[id] = 1;
      }

      switch (bus) {
        case 'master-bus':
          // Master stem: connect via masterVolumeGain (mute invariant A2.25)
          if (id === 'instrumental' && this._masterVolumeGain) {
            masterGains.push(this._masterVolumeGain);
          } else {
            masterGains.push(stem.gainNode);
          }
          break;
        case 'music-bus':
          musicGains.push(stem.gainNode);
          break;
        case 'vocal-bus':
          vocalGains.push(stem.gainNode);
          break;
        case 'fx-bus':
          fxGains.push(stem.gainNode);
          break;
      }
    });

    // STEP 2: Reconnect stems to VocalMix
    // For now: master + music = "music" gains, vocal + backing = "vocals" gains
    // This preserves current VocalMix behavior while we await W2 group bus architecture
    const allMusicGains = [...masterGains, ...musicGains];
    const mainVocalGain = vocalGains.length > 0 ? vocalGains[0] : null;

    this.vocalMix.updateRouting(
      allMusicGains,
      mainVocalGain,
      this.microphone.enabled ? this.microphone.gainNode : null,
      ctx.destination
    );

    // Connect additional vocal-bus stems (backing, etc.) to VocalMix
    // They route to the same channels as main vocal
    if (vocalGains.length > 1) {
      for (let i = 1; i < vocalGains.length; i++) {
        if (this.vocalMix.enabled) {
          vocalGains[i].connect(this.vocalMix.merger, 0, 0); // L (same as vocal)
        } else {
          vocalGains[i].connect(this.vocalMix.merger, 0, 0); // L
          vocalGains[i].connect(this.vocalMix.merger, 0, 1); // R
        }
      }
    }

    // Connect fx-bus stems (future — for now just passthrough)
    fxGains.forEach(g => {
      g.connect(ctx.destination);
    });

    // STEP 2.5 (W3): Connect parallel bus taps — AFTER VocalMix.updateRouting().
    // CRITICAL: Must be called AFTER VocalMix.updateRouting() because that method
    // calls gainNode.disconnect() which kills ALL outputs including bus taps.
    // By connecting here, we add bus taps on top of the already-working merger path.
    this._reconnectBusTaps();

    // W5: Create analysers for metering (parallel taps, not in signal path)
    this._reconnectAnalysers();

    // STEP 2.6 (W3.2): Apply effective gain for all stems — ensures gainNode.gain
    // is consistent with _stemVolumes × _busVolumes after routing rebuild.
    this.stems.forEach((_, id) => this._applyEffectiveGain(id));

    // STEP 3: Reconnect to Program Capture Bus (MUST BE LAST!)
    this._reconnectProgramBus();
  }

  /**
   * Update only VocalMix routing — called on enableVocalMix/disableVocalMix.
   * Does NOT disconnect stems from their buses.
   */
  private _updateVocalMixRouting(): void {
    const ctx = getAudioContext();
    const masterGains: GainNode[] = [];
    const musicGains: GainNode[] = [];
    const vocalGains: GainNode[] = [];

    // Disconnect stems — preserve masterVolumeGain upstream connection
    this.stems.forEach((stem, id) => {
      if (id === 'instrumental' && this._masterVolumeGain) {
        try { this._masterVolumeGain.disconnect(); } catch (_) {}
      } else {
        stem.disconnect();
      }

      const role = this._stemRoles[id];
      const bus = role ? ROLE_ROUTING[role] : 'music-bus';

      switch (bus) {
        case 'master-bus':
          if (id === 'instrumental' && this._masterVolumeGain) {
            masterGains.push(this._masterVolumeGain);
          } else {
            masterGains.push(stem.gainNode);
          }
          break;
        case 'music-bus':
          musicGains.push(stem.gainNode);
          break;
        case 'vocal-bus':
          vocalGains.push(stem.gainNode);
          break;
      }
    });

    const allMusicGains = [...masterGains, ...musicGains];
    const mainVocalGain = vocalGains.length > 0 ? vocalGains[0] : null;

    this.vocalMix.updateRouting(
      allMusicGains,
      mainVocalGain,
      this.microphone.enabled ? this.microphone.gainNode : null,
      ctx.destination
    );

    // Reconnect additional vocal-bus stems
    if (vocalGains.length > 1) {
      for (let i = 1; i < vocalGains.length; i++) {
        if (this.vocalMix.enabled) {
          vocalGains[i].connect(this.vocalMix.merger, 0, 0);
        } else {
          vocalGains[i].connect(this.vocalMix.merger, 0, 0);
          vocalGains[i].connect(this.vocalMix.merger, 0, 1);
        }
      }
    }

    // Reconnect Program Bus
    this._reconnectProgramBus();

    // W3: Reconnect bus taps (killed by stem.disconnect() above)
    this._reconnectBusTaps();

    // W5: Reconnect analysers (killed by stem.disconnect() above)
    this._reconnectAnalysers();

    // W3.2: Re-apply effective gain (killed by stem.disconnect() + VocalMix.updateRouting())
    this.stems.forEach((_, id) => this._applyEffectiveGain(id));
  }

  /**
   * Update only microphone routing — called on enableMicrophone/disableMicrophone.
   * Does NOT disconnect stems from their buses.
   */
  private _updateMicRouting(): void {
    // Mic routing is handled by VocalMix — just update the routing
    // This is lighter than full rebuild because stems stay connected
    this._updateVocalMixRouting();
  }

  /**
   * Reconnect stems/sources to Program Capture Bus.
   * Called after any routing change.
   *
   * W3.4: Program Capture reads from bus gainNodes, NOT from VocalMix merger or stem gainNodes.
   * Doctrine: V-Mix stereo separation is a monitor comfort transform, NOT program truth.
   * Recording must capture clean stems (with effective gain) without V-Mix stereo transform.
   */
  private _reconnectProgramBus(): void {
    const dest = this._programCaptureDest;
    if (!dest) return;

    // STEP 1: Disconnect ALL current sources from program bus
    try { this.vocalMix.merger.disconnect(dest); } catch (_) {}
    this.stems.forEach(s => {
      try { s.gainNode.disconnect(dest); } catch (_) {}
    });
    if (this._masterVolumeGain) {
      try { this._masterVolumeGain.disconnect(dest); } catch (_) {}
    }
    // W3.4: Disconnect bus gainNodes from program capture
    this._buses.forEach(bus => {
      try { bus.gainNode.disconnect(dest); } catch (_) {}
    });

    // STEP 2: Connect VocalMix merger to program capture
    // NEW: Program Capture = Monitor Output
    try { this.vocalMix.merger.connect(dest); } catch (_) {}

    // STEP 3: Connect external program sources (preview, compare, exercise cues)
    this._programSources.forEach((opts, node) => {
      try { node.connect(dest); } catch (_) {}
    });

    // STEP 4: Connect microphone if capture-enabled
    // NEW: Mic already in merger via VocalMix.updateRouting — direct connection NOT needed
    // Otherwise mic will be doubled in recording!
  }

  // ── W3: Group Bus Methods ────────────────────────────────

  /**
   * Connect each stem's gainNode to its bus gainNode as a PARALLEL tap.
   *
   * CRITICAL: Must be called AFTER VocalMix.updateRouting() because that method
   * calls gainNode.disconnect() which kills ALL outputs. By connecting here,
   * we add bus taps on top of the already-working merger path.
   *
   * Architecture:
   *   gainNode ───┬───→ merger (primary path — untouched)
   *               └───→ bus.gainNode (parallel tap — for bus control)
   */
  private _reconnectBusTaps(): void {
    this.stems.forEach((stem, id) => {
      const role = this._stemRoles[id];
      const busId: RoutingTarget = role ? ROLE_ROUTING[role] : 'music-bus';
      const bus = this._buses.get(busId);
      if (!bus) return;

      // For instrumental: connect masterVolumeGain to master-bus (parallel tap)
      // For all others: connect stem.gainNode to their bus (parallel tap)
      if (id === 'instrumental' && this._masterVolumeGain) {
        try { this._masterVolumeGain.connect(bus.gainNode); } catch (_) {}
      } else {
        try { stem.gainNode.connect(bus.gainNode); } catch (_) {}
      }
    });
  }

  /** Get bus gainNode by RoutingTarget */
  getBusGainNode(busId: RoutingTarget): GainNode | null {
    return this._buses.get(busId)?.gainNode ?? null;
  }

  /**
   * W5: Create/reconnect AnalyserNodes for each stem — parallel taps from gainNode.
   * Analyser is NOT in the signal path — it only reads levels for VU meters.
   * Architecture:
   *   gainNode ───┬───→ merger (primary path)
   *               ├───→ bus.gainNode (parallel tap for program capture)
   *               └───→ analyser (parallel tap for metering — no output)
   */
  private _reconnectAnalysers(): void {
    const ctx = getAudioContext();

    // Disconnect old analysers
    this._analysers.forEach(a => { try { a.disconnect(); } catch (_) {} });
    this._analysers.clear();

    this.stems.forEach((stem, id) => {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      this._analysers.set(id, analyser);

      // Parallel tap: gainNode → analyser (no output — read-only)
      if (id === 'instrumental' && this._masterVolumeGain) {
        try { this._masterVolumeGain.connect(analyser); } catch (_) {}
      } else {
        try { stem.gainNode.connect(analyser); } catch (_) {}
      }
    });
  }

  /**
   * Connect a single stem to: bus tap + analyser + program capture + effective gain.
   * Called by _rebuildFullRouting() and _addStemToRouting().
   *
   * ⚠️ OI-1: Does NOT touch sourceNode — only gainNode connections.
   * ⚠️ OI-3: Does NOT call gainNode.disconnect() — caller must handle that.
   * ⚠️ Does NOT connect to VocalMix merger — that's handled separately.
   */
  private _connectSingleStem(stemId: string): void {
    const stem = this.stems.get(stemId);
    if (!stem?.loaded || !stem.gainNode) return;

    const role = this._stemRoles[stemId];
    const ctx = getAudioContext();

    // Step 1: Connect to bus (parallel tap)
    const busId: RoutingTarget = role ? ROLE_ROUTING[role] : 'music-bus';
    const bus = this._buses.get(busId);
    if (bus) {
      bus.stemIds.add(stemId);
      if (stemId === 'instrumental' && this._masterVolumeGain) {
        try { this._masterVolumeGain.connect(bus.gainNode); } catch (_) {}
      } else {
        try { stem.gainNode.connect(bus.gainNode); } catch (_) {}
      }
    }

    // Step 2: Create analyser (parallel tap)
    if (!this._analysers.has(stemId)) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      this._analysers.set(stemId, analyser);
    }
    const analyser = this._analysers.get(stemId)!;
    if (stemId === 'instrumental' && this._masterVolumeGain) {
      try { this._masterVolumeGain.connect(analyser); } catch (_) {}
    } else {
      try { stem.gainNode.connect(analyser); } catch (_) {}
    }

    // Step 3: Program capture (via bus)
    if (this._programCaptureDest && bus) {
      try { bus.gainNode.connect(this._programCaptureDest); } catch (_) {}
    }

    // Step 4: Init state + apply effective gain
    if (this._stemVolumes[stemId] === undefined) this._stemVolumes[stemId] = 1;
    this._applyEffectiveGain(stemId);
  }

  /**
   * Incrementally add a stem to the audio graph during playback.
   *
   * ⚠️ OI-1: Does NOT call sourceNode.disconnect()
   * ⚠️ OI-3: Does NOT call gainNode.disconnect() on OTHER stems
   * ⚠️ Connects directly to merger (bypasses VocalMix.updateRouting to avoid killing all outputs)
   */
  private _addStemToRouting(stemId: string): void {
    const stem = this.stems.get(stemId);
    if (!stem?.loaded || !stem.gainNode) return;

    const role = this._stemRoles[stemId];

    // Direct merger connection (NO VocalMix.updateRouting — would kill all outputs!)
    if (role === 'vocal' || role === 'backing') {
      if (this.vocalMix.enabled) {
        stem.gainNode.connect(this.vocalMix.merger, 0, 0); // L only
      } else {
        stem.gainNode.connect(this.vocalMix.merger, 0, 0); // L
        stem.gainNode.connect(this.vocalMix.merger, 0, 1); // R
      }
    } else if (role === 'effect') {
      stem.gainNode.connect(getAudioContext().destination); // bypass merger
    } else {
      // music, master → both channels
      stem.gainNode.connect(this.vocalMix.merger, 0, 0);
      stem.gainNode.connect(this.vocalMix.merger, 0, 1);
    }

    // Bus taps + analysers + program capture + gain
    this._connectSingleStem(stemId);
  }

  /**
   * Hot-plug a stem during playback with anti-pop fade-in and playbackRate sync.
   *
   * OI-6: stem.setPlaybackRate(this._playbackRate) MUST be called before stem.play()
   * If play fails — mark as pending, apply on next play()
   *
   * ★3 stemsEnabled-aware volume: music stems muted when stemsEnabled=false
   * ★4 Update _trackUrls for hybridEngine/SyncEditor compat
   * ★10 Typed access via stem.cleanBlobUrl instead of any-cast
   */
  private _hotPlugStem(stemId: string): void {
    const stem = this.stems.get(stemId);
    if (!stem?.loaded) return;

    const ctx = getAudioContext();
    const instTime = this.getCurrentTime();

    // Incremental routing (no full rebuild!)
    this._addStemToRouting(stemId);

    // Sync time with master
    stem.setCurrentTime(instTime);

    // ★ OI-6: playbackRate sync — CRITICAL for BPM!
    stem.setPlaybackRate(this._playbackRate);

    // ★4 Update _trackUrls for hybridEngine/SyncEditor compat
    const stemBlobUrl = stem.cleanBlobUrl; // ★10 Typed access instead of any-cast
    if (stemBlobUrl) {
      this._trackUrls[stemId] = stemBlobUrl;
    }

    // ★3 stemsEnabled-aware volume: music stems muted when stemsEnabled=false
    const isMusicStem = stemId !== 'instrumental' && stemId !== 'vocals';
    const rawVol = this._stemVolumes[stemId] ?? 1;
    const targetVol = (isMusicStem && !this._stemsEnabled) ? 0 : rawVol;

    if (this._isPlaying) {
      // PLAYING: anti-pop fade-in
      stem.gainNode.gain.setValueAtTime(0, ctx.currentTime);

      try {
        stem.play().catch(() => {
          (stem as any)._pendingHotPlug = true;
        });

        // 50ms fade-in (anti-pop)
        stem.gainNode.gain.linearRampToValueAtTime(
          targetVol,
          ctx.currentTime + 0.05
        );
      } catch (e) {
        console.warn(`[HotPlug] Failed for ${stemId}, pending next play()`, e);
        (stem as any)._pendingHotPlug = true;
      }
    } else {
      // PAUSED: correct volume, don't play
      stem.gainNode.gain.value = targetVol;
    }

    // Notify awaitStemReady resolvers
    this._notifyStemReady(stemId);
  }

  /**
   * Phase 2: Load vocals + additional stems in background.
   * Fire-and-forget — DO NOT await in loadTrack().
   *
   * ★2 Uses signal.aborted + gen-check to detect stale loads.
   * ★1 Duplicate vocals guard: skip additionalStems.vocals if vocalsUrl provided.
   * ★3 stemsEnabled volume policy applied inside _hotPlugStem().
   * ★8 All-failed logging.
   */
  private _runPhase2(
    gen: number,
    signal: AbortSignal,
    vocalsUrl: string | null,
    additionalStems?: StemLoadMap
  ): void {
    const phase2Stems: Array<{ id: string; url?: string; data?: ArrayBuffer; type?: string; role: StemRole }> = [];

    // ★1 Duplicate vocals guard — only add vocalsUrl if not already in additionalStems
    const vocalsInAdditional = additionalStems && 'vocals' in additionalStems;
    if (vocalsUrl && !vocalsInAdditional) {
      phase2Stems.push({ id: 'vocals', url: vocalsUrl, role: 'vocal' });
    }

    if (additionalStems) {
      for (const [id, entry] of Object.entries(additionalStems)) {
        if (entry.url) this._trackUrls[id] = entry.url;
        phase2Stems.push({ id, url: entry.url, data: entry.data, type: entry.type, role: entry.role });
      }
    }

    if (phase2Stems.length === 0) {
      // Nothing to load — emit fully-loaded immediately
      document.dispatchEvent(new CustomEvent('track-fully-loaded', {
        detail: { duration: this._duration, loadedStems: ['instrumental'], hasVocals: false }
      }));
      return;
    }

    console.log(`🔄 [gen=${gen}] Phase 2 starting: ${phase2Stems.length} stems to load`);

    // Fire-and-forget: load each stem, hot-plug on ready
    Promise.allSettled(
      phase2Stems.map(async ({ id, url, data, type, role }) => {
        const stem = new StemPlayer(id);
        const skipDecode = role !== 'vocal';

        if (data) {
          await stem.loadFromArrayBuffer(data, type || 'audio/mpeg', signal, skipDecode);
        } else if (url) {
          await stem.load(url, signal, skipDecode);
        } else {
          throw new Error(`StemLoadEntry '${id}' has neither url nor data`);
        }

        // ★2 Hard abort check — if track switched, dispose and bail
        if (gen !== this._loadGeneration || signal.aborted) {
          stem.disconnect();
          stem.dispose();
          throw new DOMException('Load superseded', 'AbortError');
        }

        // Add to stems map
        this.stems.set(id, stem);
        this._stemRoles[id] = role;
        this._stemMutes[id] = false;
        this._stemSolos[id] = false;

        console.log(`✅ [gen=${gen}] Phase 2: ${id.toUpperCase()} loaded`);

        // Hot-plug into audio graph
        this._hotPlugStem(id);

        return { id, stem, role };
      })
    ).then((results) => {
      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      // ★8 All-failed logging
      if (failed.length === results.length) {
        console.error(`❌ [gen=${gen}] Phase 2: ALL ${results.length} stems failed to load`);
      } else if (failed.length > 0) {
        console.warn(`⚠️ [gen=${gen}] Phase 2: ${failed.length}/${results.length} stems failed`);
      }

      const loadedStems = ['instrumental', ...succeeded.map(r => (r as PromiseFulfilledResult<any>).value.id)];
      const hasVocals = loadedStems.includes('vocals');

      // Emit fully-loaded event
      document.dispatchEvent(new CustomEvent('track-fully-loaded', {
        detail: { duration: this._duration, loadedStems, hasVocals }
      }));

      // ★3.1 Если stemsEnabled=true и есть music stems → mute instrumental
      if (this._stemsEnabled) {
        const hasMusicStems = loadedStems.some(
          id => id !== 'instrumental' && id !== 'vocals'
        );
        if (hasMusicStems) {
          this.setStemVolume('instrumental', 0);
          // Unmute stems (hot-plug мог замьютить их)
          for (const id of loadedStems) {
            if (id !== 'instrumental' && id !== 'vocals') {
              this.setStemVolume(id, 1);
            }
          }
          this.setStemVolume('vocals', 1);
        }
      }

      console.log(`🏁 [gen=${gen}] Phase 2 complete: ${loadedStems.length} stems total`);
    });
  }

  /** Get all bus IDs that have stems assigned */
  getActiveBusIds(): RoutingTarget[] {
    return Array.from(this._buses.entries())
      .filter(([_, bus]) => bus.stemIds.size > 0)
      .map(([busId]) => busId);
  }

  /** Get stem IDs for a given bus */
  getBusStemIds(busId: RoutingTarget): string[] {
    return Array.from(this._buses.get(busId)?.stemIds ?? []);
  }

  /** Set bus volume (W3.2). Stores raw bus volume + recomputes effective gain for all stems in bus. */
  setBusVolume(busId: RoutingTarget, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this._busVolumes[busId] = clamped;
    // bus.gainNode.gain stays at 1.0 (unity) — it's a summing point for program capture (W3.4).
    // Volume control is applied via _applyEffectiveGain on stem gainNodes.
    const bus = this._buses.get(busId);
    if (!bus) return;
    bus.stemIds.forEach(stemId => this._applyEffectiveGain(stemId));
  }

  /** Get bus volume (W3.2) — returns raw bus volume from _busVolumes */
  getBusVolume(busId: RoutingTarget): number {
    return this._busVolumes[busId] ?? 1;
  }

  // ============================================================
  // VOLUME
  // ============================================================

  // ============================================================
  // VOLUME (W1a: generic + backward compat)
  // ============================================================

  /**
   * Set volume for any stem by ID.
   * Stores raw stem volume in _stemVolumes, then applies effective gain (stem × bus).
   * For master stem (instrumental): sets masterVolumeGain (mute invariant A2.25).
   * For all others: sets stem.gainNode directly.
   */
  setStemVolume(stemId: string, v: number): void {
    const clamped = Math.max(0, Math.min(1, v));
    this._stemVolumes[stemId] = clamped;
    this._applyEffectiveGain(stemId);
  }

  /**
   * Get raw stem volume by ID (from _stemVolumes, NOT gainNode.gain which includes bus multiplier).
   */
  getStemVolume(stemId: string): number {
    return this._stemVolumes[stemId] ?? 1;
  }

  /**
   * Mute a stem. For master (instrumental): sets masterVolumeGain to 0.
   * INVARIANT: master stem audio element is NEVER paused — only volume gain changes.
   */
  setStemMute(stemId: string, mute: boolean): void {
    this._stemMutes[stemId] = mute;
    // Delegate to _applyEffectiveGain which handles mute + bus volume
    this._applyEffectiveGain(stemId);
  }

  /**
   * Toggle mute for a stem.
   */
  toggleStemMute(stemId: string): void {
    this.setStemMute(stemId, !this._stemMutes[stemId]);
  }

  /**
   * Solo a stem. When soloed, all other stems are muted.
   */
  setStemSolo(stemId: string, solo: boolean): void {
    this._stemSolos[stemId] = solo;

    // Re-apply effective mute for all stems
    this.stems.forEach((_, id) => {
      this._applyEffectiveMute(id);
    });
  }

  /**
   * Toggle solo for a stem.
   */
  toggleStemSolo(stemId: string): void {
    this.setStemSolo(stemId, !this._stemSolos[stemId]);
  }

  /**
   * Apply effective gain considering stem volume, bus volume, and mute/solo state.
   * Formula: effectiveGain = stemVolume × busVolume × (muted ? 0 : 1)
   *
   * For instrumental: sets masterVolumeGain (NOT gainNode — clock tap invariant A2.25).
   * For all others: sets stem.gainNode.gain directly.
   */
  private _applyEffectiveGain(stemId: string): void {
    const anySoloed = Object.values(this._stemSolos).some(s => s);
    const isSoloed = this._stemSolos[stemId] === true;
    const isMuted = this._stemMutes[stemId] === true;
    const effectiveMute = isMuted || (anySoloed && !isSoloed);

    const stemVolume = this._stemVolumes[stemId] ?? 1;
    const role = this._stemRoles[stemId];
    const busId: RoutingTarget = role ? ROLE_ROUTING[role] : 'music-bus';
    const busVolume = this._busVolumes[busId] ?? 1;
    const effectiveGain = effectiveMute ? 0 : stemVolume * busVolume;

    if (stemId === 'instrumental') {
      // Master mute invariant (A2.25): set masterVolumeGain, NOT gainNode (clock tap)
      if (this._masterVolumeGain) {
        this._masterVolumeGain.gain.value = effectiveGain;
      }
      return;
    }

    const stem = this.stems.get(stemId);
    if (stem) {
      stem.gainNode.gain.value = effectiveGain;
    }
  }

  /**
   * Apply effective mute — now delegates to _applyEffectiveGain which handles mute/solo + bus volume.
   * Kept for readability — all mute/solo changes route through here to _applyEffectiveGain.
   */
  private _applyEffectiveMute(stemId: string): void {
    this._applyEffectiveGain(stemId);
  }

  /** Get mute state for a stem */
  getStemMute(stemId: string): boolean { return this._stemMutes[stemId] ?? false; }
  /** Get solo state for a stem */
  getStemSolo(stemId: string): boolean { return this._stemSolos[stemId] ?? false; }
  /** Get role for a stem */
  getStemRole(stemId: string): StemRole | undefined { return this._stemRoles[stemId]; }
  /** Get all loaded stem IDs */
  /** Get RMS meter level for a stem (0-1). Used by MixerPanel VU meters. */
  getStemMeterLevel(stemId: string): number {
    const analyser = this._analysers.get(stemId);
    if (!analyser) return 0;
    // TC-13-08: Cached buffer — eliminates ~1.68MB/sec GC pressure
    let data = this._meterBuffers.get(stemId);
    if (!data || data.length !== analyser.fftSize) {
      data = new Float32Array(analyser.fftSize);
      this._meterBuffers.set(stemId, data);
    }
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  /** Get per-stem AnalyserNode for direct frequency data access (Visual Mixer canvas waveforms) */
  getStemAnalyser(stemId: string): AnalyserNode | null {
    return this._analysers.get(stemId) ?? null;
  }

  getLoadedStemIds(): string[] { return Array.from(this.stems.keys()); }

  // ── Backward compat volume methods ──

  setInstrumentalVolume(v: number): void {
    this.setStemVolume('instrumental', v);
  }

  setVocalsVolume(v: number): void {
    this.setStemVolume('vocals', v);
  }

  setMicrophoneVolume(v: number): void {
    this.microphone.setVolume(v);
  }

  /** Get stem source node by ID (generic accessor) */
  getStemSourceNode(stemId: string): MediaElementAudioSourceNode | null {
    return this.stems.get(stemId)?.sourceNode ?? null;
  }

  /** Get stem AudioBuffer by ID (generic accessor) */
  getStemAudioBuffer(stemId: string): AudioBuffer | null {
    return this.stems.get(stemId)?.audioBuffer ?? null;
  }

  /** Vocal stem source node for external routing (MonitorMix). Backward compat. */
  getVocalSourceNode(): MediaElementAudioSourceNode | null {
    return this.getStemSourceNode('vocals');
  }

  /** Vocal stem AudioBuffer for external processing. Backward compat. */
  getVocalAudioBuffer(): AudioBuffer | null {
    return this.getStemAudioBuffer('vocals');
  }

  /**
   * TC-DS-08-FIX: Ensure instrumental AudioBuffer is decoded (lazy).
   * Returns cached buffer or decodes from blobUrl on demand.
   */
  async ensureInstrumentalBuffer(): Promise<AudioBuffer | null> {
    const stem = this.stems.get('instrumental');
    return stem?.ensureAudioBuffer() ?? null;
  }

  /**
   * TC-DS-08-FIX-7: Ensure vocals AudioBuffer is decoded (lazy).
   * Returns cached buffer or decodes from blobUrl on demand.
   */
  async ensureVocalsBuffer(): Promise<AudioBuffer | null> {
    const stem = this.stems.get('vocals');
    return stem?.ensureAudioBuffer() ?? null;
  }

  // === awaitStemReady (event-based) ===
  private _stemReadyResolvers = new Map<string, (value: boolean) => void>();

  public async awaitStemReady(stemId: string, timeoutMs = 10000): Promise<boolean> {
    const stem = this.stems.get(stemId);
    if (stem?.loaded) return true;

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        this._stemReadyResolvers.delete(stemId);
        console.warn(`[AudioEngine] awaitStemReady('${stemId}') timed out after ${timeoutMs}ms`);
        resolve(false);
      }, timeoutMs);

      this._stemReadyResolvers.set(stemId, (value: boolean) => {
        clearTimeout(timeout);
        this._stemReadyResolvers.delete(stemId);
        resolve(value);
      });
    });
  }

  // ВНИМАНИЕ: _notifyStemReady(stemId) ДОЛЖЕН вызываться в:
  // 1. Phase 2 loadTrack() — сразу после this.stems.set(id, stem) и успешного hot-plug
  // 2. loadAdditionalStems() — после добавления стема
  // Без этого вызова awaitStemReady() всегда будет таймаутиться!
  private _notifyStemReady(stemId: string): void {
    const resolver = this._stemReadyResolvers.get(stemId);
    if (resolver) resolver(true);
  }

  // ============================================================
  // LOOP
  // ============================================================

  get loopActive(): boolean { return this._loopActive; }
  get loopStart(): number | null { return this._loopActive ? this._loopStart : null; }
  get loopEnd(): number | null { return this._loopActive ? this._loopEnd : null; }

  setLoop(start: number, end: number): boolean {
    if (isNaN(start) || isNaN(end) || start < 0 || end <= start) return false;
    this._loopStart = Math.max(0, Math.min(start, this._duration));
    this._loopEnd = Math.min(end, this._duration);
    this._loopActive = true;
    this._startLoopCheck();
    document.dispatchEvent(new CustomEvent('loop-set', {
      detail: { startTime: this._loopStart, endTime: this._loopEnd },
    }));
    return true;
  }

  clearLoop(): boolean {
    const wasActive = this._loopActive;
    this._stopLoopCheck();
    this._loopActive = false;
    this._loopStart = 0;
    this._loopEnd = 0;
    document.dispatchEvent(new CustomEvent('loop-cleared', {
      detail: { time: this.getCurrentTime(), wasActive },
    }));
    return true;
  }

  /**
   * Two-phase loop check (W1b).
   *
   * Phase 1 (pre-seek): Before master reaches loopEnd, seek all followers
   * to loopStart. Wait for 'seeked' events. Set _followersPreloaded = true.
   *
   * Phase 2 (jump): When master >= loopEnd, seek master to loopStart +
   * play all stems atomically. If followers preloaded: near-zero glitch.
   * If not preloaded (timeout): fall back to hard resync.
   *
   * Short-loop guard: PRE_SEEK_AHEAD_MS = min(500, loopDuration * 0.3)
   * Prevents pre-seek overlap on short exercise blocks.
   */
  private _startLoopCheck(): void {
    this._stopLoopCheck();
    this._followersPreloaded = false;
    this._preSeekScheduled = false;

    this._loopCheckInterval = setInterval(() => {
      if (!this._loopActive || !this._isPlaying) return;
      const now = this.getCurrentTime();
      const loopDuration = this._loopEnd - this._loopStart;

      // Calculate pre-seek ahead time with short-loop guard
      const preSeekAheadMs = Math.min(
        LOOP_PRE_SEEK_MAX_MS,
        loopDuration * 1000 * LOOP_PRE_SEEK_DURATION_RATIO
      );
      const preSeekAheadSec = preSeekAheadMs / 1000;

      // ── Phase 1: Pre-seek followers (Variant F: gain-mute, not pause) ──
      // Skip pre-seek for very short loops — not enough time, lightweight jump is better
      if (
        loopDuration >= AudioEngineV2._LOOP_PRE_SEEK_MIN_DURATION &&
        !this._followersPreloaded &&
        !this._preSeekScheduled &&
        now >= this._loopEnd - preSeekAheadSec &&
        now < this._loopEnd - 0.01
      ) {
        this._schedulePreSeek();
      }

      // ── Phase 2: Loop jump ──
      // Guard: skip if last jump was too recent (prevents interval spam on short loops)
      if (now >= this._loopEnd - 0.01) {
        const elapsedSinceLastJump = performance.now() - this._lastLoopJumpTime;
        if (elapsedSinceLastJump >= AudioEngineV2._LOOP_JUMP_COOLDOWN_MS) {
          this._executeLoopJump(now);
        }
      }
    }, 50);
  }

  /**
   * Phase 1: Pre-seek all followers to loopStart with gain-mute (Variant F).
   * - Seek followers to loopStart
   * - Mute followers via gainNode.gain.setTargetAtTime(0) — smooth 5ms fade
   * - Followers keep playing (audio.currentTime advances, drift monitor sees valid data)
   * - Track silenced stems so drift monitor skips them
   */
  private _schedulePreSeek(): void {
    if (this._preSeekScheduled) return;
    this._preSeekScheduled = true;

    const loopStart = this._loopStart;
    const ctx = getAudioContext();

    // Seek all followers to loopStart and gain-mute them
    const seekPromises: Promise<void>[] = [];
    this.stems.forEach((stem, id) => {
      if (id === 'instrumental') return; // master — skip
      if (!stem.loaded) return;

      // Save current volume for later restore
      this._preSeekSavedVolumes.set(id, stem.gainNode.gain.value);

      // Seek to loopStart
      stem.setCurrentTime(loopStart);
      seekPromises.push(this._waitForSeeked(stem));

      // Smooth gain-mute: 5ms exponential fade to 0 (prevents click)
      stem.gainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.005);

      // Track as silenced (drift monitor will skip)
      this._preSeekSilencedStems.add(id);
    });

    // Wait for all followers to seek, with timeout
    const seekTimeout = new Promise<void>((resolve) => {
      this._loopPreSeekWaitTimeout = setTimeout(() => {
        console.warn(`[LOOP] Pre-seek timeout after ${LOOP_PRE_SEEK_TIMEOUT_MS}ms`);
        this._followersPreloaded = false;
        this._loopPreSeekWaitTimeout = null;
        resolve();
      }, LOOP_PRE_SEEK_TIMEOUT_MS);
    });

    Promise.race([Promise.all(seekPromises), seekTimeout]).then(() => {
      if (this._loopPreSeekWaitTimeout !== null) {
        clearTimeout(this._loopPreSeekWaitTimeout);
        this._loopPreSeekWaitTimeout = null;
      }

      // Check if all followers actually arrived
      let allReady = true;
      this.stems.forEach((stem, id) => {
        if (id === 'instrumental') return;
        if (!stem.loaded) return;
        const drift = Math.abs(stem.getCurrentTime() - loopStart);
        if (drift > 0.05) { // 50ms tolerance
          allReady = false;
        }
      });

      this._followersPreloaded = allReady;
      if (allReady && this._loopJumpCount === 0) {
        console.log(`[LOOP] Followers preloaded + gain-muted at ${loopStart.toFixed(3)}s`);
      }
    });
  }

  /**
   * Phase 2: Execute the loop jump (Variant F).
   * If followers preloaded: re-align + smooth gain-unmute + master seek.
   * If not: lightweight seek all stems (no pause/resume cycle).
   *
   * Called from _startLoopCheck interval with cooldown guard.
   */
  private _executeLoopJump(now: number): void {
    const target = this._loopStart + 0.005;
    const ctx = getAudioContext();
    const jumpNum = ++this._loopJumpCount;

    if (this._followersPreloaded) {
      // Variant F path: followers at loopStart but gain-muted
      // 1. Seek master to loopStart
      const master = this.stems.get('instrumental');
      if (master?.audio) {
        master.setCurrentTime(target);
      }

      // 2. Re-align followers (they played forward from loopStart during pre-seek)
      //    and smooth gain-unmute
      this.stems.forEach((stem, id) => {
        if (id === 'instrumental') return;
        if (!stem.loaded) return;

        // Re-align to master position
        stem.setCurrentTime(target);

        // Smooth gain-unmute: 5ms exponential fade to original volume
        const savedVol = this._preSeekSavedVolumes.get(id) ?? 1;
        stem.gainNode.gain.setTargetAtTime(savedVol, ctx.currentTime, 0.005);
      });

      if (jumpNum === 1 || jumpNum % 10 === 0) {
        console.log(`[LOOP] #${jumpNum} Atomic jump → ${target.toFixed(3)}s`);
      }
    } else {
      // Fallback: lightweight loop seek — NO pause/resume cycle.
      this._restoreSilencedStems();

      // Seek all stems to loopStart while playing
      this.stems.forEach((stem, id) => {
        if (!stem.loaded) return;
        stem.setCurrentTime(target);
      });

      // Reset sync timers for drift monitor blackout
      this._lastSeekTime = performance.now();
      this._lastHardResyncTime = performance.now();

      if (jumpNum === 1 || jumpNum % 10 === 0) {
        console.log(`[LOOP] #${jumpNum} Lightweight jump → ${target.toFixed(3)}s`);
      }
    }

    // Reset loop state for next cycle
    this._followersPreloaded = false;
    this._preSeekScheduled = false;
    this._preSeekSilencedStems.clear();
    this._preSeekSavedVolumes.clear();
    this._lastLoopJumpTime = performance.now();

    document.dispatchEvent(new CustomEvent('loopcompleted', {
      detail: { previousTime: now, newTime: target, loopStart: this._loopStart, loopEnd: this._loopEnd },
    }));
  }

  /**
   * Restore gain-muted stems to their original volume.
   * Called when loop is cleared or when hard resync fallback is used.
   */
  private _restoreSilencedStems(): void {
    const ctx = getAudioContext();
    this._preSeekSilencedStems.forEach(id => {
      const stem = this.stems.get(id);
      if (!stem) return;
      const savedVol = this._preSeekSavedVolumes.get(id) ?? 1;
      stem.gainNode.gain.setTargetAtTime(savedVol, ctx.currentTime, 0.005);
    });
    this._preSeekSilencedStems.clear();
    this._preSeekSavedVolumes.clear();
  }

  // ============================================================
  // MICROPHONE & VOCALMIX
  // ============================================================

  async enableMicrophone() { const r = await this.microphone.enable(); this._updateMicRouting(); return r; }
  disableMicrophone(): void { this.microphone.disable(); this._updateMicRouting(); }
  toggleMicrophone() { return this.microphone.toggle(); }
  getMicrophoneState() { return this.microphone.getState(); }

  /**
   * Get microphone MediaStream for WebRTC.
   * 'raw' = direct from getUserMedia
   * 'processed' = through gainNode (volume applied)
   */
  getMicrophoneStream(kind: 'raw' | 'processed' = 'processed'): MediaStream | null {
    return this.microphone.getStream(kind);
  }

  enableVocalMix(): void { this.vocalMix.enable(); this._updateVocalMixRouting(); this._emitVocalMix(); }
  disableVocalMix(): void { this.vocalMix.disable(); this._updateVocalMixRouting(); this._emitVocalMix(); }
  toggleVocalMix(): void { if (this.vocalMix.enabled) this.disableVocalMix(); else this.enableVocalMix(); }
  getVocalMixState(): boolean { return this.vocalMix.enabled; }

  private _emitVocalMix(): void {
    document.dispatchEvent(new CustomEvent('vocalmix-state-changed', {
      detail: { enabled: this.vocalMix.enabled },
    }));
  }

  // ============================================================
  // TRANSPORT HARDENING HELPERS
  // ============================================================

  private _clearSoftResync(): void {
    if (this._softResyncTimer !== null) {
      clearTimeout(this._softResyncTimer);
      this._softResyncTimer = null;
    }
    // Reset playbackRate for all soft-resynced stems
    this._softResyncRates.forEach((_, stemId) => {
      const stem = this.stems.get(stemId);
      if (stem?.audio) {
        stem.audio.playbackRate = this._playbackRate;
      }
    });
    this._softResyncRates.clear();
    this._softResyncInProgress.clear();
  }

  private _getSyncBlackoutMs(): number {
    if (!this._firstSeekDone) return 800; // Extended blackout for first seek (TC-046R)
    return this._SYNC_BLACKOUT_MAX;
  }

  // ============================================================
  // PLAYBACK RATE
  // ============================================================

  setPlaybackRate(rate: number): void {
    this._clearSoftResync();
    this._playbackRate = Math.max(0.25, Math.min(4, rate));
    this.stems.forEach(s => s.setPlaybackRate(this._playbackRate));
    document.dispatchEvent(new CustomEvent('playback-rate-changed', {
      detail: { rate: this._playbackRate },
    }));
  }

  getPlaybackRate(): number { return this._playbackRate; }

  // ============================================================
  // PROPERTIES
  // ============================================================

  get duration(): number { return this._duration; }
  get isPlaying(): boolean { return this._isPlaying; }
  set isPlaying(v: boolean) { this._isPlaying = v; }
  get audioContext(): AudioContext { return getAudioContext(); }

  get hybridEngine() {
    return {
      instrumentalUrl: this._trackUrls['instrumental'] ?? null,
      vocalsUrl: this._trackUrls['vocals'] ?? null,
    };
  }

  // ============================================================
  // TRANSPORT
  // ============================================================

  async play(): Promise<void> {
    if (this._isPlaying) return;
    if (!this.stems.has('instrumental')) return;

    const gen = ++this._transportGen;
    this._clearSoftResync();

    await ensureResumed();
    if (gen !== this._transportGen || this._isPlaying) return;

    const inst = this.stems.get('instrumental')!;

    // Pre-play sync: align ALL followers to master time
    const instTime = inst.getCurrentTime();
    const syncWaits: Promise<void>[] = [];
    this.stems.forEach((stem, id) => {
      if (id === 'instrumental') return; // master — skip
      if (!stem.loaded) return;
      const drift = Math.abs(stem.getCurrentTime() - instTime);
      if (drift > 0.01) {
        stem.setCurrentTime(instTime);
        syncWaits.push(this._waitForSeeked(stem));
      }
    });
    if (syncWaits.length > 0) {
      await Promise.all(syncWaits);
      if (gen !== this._transportGen || this._isPlaying) return;
    }

    // Per-stem initial play instrumentation (TC-050)
    const playPromises: Promise<void>[] = [];

    this.stems.forEach((stem, id) => {
      if (!stem.loaded) return;
      if (id === 'instrumental') {
        // Master: play directly
        const instAudio = inst.audio;
        if (instAudio) {
          playPromises.push(stem.play().then(() => {}));
        } else {
          playPromises.push(stem.play());
        }
      } else {
        // Followers: play with error suppression
        const stemAudio = stem.audio;
        if (stemAudio) {
          playPromises.push(stem.play().catch(() => {}).then(() => {}));
        } else {
          playPromises.push(stem.play().catch(() => {}));
        }
      }
    });
    
    await Promise.all(playPromises);

    // ── Pending hot-plug recovery ──
    // Stems that failed hot-plug during load get another chance on play()
    this.stems.forEach((stem) => {
      if ((stem as any)._pendingHotPlug && stem.loaded) {
        (stem as any)._pendingHotPlug = false;
        const ctx = getAudioContext();
        stem.gainNode.gain.setValueAtTime(0, ctx.currentTime);
        // ★ OI-6: playbackRate sync — CRITICAL for BPM!
        stem.setPlaybackRate(this._playbackRate);
        stem.setCurrentTime(this.getCurrentTime());
        stem.play().catch(() => {});

        // ★3 Apply stemsEnabled volume policy
        const isMusicStem = stem.name !== 'instrumental' && stem.name !== 'vocals';
        const targetVol = (isMusicStem && !this._stemsEnabled) ? 0 : (this._stemVolumes[stem.name] ?? 1);
        stem.gainNode.gain.linearRampToValueAtTime(
          targetVol,
          ctx.currentTime + 0.05
        );
      }
    });

    if (gen !== this._transportGen || this._isPlaying) return;

    this._isPlaying = true;
    this._firstSeekDone = true; // W9-DRIFT-002: Mark first play complete
    this._lastSeekTime = performance.now();
    this._startPositionUpdates();
    this._notifyPlaybackState();
  }

  pause(): void {
    ++this._transportGen;
    this._clearSoftResync();
    this.stems.forEach(s => s.pause());
    this._isPlaying = false;
    this._stopPositionUpdates();
    this._notifyPlaybackState();
  }

  getCurrentTime(): number {
    return this.stems.get('instrumental')?.getCurrentTime() ?? 0;
  }

  setCurrentTime(time: number): void {
    const gen = ++this._transportGen;
    this._lastSeekTime = performance.now();
    this._clearSoftResync();

    const clamped = Math.max(0, Math.min(time, this._duration || Infinity));
    if (!this._isPlaying) {
      this.stems.forEach(s => s.setCurrentTime(clamped));
      return;
    }

    this._stopPositionUpdates();
    this.stems.forEach(s => s.pause());
    this.stems.forEach(s => s.setCurrentTime(clamped));
    void this._atomicResumeFromSeek(gen);
  }

  seekTo(time: number): void { this.setCurrentTime(time); }

  getDuration(): number { return this._duration; }

  private async _atomicResumeFromSeek(gen: number): Promise<void> {
    this._resyncInProgress = true;
    try {
      const waits: Promise<void>[] = [];
      this.stems.forEach(stem => {
        if (stem.loaded && stem.audio) {
          waits.push(this._waitForSeeked(stem));
        }
      });

      if (waits.length > 0) {
        await Promise.all(waits);
      }

      // Wait for instrumental to have decoded data before resuming (TC-048)
      const instStem = this.stems.get('instrumental');
      if (instStem?.loaded && instStem.audio) {
        if (instStem.audio.readyState < 3) {
          await new Promise<void>((resolve) => {
            const el = instStem.audio!;
            if (el.readyState >= 3) { resolve(); return; }
            const onCanPlay = () => { cleanup(); resolve(); };
            const timer = setTimeout(() => { cleanup(); resolve(); }, 300);
            function cleanup() {
              el.removeEventListener('canplay', onCanPlay);
              clearTimeout(timer);
            }
            el.addEventListener('canplay', onCanPlay, { once: true });
          });
        }
      }

      if (gen !== this._transportGen || !this._isPlaying) return;

      // Per-stem resume instrumentation (TC-050)
      const plays: Promise<void>[] = [];
      this.stems.forEach(stem => {
        if (stem.loaded && stem.audio) {
          const playPromise = stem.play().catch(() => {});
          plays.push(playPromise.then(() => {}));
        }
      });
      await Promise.all(plays);

      this._firstSeekDone = true;

      if (gen !== this._transportGen || !this._isPlaying) return;

      // W9-DRIFT-002: Post-resync alignment WITH seeked wait
      // This corrects any drift introduced by the pause/seek/resume cycle itself.
      const masterTime = this.stems.get('instrumental')?.getCurrentTime() ?? 0;
      const alignmentWaits: Promise<void>[] = [];

      this.stems.forEach((stem, id) => {
        if (id === 'instrumental') return;
        if (!stem.loaded) return;
        const drift = Math.abs(stem.getCurrentTime() - masterTime);
        if (drift > 0.01) { // > 10ms
          stem.setCurrentTime(masterTime);
          alignmentWaits.push(this._waitForSeeked(stem)); // W9-DRIFT-002: Wait for seeked
        }
      });

      // W9-DRIFT-002: Wait for ALL alignments to complete before resetting timers
      if (alignmentWaits.length > 0) {
        await Promise.all(alignmentWaits);
      }

      // NOW reset sync timers — stems are actually aligned
      this._lastSeekTime = performance.now();
      this._lastHardResyncTime = performance.now();

      this._startPositionUpdates();
    } finally {
      this._resyncInProgress = false;
    }
  }

  private _waitForSeeked(stem: StemPlayer): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!stem.audio) {
        resolve();
        return;
      }

      setTimeout(() => {
        if (!stem.audio) {
          resolve();
          return;
        }

        if (!stem.audio.seeking) {
          resolve();
          return;
        }

        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          stem.audio?.removeEventListener('seeked', onSeeked);
          resolve();
        };

        const onSeeked = () => finish();
        stem.audio.addEventListener('seeked', onSeeked, { once: true });
        const timeoutMs = this._firstSeekDone ? 80 : 200;
        const timeout = setTimeout(() => {
          finish();
        }, timeoutMs);
      }, 0);
    });
  }

  private _startPositionUpdates(): void {
    this._stopPositionUpdates();
    this._positionInterval = setInterval(() => {
      const t = this.getCurrentTime();

      // N-follower drift monitor: check ALL followers, not just vocals
      // Skip entirely if a resync is already in progress or if loop is active
      // (loop system handles its own sync via pre-seek + jump)
      if (this._isPlaying && !this._resyncInProgress && !this._loopActive) {
        const blackoutMs = this._getSyncBlackoutMs();
        const elapsedSinceSeek = performance.now() - this._lastSeekTime;

        if (elapsedSinceSeek >= blackoutMs) {
          let worstDrift = 0;
          let worstDriftId = '';

          this.stems.forEach((stem, id) => {
            if (id === 'instrumental') return; // master — skip
            if (!stem.loaded) return;

            const drift = Math.abs(stem.getCurrentTime() - t);
            if (drift > worstDrift) {
              worstDrift = drift;
              worstDriftId = id;
            }
          });

          // Only resync if we found a drifting stem (may be empty if all are silenced)
          if (worstDriftId) {
            // Soft resync threshold (20ms) or hard resync threshold (40ms)
            if (worstDrift > SOFT_RESYNC_DEFAULTS.hardThreshold) {
              // Hard resync
              const now = performance.now();
              if (now - this._lastHardResyncTime >= this._HARD_RESYNC_COOLDOWN_MS) {
                this._lastHardResyncTime = now;
                this.setCurrentTime(t);
                return;
              }
            } else if (worstDrift > SOFT_RESYNC_DEFAULTS.softThreshold) {
              // Group-aware soft resync
              this._attemptSoftResync(worstDriftId, t - this.stems.get(worstDriftId)!.getCurrentTime());
            }
          }
        }
      }

      this._onPositionUpdateCallbacks.forEach(cb => {
        try { cb(t); } catch (_) {}
      });

      if (this._isPlaying && this._duration > 0 && t >= this._duration - 0.15) {
        this._isPlaying = false;
        this._stopPositionUpdates();
        const cbs = [...this._onBothEndedCallbacks];
        this._onBothEndedCallbacks = [];
        cbs.forEach(cb => { try { cb(); } catch (_) {} });
      }
    }, 50);
  }

  /**
   * Attempt soft resync for a drifting stem.
   * Respects group-aware mutex: max 1 soft resync per group bus.
   */
  private _attemptSoftResync(stemId: string, driftSeconds: number): void {
    if (this._softResyncRates.has(stemId)) return; // already resyncing

    const role = this._stemRoles[stemId];
    const bus = role ? ROLE_ROUTING[role] : 'music-bus';

    // W9-DRIFT-001: Tier-based concurrent soft resync
    const busSet = this._softResyncInProgress.get(bus) ?? new Set<string>();
    const maxConcurrent = this._getMaxConcurrentResync();
    if (busSet.size >= maxConcurrent) return;

    const stem = this.stems.get(stemId);
    if (!stem?.audio) return;

    // Apply playbackRate correction
    const rateDelta = driftSeconds > 0
      ? SOFT_RESYNC_DEFAULTS.rateDelta   // stem is ahead → slow down
      : -SOFT_RESYNC_DEFAULTS.rateDelta;  // stem is behind → speed up

    stem.audio.playbackRate = this._playbackRate + rateDelta;
    this._softResyncRates.set(stemId, rateDelta);
    busSet.add(stemId);
    this._softResyncInProgress.set(bus, busSet);

    // Auto-revert after drift should be corrected
    // At ±0.2% rateDelta, 20ms drift corrects in ~2.5s
    const correctionTimeMs = Math.abs(driftSeconds) / Math.abs(rateDelta) * 1000;
    const revertMs = Math.min(Math.max(correctionTimeMs, 1000), 5000); // 1-5 seconds

    this._softResyncTimer = setTimeout(() => {
      // Revert playbackRate
      if (stem.audio) stem.audio.playbackRate = this._playbackRate;
      this._softResyncRates.delete(stemId);
      // W9-DRIFT-001: Remove stem from bus set, delete bus if empty
      const set = this._softResyncInProgress.get(bus);
      if (set) {
        set.delete(stemId);
        if (set.size === 0) this._softResyncInProgress.delete(bus);
      }
      this._softResyncTimer = null;
    }, revertMs);
  }

  private _notifyPlaybackState(): void {
    const event = new CustomEvent('playback-state-changed', {
      detail: {
        isPlaying: this._isPlaying,
        currentTime: this.getCurrentTime(),
        duration: this._duration,
      },
    });
    window.dispatchEvent(event);
  }

  // ============================================================
  // EVENT SUBSCRIPTIONS
  // ============================================================

  onTrackLoaded(cb: Function): void { this._onTrackLoadedCallbacks.push(cb); }

  onPositionUpdate(cb: Function): void {
    this._onPositionUpdateCallbacks.push(cb);
    if (this._isPlaying) this._startPositionUpdates();
  }

  onBothEnded(cb: Function): () => void {
    this._onBothEndedCallbacks.push(cb);
    return () => { this._onBothEndedCallbacks = this._onBothEndedCallbacks.filter(c => c !== cb); };
  }

  removeEventListener(type: string, cb: Function): void {
    if (type === 'trackLoaded') this._onTrackLoadedCallbacks = this._onTrackLoadedCallbacks.filter(c => c !== cb);
    else if (type === 'positionUpdate') this._onPositionUpdateCallbacks = this._onPositionUpdateCallbacks.filter(c => c !== cb);
  }

  // ============================================================
  // CAPTURE STREAM (LEGACY — DEPRECATED)
  // ============================================================

  private _streamDest: MediaStreamAudioDestinationNode | null = null;

  get microphoneGain(): GainNode | null {
    return this.microphone?.gainNode ?? null;
  }

  get streamDestination(): MediaStreamAudioDestinationNode | null {
    return this._streamDest;
  }

  /**
   * @deprecated Use getProgramCaptureStream() instead.
   * Thin wrapper for backward compatibility during migration.
   */
  captureStream(): MediaStream {
    if (import.meta.env.DEV) {
      console.warn('[DEPRECATED] captureStream() → use getProgramCaptureStream()');
    }
    return this.getProgramCaptureStream();
  }

  // ============================================================
  // PROGRAM CAPTURE BUS (NEW — Wave R2)
  // ============================================================

  private _programCaptureDest: MediaStreamAudioDestinationNode | null = null;
  private _programSources: Map<AudioNode, { kind: string }> = new Map();
  private _micCaptureEnabled = false;

  /**
   * Get the Program Capture Bus MediaStream.
   * Single canonical audio source for MediaRecorder.
   * Auto-creates bus and connects stems on first call.
   */
  getProgramCaptureStream(): MediaStream {
    if (!this._programCaptureDest) {
      this._programCaptureDest = getAudioContext().createMediaStreamDestination();
      // W3.4: Connect bus gainNodes (not individual stem gainNodes) to Program Capture.
      // NEW: Program Capture = Monitor Output
      try { this.vocalMix.merger.connect(this._programCaptureDest!); } catch (_) {}
    }
    return this._programCaptureDest.stream;
  }

  /**
   * Register an audio source as part of the Program Capture Bus.
   * @param node - AudioNode to connect (typically GainNode)
   * @param opts.kind - Type of source: 'stem' | 'preview' | 'mic' | 'cue'
   */
  attachProgramSource(node: AudioNode, opts: { kind: string }): void {
    // Dedup check: prevent duplicate connections
    if (this._programSources.has(node)) return;

    // Auto-create bus if not yet initialized
    if (!this._programCaptureDest) {
      this.getProgramCaptureStream();
    }

    // Connect and track
    try {
      node.connect(this._programCaptureDest!);
      this._programSources.set(node, opts);
    } catch (e) {
      console.warn('[ProgramBus] Failed to attach source:', e);
    }
  }

  /**
   * Remove a previously registered source from the Program Capture Bus.
   * Silent ignore if node not attached (cleanup safety).
   */
  detachProgramSource(node: AudioNode | null): void {
    // Explicit null guard
    if (!node) return;
    
    // Silent ignore if not attached
    if (!this._programSources.has(node)) return;

    try {
      node.disconnect(this._programCaptureDest!);
      this._programSources.delete(node);
    } catch (e) {
      // Silent ignore (cleanup safety)
    }
  }

  /**
   * Enable/disable microphone in the Program Capture Bus.
   * Replaces manual microphoneGain.connect(streamDestination) calls.
   * Auto-initializes bus if not yet created.
   */
  setCaptureMicEnabled(enabled: boolean): void {
    if (import.meta.env.DEV) {
      console.warn('[DEPRECATED] setCaptureMicEnabled() — mic is now captured via VocalMix merger');
    }
    // Track capture intent for potential future use
    this._micCaptureEnabled = enabled;
    // NO direct mic → _programCaptureDest connection anymore
    // Mic is captured via merger when enabled for monitoring
  }

  // ============================================================
  // RESET
  // ============================================================

  reset(): void { this.dispose(); }

  // ============================================================
  // CLEANUP
  // ============================================================

  stop(): void {
    ++this._transportGen;
    this._clearSoftResync();
    this._isPlaying = false;
    this._stopPositionUpdates();
    this._stopLoopCheck();
    this.stems.forEach(s => s.stop());
  }

  dispose(): void {
    this.stop();
    this.stems.forEach(s => s.dispose());
    this.stems.clear();
    this._programSources.clear();
    this._programCaptureDest = null;
    this._micCaptureEnabled = false;
    this.vocalMix.dispose();
    this.microphone.dispose();
    this._trackUrls = {};
    this._duration = 0;
    // W3: Clean up bus gain nodes
    this._buses.forEach(bus => { try { bus.gainNode.disconnect(); } catch (_) {} });
    this._buses.clear();
    // W5: Clean up analysers
    this._analysers.forEach(a => { try { a.disconnect(); } catch (_) {} });
    this._analysers.clear();
    this._stemVolumes = {};
    this._busVolumes = {};
  }

  // ============================================================
  // EVENTS (stubs — will flesh out in TC-AE-09)
  // ============================================================

  private _notifyTrackLoaded(loadedStems: string[], hasVocals: boolean): void {
    const detail = { duration: this._duration, hasVocals, loadedStems };
    const event = new CustomEvent('track-loaded', { detail });
    document.dispatchEvent(event);
    this._onTrackLoadedCallbacks.forEach(cb => {
      try { cb(detail); } catch (_) {}
    });
  }

  private _stopPositionUpdates(): void {
    if (this._positionInterval) {
      clearInterval(this._positionInterval);
      this._positionInterval = null;
    }
  }

  private _stopLoopCheck(): void {
    if (this._loopCheckInterval) {
      clearInterval(this._loopCheckInterval);
      this._loopCheckInterval = null;
    }
    // Cancel pre-seek wait timeout
    if (this._loopPreSeekWaitTimeout !== null) {
      clearTimeout(this._loopPreSeekWaitTimeout);
      this._loopPreSeekWaitTimeout = null;
    }
    // Restore any gain-muted stems
    this._restoreSilencedStems();
    // Reset loop state
    this._followersPreloaded = false;
    this._preSeekScheduled = false;
    this._loopJumpCount = 0;
  }
}
