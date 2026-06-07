# Interaction Schema 2.2

**Status:** Delta к interaction-schema-2.1.md — новые взаимодействия
**Version:** 2.2
**Date:** 2026-06-07
**Related:**
- `architecture-map-2.1.md` + `architecture-map-2.2.md`
- `protocol-v2.1.md`
- `audio-engine.md`
- `sync-system.md`

> ⚠️ **Читать после interaction-schema-2.1.md.** Этот документ описывает ТОЛЬКО новые взаимодействия, добавленные в v2.2.

---

## 1. Auth Interaction Flow

### 1.1 Guest Skip Flow

```
WelcomePage
  └─ click "Пропустить"
       └─ authService.skipAuth()
            ├─ useUserProfileStore.createProfile('Гость', '🎤', true)
            │    ├─ set({ isGuest: true, isLoggedIn: true })
            │    └─ localStorage persist (belive:user-profile v2)
            └─ useAppStore.setSurface('app')
                 └─ App.tsx switch(surface) → return <AppShell />
```

**Authority:** `authService` — entry point. `userProfileStore` — data authority.

### 1.2 Google OAuth Flow

```
WelcomePage
  └─ click "Войти через Google"
       └─ authService.initiateGoogleOAuth()
            ├─ VITE_USE_MOCK_AUTH=true → _mockAuth() (dev)
            └─ window.location.href = CF_WORKER_URL/auth/google
                 └─ Worker → Google Consent → callback
                      └─ URL params: ?auth=JWT&name=...&email=...
                           └─ App.tsx useEffect → handleCallback()
                                ├─ validate JWT (exp check)
                                ├─ createOAuthProfile({name, email, authToken, ...})
                                │    ├─ set({ isGuest: false, isLoggedIn: true })
                                │    └─ localStorage persist
                                └─ setSurface('app')
```

### 1.3 Auth Check on Boot

```
App.tsx mount
  └─ useEffect → authService.checkExistingAuth()
       ├─ userProfileStore.currentUser exists?
       │    ├─ NO → setSurface('welcome'), setAuthChecked(true)
       │    └─ YES → isTokenValid(authToken)?
       │         ├─ NO → logout() → setSurface('welcome')
       │         └─ YES → setSurface('app'), setAuthChecked(true)
       └─ Fallback: LoadingSplash поверхностью welcome до authChecked=true
```

---

## 2. Surface Gate Interaction

### 2.1 Surface switch topology

```
useAppStore.surface
  ├─ 'welcome' → <WelcomePage /> (Guest entry)
  │    └─ on skip/OAuth → setSurface('app')
  ├─ 'app' → <AppShell /> (main workspace)
  │    └─ QuickActions → setSurface('profile')
  └─ 'profile' → <UserRoom /> (profile/settings)
       └─ back/Escape → setSurface('app')
       └─ logout → setSurface('welcome')
```

### 2.2 Кто меняет surface

| Действие | Кто вызывает | target surface |
|----------|-------------|----------------|
| Guest skip | `authService.skipAuth()` | `app` |
| OAuth success | `authService.handleCallback()` | `app` |
| Клик аватар | `QuickActions.tsx` | `profile` |
| Escape в UserRoom | `UserRoom.tsx useEffect` | `app` |
| Logout | `UserRoom.tsx handleLogout` | `welcome` |
| Принудительно | `NikitaApi` (dev tool) | любая |

---

## 3. Guest / OAuth User Split

### 3.1 Влияние isGuest на поверхности

```
isGuest = true:
  ├─ UserRoom → показывает блок апгрейда
  │    ├─ "Зарегистрируйся!" + Google button
  │    └─ скрывает профиль, email, аватар
  ├─ Статистика → "Доступно после регистрации"
  └─ AI → BeliveProvider отдаёт AUTH_REQUIRED

isGuest = false:
  ├─ UserRoom → показывает профиль (аватар, имя, email)
  ├─ Статистика → "скоро..."
  └─ AI → BeliveProvider шлёт запрос с JWT
```

### 3.2 Guest → OAuth upgrade path
Прямой апгрейд не реализован (нет слияния гостевых данных с OAuth). При OAuth входе создаётся новый профиль.

---

## 4. beLive AI Provider Interaction

### 4.1 Поток запроса

```
AIHub.sendMessage(request)
  └─ определил провайдер = 'belive'
       └─ BeliveProvider.streamChat(request, callbacks)
            ├─ Читает JWT: userProfileStore.currentUser.authToken
            ├─ NO TOKEN → AIError('AUTH_REQUIRED')
            ├─ Fetch POST {VITE_AI_WORKER_URL}
            │    ├─ Headers: { Authorization: Bearer JWT }
            │    └─ Body: { model, messages, stream: true, ... }
            ├─ 401 → AIError('Сессия истекла')
            ├─ 429 → AIError('Лимит 20 запросов/день')
            └─ SSE stream:
                 ├─ onToken(delta) → UI
                 ├─ [DONE] → onDone(fullText)
                 └─ AbortError → stop()
```

### 4.2 Выбор провайдера

```
AiSettingsModal
  ├─ "beLive AI" → useAiSettingsStore.setProvider('belive')
  └─ "OpenRouter" → useAiSettingsStore.setProvider('openrouter-direct')
       └─ (требует API-ключ от пользователя)
```

---

## 5. Event Surface Contract (NEW events)

События, добавленные в auth/welcome системе:

| Event | Target | Producer | Consumer | Purpose |
|-------|--------|----------|----------|---------|
| `auth-checked` | `window` | `App.tsx` | — | Auth check complete (планируется) |
| `guest-login` | `window` | `authService` | — | Guest вошёл (планируется) |
| `oauth-login` | `window` | `authService` | — | OAuth пользователь вошёл (планируется) |

> ⚠️ Эти события пока не реализованы — это architectural intent для будущих волн.

---

## 6. Persistence & Hydration (NEW)

### 6.1 User Profile

| Артефакт | Хранилище | Ключ | Версия |
|----------|-----------|------|--------|
| Профиль + JWT | localStorage (zustand persist) | `belive:user-profile` | 2 |
| Onboarding | localStorage (там же) | в составе профиля | — |

### 6.2 Migration

```
Version 1 → Version 2:
  Добавлены поля:
    catalogOnboardingComplete: false
    onboardingProgress: { step1Done: false, step2Done: false, activeStep: 1 }
```

---

## 7. New File Interaction Map

```
WelcomePage.tsx
  └─ читает: nothing (stateless)
  └─ вызывает: authService.initiateGoogleOAuth(), authService.skipAuth()

UserRoom.tsx
  └─ читает: useAppStore(surface), useUserProfileStore(currentUser, isGuest, ...)
  └─ вызывает: authService.initiateGoogleOAuth(), logout(), setSurface()

auth.service.ts
  └─ читает: import.meta.env (VITE_*), URL params
  └─ пишет: useUserProfileStore, useAppStore (setSurface)

app.store.ts
  └─ читается: App.tsx, UserRoom.tsx, QuickActions.tsx
  └─ пишется: authService, QuickActions

user-profile.store.ts
  └─ читается: UserRoom.tsx, QuickActions.tsx, BeliveProvider
  └─ пишется: authService, UserRoom (logout)

belive.provider.ts
  └─ читает: userProfileStore.currentUser.authToken
  └─ вызывает: fetch(AI_WORKER_URL)
```

---

*Продолжение следует. База: interaction-schema-2.1.md*
