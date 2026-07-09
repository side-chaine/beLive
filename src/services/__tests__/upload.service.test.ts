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

    it('other → other (или null если bare other без разделителей)', () => {
      // bare 'other' keyword removed — 'other_track' больше не совпадает (нет _other_)
      expect(classifyStemFromFilename('other_track')).toBeNull();
      // '_other_' keyword всё ещё активен
      expect(classifyStemFromFilename('track_other_')).toBe('other');
      // 'other_[mvsep' keyword всё ещё активен
      expect(classifyStemFromFilename('track_other_[mvsep.com]')).toBe('other');
    });

    it('case insensitive', () => {
      expect(classifyStemFromFilename('DRUMS')).toBe('drums');
      expect(classifyStemFromFilename('Bass_Track')).toBe('bass');
      expect(classifyStemFromFilename('Guitar_Solo')).toBe('guitar');
    });

    describe('2-stem ZIP promote (W9-UX-005)', () => {
      it('other_[mvsep.com] классифицируется как other stem', () => {
        expect(classifyStemFromFilename('Linkin Park - In the End_other_[mvsep.com]')).toBe('other');
      });

      it('vocals_[mvsep.com] классифицируется как vocals', () => {
        expect(classifyStemFromFilename('Linkin Park - In the End_vocals_[mvsep.com]')).toBe('vocals');
      });

      it('instrumental_[mvsep.com] не имеет совпадений → null (instrumental)', () => {
        expect(classifyStemFromFilename('Linkin Park - In the End_instrumental_[mvsep.com]')).toBeNull();
      });

      it('other_track (без разделителя) → null после удаления bare other', () => {
        expect(classifyStemFromFilename('other_track')).toBeNull();
      });
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

    it('handles full path', () => {
      expect(getFileNameWithoutExtension('/path/to/file.mp3')).toBe('file');
    });

    it('handles empty string', () => {
      expect(getFileNameWithoutExtension('')).toBe('');
    });

    it('handles hidden files (starting with dot)', () => {
      expect(getFileNameWithoutExtension('.gitignore')).toBe('');
    });
  });

  describe('getFileExtension', () => {
    it('возвращает расширение без точки', () => {
      expect(getFileExtension('track.mp3')).toBe('mp3');
    });

    it('без расширения — пустая строка', () => {
      expect(getFileExtension('track')).toBe('');
    });

    it('handles filenames with multiple dots', () => {
      expect(getFileExtension('my.file.name.mp3')).toBe('mp3');
    });

    it('handles full path', () => {
      expect(getFileExtension('/path/to/file.mp3')).toBe('mp3');
    });

    it('handles empty string', () => {
      expect(getFileExtension('')).toBe('');
    });

    it('handles uppercase extensions', () => {
      expect(getFileExtension('file.MP3')).toBe('MP3');
    });

    it('handles alignment.json pattern', () => {
      expect(getFileExtension('track-alignment.json')).toBe('json');
      expect(getFileExtension('alignment.json')).toBe('json');
    });
  });

  describe('getBaseNameFromPath', () => {
    it('извлекает имя из полного пути', () => {
      expect(getBaseNameFromPath('/path/to/track.mp3')).toBe('track.mp3');
    });

    it('без пути — возвращает как есть', () => {
      expect(getBaseNameFromPath('track.mp3')).toBe('track.mp3');
    });

    it('handles empty string', () => {
      expect(getBaseNameFromPath('')).toBe('');
    });

    it('handles null/undefined gracefully', () => {
      expect(getBaseNameFromPath(null as any)).toBe('');
      expect(getBaseNameFromPath(undefined as any)).toBe('');
    });

    it('handles paths with multiple slashes', () => {
      expect(getBaseNameFromPath('/a/b/c/d/e/file.mp3')).toBe('file.mp3');
    });
  });
});
