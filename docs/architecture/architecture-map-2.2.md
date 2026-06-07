# Архитектурная Карта beLive 2.2 (Delta)

**Status:** Delta — дополнение к v2.1  
**Version:** 2.2  
**Date:** 2026-06-07  
**Based on:** architecture-map-2.1.md + code recon of new auth/welcome/guest/AI systems

> ⚠️ **Читать после architecture-map-2.1.md.** Этот документ описывает только то, что добавилось/изменилось в v2.2.

---

## §21. Surface Gate System (NEW)

### 21.1 Назначение
Единственный контроллер навигации. Заменяет URL-роутинг. Управляется через Zustand store.

### 21.2 Surface Map

| Surface | Компонент | Описание |
|---------|-----------|----------|
| `welcome` | `WelcomePage.tsx` | Стартовый экран: Google OAuth, VK (disabled), Skip |
| `app` | `App.tsx` (AppShell) | Основное рабочее пространство (каталог, режимы, редактор) |
| `profile` | `UserRoom.tsx` | Профиль, настройки, Guest Upgrade UI |

### 21.3 Surface Gate реализация

```ts
// src/stores/app.store.ts
type AppSurface = 'welcome' | 'app' | 'profile';

interface AppState {
  surface: AppSurface;
  authChecked: boolean;
  setSurface: (s: AppSurface) => void;
  setAuthChecked: (v: boolean) => void;
}
```

App.tsx (Surface Gate switch):
```tsx
const surface = useAppStore(s => s.surface);
switch (surface) {
  case 'welcome': return <WelcomePage />;
  case 'app': return <AppShell />;
  case 'profile': return <UserRoom />;
}
```

### 21.4 Файлы Surface Gate

| Файл | Назначение |
|------|-----------|
| `src/stores/app.store.ts` | Surface state + authChecked |
| `src/components/app/App.tsx` | Surface switch gate |
| `src/components/welcome/WelcomePage.tsx` | Surface welcome |
| `src/components/welcome/WelcomePage.css` | Стили welcome |
| `src/components/welcome/LoadingSplash.tsx` | Сплаш для auth-check |
| `src/components/profile/UserRoom.tsx` | Surface profile |
| `src/components/profile/UserRoom.css` | Стили profile |

---

## §22. Auth Flow (NEW)

### 22.1 Схема потоков

```
GOOGLE OAUTH:
  WelcomePage "Войти через Google"
    → authService.initiateGoogleOAuth()
    → CF Worker /auth/google
    → Google Consent Screen
    → Worker callback → JWT
    → URL params (?auth=...&name=...&email=...)
    → handleCallback() → createOAuthProfile()
    → setSurface('app')

GUEST SKIP:
  WelcomePage "Пропустить"
    → authService.skipAuth()
    → createProfile('Гость', '🎤', true)
    → setSurface('app')

MOCK AUTH (dev):
  VITE_USE_MOCK_AUTH=true
    → _mockAuth() → createOAuthProfile()
    → setSurface('app')
```

### 22.2 Auth Service API

```ts
// src/services/auth.service.ts
authService.skipAuth()            // Guest вход
authService.initiateGoogleOAuth() // OAuth редирект
authService.checkExistingAuth()   // Проверка при загрузке
authService.handleCallback(params) // Обработка OAuth callback
```

### 22.3 User Profile Store (OAuth)

```ts
// src/stores/user-profile.store.ts
interface UserProfileStoreState {
  currentUser: UserProfile | null;
  isLoggedIn: boolean;
  isGuest: boolean;
  isReturning: boolean;

  createProfile(name, emoji, isGuest?)     // Создать профиль (гость/обычный)
  createOAuthProfile({name, email, authToken, ...}) // OAuth профиль
  updateProfile(updates)                    // Обновить
  logout()                                   // Выйти
  deleteProfile()                            // Удалить профиль
}
```

### 22.4 Profile data model

```ts
interface UserProfile {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  emoji?: string;
  isGuest: boolean;
  authProvider?: 'google';
  authToken?: string;
  serverId?: string;
  createdAt: string;
  lastSeenAt: string;
  preferences: Record<string, any>;
}
```

### 22.5 Persistence & Migration

- Store: `belive:user-profile` (localStorage via zustand/persist)
- Version: 2
- Migration v1→v2: adds `catalogOnboardingComplete`, `onboardingProgress`
- Partialize: сохраняет только нужные поля (без функций)

---

## §23. Guest Mode (NEW)

### 23.1 Принцип
Guest-режим — архитектурный принцип. Пользователь начинает творить мгновенно, конвертация происходит через ценность, а не через забор.

### 23.2 Guest flow
1. `createProfile('Гость', '🎤', true)` → `isGuest: true`
2. Поверхность: `welcome` → (skip) → `app`
3. UserRoom показывает блок апгрейда
4. AI Provider блокирует запросы (`AUTH_REQUIRED`)
5. Статистика скрыта ("Доступно после регистрации")

### 23.3 Guest restrictions

| Фича | Guest | OAuth User |
|------|-------|-----------|
| Просмотр каталога | ✅ | ✅ |
| Прослушивание треков | ✅ | ✅ |
| Режимы (rehearsal/concert/etc) | ✅ | ✅ |
| beLive AI | ❌ `AUTH_REQUIRED` | ✅ (20 req/day) |
| Статистика | ❌ скрыта | ✅ |
| UserRoom апгрейд | ✅ блок апгрейда | ✅ профиль |

---

## §24. beLive AI Provider (NEW)

### 24.1 Регистрация провайдера

```ts
// src/js/ai/providers/belive.provider.ts
class BeliveProvider implements AIProvider {
  id = 'belive';
  models = [
    { id: 'deepseek/deepseek-chat-v3-0324:free', ... },
    { id: 'google/gemini-2.0-flash-001', ... },
    { id: 'meta-llama/llama-4-maverick', ... },
  ];
}
```

### 24.2 Поток запроса
```
User message → AIHub.sendMessage()
  → BeliveProvider.streamChat()
  → Fetch POST {CF_WORKER_URL} (Authorization: Bearer JWT)
  → SSE stream (data: {...} events)
  → onToken/delta → UI
```

### 24.3 Rate limit
- KV store: `belive-ai-rates`
- 20 запросов/день на пользователя
- HTTP 429 при превышении

### 24.4 Безопасность
- JWT читается динамически из `userProfileStore.currentUser.authToken`
- Guest → `AIError('AUTH_REQUIRED')`
- Worker без авторизации → 401

---

## §25. Env Vars & CF Workers (UPDATED)

### 25.1 Production

```env
VITE_AUTH_WORKER_URL=https://belive-auth.nikitosss007.workers.dev
VITE_AI_WORKER_URL=https://belive-ai.nikitosss007.workers.dev
VITE_USE_MOCK_AUTH=false
VITE_GETSONGBPM_KEY=***
VITE_LASTFM_API_KEY=***
VITE_BASE_PATH=/
```

### 25.2 Development

```env
VITE_USE_MOCK_AUTH=true
VITE_GATEWAY_URL=http://localhost:8787
```

### 25.3 CF Workers Registry

| Worker | Endpoints | Secrets |
|--------|-----------|---------|
| `belive-auth` | `/auth/google`, `/auth/callback`, `/health` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `SESSION_SECRET` |
| `belive-ai` | `/v1/chat/completions` (SSE) | `OPENROUTER_API_KEY`, KV: `belive-ai-rates` |

---

## §26. New File Reference (SCAN results)

Все новые файлы проверены — `tsc --noEmit` не выдаёт ошибок в этих файлах.

| Файл | Строк | Назначение |
|------|-------|-----------|
| `src/components/welcome/WelcomePage.tsx` | 40 | Стартовый экран |
| `src/components/welcome/WelcomePage.css` | — | Стили welcome |
| `src/components/welcome/LoadingSplash.tsx` | — | Сплаш загрузки |
| `src/components/profile/UserRoom.tsx` | 93 | Профиль + Guest Upgrade |
| `src/components/profile/UserRoom.css` | — | Стили UserRoom |
| `src/services/auth.service.ts` | 126 | OAuth/Guest/JWT |
| `src/stores/app.store.ts` | 17 | Surface gate |
| `src/stores/user-profile.store.ts` | 204 | Профиль + persist |
| `src/js/ai/providers/belive.provider.ts` | 176 | beLive AI |

---

*Продолжение следует. База: architecture-map-2.1.md*
