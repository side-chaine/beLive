/** Режим Rec Studio */
export type RecStudioMode = 'entry' | 'scenario';

/** Тип шага сценария */
export type StepType = 'content' | 'feature';

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

/** Сценарий — главный объект Rec Studio */
export interface RecScenario {
  title: string;
  points: RecPoint[];
  updatedAt: number;
}

/** Пункт сценария (тема) */
export interface RecPoint {
  id: string;
  title: string;
  steps: RecStep[];
}

/** Шаг сценария */
export interface RecStep {
  id: string;
  type: StepType;
  
  // ── Content step ──
  title?: string;
  subtitle?: string;
  description?: string;
  bullets?: string[];
  imageIds?: string[];
  background?: string;
  notes?: string;
  
  // ── Feature step ──
  action?: FeatureAction;
  actionLabel?: string;
  overlayNote?: string;
}
