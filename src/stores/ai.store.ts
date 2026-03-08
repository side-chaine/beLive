import { create } from 'zustand';

export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AiState {
  messages: AiMessage[];
  isStreaming: boolean;
  displayTarget: 'chat' | 'stage' | 'both';

  addUserMessage: (content: string) => void;
  startAssistantMessage: () => void;
  appendToken: (token: string) => void;
  setAssistantError: (error: string) => void;
  setStreaming: (v: boolean) => void;
  setDisplayTarget: (t: 'chat' | 'stage' | 'both') => void;
  clearMessages: () => void;
}

export const useAiStore = create<AiState>((set) => ({
  messages: [],
  isStreaming: false,
  displayTarget: 'both',

  addUserMessage: (content) =>
    set((s) => ({
      messages: [...s.messages, { role: 'user', content }],
    })),

  startAssistantMessage: () =>
    set((s) => ({
      messages: [...s.messages, { role: 'assistant', content: '' }],
      isStreaming: true,
    })),

  appendToken: (token) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + token };
      }
      return { messages: msgs };
    }),

  setAssistantError: (error) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: '⚠️ ' + error };
      }
      return { messages: msgs, isStreaming: false };
    }),

  setStreaming: (v) => set({ isStreaming: v }),

  setDisplayTarget: (t) => set({ displayTarget: t }),

  clearMessages: () => set({ messages: [], isStreaming: false }),
}));
