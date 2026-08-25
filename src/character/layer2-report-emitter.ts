// G3: Layer-2 эмиттер — мост завершения AI-ответа в 'team-m.report-arrived'.
import { aiHub, ASSISTANT_RESPONSE_COMPLETED } from '../js/ai/registry';
import { emitReportArrived } from './notify-emit';
import { registerInit } from '../foundation/registry/initRegistry';

function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

function onAssistantDone(e: Event): void {
  const d = (e as CustomEvent).detail as { fullText?: string } | undefined;
  const text = d?.fullText ?? '';
  emitReportArrived({
    source: 'mac-chat',
    reportId: `${shortHash(text)}:${Date.now()}`,
    text,
    ts: Date.now(),
  });
}

export function startLayer2Emitter(): () => void {
  aiHub.on(ASSISTANT_RESPONSE_COMPLETED, onAssistantDone);
  return () => aiHub.off(ASSISTANT_RESPONSE_COMPLETED, onAssistantDone);
}
registerInit({ id: 'layer2-report-emitter', init: startLayer2Emitter });
