import { authService } from '../../services/auth.service';
import { useAppStore } from '../../stores/app.store';

export interface RehearsalLinkParams {
  roomId: string;
  role: 'teacher' | 'student';
  ticket: string;
  tgFileId?: string | null;
}

const STORAGE_KEY = 'bl-rehearsal-pending';

function parseFromUrl(): RehearsalLinkParams | null {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room');
  const role = params.get('role');
  const ticket = params.get('ticket');
  if (roomId && (role === 'teacher' || role === 'student') && ticket) {
    return { roomId, role, ticket, tgFileId: params.get('tgFileId') };
  }
  return null;
}

export async function handleRehearsalDeepLink(): Promise<RehearsalLinkParams | null> {
  let link = parseFromUrl();

  if (link) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(link)); // до чистки URL — иначе F5 теряет комнату
    window.history.replaceState({}, '', window.location.pathname);
  } else {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { link = JSON.parse(saved); } catch { link = null; }
    }
  }

  if (!link) return null;

  // Явный await — либо метод есть и вызов проходит, либо падаем
  // с реальной ошибкой вместо тихого неправильного поведения.
  const isAuthed = await authService.checkExistingAuth();
  if (isAuthed) {
    useAppStore.getState().setSurface('app'); // профиль уже есть, гостя не создаём
  } else {
    await authService.skipAuth(); // createProfile('Гость','🎤',true) → setSurface('app')
  }

  (window as any).beLiveSwitchMode?.('rehearsal');
  return link;
}

export function clearRehearsalDeepLink() {
  sessionStorage.removeItem(STORAGE_KEY);
}
