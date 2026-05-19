/**
 * Generator Registry Foundation
 * 
 * Minimal registry for managing available generators.
 * Initially empty - will be populated with extracted generators in future TCs.
 * 
 * This foundation enables:
 * - Lookup by id, family, or surface
 * - Future extraction of hardcoded recipes
 * - Backward compatibility during migration
 */

import type {
  GeneratorDef,
  GeneratorRegistry,
  GeneratorRegistryEntry,
  GeneratorFamily,
} from './generator.types';
import { echoGenerator } from './echo.generator';
import { fillSelectGenerator } from './fill-select.generator';
import { backingOnlyGenerator, acappellaBossGenerator } from './backing-ladder.generator';
import { tempoLadderGenerator } from './tempo-ladder.generator';
import { tradeGenerator } from './trade.generator';

/**
 * Create empty generator registry
 * Will be populated with extracted generators in Phase 2
 */
export function createGeneratorRegistry(): GeneratorRegistry {
  const entries = new Map<string, GeneratorRegistryEntry>();

  return {
    entries,

    getById(id: string): GeneratorDef | null {
      const entry = entries.get(id);
      return entry?.def ?? null;
    },

    getByFamily(family: GeneratorFamily): GeneratorDef[] {
      return Array.from(entries.values())
        .filter((entry) => entry.def.metadata.family === family)
        .map((entry) => entry.def);
    },

    getStable(): GeneratorDef[] {
      return Array.from(entries.values())
        .filter((entry) => entry.def.metadata.surface === 'stable')
        .map((entry) => entry.def);
    },

    getAll(): GeneratorDef[] {
      return Array.from(entries.values()).map((entry) => entry.def);
    },
  };
}

/**
 * Global generator registry instance
 * Initialized empty, will be populated with extracted generators
 */
export const generatorRegistry = createGeneratorRegistry();

// Register extracted generators
registerGenerator(echoGenerator, 'extracted');
registerGenerator(fillSelectGenerator, 'extracted');
registerGenerator(backingOnlyGenerator, 'extracted');
registerGenerator(acappellaBossGenerator, 'extracted');
registerGenerator(tempoLadderGenerator, 'authored');
registerGenerator(tradeGenerator, 'authored');

/**
 * Register a generator in the global registry
 * Used during extraction phase to populate registry
 */
export function registerGenerator(
  def: GeneratorDef,
  source: 'extracted' | 'authored' | 'imported' = 'extracted',
): void {
  const entry: GeneratorRegistryEntry = {
    def,
    createdAt: Date.now(),
    source,
  };
  generatorRegistry.entries.set(def.metadata.id, entry);
}

/**
 * Clear all generators from registry
 * Used for testing and reset scenarios
 */
export function clearGeneratorRegistry(): void {
  generatorRegistry.entries.clear();
}
