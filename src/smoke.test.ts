/**
 * 🔥 SMOKE TESTS — beLive Core Flows
 *
 * These tests verify the most critical user flows.
 * If these pass, the app is likely operational.
 * If any fails, something fundamental is broken.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useModeStore } from './stores/mode.store';
import { useAppStore } from './stores/app.store';
import { useTrackStore } from './stores/track.store';
import { useAudioStore } from './stores/audio.store';
import { authService } from './services/auth.service';
import { classifyStemFromFilename } from './services/upload.service';

// ─── 1. Mode Switching ───
describe('[SMOKE] Mode Switching', () => {
  beforeEach(() => {
    useModeStore.setState({ mode: 'rehearsal' });
    useAppStore.setState({ surface: 'welcome', authChecked: true });
  });

  it('mode.store переключает все 4 режима', () => {
    const modes = ['karaoke', 'concert', 'live', 'rehearsal'] as const;
    for (const mode of modes) {
      useModeStore.getState().setMode(mode);
      expect(useModeStore.getState().mode).toBe(mode);
    }
  });

  it('app.store переключает поверхности', () => {
    useAppStore.getState().setSurface('app');
    expect(useAppStore.getState().surface).toBe('app');

    useAppStore.getState().setSurface('profile');
    expect(useAppStore.getState().surface).toBe('profile');
  });
});

// ─── 2. Track Management ───
describe('[SMOKE] Track Management', () => {
  beforeEach(() => {
    useTrackStore.setState({
      tracksMeta: [], currentTrackIndex: -1, currentTrack: null,
      currentCoverTheme: null, hasBlockScenes: false,
    });
  });

  it('track.store добавляет и удаляет треки', () => {
    const track1 = { id: '1', title: 'Song A', index: 0, artist: 'Artist' };
    const track2 = { id: '2', title: 'Song B', index: 1, artist: 'Artist' };
    useTrackStore.getState().setTracksMeta([track1, track2]);
    useTrackStore.getState().setCurrentTrackIndex(0);
    expect(useTrackStore.getState().tracksMeta).toHaveLength(2);

    useTrackStore.getState().removeTrack('1');
    expect(useTrackStore.getState().tracksMeta).toHaveLength(1);
  });
});

// ─── 3. Stem Classification ───
describe('[SMOKE] Stem Classification', () => {
  it('classifyStemFromFilename определяет все стемы', () => {
    expect(classifyStemFromFilename('drums_track')).toBe('drums');
    expect(classifyStemFromFilename('bass_line')).toBe('bass');
    expect(classifyStemFromFilename('guitar_solo')).toBe('guitar');
    expect(classifyStemFromFilename('piano_part')).toBe('keys');
    expect(classifyStemFromFilename('track_vocals_')).toBe('vocals');
    expect(classifyStemFromFilename('back_voc')).toBe('backing');
    expect(classifyStemFromFilename('song_title')).toBeNull();
  });
});

// ─── 4. Auth Tokens ───
describe('[SMOKE] Auth Tokens', () => {
  it('JWT генерация и валидация работает', () => {
    const token = authService._generateMockJWT();
    expect(token.split('.')).toHaveLength(3);
    expect(authService._isTokenValid(token)).toBe(true);
    expect(authService._isTokenValid('bad.token')).toBe(false);
  });
});

// ─── 5. Audio Store ───
describe('[SMOKE] Audio Store', () => {
  beforeEach(() => {
    useAudioStore.setState({
      isPlaying: false, currentTime: 0, duration: 0,
      hasVocals: false, playbackRate: 1,
      vocalMixEnabled: false, micEnabled: false, micVolume: 1,
    });
  });

  it('playback state transitions', () => {
    useAudioStore.getState().setPlaying(true);
    expect(useAudioStore.getState().isPlaying).toBe(true);

    useAudioStore.getState().setCurrentTime(42);
    expect(useAudioStore.getState().currentTime).toBe(42);
  });
});
