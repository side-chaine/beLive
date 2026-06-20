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
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://app.mybelive.com',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
        }
      });
    }

    // ── GET /tracks (API) + /download/<file_id> + health ──
    if (request.method === 'GET') {
      const url = new URL(request.url);

      if (url.pathname === '/tracks') {
        const catalog: any[] = (await env.EPHEMERAL_KV.get('track_data:catalog', { type: 'json' }) as any) || [];
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
      const origin = request.headers.get('Origin') || '';
      if (!origin.includes('app.mybelive.com') && !origin.includes('localhost')) {
        return new Response('Forbidden', { status: 403 });
      }

      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof File)) {
        return new Response('Missing file', { status: 400 });
      }

      const tgForm = new FormData();
      tgForm.append('chat_id', env.UPLOAD_CHAT_ID);
      tgForm.append('document', file, file.name);

      const tgRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: tgForm,
      });

      if (!tgRes.ok) {
        const errText = await tgRes.text();
        console.error('[upload] TG error:', errText);
        return new Response('Upload failed', { status: 502 });
      }

      const tgData: any = await tgRes.json();
      const fileId = tgData?.result?.document?.file_id;

      if (!fileId) {
        return new Response('No file_id returned', { status: 502 });
      }

      return new Response(JSON.stringify({ fileId }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'https://app.mybelive.com',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
