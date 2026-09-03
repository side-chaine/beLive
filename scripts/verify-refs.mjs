#!/usr/bin/env node
// scripts/verify-refs.mjs — G-4 gate: warn about references to a path outside src/
// Usage: node scripts/verify-refs.mjs <path>
// Mode: report-only, exit 0 always.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(new URL('.', import.meta.url).pathname, '..');

if (!process.argv[2]) {
  console.log('Usage: node scripts/verify-refs.mjs <path>');
  console.log('  Searches scripts/, .github/, *.json for references to <path>.');
  process.exit(0);
}

const needle = process.argv[2];
let hits = 0;

function walkJson(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'scripts' || entry.name === '.github') continue;
      walkJson(abs);
    } else if (entry.name.endsWith('.json')) {
      check(abs);
    }
  }
}

function check(file) {
  const rel = relative(root, file);
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) {
      console.log(`  ${rel}:${i + 1}: ${lines[i].trim()}`);
      hits++;
    }
  }
}

// Search scripts/ (all files)
for (const entry of readdirSync(join(root, 'scripts'), { withFileTypes: true })) {
  if (entry.isFile()) check(join(root, 'scripts', entry.name));
}

// Search .github/ if exists
try {
  const gh = join(root, '.github');
  if (statSync(gh).isDirectory()) {
    function walkGH(dir) {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const abs = join(dir, e.name);
        if (e.isDirectory()) walkGH(abs);
        else check(abs);
      }
    }
    walkGH(gh);
  }
} catch {}

// Search all *.json in root (including package.json)
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.json')) {
    check(join(root, entry.name));
  }
}

console.log(`verify-refs: ${hits} hit(s) for "${needle}"`);
