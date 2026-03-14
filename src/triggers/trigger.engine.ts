import type { TriggerDetector, TriggerEvent } from './trigger.types';
import { triggerBus } from './trigger.bus';

export class TriggerEngine {
  private _detectors: TriggerDetector[] = [];

  addDetector(detector: TriggerDetector): void {
    this._detectors.push(detector);
  }

  removeDetector(detectorId: string): void {
    this._detectors = this._detectors.filter(d => d.id !== detectorId);
  }

  tick(time: number): TriggerEvent[] {
    const allEvents: TriggerEvent[] = [];
    for (const detector of this._detectors) {
      const events = detector.tick(time);
      allEvents.push(...events);
    }
    for (const event of allEvents) {
      triggerBus.emit(event);
    }
    return allEvents;
  }

  resetAll(): void {
    for (const detector of this._detectors) {
      detector.reset();
    }
    triggerBus.emit({
      id: 'trigger-reset',
      type: 'discrete',
      source: 'custom',
      value: 1,
      time: 0,
      metadata: {},
    });
  }

  dispose(): void {
    this._detectors = [];
    triggerBus.clear();
  }
}
