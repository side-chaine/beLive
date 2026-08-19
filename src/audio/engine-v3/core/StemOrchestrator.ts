import { StemPlayerV3 } from '../stems/StemPlayerV3';
import { computeCanonicalLoop } from '../integration/LoopEngineV3';
import type { StemId } from './types';

export interface StemOrchestratorOptions {
  ctx: AudioContext;
  /** e.g. 'instrumental' — mirrors the old FR-004 convention of one designated master stem. */
  masterClockStemId: StemId;
  onTrackEnded: () => void;
}

export class StemOrchestrator {
  private readonly ctx: AudioContext;
  private readonly masterClockStemId: StemId;
  private readonly onTrackEnded: () => void;
  private readonly stems = new Map<StemId, StemPlayerV3>();
  private _programOut: AudioNode | null = null;
  private _vocalHall: AudioNode | null = null;

  constructor(opts: StemOrchestratorOptions) {
    this.ctx = opts.ctx;
    this.masterClockStemId = opts.masterClockStemId;
    this.onTrackEnded = opts.onTrackEnded;
  }

  /** Установить выходы MonitorRouter (TC-2C). Разрешаем повторный вызов — для переключения V2↔V3 */
  setOutputRouting(programMix: AudioNode, vocalHall?: AudioNode): void {
    // Разрешаем повторный вызов — для переключения V2↔V3
    if (this._programOut) {
      // Переподключаем существующие стемы на новый output
      for (const stem of this.stems.values()) {
        try { stem.outputNode.disconnect() } catch {}
        stem.outputNode.connect(programMix)
      }
    }
    this._programOut = programMix
    this._vocalHall = vocalHall ?? null
  }

  addStem(id: StemId, buffer: AudioBuffer): StemPlayerV3 {
    this.stems.get(id)?.dispose();
    const stem = new StemPlayerV3({
      id,
      ctx: this.ctx,
      isMasterClock: id === this.masterClockStemId,
      onNaturalEnd: () => this.onTrackEnded(),
    });
    stem.setBuffer(buffer);
    // TC-2C: stems подключаются к Router (или destination если Router не установлен)
    stem.outputNode.connect(this._programOut ?? this.ctx.destination)
    if (id === 'vocals' && this._vocalHall) stem.outputNode.connect(this._vocalHall)
    this.stems.set(id, stem);
    return stem;
  }

  get(id: StemId): StemPlayerV3 | undefined {
    return this.stems.get(id);
  }

  all(): StemPlayerV3[] {
    return Array.from(this.stems.values());
  }

  /** Duration is defined by the master-clock stem, matching the old V2 convention. */
  get duration(): number {
    return this.stems.get(this.masterClockStemId)?.duration ?? 0;
  }

  /**
   * Starts every stem whose OWN duration covers `offset`, re-checked fresh on every
   * call. Never gate this on a cached "stem N already ended" flag from a previous
   * position — that shortcut is exactly what reproduces "seek back after a short
   * stem naturally ended, it stays silent forever" (each stem's shouldPlayAt() is the
   * single source of truth, always evaluated against the CURRENT offset).
   */
  playAllAt(targetStartCtxTime: number, offset: number, rate: number): void {
    for (const stem of this.stems.values()) {
      if (stem.shouldPlayAt(offset)) {
        stem.startAt(targetStartCtxTime, offset, rate);
      }
    }
  }

  /** Доступ для PitchChain.attachStems — нужно знать, куда были подключены степы. */
  get programOut(): AudioNode | null {
    return this._programOut;
  }
  get vocalHall(): AudioNode | null {
    return this._vocalHall;
  }

  pauseAll(): void {
    for (const stem of this.stems.values()) stem.pause();
  }

  /** Derives ONE canonical loop duration from the master-clock stem, applies it to every stem. */
  setLoopOnAllStems(requestedStart: number, requestedEnd: number): void {
    const master = this.stems.get(this.masterClockStemId);
    const masterBuffer = master?.getBuffer();
    if (!master || !masterBuffer) return;

    const channels: Float32Array[] = [];
    for (let c = 0; c < masterBuffer.numberOfChannels; c++) {
      channels.push(masterBuffer.getChannelData(c));
    }

    const canonical = computeCanonicalLoop(channels, requestedStart, requestedEnd, masterBuffer.sampleRate);
    for (const stem of this.stems.values()) stem.setLoop(canonical.start, canonical.end);
  }

  clearLoopOnAllStems(): void {
    for (const stem of this.stems.values()) stem.clearLoop();
  }

  disposeAll(): void {
    for (const stem of this.stems.values()) stem.dispose();
    this.stems.clear();
  }
}
