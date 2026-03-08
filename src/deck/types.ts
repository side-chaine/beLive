import type { ComponentType } from 'react';

/** Application modes */
export type AppMode = 'rehearsal' | 'karaoke' | 'concert' | 'live';

/** Contract for a Deck tab module */
export interface DeckModule {
  /** Unique id — used as tab key and store reference */
  id: string;
  /** Display label for the tab button */
  label: string;
  /** Sort order — lower number = further left */
  order: number;
  /** App modes where this tab is visible */
  modes: AppMode[];
  /** Keep component mounted when tab inactive (default: false) */
  keepAlive?: boolean;
  /** Dynamic import returning component with default export */
  load: () => Promise<{ default: ComponentType }>;
}
