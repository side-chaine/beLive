// src/bridges/mode-switch.bridge.ts
// Mode switch ownership: React → bridge → legacy engines

import { useTextStyleStore } from '../stores/textStyle.store';
import { useMarkersStore } from '../stores/markers.store';

export type AppMode = 'concert' | 'karaoke' | 'rehearsal' | 'live';

/* ── access helpers ── */

const getApp = (): any => (window as any).app;

function deactivateLiveIfActive(): void {
  const lm = (window as any).liveMode;
  if (lm?.isActive) lm.deactivate();
}

function setBodyMode(mode: AppMode): void {
  const cl = document.body.classList;
  cl.remove(
    'mode-concert', 'mode-karaoke', 'mode-rehearsal', 'mode-live',
    'concert-active', 'karaoke-active', 'rehearsal-active'
  );
  cl.add(`mode-${mode}`);
}

function setTransportOpen(open: boolean): void {
  try {
    const el = document.getElementById('transport-controls');
    if (el) open ? el.classList.add('is-open') : el.classList.remove('is-open');
  } catch (_) { /* safe */ }
}

function emitModeChanged(from: string | null, to: string): void {
  currentMode = to;
  const a = getApp();
  if (a) { try { a.currentMode = to; } catch (_) { /* noop */ } }
  window.dispatchEvent(new CustomEvent('mode-changed', { detail: { from, to } }));
}

/* ── mode state helpers (ownership from app.js F7) ── */

let currentMode: string | null = null;
let previousMode: string | null = null;

function getCurrentMode(): string | null {
  return currentMode ?? detectBodyMode();
}

function detectBodyMode(): string | null {
  const b = document.body.classList;
  if (b.contains('mode-rehearsal')) return 'rehearsal';
  if (b.contains('mode-karaoke')) return 'karaoke';
  if (b.contains('mode-live')) return 'live';
  if (b.contains('mode-concert')) return 'concert';
  return null;
}

function saveCurrentMode(newMode: string): void {
  if (currentMode && currentMode !== newMode) {
    previousMode = currentMode;
  }
  currentMode = newMode;
  // sync to app.js for any remaining legacy readers
  const a = getApp();
  if (a) {
    try { a.currentMode = newMode; a.previousMode = previousMode; } catch (_) { /* noop */ }
  }
}

function applyModeVolumePreset(mode: string): void {
  const instSlider = document.getElementById('instrumental-volume') as HTMLInputElement | null;
  const vocSlider = document.getElementById('vocals-volume') as HTMLInputElement | null;
  const ae = (window as any).audioEngine;

  const apply = (inst: number, voc: number) => {
    if (instSlider) instSlider.value = String(inst);
    if (vocSlider) vocSlider.value = String(voc);
    try { ae?.setInstrumentalVolume((inst || 0) / 100); } catch (_) { /* noop */ }
    try { ae?.setVocalsVolume((voc || 0) / 100); } catch (_) { /* noop */ }
  };

  if (mode === 'karaoke') { apply(100, 0); return; }
  if (mode === 'rehearsal') {
    let inst = 100, voc = 100;
    try {
      const sInst = localStorage.getItem('rehearsal:instrumentalVolume');
      const sVoc = localStorage.getItem('rehearsal:vocalsVolume');
      if (sInst !== null) inst = Math.max(0, Math.min(100, parseInt(sInst, 10) || 0));
      if (sVoc !== null) voc = Math.max(0, Math.min(100, parseInt(sVoc, 10) || 0));
    } catch (_) { /* noop */ }
    apply(inst, voc);
    return;
  }
  if (mode === 'concert' || mode === 'live') { apply(100, 0); }
}

function setLyricsContainerStyle(styleClass: string | null): void {
  const container = document.getElementById('lyrics-container');
  if (!container) return;
  const styleClasses = ['style-karaoke', 'style-concert', 'style-rehearsal', 'style-live'];
  styleClasses.forEach(cls => container.classList.remove(cls));
  if (styleClass) {
    container.classList.add(styleClass);
  }
}

/* ── mode activators ── */

function activateConcert(): void {
  const a = getApp();
  const prev = getCurrentMode();

  enableResidualLiveOverlay(true);
  deactivateLiveIfActive();

  // BG lifecycle managed by useBackgroundManagers hook

  // Style + blocks
  useTextStyleStore.getState().setStyleId('concert');
  setLyricsContainerStyle('style-concert');

  // DOM first, THEN start background (background.start adds *-active class)
  const bpmEl = document.getElementById('bpm-controls'); if (bpmEl) bpmEl.style.display = 'none';
  setBodyMode('concert');
  setTransportOpen(true);

  // Volume + emit
  try { applyModeVolumePreset('concert'); } catch (_) { /* safe */ }
  try { emitModeChanged(prev, 'concert'); } catch (_) { /* safe */ }
}

function activateKaraoke(): void {
  const a = getApp();
  const prev = getCurrentMode();

  enableResidualLiveOverlay(false);
  deactivateLiveIfActive();

  // BG lifecycle managed by useBackgroundManagers hook

  // Style + blocks
  useTextStyleStore.getState().setStyleId('karaoke');
  setLyricsContainerStyle('style-karaoke');

  // DOM first, THEN start background
  const bpmEl = document.getElementById('bpm-controls'); if (bpmEl) bpmEl.style.display = 'none';
  setBodyMode('karaoke');
  setTransportOpen(false);

  // Volume + emit
  try { applyModeVolumePreset('karaoke'); } catch (_) { /* safe */ }
  try { emitModeChanged(prev, 'karaoke'); } catch (_) { /* safe */ }
}

function activateRehearsal(): void {
  const a = getApp();
  const prev = getCurrentMode();

  enableResidualLiveOverlay(true);
  deactivateLiveIfActive();

  // BG lifecycle managed by useBackgroundManagers hook

  // Async gating: wait for lyrics/blocks before activating loop
  const startTs = Date.now();
  const maxWaitMs = 1500;

  const tryActivate = (): void => {
    const ld = a.lyricsDisplay;
    const lyricsReady = Array.isArray(ld?.lyrics) && ld.lyrics.length > 0;
    const markersCount = useMarkersStore.getState().markers.length;
    const blocksReady = Array.isArray(ld?.textBlocks) && ld.textBlocks.length > 0;

    if (lyricsReady && (markersCount === 0 || blocksReady)) {
      // Sanitize blocks
      try {
        if (ld && Array.isArray(ld.textBlocks)) {
          const sanitized = ld._sanitizeBlocks(ld.textBlocks);
          ld.textBlocks = sanitized;
        }
      } catch (_) {}
      useTextStyleStore.getState().setStyleId('rehearsal');
      setLyricsContainerStyle(null);
      const bpmEl = document.getElementById('bpm-controls'); if (bpmEl) bpmEl.style.display = 'flex';
    } else if (Date.now() - startTs < maxWaitMs) {
      setTimeout(tryActivate, 120);
      return;
    } else {
      // Fallback: activate without blocks, retry later
      useTextStyleStore.getState().setStyleId('rehearsal');
      setLyricsContainerStyle(null);
      setTimeout(() => {
        try {
          if (ld && Array.isArray(ld.textBlocks)) {
            const sanitized = ld._sanitizeBlocks(ld.textBlocks);
            ld.textBlocks = sanitized;
            if (ld.currentStyle?.id === 'rehearsal') {
              ld.activateRehearsalDisplay();
            }
          }
        } catch (_) {}
      }, 200);
    }
  };
  tryActivate();

  const bpmEl = document.getElementById('bpm-controls'); if (bpmEl) bpmEl.style.display = 'flex';

  // DOM
  setBodyMode('rehearsal');
  setTransportOpen(true);

  // Emit + volume
  try { emitModeChanged(prev, 'rehearsal'); } catch (_) {}
  try { applyModeVolumePreset('rehearsal'); } catch (_) {}
}

function activateLive(): void {
  const a = getApp();
  const prev = getCurrentMode();

  // BG lifecycle managed by useBackgroundManagers hook

  // Style + blocks
  useTextStyleStore.getState().setStyleId('live');
  setLyricsContainerStyle('style-live');

  // DOM
  const bpmEl = document.getElementById('bpm-controls'); if (bpmEl) bpmEl.style.display = 'none';
  setBodyMode('live');

  // Camera: lazy init + activate
  if (typeof (window as any).LiveMode !== 'undefined') {
    const lm = (window as any).liveMode;
    if (lm) {
      lm.activate().catch((err: any) => {
        console.error('Live mode activation error:', err);
      });
    }
  }

  // Volume + emit
  try { applyModeVolumePreset('live'); } catch (_) {}
  try { emitModeChanged(prev, 'live'); } catch (_) {}
}

/* ── main router ── */

/** F34: Live overlay toggle (migrated from app.js) */
function enableResidualLiveOverlay(show: boolean): void {
  try {
    const el = document.getElementById('live-lyrics-container');
    if (!el) return;
    el.style.pointerEvents = 'none';
    el.style.zIndex = '9200';
    if (show) {
      el.classList.remove('hidden');
      el.style.display = '';
    } else {
      el.classList.add('hidden');
      el.style.display = 'none';
    }
  } catch (_) {}
}

export function switchMode(mode: AppMode): void {
  const a = getApp();
  if (!a) return;
  if (a.currentMode === mode) return;

  // Pre-switch: hide waveform if open
  const we = (window as any).waveformEditor;
  if (we?.isVisible) we.hide();

  saveCurrentMode(mode);

  switch (mode) {
    case 'concert':   activateConcert(); break;
    case 'karaoke':   activateKaraoke(); break;
    case 'rehearsal': activateRehearsal(); break;
    case 'live':      activateLive(); break;
  }
}


// Expose to legacy JS (live-mode.js etc.)
(window as any).beLiveSwitchMode = switchMode;

// F34: Mode button clicks (migrated from app.js)
function bindModeButtons(): void {
  document.querySelectorAll('.mode-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = (btn as HTMLElement).dataset.mode as AppMode;
      if (mode) switchMode(mode);
    });
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindModeButtons);
} else {
  bindModeButtons();
}
