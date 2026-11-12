/**
 * N6 — ожидание в очереди не пустое.
 *
 * Карточка показывает только то, что действительно пришло: обложка, темп,
 * год, текст. Ни одного придуманного значения — иначе человек поверит цифре,
 * которой нет.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortFacts } from '../PortFacts';

const FILE = 'Linkin Park - Runaway.mp3';

describe('PortFacts · что уже знаем о треке', () => {
  it('рисует обложку, имя, темп и метаданные', () => {
    const { container } = render(
      <PortFacts
        fileName={FILE}
        pending={false}
        facts={{
          coverUrl: 'https://example.test/cover.jpg',
          bpm: 120, key: 'A minor', camelot: '8A',
          year: '2000', genre: 'rock', lyricsLines: 42,
        }}
      />,
    );

    expect(screen.getByText('Linkin Park — Runaway')).toBeTruthy();
    expect(screen.getByText('≈120 BPM · A minor · 8A')).toBeTruthy();
    expect(screen.getByText('2000 · rock · текст: 42 строк')).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.test/cover.jpg');
  });

  it('без обложки держит рамку-заглушку, а не битую картинку', () => {
    const { container } = render(<PortFacts fileName={FILE} pending={false} facts={{ bpm: 100 }} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('≈100 BPM')).toBeTruthy();
  });

  it('проверенный текст, которого нет, называет прямо', () => {
    render(<PortFacts fileName={FILE} pending={false} facts={{ lyricsLines: null }} />);
    expect(screen.getByText('текста нет')).toBeTruthy();
  });

  it('пока источники молчат — говорит, что собирает, а не что не нашлось', () => {
    render(<PortFacts fileName={FILE} pending facts={null} />);
    expect(screen.getByText('собираю обложку, темп и текст…')).toBeTruthy();
    expect(screen.queryByText('данных о треке не нашлось')).toBeNull();
  });

  it('пустой ответ всех источников — честная строка, а не пустая карточка', () => {
    render(<PortFacts fileName={FILE} pending={false} facts={{ bpm: null, lyricsLines: null }} />);
    expect(screen.getByText('текста нет')).toBeTruthy();
  });

  it('расширение файла не попадает в имя трека', () => {
    render(<PortFacts fileName="track.mp3" pending={false} facts={null} />);
    expect(screen.getByText('track')).toBeTruthy();
  });
});
