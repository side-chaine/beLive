/**
 * YIN Pitch Detection — AudioWorkletProcessor
 * Self-contained (no imports). Runs in audio thread.
 *
 * Pipeline per analysis frame (2048 samples):
 *   Noise gate → Difference → CMND → Threshold → Parabolic interp
 *   → Octave lock (temporal) → Range clamp → Median filter → postMessage
 *
 * Analysis rate: ~21.5 Hz (44100/2048)
 * CPU cost: ~2% audio thread
 */

/* ─── Processor ──────────────────────────────────── */
class YinProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    /* Buffer (accumulate 128-sample chunks → 2048) */
    this._size = 2048;
    this._buf = new Float32Array(this._size);
    this._pos = 0;

    /* YIN params */
    this._threshold = 0.15;
    this._gate = 0.01;
    this._tauMin = 11;           /* sr/4000 Hz */
    this._tauMax = this._size >>> 1; /* 1024 */
    this._cmnd = new Float32Array(this._tauMax + 1);

    /* Octave lock (Level 2) */
    this._prevFreq = 0;

    /* Vocal range (Level 3) */
    this._lo = 75;
    this._hi = 1200;
    this._calBuf = [];
    this._calDone = false;

    /* Median filter */
    this._medW = 5;
    this._medBuf = new Float32Array(this._medW);
    this._medIdx = 0;
    this._medN = 0;

    /* Message channel */
    this.port.onmessage = (e) => this._onMsg(e.data);
    this.port.postMessage({ type: 'ready' });
  }

  /* ── Message handling ──────────────────────────── */

  _onMsg(m) {
    if (m.type === 'config') {
      if (m.threshold != null) this._threshold = m.threshold;
      if (m.noiseGate != null) this._gate = m.noiseGate;
      if (m.rangeLow != null)  this._lo = m.rangeLow;
      if (m.rangeHigh != null) this._hi = m.rangeHigh;
      if (m.medianWindow != null) {
        this._medW = m.medianWindow;
        this._medBuf = new Float32Array(this._medW);
        this._medIdx = 0;
        this._medN = 0;
      }
    } else if (m.type === 'reset') {
      this._pos = 0;
      this._prevFreq = 0;
      this._medIdx = 0;
      this._medN = 0;
      this._calBuf = [];
      this._calDone = false;
    }
  }

  /* ── Audio processing ──────────────────────────── */

  process(inputs) {
    var ch = inputs[0] && inputs[0][0];
    if (!ch) return true;

    for (var i = 0; i < ch.length; i++) {
      this._buf[this._pos++] = ch[i];
      if (this._pos >= this._size) {
        this._pos = 0;
        this._analyze();
      }
    }
    return true;
  }

  /* ── YIN core ──────────────────────────────────── */

  _analyze() {
    var buf = this._buf;
    var N = this._size;
    var half = N >>> 1;
    var sr = sampleRate;

    /* Step 0: noise gate */
    var ssq = 0;
    for (var i = 0; i < N; i++) ssq += buf[i] * buf[i];
    var rms = Math.sqrt(ssq / N);
    if (rms < this._gate) {
      this.port.postMessage({ type: 'silence', rms: rms });
      this._prevFreq = 0;
      return;
    }

    /* Steps 1+2: difference + CMND (single pass) */
    var cmnd = this._cmnd;
    cmnd[0] = 1.0;
    var rsum = 0;

    for (var tau = 1; tau <= this._tauMax; tau++) {
      var diff = 0;
      for (var j = 0; j < half; j++) {
        var d = buf[j] - buf[j + tau];
        diff += d * d;
      }
      rsum += diff;
      cmnd[tau] = rsum === 0 ? 1.0 : (diff * tau / rsum);
    }

    /* Step 3: absolute threshold — first dip below 0.15 */
    var te = -1;
    for (var tau = this._tauMin; tau < this._tauMax; tau++) {
      if (cmnd[tau] < this._threshold) {
        while (tau + 1 < this._tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
        te = tau;
        break;
      }
    }
    if (te === -1) {
      this.port.postMessage({ type: 'no_pitch', rms: rms });
      return;
    }

    /* Step 4: parabolic interpolation */
    var bt = te;
    if (te > 0 && te < this._tauMax) {
      var s0 = cmnd[te - 1], s1 = cmnd[te], s2 = cmnd[te + 1];
      var dn = 2 * s1 - s2 - s0;
      if (dn !== 0) bt = te + (s2 - s0) / (2 * dn);
    }

    /* Step 5: frequency + confidence */
    var freq = sr / bt;
    var conf = 1.0 - cmnd[te];

    /* Level 2: temporal octave lock */
    freq = this._octLock(freq, conf);

    /* Level 3: vocal range clamp */
    freq = this._rangeClamp(freq);

    /* Median filter */
    freq = this._median(freq);

    /* Auto-calibrate after 50 confident detections */
    if (!this._calDone && conf > 0.7) {
      this._calBuf.push(freq);
      if (this._calBuf.length >= 50) this._autoCal();
    }

    this.port.postMessage({
      type: 'pitch',
      frequency: freq,
      confidence: conf,
      rms: rms,
      midi: 12 * Math.log2(freq / 440) + 69,
      timestamp: currentTime,
    });
  }

  /* ── Octave lock (Level 2) ─────────────────────── */

  _octLock(f, c) {
    if (this._prevFreq > 0 && c < 0.85) {
      var r = f / this._prevFreq;
      if      (r > 1.8 && r < 2.2)               f /= 2;
      else if (r > 0.45 && r < 0.55)             f *= 2;
      else if (r > 1.4 && r < 1.6 && c < 0.80)   f /= 1.5;
    }
    this._prevFreq = f;
    return f;
  }

  /* ── Range clamp (Level 3) ─────────────────────── */

  _rangeClamp(f) {
    while (f > 0 && f < this._lo) f *= 2;
    while (f > this._hi)          f /= 2;
    return f;
  }

  /* ── Median filter ─────────────────────────────── */

  _median(f) {
    this._medBuf[this._medIdx] = f;
    this._medIdx = (this._medIdx + 1) % this._medW;
    if (this._medN < this._medW) this._medN++;

    var a = [];
    for (var i = 0; i < this._medN; i++) {
      if (this._medBuf[i] > 0) a.push(this._medBuf[i]);
    }
    if (a.length === 0) return f;
    a.sort(function(x, y) { return x - y; });
    return a[a.length >>> 1];
  }

  /* ── Auto-calibrate vocal range ────────────────── */

  _autoCal() {
    var s = this._calBuf.slice().sort(function(a, b) { return a - b; });
    var med = s[s.length >>> 1];
    if (med < 200) { this._lo = 75;  this._hi = 600;  }
    else           { this._lo = 150; this._hi = 1200; }
    this._calDone = true;
  }
}

registerProcessor('yin-processor', YinProcessor);
