/**
 * beLive AudioEngine v2 — Full Activation.
 * Patches all v1 methods on existing window.audioEngine → v2.
 * Cached refs (app.audioEngine, BLC.audioEngine) auto-see v2.
 */
import { patchV1WithV2 } from './compat/patchV1';

let _v2: any = null;

export function tryActivateV2(): boolean {
  const ae = (window as any).audioEngine;
  if (!ae) {
    console.warn('⚠️ v2: audioEngine not found yet');
    return false;
  }

  if (_v2) {
    console.log('✅ v2 already active');
    return true;
  }

  try {
    _v2 = patchV1WithV2(ae);
    console.log('✅ AudioEngine v2 FULL PATCH active');
    return true;
  } catch (err) {
    console.error('❌ v2 activation failed:', err);
    return false;
  }
}

export function getV2Engine() { return _v2; }
