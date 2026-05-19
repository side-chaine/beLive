// beLive — Blocks Bridge (Legacy → React Store)
// Sprint 8 | Phase 1 — read-only
// Source of truth: window.lyricsDisplay.textBlocks
// Events: blocks-applied, track-loaded, lyrics-rendered (all on document)

import { useBlocksStore } from '../stores/blocks.store'

// ─── Types for legacy global ─────────────────────────────────
interface LegacyTextBlock {
  id?: string
  name?: string
  type?: string
  lineIndices?: number[]
  blockType?: string
}

interface LegacyLyricsDisplay {
  textBlocks?: LegacyTextBlock[]
}

declare global {
  interface Window {
    lyricsDisplay?: LegacyLyricsDisplay
  }
}

// ─── Read blocks from legacy ─────────────────────────────────
function syncBlocksFromLegacy(): void {
  const ld = window.lyricsDisplay
  if (!ld || !ld.textBlocks) {
    useBlocksStore.getState().clearBlocks()
    return
  }

  const raw = ld.textBlocks
  const blocks = raw
    .filter((b: LegacyTextBlock) => Array.isArray(b.lineIndices) && b.lineIndices.length > 0)
    .map((b: LegacyTextBlock, i: number) => ({
      id: b.id || `legacy-block-${i}`,
      name: b.name || `Block ${i + 1}`,
      type: b.type || b.blockType || 'unknown',
      lineIndices: b.lineIndices!,
    }))

  useBlocksStore.getState().setBlocks(blocks)
}

// ─── Init ─────────────────────────────────────────────────────
let initialized = false

export function initBlocksBridge(): void {
  if (initialized) return
  initialized = true

  // Listen for block-related events (all on document)
  document.addEventListener('before-track-change', () => {
    useBlocksStore.getState().clearBlocks()
  })

  document.addEventListener('blocks-applied', () => {
    syncBlocksFromLegacy()
  })

  document.addEventListener('track-loaded', () => {
    // Delay slightly — lyricsDisplay.textBlocks may not be populated yet
    setTimeout(() => {
      syncBlocksFromLegacy()
    }, 300)
  })

  document.addEventListener('lyrics-rendered', () => {
    syncBlocksFromLegacy()
  })

  // Initial sync (if a track is already loaded)
  setTimeout(() => {
    syncBlocksFromLegacy()
  }, 500)
}

