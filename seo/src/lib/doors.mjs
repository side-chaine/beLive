// Registry of every marketing door on mybelive.com.
//
// WHY THIS EXISTS
// The coach and streaming features ship a few days after the pages are written.
// Publishing a page that promises a feature which does not exist yet is worse
// than not ranking at all: the visitor arrives, finds nothing, and never comes
// back. So publication is a data switch, not a memory exercise.
//
//   status: 'live' — indexable, included in sitemap
//   status: 'soon' — built and reachable, but noindex and out of sitemap
//
// Default for an unregistered path is 'soon'. A new page stays invisible until
// someone deliberately declares it live — forgetting the registry can never
// accidentally publish a promise we cannot keep.

export const DOORS = [
  { path: '/', status: 'live' },
  // Coach line. Written now, published together with the coach launch.
  { path: '/nauchitsya-pet', status: 'soon', feature: 'coach' },
  { path: '/raspevka-onlayn', status: 'soon', feature: 'coach' },
];

const normalize = (path) =>
  path === '/' ? '/' : `/${String(path).replace(/^\/+|\/+$/g, '')}/`;

export function door(path) {
  const key = normalize(path);
  return DOORS.find((d) => normalize(d.path) === key) ?? { path: key, status: 'soon' };
}

export function isIndexablePath(path) {
  return door(path).status === 'live';
}

// Paths excluded from sitemap. 404 is a utility page; 'soon' doors are not
// published yet.
export function isSitemapPath(path) {
  if (normalize(path).includes('/404')) return false;
  return isIndexablePath(path);
}
