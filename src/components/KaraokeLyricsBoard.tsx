// beLive — KaraokeLyricsBoard (Sprint 11)
// Displays active + next lyric lines in Karaoke mode
// First component using CSS Module + Theme CSS vars (INV-2.1-THEME)

import { useEffect, useRef } from 'react'
import { useLyricsStore } from '../stores/lyrics.store'
import { useUIStore } from '../stores/ui.store'
import { useModeStore } from '../stores/mode.store'
import { useTextStyleStore } from '../stores/textStyle.store'
import styles from './KaraokeLyricsBoard.module.css'
import { runConcertTransition } from '../transitions/concertTransitions'
import { WordHighlightLine } from '../triggers/WordHighlightLine'

export function KaraokeLyricsBoard() {
  const lines = useLyricsStore((s) => s.lines)
  const activeLineIndex = useLyricsStore((s) => s.activeLineIndex)
  const linesCount = useUIStore((s) => s.karaokeLinesCount)
  const lyricsScale = useUIStore((s) => s.karaokeLyricsScale)
  const setLinesCount = useUIStore((s) => s.setKaraokeLinesCount)

  const mode = useModeStore(s => s.mode)
  const isConcert = mode === 'concert'

  const fontFamily = useTextStyleStore(s => s.fontFamily)
  const fontScale = useTextStyleStore(s => s.fontScale)
  const transitionId = useTextStyleStore(s => s.transitionId)

  const activeRef = useRef<HTMLDivElement | null>(null)

  const safeFontScale = Math.max(0.6, Math.min(2.0, fontScale))
  const activeMidVw = (4 * safeFontScale).toFixed(2)
  const nextMidVw = (2.5 * safeFontScale).toFixed(2)

  const concertActiveFontSize =
    `clamp(${Math.round(28 * safeFontScale)}px, ${activeMidVw}vw, ${Math.round(48 * safeFontScale)}px)`
  const concertNextFontSize =
    `clamp(${Math.round(18 * safeFontScale)}px, ${nextMidVw}vw, ${Math.round(28 * safeFontScale)}px)`

  const concertActiveStyle = isConcert
    ? { fontFamily, fontSize: concertActiveFontSize }
    : undefined

  const concertNextStyle = isConcert
    ? { fontFamily, fontSize: concertNextFontSize }
    : undefined

  useEffect(() => {
    if (!isConcert) return
    const el = activeRef.current
    if (!el) return

    try {
      runConcertTransition(el, transitionId)
    } catch {}
  }, [isConcert, activeLineIndex, transitionId])

  // No lyrics loaded
  if (!lines || lines.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.noLyrics}>♪ Загрузите трек с текстом</div>
      </div>
    )
  }

  // Build visible lines array based on linesCount setting
  const visibleLines: string[] = []
  if (activeLineIndex >= 0) {
    for (let i = 0; i < linesCount; i++) {
      const idx = activeLineIndex + i
      if (idx < lines.length) {
        visibleLines.push(lines[idx])
      }
    }
  }

  return (
    <div className={styles.container}>
      <div
        className={styles.lyricsArea}
        style={
          isConcert
            ? { fontFamily, maxWidth: '90vw' }
            : { transform: `scale(${lyricsScale / 100})` }
        }
        data-mode={isConcert ? 'concert' : 'karaoke'}
        data-transition={isConcert ? transitionId : undefined}
      >
        {visibleLines.map((line, i) => (
          <div
            key={`${activeLineIndex}-${i}`}
            ref={i === 0 ? activeRef : undefined}
            className={i === 0 ? styles.activeLine : styles.nextLine}
            data-state={i === 0 ? 'active' : 'upcoming'}
            style={
              i === 0
                ? concertActiveStyle
                : {
                    opacity: 0.6 - (i - 1) * 0.15,
                    ...(concertNextStyle ?? {}),
                  }
            }
          >
            {i === 0
              ? <WordHighlightLine lineIndex={activeLineIndex} text={line || '♪ ♪ ♪'} />
              : (line || '')
            }
          </div>
        ))}
      </div>
      <button
        className={styles.linesToggle}
        onClick={() => setLinesCount(linesCount === 2 ? 4 : 2)}
        title={`Show ${linesCount === 2 ? 4 : 2} lines`}
      >
        {linesCount === 2 ? '2→4' : '4→2'}
      </button>
    </div>
  )
}

