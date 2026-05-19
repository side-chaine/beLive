import type {
  Exercise,
  BackingMode,
  ExerciseStep,
} from './exercise.types';
import { echoGenerator, fillSelectGenerator, backingOnlyGenerator, acappellaBossGenerator, tempoLadderGenerator, tradeGenerator } from './generators';
import type { CapabilityMetadata } from './generators/generator.types';

export interface RecipeParams {
  rounds?: number;
  backing?: BackingMode;
  lineCount?: number;
  [key: string]: unknown;
}

export interface RecipeDef {
  id: string;
  name: string;
  icon: string;
  category: 'drill' | 'challenge';
  description: string;
  defaultRounds: number;
  defaultBacking: BackingMode;
  surface: 'stable' | 'smoke' | 'special';
  capabilities?: CapabilityMetadata;
  generate: (blockId: string, params?: RecipeParams) => Exercise;
}

function genExerciseId(prefix: string, blockId: string): string {
  return `ex-${prefix}-${blockId}-${Date.now()}`;
}

/**
 * Echo Drill — extracted to generator
 * Backed by: echoGenerator from generators/echo.generator.ts
 */
export const echoDrill: RecipeDef = {
  id: echoGenerator.metadata.id,
  name: echoGenerator.metadata.name,
  icon: echoGenerator.metadata.icon,
  category: echoGenerator.metadata.category,
  description: echoGenerator.metadata.description,
  defaultRounds: echoGenerator.metadata.defaultRounds,
  defaultBacking: echoGenerator.metadata.defaultBacking,
  surface: echoGenerator.metadata.surface,
  capabilities: echoGenerator.metadata.capabilities,
  generate: echoGenerator.generate,
};

/**
 * 3-Take Challenge — extracted to generator
 * Backed by: fillSelectGenerator from generators/fill-select.generator.ts
 */
export const repeat3TakeChallenge: RecipeDef = {
  id: fillSelectGenerator.metadata.id,
  name: fillSelectGenerator.metadata.name,
  icon: fillSelectGenerator.metadata.icon,
  category: fillSelectGenerator.metadata.category,
  description: fillSelectGenerator.metadata.description,
  defaultRounds: fillSelectGenerator.metadata.defaultRounds,
  defaultBacking: fillSelectGenerator.metadata.defaultBacking,
  surface: fillSelectGenerator.metadata.surface,
  capabilities: fillSelectGenerator.metadata.capabilities,
  generate: fillSelectGenerator.generate,
};

export const callAndResponse: RecipeDef = {
  id: 'call-response',
  name: 'Call & Response',
  icon: '🔀',
  category: 'drill',
  description: 'Original sings one line, you sing the next',
  defaultRounds: 1,
  defaultBacking: 'instrumental',
  surface: 'special',
  capabilities: {
    requiresVocalStem: true,
    requiresWordSync: true,
  },
  generate: (blockId, params) => {
    // Build steps dynamically based on line count
    const lineCount = Math.max(2, params?.lineCount ?? 2);
    const totalWindows = Math.floor(lineCount / 2);
    const steps: ExerciseStep[] = [];

    for (let i = 0, windowIndex = 0; i + 1 < lineCount; i += 2, windowIndex++) {
      steps.push({
        action: 'listen',
        scope: { blockId, lineRange: [i, i] },
        backing: 'full',
        instruction: 'Listen to this line',
      });

      steps.push({
        action: 'record',
        scope: { blockId, lineRange: [i + 1, i + 1] },
        backing: params?.backing ?? 'instrumental',
        slot: 'next',
        captureMode: 'in-flight',
        roundCaptureMode: true,
        responseWindowIndex: windowIndex,
        totalResponseWindows: totalWindows,
        instruction: 'Now sing the next line',
      });
    }
    // Odd line counts intentionally skip the final unmatched line in CR-WAVE A

    return {
      id: genExerciseId('callresp', blockId),
      recipeId: 'call-response',
      name: 'Call & Response',
      icon: '🔀',
      description: 'Alternate with the original by line',
      scope: { blockId },
      steps,
      repeat: { count: params?.rounds ?? 1, mode: 'fixed' },
      goal: { type: 'rounds', count: params?.rounds ?? 1 },
      defaultBacking: params?.backing ?? 'instrumental',
    };
  },
};

export const backingOnly: RecipeDef = {
  id: backingOnlyGenerator.metadata.id,
  name: backingOnlyGenerator.metadata.name,
  icon: backingOnlyGenerator.metadata.icon,
  category: backingOnlyGenerator.metadata.category,
  description: backingOnlyGenerator.metadata.description,
  defaultRounds: backingOnlyGenerator.metadata.defaultRounds,
  defaultBacking: backingOnlyGenerator.metadata.defaultBacking,
  surface: backingOnlyGenerator.metadata.surface,
  capabilities: backingOnlyGenerator.metadata.capabilities,
  generate: backingOnlyGenerator.generate,
};

export const acappellaBoss: RecipeDef = {
  id: acappellaBossGenerator.metadata.id,
  name: acappellaBossGenerator.metadata.name,
  icon: acappellaBossGenerator.metadata.icon,
  category: acappellaBossGenerator.metadata.category,
  description: acappellaBossGenerator.metadata.description,
  defaultRounds: acappellaBossGenerator.metadata.defaultRounds,
  defaultBacking: acappellaBossGenerator.metadata.defaultBacking,
  surface: acappellaBossGenerator.metadata.surface,
  capabilities: acappellaBossGenerator.metadata.capabilities,
  generate: acappellaBossGenerator.generate,
};

export const tempoLadder: RecipeDef = {
  id: tempoLadderGenerator.metadata.id,
  name: tempoLadderGenerator.metadata.name,
  icon: tempoLadderGenerator.metadata.icon,
  category: tempoLadderGenerator.metadata.category,
  description: tempoLadderGenerator.metadata.description,
  defaultRounds: tempoLadderGenerator.metadata.defaultRounds,
  defaultBacking: tempoLadderGenerator.metadata.defaultBacking,
  surface: tempoLadderGenerator.metadata.surface,
  capabilities: tempoLadderGenerator.metadata.capabilities,
  generate: tempoLadderGenerator.generate,
};

/**
 * Trade v1 — extracted to generator
 * Backed by: tradeGenerator from generators/trade.generator.ts
 * Hidden/special surface — not in current learner surface
 */
export const trade: RecipeDef = {
  id: tradeGenerator.metadata.id,
  name: tradeGenerator.metadata.name,
  icon: tradeGenerator.metadata.icon,
  category: tradeGenerator.metadata.category,
  description: tradeGenerator.metadata.description,
  defaultRounds: tradeGenerator.metadata.defaultRounds,
  defaultBacking: tradeGenerator.metadata.defaultBacking,
  surface: tradeGenerator.metadata.surface,
  capabilities: tradeGenerator.metadata.capabilities,
  generate: tradeGenerator.generate,
};

export const EXERCISE_RECIPES: RecipeDef[] = [
  echoDrill,
  repeat3TakeChallenge,
  callAndResponse,
  backingOnly,
  acappellaBoss,
  tempoLadder,
  trade,
];
