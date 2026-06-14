// @TC-088: Auth middleware — проверка ALLOWED_TG_IDS (Замок 1)

export function isAllowedUser(msg: any, allowedIds: string): boolean {
  if (!msg?.from?.id) return false;
  const ids = allowedIds.split(',').map(s => s.trim());
  return ids.includes(String(msg.from.id));
}

export function getUserId(msg: any): number {
  return msg.from?.id || 0;
}
