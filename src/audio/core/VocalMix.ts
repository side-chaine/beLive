/**
 * beLive AudioEngine v2 — VocalMix.
 * Stereo separation: vocals → L, microphone → R, music → both.
 * Used for rehearsal: hear reference vocal in one ear, your voice in other.
 */

import { getAudioContext } from './audioContext';

export class VocalMix {
  readonly merger: ChannelMergerNode;
  private _enabled = false;

  constructor() {
    this.merger = getAudioContext().createChannelMerger(2);
  }

  get enabled(): boolean { return this._enabled; }

  enable(): void { this._enabled = true; }
  disable(): void { this._enabled = false; }

  toggle(): void {
    this._enabled = !this._enabled;
  }

  /**
   * Route audio nodes through merger based on VocalMix state.
   * Call this after enable/disable and after any routing change.
   *
   * @param musicGains - GainNodes of all stems EXCEPT vocals
   * @param vocalsGain - GainNode of vocals stem (may be null)
   * @param micGain - GainNode of microphone (may be null)
   * @param destination - Final output (usually audioContext.destination)
   */
  updateRouting(
    musicGains: GainNode[],
    vocalsGain: GainNode | null,
    micGain: GainNode | null,
    destination: AudioNode
  ): void {
    // Disconnect merger from previous destination
    try { this.merger.disconnect(); } catch (_) {}

    // Disconnect all inputs from merger
    musicGains.forEach(g => { try { g.disconnect(); } catch (_) {} });
    if (vocalsGain) try { vocalsGain.disconnect(); } catch (_) {}
    if (micGain) try { micGain.disconnect(); } catch (_) {}

    // Connect merger to destination
    this.merger.connect(destination);

    if (this._enabled) {
      // VocalMix ON: stereo separation
      // Music → both channels
      musicGains.forEach(g => {
        g.connect(this.merger, 0, 0); // L
        g.connect(this.merger, 0, 1); // R
      });
      // Vocals → left only
      if (vocalsGain) {
        vocalsGain.connect(this.merger, 0, 0);
      }
      // Microphone → right only
      if (micGain) {
        micGain.connect(this.merger, 0, 1);
      }
    } else {
      // VocalMix OFF: standard routing (all → both channels)
      musicGains.forEach(g => {
        g.connect(this.merger, 0, 0);
        g.connect(this.merger, 0, 1);
      });
      if (vocalsGain) {
        vocalsGain.connect(this.merger, 0, 0);
        vocalsGain.connect(this.merger, 0, 1);
      }
      if (micGain) {
        micGain.connect(this.merger, 0, 0);
        micGain.connect(this.merger, 0, 1);
      }
    }
  }

  dispose(): void {
    try { this.merger.disconnect(); } catch (_) {}
    this._enabled = false;
  }
}
