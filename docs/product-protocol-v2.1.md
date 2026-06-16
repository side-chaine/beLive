# Protocol v2.1 — beLive Protocol Reference

**Status:** Protocol contracts for auth, AI, and data layer  
**Version:** 2.1  
**Date:** 2026-06-07  
**Related:**
- `architecture-map-2.1.md` / `architecture-map-2.2.md`
- `interaction-schema-2.1.md` / `interaction-schema-2.2.md`

---

## 1. Auth Protocol

### 1.1 Google OAuth Flow

```
Client                              CF Worker (belive-auth)          Google
  │                                       │                           │
  │  1. GET /auth/google                  │                           │
  │ ─────────────────────────────────►    │                           │
  │                                       │  2. Build Google OAuth URL│
  │                                       │     (client_id, redirect, │
  │                                       │      scope, state)        │
  │                                       │                           │
  │  3. 302 Redirect to Google            │                           │
  │ ◄─────────────────────────────────    │                           │
  │                                       │                           │
  │  4. User consents                     │                           │
  │ ─────────────────────────────────────────────────────────────►   │
  │                                       │                           │
  │  5. Google callback → /auth/callback  │                           │
  │    (?code=...)                        │                           │
  │ ─────────────────────────────────►    │                           │
  │                                       │  6. Exchange code→tokens  │
  │                                       │     Validate id_token     │
  │                                       │  7. Create JWT (custom)   │
  │                                       │                           │
  │  8. 302 → Client URL                  │                           │
  │     ?auth=JWT                         │                           │
  │     &name=...&email=...               │                           │
  │     &avatar=...&sid=...               │                           │
  │ ◄─────────────────────────────────    │                           │
```

### 1.2 JWT Format

```json
// Decoded JWT Payload
{
  "sub": "google-oauth2|123456789",    // Server ID (user identifier)
  "name": "User Name",
  "email": "user@example.com",
  "iat": 1717000000,                   // Issued at
  "exp": 1719592000                    // Expiration (30 days)
}
```

- **Header:** `{ alg: "HS256", typ: "JWT" }`
- **Signing:** HMAC-SHA256 with `JWT_SECRET`
- **Transport:** URL params (`?auth=...`) after OAuth callback
- **Storage:** localStorage via Zustand persist
- **Validation:** Client checks `exp` on every app boot

### 1.3 URL Parameters (Callback)

| Param | Type | Source | Description |
|-------|------|--------|-------------|
| `auth` | string | Worker JWT | Main JWT token |
| `name` | string | Google profile | User display name |
| `email` | string | Google profile | User email |
| `avatar` | string | Google profile | Avatar URL (optional) |
| `sid` | string | Worker | Server user ID (optional) |

### 1.4 iOS PWA Limitation

```
⚠️ iOS PWA KNOWN LIMITATION:
  OAuth opens Safari, user must manually return to PWA after authorization.
  Callback URL params persist in PWA's session and are processed on next app load.
  v3.0: investigate ASWebAuthenticationSession or universal links.
```

### 1.5 Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `AUTH_CONFIG_ERROR` | 500 | VITE_AUTH_WORKER_URL not set |
| `AUTH_TOKEN_EXPIRED` | 401 | JWT expired, re-login required |
| `AUTH_INVALID_TOKEN` | 401 | Malformed or tampered JWT |
| `MOCK_AUTH` | — | Dev mode only |

---

## 2. AI Protocol (SSE)

### 2.1 Request

```http
POST {VITE_AI_WORKER_URL} HTTP/1.1
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "model": "deepseek/deepseek-chat-v3-0324:free",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 1024
}
```

### 2.2 SSE Response

```
data: {"choices":[{"delta":{"content":"Hello"}}]}

data: {"choices":[{"delta":{"content":" world"}}]}

data: [DONE]
```

### 2.3 Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `CONFIG_ERROR` | — | VITE_AI_WORKER_URL not configured |
| `AUTH_REQUIRED` | — | No JWT token (guest) |
| `WORKER_ERROR` | 401 | Session expired |
| `WORKER_ERROR` | 429 | Rate limit exceeded (20/day) |
| `STREAM_ERROR` | — | Fetch/network error during streaming |

### 2.4 Rate Limit (KV)

```
Namespace: belive-ai-rates
Key: user:{userId}:{date}
Value: count (increment on each request)
Limit: 20 requests/day
Reset: daily (based on date in key)
Response: HTTP 429 + JSON error body
```

### 2.5 Supported Models

| Model ID | Name | Context | Cost |
|----------|------|---------|------|
| `deepseek/deepseek-chat-v3-0324:free` | DeepSeek V3 | 64K | Free |
| `google/gemini-2.0-flash-001` | Gemini 2.0 Flash | 1M | Free |
| `meta-llama/llama-4-maverick` | Llama 4 Maverick | 1M | Free |

---

## 3. Surface Protocol

### 3.1 Surface Enum

```typescript
type AppSurface = 'welcome' | 'app' | 'profile';
```

### 3.2 Surface Transitions

```
welcome → app    (on: skipAuth / handleCallback)
app → profile    (on: QuickActions click)
profile → app    (on: Escape / back click / overlay click)
profile → welcome (on: logout)
app → welcome    (on: forced logout / session expired)
```

### 3.3 Invalid transitions (should never happen)
- `welcome → welcome`
- `profile → profile`
- `app → welcome` (except session expiry)

---

## 4. Data Protocol

### 4.1 User Profile

```typescript
interface UserProfile {
  id: string;                    // UUID or server ID
  name: string;                  // Display name
  email?: string;                // OAuth email
  avatarUrl?: string;            // Google photo URL
  emoji?: string;                // Guest emoji (🎤)
  isGuest: boolean;              // Guest flag
  authProvider?: 'google';       // OAuth provider
  authToken?: string;            // JWT (never partialized in localStorage)
  serverId?: string;             // Server-side user ID
  createdAt: string;             // ISO date
  lastSeenAt: string;            // ISO date
  preferences: Record<string, any>;
}
```

### 4.2 LocalStorage Schema

```json
{
  "belive:user-profile": {
    "state": {
      "currentUserId": "uuid",
      "currentUser": { /* UserProfile */ },
      "isLoggedIn": true,
      "isGuest": false,
      "isReturning": true,
      "userName": "User",
      "userAvatar": "🎤",
      "isOnboarded": true,
      "showOnboarding": false,
      "catalogOnboardingComplete": false,
      "onboardingProgress": {
        "step1Done": false,
        "step2Done": false,
        "activeStep": 1
      }
    },
    "version": 2
  }
}
```

### 4.3 Migration Path

```typescript
// v1 → v2
migrate: (persisted, version) => {
  if (version === 1) {
    return {
      ...persisted,
      catalogOnboardingComplete: persisted.catalogOnboardingComplete ?? false,
      onboardingProgress: persisted.onboardingProgress ?? {
        step1Done: false, step2Done: false, activeStep: 1,
      },
    };
  }
}
```

### 4.4 Partialize Rules (что НЕ сохраняется в localStorage)

```typescript
partialize: (state) => ({
  // ✅ Сохраняется:
  currentUserId, isOnboarded, showOnboarding,
  currentUser, isLoggedIn, isGuest, isReturning,
  userName, userAvatar,
  catalogOnboardingComplete, onboardingProgress,
  // ❌ НЕ сохраняется (усечение):
  // createProfile, updateProfile, logout, deleteProfile, ... (все функции)
})
```

---

## 5. Error Protocol

### 5.1 AI Error Format

```typescript
class AIError extends Error {
  code: string;        // 'AUTH_REQUIRED' | 'CONFIG_ERROR' | 'WORKER_ERROR' | 'STREAM_ERROR'
  provider: string;    // 'belive' | 'openrouter-direct'
  statusCode?: number; // HTTP status if applicable

  constructor(code: string, message: string, provider: string, statusCode?: number)
}
```

### 5.2 Auth Error Responses

| Scenario | UI Message | Next Action |
|----------|-----------|-------------|
| Guest AI request | "Требуется авторизация. Войдите через Google" | Show login prompt |
| Session expired | "Сессия истекла. Войдите снова." | Redirect to welcome |
| Rate limited | "Лимит 20 запросов в день исчерпан." | Wait until next day |
| Worker offline | "Ошибка сервера" | Retry later |

---

## 6. Health Check Protocol

### 6.1 belive-auth health

```http
GET {VITE_AUTH_WORKER_URL}/health
→ 200 OK { status: "ok" }
→ 5xx Worker offline
```

### 6.2 belive-ai health

```typescript
// BeliveProvider.healthCheck()
POST {VITE_AI_WORKER_URL}
→ 401 (Worker alive, no auth in health check)
→ anything else → Worker unavailable
```

---

*Protocol v2.1 — актуально на 2026-06-07*
