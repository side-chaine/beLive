const USE_MOCK_AUTH = import.meta.env.VITE_USE_MOCK_AUTH === 'true';
const CF_WORKER_URL = import.meta.env.VITE_AUTH_WORKER_URL 
  || 'https://belive-auth.nikitosss007.workers.dev';

interface AuthCallbackData {
  authToken: string; name: string; email: string;
  avatarUrl?: string; serverId?: string;
}

export const authService = {
  async initiateGoogleOAuth(): Promise<void> {
    if (USE_MOCK_AUTH) {
      await this._mockAuth();
      return;
    }

    // Env guard
    if (!CF_WORKER_URL) {
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
    // Редирект на Worker — он строит Google OAuth URL и обрабатывает callback
    window.location.href = `${CF_WORKER_URL}/auth/google`;
  },

  async checkExistingAuth(): Promise<boolean> {
    const { useUserProfileStore } = await import('../stores/user-profile.store');
    if (USE_MOCK_AUTH) {
      // Не пропускать WelcomePage — проверить есть ли реальный профиль
      return !!useUserProfileStore.getState().currentUser;
    }
    const store = useUserProfileStore.getState();
    if (!store.currentUser?.authToken) return false;
    return this._isTokenValid(store.currentUser.authToken);
  },

  async handleCallback(params: URLSearchParams): Promise<AuthCallbackData | null> {
    const authToken = params.get('auth');
    const name = params.get('name');
    const email = params.get('email');
    const avatarUrl = params.get('avatar');
    const serverId = params.get('sid');

    if (!authToken || !name || !email) return null;
    if (!this._isTokenValid(authToken)) return null;

    return { authToken, name, email, avatarUrl: avatarUrl || undefined, serverId: serverId || undefined };
  },

  _isTokenValid(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      // Worker использует URL-safe base64 (без =, - вместо +, _ вместо /)
      const payload = JSON.parse(atob(
        parts[1].replace(/-/g, '+').replace(/_/g, '/')
      ));
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
