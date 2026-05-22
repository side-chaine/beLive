/**
 * Audio Analysis Service — WASM-based audio analysis via @libraz/libsonare
 * Layer 2: Client-side analysis of real audio data
 *
 * - Works offline
 * - Works for any track (even "Track_01")
 * - $0 cost
 * - Reads audio from IDB ArrayBuffer (not blob URLs) — safe against revocation
 */

import type { TrackMeta } from '../types/track-meta.types';
import { getTrack, updateTrackField } from './idb.service';

// ─── Types ──────────────────────────────────────────────

export interface AnalysisResult {
  bpm: number;
  key: string | null;
  camelot: string | null;
  energy: number | null;
  danceability: number | null;
  mood: string | null;
  analysedAt: string;
  analysisEngine: string;
}

// ─── Camelot Wheel Mapping ─────────────────────────────

const CAMELOT_MAP: Record<string, string> = {
  'C major': '8B', 'C minor': '8A',
  'C# major': '3B', 'C# minor': '3A',
  'Db major': '3B', 'Db minor': '3A',
  'D major': '10B', 'D minor': '10A',
  'D# major': '5B', 'D# minor': '5A',
  'Eb major': '5B', 'Eb minor': '5A',
  'E major': '12B', 'E minor': '12A',
  'F major': '7B', 'F minor': '7A',
  'F# major': '2B', 'F# minor': '2A',
  'Gb major': '2B', 'Gb minor': '2A',
  'G major': '9B', 'G minor': '9A',
  'G# major': '4B', 'G# minor': '4A',
  'Ab major': '4B', 'Ab minor': '4A',
  'A major': '11B', 'A minor': '11A',
  'A# major': '6B', 'A# minor': '6A',
  'Bb major': '6B', 'Bb minor': '6A',
  'B major': '1B', 'B minor': '1A',
};

function keyToCamelot(keyName: string): string | null {
  if (CAMELOT_MAP[keyName]) return CAMELOT_MAP[keyName];

  const lower = keyName.toLowerCase();
  for (const [k, v] of Object.entries(CAMELOT_MAP)) {
    if (k.toLowerCase() === lower) return v;
  }

  if (!lower.includes('minor') && !lower.includes('major')) {
    const majorKey = `${keyName} major`;
    if (CAMELOT_MAP[majorKey]) return CAMELOT_MAP[majorKey];
  }

  return null;
}

// ─── Energy Calculation (RMS-based) ─────────────────────

function computeEnergy(samples: Float32Array): number {
  const len = Math.min(samples.length, 44100 * 30);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sum / len);
  return Math.min(1, Math.max(0, rms * 3.33));
}

// ─── Mood Inference ─────────────────────────────────────

function inferMood(keyName: string | null, energy: number | null): string | null {
  if (!keyName) return null;
  const isMinor = keyName.toLowerCase().includes('minor');
  const isHighEnergy = energy !== null && energy > 0.6;

  if (isMinor && isHighEnergy) return 'aggressive';
  if (isMinor && !isHighEnergy) return 'melancholic';
  if (!isMinor && isHighEnergy) return 'energetic';
  return 'calm';
}

// ─── WASM Lifecycle ────────────────────────────────────

let _initPromise: Promise<void> | null = null;
let _analyzeFn: ((samples: Float32Array, sampleRate: number) => any) | null = null;

async function ensureInit(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const libsonare = await import('@libraz/libsonare');

      // Strategy 1: Let libsonare find its own WASM
      try {
        await libsonare.init();
        _analyzeFn = libsonare.analyze;
        
        console.log('[AudioAnalysis] WASM initialized (auto-detect)');
        return;
      } catch (_) {
        // auto-detect failed, try explicit path
      }

      // Strategy 2: Vite ?url import (package exports: "./wasm" → "./dist/sonare.wasm")
      try {
        const wasmModule = await import('@libraz/libsonare/wasm?url');
        await libsonare.init({ wasmPath: wasmModule.default });
        _analyzeFn = libsonare.analyze;
        
        console.log('[AudioAnalysis] WASM initialized (explicit wasm path)');
        return;
      } catch (e2) {
        _initPromise = null;
        _analyzeFn = null;
        
        console.error('[AudioAnalysis] WASM init failed (both strategies):', e2);
        throw e2;
      }
    } catch (e) {
      _initPromise = null;
      _analyzeFn = null;
      
      throw e;
    }
  })();

  return _initPromise;
}

// ─── Audio Decode (ArrayBuffer → Float32Array) ─────────

const ANALYSIS_SR = 22050;

async function decodeAudioFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  // Copy buffer — decodeAudioData may detach it in some browsers
  const bufferCopy = arrayBuffer.slice(0);

  if (typeof OfflineAudioContext === 'undefined') {
    throw new Error('OfflineAudioContext not available');
  }

  // Decode directly at target sample rate — free downsample via Web Audio API
  const ctx = new OfflineAudioContext(1, 1, ANALYSIS_SR);
  const audioBuffer = await ctx.decodeAudioData(bufferCopy);
  const sampleRate = audioBuffer.sampleRate;

  // Mono downmix if stereo
  if (audioBuffer.numberOfChannels === 1) {
    return { samples: audioBuffer.getChannelData(0), sampleRate };
  }

  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);
  const mono = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) {
    mono[i] = (left[i] + right[i]) / 2;
  }

  console.log(`[AudioAnalysis] Decoded at ${sampleRate}Hz, ${mono.length} samples`);
  return { samples: mono, sampleRate };
}

// ─── Core Analysis ─────────────────────────────────────

export async function analyzeTrack(
  audioData: ArrayBuffer,
): Promise<AnalysisResult | null> {
  try {
    await ensureInit();

    if (!_analyzeFn) {
      console.error('[AudioAnalysis] analyze function not available');
      return null;
    }

    const { samples, sampleRate } = await decodeAudioFromArrayBuffer(audioData);

    const t0 = performance.now();
    const result = _analyzeFn(analysisSamples, analysisSr);
    const elapsed = performance.now() - t0;
    console.log(`[AudioAnalysis] analyze() took ${elapsed.toFixed(0)}ms`);

    if (!result) {
      console.warn('[AudioAnalysis] analyze() returned null/undefined');
      return null;
    }

    // Extract BPM
    const bpm = result.bpm || 0;
    if (bpm <= 0 || isNaN(bpm)) {
      console.warn('[AudioAnalysis] Invalid BPM:', bpm);
      return null;
    }

    // Extract Key
    const keyName = result.key?.name || null;

    // Compute Camelot from key name
    const camelot = keyName ? keyToCamelot(keyName) : null;

    // Compute Energy (RMS-based, not from libsonare)
    const energy = computeEnergy(samples);

    // Infer mood from key + energy
    const mood = inferMood(keyName, energy);

    return {
      bpm: Math.round(bpm),
      key: keyName,
      camelot,
      energy: Math.round(energy * 100) / 100,
      danceability: null,
      mood,
      analysedAt: new Date().toISOString(),
      analysisEngine: '@libraz/libsonare@1.1.0',
    };
  } catch (e) {
    console.error('[AudioAnalysis] analyzeTrack failed:', e);
    return null;
  }
}

// ─── Analyze + Persist to IDB ──────────────────────────

export async function analyzeAndPersist(
  trackId: number,
): Promise<AnalysisResult | null> {
  try {
    // 1. Read track from IDB
    const track = await getTrack(trackId);
    if (!track?.instrumentalData) {
      console.warn('[AudioAnalysis] No instrumental data for track', trackId);
      return null;
    }

    // 2. Skip if already analyzed (any bpm value present)
    if (track.trackMeta?.bpm != null) {
      console.log('[AudioAnalysis] Track', trackId, 'already analyzed (BPM:', track.trackMeta.bpm, ')');
      return null;
    }

    // 3. Analyze
    const result = await analyzeTrack(track.instrumentalData);
    if (!result) return null;

    // 4. Merge with existing meta and persist
    const existingMeta: TrackMeta = track.trackMeta || {
      genre: null, label: null, releaseDate: null, isrc: null, mbid: null,
      tags: null, listeners: null, playcount: null, similarTracks: null,
      bpm: null, key: null, camelot: null, energy: null,
      danceability: null, mood: null, analysedAt: null, analysisEngine: null,
    };

    const mergedMeta: TrackMeta = {
      ...existingMeta,
      bpm: result.bpm,
      key: result.key,
      camelot: result.camelot,
      energy: result.energy,
      danceability: result.danceability,
      mood: result.mood,
      analysedAt: result.analysedAt,
      analysisEngine: result.analysisEngine,
    };

    await updateTrackField(trackId, { trackMeta: mergedMeta });

    console.log('[AudioAnalysis] Persisted for track', trackId,
      { bpm: result.bpm, key: result.key, camelot: result.camelot, energy: result.energy });

    return result;
  } catch (e) {
    console.error('[AudioAnalysis] analyzeAndPersist failed:', e);
    return null;
  }
}
