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
import { useStemStore } from '../stem/stem.store';
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

export interface ScenarioMeta {
  startRate: number;
  step: number;
  targetRate: number;
  totalPasses: number;
}

export interface PracticeScenario {
  id: PracticeScenarioId;
  title: string;
  icon: string;
  meta?: ScenarioMeta;
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
      { tool: 'seek_to_section', args: { sectionType: blockType } },
      { tool: 'loop_section', args: { sectionType: blockType, enabled: true } },
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

  'focus-mix': {
    id: 'focus-mix',
    title: 'Фокус на стемы',
    icon: '🎚',
    meta: {
      startRate: 1.0,
      step: 0,
      targetRate: 1.0,
      totalPasses: 0, // dynamic — зависит от количества musicStems
    },
    startActions: (ctx) => {
      const blockType = ctx.requestedBlockType || ctx.currentBlockType || 'verse';
      return [
        { tool: 'ensure_stems_enabled', args: {} },
        { tool: 'seek_to_section', args: { sectionType: blockType } },
        { tool: 'loop_section', args: { sectionType: blockType, enabled: true } },
      ];
    },
    perPassActions: (_ctx, progress) => {
      const stemState = useStemStore.getState();
      const loaded = stemState.loadedStems || [];

      const musicStems = loaded.filter(id =>
        id !== 'vocals' && id !== 'backing' && id !== 'instrumental'
      );
      const vocalStems = loaded.filter(id =>
        id === 'vocals' || id === 'backing'
      );

      const actions: PracticeAction[] = [];
      const focusIndex = progress.totalPasses - 1; // 0-indexed

      if (focusIndex >= 0 && focusIndex < musicStems.length) {
        const focusStem = musicStems[focusIndex];
        // Мьютим все musicStems кроме фокусного
        musicStems.forEach(id => {
          actions.push({ tool: 'set_stem_volume', args: { stemId: id, volume: id === focusStem ? 1.0 : 0 } });
        });
        // Вокал всегда играет
        vocalStems.forEach(id => {
          actions.push({ tool: 'set_stem_volume', args: { stemId: id, volume: 1.0 } });
        });
      }

      return actions;
    },
    isComplete: (progress) => {
      const stemState = useStemStore.getState();
      const loaded = stemState.loadedStems || [];
      const musicStems = loaded.filter(id =>
        id !== 'vocals' && id !== 'backing' && id !== 'instrumental'
      );
      return progress.totalPasses >= musicStems.length;
    },
    onCompleteActions: () => {
      const stemState = useStemStore.getState();
      const loaded = stemState.loadedStems || [];
      const actions: PracticeAction[] = [];

      loaded.forEach(id => {
        if (id !== 'instrumental') {
          actions.push({ tool: 'set_stem_volume', args: { stemId: id, volume: 1.0 } });
        }
      });
      actions.push({ tool: 'loop_section', args: { enabled: false } });

      return actions;
    },
    restoreActions: (snapshot) => {
      const stemState = useStemStore.getState();
      const loaded = stemState.loadedStems || [];
      const actions: PracticeAction[] = [];

      loaded.forEach(id => {
        if (id !== 'instrumental') {
          const vol = snapshot.stemVolumes?.[id] ?? 1.0;
          actions.push({ tool: 'set_stem_volume', args: { stemId: id, volume: vol } });
        }
      });

      return actions;
    },
  } satisfies PracticeScenario,

  'section-breakdown': {
    id: 'section-breakdown',
    title: 'Разбор по секциям',
    icon: '🗺',
    meta: {
      startRate: 1.0,
      step: 0,
      targetRate: 1.0,
      totalPasses: 0, // dynamic — depends on block count
    },
    startActions: (_ctx) => {
      const blocks = useBlocksStore.getState().blocks || [];
      const firstBlock = blocks[0];
      if (!firstBlock) return [];
      return [
        { tool: 'seek_to_section', args: { sectionType: firstBlock.type, occurrence: 1 } },
        { tool: 'loop_section', args: { sectionType: firstBlock.type, enabled: true } },
      ];
    },
    perPassActions: (_ctx, progress) => {
      const blocks = useBlocksStore.getState().blocks || [];
      const nextIndex = progress.totalPasses;
      const nextBlock = blocks[nextIndex];
      if (!nextBlock) return [];
      return [
        { tool: 'seek_to_section', args: { sectionType: nextBlock.type } },
        { tool: 'loop_section', args: { sectionType: nextBlock.type, enabled: true } },
      ];
    },
    isComplete: (progress) => {
      const blocks = useBlocksStore.getState().blocks || [];
      return progress.totalPasses >= blocks.length;
    },
    onCompleteActions: [
      { tool: 'loop_section', args: { enabled: false } },
    ],
    restoreActions: (snapshot) => snapshot.hadLoop
      ? []
      : [{ tool: 'loop_section', args: { enabled: false } }],
  } satisfies PracticeScenario,
};

export function getScenario(id: PracticeScenarioId): PracticeScenario | undefined {
  return SCENARIOS[id];
}

/** Русские названия типов блоков — единый маппинг */
export const BLOCK_TYPE_NAMES: Record<string, string> = {
  intro: 'Вступление',
  verse: 'Куплет',
  prechorus: 'Пре-хорус',
  chorus: 'Припев',
  bridge: 'Бридж',
  interlude: 'Интерлюдия',
  outro: 'Заключение',
  unknown: '???',
};

/** Построить русскую структурную формулу */
export function getRussianStructureFormula(blocks: { type: string }[] | null): string {
  if (!blocks || blocks.length === 0) return '';
  return blocks.map(b => BLOCK_TYPE_NAMES[b.type] || b.type).join(' → ');
}

/** Сценарии которые РЕАЛИЗОВАНЫ и доступны в runtime */
export const AVAILABLE_SCENARIO_IDS: readonly PracticeScenarioId[] = [
  'bpm-ramp',
  'focus-mix',
  'section-breakdown',
] as const;

/** Проверка доступности сценария */
export function isScenarioAvailable(id: string): boolean {
  return (AVAILABLE_SCENARIO_IDS as readonly string[]).includes(id);
}

/** Получить все доступные сценарии */
export function getAvailableScenarios(): PracticeScenarioId[] {
  return [...AVAILABLE_SCENARIO_IDS];
}

export function getScenarioOptions(ctx: PracticeContext): {
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

/** Smart scenario suggestions based on track structure */
export interface ScenarioSuggestion {
  id: PracticeScenarioId;
  target: string;
  label: string;
  reason: string;
}

export function suggestScenarios(
  blocks: { type: string }[]
): ScenarioSuggestion[] {
  const suggestions: ScenarioSuggestion[] = [];
  const hasChorus = blocks.some(b => b.type === 'chorus');
  const hasVerse = blocks.some(b => b.type === 'verse');
  const blockCount = blocks.length;

  // bpm-ramp — проверяем через реестр
  if (hasChorus && isScenarioAvailable('bpm-ramp')) {
    suggestions.push({
      id: 'bpm-ramp',
      target: 'chorus',
      label: '🔥 Разогнать припев',
      reason: 'Припев — самое энергичное место, идеально для разгона темпа',
    });
  }

  if (!hasChorus && hasVerse && isScenarioAvailable('bpm-ramp')) {
    suggestions.push({
      id: 'bpm-ramp',
      target: 'verse',
      label: '🔥 Разогнать куплет',
      reason: 'Разгон темпа для проработки',
    });
  }

  // focus-mix — проверяем через реестр
  if (hasVerse && isScenarioAvailable('focus-mix')) {
    suggestions.push({
      id: 'focus-mix',
      target: 'verse',
      label: '🎚 Разобрать стемы куплета',
      reason: 'Куплет — хорошее место чтобы услышать каждую партию отдельно',
    });
  }

  // section-breakdown — проверяем через реестр
  if (blockCount >= 5 && isScenarioAvailable('section-breakdown')) {
    suggestions.push({
      id: 'section-breakdown',
      target: 'all',
      label: '🗺 Пройти весь трек',
      reason: `${blockCount} секций — пройдём по порядку`,
    });
  }

  // Limit to 4 suggestions max
  return suggestions.slice(0, 4);
}
