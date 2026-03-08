/**
 * Main-thread YIN pitch detector.
 * Same algorithm as yin-processor.js but runs on main thread
 * via AnalyserNode.getFloatTimeDomainData().
 *
 * Used for vocal track detection (passive, no audio impact).
 * Mic still uses AudioWorklet (doesn't affect speaker output).
 */

export interface YinResult {
  frequency: number;
  confidence: number;
  midi: number;
  rms: number;

  /** 0..1 — strength of subharmonic (F0/2) relative to fundamental */
  subharmonicRatio: number;
  /** Hz — estimated subharmonic frequency (F0/2) when ratio is meaningful */
  subFrequency: number | null;
  /** MIDI — estimated subharmonic MIDI when ratio is meaningful */
  subMidi: number | null;
  /** 0..1 — composite distortion depth proxy */
  depth: number;
  /** 0..1 — subharmonic strength (growl/false-cord family) */
  subScore: number;
  /** 0..1 — aperiodicity/noise proxy (scream/rasp family) */
  noiseScore: number;
}

export class YinDetector {
  private _threshold = 0.15;
  private _gate = 0.01;
  private _tauMin = 11;
  private _cmnd: Float32Array;

  /* Octave lock (Level 2) */
  private _prevFreq = 0;

  /* Vocal range (Level 3) */
  private _lo = 75;
  private _hi = 1200;
  private _calBuf: number[] = [];
  private _calDone = false;

  /* Median filter */
  private _medW: number;
  private _medBuf: Float32Array;
  private _medIdx = 0;
  private _medN = 0;

  constructor(bufferSize = 2048, medianWindow = 5) {
    const tauMax = bufferSize >>> 1;
    this._cmnd = new Float32Array(tauMax + 1);
    this._medW = medianWindow;
    this._medBuf = new Float32Array(medianWindow);
  }

  reset(): void {
    this._prevFreq = 0;
    this._medIdx = 0;
    this._medN = 0;
    this._calBuf = [];
    this._calDone = false;
  }

  detect(buffer: any, sampleRate: number): YinResult | null {
    const N = buffer.length;
    const halfN = N >>> 1;
    const tauMax = halfN;
    const cmnd = this._cmnd;

    /* Step 0: noise gate */
    let ssq = 0;
    for (let i = 0; i < N; i++) ssq += buffer[i] * buffer[i];
    const rms = Math.sqrt(ssq / N);
    if (rms < this._gate) {
      this._prevFreq = 0;
      return null;
    }

    /* Steps 1+2: difference + CMND */
    cmnd[0] = 1;
    let rsum = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      let diff = 0;
      for (let j = 0; j < halfN; j++) {
        const d = buffer[j] - buffer[j + tau];
        diff += d * d;
      }
      rsum += diff;
      cmnd[tau] = rsum === 0 ? 1 : (diff * tau / rsum);
    }

    /* Step 3: absolute threshold (with fallback min CMND) */
    let te = -1;
    let minTau = this._tauMin;
    let minVal = cmnd[minTau];

    for (let tau = this._tauMin; tau < tauMax; tau++) {
      const v = cmnd[tau];
      if (v < minVal) {
        minVal = v;
        minTau = tau;
      }

      if (te === -1 && v < this._threshold) {
        while (tau + 1 < tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
        te = tau;
        break;
      }
    }

    /* If no tau below threshold, treat as "no_pitch" but still compute depth */
    if (te === -1) {
      te = minTau;
    }

    /* Step 4: parabolic interpolation */
    let bt = te;
    if (te > 0 && te < tauMax) {
      const s0 = cmnd[te - 1], s1 = cmnd[te], s2 = cmnd[te + 1];
      const dn = 2 * s1 - s2 - s0;
      if (dn !== 0) bt = te + (s2 - s0) / (2 * dn);
    }

    let freq = sampleRate / bt;
    const conf = 1 - cmnd[te];

    /* ── Distortion MVP-0: subharmonics + depth (proxy) ──
       YIN already computed CMND for all tau values.
       Fundamental strength ~= 1 - cmnd[T0]
       Subharmonic (F0/2) strength ~= 1 - cmnd[2*T0] (if in range)
    */
    let subharmonicRatio = 0;
    let subFrequency: number | null = null;
    let subMidi: number | null = null;

    const twoTe = te * 2;
    if (twoTe <= tauMax) {
      const fundStrength = conf; // = 1 - cmnd[te]
      const subStrength = 1 - cmnd[twoTe];
      if (fundStrength > 0) {
        subharmonicRatio = Math.max(0, Math.min(1, subStrength / fundStrength));
      }
    }

    const aperiodicity = cmnd[te]; // 0..1, higher = noisier / more chaotic
    const noiseProxy = Math.max(0, Math.min(1, (aperiodicity - 0.18) / 0.42));
    const depth = Math.max(0, Math.min(1, 0.8 * subharmonicRatio + 0.2 * noiseProxy));

    const subScore = subharmonicRatio;
    const noiseScore = noiseProxy;

    /* Level 2: temporal octave lock */
    freq = this._octLock(freq, conf);

    /* Level 3: vocal range clamp */
    freq = this._rangeClamp(freq);

    /* Median filter */
    freq = this._median(freq);

    /* Auto-calibrate */
    if (!this._calDone && conf > 0.7) {
      this._calBuf.push(freq);
      if (this._calBuf.length >= 50) this._autoCal();
    }

    const midi = 12 * Math.log2(freq / 440) + 69;

    if (subharmonicRatio > 0.2) {
      subFrequency = freq / 2;
      subMidi = midi - 12;
    }

    return {
      frequency: freq,
      confidence: conf,
      midi,
      rms,
      subharmonicRatio,
      subFrequency,
      subMidi,
      depth,
      subScore,
      noiseScore,
    };
  }

  private _octLock(f: number, c: number): number {
    if (this._prevFreq > 0 && c < 0.85) {
      const r = f / this._prevFreq;
      if (r > 1.8 && r < 2.2) f /= 2;
      else if (r > 0.45 && r < 0.55) f *= 2;
      else if (r > 1.4 && r < 1.6 && c < 0.80) f /= 1.5;
    }
    this._prevFreq = f;
    return f;
  }

  private _rangeClamp(f: number): number {
    while (f > 0 && f < this._lo) f *= 2;
    while (f > this._hi) f /= 2;
    return f;
  }

  private _median(f: number): number {
    this._medBuf[this._medIdx] = f;
    this._medIdx = (this._medIdx + 1) % this._medW;
    if (this._medN < this._medW) this._medN++;
    const a: number[] = [];
    for (let i = 0; i < this._medN; i++) {
      if (this._medBuf[i] > 0) a.push(this._medBuf[i]);
    }
    if (a.length === 0) return f;
    a.sort((x, y) => x - y);
    return a[a.length >>> 1];
  }

  private _autoCal(): void {
    const s = this._calBuf.slice().sort((a, b) => a - b);
    const med = s[s.length >>> 1];
    if (med < 200) { this._lo = 75; this._hi = 600; }
    else { this._lo = 150; this._hi = 1200; }
    this._calDone = true;
  }
}
