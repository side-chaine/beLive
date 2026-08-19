#!/usr/bin/env node
/**
 * beLive CDP-клиент (Node >= 22, встроенный WebSocket, без зависимостей)
 * Использование:
 *   node cdp.mjs list                          — список вкладок
 *   node cdp.mjs eval '<JS>'                   — Runtime.evaluate (awaitPromise)
 *   node cdp.mjs shot <out.png>                — Page.captureScreenshot
 *   node cdp.mjs console [secs]                — сбор consoleAPICalled/exceptionThrown
 *   node cdp.mjs upload <file> <selector>      — DOM.setFileInputFiles
 *   node cdp.mjs nav <url>                     — Page.navigate
 *   node cdp.mjs reload                        — Page.reload
 *   node cdp.mjs list
 * Env: CDP_BASE (default http://127.0.0.1:9222), CDP_TAB (default localhost), CDP_TIMEOUT (default 20000)
 */
const CDP_BASE = process.env.CDP_BASE || 'http://127.0.0.1:9222';
const TIMEOUT = parseInt(process.env.CDP_TIMEOUT || '20000', 10);
const [,, cmd, ...args] = process.argv;

let msgId = 0;
const pending = new Map();

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => reject(new Error('WS timeout')), 5000);
    ws.onopen = () => { clearTimeout(timer); resolve(ws); };
    ws.onerror = () => { clearTimeout(timer); reject(new Error('WS error')); };
    ws.onclose = () => {
      for (const [, p] of pending) { clearTimeout(p.timer); p.reject(new Error('WS closed')); }
      pending.clear();
    };
    // базовый обработчик: резолвим pending по id, остальное — в eventHandler
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        clearTimeout(p.timer); pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      } else if (ws._eventHandler) {
        ws._eventHandler(msg);
      }
    };
  });
}

function send(ws, method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, TIMEOUT);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function getTabs(match = 'localhost') {
  const r = await fetch(`${CDP_BASE}/json/list`);
  const tabs = await r.json();
  const tab = tabs.find(t => t.type === 'page' && t.url.includes(match)) || tabs.find(t => t.type === 'page');
  if (!tab) throw new Error('Нет вкладки page');
  return { tabs, tab };
}

async function main() {
  const { tabs, tab } = await getTabs(process.env.CDP_TAB || 'localhost');
  const { writeFileSync } = await import('node:fs');
  const { resolve: rp } = await import('node:path');

  switch (cmd) {
    case 'list': {
      for (const t of tabs) console.log(`[${t.type}] ${t.title} | ${t.url}`);
      break;
    }
    case 'eval': {
      const expr = args.join(' ');
      const ws = await connect(tab.webSocketDebuggerUrl);
      const res = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      ws.close();
      console.log(JSON.stringify(res?.result?.value ?? res?.result ?? res));
      break;
    }
    case 'shot': {
      const out = args[0];
      if (!out) throw new Error('Укажи выходной файл');
      const ws = await connect(tab.webSocketDebuggerUrl);
      const res = await send(ws, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      ws.close();
      writeFileSync(out, Buffer.from(res.data, 'base64'));
      console.log(`SHOT OK: ${out} (${(Buffer.from(res.data, 'base64').length / 1024).toFixed(0)} KB)`);
      break;
    }
    case 'console': {
      const secs = parseInt(args[0] || '5', 10);
      const ws = await connect(tab.webSocketDebuggerUrl);
      const events = [];
      ws._eventHandler = (msg) => {
        if (msg.method === 'Runtime.consoleAPICalled') {
          const { type, args: cargs } = msg.params;
          const text = (cargs || []).map(a => a.value ?? a.description ?? '').join(' ');
          events.push(`[console:${type}] ${text}`);
        } else if (msg.method === 'Runtime.exceptionThrown') {
          events.push(`[exception] ${JSON.stringify(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text)}`);
        } else if (msg.method === 'Log.entryAdded') {
          events.push(`[log:${msg.params.entry.level}] ${msg.params.entry.text}`);
        }
      };
      await send(ws, 'Runtime.enable');
      await send(ws, 'Log.enable');
      await new Promise(r => setTimeout(r, secs * 1000));
      ws.close();
      events.length ? events.forEach(e => console.log(e)) : console.log(`NO console events in ${secs}s`);
      break;
    }
    case 'upload': {
      const [file, selector] = args;
      if (!file || !selector) throw new Error('Использование: upload <file> <selector>');
      const abs = rp(file);
      const ws = await connect(tab.webSocketDebuggerUrl);
      const doc = await send(ws, 'DOM.getDocument', { depth: -1, pierce: true });
      const q = await send(ws, 'DOM.querySelector', { nodeId: doc.root.nodeId, selector });
      if (!q.nodeId) throw new Error(`Инпут не найден: ${selector}`);
      await send(ws, 'DOM.setFileInputFiles', { nodeId: q.nodeId, files: [abs] });
      ws.close();
      console.log(`UPLOADED: ${abs} -> ${selector}`);
      break;
    }
    case 'nav': {
      const url = args[0];
      if (!url) throw new Error('Укажи URL');
      const ws = await connect(tab.webSocketDebuggerUrl);
      await send(ws, 'Page.navigate', { url });
      ws.close();
      console.log(`NAV: ${url}`);
      break;
    }
    case 'reload': {
      const ws = await connect(tab.webSocketDebuggerUrl);
      await send(ws, 'Page.reload', { ignoreCache: true });
      ws.close();
      console.log('RELOADED');
      break;
    }
    default:
      console.log('Неизвестная команда. Доступно: list, eval, shot, console, upload, nav, reload');
      process.exit(1);
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
