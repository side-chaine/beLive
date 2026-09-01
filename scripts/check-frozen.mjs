import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
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
// FROZEN-WARN-патч 201 (01.09): рекурсивный обход — подкаталоги под наблюдением;
// SKIP-маска по ИМЕНИ (не по каталогу — иначе дыра вернётся); .tsx ловится;
// .spec.ts больше не даёт ложный WARN (доказано дифф-прогоном 201: HEAD 3/5 провалов, патч 6/6).
const SKIP_RE = /\.(test|spec)\.tsx?$/;   // тесты легально править — см. note в манифесте
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}
if (existsSync(bridgesDir)) {
  for (const abs of walk(bridgesDir)) {
    const rel = relative(root, abs).split(sep).join('/');
    if (known.has(rel)) continue;
    if (SKIP_RE.test(rel)) continue;      // тесты — не замок, и не шум
    console.warn(`WARN resurrection: ${rel} вне манифеста (новый мост до Волны C?)`);
  }
}

const total = Object.keys(manifest.guard).length + Object.keys(manifest.graveyard).length;
if (errors > 0) {
  console.error(`frozen FAIL: ${errors} нарушений (${checked}/${total} проверено)`);
  process.exit(1);
}
console.log(`frozen OK: ${checked}/${total}`);
