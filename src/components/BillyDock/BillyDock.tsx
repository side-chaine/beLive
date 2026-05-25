import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { useBillyAnimation, useBillyIsLooping, useBillyIsRecording, useBillyTrackInfoOpen, type BillyAnimation } from '../../hooks/useBillyState';
import { useBillyAudioReactive } from '../../hooks/useBillyAudioReactive';
import { useBillyLocomotion } from '../../hooks/useBillyLocomotion';
import { getInitialPixelPosition } from '../../billy/billy-runtime';
import { useBillyRuntimeStore } from '../../billy/billy-runtime.store';
import { useTrackInfoStore } from '../../stores/trackInfo.store';
import { useDeckStore } from '../../stores/deck.store';
import { useTrackStore } from '../../stores/track.store';
import { useBlocksStore } from '../../stores/blocks.store';
import { useLyricsStore } from '../../stores/lyrics.store';
import { getBlockTypeConfig } from '../../blocks/types';
import styles from './BillyDock.module.css';

type EffectiveAnimation = BillyAnimation | 'jump' | 'walk' | 'somersault';

const STATE_CLASS: Record<EffectiveAnimation, string> = {
    idle: styles.idle,
    dance: styles.dance,
    think: styles.think,
    sleep: styles.sleep,
    jump: styles.jump,
    walk: styles.walk,
    somersault: styles.somersault,
  };

const JUMP_DURATION = 750;

interface BillyRefs {
  billySvg: SVGSVGElement | null;
  bodyInner: SVGGElement | null;
  headInner: SVGGElement | null;
  armLInner: SVGGElement | null;
  armRInner: SVGGElement | null;
}

export function BillyDock() {
  const animation = useBillyAnimation();
  const isLooping = useBillyIsLooping();
  const isRecording = useBillyIsRecording();
  const trackInfoOpen = useBillyTrackInfoOpen();
  const runtimeMode = useBillyRuntimeStore(s => s.mode);
  const [clickJump, setClickJump] = useState(false);
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Track-change jump trigger ──
  const currentTrackId = useTrackStore(s => s.currentTrack?.id ?? null);
  const prevTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentTrackId && prevTrackIdRef.current && currentTrackId !== prevTrackIdRef.current) {
      setClickJump(true);
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
      jumpTimerRef.current = setTimeout(() => setClickJump(false), JUMP_DURATION);
    }
    prevTrackIdRef.current = currentTrackId;
  }, [currentTrackId]);

  useEffect(() => {
    return () => {
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    };
  }, []);

  // ── Block color from active block ──
  const activeBlockColor = useBlocksStore(s => {
    const idx = useLyricsStore.getState().activeLineIndex;
    if (idx < 0 || !s.blocks?.length) return 'transparent';
    for (const block of s.blocks) {
      if (block.lineIndices?.includes(idx)) {
        return getBlockTypeConfig(block.type).color;
      }
    }
    return 'transparent';
  });

  // ── Effective animation ──
  // BillyAnimation из useBillyState переопределяется runtime mode Position Engine
  const effectiveAnimation: EffectiveAnimation = clickJump ? 'jump' :
    runtimeMode === 'groove' ? 'dance' :
    runtimeMode === 'think' ? 'think' :
    runtimeMode === 'sleep' ? 'sleep' :
    'idle';
  const stateClass = STATE_CLASS[effectiveAnimation] || styles.idle;

  // ── Click handler ──
  const handleClick = useCallback(() => {
    // One-shot jump — ALWAYS, even without track (cute, no error)
    setClickJump(true);
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    jumpTimerRef.current = setTimeout(() => setClickJump(false), JUMP_DURATION);

    // Клик на Billy → открывает док с billy tab, НЕ overlay
    const deck = useDeckStore.getState();
    if (deck.activeTabId === 'billy' && deck.expanded) {
      // Уже открыт — закрыть
      deck.setTab('');
      return;
    }
    // Открыть billy tab в доке
    deck.setTab('billy');
    if (!deck.expanded) deck.toggle();

    // Установить vocal-coach как активного эксперта
    const track = useTrackStore.getState().currentTrack;
    if (track?.id) {
      useTrackInfoStore.getState().setActiveExpert('vocal-coach');
    }

    // Фокус на input после анимации
    setTimeout(() => {
      const input = document.querySelector<HTMLTextAreaElement>('[data-billy-input="true"]');
      input?.focus();
    }, 150);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  // ── Locomotion ref ──
  const billyRootRef = useRef<HTMLDivElement>(null);

  // INV-BILLY-INITPOS: начальная позиция до первого paint
  useLayoutEffect(() => {
    if (billyRootRef.current) {
      const { pixelX, pixelY } = getInitialPixelPosition();
      billyRootRef.current.style.transform = `translate(${pixelX}px, ${pixelY}px)`;
    }
  }, []);

  // ── Audio-reactive refs (stable object via useRef) ──
  const billySvgRef = useRef<SVGSVGElement>(null);
  const bodyInnerRef = useRef<SVGGElement>(null);
  const headInnerRef = useRef<SVGGElement>(null);
  const armLInnerRef = useRef<SVGGElement>(null);
  const armRInnerRef = useRef<SVGGElement>(null);

  const billyRefs = useRef<BillyRefs>({
    billySvg: null,
    bodyInner: null,
    headInner: null,
    armLInner: null,
    armRInner: null,
  });

  // Update refs on every render (cheap — just assignments)
  billyRefs.current.billySvg = billySvgRef.current;
  billyRefs.current.bodyInner = bodyInnerRef.current;
  billyRefs.current.headInner = headInnerRef.current;
  billyRefs.current.armLInner = armLInnerRef.current;
  billyRefs.current.armRInner = armRInnerRef.current;

  // ── Audio-reactive micro-movements ──
  useBillyAudioReactive(billyRefs, effectiveAnimation);

  // ── Locomotion (Position Engine) ──
  useBillyLocomotion({ rootRef: billyRootRef });

  // ── Glow classes ──
  const hasGlow = activeBlockColor !== 'transparent';

  return (
    <div
      ref={billyRootRef}
      className={[
        styles.root,
        stateClass,
        trackInfoOpen ? styles.boardOpen : '',
        isLooping ? styles.loopActive : '',
        isRecording ? styles.recActive : '',
      ].filter(Boolean).join(' ')}
      style={{ '--bl-billy-block-color': activeBlockColor } as React.CSSProperties}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title="Спроси Билли"
      role="button"
      tabIndex={0}
      aria-label="Открыть AI-тренера Билли"
    >
      <svg
        ref={billySvgRef}
        className={styles.billy}
        width="64"
        height="91"
        viewBox="0 0 140 200"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {/* Body audio-reactive inner layer — CSS keyframes on <svg>, JS bounce on <g> */}
        <g ref={bodyInnerRef} className={styles.bodyReactive}>

          {/* Ноги */}
          <g className={styles.legL}>
            <rect x="50" y="155" width="17" height="26" rx="8.5" fill="#1c1c1c" stroke="#2e2e2e" strokeWidth="1"/>
            <ellipse cx="58" cy="182" rx="12" ry="6" fill="#111" stroke="#222" strokeWidth="1"/>
          </g>
          <g className={styles.legR}>
            <rect x="73" y="155" width="17" height="26" rx="8.5" fill="#1c1c1c" stroke="#2e2e2e" strokeWidth="1"/>
            <ellipse cx="81" cy="182" rx="12" ry="6" fill="#111" stroke="#222" strokeWidth="1"/>
          </g>

          {/* Рука лево — outer CSS + inner reactive */}
          <g className={styles.armL}>
            <g ref={armLInnerRef} className={styles.armLReactive}>
              <path d="M 53 118 Q 32 110 28 100" fill="none" stroke="#1c1c1c" strokeWidth="13" strokeLinecap="round"/>
              <path d="M 53 118 Q 32 110 28 100" fill="none" stroke="#282828" strokeWidth="9" strokeLinecap="round"/>
              <circle cx="26" cy="98" r="8" fill="#1c1c1c" stroke="#333" strokeWidth="1"/>
            </g>
          </g>

          {/* Тело */}
          <rect x="53" y="108" width="34" height="52" rx="9" fill="#1c1c1c" stroke="#2a2a2a" strokeWidth="1"/>
          <rect x="56" y="115" width="28" height="5" rx="2" fill="#111"/>
          <rect x="56" y="125" width="28" height="5" rx="2" fill="#111"/>
          <rect x="56" y="135" width="28" height="5" rx="2" fill="#0e0e0e"/>
          <rect x="56" y="145" width="28" height="5" rx="2" fill="#111"/>

          {/* Рука право — outer CSS + inner reactive */}
          <g className={styles.armR}>
            <g ref={armRInnerRef} className={styles.armRReactive}>
              <path d="M 87 118 Q 108 110 112 100" fill="none" stroke="#1c1c1c" strokeWidth="13" strokeLinecap="round"/>
              <path d="M 87 118 Q 108 110 112 100" fill="none" stroke="#282828" strokeWidth="9" strokeLinecap="round"/>
              <circle cx="114" cy="98" r="8" fill="#1c1c1c" stroke="#333" strokeWidth="1"/>
            </g>
          </g>

          {/* Голова — outer CSS + inner reactive */}
          <g className={styles.head}>
            <g ref={headInnerRef} className={styles.headReactive}>
              {/* Микрофон шар */}
              <ellipse cx="70" cy="60" rx="40" ry="42" fill="#1e1e1e" stroke="#383838" strokeWidth="1.5"/>
              <ellipse cx="70" cy="60" rx="33" ry="35" fill="#252525" stroke="#2c2c2c" strokeWidth=".8"/>
              <ellipse
                cx="70" cy="60" rx="24" ry="27"
                fill="#1e1e1e" stroke="#303030" strokeWidth=".6"
                className={hasGlow ? styles.headGlow : ''}
              />
              {/* Сетка горизонт */}
              <line x1="32" y1="48" x2="108" y2="48" stroke="#2c2c2c" strokeWidth=".7"/>
              <line x1="30" y1="60" x2="110" y2="60" stroke="#2c2c2c" strokeWidth=".7"/>
              <line x1="32" y1="72" x2="108" y2="72" stroke="#2c2c2c" strokeWidth=".7"/>
              {/* Сетка верт */}
              <line x1="57" y1="19" x2="51" y2="101" stroke="#2c2c2c" strokeWidth=".7"/>
              <line x1="70" y1="18" x2="70" y2="102" stroke="#2c2c2c" strokeWidth=".7"/>
              <line x1="83" y1="19" x2="89" y2="101" stroke="#2c2c2c" strokeWidth=".7"/>
              {/* Recording indicator — red dot on mic head */}
              <circle className={styles.recDot} cx="70" cy="33" r="3" fill="#ff3333"/>
              {/* Воротник */}
              <rect x="38" y="97" width="64" height="9" rx="4.5" fill="#b0b0b0" stroke="#909090" strokeWidth=".8"/>
              <rect x="40" y="99" width="60" height="5" rx="2.5" fill="#d4d4d4"/>
              {/* Оранжевый акцент */}
              <rect x="53" y="106" width="34" height="5" rx="2.5" fill="#f97316"/>
              {/* Loop indicator — orange dot on collar */}
              <circle className={styles.loopDot} cx="70" cy="103" r="3.5" fill="#f97316"/>
              {/* Глаза */}
              <g className={`${styles.eyes} ${hasGlow ? styles.eyesGlow : ''}`}>
                <ellipse cx="53" cy="68" rx="11" ry="12" fill="white"/>
                <ellipse cx="87" cy="68" rx="11" ry="12" fill="white"/>
                {/* Зрачки — отдельные circle для Phase 1.5 eye tracking */}
                <circle cx={55} cy={69} r="6.5" fill="#0a0a0a" className={styles.pupilL}/>
                <circle cx={89} cy={69} r="6.5" fill="#0a0a0a" className={styles.pupilR}/>
                {/* Блики */}
                <circle cx="52" cy="66" r="2.8" fill="white"/>
                <circle cx="86" cy="66" r="2.8" fill="white"/>
                <circle cx="57" cy="72" r="1.1" fill="white"/>
                <circle cx="91" cy="72" r="1.1" fill="white"/>
              </g>
              {/* Рот */}
              <path d="M 57 83 Q 70 93 83 83" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            </g>
          </g>

          {/* ZZZ — only in sleep */}
          {effectiveAnimation === 'sleep' && (
            <g className={styles.zzz}>
              <text className={styles.z1} x="96" y="36" fontSize="13" fontFamily="monospace" fontWeight="700" fill="#818cf8">z</text>
              <text className={styles.z2} x="104" y="22" fontSize="17" fontFamily="monospace" fontWeight="700" fill="#818cf8">Z</text>
            </g>
          )}

        </g>
      </svg>
      {/* Ground shadow — independent of SVG animation */}
      <div className={styles.shadow} aria-hidden="true" />
    </div>
  );
}
