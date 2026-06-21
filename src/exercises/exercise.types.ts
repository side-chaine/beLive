export interface ExerciseScope {
  blockId: string;
  lineRange?: [number, number];
}

export type BackingMode =
  | 'full'
  | 'instrumental'
  | 'guide'
  | 'silent'
  | 'vocals-only';

export type StepAction =
  | 'listen'
  | 'record'
  | 'compare'
  | 'wait';

export interface ExerciseStep {
  action: StepAction;
  scope?: ExerciseScope;
  backing?: BackingMode;
  slot?: number | 'next';
  waitSec?: number;
  instruction?: string;
  visualCue?: 'lyrics' | 'waveform' | 'piano';
  captureMode?: 'standard' | 'in-flight';
  roundCaptureMode?: boolean;
  responseWindowIndex?: number;
  totalResponseWindows?: number;
  tempoRate?: number;
  /** Take classification: training or final */
  takeKind?: 'training' | 'final';
  /** Listen source semantics: reference (original) or previous-take (between-round preview) */
  listenSource?: 'reference' | 'previous-take';
}

export type ExerciseGoal =
  | { type: 'completion' }
  | { type: 'filled'; slotCount: number }
  | { type: 'rounds'; count: number };

export interface ExerciseRepeat {
  count: number;
  mode: 'fixed' | 'until-filled';
  filledTarget?: number;
}

export interface Exercise {
  id: string;
  recipeId: string;
  name: string;
  icon: string;
  description: string;
  scope: ExerciseScope;
  steps: ExerciseStep[];
  repeat: ExerciseRepeat;
  goal: ExerciseGoal;
  defaultBacking: BackingMode;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
  authorId?: string;
}

export interface QuestStepRef {
  recipeId: string;
  scopeOverride?: ExerciseScope;
  title?: string;
}

export interface Quest {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  exercises: QuestStepRef[];
  completionRule: 'all' | 'any-n';
  completionCount?: number;
}

export interface AttemptResult {
  stepIndex: number;
  takeId: string | null;
  completedAt: number;
}

export interface ExerciseResult {
  exerciseId: string;
  recipeId: string;
  roundsCompleted: number;
  roundsTotal: number;
  attempts: AttemptResult[];
  starredSlot: number | null;
  completedAt: number | null;
}

export interface SessionProgress {
  startedAt: number;
  exercisesCompleted: number;
  questsCompleted: number;
  blocksExercised: string[];
  totalRoundsCompleted: number;
}

export type ExercisePhase =
  | 'idle'
  | 'listening'
  | 'pre-recording'
  | 'recording'
  | 'comparing'
  | 'waiting'
  | 'round-complete'
  | 'exercise-complete';

export interface ExerciseProgressDisplay {
  round: number;
  totalRounds: number;
  step: number;
  totalSteps: number;
  icon: string;
  instruction: string;
}

export interface RoundCaptureState {
  active: boolean;
  lockedSlot: number | null;
  currentWindowIndex: number;
  totalWindows: number;
  recorderArmed: boolean;
  responseActive: boolean;
}

export interface ScenarioMixOverride {
  instrumental?: number;
  vocal?: number;
}

export interface CompletionMoment {
  exerciseId: string;
  recipeId: string;
  name: string;
  icon: string;
  blockId: string;
  roundsCompleted: number;
  roundsTotal: number;
  completedAt: number;
}
