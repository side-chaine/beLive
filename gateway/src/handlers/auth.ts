// @TC-103-01: JWT verification middleware (Web Crypto HS256)
// Проверяет подпись, exp, iss. Возвращает authCtx или null.

export interface AuthCtx {
  sub: string;           // "google:<provider_sub>"
  provider: string;      // "google"
  providerSub: string;   // raw Google sub
  roleHint: string;      // ⚠️ NOT FOR AUTHORIZATION — use getUserRole(db, provider, providerSub)
  email?: string;
  name?: string;
  picture?: string;
  exp: number;
}

interface Env {
  JWT_SECRET: string;
}

// ─── Public: verify JWT from Authorization header ───
export async function getAuthCtx(
  request: Request,
  env: Env
): Promise<AuthCtx | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  return verifyJWT(token, env.JWT_SECRET);
}

// ─── Web Crypto HS256 verify ───
export async function verifyJWT(token: string, secret: string): Promise<AuthCtx | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // 1. Verify signature via Web Crypto
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sigBuf = base64UrlDecode(signatureB64);

    const valid = await crypto.subtle.verify('HMAC', key, sigBuf, data);
    if (!valid) return null;

    // 2. Parse payload
    const payloadStr = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadStr);

    // 3. Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    // 4. Check issuer (must be our auth worker)
    if (payload.iss !== 'belive-auth') return null;

    // 5. Resolve role hint (⚠️ NOT FOR AUTHORIZATION — use getUserRole for authz)
    const roleHint = payload.role || 'user';

    return {
      sub: payload.sub,
      provider: payload.provider || 'google',
      providerSub: payload.sub?.replace(/^google:/, '') || payload.sub || '',
      roleHint,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

// ─── base64url → ArrayBuffer (Node Web Crypto compatible) ───
function base64UrlDecode(str: string): ArrayBuffer {
  // Restore standard base64
  const base64 = str
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  // Pad
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binaryStr = atob(padded);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
}
