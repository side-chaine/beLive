/**
 * Журнал очереди MVSEP — сырьё для разбора «в какие часы быстрее».
 *
 * Поллинг и так получает `current_order` / `queue_count` на каждом опросе, но
 * до сих пор выбрасывал их после отрисовки. Здесь они оседают в localStorage
 * кольцом на LIMIT записей: перезагрузка страницы журнал не стирает, поэтому
 * через несколько прогонов видно реальную скорость очереди по часам.
 *
 * Журнал не влияет на поллинг: любая ошибка записи (квота, приватный режим,
 * битый JSON) глушится. Нет localStorage — просто ничего не пишем.
 */

const KEY = 'belive.mvsep.queue.log.v1';
const LIMIT = 500;

export interface QueueSample {
  /** Когда получен ответ. */
  at: number;
  hash: string;
  /** Статус, который вернул MVSEP: waiting / processing / distributing… */
  status: string;
  /** Позиция и размер очереди — если MVSEP их честно отдал. */
  pos?: number;
  total?: number;
  poll: number;
  /** Сколько секунд джоба живёт всего. */
  elapsedSec: number;
  /** Сколько секунд прошло с последнего честного ответа. */
  silenceSec: number;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // приватный режим/запрет доступа
  }
}

export function recordQueueSample(sample: QueueSample): void {
  const store = storage();
  if (!store) {return;}
  try {
    const raw = store.getItem(KEY);
    let list: QueueSample[] = [];
    if (raw) {
      // Битое значение не должно блокировать журнал навсегда: начинаем заново.
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {list = parsed as QueueSample[];}
      } catch {
        list = [];
      }
    }
    store.setItem(KEY, JSON.stringify(list.concat(sample).slice(-LIMIT)));
  } catch {
    // Журнал — не критичный путь: поллинг из-за него падать не должен.
  }
}

export function readQueueLog(): QueueSample[] {
  const store = storage();
  if (!store) {return [];}
  try {
    const raw = store.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueueSample[]) : [];
  } catch {
    return [];
  }
}

export function clearQueueLog(): void {
  const store = storage();
  if (!store) {return;}
  try {
    store.removeItem(KEY);
  } catch {
    // см. recordQueueSample
  }
}
