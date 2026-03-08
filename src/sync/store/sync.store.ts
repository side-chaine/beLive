import { create } from 'zustand';
import { useMarkersStore } from '../../stores/markers.store';

export type WaveformSource = 'instrumental' | 'vocal' | 'mix';

interface MarkerSnapshot {
  id: string;
  time: number;
  lineIndex: number;
  blockType?: string;
  color?: string;
}

interface SyncState {
  open: boolean;
  zoom: number;
  followPlayhead: boolean;
  sourceMode: WaveformSource;
  markersVisible: boolean;

  // Undo/Redo
  undoStack: MarkerSnapshot[][];
  redoStack: MarkerSnapshot[][];
  isDirty: boolean;

  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  markClean: () => void;

  openSync: () => void;
  closeSync: () => void;
  setZoom: (z: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleFollow: () => void;
  setSourceMode: (m: WaveformSource) => void;
  toggleMarkersVisible: () => void;
}

const MIN_ZOOM = 10;
const MAX_ZOOM = 500;
const DEFAULT_ZOOM = 50;
const ZOOM_FACTOR = 1.3;

export const useSyncStore = create<SyncState>((set) => ({
  open: false,
  zoom: DEFAULT_ZOOM,
  followPlayhead: true,
  sourceMode: 'mix',
  markersVisible: true,

  undoStack: [],
  redoStack: [],
  isDirty: false,

  pushUndo: () => {
    const mm = (window as any).markerManager;
    if (!mm) return;
    const snapshot = (mm.getMarkers?.() || []).map((m: any) => ({
      id: m.id, time: m.time, lineIndex: m.lineIndex,
      blockType: m.blockType, color: m.color,
    }));
    set((s) => ({
      undoStack: [...s.undoStack, snapshot],
      redoStack: [],
      isDirty: true,
    }));
  },

  undo: () => set((s) => {
    if (s.undoStack.length === 0) return s;
    const mm = (window as any).markerManager;
    if (!mm) return s;

    // Save current state to redo
    const current = (mm.getMarkers?.() || []).map((m: any) => ({
      id: m.id, time: m.time, lineIndex: m.lineIndex,
      blockType: m.blockType, color: m.color,
    }));

    const prev = s.undoStack[s.undoStack.length - 1];
    // Restore markers in legacy
    mm.setMarkers(prev.map((m: any) => ({ ...m })));
    // Sync React store so canvas redraws
    useMarkersStore.setState({ markers: [...mm.markers] });

    return {
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, current],
      isDirty: s.undoStack.length > 1,
    };
  }),

  redo: () => set((s) => {
    if (s.redoStack.length === 0) return s;
    const mm = (window as any).markerManager;
    if (!mm) return s;

    const current = (mm.getMarkers?.() || []).map((m: any) => ({
      id: m.id, time: m.time, lineIndex: m.lineIndex,
      blockType: m.blockType, color: m.color,
    }));

    const next = s.redoStack[s.redoStack.length - 1];
    mm.setMarkers(next.map((m: any) => ({ ...m })));
    // Sync React store so canvas redraws
    useMarkersStore.setState({ markers: [...mm.markers] });

    return {
      undoStack: [...s.undoStack, current],
      redoStack: s.redoStack.slice(0, -1),
      isDirty: true,
    };
  }),

  markClean: () => set({ isDirty: false, undoStack: [], redoStack: [] }),

  openSync: () => set({ open: true }),
  closeSync: () => set({ open: false }),

  setZoom: (z) => set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)) }),
  zoomIn: () => set((s) => ({
    zoom: Math.min(MAX_ZOOM, s.zoom * ZOOM_FACTOR),
  })),
  zoomOut: () => set((s) => ({
    zoom: Math.max(MIN_ZOOM, s.zoom / ZOOM_FACTOR),
  })),

  toggleFollow: () => set((s) => ({ followPlayhead: !s.followPlayhead })),
  setSourceMode: (m) => set({ sourceMode: m }),
  toggleMarkersVisible: () => set((s) => ({
    markersVisible: !s.markersVisible,
  })),
}));
