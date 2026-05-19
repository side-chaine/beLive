export type BlockType =
  | 'intro'
  | 'verse'
  | 'prechorus'
  | 'chorus'
  | 'bridge'
  | 'interlude'
  | 'outro';

export interface AliasEntry {
  type: BlockType;
  reviewRequired: boolean;
}

export const BLOCK_ALIAS_MAP: Record<string, AliasEntry> = {
  // EN: Verse
  'verse':          { type: 'verse', reviewRequired: false },
  'v':              { type: 'verse', reviewRequired: false },
  // EN: Chorus
  'chorus':         { type: 'chorus', reviewRequired: false },
  'refrain':        { type: 'chorus', reviewRequired: false },
  'hook':           { type: 'chorus', reviewRequired: true },
  'post-chorus':    { type: 'chorus', reviewRequired: true },
  'postchorus':     { type: 'chorus', reviewRequired: true },
  'post chorus':    { type: 'chorus', reviewRequired: true },
  // EN: Pre-Chorus
  'pre-chorus':     { type: 'prechorus', reviewRequired: false },
  'prechorus':      { type: 'prechorus', reviewRequired: false },
  'pre chorus':     { type: 'prechorus', reviewRequired: false },
  // EN: Bridge
  'bridge':         { type: 'bridge', reviewRequired: false },
  // EN: Interlude (separate type, not bridge)
  'interlude':      { type: 'interlude', reviewRequired: false },
  'instrumental':   { type: 'bridge', reviewRequired: true },
  'break':          { type: 'bridge', reviewRequired: true },
  'solo':           { type: 'bridge', reviewRequired: true },
  'guitar solo':    { type: 'bridge', reviewRequired: true },
  'piano solo':     { type: 'bridge', reviewRequired: true },
  'drum break':     { type: 'bridge', reviewRequired: true },
  'music':          { type: 'bridge', reviewRequired: true },
  // EN: Intro/Outro
  'intro':          { type: 'intro', reviewRequired: false },
  'introduction':   { type: 'intro', reviewRequired: false },
  'outro':          { type: 'outro', reviewRequired: false },
  // RU: Куплет
  'куплет':         { type: 'verse', reviewRequired: false },
  // RU: Припев
  'припев':         { type: 'chorus', reviewRequired: false },
  'рефрен':         { type: 'chorus', reviewRequired: true },
  // RU: Предприпев
  'предприпев':     { type: 'prechorus', reviewRequired: false },
  'пре-хорус':      { type: 'prechorus', reviewRequired: false },
  'пре хорус':      { type: 'prechorus', reviewRequired: false },
  // RU: Бридж
  'бридж':          { type: 'bridge', reviewRequired: false },
  'вставка':        { type: 'bridge', reviewRequired: true },
  'проигрыш':       { type: 'bridge', reviewRequired: true },
  'инструментал':   { type: 'bridge', reviewRequired: true },
  'соло':           { type: 'bridge', reviewRequired: true },
  // RU: Интро/Аутро
  'интро':          { type: 'intro', reviewRequired: false },
  'вступление':     { type: 'intro', reviewRequired: false },
  'аутро':          { type: 'outro', reviewRequired: false },
  'концовка':       { type: 'outro', reviewRequired: true },
};

export function resolveBlockAlias(tag: string): AliasEntry | null {
  const normalized = tag
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return BLOCK_ALIAS_MAP[normalized] ?? null;
}
