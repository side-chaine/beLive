// @TC-088: Command handlers для Telegram бота

import { sendMessage } from './tg';
import { getDraft, setDraft, clearDraft, newDraft, type DraftState } from './state-machine';
import { isAllowedUser } from './auth';
import { getTracksPage, findTrack, TRACKS_PER_PAGE } from './data/tracks';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

interface CmdCtx {
  token: string;
  env: any;
  msg: any;
  chatId: number;
  userId: number;
  text: string;
}

// --- /cancel — сброс стейт-машины (Замок 2) ---
export async function cmdCancel(ctx: CmdCtx): Promise<boolean> {
  if (!isAllowedUser(ctx.msg, ctx.env.ALLOWED_TG_IDS)) return false;
  await clearDraft(ctx.env.EPHEMERAL_KV, ctx.userId);
  await sendMessage(ctx.token, ctx.chatId, '❌ Создание отменено. Черновик удалён.');
  return true;
}

// --- /new_event — запуск стейт-машины ---
export async function cmdNewEvent(ctx: CmdCtx): Promise<boolean> {
  if (!isAllowedUser(ctx.msg, ctx.env.ALLOWED_TG_IDS)) return false;
  await setDraft(ctx.env.EPHEMERAL_KV, ctx.userId, newDraft('event'));
  await sendMessage(ctx.token, ctx.chatId,
    '📅 Создание нового события.\n\nПришли название события:',
    { parse_mode: 'HTML' },
  );
  return true;
}

// --- /new_poll — умный парсинг (Замок 3) ---
export async function cmdNewPoll(ctx: CmdCtx): Promise<boolean> {
  if (!isAllowedUser(ctx.msg, ctx.env.ALLOWED_TG_IDS)) return false;

  const lines = ctx.text.split('\n').map(s => s.trim()).filter(Boolean);
  // Первая строка после команды — title
  const titleLine = lines[0].replace(/^\/new_poll\s*/i, '').trim();
  if (!titleLine || lines.length < 3) {
    await sendMessage(ctx.token, ctx.chatId,
      '⚠️ Формат:\n<code>/new_poll Вопрос</code>\n<code>Вариант 1</code>\n<code>Вариант 2</code>\n<code>Вариант 3</code>',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  // Остальные строки — варианты
  const options = lines.slice(1).map((opt, i) => ({
    id: `opt${i + 1}`,
    title: opt,
    votes: 0,
  }));

  const draft = newDraft('poll');
  draft.title = titleLine;
  draft.step = 'done';
  draft.pollData = { options };
  draft.description = `Опрос: ${options.length} вариантов`;

  await setDraft(ctx.env.EPHEMERAL_KV, ctx.userId, draft);

  // Сразу публикуем poll (без фото)
  const pollId = `tg_poll_${ctx.msg.message_id}`;
  await ctx.env.FEED_DB.prepare(
    `INSERT OR IGNORE INTO feed_items (id, type, title, description, data, status, priority)
     VALUES (?, 'poll', ?, ?, ?, 'published', 5)`
  ).bind(pollId, draft.title, draft.description, JSON.stringify({ options })).run();

  await clearDraft(ctx.env.EPHEMERAL_KV, ctx.userId);
  await sendMessage(ctx.token, ctx.chatId, `✅ Опрос «${draft.title}» опубликован!`);
  return true;
}

// --- /publish — публикация черновика ---
export async function cmdPublish(ctx: CmdCtx): Promise<boolean> {
  if (!isAllowedUser(ctx.msg, ctx.env.ALLOWED_TG_IDS)) return false;

  const parts = ctx.text.split(' ');
  const itemId = parts[1];
  if (!itemId) {
    await sendMessage(ctx.token, ctx.chatId, '⚠️ Укажите ID: /publish tg_123');
    return true;
  }

  await ctx.env.FEED_DB.prepare(
    `UPDATE feed_items SET status = 'published' WHERE id = ?`
  ).bind(itemId).run();

  await sendMessage(ctx.token, ctx.chatId,
    `✅ Пост ${itemId} опубликован. Появится в ленте через ~60s (KV TTL).`,
  );
  return true;
}

// --- /archive — Soft Delete ---
export async function cmdArchive(ctx: CmdCtx): Promise<boolean> {
  if (!isAllowedUser(ctx.msg, ctx.env.ALLOWED_TG_IDS)) return false;

  const parts = ctx.text.split(' ');
  const itemId = parts[1];
  if (!itemId) {
    await sendMessage(ctx.token, ctx.chatId, '⚠️ Укажите ID: /archive tg_123');
    return true;
  }

  await ctx.env.FEED_DB.prepare(
    `UPDATE feed_items SET status = 'archived' WHERE id = ?`
  ).bind(itemId).run();

  await sendMessage(ctx.token, ctx.chatId,
    `🗂 Пост ${itemId} архивирован. Исчезнет из ленты через ~60s.`,
  );
  return true;
}

// --- /start — приветствие ---
export async function cmdStart(ctx: CmdCtx): Promise<boolean> {
  if (!isAllowedUser(ctx.msg, ctx.env.ALLOWED_TG_IDS)) return false;
  await sendMessage(ctx.token, ctx.chatId,
    '🎤 <b>beLive Feed Bot</b>\n\n' +
    'Команды:\n' +
    '/catalog — Каталог треков (10 на страницу)\n' +
    '/track &lt;название&gt; — Найти трек\n' +
    '/cancel — Отменить текущее действие\n\n' +
    '<i>Каталог Linkin Park — 52 трека</i>',
    { parse_mode: 'HTML' },
  );
  return true;
}

// --- Обработчик шагов стейт-машины ---
export async function handleDraftStep(ctx: CmdCtx, draft: DraftState): Promise<boolean> {
  if (!isAllowedUser(ctx.msg, ctx.env.ALLOWED_TG_IDS)) return false;

  switch (draft.step) {
    case 'awaiting_title': {
      draft.title = ctx.text;
      draft.subtitle = '';
      draft.step = 'awaiting_date_price';
      await setDraft(ctx.env.EPHEMERAL_KV, ctx.userId, draft);
      await sendMessage(ctx.token, ctx.chatId,
        '📅 Пришли дату и цену в формате:\n<code>2026-07-15, 1500₽</code>\n\nИли отправь /skip',
        { parse_mode: 'HTML' },
      );
      return true;
    }

    case 'awaiting_date_price': {
      if (ctx.text.toLowerCase() !== '/skip') {
        const parts = ctx.text.split(',').map(s => s.trim());
        draft.eventDate = parts[0] || undefined;
        draft.price = parts[1] || undefined;
      }
      draft.step = 'awaiting_photo';
      await setDraft(ctx.env.EPHEMERAL_KV, ctx.userId, draft);
      await sendMessage(ctx.token, ctx.chatId,
        '🖼 Пришли обложку для события (фото)\n\nИли отправь /skip',
        { parse_mode: 'HTML' },
      );
      return true;
    }

    case 'awaiting_photo': {
      await sendMessage(ctx.token, ctx.chatId,
        'Ожидаю фото... Если хочешь пропустить — /skip',
      );
      return true;
    }

    default:
      return false;
  }
}

// ── Парсер имени файла (ZIP) ──
export function parseFilename(filename: string): { artist: string; title: string; slug: string } {
  const cleaned = filename.replace(/\.(zip|flac|mp3)$/i, '');
  const withoutNumber = cleaned.replace(/^\d{1,3}\s*[–-]\s*/, '');
  const match = withoutNumber.match(/^(.+?)\s*[–-]\s*(.+)$/);
  const title = match ? match[2].trim() : withoutNumber;
  const artist = match ? match[1].trim() : 'Linkin Park';
  const slug = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-');
  return { artist, title, slug };
}

// ── Загрузка ZIP от админа ──
export async function cmdUploadDoc(ctx: CmdCtx): Promise<boolean> {
  if (!isAllowedUser(ctx.msg, ctx.env.ALLOWED_TG_IDS)) return false;

  const doc = ctx.msg.document;
  if (!doc) return false;

  const fileName = doc.file_name || '';
  if (!fileName.endsWith('.zip')) {
    await sendMessage(ctx.token, ctx.chatId, '⚠️ Только ZIP файлы.');
    return true;
  }

  const fileSize = doc.file_size || 0;
  if (fileSize > 52_428_800) {
    await sendMessage(ctx.token, ctx.chatId,
      `⚠️ Файл ${(fileSize / 1024 / 1024).toFixed(1)} MB — превышает лимит TG 50MB.\nСожми до 128kbps и загрузи снова.`,
    );
    return true;
  }

  const { artist, title, slug } = parseFilename(fileName);
  if (!title) {
    await sendMessage(ctx.token, ctx.chatId, '⚠️ Не удалось распознать название трека из имени файла.');
    return true;
  }

  // Сохраняем draft в KV (1h TTL)
  const draft = { fileId: doc.file_id, fileName, artist, title, slug, fileSize };
  await ctx.env.EPHEMERAL_KV.put(`track_draft:${ctx.userId}`, JSON.stringify(draft), { expirationTtl: 3600 });

  // Спрашиваем тип
  const keyboard = {
    inline_keyboard: [[
      { text: '‹ DUO ›', callback_data: 'upload_2stem' },
      { text: '‹ FULL ›', callback_data: 'upload_full' },
      { text: '❌ Отмена', callback_data: 'upload_cancel' },
    ]],
  };

  await sendMessage(ctx.token, ctx.chatId,
    `📦 ${escapeHtml(title)}\n` +
    `🎤 ${escapeHtml(artist)}\n` +
    `📁 ${(fileSize / 1024 / 1024).toFixed(1)} MB\n\n` +
    `Выбери тип трека:`,
    { parse_mode: 'HTML', reply_markup: keyboard },
  );

  return true;
}

// ── Выбор типа 2-STEM/FULL после загрузки ──
export async function cmdUploadType(ctx: CmdCtx): Promise<boolean> {
  if (!isAllowedUser({ from: { id: ctx.userId } }, ctx.env.ALLOWED_TG_IDS)) return false;

  const trackType = ctx.text; // '2stem' | 'full' | 'cancel'

  if (trackType === 'cancel') {
    await ctx.env.EPHEMERAL_KV.delete(`track_draft:${ctx.userId}`);
    await sendMessage(ctx.token, ctx.chatId, '❌ Загрузка отменена.');
    return true;
  }

  if (trackType !== '2stem' && trackType !== 'full') return false;

  // Читаем draft
  const draft: any = await ctx.env.EPHEMERAL_KV.get(`track_draft:${ctx.userId}`, { type: 'json' });
  if (!draft) {
    await sendMessage(ctx.token, ctx.chatId, '⚠️ Черновик не найден. Загрузи ZIP снова.');
    return true;
  }

  // Читаем текущий каталог
  const catalog: any[] = (await ctx.env.EPHEMERAL_KV.get('track_data:catalog', { type: 'json' })) as any[] || [];
  const nextId = `lp-${String(catalog.length + 1).padStart(2, '0')}`;

  // Создаём запись
  const trackEntry = {
    id: nextId,
    title: draft.title,
    artist: draft.artist,
    slug: draft.slug,
    type: trackType,
    fileIds: { instrumental: trackType === '2stem' ? draft.fileId : '', full: trackType === 'full' ? draft.fileId : '' },
    fileSize: draft.fileSize,
    fileName: draft.fileName,
  };

  // Сохраняем отдельный ключ и каталог
  await ctx.env.EPHEMERAL_KV.put(`track_data:${draft.slug}`, JSON.stringify(trackEntry));
  catalog.push(trackEntry);
  await ctx.env.EPHEMERAL_KV.put('track_data:catalog', JSON.stringify(catalog));
  await ctx.env.EPHEMERAL_KV.delete(`track_draft:${ctx.userId}`);

  await sendMessage(ctx.token, ctx.chatId,
    `✅ ${escapeHtml(draft.title)} сохранён (${(draft.fileSize / 1024 / 1024).toFixed(1)} MB, ‹ ${trackType === '2stem' ? 'DUO' : trackType.toUpperCase()} ›)`,
    { parse_mode: 'HTML' },
  );

  return true;
}

// --- /catalog — список треков ---
export async function cmdCatalog(ctx: CmdCtx): Promise<boolean> {
  if (!isAllowedUser(ctx.msg, ctx.env.ALLOWED_TG_IDS)) return false;

  const parts = ctx.text.split(' ');
  const page = Math.max(1, parseInt(parts[1]) || 1);
  const { tracks, total, pages } = getTracksPage(page);

  if (tracks.length === 0) {
    await sendMessage(ctx.token, ctx.chatId, '⚠️ Страница не найдена.');
    return true;
  }

  let text = `🎵 <b>Каталог треков</b> (${total} total)\nСтраница ${page}/${pages}\n\n`;
  tracks.forEach((t, i) => {
    text += `${(page - 1) * TRACKS_PER_PAGE + i + 1}. ${escapeHtml(t.title)}\n`;
    text += `   <i>${escapeHtml(t.album)} (${t.year})</i>\n`;
    text += `   /track_${t.slug}\n\n`;
  });

  const keyboard = {
    inline_keyboard: [
      [
        ...(page > 1 ? [{ text: '⬅️', callback_data: `catalog_${page - 1}` }] : []),
        { text: `${page}/${pages}`, callback_data: 'noop' },
        ...(page < pages ? [{ text: '➡️', callback_data: `catalog_${page + 1}` }] : []),
      ],
    ],
  };

  await sendMessage(ctx.token, ctx.chatId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
  return true;
}

// --- /track — поиск трека ---
export async function cmdTrack(ctx: CmdCtx): Promise<boolean> {
  if (!isAllowedUser(ctx.msg, ctx.env.ALLOWED_TG_IDS)) return false;

  const parts = ctx.text.split(' ');
  const query = parts.slice(1).join(' ').trim();

  if (!query) {
    await sendMessage(ctx.token, ctx.chatId,
      '⚠️ Укажи название трека:\n<code>/track Numb</code>\n<code>/track In the End</code>',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  const track = findTrack(query);
  if (!track) {
    await sendMessage(ctx.token, ctx.chatId,
      `❌ Трек «${escapeHtml(query)}» не найден.\n\nПопробуй: /catalog`,
    );
    return true;
  }

  const r2Url = track.r2Key
    ? `${ctx.env.R2_PUBLIC_URL || 'https://belive-feed-media.r2.dev'}/${track.r2Key}`
    : '📦 (скоро будет загружено)';

  const text =
    `🎤 <b>${escapeHtml(track.title)}</b>\n` +
    `💿 ${escapeHtml(track.album)} (${track.year})\n` +
    `📦 <code>${escapeHtml(track.fileName)}</code>\n\n` +
    `🔗 ${r2Url}`;

  await sendMessage(ctx.token, ctx.chatId, text, { parse_mode: 'HTML' });
  return true;
}
