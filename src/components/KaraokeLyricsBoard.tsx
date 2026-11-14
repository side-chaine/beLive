// beLive — KaraokeLyricsBoard (Sprint 11)
// Displays active + next lyric lines in Karaoke mode
// First component using CSS Module + Theme CSS vars (INV-2.1-THEME)

import { useEffect, useRef } from 'react'
import { useLyricsStore } from '../stores/lyrics.store'
import { useBlocksStore } from '../stores/blocks.store'
import { useUIStore } from '../stores/ui.store'
import { useModeStore } from '../stores/mode.store'
import { useTextStyleStore } from '../stores/textStyle.store'
import { subBlocksOf } from '../utils/subblocks'
import { MAX_SUB_BLOCK_LINES } from '../slot-matrix/slot-matrix.utils'
import styles from './KaraokeLyricsBoard.module.css'
import { runConcertTransition } from '../transitions/concertTransitions'
import { WordHighlightLine } from '../triggers/WordHighlightLine'

export function KaraokeLyricsBoard() {
  const lines = useLyricsStore((s) => s.lines)
  const activeLineIndex = useLyricsStore((s) => s.activeLineIndex)
  const blocks = useBlocksStore((s) => s.blocks)
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
    if (!isConcert) {return}
    const el = activeRef.current
    if (!el) {return}

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
  // BL-050-ui (§12.8): караоке-окно НЕ пересекает границу подблока — последняя
  // видимая строка обрезается концом активного подблока. На границе окно
  // короче, зато строка из следующего юнита не «подмешивается» в текущий.
  const visibleLines: string[] = []
  if (activeLineIndex >= 0) {
    let limit = lines.length - 1
    const block = blocks.find((b) => b.lineIndices.includes(activeLineIndex))
    if (block) {
      const subs = subBlocksOf(block, lines, MAX_SUB_BLOCK_LINES)
      const sub = subs.find((s) => s.lineIndices.includes(activeLineIndex))
      if (sub && sub.lineIndices.length > 0) {
        limit = Math.min(limit, sub.lineIndices[sub.lineIndices.length - 1])
      }
    }
    for (let i = 0; i < linesCount; i++) {
      const idx = activeLineIndex + i
      if (idx <= limit && idx < lines.length) {
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

