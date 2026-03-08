import { create } from 'zustand';
import { getColorForBlockType, getActiveLineAtTime as getActiveLineAtTimeUtil } from '../utils/markerUtils';

export interface Marker {
  id: string;
  lineIndex: number;
  time: number;
  text: string;
  blockType?: string;
  color?: string;
}

export interface Section {
  id: string;
  type: string;
  index: number;
  label: string;
  color: string | undefined;
  start: number;
  end: number | null;
  markerIds: string[];
}

// getColorForBlockType re-exported from markerUtils for backward compatibility
export { getColorForBlockType };

interface MarkersState {
  markers: Marker[];
  sections: Section[];
  trackDuration: number;
  syncMode: 'line' | 'word';

  setMarkers: (m: Marker[]) => void;
  setSections: (s: Section[]) => void;
  setTrackDuration: (d: number) => void;
  setSyncMode: (mode: 'line' | 'word') => void;

  getActiveLineAtTime: (time: number) => number;

  // CRUD actions — delegate to legacy MM, bridge syncs back
  addMarker: (lineIndex: number, time: number) => void;
  deleteMarker: (id: string) => void;
  updateMarker: (id: string, updates: Partial<Marker>) => void;
}

export const useMarkersStore = create<MarkersState>((set, get) => ({
  markers: [],
  sections: [],
  trackDuration: 0,
  syncMode: 'line',

  setMarkers: (m) => set({ markers: m }),
  setSections: (s) => set({ sections: s }),
  setTrackDuration: (d) => set({ trackDuration: d }),
  setSyncMode: (mode) => set({ syncMode: mode }),

  getActiveLineAtTime: (time: number) => getActiveLineAtTimeUtil(get().markers, time),

  // CRUD — call legacy MM, bridge auto-syncs store
  addMarker: (lineIndex, time) => {
    const mm = (window as any).markerManager;
    if (mm?.addMarker) mm.addMarker(lineIndex, time);
  },
  deleteMarker: (id) => {
    const mm = (window as any).markerManager;
    if (mm?.deleteMarker) mm.deleteMarker(id);
  },
  updateMarker: (id, updates) => {
    const mm = (window as any).markerManager;
    if (mm?.updateMarker) mm.updateMarker(id, updates);
  },
}));