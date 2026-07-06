const encoder = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export interface TicketPayload {
  roomId: string;
  role: 'teacher' | 'student';
  exp: number;
}

export async function signTicket(payload: TicketPayload, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const body = btoa(JSON.stringify(payload));
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return `${body}.${sig}`;
}

export async function verifyTicket(ticket: string, secret: string): Promise<TicketPayload | null> {
  const [body, sig] = ticket.split('.');
  if (!body || !sig) return null;
  const key = await hmacKey(secret);
  let sigBuf: Uint8Array;
  try { sigBuf = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0)); } catch { return null; }
  const valid = await crypto.subtle.verify('HMAC', key, sigBuf, encoder.encode(body));
  if (!valid) return null;
  try {
    const payload = JSON.parse(atob(body)) as TicketPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}
