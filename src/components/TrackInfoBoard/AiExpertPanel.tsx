import { useState, useRef, useEffect, useCallback } from 'react';
import { useTrackInfoStore } from '../../stores/trackInfo.store';
import { useAiSettingsStore } from '../../stores/ai-settings.store';
import { useTrackStore } from '../../stores/track.store';
import { useBlocksStore } from '../../stores/blocks.store';
import { useAudioStore } from '../../stores/audio.store';
import { useLoopStore } from '../../stores/loop.store';
import { usePracticeStore } from '../../stores/practice-session.store';
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
import type { PracticeScenarioId } from '../../practice/practice-scenarios';
import { getScenario, resolveTargetBlock, suggestScenarios, getAvailableScenarios, getRussianStructureFormula, BLOCK_TYPE_NAMES } from '../../practice/practice-scenarios';
import { runPracticeActions } from '../../practice/billy-action-runner';
import { PracticeSessionCard } from './PracticeSessionCard';
import { buildStartMessage, buildErrorMessage } from '../../practice/practice-messages';
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
  const currentTrack = useTrackStore(s => s.currentTrack);
  const blocks = useBlocksStore(s => s.blocks);
  const activeLineIndex = useLyricsStore(s => s.activeLineIndex);
  const isConfigured = useAiSettingsStore(s => s.isConfigured);
  const coachName = useAiSettingsStore(s => s.coachName);
  const isSessionActive = usePracticeStore(s => s.isActive);
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastGreetedTrackId = useRef<string | null>(null);

  // Compact mode — always vocal-coach, no tabs
  useEffect(() => {
    if (compact && activeExpert !== 'vocal-coach') {
      setActiveExpert('vocal-coach');
    }
  }, [compact, activeExpert]);

  // Proactive greeting on track load — React state driven, not DOM event
  useEffect(() => {
    const trackId = currentTrack?.id || currentTrack?.title;
    if (!trackId) return; // no track yet
    
    // Already greeted for this track
    if (lastGreetedTrackId.current === trackId) return;
    lastGreetedTrackId.current = trackId;

    // Don't greet if practice is active
    const practiceState = usePracticeStore.getState();
    if (practiceState.isActive) return;

    const parsed = parseTrackName(currentTrack?.title || '');
    const currentBlocks = useBlocksStore.getState().blocks || [];
    const formula = getRussianStructureFormula(currentBlocks);

    // Smart suggestions
    const suggestions = suggestScenarios(currentBlocks);

    // Build greeting
    const title = parsed.title || currentTrack?.title || 'Трек';
    const artist = parsed.artist && parsed.artist !== 'Разное' ? ` — ${parsed.artist}` : '';
    
    let greeting = `🎵 ${title}${artist}\n`;
    if (formula) {
      greeting += `Структура: ${formula}\n`;
    }
    greeting += '\nС чего начнём?\n';

    // Add scenario buttons
    suggestions.forEach(s => {
      greeting += `[ACTION: ${s.label}|SCENARIO:${s.id}:${s.target}]\n`;
    });

    // Add navigation buttons if no suggestions
    if (suggestions.length === 0) {
      greeting += '[ACTION: ▶ К припеву|SEEK:chorus:1]\n';
      greeting += '[ACTION: 🔄 На повтор|LOOP:chorus]\n';
    }

    addAiMessage({ role: 'assistant', content: greeting });
  }, [currentTrack]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps — stores stable, not reactive deps
  const buildCtx = useCallback(() => {
    const parsed = parseTrackName(currentTrack?.title || '');

    // Read runtime state
    const audioState = useAudioStore.getState();
    const loopState = useLoopStore.getState();
    const practiceState = usePracticeStore.getState();

    // Determine loop block type from loopBlockIds
    let loopBlockType: string | null = null;
    if (loopState.isLooping && loopState.loopBlockIds?.length) {
      const allBlocks = useBlocksStore.getState().blocks;
      const loopBlock = allBlocks?.find(b => loopState.loopBlockIds.includes(b.id));
      if (loopBlock) loopBlockType = loopBlock.type;
    }

    return buildTrackContext({
      title: parsed.title || currentTrack?.title || 'Unknown',
      artist: parsed.artist === 'Разное' ? '' : parsed.artist,
      blocks: blocksList.length > 0 ? blocksList.map(b => ({ type: b.type })) : null,
      activeBlockType: effectiveBlock,
      genre: meta?.genre || null,
      key: meta?.key || null,
      bpm: meta?.bpm || null,
      // RUNTIME STATE:
      playbackRate: audioState.playbackRate,
      isLooping: loopState.isLooping,
      loopBlockType,
      practiceActive: practiceState.isActive,
      practiceStatus: practiceState.practiceStatus,
      practiceRate: practiceState.currentRate,
      practicePasses: practiceState.passesCount,
      availableScenarios: getAvailableScenarios(),
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
    if (cmd) {
      // Player control tools — SAFETY: NOT auto-executed from AI text
      // These MUST go through [ACTION] quick reply click for user consent
      const PLAYER_TOOLS = [
        'set_playback_rate',
        'loop_section',
        'set_stem_volume',
        'switch_mode',
        'toggle_vocal_mix',
      ];

      if (PLAYER_TOOLS.includes(cmd.tool)) {
        // Strip from display, log warning, do NOT execute
        console.log('[AI] Player command blocked (not through ACTION button):', cmd.tool, cmd.args);
      } else if (cmd.tool !== 'search_wikipedia' && cmd.tool !== 'search_audiodb') {
        // Legacy/info tools: safe to auto-execute
        console.log('[AI] Command:', cmd);
        const result = await executeToolCall(cmd.tool, cmd.args);
        if (result.success) {
          console.log('[AI] Tool OK:', result.message);
        }
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
    // НЕ очищаем сообщения при смене эксперта — пользователь хочет контекст
    setActiveExpert(expert);

    if (!isConfigured()) {
      addAiMessage({ role: 'system', content: '⚠️ AI не настроен. Нажмите 🤖 → настройте модель.' });
      return;
    }

    const q = getAutoQuery(expert);
    addAiMessage({ role: 'user', content: q });
    await sendToAi(q, expert, []);
  }, [activeExpert, isConfigured, sendToAi, setActiveExpert, addAiMessage]);

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
        const searchQuery = reply.action.startsWith('SEARCH_AUDIO:')
          ? reply.action.slice(13).trim()
          : reply.action;
        addAiMessage({ role: 'user', content: reply.label });
        addAiMessage({ role: 'assistant', content: `Ищу BPM/Key: "${searchQuery}"...` });
        const result = await executeToolCall('search_audiodb', { query: searchQuery });
        if (result.success) {
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

      /* ═══ Wave G: Player Controls ═══ */

      case 'bpm': {
        const bpmValue = reply.action.startsWith('BPM:')
          ? reply.action.slice(4).trim()
          : reply.action;
        const targetRate = parseFloat(bpmValue);
        if (isNaN(targetRate)) {
          addAiMessage({ role: 'assistant', content: '⚠️ Неверное значение темпа' });
          break;
        }
        const result = await executeToolCall('set_playback_rate', { rate: targetRate });
        if (result.success) {
          const pct = Math.round(targetRate * 100);
          addAiMessage({ role: 'assistant', content: `✓ Темп: ${pct}%` });
        } else {
          addAiMessage({ role: 'assistant', content: `⚠️ ${result.message}` });
        }
        break;
      }

      case 'loop': {
        addAiMessage({ role: 'user', content: reply.label });
        const loopRaw = reply.action.startsWith('LOOP:')
          ? reply.action.slice(5).trim()
          : reply.action;
        if (loopRaw.toLowerCase() === 'off') {
          const r = await executeToolCall('loop_section', { enabled: false });
          addAiMessage({ role: 'assistant', content: r.success ? `✓ ${r.message}` : `⚠ ${r.message}` });
        } else {
          const parts = loopRaw.split(':');
          const r = await executeToolCall('loop_section', {
            sectionType: parts[0] || '',
            occurrence: parts[1] ? parseInt(parts[1], 10) : 1,
          });
          addAiMessage({ role: 'assistant', content: r.success ? `✓ ${r.message}` : `⚠ ${r.message}` });
        }
        break;
      }

      case 'volume': {
        addAiMessage({ role: 'user', content: reply.label });
        const volRaw = reply.action.startsWith('VOLUME:')
          ? reply.action.slice(7).trim()
          : reply.action;
        const volParts = volRaw.split(':');
        const r = await executeToolCall('set_stem_volume', {
          stemId: volParts[0] || '',
          volume: volParts[1] ? parseFloat(volParts[1]) : 0,
        });
        addAiMessage({ role: 'assistant', content: r.success ? `✓ ${r.message}` : `⚠ ${r.message}` });
        break;
      }

      case 'mode': {
        addAiMessage({ role: 'user', content: reply.label });
        const modeVal = reply.action.startsWith('MODE:')
          ? reply.action.slice(5).trim()
          : reply.action;
        const r = await executeToolCall('switch_mode', { mode: modeVal });
        addAiMessage({ role: 'assistant', content: r.success ? `✓ ${r.message}` : `⚠ ${r.message}` });
        break;
      }

      case 'vocalmix': {
        addAiMessage({ role: 'user', content: reply.label });
        const vmRaw = reply.action.startsWith('VOCALMIX:')
          ? reply.action.slice(9).trim()
          : reply.action;
        const vmEnabled = vmRaw.toLowerCase() !== 'off' && vmRaw.toLowerCase() !== 'false';
        const r = await executeToolCall('toggle_vocal_mix', { enabled: vmEnabled });
        addAiMessage({ role: 'assistant', content: r.success ? `✓ ${r.message}` : `⚠ ${r.message}` });
        break;
      }

      case 'scenario': {
        try {
          // Parse scenario command
          const scenarioMatch = reply.action.match(/^SCENARIO:([^:\]]+)(?::([^\]]+))?$/);
          if (!scenarioMatch) {
            addAiMessage({ role: 'assistant', content: '⚠️ Не удалось распознать сценарий' });
            break;
          }

          const scenarioId = scenarioMatch[1] as PracticeScenarioId;
          const scenarioTarget = scenarioMatch[2] || null;

          // Resolve target block
          const target = resolveTargetBlock({
            requestedBlockType: scenarioTarget || undefined,
          });
          if (!target) {
            addAiMessage({ role: 'assistant', content: '⚠️ Не удалось найти блок для сценария' });
            break;
          }

          // Get scenario definition
          const scenario = getScenario(scenarioId);
          if (!scenario) {
            addAiMessage({ role: 'assistant', content: `⚠️ Сценарий "${scenarioId}" не найден` });
            break;
          }

          // ★ CAPTURE SNAPSHOT BEFORE ANY ACTIONS ★
          const snapshotBefore = usePracticeStore.getState().getSnapshot();

          // Generate and execute start actions
          const ctx = { requestedBlockType: target.blockType, requestedBlockId: target.blockId };
          const startActions = typeof scenario.startActions === 'function'
            ? scenario.startActions(ctx)
            : scenario.startActions;

          const stepResults = await runPracticeActions({ actions: startActions });

          // Check results — partial failure = restore from pre-captured snapshot
          if (!stepResults.every(sr => sr.result.success)) {
            const failedStep = stepResults.find(sr => !sr.result.success)!;
            usePracticeStore.getState().restoreAndCancel(snapshotBefore);
            addAiMessage({ role: 'assistant', content: buildErrorMessage(failedStep) });
            break;
          }

          // All succeeded — start practice with pre-captured snapshot
          const blockLabel = BLOCK_TYPE_NAMES[target.blockType] || target.blockType;

          const SCENARIO_LABELS: Record<string, string> = {
            'bpm-ramp': `🔥 Разгон ${blockLabel}`,
            'focus-mix': `🎚 Фокус: ${blockLabel}`,
            'section-breakdown': `🗺 Разбор трека`,
          };
          usePracticeStore.getState().startPractice(scenarioId, SCENARIO_LABELS[scenarioId] || `🔥 ${blockLabel}`, snapshotBefore, target.blockId);

          addAiMessage({
            role: 'assistant',
            content: buildStartMessage(stepResults, blockLabel, scenarioId),
          });

        } catch (err: any) {
          // Exception — cancel cleanly
          try { usePracticeStore.getState().cancelPractice(); } catch {}
          addAiMessage({
            role: 'assistant',
            content: `⚠️ Ошибка запуска: ${err?.message || 'неизвестная'}`,
          });
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
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
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
                      {(isSessionActive
                        ? replies.filter(r => ['seek', 'expert', 'search', 'search-audio'].includes(r.type))
                        : replies
                      ).map((reply, j) => (
                        <button
                          key={j}
                          className={`${styles.quickReplyBtn} ${
                            reply.type === 'seek' ? styles.quickReplySeek :
                            reply.type === 'expert' ? styles.quickReplyExpert :
                            reply.type === 'search' ? styles.quickReplySearch :
                            reply.type === 'search-audio' ? styles.quickReplySearchAudio :
                            reply.type === 'bpm' ? styles.quickReplyBpm :
                            reply.type === 'loop' ? styles.quickReplyLoop :
                            reply.type === 'volume' ? styles.quickReplyVolume :
                            reply.type === 'mode' ? styles.quickReplyMode :
                            reply.type === 'vocalmix' ? styles.quickReplyVocalmix :
                            reply.type === 'scenario' ? styles.quickReplyScenario :
                            styles.quickReplyQuery
                          }`}
                          onClick={() => handleQuickReply(reply)}
                          disabled={isAiStreaming}
                          data-action-type={reply.type}
                          data-action-value={reply.action}
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
            {/* Practice Session Card — live state, NOT in aiMessages */}
            <PracticeSessionCard />
            <div ref={chatEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      {activeExpert && (
        <div className={styles.chatInputArea}>
          <textarea
            ref={textareaRef}
            className={styles.chatInput}
            data-billy-input={compact ? 'true' : undefined}
            rows={1}
            value={inputValue}
            onChange={e => {
              setInputValue(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
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