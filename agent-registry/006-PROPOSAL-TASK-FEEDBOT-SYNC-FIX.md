# [@PROPOSAL patch] · TASK-FEEDBOT-SYNC-FIX · от 006 · 24.08
**Цель:** вернуть синхронизацию списка треков клиентом (`GET /tracks`) — бот снова «виден».
**Рекомендация 006:** Вар.1 (union-read) + CORS. Самый надёжный возврат функционала без миграции KV.
**Frozen-check:** `belive-feed-bot/` НЕ frozen. Править Operator (через 007). 006 — только спека.

## ROOT CAUSE (см. 006-RECON-TASK-FEEDBOT-TRACK-SYNC.md)
`GET /tracks` (belive-feed-bot/src/index.ts:45) читает ТОЛЬКО `track_data:t:*` (префикс, добавлен в 1388c57). Но бот (`cmdUploadType`, commands.ts:289/291) и `scripts/bulk-upload.ts` пишут `track_data:<slug>` + `track_data:catalog` (с 8eff92b, не мигрированы). `/tracks` их не видит ⇒ пустой каталог.

## E1 · belive-feed-bot/src/index.ts — `GET /tracks` (строки 43-61) → union-read + CORS
Заменить блок на:
```ts
if (url.pathname === '/tracks') {
  // B1: per-track records (HTTP /upload path) — префикс track_data:t:
  const trackList = await env.EPHEMERAL_KV.list({ prefix: 'track_data:t:', limit: 200 });
  const fromPrefix = await Promise.all(
    trackList.keys.map(k => env.EPHEMERAL_KV.get(k.name, { type: 'json' }))
  );
  // B2: denormalized catalog (bot upload + bulk-upload path)
  const catalogArr: any[] = (await env.EPHEMERAL_KV.get('track_data:catalog', { type: 'json' })) || [];

  // Merge + dedup по slug (приоритет у записи с бОльшим числом непустых fileIds / новее)
  const bySlug = new Map<string, any>();
  const score = (x: any) =>
    (x?.fileIds ? Object.values(x.fileIds).filter(Boolean).length : 0) +
    ((x?.createdAt || 0) / 1e15);
  for (const t of [...catalogArr, ...fromPrefix.filter(Boolean)] as any[]) {
    if (!t || !t.slug) continue;
    const prev = bySlug.get(t.slug);
    if (!prev || score(t) > score(prev)) bySlug.set(t.slug, t);
  }
  const catalog = [...bySlug.values()].sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

  // CORS: динамический origin (как в OPTIONS :27-29), НЕ хардкод
  const reqOrigin = request.headers.get('Origin') || '';
  const allowedOrigin = ['https://app.mybelive.com', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://0.0.0.0:5173']
    .find(o => reqOrigin.startsWith('http://192.168.') ? true : o === reqOrigin) || 'https://app.mybelive.com';

  return new Response(JSON.stringify({ updatedAt: Date.now(), total: catalog.length, tracks: catalog }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    }
  });
}
```
**Что даёт:** `/tracks` теперь возвращает и `track_data:t:*` (HTTP-загрузки), и `track_data:catalog` (бот/bulk) → клиент снова видит ВСЕ треки. CORS чинится для dev-origin. Миграция KV НЕ нужна (старые `track_data:<slug>` индивидуальные ключи остаются осиротелыми, но catalog-массив их покрывает).

## ОПЦИОНАЛЬНО (Вар.2, follow-up-чистка, НЕ блокирует возврат)
Свести писателей к единому ключу `track_data:t:<id>`:
- **E2** commands.ts `cmdUploadType` (:273-292): писать `track_data:t:<uuid>` (как index.ts:228), `id` = `tg-<uuid>` вместо `lp-NN` (убрать коллизию с статикой), держать `track_data:catalog` как индекс для совместимости.
- **E3** bulk-upload.ts (:122/134): `track_data:${slug}` → `track_data:t:${slug}`.
- **E4** commands.ts `cmdCatalog` (:303): читать реальный каталог (union) вместо статичного `TRACKS` из data/tracks.ts.
После E2-E3 можно убрать чтение `track_data:catalog` из E1 (останется только `track_data:t:*`).

## РИСКИ
- **R1 LOW:** `track_data:catalog` — JSON-массив, лимит KV value 25MB; для сотен треков ок, при тысячах — вынести в пер-ключ (уже есть `track_data:t:*`).
- **R2 LOW:** dedup-эвристика (score) — при одинаковом slug предпочтёт запись с бОльшим числом fileIds; при равенстве — новее. Крайне редкий конфликт.
- **R3 INFO:** индивидуальные `track_data:<slug>` (старые) остаются в KV «мусором» — не влияет на /tracks после E1; чистится отдельным скриптом позже.
- **R4 MED:** dopo деплоя бандл собирается esbuild (docs/telegram/bot-catalog-integration.md:90) и заливается в CF Dashboard вручную — не забыть пересобрать `dist/worker-bundle.js` и задеплоить.

## ДЕПЛОЙ (напоминание для Operator/007)
Согласно docs/telegram/bot-catalog-integration.md:87-93 — `npx esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/worker-bundle.js` → вставить в CF Dashboard → Workers → belive-feed-bot → Save & Deploy. Wrangler на macOS падает.

## 🔬 LIVE DIAGNOSTIC (24.08 — подтверждено вживую, root cause 100%)
- `curl /tracks` → `{"updatedAt":...,"total":2,"tracks":[...]}` с `id:"usr-<uuid>"`, `slug:"linkin-park-linkin-park-points-of-authority-full"`, `fileIds:{full:...}` — это записи `track_data:t:*` (HTTP `/upload`).
- **Бот-добавленные треки (cmdUploadType → `track_data:catalog` / `track_data:<slug>`) В ОТВЕТЕ ОТСУТСТВУЮТ** ⇒ гипотеза подтверждена: `/tracks` читает только `track_data:t:*`, бот-путь невидим.
- **CORS доказан:** с `Origin: http://localhost:5173` ответ `access-control-allow-origin: https://app.mybelive.com` (hardcoded) ⇒ на dev-origin браузер блокирует чтение ⇒ вторая причина пустого каталога в dev. Фикс в E1 (динамический origin).
- `dist/` локально **ОТСУТСТВУЕТ** ⇒ Operator обязан собрать `npx esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/worker-bundle.js` (или `npm run deploy`=wrangler) перед заливкой.
- **ВЕРИФИКАЦИЯ после деплоя:** `curl /tracks` → `total` должен вырасти с 2 до `2+N` (N = треки из `track_data:catalog`). Если осталось 2 → `track_data:catalog` пуст → сделать reseed через `scripts/bulk-upload.ts` (пишет `track_data:catalog`, который E1 читает) либо применить Вар.2 (миграция писателей на `track_data:t:`).
- Бот жив (GET / → HTTP 200), deployed-бандл = post-refactor (читает `track_data:t:*`, подтверждено `usr-` id-форматом).
