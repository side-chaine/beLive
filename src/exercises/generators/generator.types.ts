/**
 * Generator Foundation Types
 * 
 * Minimal types for generator-based recipe extraction.
 * Supports generator provenance, family identity, and recipe-facing metadata.
 * 
 * This layer enables future extraction of hardcoded recipes into generator families
 * without changing current visible behavior.
 */

import type { Exercise, BackingMode } from '../exercise.types';

/**
 * Generator family identifier
 * Families are rare and meaningful (3-7 expected)
 * Examples: 'echo', 'until-filled', 'alternation'
 */
export type GeneratorFamily = string;

/**
 * Generator version for tracking provenance
 * Allows multiple versions of same family to coexist during migration
 */
export interface GeneratorVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Recipe parameters passed to generator
 * Allows customization of generated exercises
 */
export interface GeneratorParams {
  rounds?: number;
  backing?: BackingMode;
  lineCount?: number;
  [key: string]: unknown;
}

/**
 * Capability metadata for scenario availability gating
 * Minimal shape for reasoning about which scenarios are available, hidden, or disabled
 */
export interface CapabilityMetadata {
  requiresVocalStem?: boolean;
  requiresWordSync?: boolean;
  experimentalReason?: string;
}

/**
 * Generator metadata for recipe-facing surface
 * Equivalent to current RecipeDef but with provenance
 */
export interface GeneratorMetadata {
  // Identity
  id: string;
  family: GeneratorFamily;
  version: GeneratorVersion;

  // Recipe-facing display
  name: string;
  icon: string;
  category: 'drill' | 'challenge';
  description: string;

  // Runtime defaults
  defaultRounds: number;
  defaultBacking: BackingMode;

  // Surface visibility
  surface: 'stable' | 'smoke' | 'special';

  // Optional: recipe id for backward compatibility during migration
  recipeId?: string;

  // Optional: capability metadata for scenario gating
  capabilities?: CapabilityMetadata;

  // Optional: hide from all learner surfaces (smoke-but-not-ready)
  hidden?: boolean;
}

/**
 * Generator function signature
 * Produces Exercise from blockId and optional params
 */
export type GeneratorFunction = (
  blockId: string,
  params?: GeneratorParams,
) => Exercise;

/**
 * Complete generator definition
 * Combines metadata with generation logic
 */
export interface GeneratorDef {
  metadata: GeneratorMetadata;
  generate: GeneratorFunction;
}

/**
 * Generator registry entry
 * Allows lookup by id, family, or version
 */
export interface GeneratorRegistryEntry {
  def: GeneratorDef;
  createdAt: number;
  source: 'extracted' | 'authored' | 'imported';
}

/**
 * Generator registry
 * Central lookup for all available generators
 */
export interface GeneratorRegistry {
  entries: Map<string, GeneratorRegistryEntry>;
  
  // Lookup methods
  getById(id: string): GeneratorDef | null;
  getByFamily(family: GeneratorFamily): GeneratorDef[];
  getStable(): GeneratorDef[];
  getAll(): GeneratorDef[];
}
