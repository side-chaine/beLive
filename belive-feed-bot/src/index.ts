// @TC-089: Telegram Bot Webhook — belive-feed-bot
// Phase 2.1: /catalog, /track, /start, /cancel, /download, upload ZIP

import { sendMessage, answerCallbackQuery, getFile, fileUrl } from './tg';
import { isAllowedUser, getUserId } from './auth';
import { verifyJwt } from './jwt';
import { corsHeaders, isAllowedOrigin, parseAllowedOrigins } from './cors';
import { getDraft, clearDraft } from './state-machine';
import {
  cmdStart, cmdCancel, cmdCatalog, cmdTrack,
  cmdUploadDoc, cmdUploadType,
} from './commands';
import { getTrackBySlug, TRACKS } from './data/tracks';

interface Env {
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  ALLOWED_TG_IDS: string;
  EPHEMERAL_KV: KVNamespace;
  UPLOAD_CHAT_ID: string;
  JWT_SECRET: string;
  /**
   * Необязательный список точных origin'ов через запятую (LAN-телефон и т.п.).
   *
   * Единственная переменная про origin'ы, которую этот воркер читает.
   * Рядом раньше была объявлена `ALLOWED_ORIGIN` (единственное число) — она
   * лежала в `wrangler.toml`, попадала в прод и НЕ ЧИТАЛАСЬ НИГДЕ: прод-origin
   * зашит в `cors.ts` константой `PROD_ORIGIN`. Две переменные с почти
   * одинаковыми именами, из которых работает одна, — приглашение к ошибке
   * «поменял настройку, ничего не изменилось». Убрана 02.11.2026.
   */
  ALLOWED_ORIGINS?: string;
}

/**
 * Потолок размера загружаемого ZIP.
 *
 * 50 МБ — это лимит Telegram Bot API на документ, выше него TG всё равно
 * откажет. Значение одно на оба гейта ниже: раньше оно было вписано числом
 * только в проверке Content-Length, а второй гейт отсутствовал вовсе.
 */
export const MAX_UPLOAD_BYTES = 52_428_800;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const reqOrigin = request.headers.get('Origin') || '';
    // CORS — из одного хелпера (src/cors.ts). Раньше здесь было замыкание с
    // `origin.startsWith('http://192.168.')`, а на /upload — второй, отдельный
    // набор заголовков с фиксированным origin. Два места → две разные дыры.
    const corsHdr = corsHeaders(reqOrigin, parseAllowedOrigins(env.ALLOWED_ORIGINS));
    // ── CORS preflight ──
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHdr });
    }

    // ── GET /tracks (API) + /download/<file_id> + health ──
    if (request.method === 'GET') {
      const url = new URL(request.url);

      // Каталог и стемы закрыты входом.
      //
      // До этого /tracks отдавал кому угодно полный список треков вместе с
      // Telegram file_id, а /download/<file_id> по этому id отдавал сам файл.
      // То есть каталог был не «утечкой», а открытой раздачей: любой скрипт
      // в интернете получал индекс и качал по нему стемы без учётной записи.
      // Закрываем оба маршрута тем же JWT, что уже стоит на /upload.
      const protectedPath = url.pathname === '/tracks' || url.pathname.startsWith('/download/');
      if (protectedPath) {
        if (!env.JWT_SECRET) {
          console.error('[catalog] JWT_SECRET не задан — каталог закрыт');
          return new Response('Server misconfigured', { status: 503, headers: corsHdr });
        }
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
          return new Response('Unauthorized', { status: 401, headers: corsHdr });
        }
        const auth = await verifyJwt(authHeader.slice('Bearer '.length), env.JWT_SECRET);
        if (!auth) {
          return new Response('Unauthorized', { status: 401, headers: corsHdr });
        }
      }

      if (url.pathname === "/tracks") {
        const trackList = await env.EPHEMERAL_KV.list({ prefix: "track_data:t:", limit: 200 });
        const entries = await Promise.all(trackList.keys.map((k) => env.EPHEMERAL_KV.get(k.name, { type: "json" })));
        const tTracks: any[] = entries.filter(Boolean);
        let rawCatalog: any = null;
        try { rawCatalog = await env.EPHEMERAL_KV.get('track_data:catalog', { type: 'json' }); } catch { rawCatalog = null; }
        const cTracks: any[] = Array.isArray(rawCatalog) ? rawCatalog : [];
        const kvTracks: any[] = [...tTracks, ...cTracks];
        const hardTracks: any[] = TRACKS.map((t: any) => ({ id: t.id, title: t.title, artist: t.artist, slug: t.slug, album: t.album, year: t.year, fileName: t.fileName, fileIds: {}, type: undefined }));
        const normSlug = (s: string) => (s || '').toLowerCase().replace(/[-_]/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
        const knownArtists = [...new Set(hardTracks.map((t: any) => (t.artist || '').toLowerCase().trim()).filter(Boolean))];
        const titleCore = (t: any) => {
          let s = (t.title || '').toLowerCase().trim();
          const art = (t.artist || '').toLowerCase().trim();
          const strip = (a: string) => { if (a && s.startsWith(a)) s = s.slice(a.length).replace(/^[\s\-–—:]+/, ''); };
          if (art) strip(art);
          else for (const ka of knownArtists) { const before = s; strip(ka); if (s !== before) break; }
          return s.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
        };
        const bySlug = new Map<string, any>();
        const byTitle = new Map<string, any>();
        for (const t of hardTracks) { const ks = normSlug(t.slug), kt = titleCore(t); bySlug.set(ks, t); byTitle.set(kt, t); }
        for (const t of kvTracks) {
          if (!t || typeof t !== 'object') continue;
          const ks = normSlug(t.slug), kt = titleCore(t);
          const hit = bySlug.get(ks) || byTitle.get(kt);
          if (hit) { hit.fileIds = { ...(hit.fileIds || {}), ...(t.fileIds || {}) }; if (t.type) hit.type = t.type; if (t.fileName) hit.fileName = t.fileName; }
          else { bySlug.set(ks, t); byTitle.set(kt, t); }
        }
        const catalog = Array.from(bySlug.values()).sort((a: any, b: any) => (a.title || '').localeCompare(b.title || ''));
        return new Response(JSON.stringify({ updatedAt: Date.now(), total: catalog.length, tracks: catalog }), {
          headers: { 'Content-Type': 'application/json', ...corsHdr }
        });
      }

      if (url.pathname.startsWith("/download/")) {
        const fileId = url.pathname.replace("/download/", "");
        if (!fileId) return new Response("Missing file_id", { status: 400, headers: corsHdr });
        const tgFile = await getFile(env.BOT_TOKEN, fileId);
        if (!tgFile.file_path) {
          // Раньше здесь был голый 404 "File not found" на ЛЮБУЮ ошибку
          // Telegram: неверный BOT_TOKEN, удалённый файл, файл больше 20 МБ
          // (официальный предел Bot API на скачивание) — всё выглядело как
          // «файла нет». Отладить по такому ответу нельзя, поэтому отдаём
          // настоящую причину и код.
          const detail = tgFile.description || "Telegram не вернул file_path";
          const code = tgFile.error_code ?? null;
          console.error(`[download] getFile без file_path: code=${code ?? "—"} desc=${detail}`);

          const tooBig = /too big|too large/i.test(detail);
          const notFound = /not found|invalid file_id|wrong file/i.test(detail);
          const status = tooBig ? 413 : notFound ? 404 : 502;
          return new Response(JSON.stringify({
            error: tooBig ? "FILE_TOO_LARGE_FOR_BOT_API"
                 : notFound ? "TG_FILE_NOT_FOUND"
                 : "TG_GETFILE_FAILED",
            detail,
            tg_error_code: code,
          }), {
            status,
            headers: { "Content-Type": "application/json", ...corsHdr },
          });
        }
        const fileRes = await fetch(fileUrl(env.BOT_TOKEN, tgFile.file_path));
        if (!fileRes.ok) return new Response("Download failed", { status: 502, headers: corsHdr });
        return new Response(fileRes.body, {
          headers: {
            "Content-Disposition": "attachment",
            "Content-Type": fileRes.headers.get("Content-Type") || "application/octet-stream",
            ...corsHdr
          }
        });
      }

      return new Response('OK', { status: 200 });
    }

    // ── POST /upload (from beLive client — battle vocals ZIP) ──
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname === '/upload') {
      // Origin проверяется тем же хелпером, что и GET-маршруты. Раньше здесь
      // стоял свой список плюс `startsWith('http://192.168.')`, а заголовки
      // ответа — фиксированные, поэтому /upload и GET расходились поведением.
      const origin = request.headers.get('Origin') || '';
      if (!isAllowedOrigin(origin, parseAllowedOrigins(env.ALLOWED_ORIGINS))) {
        return new Response('Forbidden', { status: 403, headers: corsHdr });
      }

      // A3: Content-Length check ДО formData (heap protection)
      const contentLength = request.headers.get('Content-Length');
      if (contentLength && parseInt(contentLength) > MAX_UPLOAD_BYTES) {
        return new Response('Payload Too Large', { status: 413, headers: corsHdr });
      }

      // A4: JWT — тот же HS256, что у gateway и belive-mvsep.
      //
      // Раньше здесь был общий статический ключ в заголовке X-API-Key. Он не
      // давал защиты: значение захардкожено в клиенте
      // (src/services/tg-upload.service.ts), то есть лежало в публичном
      // бандле и в публичном репозитории. Любой мог залить ZIP, который
      // уходил в наш Telegram и появлялся в каталоге через GET /tracks.
      // Статический ключ в публичном клиенте — не аутентификация.
      if (!env.JWT_SECRET) {
        // Fail closed: без секрета проверить токен нечем, а принимать всех
        // подряд нельзя. Лучше явная ошибка, чем открытая дверь.
        console.error('[upload] JWT_SECRET не задан — /upload закрыт');
        return new Response('Server misconfigured', { status: 503, headers: corsHdr });
      }
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401, headers: corsHdr });
      }
      const auth = await verifyJwt(authHeader.slice('Bearer '.length), env.JWT_SECRET);
      if (!auth) {
        return new Response('Unauthorized', { status: 401, headers: corsHdr });
      }

      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof File)) {
        return new Response('Missing file', { status: 400, headers: corsHdr });
      }

      // A3-b: размер ФАКТИЧЕСКОГО файла, а не заголовка.
      //
      // Проверка Content-Length выше срабатывает только если заголовок есть.
      // Chunked-запрос (Transfer-Encoding: chunked) приходит без него — и
      // тогда ZIP любого размера проходил мимо лимита целиком: сначала в
      // память изолята через formData(), потом в Telegram. На Free-плане
      // память изолята 128 МБ, то есть это ещё и способ уронить воркер.
      //
      // Гейт стоит ДО чтения magic bytes: незачем разбирать содержимое того,
      // что всё равно не примем.
      if (file.size > MAX_UPLOAD_BYTES) {
        return new Response(
          `File too large — max ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
          { status: 413, headers: corsHdr },
        );
      }

      // A5: Server-side file type validation — ZIP magic bytes
      const zipHeader = await file.slice(0, 4).arrayBuffer();
      const magicBytes = new Uint8Array(zipHeader);
      const isZip = magicBytes[0] === 0x50 && magicBytes[1] === 0x4B &&
                    (magicBytes[2] === 0x03 || magicBytes[2] === 0x05) &&
                    magicBytes[3] === 0x04;
      if (!isZip) {
        return new Response('Invalid file type — ZIP only', { status: 415, headers: corsHdr });
      }

      // A6: Filename sanitize
      const sanitizeName = (name: string) =>
        name.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 64);
      const safeFileName = sanitizeName(file.name);

      // A7: Отправка в Telegram
      const tgForm = new FormData();
      tgForm.append('chat_id', env.UPLOAD_CHAT_ID);
      tgForm.append('document', file, safeFileName);

      const controller = new AbortController();
      const tgTimeout = setTimeout(() => controller.abort(), 8000);

      let tgRes: Response;
      try {
        tgRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendDocument`, {
          method: 'POST',
          body: tgForm,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(tgTimeout);
        return new Response('Upload failed — TG timeout', { status: 502, headers: corsHdr });
      }
      clearTimeout(tgTimeout);

      if (!tgRes.ok) {
        // A8: Retry on 429
        if (tgRes.status === 429) {
          try {
            const retryAfter = parseInt(tgRes.headers.get('Retry-After') || '5') * 1000;
            await new Promise(r => setTimeout(r, Math.min(retryAfter, 5000)));
            tgRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendDocument`, {
              method: 'POST', body: tgForm,
            });
          } catch {
            return new Response('Upload failed', { status: 502, headers: corsHdr });
          }
        }
        if (!tgRes.ok) {
          return new Response('Upload failed', { status: 502, headers: corsHdr });
        }
      }

      const tgData: any = await tgRes.json();
      const fileId = tgData?.result?.document?.file_id;
      if (!fileId) {
        return new Response('No file_id returned', { status: 502, headers: corsHdr });
      }

      // A9: Catalog write with dedup by slug+contentHash
      const artist = (formData.get('artist') as string) || 'Unknown Artist';
      const title = (formData.get('title') as string) || 'Unknown Title';
      const stemType = (formData.get('stemType') as string) || 'full';
      const contentHash = (formData.get('contentHash') as string) || '';
      
      // Build slug with stemType (dedup unit)
      const rawSlug = `${artist}-${title}-${stemType}`;
      const slug = rawSlug.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .replace(/-+/g, '-') || `t-${Date.now()}`;

      let catalogWriteOk = false;
      let trackEntry = null;
      try {
        // Find existing entry by slug
        const trackList = await env.EPHEMERAL_KV.list({ prefix: 'track_data:t:', limit: 200 });
        let existingKey = '';
        for (const key of trackList.keys) {
          const entry: any = await env.EPHEMERAL_KV.get(key.name, { type: 'json' });
          if (entry?.slug === slug) { existingKey = key.name; break; }
        }

        // If found with same contentHash → skip (already published)
        if (existingKey && contentHash) {
          const existing: any = await env.EPHEMERAL_KV.get(existingKey, { type: 'json' });
          if (existing?.contentHash === contentHash) {
            return new Response(JSON.stringify({
              success: true, duplicate: true, slug,
              fileId, id: existing.id,
            }), { headers: { 'Content-Type': 'application/json', ...corsHdr } });
          }
          // Content changed — overwrite existing entry
          trackEntry = {
            ...existing,
            fileIds: { ...existing.fileIds, [stemType]: fileId },
            contentHash,
            updatedAt: Date.now(),
          };
          await env.EPHEMERAL_KV.put(existingKey, JSON.stringify(trackEntry));
        } else {
          // New entry
          const trackId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
          trackEntry = {
            id: `usr-${trackId}`,
            title, artist, slug,
            type: stemType,
            fileIds: { [stemType]: fileId },
            fileSize: file.size,
            fileName: safeFileName,
            contentHash: contentHash || undefined,
            createdAt: Date.now(),
          };
          await env.EPHEMERAL_KV.put(`track_data:t:${trackId}`, JSON.stringify(trackEntry));
        }
        catalogWriteOk = true;
      } catch (kvErr) {
        console.error('[upload] KV write failed:', kvErr);
        try {
          await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: env.UPLOAD_CHAT_ID,
              message_id: tgData?.result?.message_id,
            }),
          });
        } catch { /* best-effort cleanup */ }
      }

      return new Response(JSON.stringify({
        success: catalogWriteOk,
        fileId,
        slug: trackEntry?.slug || slug,
        id: trackEntry?.id || null,
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHdr,
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const contentLength = request.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength) > 1024 * 1024) {
      return new Response('Payload Too Large', { status: 413 });
    }

    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!secret) {
      console.log('[bot] Missing WEBHOOK_SECRET header');
      return new Response('Unauthorized', { status: 401 });
    }
    const encoder = new TextEncoder();
    const secretBytes = encoder.encode(secret);
    const expectedBytes = encoder.encode(env.WEBHOOK_SECRET || '');
    if (secretBytes.length !== expectedBytes.length ||
        !(crypto.subtle as any).timingSafeEqual(secretBytes, expectedBytes)) {
      console.log('[bot] WEBHOOK_SECRET mismatch');
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const update: any = await request.json();

      // ── CALLBACK QUERY ──
      if (update.callback_query) {
        const cb = update.callback_query;
        const cbData = cb.data || '';

        if (!isAllowedUser({ from: cb.from }, env.ALLOWED_TG_IDS)) {
          await answerCallbackQuery(env.BOT_TOKEN, cb.id, '⛔ Нет доступа.');
          return new Response('OK');
        }

        await answerCallbackQuery(env.BOT_TOKEN, cb.id);

        if (cbData.startsWith('catalog_')) {
          const page = Math.max(1, parseInt(cbData.replace('catalog_', '')) || 1);
          const cbChatId = cb.message?.chat?.id ?? cb.from?.id;
          const cbCtx = {
            token: env.BOT_TOKEN, env,
            msg: cb.message ?? { from: cb.from, chat: { id: cbChatId } },
            chatId: cbChatId, userId: cb.from?.id ?? 0,
            text: `/catalog ${page}`,
          };
          await cmdCatalog(cbCtx);

        } else if (cbData.startsWith('upload_')) {
          const trackType = cbData.replace('upload_', '');
          const uCtx = {
            token: env.BOT_TOKEN, env,
            msg: cb.message ?? { from: cb.from },
            chatId: cb.message?.chat?.id ?? cb.from?.id,
            userId: cb.from?.id ?? 0,
            text: trackType,
          };
          await cmdUploadType(uCtx);
        }
        return new Response('OK');
      }

      const msg = update.message;
      if (!msg) return new Response('OK');

      const chatId = msg.chat.id;
      const userId = getUserId(msg);
      const text = (msg.text || '').trim();

      if (!isAllowedUser(msg, env.ALLOWED_TG_IDS)) {
        return new Response('OK');
      }

      const ctx = { token: env.BOT_TOKEN, env, msg, chatId, userId, text };

      // ── ДОКУМЕНТ (ZIP от админа) ──
      if (msg.document) {
        await cmdUploadDoc(ctx);
        return new Response('OK');
      }

      // ── ФОТО (если draft active, игнор для MVP) ──
      if (msg.photo) {
        const draft = await getDraft(env.EPHEMERAL_KV, userId);
        if (draft && draft.step !== 'idle' && draft.step !== 'done') {
          await sendMessage(env.BOT_TOKEN, chatId, 'ℹ️ Используй /cancel для отмены.');
        }
        return new Response('OK');
      }

      // ── ТЕКСТОВЫЕ КОМАНДЫ ──
      if (text.startsWith('/start')) {
        await cmdStart(ctx);
      } else if (text.startsWith('/cancel')) {
        await cmdCancel(ctx);
      } else if (text.startsWith('/track_')) {
        const slug = text.replace('/track_', '');
        const track = getTrackBySlug(slug);
        if (track) {
          await cmdTrack({ ...ctx, text: `/track ${track.title}` });
        } else {
          await sendMessage(env.BOT_TOKEN, chatId, '❌ Трек не найден.');
        }
      } else if (text.startsWith('/track')) {
        await cmdTrack(ctx);
      } else if (text.startsWith('/catalog')) {
        await cmdCatalog(ctx);
      } else {
        const draft = await getDraft(env.EPHEMERAL_KV, userId);
        if (draft && draft.step !== 'idle' && draft.step !== 'done') {
          await sendMessage(env.BOT_TOKEN, chatId, 'ℹ️ Используй /cancel для отмены.');
        } else {
          await sendMessage(env.BOT_TOKEN, chatId, 'ℹ️ Неизвестная команда. /start — помощь.');
        }
      }

      return new Response('OK');
    } catch (err) {
      console.error('[bot] Unhandled error:', err);
      return new Response('OK');
    }
  },
};

// deploy-20260627-0115
