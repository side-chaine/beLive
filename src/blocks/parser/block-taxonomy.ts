/**
 * block-taxonomy.ts — SSOT для всех типов блоков
 * 16 канонических типов + role + instrument
 */
export type BlockRole = 'core' | 'transition' | 'instrumental' | 'energy' | 'speech' | 'ending';

export type BlockType =
  | 'intro'
  | 'verse'
  | 'prechorus'
  | 'chorus'
  | 'postchorus'
  | 'bridge'
  | 'interlude'
  | 'outro'
  | 'hook'
  | 'solo'
  | 'instrumental'
  | 'build'
  | 'drop'
  | 'breakdown'
  | 'spoken'
  | 'rap';

export interface AliasEntry {
  type: BlockType;
  reviewRequired: boolean;
  instrument?: string;    // 'guitar', 'piano', 'drums', 'bass'... (для Solo)
  role?: BlockRole;       // категория блока
  variant?: string;       // 'coda' для Outro, 'spoken' для Intro...
}

/** Текущая версия taxonomy. Инкрементировать при изменении схемы полей блока. */
export const TAXONOMY_VERSION = 1;

export const ROLE_MAP: Record<BlockType, BlockRole> = {
  intro: 'core',
  verse: 'core',
  prechorus: 'core',
  chorus: 'core',
  postchorus: 'core',
  bridge: 'transition',
  interlude: 'transition',
  outro: 'ending',
  hook: 'core',
  solo: 'instrumental',
  instrumental: 'instrumental',
  build: 'energy',
  drop: 'energy',
  breakdown: 'energy',
  spoken: 'speech',
  rap: 'speech',
};

export const BLOCK_ALIAS_MAP: Record<string, AliasEntry> = {
  // ── EN: Verse ──
  'verse':            { type: 'verse', reviewRequired: false },
  'v':                { type: 'verse', reviewRequired: false },
  // ── EN: Chorus ──
  'chorus':           { type: 'chorus', reviewRequired: false },
  'refrain':          { type: 'chorus', reviewRequired: false },
  // ── EN: Post-Chorus (отдельный тип, не chorus!) ──
  'post-chorus':      { type: 'postchorus', reviewRequired: false },
  'postchorus':       { type: 'postchorus', reviewRequired: false },
  'post chorus':      { type: 'postchorus', reviewRequired: false },
  // ── EN: Pre-Chorus ──
  'pre-chorus':       { type: 'prechorus', reviewRequired: false },
  'prechorus':        { type: 'prechorus', reviewRequired: false },
  'pre chorus':       { type: 'prechorus', reviewRequired: false },
  // ── EN: Bridge ──
  'bridge':           { type: 'bridge', reviewRequired: false },
  'climax':           { type: 'bridge', reviewRequired: true },
  // ── EN: Interlude ──
  'interlude':        { type: 'interlude', reviewRequired: false },
  'transition':       { type: 'interlude', reviewRequired: true },
  'turn':             { type: 'interlude', reviewRequired: true },
  'shoutout':         { type: 'interlude', reviewRequired: true },
  // ── EN: Solo (отдельный тип, не bridge!) ──
  'solo':             { type: 'solo', reviewRequired: false },
  'guitar solo':      { type: 'solo', reviewRequired: false, instrument: 'guitar' },
  'piano solo':       { type: 'solo', reviewRequired: false, instrument: 'piano' },
  'drum break':       { type: 'solo', reviewRequired: false, instrument: 'drums' },
  'drum solo':        { type: 'solo', reviewRequired: false, instrument: 'drums' },
  'bass solo':        { type: 'solo', reviewRequired: false, instrument: 'bass' },
  // ── EN: Instrumental (отдельный тип, не bridge!) ──
  'instrumental':     { type: 'instrumental', reviewRequired: false },
  'instrumental break': { type: 'instrumental', reviewRequired: false },
  'music':            { type: 'instrumental', reviewRequired: false },
  'break':            { type: 'instrumental', reviewRequired: true },
  // ── EN: Drop (новый тип EDM) ──
  'drop':             { type: 'drop', reviewRequired: false },
  'pop drop':         { type: 'drop', reviewRequired: false },
  // ── EN: Build (новый тип EDM) ──
  'build':            { type: 'build', reviewRequired: false },
  'rise':             { type: 'build', reviewRequired: false },
  'build up':         { type: 'build', reviewRequired: false },
  'buildup':          { type: 'build', reviewRequired: false },
  'riser':            { type: 'build', reviewRequired: false },
  // ── EN: Breakdown (новый тип EDM) ──
  'breakdown':         { type: 'breakdown', reviewRequired: false },
  'break down':        { type: 'breakdown', reviewRequired: false },
  // ── EN: Spoken (отдельный тип) ──
  'spoken':           { type: 'spoken', reviewRequired: false },
  'spoken word':      { type: 'spoken', reviewRequired: false },
  'talk':             { type: 'spoken', reviewRequired: false },
  // ── EN: Rap (отдельный тип, не verse!) ──
  'rap':              { type: 'rap', reviewRequired: false },
  'rap verse':        { type: 'rap', reviewRequired: false },
  'flow':             { type: 'rap', reviewRequired: false },
  // ── EN: Hook (отдельный тип, не chorus!) ──
  'hook':             { type: 'hook', reviewRequired: true },
  // ── EN: Intro/Outro ──
  'intro':            { type: 'intro', reviewRequired: false },
  'introduction':     { type: 'intro', reviewRequired: false },
  'intro spoken':     { type: 'intro', reviewRequired: true, variant: 'spoken' },
  'outro':            { type: 'outro', reviewRequired: false },
  'coda':             { type: 'outro', reviewRequired: false, variant: 'coda' },
  'finale':           { type: 'outro', reviewRequired: false, variant: 'coda' },
  'tag':              { type: 'outro', reviewRequired: true },
  'vamp':             { type: 'outro', reviewRequired: true },
  'fade':             { type: 'outro', reviewRequired: true },
  'fade out':         { type: 'outro', reviewRequired: true },
  // ── RU: Verse ──
  'куплет':           { type: 'verse', reviewRequired: false },
  // ── RU: Chorus ──
  'припев':           { type: 'chorus', reviewRequired: false },
  'рефрен':           { type: 'chorus', reviewRequired: true },
  // ── RU: Post-Chorus ──
  'постприпев':       { type: 'postchorus', reviewRequired: false },
  'пост-припев':      { type: 'postchorus', reviewRequired: false },
  // ── RU: Pre-Chorus ──
  'предприпев':       { type: 'prechorus', reviewRequired: false },
  'пре-хорус':        { type: 'prechorus', reviewRequired: false },
  'пре хорус':        { type: 'prechorus', reviewRequired: false },
  // ── RU: Bridge ──
  'бридж':            { type: 'bridge', reviewRequired: false },
  'переход':           { type: 'bridge', reviewRequired: true },
  'вставка':           { type: 'bridge', reviewRequired: true },
  // ── RU: Solo ──
  'соло':             { type: 'solo', reviewRequired: false },
  'соло гитара':      { type: 'solo', reviewRequired: false, instrument: 'guitar' },
  // ── RU: Instrumental ──
  'инструментал':     { type: 'instrumental', reviewRequired: false },
  'проигрыш':         { type: 'instrumental', reviewRequired: false },
  // ── RU: Drop ──
  'дроп':             { type: 'drop', reviewRequired: false },
  // ── RU: Build ──
  'билдап':           { type: 'build', reviewRequired: false },
  'билд':             { type: 'build', reviewRequired: false },
  // ── RU: Breakdown ──
  'брейкдаун':        { type: 'breakdown', reviewRequired: false },
  // ── RU: Spoken ──
  'говорят':          { type: 'spoken', reviewRequired: false },
  'речь':             { type: 'spoken', reviewRequired: false },
  'речитатив':        { type: 'spoken', reviewRequired: true },
  // ── RU: Rap ──
  'рэп':              { type: 'rap', reviewRequired: false },
  'рэп куплет':       { type: 'rap', reviewRequired: false },
  'читка':            { type: 'rap', reviewRequired: false },
  // ── RU: Hook ──
  'хук':              { type: 'hook', reviewRequired: true },
  // ── RU: Intro/Outro ──
  'интро':            { type: 'intro', reviewRequired: false },
  'вступление':       { type: 'intro', reviewRequired: false },
  'аутро':            { type: 'outro', reviewRequired: false },
  'концовка':         { type: 'outro', reviewRequired: true },
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

export function getBlockRole(type: BlockType): BlockRole {
  return ROLE_MAP[type] ?? 'core';
}

export function extractInstrument(tag: string): string | undefined {
  const normalized = tag.toLowerCase().trim();
  const alias = BLOCK_ALIAS_MAP[normalized];
  return alias?.instrument;
}
