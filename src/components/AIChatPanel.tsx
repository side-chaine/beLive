import React, { useState, useRef, useEffect } from 'react';
import { useModeStore } from '../stores/mode.store';
import { useAiStore } from '../stores/ai.store';

const MODE_COLORS: Record<string, string> = {
  concert: '#3498db',
  karaoke: '#9b59b6',
  rehearsal: '#FF8C00',
  live: '#e74c3c',
};

export function AIChatPanel() {
  const mode = useModeStore((s) => s.mode);
  const accent = MODE_COLORS[mode] || '#3498db';
  const { messages, isStreaming, addUserMessage, startAssistantMessage, appendToken, setStreaming } = useAiStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    addUserMessage(text);

    // Mock streaming — имитация AI ответа
    const mockResponses = [
      '🎵 Отличный вопрос! В режиме репетиции я помогу разобрать структуру трека по блокам.',
      '🎤 Попробуй включить loop на припеве — это поможет отработать сложные места.',
      '🎹 Темп этого трека отлично подходит для разогрева. Начни с медленного прохода.',
      '🎸 Совет: послушай инструментал отдельно, убрав вокал. Это откроет новые детали.',
      '🎶 Я готов помочь с анализом текста, структурой или техникой исполнения!',
    ];
    const response = mockResponses[Math.floor(Math.random() * mockResponses.length)];

    startAssistantMessage();
    for (let i = 0; i < response.length; i++) {
      await new Promise((r) => setTimeout(r, 25));
      appendToken(response[i]);
    }
    setStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '20px', fontSize: '12px' }}>
            🤖 AI Assistant ready
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            background: msg.role === 'user' ? accent : '#2a2a3a',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: '8px',
            maxWidth: '85%',
            fontSize: '12px',
            lineHeight: '1.4',
            whiteSpace: 'pre-wrap',
          }}>
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ display: 'flex', gap: '6px', paddingTop: '8px', borderTop: '1px solid #333' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI..."
          disabled={isStreaming}
          style={{
            flex: 1, background: '#1a1a2e', color: '#fff', border: '1px solid #444',
            borderRadius: '6px', padding: '6px 10px', fontSize: '12px', outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          style={{
            background: accent, color: '#fff', border: 'none', borderRadius: '6px',
            padding: '6px 12px', fontSize: '12px', cursor: 'pointer', opacity: input.trim() ? 1 : 0.5,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
