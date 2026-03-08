/**
 * markerUtils.ts — Pure functions extracted from legacy MarkerManager
 * F22: Single source of truth for marker computations
 * Used by: marker-manager.js (legacy), markers.store.ts (React)
 */

import type { Marker, Section } from '../stores/markers.store';

/** Color map for block types */
const BLOCK_TYPE_COLORS: Record<string, string> = {
  verse:     '#4CAF50',
  chorus:    '#F44336',
  bridge:    '#6f42c1',
  prechorus: '#FF9800',
  intro:     '#03A9F4',
  outro:     '#9E9E9E',
  blank:     'rgba(255,255,255,0.1)',
};

const DEFAULT_COLOR = 'rgba(255,255,255,0.1)';

export function getColorForBlockType(blockType?: string): string {
  return blockType ? (BLOCK_TYPE_COLORS[blockType] || DEFAULT_COLOR) : DEFAULT_COLOR;
}

export function getActiveLineAtTime(markers: Marker[], time: number): number {
  if (!markers || markers.length === 0) return -1;
  if (time < markers[0].time) {
    return (markers[0].time - time < 2.0) ? markers[0].lineIndex : -1;
  }
  let activeIdx = -1;
  for (let i = 0; i < markers.length; i++) {
    if (time >= markers[i].time) { activeIdx = i; } else { break; }
  }
  if (activeIdx >= 0) return markers[activeIdx].lineIndex;
  if (time > markers[markers.length - 1].time) return markers[markers.length - 1].lineIndex;
  return -1;
}

export function computeSections(markers: Marker[], trackDuration: number = 0): Section[] {
  const res: Section[] = [];
  if (!markers || !markers.length) return res;
  const sorted = [...markers].sort((a, b) => a.time - b.time);
  const idxByType: Record<string, number> = {};
  const prefixMap: Record<string, string> = {
    verse:'V', chorus:'C', bridge:'B', prechorus:'PC', intro:'I', outro:'O', blank:'BL'
  };
  // allowed types = keys of prefixMap
  let i = 0;
  while (i < sorted.length) {
    const t = sorted[i].blockType || '';
    const color = sorted[i].color;
    if (!(t in prefixMap)) { i++; continue; }
    const start = sorted[i].time;
    const markerIds = [sorted[i].id];
    let j = i + 1;
    while (j < sorted.length && sorted[j].blockType === t) { markerIds.push(sorted[j].id); j++; }
    idxByType[t] = (idxByType[t] || 0) + 1;
    const label = (prefixMap[t] || 'U') + idxByType[t];
    const nextStart = j < sorted.length ? sorted[j].time : (trackDuration || null);
    res.push({ id: label, type: t, index: idxByType[t], label, color, start, end: nextStart, markerIds });
    i = j;
  }
  return res;
}

export function buildBlocksFromMarkers(markers: Marker[]): Array<{
  id: string; name: string; type: string; lineIndices: number[];
}> {
  if (!Array.isArray(markers) || markers.length === 0) return [];
  const sorted = [...markers].sort((a, b) => a.lineIndex - b.lineIndex);
  const blocks: Array<{ id: string; name: string; type: string; lineIndices: number[] }> = [];
  const counters: Record<string, number> = {};
  let current: { id: string; name: string; type: string; lineIndices: number[]; _last: number } | null = null;
  for (const m of sorted) {
    const t = (m.blockType && m.blockType !== 'unknown') ? m.blockType : 'verse';
    if (!current || current.type !== t || m.lineIndex !== current._last + 1) {
      if (current) { blocks.push({ id: current.id, name: current.name, type: current.type, lineIndices: current.lineIndices }); }
      counters[t] = (counters[t] || 0) + 1;
      current = {
        id: `blk-${t}-${counters[t]}`,
        name: `${t.charAt(0).toUpperCase() + t.slice(1)} ${counters[t]}`,
        type: t, lineIndices: [m.lineIndex], _last: m.lineIndex
      };
    } else {
      current.lineIndices.push(m.lineIndex);
      current._last = m.lineIndex;
    }
  }
  if (current) { blocks.push({ id: current.id, name: current.name, type: current.type, lineIndices: current.lineIndices }); }
  return blocks;
}

export function getBlockTypeForLine(
  lineIndex: number,
  textBlocks: Array<{ lineIndices?: number[]; type?: string }>
): string {
  if (!textBlocks || textBlocks.length === 0) return 'unknown';
  const allowed = new Set(['verse','chorus','bridge','prechorus','intro','outro','blank']);
  for (const block of textBlocks) {
    if (block.lineIndices && block.lineIndices.includes(lineIndex)) {
      if (block.type && allowed.has(block.type)) return block.type;
      return 'unknown';
    }
  }
  return 'unknown';
}
