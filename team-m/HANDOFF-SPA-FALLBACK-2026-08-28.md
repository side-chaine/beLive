# HANDOFF · SPA-FALLBACK FIX (deploy-race MIME crash) — 2026-08-28

> Передаётся между сессиями 007 (Qwen выдохся → свитч на opencode/hy3-free, см. MODEL-SWITCH-GUIDE.md).
> Состояние на момент передачи: цепь 001 v2 ЗАВЕРШЁН (спека найдена), 002 v2 УПАЛ (rate-limit qwen), но эквивалент стресса сделан 007 вручную (см. ниже). 009 v2 / Operator / push — НЕ СДЕЛАНЫ.

## ПРОБЛЕМА
Босс на первом визите app.mybelive.com после деплоя получил краш: старый кэш (браузер/SW/CF-edge мозаика) запросил hashed-ассеты прошлой генерации → недостающие файлы поймал `public/_redirects` (`/* /index.html 200`) → вернулся index.html (200 text/html) → strict MIME → `Failed to load module script` / `Refused to apply style` → краш. Перезагрузка = новая генерация → всё ок (самовосстановление подтверждено Боссом). Запись работает в проде (REC-SYNC·COMMIT в логе Босса).

## ПОЧЕМУ НЕ `_redirects`
009 v1 ОТКЛОНИЛ строку `/assets/* 404` в `_redirects`: CF Pages требует destination в правилах, malformed=ignored, «Rewrites (other status codes) ❌»; оба парсинга дают не 404 (302→/404→200 HTML либо ignore). Спека мертва → ОТЛОЖЕНО.

## СПЕКА v2 (001, ДОК-ПОДТВЕРЖДЕНА context7 CF Pages)
Механизм: **Pages Function** на `/assets/*` (Functions приоритетнее статики → обязателен fallthrough через `env.ASSETS.fetch`; ASSETS.fetch применяет _headers/_redirects, поэтому missing вернёт либо 200-HTML-rewrite либо сырой 404 — оба ловим).
- `functions/assets/[[path]].js` (корень проекта, ~6 строк, вне tsc/vitest):
  ```js
  export async function onRequest({ request, env }) {
    const res = await env.ASSETS.fetch(request);
    if (!res.ok || (res.headers.get('content-type') || '').includes('text/html'))
      return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return res;
  }
  ```
- `public/_routes.json` (копируется vite в dist): `{"version":1,"include":["/assets/*"],"exclude":[]}` — ограничивает Function-invocations только /assets/*.
- **D1-риск снят by design:** ответ Function НЕ проходит через _headers → immutable не прикладывается к 404; `no-store` запрещает кэш; SW-precache получает ok=false → не пишет отравленный кэш.
- GH Pages: `functions/` и `_routes.json` инертны; там missing = нативный 404 (доп. правка не нужна).

## 002 v2 СТРЕСС — ЭКВИВАЛЕНТ СДЕЛАН 007 (subagent упал по rate-limit)
Проверено вручную (grep/read): (1) `functions/` и `public/_routes.json` НЕ существуют → создаём без конфликтов; (2) vite `publicDir:'public', outDir:'dist'` → `public/_routes.json` попадёт в dist (CF читает оттуда); (3) `functions/` в корне НЕ копируется vite (CF детектит с корня) — ок; (4) GH Pages deploy.yml берёт `./dist` → functions/ не попадёт (безопасно); (5) guard: живой JS-ассет = res.ok + text/javascript → проходит сквозь; missing = 404 или 200-html → оба → 404; (6) `env.ASSETS` — стандартный CF Pages binding для статических проектов (док 001 v2). **ВЕРДИКТ 007: спека ДЕРЖИТ.** (Финальный 002 v2 + 009 v2 — прогнать после рестарта на hy3-free для формальности.)

## ЧТО ДЕЛАТЬ ПОСЛЕ РЕСТАРТА (на hy3-free)
1. **002 v2** (быстрый, подтверждающий) → **009 v2** (РЕШЕНО) → **Operator**: создать `functions/assets/[[path]].js` + `public/_routes.json` (НЕ трогать _redirects/_headers/frozen; проверить что dist/_routes.json после build и tsc=296/vitest=761 не дрейфуют).
2. **Коммит** на ветку.
3. **Пуш в main (GO Босса)** → CF Pages пересоберёт из main → прод-деплой.
4. **Smoke (обязательно, D2):** `curl -I https://app.mybelive.com/assets/DEADbeef.js` → **404**; `curl -I https://app.mybelive.com/assets/<живой>.js` → **200 + immutable**; SPA deep-link → 200 html. Провал любого → revert строки.

## ПАРАЛЛЕЛЬНЫЕ ХВОСТЫ (не блокируют, но висят)
- 🔐 **SECURITY:** belive-api/src/index.ts — роут `/auth/debug-hmac` УДАЛЁН (chain 001→002→009→Operator, typecheck GREEN), НО `belive-api/` gitignored → фикс только на диске. Босс: `cd belive-api && wrangler deploy` + smoke (debug-hmac→404, /health→200) + **ротация JWT_SECRET** (`wrangler secret put`) — секрет светился!
- 🔑 Ротация MVSEP/GetSongBPM ключей (висит).
- 📺 MIGRATION-STORY-DVIGATEL-2026-08-28.md упакован (7 эпизодов).
- 📦 Docs-коммиты (b047772, 50ceab2) на ветке, не запушены в main.

## МОДЕЛЬ-СВИТЧ (Босс, 28.08)
Qwen 3.8 Max Free выдохся (rate-limit). Все агенты + оба конфига (`opencode.json` проектный, `~/.config/opencode/opencode.jsonc` глобальный) переключены на `opencode/hy3-free` (operator уже был hy3-free). **ТРЕБУЕТСЯ РЕСТАРТ opencode** — конфиг читается при старте. CHAIN-SMOKE после рестарта: спавн 002, спросить model id → должен быть `opencode/hy3-free`.
