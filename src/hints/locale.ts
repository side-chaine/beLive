import type { HintLocale } from './types';

/**
 * «Английская версия в зависимости от того, откуда открыт beLive».
 *
 * Resolution order — every provider is pure and can be extended/reordered:
 *   1. explicit link contract: ?lang=en / ?locale=ru / ?hl=en
 *   2. entry surface: ?src / ?ref / ?utm_source, then the referrer host
 *   3. browser / OS languages
 *   4. home locale (ru)
 *
 * A manual choice in the room always wins (store.localeOverride).
 * Add new entry surfaces to ENTRY_SOURCES instead of scattering `if`s.
 */

type Provider = () => HintLocale | null;

function normalise(value: string | null | undefined): HintLocale | null {
  if (!value) return null;
  const v = value.toLowerCase().trim();
  if (/^en([-_]|$)/.test(v)) return 'en';
  if (/^(ru|uk|be|kk)([-_]|$)/.test(v)) return 'ru';
  return null;
}

const EN_SOURCES = /^(en|global|intl|world|web-en|landing-en|site-en)$/;
const RU_SOURCES = /^(ru|tg|telegram|vk|web-ru|landing-ru|bot)$/;

const fromUrl: Provider = () => {
  const q = new URLSearchParams(window.location.search);
  return normalise(q.get('lang') || q.get('locale') || q.get('hl'));
};

const fromEntrySource: Provider = () => {
  const q = new URLSearchParams(window.location.search);
  const src = (q.get('src') || q.get('ref') || q.get('utm_source') || '').toLowerCase().trim();
  if (EN_SOURCES.test(src)) return 'en';
  if (RU_SOURCES.test(src)) return 'ru';

  // Only unambiguous host signals. A generic `.com` referrer (google.com,
  // auth.mybelive.com) is NOT a language signal — do not guess from it.
  try {
    const host = new URL(document.referrer).hostname.toLowerCase();
    if (/^en\./.test(host)) return 'en';
    if (/\.ru$/.test(host)) return 'ru';
  } catch {
    /* no referrer — normal for a direct PWA launch */
  }
  return null;
};

const fromNavigator: Provider = () => {
  const nav = navigator as Navigator & { languages?: readonly string[] };
  const list = nav.languages?.length ? nav.languages : [nav.language];
  for (const l of list) {
    const resolved = normalise(l);
    if (resolved) return resolved;
  }
  return null;
};

const PROVIDERS: Provider[] = [fromUrl, fromEntrySource, fromNavigator];

export function resolveHintLocale(override?: HintLocale | null): HintLocale {
  if (override === 'ru' || override === 'en') return override;
  for (const provider of PROVIDERS) {
    try {
      const resolved = provider();
      if (resolved) return resolved;
    } catch {
      /* a provider must never be able to break the tour */
    }
  }
  return 'ru';
}
