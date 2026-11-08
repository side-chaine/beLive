// Schema.org builders. Every landing page must emit SoftwareApplication +
// FAQPage + HowTo + BreadcrumbList (see rules/ROLE-711.md). Keeping the shapes
// here means a typo in a page cannot silently produce invalid structured data.

import { SITE, APP_URL, BRAND, LANG } from './site.mjs';

const abs = (path) => new URL(path, SITE).href;

export function organization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE}/#organization`,
    name: BRAND,
    url: SITE,
    logo: abs('/og/og-default.png'),
  };
}

export function webSite() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE}/#website`,
    name: BRAND,
    url: SITE,
    inLanguage: LANG,
    publisher: { '@id': `${SITE}/#organization` },
  };
}

export function softwareApplication({ name, description }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: name ?? BRAND,
    description,
    url: APP_URL,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    inLanguage: LANG,
  };
}

export function faqPage(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

export function howTo({ name, description, steps }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    step: steps.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: typeof step === 'string' ? step : step.name,
      text: typeof step === 'string' ? step : step.text,
    })),
  };
}

// items: [{ name, path }] ordered from the site root down to the current page.
export function breadcrumbList(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}
