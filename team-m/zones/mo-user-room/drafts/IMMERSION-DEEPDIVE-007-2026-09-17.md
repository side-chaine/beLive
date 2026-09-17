# IMMERSION-DEEPDIVE · user-room семья · 2026-09-17
**Автор: 007 (разведка/упаковка).** NOT MO-user-room — роль владельца вакантна.
Это глубокое погружение по §2 вопроса 004 (IMMERSION-REPORT-2026-09-17.md): слепая вертикаль metrics.store,
карта полей/потребителей user-profile.store, зонный слой. Read-only: **0 правок src/**, frozen-зоны не тронуты.

---

## §1 СЕМЬЯ — перемерено 17.09

| файл | LOC | класс | персист |
|---|---|---|---|
| `src/stores/metrics.store.ts` | 122 | L3-ядро | zustand persist → **localStorage** `belive:metrics` v1 |
| `src/stores/user-profile.store.ts` | 227 | L3-ядро | zustand persist → **localStorage** `belive:user-profile` v2 (migrate v1→v2) |
| `src/components/profile/UserRoom.tsx` | 292 | зонный слой | — |
| `src/services/metrics-sync.service.ts` | 134 | стык-провод | — |

**Уточнение хэндофа:** «idb.service (персист)» — **неточно** для этих ядер. idb.service = слой персиста
track/catalog/show/cover-art семейств (upload.service, track.loader, catalog.store…), оба ядра user-room
живут на localStorage через zustand-persist. idb — сосед, но не их персист-слой.

---

## §2 🔴 metrics.store — «СЛЕПАЯ ВЕРТИКАЛЬ» = ПОДТВЕРЖДЕНА ПОЛНОСТЬЮ

### 2.1 Карта writers (grep вызовов actions по всему src/)

| action | внешние вызыватели | статус |
|---|---|---|
| `incrementRehearsal` | **0** | 💀 мёртв |
| `incrementPractice` | **0** | 💀 мёртв |
| `setExercisesCompleted` | **0** | 💀 мёртв |
| `addPlayTimeMs` | **0** | 💀 мёртв |
| `recomputeGenres` | **0** | 💀 мёртв |
| `touchLastActive` | 0 (только внутри increment* — самих мёртвых) | 💀 мёртв |
| `recomputeStreak` | 0 (только из touchLastActive) | 💀 мёртв |
| `setElo` | 1 — `metrics-sync.service.ts:85` | ⚠️ ед. живой, но недостижим (см. 2.3) |

**7 из 8 actions не имеет ни одного вызывателя.** Шапка магазина врёт: `Actions (called ONLY by metrics.bridge, NEVER by UI)` (:44) — единственному писцу, которого она декларирует, **больше не существует**.

### 2.2 Корень — metrics.bridge RETIRED без замены

`App.tsx:67` — `// retired: metrics.bridge → metrics data frozen in store`
`App.tsx:104` — `// const cleanupMetrics = initMetricsBridge();  // retired`

Это часть волны退休-мостов (Фаза 4, :92–104): audio/lyrics/sync/stem-reactive/text-style/takes/exercise/monitor/performance → ушли в `main.tsx` event-bus wrappers. **Все, кроме metrics, получили замену-обёртку.** metrics.bridge снесли, а `metrics-events` wrapper не создали — провод оборвался и висит. Сосед-омоним: `markers-events.ts:43 scheduleSyncForTrack` — **маркеры** (polling markerManager), к metrics-sync никакого отношения не имеет; имя вводит в заблуждение.

### 2.3 Исходящий синк тоже мёртв → elo = 1500 навсегда

- `scheduleSync()` (`metrics-sync.service.ts:28`) — **0 вызывателей** в src/ (grep по всему дереву).
- `initSyncLifecycle()` вызывается (`App.tsx:105`), но его единственное тело — `onOnline`: `if (pendingDirty) scheduleSync()`. `pendingDirty` становится true **только внутри** scheduleSync, который никто не зовёт, → `onOnline` мёртв, `executeSync` никогда не стартует, `fetch('/api/metrics/sync')` никогда не летит, `setElo(data.elo)` (`:85`) никогда не дойдёт до store.
- **Следствие:** `elo` стоит на дефолте **1500** (metrics.store:39) всегда. Вся полезная нагрузка синка (rehearsals/practiceSessions/exercisesCompleted/totalPlayTimeMs/genres) уходит нулями — даже если бы синк ожил.

### 2.4 Reader: карточка жива, но никогда не наполнится

`src/feed/ProfileStats.tsx` (монтирован в `feed/FeedScreen.tsx:56`):
- читает `rehearsals` (:48), `exercisesCompleted` (:49), `topGenre` (:50), `elo` (:51) + `tracksMeta.length` из track.store (:47);
- принцип `// no mock data. Cells visible only when counter > 0` (:2), earned-ячейки рисуются **только если счётчик > 0** (:59–61);
- так как счётчики не инкрементятся — «Репетиций» / «Упражнений» / «Жанр» **никогда не появятся**. Вечно видны ровно 2 ячейки: `ELO 1500` (замороженный дефолт) и `Треков N` (живой, из track.store — единственный живой сигнал карточки).

### 2.5 Баг логики streak (независимо от мёртвых writers)

`touchLastActive` (:74): `set({lastActiveAt: now})` → **потом** `get().recomputeStreak()` (:77). recomputeStreak (:80) читает уже-обновлённое `lastActiveAt` → `diffDays === 0` → streak unchanged. Ветвь `diffDays === 1` (:91) **недостижима по построению**. streakDays может измениться только если recomputeStreak вызвать со свежим lastActiveAt — а такого вызывателя нет. OnRehydrate (:115) тоже гонит только `hasAnyData`, не streak.
Плюс `hasAnyData` пересчитывается **только** onRehydrate — после любого action стейлится.

### 2.6 Источник репетиций существует — провод не построен

`usePracticeStore` (`src/stores/practice-session.store.ts`, жив, 194+) — движок практики: `startPractice/endPractice/pausePractice/cancelPractice/completeAndKeep/passesCount` — потребляется ControlDeck, AiExpertPanel, ai-tools, StructureDiagram, PracticeSessionCard. **Но он НИКОГДА не зовёт** `incrementRehearsal/incrementPractice` (grep → 0). Гипотеза хэндофа «пишут из practice-событий» → **частично верна по духу, ложна по факту**: источник правды есть (завершённая практика = rehearsal), а провода practice→metrics **нет в природе** — ни через мост (снесён), ни через шину, ни напрямую.

> **Итог §2:** metrics.store — полностью замороженный read-only склад с момента退休 metrics.bridge. Вся «карточка видения» (:33-41) — нули и дефолт 1500.

---

## §3 user-profile.store — ядро ЖИВО, но migration split-brain

### 3.1 Поля/потребители (60 проводов — здоровое ядро)

| группа полей | писцы/читцы |
|---|---|
| auth (`currentUser/isLoggedIn/isGuest/isReturning`) | `App.tsx:147,148,168` · `auth.service.ts:14,44,108,110` (createProfile guest + createOAuthProfile) |
| feed-токен `authToken` | `feed-data.store.ts` ×9 (:12,132,198,241,400,461,503,530,568) · `belive.provider.ts:64,65` · `mvsep.service.ts:172` |
| `currentUser` (UI) | `CommentsPanel.tsx:55` · `FeedPostCard.tsx:43` · `PostComposer.tsx:30` · `QuickActions.tsx:318-320` · `billy/context-builder.ts:11` |
| `isGuest` | `AiSettingsModal.tsx:20` · `mvsep.service.ts:77` · `metrics-sync.service.ts:45` |
| `mvsepApiKey` | `UserRoom.tsx:19,127,158` · `mvsep.service.ts:57,183` · `setMvsepApiKey` — живой |
| onboarding | `setCatalogOnboardingComplete`/`setOnboardingProgress` (migrate v1→v2 :189-201) |

### 3.2 🔴 FINDING: миграция surface «Фаза 4» инвертирована

`app.store.ts:6` — `@deprecated Используйте useUserProfileStore (surface, authChecked, setSurface, setAuthChecked). Мигрировано — Фаза 4`.
Факт: **все живые потребители — на «депрекейтнутом» app.store**; дубль в user-profile.store — мёртв:

| потребитель | берёт из |	user-profile-аналог |
|---|---|---|
| `App.tsx:85,86,152,153,159,160` | useAppStore | мёртв |
| `auth.service.ts:15,16,115,116` | useAppStore | мёртв |
| `deep-link.service.ts:64` | useAppStore | мёртв |
| `QuickActions.tsx:317,480` | useAppStore | мёртв |
| `UserRoom.tsx:11,42,50,58,60` | useAppStore | мёртв |
| `smoke.test.ts:21,33,36` + `app.store.test.ts` | useAppStore | — |

`user-profile.store.setSurface/setAuthChecked` (:184-185) — **0 живых вызывателей**. Итого **два источника правды для `surface`**, причём «устаревший» — настоящий. Дополнительно: `partialize` (:202-214) **не включает** surface/authChecked — если кто-то начнёт читать их из user-profile.store, после reload они сбросятся на `'welcome'` (zustand-слияние с initialState).

---

## §4 Зонный слой UserRoom.tsx (292 LOC)

- аватар/имя — живые (`:53-55` avatarContent, `:81` имя) — хэндоф-указание :53-55 **точно**;
- секции: `Настройки — "скоро..."` (:88-91) · `MVSEP API Key` — **живой UI** (:93-187) · `Тема` — **живой UI** (theme-store, :189-271) · `Статистика — "скоро..."/"Доступно после регистрации"` (:273-278);
- гость → CTA Google-регистрации (:64-75, :280-283) — обещает «Статистика, прогресс, ИИ и сохранение данных»;
- 🔴 **Продуктовый разрыв:** `ProfileStats` (единственная metrics-карточка) смонтирована **в FeedScreen**, а не в комнате. Комната юзера не показывает свой прогресс ВООБЩЕ — только плейсхолдер «скоро...»;
- 🔴 **Друзья (§C-2 стройка): отсутствует как сущность** — нет полей в UserProfile, нет стора, нет UI, нет шинного события. Строить с нуля.

---

## §5 Стройка §C-2 — фактическое состояние

| направление | статус |
|---|---|
| **Профиль** | 🟢 жив (auth/guest/avatar/name/email/mvsep-key/тема); мелочь — split-brain surface |
| **Прогресс** | 🔴 **мёртв на клиенте целиком** — метрики заморожены с 退休 metrics.bridge, earned-ячейки никогда не появятся, streak-логика недостижима, UI — плейсхолдеры |
| **Друзья** | ⚫ не существует — новая сущность |

---

## §6 Рецепты-кандидаты (через цепь — решение за Центром/Никитой; 007 архитектуру не выбирает)

1. **Воскрешение metrics-провода по образцу волны 4:** `metrics-events` wrapper в `main.tsx` (как track-events/lyrics-events) — подписка на `EventBusChannel.Practice`-событие «сессия завершена» → `useMetricsStore.getState().incrementRehearsal()` + `scheduleSync()`. Это чинит сразу 2 из 3 мёртвых слоёв (writer + sync-trigгер).
2. **Пересадка на шину practice-семьи:** естественный source:fact — `practice-session.store` `endPractice/completeAndKeep` (MO-practice — владелец события; стык по аналогии §B MO-transport).
3. **Починка streak:** считать diff ДО записи `lastActiveAt` (или хранить prevLastActiveAt). Решение тривиальное, но применять — Оператору по MICROPACK.
4. **Добор surface-миграции:** 8 точек useAppStore → user-profile.store + внести surface/authChecked в partialize (иначе reset на reload). Фаза 4 — закрыта как «миграция не доведена».
5. **Друзья:** новая сущность — profile-поля + idb-связи? сервер? — **вопрос архитектуры Центру** (где живёт граф: client-localStorage vs gateway), рецептов до решения не даю.

---

## §7 Интерфейсы семьи — что отсутствует

- ❌ `team-m/TRIGGERS/MO-user-room.md` — **не существует** (хэндоф §ИНТЕРФЕЙСЫ его декларирует);
- ❌ строки «семья user-room закрыта: N L3-единиц» в `TRIGGERS/003.md` **нет** (есть для upload 13:2x / transport 12:49 / engine-v3 10:5x / practice 14:4x) — её ставит **агент-владелец**, не 007;
- ✅ `team-m/zones/mo-user-room/drafts/` — DRAFT-зона жива (004-рекогносцировка + этот отчёт).

---

## §8 Канон-примечание

Замер не гнался (read-only recon, правок кода нет). Последний известный канон из `TRIGGERS/003.md` (21:11, CEO_1): **tsc=181 · vitest 812/68** — живой замер, НЕ 293/801 из шапки 30.08 (дрейф). Frozen-зоны: **0 касаний**. Работа — только анализ + один артефакт в drafts.

---

## §СТОП

«Погружение-дайв по вопросам 004 сдано (этот артефакт). Я — 007, не MO-user-room: роль владельца семьи вакантна, её интерфейсы (TRIGGERS/MO-user-room.md, строка закрытия семьи в 003) не созданы — их ставит владелец. **СТОП: жду план Никиты.** Полномочий начинать стройку §C-2 или применять рецепты §6 у меня нет — они идут через цепь (001→002→001→009) с MICROPACK на Оператора.»
