import { verifyTicket } from '../tickets';

export interface Env {
  REHEARSAL_TICKET_SECRET: string;
}

interface Peer { role: 'teacher' | 'student'; ws: WebSocket; }

export class RehearsalRoomDO {
  peers = new Map<'teacher' | 'student', Peer>();
  env: Env;
  constructor(_state: DurableObjectState, env: Env) { this.env = env; }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    const url = new URL(request.url);
    const roomId = url.searchParams.get('room');
    const role = url.searchParams.get('role') as 'teacher' | 'student' | null;
    const ticket = url.searchParams.get('ticket');
    if (!roomId || !role || !ticket) return new Response('Missing params', { status: 400 });

    const claims = await verifyTicket(ticket, this.env.REHEARSAL_TICKET_SECRET);
    if (!claims || claims.roomId !== roomId || claims.role !== role) {
      return new Response('Invalid or expired ticket', { status: 401 });
    }

    if (this.peers.has(role)) {
      this.peers.get(role)!.ws.close(4001, 'replaced-by-new-connection');
      this.peers.delete(role);
    }
    if (this.peers.size >= 2) return new Response('Room full', { status: 429 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.peers.set(role, { role, ws: server });
    this.broadcast(role, JSON.stringify({ type: 'peer-joined', role }));

    server.addEventListener('message', (event) => {
      const raw = event.data;
      if (typeof raw !== 'string' || raw.length > 16384) return;
      this.relay(role, raw);
    });
    const cleanup = () => {
      this.peers.delete(role);
      this.broadcast(role, JSON.stringify({ type: 'peer-left', role }));
    };
    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }

  private relay(fromRole: string, raw: string) {
    for (const [role, peer] of this.peers) if (role !== fromRole) peer.ws.send(raw);
  }
  private broadcast(excludeRole: string, raw: string) {
    for (const [role, peer] of this.peers) if (role !== excludeRole) peer.ws.send(raw);
  }
}
