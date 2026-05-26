/**
 * Practice Messages — Deterministic message builder
 * Messages built from confirmed ToolCallResults, not AI text.
 */

import type { PracticeStepResult } from './billy-action-runner';

export function buildStartMessage(
  stepResults: PracticeStepResult[],
  blockLabel: string,
  scenarioId?: string
): string {
  const parts: string[] = [];
  const seekOk = stepResults.find(r => r.action.tool === 'seek_to_section' && r.result.success);
  const loopOk = stepResults.find(r => r.action.tool === 'loop_section' && r.result.success);
  const rateOk = stepResults.find(r => r.action.tool === 'set_playback_rate' && r.result.success);

  if (seekOk) parts.push(`Перемотка к ${blockLabel} ✓`);
  if (loopOk) parts.push(`${blockLabel} на повторе ✓`);
  if (rateOk) {
    const pct = Math.round((rateOk.action.args.rate as number) * 100);
    parts.push(`Темп ${pct}% ✓`);
  }

  if (parts.length === 0) return '⚠️ Не удалось запустить сценарий';

  // Scenario-specific intro
  if (scenarioId === 'focus-mix') {
    return `🎚 Фокус на стемы: ${blockLabel}\n${parts.join('\n')}\n\nНачнём с полного микса — потом по кругу будешь слышать вокал + каждый инструмент по очереди. Авто-переключение каждый круг!`;
  }

  if (scenarioId === 'section-breakdown') {
    return `🗺 Разбор по секциям\n${parts.join('\n')}\n\nПройдём все секции по порядку. Авто-переход каждый круг.`;
  }

  // Default: bpm-ramp
  return `🔥 Разгон ${blockLabel} начат!\n${parts.join('\n')}\n\nЖми "Следующий круг", когда готов ускориться.`;
}

export function buildErrorMessage(failedStep: PracticeStepResult): string {
  const labels: Record<string, string> = {
    'seek_to_section': 'перемотать к блоку',
    'loop_section': 'поставить повтор',
    'set_playback_rate': 'изменить темп',
  };
  const label = labels[failedStep.action.tool] || 'выполнить действие';
  return `⚠️ Не удалось ${label}. Попробуй ещё раз или настрой вручную.`;
}
