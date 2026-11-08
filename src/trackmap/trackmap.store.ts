import { create } from 'zustand';

/**
 * TrackMap control surface.
 *
 * TrackMap is not decoration — it is the map of the song and (later) the
 * material selector for LoopLearn. So the component must stay dumb and this
 * store owns every visual decision:
 *
 *   - `dimMode`     — how the strip behaves while a block is active.
 *   - `selection`   — which blocks are picked as learning material.
 *   - `fxEnabled`   — the startup "blink" (a taste switch, persisted).
 *   - `fxIntensity` — 0..1 multiplier for glow strength (taste switch).
 *
 * Deliberately NOT persisted: the currently running fx (it is a transient,
 * a few seconds long) and the run key.
 */

export type TrackMapDimMode =
  /** все блоки одинаково читаемы (текущее поведение) */
  | 'off'
  /** активный ярче, остальные мягко притухают */
  | 'soft'
  /** только активный (и выбранные), остальные почти гаснут */
  | 'solo';

interface TrackMapState {
  dimMode: TrackMapDimMode;
  fxEnabled: boolean;
  fxIntensity: number;
  /** LoopLearn: материал, который учим. Пусто = весь трек. */
  selection: string[];

  setDimMode: (m: TrackMapDimMode) => void;
  setFxEnabled: (v: boolean) => void;
  setFxIntensity: (v: number) => void;
  cycleDimMode: () => void;

  toggleSelected: (blockId: string) => void;
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (blockId: string) => boolean;
}

const DIM_CYCLE: TrackMapDimMode[] = ['off', 'soft', 'solo'];

export const useTrackMapStore = create<TrackMapState>()((set, get) => ({
  // Никита 07.11: «остальные блоки темнее» — soft включён по умолчанию.
  // Без него активный блок не читается: у всех Chorus одинаковый красный градиент.
  dimMode: 'soft',
  fxEnabled: true,
  fxIntensity: 1,
  selection: [],

  setDimMode: (dimMode) => set({ dimMode }),
  setFxEnabled: (fxEnabled) => set({ fxEnabled }),
  setFxIntensity: (v) => set({ fxIntensity: Math.max(0, Math.min(1, v)) }),
  cycleDimMode: () => {
    const i = DIM_CYCLE.indexOf(get().dimMode);
    set({ dimMode: DIM_CYCLE[(i + 1) % DIM_CYCLE.length] });
  },

  toggleSelected: (blockId) => set((s) => ({
    selection: s.selection.includes(blockId)
      ? s.selection.filter(id => id !== blockId)
      : [...s.selection, blockId],
  })),
  setSelection: (selection) => set({ selection }),
  clearSelection: () => set({ selection: [] }),
  isSelected: (blockId) => get().selection.includes(blockId),
}));
