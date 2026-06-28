/**
 * Slugify — универсальная нормализация строк для URL/slug
 * Поддержка кириллицы + UUID fallback для pure non-Latin
 */

const TRANSLIT_MAP: Record<string, string> = {
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e',
  'ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m',
  'н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
  'ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch',
  'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
};

function randomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function slugify(raw: string): string {
  if (!raw) return `t-${randomId()}`;
  
  const lower = raw.toLowerCase().trim();
  
  // Transliterate cyrillic
  let result = '';
  for (const ch of lower) {
    result += TRANSLIT_MAP[ch] ?? '';
  }
  
  // Replace non-alphanumeric with hyphens
  result = result.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').replace(/-+/g, '-');
  
  // Fallback for empty result (pure non-Latin only)
  if (!result) {
    return `t-${randomId()}`;
  }
  
  return result;
}
