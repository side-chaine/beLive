import { useEffect, useRef } from 'react';
import type { AiCoachMessage } from './ai-coach.store';
import styles from './AiCoachPanel.module.css';

interface AiCoachMessageListProps {
  messages: AiCoachMessage[];
  isStreaming: boolean;
  onSuggestion: (text: string) => void;
}

const SUGGESTIONS = [
  'Разбери структуру трека',
  'Где вход в припев?',
  'Что важно в бридже?',
];

export function AiCoachMessageList({ messages, isStreaming, onSuggestion }: AiCoachMessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = messages.length > 0 ? messages[messages.length - 1].id : null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, lastId, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyBadge} aria-hidden="true">✦</div>
        <p className={styles.emptyTitle}>Привет! Я AI Coach.</p>
        <p className={styles.emptyText}>
          Помогу разобрать трек, найти сложные переходы и настроить репетицию.
        </p>
        <div className={styles.suggestions}>
          {SUGGESTIONS.map((text) => (
            <button
              key={text}
              type="button"
              className={styles.suggestion}
              onClick={() => onSuggestion(text)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.messages} role="log" aria-live="polite" aria-relevant="additions text">
      {messages.map((msg, i) => {
        const isLast = i === messages.length - 1;
        const showCaret = isStreaming && isLast && msg.role === 'assistant';

        if (msg.role === 'system') {
          return (
            <div key={msg.id} className={styles.systemRow}>
              <span className={styles.systemText}>{msg.content}</span>
            </div>
          );
        }

        return (
          <div
            key={msg.id}
            className={msg.role === 'user' ? styles.rowUser : styles.rowCoach}
          >
            {msg.role === 'assistant' && (
              <span className={styles.avatar} aria-hidden="true">✦</span>
            )}
            <div className={msg.role === 'user' ? styles.bubbleUser : styles.bubbleCoach}>
              {msg.content}
              {showCaret && <span className={styles.caret} aria-hidden="true" />}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
