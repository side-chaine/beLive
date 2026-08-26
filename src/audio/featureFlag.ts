/**
 * beLive AudioEngine v2 — Full Activation.
 * Patches all v1 methods on existing window.audioEngine → v2.
 * Cached refs (app.audioEngine, BLC.audioEngine) auto-see v2.
 */
let _v2: any = null;

export function getV2Engine() { return _v2; }
