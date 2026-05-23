import { useState, useRef, useEffect, useCallback } from 'react';
import { useTrackInfoStore } from '../../stores/trackInfo.store';
import { useAiSettingsStore } from '../../stores/ai-settings.store';
import { useTrackStore } from '../../stores/track.store';
import { useBlocksStore } from '../../stores/blocks.store';
import { useLyricsStore } from '../../stores/lyrics.store';
import { aiHub } from '../../js/ai/registry';
import type { AiExpert } from '../../types/track-meta.types';
import type { ChatRequest } from '../../js/ai/types';
import { parseTrackName } from '../../catalog/types';
import {
  getSystemPrompt,
  getAutoQuery,
  buildTrackContext,
} from './ai-expert-prompts';
import {
  parseTextCommand,
  stripTextCommands,
  executeToolCall,
  parseQuickReplies,
  type QuickReply,
} from './ai-tools';
import styles from './TrackInfoBoard.module.css';

/* ── Expert tab config — ALL 4 experts ── */
const EXPERT_TABS: { id: AiExpert; icon: string; label: string; color: string }[] = [
  { id: 'vocal-coach',     icon: '🎤', label: 'Coach',     color: '#f97316' },
  { id: 'track-analyst',   icon: '🎵', label: 'Analyst',   color: '#818cf8' },
  { id: 'structure-expert', icon: '🔬', label: 'Structure', color: '#22d3ee' },
  { id: 'harmonic-match',  icon: '🎹', label: 'Harmonic',  color: '#a855f7' },
];

/* ── Markdown-lite renderer — React elements only, NO dangerouslySetInnerHTML ── */
function renderMd(text: string): React.ReactNode[] {
  // Strip [ACTION] tags (rendered as buttons separately)
  const { cleanText: afterActions } = parseQuickReplies(text);
  // Strip other commands ([SEEK], [SEARCH], [SEARCH_AUDIO], etc.)
  const displayText = stripTextCommands(afterActions);
  if (!displayText) return [];

  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(displayText)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{displayText.slice(lastIndex, match.index)}</span>);
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < displayText.length) {
    parts.push(<span key={key++}>{displayText.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : [<span key={0}>{displayText}</span>];
}

/** Extract QuickReply buttons from AI message text */
function extractReplies(text: string): QuickReply[] {
  if (!text) return [];
  const { replies } = parseQuickReplies(text);
  return replies;
}

interface AiExpertPanelProps {
  compact?: boolean;
}

export function AiExpertPanel({ compact = false }: AiExpertPanelProps = {}) {
  const activeExpert = useTrackInfoStore(s => s.activeExpert);
  const aiMessages = useTrackInfoStore(s => s.aiMessages);
  const isAiStreaming = useTrackInfoStore(s => s.isAiStreaming);
  const meta = useTrackInfoStore(s => s.meta);
  const clickedBlockType = useTrackInfoStore(s => s._clickedBlockType);
  const setActiveExpert = useTrackInfoStore(s => s.setActiveExpert);
  const addAiMessage = useTrackInfoStore(s => s.addAiMessage);
  const appendAiToken = useTrackInfoStore(s => s.appendAiToken);
  const setAiStreaming = useTrackInfoStore(s => s.setAiStreaming);
  const clearAiMessages = useTrackInfoStore(s => s.clearAiMessages);
  const currentTrack = useTrackStore(s => s.currentTrack);
  const blocks = useBlocksStore(s => s.blocks);
  const activeLineIndex = useLyricsStore(s => s.activeLineIndex);
  const isConfigured = useAiSettingsStore(s => s.isConfigured);
  const coachName = useAiSettingsStore(s => s.coachName);
  const [inputValue, setInputValue] = useState('');

  // Compact mode — always vocal-coach, no tabs
  useEffect(() => {
    if (compact && activeExpert !== 'vocal-coach') {
      setActiveExpert('vocal-coach');
    }
  }, [compact, activeExpert]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Derive active block
  let activeBlockType: string | null = null;
  const blocksList = blocks || [];
  if (activeLineIndex >= 0 && blocksList.length > 0) {
    for (const block of blocksList) {
      if (block.lineIndices?.includes(activeLineIndex)) {
        activeBlockType = block.type;
        break;
      }
    }
  }

  const effectiveBlock = clickedBlockType || activeBlockType;

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages.length, isAiStreaming]);

  // Build context for AI messages
  const buildCtx = useCallback(() => {
    const parsed = parseTrackName(currentTrack?.title || '');
    return buildTrackContext({
      title: parsed.title || currentTrack?.title || 'Unknown',
      artist: parsed.artist === 'Разное' ? '' : parsed.artist,
      blocks: blocksList.length > 0 ? blocksList.map(b => ({ type: b.type })) : null,
      activeBlockType: effectiveBlock,
      genre: meta?.genre || null,
      key: meta?.key || null,
      bpm: meta?.bpm || null,
    });
  }, [currentTrack, blocksList, effectiveBlock, meta]);

  // Process search tools from AI response (Wikipedia + AudioDB)
  const processSearchTools = useCallback(async (fullText: string, expert: AiExpert) => {
    // Check for [SEARCH_AUDIO: ...] or [SEARCH: ...]
    const audioMatch = fullText.match(/\[SEARCH_AUDIO:\s*([^\]]+)\]/i);
    const wikiMatch = fullText.match(/\[SEARCH:\s*([^\]]+)\]/i);
    const searchMatch = audioMatch || wikiMatch;
    if (!searchMatch) return;

    const toolName = audioMatch ? 'search_audiodb' : 'search_wikipedia';
    const searchQuery = searchMatch[1].trim();
    console.log('[AI] Search tool:', toolName, searchQuery);

    const result = await executeToolCall(toolName, { query: searchQuery });
    if (result.success) {
      // Inject search result as context and ask AI to continue
      const model = aiHub.getActiveModel();
      if (model) {
        const ctx = buildCtx();
        const systemPrompt = getSystemPrompt(expert, coachName);
        const continuationMessages = [
          { role: 'system' as const, content: `${systemPrompt}\n\nTRACK CONTEXT:\n${ctx}` },
          ...aiMessages.filter(m => m.role !== 'system').slice(-6).map(m => ({ 
            role: m.role as 'user' | 'assistant', 
            content: m.content 
          })),
          {
            role: 'user' as const,
            content: `Результат поиска (${toolName === 'search_audiodb' ? 'AudioDB' : 'Wikipedia'}) для "${searchQuery}":\n${result.message}\n\nИспользуй эти данные и ответь кратко с [ACTION] кнопками. Если это AudioDB — приведи конкретные BPM/Key.`,
          },
        ];

        setAiStreaming(true);
        addAiMessage({ role: 'assistant', content: '' });

        let continuationText = '';
        await aiHub.sendMessage(
          { model: model.id, messages: continuationMessages, stream: true } as ChatRequest,
          {
            onToken: (token: string) => {
              continuationText += token;
              appendAiToken(token);
            },
            onDone: () => {
              setAiStreaming(false);
              console.log('[AI] Search continuation done');
              // Check for nested [SEEK] commands in continuation
              const cmd = parseTextCommand(continuationText);
              if (cmd) {
                executeToolCall(cmd.tool, cmd.args).then(r => {
                  if (r.success) console.log('[AI] Nested tool OK:', r.message);
                });
              }
            },
            onError: (error: any) => {
              setAiStreaming(false);
              console.error('[AI] Search continuation error:', error.message);
            },
          },
        );
      }
    } else {
      // Search failed — tell user
      addAiMessage({ role: 'system', content: `⚠️ Поиск не удался: ${result.message}` });
    }
  }, [buildCtx, coachName, aiMessages, addAiMessage, appendAiToken, setAiStreaming]);

  // Process other text commands from AI response ([SEEK], [STRUCTURE], [CATALOG])
  const processAiResponse = useCallback(async (fullText: string, expert: AiExpert) => {
    // 1. Process [SEEK], [STRUCTURE], [CATALOG]
    const cmd = parseTextCommand(fullText);
    if (cmd && cmd.tool !== 'search_wikipedia' && cmd.tool !== 'search_audiodb') {
      console.log('[AI] Command:', cmd);
      const result = await executeToolCall(cmd.tool, cmd.args);
      if (result.success) {
        console.log('[AI] Tool OK:', result.message);
      }
    }

    // 2. Process search tools (Wikipedia + AudioDB) — with continuation
    await processSearchTools(fullText, expert);
  }, [processSearchTools]);

  // Send message to AI
  const sendToAi = useCallback(async (
    userText: string,
    expert: AiExpert,
    history: { role: string; content: string }[],
  ) => {
    const model = aiHub.getActiveModel();
    if (!model) {
      addAiMessage({ role: 'system', content: '⚠️ Модель не выбрана. Нажмите 🤖 → настройте AI.' });
      return;
    }

    const ctx = buildCtx();
    const prompt = getSystemPrompt(expert, coachName);
    const recent = history.filter(m => m.role !== 'system').slice(-10);
    const apiMsgs = [
      { role: 'system' as const, content: `${prompt}\n\nTRACK CONTEXT:\n${ctx}` },
      ...recent.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: userText },
    ];

    console.log('[AI] Send:', { model: model.id, expert, msgs: apiMsgs.length });

    setAiStreaming(true);
    addAiMessage({ role: 'assistant', content: '' });

    let full = '';

    await aiHub.sendMessage(
      { model: model.id, messages: apiMsgs, stream: true } as ChatRequest,
      {
        onToken: (t: string) => {
          full += t;
          appendAiToken(t);
        },
        onDone: () => {
          setAiStreaming(false);
          console.log('[AI] Done, chars:', full.length);
          processAiResponse(full, expert);
        },
        onError: (e: any) => {
          setAiStreaming(false);
          console.error('[AI] Error:', e.message);
          addAiMessage({ role: 'system', content: `❌ ${e.message}` });
        },
      },
    );
  }, [buildCtx, coachName, addAiMessage, appendAiToken, setAiStreaming, processAiResponse]);

  // Expert tab click
  const handleExpertClick = useCallback(async (expert: AiExpert) => {
    if (activeExpert === expert) return;
    clearAiMessages();
    setActiveExpert(expert);

    if (!isConfigured()) {
      addAiMessage({ role: 'system', content: '⚠️ AI не настроен. Нажмите 🤖 → настройте модель.' });
      return;
    }

    const q = getAutoQuery(expert);
    addAiMessage({ role: 'user', content: q });
    await sendToAi(q, expert, []);
  }, [activeExpert, isConfigured, sendToAi, setActiveExpert, clearAiMessages, addAiMessage]);

  // Quick Reply click handler
  const handleQuickReply = useCallback(async (reply: QuickReply) => {
    if (!activeExpert) return;

    switch (reply.type) {
      case 'seek': {
        const parts = reply.action.split(':');
        const sectionType = parts[1] || '';
        const occurrence = parts[2] ? parseInt(parts[2], 10) : 1;
        addAiMessage({ role: 'user', content: reply.label });
        const result = await executeToolCall('seek_to_section', { sectionType, occurrence });
        if (result.success) {
          addAiMessage({ role: 'assistant', content: `✓ ${result.message}` });
          // Усиление Центра_10: краткий AI комментарий после навигации
          await sendToAi(
            `Я перемотал к секции ${sectionType}. Что важного в этой части? Ответь в 1-2 предложения.`,
            activeExpert,
            aiMessages,
          );
        } else {
          addAiMessage({ role: 'assistant', content: `⚠ ${result.message}` });
        }
        break;
      }

      case 'query': {
        const queryText = reply.action.startsWith('QUERY:')
          ? reply.action.slice(6).trim()
          : reply.action;
        addAiMessage({ role: 'user', content: reply.label });
        await sendToAi(queryText, activeExpert, aiMessages);
        break;
      }

      case 'expert': {
        const expertId = reply.action.startsWith('EXPERT:')
          ? reply.action.slice(7).trim()
          : reply.action;
        if (expertId !== activeExpert) {
          await handleExpertClick(expertId as AiExpert);
        }
        break;
      }

      case 'search': {
        // Wikipedia search via QuickReply
        const searchQuery = reply.action.startsWith('SEARCH:')
          ? reply.action.slice(7).trim()
          : reply.action;
        addAiMessage({ role: 'user', content: reply.label });
        addAiMessage({ role: 'assistant', content: `Ищу в Wikipedia: "${searchQuery}"...` });
        const result = await executeToolCall('search_wikipedia', { query: searchQuery });
        if (result.success) {
          // Continue with AI commentary
          await sendToAi(
            `Wikipedia результат для "${searchQuery}":\n${result.message}\n\nИспользуй эти факты и ответь кратко с [ACTION] кнопками.`,
            activeExpert,
            aiMessages,
          );
        } else {
          addAiMessage({ role: 'assistant', content: `⚠️ Не найдено: ${result.message}` });
        }
        break;
      }

      case 'search-audio': {
        // AudioDB search via QuickReply
        const searchQuery = reply.action.startsWith('SEARCH_AUDIO:')
          ? reply.action.slice(13).trim()
          : reply.action;
        addAiMessage({ role: 'user', content: reply.label });
        addAiMessage({ role: 'assistant', content: `Ищу BPM/Key: "${searchQuery}"...` });
        const result = await executeToolCall('search_audiodb', { query: searchQuery });
        if (result.success) {
          // Continue with AI commentary
          await sendToAi(
            `AudioDB результат для "${searchQuery}":\n${result.message}\n\nПриведи конкретные BPM/Key и ответь кратко с [ACTION] кнопками.`,
            activeExpert,
            aiMessages,
          );
        } else {
          addAiMessage({ role: 'assistant', content: `⚠️ Данные не найдены: ${result.message}` });
        }
        break;
      }
    }
  }, [activeExpert, aiMessages, addAiMessage, sendToAi, handleExpertClick]);

  // User sends message
  const handleSend = useCallback(async () => {
    const t = inputValue.trim();
    if (!t || isAiStreaming || !activeExpert) return;
    addAiMessage({ role: 'user', content: t });
    setInputValue('');
    await sendToAi(t, activeExpert, aiMessages);
  }, [inputValue, isAiStreaming, activeExpert, aiMessages, addAiMessage, sendToAi]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const tab = EXPERT_TABS.find(t => t.id === activeExpert);

  return (
    <div className={styles.aiExpertPanel}>
      {/* Expert tabs — hidden in compact mode */}
      {!compact && (
      <div className={styles.expertTabs}>
        {EXPERT_TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.expertTab} ${activeExpert === t.id ? styles.expertTabActive : ''}`}
            onClick={() => handleExpertClick(t.id)}
            style={{ '--expert-color': t.color } as React.CSSProperties}
          >
            <span className={styles.expertTabIcon}>{t.icon}</span>
            <span className={styles.expertTabLabel}>{t.label}</span>
          </button>
        ))}
      </div>
      )}

      {/* Chat area */}
      <div className={styles.chatArea} style={compact ? { maxHeight: '160px' } : undefined}>
        {!activeExpert ? (
          <div className={styles.chatEmpty}>
            <span className={styles.chatEmptyIcon}>🤖</span>
            <span className={styles.chatEmptyText}>Выберите эксперта для анализа</span>
          </div>
        ) : (
          <>
            {aiMessages.map((msg, i) => {
              const replies = msg.role === 'assistant' ? extractReplies(msg.content) : [];
              return (
                <div key={i} className={styles.chatMessageWrap}>
                  <div
                    className={`${styles.chatMessage} ${
                      msg.role === 'user' ? styles.chatMsgUser :
                      msg.role === 'assistant' ? styles.chatMsgAi :
                      styles.chatMsgSystem
                    }`}
                  >
                    {msg.role === 'assistant' && tab && (
                      <span className={styles.chatMsgBadge} style={{ color: tab.color }}>
                        {tab.icon}
                      </span>
                    )}
                    <div className={styles.chatMsgContent}>
                      {msg.role === 'assistant' && msg.content
                        ? renderMd(msg.content)
                        : msg.content
                          ? msg.content
                          : isAiStreaming && i === aiMessages.length - 1
                            ? <span className={styles.chalkCursor}>▌</span>
                            : null}
                    </div>
                  </div>

                  {/* Quick Reply buttons */}
                  {replies.length > 0 && !isAiStreaming && (
                    <div className={styles.quickReplies}>
                      {replies.map((reply, j) => (
                        <button
                          key={j}
                          className={`${styles.quickReplyBtn} ${
                            reply.type === 'seek' ? styles.quickReplySeek :
                            reply.type === 'expert' ? styles.quickReplyExpert :
                            reply.type === 'search' ? styles.quickReplySearch :
                            reply.type === 'search-audio' ? styles.quickReplySearchAudio :
                            styles.quickReplyQuery
                          }`}
                          onClick={() => handleQuickReply(reply)}
                          disabled={isAiStreaming}
                        >
                          {reply.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {isAiStreaming && <div className={styles.streamingBar} />}
            <div ref={chatEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      {activeExpert && (
        <div className={styles.chatInputArea}>
          <input
            className={styles.chatInput}
            data-billy-input={compact ? 'true' : undefined}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder={tab ? `Спроси ${coachName}...` : 'Введите вопрос...'}
            disabled={isAiStreaming}
          />
          <button
            className={styles.chatSendBtn}
            onClick={handleSend}
            disabled={isAiStreaming || !inputValue.trim()}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}