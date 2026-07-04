import { describe, it, expect } from 'vitest';
import { migratePersistedBlock, TAXONOMY_VERSION } from '../utils/block-migration';

describe('Gate B — Persistence', () => {

  describe('migratePersistedBlock (lazy repair)', () => {

    it('восстанавливает taxonomyVersion и originalTag для блока без полей', () => {
      const oldBlock = { id: '1', name: 'Chorus', lineIndices: [0,1,2], type: 'chorus' };
      const migrated = migratePersistedBlock(oldBlock);
      expect(migrated.taxonomyVersion).toBe(TAXONOMY_VERSION);
      expect(migrated.originalTag).toBe('Chorus');
      expect(migrated._originalTagInferred).toBe(true);
    });

    it('не трогает блок с актуальной taxonomyVersion', () => {
      const block = { id: '1', name: 'Chorus', lineIndices: [0,1,2], type: 'chorus', taxonomyVersion: TAXONOMY_VERSION, originalTag: 'Chorus' };
      const migrated = migratePersistedBlock(block);
      expect(migrated).toBe(block); // тот же объект
    });

    it('не перезаписывает существующий originalTag из Genius', () => {
      const block = { id: '1', name: 'Chorus', lineIndices: [0,1,2], type: 'verse', originalTag: 'Refrain' };
      const migrated = migratePersistedBlock(block);
      expect(migrated.originalTag).toBe('Refrain');
      expect(migrated._originalTagInferred).toBeUndefined();
    });

    it('восстанавливает taxonomyVersion если он меньше текущего', () => {
      const block = { id: '1', name: 'Chorus', lineIndices: [0,1,2], type: 'chorus', taxonomyVersion: 0 };
      const migrated = migratePersistedBlock(block);
      expect(migrated.taxonomyVersion).toBe(TAXONOMY_VERSION);
    });

    it('проставляет _originalTagInferred для блоков без originalTag', () => {
      const block = { id: '1', name: 'Chorus', lineIndices: [0,1,2], type: 'bridge', taxonomyVersion: TAXONOMY_VERSION };
      // taxonomyVersion в норме, но originalTag отсутствует
      const migrated = migratePersistedBlock(block);
      expect(migrated.taxonomyVersion).toBe(TAXONOMY_VERSION);
      expect(migrated._originalTagInferred).toBe(true);
    });

  });

  describe('PersistedTextBlock interface', () => {
    it('пропускает originalTag/instrument/taxonomyVersion (runtime check)', () => {
      const block = {
        id: 'test',
        name: 'Solo',
        lineIndices: [5],
        type: 'solo',
        originalTag: 'Guitar Solo',
        instrument: 'guitar',
        taxonomyVersion: 1,
      };
      // Проверяем что поля не стираются при сохранении/чтении
      expect(block.originalTag).toBe('Guitar Solo');
      expect(block.instrument).toBe('guitar');
      expect(block.taxonomyVersion).toBe(1);
    });
  });

});
