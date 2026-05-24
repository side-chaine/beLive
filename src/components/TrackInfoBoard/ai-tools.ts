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
import { useLoopStore } from '../../stores/loop.store';
import { useAudioStore } from '../../stores/audio.store';
import { useStemStore } from '../../stem/stem.store';
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
  type: 'seek' | 'query' | 'expert' | 'search' | 'search-audio'
      | 'bpm' | 'loop' | 'volume' | 'mode' | 'vocalmix' | 'scenario';
}

/* ═══ Text Command Parsing ═══ */

/** Parse [SEEK], [STRUCTURE], [CATALOG], [SEARCH], [SEARCH_AUDIO] */
export function parseTextCommand(text: string): ToolCall | null {
  // [SEEK: sectionType] or [SEEK: sectionType:N]
  const seekMatch = text.match(/\[SEEK:\s*([\w-]+)(?::(\d+))?\]/i);
  if (seekMatch) {
    return {
      tool: 'seek_to_section',
      args: {
        sectionType: normalizeSectionType(seekMatch[1]),
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
    else if (action.startsWith('BPM:')) type = 'bpm';
    else if (action.startsWith('LOOP:')) type = 'loop';
    else if (action.startsWith('VOLUME:')) type = 'volume';
    else if (action.startsWith('MODE:')) type = 'mode';
    else if (action.startsWith('VOCALMIX:')) type = 'vocalmix';
    else if (action.startsWith('SCENARIO:')) type = 'scenario';
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
    case 'set_playback_rate':
      return executeSetPlaybackRate(args);
    case 'loop_section':
      return executeLoopSection(args);
    case 'set_stem_volume':
      return executeSetStemVolume(args);
    case 'switch_mode':
      return executeSwitchMode(args);
    case 'toggle_vocal_mix':
      return executeToggleVocalMix(args);
    default:
      return { tool: toolName, success: false, message: `Unknown tool: ${toolName}` };
  }
}

/* ═══ Tool Implementations ═══ */

async function executeSeekToSection(args: Record<string, unknown>): Promise<ToolCallResult> {
  try {
    const rawSectionType = args.sectionType as string;
    const sectionType = normalizeSectionType(rawSectionType);
    const occurrence = (args.occurrence as number) || 1;

    if (!rawSectionType) {
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
  } catch (err: any) {
    return { tool: 'seek_to_section', success: false, message: `Ошибка перемотки: ${err?.message || 'неизвестная'}` };
  }
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

/** GetSongBPM — BPM + Key + Camelot lookup (replaces AudioDB) */
async function executeSearchAudioDB(args: Record<string, unknown>): Promise<ToolCallResult> {
  const query = args.query as string;
  if (!query) {
    return { tool: 'search_audiodb', success: false, message: 'query is required' };
  }

  try {
    // Parse "Artist Song" from query
    let artist = '';
    let song = '';

    if (query.includes(' - ')) {
      [artist, song] = query.split(' - ').map(s => s.trim());
    } else if (query.includes(' by ')) {
      [song, artist] = query.split(' by ').map(s => s.trim());
    } else {
      const parts = query.trim().split(/\s+/);
      artist = parts.slice(0, Math.min(2, Math.ceil(parts.length / 2))).join(' ');
      song = parts.slice(Math.min(2, Math.ceil(parts.length / 2))).join(' ');
    }

    console.log('[GetSongBPM] Searching:', { artist, song });

    // GetSongBPM API (free, no API key needed for basic lookup)
    const url = `https://api.getsongbpm.com/search/?api_key=2&type=both&lookup=song:${encodeURIComponent(song)}+artist:${encodeURIComponent(artist)}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      // Fallback: try TheAudioDB as backup
      console.log('[GetSongBPM] Failed, trying AudioDB fallback');
      return executeSearchAudioDBFallback(artist, song);
    }

    const data = await res.json();

    if (!data.search?.length) {
      return executeSearchAudioDBFallback(artist, song);
    }

    // Find best match
    const track = data.search[0];
    const result: string[] = [];

    if (track.artist?.name) result.push(`Artist: ${track.artist.name}`);
    if (track.song?.title) result.push(`Track: ${track.song.title}`);
    if (track.song?.tempo) result.push(`BPM: ${track.song.tempo}`);
    if (track.song?.key_of) result.push(`Key: ${track.song.key_of}`);
    if (track.song?.camelot) result.push(`Camelot: ${track.song.camelot}`);
    if (track.song?.time_sig) result.push(`Time signature: ${track.song.time_sig}`);

    if (result.length <= 2) {
      // Only got artist + title, no audio features
      return executeSearchAudioDBFallback(artist, song);
    }

    return {
      tool: 'search_audiodb',
      success: true,
      message: result.join('\n'),
      data: {
        artist: track.artist?.name,
        track: track.song?.title,
        bpm: track.song?.tempo || null,
        key: track.song?.key_of || null,
        camelot: track.song?.camelot || null,
      },
    };
  } catch (e: any) {
    return {
      tool: 'search_audiodb',
      success: false,
      message: `Search failed: ${e.message}`,
    };
  }
}

/** Fallback: TheAudioDB (BPM only, no Key/Camelot) */
async function executeSearchAudioDBFallback(artist: string, song: string): Promise<ToolCallResult> {
  try {
    const url = `https://www.theaudiodb.com/api/v1/json/2/searchtrack.php?s=${encodeURIComponent(artist)}&t=${encodeURIComponent(song)}`;
    console.log('[AudioDB] Fallback search:', { artist, song });

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return { tool: 'search_audiodb', success: false, message: `Не найдено: "${artist} - ${song}"` };
    }

    const data = await res.json();
    if (!data.track?.length) {
      return { tool: 'search_audiodb', success: false, message: `Не найдено: "${artist} - ${song}"` };
    }

    const track = data.track[0];
    const result: string[] = [];

    if (track.strArtist) result.push(`Artist: ${track.strArtist}`);
    if (track.strTrack) result.push(`Track: ${track.strTrack}`);
    if (track.intBPM && track.intBPM !== '0') result.push(`BPM: ${track.intBPM}`);
    if (track.strGenre) result.push(`Genre: ${track.strGenre}`);

    if (result.length <= 2) {
      return { tool: 'search_audiodb', success: false, message: `Данные найдены, но BPM/Key отсутствуют` };
    }

    return {
      tool: 'search_audiodb',
      success: true,
      message: result.join('\n') + '\n⚠ Key/Camelot недоступны в этом источнике',
      data: {
        artist: track.strArtist,
        track: track.strTrack,
        bpm: track.intBPM || null,
        key: null,
        camelot: null,
      },
    };
  } catch (e: any) {
    return { tool: 'search_audiodb', success: false, message: `Fallback failed: ${e.message}` };
  }
}

/* ═══ Normalization ═══ */

/**
 * Normalize section type string to canonical block type.
 * Handles hyphenated variations from AI output:
 *   "pre-chorus"  → "prechorus"
 *   "Pre-Chorus"  → "prechorus"
 *   "post-chorus" → "chorus"
 * Falls back to lowercased input if no mapping found.
 */
export function normalizeSectionType(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const map: Record<string, string> = {
    'pre-chorus': 'prechorus',
    'pre chorus': 'prechorus',
    'post-chorus': 'chorus',
    'post chorus': 'chorus',
    'postchorus': 'chorus',
  };

  return map[normalized] ?? normalized;
}

/**
 * Normalize stem ID for player commands.
 * Handles singular/plural variations from AI output:
 *   "vocal" → "vocals"
 *   "drum"  → "drums"
 *   "instrument" → "instrumental"
 * Falls back to lowercased input if no mapping found.
 */
export function normalizeStemId(raw: string): string {
  const normalized = raw.toLowerCase().trim();
  const map: Record<string, string> = {
    'vocal': 'vocals',
    'drum': 'drums',
    'instrument': 'instrumental',
  };
  return map[normalized] ?? normalized;
}

/* ═══ Player Control Tools — Wave G ═══ */

async function executeSetPlaybackRate(
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  const audioStore = useAudioStore.getState();
  const currentRate = audioStore.playbackRate;

  let targetRate: number;
  if (args.rate !== undefined) {
    targetRate = Number(args.rate);
  } else if (args.delta !== undefined) {
    targetRate = currentRate + Number(args.delta);
  } else {
    return {
      tool: 'set_playback_rate',
      success: false,
      message: 'Укажите темп: [BPM:0.9] или [BPM:+0.05]',
    };
  }

  // Trainer safe range: 0.5–1.25
  targetRate = Math.max(0.5, Math.min(1.25, targetRate));
  targetRate = Math.round(targetRate * 100) / 100;

  const ae = (window as any).audioEngine;
  if (ae?.setPlaybackRate) {
    ae.setPlaybackRate(targetRate);
  }
  audioStore.setPlaybackRate(targetRate);

  const pct = Math.round(targetRate * 100);
  const label = targetRate > 1 ? 'быстрее' : targetRate < 1 ? 'медленнее' : 'норма';
  return {
    tool: 'set_playback_rate',
    success: true,
    message: `Темп: ${pct}% (${label})`,
  };
}

async function executeLoopSection(
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  const loopStore = useLoopStore.getState();

  // LOOP:off — снять повтор
  if (args.enabled === false) {
    if (loopStore.isLooping) {
      loopStore.clearLoop();
    }
    return { tool: 'loop_section', success: true, message: 'Повтор снят' };
  }

  const sectionType = normalizeSectionType(String(args.sectionType || ''));
  const occurrence = Number(args.occurrence || 1);

  const blocks = useBlocksStore.getState().blocks;
  if (!blocks?.length) {
    return { tool: 'loop_section', success: false, message: 'Нет блоков для loop' };
  }

  const matching = blocks.filter(b => b.type === sectionType);
  const target = matching[occurrence - 1];
  if (!target) {
    const ruNames: Record<string, string> = {
      intro: 'Вступление', verse: 'Куплет', prechorus: 'Пре-хорус',
      chorus: 'Припев', bridge: 'Бридж', interlude: 'Интерлюдия', outro: 'Заключение',
    };
    const label = ruNames[sectionType] || sectionType;
    return {
      tool: 'loop_section',
      success: false,
      message: `${label}${occurrence > 1 ? ` #${occurrence}` : ''} не найден`,
    };
  }

  // ★ enabled:true — ГАРАНТИРУЕМ loop ON ★
  if (args.enabled === true) {
    if (loopStore.isLooping && loopStore.loopBlockIds?.includes(target.id)) {
      return { tool: 'loop_section', success: true, message: 'Уже на повторе' };
    }
    if (loopStore.isLooping) {
      loopStore.replaceLoop(target);
    } else {
      loopStore.toggleBlock(target);
    }
    const ruNames: Record<string, string> = {
      intro: 'Вступление', verse: 'Куплет', prechorus: 'Пре-хорус',
      chorus: 'Припев', bridge: 'Бридж', interlude: 'Интерлюдия', outro: 'Заключение',
    };
    const label = ruNames[sectionType] || sectionType;
    return { tool: 'loop_section', success: true, message: `${label} на повторе` };
  }

  // Существующая toggle-логика (enabled НЕ true и НЕ false)
  if (loopStore.isLooping && loopStore.loopBlockIds?.includes(target.id)) {
    loopStore.toggleBlock(target);
    return { tool: 'loop_section', success: true, message: 'Повтор снят' };
  }

  if (loopStore.isLooping) {
    loopStore.replaceLoop(target);
  } else {
    loopStore.toggleBlock(target);
  }

  const ruNames: Record<string, string> = {
    intro: 'Вступление', verse: 'Куплет', prechorus: 'Пре-хорус',
    chorus: 'Припев', bridge: 'Бридж', interlude: 'Интерлюдия', outro: 'Заключение',
  };
  const label = ruNames[sectionType] || sectionType;
  return { tool: 'loop_section', success: true, message: `${label} на повторе` };
}

async function executeSetStemVolume(
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  const stemId = normalizeStemId(String(args.stemId || ''));
  const volume = Math.max(0, Math.min(1, Number(args.volume ?? 0)));

  const ae = (window as any).audioEngine;
  if (ae?.setStemVolume) {
    ae.setStemVolume(stemId, volume);
  }

  // Store mirror
  useStemStore.getState().setStemVolume(stemId, volume);

  const pct = Math.round(volume * 100);
  const ruStem: Record<string, string> = {
    instrumental: 'инструментал',
    vocals: 'вокал',
  };
  const label = ruStem[stemId] || stemId;
  return {
    tool: 'set_stem_volume',
    success: true,
    message: `${label}: ${pct}%${volume === 0 ? ' (мьют)' : ''}`,
  };
}

async function executeSwitchMode(
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  const mode = String(args.mode || '');
  const validModes = ['rehearsal', 'karaoke', 'concert', 'live'];
  if (!validModes.includes(mode)) {
    return { tool: 'switch_mode', success: false, message: `Неизвестный режим: "${mode}"` };
  }

  const switchFn = (window as any).beLiveSwitchMode;
  if (switchFn) {
    switchFn(mode);
  } else {
    console.warn('[Billy] beLiveSwitchMode not available, using store fallback');
    const { useModeStore } = await import('../../stores/mode.store');
    useModeStore.getState().setMode(mode as any);
  }

  const ruModes: Record<string, string> = {
    rehearsal: 'репетиция',
    karaoke: 'караоке',
    concert: 'концерт',
    live: 'живой звук',
  };
  return {
    tool: 'switch_mode',
    success: true,
    message: `Режим: ${ruModes[mode] || mode}`,
  };
}

async function executeToggleVocalMix(
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  const ae = (window as any).audioEngine;
  const audioStore = useAudioStore.getState();

  let targetEnabled: boolean;
  if (args.enabled !== undefined) {
    targetEnabled = !!args.enabled;
  } else {
    targetEnabled = !audioStore.vocalMixEnabled;
  }

  if (targetEnabled) {
    ae?.enableVocalMix?.();
  } else {
    ae?.disableVocalMix?.();
  }

  // Mirror store
  audioStore.setVocalMixEnabled(targetEnabled);

  return {
    tool: 'toggle_vocal_mix',
    success: true,
    message: targetEnabled ? 'VocalMix включён' : 'VocalMix выключен',
  };
}

/* ═══ Helpers ═══ */

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}