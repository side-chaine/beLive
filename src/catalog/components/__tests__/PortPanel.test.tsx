/**
 * A2.4 — финал джобы не исчезает молча.
 *
 * `stopPolling` удаляет джобу из стора сразу после `updateJobStatus('failed')`,
 * поэтому в разметке статус `failed` не появляется вообще: Пульт возвращался
 * в пустое состояние, и пользователь не узнавал, что разделение упало.
 *
 * Проверяем именно то, что легко сломать: снимок берётся подпиской на стор в
 * момент УДАЛЕНИЯ джобы, а не при рендере статуса.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { PortPanel } from '../PortPanel';
import { useMvsepStore } from '../../../stores/mvsep.store';

const noop = () => {};

/** Провал: поллер поставил failed и тут же удалил джобу. */
const failAndRemove = (hash: string, error?: string) => {
  act(() => {
    const s = useMvsepStore.getState();
    s.addJob(hash, 7, 'track.wav', 'beLive');
    s.updateJobStatus(hash, 'failed', error);
    s.removeJob(hash);
  });
};

describe('PortPanel · снимок финала', () => {
  beforeEach(() => {
    useMvsepStore.setState({ activeJobs: new Map() });
  });

  it('показывает причину провала после удаления джобы из стора', () => {
    render(<PortPanel onZip={noop} />);
    failAndRemove('h-fail', 'MVSEP ответил 500');
    expect(screen.getByText('MVSEP ответил 500')).toBeTruthy();
  });

  it('без текста ошибки показывает человеческий дефолт, а не пустоту', () => {
    render(<PortPanel onZip={noop} />);
    failAndRemove('h-fail-empty');
    expect(screen.getByText('разделение не удалось')).toBeTruthy();
  });

  it('успех тоже не исчезает: говорит, что трек уже в каталоге', () => {
    render(<PortPanel onZip={noop} />);
    act(() => {
      const s = useMvsepStore.getState();
      s.addJob('h-done', 8, 'track.wav', 'beLive');
      s.updateJobStatus('h-done', 'done');
      s.removeJob('h-done');
    });
    expect(screen.getByText('готово — трек в каталоге')).toBeTruthy();
  });

  it('обычное удаление в работе не выдумывает провал', () => {
    render(<PortPanel onZip={noop} />);
    act(() => {
      const s = useMvsepStore.getState();
      s.addJob('h-processing', 9, 'track.wav', 'beLive');
      s.updateJobStatus('h-processing', 'processing');
      s.removeJob('h-processing');
    });
    // Пульт вернулся в пустое состояние — и не соврал про ошибку.
    expect(screen.getByText('кинь трек — верну 7 стемов')).toBeTruthy();
    expect(screen.queryByText('разделение не удалось')).toBeNull();
  });
});
