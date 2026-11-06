// CORS для belive-feed-bot — единственное место, где решается «кому можно».
//
// Зачем отдельный файл. До 02.11.2026 логика CORS жила в двух местах одного
// воркера и вела себя по-разному: GET-маршруты и префлайт отражали origin
// через замыкание `corsHeaders(origin)`, а /upload ставил фиксированный
// `https://app.mybelive.com`. Из-за этого одна и та же дыра существовала
// только на половине маршрутов, а починить её надо было дважды.
//
// Сама дыра: `origin.startsWith('http://192.168.')`. Проверка префикса, а не
// хоста. `http://192.168.1.evil.com` начинается с этой строки и получал
// отражённый `Access-Control-Allow-Origin` — то есть любой сайт, который
// резолвится в такой адрес, читал ответы воркера от имени пользователя.
//
// Правило теперь одно: origin сравнивается ЦЕЛИКОМ. Либо он в точном списке,
// либо совпадает с якорной регуляркой превью-домена, либо его явно добавили
// в ALLOWED_ORIGINS. Никаких префиксов.

/** Прод-фронтенд. Он же — ответ по умолчанию для неразрешённых origin. */
export const PROD_ORIGIN = 'https://app.mybelive.com';

/**
 * Локальная разработка. Точные строки, включая порт: `localhost.evil.com`
 * сюда не попадает, потому что это не `localhost:5173`.
 */
const DEV_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://0.0.0.0:5173',
]);

/**
 * Превью-деплои Cloudflare Pages: `<branch>.<project>.pages.dev`.
 *
 * Якоря `^`/`$` обязательны: без них `https://x1y2.belive-dul.pages.dev.evil.com`
 * проходит проверку и получает отражение — тот же класс ошибки, что и с
 * префиксом у 192.168.
 */
const PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.belive-dul\.pages\.dev$/;

/**
 * Разрешён ли origin.
 *
 * @param origin заголовок Origin как есть
 * @param extra  дополнительные точные origin'ы из env.ALLOWED_ORIGINS.
 *               Здесь же живёт LAN-адрес телефона при отладке — но только
 *               если его туда положили руками. В коде прода LAN нет:
 *               для телефона есть превью-домены.
 */
export function isAllowedOrigin(origin: string, extra: string[] = []): boolean {
  if (!origin) return false;
  if (origin === PROD_ORIGIN) return true;
  if (DEV_ORIGINS.has(origin)) return true;
  if (PREVIEW_RE.test(origin)) return true;
  return extra.includes(origin);
}

/** Список из `ALLOWED_ORIGINS` (через запятую). Пустая строка → пусто. */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Заголовки CORS для ответа.
 *
 * Для разрешённого origin — отражение (клиенту нужен именно его origin).
 * Для остальных — прод-origin: браузер такой ответ не отдаст странице, но
 * заголовок остаётся валидным для остальных клиентов.
 *
 * `Vary: Origin` обязателен: без него CDN может закешировать ответ с
 * отражением одного origin и отдать его другому.
 */
export function corsHeaders(origin: string, extra: string[] = []) {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin, extra) ? origin : PROD_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}
