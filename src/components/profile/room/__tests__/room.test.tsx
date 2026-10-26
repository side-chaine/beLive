/**
 * MR-3 §6 — презентационные компоненты комнаты (без IDB и без сторов).
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeekStrip } from '../WeekStrip';
import { ContinueCard } from '../ContinueCard';
import type { ContinueTarget, WeekStats } from '../../../../services/practice-journal/aggregate';

const EMPTY: WeekStats = { minutes: 0, runs: 0, streak: 0, spark: [0, 0, 0, 0, 0, 0, 0] };

const TARGET: ContinueTarget = {
  trackId: 'track-1',
  trackTitle: 'Song',
  scenarioId: 'bpm-ramp',
  blockId: 'block-1',
  blockType: 'chorus',
  rate: 0.9,
  at: 1_700_000_000_000,
};

describe('room', () => {
  it('1. WeekStrip: пустая неделя → «—» и «Проведи первую репетицию»', () => {
    render(<WeekStrip stats={EMPTY} />);
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.getByText(/Проведи первую репетицию/)).toBeTruthy();
  });

  it('2. ContinueCard: совпадающий трек → кнопка активна, чужой → disabled', () => {
    const onContinue = () => {};

    const { unmount } = render(
      <ContinueCard target={TARGET} currentTrackId="track-1" onContinue={onContinue} />,
    );
    const active = screen.getByRole('button', { name: '▶ ВЕРНУТЬСЯ' }) as HTMLButtonElement;
    expect(active.disabled).toBe(false);
    unmount();

    render(<ContinueCard target={TARGET} currentTrackId="track-2" onContinue={onContinue} />);
    const blocked = screen.getByRole('button', { name: '▶ ВЕРНУТЬСЯ' }) as HTMLButtonElement;
    expect(blocked.disabled).toBe(true);
    expect(screen.getByText('Открой этот трек, чтобы продолжить')).toBeTruthy();
  });
});
