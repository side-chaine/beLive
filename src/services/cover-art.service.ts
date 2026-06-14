import type { CoverArtTheme } from '../types/cover-theme.types';
import { _CYR_TO_LAT, _normalizeText } from './auto-lyrics.service';
import { updateTrackField } from './idb.service';
import { useTrackStore } from '../stores/track.store';
import { parseTrackName } from '../catalog/types';

// ─── Last.fm API ───

const LASTFM_API_KEY = import.meta.env.VITE_LASTFM_API_KEY || '';

interface LastFmImage {
  '#text': string;
  size: string;
}

interface LastFmTrack {
  album?: {
    image?: LastFmImage[];
  };
}

export async function fetchCoverArt(artist: string, title: string): Promise<string | null> {
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.track?.album?.image) {
      const images = data.track.album.image as LastFmImage[];
      const best = images.find(c => c.size === 'extralarge')
        || images.find(c => c.size === 'large')
        || images.find(c => c.size === 'medium');
      return best?.['#text'] || null;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── iTunes Search API (CORS-friendly) ───

async function fetchCoverArtFromItunes(
  artist: string,
  title: string,
): Promise<string | null> {
  try {
    const query = [artist, title].filter(Boolean).join(' ');
    if (!query.trim() || query.trim().length < 2) return null;

    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();

    if (!data.results || data.results.length === 0) return null;

    // Pick best result by duration match if multiple
    const result = data.results[0];
    const artwork = result.artworkUrl100;
    if (artwork) {
      // Upgrade to 600x600 (standard iTunes trick)
      return artwork.replace('100x100bb', '600x600bb');
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Main Fetch + Update ───

export async function fetchCoverArtAndUpdate(
  trackId: number,
  trackTitle: string
): Promise<void> {
  const parsed = parseTrackName(trackTitle);
  const artist = parsed.artist || '';
  const title = parsed.title;

  if (!title.trim() || title.trim().length < 2) return;

  let coverUrl: string | null = null;

  // Strategy 1: iTunes Search API (CORS-friendly, works from browser)
  coverUrl = await fetchCoverArtFromItunes(artist, title);
  if (coverUrl) {
    if (import.meta.env.DEV) console.log(`[CoverArt] Found via iTunes: ${coverUrl}`);
  }

  // Strategy 2: Title-only iTunes search (if artist was empty)
  if (!coverUrl && !artist) {
    coverUrl = await fetchCoverArtFromItunes('', title);
    if (coverUrl) {
      if (import.meta.env.DEV) console.log(`[CoverArt] Found via iTunes (title-only): ${coverUrl}`);
    }
  }

  // Strategy 3: Last.fm fallback (may work with future proxy)
  if (!coverUrl) {
    coverUrl = await fetchCoverArt(artist || ' ', title);
    if (coverUrl) {
      if (import.meta.env.DEV) console.log(`[CoverArt] Found via Last.fm: ${coverUrl}`);
    }
  }

  if (!coverUrl) {
    if (import.meta.env.DEV) console.log(`[CoverArt] No cover found for: "${trackTitle}"`);
    return;
  }

  // Persist URL to IDB
  await updateTrackField(trackId, { coverArtUrl: coverUrl });

  // TC-COVER-03: Save image blob for offline use
  try {
    const imgResp = await fetch(coverUrl);
    if (imgResp.ok) {
      const imgBlob = await imgResp.blob();
      await updateTrackField(trackId, { coverArtBlob: imgBlob });
    }
  } catch (blobErr) {
    console.warn('[CoverArt] Failed to save blob for offline:', blobErr);
    // Non-critical — URL is already saved as fallback
  }

  // Try color extraction
  try {
    const theme = await extractDominantColors(coverUrl);
    if (theme) {
      await updateTrackField(trackId, { coverTheme: theme });
      if (import.meta.env.DEV) console.log(`[CoverArt] Theme extracted: primary=${theme.primary} accent=${theme.accent}`);

      const currentTrack = useTrackStore.getState().currentTrack;
      if (currentTrack && Number(currentTrack.id) === trackId) {
        useTrackStore.getState().setCurrentCoverTheme(theme);
      }
    }
  } catch (err) {
    console.warn('[CoverArt] Color extraction failed:', err);
  }
}

// ─── Color Extraction (Canvas-based Median Cut) ───

/**
 * Extract dominant color theme from a Blob (for custom backgrounds)
 * Creates temporary Object URL, extracts colors, revokes URL
 */
export async function extractThemeFromBlob(blob: Blob): Promise<CoverArtTheme | null> {
  const url = URL.createObjectURL(blob);
  try {
    return await extractDominantColors(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function extractDominantColors(imageUrl: string): Promise<CoverArtTheme | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvasSize = 200;
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      const canvasH = Math.round(canvasSize * (img.naturalHeight / img.naturalWidth));
      canvas.height = canvasH || canvasSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const theme = medianCutExtract(imageData, imageUrl);
        resolve(theme);
      } catch {
        // Canvas tainted (CORS) — can't extract colors, but URL is saved
        console.warn('[CoverArt] Canvas tainted — color extraction skipped');
        resolve(null);
      }
    };

    img.onerror = () => {
      console.warn('[CoverArt] Image load failed for extraction');
      resolve(null);
    };

    img.src = imageUrl;
  });
}

// ─── Median Cut Algorithm ───

interface HslPixel { h: number; s: number; l: number; }

function rgbToHsl(r: number, g: number, b: number): HslPixel {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function medianCutExtract(imageData: ImageData, coverUrl: string): CoverArtTheme {
  const { data, width, height } = imageData;
  const pixels: HslPixel[] = [];
  const step = 7; // Sample every 7th pixel

  for (let i = 0; i < data.length; i += 4 * step) {
    const a = data[i + 3];
    if (a < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    pixels.push(rgbToHsl(r, g, b));
  }

  if (pixels.length === 0) {
    return { coverUrl, primary: '#6366f1', secondary: '#3b82f6', accent: '#f59e0b', isDark: true, text: '#ffffff' };
  }

  // Median cut: split into 6 buckets
  let buckets: HslPixel[][] = [pixels];
  while (buckets.length < 6) {
    let maxRange = 0;
    let maxIdx = 0;
    let maxChannel: 'h' | 's' | 'l' = 'h';
    for (let i = 0; i < buckets.length; i++) {
      for (const ch of ['h', 's', 'l'] as const) {
        const vals = buckets[i].map(p => p[ch]);
        const range = Math.max(...vals) - Math.min(...vals);
        if (range > maxRange) { maxRange = range; maxIdx = i; maxChannel = ch; }
      }
    }
    const bucket = buckets[maxIdx];
    bucket.sort((a, b) => a[maxChannel] - b[maxChannel]);
    const mid = Math.floor(bucket.length / 2);
    buckets.splice(maxIdx, 1, bucket.slice(0, mid), bucket.slice(mid));
  }

  // Average color per bucket
  const averages = buckets.map(bucket => {
    const avg = { h: 0, s: 0, l: 0 };
    for (const p of bucket) { avg.h += p.h; avg.s += p.s; avg.l += p.l; }
    const n = bucket.length;
    return { h: avg.h / n, s: avg.s / n, l: avg.l / n, count: n };
  });

  // Sort by dominance
  averages.sort((a, b) => b.count - a.count);

  const primary = hslToHex(averages[0].h, averages[0].s, averages[0].l);

  // Secondary: most different from primary by hue
  let secondary = hslToHex(averages[1].h, averages[1].s, averages[1].l);
  const primaryHue = averages[0].h;

  // Accent: highest chroma (saturation * midpoint lightness) with hue difference > 30
  let accent = secondary;
  let maxChroma = 0;
  for (let i = 1; i < averages.length; i++) {
    const hueDiff = Math.abs(averages[i].h - primaryHue);
    const hueDiffNorm = Math.min(hueDiff, 360 - hueDiff);
    if (hueDiffNorm > 30) {
      const chroma = averages[i].s * Math.min(averages[i].l, 1 - averages[i].l);
      if (chroma > maxChroma) {
        maxChroma = chroma;
        accent = hslToHex(averages[i].h, averages[i].s, averages[i].l);
      }
    }
  }
  if (maxChroma === 0) accent = hslToHex(averages[2]?.h ?? averages[1].h, averages[2]?.s ?? averages[1].s, averages[2]?.l ?? averages[1].l);

  // isDark from primary luminance
  const r = parseInt(primary.slice(1, 3), 16) / 255;
  const g = parseInt(primary.slice(3, 5), 16) / 255;
  const b = parseInt(primary.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const isDark = luminance < 0.4;

  const text = isDark ? '#ffffff' : '#000000';
  return { coverUrl, primary, secondary, accent, isDark, text };
}
