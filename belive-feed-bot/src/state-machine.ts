// @TC-088: Draft state machine — хранение черновиков в EPHEMERAL_KV (Замок 2)

export type DraftStep = 'idle' | 'awaiting_title' | 'awaiting_date_price' | 'awaiting_photo' | 'done';

export interface DraftState {
  step: DraftStep;
  type: 'event' | 'poll';
  title: string;
  subtitle?: string;
  description?: string;
  eventDate?: string;
  price?: string;
  coverR2Key?: string;
  pollData?: { options: { id: string; title: string }[] };
  createdAt: number;
}

const DRAFT_TTL = 3600; // 1 hour — защита от зависаний

function draftKey(userId: number): string {
  return `draft:${userId}`;
}

export async function getDraft(kv: KVNamespace, userId: number): Promise<DraftState | null> {
  return kv.get(draftKey(userId), { type: 'json' }) as Promise<DraftState | null>;
}

export async function setDraft(kv: KVNamespace, userId: number, state: DraftState): Promise<void> {
  await kv.put(draftKey(userId), JSON.stringify(state), { expirationTtl: DRAFT_TTL });
}

export async function clearDraft(kv: KVNamespace, userId: number): Promise<void> {
  await kv.delete(draftKey(userId));
}

export function newDraft(type: 'event' | 'poll'): DraftState {
  return {
    step: type === 'event' ? 'awaiting_title' : 'done',
    type,
    title: '',
    createdAt: Date.now(),
  };
}
