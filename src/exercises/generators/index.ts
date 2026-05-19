/**
 * Generator module exports
 * Foundation types and registry for generator-based recipe extraction
 */

export type {
  GeneratorFamily,
  GeneratorVersion,
  GeneratorParams,
  GeneratorMetadata,
  GeneratorFunction,
  GeneratorDef,
  GeneratorRegistryEntry,
  GeneratorRegistry,
} from './generator.types';

export {
  createGeneratorRegistry,
  generatorRegistry,
  registerGenerator,
  clearGeneratorRegistry,
} from './generator.registry';

export { echoGenerator } from './echo.generator';
export { fillSelectGenerator } from './fill-select.generator';
export { backingOnlyGenerator, acappellaBossGenerator } from './backing-ladder.generator';
export { tempoLadderGenerator } from './tempo-ladder.generator';
export { tradeGenerator } from './trade.generator';
