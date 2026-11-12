import { registerInit } from '../foundation/registry/initRegistry';
import { useNotifyStore } from '../stores/notify.store';
import { emitReportArrived } from './notify-emit';
import inboxVirtual from '../../team-m/INBOX.md?raw';

// 1.5 с — это 240 запросов в минуту на статический файл. Cloudflare на такое
// отвечает ERR_CONNECTION_CLOSED и рвёт HTTP/2, а браузер держит к хосту шесть
// соединений — остальные запросы приложения встают в очередь. Полминуты с
// запасом: «почта» обновляется руками, а не сама.
const POLL_MS = 30_000;
/** Зависший запрос не должен копиться поверх следующего. */
const FETCH_TIMEOUT_MS = 5_000;
const inboxUrl = `${import.meta.env.BASE_URL}team-m/INBOX.md`;

function contentHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {h = ((h << 5) + h + s.charCodeAt(i)) | 0;}
  return `${s.length.toString(16)}:${(h >>> 0).toString(16)}`;
}

function apply(next: string): void {
  const hash = contentHash(next);
  const { lastHash, setArrival } = useNotifyStore.getState();
  if (hash === lastHash) {return;}
  const hadBaseline = lastHash !== '';
  setArrival(hash);
  if (hadBaseline) {emitReportArrived({ source: 'inbox-sync', reportId: hash, ts: Date.now() });}
}

let inFlight = false;

async function pollInbox(): Promise<void> {
  if (inFlight) {return;}
  inFlight = true;
  try {
    const res = await fetch(inboxUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {throw new Error(`inbox ${res.status}`);}
    apply(await res.text());
  } catch {
    apply(inboxVirtual);
  } finally {
    inFlight = false;
  }
}

export function startNotifyBridge(): () => void {
  void pollInbox();
  const timer = setInterval(() => void pollInbox(), POLL_MS);
  return () => clearInterval(timer);
}

registerInit({ id: 'notify-bridge', init: startNotifyBridge });
