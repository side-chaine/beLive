/**
 * AI Tools — Wave C
 * + Fixed seek (getBlockTimeRange)
 * + QuickReply [ACTION] parsing
 * + Wikipedia [SEARCH] — for artist/genre facts
 * + AudioDB [SEARCH_AUDIO] — for BPM/Key
 * + Anti-hallucination guard
 */

import { useBlocksStore } from '../../stores/blocks.store';
import { useMarkersStore } from '../../stores/markers.store';
import { useTrackStore } from '../../stores/track.store';
import { getBlockTimeRange } from '../../utils/block-time-range';
import { getStructureFormula } from '../../utils/structure-formula';

/* ═══ Interfaces ═══ */
export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolCallResult {
  tool: string;
  success: boolean;
  message: string;
  data?: unknown;
}

export interface QuickReply {
  label: string;
  action: string;
  type: 'seek' | 'query' | 'expert' | 'search' | 'search-audio';
}

/* ═══ Text Command Parsing ═══ */

/** Parse [SEEK], [STRUCTURE], [CATALOG], [SEARCH], [SEARCH_AUDIO] */
export function parseTextCommand(text: string): ToolCall | null {
  // [SEEK: sectionType] or [SEEK: sectionType:N]
  const seekMatch = text.match(/\[SEEK:\s*(\w+)(?::(\d+))?\]/i);
  if (seekMatch) {
    return {
      tool: 'seek_to_section',
      args: {
        sectionType: seekMatch[1].toLowerCase(),
        occurrence: seekMatch[2] ? parseInt(seekMatch[2], 10) : 1,
      },
    };
  }

  // [STRUCTURE] or [STRUCTURE: trackIndex]
  const structMatch = text.match(/\[STRUCTURE(?::\s*(\d+))?\]/i);
  if (structMatch) {
    return {
      tool: 'get_track_structure',
      args: structMatch[1] ? { trackIndex: parseInt(structMatch[1], 10) } : {},
    };
  }

  // [CATALOG]
  if (/\[CATALOG\]/i.test(text)) {
    return { tool: 'list_catalog_structures', args: {} };
  }

  // [SEARCH_AUDIO: artist song] — BPM/Key lookup
  const audioMatch = text.match(/\[SEARCH_AUDIO:\s*([^\]]+)\]/i);
  if (audioMatch) {
    return {
      tool: 'search_audiodb',
      args: { query: audioMatch[1].trim() },
    };
  }

  // [SEARCH: query] — Wikipedia lookup
  const searchMatch = text.match(/\[SEARCH:\s*([^\]]+)\]/i);
  if (searchMatch) {
    return {
      tool: 'search_wikipedia',
      args: { query: searchMatch[1].trim() },
    };
  }

  return null;
}

/** Strip all text commands from display text */
export function stripTextCommands(text: string): string {
  return text
    .replace(/\[(?:SEEK|STRUCTURE|CATALOG|SEARCH|SEARCH_AUDIO)(?::[^\]]+)?\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ═══ Quick Reply Parsing ═══ */

/** Parse [ACTION: label|command] from AI response */
export function parseQuickReplies(text: string): { cleanText: string; replies: QuickReply[] } {
  const replies: QuickReply[] = [];
  const regex = /\[ACTION:\s*([^|]+)\|([^\]]+)\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const label = match[1].trim();
    const action = match[2].trim();
    let type: QuickReply['type'] = 'query';
    if (action.startsWith('SEEK:')) type = 'seek';
    else if (action.startsWith('EXPERT:')) type = 'expert';
    else if (action.startsWith('SEARCH_AUDIO:')) type = 'search-audio';
    else if (action.startsWith('SEARCH:')) type = 'search';
    replies.push({ label, action, type });
  }

  const cleanText = text
    .replace(/\[ACTION:\s*[^|]+\|[^\]]+\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleanText, replies };
}

/* ═══ Tool Execution ═══ */

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolCallResult> {
  switch (toolName) {
    case 'seek_to_section':
      return executeSeekToSection(args);
    case 'get_track_structure':
      return executeGetTrackStructure(args);
    case 'list_catalog_structures':
      return executeListCatalogStructures();
    case 'search_wikipedia':
      return executeSearchWikipedia(args);
    case 'search_audiodb':
      return executeSearchAudioDB(args);
    default:
      return { tool: toolName, success: false, message: `Unknown tool: ${toolName}` };
  }
}

/* ═══ Tool Implementations ═══ */

async function executeSeekToSection(args: Record<string, unknown>): Promise<ToolCallResult> {
  const sectionType = args.sectionType as string;
  const occurrence = (args.occurrence as number) || 1;

  if (!sectionType) {
    return { tool: 'seek_to_section', success: false, message: 'sectionType is required' };
  }

  const blocks = useBlocksStore.getState().blocks;
  const markers = useMarkersStore.getState().markers;

  if (!blocks?.length) {
    return { tool: 'seek_to_section', success: false, message: 'Нет блоков в треке' };
  }

  const matchingBlocks = blocks.filter(b => b.type === sectionType);
  if (matchingBlocks.length === 0) {
    return {
      tool: 'seek_to_section',
      success: false,
      message: `Секция "${sectionType}" не найдена`,
    };
  }

  const targetIndex = Math.min(occurrence - 1, matchingBlocks.length - 1);
  const targetBlock = matchingBlocks[targetIndex];

  // CORRECT: use getBlockTimeRange instead of target.startTime
  const range = getBlockTimeRange(targetBlock, markers);
  if (!range) {
    return {
      tool: 'seek_to_section',
      success: false,
      message: `Нет тайминга для ${sectionType} #${targetIndex + 1}`,
    };
  }

  const ae = (window as any).audioEngine;
  if (ae?.setCurrentTime) {
    ae.setCurrentTime(range.startTime);
    return {
      tool: 'seek_to_section',
      success: true,
      message: `Перемотка к ${sectionType} #${targetIndex + 1} (${formatTime(range.startTime)})`,
      data: { sectionType, occurrence: targetIndex + 1, time: range.startTime },
    };
  }

  return { tool: 'seek_to_section', success: false, message: 'Audio engine не доступен' };
}

async function executeGetTrackStructure(_args: Record<string, unknown>): Promise<ToolCallResult> {
  const blocks = useBlocksStore.getState().blocks;
  const track = useTrackStore.getState().currentTrack;
  const formula = getStructureFormula(blocks);

  return {
    tool: 'get_track_structure',
    success: true,
    message: formula || 'Нет структуры',
    data: {
      title: track?.title || 'Unknown',
      formula,
      blockCount: blocks.length,
      blocks: blocks.map(b => ({ type: b.type, name: b.name, lines: b.lineIndices.length })),
    },
  };
}

async function executeListCatalogStructures(): Promise<ToolCallResult> {
  const tracks = useTrackStore.getState().tracksMeta;
  if (!tracks || tracks.length === 0) {
    return { tool: 'list_catalog_structures', success: true, message: 'Каталог пуст', data: [] };
  }

  const items = tracks.map((t: any, i: number) => ({
    index: i,
    title: t.title || 'Без названия',
  }));

  return {
    tool: 'list_catalog_structures',
    success: true,
    message: `${tracks.length} треков в каталоге`,
    data: items,
  };
}

/** Wikipedia — for artist/genre/history facts (NOT BPM/Key!) */
async function executeSearchWikipedia(args: Record<string, unknown>): Promise<ToolCallResult> {
  const query = args.query as string;
  if (!query) {
    return { tool: 'search_wikipedia', success: false, message: 'query is required' };
  }

  try {
    const ruUrl = `https://ru.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const enUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;

    const [ruRes, enRes] = await Promise.allSettled([
      fetch(ruUrl, { signal: AbortSignal.timeout(6000) }),
      fetch(enUrl, { signal: AbortSignal.timeout(6000) }),
    ]);

    let extract = '';
    let source = '';

    if (ruRes.status === 'fulfilled' && ruRes.value.ok) {
      const data = await ruRes.value.json();
      if (data.extract) {
        extract = data.extract;
        source = data.content_urls?.desktop?.page || '';
      }
    }

    if (!extract && enRes.status === 'fulfilled' && enRes.value.ok) {
      const data = await enRes.value.json();
      if (data.extract) {
        extract = data.extract;
        source = data.content_urls?.desktop?.page || '';
      }
    }

    if (!extract) {
      return {
        tool: 'search_wikipedia',
        success: false,
        message: `Ничего не найдено: "${query}"`,
      };
    }

    return {
      tool: 'search_wikipedia',
      success: true,
      message: extract,
      data: { query, source },
    };
  } catch (e: any) {
    return {
      tool: 'search_wikipedia',
      success: false,
      message: `Search failed: ${e.message}`,
    };
  }
}

/** AudioDB — for BPM, Key, Genre (specialized music data) */
async function executeSearchAudioDB(args: Record<string, unknown>): Promise<ToolCallResult> {
  const query = args.query as string;
  if (!query) {
    return { tool: 'search_audiodb', success: false, message: 'query is required' };
  }

  try {
    // Parse "Artist Song" from query
    const parts = query.trim().split(/\s+/);
    let artist = '';
    let song = '';

    // Try to split: first word(s) = artist, last word(s) = song
    // Heuristic: if there's a known separator
    if (query.includes(' - ')) {
      [artist, song] = query.split(' - ').map(s => s.trim());
    } else if (query.includes(' by ')) {
      [song, artist] = query.split(' by ').map(s => s.trim());
    } else {
      // Best guess: first 1-2 words = artist, rest = song
      artist = parts.slice(0, Math.min(2, Math.ceil(parts.length / 2))).join(' ');
      song = parts.slice(Math.min(2, Math.ceil(parts.length / 2))).join(' ');
    }

    // TheAudioDB free API (key: 2 — free tier)
    const url = `https://www.theaudiodb.com/api/v1/json/2/searchtrack.php?s=${encodeURIComponent(artist)}&t=${encodeURIComponent(song)}`;
    console.log('[AudioDB] Searching:', { artist, song });

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return {
        tool: 'search_audiodb',
        success: false,
        message: `AudioDB error: ${res.status}`,
      };
    }

    const data = await res.json();
    if (!data.track?.length) {
      return {
        tool: 'search_audiodb',
        success: false,
        message: `Не найдено в AudioDB: "${artist} - ${song}"`,
      };
    }

    const track = data.track[0];
    const result: string[] = [];

    if (track.strArtist) result.push(`Artist: ${track.strArtist}`);
    if (track.strTrack) result.push(`Track: ${track.strTrack}`);
    if (track.intBPM && track.intBPM !== '0') result.push(`BPM: ${track.intBPM}`);
    if (track.strKey) result.push(`Key: ${track.strKey}`);
    if (track.strGenre) result.push(`Genre: ${track.strGenre}`);
    if (track.strMood) result.push(`Mood: ${track.strMood}`);

    if (result.length === 0) {
      return {
        tool: 'search_audiodb',
        success: false,
        message: `AudioDB: данные найдены, но BPM/Key отсутствуют`,
      };
    }

    return {
      tool: 'search_audiodb',
      success: true,
      message: result.join('\n'),
      data: {
        artist: track.strArtist,
        track: track.strTrack,
        bpm: track.intBPM || null,
        key: track.strKey || null,
        genre: track.strGenre || null,
      },
    };
  } catch (e: any) {
    return {
      tool: 'search_audiodb',
      success: false,
      message: `AudioDB search failed: ${e.message}`,
    };
  }
}

/* ═══ Helpers ═══ */

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}