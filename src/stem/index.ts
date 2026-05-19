/**
 * Stem Domain — Public API
 *
 * Re-exports all stem types and store.
 * Import from 'src/stem' — not from individual files.
 */

// Types
export type {
  StemRole,
  RoutingTarget,
  StemDefinition,
  StemLoadEntry,
  StemLoadMap,
  StemDisplayOrder,
  StemSnapshot,
  StemAutomationData,
  StemAutomationLane,
  AutomationPoint,
  ModeStemPolicy,
  SoftResyncBudget,
  StemCapacityBudget,
} from './stemTypes';

// Constants
export {
  ROLE_ROUTING,
  BUILTIN_STEMS,
  DEFAULT_ROLE_ORDER,
  sortStemsForDisplay,
  MODE_STEM_POLICIES,
  SOFT_RESYNC_DEFAULTS,
  STEM_CAPACITY_BY_TIER,
  LOOP_PRE_SEEK_MAX_MS,
  LOOP_PRE_SEEK_DURATION_RATIO,
  LOOP_PRE_SEEK_TIMEOUT_MS,
} from './stemTypes';

// Store
export { useStemStore } from './stem.store';
