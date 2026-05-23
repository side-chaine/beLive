/**
 * Practice Scenario Definitions — Wave G
 *
 * 3-фазная модель:
 * - startActions: выполнить при старте
 * - perPassActions: выполнить после каждого прохода (user-driven)
 * - isComplete: проверить завершение
 * - onCompleteActions: выполнить при завершении
 * - restoreActions: выполнить при cancel (restore snapshot)
 */

import type { PracticeAction } from './billy-action-runner';
import { useBlocksStore } from '../stores/blocks.store';
import type { PracticeSnapshot } from '../stores/practice-session.store';

// ── Types ──

export type PracticeScenarioId = 'bpm-ramp' | 'focus-mix' | 'section-breakdown' | 'random-blocks';

export interface PracticeContext {
  requestedBlockType?: string;
  requestedBlockId?: string;
  currentBlockId?: string;
  currentBlockType?: string;
  occurrence?: number;
}

export interface PracticeProgress {
  currentRate: number;
  totalPasses: number;
  completedBlockIds: string[];
}

export interface PracticeScenario {
  id: PracticeScenarioId;
  title: string;
  icon: string;
  startActions: PracticeAction[] | ((ctx: PracticeContext) => PracticeAction[]);
  perPassActions: PracticeAction[] | ((ctx: PracticeContext, progress: PracticeProgress) => PracticeAction[]);
  isComplete: (progress: PracticeProgress, ctx: PracticeContext) => boolean;
  onCompleteActions: PracticeAction[] | ((ctx: PracticeContext, progress: PracticeProgress) => PracticeAction[]);
  restoreActions: PracticeAction[] | ((snapshot: PracticeSnapshot) => PracticeAction[]);
}

// ── Helpers ──

const RU_BLOCK_NAMES: Record<string, string> = {
  intro: 'Вступление', verse: 'Куплет', prechorus: 'Пре-хорус',
  chorus: 'Припев', bridge: 'Бридж', interlude: 'Интерлюдия', outro: 'Заключение',
};

function ruBlockName(type: string): string {
  return RU_BLOCK_NAMES[type] || type;
}

// ── Scenario: BPM Ramp (Прогон с разгоном) ──

const BPM_RAMP: PracticeScenario = {
  id: 'bpm-ramp',
  title: 'Разгон темпа',
  icon: '🔥',

  startActions: (ctx) => {
    const blockType = ctx.requestedBlockType || ctx.currentBlockType || 'chorus';
    return [
      { tool: 'loop_section', args: { sectionType: blockType } },
      { tool: 'set_playback_rate', args: { rate: 0.8 } },
    ];
  },

  perPassActions: (_ctx, progress) => {
    const newRate = Math.min(1.0, progress.currentRate + 0.05);
    return [
      { tool: 'set_playback_rate', args: { rate: newRate } },
    ];
  },

  isComplete: (progress) => {
    return progress.currentRate >= 1.0 && progress.totalPasses > 0;
  },

  onCompleteActions: () => [
    { tool: 'loop_section', args: { enabled: false } },
  ],

  restoreActions: (snapshot) => [
    { tool: 'set_playback_rate', args: { rate: snapshot.playbackRate } },
    { tool: 'loop_section', args: { enabled: false } },
  ],
};

// ── Scenario Registry ──

const SCENARIOS: Partial<Record<PracticeScenarioId, PracticeScenario>> = {
  'bpm-ramp': BPM_RAMP,
};

export function getScenario(id: PracticeScenarioId): PracticeScenario | undefined {
  return SCENARIOS[id];
}

export function getAvailableScenarios(ctx: PracticeContext): {
  id: PracticeScenarioId;
  title: string;
  icon: string;
  targetBlockType: string;
}[] {
  const blockType = ctx.requestedBlockType || ctx.currentBlockType || 'chorus';
  return [
    {
      id: 'bpm-ramp',
      title: `Разогнать ${ruBlockName(blockType)}`,
      icon: '🔥',
      targetBlockType: blockType,
    },
  ];
}

/** Resolve target block for scenario */
export function resolveTargetBlock(
  ctx: PracticeContext
): { blockId: string; blockType: string } | null {
  const blocks = useBlocksStore.getState().blocks;
  if (!blocks?.length) return null;

  // 1. Explicit blockId
  if (ctx.requestedBlockId) {
    const found = blocks.find(b => b.id === ctx.requestedBlockId);
    if (found) return { blockId: found.id, blockType: found.type };
  }

  // 2. Current active block
  if (ctx.currentBlockId) {
    const found = blocks.find(b => b.id === ctx.currentBlockId);
    if (found) return { blockId: found.id, blockType: found.type };
  }

  // 3. First matching type
  const targetType = ctx.requestedBlockType || ctx.currentBlockType;
  if (targetType) {
    const found = blocks.find(b => b.type === targetType);
    if (found) return { blockId: found.id, blockType: found.type };
  }

  // 4. First chorus
  const chorus = blocks.find(b => b.type === 'chorus');
  if (chorus) return { blockId: chorus.id, blockType: chorus.type };

  // 5. Any block
  const first = blocks[0];
  return { blockId: first.id, blockType: first.type };
}
