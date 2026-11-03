/**
 * C1–C3 (PR-2): тесты презентационной части баннера.
 * Рендерим StemDegradedBannerView напрямую с пропсами — без window-событий
 * (vitest/jsdom: window не является реальным EventTarget).
 */

import { describe, expect, it, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { StemDegradedBannerView } from '../StemDegradedBanner'
import type { DegradedStem } from '../useStemDegradation'

const VOCP: DegradedStem[] = [{ stemId: 'vocals', error: 'boom' }]
const BASS: DegradedStem[] = [{ stemId: 'bass', error: 'x' }]

describe('StemDegradedBannerView', () => {
  afterEach(() => cleanup())

  it('1. без стемов и без trackLoadFailed — ничего не рендерится', () => {
    const { container } = render(
      <StemDegradedBannerView degradedStems={[]} trackLoadFailed={false} onClear={() => {}} />,
    )
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('2. vocals degraded → «Вокал недоступен — играет инструментал»', () => {
    render(<StemDegradedBannerView degradedStems={VOCP} trackLoadFailed={false} onClear={() => {}} />)
    expect(screen.getByText('Вокал недоступен — играет инструментал')).toBeTruthy()
  })

  it('3. другой стем → «Часть дорожек недоступна (...)»', () => {
    render(<StemDegradedBannerView degradedStems={BASS} trackLoadFailed={false} onClear={() => {}} />)
    expect(screen.getByText(/Часть дорожек недоступна/)).toBeTruthy()
    expect(screen.getByText(/bass/)).toBeTruthy()
  })

  it('4. trackLoadFailed (без стемов) → «Трек загрузился не полностью»', () => {
    render(<StemDegradedBannerView degradedStems={[]} trackLoadFailed onClear={() => {}} />)
    expect(screen.getByText('Трек загрузился не полностью')).toBeTruthy()
  })

  it('5. C2: обёртка pointerEvents:none — не перехватывает клики по UI под ней', () => {
    render(<StemDegradedBannerView degradedStems={VOCP} trackLoadFailed={false} onClear={() => {}} />)
    const wrap = screen.getByRole('status') as HTMLElement
    expect(wrap.style.pointerEvents).toBe('none')
  })

  it('6. клик по крестику вызывает onClear', () => {
    const onClear = vi.fn()
    render(<StemDegradedBannerView degradedStems={VOCP} trackLoadFailed={false} onClear={onClear} />)
    screen.getByLabelText('Скрыть уведомление').click()
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
