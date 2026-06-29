// src/structure/block-colors.ts
// Canonical block color contract — single source of truth
// Финальная палитра через role (утверждена: GPT + Никита)

export const BLOCK_COLORS = {
  // Core
  intro: '#2196F3',         // 🔵 Синий — спокойное начало
  verse: '#4CAF50',         // 🟢 Зелёный — основное повествование
  prechorus: '#FFC107',     // 🟨 Золотистый — подготовка (НЕ ярче chorus!)
  chorus: '#F44336',        // 🔴 Красный — кульминация
  postchorus: '#FF8A65',    // 🪸 Коралловый — производный от Chorus
  hook: '#FFB300',          // 🟠 Янтарный — яркий акцент
  // Transition
  bridge: '#9C27B0',        // 🟣 Фиолетовый — неожиданный поворот
  interlude: '#BA68C8',     // 🪻 Сирень — пауза, воздух
  // Instrumental
  solo: '#FB8C00',          // 🟠 Оранжевый — инструментальная энергия
  instrumental: '#78909C',  // 🔘 Серо-голубой — мягкий фоновый
  // Energy
  build: '#9CCC65',         // 🌱 Светло-зелёный — рост
  drop: '#FF1744',          // ❤️ Огненно-красный — BOOM!
  breakdown: '#455A64',     // ⚙️ Графит — энергия ушла, осталась механика
  // Speech
  spoken: '#CFD8DC',        // 🌫 Бумажный — максимально нейтральный
  rap: '#64DD17',           // 🟩 Холодный лайм — ритмичный, современный
  // Ending
  outro: '#00BCD4',         // 🩵 Бирюзовый — растворение
  // Fallbacks
  unknown: '#9E9E9E',       // ⚪ Серый — неизвестный тип
  blank: 'rgba(255,255,255,0.1)', // Пустой
} as const;

/**
 * Get canonical block color by type
 * Normalizes aliases (pre-chorus → prechorus)
 * Falls back to unknown for unrecognized types
 */
export function getCanonicalBlockColor(blockType?: string): string {
  if (!blockType) return BLOCK_COLORS.unknown;

  const normalized = blockType.toLowerCase().replace(/[\s-]+/g, '');

  // Normalize aliases
  if (normalized === 'prechorus' || normalized === 'pre-chorus') {
    return BLOCK_COLORS.prechorus;
  }
  if (normalized === 'postchorus' || normalized === 'post-chorus') {
    return BLOCK_COLORS.postchorus;
  }
  if (normalized === 'guitarsolo' || normalized === 'pianosolo') {
    return BLOCK_COLORS.solo;
  }
  if (normalized === 'instrumentalbreak') {
    return BLOCK_COLORS.instrumental;
  }

  // Direct lookup
  const key = normalized as keyof typeof BLOCK_COLORS;
  if (key in BLOCK_COLORS) {
    return BLOCK_COLORS[key];
  }

  // Fallback
  return BLOCK_COLORS.unknown;
}
