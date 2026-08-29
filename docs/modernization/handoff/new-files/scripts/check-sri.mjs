#!/usr/bin/env node
/**
 * check-sri — гейт: каждый внешний CDN-скрипт обязан иметь integrity и закреплённую версию.
 * ADR-0008.
 *
 * Проверяет два правила, которые работают только вместе:
 *   1. presence: у <script src="http..."> есть атрибут integrity
 *   2. pin:      URL содержит версию (@x.y.z)
 *
 * Почему второе обязательно: SRI без пина версии — это бомба. CDN отдаёт «последнюю»,
 * файл меняется, хэш перестаёт совпадать, и приложение перестаёт грузиться
 * в произвольный момент (в худшем случае — на выступлении).
 *
 * Выход: 0 — ок, 1 — нарушения.
 *
 * Запуск: node scripts/check-sri.mjs [file ...]   (по умолчанию index.html)
 */
import fs from 'node:fs';

const files = process.argv.slice(2).length ? process.argv.slice(2) : ['index.html'];

// Белый список: источники, которым разрешено быть без SRI.
// Пустой — все внешние скрипты обязаны быть подписаны.
const ALLOWLIST = [];

let violations = 0;
let checked = 0;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log(`SKIP ${file} (нет файла)`);
    continue;
  }

  const html = fs.readFileSync(file, 'utf8');
  // Ищем все теги <script ...> и разбираем атрибуты по отдельности,
  // чтобы не зависеть от порядка атрибутов и переносов строк.
  const tagRe = /<script\b([^>]*)>/gi;
  let m;

  while ((m = tagRe.exec(html)) !== null) {
    const attrs = m[1];

    const srcMatch = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!srcMatch) continue; // инлайн-скрипт — не наша проверка (см. ADR-0008 про CSP)

    const src = srcMatch[1];
    if (!/^https?:\/\//i.test(src)) continue; // локальный файл

    if (ALLOWLIST.some((h) => src.includes(h))) continue;

    checked++;

    const hasIntegrity = /\bintegrity\s*=\s*["'][^"']+["']/i.test(attrs);
    const hasCrossorigin = /\bcrossorigin\b/i.test(attrs);
    // Закрепление версии: @1.2.3 сразу после имени пакета
    const hasPin = /@\d+\.\d+\.\d+/.test(src);

    const problems = [];
    if (!hasIntegrity) problems.push('нет integrity');
    if (!hasPin) problems.push('нет закреплённой версии');
    if (!hasCrossorigin) problems.push('нет crossorigin (SRI без него не работает)');

    if (problems.length) {
      violations++;
      const line = html.slice(0, m.index).split('\n').length;
      console.log(`❌ ${file}:${line}  ${problems.join(', ')}`);
      console.log(`     ${src}`);
    }
  }
}

console.log(`\nвнешних скриптов проверено : ${checked}`);
console.log(`нарушений                  : ${violations}`);

if (violations === 0) {
  console.log('\n✅ Все внешние скрипты подписаны и закреплены.');
  process.exit(0);
}

console.log('\nПересчитать хэши: bash scripts/generate-sri.sh');
process.exit(1);
