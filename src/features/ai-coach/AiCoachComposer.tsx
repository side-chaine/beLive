import { useState, type RefObject } from 'react';
import styles from './AiCoachPanel.module.css';

interface AiCoachComposerProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isStreaming: boolean;
  onSend: (text: string) => void;
}

export function AiCoachComposer({ inputRef, isStreaming, onSend }: AiCoachComposerProps) {
  const [value, setValue] = useState('');
  const canSend = value.trim().length > 0 && !isStreaming;

  const submit = () => {
    const text = value.trim();
    if (!text || isStreaming) return;
    setValue('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    onSend(text);
  };

  return (
    <div className={styles.composer}>
      <span className={styles.composerGlyph} aria-hidden="true">✦</span>
      <textarea
        ref={inputRef}
        className={styles.input}
        rows={1}
        value={value}
        placeholder="Ask me anything…"
        aria-label="Сообщение для AI Coach"
        onChange={(e) => {
          setValue(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        disabled={isStreaming}
      />
      <button
        type="button"
        className={styles.send}
        onClick={submit}
        disabled={!canSend}
        aria-label="Отправить"
        title="Отправить"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2.5 8h10M8.5 3.5 13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
