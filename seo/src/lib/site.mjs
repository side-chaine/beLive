// Single source of truth for hosts and brand strings used by the SEO site.
// Imported by astro.config.mjs as well, so `site` in the config can never drift
// from the canonical host used in the markup.

export const SITE = 'https://mybelive.com';

// The application is a separate deployment. Marketing pages never render app
// UI; they only link to it. Keep every CTA pointing through this constant.
export const APP_URL = 'https://app.mybelive.com';

export const BRAND = 'beLive';

export const LOCALE = 'ru_RU';
export const LANG = 'ru';

// Default social preview (1200x630) served from seo/public/og/.
export const OG_DEFAULT = '/og/og-default.png';
