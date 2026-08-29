#!/usr/bin/env node
/**
 * check-native-bindings — гейт целостности среды (ADR-0010).
 *
 * Ловит ситуацию «node_modules приехал с другой ОС». Это не теоретика:
 * на машине Windows были найдены только linux-x64 бинари rolldown/rollup/
 * lightningcss/esbuild, из-за чего не работали 5 npm-скриптов из 6,
 * при этом CI (ubuntu) оставался зелёным и никто не замечал поломки.
 *
 * Проверяет:
 *   1. Для каждого нативного пакета с os/cpu в lockfile, подходящего текущей
 *      платформе, — установлен ли он в node_modules?
 *   2. Есть ли в node_modules платформенные пакеты ЧУЖОЙ ОС? (признак привоза)
 *
 * Выход: 0 — ок, 1 — проблемы.
 *
 * Запуск: node scripts/check-native-bindings.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PLATFORM = process.platform;   // 'win32' | 'linux' | 'darwin'
const ARCH = process.arch;           // 'x64' | 'arm64' | ...

// Нормализация: npm называет linux-x64-gnu, но пакет может быть без суффикса libc
const current = { os: PLATFORM, cpu: ARCH };

function matches(entry, { os, cpu }) {
  const eOs = entry.os || [];
  const eCpu = entry.cpu || [];
  const osOk = eOs.length === 0 || eOs.includes(os);
  const cpuOk = eCpu.length === 0 || eCpu.includes(cpu);
  return osOk && cpuOk;
}

const lockPath = path.join(ROOT, 'package-lock.json');
if (!fs.existsSync(lockPath)) {
  console.log('SKIP: нет package-lock.json');
  process.exit(0);
}

const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const packages = lock.packages || {};

const missing = [];   // нужен для этой платформы, но не установлен
const foreign = [];   // установлен, но для другой ОС

for (const [name, meta] of Object.entries(packages)) {
  const hasPlatformConstraint = meta.os || meta.cpu;
  if (!hasPlatformConstraint) continue;

  // Ключи в lockfile уже вида "node_modules/@scope/pkg" — joinим напрямую от корня.
  const installed = fs.existsSync(path.join(ROOT, name));
  const isForThisPlatform = matches(meta, current);

  if (isForThisPlatform && !installed) {
    missing.push(`${name}  (os=${JSON.stringify(meta.os)} cpu=${JSON.stringify(meta.cpu)})`);
  }
  if (!isForThisPlatform && installed) {
    foreign.push(`${name}  (os=${JSON.stringify(meta.os)} cpu=${JSON.stringify(meta.cpu)})`);
  }
}

console.log(`платформа          : ${PLATFORM} / ${ARCH}`);
console.log(`платформенных пакетов в lockfile : ${Object.values(packages).filter((p) => p.os || p.cpu).length}`);
console.log(`не хватает для этой ОС          : ${missing.length}`);
console.log(`чужих ОС в node_modules         : ${foreign.length}`);

let bad = 0;

if (missing.length) {
  bad = 1;
  console.log('\n❌ НУЖЕН для этой платформы, но не установлен (сборка/тесты упадут):');
  for (const m of missing) console.log(`   ${m}`);
  console.log('\n   Лечение: rm -rf node_modules && npm ci');
}

if (foreign.length) {
  bad = 1;
  console.log('\n❌ Установлены бинари ЧУЖОЙ ОС — node_modules привезён, а не установлен:');
  for (const f of foreign) console.log(`   ${f}`);
  console.log('\n   Лечение: rm -rf node_modules && npm ci');
  console.log('   Причина: копирование node_modules между машинами или синк через облако.');
}

if (bad === 0) {
  console.log('\n✅ Нативные бинари соответствуют платформе.');
}
process.exit(bad);
