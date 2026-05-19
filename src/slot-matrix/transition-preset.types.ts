// ═══════════════════════════════════════════════════
// TRANSITION PRESET TYPES
// Система пресетов переходов для Preview Slot
// ═══════════════════════════════════════════════════

/** CSS easing — строковый формат.
 *  Named: "ease" | "ease-in" | "ease-out" | "ease-in-out" | "linear"
 *  Custom: "cubic-bezier(0.22, 1, 0.36, 1)" */
export type EasingValue = string;

/** Фаза transition state machine */
export type TransitionPhase = 'idle' | 'grow' | 'travel' | 'dissolve' | 'enter';

/** Параметры появления ПС при mount */
export interface AppearConfig {
  /** Длительность появления (сек) → --bl-ps-appear-duration */
  duration: number;
  /** CSS easing → --bl-ps-appear-easing */
  easing: EasingValue;
  /** Slide снизу (px) → --bl-ps-appear-slide */
  slideFrom: number;
  /** Начальная opacity → --bl-ps-appear-start-opacity */
  startOpacity: number;
  /** Конечная opacity → --bl-ps-appear-end-opacity */
  endOpacity: number;
}

/** Параметры прожектора (подсветка ПС при travel) */
export interface SpotlightConfig {
  /** Включить прожектор → data-spotlight-active */
  enabled: boolean;
  /** Интенсивность затемнения фона (0-1) → --bl-ps-spotlight-intensity */
  intensity: number;
  /** Размер свечения (px) → --bl-ps-spotlight-glow-size */
  glowSize: number;
  /** Прозрачность свечения (0-1) → --bl-ps-spotlight-glow-opacity */
  glowOpacity: number;
  /** Затемнять другие строки → data-spotlight-dim-others */
  dimOthers: boolean;
  /** Opacity других строк при travel (0-1) → --bl-ps-spotlight-others-opacity */
  othersOpacity: number;
}

/** Параметры полёта ПС к цели */
export interface TravelConfig {
  /** Длительность полёта (сек) → --bl-ps-travel-duration + JS */
  duration: number;
  /** CSS easing → --bl-ps-travel-easing + JS */
  easing: EasingValue;
  /** Прожектор */
  spotlight: SpotlightConfig;
}

/** Параметры ухода старых строк (Phase 2, MVP = mode:'none') */
export interface DissolveConfig {
  /** Режим dissolve */
  mode: 'none' | 'fade' | 'wave' | 'scale';
  /** Длительность (сек) */
  duration: number;
  /** Задержка между строками (сек) */
  stagger: number;
  /** Направление волны */
  waveDirection: 'top-down' | 'bottom-up';
  /** Финальный scale */
  scale: number;
  /** Финальная opacity */
  endOpacity: number;
}

/** Параметры появления новых строк (Phase 2, MVP = mode:'none') */
export interface EnterConfig {
  /** Режим enter */
  mode: 'none' | 'fade' | 'wave' | 'slide-up';
  /** Длительность (сек) */
  duration: number;
  /** Задержка между строками (сек) */
  stagger: number;
  /** Направление волны */
  waveDirection: 'top-down' | 'bottom-up';
  /** Начальная opacity */
  startOpacity: number;
  /** Slide offset (px) */
  slideY: number;
}

/** Тайминг координация между фазами */
export interface TimingConfig {
  /** За сколько сек до маркера начать travel (JS) */
  triggerOffset: number;
  /** Какую часть subBlock интервала занять travel (JS multiplier) */
  subBlockOffsetRatio: number;
  /** Сколько сек после триггера ловить (JS окно) */
  triggerWindow: number;
  /** Отступ ПС под последней строкой в idle (px, JS) */
  idleGap: number;
  /** Когда начать dissolve (Phase 2) */
  dissolveStart: 'at-switch' | 'travel-mid' | 'travel-end';
  /** Задержка после dissolve до enter (сек, Phase 2) */
  enterDelay: number;
}

/** Полный пресет перехода — сериализуется в JSON, едет в ZIP */
export interface TransitionPreset {
  /** Уникальный ID: /^[a-z0-9-]+$/ */
  id: string;
  /** Читаемое имя для UI */
  name: string;
  /** Версия схемы */
  version: number;
  /** Появление ПС */
  appear: AppearConfig;
  /** Полёт ПС к цели */
  travel: TravelConfig;
  /** Уход старых строк (Phase 2) */
  dissolve: DissolveConfig;
  /** Появление новых строк (Phase 2) */
  enter: EnterConfig;
  /** Тайминг координация */
  timing: TimingConfig;
}
