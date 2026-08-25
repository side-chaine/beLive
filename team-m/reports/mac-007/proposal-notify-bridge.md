---
agent: mac-007
task: proposal-notify-bridge
status: wip
updated: 2026-08-25T06:10:00+00:00
---
# ПРОПОЗАЛ G3 (Layer-2) — NotifyBridge (Mac-зона, применяет Оператор по dispatch Hub)

## 1. Listener УЖЕ ЕСТЬ (В007 применил)
`src/character/sound/CharacterSoundManager.ts:52`:
```ts
window.addEventListener('team-m.report-arrived', () => this.playNotification());
```
`playNotification()` живой (В007 перекатал с призрачного `setState`). CueSpec ~440→660.

## 2. Gap: никто не ЭМИТИТ (DORMANT, подтверждено TASKS-V007-TO-M007.md:45-46)
Нужен Mac-side диспетчер, который при новом отчёте Мака шлёт `team-m.report-arrived`.

## 3. Пропозал — `src/character/notify-bridge.ts` (НОВЫЙ, Mac-зона)
Браузерный рантайм → поллит `INBOX.md` через `fetch` (без node `fs`), сравнивает mtime
(Last-Modified) с фолбэком на etag.
```ts
// src/character/notify-bridge.ts — Mac-side Layer-2 dispatcher
import { registerInit } from '../foundation/registry/initRegistry';

const INBOX_URL = '/team-m/INBOX.md';
let lastSig = '';

async function pollInbox() {
  try {
    const res = await fetch(INBOX_URL, { method: 'HEAD', cache: 'no-store' });
    const sig = res.headers.get('last-modified') || res.headers.get('etag') || '';
    if (sig && sig !== lastSig) {
      if (lastSig) window.dispatchEvent(new CustomEvent('team-m.report-arrived'));
      lastSig = sig;
    }
  } catch {
    /* монтаж недоступен — тихо */
  }
}

export function startNotifyBridge() {
  fetch(INBOX_URL, { cache: 'no-store' })
    .then((r) => r.headers.get('last-modified') || r.headers.get('etag') || '')
    .then((s) => (lastSig = s));
  setInterval(pollInbox, 1500);
}

registerInit({ id: 'notify-bridge', init: startNotifyBridge });
```

## 4. Проводка (Оператор)
В `src/character/index.ts` добавить импорт-сайдэффект, чтобы `registerInit` сработал:
```ts
import './notify-bridge';
```
(рядом с другими `registerInit`-модулями, как в M1 — engine-agnostic, R9-безопасно).

## 5. Контракт события
Любая сторона, приземлившая отчёт в `team-m/reports/*` → `mac-state.sh` обновляет `INBOX.md`
(mtime меняется) → оба рантайма (Мак+ПК) диспатчат `team-m.report-arrived` → обе стороны
слышат «доложился» (CharacterSoundManager → playNotification).

## Статус
wip — пропозал готов, ждёт диспатч Оператору (Hub). Frozen Zone не затронут.
