#!/usr/bin/env node
// Тест дрейф-чека роадмапа. Запуск: node --test scripts/roadmap-drift.test.mjs
//
// Проверяем не «функция вызвана», а поведение CLI на фикстуре: узел с PR,
// влитым в историю, не может стоять в active/queued/waiting без объяснения.
// История подделывается отдельным git-репозиторием (ROADMAP_GIT_DIR), поэтому
// тест не зависит от истории самого beLive и не может «позеленеть от времени».

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'generate-roadmap.mjs');
const SRC = join(ROOT, 'docs', 'roadmap');

function makeFixture() {
  const base = mkdtempSync(join(tmpdir(), 'roadmap-drift-'));
  const board = join(base, 'board');
  const repo = join(base, 'repo');

  cpSync(SRC, board, { recursive: true });

  mkdirSync(repo, { recursive: true });
  const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' });
  git('init', '-q');
  writeFileSync(join(repo, 'README.md'), 'fixture\n');
  git('add', '.');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'Merge pull request #999 from side-chaine/fixture');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');

  return { base, board, repo };
}

function run(fx, args, gitDir = fx.repo) {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ROADMAP_DIR: fx.board, ROADMAP_GIT_DIR: gitDir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return { code: e.status, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}

const dataPath = (fx) => join(fx.board, 'roadmap-data.json');
const readData = (fx) => JSON.parse(readFileSync(dataPath(fx), 'utf8'));
const writeData = (fx, d) => writeFileSync(dataPath(fx), JSON.stringify(d, null, 2) + '\n');

test('чистая фикстура: --check зелёный, дрейфа нет', () => {
  const fx = makeFixture();
  assert.equal(run(fx, ['--write']).code, 0);
  const r = run(fx, ['--check']);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(/DRIFT/.test(r.stderr), false);
});

test('узел с влитым PR в active без блокера — дрейф, exit 1', () => {
  const fx = makeFixture();
  const d = readData(fx);
  const n = d.nodes.find(x => x.id === 'N2');
  n.pr = [999];
  n.state = 'active';
  n.blocker = null;
  writeData(fx, d);

  assert.equal(run(fx, ['--write']).code, 0);          // артефакты синхронны, дрейф не мешает записи
  const r = run(fx, ['--check']);
  assert.equal(r.code, 1, 'ожидался exit 1');
  const drift = r.stderr.split('\n').filter(l => l.includes('DRIFT'));
  assert.equal(drift.length, 1, r.stderr);
  assert.match(drift[0], /N2/);
  assert.match(drift[0], /#999/);
});

test('тот же узел в done — дрейфа нет', () => {
  const fx = makeFixture();
  const d = readData(fx);
  const n = d.nodes.find(x => x.id === 'N2');
  n.pr = [999];
  n.state = 'done';
  n.blocker = null;
  writeData(fx, d);

  assert.equal(run(fx, ['--write']).code, 0);
  const r = run(fx, ['--check']);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(/DRIFT/.test(r.stderr), false);
});

test('влитый PR + живой блокер — не дрейф (линия не закрыта, это не ложь карты)', () => {
  const fx = makeFixture();
  const d = readData(fx);
  const n = d.nodes.find(x => x.id === 'N2');
  n.pr = [999];
  n.state = 'waiting';
  n.blocker = 'ждём CF Pages';
  writeData(fx, d);

  assert.equal(run(fx, ['--write']).code, 0);
  const r = run(fx, ['--check']);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(/DRIFT/.test(r.stderr), false);
});

test('нет git-истории — проверка молча пропускается, не падает', () => {
  const fx = makeFixture();
  const d = readData(fx);
  const n = d.nodes.find(x => x.id === 'N2');
  n.pr = [999];
  n.state = 'active';
  n.blocker = null;
  writeData(fx, d);
  assert.equal(run(fx, ['--write']).code, 0);

  const notRepo = mkdtempSync(join(tmpdir(), 'roadmap-nogit-'));
  const r = run(fx, ['--check'], notRepo);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(/DRIFT/.test(r.stderr), false);
});
