# MICRO-PACK M2-AVATAR (Mac-007 / frontend) — draft

> Роль: F001 Со-Архитектор · Far Light beLive
> Режим: READ-ONLY `src/` · design-only MICRO-PACK · НЕ править src напрямую
> Статус: DRAFT · не коммитить

## §0 Инвентарь (что есть в src)

| Артефакт | Путь | Роль |
|---|---|---|
| Store | `src/avatar/avatar.store.ts` | Zustand: `state`, `mode`, `preset` + `setState`/`setMode`/`setPreset` |
| FullAvatar | `src/avatar/FullAvatar.tsx` | tier max/ultra, audio-reactive, PVS |
| FallbackAvatar | `src/avatar/FallbackAvatar.tsx` | lite/balanced, CSS-only, 0 re-render |
| AvatarEngine | `src/avatar/AvatarEngine.tsx` | tier-gate: allowAvatar → Full/Fallback |
| CSS | `src/avatar/avatar.css` | data-state селекторы + keyframes |
| Ассеты | `src/avatar/avatar.assets.ts` | `AVATAR_PRESETS` (svg) |

**Ключевой факт (проверено):** в `avatar.store.ts` поля `celebrateUntil` НЕТ. Ошибка подтверждена — биндимся исключительно к существующему `setState(state: AvatarStateId)` и DOM-атрибуту `data-state`.

---

## §1 Visual states (union `AvatarStateId`)

Источник: `avatar.store.ts:6`
```ts
export type AvatarStateId = 'idle' | 'happy' | 'listening' | 'sing' | 'error' | 'reactive';
```

| State | Визуал (CSS `avatar.css`) | Статус биндинга в коде |
|---|---|---|
| `idle` | `--rx-scale:0.3`; sway + blink | ✅ дефолт `data-state="idle"` (Full/Fallback :150/:102) |
| `happy` | `--rx-scale:1.5`; happy-bounce ×3; улыбка `d:path(...)` | ✅ feed(like/react/comment) + `ASSISTANT_RESPONSE_COMPLETED` |
| `listening` | `--rx-scale:1`; tilt + focus | ✅ `ai.isStreaming===true` |
| `sing` | audio-reactive рот (`--bl-audio-bass`) | ✅ `ai.isStreaming===false` (Full :120, Fallback :72) |
| `error` | `--rx-scale:0.5`; error-shake ×3; рот `scaleY(0.1)` | ⚠️ CSS есть, но **нигде нет `setState('error')`** — не забинден |
| `reactive` | ❗ в union, но в CSS реализован НЕ как `data-state`, а как отдельный атрибут `data-reactive="beat"` (`.av-container[data-reactive="beat"] .av-body` → `reactive-pulse`) | ⚠️ `setState('reactive')` никто не вызывает; `reactive` как data-state фактически «мёртв» в union |

> Парадокс зоны: `reactive` и `error` объявлены в типе и/или CSS, но не имеют живого `setState`-
> вызова. Для M2 landing это либо dead-type (reactive), либо unbound-state (error).
> Решение — см. §4/§6.

---

## §2 avatar.css — добавления (набросок)

Существующий CSS уже покрывает `idle/happy/listening/sing/error` через `[data-state="..."]`
и `reactive` через `[data-reactive="beat"]`. Достаём:

**(A) Плавные переходы между состояниями** — добавить в `.av-container`:
```css
.av-container {
  transition:
    --rx-scale 0.25s ease,
    transform  0.25s ease;
}
.av-container .av-body,
.av-container .av-mouth-path {
  transition:
    transform 0.2s ease,
    d          0.2s ease;   /* morph path idle→happy→error */
}
```

**(B) Привести `reactive` к единому контракту `data-state`** (чтобы union и DOM совпали):
```css
/* reactive как самостоятельный data-state (зеркало data-reactive overlay) */
.av-container[data-state="reactive"] {
  --rx-scale: 1.1;
}
.av-container[data-state="reactive"] .av-body {
  animation: reactive-pulse 0.15s ease infinite;
}
```
> Старый `[data-reactive="beat"]` оставляем как beat-overlay (Frozen-check §5 — не трогать
> audio-reactive.bridge), НО добавляем `data-state="reactive"` как честный union-member.

**(C) Гарантия G1 — happy не гаснет при ошибке тула:**
```css
/* happy имеет приоритет яркости над error-димом: ошибка НЕ гасит празднование */
.av-container[data-state="happy"] { opacity: 1; filter: none; }
.av-container[data-state="error"] { opacity: 0.85; }
/* если одновременно error + happy-мод (класс-флаг), happy wins */
.av-container.is-celebrating[data-state="error"] { opacity: 1; }
```

---

## §3 UX-MAP (триггер → состояние → анимация)

| Триггер (источник) | Состояние | Анимация | Якорь |
|---|---|---|---|
| Feed `like` / `react` / `comment` | `happy` (TTL 30s) | happy-bounce ×3 + улыбка | `FallbackAvatar.tsx:45-52`, `FullAvatar.tsx:93-100` |
| `ASSISTANT_RESPONSE_COMPLETED` (Billy/Expert cue) | `happy` на ~700ms | happy-bounce + re-assert через `setTimeout(apply,0)` | `FallbackAvatar.tsx:84`, `FullAvatar.tsx:132` |
| `ai.isStreaming === true` | `listening` | tilt + focus | `FallbackAvatar.tsx:72`, `FullAvatar.tsx:120` |
| `ai.isStreaming === false` (Full tier) | `sing` | audio-reactive рот `--bl-audio-bass` | `FullAvatar.tsx:120` |
| audio beat (PVS) | overlay `data-reactive="beat"` (не меняет data-state) | reactive-pulse | `avatar.css:83` |
| нет события / stale >30s | `idle` | sway + blink | оба компонента |
| **ошибка тула** | `error` — **НЕ забинден** (см. §4) | error-shake (пока недостижим) | `avatar.css:71`, вызова нет |

> Billy/Expert cue → happy идёт через `aiHub.on(ASSISTANT_RESPONSE_COMPLETED)` (не прямой
> вызов store из billy). Прямых `useAvatarStore` в `src/billy/*` нет (grep: 0 совпадений) —
> связь опосредована AI-стримингом и feed-событиями.

---

## §4 data-state биндинг к существующему `store.setState`

Контракт (не менять): `avatar.store.ts:18` `setState: (s: AvatarStateId) => void;`
реализация `avatar.store.ts:28` `setState: (state) => set({ state })`.

Оба компонента уже делают двойной биндинг — DOM + store (pattern «direct DOM, 0 re-render»):
```ts
el.setAttribute('data-state', mood);  // FullAvatar.tsx:109 / FallbackAvatar.tsx:61
setState(mood);                       // FullAvatar.tsx:110 / FallbackAvatar.tsx:62
```

**old → new (дизайн-предложение, НЕ править src):**

1. **Bind `error`** — добавить в оба `useEffect` подписки на событие ошибки тула
   (через новый `feed`/`runtime` event, аналогично `lastEvent`):
   ```ts
   // new (после switch event.type):
   case 'tool-error': mood = 'error'; break;
   el.setAttribute('data-state', mood); setState(mood);
   ```
   Якорь для вставки: `FallbackAvatar.tsx:45-58`, `FullAvatar.tsx:93-106`.

2. **Bind `reactive` как data-state** — либо оставить `reactive` только как
   `data-reactive="beat"` (рекомендую: убрать из union как dead-type), либо добавить
   `setState('reactive')` при beat-пиках в PVS-writer (`FullAvatar.tsx:63-68`).
   Рекомендация M2: **убрать `reactive` из union** (он дублирует `data-reactive` overlay)
   или задокументировать как опциональный.

3. **G1-guard** — в `onCompleted` уже есть re-assert `setTimeout(apply,0)` перекрывающий
   подписку isStreaming. Чтобы ошибка тула не погасила happy, добавить приоритет:
   ```ts
   // новый флаг-класс на 700ms празднования
   el.classList.add('is-celebrating');
   setTimeout(() => el.classList.remove('is-celebrating'), 700);
   ```
   Якорь: `FallbackAvatar.tsx:80-96`, `FullAvatar.tsx:128-144`.

---

## §5 Frozen-check (НЕ трогать)

- ❌ Не добавлять поле `celebrateUntil` в `avatar.store.ts` (его нет — ошибка исключена).
- ❌ Не трогать `audio/bridges/*` — `--bl-audio-*` пишет `audio-reactive.bridge.ts`,
  `sing`-рот читает через CSS-cascade (Frozen).
- ❌ Не трогать `data-reactive="beat"` overlay (beat-pulse от PVS) — он вне scope M2.
- ❌ Не менять `getPlaybackVisualScheduler()` регистрацию (FullAvatar :70-71).
- ❌ Не менять `AVATAR_PRESETS` svg-ассеты и структуру `.av-svg/.av-body/.av-mouth-path`.
- ❌ Не менять `AvatarMode`/`AvatarPresetId` union и tier-gate в `AvatarEngine.tsx`.
- ✅ Трогаем ТОЛЬКО: добавление CSS-селекторов `data-state="reactive"` + transitions + `.is-celebrating`
  и (опц.) `case 'tool-error'` в двух switch + класс-флаг в `onCompleted`.

---

## §6 Verify

**Статический анализ (design-only, не запускать в src):**
- `tsc` (проект ~313 файлов): добавление `case 'tool-error'` и `data-state="reactive"` —
  типобезопасно, т.к. `AvatarStateId` уже включает `'error'`; `reactive` уже в union.
  Новых типов не вводим → 0 новых ошибок типов.
- `vitest` (проект ~769 тестов): новый CSS/класс-флаг не ломает существующие avatar-тесты
  (если есть `src/avatar/__tests__` — добавить smoke-тест на `data-state` после feed-event).

**Визуальный прогон — G1 (критерий):**
> Аватар `happy` НЕ гаснет (opacity/filter) при ошибке тула.
- Сейчас `error` не забинден → happy физически нечем погасить (G1 зелёный «по умолчанию»).
- После бинда `error` (§4.1) + CSS `.is-celebrating[data-state="error"]{opacity:1}` (§2C)
  G1 остаётся зелёным: 700ms празднования перекрывают error-дим за счёт класс-флага.

**Чек-лист перед коммитом (кем-то другим):**
- [ ] `npx tsc --noEmit` чисто
- [ ] `npx vitest run src/avatar` зелёно
- [ ] Ручной прогон: Billy/Expert cue → аватар happy ~700ms, затем ошибка тула → happy НЕ гаснет

---
*DRAFT · design-only · не коммитить. Автор: F001 Со-Архитектор.*
