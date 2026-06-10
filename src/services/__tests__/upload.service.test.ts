import { describe, it, expect } from 'vitest';
import { classifyStemFromFilename, getFileNameWithoutExtension, getFileExtension, getBaseNameFromPath } from '../upload.service';

describe('upload.service — чистые функции', () => {
  describe('classifyStemFromFilename', () => {
    it('instrumental (нет совпадений) → null', () => {
      expect(classifyStemFromFilename('track-name.mp3')).toBeNull();
      expect(classifyStemFromFilename('song.wav')).toBeNull();
    });

    it('vocals → vocal', () => {
      expect(classifyStemFromFilename('track_vocals_')).toBe('vocals');
      expect(classifyStemFromFilename('lead_vocal')).toBe('vocals');
      expect(classifyStemFromFilename('track vox')).toBe('vocals');
    });

    it('drums → drums', () => {
      expect(classifyStemFromFilename('track_drums_')).toBe('drums');
      expect(classifyStemFromFilename('drm_track')).toBe('drums');
    });

    it('bass → bass', () => {
      expect(classifyStemFromFilename('bass_track')).toBe('bass');
      expect(classifyStemFromFilename('track_bass_')).toBe('bass');
    });

    it('guitar → guitar', () => {
      expect(classifyStemFromFilename('guitar_track')).toBe('guitar');
      expect(classifyStemFromFilename('track_gtr')).toBe('guitar');
    });

    it('keys/piano → keys', () => {
      expect(classifyStemFromFilename('keys_track')).toBe('keys');
      expect(classifyStemFromFilename('piano_part')).toBe('keys');
      expect(classifyStemFromFilename('synth_pad')).toBe('keys');
    });

    it('backing vocal → backing (даже если есть vocal)', () => {
      // back_voc содержит "voc" — но должен быть классифицирован как backing, не vocals
      expect(classifyStemFromFilename('back_voc')).toBe('backing');
      expect(classifyStemFromFilename('bgvoc_track')).toBe('backing');
    });

    it('other → other', () => {
      expect(classifyStemFromFilename('other_track')).toBe('other');
      expect(classifyStemFromFilename('track_other_')).toBe('other');
    });

    it('case insensitive', () => {
      expect(classifyStemFromFilename('DRUMS')).toBe('drums');
      expect(classifyStemFromFilename('Bass_Track')).toBe('bass');
      expect(classifyStemFromFilename('Guitar_Solo')).toBe('guitar');
    });
  });

  describe('getFileNameWithoutExtension', () => {
    it('убирает одно расширение', () => {
      expect(getFileNameWithoutExtension('track.mp3')).toBe('track');
    });

    it('убирает только последнее расширение', () => {
      expect(getFileNameWithoutExtension('track.name.mp3')).toBe('track.name');
    });

    it('без расширения возвращает как есть', () => {
      expect(getFileNameWithoutExtension('track')).toBe('track');
    });
  });

  describe('getFileExtension', () => {
    it('возвращает расширение без точки', () => {
      expect(getFileExtension('track.mp3')).toBe('mp3');
    });

    it('без расширения — пустая строка', () => {
      expect(getFileExtension('track')).toBe('');
    });
  });

  describe('getBaseNameFromPath', () => {
    it('извлекает имя из полного пути', () => {
      expect(getBaseNameFromPath('/path/to/track.mp3')).toBe('track.mp3');
    });

    it('без пути — возвращает как есть', () => {
      expect(getBaseNameFromPath('track.mp3')).toBe('track.mp3');
    });
  });
});
