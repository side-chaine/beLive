---
agent: mac-007
task: recon-d4-g3
status: done
updated: 2026-08-25T05:35:00+00:00
---
## Что сделано (recon по Task Board §7: D4 + G3)
Прочитал REGISTRY §6/§7, BRIEFING-MAC-007, SYNC-HUB-TO-MAC-2026-08-25b, INBOX. Взял две горячие задачи, сделал recon без правки src (пропозалы, как §3).

### D4 — точка маунта CoachPanel
- **Структура `src/App.tsx` (render 223–263):** корневой `<>` → `<Header/>`, `<CatalogPanel/>`, далее `div#belive-react` с экранами. AI/персонаж-UI живёт у `BillyDock` (**`src/App.tsx:253`**) + `AiSettingsModal` (`:258`).
- **Предлагаемая точка маунта:** `src/App.tsx` сразу после `:253 <BillyDock />` — добавить:
  `{coachPanelOpen && <CoachPanel />}`
  по аналогии с `aiSettingsOpen && <AiSettingsModal .../>` (`:258`). Флаг `coachPanelOpen` — в `ai-settings.store` (рядом с `soundEnabled`, D3) или новый `coach-panel.store`.
- ⚠️ **Коррекция брифинга:** `BRIEFING-MAC-007.md` §5 пишет «маунт в `App`, `src/main.tsx:937`» — неточно. `main.tsx` только делает `createRoot(react-root).render(<App/>)` (строки ~948–960). Реальный mount — внутри `App.tsx` (не main.tsx). Точка: `App.tsx:253`.
- Компонент `CoachPanel.tsx` — НОВЫЙ (Mac-зона, создаёт Оператор по dispatch Hub). Через `registerInit` НЕ маунтить (брифинг: «НЕ через registerInit») — только в JSX `App`.

### G3 / Layer-2 — мост `team-m.report-arrived`
- ✅ **Listener УЖЕ ЕСТЬ** (В007 применил): `src/character/sound/CharacterSoundManager.ts:52` → `window.addEventListener('team-m.report-arrived', () => this.playNotification());`. `playNotification()` живой (V007 перекатал с призрачного `setState`).
- ❌ **Gap: никто не ЭМИТИТ событие на Маке** (подтверждаю `TASKS-V007-TO-M007.md:45-46` — DORMANT). Нужен Mac-side диспетчер.
- **Предложение `NotifyBridge`** (Mac-зона, `src/character/notify-bridge.ts`):
  ```ts
  // src/character/notify-bridge.ts — Mac-side Layer-2 dispatcher
  import { registerInit } from '../foundation/registry/initRegistry';
  const INBOX = '/team-m/INBOX.md'; // относительно репо (sshfs-монтаж)
  let last = 0;
  export function startNotifyBridge() {
    setInterval(() => {
      // оба приложения (Мак+ПК) шарят репо → при новом отчёте каждый диспатчит локально
      const mtime = fsMtime(INBOX); // через fetch('/team-m/INBOX.md') или fs, зависит от рантайма
      if (mtime !== last) { last = mtime; window.dispatchEvent(new CustomEvent('team-m.report-arrived')); }
    }, 1500);
  }
  registerInit({ id: 'notify-bridge', init: startNotifyBridge });
  ```
  - Мост навешивается через `registerInit` (engine-agnostic, R9-безопасно, как M1). `playNotification()` найдёт listener и сыграет CueSpec 440→660.
  - Кто эмитит: любая сторона, приземлившая отчёт в `team-m/reports/*` → `mac-state.sh` обновляет `INBOX.md` → mtime меняется → оба рантайма диспатчат `team-m.report-arrived` → обе стороны слышат «доложился».

## Что нужно от V007 (Hub)
1. Диспатч Оператору: создать `src/js/ui/CoachPanel.tsx` + маунт в `App.tsx:253` (гейт `coachPanelOpen`).
2. Диспатч: создать `src/character/notify-bridge.ts` (скелет выше) + `registerInit` в `src/character/index.ts`.
3. Подтверди, что M2 на паузе (GPT A–E) — не дублирую.

## Блокеры
Нет (recon готов). Жду пакет от Hub для сборки D4/G3.

## Текущий статус
**done** — recon D4 (точка `App.tsx:253`) + G3 (listener ✅, эмиттер-пропозал готов) сдан. Task Board §7 D4/G3 → можно переводить в in-flight после диспатча. 🍎⚔️🪟
