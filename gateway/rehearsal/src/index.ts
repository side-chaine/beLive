import { RehearsalRoomDO } from './do/rehearsal-room.do';
import { signTicket } from './tickets';

export { RehearsalRoomDO };

export interface Env {
  REHEARSAL_ROOM: DurableObjectNamespace;
  REHEARSAL_TICKET_SECRET: string;
  JWT_SECRET: string;
}

const TICKET_TTL_MS = 6 * 60 * 60 * 1000;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://app.mybelive.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      const roomId = url.searchParams.get('room');
      if (!roomId) return new Response('Missing room', { status: 400 });
      const id = env.REHEARSAL_ROOM.idFromName(roomId);
      return env.REHEARSAL_ROOM.get(id).fetch(request);
    }

    if (url.pathname === '/rooms' && request.method === 'POST') {
      const userId = await verifyUserJwt(request, env.JWT_SECRET);
      if (!userId) return new Response('Unauthorized', { status: 401, headers: corsHeaders() });

      const roomId = crypto.randomUUID();
      const exp = Date.now() + TICKET_TTL_MS;
      const teacherTicket = await signTicket({ roomId, role: 'teacher', exp }, env.REHEARSAL_TICKET_SECRET);
      const studentTicket = await signTicket({ roomId, role: 'student', exp }, env.REHEARSAL_TICKET_SECRET);
      return Response.json({ roomId, teacherTicket, studentTicket, expiresAt: exp }, { headers: corsHeaders() });
    }

    return new Response('Not found', { status: 404 });
  },
};

async function verifyUserJwt(request: Request, secret: string): Promise<string | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const [headerB64, payloadB64, sigB64] = token.split('.');
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(`${headerB64}.${payloadB64}`));
  if (!valid) return null;

  let payloadBase64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
  while (payloadBase64.length % 4) payloadBase64 += '=';  // atob() кидает InvalidCharacterError без паддинга
  const payloadBytes = Uint8Array.from(atob(payloadBase64), (c) => c.charCodeAt(0));
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes)); // TextDecoder — на случай не-ASCII полей
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;
  return payload.sub ?? null;
}
// force redeploy 2026-07-14
