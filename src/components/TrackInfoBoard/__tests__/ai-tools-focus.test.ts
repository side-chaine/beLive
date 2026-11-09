import { describe, expect, it } from 'vitest';
import { parseFocusWord, stripTextCommands } from '../ai-tools';

describe('parseFocusWord', () => {
  it('достаёт слово из метки', () => {
    expect(parseFocusWord('Держи выше на слове [FOCUS: think]')).toBe('think');
  });

  it('снимает кавычки по краям', () => {
    expect(parseFocusWord('[FOCUS: «think»]')).toBe('think');
    expect(parseFocusWord('[FOCUS: "think"]')).toBe('think');
  });

  it('не зависит от регистра метки', () => {
    expect(parseFocusWord('[focus: love]')).toBe('love');
  });

  it('возвращает null без метки', () => {
    expect(parseFocusWord('Просто совет без метки')).toBeNull();
  });

  it('возвращает null на пустой метке', () => {
    expect(parseFocusWord('[FOCUS:   ]')).toBeNull();
  });
});

describe('stripTextCommands', () => {
  it('убирает FOCUS из текста ответа', () => {
    expect(stripTextCommands('Выше на два цента. [FOCUS: think]')).toBe('Выше на два цента.');
  });

  it('по-прежнему убирает старые команды (регресс)', () => {
    expect(stripTextCommands('Перехожу в припев [SEEK: chorus]')).toBe('Перехожу в припев');
    expect(stripTextCommands('Смотрю структуру [STRUCTURE]')).toBe('Смотрю структуру');
    expect(stripTextCommands('Ищу трек [SEARCH_AUDIO: Queen - Bohemian Rhapsody]')).toBe('Ищу трек');
  });
});
