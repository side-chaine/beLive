// Проверка HS256 JWT для belive-feed-bot.
//
// Тот же контракт, что у `gateway` и `belive-mvsep`: токен подписан общим
// JWT_SECRET, в payload лежит `sub` и `exp`. Отдельный файл — чтобы функцию
// можно было покрыть тестами без импорта всего воркера.

export interface JwtPayload {
  sub: string;
  /** Обязателен: токен без срока жизни — не наш токен. См. проверку ниже. */
  exp: number;
}

/** base64url → байты. Именно base64url: `-` и `_` вместо `+` и `/`. */
function b64urlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {out[i] = bin.charCodeAt(i);}
  return out;
}

function b64urlToJson(input: string): any {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(input)));
}

/**
 * Возвращает payload или null. Никогда не бросает: вызывающий отличает
 * «токен плохой» (401) от «секрет не задан» (503) сам.
 */
export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {return null;}

    const header = b64urlToJson(parts[0]);
    if (header?.alg !== 'HS256') {return null;}

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    // Подпись считается по исходным base64url-строкам, а не по раскодированным
    // байтам: пересборка через JSON дала бы другой результат.
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlToBytes(parts[2]),
      encoder.encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) {return null;}

    const payload = b64urlToJson(parts[1]);
    // exp обязателен, а не «если есть».
    //
    // Было: `typeof payload.exp === 'number' && payload.exp < now` — то есть
    // токен вообще без exp считался вечным и проходил проверку. Единственный
    // минтер (belive-auth) всегда ставит TTL 15 минут, поэтому токен без exp
    // не может быть нашим: это либо самоделка, либо сломанный минтер. В обоих
    // случаях правильный ответ — отказ, а не «живём дальше».
    if (typeof payload?.exp !== 'number') {return null;}
    if (payload.exp < Date.now() / 1000) {return null;}
    if (!payload?.sub) {return null;}

    return { sub: String(payload.sub), exp: payload.exp };
  } catch {
    return null;
  }
}
