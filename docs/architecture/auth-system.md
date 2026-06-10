# Auth System — beLive

**Status:** Living Master Document — User Registration & Identity
**Version:** 1.0
**Date:** 2026-06-07
**Author:** Agent 007 (по заданию Никиты)
**Related:**
- `protocol-v2.1.md` (Technical JWT/protocol specs)
- `interaction-schema-2.2.md` (Interaction flows)
- `architecture-map-2.2.md` (Auth in arch context)
- `src/services/auth.service.ts` (Implementation)
- `src/stores/user-profile.store.ts` (Data store)
- `src/types/user.types.ts` (Type definitions)

---

## Table of Contents
1. [Philosophy](#1-philosophy)
2. [Provider Registry](#2-provider-registry)
3. [Data Model](#3-data-model)
4. [Guest Mode](#4-guest-mode)
5. [Surface Gate Integration](#5-surface-gate-integration)
6. [CF Workers](#6-cf-workers)
7. [Security & Limitations](#7-security--limitations)
8. [Migration & Persistence](#8-migration--persistence)
9. [Adding a New Provider (Playbook)](#9-adding-a-new-provider-playbook)
10. [Future Roadmap](#10-future-roadmap)

---

## 1. Philosophy

beLive — это **Guest-first** платформа. Регистрация не блокирует контент.

```
Guest (мгновенно, 1 клик)
  │
  ├─ Каталог        ✅
  ├─ Прослушивание  ✅
  ├─ Режимы         ✅
  │
  └─ Расширенные функции (AI, статистика)
       │
       └─ Конвертация через ценность
            ├─ Google OAuth    ✅
            ├─ VK OAuth        🚧 стаб кнопка
            ├─ Yandex          📝 план
            ├─ Apple ID        🤔 обсуждается
            └─ Email/Password  ❌ не планируется (UX антипаттерн)
```

### Ключевые принципы

| Принцип | Правило |
|---------|---------|
| **Guest-first** | Регистрация не требуется для основного UX |
| **Конвертация, не блокировка** | Пользователь регистрируется когда видит ценность |
| **Один профиль — много провайдеров** | 🧭 В будущем: Google+VK+Apple → один UserProfile |
| **OAuth без паролей** | Никаких email/password форм |
| **JWT на клиенте** | ⚠️ Tech debt: localStorage. v3.0 → httpOnly cookie |
| **Провайдеры плагинные** | Добавление нового = 1 файл конфига + 1 кнопка |

---

## 2. Provider Registry

### 2.1 Active Providers

| Провайдер | Статус | Тип | Кнопка | CF Worker endpoint | Data |
|-----------|--------|-----|--------|-------------------|------|
| **Guest** | ✅ Production | local `createProfile()` | "Пропустить →" | — | `isGuest: true` |
| **Google** | ✅ Production | OAuth 2.0 + OpenID | "Войти через Google" | `/auth/google` | `name`, `email`, `avatar`, `sid` |

### 2.2 Provider Configuration

Каждый OAuth провайдер требует:

| Параметр | Google | VK (planned) |
|----------|--------|--------------|
| Worker endpoint | `/auth/google` | `/auth/vk` |
| OAuth URL build | Worker | Worker |
| Callback path | `/auth/callback` | `/auth/callback` |
| Scope | `openid profile email` | `email` |
| JWT fields | name, email, avatar, sid | name, avatar, sid |
| Client ID secret | `GOOGLE_CLIENT_ID` | `VK_CLIENT_ID` |
| Client Secret | `GOOGLE_CLIENT_SECRET` | `VK_CLIENT_SECRET` |

### 2.3 UserProfile.authProvider values

```typescript
// src/types/user.types.ts
authProvider?: 'google' | 'guest';  // Расширяется: 'vk' | 'yandex' | 'apple'
```

**Правило:** каждый новый провайдер добавляет значение в union.

### 2.4 Future Providers

| Провайдер | Приоритет | Статус | Блокер |
|-----------|-----------|--------|--------|
| **VK** | P1 | 🚧 Кнопка есть (`disabled`), Worker готовится | Нужен VK app + secrets |
| **Yandex** | P2 | 📝 План | — |
| **Apple ID** | P2 | 🤔 Обсуждается | iOS PWA ограничения |
| **Email/Password** | ❌ | Отклонено | UX антипаттерн для PWA |

---

## 3. Data Model

### 3.1 UserProfile (полная схема)

```typescript
// src/types/user.types.ts
export interface UserProfile {
  id: string;                          // UUID (клиентская генерация)
  name: string;                        // Display name
  emoji?: string;                      // Guest эмодзи (🎤)
  createdAt: string;                   // ISO date
  lastSeenAt: string;                  // ISO date
  preferences?: UserProfilePreferences; // Тема, язык, BillyMood
  mvsepApiKey?: string;                // MVSEP API key (UserRoom UI)
  
  // Идентификация
  isGuest: boolean;                    // Флаг гостя
  pinHash?: string;                    // 🧭 Для будущего PIN-кода
  
  // Серверная связь
  serverId?: string;                   // ID на сервере (после OAuth / миграции)
  migrationStatus?: 'local' | 'migrating' | 'synced';  // Статус миграции
  
  // OAuth
  authProvider?: 'google' | 'guest';   // Провайдер (расширяемый union)
  email?: string;                      // Email от провайдера
  avatarUrl?: string;                  // Аватар от провайдера
  authToken?: string;                  // ⚠️ localStorage JWT (tech debt)
}
```

### 3.2 Onboarding & Stats

```typescript
export interface OnboardingProgress {
  step1Done: boolean;
  step2Done: boolean;
  activeStep: number;
}

export interface UserStats {
  userId: string;
  serverId?: string;
  totalTracks: number;
  totalSessions: number;
  totalPracticeMinutes: number;
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string | null;
  milestones: UserMilestone[];
  updatedAt: string;
}
```

### 3.3 LocalStorage Schema

```json
{
  "belive:user-profile": {
    "state": {
      "currentUserId": "uuid",
      "isOnboarded": true,
      "showOnboarding": false,
      "currentUser": { /* UserProfile */ },
      "isLoggedIn": true,
      "isGuest": false,
      "isReturning": true,
      "userName": "User",
      "userAvatar": "🎤",
      "catalogOnboardingComplete": false,
      "onboardingProgress": { "step1Done": false, "step2Done": false, "activeStep": 1 }
    },
    "version": 2
  }
}
```

**⚠️ Важно:** `authToken` (JWT) сохраняется через `partialize` — это tech debt. v3.0 перейдёт на httpOnly cookie через CF Worker.

---

## 4. Guest Mode

### 4.1 Entry

```typescript
// authService.skipAuth()
useUserProfileStore.getState().createProfile('Гость', '🎤', true);
useAppStore.getState().setSurface('app');
```

### 4.2 Guest Restrictions Map

| Домен | Guest | OAuth User | Механизм |
|-------|-------|-----------|----------|
| Каталог треков | ✅ Полный | ✅ Полный | — |
| Прослушивание | ✅ | ✅ | — |
| Все режимы | ✅ | ✅ | — |
| beLive AI | ❌ | ✅ 20 req/day | `BeliveProvider` check `authToken` |
| Статистика | ❌ "Доступно после регистрации" | ✅ "скоро..." | `isGuest ?` в UserRoom |
| UserRoom | ✅ Upgrade блок | ✅ Профиль | `isGuest ?` рендеринг |
| Редактор синхронизации | ✅ | ✅ | — |
| Export/Import ZIP | ✅ | ✅ | — |

### 4.3 Guest → OAuth Upgrade

**Текущее состояние:** при OAuth входе создаётся **новый профиль** (без слияния гостевых данных).

```typescript
createOAuthProfile({ name, email, authToken, ... })
  // → создаёт новый UserProfile с isGuest: false
  // → НЕ переносит гостевые данные (треки, прогресс)
```

**🧭 План:** в будущем — merge гостевых IDB данных в OAuth профиль.

### 4.4 Guest UX принципы

- Guest видит **ровно тот же интерфейс**, что и OAuth пользователь
- Различия только в скрытых/заблокированных секциях
- **Никаких popup-ов** "Зарегистрируйся чтобы продолжить"
- Upgrade UI — только в UserRoom (пассивный)

---

## 5. Surface Gate Integration

### 5.1 Surface Transitions

```
                 ┌─────────────────────────────┐
                 │         WELCOME              │
                 │  (Guest / OAuth выбор)       │
                 └──────────┬──────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        skipAuth()    Google OAuth    VK OAuth (🚧)
              │             │             │
              └──────┬──────┘             │
                     ▼                    ▼
              ┌──────────────┐     ┌──────────────┐
              │     APP      │     │   WELCOME    │
              │ (main UI)    │     │ (fail → retry)│
              └──────┬──────┘     └──────────────┘
                     │
              QuickActions click
                     │
                     ▼
              ┌──────────────┐
              │   PROFILE    │
              │  (UserRoom)  │
              └──────┬──────┘
                     │
              Escape / Logout
                     │
                     ▼
              ┌──────────────┐
              │   WELCOME    │
              └──────────────┘
```

### 5.2 Auth Check на Boot

```typescript
// App.tsx mount
useEffect(() => {
  const hasSession = await authService.checkExistingAuth();
  // Проверка: isTokenValid(currentUser.authToken)
  // NO → welcome (с LoadingSplash пока проверка идёт)
  // YES → app
  setAuthChecked(true);
}, []);
```

---

## 6. CF Workers

### 6.1 belive-auth Worker

| Аспект | Детали |
|--------|--------|
| URL | `https://belive-auth.nikitosss007.workers.dev` |
| Репозиторий | `belive-api/` (в корне проекта) |
| Runtime | Cloudflare Workers (ES Modules) |

### 6.2 Endpoints

| Endpoint | Метод | Назначение | Параметры |
|----------|-------|-----------|-----------|
| `/auth/google` | GET | Инициировать Google OAuth | — (редиректит на Google) |
| `/auth/vk` | GET | Инициировать VK OAuth 🚧 | — (редиректит на VK) |
| `/auth/callback` | GET | Принять callback от провайдера | `?code=...&state=...` |
| `/auth/refresh` | POST | Обновить JWT | `{ refreshToken }` 🧭 ⚠️ NOT IMPLEMENTED — endpoint does not exist in belive-api worker |
| `/health` | GET | Health check | — |

### 6.3 Secrets

```
GOOGLE_CLIENT_ID      — ID приложения Google Cloud
GOOGLE_CLIENT_SECRET  — Secret Google Cloud  
VK_CLIENT_ID          — ID приложения VK Dev 🚧
VK_CLIENT_SECRET      — Secret VK Dev 🚧
JWT_SECRET            — Подпись JWT (HMAC-SHA256)
SESSION_SECRET        — Шифрование сессионных данных ⚠️ NOT USED — not declared in wrangler.toml, not referenced in code
```

### 6.4 OAuth Flow (общий для всех провайдеров)

```
Client                    Worker                      Провайдер
  │                         │                            │
  │ GET /auth/{provider}    │                            │
  │────────────────────────►│                            │
  │                         │ Строит OAuth URL            │
  │                         │ (client_id, redirect, scope,│
  │                         │  state)                     │
  │ 302 Redirect            │                            │
  │◄────────────────────────│                            │
  │                         │                            │
  │ Пользователь соглашается│                            │
  │─────────────────────────────────────────────────────►│
  │                         │                            │
  │ Callback → /auth/callback (?code=...&state=...)      │
  │────────────────────────►│                            │
  │                         │ Валидирует state            │
  │                         │ Обменивает code→token       │
  │                         │ Создаёт JWT                 │
  │ 302 → Client URL        │                            │
  │   ?auth=JWT&name=...    │                            │
  │◄────────────────────────│                            │
  ▼                         ▼                            ▼
```

---

## 7. Security & Limitations

### 7.1 JWT

```json
// Decoded payload
{
  "sub": "google-oauth2|123456789",
  "name": "User Name",
  "email": "user@example.com",
  "iat": 1717000000,
  "exp": 1719592000           // 30 дней
}
```

- **Алгоритм:** HS256
- **TTL:** 30 дней
- **Хранение:** localStorage (⚠️ tech debt)
- **Валидация:** клиент проверяет `exp` на каждом boot

### 7.2 iOS PWA Limitation

```
⚠️ KNOWN LIMITATION:
  iOS PWA не поддерживает OAuth redirect обратно в PWA.
  Приходится открывать Safari, пользователь возвращается вручную.
  Callback URL params сохраняются в сессии PWA.
  
  v3.0: ASWebAuthenticationSession или universal links.
```

### 7.3 Rate Limits

- **beLive AI:** 20 requests/day per user (KV `belive-ai-rates`)
- **Auth retries:** не ограничено (провайдер сам ограничивает)
- **Mock auth:** не ограничено (dev only)

### 7.4 Безопасность

| Риск | Статус | Митигация |
|------|--------|-----------|
| JWT в localStorage | ⚠️ Tech debt | v3.0 → httpOnly cookie через Worker |
| XSS → кража JWT | ⚠️ | Минимизируем dangerouslySetInnerHTML |
| Mock JWT в production | ❌ Невозможно | `VITE_USE_MOCK_AUTH=true` только в dev |
| CSRF | ✅ | state parameter + PKCE (planned) |
| Token replay | ✅ | JWT expiration (30 дней) |

---

## 8. Migration & Persistence

### 8.1 Storage

| Данные | Хранилище | Ключ | Версия |
|--------|-----------|------|--------|
| User profile | localStorage (Zustand persist) | `belive:user-profile` | 2 |
| JWT token | localStorage (в составе профиля) | — | — |
| User stats | IDB (план) | — | — |

### 8.2 Migration History

| Версия | Изменения | Дата |
|--------|----------|------|
| v1 | Базовая: profile, isGuest, onboarding | 2026-05 |
| v2 | + `catalogOnboardingComplete`, `onboardingProgress` | 2026-06-05 |

### 8.3 Partialize (что попадает в localStorage)

```typescript
partialize: (state) => ({
  currentUserId, isOnboarded, showOnboarding,
  currentUser, isLoggedIn, isGuest, isReturning,
  userName, userAvatar,
  catalogOnboardingComplete, onboardingProgress,
  // ❌ Функции (createProfile, logout, etc.) — не сохраняются
})
```

### 8.4 OAuth/Guest двойная запись

**Текущая проблема:** Guest и OAuth — РАЗНЫЕ профили.

```
Guest профиль:
  isGuest: true, authProvider: 'guest', authToken: undefined

OAuth профиль:
  isGuest: false, authProvider: 'google', authToken: 'jwt...'
```

При OAuth входе будучи гостем — старый профиль **теряется** (не удаляется из localStorage, но стора перезаписывается).

**🧭 План:**
1. Сохранять guestUserId в OAuth профиль
2. При входе — merge гостевых треков/прогресса
3. Добавить `GuestMigrationResult` с результатом

---

## 9. Adding a New Provider (Playbook)

Этот раздел — инструкция для добавления нового OAuth провайдера.

### Step 1: Worker (belive-api/)

```typescript
// 1. Добавить endpoint в Worker (например /auth/vk)
// 2. Добавить secrets: VK_CLIENT_ID, VK_CLIENT_SECRET  
// 3. Реализовать:
//    - buildVkOAuthUrl() — построить URL для VK
//    - handleVkCallback() — обменять code на токен
//    - createJwt() — создать beLive JWT (тот же формат)
```

### Step 2: UI (WelcomePage.tsx)

```tsx
// 1. Активировать/добавить кнопку
<button className="bl-welcome__vk-btn" onClick={() => authService.initiateVkOAuth()}>
  Войти через VK
</button>

// 2. Для провайдеров с SVG иконкой — добавить иконку
```

### Step 3: Auth Service (auth.service.ts)

```typescript
// 1. Добавить метод initiate<Vk>OAuth()
async initiateVkOAuth(): Promise<void> {
  if (USE_MOCK_AUTH) return this._mockAuth();
  window.location.href = `${CF_WORKER_URL}/auth/vk`;
}

// 2. handleCallback уже универсальный — парсит ?auth=JWT&name=...
//    Новые параметры (?avatar=... уже поддерживается)
```

### Step 4: Data Model (user.types.ts)

```typescript
// 1. Расширить authProvider union
authProvider?: 'google' | 'vk' | 'guest';  // + 'vk'

// 2. Если провайдер даёт новые поля — добавить в UserProfile
```

### Step 5: Docs

```markdown
// 1. Обновить Provider Registry в этом документе (§2)
// 2. Добавить кнопку в таблицу активных провайдеров
```

### Step 6: CF Worker Deploy

```bash
wrangler deploy
```

---

## 10. Future Roadmap

### P0 — Сейчас
- ✅ Google OAuth
- ✅ Guest mode
- ✅ JWT в localStorage

### P1 — Ближайшие волны
| Фича | Статус |
|------|--------|
| VK OAuth (активировать кнопку) | 🚧 Кнопка есть, Worker готовится |
| Secret management в Worker | 📝 Упорядочить secrets |

### P2 — Среднесрочные
| Фича | Зачем |
|------|-------|
| ASWebAuthenticationSession | iOS PWA OAuth UX |
| httpOnly cookie вместо localStorage | Безопасность |
| Guest → OAuth merge | Не терять данные гостя |
| Yandex OAuth | Расширение аудитории |

### P3 — Стратегические
| Фича | Зачем |
|------|-------|
| Apple ID OAuth | iOS пользователи |
| Server-side profiles | Бекап, кросс-девайс |
| Refresh tokens | Долгие сессии без re-auth |
| Multi-provider binding | Google + VK = один профиль |
| Email-уведомления | Только после OAuth (опционально) |
| Аватар upload | Для гостей и незалогиненных |

---

*Auth System v1.0 — живой документ. Обновляется при добавлении каждого нового провайдера.*
*Создан: 2026-06-07 | Автор: Agent 007*
