import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAiCoachStore } from './ai-coach.store';
import { aiCoachService } from './ai-coach.service';
import { AiCoachMessageList } from './AiCoachMessageList';
import { AiCoachComposer } from './AiCoachComposer';
import { parseFocusWord, stripTextCommands } from '../../components/TrackInfoBoard/ai-tools';
import styles from './AiCoachPanel.module.css';

/** Нижняя граница панели — над доком, какой бы высоты он ни был. */
function useDockOffset(): number {
  const [offset, setOffset] = useState(60);

  useEffect(() => {
    const dock = document.querySelector<HTMLElement>('[data-bl-deck]');
    if (!dock) {return;}

    const apply = () => setOffset(dock.offsetHeight + 12);
    apply();

    const ro = new ResizeObserver(apply);
    ro.observe(dock);
    return () => ro.disconnect();
  }, []);

  return offset;
}

/**
 * AI Coach — правая панель чата.
 * Фаза 1: оболочка (открытие/сворачивание, лента, ввод). Подключение к LLM — Фаза 2.
 */
export function AiCoachPanel() {
  const open = useAiCoachStore((s) => s.open);
  const collapsed = useAiCoachStore((s) => s.collapsed);
  const messages = useAiCoachStore((s) => s.messages);
  const isStreaming = useAiCoachStore((s) => s.isStreaming);
  const toggleCollapsed = useAiCoachStore((s) => s.toggleCollapsed);
  const setCollapsed = useAiCoachStore((s) => s.setCollapsed);
  const addMessage = useAiCoachStore((s) => s.addMessage);
  const appendToken = useAiCoachStore((s) => s.appendToken);
  const setMessageContent = useAiCoachStore((s) => s.setMessageContent);
  const setStreaming = useAiCoachStore((s) => s.setStreaming);
  const setFocusWord = useAiCoachStore((s) => s.setFocusWord);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dockOffset = useDockOffset();

  // Фокус в поле ввода при открытии/развороте.
  useEffect(() => {
    if (open && !collapsed) {inputRef.current?.focus();}
  }, [open, collapsed]);

  // Esc сворачивает панель, не теряя переписку.
  useEffect(() => {
    if (!open || collapsed) {return;}
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setCollapsed(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, collapsed, setCollapsed]);

  if (!open) {return null;}

  const handleSend = (text: string) => {
    if (isStreaming) {return;}

    // История — строго ДО текущего вопроса: иначе он попадёт в промпт дважды.
    const history = useAiCoachStore.getState().messages;
    addMessage({ role: 'user', content: text });
    const assistantId = addMessage({ role: 'assistant', content: '' });
    setStreaming(true);

    void aiCoachService
      .send(history, text, {
        onToken: (token) => appendToken(assistantId, token),
        onDone: (fullText) => {
          const streamed =
            useAiCoachStore.getState().messages.find((m) => m.id === assistantId)?.content ?? '';
          const raw = fullText || streamed;
          setMessageContent(assistantId, stripTextCommands(raw));
          setFocusWord(parseFocusWord(raw));
        },
        onError: (error) => {
          const partial =
            useAiCoachStore.getState().messages.find((m) => m.id === assistantId)?.content ?? '';
          setMessageContent(
            assistantId,
            partial
              ? `${stripTextCommands(partial)}\n\n— ответ оборвался: ${error.message}`
              : error.message,
          );
        },
      })
      .finally(() => setStreaming(false));
  };

  return (
    <aside
      className={styles.panel}
      data-collapsed={collapsed}
      style={{ '--ai-coach-bottom': `${dockOffset}px` } as CSSProperties}
      role="complementary"
      aria-label="AI Coach"
    >
      <header className={styles.header}>
        <button
          type="button"
          className={styles.badge}
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Развернуть AI Coach' : 'Свернуть AI Coach'}
          aria-expanded={!collapsed}
        >
          <span aria-hidden="true">✦</span>
        </button>

        {!collapsed && (
          <>
            <span className={styles.title}>AI Coach</span>
            <span className={styles.online}>
              <i className={styles.dot} aria-hidden="true" />
              Online
            </span>
            <button
              type="button"
              className={styles.chevron}
              onClick={toggleCollapsed}
              aria-label="Свернуть AI Coach"
              tabIndex={-1}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m3.5 6 4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}

        {collapsed && <span className={styles.railLabel} aria-hidden="true">AI</span>}
      </header>

      {!collapsed && (
        <>
          <AiCoachMessageList
            messages={messages}
            isStreaming={isStreaming}
            onSuggestion={handleSend}
          />
          <AiCoachComposer
            inputRef={inputRef}
            isStreaming={isStreaming}
            onSend={handleSend}
          />
        </>
      )}
    </aside>
  );
}
