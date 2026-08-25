import { registerInit } from '../foundation/registry/initRegistry';
import { useNotifyStore } from '../stores/notify.store';
import { emitReportArrived } from './notify-emit';
import inboxVirtual from '../../team-m/INBOX.md?raw';

const POLL_MS = 1500;
const inboxUrl = `${import.meta.env.BASE_URL}team-m/INBOX.md`;

function contentHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length.toString(16)}:${(h >>> 0).toString(16)}`;
}

function apply(next: string): void {
  const hash = contentHash(next);
  const { lastHash, setArrival } = useNotifyStore.getState();
  if (hash === lastHash) return;
  const hadBaseline = lastHash !== '';
  setArrival(hash);
  if (hadBaseline) emitReportArrived({ source: 'inbox-sync', reportId: hash, ts: Date.now() });
}

async function pollInbox(): Promise<void> {
  try {
    const res = await fetch(inboxUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`inbox ${res.status}`);
    apply(await res.text());
  } catch {
    apply(inboxVirtual);
  }
}

export function startNotifyBridge(): () => void {
  void pollInbox();
  const timer = setInterval(() => void pollInbox(), POLL_MS);
  return () => clearInterval(timer);
}

registerInit({ id: 'notify-bridge', init: startNotifyBridge });
