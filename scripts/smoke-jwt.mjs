#!/usr/bin/env node
// Контракт JWT между воркерами beLive.
//
// Зачем: секрет подписи живёт в четырёх воркерах как отдельные секреты
// Cloudflare. Ротация — это четыре независимые команды `wrangler secret put`,
// и нет ничего, что удерживало бы их в согласии. 02.11.2026 они уже
// разошлись: токен, выписанный auth, получал 401 от feed-bot, потому что
// секреты были разные. Нашли это случайно, по 401 на живом каталоге.
//
// Этот скрипт — проверка после каждой ротации: один токен от auth должен
// приниматься всеми, кто его проверяет.
//
// Запуск (имя переменной окружения — BELIVE_JWT):
//   bash:        BELIVE_JWT='<токен>' npm run verify:jwt
//   PowerShell:  $env:BELIVE_JWT = '<токен>'; npm run verify:jwt
//   аргументом:  node scripts/smoke-jwt.mjs '<токен>'
//
// Где взять живой токен. В localStorage его НЕТ и не будет: access-токен
// намеренно не персистится, сессию держит httpOnly cookie. Поэтому токен
// берётся тем же запросом, которым его берёт приложение — в консоли
// app.mybelive.com, на уже открытой вкладке:
//
//   await (await fetch('https://auth.mybelive.com/auth/refresh',
//     { method: 'POST', credentials: 'include' })).json()
//
// В ответе поле с токеном (accessToken). Он живёт 15 минут — запускать сразу.
// Значение не печатается этим скриптом никогда: ни в выводе, ни в ошибках,
// только длина в символах.
//
// Приёмка деплоя PR-1 и PR-2: строка «префлайт с чужим origin не отражается»
// переходит из FAIL в OK. До деплоя она красная — дыра жива.
//
// Код возврата: 0 — контракт цел, 1 — разошёлся, 2 — нечем проверять.

const BASE = {
  gateway: 'https://belive-gateway.nikitosss007.workers.dev',
  mvsep: 'https://belive-mvsep.nikitosss007.workers.dev',
  feedBot: 'https://belive-feed-bot.nikitosss007.workers.dev',
  auth: 'https://auth.mybelive.com',
};

const ORIGIN = 'https://app.mybelive.com';
// Чужой origin из живого промаха 02.11: `http://192.168.1.evil.com` начинался
// с префикса `http://192.168.` и получал отражённый ACAO.
const EVIL_ORIGIN = 'http://192.168.1.evil.com';

const TOKEN = process.argv[2] || process.env.BELIVE_JWT || '';

if (!TOKEN) {
  console.error('Нет токена. Передай аргументом или в BELIVE_JWT.');
  console.error('  BELIVE_JWT=\'<токен>\' node scripts/smoke-jwt.mjs');
  process.exit(2);
}

/** Один запрос. Никогда не логирует заголовки — в них токен. */
async function probe(url, init = {}) {
  try {
    const res = await fetch(url, { ...init, redirect: 'manual' });
    return { status: res.status, headers: res.headers };
  } catch (err) {
    return { status: 0, error: String(err && err.message ? err.message : err), headers: new Headers() };
  }
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
}

const bearer = { Authorization: `Bearer ${TOKEN}` };

async function main() {
  console.log('Контракт JWT · smoke · ' + new Date().toISOString());
  console.log('Токен: ' + TOKEN.length + ' символов, значение не печатается.\n');

  // ── 1. Живость ────────────────────────────────────────────
  for (const [name, base] of Object.entries(BASE)) {
    const r = await probe(`${base}/health`);
    // auth может не иметь /health — это не провал контракта.
    const soft = name === 'auth';
    check(`health ${name}`, r.status === 200, soft ? `мягкая проверка, ${r.status}` : `HTTP ${r.status}`);
  }

  // ── 2. Гейты без токена: то, что закрыто, обязано отвечать 401 ──
  const anonTracks = await probe(`${BASE.feedBot}/tracks`);
  check('аноним /tracks → 401', anonTracks.status === 401, `HTTP ${anonTracks.status}`);

  const anonQuota = await probe(`${BASE.mvsep}/quota`);
  check('аноним /quota → 401', anonQuota.status === 401, `HTTP ${anonQuota.status}`);

  // /status и /download на mvsep — те два маршрута, которые закрывал PR #24.
  // Без них приёмка деплоя mvsep неполная: /quota закрыт давно, а эти два
  // до #24 стояли ВЫШЕ проверки токена и были открыты. /status при этом ходит
  // в mvsep.com нашим платным ключом, то есть анонимный перебор hash'ей жёг
  // деньги и снимал глобальный лок.
  const anonStatus = await probe(`${BASE.mvsep}/status?hash=smoke-probe`);
  check('аноним /status → 401', anonStatus.status === 401, `HTTP ${anonStatus.status}`);

  const anonMvsepDl = await probe(
    `${BASE.mvsep}/download?url=${encodeURIComponent('https://mvsep.com/file/smoke.mp3')}`,
  );
  check('аноним mvsep /download → 401', anonMvsepDl.status === 401, `HTTP ${anonMvsepDl.status}`);

  // gateway: POST с пустым телом. Без токена — 401, с токеном — отказ
  // валидации (400), и ничего не создаётся. Пустой объект специально:
  // проверяем проход авторизации, а не запись.
  const postInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: '{}',
  };
  const anonPost = await probe(`${BASE.gateway}/api/feed/posts`, postInit);
  check('аноним POST /api/feed/posts → 401', anonPost.status === 401, `HTTP ${anonPost.status}`);

  // ── 3. Тот же токен: все, кто проверяет, обязаны принять ──
  const authTracks = await probe(`${BASE.feedBot}/tracks`, { headers: bearer });
  check('с токеном /tracks → 200', authTracks.status === 200, `HTTP ${authTracks.status}`);

  const authQuota = await probe(`${BASE.mvsep}/quota`, { headers: bearer });
  check('с токеном /quota → 200', authQuota.status === 200, `HTTP ${authQuota.status}`);

  const authPost = await probe(`${BASE.gateway}/api/feed/posts`, {
    ...postInit,
    headers: { ...postInit.headers, ...bearer },
  });
  // Любой ответ кроме 401 значит, что подпись проверена и токен принят.
  // 400/422 — отказ валидации, это норма для пустого тела.
  check(
    'с токеном gateway принял подпись (не 401)',
    authPost.status !== 401 && authPost.status !== 0,
    `HTTP ${authPost.status}`,
  );

  // ── 4. CORS: отражения чужого origin быть не должно ────────
  const pre = await probe(`${BASE.feedBot}/tracks`, {
    method: 'OPTIONS',
    headers: { Origin: EVIL_ORIGIN },
  });
  const acao = pre.headers.get('access-control-allow-origin') || '';
  check(
    'префлайт с чужим origin не отражается',
    !acao.includes('192.168.1.evil.com'),
    `ACAO=${acao || '(нет)'}`,
  );

  // ── 5. Срок жизни токена ──────────────────────────────────
  const payload = decodePayload(TOKEN);
  if (payload && typeof payload.exp === 'number') {
    const left = payload.exp - Math.floor(Date.now() / 1000);
    check('токен ещё жив', left > 0, `${left} с`);
    check('iss = belive-auth', payload.iss === 'belive-auth', String(payload.iss));
  } else {
    check('в токене есть exp', false, 'нет exp или токен не разобран');
  }

  // ── Вывод ─────────────────────────────────────────────────
  console.log('');
  let hard = 0;
  for (const r of results) {
    const mark = r.ok ? 'OK  ' : 'FAIL';
    if (!r.ok) {hard++;}
    console.log(`  ${mark}  ${r.name}  (${r.detail})`);
  }
  console.log('');
  if (hard === 0) {
    console.log('Контракт цел: один токен принимают все, кто его проверяет.');
    process.exit(0);
  }
  console.log(`Разошлось проверок: ${hard}.`);
  console.log('Если /tracks и /quota дают 401 при живом токене — секреты JWT_SECRET разошлись.');
  console.log('Ротация: wrangler secret put JWT_SECRET в auth, gateway, mvsep, feed-bot одним значением.');
  process.exit(1);
}

function decodePayload(token) {
  try {
    const part = token.split('.')[1];
    if (!part) {return null;}
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    return JSON.parse(Buffer.from(b64 + pad, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

main();
