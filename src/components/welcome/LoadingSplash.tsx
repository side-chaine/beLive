import { useEffect, useRef, useState } from 'react';
import type { TransitionEvent } from 'react';
import { SPLASH_POSTER_URL, dismissBootSplash } from '../../boot/boot-splash';
import { RoundelFace } from '../RoundelFace';

/**
 * Animated startup splash.
 *
 * Plays `src/assets/welcome-splash.mp4` (the "Welcome to beLIVE / Art Platform"
 * intro with the neon red/blue wings) full-screen while the app boots. Rendered
 * as a STABLE overlay by `App.tsx`: the app is mounted *underneath* it, so when
 * the splash fades there is no hard cut — the already-present UI is simply
 * revealed with a soft crossfade.
 *
 * Design goals (iteration 6 — the wings BECOME the two tools):
 *  - The reveal is STAGED, not simultaneous:
 *      1. VIDEO  — the animated wings play; no faders are shown yet.
 *      2. FADERS — when the intro ends (the wings are gone), the video fades out
 *         and the two real tools fade IN at the bottom-centre deck position:
 *         `Inst` (instrumental, red) + `Voc` (vocal, blue). The wings *become*
 *         the two faders you actually control — that's the symbolism.
 *      3. EXIT   — after a short beat (once auth is ready) the whole splash
 *         crossfades, handing off to the live app's real ControlDeck.
 *  - `object-fit: cover` (no black side bars), `loop` off (final frame held, no
 *    rewind glitch). Compositing hints kill sub-pixel letter jitter.
 *
 * The video is imported through `new URL(..., import.meta.url)` so Vite resolves
 * the correct URL for dev (`/beLive/...`) and prod (`/...`) automatically.
 *
 * FIRST PAINT: React only mounts after the whole module graph has been fetched
 * and evaluated (~45 imports + bootAether), so a plain HTML/CSS boot layer in
 * index.html shows the same poster frame instantly. This component dismisses
 * that layer as soon as the video has a frame (with a timer + inline-script
 * safety net), and the <video poster> bridges the hand-off without a black cut.
 */

const splashSrc = new URL('../../assets/welcome-splash.mp4', import.meta.url).href;
// Poster URL + boot-layer dismissal live in the canonical boot contract:
// src/boot/boot-splash.ts (single source of truth, shared with index.html).

type LoadingSplashProps = {
  /** App is authenticated / ready. Gates the final reveal so we never expose an unmounted app. */
  authReady: boolean;
  /** Fired after the fade-out transition completes; parent should then unmount the splash. */
  onComplete: () => void;
};

/** Exact wing-core colors sampled from `welcome-splash.mp4` (frame ~2.8s). */
const WING_RED = '#FE5C55';   // Inst — red wing core  (rgb 254,92,85)
const WING_BLUE = '#39A4FE';  // Voc — blue wing core  (rgb 57,164,254)

/** Small helper: hex (#RRGGBB) → rgba() string with the given alpha. */
function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * A single fader styled as a small fragment of the wing "compressed" into a
 * precise tool (Energy Rail + Light Node, per the 707 brief):
 *  - Energy Rail — the filled portion, the saturated wing color with internal
 *    filament veins and a brighter inset edge.
 *  - Light Node — a narrow bright marker at the fill's leading edge with a flare.
 *  - The unfilled track keeps a thin colored outline so the wing "ghost" reads
 *    even at 0%. Appears with a subtle scale impulse (350ms).
 */
function Fader({ label, value, color, glow }: { label: string; value: number; color: string; glow: string }) {
  return (
    <div
      className="bl-wing-fader"
      style={{
        position: 'relative',
        width: 180,
        height: 22,
        borderRadius: 4,
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid ${hexToRgba(color, 0.4)}`,
        overflow: 'hidden',
        flexShrink: 0,
        filter: `drop-shadow(0 0 8px ${glow})`,
      }}
      aria-label={label}
    >
      {/* Energy Rail */}
      <div
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${value}%`,
          background: `linear-gradient(180deg, ${hexToRgba(color, 0.9)} 0%, ${hexToRgba(color, 0.22)} 50%, ${hexToRgba(color, 0.9)} 100%)`,
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -3px 6px rgba(0,0,0,0.45)',
          transition: 'width 0.05s',
          pointerEvents: 'none',
        }}
      >
        {/* Filament veins */}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: `repeating-linear-gradient(90deg, transparent 0, transparent 6px, rgba(255,255,255,0.14) 6px, rgba(255,255,255,0.14) 7px)`,
            mixBlendMode: 'overlay',
            pointerEvents: 'none',
          }}
        />
        {/* Light Node — bright leading edge + flare */}
        <div
          style={{
            position: 'absolute', right: -1, top: -1, bottom: -1, width: 2,
            background: '#ffffff',
            boxShadow: `0 0 6px 1px ${color}, 0 0 12px 3px ${glow}`,
            pointerEvents: 'none',
          }}
        />
      </div>
      <span
        style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', fontSize: 9,
          color: 'rgba(255,255,255,0.55)', userSelect: 'none', pointerEvents: 'none',
          textShadow: '0 1px 2px rgba(0,0,0,0.65)',
        }}
      >
        {label} {value}
      </span>
    </div>
  );
}

type Phase = 'video' | 'faders' | 'exit';

export function LoadingSplash({ authReady, onComplete }: LoadingSplashProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Keep the latest callback without making the exit-fallback effect depend on
  // its identity (App passes an inline arrow, so it changes on every render).
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [phase, setPhase] = useState<Phase>('video');

  // Force muted + start playback (autoplay requires muted).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const p = v.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {/* autoplay blocked — safety timeouts still advance phases */});
    }
  }, []);

  // Static boot layer (#bl-boot-splash) sits ABOVE the React splash, so it must
  // never be able to outlive it. `dismissBootSplash` is idempotent, so this
  // fallback can safely race with canplay / loadeddata / error. The <video>
  // carries the same poster, so even an early dismissal is visually seamless.
  useEffect(() => {
    const t = setTimeout(dismissBootSplash, 1200);
    return () => clearTimeout(t);
  }, []);

  // Once the wings are gone, the boot poster is stale by definition.
  useEffect(() => {
    if (phase !== 'video') dismissBootSplash();
  }, [phase]);

  // When the intro finishes, the wings are gone → reveal the faders.
  const handleEnded = () => {
    setPhase((p) => (p === 'video' ? 'faders' : p));
  };

  // Video failed (missing asset / codec / network): don't sit on a black frame —
  // drop the poster and go straight to the two tools.
  const handleVideoError = () => {
    dismissBootSplash();
    setPhase((p) => (p === 'video' ? 'faders' : p));
  };

  // Once the faders are shown, hold them a beat, then exit — on the splash's
  // OWN timeline. We deliberately do NOT gate the exit on `authReady`: the live
  // app is already mounted underneath, so if auth is still resolving it simply
  // renders behind us (no flash) and pops in a beat later. Gating exit on auth
  // was a hang risk — a slow or failed auth check left the splash stuck on the
  // faders forever.
  useEffect(() => {
    if (phase !== 'faders') return;
    const t = setTimeout(() => setPhase('exit'), 1300);
    return () => clearTimeout(t);
  }, [phase]);

  // Safety: if the video never ends (autoplay blocked / stalled), don't get stuck
  // on the intro — advance to the faders around 8s.
  useEffect(() => {
    const t = setTimeout(() => {
      setPhase((p) => (p === 'video' ? 'faders' : p));
    }, 8000);
    return () => clearTimeout(t);
  }, []);

  // Safety: never hang behind the splash. If we're still on the faders once auth
  // is ready, force the exit (covers late auth / any race).
  useEffect(() => {
    if (!authReady) return;
    const t = setTimeout(() => {
      setPhase((p) => (p === 'faders' ? 'exit' : p));
    }, 13000);
    return () => clearTimeout(t);
  }, [authReady]);

  // Hard safety for the "hangs on this frame" symptom: the parent unmounts us
  // ONLY on the opacity transitionend. If that event is suppressed (background
  // tab, reduced motion, compositor quirk) the invisible overlay would stay
  // mounted forever. 850ms transition + margin → force completion.
  // Calling onComplete twice is harmless (setSplashGone(true) is idempotent).
  useEffect(() => {
    if (phase !== 'exit') return;
    const t = setTimeout(() => onCompleteRef.current(), 1200);
    return () => clearTimeout(t);
  }, [phase]);

  const handleContainerTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.propertyName === 'opacity' && phase === 'exit') {
      onComplete();
    }
  };

  const videoVisible = phase === 'video';
  const fadersVisible = phase === 'faders' || phase === 'exit';

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: '#000',
        zIndex: 9999999,
        overflow: 'hidden',
        opacity: phase === 'exit' ? 0 : 1,
        transition: 'opacity 0.85s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: phase === 'exit' ? 'none' : 'auto',
        willChange: 'opacity',
      }}
      onTransitionEnd={handleContainerTransitionEnd}
    >
      <video
        ref={videoRef}
        src={splashSrc}
        poster={SPLASH_POSTER_URL}
        autoPlay
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        onCanPlay={dismissBootSplash}
        onLoadedData={dismissBootSplash}
        onError={handleVideoError}
        onEnded={handleEnded}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          backgroundColor: '#000',
          opacity: videoVisible ? 1 : 0,
          transition: 'opacity 0.7s ease',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          willChange: 'opacity',
        }}
      />

      {/* The two tools fade IN only AFTER the wings are gone (iteration 6).
          Sitting at the bottom-centre deck position so the hand-off to the live
          ControlDeck is seamless. */}
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 7,
          height: 22,
          pointerEvents: 'none',
          zIndex: 3,
        }}
      >
        {/* SAME 50% axis as the top bL roundel and the live deck fader trio.
            bottom:7 -> y = H-29, matching the deck faders at any viewport
            height. No padding hack: the live deck is absolute on 50% too, so
            the wings -> faders -> deck hand-off cannot ghost in any state. */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 6,
            height: 22,
            opacity: fadersVisible ? 1 : 0,
            transition: 'opacity 0.7s ease',
          }}
        >
          <Fader label="Inst" value={100} color={WING_RED} glow="rgba(254, 92, 85, 0.55)" />
          {/* Same roundel as the live deck, decorative during the intro so the
              wings → faders → deck hand-off stays pixel-identical. */}
          <RoundelFace playing={false} decorative />
          <Fader label="Voc" value={100} color={WING_BLUE} glow="rgba(57, 164, 254, 0.55)" />
        </div>
      </div>

      {/* Loading dots show only while the intro plays; they fade out as the
          faders take over. */}
      <div
        className="bl-loading-dots"
        style={{
          position: 'absolute', bottom: '7%',
          opacity: videoVisible ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
      >
        <span /><span /><span />
      </div>
      <style>{`
        .bl-loading-dots span {
          display: inline-block; width: 8px; height: 8px;
          border-radius: 50%; background: rgba(255,255,255,0.5);
          margin: 0 4px; animation: bl-dot-bounce 1.2s infinite;
        }
        .bl-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .bl-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bl-dot-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .bl-wing-fader { animation: bl-fader-impulse 350ms ease-out; }
        @keyframes bl-fader-impulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
