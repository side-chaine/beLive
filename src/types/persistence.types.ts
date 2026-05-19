/**
 * Persistence Contract Types
 * Defines strict shapes for persisted data structures
 */

/**
 * Persisted text block (from lyrics editor or import)
 */
export interface PersistedTextBlock {
  id: string;
  name: string;
  lineIndices: number[];
  type?: string;
  originalLineIndices?: number[];
  contentLines?: string[];  // TC-010: Display text for WagonTrain
}

/**
 * Persisted sync marker (from word-sync or manual entry)
 */
export interface PersistedSyncMarker {
  id: string;
  lineIndex: number;
  time: number;
  text: string;
  blockType?: string;
  color?: string;
  markerType?: 'M1' | 'M2';
  afterBlockId?: string;
  isSuggested?: boolean;
}

/**
 * Transition zone between blocks — gap where M2 closing marker can be placed.
 * Computed on-the-fly from markers + blocks, NOT persisted.
 */
export interface TransitionZone {
  afterBlockId: string;
  beforeBlockId: string | null;
  fromTime: number;
  toTime: number | null;
  gapDuration: number;
  avgLineGap: number;
  suggestedTime: number;
  hasM2: boolean;
  m2Time?: number;
  isTrackEnd: boolean;
}

/**
 * Type predicates for runtime validation
 */

export function isPersistedSyncMarker(obj: unknown): obj is PersistedSyncMarker {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.lineIndex === 'number' &&
    typeof o.time === 'number' &&
    typeof o.text === 'string' &&
    (o.blockType === undefined || typeof o.blockType === 'string') &&
    (o.color === undefined || typeof o.color === 'string') &&
    (o.markerType === undefined || o.markerType === 'M1' || o.markerType === 'M2') &&
    (o.afterBlockId === undefined || typeof o.afterBlockId === 'string') &&
    (o.isSuggested === undefined || typeof o.isSuggested === 'boolean')
  );
}

export function isPersistedSyncMarkerArray(obj: unknown): obj is PersistedSyncMarker[] {
  return Array.isArray(obj) && obj.every(isPersistedSyncMarker);
}

export function isPersistedTextBlock(obj: unknown): obj is PersistedTextBlock {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    Array.isArray(o.lineIndices) &&
    o.lineIndices.every((x: unknown) => typeof x === 'number') &&
    (o.type === undefined || typeof o.type === 'string') &&
    (o.originalLineIndices === undefined ||
      (Array.isArray(o.originalLineIndices) &&
        o.originalLineIndices.every((x: unknown) => typeof x === 'number')))
  );
}

export function isPersistedTextBlockArray(obj: unknown): obj is PersistedTextBlock[] {
  return Array.isArray(obj) && obj.every(isPersistedTextBlock);
}
