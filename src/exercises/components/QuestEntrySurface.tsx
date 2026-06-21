import React from 'react';
import { useExerciseStore } from '../exercise.store';
import { EXERCISE_RECIPES } from '../exercise.recipes';
import { useBlocksStore } from '../../stores/blocks.store';
import { useAudioStore } from '../../stores/audio.store';
import { TempoSetupModal } from './TempoSetupModal';

export interface QuestEntrySurfaceProps {
  blockId: string;
  onClose: () => void;
  visibility?: 'stable' | 'all'; // 'stable' = learner-safe default, 'all' = show experimental/special
}

/**
 * QuestEntrySurface — Entry surface foundation for quest/challenge discovery and selection.
 *
 * This is the dedicated user-facing surface where learners browse and launch practice challenges.
 * It replaces the ad-hoc popover-only architecture with a proper entry surface foundation.
 *
 * Current wave (learner-facing default):
 * - Renders card grid of stable recipes only (learner-safe default)
 * - Shows card metadata (name, icon, description, rounds)
 * - Supports close callback
 * - Architecture ready for experimental/special sections later
 *
 * Future waves (not yet implemented):
 * - Experimental section: Tempo Ladder, Backing Ladder variants (opt-in toggle)
 * - Special lane: Call & Response, Alternation patterns (separate entry point)
 * - Stats/progression visuals
 * - Advanced grouping/navigation
 *
 * Visibility policy (frozen):
 * - 'stable': Echo Drill, 3-Take Challenge (always shown to learners)
 * - 'smoke': Tempo Ladder, Backing Only, A Cappella Boss (hidden by default, experimental)
 * - 'special': Call & Response, Alternation patterns (separate lane, requires duet mode)
 */
export const QuestEntrySurface: React.FC<QuestEntrySurfaceProps> = ({
  blockId,
  onClose,
  visibility = 'stable',
}) => {
  const startRecipe = useExerciseStore((s) => s.startRecipe);
  const blocks = useBlocksStore((s) => s.blocks);

  const [tempoSetupOpen, setTempoSetupOpen] = React.useState(false);

  // Compute line count for active block
  const activeBlock = blocks.find((b) => b.id === blockId);
  const lineCount = activeBlock?.lineIndices?.length ?? 2;

  // Check vocal stem availability via audio store (reactive, fixes race with useMemo)
  const hasVocalStem = useAudioStore((s) => s.hasVocals);

  // Filter recipes by visibility policy
  const stableRecipes = EXERCISE_RECIPES.filter((recipe) => recipe.surface === 'stable');
  
  const experimentalRecipes = EXERCISE_RECIPES.filter(
    (recipe) => recipe.surface === 'smoke' && !recipe.hidden
  );
  
  // Unified visible recipes: stable + experimental (including smoke labs)
  const visibleRecipes = [
    ...stableRecipes,
    ...experimentalRecipes,
  ];

  // Determine if a recipe is available (not disabled by missing capabilities)
  const isRecipeAvailable = (recipe: typeof EXERCISE_RECIPES[0]): boolean => {
    if (!recipe.capabilities) return true;
    if (recipe.capabilities.requiresVocalStem && !hasVocalStem) return false;
    return true;
  };

  // Get reason why a recipe is disabled
  const getDisabledReason = (recipe: typeof EXERCISE_RECIPES[0]): string | null => {
    if (!recipe.capabilities) return null;
    if (recipe.capabilities.requiresVocalStem && !hasVocalStem) {
      return 'Requires vocal stem';
    }
    if (recipe.capabilities.experimentalReason) {
      return recipe.capabilities.experimentalReason;
    }
    return null;
  };

  const handleCardClick = (recipeId: string) => {
    const recipe = EXERCISE_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return;

    // For Tempo Ladder, open setup modal instead of launching immediately
    if (recipe.id === 'tempo-ladder') {
      setTempoSetupOpen(true);
      return;
    }

    // For Call & Response, pass lineCount to expand across full block
    if (recipe.id === 'call-response') {
      startRecipe(recipe.id, blockId, { lineCount });
    } else if (recipe.id === 'trade-v1') {
      // For Trade v1, pass lineCount for explicit line-stage sequence
      startRecipe(recipe.id, blockId, { lineCount });
    } else {
      startRecipe(recipe.id, blockId);
    }
    onClose();
  };

  return (
    <>
      {/* Tempo Setup Modal — extracted component */}
      {tempoSetupOpen && (
        <TempoSetupModal
          onConfirm={(tempoRate, previewBetweenRounds) => {
            startRecipe('tempo-ladder', blockId, { tempoRate, previewBetweenRounds });
            setTempoSetupOpen(false);
            onClose();
          }}
          onCancel={() => setTempoSetupOpen(false)}
        />
      )}

      {/* Main Quest Room */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          pointerEvents: 'auto',
        }}
        onClick={(e) => {
          // Close on backdrop click (only if clicking the outer container directly)
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
      {/* Inner content frame */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 1000,
          width: '90%',
          maxHeight: '85vh',
          background: 'rgba(20,20,20,0.95)',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.60)',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
      >
        {/* Quest room header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            padding: '24px 40px',
            borderBottom: '1px solid rgba(255,255,255,0.12)',
            flexShrink: 0,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.95)',
                letterSpacing: '0px',
              }}
            >
              Choose a scenario
            </h1>
          </div>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.70)',
              fontSize: 22,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s ease',
              fontWeight: 600,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.85)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.70)';
            }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Content area */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
          }}
        >
          {/* Unified practice scenarios grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {visibleRecipes.map((recipe) => (
              <QuestCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => handleCardClick(recipe.id)}
                isAvailable={isRecipeAvailable(recipe)}
                disabledReason={getDisabledReason(recipe)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

/**
 * Card Anatomy Helpers — Minimal formatting for Promise/Method/Win contract
 * 
 * These helpers derive promise/method/win text from recipe metadata.
 * They use only available data — no fake analytics or mastery numbers.
 */

function getPromise(recipe: typeof EXERCISE_RECIPES[0]): string {
  // Promise: What will you achieve?
  const promises: Record<string, string> = {
    'echo-drill': 'Build muscle memory through repetition',
    'triple-take': 'Master this section through comparison',
  };
  return promises[recipe.id] || recipe.name;
}

function getMethod(recipe: typeof EXERCISE_RECIPES[0]): string {
  // Method: How will you practice?
  const methods: Record<string, string> = {
    'echo-drill': 'Listen, then sing it back',
    'triple-take': 'Record multiple takes',
  };
  return methods[recipe.id] || recipe.description;
}

function getWin(recipe: typeof EXERCISE_RECIPES[0]): string {
  // Win: How do you know you're done?
  const wins: Record<string, string> = {
    'echo-drill': `Complete ${recipe.defaultRounds} rounds`,
    'triple-take': `Fill all ${recipe.defaultRounds} slots`,
  };
  return wins[recipe.id] || `Complete ${recipe.defaultRounds} round${recipe.defaultRounds !== 1 ? 's' : ''}`;
}

/**
 * QuestCard — Individual quest card component with card anatomy baseline.
 *
 * Displays Promise/Method/Win contract:
 * - Promise: What will you achieve?
 * - Method: How will you practice?
 * - Win: How do you know you're done?
 *
 * Uses only available metadata — no fake data.
 * Compact enough for current Takes scene.
 */
interface QuestCardProps {
  recipe: typeof EXERCISE_RECIPES[0];
  onClick: () => void;
  isAvailable?: boolean;
  disabledReason?: string | null;
}

const QuestCard: React.FC<QuestCardProps> = ({ recipe, onClick, isAvailable = true, disabledReason = null }) => {
  const promise = getPromise(recipe);
  const method = getMethod(recipe);
  const win = getWin(recipe);
  const isDisabled = !isAvailable;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={{
        borderRadius: 8,
        border: isDisabled ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.20)',
        background: isDisabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: 10,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        color: isDisabled ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.90)',
        padding: 12,
        minHeight: 160,
        transition: 'all 0.2s ease',
        textAlign: 'left',
        opacity: isDisabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (isDisabled) return;
        (e.currentTarget as HTMLButtonElement).style.background =
          'rgba(255,255,255,0.14)';
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          'rgba(255,255,255,0.30)';
      }}
      onMouseLeave={(e) => {
        if (isDisabled) return;
        (e.currentTarget as HTMLButtonElement).style.background =
          'rgba(255,255,255,0.08)';
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          'rgba(255,255,255,0.20)';
      }}
    >
      {/* Icon/Emblem */}
      <span style={{ fontSize: 24, opacity: isDisabled ? 0.5 : 1, marginBottom: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>{recipe.icon}</span>

      {/* Title/Promise */}
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1.2,
          marginBottom: 3,
        }}
      >
        {recipe.name}
      </span>

      {/* Disabled reason (if applicable) */}
      {isDisabled && disabledReason && (
        <span
          style={{
            fontSize: 8,
            color: 'rgba(255,200,100,0.70)',
            lineHeight: 1.3,
            fontWeight: 500,
          }}
        >
          {disabledReason}
        </span>
      )}

      {/* Promise: What you'll achieve */}
      {!isDisabled && (
        <span
          style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.3,
            marginBottom: 1,
          }}
        >
          {promise}
        </span>
      )}

      {/* Method: How you'll practice */}
      {!isDisabled && (
        <span
          style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.3,
            marginBottom: 1,
          }}
        >
          {method}
        </span>
      )}

      {/* Win: How you know you're done */}
      {!isDisabled && (
        <span
          style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.3,
            marginTop: 'auto',
            fontStyle: 'italic',
          }}
        >
          {win}
        </span>
      )}
    </button>
  );
};
