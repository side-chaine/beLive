import { create } from 'zustand';
import type { BlockType, EditingBlock, SavedBlock } from '../types';

/* ═══════════════════════════════════════════
   Block Editor Store — Sprint 36
   Editor-only state (transient, not persisted)
   Separate from blocks.store.ts (read-only mirror)
   ═══════════════════════════════════════════ */

// ── Helpers ──────────────────────────────

function uid(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function detectType(content: string): BlockType {
  const l = content.toLowerCase();
  if (l.includes('chorus') || l.includes('припев') || l.includes('refrain')) return 'chorus';
  if (l.includes('prechorus') || l.includes('предприпев') || l.includes('pre-chorus')) return 'prechorus';
  if (l.includes('bridge') || l.includes('бридж')) return 'bridge';
  if (l.includes('intro') || l.includes('интро')) return 'intro';
  if (l.includes('outro') || l.includes('аутро')) return 'outro';
  return 'verse';
}

/** Parse raw lyrics text into EditingBlock[] with tracked lineIndices */
function parseText(text: string): { blocks: EditingBlock[]; lyricsLines: string[] } {
  const lyricsLines = (text || '').split('\n').map(l => l.trim());
  if (!text || !text.trim()) return { blocks: [], lyricsLines };

  const normalized = text.replace(/\r\n|\r/g, '\n');
  const chunks = normalized.split(/\n{2,}/).filter(c => c.trim());
  let cursor = 0;

  const blocks: EditingBlock[] = chunks.map(chunk => {
    const trimmed = chunk.trim();
    const type = detectType(trimmed);
    const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
    const lineIndices: number[] = [];

    for (const line of lines) {
      const idx = lyricsLines.indexOf(line, cursor);
      if (idx !== -1) {
        lineIndices.push(idx);
        cursor = idx + 1;
      }
    }

    return { id: uid(), text: trimmed, type, lineIndices };
  });

  return { blocks, lyricsLines };
}

function serialize(blocks: EditingBlock[]): string {
  return JSON.stringify(blocks);
}

function deserialize(json: string): EditingBlock[] {
  return JSON.parse(json);
}

// ── Types ────────────────────────────────

type SaveCb = (blocks: SavedBlock[], lyrics: string, trackInfo: any) => Promise<any>;
type CancelCb = () => void;

interface BlockEditorState {
  /* modal */
  isOpen: boolean;

  /* data */
  blocks: EditingBlock[];
  lyricsLines: string[];
  trackInfo: any | null;

  /* ui */
  isEditMode: boolean;
  selectedBlockId: string | null;
  isSaving: boolean;
  isDirty: boolean;

  /* history */
  undoStack: string[];
  redoStack: string[];

  /* legacy callbacks (set by bridge) */
  _onSave: SaveCb | null;
  _onCancel: CancelCb | null;

  /* ── actions ── */
  open: (text: string, trackInfo: any, onSave: SaveCb | null, onCancel?: CancelCb | null) => void;
  close: () => void;
  cancel: () => void;

  selectBlock: (id: string | null) => void;
  setBlockType: (id: string, type: BlockType) => void;
  addBlock: () => void;
  deleteBlock: (id: string) => void;
  mergeBlocks: (sourceId: string, targetId: string) => void;
  updateBlockText: (id: string, text: string) => void;
  toggleEditMode: () => void;

  undo: () => void;
  redo: () => void;

  save: () => Promise<void>;
}

// ── Snapshot helper ──

function pushSnapshot(get: () => BlockEditorState, set: (p: Partial<BlockEditorState>) => void) {
  const snap = serialize(get().blocks);
  const stack = get().undoStack;
  if (stack.length > 0 && stack[stack.length - 1] === snap) return;
  set({ undoStack: [...stack, snap], redoStack: [] });
}

// ── Empty state ──

const EMPTY: Partial<BlockEditorState> = {
  isOpen: false,
  blocks: [],
  lyricsLines: [],
  trackInfo: null,
  isEditMode: false,
  selectedBlockId: null,
  isSaving: false,
  isDirty: false,
  undoStack: [],
  redoStack: [],
  _onSave: null,
  _onCancel: null,
};

// ── Store ──────────────────────────────

export const useBlockEditorStore = create<BlockEditorState>((set, get) => ({
  ...(EMPTY as BlockEditorState),

  /* ── lifecycle ── */

  open: (text, trackInfo, onSave, onCancel) => {
    const { blocks, lyricsLines } = parseText(text);
    set({
      isOpen: true,
      blocks,
      lyricsLines,
      trackInfo,
      isEditMode: false,
      selectedBlockId: null,
      isSaving: false,
      isDirty: false,
      undoStack: [],
      redoStack: [],
      _onSave: onSave ?? null,
      _onCancel: onCancel ?? null,
    });
  },

  close: () => set(EMPTY),

  cancel: () => {
    get()._onCancel?.();
    set(EMPTY);
  },

  /* ── selection ── */

  selectBlock: (id) => set({ selectedBlockId: id }),

  /* ── block mutations (all push snapshot first) ── */

  setBlockType: (id, type) => {
    pushSnapshot(get, set);
    set(s => ({
      blocks: s.blocks.map(b => b.id === id ? { ...b, type } : b),
      isDirty: true,
    }));
  },

  addBlock: () => {
    pushSnapshot(get, set);
    const newBlock: EditingBlock = { id: uid(), text: '', type: 'verse', lineIndices: [] };
    set(s => ({ blocks: [...s.blocks, newBlock], isDirty: true }));
  },

  deleteBlock: (id) => {
    pushSnapshot(get, set);
    set(s => ({
      blocks: s.blocks.filter(b => b.id !== id),
      selectedBlockId: s.selectedBlockId === id ? null : s.selectedBlockId,
      isDirty: true,
    }));
  },

  mergeBlocks: (sourceId, targetId) => {
    if (sourceId === targetId) return;
    const { blocks } = get();
    const src = blocks.find(b => b.id === sourceId);
    const tgt = blocks.find(b => b.id === targetId);
    if (!src || !tgt) return;

    pushSnapshot(get, set);

    const merged: EditingBlock = {
      ...tgt,
      text: tgt.text + '\n' + src.text,
      lineIndices: [...tgt.lineIndices, ...src.lineIndices],
    };
    set({
      blocks: blocks
        .filter(b => b.id !== sourceId)
        .map(b => b.id === targetId ? merged : b),
      selectedBlockId: targetId,
      isDirty: true,
    });
  },

  updateBlockText: (id, text) => {
    pushSnapshot(get, set);
    set(s => ({
      blocks: s.blocks.map(b => b.id === id ? { ...b, text } : b),
      isDirty: true,
    }));
  },

  toggleEditMode: () => set(s => ({
    isEditMode: !s.isEditMode,
    selectedBlockId: null,
  })),

  /* ── history ── */

  undo: () => {
    const { undoStack, blocks } = get();
    if (undoStack.length === 0) return;

    const currentSnap = serialize(blocks);
    const newUndo = [...undoStack];
    const prevSnap = newUndo.pop()!;

    set({
      blocks: deserialize(prevSnap),
      undoStack: newUndo,
      redoStack: [...get().redoStack, currentSnap],
      isDirty: newUndo.length > 0,
      selectedBlockId: null,
    });
  },

  redo: () => {
    const { redoStack, blocks } = get();
    if (redoStack.length === 0) return;

    const currentSnap = serialize(blocks);
    const newRedo = [...redoStack];
    const nextSnap = newRedo.pop()!;

    set({
      blocks: deserialize(nextSnap),
      undoStack: [...get().undoStack, currentSnap],
      redoStack: newRedo,
      isDirty: true,
      selectedBlockId: null,
    });
  },

  /* ── save ── */

  save: async () => {
    const state = get();
    if (state.isSaving) return;
    set({ isSaving: true });

    try {
      const savedBlocks: SavedBlock[] = state.blocks.map((b, i) => ({
        id: b.id,
        name: `Block ${i + 1}`,
        lineIndices: b.lineIndices,
        type: b.type,
      }));

      const lyricsText = state.lyricsLines.join('\n');

      if (state._onSave) {
        await state._onSave(savedBlocks, lyricsText, state.trackInfo);
      }

      set(EMPTY);

      // Auto-open Sync Editor (intercepted by sync.bridge)
      try {
        const w = window as any;
        w.waveformEditor?.show?.();
      } catch (e) {
        console.warn('[BlockEditor] Could not auto-open Sync Editor:', e);
      }

    } catch (error) {
      console.error('[BlockEditor] Save failed:', error);
      set({ isSaving: false });
    }
  },
}));
