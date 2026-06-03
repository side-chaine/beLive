/** Режим Show */
export type ShowMode = 'entry' | 'scenario';

/** Тип шага сценария */
export type StepType = 'content' | 'feature' | 'html';

/** Действие при feature-шаге */
export interface FeatureAction {
  /** Идентификатор действия из реестра */
  type: string;
  /** 
   * Предустановка состояния beLive — INTENT, не императив.
   * Конкретная функция решает как интерпретировать.
   * MVP: Record<string, unknown>
   * v1.1: discriminated union по type
   */
  preset?: Record<string, unknown>;
}

/** Снимок состояния deck перед feature activation */
export interface FeatureSnapshot {
  /** activeTabId из deck.store — ВОССТАНАВЛИВАЕТСЯ при deactivate */
  activeTabId: string;
  /** expanded из deck.store — ВОССТАНАВЛИВАЕТСЯ при deactivate */
  expanded: boolean;
  // ── ИНВАРИАНТ: при добавлении нового поля → обновить captureSnapshot + restoreSnapshot ──
}

/** Цветовая палитра для суб-слайдов */
export const SLIDE_COLORS = [
  '#9b59b6', // фиолетовый (default)
  '#e74c3c', // красный
  '#3498db', // синий
  '#2ecc71', // зелёный
  '#f39c12', // оранжевый
] as const;

export type SlideColor = typeof SLIDE_COLORS[number];

/** Пункт внутри суб-слайда */
export interface SubSlideBullet {
  text: string;
  color?: SlideColor;
}

/** Суб-слайд внутри content-шага */
export interface ShowSubSlide {
  imageId?: string;
  title?: string;
  titleColor?: SlideColor;
  description?: string;
  descriptionColor?: SlideColor;
  bullets?: SubSlideBullet[];
}

/** Сценарий — главный объект Show */
export interface ShowScenario {
  title: string;
  points: ShowPoint[];
  updatedAt: number;
}

/** Пункт сценария (тема) */
export interface ShowPoint {
  id: string;
  title: string;
  steps: ShowStep[];
}

/** Шаг сценария */
export interface ShowStep {
  id: string;
  type: StepType;
  
  // ── Content step ──
  title?: string;
  subtitle?: string;
  description?: string;
  bullets?: string[];
  imageIds?: string[];
  imageCaptions?: string[];  // Параллельно imageIds — подпись под каждым фото
  background?: string;
  notes?: string;
  subSlides?: ShowSubSlide[];  // ★ НОВОЕ — суб-слайды
  
  // ── Feature step ──
  action?: FeatureAction;
  actionLabel?: string;
  overlayNote?: string;

  // ── HTML step ──
  htmlId?: string;
}
