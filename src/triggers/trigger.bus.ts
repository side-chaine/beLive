import type { TriggerEvent, TriggerCallback, TriggerSignalId } from './trigger.types';

class TriggerBus {
  private _idListeners = new Map<string, Set<TriggerCallback>>();
  private _anyListeners = new Set<TriggerCallback>();

  on(signalId: TriggerSignalId, cb: TriggerCallback): () => void {
    let set = this._idListeners.get(signalId);
    if (!set) {
      set = new Set();
      this._idListeners.set(signalId, set);
    }
    set.add(cb);
    return () => { set!.delete(cb); };
  }

  onAny(cb: TriggerCallback): () => void {
    this._anyListeners.add(cb);
    return () => { this._anyListeners.delete(cb); };
  }

  emit(event: TriggerEvent): void {
    const idSet = this._idListeners.get(event.id);
    if (idSet) idSet.forEach(cb => cb(event));
    this._anyListeners.forEach(cb => cb(event));
  }

  clear(): void {
    this._idListeners.clear();
    this._anyListeners.clear();
  }
}

export const triggerBus = new TriggerBus();
