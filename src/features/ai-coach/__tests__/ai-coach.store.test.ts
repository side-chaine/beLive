import { describe, it, expect, beforeEach } from 'vitest';
import { useAiCoachStore } from '../ai-coach.store';

describe('ai-coach.store', () => {
  beforeEach(() => {
    useAiCoachStore.setState({
      open: false,
      collapsed: false,
      messages: [],
      isStreaming: false,
      focusWord: null,
    });
  });

  it('открытие разворачивает свёрнутую панель', () => {
    useAiCoachStore.getState().setCollapsed(true);
    useAiCoachStore.getState().openPanel();

    expect(useAiCoachStore.getState().open).toBe(true);
    expect(useAiCoachStore.getState().collapsed).toBe(false);
  });

  it('togglePanel закрывает открытую панель', () => {
    useAiCoachStore.getState().openPanel();
    useAiCoachStore.getState().togglePanel();

    expect(useAiCoachStore.getState().open).toBe(false);
  });

  it('addMessage возвращает id и добавляет сообщение', () => {
    const id = useAiCoachStore.getState().addMessage({ role: 'user', content: 'привет' });
    const { messages } = useAiCoachStore.getState();

    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(id);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('привет');
  });

  it('appendToken дописывает только в своё сообщение', () => {
    const first = useAiCoachStore.getState().addMessage({ role: 'assistant', content: 'Ты ' });
    const second = useAiCoachStore.getState().addMessage({ role: 'assistant', content: 'другое' });

    useAiCoachStore.getState().appendToken(first, 'молодец');
    useAiCoachStore.getState().appendToken('missing-id', 'игнор');

    const { messages } = useAiCoachStore.getState();
    expect(messages[0].content).toBe('Ты молодец');
    expect(messages[1].content).toBe('другое');
    expect(messages[1].id).toBe(second);
  });

  it('focusWord ставится и сбрасывается', () => {
    useAiCoachStore.getState().setFocusWord('think');
    expect(useAiCoachStore.getState().focusWord).toBe('think');

    useAiCoachStore.getState().setFocusWord(null);
    expect(useAiCoachStore.getState().focusWord).toBeNull();
  });

  it('reset очищает переписку, стрим и слово', () => {
    useAiCoachStore.getState().addMessage({ role: 'user', content: 'x' });
    useAiCoachStore.getState().setStreaming(true);
    useAiCoachStore.getState().setFocusWord('think');

    useAiCoachStore.getState().reset();

    const state = useAiCoachStore.getState();
    expect(state.messages).toHaveLength(0);
    expect(state.isStreaming).toBe(false);
    expect(state.focusWord).toBeNull();
  });
});
