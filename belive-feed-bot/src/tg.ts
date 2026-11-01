// @TC-088: Telegram Bot API helpers

const TG_API = 'https://api.telegram.org/bot';

export async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  opts?: { parse_mode?: 'HTML' | 'Markdown'; reply_markup?: any }
): Promise<any> {
  const body: any = { chat_id: chatId, text, ...opts };
  const res = await fetch(`${TG_API}${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '(no body)');
    console.error(`[TG] sendMessage failed: ${res.status} ${res.statusText}`, errBody);
    return { ok: false, error: `HTTP ${res.status}: ${errBody.slice(0, 200)}` };
  }
  return res.json();
}

/**
 * Информация о файле. При ошибке Telegram возвращаем её как есть, а не
 * пустой объект: иначе вызывающий не отличает «файла нет» от «токен не тот»
 * и «файл больше 20 МБ» — все три случая выглядели одинаково.
 */
export interface TgFileInfo {
  file_path?: string;
  error_code?: number;
  description?: string;
}

export async function getFile(token: string, fileId: string): Promise<TgFileInfo> {
  const res = await fetch(`${TG_API}${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok || !data || data.ok === false) {
    return {
      error_code: data?.error_code ?? res.status,
      description: data?.description ?? `HTTP ${res.status} ${res.statusText}`,
    };
  }
  return data.result || {};
}

export function fileUrl(token: string, path: string): string {
  return `https://api.telegram.org/file/bot${token}/${path}`;
}

export async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
  const body: any = { callback_query_id: callbackQueryId };
  if (text) body.text = text;
  const res = await fetch(`${TG_API}${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`[TG] answerCallbackQuery failed: ${res.status}`);
  }
}
