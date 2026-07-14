import { authService } from '../../services/auth.service';
import { useAppStore } from '../../stores/app.store';
import { SignalingClient } from './signaling-client';
import { PeerConnectionManager } from './peer-connection';
import { RehearsalTriggerBridge } from '../bridge/rehearsal-trigger.bridge';
import { useRehearsalSessionStore } from '../store/rehearsal-session.store';

export interface RehearsalLinkParams {
  roomId: string;
  role: 'teacher' | 'student';
  ticket: string;
  tgFileId?: string | null;
}

const STORAGE_KEY = 'bl-rehearsal-pending';

function parseFromUrl(): RehearsalLinkParams | null {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room');
  const role = params.get('role');
  const ticket = params.get('ticket');
  if (roomId && (role === 'teacher' || role === 'student') && ticket) {
    return { roomId, role, ticket, tgFileId: params.get('tgFileId') };
  }
  return null;
}

/** Подписать ticket на клиенте (HMAC-SHA256).
 *  Используется обоими путями: ?phone=1 (main.tsx) и ?room= (deep-link.service).
 *  Формат: base64(payload).base64(signature) — соответствует gateway/rehearsal/src/tickets.ts. */
export async function signClientTicket(roomId: string, role: 'teacher' | 'student', secret: string): Promise<string> {
  const exp = Date.now() + 3600000; // 1 час
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const body = btoa(JSON.stringify({ roomId, role, exp }));
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return `${body}.${sig}`;
}

export async function handleRehearsalDeepLink(): Promise<RehearsalLinkParams | null> {
  let link = parseFromUrl();

  if (link) {
    // Если ticket не в формате body.sig — это сырой секрет, подписываем на клиенте
    if (!link.ticket.includes('.')) {
      link = { ...link, ticket: await signClientTicket(link.roomId, link.role, link.ticket) };
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(link));
    window.history.replaceState({}, '', window.location.pathname);
  } else {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { link = JSON.parse(saved); } catch { link = null; }
    }
  }

  if (!link) return null;

  const isAuthed = await authService.checkExistingAuth();
  if (isAuthed) {
    useAppStore.getState().setSurface('app');
  } else {
    await authService.skipAuth();
  }

  (window as any).beLiveSwitchMode?.('rehearsal');
  return link;
}

/** Создаёт WebRTC bridge для репетиционной сессии. */
export function connectRehearsalSession(link: RehearsalLinkParams): void {
  const { roomId, role, ticket } = link;
  useRehearsalSessionStore.getState().setRole(role, roomId);
  const sc = new SignalingClient(roomId, role, ticket);
  const pc = new PeerConnectionManager(sc, role);
  sc.onPeerJoined = () => {
    if (role === 'teacher') pc.createDataChannels();
  };
  const bridge = new RehearsalTriggerBridge(pc, role);
  sc.connect();
  (window as any).__pc = pc;
  (window as any).__sc = sc;
  (window as any).__bridge = bridge;
}

export function clearRehearsalDeepLink() {
  sessionStorage.removeItem(STORAGE_KEY);
}
