#!/usr/bin/env node
// scripts/gen-doc-index.mjs — R-3: индекс доков генерится из DOC-CENSUS.yaml (не руками).
// Спека: DOCS-EXECUTION Опуса → маршрут CEO_1 шаг-5. Приёмка: grep 'docs/sync' docs/INDEX.md = 0.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const census = readFileSync(join(root, 'team-m', 'DOC-CENSUS.yaml'), 'utf8');

// Парс records (path/state/visibility) — лёгкий строковый парс (yaml-блок простой)
const records = [];
let cur = null;
for (const line of census.split('\n')) {
  const p = line.match(/^\s*- path: "(.+)"$/);
  if (p) { cur = { path: p[1] }; records.push(cur); continue; }
  const st = line.match(/^\s*state: (\w+)/); if (st && cur) cur.state = st[1];
  const vi = line.match(/^\s*visibility: (\w+)/); if (vi && cur) cur.visibility = vi[1];
}

const LIVING = records.filter(r => r.state === 'LIVING' && r.visibility === 'public');
const HISTORY = records.filter(r => r.state === 'HISTORY' && r.visibility === 'public');
const PRIVATE_COUNT = records.filter(r => r.visibility === 'private').length;

const lines = [
  '# beLive — Index of docs (R-3, generated)',
  '',
  `> Сгенерировано скриптом \`scripts/gen-doc-index.mjs\` из \`team-m/DOC-CENSUS.yaml\` (census = единственный источник; правки индекса руками запрещены — правь census).`,
  `> Публичных LIVING: ${LIVING.length} · публичных HISTORY: ${HISTORY.length} · приватных (vault/, agents-only): ${PRIVATE_COUNT}.`,
  '',
  '## LIVING (public)',
  ...LIVING.map(r => `- [${r.path}](${r.path})`),
  '',
  '## HISTORY (public lineage — надгробия читаются в файлах)',
  ...HISTORY.map(r => `- [${r.path}](${r.path})`),
  '',
  '## Приватная зона (vault/ — agents-only, не публикуется)',
  `Статус приватных доков: \`vault/\` под .gitignore; перечислены в census (счёт ${PRIVATE_COUNT}), в публичном индексе не разглашаются.`,
  '',
];

const outPath = join(root, 'docs', 'INDEX.md');
writeFileSync(outPath, lines.join('\n'));
console.log(`gen-doc-index: ${records.length} census-records -> INDEX.md (LIVING ${LIVING.length}, HISTORY ${HISTORY.length}, private ${PRIVATE_COUNT})`);
