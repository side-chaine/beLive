/**
 * Practice Journal — локальные даты (MR-2, этап 2).
 * Чистые функции без IDB: чтобы агрегации не тянули IDB-модуль.
 * day = ЛОКАЛЬНАЯ дата YYYY-MM-DD (никуда не конвертируем в UTC).
 */

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** LOCAL day YYYY-MM-DD (НЕ toISOString). */
export function localDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Сдвиг локального дня на delta суток (через локальный календарь, не UTC). */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + delta));
}
