# ❄️ AUTH SYSTEM — SNAPSHOT (FROZEN)

> **Дата:** 2026-05-28
> **Статус:** Заморожен по решению Центра.
> **Ветка:** `main`
> **Коммит:** (текущий HEAD)

---

## 1. Архитектура

### 1.1 Модель

```
Гость (Guest) → Имя (Named) → Возврат (Returning)
```

- **Гость** — пользуется сразу, без регистрации. ID — 12-char hex.
- **Профиль (Named)** — имя + emoji (опционально). UUID v4.
- **Возврат (Returning)** — localStorage (Zustand persist) + IDB.
- **Нет** email/phone/OAuth/паролей.

### 1.2 AuthState

```ts
type AuthState = 'guest' | 'named' | 'returning';
```

Источник: `src/types/user.types.ts:6`

---

## 2. Типы — `src/types/user.types.ts` (86 строк)

| Тип | Поле | Описание |
|------|-------|-----------|
| `UserProfile` | `id`, `name`, `emoji?`, `createdAt`, `lastSeenAt`, `preferences?`, `isGuest`, `pinHash?`, `serverId?`, `migrationStatus?` | Основной профиль |
| `AuthState` | — | Литерал `'guest' \| 'named' \| 'returning'` |
| `UserState` | `currentUserId`, `isOnboarded`, `showOnboarding` | Состояние UI |
| `UserProfilePreferences` | `theme?`, `language?`, `billyMood?` | Настройки профиля |
| `BillyMood` | — | `'quiet' \| 'helpful' \| 'attentive'` |
| `UserStats` | `userId`, `totalTracks`, `totalSessions`, `totalPracticeMinutes`, `currentStreak`, `longestStreak`, `lastPracticeDate`, `milestones` | Статистика (заготовка) |
| `GuestMigrationResult` | `profileId`, `tracksMigrated`, `settingsMigrated` | Результат миграции |
| `OnboardingStep` | `step`, `completed` | Шаг онбординга |
| `MilestoneType` | — | `'first_track' \| 'first_sync' \| 'first_recording' \| 'streak_3' \| 'streak_7' \| 'streak_30'` |

Гард-функция: `isUserProfile(obj)` — проверка на runtime.

---

## 3. Store — `src/stores/user-profile.store.ts` (128 строк)

Zustand + `persist` middleware (ключ `belive:user-profile`).

### Состояние (`initialState`)

```ts
{
  currentUserId: null,
  isOnboarded: false,
  showOnboarding: false,
  currentUser: null,
  isLoggedIn: false,
  isGuest: true,
  isReturning: false,
  userName: '',
  userAvatar: '🎤',
}
```

### Actions

| Action | Сигнатура | Эффект |
|--------|-----------|--------|
| `createProfile` | `(name, emoji) => UserProfile` | Создаёт профиль (UUID), устанавливает `isLoggedIn: true`, `isGuest: false`, `isOnboarded: true` |
| `updateProfile` | `(Partial<UserProfile>)` | Мержит + обновляет `lastSeenAt` |
| `updatePreferences` | `(Partial<Preferences>)` | Мержит preferences |
| `setOnboarded` | `() => void` | `isOnboarded = true`, `showOnboarding = false` |
| `setShowOnboarding` | `(boolean) => void` | Управляет показом онбординга |
| `logout` | `() => void` | Сбрасывает в initialState, `isReturning = true` |
| `deleteProfile` | `() => void` | Полный сброс в initialState |

### Hydration

`onRehydrateStorage` восстанавливает `isLoggedIn`, `isGuest`, `isReturning`, `userName`, `userAvatar` из сохранённого `currentUser`.

---

## 4. IndexedDB — `src/services/idb.service.ts` (332 строки)

- **DB_NAME:** `TextAppDB`
- **DB_VERSION:** `9` (shared с `js/track-catalog.js`)

### Схема

| Object Store | Key | Индексы | Создан в |
|-------------|-----|---------|----------|
| `tracks` | `id` | `title`, `userId` (TC-AUTH-003) | upgrade |
| `app_state` | `key` | — | upgrade |
| `temp_audio_files` | `id` | — | upgrade |
| `my_music` | `trackId` | — | upgrade |
| `users` | `id` | `name`, `createdAt` | upgrade (TC-AUTH-003) |

### UserRecord в IDB

```ts
{
  id: string;
  serverId?: string;
  name: string;
  emoji: string;
  isGuest: boolean;
  createdAt: string;
  lastSeenAt: string;
  pinHash?: string;
  migrationStatus?: 'local' | 'migrating' | 'synced';
  preferences: { theme?, language?, billyMood? };
}
```

### Users CRUD (`getUser`, `getUserByName`, `saveUser`, `deleteUser`, `getAllUsers`) — строки 229–254.

### Миграция (`migrateGuestTracksToProfile`) — строка 258

- Проходит курсором по `tracks`, находит записи без `userId`
- Устанавливает `track.userId = profileId`
- Возвращает `migrated` — количество обновлённых записей

---

## 5. Landing Page — `src/components/landing/LandingPage.tsx` (130 строк)

### 6-фазная анимация

| Фаза | Тайминг | Элемент |
|------|---------|---------|
| 0→1 | 150ms | SVG-микрофон (scale + opacity) |
| 1→2 | 400ms | Заголовок "beLive" |
| 2→3 | 650ms | Подзаголовок "Твоя вокальная студия" |
| 3→4 | 850ms | Аватар-превью + input name |
| 4→5 | 1050ms | Кнопка "Начать" + соц. кнопки (disabled, "скоро") |

### Avatar preview

- Цвет: хеш от имени → `AVATAR_COLORS[10]`
- Initial: первая буква имени (или 'Г')
- Отображается в реальном времени при вводе

### Submit

```ts
createProfile(name.trim() || 'Гость', `${initial}:${avatarColor}`);
```

Социальные кнопки (Google, VK, Telegram, GitHub) — disabled, заглушка "скоро".

---

## 6. Стили — `src/components/landing/LandingPage.css` (212 строк)

- `position: fixed; inset: 0; z-index: 10000` — fullscreen overlay поверх всего
- `background: #0a0a0a` — тёмная тема
- Анимации: `cubic-bezier(0.16, 1, 0.3, 1)` — плавное появление
- `@keyframes lp-glow` — пульсация тени микрофона
- Mobile: `@media (max-width: 480px)` — уменьшенный заголовок/лого
- Состояния: `.visible` (opacity 1 + translateY(0) / scale(1)), `:focus`, `:hover`, `:active`, `:disabled`

---

## 7. Legacy JS — `js/track-catalog.js`

- **DB_VERSION = 9** (синхронизирован с `src/services/idb.service.ts`)
- Создаёт: `tracks`, `app_state`, `temp_audio_files`
- НЕ создаёт `users` store — это прерогатива TS IDB Service

---

## 8. Ключевые решения

| Решение | Обоснование |
|---------|-------------|
| Guest model | Без паролей/email, offline-first, progressive |
| DB_VERSION = 9 | Единая версия для TS и JS, предотвращает race condition |
| users store только в upgrade | Создаётся если не существует, безопасно для существующих БД |
| userId index на tracks | Позволяет фильтровать треки по пользователю |
| Zustand persist | localStorage для быстрого старта при возврате |
| Миграция через курсор | Не блокирует БД, обрабатывает все записи |

## 9. Состояние на момент заморозки

- ✅ **Auth код присутствует**, но деактивирован (Welcome восстановлен, Landing guard удалён)
- ✅ Типы, store, IDB service — в рабочем состоянии
- ❄️ Онбординг, Menu, Billy — заморожены
- 🎯 Следующий фокус: DEMO TRACKS
