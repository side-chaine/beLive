# SEO — чеклист beLive (app.mybelive.com)

Сайт — SPA (React 19 + Vite), один публичный URL `/`. Деплой GitHub Pages за Cloudflare, автодеплой на push в `main`.

## Публичность страниц
- **Публично:** только `/` (SPA-шелл с мета-тегами в `index.html`).
- **Закрыто от индексации** в `robots.txt`: `/api/`, `/admin/`, `/team-m/` (служебный ассет notify-фичи), `/sw.js`.
- Авторизованные сурфейсы живёт внутри того же URL — отдельная индексируемая страница не образуется. `noindex` per-route не нужен.

## Env-переменные (verification)
| Переменная | Сервис | Где взять |
|---|---|---|
| `SEO_GOOGLE_SITE_VERIFICATION` | Google Search Console | Добавить ресурс → HTML-тег → `content="..."` |
| `SEO_YANDEX_VERIFICATION` | Яндекс Вебмастер | Добавить сайт → Meta-тег |
| `SEO_BING_VERIFICATION` | Bing Webmaster Tools | «Импорт из GSC» (рекомендуется) или Meta-тег |

Механизм: `seoVerificationPlugin()` в `vite.config.ts` вставляет `<meta>` в `<head>` только если переменная задана и не пуста. Секреты в репозиторий **не хардкодятся** — задаются как GitHub secrets (Settings → Secrets and variables → Actions → New repository secret), прокидываются в деплой (`deploy.yml` → `Build` step).

## После первого деплоя (push в main)
1. `https://app.mybelive.com/robots.txt` → должен отдать text/plain с `Sitemap: https://app.mybelive.com/sitemap.xml`.
2. `https://app.mybelive.com/sitemap.xml` → валидный XML с одним `https://app.mybelive.com/`.
3. `https://app.mybelive.com/` → в `<head>`: `title`, `meta description`, `canonical`, OG-теги; при заданных secrets — verification-меты.
4. Отправить в панели:
   - **Google Search Console:** URL-проверка → «Запросить индексирование» для `https://app.mybelive.com/`; затем `Ссылки → Отправить sitemap` (`sitemap.xml`).
   - **Яндекс Вебмастер:** «Индексирование → Переобход страниц» → `https://app.mybelive.com/`; «Индексирование → Файлы Sitemap» → `sitemap.xml`.
   - **Bing Webmaster Tools:** «Submit URLs» → корень; sitemap загружается автоматически из robots.txt (или вручную).

## Ручная проверка (без панелей)
```bash
curl -s https://app.mybelive.com/robots.txt
curl -s https://app.mybelive.com/sitemap.xml
curl -s https://app.mybelive.com/ | grep -E 'canonical|description|google-site-verification'
```

## Известные риски
- **og:image** сейчас — `/img/icon-192.png` (192px). Для нормальных превью нужен PNG **1200×630** (сделать — отдельная задача).
- **SPA + JS-контент:** поисковик видит только `<head>` и пустой `#app-root`. Для расширенного SEO (тексты, вторые страницы) понадобится prerender/SSG — сейчас не делалось (минимальное решение по канону).
- **`/team-m/INBOX.md`** технически доступен по URL (нужен notify-фиче), но не индексируется.
