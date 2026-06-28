// @TC-089: Telegram Bot Webhook — belive-feed-bot
// Phase 2.1: /catalog, /track, /start, /cancel, /download, upload ZIP

import { sendMessage, answerCallbackQuery, getFile, fileUrl } from './tg';
import { isAllowedUser, getUserId } from './auth';
import { getDraft, clearDraft } from './state-machine';
import {
  cmdStart, cmdCancel, cmdCatalog, cmdTrack,
  cmdUploadDoc, cmdUploadType,
} from './commands';
import { getTrackBySlug } from './data/tracks';

interface Env {
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  ALLOWED_TG_IDS: string;
  EPHEMERAL_KV: KVNamespace;
  UPLOAD_CHAT_ID: string;
  UPLOAD_API_KEY_SECRET: string;
  ALLOWED_ORIGIN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      const reqOrigin = request.headers.get('Origin') || '';
      const allowedOrigin = ['https://app.mybelive.com', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://0.0.0.0:5173']
        .find(o => reqOrigin.startsWith('http://192.168.') ? true : o === reqOrigin) ? reqOrigin : 'https://app.mybelive.com';
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
        }
      });
    }

    // ── GET /tracks (API) + /download/<file_id> + health ──
    if (request.method === 'GET') {
      const url = new URL(request.url);

      if (url.pathname === '/tracks') {
        // Build catalog from per-track records (race-free append-only)
        const trackList = await env.EPHEMERAL_KV.list({ prefix: 'track_data:t:', limit: 200 });
        const entries = await Promise.all(
          trackList.keys.map(k => env.EPHEMERAL_KV.get(k.name, { type: 'json' }))
        );
        const catalog = entries.filter(Boolean).sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
        return new Response(JSON.stringify({
          updatedAt: Date.now(),
          total: catalog.length,
          tracks: catalog
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://app.mybelive.com',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
          }
        });
      }

      if (url.pathname.startsWith('/download/')) {
        const fileId = url.pathname.replace('/download/', '');
        if (!fileId) return new Response('Missing file_id', { status: 400 });
        const tgFile = await getFile(env.BOT_TOKEN, fileId);
        if (!tgFile.file_path) return new Response('File not found', { status: 404 });
        const fileRes = await fetch(fileUrl(env.BOT_TOKEN, tgFile.file_path));
        if (!fileRes.ok) return new Response('Download failed', { status: 502 });
        return new Response(fileRes.body, {
          headers: {
            'Content-Disposition': 'attachment',
            'Content-Type': fileRes.headers.get('Content-Type') || 'application/octet-stream',
            'Access-Control-Allow-Origin': 'https://app.mybelive.com',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
          }
        });
      }

      return new Response('OK', { status: 200 });
    }

    // ── POST /upload (from beLive client — battle vocals ZIP) ──
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname === '/upload') {
      // A1: CORS headers для всех ответов
      const corsHeaders = {
        'Access-Control-Allow-Origin': 'https://app.mybelive.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      };

      // A2: Strict origin check (=== не includes!)
      const origin = request.headers.get('Origin') || '';
      const allowedDev = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://0.0.0.0:5173'];
      if (origin !== 'https://app.mybelive.com' && !allowedDev.includes(origin) && !origin.startsWith('http://192.168.')) {
        return new Response('Forbidden', { status: 403, headers: corsHeaders });
      }

      // A3: Content-Length check ДО formData (heap protection)
      const contentLength = request.headers.get('Content-Length');
      if (contentLength && parseInt(contentLength) > 52_428_800) { // 50MB (TG limit)
        return new Response('Payload Too Large', { status: 413, headers: corsHeaders });
      }

      // A4: X-API-Key check
      const apiKey = request.headers.get('X-API-Key');
      if (!apiKey) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }
      const encoder = new TextEncoder();
      const apiKeyBytes = encoder.encode(apiKey);
      const expectedKeyBytes = encoder.encode(env.UPLOAD_API_KEY_SECRET || 'belive2026');
      if (apiKeyBytes.length !== expectedKeyBytes.length ||
          !(crypto.subtle as any).timingSafeEqual(apiKeyBytes, expectedKeyBytes)) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }

      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof File)) {
        return new Response('Missing file', { status: 400, headers: corsHeaders });
      }

      // A5: Server-side file type validation — ZIP magic bytes
      const zipHeader = await file.slice(0, 4).arrayBuffer();
      const magicBytes = new Uint8Array(zipHeader);
      const isZip = magicBytes[0] === 0x50 && magicBytes[1] === 0x4B &&
                    (magicBytes[2] === 0x03 || magicBytes[2] === 0x05) &&
                    magicBytes[3] === 0x04;
      if (!isZip) {
        return new Response('Invalid file type — ZIP only', { status: 415, headers: corsHeaders });
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
        return new Response('Upload failed — TG timeout', { status: 502, headers: corsHeaders });
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
            return new Response('Upload failed', { status: 502, headers: corsHeaders });
          }
        }
        if (!tgRes.ok) {
          return new Response('Upload failed', { status: 502, headers: corsHeaders });
        }
      }

      const tgData: any = await tgRes.json();
      const fileId = tgData?.result?.document?.file_id;
      if (!fileId) {
        return new Response('No file_id returned', { status: 502, headers: corsHeaders });
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
            }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
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
          ...corsHeaders,
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
