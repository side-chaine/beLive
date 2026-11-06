import { SignalingClient } from '../Rehearsal/services/signaling-client';
import { PeerConnectionManager } from '../Rehearsal/services/peer-connection';
import { RehearsalTriggerBridge } from '../Rehearsal/bridge/rehearsal-trigger.bridge';
import { useRehearsalSessionStore } from '../Rehearsal/store/rehearsal-session.store';

/**
 * Non-critical startup hooks: rehearsal test bridge, welcome-surface guard and
 * phone deep-link auto-connect. Kept out of the entry so the boot sequence
 * stays readable.
 */
export function installDevHooks(): void {
  // ★ Rehearsal Video Bridge — временный тестовый хук (Фаза 2: +bridge, Phase 3 удалить)
  (window as any).__testRehearsal = (roomId: string, role: 'teacher' | 'student', ticket: string) => {
    const sc = new SignalingClient(roomId, role, ticket);
    const pc = new PeerConnectionManager(sc, role);
    sc.onOpen = () => {
      if (import.meta.env.DEV) console.log('[test] WS open, role=', role);
      useRehearsalSessionStore.getState().setConnectionState('connected');
    };
    sc.onClose = (code) => {
      useRehearsalSessionStore.getState().setConnectionState(code === 4001 ? 'failed' : 'reconnecting');
    };
    sc.onPeerJoined = (peerRole) => {
      if (import.meta.env.DEV) console.log('[test] peer joined:', peerRole);
      if (role === 'teacher') pc.createDataChannels();
    };
    pc.onConnectionStateChange = (s) => { if (import.meta.env.DEV) console.log('[test] connectionState:', s); };
    pc.onClockSynced = (offset, rtt) => {
      if (import.meta.env.DEV) console.log('[test] clock synced. offset=', offset, 'rtt=', rtt);
      useRehearsalSessionStore.getState().setClockSync(offset, rtt);
    };
    const bridge = new RehearsalTriggerBridge(pc, role);
    sc.connect();
    (window as any).__pc = pc;
    (window as any).__sc = sc;
    (window as any).__bridge = bridge;
    return { sc, pc, bridge };
  };

  // Surface guard — скрыть legacy header если нет профиля
  if (!localStorage.getItem('belive:user-profile')) {
    document.documentElement.classList.add('bl-surface-welcome');
  }

  // ★ Phone connect — автоматическое подключение Student без консоли
  // Используется с docs/phone-connect.html (открыть на телефоне, ввести Room ID)
  // URL: https://app.mybelive.com/?phone=1&room=live-xxxxxxxxxx
  (async () => {
    const params = new URLSearchParams(location.search);
    if (params.get('phone') !== '1') return;
    const roomId = params.get('room');
    if (!roomId) return;
    const secret = 'test-rehearsal-secret-2026';
    try {
      const { signClientTicket } = await import('../Rehearsal/services/deep-link.service');
      const ticket = await signClientTicket(roomId, 'student', secret);
      (window as any).__testRehearsal(roomId, 'student', ticket);
    } catch (e) {
      console.warn('[phone] auto-connect failed:', e);
    }
  })();
}
