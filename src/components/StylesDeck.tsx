import { useEffect, useMemo, useState } from 'react';
import { useModeStore } from '../stores/mode.store';
import { useTextStyleStore } from '../stores/textStyle.store';
import { useTrackStore } from '../stores/track.store';
import { useThemeStore } from '../theme/store/theme-store';
import { getThemeById } from '../theme/themes/index';
import {
  FONT_CATEGORIES,
  TRANSITIONS,
  LINE_OTHERS_SOURCES,
  LINE_OTHERS_SOURCE_LABELS,
  type WordFocusLevel,
  type WordFxMode,
  type WordCompletedMode,
  type WordTrailDepth,
  type LineActiveLevel,
  type LineNextLevel,
  type LineOthersLevel,
  type LineOthersSource,
} from '../types/textStyle.types';
import { REHEARSAL_STYLE_RECIPES } from '../styles/style-recipes';
import { LineFxSelectorModal } from './LineFxSelectorModal';
import { useResolvedTrailDepth, useVisualBudget } from '../performance/performance.hooks';
import s from './StylesDeck.module.css';

type TransitionSet = 'A' | 'B';

// Display labels for word controls (capitalized for UI)
const WORD_FOCUS_LABELS: Record<WordFocusLevel, string> = {
  off: 'Off',
  soft: 'Soft',
  strong: 'Strong',
};

const LINE_ACTIVE_LABELS: Record<LineActiveLevel, string> = {
  off: 'Off',
  soft: 'Focus Soft',
  strong: 'Focus Strong',
};

const LINE_NEXT_LABELS: Record<LineNextLevel, string> = {
  off: 'Off',
  hint: 'Hint',
  guide: 'Guide',
};

const LINE_OTHERS_LABELS: Record<LineOthersLevel, string> = {
  dim: 'Dim',
  medium: 'Balanced',
  low: 'Open',
};

// Bank badge for each lane (v1 — static / semantic)
const LINE_ACTIVE_BANK = 'A';
const LINE_NEXT_BANK = 'C';
const LINE_OTHERS_BANK = 'D';

const WORD_FX_LABELS: Record<WordFxMode, string> = {
  progress: 'Progress',
  neon: 'Neon',
  underline: 'Underline',
  bounce: 'Bounce',
};

const WORD_COMPLETED_LABELS: Record<WordCompletedMode, string> = {
  off: 'Off',
  full: 'On',
};

// Public UI labels for Trail — Scene removed (exploratory, not shipping-grade)
const WORD_TRAIL_LABELS: Record<Exclude<WordTrailDepth, 'scene'>, string> = {
  off: 'Off',
  line: 'Line',
};

const ALL_FONTS = FONT_CATEGORIES.flatMap(cat => cat.list);

const MODE_UI = {
  rehearsal: {
    label: 'Rehearsal',
    presets: ['Focus', 'Soft Guide', 'Loop Study', 'Minimal'],
    wordDefault: 'soft' as WordFocusLevel,
    progressDefault: 'progress' as WordFxMode,
    wordOthers: 'Medium',
    lineActive: 'Soft',
    lineNext: 'Guide',
    lineOthers: 'Low',
  },
  karaoke: {
    label: 'Karaoke',
    presets: ['Classic', 'Readable', 'Lead+', 'Soft Flow'],
    wordDefault: 'soft' as WordFocusLevel,
    progressDefault: 'progress' as WordFxMode,
    wordOthers: 'Medium',
    lineActive: 'Strong',
    lineNext: 'Visible',
    lineOthers: 'Soft',
  },
  concert: {
    label: 'Concert',
    presets: ['Arena', 'Neon', 'Fireline', 'Impact'],
    wordDefault: 'strong' as WordFocusLevel,
    progressDefault: 'neon' as WordFxMode,
    wordOthers: 'Low',
    lineActive: 'Strong',
    lineNext: 'Dim',
    lineOthers: 'Low',
  },
  live: {
    label: 'Live',
    presets: ['Safe', 'Broadcast', 'Bold Subtitle', 'Minimal'],
    wordDefault: 'soft' as WordFocusLevel,
    progressDefault: 'underline' as WordFxMode,
    wordOthers: 'Medium',
    lineActive: 'Clear',
    lineNext: 'Minimal',
    lineOthers: 'Off',
  },
} as const;

const WORD_LEVELS: WordFocusLevel[] = ['off', 'soft', 'strong'];
const WORD_FX_MODES: WordFxMode[] = ['progress', 'neon', 'underline', 'bounce'];
const WORD_COMPLETED_MODES: WordCompletedMode[] = ['off', 'full'];
// Public UI options for Trail — Scene removed (exploratory, not shipping-grade)
const WORD_TRAIL_DEPTHS: Exclude<WordTrailDepth, 'scene'>[] = ['off', 'line'];
const LINE_ACTIVE_LEVELS: LineActiveLevel[] = ['off', 'soft', 'strong'];
const LINE_NEXT_LEVELS: LineNextLevel[] = ['off', 'hint', 'guide'];
const LINE_OTHERS_LEVELS: LineOthersLevel[] = ['dim', 'medium', 'low'];

// Weighted random picker for safer UX
function pickWeightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function buildPreviewTitle(input?: string): string {
  const raw = (input || '').trim();
  if (!raw) return 'Sample Preview';
  const words = raw.split(/\s+/);
  if (words.length <= 4) return raw;
  return `${words.slice(0, 4).join(' ')}…`;
}

/**
 * Check if a trail depth option is available given the max allowed depth
 * Note: Scene is not exposed in public UI, treat as Line for availability checks
 */
function isTrailDepthAvailable(depth: Exclude<WordTrailDepth, 'scene'>, maxAllowed: WordTrailDepth): boolean {
  // Scene is not in public UI; if persisted value is scene, treat as line for availability
  const effectiveMax = maxAllowed === 'scene' ? 'line' : maxAllowed;
  const depthOrder: Exclude<WordTrailDepth, 'scene'>[] = ['off', 'line'];
  const depthIndex = depthOrder.indexOf(depth);
  const maxIndex = depthOrder.indexOf(effectiveMax as Exclude<WordTrailDepth, 'scene'>);
  return depthIndex <= maxIndex;
}

/**
 * Get product-clear helper text for tier limitation
 * Note: Scene is not exposed in public UI
 */
function getTierLimitText(maxTrailDepth: WordTrailDepth): string {
  // Scene is not in public UI; treat as line for messaging
  const effectiveMax = maxTrailDepth === 'scene' ? 'line' : maxTrailDepth;
  switch (effectiveMax) {
    case 'off':
      return 'Lite only allows Off';
    case 'line':
      return '';
    default:
      return '';
  }
}

/**
 * Trail control with availability-aware UI
 * Shows enabled/disabled states based on performance tier budget
 * Note: Scene is not exposed in public UI (exploratory, not shipping-grade)
 */
interface TrailControlProps {
  selectedDepth: WordTrailDepth;
  effectiveDepth: WordTrailDepth;
  maxTrailDepth: WordTrailDepth;
  onChange: (depth: Exclude<WordTrailDepth, 'scene'>) => void;
}

function TrailControl({ selectedDepth, effectiveDepth, maxTrailDepth, onChange }: TrailControlProps) {
  // Scene is not in public UI; if persisted value is scene, visually treat as Line
  const publicSelectedDepth: Exclude<WordTrailDepth, 'scene'> = selectedDepth === 'scene' ? 'line' : selectedDepth;
  const isClamped = selectedDepth !== effectiveDepth;
  const tierLimitText = getTierLimitText(maxTrailDepth);

  return (
    <div className={s.controlRow}>
      <span className={s.controlLabel}>Trail</span>
      <div className={s.chipRow}>
        {WORD_TRAIL_DEPTHS.map(depth => {
          const isAvailable = isTrailDepthAvailable(depth, maxTrailDepth);
          const isSelected = publicSelectedDepth === depth;
          return (
            <button
              type="button"
              key={depth}
              disabled={!isAvailable}
              className={`${s.chipBtn} ${isSelected ? s.chipBtnActive : ''} ${!isAvailable ? s.chipBtnDisabled : ''}`}
              onClick={() => isAvailable && onChange(depth)}
            >
              {WORD_TRAIL_LABELS[depth]}
            </button>
          );
        })}
      </div>
      {isClamped && tierLimitText && (
        <span className={s.trailClampHint}>
          {tierLimitText}
        </span>
      )}
    </div>
  );
}

export function StylesDeck() {
  const mode = useModeStore(st => st.mode);
  const meta = MODE_UI[mode];

  const currentTrack = useTrackStore(st => st.currentTrack);

  const activeThemeId = useThemeStore(st => st.activeThemeId);
  const appTheme = getThemeById(activeThemeId);

  const fontFamily = useTextStyleStore(st => st.fontFamily);
  const fontScale = useTextStyleStore(st => st.fontScale);
  const transitionId = useTextStyleStore(st => st.transitionId);
  const transitionSet = useTextStyleStore(st => st.transitionSet);
  const wordFocusLevel = useTextStyleStore(st => st.wordFocusLevel);
  const wordFxMode = useTextStyleStore(st => st.wordFxMode);
  const wordCompletedMode = useTextStyleStore(st => st.wordCompletedMode);
  const wordTrailDepth = useTextStyleStore(st => st.wordTrailDepth);
  const lineActiveLevel = useTextStyleStore(st => st.lineActiveLevel);
  const lineNextLevel = useTextStyleStore(st => st.lineNextLevel);
  const lineOthersLevel = useTextStyleStore(st => st.lineOthersLevel);
  const lineOthersSource = useTextStyleStore(st => st.lineOthersSource);
  const setFont = useTextStyleStore(st => st.setFontFamily);
  const setTransition = useTextStyleStore(st => st.setTransitionId);
  const setTransSet = useTextStyleStore(st => st.setTransitionSet);
  const setWordFocusLevel = useTextStyleStore(st => st.setWordFocusLevel);
  const setWordFxMode = useTextStyleStore(st => st.setWordFxMode);
  const setWordCompletedMode = useTextStyleStore(st => st.setWordCompletedMode);
  const setWordTrailDepth = useTextStyleStore(st => st.setWordTrailDepth);
  const setLineActiveLevel = useTextStyleStore(st => st.setLineActiveLevel);
  const setLineNextLevel = useTextStyleStore(st => st.setLineNextLevel);
  const setLineOthersLevel = useTextStyleStore(st => st.setLineOthersLevel);
  const setLineOthersSource = useTextStyleStore(st => st.setLineOthersSource);
  const increase = useTextStyleStore(st => st.increaseFontScale);
  const decrease = useTextStyleStore(st => st.decreaseFontScale);
  const reset = useTextStyleStore(st => st.resetFontScale);

  const [selectedPreset, setSelectedPreset] = useState<string>(meta.presets[0]);
  const [lineFxModalOpen, setLineFxModalOpen] = useState(false);

  useEffect(() => {
    setSelectedPreset(meta.presets[0]);
  }, [meta]);

  // Derive active Rehearsal recipe id from live store values.
  // Returns recipe id if store exactly matches a recipe, null otherwise.
  const activeRehearsalRecipeId = useMemo(() => {
    if (mode !== 'rehearsal') return null;
    const match = REHEARSAL_STYLE_RECIPES.find(
      r =>
        r.wordFocusLevel === wordFocusLevel &&
        r.wordFxMode === wordFxMode &&
        r.lineActiveLevel === lineActiveLevel &&
        r.lineNextLevel === lineNextLevel &&
        r.lineOthersLevel === lineOthersLevel
    );
    return match?.id ?? null;
  }, [mode, wordFocusLevel, wordFxMode, lineActiveLevel, lineNextLevel, lineOthersLevel]);

  const previewTitle = useMemo(
    () => buildPreviewTitle(currentTrack?.title || currentTrack?.artist),
    [currentTrack]
  );

  const currentTransitionName = TRANSITIONS[transitionId]?.name ?? 'Effect';
  const appThemeName = appTheme?.name ?? activeThemeId;

  function applyRehearsalRecipe(recipeId: string) {
    const recipe = REHEARSAL_STYLE_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;
    setWordFocusLevel(recipe.wordFocusLevel);
    setWordFxMode(recipe.wordFxMode);
    setLineActiveLevel(recipe.lineActiveLevel);
    setLineNextLevel(recipe.lineNextLevel);
    setLineOthersLevel(recipe.lineOthersLevel);
  }

  function handleRandomize() {
    if (mode === 'rehearsal') {
      // Rehearsal: weighted recipe-based Random — coherent scene, intentional variety
      // Weights: focus(24) soft-guide(24) loop-study(18) minimal(14) neon-trace(14) pulse-cue(6)
      const RECIPE_WEIGHTS: Record<string, number> = {
        'focus': 24,
        'soft-guide': 24,
        'loop-study': 18,
        'minimal': 14,
        'neon-trace': 14,
        'pulse-cue': 6,
      };
      const weightedRecipes = REHEARSAL_STYLE_RECIPES.map(r => r);
      const weights = weightedRecipes.map(r => RECIPE_WEIGHTS[r.id] ?? 10);
      const recipe = pickWeightedRandom(weightedRecipes, weights);
      applyRehearsalRecipe(recipe.id);

      // Font variation — independent, safe
      const randomFont = pickRandom(ALL_FONTS);
      setFont(randomFont.family);

      // Transition variation — independent, safe
      const randomSet: TransitionSet = Math.random() > 0.5 ? 'A' : 'B';
      const randomSource = randomSet === 'A' ? 'claude' : 'gemini';
      const randomTransitions = Object.entries(TRANSITIONS)
        .filter(([, t]) => t.source === randomSource)
        .map(([id]) => id);
      setTransSet(randomSet);
      setTransition(pickRandom(randomTransitions));
      return;
    }

    // All other modes: original weighted-random behavior
    const randomSet: TransitionSet = Math.random() > 0.5 ? 'A' : 'B';
    const randomSource = randomSet === 'A' ? 'claude' : 'gemini';
    const randomTransitions = Object.entries(TRANSITIONS)
      .filter(([, t]) => t.source === randomSource)
      .map(([id]) => id);

    const randomFont = pickRandom(ALL_FONTS);
    const randomTransition = pickRandom(randomTransitions);

    // Weighted random for word controls (safer UX)
    // Focus: soft (60%), strong (30%), off (10%)
    const randomFocus = pickWeightedRandom<WordFocusLevel>(
      ['soft', 'strong', 'off'],
      [0.6, 0.3, 0.1]
    );
    // FX: underline (50%), neon (25%), bounce (20%), progress (5%)
    const randomFxMode = pickWeightedRandom<WordFxMode>(
      ['underline', 'neon', 'bounce', 'progress'],
      [0.5, 0.25, 0.2, 0.05]
    );

    setFont(randomFont.family);
    setTransSet(randomSet);
    setTransition(randomTransition);
    setWordFocusLevel(randomFocus);
    setWordFxMode(randomFxMode);
    setSelectedPreset('Random');
  }

  return (
    <>
      <div className={s.root}>
        <div className={s.consoleGrid}>
          <section className={`${s.section} ${s.fontSection}`}>
            <div className={s.sectionHead}>
              <div className={s.sectionTitle}>Font</div>
            </div>

            <div className={s.previewPlate}>
              <div className={s.previewLabel}>Preview</div>
              <div
                className={s.previewTitle}
                style={{ fontFamily }}
                title={currentTrack?.title || currentTrack?.artist || 'Sample Preview'}
              >
                {previewTitle}
              </div>
            </div>

            <div className={s.controlRow}>
              <span className={s.controlLabel}>Font</span>
              <select
                className={s.fontSelect}
                value={fontFamily}
                onChange={e => setFont(e.target.value)}
              >
                {FONT_CATEGORIES.map(cat => (
                  <optgroup key={cat.name} label={cat.name}>
                    {cat.list.map(f => (
                      <option key={f.id} value={f.family}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className={s.controlRow}>
              <span className={s.controlLabel}>Size</span>
              <div className={s.scaleGroup}>
                <button type="button" className={s.scaleBtn} onClick={() => decrease()}>
                  A−
                </button>
                <span className={s.scaleVal}>{Math.round(fontScale * 100)}%</span>
                <button type="button" className={s.scaleBtn} onClick={() => increase()}>
                  A+
                </button>
                <button type="button" className={s.scaleBtn} onClick={() => reset()} title="Reset">
                  ↺
                </button>
              </div>
            </div>
          </section>

          <section className={`${s.section} ${s.wordSection}`}>
            <div className={s.sectionHead}>
              <div className={s.sectionTitle}>Word</div>
            </div>

            <div className={s.controlRow}>
              <span className={s.controlLabel}>Style</span>
              <select
                className={s.styleSelect}
                value={wordFxMode}
                onChange={e => setWordFxMode(e.target.value as WordFxMode)}
              >
                {WORD_FX_MODES.map(mode => (
                  <option key={mode} value={mode}>
                    {WORD_FX_LABELS[mode]}
                  </option>
                ))}
              </select>
            </div>

            <div className={s.controlRow}>
              <span className={s.controlLabel}>Focus</span>
              <div className={s.chipRow}>
                {WORD_LEVELS.map(level => (
                  <button
                    type="button"
                    key={level}
                    className={`${s.chipBtn} ${wordFocusLevel === level ? s.chipBtnActive : ''}`}
                    onClick={() => setWordFocusLevel(level)}
                  >
                    {WORD_FOCUS_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>

            <TrailControl
              selectedDepth={wordTrailDepth}
              effectiveDepth={useResolvedTrailDepth()}
              maxTrailDepth={useVisualBudget().word.maxTrailDepth}
              onChange={setWordTrailDepth}
            />
          </section>

          <section className={`${s.section} ${s.lineSection}`}>
            <div className={s.sectionHead}>
              <div className={s.sectionTitle}>Line</div>
            </div>

            {/* Active lane */}
            <div className={s.laneRow}>
              <span className={s.laneLabel}>Active</span>
              <div className={s.rail}>
                {LINE_ACTIVE_LEVELS.map(level => (
                  <button
                    type="button"
                    key={level}
                    title={LINE_ACTIVE_LABELS[level]}
                    className={`${s.railStop} ${lineActiveLevel === level ? s.railStopActive : ''}`}
                    onClick={() => setLineActiveLevel(level)}
                  />
                ))}
              </div>
              <span className={s.lanePresetName}>{LINE_ACTIVE_LABELS[lineActiveLevel]}</span>
              <span className={s.bankBadge} data-line-bank="A">{LINE_ACTIVE_BANK}</span>
            </div>

            {/* Next Line lane */}
            <div className={s.laneRow}>
              <span className={s.laneLabel}>Next Line</span>
              <div className={s.rail}>
                {LINE_NEXT_LEVELS.map(level => (
                  <button
                    type="button"
                    key={level}
                    title={LINE_NEXT_LABELS[level]}
                    className={`${s.railStop} ${lineNextLevel === level ? s.railStopActive : ''}`}
                    onClick={() => setLineNextLevel(level)}
                  />
                ))}
              </div>
              <span className={s.lanePresetName}>{LINE_NEXT_LABELS[lineNextLevel]}</span>
              <span className={s.bankBadge} data-line-bank="C">{LINE_NEXT_BANK}</span>
            </div>

            {/* Others: TrackMap toggle + Presence rail */}
            <div className={s.othersRow}>
              <span className={s.controlLabel}>Others</span>
              <div className={s.othersControls}>
                <button
                  type="button"
                  className={`${s.trackMapToggle} ${lineOthersSource === 'trackmap' ? s.trackMapToggleActive : ''}`}
                  onClick={() => setLineOthersSource(lineOthersSource === 'trackmap' ? 'neutral' : 'trackmap')}
                  title="TrackMap colors for background lines"
                >
                  TrackMap
                </button>
                <div className={s.presenceRail}>
                  {LINE_OTHERS_LEVELS.map(level => (
                    <button
                      type="button"
                      key={level}
                      title={LINE_OTHERS_LABELS[level]}
                      className={`${s.presenceStop} ${lineOthersLevel === level ? s.presenceStopActive : ''}`}
                      onClick={() => setLineOthersLevel(level)}
                    />
                  ))}
                </div>
                <span className={s.othersValueLabel}>{LINE_OTHERS_LABELS[lineOthersLevel]}</span>
              </div>
            </div>

            <div className={s.lineFxCompact}>
              <span className={s.controlLabel}>FX</span>
              <button
                type="button"
                className={s.fxSelectBtn}
                onClick={() => setLineFxModalOpen(true)}
              >
                <span className={s.fxSelectName}>{currentTransitionName}</span>
                <span className={s.fxSelectMeta}>Click to choose</span>
              </button>
            </div>
          </section>

          <section className={`${s.section} ${s.themeSection}`}>
            <div className={s.sectionHead}>
              <div className={s.sectionTitle}>Theme</div>
              <span className={s.modePill}>{meta.label}</span>
            </div>

            <div className={s.metaRow}>
              <span className={s.controlLabel}>App</span>
              <span className={s.themeChip}>✓ {appThemeName}</span>
            </div>

            <div className={s.metaRow}>
              <span className={s.controlLabel}>Style</span>
              <div className={s.presetStrip}>
                {mode === 'rehearsal'
                  ? REHEARSAL_STYLE_RECIPES.map(recipe => (
                      <button
                        type="button"
                        key={recipe.id}
                        className={`${s.presetBtn} ${activeRehearsalRecipeId === recipe.id ? s.presetBtnActive : ''}`}
                        onClick={() => applyRehearsalRecipe(recipe.id)}
                      >
                        {recipe.label}
                      </button>
                    ))
                  : meta.presets.map(preset => (
                      <button
                        type="button"
                        key={preset}
                        className={`${s.presetBtn} ${selectedPreset === preset ? s.presetBtnActive : ''}`}
                        onClick={() => setSelectedPreset(preset)}
                      >
                        {preset}
                      </button>
                    ))
                }
                <span className={s.presetGhost}>Custom</span>
              </div>
            </div>

            <div className={s.metaRow}>
              <span className={s.controlLabel}>Theme</span>
              <div className={s.themeActions}>
                <button type="button" className={s.randomBtn} onClick={handleRandomize}>
                  Random
                </button>
                <span className={s.currentThemeState}>
                  {mode === 'rehearsal'
                    ? (activeRehearsalRecipeId
                        ? REHEARSAL_STYLE_RECIPES.find(r => r.id === activeRehearsalRecipeId)?.label
                        : 'Custom')
                    : selectedPreset
                  }
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <LineFxSelectorModal
        open={lineFxModalOpen}
        transitionSet={transitionSet}
        transitionId={transitionId}
        onClose={() => setLineFxModalOpen(false)}
        onSetTransitionSet={setTransSet}
        onSelectTransition={setTransition}
      />
    </>
  );
}
