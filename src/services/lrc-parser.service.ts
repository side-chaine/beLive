/**
 * Unified LRC parser service.
 * Central access point for both LRC parsing approaches.
 *
 * - parseLrcFile  → strip timestamps, return clean text (string)
 * - parseLrc      → parse timestamps, return structured data (LrcLine[])
 *
 * SEMANTIC SPLIT: These are intentionally separate.
 * parseLrcFile is a STRIPPER (removes timing).
 * parseLrc is a PARSER (extracts timing).
 * Do NOT merge them.
 */

export type { LrcLine, LrcResult } from './auto-lyrics.service';

/**
 * Strip LRC timestamps and return clean text-only content.
 * @returns joined string of all text lines (no timestamps, no empty lines)
 */
export { parseLrcFile } from './parsing.service';

/**
 * Parse LRC text with timestamps into structured LrcLine[].
 * Handles multi-timestamps [00:12.00][01:24.00]text, [offset:], sort by time.
 * @returns LrcResult with lines, rawSynced, fetchedAt, confidence
 */
export { parseLrcString as parseLrc } from './auto-lyrics.service';
