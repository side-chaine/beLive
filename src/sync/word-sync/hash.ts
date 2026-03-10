export function normalizeLyricsForHash(rawLyrics: string): string {
  return rawLyrics.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function computeLyricsHash(rawLyrics: string): string {
  const input = normalizeLyricsForHash(rawLyrics);

  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
