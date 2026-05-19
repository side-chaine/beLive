import type {
  Exercise,
  Quest,
  ExerciseResult,
} from './exercise.types';

export interface ExerciseDefinitionDocument {
  schema: 'bl-exercise-v1';
  recipe: Exercise;
  quest?: Quest;
}

export interface ExerciseEvidenceDocument {
  schema: 'bl-exercise-evidence-v1';
  trackId: string;
  blockId: string;
  recipeId: string;
  questId?: string;
  attempts: ExerciseResult[];
}
