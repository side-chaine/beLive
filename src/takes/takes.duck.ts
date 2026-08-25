/**
 * Единый helper duck/restore для takes-флоу (V3-aware).
 * Pаттерн takes.time.ts: единая точка V3-aware аудио-логики тейков.
 *
 * Маршрутизация:
 *  - v3 + stems: snapshot bus volumes → setBusVolume(0); restore → setBusVolume(snapshot)
 *  - v3 + no-stems: muteStem('instrumental', true/false)
 *  - v2 / no pipeline: legacy ae.set*Volume(0) + restore from stem volumes
 */
export interface DuckHandle {
  restore(): void;
}

export function duckProgram(opts?: {
  buses?: Array<'music-bus' | 'vocal-bus'>;
  rampMs?: number;
}): DuckHandle | null {
  const buses = opts?.buses ?? ['music-bus', 'vocal-bus'];

  // v3 + stems
  if (
    (window as any).__v3Active &&
    (window as any).__belive?.pipeline &&
    (window as any).__belive?.stemOrchestrator?.all?.()?.length > 0
  ) {
    const p = (window as any).__belive.pipeline;
    const snapshot: Record<string, number> = {};
    for (const bus of buses) {
      snapshot[bus] = p.getBusVolume(bus);
      p.setBusVolume(bus, 0);
    }
    console.log('[TAKES-DUCK] v3+stems duck', snapshot);
    return {
      restore() {
        for (const bus of buses) {
          p.setBusVolume(bus, snapshot[bus] ?? 1);
        }
        console.log('[TAKES-DUCK] v3+stems restore', snapshot);
      },
    };
  }

  // v3 + no-stems
  if (
    (window as any).__v3Active &&
    (window as any).__belive?.pipeline
  ) {
    const p = (window as any).__belive.pipeline;
    p.muteStem('instrumental', true);
    console.log('[TAKES-DUCK] v3+no-stems duck');
    return {
      restore() {
        p.muteStem('instrumental', false);
        console.log('[TAKES-DUCK] v3+no-stems restore');
      },
    };
  }

  // v2 / no pipeline
  if ((window as any).__v3Active === false) {
    const ae = (window as any).audioEngine;
    if (!ae) return null;
    // snapshot current V2 stem volumes
    const snapInst = typeof ae.getStemVolume === 'function' ? ae.getStemVolume('instrumental') : 1;
    const snapVoc = typeof ae.getStemVolume === 'function' ? ae.getStemVolume('vocals') : 1;
    ae.setInstrumentalVolume?.(0);
    ae.setVocalsVolume?.(0);
    console.log('[TAKES-DUCK] v2 duck');
    return {
      restore() {
        ae.setInstrumentalVolume?.(snapInst);
        ae.setVocalsVolume?.(snapVoc);
        console.log('[TAKES-DUCK] v2 restore');
      },
    };
  }

  return null;
}
