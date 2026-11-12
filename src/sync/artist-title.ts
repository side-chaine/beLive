/**
 * «Metallica - The Unforgiven II», «Metallica-The Unforgiven II»,
 * «Metallica – The Unforgiven II» — это одно и то же. Расширение срезаем:
 * в запросе к lrclib `.mp3` только мешает.
 *
 * Артист может остаться пустым — это нормально, lrclib ищет и по названию.
 */
export function splitArtistTitle(raw: string): { artist: string; title: string } {
  const clean = raw.replace(/\.(mp3|wav|flac|m4a|ogg|opus|aac|aiff)$/i, '').trim();
  const spaced = clean.split(/\s+[-–—]\s+/);
  if (spaced.length >= 2) {
    return { artist: spaced[0].trim(), title: spaced.slice(1).join(' - ').trim() };
  }
  // Одиночный дефис — только когда слева похоже на имя артиста. Служебные имена
  // вида «20261112172517-cb73c7d523-metallica-…» так не разрезаем: артистом
  // станет хеш, и поиск уйдёт в пустоту.
  const dash = clean.indexOf('-');
  if (dash > 0 && clean.indexOf('-', dash + 1) === -1) {
    const left = clean.slice(0, dash).trim();
    if (left && !/\d/.test(left)) {
      return { artist: left, title: clean.slice(dash + 1).trim() };
    }
  }
  return { artist: '', title: clean };
}
