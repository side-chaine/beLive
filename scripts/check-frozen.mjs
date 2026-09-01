import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'frozen-manifest.json'), 'utf8'));

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

let errors = 0;
let checked = 0;

function checkBlock(block, files) {
  for (const [file, expected] of Object.entries(files)) {
    checked++;
    const path = join(root, file);
    if (!existsSync(path)) {
      console.error(`ERROR [${block}] отсутствует: ${file} — легальный снос обязан удалить манифест-строку в том же коммите`);
      errors++;
      continue;
    }
    const actual = sha256(path);
    if (actual !== expected) {
      console.error(`ERROR [${block}] изменён: ${file}`);
      console.error(`  manifest: ${expected}`);
      console.error(`  live    : ${actual}`);
      errors++;
    }
  }
}

checkBlock('guard', manifest.guard);
checkBlock('graveyard', manifest.graveyard);

const known = new Set([...Object.keys(manifest.guard), ...Object.keys(manifest.graveyard)]);
const bridgesDir = join(root, 'src', 'bridges');
if (existsSync(bridgesDir)) {
  for (const entry of readdirSync(bridgesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
    const rel = `src/bridges/${entry.name}`;
    if (!known.has(rel)) {
      console.warn(`WARN resurrection: ${rel} вне манифеста (новый мост до Волны C?)`);
    }
  }
}

const total = Object.keys(manifest.guard).length + Object.keys(manifest.graveyard).length;
if (errors > 0) {
  console.error(`frozen FAIL: ${errors} нарушений (${checked}/${total} проверено)`);
  process.exit(1);
}
console.log(`frozen OK: ${checked}/${total}`);
