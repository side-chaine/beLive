// Тесты /download у belive-feed-bot.
//
// Зачем: на ЛЮБУЮ ошибку Telegram воркер отвечал одинаково — 404
// "File not found". Неверный BOT_TOKEN, удалённый из чата файл и файл
// больше 20 МБ (официальный предел Bot API на скачивание через getFile)
// выглядели неотличимо. По такому ответу нельзя понять, что чинить.
//
// Эти тесты фиксируют, что причина доходит до клиента: 413 на «слишком
// большой», 404 на «файла нет», 502 на всё остальное, и что текст ошибки
// Telegram попадает в тело ответа.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from './index';
import { getFile } from './tg';

const FILE_ID = 'BQACAgIAAxkBAAOkai4-zIZSApvICpdW2qYzso3VwaEAAm2YAAKzAnBJfI3iOnL2bp88BA';

function makeEnv(overrides: Record<string, any> = {}) {
  return {
    BOT_TOKEN: 'bot-token',
    WEBHOOK_SECRET: 'webhook-secret',
    ALLOWED_TG_IDS: '1',
    EPHEMERAL_KV: { get: async () => null, put: async () => {}, delete: async () => {}, list: async () => ({ keys: [] }) },
    UPLOAD_CHAT_ID: '-100123',
    JWT_SECRET: 'secret',
    ALLOWED_ORIGIN: 'https://app.mybelive.com',
    ...overrides,
  } as any;
}

function downloadReq(fileId = FILE_ID) {
  return new Request(`https://feed-bot.test/download/${fileId}`, {
    method: 'GET',
    headers: { Origin: 'https://app.mybelive.com' },
  });
}

/** Ответ Telegram в формате Bot API. */
function tgError(code: number, description: string) {
  return new Response(JSON.stringify({ ok: false, error_code: code, description }), {
    status: code === 400 ? 400 : code,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchSpy: any;

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('/download отдаёт настоящую причину', () => {
  it('файл больше 20 МБ → 413 FILE_TOO_LARGE_FOR_BOT_API', async () => {
    fetchSpy.mockResolvedValueOnce(tgError(400, 'Bad Request: file is too big'));

    const res = await worker.fetch(downloadReq(), makeEnv());

    expect(res.status).toBe(413);
    const json: any = await res.json();
    expect(json.error).toBe('FILE_TOO_LARGE_FOR_BOT_API');
    expect(json.detail).toContain('too big');
    expect(json.tg_error_code).toBe(400);
  });

  it('неверный BOT_TOKEN / файла нет → 404 TG_FILE_NOT_FOUND', async () => {
    fetchSpy.mockResolvedValueOnce(tgError(404, 'Not Found'));

    const res = await worker.fetch(downloadReq(), makeEnv());

    expect(res.status).toBe(404);
    const json: any = await res.json();
    expect(json.error).toBe('TG_FILE_NOT_FOUND');
    expect(json.tg_error_code).toBe(404);
  });

  it('прочая ошибка Telegram → 502 TG_GETFILE_FAILED с текстом', async () => {
    fetchSpy.mockResolvedValueOnce(tgError(400, 'Bad Request: invalid file_id'));

    const res = await worker.fetch(downloadReq(), makeEnv());

    // 'invalid file_id' попадает в notFound — это честный 404, а не 502.
    const json: any = await res.json();
    expect(json.detail).toBe('Bad Request: invalid file_id');
    expect(res.status).toBe(404);
  });

  it('неизвестная ошибка без ключевых слов → 502', async () => {
    fetchSpy.mockResolvedValueOnce(tgError(500, 'Internal Server Error'));

    const res = await worker.fetch(downloadReq(), makeEnv());

    expect(res.status).toBe(502);
    const json: any = await res.json();
    expect(json.error).toBe('TG_GETFILE_FAILED');
  });

  it('успешный путь: 200 и вложение с Content-Type', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ ok: true, result: { file_path: 'documents/file_1.zip' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response('ZIPDATA', {
        status: 200,
        headers: { 'Content-Type': 'application/zip' },
      }));

    const res = await worker.fetch(downloadReq(), makeEnv());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toBe('attachment');
    expect(res.headers.get('Content-Type')).toBe('application/zip');
    expect(String(fetchSpy.mock.calls[1][0])).toContain('api.telegram.org/file/bot');
  });
});

describe('getFile не глотает ошибку', () => {
  it('возвращает error_code и description вместо пустого объекта', async () => {
    fetchSpy.mockResolvedValueOnce(tgError(400, 'Bad Request: file is too big'));

    const info = await getFile('bot-token', FILE_ID);

    expect(info.file_path).toBeUndefined();
    expect(info.error_code).toBe(400);
    expect(info.description).toContain('too big');
  });

  it('возвращает file_path при успехе', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(
      JSON.stringify({ ok: true, result: { file_path: 'documents/x.zip' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    const info = await getFile('bot-token', FILE_ID);

    expect(info.file_path).toBe('documents/x.zip');
    expect(info.error_code).toBeUndefined();
  });
});
