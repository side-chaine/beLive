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
import { loadTrackFacts } from '../../../services/track-facts.service';

// Отправку не трогаем по-настоящему: тест про то, что видит человек при отказе.
vi.mock('../../../services/first-path.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/first-path.service')>();
  return { ...actual, startFirstPath: vi.fn(), checkFirstPathFile: vi.fn(() => null) };
});

// Сеть за фактами не нужна: проверяем, что панель их показывает, когда они пришли.
vi.mock('../../../services/track-facts.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/track-facts.service')>();
  return { ...actual, loadTrackFacts: vi.fn(() => Promise.resolve()) };
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

// «Проверить сейчас» — только факт вызова: сам поллер тестируется отдельно.
const pollNow = vi.fn((_hash: string) => true);
vi.mock('../../../services/mvsep-polling.service', () => ({
  mvsepPollingService: { pollNow: (hash: string) => pollNow(hash) },
}));

describe('PortPanel · «проверить сейчас» (FP-N7)', () => {
  beforeEach(() => {
    useMvsepStore.setState({ activeJobs: new Map() });
    pollNow.mockClear();
  });

  it('в очереди есть кнопка, она опрашивает именно эту джобу', () => {
    act(() => {
      useMvsepStore.getState().addJob('h-q', 7, 'track.wav', 'beLive');
      useMvsepStore.getState().updateJobStatus('h-q', 'queued');
    });
    render(<PortPanel onZip={noop} />);

    fireEvent.click(screen.getByText('↻ проверить'));
    expect(pollNow).toHaveBeenCalledWith('h-q');
  });

  it('в пустом Порте кнопки нет', () => {
    render(<PortPanel onZip={noop} />);
    expect(screen.queryByText('↻ проверить')).toBeNull();
  });

  it('предохранитель сработал (timeout) — панель объясняет, а не пустеет', () => {
    render(<PortPanel onZip={noop} />);
    act(() => {
      const s = useMvsepStore.getState();
      s.addJob('h-to', 7, 'track.wav', 'beLive');
      s.updateJobStatus('h-to', 'timeout');
      s.removeJob('h-to'); // так делает handleTimeout → stopPolling
    });

    expect(screen.getByText(/перестали ждать MVSEP/)).toBeTruthy();
  });
});

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

/**
 * N4 — «ничего не происходит» на проде.
 *
 * Целью клика и drop была только пунктирная рамка 96 px. Подсказка
 * «кинь трек — разделю его на 7 дорожек» живёт ниже, в Пульте (281 px), и
 * человек целился именно в неё: панель выглядит одним блоком, а 3/4 её площади
 * молчали. Тесты держат цель на всей панели, а не на рамке.
 */
describe('PortPanel · файл принимает вся панель, а не только рамка', () => {
  beforeEach(() => {
    useMvsepStore.setState({ activeJobs: new Map() });
    vi.mocked(startFirstPath).mockReset();
    vi.mocked(startFirstPath).mockResolvedValue({ ok: true, hash: 'h-drop', trackId: 1 });
  });

  const mp3 = () => new File(['x'], 'track.mp3', { type: 'audio/mpeg' });

  it('drop по плиткам стемов принимает файл — раньше эта зона была мёртвой', async () => {
    render(<PortPanel onZip={noop} />);
    await act(async () => {
      fireEvent.drop(screen.getByText('Вокал'), { dataTransfer: { files: [mp3()] } });
    });
    expect(startFirstPath).toHaveBeenCalledTimes(1);
  });

  it('drop по строке статуса принимает файл', async () => {
    render(<PortPanel onZip={noop} />);
    await act(async () => {
      fireEvent.drop(screen.getByText('кинь трек — разделю его на 7 дорожек'), {
        dataTransfer: { files: [mp3()] },
      });
    });
    expect(startFirstPath).toHaveBeenCalledTimes(1);
  });

  it('клик по подсказке «кинь трек…» открывает выбор файла', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    try {
      render(<PortPanel onZip={noop} />);
      fireEvent.click(screen.getByText('кинь трек — разделю его на 7 дорожек'));
      expect(click).toHaveBeenCalledTimes(1);
    } finally {
      click.mockRestore();
    }
  });

  it('клик по «? что будет» не открывает выбор файла — кнопка остаётся кнопкой', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    try {
      render(<PortPanel onZip={noop} />);
      fireEvent.click(screen.getByText('? что будет'));
      expect(click).not.toHaveBeenCalled();
      expect(screen.getByText(/Стемы — это дорожки одного трека/)).toBeTruthy();
    } finally {
      click.mockRestore();
    }
  });
});

/**
 * N5 — «есть вывод, но не видно, что трек приняли».
 *
 * Джоба появляется только после ответа воркера. Между броском и ответом панель
 * выглядела ровно как до броска: ни имени файла, ни живой ступени. Теперь файл
 * показывается сразу и остаётся рядом с причиной отказа.
 */
describe('PortPanel · видно, что файл принят', () => {
  beforeEach(() => {
    useMvsepStore.setState({ activeJobs: new Map() });
    vi.mocked(startFirstPath).mockReset();
  });

  const dropNamed = async (name: string) => {
    await act(async () => {
      fireEvent.drop(screen.getByText('Вокал'), {
        dataTransfer: { files: [new File(['x'], name, { type: 'audio/mpeg' })] },
      });
    });
  };

  it('имя и размер видны сразу — до ответа воркера', async () => {
    vi.mocked(startFirstPath).mockReturnValue(new Promise(() => {}));
    render(<PortPanel onZip={noop} />);
    await dropNamed('my-song.mp3');
    expect(screen.getByText('my-song.mp3')).toBeTruthy();
    expect(screen.getByText(/ПОРТ · принял/)).toBeTruthy();
  });

  it('после отказа имя файла остаётся рядом с причиной', async () => {
    vi.mocked(startFirstPath).mockRejectedValue(new MvsepError('MVSEP_KEY_INVALID'));
    render(<PortPanel onZip={noop} />);
    await dropNamed('lost.mp3');
    expect(screen.getByText('lost.mp3')).toBeTruthy();
    expect(screen.getByText(/MVSEP не принял ключ/)).toBeTruthy();
  });

  it('имя не переживает следующую попытку — показываем текущий файл', async () => {
    vi.mocked(startFirstPath).mockResolvedValue({ ok: true, hash: 'h-x', trackId: 1 });
    render(<PortPanel onZip={noop} />);
    await dropNamed('first.mp3');
    await dropNamed('second.mp3');
    expect(screen.queryByText('first.mp3')).toBeNull();
    expect(screen.getByText('second.mp3')).toBeTruthy();
  });
});

/**
 * N6 — ожидание в очереди перестаёт быть пустым.
 *
 * Пока MVSEP держит трек в очереди, панель сама показывает обложку, темп,
 * год и наличие текста. Человек смотрит не на голую цифру, а на свой трек.
 */
describe('PortPanel · что уже знаем о треке, пока идёт очередь', () => {
  beforeEach(() => {
    useMvsepStore.setState({ activeJobs: new Map() });
    vi.mocked(loadTrackFacts).mockReset().mockResolvedValue(undefined);
  });

  it('факты появляются сами, без действий человека', async () => {
    vi.mocked(loadTrackFacts).mockImplementation(async (_name, _audio, onPatch) => {
      onPatch({ coverUrl: 'https://example.test/c.jpg', bpm: 120, key: 'A minor', camelot: '8A' });
      onPatch({ year: '2000', genre: 'rock', lyricsLines: 42 });
    });

    render(<PortPanel onZip={noop} />);
    await act(async () => {
      const s = useMvsepStore.getState();
      s.addJob('h-facts', 11, 'Linkin Park - Runaway.mp3', 'beLive');
      s.updateJobStatus('h-facts', 'queued');
    });

    expect(screen.getByText('≈120 BPM · A minor · 8A')).toBeTruthy();
    expect(screen.getByText('2000 · rock · текст: 42 строк')).toBeTruthy();
  });

  it('на одну джобу — одна загрузка фактов, даже когда очередь обновилась', async () => {
    render(<PortPanel onZip={noop} />);
    await act(async () => {
      const s = useMvsepStore.getState();
      s.addJob('h-once', 12, 'a.mp3', 'beLive');
      s.updateJobStatus('h-once', 'queued');
      s.updateJobQueue('h-once', { pos: 200, total: 270 });
    });

    expect(loadTrackFacts).toHaveBeenCalledTimes(1);
  });
});
