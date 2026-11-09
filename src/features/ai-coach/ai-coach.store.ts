import { create } from 'zustand';

export type AiCoachRole = 'user' | 'assistant' | 'system';

export interface AiCoachMessage {
  id: string;
  role: AiCoachRole;
  content: string;
  createdAt: number;
}

interface AiCoachState {
  /** Панель открыта (точка входа — кнопка в Header). */
  open: boolean;
  /** Панель свёрнута в узкий рейл. */
  collapsed: boolean;

  messages: AiCoachMessage[];
  isStreaming: boolean;
  /** Слово в лирике, к которому относится совет (для подсветки). */
  focusWord: string | null;

  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setCollapsed: (v: boolean) => void;
  toggleCollapsed: () => void;

  addMessage: (msg: Pick<AiCoachMessage, 'role' | 'content'>) => string;
  appendToken: (id: string, token: string) => void;
  setMessageContent: (id: string, content: string) => void;
  setStreaming: (v: boolean) => void;
  setFocusWord: (word: string | null) => void;
  reset: () => void;
}

let seq = 0;
const nextId = (): string => `ac-${Date.now().toString(36)}-${++seq}`;

export const useAiCoachStore = create<AiCoachState>((set) => ({
  open: false,
  collapsed: false,
  messages: [],
  isStreaming: false,
  focusWord: null,

  openPanel: () => set({ open: true, collapsed: false }),
  closePanel: () => set({ open: false }),
  togglePanel: () => set((s) => (s.open ? { open: false } : { open: true, collapsed: false })),
  setCollapsed: (v) => set({ collapsed: v }),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),

  addMessage: (msg) => {
    const id = nextId();
    set((s) => ({
      messages: [...s.messages, { id, createdAt: Date.now(), ...msg }],
    }));
    return id;
  },

  appendToken: (id, token) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === id);
      if (idx === -1) {return s;}
      const messages = [...s.messages];
      messages[idx] = { ...messages[idx], content: messages[idx].content + token };
      return { messages };
    }),

  setMessageContent: (id, content) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === id);
      if (idx === -1) {return s;}
      const messages = [...s.messages];
      messages[idx] = { ...messages[idx], content };
      return { messages };
    }),

  setStreaming: (v) => set({ isStreaming: v }),
  setFocusWord: (word) => set({ focusWord: word }),
  reset: () => set({ messages: [], isStreaming: false, focusWord: null }),
}));
