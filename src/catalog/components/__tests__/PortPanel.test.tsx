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

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PortPanel } from '../PortPanel';
import { useMvsepStore } from '../../../stores/mvsep.store';
import { startFirstPath } from '../../../services/first-path.service';
import { MvsepError } from '../../../services/mvsep.service';

// Отправку не трогаем по-настоящему: тест про то, что видит человек при отказе.
vi.mock('../../../services/first-path.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/first-path.service')>();
  return { ...actual, startFirstPath: vi.fn(), checkFirstPathFile: vi.fn(() => null) };
});

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
    expect(screen.getByText('кинь трек — разделю его на 7 дорожек')).toBeTruthy();
    expect(screen.queryByText('разделение не удалось')).toBeNull();
  });
});

describe('PortPanel · отказ отправки виден и не гаснет', () => {
  beforeEach(() => {
    useMvsepStore.setState({ activeJobs: new Map() });
    vi.mocked(startFirstPath).mockReset();
  });

  const dropFile = async (container: HTMLElement) => {
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    const file = new File(['x'], 'track.mp3', { type: 'audio/mpeg' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
  };

  it('истёкшая сессия: пишет, что делать, а не «связь или сессия»', async () => {
    vi.mocked(startFirstPath).mockRejectedValue(new MvsepError('AUTH_REQUIRED'));
    const { container } = render(<PortPanel onZip={noop} />);
    await dropFile(container);
    expect(screen.getByText(/сессия истекла — войди заново/)).toBeTruthy();
  });

  it('сообщение не исчезает через 4 секунды — раньше человек видел пустой Пульт', async () => {
    vi.useFakeTimers();
    vi.mocked(startFirstPath).mockRejectedValue(new MvsepError('AUTH_REQUIRED'));
    const { container } = render(<PortPanel onZip={noop} />);
    await dropFile(container);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText(/сессия истекла — войди заново/)).toBeTruthy();
    vi.useRealTimers();
  });

  it('401 от MVSEP не выдаёт себя за проблему пользователя', async () => {
    vi.mocked(startFirstPath).mockRejectedValue(new MvsepError('MVSEP_SUBMIT_ERROR_401'));
    const { container } = render(<PortPanel onZip={noop} />);
    await dropFile(container);
    expect(screen.getByText(/это на стороне сервиса/)).toBeTruthy();
  });
});
