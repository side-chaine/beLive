/**
 * Concert Transition Engine — Web Animations API
 * All 29 transitions (19 Claude + 10 Gemini)
 * No CSS classes, no legacy code, pure React-compatible
 */

type TransitionId =
  | 'explosion' | 'burn' | 'matrix' | 'glitch' | 'typewriter'
  | 'neonPulse' | 'liquid' | 'vibration' | 'echo' | 'sparkle'
  | 'wave' | 'letterByLetter' | 'wordByWord' | 'smoke'
  | 'edgeGlow' | 'pulseRim' | 'fireEdge' | 'neonOutline' | 'starlight'
  | 'letterShine' | 'electricEdges' | 'cometTail' | 'ghostlyAppear'
  | 'laserScan' | 'pixelateIn' | 'cinemaLights' | 'windySmoke'
  | 'starDust' | 'inkBleed'

type Cleanup = () => void

const active = new WeakMap<HTMLElement, Cleanup>()

function stop(el: HTMLElement) {
  const prev = active.get(el)
  if (prev) prev()
  active.delete(el)
}

function animateEl(
  el: HTMLElement,
  kf: Keyframe[],
  opts: KeyframeAnimationOptions
): Cleanup {
  const anim = el.animate(kf, { fill: 'both', ...opts })
  const cleanup = () => {
    try {
      anim.cancel()
    } catch {}
  }
  active.set(el, cleanup)
  anim.finished.finally(() => {
    if (active.get(el) === cleanup) active.delete(el)
  })
  return cleanup
}

function withTempStyle(
  el: HTMLElement,
  patch: Partial<CSSStyleDeclaration>
): Cleanup {
  const prev: Partial<Record<keyof CSSStyleDeclaration, string>> = {}
  for (const k of Object.keys(patch) as (keyof CSSStyleDeclaration)[]) {
    prev[k] = (el.style[k] as any) ?? ''
    ;(el.style[k] as any) = (patch as any)[k] ?? ''
  }
  return () => {
    for (const k of Object.keys(patch) as (keyof CSSStyleDeclaration)[]) {
      ;(el.style[k] as any) = prev[k] ?? ''
    }
  }
}

function wrap(
  el: HTMLElement,
  mode: 'letters' | 'words'
): { cleanup: Cleanup; spans: HTMLSpanElement[] } {
  const text = el.textContent ?? ''
  ;(el as any).__bl_originalText = text

  const parts =
    mode === 'words'
      ? text.split(/(\s+)/g).filter((p) => p.length > 0)
      : Array.from(text)

  el.textContent = ''
  const spans: HTMLSpanElement[] = []

  for (const p of parts) {
    const s = document.createElement('span')
    s.textContent = p
    s.style.display = 'inline-block'
    s.style.opacity = '0'
    spans.push(s)
    el.appendChild(s)
  }

  const cleanup = () => {
    const orig = (el as any).__bl_originalText
    el.textContent = typeof orig === 'string' ? orig : text
    delete (el as any).__bl_originalText
  }

  return { cleanup, spans }
}

function overlayLine(el: HTMLElement): { cleanup: Cleanup; line: HTMLDivElement } {
  const c1 = withTempStyle(el, { position: 'relative', overflow: 'hidden' })

  const line = document.createElement('div')
  line.style.position = 'absolute'
  line.style.left = '0'
  line.style.right = '0'
  line.style.height = '2px'
  line.style.top = '0'
  line.style.background = 'rgba(13,202,240,0.9)'
  line.style.boxShadow = '0 0 12px rgba(13,202,240,0.7)'
  line.style.transform = 'translateY(-8px)'
  el.appendChild(line)

  const cleanup = () => {
    try {
      line.remove()
    } catch {}
    c1()
  }

  return { cleanup, line }
}

function runLetterStagger(el: HTMLElement, mode: 'letters' | 'words'): Cleanup {
  const { cleanup, spans } = wrap(el, mode)

  const per = mode === 'words' ? 120 : 35
  const dur = 260
  let cancelled = false

  spans.forEach((sp, i) => {
    const delay = i * per
    sp.animate(
      [
        { opacity: 0, transform: 'translateY(6px)', filter: 'blur(2px)' },
        { opacity: 1, transform: 'translateY(0px)', filter: 'blur(0px)' },
      ],
      { duration: dur, delay, fill: 'both', easing: 'ease-out' }
    )
  })

  const total = spans.length * per + dur + 50
  const t = window.setTimeout(() => {
    if (!cancelled) cleanup()
  }, total)

  const c = () => {
    cancelled = true
    clearTimeout(t)
    cleanup()
  }

  active.set(el, c)
  return c
}

export function runConcertTransition(el: HTMLElement, id: string): void {
  stop(el)

  if (!id || id === 'none') return
  const tid = id as TransitionId

  switch (tid) {
    case 'explosion':
      animateEl(
        el,
        [
          {
            opacity: 0.3,
            transform: 'scale(0.85)',
            filter: 'blur(3px)',
            letterSpacing: '0px',
          },
          {
            opacity: 0.9,
            transform: 'scale(1.08)',
            filter: 'blur(0px)',
            letterSpacing: '3px',
            offset: 0.45,
          },
          {
            opacity: 1,
            transform: 'scale(1)',
            filter: 'blur(0px)',
            letterSpacing: '0px',
          },
        ],
        { duration: 900, easing: 'ease-out' }
      )
      return

    case 'burn':
      animateEl(
        el,
        [
          {
            textShadow: '0 0 0 rgba(255,60,0,0)',
            filter: 'brightness(0.9)',
            opacity: 0.7,
          },
          {
            textShadow:
              '0 0 18px rgba(255,120,0,0.9), 0 0 40px rgba(255,60,0,0.7)',
            filter: 'brightness(1.2)',
            opacity: 1,
            offset: 0.5,
          },
          {
            textShadow: '0 0 10px rgba(255,120,0,0.5)',
            filter: 'brightness(1.0)',
            opacity: 1,
          },
        ],
        { duration: 1200, easing: 'ease-in-out' }
      )
      return

    case 'matrix':
      animateEl(
        el,
        [
          {
            opacity: 0,
            transform: 'translateY(-18px)',
            color: '#0f0',
            textShadow: '0 0 8px #0f0',
          },
          {
            opacity: 1,
            transform: 'translateY(0px)',
            color: '#fff',
            textShadow: '0 0 0 rgba(0,0,0,0)',
          },
        ],
        { duration: 900, easing: 'ease-out' }
      )
      return

    case 'glitch':
      animateEl(
        el,
        [
          {
            transform: 'translateX(0) skew(0deg)',
            textShadow: '2px 0 rgba(255,0,0,0.6), -2px 0 rgba(0,255,255,0.6)',
          },
          {
            transform: 'translateX(-2px) skew(8deg)',
            textShadow: '4px 0 rgba(255,0,0,0.7), -4px 0 rgba(0,255,255,0.7)',
          },
          {
            transform: 'translateX(2px) skew(-6deg)',
            textShadow: '1px 0 rgba(255,0,0,0.6), -1px 0 rgba(0,255,255,0.6)',
          },
          {
            transform: 'translateX(0) skew(0deg)',
            textShadow: '0 0 rgba(0,0,0,0)',
          },
        ],
        { duration: 520, easing: 'linear' }
      )
      return

    case 'typewriter': {
      const c = withTempStyle(el, { overflow: 'hidden', whiteSpace: 'nowrap' })
      const cleanup = animateEl(
        el,
        [
          { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
          { clipPath: 'inset(0 0% 0 0)', opacity: 1 },
        ],
        { duration: 900, easing: 'steps(14,end)' }
      )
      active.set(el, () => {
        cleanup()
        c()
      })
      return
    }

    case 'neonPulse':
      animateEl(
        el,
        [
          { textShadow: '0 0 10px rgba(13,202,240,0.3)' },
          {
            textShadow:
              '0 0 26px rgba(13,202,240,0.9), 0 0 60px rgba(13,202,240,0.45)',
          },
          { textShadow: '0 0 10px rgba(13,202,240,0.3)' },
        ],
        { duration: 1200, easing: 'ease-in-out' }
      )
      return

    case 'liquid':
      animateEl(
        el,
        [
          {
            filter: 'blur(3px)',
            transform: 'skewX(0deg) translateY(6px)',
            opacity: 0.75,
          },
          {
            filter: 'blur(0px)',
            transform: 'skewX(-6deg) translateY(-2px)',
            opacity: 1,
            offset: 0.55,
          },
          {
            filter: 'blur(0px)',
            transform: 'skewX(0deg) translateY(0px)',
            opacity: 1,
          },
        ],
        { duration: 1100, easing: 'ease-out' }
      )
      return

    case 'vibration':
      animateEl(
        el,
        [
          { transform: 'translate(0,0)' },
          { transform: 'translate(-2px,1px)' },
          { transform: 'translate(2px,-1px)' },
          { transform: 'translate(-1px,2px)' },
          { transform: 'translate(0,0)' },
        ],
        { duration: 420, easing: 'linear' }
      )
      return

    case 'echo':
      animateEl(
        el,
        [
          { opacity: 0.6, textShadow: '0 0 0 rgba(255,255,255,0)' },
          {
            opacity: 1,
            textShadow:
              '0 0 0 rgba(255,255,255,0), 0 0 18px rgba(255,255,255,0.25)',
          },
          { opacity: 1, textShadow: '0 0 22px rgba(255,255,255,0.35)' },
        ],
        { duration: 900, easing: 'ease-out' }
      )
      return

    case 'sparkle':
      animateEl(
        el,
        [
          {
            filter: 'brightness(1)',
            textShadow: '0 0 8px rgba(255,255,255,0.25)',
          },
          {
            filter: 'brightness(1.35)',
            textShadow:
              '0 0 18px rgba(255,255,255,0.7), 0 0 40px rgba(13,202,240,0.35)',
          },
          {
            filter: 'brightness(1)',
            textShadow: '0 0 8px rgba(255,255,255,0.25)',
          },
        ],
        { duration: 1200, easing: 'ease-in-out' }
      )
      return

    case 'wave':
      animateEl(
        el,
        [
          { transform: 'translateY(8px) skewX(-6deg)', opacity: 0.7 },
          { transform: 'translateY(0px) skewX(0deg)', opacity: 1 },
          { transform: 'translateY(-4px) skewX(4deg)', opacity: 1 },
          { transform: 'translateY(0px) skewX(0deg)', opacity: 1 },
        ],
        { duration: 900, easing: 'ease-out' }
      )
      return

    case 'letterByLetter':
      runLetterStagger(el, 'letters')
      return

    case 'wordByWord':
      runLetterStagger(el, 'words')
      return

    case 'smoke':
      animateEl(
        el,
        [
          { opacity: 0.2, filter: 'blur(6px)', transform: 'translateY(10px)' },
          { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0px)' },
        ],
        { duration: 1400, easing: 'ease-out' }
      )
      return

    case 'edgeGlow':
      animateEl(
        el,
        [
          { textShadow: '0 0 4px rgba(255,255,255,0.2)' },
          {
            textShadow:
              '0 0 10px rgba(255,255,255,0.7), 0 0 24px rgba(13,110,253,0.55)',
          },
          { textShadow: '0 0 4px rgba(255,255,255,0.2)' },
        ],
        { duration: 1200, easing: 'ease-in-out' }
      )
      return

    case 'pulseRim':
      animateEl(
        el,
        [
          { textShadow: '0 0 0 rgba(0,0,0,0)' },
          {
            textShadow:
              '0 0 10px rgba(255,255,255,0.55), 0 0 24px rgba(255,255,255,0.25)',
          },
          { textShadow: '0 0 0 rgba(0,0,0,0)' },
        ],
        { duration: 1100, easing: 'ease-in-out' }
      )
      return

    case 'fireEdge':
      animateEl(
        el,
        [
          { textShadow: '0 0 6px rgba(255,180,0,0.35)' },
          {
            textShadow:
              '0 0 18px rgba(255,180,0,0.9), 0 0 44px rgba(255,60,0,0.55)',
          },
          { textShadow: '0 0 6px rgba(255,180,0,0.35)' },
        ],
        { duration: 1200, easing: 'ease-in-out' }
      )
      return

    case 'neonOutline':
      animateEl(
        el,
        [
          { textShadow: '0 0 8px rgba(13,202,240,0.35)' },
          {
            textShadow:
              '0 0 22px rgba(13,202,240,0.95), 0 0 60px rgba(13,202,240,0.35)',
          },
          { textShadow: '0 0 8px rgba(13,202,240,0.35)' },
        ],
        { duration: 1200, easing: 'ease-in-out' }
      )
      return

    case 'starlight':
      animateEl(
        el,
        [
          {
            filter: 'brightness(1)',
            textShadow: '0 0 10px rgba(255,255,255,0.25)',
          },
          {
            filter: 'brightness(1.35)',
            textShadow:
              '0 0 18px rgba(255,255,255,0.75), 0 0 50px rgba(255,255,180,0.35)',
          },
          {
            filter: 'brightness(1)',
            textShadow: '0 0 10px rgba(255,255,255,0.25)',
          },
        ],
        { duration: 1400, easing: 'ease-in-out' }
      )
      return

    /* Gemini set (B) */
    case 'letterShine':
      animateEl(
        el,
        [
          { filter: 'brightness(0.95)' },
          {
            filter: 'brightness(1.35)',
            textShadow: '0 0 18px rgba(255,255,255,0.8)',
          },
          { filter: 'brightness(1.0)' },
        ],
        { duration: 1200, easing: 'ease-in-out' }
      )
      return

    case 'electricEdges':
      animateEl(
        el,
        [
          { textShadow: '0 0 10px rgba(0,200,255,0.2)' },
          {
            textShadow:
              '0 0 18px rgba(0,200,255,0.9), 0 0 44px rgba(160,0,255,0.55)',
          },
          { textShadow: '0 0 12px rgba(0,200,255,0.35)' },
        ],
        { duration: 700, easing: 'linear' }
      )
      return

    case 'cometTail':
      animateEl(
        el,
        [
          {
            textShadow: '0 0 0 rgba(0,0,0,0)',
            transform: 'translateX(-6px)',
            opacity: 0.7,
          },
          {
            textShadow: '12px 0 18px rgba(13,202,240,0.25)',
            transform: 'translateX(0px)',
            opacity: 1,
          },
          {
            textShadow: '0 0 0 rgba(0,0,0,0)',
            transform: 'translateX(0px)',
            opacity: 1,
          },
        ],
        { duration: 1200, easing: 'ease-out' }
      )
      return

    case 'ghostlyAppear':
      animateEl(
        el,
        [
          { opacity: 0, filter: 'blur(6px)', transform: 'translateY(6px)' },
          { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0px)' },
        ],
        { duration: 1200, easing: 'ease-out' }
      )
      return

    case 'laserScan': {
      const { cleanup: c0, line } = overlayLine(el)
      const a0 = animateEl(
        line,
        [
          { transform: 'translateY(-10px)', opacity: 0.0 },
          { transform: 'translateY(10px)', opacity: 1.0, offset: 0.2 },
          { transform: 'translateY(80%)', opacity: 0.9 },
          { transform: 'translateY(110%)', opacity: 0.0 },
        ],
        { duration: 900, easing: 'linear' }
      )
      const a1 = animateEl(
        el,
        [
          { filter: 'brightness(1.0)' },
          { filter: 'brightness(1.25)' },
          { filter: 'brightness(1.0)' },
        ],
        { duration: 900, easing: 'ease-in-out' }
      )
      active.set(el, () => {
        a0()
        a1()
        c0()
      })
      return
    }

    case 'pixelateIn':
      animateEl(
        el,
        [
          { filter: 'blur(6px) contrast(1.2)', opacity: 0.6 },
          { filter: 'blur(0px) contrast(1.0)', opacity: 1 },
        ],
        { duration: 900, easing: 'steps(10,end)' }
      )
      return

    case 'cinemaLights':
      animateEl(
        el,
        [
          {
            filter: 'brightness(0.95)',
            textShadow: '0 0 10px rgba(255,255,255,0.15)',
          },
          {
            filter: 'brightness(1.35)',
            textShadow:
              '0 0 24px rgba(255,255,255,0.55), 0 0 60px rgba(255,180,60,0.25)',
          },
          {
            filter: 'brightness(1.0)',
            textShadow: '0 0 10px rgba(255,255,255,0.15)',
          },
        ],
        { duration: 1400, easing: 'ease-in-out' }
      )
      return

    case 'windySmoke':
      animateEl(
        el,
        [
          {
            opacity: 0.35,
            filter: 'blur(6px)',
            transform: 'translateX(-16px)',
          },
          { opacity: 1, filter: 'blur(0px)', transform: 'translateX(0px)' },
        ],
        { duration: 1200, easing: 'ease-out' }
      )
      return

    case 'starDust':
      animateEl(
        el,
        [
          {
            textShadow: '0 0 10px rgba(255,255,255,0.25)',
            filter: 'brightness(1.0)',
          },
          {
            textShadow:
              '0 0 18px rgba(255,255,255,0.7), 0 0 44px rgba(13,202,240,0.25)',
            filter: 'brightness(1.25)',
          },
          {
            textShadow: '0 0 10px rgba(255,255,255,0.25)',
            filter: 'brightness(1.0)',
          },
        ],
        { duration: 1200, easing: 'ease-in-out' }
      )
      return

    case 'inkBleed':
      animateEl(
        el,
        [
          { opacity: 0.2, filter: 'blur(8px)', letterSpacing: '2px' },
          { opacity: 1, filter: 'blur(0px)', letterSpacing: '0px' },
        ],
        { duration: 1300, easing: 'ease-out' }
      )
      return

    default:
      animateEl(
        el,
        [
          { opacity: 0.0, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'translateY(0px)' },
        ],
        { duration: 450, easing: 'ease-out' }
      )
      return
  }
}
