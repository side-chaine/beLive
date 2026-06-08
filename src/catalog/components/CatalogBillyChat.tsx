import { useState, useRef, useEffect } from 'react';
import { aiHub } from '../../js/ai/registry';
import type { Message } from '../../js/ai/types';

const SCOUT_SYSTEM_PROMPT = `Ты — Билли, ИИ-помощник вокальной студии beLive. Сейчас пользователь находится в каталоге и ещё не загрузил трек. Твоя задача — помочь ему загрузить первый трек. Отвечай только на вопросы про: как загрузить ZIP-архив, как разделить трек на вокал и минус через mvsep.com, как подготовить текст, и что такое beLive. На вопросы не связанные с загрузкой треков и beLive, вежливо отказывай и возвращай к теме загрузки. Отвечай коротко и по делу.`;

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

    const assistantMessage: ChatMessage = { role: 'assistant', text: '' };
    setMessages([...newMessages, assistantMessage]);

    const aiMessages: Message[] = [
      { role: 'system', content: SCOUT_SYSTEM_PROMPT },
      ...newMessages.map(m => ({ role: m.role, content: m.text })),
    ];

    const model = aiHub.getActiveModel()?.id || 'openrouter/free';
    let fullText = '';
    await aiHub.sendMessage(
      { model, messages: aiMessages, stream: true },
      {
        onToken: (token) => {
          fullText += token;
          assistantMessage.text = fullText;
          setMessages([...newMessages, { ...assistantMessage }]);
        },
        onDone: () => {
          setIsStreaming(false);
        },
        onError: (err) => {
          assistantMessage.text = `Ошибка: ${err.message}`;
          setMessages([...newMessages, { ...assistantMessage }]);
          setIsStreaming(false);
        }
      }
    );
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
            {msg.text}
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
