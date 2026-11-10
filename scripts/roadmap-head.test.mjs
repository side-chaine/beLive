#!/usr/bin/env node
// Тест шапки ROADMAP.md. Запуск: node --test scripts/roadmap-head.test.mjs
//
// Шапка со снимком базы раньше жила статикой вне сплайса, и --check её не видел:
// устаревший SHA не краснел никогда. Теперь шапка генерируется из meta и
// проверяется тем же сравнением, что граф. Тесты держат именно это: правится
// meta — меняется шапка; правится шапка руками — --check краснеет.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'generate-roadmap.mjs');
const SRC = join(ROOT, 'docs', 'roadmap');

function fixture() {
  const board = join(mkdtempSync(join(tmpdir(), 'roadmap-head-')), 'board');
  cpSync(SRC, board, { recursive: true });
  return board;
}

function run(board, args) {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ROADMAP_DIR: board },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return { code: e.status, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}

const mdPath = (b) => join(b, 'ROADMAP.md');
const dataPath = (b) => join(b, 'roadmap-data.json');
const readData = (b) => JSON.parse(readFileSync(dataPath(b), 'utf8'));
const writeData = (b, d) => writeFileSync(dataPath(b), JSON.stringify(d, null, 2) + '\n');

test('--write рисует шапку из meta', () => {
  const b = fixture();
  assert.equal(run(b, ['--write']).code, 0);
  const md = readFileSync(mdPath(b), 'utf8');
  assert.match(md, /<!-- HEAD:START -->/);
  assert.match(md, /> \*\*Снимок:\*\* \d{2}\.\d{2}\.\d{4} \d{2}:\d{2} · `origin\/main = [0-9a-f]+`/);
  assert.match(md, /> \*\*Дрейф:\*\* /);
});

test('смена meta.main меняет шапку — она не статична', () => {
  const b = fixture();
  const d = readData(b);
  d.meta.main = 'deadbee';
  d.meta.generated = '2026-12-31T09:05:00+03:00';
  writeData(b, d);
  assert.equal(run(b, ['--write']).code, 0);
  const md = readFileSync(mdPath(b), 'utf8');
  assert.match(md, /`origin\/main = deadbee`/);
  assert.match(md, /\*\*Снимок:\*\* 31\.12\.2026 09:05/);
});

test('шапка, поправленная руками, краснеет на --check', () => {
  const b = fixture();
  assert.equal(run(b, ['--write']).code, 0);
  const md = readFileSync(mdPath(b), 'utf8');
  const stale = md.replace(/origin\/main = [0-9a-f]+/, 'origin/main = 6cd4f1f');
  assert.notEqual(stale, md, 'подмена должна была изменить файл');
  writeFileSync(mdPath(b), stale);

  const r = run(b, ['--check']);
  assert.equal(r.code, 1, r.stderr);
  assert.match(r.stderr, /STALE · .*ROADMAP\.md/);
});

test('--write возвращает зелёный после ручной правки', () => {
  const b = fixture();
  assert.equal(run(b, ['--write']).code, 0);
  const md = readFileSync(mdPath(b), 'utf8').replace(/origin\/main = [0-9a-f]+/, 'origin/main = 6cd4f1f');
  writeFileSync(mdPath(b), md);

  assert.equal(run(b, ['--write']).code, 0);
  const r = run(b, ['--check']);
  assert.equal(r.code, 0, r.stderr);
});

test('без маркеров шапки — явная ошибка, а не тихая генерация', () => {
  const b = fixture();
  assert.equal(run(b, ['--write']).code, 0);
  const md = readFileSync(mdPath(b), 'utf8')
    .replace('<!-- HEAD:START -->', '')
    .replace('<!-- HEAD:END -->', '');
  writeFileSync(mdPath(b), md);

  const r = run(b, ['--check']);
  assert.equal(r.code, 4, r.stderr);
  assert.match(r.stderr, /HEAD:START/);
});
