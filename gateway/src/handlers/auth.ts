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
    //
    // exp ОБЯЗАТЕЛЕН, а не «если есть». Было `if (payload.exp && ...)`:
    // токен без срока жизни проходил как вечный — тот же класс дыры, что
    // закрыт в belive-feed-bot/src/jwt.ts и belive-mvsep/index.js.
    // Минтер один — belive-auth — и он всегда ставит TTL, поэтому токен
    // без exp не наш.
    if (typeof payload.exp !== 'number') return null;
    if (Date.now() / 1000 > payload.exp) return null;

    // 4. Check issuer (must be our auth worker)
    if (payload.iss !== 'belive-auth') return null;

    // 5. sub обязателен: без него authCtx.sub = undefined, а на нём держится
    //    вся авторизация записи (author_id === auth.sub в feed.ts).
    if (!payload.sub) return null;

    // 6. Resolve role hint (⚠️ NOT FOR AUTHORIZATION — use getUserRole for authz)
    const roleHint = payload.role || 'user';

    return {
      sub: String(payload.sub),
      provider: payload.provider || 'google',
      providerSub: String(payload.sub).replace(/^google:/, ''),
      roleHint,
      email: payload.email,
      name: payload.name,
      picture: payload.picture || payload.avatar,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

// ─── base64url → байты ───
//
// Возвращаем именно Uint8Array (view), а не `bytes.buffer`.
//
// Почему это не косметика: `crypto.subtle.verify` принимает BufferSource и
// проверяет аргумент на принадлежность к своему realm. В jsdom голый
// ArrayBuffer из realm Node не проходит `instanceof ArrayBuffer` — verify
// бросает TypeError, `catch` ниже глотает его и функция возвращает null.
// То есть на Node 20 любой ВАЛИДНЫЙ токен выглядел как невалидный. Ровно это
// и краснело в CI на gateway/test.
//
// `ArrayBuffer.isView` работает кросс-realm, поэтому view проходит проверку
// и в jsdom, и в Workers. В belive-feed-bot/src/jwt.ts та же функция с самого
// начала возвращает view — и те же тесты там зелёные.
//
// ⚠️ Экспортируется ТОЛЬКО ради теста типа. Поведенческий тест verifyJWT эту
// регрессию ловит не всегда: 02.11.2026 откат на голый `.buffer` краснил тесты
// только в jsdom на Node 20, а на Node 22, Node 24 и в environment: 'node'
// проходил зелёным. Явная проверка `toBeInstanceOf(Uint8Array)` краснеет во
// всех комбинациях — она и держит охрану.
export function base64UrlDecode(str: string): Uint8Array {
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
  return bytes;
}
