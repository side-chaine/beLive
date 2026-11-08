import { useEffect, useState, type CSSProperties } from 'react'
import { useStemDegradation, type DegradedStem } from './useStemDegradation'

/** Адаптивная тема (prefers-color-scheme) — читается и днём, и ночью. */
function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  )
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return dark
}

const wrapStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 8000,
  display: 'flex',
  justifyContent: 'center',
  // C3: безопасная зона — не перекрываем «чёлку»/ноутч.
  paddingTop: 'max(10px, env(safe-area-inset-top))',
  paddingBottom: 10,
  paddingLeft: 'max(12px, env(safe-area-inset-left))',
  paddingRight: 'max(12px, env(safe-area-inset-right))',
  pointerEvents: 'none', // C2: баннер не перехватывает клики по UI под ним
}

function cardStyle(dark: boolean): CSSProperties {
  return {
    pointerEvents: 'auto',
    width: '100%',
    maxWidth: 540,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 12,
    border: `1px solid ${dark ? 'rgba(255,170,80,0.40)' : 'rgba(200,130,50,0.55)'}`,
    borderLeft: `4px solid ${dark ? '#ff9d3c' : '#e8821e'}`,
    background: dark ? 'rgba(28,24,20,0.94)' : 'rgba(255,248,240,0.96)',
    color: dark ? '#ffd9a8' : '#5a3d1a',
    boxShadow: '0 4px 18px rgba(0,0,0,0.25)',
    fontSize: 14,
    lineHeight: 1.4,
  }
}

function closeBtnStyle(dark: boolean): CSSProperties {
  return {
    marginLeft: 'auto',
    flexShrink: 0,
    width: 26,
    height: 26,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    background: dark ? 'rgba(255,170,80,0.18)' : 'rgba(200,130,50,0.18)',
    color: dark ? '#ffd9a8' : '#5a3d1a',
    fontSize: 16,
    lineHeight: 1,
  }
}

/**
 * C1–C3 (PR-2): НЕМОДАЛЬНЫЙ баннер видимой деградации.
 * Заменяет «STEM SILENT»/AudioCrashModal на «вокал недоступен — играет инструментал».
 * Сбрасывается на before-track-change (через useStemDegradation).
 */

/** Презентационная часть — тестируется напрямую через пропсы (без window-событий). */
export interface StemDegradedBannerViewProps {
  degradedStems: DegradedStem[]
  trackLoadFailed: boolean
  onClear: () => void
}

export function StemDegradedBannerView({
  degradedStems,
  trackLoadFailed,
  onClear,
}: StemDegradedBannerViewProps) {
  const dark = usePrefersDark()

  const visible = degradedStems.length > 0 || trackLoadFailed
  if (!visible) return null

  const vocalsDown = degradedStems.some((s) => s.stemId === 'vocals')
  // eslint-disable-next-line no-useless-assignment -- [FROZEN-REQUEST N1b | Центр_5 2026-11-08 | ok: 707 (и.о. Gate R) | ревью: Соннет постфактум]
  let icon = '⚠️'
  let text: string
  if (vocalsDown) {
    icon = '🎤'
    text = 'Вокал недоступен — играет инструментал'
  } else if (degradedStems.length > 0) {
    icon = '🎚️'
    text = `Часть дорожек недоступна (${degradedStems.map((s) => s.stemId).join(', ')})`
  } else {
    icon = '⚠️'
    text = 'Трек загрузился не полностью'
  }

  return (
    <div style={wrapStyle} role="status" aria-live="polite">
      <div style={cardStyle(dark)}>
        <span aria-hidden style={{ fontSize: 18 }}>{icon}</span>
        <span>{text}</span>
        <button
          type="button"
          aria-label="Скрыть уведомление"
          style={closeBtnStyle(dark)}
          onClick={onClear}
        >
          ×
        </button>
      </div>
    </div>
  )
}

/** Контейнер: берёт состояние из хука и делегирует презентационной части. */
export function StemDegradedBanner() {
  const { degradedStems, trackLoadFailed, clear } = useStemDegradation()
  return (
    <StemDegradedBannerView
      degradedStems={degradedStems}
      trackLoadFailed={trackLoadFailed}
      onClear={clear}
    />
  )
}
