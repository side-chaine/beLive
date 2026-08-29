#!/usr/bin/env node
/**
 * check-manifest — гейт политики зависимостей (ADR-0012).
 *
 * Правило: пакет в dependencies/devDependencies обязан встречаться в import/require
 * где-то в исходниках. Исключения — белый список (инструменты, подключаемые строкой
 * в конфиге, или используемые только через CLI).
 *
 * Выход: 0 — ок, 1 — найдены неиспользуемые прямые зависимости.
 *
 * Запуск: node scripts/check-manifest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

// Инструменты, которые нужны, но не импортируются в коде явно:
// подключаются строкой в конфиге, запускаются из CLI или нужны как ambiente.
const ALLOWLIST = new Set([
  'globals',             // список глобалок для eslint-конфига
  'jsdom',               // среда для vitest
  '@vitest/ui',          // опциональный UI, запускается флагом
  '@playwright/test',    // e2e-раннер
  'workbox-window',      // подключается vite-plugin-pwa
  '@types/react',
  '@types/react-dom',
  '@types/jszip',
  'vite-tsconfig-paths', // плагин, подключается строкой в vite.config
  'vite-plugin-pwa',     // плагин
  'acorn',
  'acorn-jsx',
  'lodash.merge',
]);

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const direct = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
];

// --- Собираем корпус исходников ---
const roots = ['src', 'scripts', 'gateway', 'belive-feed-bot', 'js', 'public', '.github'];
const configFiles = ['vite.config.ts', 'vitest.config.ts', 'eslint.config.mjs', 'tsconfig.json', 'index.html'];
const files = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'dev-dist', 'coverage'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|json|html|yml|yaml)$/.test(e.name)) files.push(p);
  }
}
roots.forEach(walk);
// package.json НЕ включаем: он самореферентен (содержит все имена зависимостей).
configFiles.forEach((f) => { if (fs.existsSync(path.join(ROOT, f))) files.push(path.join(ROOT, f)); });

const corpus = files
  .map((f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } })
  .join('\n');

function isReferenced(dep) {
  if (ALLOWLIST.has(dep)) return true;
  const esc = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    // from 'x' | require('x') | import('x') | import 'x' (side-effect) | "x" как ключ/строка
    `(from\\s*['"]${esc}(/[^'"]*)?['"]` +
    `|require\\(\\s*['"]${esc}(/[^'"]*)?['"]\\s*\\)` +
    `|import\\(\\s*['"]${esc}(/[^'"]*)?['"]\\s*\\)` +
    `|import\\s+['"]${esc}(/[^'"]*)?['"]` +
    `|['"]${esc}(/[^'"]*)?['"])`
  );
  return re.test(corpus);
}

const unreferenced = direct.filter((d) => !isReferenced(d));

console.log(`direct dependencies : ${direct.length}`);
console.log(`unreferenced        : ${unreferenced.length}`);

if (unreferenced.length === 0) {
  console.log('\n✅ Манифест чист: все прямые зависимости используются.');
  process.exit(0);
}

console.log('\n❌ Прямые зависимости, нигде не импортируемые (кандидаты на удаление):');
for (const d of unreferenced) console.log(`   ${d}`);
console.log('\nЕсли пакет нужен — добавь его в ALLOWLIST в scripts/check-manifest.mjs.');
process.exit(1);
