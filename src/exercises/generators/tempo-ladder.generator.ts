/**
 * Tempo Ladder Generator Family
 * 
 * Experimental family for tempo-aware practice scenarios.
 * Implements: Progressive tempo challenges with listen-first contract.
 * 
 * Family: tempo-ladder (tempo progression)
 * Version: initial version (experimental)
 * 
 * EXPERIMENTAL STATUS:
 * - Listen steps may carry tempoRate for future runtime application
 * - Record steps remain honest under current record-at-1.0 contract
 * - No slowed recording support yet; tempo awareness is listen-only
 */

import type { Exercise, ExerciseStep } from '../exercise.types';
import type { GeneratorDef, GeneratorParams } from './generator.types';
import { genExerciseId } from './gen-id.util';

/**
 * Tempo Ladder Generator — Explicit Ladder Progression
 * 
 * v2 architecture: generates explicit tempo stages walking toward 100%
 * - if start < 1.0 → generate +0.05 steps until 1.0
 * - if start > 1.0 → generate -0.05 steps until 1.0
 * - if start === 1.0 → single final stage only
 * 
 * Each stage: listen → record
 * Record steps use slot 0, takeKind 'training' for non-100 stages, 'final' for 100 stage
 */
export const tempoLadderGenerator: GeneratorDef = {
  metadata: {
    // Identity
    id: 'tempo-ladder',
    family: 'tempo-ladder',
    version: { major: 1, minor: 0, patch: 0 },

    // Recipe-facing display
    name: 'Tempo Ladder',
    icon: '🎼',
    category: 'drill',
    description: 'Progressive tempo challenge walking toward original speed',

    // Runtime defaults
    defaultRounds: 1,
    defaultBacking: 'full',

    // Surface visibility (experimental/smoke)
    surface: 'smoke',

    // Backward compatibility
    recipeId: 'tempo-ladder',

    // Capability metadata
    capabilities: {
      experimentalReason: 'Explicit ladder progression toward 100% tempo',
    },
  },

  generate: (blockId: string, params?: GeneratorParams): Exercise => {
    const startRate = (params?.tempoRate as number) ?? 0.9;
    const previewBetweenRounds = (params?.previewBetweenRounds as boolean) ?? false;

    // Generate ladder stages
    const stages: number[] = [];
    if (startRate < 1.0) {
      // Ascending ladder: +0.05 steps until 1.0
      let tempo = startRate;
      while (tempo < 1.0) {
        stages.push(Math.round(tempo * 100) / 100);
        tempo += 0.05;
      }
      stages.push(1.0);
    } else if (startRate > 1.0) {
      // Descending ladder: -0.05 steps until 1.0
      let tempo = startRate;
      while (tempo > 1.0) {
        stages.push(Math.round(tempo * 100) / 100);
        tempo -= 0.05;
      }
      stages.push(1.0);
    } else {
      // Single stage at 100%
      stages.push(1.0);
    }

    // Build steps: listen + record + optional previous-take preview for each stage
    const steps: ExerciseStep[] = [];
    for (let i = 0; i < stages.length; i++) {
      const tempo = stages[i];
      const isFinalStage = i === stages.length - 1;

      // Reference listen step (always present)
      steps.push({
        action: 'listen',
        backing: 'full',
        tempoRate: tempo,
        listenSource: 'reference',
        instruction: `Listen at ${Math.round(tempo * 100)}%`,
      });

      // Record step
      steps.push({
        action: 'record',
        backing: 'full',
        slot: 0,
        tempoRate: tempo,
        takeKind: isFinalStage ? 'final' : 'training',
        instruction: `Record at ${Math.round(tempo * 100)}%`,
      });

      // Optional previous-take preview step (after record, when enabled)
      if (previewBetweenRounds) {
        steps.push({
          action: 'listen',
          backing: 'full',
          tempoRate: tempo,
          listenSource: 'previous-take',
          instruction: `Review your previous take at ${Math.round(tempo * 100)}%`,
        });
      }
    }

    return {
      id: genExerciseId('tempo', blockId),
      recipeId: 'tempo-ladder',
      name: 'Tempo Ladder',
      icon: '🎼',
      description: `Progressive tempo challenge from ${Math.round(startRate * 100)}% to 100%`,
      scope: { blockId },
      steps,
      repeat: { count: 1, mode: 'fixed' },
      goal: { type: 'completion' },
      defaultBacking: 'full',
    };
  },
};
