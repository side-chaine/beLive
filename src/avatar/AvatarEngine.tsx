// @TC-AVATAR: AvatarEngine — tier gate component
// Checks allowAvatar → renders FallbackAvatar or FullAvatar

import { useVisualBudget } from '../performance/performance.hooks';
import { FallbackAvatar } from './FallbackAvatar';
import { FullAvatar } from './FullAvatar';
import type { AvatarMode } from './avatar.store';

interface AvatarEngineProps {
  /** Display mode: full (Feed), compact (Catalog), micro (Billy Chat — V1) */
  mode?: AvatarMode;
  className?: string;
}

/**
 * AvatarEngine — main entry point for avatar rendering.
 * - Checks useVisualBudget().scene.allowAvatar
 * - false → FallbackAvatar (CSS keyframes, 0ms CPU, no scheduler)
 * - true  → FullAvatar (scheduler + audio-reactive, max/ultra tiers)
 */
export function AvatarEngine({ mode = 'full', className }: AvatarEngineProps) {
  const budget = useVisualBudget();

  if (!budget.scene.allowAvatar) {
    return <FallbackAvatar mode={mode} className={className} />;
  }

  return <FullAvatar mode={mode} className={className} />;
}
