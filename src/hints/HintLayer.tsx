import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../stores/app.store';
import { useTrackStore } from '../stores/track.store';
import { useUIStore } from '../stores/ui.store';
import { ChalkHint } from './ChalkHint';
import {
  HINT_ANCHOR_ATTR,
  HINT_BOX_H,
  HINT_BOX_W,
  HINT_DEFAULT_TTL_MS,
  HINT_IN_DELAY_MS,
  HINT_OUT_MS,
} from './config';
import { isStepEligible, uploadMastery } from './eligibility';
import type { HintContext } from './eligibility';
import { resolveHintLocale } from './locale';
import { checkHintPools, HINT_ORDER, HINT_REGISTRY } from './registry';
import { pickVariantIndex, useHintsStore } from './store';
import type { HintCompletion, HintId, HintSpec, HintVariant } from './types';
import './hints.css';

interface AnchorRect {
  left: number; top: number; right: number; bottom: number;
  cx: number; cy: number; width: number; height: number;
  vw: number; vh: number;
}

interface Placement {
  left: number; top: number;
  sx: number; sy: number; ex: number; ey: number;
}

/**
 * Exactly ONE roll per (step, locale) per DOCUMENT.
 *
 * HintLayer legitimately unmounts and remounts during a visit — opening the
 * Room switches `surface` away from 'app', and `App.tsx` only mounts this layer
 * for that surface. A `useRef` (or component state) would be reset by that
 * remount and re-roll the copy: the CDP witness caught two `noteVariant`
 * writes in one document, and the second roll could land on the variant from
 * the previous page load. Module scope survives those remounts but is
 * re-created by a real reload — which is exactly when a NEW variant is wanted.
 */
const rolledThisDocument = new Map<string, HintVariant>();

/**
 * Exactly ONE delivered impression per step per document, counted when the
 * chalk LEAVES, not when it is merely eligible. Counting on entry would make
 * the exposure budget flip mid-animation and yank the hint off the screen.
 */
const deliveredThisDocument = new Set<string>();

function toRect(el: HTMLElement): AnchorRect {
  const b = el.getBoundingClientRect();
  return {
    left: b.left, top: b.top, right: b.right, bottom: b.bottom,
    cx: b.left + b.width / 2, cy: b.top + b.height / 2,
    width: b.width, height: b.height,
    vw: window.innerWidth, vh: window.innerHeight,
  };
}

/** Placement is derived from the measured target, never from hard-coded pixels. */
function place(spec: HintSpec, r: AnchorRect): Placement {
  const toTheRight = spec.side.endsWith('right');
  const below = spec.side.startsWith('below');
  const left = Math.max(14, Math.min(
    toTheRight ? r.left - 24 : r.right - HINT_BOX_W,
    r.vw - HINT_BOX_W - 14,
  ));
  const top = below ? r.bottom + 62 : Math.max(14, r.top - 62 - HINT_BOX_H);
  return {
    left, top,
    sx: left + HINT_BOX_W - 30,
    sy: below ? top - 6 : top + HINT_BOX_H + 6,
    ex: r.cx,
    ey: below ? r.bottom + 9 : r.top - 9,
  };
}

/**
 * Root of the guided tour. Mounted lazily AFTER the splash is gone, so none of
 * this enters the first-paint module graph. It renders at most one step, is
 * fully transparent to pointer events (except its tiny dismiss button), and
 * disappears on its own.
 *
 * This component owns LIFECYCLE only. WHETHER a step may be shown is decided by
 * the pure policies in eligibility.ts — that is what lets the tour grow without
 * turning HintLayer into a pile of `if (id === ...)`.
 */
export function HintLayer() {
  const enabled = useHintsStore((s) => s.enabled);
  const completed = useHintsStore((s) => s.completed);
  const stats = useHintsStore((s) => s.stats);
  const localeOverride = useHintsStore((s) => s.localeOverride);
  const noteVariant = useHintsStore((s) => s.noteVariant);
  const complete = useHintsStore((s) => s.complete);

  const surface = useAppStore((s) => s.surface);
  const catalogOpen = useUIStore((s) => s.catalogOpen);
  const catalogTab = useUIStore((s) => s.catalogTab);
  const trackCount = useTrackStore((s) => s.tracksMeta.length);

  /**
   * `sessionDone` is in-memory only: doing the action ends the step for THIS
   * visit, so there is no nagging, but a fresh load can greet the user again.
   * `savedThisVisit` is likewise visit-scoped — a persisted fact must never be
   * mistaken for an action the user just performed.
   */
  const [sessionDone, setSessionDone] = useState<HintId[]>([]);
  const [savedThisVisit, setSavedThisVisit] = useState(false);

  const context: HintContext = useMemo(() => ({
    surface, catalogOpen, catalogTab, trackCount,
    enabled, completed, sessionDone, stats,
  }), [surface, catalogOpen, catalogTab, trackCount, enabled, completed, sessionDone, stats]);

  const spec = useMemo(
    () => HINT_ORDER.map((id) => HINT_REGISTRY[id]).find(
      (s) => s && isStepEligible(s, context),
    ) ?? null,
    [context],
  );
  const mastery = useMemo(() => uploadMastery(context), [context]);

  const [rect, setRect] = useState<AnchorRect | null>(null);
  const [variant, setVariant] = useState<HintVariant | null>(null);
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const visibleRef = useRef(false);
  useEffect(() => { visibleRef.current = visible; }, [visible]);

  const locale = resolveHintLocale(localeOverride);
  // `active` is intentionally spec-driven: the old global `!catalogOpen` gate
  // made a step INSIDE the catalog impossible.
  const active = !!spec;

  /** Record the impression when the chalk leaves, exactly once per document. */
  const deliver = useCallback((id: HintId, refused: boolean) => {
    if (deliveredThisDocument.has(id)) {return;}
    deliveredThisDocument.add(id);
    const s = useHintsStore.getState();
    s.noteShow(id);
    if (refused) {s.noteDismiss(id);}
  }, []);

  /** End a step for THIS visit. Deliberately never writes `completed[]`. */
  const finishStep = useCallback((id: HintId) => {
    if (visibleRef.current) {deliver(id, false);}
    setSessionDone((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, [deliver]);

  const dismiss = useCallback((id: HintId, refused: boolean) => {
    const wasVisible = visibleRef.current;
    setLeaving(true);
    window.setTimeout(() => {
      // Evidence is written AFTER the fade: noteDismiss retires a learn-once
      // step immediately, and writing it earlier would cut the animation.
      if (wasVisible) {deliver(id, refused);}
      setVisible(false);
      setLeaving(false);
      if (refused) {
        setSessionDone((prev) => (prev.includes(id) ? prev : [...prev, id]));
      }
    }, HINT_OUT_MS);
  }, [deliver]);

  /** Live, visit-scoped observations. Persisted facts never count here. */
  const seenThisVisit = useCallback((name: HintCompletion): boolean => {
    switch (name) {
      case 'catalog-open': return catalogOpen;
      case 'upload-tab-open': return catalogTab === 'upload';
      case 'track-saved': return savedThisVisit;
      default: return false;
    }
  }, [catalogOpen, catalogTab, savedThisVisit]);

  useEffect(() => {
    const problems = checkHintPools();
    if (problems.length) {console.warn('[hints] registry:', problems.join('; '));}
  }, []);

  /**
   * FACTS. `track-saved` is dispatched by upload.service.ts after a track
   * really reached IDB (3 dispatch sites) — the strongest available proof of
   * upload mastery. `upload-tab-open` counts deliberate visits to ЗАГРУЗКА.
   * Both are persisted, so mastery survives a reload.
   */
  useEffect(() => {
    const onSaved = () => {
      setSavedThisVisit(true);
      useHintsStore.getState().noteFact('track-saved');
    };
    document.addEventListener('track-saved', onSaved);
    return () => document.removeEventListener('track-saved', onSaved);
  }, []);

  const prevTab = useRef(catalogTab);
  useEffect(() => {
    if (catalogTab === 'upload' && prevTab.current !== 'upload') {
      useHintsStore.getState().noteFact('upload-tab-open');
    }
    prevTab.current = catalogTab;
  }, [catalogTab]);

  /**
   * Completion is evaluated for EVERY step, not just the one on screen: when
   * the catalog opens, `start.catalog` becomes ineligible in the very same
   * render, so an effect keyed on the active spec would miss it and the start
   * nudge would pop back up later in the visit.
   */
  useEffect(() => {
    for (const id of HINT_ORDER) {
      const s = HINT_REGISTRY[id];
      if (!s?.completeOn || sessionDone.includes(id)) {continue;}
      if (!seenThisVisit(s.completeOn)) {continue;}
      finishStep(id);
      if (!s.repeatOnLoad && !completed.includes(id)) {complete(id);}
    }
  }, [seenThisVisit, sessionDone, completed, finishStep, complete]);

  // Switching steps must not reuse the previous step's copy / geometry / fade.
  useEffect(() => {
    setVisible(false);
    setLeaving(false);
    setRect(null);
  }, [spec?.id]);

  // One random variant per load, never repeating the previous load's one.
  useEffect(() => {
    if (!active || !spec) {return;}
    const key = `${spec.id}:${locale}`;
    let chosen = rolledThisDocument.get(key);
    if (!chosen) {
      const pool = spec.variants[locale];
      // Read fresh from the store (hydration is synchronous) instead of a
      // render-time snapshot, which can be stale after an `active` toggle.
      const last = useHintsStore.getState().lastVariant[spec.id];
      const index = pickVariantIndex(pool.length, last);
      chosen = pool[index];
      rolledThisDocument.set(key, chosen);
      noteVariant(spec.id, index);
    }
    setVariant(chosen);
  }, [active, spec, locale, noteVariant]);

  // Anchor discovery + live measurement. The target may appear a beat later
  // (the catalog overlay is React-mounted), so retry briefly before giving up.
  useEffect(() => {
    if (!active || !spec) {
      setRect(null);
      return;
    }
    let el: HTMLElement | null = null;
    let observer: ResizeObserver | null = null;
    let timer = 0;
    let tries = 0;

    const measure = () => { if (el) {setRect(toRect(el));} };
    const seek = () => {
      el = document.querySelector<HTMLElement>(`[${HINT_ANCHOR_ATTR}="${spec.target}"]`);
      if (!el || el.getBoundingClientRect().width === 0) {
        if (tries++ < 40) {timer = window.setTimeout(seek, 50);}
        return;
      }
      measure();
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(measure);
        observer.observe(el);
      }
      window.addEventListener('resize', measure);
      window.addEventListener('scroll', measure, true);
    };
    seek();
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, spec?.target]);

  // Enter on a short delay so the splash → deck handoff is visually settled,
  // then fade out on its own. No click required, ever.
  useEffect(() => {
    if (!active || !rect || !variant || !spec) {return;}
    const inTimer = window.setTimeout(() => setVisible(true), HINT_IN_DELAY_MS);
    const ttlTimer = window.setTimeout(
      () => dismiss(spec.id, false),
      HINT_IN_DELAY_MS + (spec.ttlMs ?? HINT_DEFAULT_TTL_MS),
    );
    return () => {
      window.clearTimeout(inTimer);
      window.clearTimeout(ttlTimer);
    };
  }, [active, rect, variant, spec, dismiss]);

  // Escape / direct click on the anchor also end the step quietly. A click is
  // NOT mastery: one curious tap must never retire a learn-once step.
  useEffect(() => {
    if (!active || !spec || !visible) {return;}
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') {dismiss(spec.id, false);} };
    const anchor = document.querySelector<HTMLElement>(`[${HINT_ANCHOR_ATTR}="${spec.target}"]`);
    const onAnchor = () => { finishStep(spec.id); dismiss(spec.id, false); };
    window.addEventListener('keydown', onKey);
    anchor?.addEventListener('pointerdown', onAnchor);
    return () => {
      window.removeEventListener('keydown', onKey);
      anchor?.removeEventListener('pointerdown', onAnchor);
    };
  }, [active, spec, visible, dismiss, finishStep]);

  if (!active || !spec || !rect || !variant || (!visible && !leaving)) {return null;}

  const p = place(spec, rect);
  // Observable for the CDP witnesses: which pool index is on screen right now.
  const shownIndex = spec.variants[locale].indexOf(variant);
  const tipX = p.ex - 8;
  const tipY = p.ey + 3;
  const arrow = `M ${p.sx} ${p.sy} C ${p.sx + 44} ${p.sy - 32}, ${p.ex - 74} ${p.ey + 52}, ${tipX} ${tipY}`;
  const head = `M ${tipX} ${tipY} l -13 -1 M ${tipX} ${tipY} l -4 -12`;

  return (
    <div
      className={`bl-hint-layer${leaving ? ' bl-hint-layer--leaving' : ''}`}
      data-bl-hint-layer={spec.id}
      data-bl-hint-locale={locale}
      data-bl-hint-variant={shownIndex}
      data-bl-hint-track-count={trackCount}
      data-bl-hint-mastery={mastery.reason ?? 'none'}
    >
      <svg
        className="bl-hint__canvas"
        width={rect.vw}
        height={rect.vh}
        viewBox={`0 0 ${rect.vw} ${rect.vh}`}
        aria-hidden="true"
      >
        <ellipse
          className="bl-hint__stroke bl-hint__ring"
          cx={rect.cx}
          cy={rect.cy}
          rx={rect.width / 2 + 9}
          ry={rect.height / 2 + 6}
          pathLength={1}
        />
        <path className="bl-hint__stroke bl-hint__stroke--dust" d={arrow} pathLength={1} />
        <path className="bl-hint__stroke" d={arrow} pathLength={1} />
        <path className="bl-hint__stroke" d={head} pathLength={1} />
      </svg>

      <ChalkHint
        hintId={spec.id}
        variant={variant}
        left={p.left}
        top={p.top}
        locale={locale}
        onDismiss={(refused) => dismiss(spec.id, refused)}
      />
    </div>
  );
}
