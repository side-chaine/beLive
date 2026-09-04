#!/usr/bin/env node
// scripts/verify-inert.mjs — G-5 gate: calls into inert facade members
// Windows-корректен С РОЖДЕНИЯ (норма 201: гейт, не запускающийся у Никиты, — не гейт)
// CENSUS-АЛГОРИТМ v6 (проверен CEO_1 на живом фасаде, 4 итерации, см. §2-bis):
// НЕ регексп на строки — пары "a() {}, b() {}," ломают все строковые якоря.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';   // ← НЕ new URL().pathname (урок 201 21:15)
const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const FACADE = 'js/audio-facade-v3.js';
const src = readFileSync(join(root, FACADE), 'utf8');

// ── 1. CENSUS: сканер объявлений (позиционный, не строковый) ──
//    член = имя( где перед именем (нач.строки | , или ;) — ловит парные члены в одной строке
const KEYWORDS = new Set(['if','for','while','switch','catch','return','new','typeof','await','else','do','in','of']);
const DECL = /(?:^|(?<=[,;]))\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm;
function bodyOf(pos) {          // от позиции после '(' — баланс до закрывающей, затем {…}
  let i = pos, depth = 1;
  while (i < src.length && depth > 0) { if (src[i]==='(') depth++; else if (src[i]===')') depth--; i++; }
  const j = src.indexOf('{', i);
  if (j === -1 || j - i > 10) return null;
  let k = j + 1, d = 1;
  while (k < src.length && d > 0) { if (src[k]==='{') d++; else if (src[k]==='}') d--; k++; }
  return src.slice(j + 1, k - 1).trim();
}
const inert = new Map();
for (const m of src.matchAll(DECL)) {
  const name = m[1]; if (KEYWORDS.has(name) || inert.has(name)) continue;
  const body = bodyOf(m.index + m[0].length);
  if (body === null) continue;
  if (body === '') inert.set(name, 'empty');
  else if (/^return\s+Promise\.resolve\(.*?\)\s*;?$/.test(body)) inert.set(name, 'promise');
}

// ── 2. allowlist: инерция, которая ОСОЗНАННА (иначе красный) ──
const ALLOW = (JSON.parse(readFileSync(join(root, 'inert-allowlist.json'), 'utf8')).members ?? []);

// ── 3. живые вызовы с колонкой ПРИЁМНИК (§0-1) ──
function walk(dir, out = []) { for (const e of readdirSync(dir, { withFileTypes: true })) {
  if (e.name === 'node_modules' || e.name === '__tests__') continue;
  const p = join(dir, e.name);
  if (e.isDirectory()) walk(p, out);
  else if (/\.(ts|tsx|js|jsx|mjs)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(p);
} return out; }
const callRE = /(?:ae|audioEngine)\s*(?:\?\.)?\s*\.?\s*([a-zA-Z_]+)\s*(?:\?\.)?\s*\(/g;   // 4 формы: ae.x( · ae.x?.( · ae?.x( · ae?.x?.(
const live = new Map();
for (const f of walk(join(root, 'src')).concat([join(root, 'js', 'monitor-mix.js')])) {
  const txt = readFileSync(f, 'utf8'); callRE.lastIndex = 0; let m;
  while ((m = callRE.exec(txt)) !== null) {
    if (!inert.has(m[1])) continue;
    const line = txt.slice(0, m.index).split('\n').length;
    (live.get(m[1]) ?? live.set(m[1], []).get(m[1])).push(relative(root, f) + ':' + line);
  }
}

// ── 4. verdict ──
for (const [member, kind] of inert) {
  const al = ALLOW.find((a) => a.member === member);
  const callers = live.get(member) ?? [];
  if (al && callers.length === 0) { console.log(`  ⚪ ${member}: intentional (${al.reason}, until ${al.until})`); continue; }
  // G-5-fix (007): allowlist-член с живыми вызовами = honest-contract (loadTrack: V2-fallback
  // деградации, вызовы маркированы). Пустота осознана => intentional, вызовы перечислены для наблюдателя.
  if (al && callers.length > 0) { console.log(`  ⚪ ${member}: intentional-contract (${al.reason}, until ${al.until}) — ${callers.length} live marked call(s): ${callers.join(', ')}`); continue; }
  if (callers.length) console.log(`  🔴🔴 ${member} (${kind}): ${callers.length} LIVE CALL(S) INTO VOID -> ${callers.join(', ')}`);
  else console.log(`  🔴 ${member} (${kind}): inert, not in allowlist`);
}
console.log(`verify-inert: ${inert.size} inert member(s), ${[...live.values()].flat().length} live call(s) into void`);
// Mode: warn, exit 0. Флип в fail — только ПОСЛЕ волны §1 + неделя warn (правило D-4-усилений).
process.exit(0);
