import { useState, useRef, useEffect } from 'react';
import { aiHub } from '../../js/ai/registry';
import type { Message } from '../../js/ai/types';
import { getActiveSkill, buildSystemPrompt } from '../../billy/skill-registry';
import { BillyMessageRenderer } from '../../billy/BillyMessageRenderer';
import { useAiStore } from '../../stores/ai.store';

const QUICK_QUESTIONS = [
  "Как загрузить трек?",
  "Что такое ZIP?",
  "С чего начать?",
];

interface ChatMessage { role: 'user' | 'assistant'; text: string; }

export function CatalogBillyChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showQuickQ, setShowQuickQ] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async (text?: string) => {
    const userMessage = text || input;
    if (!userMessage.trim() || isStreaming) return;

    setShowQuickQ(false);
    const newMessages = [...messages, { role: 'user' as const, text: userMessage }];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);
    useAiStore.getState().setStreaming(true);

    const assistantMessage: ChatMessage = { role: 'assistant', text: '' };
    setMessages([...newMessages, assistantMessage]);

    const skill = getActiveSkill();
    const systemPrompt = buildSystemPrompt(skill);

    const aiMessages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...newMessages.map(m => ({ role: m.role, content: m.text })),
    ];

    const model = aiHub.getActiveModel()?.id || 'openrouter/free';
    let fullText = '';
    await aiHub.sendMessage(
      { model, messages: aiMessages, stream: true, temperature: skill.temperature, maxTokens: skill.maxTokens },
      {
        onToken: (token) => {
          fullText += token;
          assistantMessage.text = fullText;
          setMessages([...newMessages, { ...assistantMessage }]);
        },
        onDone: () => {
          setIsStreaming(false);
          useAiStore.getState().setStreaming(false);
        },
        onError: (err) => {
          assistantMessage.text = `Ошибка: ${err.message}`;
          setMessages([...newMessages, { ...assistantMessage }]);
          setIsStreaming(false);
          useAiStore.getState().setStreaming(false);
        }
      }
    );
  };

  const handleBillyAction = (action: string) => {
    switch (action) {
      case 'highlight-zip': {
        const dropzone = document.querySelector('.bl-catalog-dropzone');
        if (dropzone) {
          dropzone.classList.add('bl-catalog-dropzone--highlight');
          setTimeout(() => dropzone.classList.remove('bl-catalog-dropzone--highlight'), 3000);
        }
        break;
      }
      case 'zip-upload':
        {
          const input = document.getElementById('bl-smart-file-input') as HTMLInputElement;
          if (input) {
            input.accept = '.zip';
            input.click();
          }
        }
        return;

      default:
        console.warn('[billy] Unknown action:', action);
    }
  };

  const msgClass = (role: string) =>
    role === 'user'
      ? 'bl-chat__msg bl-chat__msg--user'
      : 'bl-chat__msg bl-chat__msg--assistant';

  return (
    <div className="bl-chat">
      <div className="bl-chat__messages">
        {messages.length === 0 && showQuickQ && (
          <div className="bl-chat__quick-qs">
            <div className="bl-chat__empty">
              Привет! Я Билли. Спроси меня, как загрузить трек!
            </div>
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                className="bl-chat__quick-btn"
                onClick={() => handleSend(q)}
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={msgClass(msg.role)}>
            {isStreaming && i === messages.length - 1 && msg.role === 'assistant' && !msg.text ? (
              <div className="bl-chat__skeleton">
                <div className="bl-skeleton-line" style={{ width: '85%' }} />
                <div className="bl-skeleton-line" style={{ width: '70%' }} />
                <div className="bl-skeleton-line" style={{ width: '45%' }} />
              </div>
            ) : (
              msg.role === 'assistant'
                ? <BillyMessageRenderer content={msg.text} onAction={handleBillyAction} />
                : msg.text
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="bl-chat__input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Как загрузить трек?"
          disabled={isStreaming}
        />
        <button onClick={() => handleSend()} disabled={isStreaming || !input.trim()}>
          ➤
        </button>
      </div>
    </div>
  );
}
