// ============================================================
// src/services/mode-switch.service.ts
// Extracted from src/bridges/mode-switch.bridge.ts
// Core switchMode logic — clean, no side-effect exports
// ============================================================

import { useStemStore } from '../stem/stem.store';
import { BUILTIN_STEMS, MODE_STEM_POLICIES } from '../stem/stemTypes';
import type { StemRole, ModeStemPolicy } from '../stem/stemTypes';

type AppMode = 'concert' | 'karaoke' | 'rehearsal' | 'live';

// ─── Helpers ───────────────────────────────────────────────

function getApp(): any {
  return (window as any).app;
}

function setBodyMode(mode: string): void {
  document.body.className = document.body.className
    .replace(/mode-\w+/g, '')
    .trim() + ` mode-${mode}`;
}

function setTransportOpen(open: boolean): void {
  const el = document.getElementById('transport-controls');
  if (el) el.classList.toggle('is-open', open);
}

function emitModeChanged(from: string, to: string): void {
  const a = getApp();
  if (a) a.currentMode = to;
  window.dispatchEvent(new CustomEvent('mode-changed', { detail: { from, to } }));
}

function getRolePolicyVolume(role: StemRole, policy: ModeStemPolicy): number {
  switch (role) {
    case 'master': return policy.musicGroup;
    case 'music': return policy.musicGroup;
    case 'vocal': return policy.leadVocal;
    case 'backing': return policy.backingVocal;
    case 'effect': return policy.musicGroup;
  }
}

function updateDomSlider(stemId: string, volume: number): void {
  const slider = document.getElementById(`${stemId}-volume`) as HTMLInputElement | null;
  if (slider) slider.value = String(Math.round(volume * 100));
}

const VOLUME_STORAGE_KEY = 'bl-rehearsal-volumes';

function saveRehearsalVolumesToStorage(): void {
  try {
    const st = useStemStore.getState();
    const data: Record<string, number> = {};
    for (const stemId of st.loadedStems) {
      data[stemId] = st.stemVolumes[stemId] ?? 1;
    }
    localStorage.setItem(VOLUME_STORAGE_KEY, JSON.stringify({ v: 2, stemVolumes: data }));
  } catch (_) {}
}

function loadRehearsalVolumesFromStorage(): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.v === 2 && parsed.stemVolumes) {
      const result: Record<string, number> = {};
      for (const [key, val] of Object.entries(parsed.stemVolumes as Record<string, unknown>)) {
        const n = Number(val);
        result[key] = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
      }
      return result;
    }
    if (parsed.instrumentalVolume !== undefined || parsed.vocalsVolume !== undefined) {
      const clamp = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1; };
      return { instrumental: clamp(parsed.instrumentalVolume ?? 1), vocals: clamp(parsed.vocalsVolume ?? 1) };
    }
    return null;
  } catch { return null; }
}

// ─── Mode persistence ──────────────────────────────────────

let currentMode: AppMode | undefined;
let previousMode: AppMode | undefined;

function getCurrentMode(): AppMode | undefined {
  if (currentMode) return currentMode;
  const body = document.body.className;
  if (body.includes('mode-concert')) return 'concert';
  if (body.includes('mode-karaoke')) return 'karaoke';
  if (body.includes('mode-live')) return 'live';
  return 'rehearsal';
}

function detectBodyMode(): AppMode | undefined {
  const body = document.body.className;
  if (body.includes('mode-concert')) return 'concert';
  if (body.includes('mode-karaoke')) return 'karaoke';
  if (body.includes('mode-rehearsal')) return 'rehearsal';
  if (body.includes('mode-live')) return 'live';
  return undefined;
}

function saveCurrentMode(mode: AppMode): void {
  previousMode = currentMode;
  currentMode = mode;
  const a = getApp();
  if (a) {
    a.previousMode = previousMode;
    a.currentMode = mode;
  }
}

// ─── Volume policy ─────────────────────────────────────────

function applyModeVolumePreset(mode: string): void {
  const ae = (window as any).audioEngine;
  if (!ae) return;
  const policy = MODE_STEM_POLICIES[mode];
  if (!policy) return;
  const st = useStemStore.getState();

  if (mode === 'rehearsal') {
    const saved = loadRehearsalVolumesFromStorage();
    for (const stemId of st.loadedStems) {
      const vol = saved?.[stemId] ?? 1;
      try { ae.setStemVolume?.(stemId, vol); } catch {}
      useStemStore.getState().setStemVolume(stemId, vol);
      updateDomSlider(stemId, vol);
    }
  } else {
    for (const stemId of st.loadedStems) {
      const def = BUILTIN_STEMS[stemId];
      const role: StemRole = def?.role ?? 'music';
      const vol = getRolePolicyVolume(role, policy);
      try { ae.setStemVolume?.(stemId, vol); } catch {}
      useStemStore.getState().setStemVolume(stemId, vol);
      updateDomSlider(stemId, vol);
    }
  }
}

function setLyricsContainerStyle(mode: string): void {
  const container = document.getElementById('lyrics-container');
  if (!container) return;
  container.className = container.className.replace(/style-\w+/g, '').trim() + ` style-${mode}`;
}

// ─── Mode activators ───────────────────────────────────────

function activateConcert(): void {
  setBodyMode('concert');
  setTransportOpen(true);
  setLyricsContainerStyle('concert');
  document.getElementById('bpm-controls')?.style.setProperty('display', 'none');
  emitModeChanged(getCurrentMode() ?? 'rehearsal', 'concert');
  applyModeVolumePreset('concert');
}

function activateKaraoke(): void {
  setBodyMode('karaoke');
  setTransportOpen(true);
  setLyricsContainerStyle('karaoke');
  document.getElementById('bpm-controls')?.style.setProperty('display', 'none');
  emitModeChanged(getCurrentMode() ?? 'rehearsal', 'karaoke');
  applyModeVolumePreset('karaoke');
}

function activateRehearsal(): void {
  setBodyMode('rehearsal');
  setTransportOpen(false);
  setLyricsContainerStyle('rehearsal');
  document.getElementById('bpm-controls')?.style.setProperty('display', '');
  emitModeChanged(getCurrentMode() ?? 'rehearsal', 'rehearsal');
  applyModeVolumePreset('rehearsal');

  // Async gating: ждём lyrics + markers готовности
  const ld = (window as any).lyricsDisplay;
  if (ld && Array.isArray(ld.textBlocks) && ld.textBlocks.length > 0) return;
  let attempts = 0;
  const poll = setInterval(() => {
    const ld2 = (window as any).lyricsDisplay;
    if (!ld2) { clearInterval(poll); return; }
    const markers = (window as any).markerManager?.getMarkers?.() ?? [];
    attempts++;
    if (markers.length > 0 || attempts > 30) {
      clearInterval(poll);
    }
  }, 100);
}

function activateLive(): void {
  setBodyMode('live');
  setTransportOpen(true);
  setLyricsContainerStyle('live');
  document.getElementById('bpm-controls')?.style.setProperty('display', 'none');
  enableResidualLiveOverlay();
  emitModeChanged(getCurrentMode() ?? 'rehearsal', 'live');
  applyModeVolumePreset('live');
}

function enableResidualLiveOverlay(): void {
  const overlay = document.getElementById('live-lyrics-container');
  if (overlay) {
    overlay.classList.remove('hidden');
    (overlay as HTMLElement).style.zIndex = '200';
  }
}

// ─── Main entry ────────────────────────────────────────────

export function switchMode(mode: AppMode): void {
  const a = getApp();
  if (!a) return;
  if (a.currentMode === mode) return;

  const prev = getCurrentMode();
  if (prev === 'rehearsal' && mode !== 'rehearsal') {
    saveRehearsalVolumesToStorage();
  }

  saveCurrentMode(mode);

  switch (mode) {
    case 'concert':   activateConcert(); break;
    case 'karaoke':   activateKaraoke(); break;
    case 'rehearsal': activateRehearsal(); break;
    case 'live':      activateLive(); break;
  }
}

// ─── Legacy exports ────────────────────────────────────────

(window as any).beLiveSwitchMode = switchMode;
