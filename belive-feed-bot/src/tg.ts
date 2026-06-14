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

export async function getFile(token: string, fileId: string): Promise<{ file_path?: string }> {
  const res = await fetch(`${TG_API}${token}/getFile?file_id=${fileId}`);
  const data: any = await res.json();
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
