/**
 * Billy Skill System — типовая архитектура
 * v1.0: только Скаут (catalog-empty), остальные заглушки на v3.0
 */

export type BillyZone =
  | 'catalog-empty'
  | 'catalog-ready'
  | 'rehearsal'
  | 'karaoke'
  | 'live';

export interface BillySkill {
  zone: BillyZone;
  systemPrompt: string;
  contextBuilder: () => string;
  temperature: number;
  maxTokens: number;
}

export interface BillyContext {
  zone: BillyZone;
  userName: string;
  isGuest: boolean;
  tracksCount: number;
  currentTrackTitle: string | null;
  currentMode: string;
  onboardingStep: number;
}
