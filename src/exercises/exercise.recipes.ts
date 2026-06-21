import type {
  Exercise,
  BackingMode,
} from './exercise.types';
import { echoGenerator, fillSelectGenerator, backingOnlyGenerator, acappellaBossGenerator, tempoLadderGenerator, tradeGenerator, callResponseGenerator } from './generators';
import type { GeneratorDef } from './generators/generator.types';
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
  hidden?: boolean;
  generate: (blockId: string, params?: RecipeParams) => Exercise;
}

/**
 * Create a RecipeDef from a GeneratorDef.
 * Eliminates manual proxy boilerplate across generator-backed recipes.
 * Automatically propagates all GeneratorMetadata fields.
 */
function recipeFromGenerator(gen: GeneratorDef): RecipeDef {
  return {
    id: gen.metadata.id,
    name: gen.metadata.name,
    icon: gen.metadata.icon,
    category: gen.metadata.category,
    description: gen.metadata.description,
    defaultRounds: gen.metadata.defaultRounds,
    defaultBacking: gen.metadata.defaultBacking,
    surface: gen.metadata.surface,
    capabilities: gen.metadata.capabilities,
    hidden: gen.metadata.hidden,
    generate: (blockId, params) => gen.generate(blockId, params as any),
  };
}

/**
 * Echo Drill — extracted to generator
 * Backed by: echoGenerator from generators/echo.generator.ts
 */
export const echoDrill: RecipeDef = recipeFromGenerator(echoGenerator);

/**
 * 3-Take Challenge — extracted to generator
 * Backed by: fillSelectGenerator from generators/fill-select.generator.ts
 */
export const repeat3TakeChallenge: RecipeDef = recipeFromGenerator(fillSelectGenerator);

export const callAndResponse: RecipeDef = recipeFromGenerator(callResponseGenerator);

export const backingOnly: RecipeDef = recipeFromGenerator(backingOnlyGenerator);

export const acappellaBoss: RecipeDef = recipeFromGenerator(acappellaBossGenerator);

export const tempoLadder: RecipeDef = recipeFromGenerator(tempoLadderGenerator);

/**
 * Trade v1 — extracted to generator
 * Backed by: tradeGenerator from generators/trade.generator.ts
 * Hidden/special surface — not in current learner surface
 */
export const trade: RecipeDef = recipeFromGenerator(tradeGenerator);

export const EXERCISE_RECIPES: RecipeDef[] = [
  echoDrill,
  repeat3TakeChallenge,
  callAndResponse,
  backingOnly,
  acappellaBoss,
  tempoLadder,
  trade,
];
