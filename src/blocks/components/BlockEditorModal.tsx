import React, { useEffect } from 'react';
import { useBlockEditorStore } from '../store/blockEditor.store';
import { BLOCK_TYPE_CONFIG, getBlockTypeConfig } from '../types';
import type { EditingBlock } from '../types';
import styles from './BlockEditorModal.module.css';

/* ═══════════════════════════════════════════
   Block Editor Modal — Sprint 36
   Full-screen overlay for editing song blocks
   z-index: 9999 (above all panels)
   ═══════════════════════════════════════════ */

export default function BlockEditorModal() {
  const {
    isOpen, blocks, isEditMode, selectedBlockId, isSaving,
    undoStack, redoStack,
    selectBlock, setBlockType, addBlock, deleteBlock,
    updateBlockText, toggleEditMode, undo, redo, save, cancel,
  } = useBlockEditorStore();

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, undo, redo]);

  if (!isOpen) return null;

  const selectedBlock = blocks.find(b => b.id === selectedBlockId);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Saving overlay */}
        {isSaving && (
          <div className={styles.savingOverlay}>
            <span className={styles.savingText}>Сохранение...</span>
          </div>
        )}

        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>Редактор Блоков</h1>
          <span className={styles.status}>
            {isEditMode ? 'Режим редактирования текста' : 'Режим выбора блоков'}
          </span>
        </header>

        {/* Content */}
        <div className={styles.content}>
          {/* Block List */}
          <div className={styles.blockList}>
            {blocks.map(block => (
              <BlockItem
                key={block.id}
                block={block}
                isSelected={selectedBlockId === block.id}
                isEditMode={isEditMode}
                onSelect={() => {
                  if (!isEditMode) selectBlock(block.id);
                }}
                onTextChange={(text) => updateBlockText(block.id, text)}
              />
            ))}
            {blocks.length === 0 && (
              <div className={styles.emptyState}>
                Нет блоков. Нажмите «Добавить блок».
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className={styles.sidebar}>
            {/* Type selector — visible when block selected, not editing */}
            {selectedBlock && !isEditMode && (
              <div className={styles.typeSection}>
                <div className={styles.sectionLabel}>Тип блока:</div>
                {BLOCK_TYPE_CONFIG.map(cfg => (
                  <button
                    key={cfg.type}
                    className={`${styles.typeBtn} ${
                      selectedBlock.type === cfg.type ? styles.typeBtnActive : ''
                    }`}
                    style={{ '--type-color': `var(${cfg.cssVar}, ${cfg.color})` } as React.CSSProperties}
                    onClick={() => setBlockType(selectedBlock.id, cfg.type)}
                  >
                    {cfg.labelRu}
                  </button>
                ))}
              </div>
            )}

            <div className={styles.actions}>
              <button className={styles.btn} onClick={addBlock}>
                Добавить блок
              </button>
              <button
                className={`${styles.btn} ${isEditMode ? styles.btnActive : ''}`}
                onClick={toggleEditMode}
              >
                {isEditMode ? 'Готово' : 'Редактировать текст'}
              </button>
              <button
                className={`${styles.btn} ${styles.btnDanger}`}
                disabled={!selectedBlockId || isEditMode}
                onClick={() => selectedBlockId && deleteBlock(selectedBlockId)}
              >
                Удалить блок
              </button>

              <div className={styles.separator} />

              <button
                className={styles.btn}
                disabled={undoStack.length === 0}
                onClick={undo}
              >
                ↶ Undo
              </button>
              <button
                className={styles.btn}
                disabled={redoStack.length === 0}
                onClick={redo}
              >
                ↷ Redo
              </button>

              <div className={styles.separator} />

              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={isSaving}
                onClick={save}
              >
                {isSaving ? 'Сохранение...' : 'Сохранить трек'}
              </button>
              <button
                className={styles.btn}
                onClick={cancel}
                disabled={isSaving}
              >
                Отмена
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ── Block Item (internal component) ── */

function BlockItem({
  block,
  isSelected,
  isEditMode,
  onSelect,
  onTextChange,
}: {
  block: EditingBlock;
  isSelected: boolean;
  isEditMode: boolean;
  onSelect: () => void;
  onTextChange: (text: string) => void;
}) {
  const cfg = getBlockTypeConfig(block.type);

  return (
    <div
      className={`${styles.block} ${isSelected ? styles.blockSelected : ''}`}
      style={{ '--block-color': `var(${cfg.cssVar}, ${cfg.color})` } as React.CSSProperties}
      onClick={onSelect}
    >
      <div className={styles.blockTypeLabel}>{cfg.labelRu}</div>
      {isEditMode ? (
        <textarea
          className={styles.blockTextarea}
          value={block.text}
          onChange={e => onTextChange(e.target.value)}
          rows={Math.max(2, block.text.split('\n').length)}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div className={styles.blockText}>
          {block.text || <span className={styles.placeholder}>Пустой блок</span>}
        </div>
      )}
    </div>
  );
}
