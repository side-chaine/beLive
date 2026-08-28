#!/usr/bin/env node
// boot-smoke.mjs — boot-smoke CDP V1/V5 для гейта волн срезки Легаси (beLive)
// Hub (007_Винда). Read-only по репо; гоняет dev-сервер с VITE_ENGINE и ловит фатальные ошибки.
// Запуск:  node team-m/bLb/boot-smoke.mjs            (оба режима: v2 и v3)
//          node team-m/bLb/boot-smoke.mjs v2         (только legacy)
//          node team-m/bLb/boot-smoke.mjs v3         (только V3)
// Требует: npx playwright install chromium  (один раз)
import { spawn } from 'node:child_process';
import http from 'node:http';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5199;
const URL = `http://localhost:${PORT}/`;

function waitForPort(port, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: 'localhost', port, path: '/' }, res => { res.destroy(); resolve(); });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('server timeout'));
        else setTimeout(tick, 500);
      });
    };
    tick();
  });
}

async function runOnce(mode) {
  const env = { ...process.env, VITE_ENGINE: mode };
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT, env, stdio: ['ignore', 'ignore', 'ignore'],
  });
  let result = { mode, mounted: false, errors: [], fatal: null };
  try {
    await waitForPort(PORT, 90000);
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500); // дать монтироваться реакту + аудио-инит
    result.mounted = await page.evaluate(() => (document.querySelector('#root')?.childElementCount ?? 0) > 0);
    result.errors = errors;
    await browser.close();
  } catch (e) {
    result.fatal = String(e && e.message || e);
  } finally {
    server.kill('SIGTERM');
  }
  return result;
}

const modes = process.argv[2] ? [process.argv[2]] : ['v2', 'v3'];
let allOk = true;
for (const m of modes) {
  const r = await runOnce(m);
  const fatal = r.fatal ? `FATAL: ${r.fatal}` : '';
  const consoleErrs = r.errors.length ? `console.errors=${r.errors.length} [${r.errors.slice(0,3).join(' | ')}]` : 'no console errors';
  const ok = !r.fatal && r.mounted && r.errors.length === 0;
  allOk = allOk && ok;
  console.log(`[boot-smoke ${m}] ${ok ? '✅ GREEN' : '🔴 RED'}  mounted=${r.mounted}  ${consoleErrs} ${fatal}`);
}
process.exit(allOk ? 0 : 1);
