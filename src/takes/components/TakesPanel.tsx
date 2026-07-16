import React from 'react';
import { TakesCanvas } from './TakesCanvas';
import { TakesControlStrip } from './TakesControlStrip';
import { TakesToolbar } from './TakesToolbar';
import { useTakesStore } from '../takes.store';
import { useBlocksStore } from '../../stores/blocks.store';
import { useMarkersStore } from '../../stores/markers.store';
import { useAudioStore } from '../../stores/audio.store';
import { useStemStore } from '../../stem/stem.store';
import { getBlockTimeRange } from '../../utils/block-time-range';
import { takeAssets } from '../takes.assets';
import { generatePeaks } from '../../sync/canvas/peaks';
import { LiveTrailController } from '../waveform/live-trail-controller';
import { getWaveformTierConfigWithSkin } from '../waveform/waveform-tier-config';
import { usePerformanceStore } from '../../performance/performance.store';
import { QuestEntrySurface } from '../../exercises/components/QuestEntrySurface';
import { isExerciseExecutionLocked } from '../../exercises/exercise.runtime';
import { interruptPracticeSession } from '../../exercises/exercise.interruption';

// Exercise runtime imports (hidden orchestration)
import { useExerciseStore } from '../../exercises/exercise.store';
import { resolveExerciseScope } from '../../exercises/exercise.scope-resolver';
import {
  getCurrentExerciseStep,
  advanceExerciseCursor,
  resolveBackingVolumes,
} from '../../exercises/exercise.runtime';

// Exercise UI components
import { ExerciseStrip } from '../../exercises/components/ExerciseStrip';
import { QuestCompletionMoment } from '../../exercises/components/QuestCompletionMoment';

/**
 * TakesPanel — renders waveform canvas for active block in Takes mode.
 * Same waveform, same V-I-M, same canvas.
 * Takes-specific controls will be added as overlay/strip.
 */
export const TakesPanel: React.FC = () => {
  const activeBlockId = useTakesStore((s) => s.activeBlockId);
  const blocks = useBlocksStore((s) => s.blocks);
  const markers = useMarkersStore((s) => s.markers);
  const duration = useAudioStore((s) => s.duration);
  const isRecording = useTakesStore((s) => s.isRecording);
  const viewMode = useTakesStore((s) => s.viewMode);
  const { setViewMode, setActiveBlock } = useTakesStore();
  const blockTakesMap = useTakesStore(s => s.blockTakesMap);
  const assetRevision = useTakesStore(s => s.assetRevision);
  
  // Exercise selectors (hidden orchestration)
  const activeExercise = useExerciseStore((s) => s.activeExercise);
  const phase = useExerciseStore((s) => s.phase);
  const currentStepIndex = useExerciseStore((s) => s.currentStepIndex);
  const currentRound = useExerciseStore((s) => s.currentRound);
  const exerciseResolvedTimeRange = useExerciseStore((s) => s.resolvedTimeRange);
  const savedVolumes = useExerciseStore((s) => s.savedVolumes);
  const savedPlaybackRate = useExerciseStore((s) => s.savedPlaybackRate);
  const savedVmixEnabled = useExerciseStore((s) => s.savedVmixEnabled);
  const scenarioMixOverride = useExerciseStore((s) => s.scenarioMixOverride);
  const completionMoment = useExerciseStore((s) => s.completionMoment);
  const clearCompletionMoment = useExerciseStore((s) => s.clearCompletionMoment);
  const setResolvedTimeRange = useExerciseStore((s) => s.setResolvedTimeRange);
  const setSavedVolumes = useExerciseStore((s) => s.setSavedVolumes);
  const setSavedPlaybackRate = useExerciseStore((s) => s.setSavedPlaybackRate);
  const setSavedVmixEnabled = useExerciseStore((s) => s.setSavedVmixEnabled);
  const advanceToNextStep = useExerciseStore((s) => s.advanceToNextStep);
  
  // Exercise execution lock for canvas seek guard - replaced with interruption model
  // REMOVED: exerciseLocked blanket check - now uses interruptPracticeSession()
  
  // Refs for stable hidden execution
  const advanceRef = React.useRef(advanceToNextStep);
  const listenRunIdRef = React.useRef(0);
  const waitRunIdRef = React.useRef(0);
  const lastListenExecKeyRef = React.useRef<string | null>(null);
  const lastWaitExecKeyRef = React.useRef<string | null>(null);
  const listenExecRangeRef = React.useRef<typeof exerciseResolvedTimeRange>(null);
  
  // Ref for resolvedTimeRange equality guard (breaks dependency cycle)
  const resolvedTimeRangeRef = React.useRef(exerciseResolvedTimeRange);
  
  // Countdown overlay state
  const [countdownOverlay, setCountdownOverlay] = React.useState<number | null>(null);
  
  // Response cue for Call & Response (anticipatory countdown during pre-recording)
  const [responseCue, setResponseCue] = React.useState<number | null>(null);
  
  // Response window highlight for Call & Response (upcoming segment guide on canvas)
  const [responseWindow, setResponseWindow] = React.useState<{
    startTime: number;
    endTime: number;
    active: boolean;
  } | null>(null);
  
  // Active compare target state (drives overlay)
  const [activeCompareSlot, setActiveCompareSlot] = React.useState<number | null>(null);
  
  // Compare mode state (local to panel)
  const [compareMode, setCompareMode] = React.useState<'off' | 'ab'>('off');
  
  // Preview mode state (solo/context)
  const previewMode = useTakesStore(s => s.previewMode);
  const setPreviewMode = useTakesStore(s => s.setPreviewMode);
  
  // Recipes popover state
  const [recipesOpen, setRecipesOpen] = React.useState(false);
  
  // Exercise playback lock
  const exercisePlaybackLocked = isExerciseExecutionLocked(activeExercise, phase);
  
  // Live recorder analyser for DAW-like trail visualization
  const [liveAnalyser, setLiveAnalyser] = React.useState<AnalyserNode | null>(null);
  
  // Derive current exercise step (pure computation)
  const currentExerciseStep = React.useMemo(() => {
    return getCurrentExerciseStep(activeExercise, currentStepIndex);
  }, [activeExercise, currentStepIndex]);
  
  // Sync advance ref on every render
  React.useEffect(() => {
    advanceRef.current = advanceToNextStep;
  }, [advanceToNextStep]);
  
  // Sync resolvedTimeRange ref
  React.useEffect(() => {
    resolvedTimeRangeRef.current = exerciseResolvedTimeRange;
  }, [exerciseResolvedTimeRange]);
  
  // Build derived key for one-shot listen execution
  const listenExecKey = React.useMemo(() => {
    if (
      !activeExercise ||
      phase !== 'listening' ||
      currentExerciseStep?.action !== 'listen' ||
      !exerciseResolvedTimeRange
    ) {
      return null;
    }

    return [
      activeExercise.id,
      currentRound,
      currentStepIndex,
      exerciseResolvedTimeRange.startTime,
      exerciseResolvedTimeRange.endTime,
    ].join(':');
  }, [
    activeExercise?.id,
    phase,
    currentExerciseStep?.action,
    currentRound,
    currentStepIndex,
    exerciseResolvedTimeRange?.startTime,
    exerciseResolvedTimeRange?.endTime,
  ]);
  
  // Sync listen exec range ref when key changes
  React.useEffect(() => {
    listenExecRangeRef.current = exerciseResolvedTimeRange;
  }, [listenExecKey, exerciseResolvedTimeRange]);
  
  // Build derived key for one-shot wait execution
  const waitExecKey = React.useMemo(() => {
    if (
      !activeExercise ||
      phase !== 'waiting' ||
      currentExerciseStep?.action !== 'wait'
    ) {
      return null;
    }

    return [
      activeExercise.id,
      currentRound,
      currentStepIndex,
      currentExerciseStep.waitSec ?? 0,
    ].join(':');
  }, [
    activeExercise?.id,
    phase,
    currentRound,
    currentStepIndex,
    currentExerciseStep?.action,
    currentExerciseStep?.waitSec,
  ]);
  
  // Live trail refs for imperative controller (TC-W2D2-005)
  const liveCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const liveTrailControllerRef = React.useRef<LiveTrailController | null>(null);
  
  // Ref for tracking logged takeIds to avoid render spam (must be before compareTakeTarget memoized function)
  const lastLoggedTakeIdRef = React.useRef<string | null>(null);
  
  // Reset active compare slot on block change
  React.useEffect(() => {
    setActiveCompareSlot(null);
  }, [activeBlockId]);
  
  // Auto-focus first ready take on quest completion
  React.useEffect(() => {
    if (!completionMoment) return;
    
    const bt = blockTakesMap[completionMoment.blockId];
    if (!bt) return;
    
    // Find first ready take (lowest index)
    const firstReadyIndex = bt.takes.findIndex(
      (t): t is NonNullable<typeof t> => t?.status === 'ready'
    );
    
    if (firstReadyIndex !== -1) {
      setCompareMode('off');
      setActiveCompareSlot(firstReadyIndex);
    }
  }, [completionMoment, blockTakesMap]);
  
  // Reference take target for Compare A-B (selected take)
  const referenceTakeTarget = React.useMemo(() => {
    if (!activeBlockId) return null;
    const bt = blockTakesMap[activeBlockId];
    if (!bt) return null;
    
    // Hide overlays during countdown or recording
    if (isRecording || countdownOverlay !== null) return null;
    
    // Only show reference layer in A-B mode with selected take
    if (compareMode !== 'ab') return null;
    
    if (
      bt.selectedSlot !== null &&
      bt.takes[bt.selectedSlot]?.status === 'ready'
    ) {
      return bt.takes[bt.selectedSlot]!;
    }
    
    return null;
  }, [activeBlockId, blockTakesMap, compareMode, isRecording, countdownOverlay]);
  
  // Compare take target for Compare A-B (active compare slot or fallback)
  const compareTakeTarget = React.useMemo(() => {
    if (!activeBlockId) return null;
    const bt = blockTakesMap[activeBlockId];
    if (!bt) return null;
    const takes = bt.takes;
    
    // Hide committed take during pure reference listen (not previous-take preview)
    if (
      phase === 'listening' &&
      currentExerciseStep?.action === 'listen' &&
      currentExerciseStep?.listenSource !== 'previous-take'
    ) {
      return null;
    }
    
    // Hide overlays during countdown or recording
    if (isRecording || countdownOverlay !== null) return null;
    
    if (compareMode === 'ab') {
      // In A-B mode: show active compare slot if different from selected
      if (
        activeCompareSlot !== null &&
        activeCompareSlot !== bt.selectedSlot &&
        takes[activeCompareSlot]?.status === 'ready'
      ) {
        return takes[activeCompareSlot]!;
      }
      // If clicking the selected take itself, no compare layer
      return null;
    } else {
      // Compare Off: use old overlay fallback logic
      // Priority 1: active compare target (from card click)
      if (
        activeCompareSlot !== null &&
        takes[activeCompareSlot]?.status === 'ready'
      ) {
        const chosen = takes[activeCompareSlot]!;
        if (lastLoggedTakeIdRef.current !== chosen.id) {
          lastLoggedTakeIdRef.current = chosen.id;
        }
        return chosen;
      }
      
      // Priority 2: selected/best take
      if (
        bt.selectedSlot !== null &&
        takes[bt.selectedSlot]?.status === 'ready'
      ) {
        const chosen = takes[bt.selectedSlot]!;
        if (lastLoggedTakeIdRef.current !== chosen.id) {
          lastLoggedTakeIdRef.current = chosen.id;
        }
        return chosen;
      }
      
      // Priority 3: latest ready take
      const readyTakes = takes.filter(
        (t): t is NonNullable<typeof t> => t?.status === 'ready'
      );
      
      if (readyTakes.length === 0) return null;
      
      readyTakes.sort((a, b) => b.recordedAt - a.recordedAt);
      const chosen = readyTakes[0];
      if (lastLoggedTakeIdRef.current !== chosen.id) {
        lastLoggedTakeIdRef.current = chosen.id;
      }
      return chosen;
    }
  }, [activeBlockId, blockTakesMap, compareMode, activeCompareSlot, isRecording, countdownOverlay, phase, currentExerciseStep]);
  
  // Derive whether current block has enough ready takes for meaningful compare
  const canCompare = React.useMemo(() => {
    if (!activeBlockId) return false;
    const bt = blockTakesMap[activeBlockId];
    if (!bt) return false;
    
    const readyTakesCount = bt.takes.filter(
      (t): t is NonNullable<typeof t> => t?.status === 'ready'
    ).length;
    
    return readyTakesCount >= 2;
  }, [activeBlockId, blockTakesMap]);
  
  // Canvas zone refs for width caching and playhead
  const canvasZoneRef = React.useRef<HTMLDivElement>(null);
  const playheadRef = React.useRef<HTMLDivElement>(null);
  const widthRef = React.useRef(0);
  
  // TC-DS-08: Adaptive canvas height state
  const [canvasHeight, setCanvasHeight] = React.useState(200);
  
  // Refs for rAF access (avoid closure stale state)
  const isRecordingRef = React.useRef(false);
  const activeBlockIdRef = React.useRef(activeBlockId);
  const exercisePhaseRef = React.useRef<typeof phase>(phase);
  const activeExerciseRef = React.useRef(activeExercise);
  const completionMomentRef = React.useRef(completionMoment);
  
  React.useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  
  React.useEffect(() => {
    activeBlockIdRef.current = activeBlockId;
  }, [activeBlockId]);
  
  React.useEffect(() => {
    exercisePhaseRef.current = phase;
  }, [phase]);
  
  React.useEffect(() => {
    activeExerciseRef.current = activeExercise;
  }, [activeExercise]);
  
  React.useEffect(() => {
    completionMomentRef.current = completionMoment;
  }, [completionMoment]);
  
  // Width cache through ResizeObserver (NOT in rAF)
  React.useEffect(() => {
    const el = canvasZoneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      // Quantize to integer to prevent fractional resize storms
      const nextWidth = Math.round(entry.contentRect.width);
      // Only update if quantized width actually changed (idempotent resize)
      if (widthRef.current !== nextWidth) {
        widthRef.current = nextWidth;
        liveTrailControllerRef.current?.setSize(nextWidth, 180);
      }
      
      // TC-DS-08-FIX-5: Compute adaptive canvas height
      const containerHeight = entry.contentRect.height;
      const padding = 8;
      // ExerciseStrip + TakesControlStrip are absolute positioned — don't consume flow space
      const available = containerHeight - padding;
      setCanvasHeight(Math.max(120, available));
    });
    ro.observe(el);
    
    // Initial sync for live trail controller
    // Quantize to integer to prevent fractional resize storms
    const initialWidth = Math.round(el.clientWidth);
    if (initialWidth > 0) {
      if (widthRef.current !== initialWidth) {
        widthRef.current = initialWidth;
        liveTrailControllerRef.current?.setSize(initialWidth, 180);
      }
    }
    return () => ro.disconnect();
  }, [activeBlockId, blocks, markers]);
  
  // Find active block
  const activeBlock = React.useMemo(() => {
    if (!activeBlockId) return null;
    return blocks.find((b) => b.id === activeBlockId) || null;
  }, [activeBlockId, blocks]);

  // Compute time range for active block
  const timeRange = React.useMemo(() => {
    if (!activeBlock) return null;
    return getBlockTimeRange(activeBlock, markers);
  }, [activeBlock, markers]);
  
  // Live trail controller CREATE/DISPOSE lifecycle (TC-W2D2-005: imperative runtime)
  // Only depends on isRecording and liveAnalyser - NOT timeRange
  React.useEffect(() => {
    // If not recording or no analyser, dispose existing controller
    if (!isRecording || !liveAnalyser) {
      if (liveTrailControllerRef.current) {
        liveTrailControllerRef.current.dispose();
        liveTrailControllerRef.current = null;
      }
      return;
    }
    
    // Controller already exists - do nothing (prevents recreation storm)
    if (liveTrailControllerRef.current) {
      return;
    }
    
    // Create controller ONCE per recording session
    
    // Get effective tier from performance domain
    const perfState = usePerformanceStore.getState();
    const tier = perfState.getEffectiveTier();
    
    // Get tier-specific config and skin
    const { config, skin } = getWaveformTierConfigWithSkin(tier);
    
    // Instantiate controller
    const controller = new LiveTrailController(config, skin);
    
    // Attach to live canvas
    if (liveCanvasRef.current) {
      controller.attachCanvas(liveCanvasRef.current);
      controller.setSize(widthRef.current, 180);
    }
    
    // Pass analyser
    controller.setAnalyser(liveAnalyser);
    
    // Set time range BEFORE start (critical for tick to work)
    if (timeRange) {
      controller.setTimeRange(timeRange);
    }
    
    // Start the rAF loop
    controller.start();
    
    // Store reference
    liveTrailControllerRef.current = controller;
    
    // Cleanup on unmount or when isRecording/liveAnalyser changes
    return () => {
      controller.dispose();
      liveTrailControllerRef.current = null;
    };
  }, [isRecording, liveAnalyser, timeRange?.startTime, timeRange?.endTime]);

  // Canvas mount verification effect
  React.useEffect(() => {
    // Canvas mounted - no action needed
  }, []);

  // TIME RANGE UPDATE effect - separate from create/dispose
  // Updates controller time range imperatively without recreation
  React.useEffect(() => {
    if (liveTrailControllerRef.current && timeRange) {
      liveTrailControllerRef.current.setTimeRange(timeRange);
    }
  }, [timeRange?.startTime, timeRange?.endTime]);

  // TC-DS-08-FIX: Instrumental buffer with async lazy decode (skipDecode support)
  const [instrumentalBuffer, setInstrumentalBuffer] = React.useState<AudioBuffer | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!duration) {
      setInstrumentalBuffer(null);
      return;
    }
    const ae = (window as any).audioEngine;
    
    // Try sync first (if buffer already decoded)
    const existing = ae?.getAudioBuffer?.() ?? null;
    if (existing) {
      setInstrumentalBuffer(existing);
      return;
    }
    
    // Lazy decode from blob URL (skipDecode optimization)
    ae?.ensureInstrumentalBuffer?.()?.then((buf: AudioBuffer | null) => {
      if (!cancelled && buf) setInstrumentalBuffer(buf);
    });
    
    return () => { cancelled = true; };
  }, [duration]);

  // TC-DS-08-FIX-7: Vocal buffer with useState + useEffect (fixes useMemo caching issue)
  const [vocalBuffer, setVocalBuffer] = React.useState<AudioBuffer | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!duration) {
      setVocalBuffer(null);
      return;
    }
    const ae = (window as any).audioEngine;
    // Try sync first (buffer may already be decoded)
    const existing = ae?.getVocalAudioBuffer?.() ?? null;
    if (existing) {
      setVocalBuffer(existing);
      return;
    }
    // Lazy decode from blob URL (skipDecode optimization)
    ae?.ensureVocalsBuffer?.()?.then((buf: AudioBuffer | null) => {
      if (!cancelled && buf) setVocalBuffer(buf);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [duration]);
  
  // Compute reference peaks for Compare A-B (gold layer)
  const referencePeaks = React.useMemo(() => {
    if (!referenceTakeTarget || !timeRange) return null;
    const buffer = takeAssets.getAudioBuffer(referenceTakeTarget.id);
    if (!buffer) return null;
    
    const sr = buffer.sampleRate;
    const ch = buffer.getChannelData(0);
    const trimStart = referenceTakeTarget.trimStartSec ?? 0;
    const blockDuration = timeRange.endTime - timeRange.startTime;
    
    const s0 = Math.floor(trimStart * sr);
    const s1 = Math.min(
      ch.length, 
      Math.ceil((trimStart + blockDuration) * sr)
    );
    if (s1 <= s0) return null;
    
    return generatePeaks(ch.subarray(s0, s1), 0, s1 - s0, 500);
  }, [referenceTakeTarget, timeRange, assetRevision]);
  
  // Compute compare peaks (orange layer)
  const comparePeaks = React.useMemo(() => {
    if (!compareTakeTarget || !timeRange) return null;
    const buffer = takeAssets.getAudioBuffer(compareTakeTarget.id);
    if (!buffer) {
      if (import.meta.env.DEV) console.log('[PEAKS-MISS]', { takeId: compareTakeTarget.id, slot: compareTakeTarget.slot, reason: 'audioBuffer-null' });
      return null;
    }
    
    const sr = buffer.sampleRate;
    const ch = buffer.getChannelData(0);
    const trimStart = compareTakeTarget.trimStartSec ?? 0;
    const blockDuration = timeRange.endTime - timeRange.startTime;
    
    const s0 = Math.floor(trimStart * sr);
    const s1 = Math.min(
      ch.length, 
      Math.ceil((trimStart + blockDuration) * sr)
    );
    if (s1 <= s0) return null;
    
    const peaks = generatePeaks(ch.subarray(s0, s1), 0, s1 - s0, 500);
    return peaks;
  }, [compareTakeTarget, timeRange, assetRevision]);
  
  // Memoized block time ranges for auto-follow
  const blockRanges = React.useMemo(() => {
    if (!blocks.length || !markers.length) return [];
    
    return blocks.map(block => {
      const range = getBlockTimeRange(block, markers, duration);
      if (!range) return null;
      return { blockId: block.id, startTime: range.startTime, endTime: range.endTime };
    }).filter(Boolean) as Array<{ blockId: string; startTime: number; endTime: number }>;
  }, [blocks, markers, duration]);
  
  // Block ranges ref for rAF access
  const blockRangesRef = React.useRef(blockRanges);
  React.useEffect(() => {
    blockRangesRef.current = blockRanges;
  }, [blockRanges]);

  // Auto-init / self-heal active block (defense-in-depth):
  // Fires when (a) no active block yet (null), or (b) active block ID is stale
  // (track switched / block deleted / ID mutated). The UI must NOT depend
  // on the store always resetting activeBlockId on track change.
  React.useEffect(() => {
    if (blockRanges.length === 0) return;
    if (!activeBlockId || !blocks.some((b) => b.id === activeBlockId)) {
      setActiveBlock(blockRanges[0].blockId);
    }
  }, [blockRanges, blocks, activeBlockId, setActiveBlock]);

  // One-time confirmation log for buffer availability
  React.useEffect(() => {
    if (instrumentalBuffer) {
      if (import.meta.env.DEV) console.log('[TakesCanvas] Instrumental buffer ready:', {
        duration: instrumentalBuffer.duration,
        sampleRate: instrumentalBuffer.sampleRate,
        length: instrumentalBuffer.length,
      });
    }
  }, [instrumentalBuffer]);
  
  // Playhead rAF loop (direct engine read, NO store subscription)
  React.useEffect(() => {
    const el = playheadRef.current;
    if (!el) return;
    let rafId: number;
    let followCount = 0;
    
    const tick = () => {
      const ae = (window as any).audioEngine;
      const t: number = ae?.getCurrentTime?.() ?? 0;
      const w = widthRef.current;
      
      if (!timeRange || w === 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      
      const progress = (t - timeRange.startTime) / 
                      (timeRange.endTime - timeRange.startTime);
      
      if (progress >= -0.05 && progress <= 1.05) {
        const x = Math.max(0, Math.min(w, progress * w));
        el.style.transform = `translateX(${x}px)`;
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
      
      // Block auto-follow (throttled: every ~15 frames ≈ 4Hz)
      if (!isRecordingRef.current && !activeExerciseRef.current && !completionMomentRef.current && followCount % 15 === 0) {
        const currentBlockRange = blockRangesRef.current.find(
          br => t >= br.startTime && t < br.endTime
        );
        if (currentBlockRange && currentBlockRange.blockId !== activeBlockIdRef.current) {
          setActiveBlock(currentBlockRange.blockId);
        }
      }
      followCount++;
      
      rafId = requestAnimationFrame(tick);
    };
    
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [timeRange, setActiveBlock]);

  // ========== EXERCISE HIDDEN ORCHESTRATION ==========
  
  // Effect 1: Scope resolution - compute resolvedTimeRange from current step
  React.useEffect(() => {
    if (!activeExercise || !currentExerciseStep) {
      setResolvedTimeRange(null);
      return;
    }

    // Resolve scope: step-level overrides exercise-level
    const scope = currentExerciseStep.scope ?? activeExercise.scope;
    const resolved = resolveExerciseScope(scope, blocks, markers, duration);
    
    // Equality guard: prevent repeated writes with same values
    const prev = resolvedTimeRangeRef.current;
    const next = resolved;
    
    const changed =
      (prev?.startTime ?? null) !== (next?.startTime ?? null) ||
      (prev?.endTime ?? null) !== (next?.endTime ?? null);
    
    if (changed) {
      setResolvedTimeRange(next);
    }
  }, [activeExercise, currentExerciseStep, blocks, markers, duration, setResolvedTimeRange]);

  // Effect 2: Backing save/apply on executable phases
  React.useEffect(() => {
    // Only apply during listening and recording phases (NOT pre-recording)
    if (
      !activeExercise ||
      !currentExerciseStep ||
      !['listening', 'recording'].includes(phase)
    ) {
      return;
    }

    const ae = (window as any).audioEngine;
    if (!ae) return;

    // Save volumes on first entry
    if (!savedVolumes) {
      const state = useStemStore.getState();
      setSavedVolumes({
        instrumental: state.stemVolumes['instrumental'] ?? 1,
        vocals: state.stemVolumes['vocals'] ?? 1,
      });
    }

    // Resolve backing: step-level overrides exercise-level
    const backing = currentExerciseStep.backing ?? activeExercise.defaultBacking;
    if (!backing) return;

    // Compute backing volumes
    const volumes = resolveBackingVolumes(backing);

    // Apply effective backing: scenario target backing + scenario mix override if present
    const effectiveInstrumental = scenarioMixOverride?.instrumental ?? volumes.instrumental;
    const effectiveVocal = scenarioMixOverride?.vocal ?? volumes.vocals;

    // Apply to engine
    ae.setInstrumentalVolume?.(effectiveInstrumental);
    ae.setVocalsVolume?.(effectiveVocal);

    // Mirror effective values into stem.store for UI truth
    useStemStore.getState().setStemVolume('instrumental', effectiveInstrumental);
    useStemStore.getState().setStemVolume('vocals', effectiveVocal);
  }, [
    activeExercise,
    currentExerciseStep,
    phase,
    savedVolumes,
    setSavedVolumes,
    scenarioMixOverride,
  ]);

  // Effect 2b: PlaybackRate save/apply for tempo-aware steps
  React.useEffect(() => {
    // Only apply during listening phase with tempo-aware step
    if (
      !activeExercise ||
      !currentExerciseStep ||
      phase !== 'listening' ||
      !currentExerciseStep.tempoRate
    ) {
      return;
    }

    const ae = (window as any).audioEngine;
    if (!ae) return;

    // Save playbackRate on first entry
    if (!savedPlaybackRate) {
      setSavedPlaybackRate(ae.getPlaybackRate?.() ?? 1.0);
    }

    // Apply tempo rate from step
    ae.setPlaybackRate?.(currentExerciseStep.tempoRate);
  }, [
    activeExercise,
    currentExerciseStep,
    phase,
    savedPlaybackRate,
    setSavedPlaybackRate,
  ]);

  // Effect 2d: Prep context restoration for pre-recording phase (repeated record rounds)
  React.useEffect(() => {
    // Only apply during pre-recording phase
    if (
      !activeExercise ||
      !currentExerciseStep ||
      phase !== 'pre-recording'
    ) {
      return;
    }

    const ae = (window as any).audioEngine;
    if (!ae) return;

    // Determine if previous step in current scenario sequence was 'listen'
    const previousStepIndex = currentStepIndex - 1;
    const previousStep = previousStepIndex >= 0 
      ? getCurrentExerciseStep(activeExercise, previousStepIndex)
      : null;
    
    const previousWasListen = previousStep?.action === 'listen';

    if (previousWasListen) {
      // Preserve current listening mix into countdown (do nothing - keep current backing)
      return;
    }

    // Otherwise (record-only repeated rounds like 3-Take): restore prep context
    // Restore from user baseline + scenario mix override
    if (!savedVolumes) {
      return; // No baseline to restore from
    }

    // Apply prep context: baseline volumes + scenario mix override if present
    const prepInstrumental = scenarioMixOverride?.instrumental ?? savedVolumes.instrumental;
    const prepVocal = scenarioMixOverride?.vocal ?? savedVolumes.vocals;

    ae.setInstrumentalVolume?.(prepInstrumental);
    ae.setVocalsVolume?.(prepVocal);
  
    // Mirror prep context values into stem.store for UI truth
    useStemStore.getState().setStemVolume('instrumental', prepInstrumental);
    useStemStore.getState().setStemVolume('vocals', prepVocal);
  }, [
    activeExercise,
    currentExerciseStep,
    currentStepIndex,
    phase,
    savedVolumes,
    scenarioMixOverride,
  ]);
  
  // Effect 2f: Prep context restoration for pre-recording phase (repeated record rounds)
  React.useEffect(() => {
    // Only apply during pre-recording phase
    if (
      !activeExercise ||
      !currentExerciseStep ||
      phase !== 'pre-recording'
    ) {
      return;
    }
  
    const ae = (window as any).audioEngine;
    if (!ae) return;
  
    // Determine if previous step in current scenario sequence was 'listen'
    const previousStepIndex = currentStepIndex - 1;
    const previousStep = previousStepIndex >= 0
      ? getCurrentExerciseStep(activeExercise, previousStepIndex)
      : null;
  
    const previousWasListen = previousStep?.action === 'listen';
  
    if (previousWasListen) {
      // Preserve current listening mix into countdown (do nothing - keep current backing)
      return;
    }
  
    // Otherwise (record-only repeated rounds like 3-Take): restore prep context
    // Restore from user baseline + scenario mix override
    if (!savedVolumes) {
      return; // No baseline to restore from
    }
  
    // Apply prep context: baseline volumes + scenario mix override if present
    const prepInstrumental = scenarioMixOverride?.instrumental ?? savedVolumes.instrumental;
    const prepVocal = scenarioMixOverride?.vocal ?? savedVolumes.vocals;
  
    ae.setInstrumentalVolume?.(prepInstrumental);
    ae.setVocalsVolume?.(prepVocal);
  
    // Mirror prep context values into stem.store for UI truth
    useStemStore.getState().setStemVolume('instrumental', prepInstrumental);
    useStemStore.getState().setStemVolume('vocals', prepVocal);
  }, [
    activeExercise,
    currentExerciseStep,
    currentStepIndex,
    phase,
    savedVolumes,
    scenarioMixOverride,
  ]);

  // Effect 4: Restore volumes when exercise ends
  React.useEffect(() => {
    // Only restore when exercise becomes inactive AND we have saved volumes
    if (activeExercise || !savedVolumes) {
      return;
    }

    const ae = (window as any).audioEngine;
    if (!ae) return;

    // Restore engine volumes from saved values
    ae.setInstrumentalVolume?.(savedVolumes.instrumental);
    ae.setVocalsVolume?.(savedVolumes.vocals);

    // Mirror restored baseline values into stem.store for UI truth
    useStemStore.getState().setStemVolume('instrumental', savedVolumes.instrumental);
    useStemStore.getState().setStemVolume('vocals', savedVolumes.vocals);

    // Clear saved volumes
    setSavedVolumes(null);
  }, [activeExercise, savedVolumes, setSavedVolumes]);

  // Effect 4b: Restore playbackRate when exercise ends
  React.useEffect(() => {
    // Only restore when exercise becomes inactive AND we have saved playbackRate
    if (activeExercise || !savedPlaybackRate) {
      return;
    }

    const ae = (window as any).audioEngine;
    if (!ae) return;

    // Restore engine playbackRate from saved value
    ae.setPlaybackRate?.(savedPlaybackRate);

    // Clear saved playbackRate
    setSavedPlaybackRate(null);
  }, [activeExercise, savedPlaybackRate, setSavedPlaybackRate]);

  // Effect 4c: Capture baseline V-Mix state on Tempo scenario start
  React.useEffect(() => {
    // Only capture for Tempo scenarios at first step entry
    if (
      !activeExercise ||
      activeExercise.recipeId !== 'tempo-ladder' ||
      currentStepIndex !== 0 ||
      savedVmixEnabled !== null
    ) {
      return;
    }

    // Capture current V-Mix state from audio store
    const audioState = useAudioStore.getState();
    setSavedVmixEnabled(audioState.vocalMixEnabled);
  }, [activeExercise, currentStepIndex, savedVmixEnabled, setSavedVmixEnabled]);

  // Effect 4d: Apply V-Mix automation for Tempo scenario listen phases
  React.useEffect(() => {
    // Only apply for Tempo scenarios during listening phase
    if (
      !activeExercise ||
      activeExercise.recipeId !== 'tempo-ladder' ||
      phase !== 'listening' ||
      !currentExerciseStep ||
      currentExerciseStep.action !== 'listen'
    ) {
      return;
    }

    const ae = (window as any).audioEngine;
    if (!ae) return;

    // Apply V-Mix based on listenSource
    if (currentExerciseStep.listenSource === 'reference') {
      // Reference listen: ensure V-Mix is OFF
      ae.disableVocalMix?.();
      useAudioStore.setState({ vocalMixEnabled: false });
    } else if (currentExerciseStep.listenSource === 'previous-take') {
      // Previous-take preview: ensure V-Mix is ON
      ae.enableVocalMix?.();
      useAudioStore.setState({ vocalMixEnabled: true });
    }
  }, [activeExercise, phase, currentExerciseStep]);

  // Effect 4e: Restore V-Mix when exercise ends
  React.useEffect(() => {
    // Only restore when exercise becomes inactive AND we have saved V-Mix state
    if (activeExercise || savedVmixEnabled === null) {
      return;
    }

    const ae = (window as any).audioEngine;
    if (!ae) return;

    // Restore engine V-Mix from saved value
    if (savedVmixEnabled) {
      ae.enableVocalMix?.();
    } else {
      ae.disableVocalMix?.();
    }

    // Mirror to audio store
    useAudioStore.setState({ vocalMixEnabled: savedVmixEnabled });

    // Clear saved V-Mix state
    setSavedVmixEnabled(null);
  }, [activeExercise, savedVmixEnabled, setSavedVmixEnabled]);

  // ========== EXERCISE LISTEN EXECUTOR (hidden) ==========
  React.useEffect(() => {
    // Guard: require valid key
    if (!listenExecKey) return;
    
    // Guard: skip if recording (standard guard)
    if (isRecording) return;
    
    // One-shot guard: only run once per unique key
    if (lastListenExecKeyRef.current === listenExecKey) return;
    
    // Mark as executed
    lastListenExecKeyRef.current = listenExecKey;
    
    const ae = (window as any).audioEngine;
    if (!ae) return;
  
    // Get range from ref (guaranteed non-null by key guard)
    const range = listenExecRangeRef.current;
    if (!range) return; // Safety guard
  
    // Stale-run guard with runId
    const runId = ++listenRunIdRef.current;
    let cancelled = false;
    let rafId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
    // BRANCH EARLY: Handle previous-take preview for between-round listening
    if (currentExerciseStep?.listenSource === 'previous-take' && activeBlockId) {
      // Polling mechanism to wait for just-recorded take to become ready
      const MAX_RETRIES = 15;
      const RETRY_INTERVAL_MS = 200;
      let retryCount = 0;
      let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;
      
      const pollForReadyTake = () => {
        // Stale-run guard
        if (cancelled) return;
        if (listenRunIdRef.current !== runId) return;
        
        // Get fresh state from store (not stale closure)
        const takesState = useTakesStore.getState();
        const bt = takesState.getBlockTakes(activeBlockId);
        
        if (bt && bt.takes.length > 0) {
          // Find the last ready take (highest index with status === 'ready')
          let lastReadyTake = null;
          for (let i = bt.takes.length - 1; i >= 0; i--) {
            const take = bt.takes[i];
            if (take && take.status === 'ready' && takeAssets.getAudioBuffer(take.id)) {
              lastReadyTake = take;
              break;
            }
          }
          
          // If ready take found, trigger preview via exposed hook (owns playback path)
          if (lastReadyTake) {
            const playTakeFn = (useTakesStore as any).__playTakeFn;
            if (playTakeFn) {
              try {
                playTakeFn(lastReadyTake.id, { pan: 1, forceContext: true });
              } catch (err) {
                console.error('[Tempo] Previous-take preview failed:', err);
                // Continue without preview - do not crash
              }
            }
            
            // Schedule advance after take duration + safety buffer
            const takeDurationMs = (lastReadyTake.duration ?? 0) * 1000;
            const advanceDelayMs = Math.max(1000, takeDurationMs + 300);
            timeoutId = window.setTimeout(() => {
              if (cancelled) return;
              if (listenRunIdRef.current !== runId) return;
              advanceRef.current();
            }, advanceDelayMs);
            return; // Success - exit polling
          }
        }
        
        // No ready take found - check if we should retry
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          // Schedule next retry
          pollTimeoutId = window.setTimeout(pollForReadyTake, RETRY_INTERVAL_MS);
        } else {
          // Max retries exceeded - graceful auto-advance
          timeoutId = window.setTimeout(() => {
            if (cancelled) return;
            if (listenRunIdRef.current !== runId) return;
            advanceRef.current();
          }, 1500);
        }
      };
      
      // Start polling immediately
      pollForReadyTake();
      
      // Do NOT continue to reference listen path - previous-take owns its playback
      // Let the stage continue under the preview path
      // Cleanup and return early
      return () => {
        cancelled = true;
        setResponseCue(null);
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        if (pollTimeoutId !== null) {
          window.clearTimeout(pollTimeoutId);
        }
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      };
    }
    
    // REFERENCE LISTEN PATH: Standard playback for 'reference' or undefined listenSource
    // Seek to start and play (guard: only play if not already playing)
    ae.setCurrentTime?.(range.startTime);
    if (!ae?.isPlaying) ae.play?.();
    
    // Determine if next step requires continuous handoff (Call & Response)
    const currentExercise = activeExercise;
    const cursor = currentExercise ? advanceExerciseCursor(currentExercise, currentRound, currentStepIndex) : { completed: true, nextRound: 0, nextStepIndex: 0 };
    const nextStep =
      !cursor.completed && currentExercise
        ? getCurrentExerciseStep(currentExercise, cursor.nextStepIndex)
        : null;

    const shouldContinuousHandoff =
      !!nextStep &&
      nextStep.action === 'record' &&
      nextStep.captureMode === 'in-flight';

    // Resolve response start time for anticipatory cue
    let responseCueTargetTime: number | null = null;
    if (shouldContinuousHandoff && nextStep?.scope && activeBlockId) {
      try {
        const resolved = resolveExerciseScope(
          nextStep.scope,
          blocks,
          markers,
          duration
        );
        if (resolved) {
          responseCueTargetTime = resolved.startTime ?? null;
          
          // Set response window highlight for canvas
          setResponseWindow({
            startTime: resolved.startTime,
            endTime: resolved.endTime,
            active: false,  // Not yet recording
          });
        }
      } catch (e) {
        // Silently fail - cue won't show but exercise continues
      }
    }
  
    // rAF loop to monitor playback progress
    const tick = () => {
      // Stale-run guard
      if (cancelled) return;
      if (listenRunIdRef.current !== runId) return;
  
      // Check if audio engine is actually playing
      if (!ae?.isPlaying) {
        rafId = requestAnimationFrame(tick);
        return;
      }
  
      const currentTime = ae.getCurrentTime?.() ?? 0;
  
      // Show anticipatory response cue during continuous handoff
      if (shouldContinuousHandoff && responseCueTargetTime !== null) {
        const left = responseCueTargetTime - currentTime;
        if (left <= 3 && left > 0) {
          setResponseCue(Math.ceil(left));
        } else {
          setResponseCue(null);
        }
      }
  
      // Check if we've reached the end
      if (currentTime >= range.endTime) {
        // Clear cue before advancing
        setResponseCue(null);
        
        // For in-flight handoff, keep transport alive — don't pause
        if (shouldContinuousHandoff) {
          window.clearTimeout(timeoutId!);
            
          // Stale-run guard before advancing
          if (!cancelled && listenRunIdRef.current === runId) {
            advanceRef.current();
          }
          return;
        }
  
        // Standard path: pause then advance
        ae.pause?.();
        window.clearTimeout(timeoutId!);
          
        // Stale-run guard before advancing
        if (!cancelled && listenRunIdRef.current === runId) {
          advanceRef.current();
        }
        return;
      }
  
      // Continue monitoring if not cancelled
      rafId = requestAnimationFrame(tick);
    };
  
    // Timeout fallback: ensure advance even if rAF stalls
    const blockDurationSec = range.endTime - range.startTime;
    const tempoRate = currentExerciseStep?.tempoRate;
    const adjustedDurationSec = tempoRate ? blockDurationSec / tempoRate : blockDurationSec;
    const fallbackMs = Math.max(0, (adjustedDurationSec + 2) * 1000);
    timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      if (listenRunIdRef.current !== runId) return;
        
      // Clear cue on timeout
      setResponseCue(null);
      
      // For in-flight handoff, don't pause — just advance
      if (shouldContinuousHandoff) {
        advanceRef.current();
        return;
      }
        
      // Standard path
      ae.pause?.();
      advanceRef.current();
    }, fallbackMs);
  
    // Start the loop
    rafId = requestAnimationFrame(tick);
  
    // Cleanup: cancel on unmount or dependency change
    return () => {
      cancelled = true;
      setResponseCue(null);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      // Note: do NOT reset lastListenExecKeyRef.current here
      // It should only change when next valid listen step produces a new key
    };
  }, [
    listenExecKey,
    isRecording,
  ]);

  // ========== EXERCISE WAIT EXECUTOR (hidden) ==========
  React.useEffect(() => {
    // Guard: require valid key
    if (!waitExecKey) return;
    
    // One-shot guard: only run once per unique key
    if (lastWaitExecKeyRef.current === waitExecKey) return;
    
    // Mark as executed
    lastWaitExecKeyRef.current = waitExecKey;
    
    // Capture step reference (guaranteed non-null by key guard)
    const step = currentExerciseStep;
    if (!step) return; // Safety guard

    // Stale-run guard with runId
    const runId = ++waitRunIdRef.current;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Compute wait duration
    const waitMs = (step.waitSec ?? 0) * 1000;

    // Schedule advance
    timeoutId = setTimeout(() => {
      // Stale-run guard before advancing
      if (!cancelled && waitRunIdRef.current === runId) {
        advanceRef.current();
      }
    }, waitMs);

    // Cleanup: clear timeout on unmount or dependency change
    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      // Note: do NOT reset lastWaitExecKeyRef.current here
      // It should only change when next valid wait step produces a new key
    };
  }, [
    waitExecKey,
    currentExerciseStep,
  ]);

  // Clear response cue when recording starts
  React.useEffect(() => {
    if (isRecording) {
      setResponseCue(null);
      
      // Activate response window when recording begins
      if (responseWindow && !responseWindow.active) {
        setResponseWindow({ ...responseWindow, active: true });
      }
    }
  }, [isRecording, responseWindow]);
  
  // Cleanup response window on exercise end/cancel
  React.useEffect(() => {
    if (!activeExercise) {
      setResponseWindow(null);
    }
  }, [activeExercise]);

  // Set response window for line-based record stages (Trade v1 and similar)
  React.useEffect(() => {
    // Only set for record phases with lineRange scope
    if (
      !activeExercise ||
      !currentExerciseStep ||
      currentExerciseStep.action !== 'record' ||
      !currentExerciseStep.scope?.lineRange
    ) {
      setResponseWindow(null);
      return;
    }

    // Resolve the lineRange scope to time range
    try {
      const resolved = resolveExerciseScope(
        currentExerciseStep.scope,
        blocks,
        markers,
        duration
      );
      if (resolved) {
        setResponseWindow({
          startTime: resolved.startTime,
          endTime: resolved.endTime,
          active: phase === 'recording',
        });
      } else {
        setResponseWindow(null);
      }
    } catch (e) {
      // Silently fail - no highlight but exercise continues
      setResponseWindow(null);
    }
  }, [activeExercise, currentExerciseStep, phase, blocks, markers, duration]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Waveform canvas with playhead overlay */}
      {activeBlockId && timeRange && (
        <div 
          ref={canvasZoneRef}
          style={{ 
            position: 'relative', 
            cursor: 'crosshair',
            flex: 1,
            minHeight: 0,
          }}
          onClick={(e) => {
            // Future-proof seek guard for all interactive overlays
            if ((e.target as HTMLElement).closest('[data-no-seek]')) return;
            
            // Interrupt practice first if active, then seek
            interruptPracticeSession(() => {
              const rect = e.currentTarget.getBoundingClientRect();
              const progress = (e.clientX - rect.left) / rect.width;
              const t = timeRange.startTime + 
                        progress * (timeRange.endTime - timeRange.startTime);
              const ae = (window as any).audioEngine;
              ae?.setCurrentTime?.(t);
            });
          }}
        >
          <TakesCanvas
            instrumentalBuffer={instrumentalBuffer}
            vocalBuffer={vocalBuffer}
            blockStart={timeRange.startTime}
            blockEnd={timeRange.endTime}
            isRecording={isRecording}
            viewMode={viewMode}
            height={canvasHeight}
            referencePeaks={referencePeaks}
            takePeaks={comparePeaks}
            responseWindow={responseWindow}
          />
          
          {/* EXERCISE OVERLAY - absolute positioned strip inside canvas zone */}
          {activeExercise && (
            <div
              data-no-seek
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 28,
                zIndex: 30,
                pointerEvents: 'auto',
              }}
            >
              <ExerciseStrip />
            </div>
          )}
          
          {/* LIVE TRAIL CANVAS - Imperative renderer overlay */}
          <canvas
            ref={liveCanvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
          
          {/* COUNTDOWN OVERLAY */}
          {countdownOverlay !== null && (
            <div
              data-no-seek
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 20,
                background: 'rgba(0,0,0,0.52)',
                pointerEvents: 'none',
              }}
            >
              <span style={{
                fontSize: 76,
                fontWeight: 900,
                color: 'rgba(255,70,70,0.88)',
                textShadow: '0 0 42px rgba(255,70,70,0.3)',
              }}>
                {countdownOverlay}
              </span>
            </div>
          )}
          
          {/* RESPONSE CUE FOR CALL & RESPONSE (lightweight anticipatory countdown) */}
          {responseCue !== null && (
            <div
              data-no-seek
              style={{
                position: 'absolute',
                top: '15%',
                left: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 25,
                pointerEvents: 'none',
              }}
            >
              <span style={{
                fontSize: 42,
                fontWeight: 700,
                color: 'rgba(255,200,70,0.9)',
                textShadow: '0 0 20px rgba(255,200,70,0.4)',
              }}>
                {responseCue}
              </span>
            </div>
          )}
          
          {/* UNIFIED TOP TOOLBAR: Block info + main control grammar */}
          <TakesToolbar
            activeBlock={activeBlock}
            activeBlockId={activeBlockId}
            timeRange={timeRange}
            viewMode={viewMode}
            setViewMode={setViewMode}
            previewMode={previewMode}
            setPreviewMode={setPreviewMode}
            compareMode={compareMode}
            setCompareMode={setCompareMode}
            exercisePlaybackLocked={exercisePlaybackLocked}
            recipesOpen={recipesOpen}
            setRecipesOpen={setRecipesOpen}
            activeExercise={activeExercise}
            onInterrupt={interruptPracticeSession}
          />
          
          {/* BOTTOM-RIGHT HUD: REC badge */}
          {isRecording && (
            <div
              data-no-seek
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: 999,
                background: 'rgba(0,0,0,0.48)',
                border: '1px solid rgba(255,90,90,0.2)',
                color: '#ff5a5a',
                fontSize: 10,
                fontWeight: 700,
                zIndex: 8,
                pointerEvents: 'none',
              }}
            >
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#ff5a5a',
              }} />
              REC
            </div>
          )}
          
          <div 
            ref={playheadRef}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: '2px',
              background: isRecording ? '#ff3c3c' : 'rgba(255,255,255,0.86)',
              pointerEvents: 'none',
              willChange: 'transform',
              zIndex: 7,
            }}
          />
        </div>
      )}
      
      {/* TakesControlStrip - centered hero trio + utility zone */}
      {activeBlockId && timeRange && (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: 0,
            right: 0,
            zIndex: 15,
            pointerEvents: 'auto',
          }}
        >
          <TakesControlStrip
            activeBlockId={activeBlockId}
            timeRange={timeRange}
            onCountdownChange={setCountdownOverlay}
            onRecorderAnalyserChange={setLiveAnalyser}
            compareMode={compareMode}
            onCompareModeChange={setCompareMode}
            activeCompareSlot={activeCompareSlot}
            onActiveCompareSlotChange={setActiveCompareSlot}
          />
        </div>
      )}
      
      {/* Quest Entry Surface - Real entry layer inside Takes scene */}
      {recipesOpen && activeBlockId && (
        <QuestEntrySurface
          blockId={activeBlockId}
          onClose={() => setRecipesOpen(false)}
          visibility="all"
        />
      )}

      {/* Quest Completion Moment - Completion surface when exercise completes */}
      <QuestCompletionMoment />
    </div>
  );
};
