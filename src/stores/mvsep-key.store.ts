/**
 * MVSEP Key Store — персональный API-ключ MVSEP (BYOK).
 *
 * Отдельный persist-ключ `belive:mvsep-key`, НЕ внутри профиля:
 *  - переживает гость→логин (`createOAuthProfile` пересоздаёт профиль и раньше
 *    терял `mvsepApiKey`, D5);
 *  - переживает логаут (Q4 решение главной сессии);
 *  - удаляется только явной кнопкой «Удалить ключ» (`clearApiKey`).
 *
 * ⚠ Ключ лежит в localStorage открытым текстом — как и раньше внутри профиля.
 * Это ключ пользователя от его собственного аккаунта MVSEP; шифрования нет.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useUserProfileStore } from './user-profile.store';

export const MVSEP_KEY_STORAGE_NAME = 'belive:mvsep-key';

interface MvsepKeyState {
  apiKey: string | null;
}

interface MvsepKeyActions {
  setApiKey: (key: string | null) => void;
  clearApiKey: () => void;
}

export const useMvsepKeyStore = create<MvsepKeyState & MvsepKeyActions>()(
  persist(
    (set) => ({
      apiKey: null,
      setApiKey: (key) => {
        const trimmed = key?.trim();
        set({ apiKey: trimmed ? trimmed : null });
      },
      clearApiKey: () => set({ apiKey: null }),
    }),
    {
      name: MVSEP_KEY_STORAGE_NAME,
      version: 1,
      partialize: (state) => ({ apiKey: state.apiKey }),
    },
  ),
);

/**
 * Одноразовая миграция: старые ключи лежали в `currentUser.mvsepApiKey`
 * (persist `belive:user-profile`). Переносим в отдельный стор и обнуляем старое
 * поле через существующий action — сам `user-profile.store` не меняем.
 * Идемпотентна. Возвращает true, если что-то перенесено.
 */
export function migrateMvsepKeyFromProfile(): boolean {
  try {
    const legacy = useUserProfileStore.getState().currentUser?.mvsepApiKey?.trim();
    if (!legacy) {return false;}
    if (!useMvsepKeyStore.getState().apiKey) {
      useMvsepKeyStore.getState().setApiKey(legacy);
    }
    useUserProfileStore.getState().setMvsepApiKey(null);
    return true;
  } catch (err) {
    console.warn('[mvsep-key] migration failed:', err);
    return false;
  }
}

// persist с localStorage гидратируется синхронно при создании сторов,
// поэтому на момент импорта профиль уже прочитан.
migrateMvsepKeyFromProfile();
