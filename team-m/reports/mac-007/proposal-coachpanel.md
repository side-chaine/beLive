---
agent: mac-007
task: proposal-coachpanel
status: wip
updated: 2026-08-25T06:10:00+00:00
---
# ПРОПОЗАЛ D4 — CoachPanel (Mac-зона, применяет Оператор по dispatch Hub)

## 1. Точка маунта (уточнено recon)
`src/App.tsx:253` — после `{!showActive && !featureActive && <BillyDock />}` добавить:
```tsx
{coachPanelOpen && <CoachPanel onClose={() => useCoachPanelStore.getState().setOpen(false)} />}
```
(аналог `aiSettingsOpen && <AiSettingsModal .../>` на `:258`).

## 2. Флаг состояния — новый стор (Mac-зона)
Новый файл `src/js/stores/coachPanel.store.ts`:
```ts
import { create } from 'zustand';
interface CoachPanelState {
  open: boolean;
  setOpen: (v: boolean) => void;
}
export const useCoachPanelStore = create<CoachPanelState>((set) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
}));
```
В `src/App.tsx` добавить импорт стора и `coachPanelOpen`:
```ts
import { useCoachPanelStore } from './js/stores/coachPanel.store';
const coachPanelOpen = useCoachPanelStore((s) => s.open);
```

## 3. Компонент CoachPanel (НОВЫЙ, Mac-зона)
Новый файл `src/js/ui/CoachPanel.tsx` — стартовый каркас (UI/CSS Мака), без правки Frozen:
```tsx
import React from 'react';

export function CoachPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="coach-panel" role="dialog" aria-label="Coach Panel">
      <header className="coach-panel__head">
        <span>Coach</span>
        <button onClick={onClose} aria-label="close">×</button>
      </header>
      <div className="coach-panel__body">
        {/* Mac-зона: сюда лягут подсказки/разбор от сабагентов 001/002/009 */}
      </div>
    </div>
  );
}
```
Маунт — ТОЛЬКО в JSX `App.tsx` (НЕ через `registerInit`, согласно брифингу).

## 4. Коррекция брифинга
`BRIEFING-MAC-007.md §5` пишет «маунт в `App`, `src/main.tsx:937`» — неточно: `main.tsx` только `createRoot(...).render(<App/>)`. Реальный mount — `src/App.tsx:253`.

## Статус
wip — пропозал готов, ждёт диспатч Оператору (Hub). Frozen Zone не затронут.
