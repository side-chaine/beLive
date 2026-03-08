// beLive — Blocks Store (read-only mirror of lyricsDisplay.textBlocks)
// Sprint 8 | Phase 1 — read from legacy, no writes yet
// INV-2.0-E: Yjs-ready (no DOM side effects)
// INV-2.1-JSON: lineIndices are array indices (fragile)

import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────
export interface TextBlock {
  id: string
  name: string
  type: string          // verse|chorus|bridge|prechorus|intro|outro|unknown
  lineIndices: number[] // indices into lyrics[] array (fragile! future: lineId)
}

interface BlocksState {
  blocks: TextBlock[]
  blockCount: number

  // Actions
  setBlocks: (blocks: TextBlock[]) => void
  clearBlocks: () => void
}

// ─── Store ────────────────────────────────────────────────────
export const useBlocksStore = create<BlocksState>()((set) => ({
  blocks: [],
  blockCount: 0,

  setBlocks: (blocks: TextBlock[]) =>
    set({ blocks, blockCount: blocks.length }),

  clearBlocks: () =>
    set({ blocks: [], blockCount: 0 }),
}))

