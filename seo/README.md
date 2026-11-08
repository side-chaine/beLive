# beLive — SEO site (mybelive.com)

Static marketing site for **mybelive.com**. The application stays on
**app.mybelive.com** and is not built or served from here.

Astro, static output, zero JavaScript shipped. Landing pages are generated at
build time; the only client-side payload is HTML and inlined CSS.

## Commands

```bash
cd seo
npm ci
npm run dev      # http://localhost:4321
npm run build    # -> seo/dist
npm run preview  # serve seo/dist locally
```

## Structure

```
seo/
├── astro.config.mjs          # site host, sitemap integration
├── public/                   # robots.txt, _headers, favicon, og/
└── src/
    ├── lib/site.mjs          # SITE, APP_URL, brand strings — single source
    ├── lib/schema.mjs        # Schema.org builders (SoftwareApplication, FAQPage, HowTo, BreadcrumbList)
    ├── layouts/Base.astro    # html shell, head, header/footer
    ├── components/Seo.astro  # title/meta/canonical/OG + build-time length guard
    ├── components/Schema.astro
    ├── components/Header.astro, Footer.astro, Cta.astro
    ├── pages/index.astro     # phase 0 placeholder
    └── pages/404.astro
```

## Rules encoded in the code

- **Title ≤ 60, description ≤ 160.** `Seo.astro` throws during the build, so an
  overlong title fails CI instead of shipping. Verified by mutation: an
  83-character title aborts the build.
- **One canonical form.** Canonical is always `https://mybelive.com/<slug>/`
  with a trailing slash, regardless of how the URL was requested.
- **Marketing → app handoff only.** Every CTA goes through `APP_URL` from
  `src/lib/site.mjs`. No app UI is rendered here.
- **No secrets in code.** Verification tokens are read from `SEO_*` env vars at
  build time (GitHub secrets). Absent → no meta tag, build stays green.

## Deploy

`.github/workflows/deploy-seo.yml` builds and deploys to Cloudflare Pages
project `belive-seo`. It triggers only on `seo/**` changes, so app work never
redeploys the site and vice versa.

Required secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
(environment `production-seo`). Domain binding and DNS are Nikita's hands.

## Version pin

`astro` is pinned to **7.4.1** on purpose: 7.4.2+ requires Node ≥ 22.23.4, and
the build machine runs 22.22.2. Bump the pin together with the Node upgrade —
do not use `^` here, or CI and local builds diverge.
