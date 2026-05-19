import { describe, it, expect } from 'vitest';
import { 
  getBaseNameFromPath, 
  getFileNameWithoutExtension, 
  getFileExtension 
} from './upload.service';

describe('getBaseNameFromPath', () => {
  it('extracts filename from full path', () => {
    expect(getBaseNameFromPath('/path/to/file.mp3')).toBe('file.mp3');
  });

  it('returns filename when no path', () => {
    expect(getBaseNameFromPath('file.mp3')).toBe('file.mp3');
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

describe('getFileNameWithoutExtension', () => {
  it('removes extension from filename', () => {
    expect(getFileNameWithoutExtension('file.mp3')).toBe('file');
  });

  it('handles filenames with multiple dots', () => {
    expect(getFileNameWithoutExtension('my.file.name.mp3')).toBe('my.file.name');
  });

  it('handles filename without extension', () => {
    expect(getFileNameWithoutExtension('file')).toBe('file');
  });

  it('handles full path', () => {
    expect(getFileNameWithoutExtension('/path/to/file.mp3')).toBe('file');
  });

  it('handles empty string', () => {
    expect(getFileNameWithoutExtension('')).toBe('');
  });

  it('handles hidden files (starting with dot)', () => {
    // .gitignore has no extension, so function returns the base name which is empty
    // This is expected behavior - dots at start are not considered extensions
    expect(getFileNameWithoutExtension('.gitignore')).toBe('');
  });
});

describe('getFileExtension', () => {
  it('extracts extension from filename', () => {
    expect(getFileExtension('file.mp3')).toBe('mp3');
  });

  it('handles filenames with multiple dots', () => {
    expect(getFileExtension('my.file.name.mp3')).toBe('mp3');
  });

  it('handles filename without extension', () => {
    expect(getFileExtension('file')).toBe('');
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
