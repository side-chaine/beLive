import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showTrackNotice } from '../notification';

/**
 * Уведомление о результате разделения.
 * Держим только два факта — готово и не получилось: очередь сюда не попадает.
 */
describe('showTrackNotice', () => {
  beforeEach(() => {
    document.querySelectorAll('.bl-ntc').forEach((n) => n.remove());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('показывает заголовок и текст', () => {
    const el = showTrackNotice({
      kind: 'ready',
      title: 'in-the-end.mp3 — готово',
      text: '7 стемов · заняло 08:40',
    });

    expect(el).not.toBeNull();
    expect(el!.querySelector('.bl-ntc__title')?.textContent).toBe('in-the-end.mp3 — готово');
    expect(el!.querySelector('.bl-ntc__text')?.textContent).toBe('7 стемов · заняло 08:40');
    expect(el!.className).toContain('bl-ntc');
    expect(el!.className).not.toContain('bl-ntc--err');
  });

  it('провал помечен красным и получает предупреждение', () => {
    const el = showTrackNotice({
      kind: 'failed',
      title: 'a.mp3 — не получилось',
      text: 'MVSEP не смог обработать файл.',
    });

    expect(el!.className).toContain('bl-ntc--err');
    expect(el!.querySelector('.bl-ntc__glyph')?.textContent).toBe('⚠');
  });

  it('исчезает сам через 6 секунд', () => {
    showTrackNotice({ kind: 'ready', title: 'a', text: 'b' });
    expect(document.querySelector('.bl-ntc')).not.toBeNull();

    vi.advanceTimersByTime(6000);
    vi.advanceTimersByTime(200);

    expect(document.querySelector('.bl-ntc')).toBeNull();
  });

  it('наведение мышью останавливает таймер', () => {
    const el = showTrackNotice({ kind: 'ready', title: 'a', text: 'b' })!;
    el.dispatchEvent(new MouseEvent('mouseenter'));

    vi.advanceTimersByTime(9000);

    expect(document.querySelector('.bl-ntc')).not.toBeNull();
  });

  it('после ухода мыши даёт 2.4 с и убирает', () => {
    const el = showTrackNotice({ kind: 'ready', title: 'a', text: 'b' })!;
    el.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(9000);
    el.dispatchEvent(new MouseEvent('mouseleave'));

    vi.advanceTimersByTime(2400);
    vi.advanceTimersByTime(200);

    expect(document.querySelector('.bl-ntc')).toBeNull();
  });

  it('клик убирает сразу', () => {
    const el = showTrackNotice({ kind: 'ready', title: 'a', text: 'b' })!;
    el.dispatchEvent(new MouseEvent('click'));
    vi.advanceTimersByTime(200);

    expect(document.querySelector('.bl-ntc')).toBeNull();
  });

  it('стили вставляются один раз на все уведомления', () => {
    showTrackNotice({ kind: 'ready', title: 'a', text: 'b' });
    showTrackNotice({ kind: 'failed', title: 'c', text: 'd' });

    expect(document.querySelectorAll('#bl-ntc-style').length).toBe(1);
  });
});
