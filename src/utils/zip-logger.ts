/**
 * Structured ZIP-export logger.
 * 5 event types + SUSPECT gate.
 * Единый emitter — легко заменить на Sentry/Analytics в будущем.
 */

type ZipEventType =
  | 'preflight'
  | 'fast-path'
  | 'export-start'
  | 'stem-decode-start'
  | 'stem-encode-progress'
  | 'stem-ok'
  | 'stem-skip'
  | 'stem-abort'
  | 'export-done'
  | 'budget-met'
  | 'budget-gate'
  | 'budget-exceeded'
  | 'tightening-start'
  | 'tightening-done'
  | 'tightening-failed'
  | 'abort-user';

export function logZipEvent(event: ZipEventType, payload: Record<string, any>): void {
  const prefix = '[zip-enc]';
  switch (event) {
    case 'export-start':
      console.log(prefix, 'START', formatPayload(payload));
      break;
    case 'preflight':
      console.log(prefix, 'PREFLIGHT', formatPayload(payload));
      break;
    case 'fast-path':
      console.log(prefix, 'FAST_PATH', formatPayload(payload));
      break;
    case 'stem-decode-start':
      console.log(prefix, 'DECODE_START', formatPayload(payload));
      break;
    case 'stem-encode-progress':
      console.log(prefix, 'ENCODE_PROGRESS', formatPayload(payload));
      break;
    case 'stem-ok':
      console.log(prefix, 'OK', formatPayload(payload));
      break;
    case 'stem-skip':
      console.warn(prefix, 'SKIP', formatPayload(payload));
      // SUSPECT gate: если outSize < 8MB и это был T0, подозрительно
      if (payload.tier === 'T0' && payload.outSize < 8 * 1024 * 1024) {
        console.warn(prefix, 'SUSPECT — outSize < 8MB на T0');
      }
      break;
    case 'stem-abort':
      console.error(prefix, 'ABORT', formatPayload(payload));
      break;
    case 'export-done':
      console.log(prefix, 'FINAL', formatPayload(payload));
      break;
    case 'budget-met':
      console.log(prefix, 'BUDGET_MET', formatPayload(payload));
      break;
    case 'budget-gate':
      console.log(prefix, 'BUDGET_GATE', formatPayload(payload));
      break;
    case 'budget-exceeded':
      console.warn(prefix, 'BUDGET_EXCEEDED', formatPayload(payload));
      break;
    case 'tightening-start':
      console.log(prefix, 'TIGHTENING_START', formatPayload(payload));
      break;
    case 'tightening-done':
      console.log(prefix, 'TIGHTENING_DONE', formatPayload(payload));
      break;
    case 'tightening-failed':
      console.error(prefix, 'TIGHTENING_FAILED', formatPayload(payload));
      break;
    case 'abort-user':
      console.error(prefix, 'ABORT_USER', formatPayload(payload));
      break;
    default:
      break;
  }
}

function formatPayload(p: Record<string, any>): string {
  try { return JSON.stringify(p); } catch { return String(p); }
}
