# MICRO-PACK · MR-3 «Каркас комнаты + Эта неделя + Продолжить» (этап 3)
**2026-10-24 · 007 · для operator · вход: SPEC v1.1 §4 + §6 (этап 3) · этапы 1-2 приняты**

> Правило Босса: проверяем на `http://127.0.0.1:3000/beLive/` (живой Vite, HMR). Пуш/коммит — запрещены.
> Текущее состояние (скрины Босса 24.10): комната = модалка 360px с бэкдропом; в меню пункт «🏠 Комната / Profile».

## 0. ГЕЙТЫ
- До: tsc=181 · build=0 · vitest 904/76.
- После: tsc ≤181 (новых 0) · build exit 0 · vitest 904+N, 0 failed · HTTP 200 на :3000/beLive/.
- Не трогать: metrics.store (App.tsx:67), session-SP, audio/engine-v3, catalog, theme.

## 1. ФАЙЛЫ
1. `src/components/profile/UserRoom.tsx` — каркас-экран + сборка секций
2. `src/components/profile/UserRoom.css` — экран вместо модалки
3. `src/components/profile/room/WeekStrip.tsx` — NEW (пропсы, без сторов)
4. `src/components/profile/room/ContinueCard.tsx` — NEW (пропсы)
5. `src/components/profile/room/useJournal.ts` — NEW (загрузка + обновление по событиям)
6. `src/components/profile/room/__tests__/room.test.tsx` — NEW (2 теста)
7. `src/services/practice-journal/aggregate.ts` — `ContinueTarget` += `scenarioId: string | null`; `lastSession` его отдаёт
8. `src/components/QuickActions.tsx` — убрать подпись «Profile» у пункта «🏠 Комната» (:485)

## 2. КАРКАС (UserRoom.tsx/.css)
- Корень: `<div className="bl-userroom-screen">` — **без** onClick-закрытия и без бэкдропа.
- CSS: `position:fixed; top:var(--react-header-height,64px); bottom:var(--bl-deck-height,268px); left:0; right:0; background:var(--bl-surface-base,#0a0a14); z-index:999990; display:flex; flex-direction:column; overflow:hidden;`
  → хедер (999996) и дек (999995) остаются живыми и кликабельными.
- Верхняя строка: кнопка «← В студию» (setSurface('app')) + `<h2>Комната</h2>`.
- Скролл: внутренний `<div className="bl-userroom-scroll">` с `overflow-y:auto; padding:24px`; страница не прыгает.
- Контент: `.bl-userroom-content { max-width:1100px; margin:0 auto; display:grid; gap:16px; }`
- Мобильный `@media (max-width:768px)`: одна колонка, padding 12px, всё на всю ширину.
- Esc закрывает (текущий обработчик UserRoom.tsx:39-45 сохранить).
- Старые стили `.bl-userroom-overlay` (backdrop/blur/animation) — удалить/заменить; `.bl-userroom` больше не 360px-карточка.

## 3. WeekStrip (props)
```tsx
interface Props { stats: WeekStats }
```
- 3 числа: `minutes` («мин в репетиции»), `runs` («прогонов»), `streak` («дней подряд»).
- Спарклайн: 7 столбиков из `stats.spark` (высота нормализуется к максимуму; нули — минимальная высота).
- Empty: `runs===0` → числа 0 + подпись «Проведи первую репетицию — здесь появится неделя».
- Без сторов и эффектов — чистая презентация.

## 4. ContinueCard (props)
```tsx
interface Props { target: ContinueTarget | null; currentTrackId: string | null; onContinue: () => void }
```
- `target===null` → компонент не рендерится (или null).
- Показывает: трек (`trackTitle`), блок (`blockType`/`blockId`), темп (`rate`), «▶ ВЕРНУТЬСЯ».
- Кнопка активна только если `currentTrackId === target.trackId`; иначе disabled + hint «Открой этот трек, чтобы продолжить».
- `onContinue` в контейнере: `usePracticeStore.getState().startPractice(target.scenarioId!, undefined, undefined, target.blockId ?? undefined)`.

## 5. useJournal (контейнер)
```ts
useJournal(ownerId: string) → { sessions, passes, week: WeekStats, last: ContinueTarget | null, loading: boolean, refresh: () => void }
```
- `ownerId = currentUser?.id ?? 'guest'`.
- Загрузка: `getAllForOwner(ownerId)` → split по `kind` → `weekStats(sessions)` + `lastSession(sessions)`.
- Обновление: `document.addEventListener` на `practice:ended`, `practice:completed-kept` → `refresh()` (после записи журнала; порядок слушателей не важен — refresh в микротаске `setTimeout 0`).
- `loading` только до первой загрузки; ошибки IDB → пустые данные (не падать).

## 6. Тесты (room.test.tsx, 2 кейса)
1. `WeekStrip` с `runs:0` → видит «0» и текст «Проведи первую репетицию».
2. `ContinueCard` с target и совпадающим trackId → кнопка «▶ ВЕРНУТЬСЯ» enabled; при чужом trackId → disabled.
(Рендер через `@testing-library/react`, без IDB и без сторов.)

## 7. Меню
- `QuickActions.tsx:485` — удалить `<span ...>Profile</span>` (дубль «профиль/комната»). Пункт остаётся «🏠 Комната».
- FeedScreen.tsx:50 («Профиль» в колонке ленты) — **НЕ трогать в этом этапе** (там же кнопка сворачивания колонки); решение за Боссом, вынесено в отчёт.

## 8. Приёмка (проводит 007)
- [ ] tsc ≤181 (0 новых)
- [ ] vitest: 904+N, 0 failed
- [ ] build exit 0
- [ ] live: `curl :3000/beLive/` → 200; страница открывается
- [ ] визуальный смоук (скрин): комната — экран, хедер и транспорт ВИДНЫ и не перекрыты; скролл внутри; на узком вьюпорте — одна колонка
- [ ] Esc и «← В студию» закрывают; клик по фону ничего не делает
- [ ] в меню нет «Profile», есть «🏠 Комната»
- [ ] diff — только файлы §1

## 9. НЕ ДЕЛАТЬ
❌ TempoList (этап 4) ❌ миграция гостя/настройки (этап 5) ❌ правки схемы IDB ❌ новые зависимости ❌ сервер ❌ коммит/пуш
