type SignalingMessage =
  | { type: 'sdp'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; candidate: RTCIceCandidateInit }
  | { type: 'peer-joined'; role: string }
  | { type: 'peer-left'; role: string };

export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempt = 0;
  private closedByUser = false;

  onSDP: ((sdp: RTCSessionDescriptionInit) => void) | null = null;
  onICE: ((candidate: RTCIceCandidateInit) => void) | null = null;
  onPeerJoined: ((role: string) => void) | null = null;
  onPeerLeft: ((role: string) => void) | null = null;
  onOpen: (() => void) | null = null;

  constructor(roomId: string, role: 'teacher' | 'student', ticket: string) {
    const base = import.meta.env.VITE_REHEARSAL_SIGNALING_URL as string | undefined;
    if (!base) throw new Error('VITE_REHEARSAL_SIGNALING_URL is not set');
    this.url = `${base}?room=${encodeURIComponent(roomId)}&role=${role}&ticket=${encodeURIComponent(ticket)}`;
  }

  connect() {
    this.closedByUser = false;
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener('open', () => { this.reconnectAttempt = 0; this.onOpen?.(); });
    this.ws.addEventListener('message', (event) => {
      let msg: SignalingMessage;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === 'sdp') this.onSDP?.(msg.sdp);
      else if (msg.type === 'ice') this.onICE?.(msg.candidate);
      else if (msg.type === 'peer-joined') this.onPeerJoined?.(msg.role);
      else if (msg.type === 'peer-left') this.onPeerLeft?.(msg.role);
    });
    this.ws.addEventListener('close', (event) => {
      if (this.closedByUser) return;
      if (event.code === 4001) return;
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect() {
    this.reconnectAttempt++;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 15000);
    setTimeout(() => { if (!this.closedByUser) this.connect(); }, delay);
  }

  sendSDP(sdp: RTCSessionDescriptionInit) { this.ws?.send(JSON.stringify({ type: 'sdp', sdp })); }
  sendICE(candidate: RTCIceCandidateInit) { this.ws?.send(JSON.stringify({ type: 'ice', candidate })); }
  leaveRoom() { this.closedByUser = true; this.ws?.close(); }
}
