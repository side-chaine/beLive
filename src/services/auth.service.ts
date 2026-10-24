const USE_MOCK_AUTH = import.meta.env.VITE_USE_MOCK_AUTH === 'true';
/**
 * Воркер авторизации. С v5 (cookie-сессии) — свой домен: только оттуда можно
 * поставить httpOnly cookie на mybelive.com. Legacy *.workers.dev остаётся
 * рабочим для старых ссылок.
 */
const AUTH_URL = import.meta.env.VITE_AUTH_WORKER_URL || 'https://auth.mybelive.com';

interface AuthCallbackData {
  authToken: string; name: string; email: string;
  avatarUrl?: string; serverId?: string;
}

interface RefreshResponse {
  jwt: string;
  expires_in: number;
  user: { sub: string; email: string; name: string; avatar?: string };
}

export const authService = {
  async skipAuth(): Promise<void> {
    const { useUserProfileStore } = await import('../stores/user-profile.store');
    const { useAppStore } = await import('../stores/app.store');
    useUserProfileStore.getState().createProfile('Гость', '🎤', true);
    useAppStore.getState().setSurface('app');
    useAppStore.getState().setAuthChecked(true);
  },

  async initiateGoogleOAuth(): Promise<void> {
    if (USE_MOCK_AUTH) {
      await this._mockAuth();
      return;
    }

    if (!AUTH_URL) {
      console.warn('[auth] VITE_AUTH_WORKER_URL not configured');
      if (import.meta.env.DEV) {
        await this._mockAuth();
        return;
      }
      throw new Error('Auth not configured');
    }

    // ⚠️ iOS PWA KNOWN LIMITATION: OAuth opens Safari, user must manually
    // return to PWA after authorization. Callback URL params persist in
    // PWA's session and are processed on next app load.
    // v3.0: investigate ASWebAuthenticationSession or universal links.
    window.location.href = `${AUTH_URL}/auth/google`;
  },

  /**
   * Молча продлить сессию по httpOnly cookie.
   * Возвращает свежий короткий JWT или null, если сессии нет/она протухла.
   */
  async refreshSession(): Promise<RefreshResponse | null> {
    try {
      const res = await fetch(`${AUTH_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = (await res.json()) as RefreshResponse;
      return data?.jwt ? data : null;
    } catch (e) {
      console.warn('[auth] refreshSession failed:', e);
      return null;
    }
  },

  /**
   * Старт приложения. Приоритет:
   * 1) cookie-сессия → молча продлеваем (переживает reload и деплои);
   * 2) legacy JWT в localStorage (переходный период);
   * 3) гость.
   */
  async checkExistingAuth(): Promise<boolean> {
    const { useUserProfileStore } = await import('../stores/user-profile.store');
    const store = useUserProfileStore.getState();

    const session = await this.refreshSession();
    if (session) {
      if (!store.currentUser || store.currentUser.isGuest) {
        store.createOAuthProfile({
          name: session.user.name,
          email: session.user.email,
          avatarUrl: session.user.avatar || undefined,
          serverId: session.user.sub,
          authToken: session.jwt,
        });
      } else {
        useUserProfileStore.setState({
          currentUser: { ...store.currentUser, authToken: session.jwt },
        });
      }
      return true;
    }

    if (!store.currentUser) return false;
    // Гость — токена нет по определению
    if (store.currentUser.isGuest) return true;
    // Legacy: старый токен мог остаться в localStorage до миграции
    return this._isTokenValid(store.currentUser.authToken || '');
  },

  /** Выход: сносим серверную сессию (KV + cookie) и локальный профиль. */
  async logout(): Promise<void> {
    try {
      await fetch(`${AUTH_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.warn('[auth] logout request failed:', e);
    }
    const { useUserProfileStore } = await import('../stores/user-profile.store');
    useUserProfileStore.getState().logout();
  },

  async handleCallback(params: URLSearchParams): Promise<AuthCallbackData | null> {
    const token = params.get('auth');

    if (!token) return null;

    const valid = this._isTokenValid(token);

    if (!valid) return null;

    try {
      const payloadStr = this._decodeBase64Url(token.split('.')[1]);

      const payload = JSON.parse(payloadStr);

      return {
        authToken: token,
        name: params.get('name') || payload.name || payload.given_name || 'User',
        email: params.get('email') || payload.email || '',
        avatarUrl: params.get('avatar') || payload.avatar || payload.picture || undefined,
        serverId: params.get('sid') || payload.sub || undefined,
      };
    } catch (e) {
      console.error('[auth] handleCallback error:', e);
      return null;
    }
  },

  _decodeBase64Url(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  },

  _isTokenValid(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(this._decodeBase64Url(parts[1]));
      return payload.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  },

  async _mockAuth(): Promise<void> {
    const { useUserProfileStore } = await import('../stores/user-profile.store');
    const { useAppStore } = await import('../stores/app.store');
    useUserProfileStore.getState().createOAuthProfile({
      name: 'Тестовый Пользователь',
      email: 'test@belive.app',
      authToken: this._generateMockJWT(),
    });
    useAppStore.getState().setSurface('app');
    useAppStore.getState().setAuthChecked(true);
  },

  _generateMockJWT(): string {
    // btoa() не поддерживает кириллицу — имя в payload только Latin1
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: 'mock-user-id',
      name: 'Test User',
      email: 'test@belive.app',
      exp: Math.floor(Date.now() / 1000) + 86400 * 30,
      iat: Math.floor(Date.now() / 1000),
    }));
    const signature = btoa('mock-signature');
    return `${header}.${payload}.${signature}`;
  },
};
