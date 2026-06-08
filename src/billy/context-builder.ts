import { BillyContext, BillyZone } from './types';
import { useUserProfileStore } from '../stores/user-profile.store';
import { useModeStore } from '../stores/mode.store';
import { useTrackStore } from '../stores/track.store';

/**
 * Собрать полный контекст пользователя и окружения.
 * Использует РЕАЛЬНЫЕ данные из сторов — без заглушек.
 */
export function buildBillyContext(): BillyContext {
  const profile = useUserProfileStore.getState();
  const mode = useModeStore.getState();
  const tracks = useTrackStore.getState();

  return {
    zone: 'catalog-empty',
    userName: profile.userName || 'Гость',
    isGuest: profile.isGuest ?? false,
    tracksCount: tracks.tracksMeta?.length ?? 0,
    currentTrackTitle: tracks.currentTrack?.title ?? null,
    currentMode: mode.mode,
    onboardingStep: profile.onboardingProgress?.activeStep ?? 1,
  };
}

export function resolveZone(ctx: BillyContext): BillyZone {
  if (ctx.currentMode === 'live') return 'live';
  if (ctx.currentMode === 'karaoke' || ctx.currentMode === 'concert') return 'karaoke';
  if (ctx.currentMode === 'rehearsal' && ctx.currentTrackTitle) return 'rehearsal';
  if (ctx.tracksCount > 0) return 'catalog-ready';
  return 'catalog-empty';
}
