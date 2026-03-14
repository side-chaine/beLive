/* ── Text Style Types ── */

export interface FontItem {
  id: string;
  name: string;
  family: string;
}

export interface FontCategory {
  name: string;
  order: number;
  list: FontItem[];
}

export interface StyleOptions {
  textAlign: string;
  fontSize?: string;
  lineSpacing?: string;
  fontFamily: string;
  textColor?: string;
  backgroundColor?: string;
  fontWeight?: string;
  textShadow?: string;
}

export interface TextStylePreset {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'performance' | 'creative' | 'hidden';
  cssClass: string;
  containerClass: string;
  transition: string;
  options: StyleOptions;
}

export interface TransitionItem {
  name: string;
  source: 'claude' | 'gemini';
}

export type TransitionSet = 'A' | 'B';

/* ── Word-level FX Types ── */

export type WordFocusLevel = 'off' | 'soft' | 'strong';

export type WordFxMode = 'progress' | 'neon' | 'underline' | 'bounce';

export type WordCompletedMode = 'off' | 'full';

/* ── Word Trail Depth Types (R1 Recovery) ── */
export type WordTrailDepth = 'off' | 'line' | 'scene';

/* ── Line-level FX Types ── */

export type LineActiveLevel = 'off' | 'soft' | 'strong';
export type LineNextLevel = 'off' | 'hint' | 'guide';
export type LineOthersLevel = 'dim' | 'medium' | 'low';

/* ── Line Others Source Types (V1: TrackMap / Neutral) ── */

export type LineOthersSource = 'trackmap' | 'neutral';

export const LINE_OTHERS_SOURCES: LineOthersSource[] = ['trackmap', 'neutral'];

export const LINE_OTHERS_SOURCE_LABELS: Record<LineOthersSource, string> = {
  trackmap: 'TrackMap',
  neutral: 'Neutral',
};

/* ── Font catalog (from legacy) ── */

export const FONT_CATEGORIES: FontCategory[] = [
  {
    name: 'Современные',
    order: 1,
    list: [
      { id: 'Roboto', name: 'Roboto', family: "'Roboto', sans-serif" },
      { id: 'Montserrat', name: 'Montserrat', family: "'Montserrat', sans-serif" },
      { id: 'OpenSans', name: 'Open Sans', family: "'Open Sans', sans-serif" },
      { id: 'BebasNeue', name: 'Bebas Neue', family: "'Bebas Neue', sans-serif" },
    ],
  },
  {
    name: 'Классические',
    order: 2,
    list: [
      { id: 'PlayfairDisplay', name: 'Playfair Display', family: "'Playfair Display', serif" },
      { id: 'Merriweather', name: 'Merriweather', family: "'Merriweather', serif" },
      { id: 'Lora', name: 'Lora', family: "'Lora', serif" },
      { id: 'PTSerif', name: 'PT Serif', family: "'PT Serif', serif" },
    ],
  },
  {
    name: 'Акцентные',
    order: 3,
    list: [
      { id: 'Oswald', name: 'Oswald', family: "'Oswald', sans-serif" },
      { id: 'Lobster', name: 'Lobster', family: "'Lobster', cursive" },
      { id: 'Pacifico', name: 'Pacifico', family: "'Pacifico', cursive" },
      { id: 'Caveat', name: 'Caveat', family: "'Caveat', cursive" },
    ],
  },
];

export const TRANSITIONS: Record<string, TransitionItem> = {
  /* ── Set A (Claude) ── */
  explosion: { name: 'Взрыв', source: 'claude' },
  burn: { name: 'Огонь', source: 'claude' },
  matrix: { name: 'Матрица', source: 'claude' },
  glitch: { name: 'Глюк', source: 'claude' },
  typewriter: { name: 'Печатная машинка', source: 'claude' },
  neonPulse: { name: 'Неоновый пульс', source: 'claude' },
  liquid: { name: 'Жидкость', source: 'claude' },
  vibration: { name: 'Вибрация', source: 'claude' },
  echo: { name: 'Эхо', source: 'claude' },
  sparkle: { name: 'Искры', source: 'claude' },
  wave: { name: 'Волна', source: 'claude' },
  letterByLetter: { name: 'По буквам', source: 'claude' },
  wordByWord: { name: 'По словам', source: 'claude' },
  smoke: { name: 'Дым', source: 'claude' },
  edgeGlow: { name: 'Свечение краёв', source: 'claude' },
  pulseRim: { name: 'Пульсация контура', source: 'claude' },
  fireEdge: { name: 'Огненный контур', source: 'claude' },
  neonOutline: { name: 'Неоновый контур', source: 'claude' },
  starlight: { name: 'Звёздное сияние', source: 'claude' },
  /* ── Set B (Gemini) ── */
  letterShine: { name: 'Сияние букв', source: 'gemini' },
  electricEdges: { name: 'Электрические края', source: 'gemini' },
  cometTail: { name: 'Хвост кометы', source: 'gemini' },
  ghostlyAppear: { name: 'Призрачное появление', source: 'gemini' },
  laserScan: { name: 'Лазерное сканирование', source: 'gemini' },
  pixelateIn: { name: 'Пикселизация', source: 'gemini' },
  cinemaLights: { name: 'Кино-огни', source: 'gemini' },
  windySmoke: { name: 'Дымный ветер', source: 'gemini' },
  starDust: { name: 'Звёздная пыль', source: 'gemini' },
  inkBleed: { name: 'Чернильное пятно', source: 'gemini' },
};

/* ── Default font scales per mode ── */

/* ── Word FX Defaults ── */

export const DEFAULT_WORD_FOCUS_LEVEL: WordFocusLevel = 'soft';
export const DEFAULT_WORD_FX_MODE: WordFxMode = 'underline';
export const DEFAULT_WORD_COMPLETED_MODE: WordCompletedMode = 'off';
export const DEFAULT_WORD_TRAIL_DEPTH: WordTrailDepth = 'off';

/* ── Line FX Defaults ── */

export const DEFAULT_LINE_ACTIVE_LEVEL: LineActiveLevel = 'soft';
export const DEFAULT_LINE_NEXT_LEVEL: LineNextLevel = 'guide';
export const DEFAULT_LINE_OTHERS_LEVEL: LineOthersLevel = 'medium';

/* ── Line Others Source Defaults ── */

export const DEFAULT_LINE_OTHERS_SOURCE: LineOthersSource = 'trackmap';

/* ── Default font scales per mode ── */

export const DEFAULT_FONT_SCALES: Record<string, number> = {
  default: 1.0,
  concert: 1.2,
  karaoke: 1.2,
  rehearsal: 1.0,
  live: 1.0,
  central: 1.0,
  minimalist: 1.0,
  neonGlow: 1.0,
};
