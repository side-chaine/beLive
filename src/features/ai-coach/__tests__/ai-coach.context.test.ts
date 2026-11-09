import { describe, expect, it } from 'vitest';
import { buildCoachMessages, buildTrackContext } from '../ai-coach.context';
import type { AiCoachMessage } from '../ai-coach.store';
import { AI_COACH_HISTORY_LIMIT } from '../ai-coach.prompt';

const msg = (id: number, role: AiCoachMessage['role'], content: string): AiCoachMessage => ({
  id: `m${id}`,
  role,
  content,
  createdAt: id,
});

describe('buildCoachMessages', () => {
  it('ставит системный промпт первым, вопрос — последним', () => {
    const messages = buildCoachMessages([], 'Как войти в припев?');

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1]).toEqual({ role: 'user', content: 'Как войти в припев?' });
  });

  it('режет историю до лимита', () => {
    const history = Array.from({ length: 20 }, (_, i) =>
      msg(i, i % 2 === 0 ? 'user' : 'assistant', `реплика ${i}`),
    );

    const messages = buildCoachMessages(history, 'новый вопрос');
    const dialogue = messages.slice(1);

    expect(dialogue).toHaveLength(AI_COACH_HISTORY_LIMIT + 1);
    expect(dialogue[0].content).toBe(`реплика ${20 - AI_COACH_HISTORY_LIMIT}`);
    expect(dialogue[dialogue.length - 1].content).toBe('новый вопрос');
  });

  it('выбрасывает системные сообщения из истории', () => {
    const history = [msg(1, 'system', 'служебное'), msg(2, 'user', 'привет')];
    const messages = buildCoachMessages(history, 'ещё');

    expect(messages.filter((m) => m.role === 'system')).toHaveLength(1);
    expect(messages.some((m) => m.content === 'служебное')).toBe(false);
  });
});

describe('buildTrackContext', () => {
  it('без трека честно сообщает, что питч не измеряется', () => {
    expect(buildTrackContext()).toContain('Питч: не измеряется');
  });
});
