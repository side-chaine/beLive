/**
 * Content Hash — определяет уникальность трека для TG-каталога
 * Использует FNV-1a (не требует crypto.subtle, работает на HTTP)
 */
import { getTrack } from '../services/idb.service';

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function computeContentHash(trackId: number): Promise<string> {
  const track = await getTrack(trackId);
  if (!track) throw new Error(`Track ${trackId} not found`);

  const trackStems = track.stemsData || {};
  const stemCount = Object.keys(trackStems).filter(k => trackStems[k]?.data?.byteLength > 0).length;
  const stemType = stemCount > 2 ? 'full' : 'duo';

  let scenesDesc = '';
  try {
    const { getBlockScenes } = await import('../services/block-scene.service');
    const scenes: any[] = await getBlockScenes(trackId);
    scenesDesc = scenes.map((s: any) => `${s.blockIndex}:${s.lineIndex ?? ''}`).join(',');
  } catch { /* scenes optional */ }

  const hashInput = JSON.stringify({
    s: stemType,
    m: track.syncMarkers ?? [],
    sc: scenesDesc,
    t: track.title ?? '',
  });

  return fnv1a(hashInput);
}

export function inferStemType(stemsData?: Record<string, any> | null, _vocalsData?: any): string {
  if (!stemsData) return 'duo';
  const stemCount = Object.keys(stemsData).length;
  return stemCount > 2 ? 'full' : 'duo';
}
