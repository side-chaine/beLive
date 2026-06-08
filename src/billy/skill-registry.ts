import { BillySkill, BillyZone } from './types';
import { scoutSkill } from './skills/scout.skill';
import { buildBillyContext, resolveZone } from './context-builder';

// Реестр скиллов — только Скаут реализован полностью
const SKILLS: Partial<Record<BillyZone, BillySkill>> = {
  'catalog-empty': scoutSkill,
  // Остальные — заглушки на v3.0
};

export function getActiveSkill(): BillySkill {
  const ctx = buildBillyContext();
  const zone = resolveZone(ctx);
  return SKILLS[zone] || scoutSkill;
}

export function buildSystemPrompt(skill: BillySkill): string {
  const context = skill.contextBuilder();
  return `${skill.systemPrompt}\n\n== КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ ==\n${context}`;
}
