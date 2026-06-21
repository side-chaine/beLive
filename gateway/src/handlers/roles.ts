// @TC-103-02: D1 user_roles read/write helpers
// НЕ middleware — утилиты для lookup роли по JWT.sub

interface Env {
  FEED_DB: D1Database;
}

export interface UserRoleRow {
  user_id: string;
  provider: string;
  provider_sub: string;
  role: string;
  email: string | null;
  assigned_by: string;
  assigned_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
}

// Получить роль пользователя по (provider, provider_sub)
export async function getUserRole(
  db: D1Database,
  provider: string,
  providerSub: string
): Promise<string | null> {
  const row = await db.prepare(
    'SELECT role FROM user_roles WHERE provider = ? AND provider_sub = ? AND revoked_at IS NULL'
  ).bind(provider, providerSub).first<{ role: string }>();
  return row?.role ?? null;
}

// Получить роль по user_id (для admin endpoints)
export async function getUserRoleById(
  db: D1Database,
  userId: string
): Promise<string | null> {
  const row = await db.prepare(
    'SELECT role FROM user_roles WHERE user_id = ? AND revoked_at IS NULL'
  ).bind(userId).first<{ role: string }>();
  return row?.role ?? null;
}

// Записать роль (founder bootstrap / admin назначает)
export async function assignRole(
  db: D1Database,
  params: {
    userId: string;
    provider: string;
    providerSub: string;
    role: string;
    email?: string;
    assignedBy: string;
  }
): Promise<void> {
  await db.prepare(
    `INSERT INTO user_roles (user_id, provider, provider_sub, role, email, assigned_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    params.userId,
    params.provider,
    params.providerSub,
    params.role,
    params.email ?? null,
    params.assignedBy
  ).run();
}

// Проверить что founder уже существует (для bootstrap guard)
export async function hasExistingFounder(db: D1Database): Promise<boolean> {
  const row = await db.prepare(
    "SELECT 1 FROM user_roles WHERE role = 'founder' AND revoked_at IS NULL LIMIT 1"
  ).first();
  return !!row;
}
