/**
 * MonitorMix (минимальная версия)
 * - enumerateDevices() → список audiooutput
 * - mic → Delay → Gain → MediaStreamDestination → <audio> (sinkId)
 * - опциональный tap музыки от audioEngine.instrumentalGain
 * - testPulse() для проверки задержки
 */
(function(){
    class MonitorMix {
        constructor(audioEngine){
            this.engine = audioEngine;
            this.ctx = audioEngine?.audioContext || new (window.AudioContext||window.webkitAudioContext)({ latencyHint: 'interactive' });
            this.enabled = false;

            // state
            this.delayMs = Number(localStorage.getItem('monitor:delayMs')||120);
            this.compensateOn = localStorage.getItem('monitor:compensateOn') || 'monitor'; // 'monitor' | 'main'
            this.includeMusic = localStorage.getItem('monitor:includeMusic') === 'true';
            this.musicLevel = Number(localStorage.getItem('monitor:musicLevel')||0.15);
            this.outputDeviceId = localStorage.getItem('monitor:deviceId') || '';
            this.mainDeviceId = localStorage.getItem('monitor:mainDeviceId') || '';
            this.routeMainEnabled = localStorage.getItem('monitor:routeMain') === 'true';
            this.vocalToMain = localStorage.getItem('monitor:vocalToMain') === 'true';
            this.vocalHallLevel = Number(localStorage.getItem('monitor:vocalHallLevel')||0.2);
            // Line Up source preference - runtime default only
            this.lineUpSource = 'pulse'; // 'pulse' | 'voc' (UI persists to lineUp:source)
            // авто-подмешивание по блокам
            this.autoVerseOn = localStorage.getItem('monitor:autoVerseOn') === 'true';
            this.autoVerseLevel = Number(localStorage.getItem('monitor:autoVerseLevel')||0.3);
            this.autoChorusOn = localStorage.getItem('monitor:autoChorusOn') === 'true';
            this.autoChorusLevel = Number(localStorage.getItem('monitor:autoChorusLevel')||0.3);
            this.autoBridgeOn = localStorage.getItem('monitor:autoBridgeOn') === 'true';
            this.autoBridgeLevel = Number(localStorage.getItem('monitor:autoBridgeLevel')||0.3);
            this.autoIntroOn = localStorage.getItem('monitor:autoIntroOn') === 'true';
            this.autoIntroLevel = Number(localStorage.getItem('monitor:autoIntroLevel')||0.3);
            this.autoPreChorusOn = localStorage.getItem('monitor:autoPreChorusOn') === 'true';
            this.autoPreChorusLevel = Number(localStorage.getItem('monitor:autoPreChorusLevel')||0.3);
            this.autoOutroOn = localStorage.getItem('monitor:autoOutroOn') === 'true';
            this.autoOutroLevel = Number(localStorage.getItem('monitor:autoOutroLevel')||0.3);

            // nodes
            this.delayNode = this.ctx.createDelay(1.0);
            this.monitorGain = this.ctx.createGain();
            this.musicGain = this.ctx.createGain();
            this.dest = this.ctx.createMediaStreamDestination();
            this.outputEl = null;
            this.vocalToMainGain = this.ctx.createGain();

            // main routing (инструментал → выбранный sink)
            this.mainDest = this.ctx.createMediaStreamDestination();
            this.mainEl = null;
            this.mainDelayNode = null;
            this.micSource = null;

            // split gains for безразрывного переключения
            this._routingReady = false;
            this.defaultBranchGain = null;
            this.mainBranchGain = null;

            // sync test state
            this._syncTestActive = false;
            this._syncInterval = null;
            this.syncGainNode = this.ctx.createGain();

            // pending vocal retry timeout (prevents stale reconnection after disable)
            this._pendingVocalRetry = null;

            // track-switch lifecycle state
            this._trackSwitching = false;
            this._trackLifecycleBound = false;

            // pulse startup guard token
            this._pulseStartupToken = null;
            
            // pulse session vocal isolation snapshot (runtime-only, not persisted)
            this._pulseSessionSnapshot = null;

            // ===== PULSE DIAGNOSTIC FIELDS (TEMPORARY) =====
            this._pulseDiagEnabled = false;
            this._pulseDiagDirectMain = false;
            this._lastPulseTime = 0;
            this._pulseStartTime = 0;

            // Precise pulse scheduling state
            this._pulseScheduleTimer = null;
            this._nextPulseTime = 0;

            this.setDelayMs(this.delayMs);
            this.musicGain.gain.value = this.includeMusic ? this.musicLevel : 0;
            this.vocalToMainGain.gain.value = this.vocalToMain ? this.vocalHallLevel : 0;
            this._bindBlockAutoMix();
            this._bindTrackLifecycle();
        }

        async ensureOutputEl(){
            if (this.outputEl) return this.outputEl;
            const el = document.createElement('audio');
            el.autoplay = true; el.muted = false; el.playsInline = true; el.srcObject = this.dest.stream; el.style.display = 'none';
            document.body.appendChild(el);
            this.outputEl = el;
            if (typeof el.setSinkId === 'function' && this.outputDeviceId) {
                try { await el.setSinkId(this.outputDeviceId); } catch(e){ console.warn('MonitorMix.setSinkId failed', e); }
            }
            try { await el.play(); } catch(_) {}
            return el;
        }

        async ensureMainEl(){
            if (this.mainEl) return this.mainEl;
            const el = document.createElement('audio');
            el.autoplay = true; el.muted = false; el.playsInline = true; el.srcObject = this.mainDest.stream; el.style.display = 'none';
            document.body.appendChild(el);
            this.mainEl = el;
            if (typeof el.setSinkId === 'function' && this.mainDeviceId) {
                try { await el.setSinkId(this.mainDeviceId); } catch(e){ console.warn('MonitorMix.setMainSink failed', e); }
            }
            try { await el.play(); } catch(_) {}
            return el;
        }

        async enable(opts){
            opts = opts || {};
            if (this.enabled) return true;
            // mic
            if (!opts.skipMic) {
                await this.engine.enableMicrophone();
                this.micSource = this.engine.microphoneSource || (this.engine.microphoneStream ? this.ctx.createMediaStreamSource(this.engine.microphoneStream) : null);
                if (!this.micSource) throw new Error('MonitorMix: no microphone');
                try { this.micSource.disconnect(); } catch(_) {}
                this.micSource.connect(this.delayNode);
                this.delayNode.connect(this.monitorGain);
            }
            if (this.includeMusic) { this._connectMusicTap(); }
            this.monitorGain.connect(this.dest);
            this.enabled = true;
            this._connectVocalToMain();
            // если основной тракт задействован, убедимся что он слышен
            if (this.routeMainEnabled) { try { await this.ensureMainEl(); await this.mainEl.play(); } catch(_) {} }
            await this.ensureOutputEl();
            this._persist();
            document.dispatchEvent(new CustomEvent('monitor-state-changed', { detail: this.getState() }));
            return true;
        }

        disable(){
            if (!this.enabled) return;
            try { this.monitorGain.disconnect(); } catch(_) {}
            try { this.musicGain.disconnect(); } catch(_) {}
            try { this.vocalToMainGain.disconnect(); } catch(_) {}
            // отменить pending vocal retry
            if (this._pendingVocalRetry) {
                clearTimeout(this._pendingVocalRetry);
                this._pendingVocalRetry = null;
            }
            // обнулить vocal gain явно
            if (this.vocalToMainGain?.gain) {
                this.vocalToMainGain.gain.value = 0;
            }
            this.enabled = false;
            document.dispatchEvent(new CustomEvent('monitor-state-changed', { detail: this.getState() }));
        }

        async setOutputDevice(deviceId){
            this.outputDeviceId = deviceId || '';
            await this.ensureOutputEl();
            if (this.outputEl && typeof this.outputEl.setSinkId === 'function' && deviceId) {
                try { await this.outputEl.setSinkId(deviceId); } catch(e){ console.warn('MonitorMix.setSinkId failed', e); }
            }
            this._persist();
        }

        setDelayMs(ms){
            const v = Math.max(0, Math.min(1000, Number(ms)||0));
            const previousDelayMs = this.delayMs;
            this.delayMs = v;
            if (this.compensateOn === 'main') {
                if (this.mainDelayNode) { this.mainDelayNode.delayTime.value = v/1000; }
                this.delayNode.delayTime.value = 0;
            } else {
                this.delayNode.delayTime.value = v/1000;
                if (this.mainDelayNode) { this.mainDelayNode.delayTime.value = 0; }
            }
            this._persist();
        }

        setCompensateTarget(target){
            this.compensateOn = (target === 'main') ? 'main' : 'monitor';
            // Переставим значение задержки в соответствующую ветку
            this.setDelayMs(this.delayMs);
            if (this.enabled) this._connectVocalToMain();
        }

        setIncludeMusic(on){
            this.includeMusic = !!on; this.musicGain.gain.value = this.includeMusic ? this.musicLevel : 0; this._persist();
            if (this.enabled) this._connectMusicTap();
        }

        setMusicLevel(level){
            const v = Math.max(0, Math.min(1, Number(level)||0));
            this.musicLevel = v; if (this.includeMusic) this.musicGain.gain.value = v; this._persist();
        }

        _connectMusicTap(){
            try { this.musicGain.disconnect(); } catch(_) {}
            if (!this.includeMusic) return;
            if (this.engine && this.engine.instrumentalGain) {
                this.engine.instrumentalGain.connect(this.musicGain);
                this.musicGain.connect(this.dest);
            }
        }

        _setupRouting(){
            if (this._routingReady) return;
            const g = this.engine?.instrumentalGain;
            if (!g) return;
            try { g.disconnect(); } catch(_) {}
            this.defaultBranchGain = this.ctx.createGain();
            this.mainBranchGain = this.ctx.createGain();
            g.connect(this.defaultBranchGain);
            g.connect(this.mainBranchGain);
            // default path
            this.defaultBranchGain.connect(this.ctx.destination);
            // main path
            this.mainDelayNode = this.ctx.createDelay(2.0);
            this.mainDelayNode.delayTime.value = (this.compensateOn === 'main') ? (this.delayMs/1000) : 0;
            this.mainBranchGain.connect(this.mainDelayNode);
            this.mainDelayNode.connect(this.mainDest);
            // initial state: играем в системный выход
            this.defaultBranchGain.gain.value = 1.0;
            this.mainBranchGain.gain.value = 0.0;
            this._routingReady = true;
        }

        _hasAnyAutoMixEnabled(){
            return !!(
                this.autoIntroOn ||
                this.autoVerseOn ||
                this.autoPreChorusOn ||
                this.autoChorusOn ||
                this.autoBridgeOn ||
                this.autoOutroOn
            );
        }

        _connectVocalToMain(){
            if (!this.enabled) return;
            try { this.vocalToMainGain.disconnect(); } catch(_) {}
            
            const allowVocalRoute = this.vocalToMain || this._hasAnyAutoMixEnabled();
            if (!allowVocalRoute) {
                // 1. отменить pending retry если есть
                if (this._pendingVocalRetry) {
                    clearTimeout(this._pendingVocalRetry);
                    this._pendingVocalRetry = null;
                }
                // 2. обнулить gain
                if (this.vocalToMainGain?.gain) {
                    this.vocalToMainGain.gain.value = 0;
                }
                return;
            }
            this._setupRouting();
            this.ensureMainEl().then(()=>{ try { this.mainEl.play(); } catch(_) {} });

            // Пытаемся подключиться к источнику вокальной дорожки из AudioEngine
            const src = this.engine && this.engine.vocalsSourceNode ? this.engine.vocalsSourceNode : null;
            if (!src) {
                if (this._pendingVocalRetry) clearTimeout(this._pendingVocalRetry);
                this._pendingVocalRetry = setTimeout(() => {
                    this._pendingVocalRetry = null;
                    this._connectVocalToMain();
                }, 500);
                
                return;
            }

            // Semantic default gain rule:
            // - if track switching → stay silent
            // - else if manual vocal send → audible pre-block override
            // - else (AutoMix armed only) → silent, block truth comes later
            if (this._trackSwitching) {
                this.vocalToMainGain.gain.value = 0;
            } else if (this.vocalToMain) {
                this.vocalToMainGain.gain.value = this.vocalHallLevel;
            } else {
                this.vocalToMainGain.gain.value = 0;
            }
            try { src.disconnect(this.vocalToMainGain); } catch(_) {}
            src.connect(this.vocalToMainGain);

            try { this.vocalToMainGain.disconnect(); } catch(_) {}
            if (this.compensateOn === 'main') {
                if (!this.mainDelayNode) {
                    this.mainDelayNode = this.ctx.createDelay(2.0);
                    this.mainDelayNode.delayTime.value = 
                        (this.compensateOn === 'main') ? (this.delayMs||0)/1000 : 0;
                    if (this.mainBranchGain) { this.mainBranchGain.connect(this.mainDelayNode); }
                    this.mainDelayNode.connect(this.mainDest);
                } else {
                    this.mainDelayNode.delayTime.value = 
                        (this.compensateOn === 'main') ? (this.delayMs||0)/1000 : 0;
                }
                this.vocalToMainGain.connect(this.mainDelayNode);
            } else {
                this.vocalToMainGain.connect(this.mainDest);
            }
            
            // AutoMix cold-start recovery: re-apply current block truth immediately after connection
            if (this._hasAnyAutoMixEnabled() && !this._syncTestActive) {
                this._updateAutoVocalGainForLine(
                    window.lyricsDisplay?.currentLine ?? 0
                );
            }
        }

        _bindBlockAutoMix(){
            if (this._autoMixBound) return;
            this._autoMixHandler = (e)=>{
                try {
                    const lineIndex = (e && e.detail && typeof e.detail.newLineIndex === 'number') ? e.detail.newLineIndex : (window.lyricsDisplay ? window.lyricsDisplay.currentLine : 0);
                    this._updateAutoVocalGainForLine(lineIndex);
                } catch(_) {}
            };
            document.addEventListener('active-line-changed', this._autoMixHandler);
            this._autoMixBound = true;
        }

        _bindTrackLifecycle(){
            if (this._trackLifecycleBound) return;
            
            // before-track-change: suspend runtime routing, preserve user config
            this._beforeTrackChangeHandler = ()=>{
                if (!this.enabled) return;
                
                // Suspend AutoMix runtime only if any is enabled
                this._trackSwitching = this._hasAnyAutoMixEnabled();
                
                // Clear pending vocal retry
                if (this._pendingVocalRetry) {
                    clearTimeout(this._pendingVocalRetry);
                    this._pendingVocalRetry = null;
                }
                
                // Zero hall vocal immediately
                if (this.vocalToMainGain?.gain) {
                    this.vocalToMainGain.gain.value = 0;
                }
                
                // Safely disconnect gains
                try { this.musicGain.disconnect(); } catch(_) {}
                try { this.vocalToMainGain.disconnect(); } catch(_) {}
                
                // Zero branch gains if they exist
                if (this.defaultBranchGain) {
                    this.defaultBranchGain.gain.value = 0;
                }
                if (this.mainBranchGain) {
                    this.mainBranchGain.gain.value = 0;
                }
                
                // Pause hidden sink elements to prevent stale-stream overlap / pitch artifact
                if (this.mainEl) {
                    try { this.mainEl.pause(); } catch(_) {}
                }
                if (this.outputEl) {
                    try { this.outputEl.pause(); } catch(_) {}
                }
                
                // Prepare clean rebuild
                this._routingReady = false;
                
                // PRESERVE user config:
                // - routeMainEnabled
                // - includeMusic
                // - AutoMix flags/levels
                // - vocalToMain
            };
            document.addEventListener('before-track-change', this._beforeTrackChangeHandler);
            
            // track-loaded: rebind routing to new stem nodes
            this._trackLoadedHandler = ()=>{
                if (!this.enabled) return;
                
                // Rebuild routing for new instrumentalGain
                this._setupRouting();
                
                // Restore branch gain state according to routeMainEnabled
                if (this.routeMainEnabled) {
                    if (this.defaultBranchGain) {
                        this.defaultBranchGain.gain.value = 0.0;
                    }
                    if (this.mainBranchGain) {
                        this.mainBranchGain.gain.value = 1.0;
                    }
                } else {
                    if (this.defaultBranchGain) {
                        this.defaultBranchGain.gain.value = 1.0;
                    }
                    if (this.mainBranchGain) {
                        this.mainBranchGain.gain.value = 0.0;
                    }
                }
                
                // Reconnect music tap if needed
                if (this.includeMusic) {
                    this._connectMusicTap();
                }
                
                // Reconnect vocal to main if needed, but stay silent while switching
                if (this.vocalToMain || this._hasAnyAutoMixEnabled()) {
                    this._connectVocalToMain();
                }
                
                // Resume hidden sink elements after routing rebuilt
                // Main path: resume if routeMainEnabled
                if (this.routeMainEnabled) {
                    this.ensureMainEl().then(() => {
                        try { this.mainEl.play(); } catch(_) {}
                    });
                }
                
                // Output path: resume if monitor path should be alive
                if (this.includeMusic || this.micSource || this.enabled) {
                    this.ensureOutputEl().then(() => {
                        try { this.outputEl.play(); } catch(_) {}
                    });
                }
            };
            document.addEventListener('track-loaded', this._trackLoadedHandler);
            
            this._trackLifecycleBound = true;
        }

        _getBlockTypeByLine(lineIndex){
            try {
                const ld = window.lyricsDisplay;
                if (!ld) return null;
                const rawBlocks = (typeof ld._splitLargeBlocks === 'function') ? ld._splitLargeBlocks(ld.textBlocks||[]) : (ld.textBlocks||[]);
                for (const blk of rawBlocks||[]) {
                    if (blk && Array.isArray(blk.lineIndices) && blk.lineIndices.includes(lineIndex)) {
                        const t = (blk.type||'').toLowerCase();
                        if (t === 'chorus' || t === 'bridge' || t === 'verse') return t;
                        if (t === 'prechorus' || t === 'pre-chorus') return 'prechorus';
                        if (t === 'interlude') return 'interlude';
                        if (t === 'intro') return 'intro';
                        if (t === 'outro') return 'outro';
                        // Unknown block type → treat as gap (null = strict zero semantics per TC-065)
                        return null;
                    }
                }
                // No exact block match → gap/unmapped line
                return null;
            } catch(_) {}
            return null;
        }

        _refreshVocalRouteFromAutoMixConfig(){
            // Explicit AutoMix config path routing helper
            if (!this.enabled) return;
            this._connectVocalToMain();
        }

        _updateAutoVocalGainForLine(lineIndex){
            if (!this.enabled) return;
            if (this._syncTestActive) return;
            // Если авто выключено — не мешаем ручной логике
            if (!this.autoVerseOn && !this.autoChorusOn && !this.autoBridgeOn && !this.autoIntroOn && !this.autoPreChorusOn && !this.autoOutroOn) {
                this.vocalToMainGain.gain.value = this.vocalToMain ? this.vocalHallLevel : 0;
                return;
            }
            
            // Line index comes from event argument — current truth
            const currentLine =
              typeof lineIndex === 'number'
                ? lineIndex
                : (typeof window.lyricsDisplay?.currentLine === 'number'
                    ? window.lyricsDisplay.currentLine
                    : -1);
            
            if (currentLine < 0) return;
            
            const t = this._getBlockTypeByLine(currentLine);
            let target = 0;
            if (t === 'verse' && this.autoVerseOn) target = this.autoVerseLevel;
            if (t === 'chorus' && this.autoChorusOn) target = this.autoChorusLevel;
            else if (t === 'bridge' && this.autoBridgeOn) target = this.autoBridgeLevel;
            else if (t === 'intro' && this.autoIntroOn) target = this.autoIntroLevel;
            else if (t === 'prechorus' && this.autoPreChorusOn) target = this.autoPreChorusLevel;
            else if (t === 'outro' && this.autoOutroOn) target = this.autoOutroLevel;
            
            // Track-switch resume rule
            if (this._trackSwitching) {
                if (target > 0) {
                    // First exact enabled AutoMix block found → resume
                    this._trackSwitching = false;
                } else {
                    // Still on gap/unmapped line → stay silent
                    this.vocalToMainGain.gain.value = 0;
                    return;
                }
            }
            
            this.vocalToMainGain.gain.value = target;
        }

        async testPulse(){
            const dur = 0.06;
            const mk = (toNode)=>{
                const osc = this.ctx.createOscillator(); const g = this.ctx.createGain();
                osc.frequency.value = 1000; g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.8, this.ctx.currentTime + 0.002);
                g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
                osc.connect(g).connect(toNode); osc.start(); osc.stop(this.ctx.currentTime + dur);
            };
            if (this.routeMainEnabled && this.mainDest) { mk(this.mainDest); } else { mk(this.ctx.destination); }
            mk(this.dest);            // monitor
        }

        syncClick(){
            if (!this.ctx) return;
            const sampleRate = this.ctx.sampleRate;
            const frames = Math.floor(sampleRate * 0.015);
            const buf = this.ctx.createBuffer(1, frames, sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < frames; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (frames * 0.15));
            }
            const play = (destination) => {
                const src = this.ctx.createBufferSource();
                src.buffer = buf;
                const g = this.ctx.createGain();
                g.gain.value = 0.8;
                src.connect(g).connect(destination);
                src.start();
            };
            this.ensureOutputEl().then(() => {
                if (this.dest) play(this.dest);
            });
            if (this.routeMainEnabled && this.mainDest) {
                this.ensureMainEl().then(() => {
                    if (this.mainDest) play(this.mainDest);
                });
            }
        }

        _buildCalibrationBuffer(){
            if (!this.ctx) return;
            const sampleRate = this.ctx.sampleRate;
            const duration = 0.12; // 120ms total
            const frames = Math.floor(sampleRate * duration);
            const buffer = this.ctx.createBuffer(1, frames, sampleRate);
            const data = buffer.getChannelData(0);

            // Synthesis parameters
            const f0 = 880; // A5 — above MacBook speaker cutoff
            const tau = 0.028; // 28ms exponential decay

            // Build harmonic pluck with transient onset
            for (let i = 0; i < frames; i++) {
                const t = i / sampleRate;
                const env = Math.exp(-t / tau);

                // Transient onset: sharp noise burst first 1.5ms
                const isOnset = i < Math.floor(sampleRate * 0.0015);
                const noise = isOnset ? (Math.random() * 2 - 1) * 0.4 : 0;

                // Harmonic body: 6 harmonics
                const harmonics =
                    1.00 * Math.sin(2 * Math.PI * f0 * 1 * t) +
                    0.60 * Math.sin(2 * Math.PI * f0 * 2 * t) +
                    0.40 * Math.sin(2 * Math.PI * f0 * 3 * t) +
                    0.25 * Math.sin(2 * Math.PI * f0 * 4 * t) +
                    0.15 * Math.sin(2 * Math.PI * f0 * 5 * t) +
                    0.08 * Math.sin(2 * Math.PI * f0 * 6 * t);

                data[i] = (noise + harmonics * 0.35) * env;
            }

            // Normalize to peak 0.85
            let peak = 0;
            for (let i = 0; i < frames; i++) {
                const abs = Math.abs(data[i]);
                if (abs > peak) peak = abs;
            }
            if (peak > 0) {
                const normalizeFactor = 0.85 / peak;
                for (let i = 0; i < frames; i++) {
                    data[i] *= normalizeFactor;
                }
            }

            this._calibrationBuffer = buffer;
        }

        _emitCalibrationHit(){
            if (!this.ctx || !this._calibrationBuffer) return;

            const src = this.ctx.createBufferSource();
            src.buffer = this._calibrationBuffer;

            // Dedicated calibration gain — NOT through musicGain
            const calibGain = this.ctx.createGain();
            calibGain.gain.value = 0.5;
            src.connect(calibGain);

            // BT path (always)
            calibGain.connect(this.dest);

            // Speakers path (Sound Check mode)
            // IMPORTANT: through mainDelayNode so previewDelayMs() works
            // ===== PULSE DIAGNOSTIC: direct-main experiment mode =====
            if (this._pulseDiagDirectMain) {
                // Direct to ctx.destination for experiment
                calibGain.connect(this.ctx.destination);
            } else if (this.routeMainEnabled && this.mainDest) {
                // Normal production path
                if (this.mainDelayNode) {
                    calibGain.connect(this.mainDelayNode);
                } else {
                    calibGain.connect(this.mainDest);
                }
            }

            src.start();
            src.onended = () => {
                try { src.disconnect(); } catch(_) {}
                try { calibGain.disconnect(); } catch(_) {}
            };
        }

        /**
         * PART A — Precise AudioContext-scheduled pulse loop
         * Replaces setInterval with ctx.currentTime scheduling
         * 
         * Uses lookahead scheduler pattern:
         * - schedules pulses 150ms ahead
         * - re-checks every 80ms
         * - first pulse 50ms from now to allow routing to settle
         * 
         * Accuracy: microseconds (hardware audio clock)
         * vs setInterval: ±260ms jitter
         */
        _startPrecisePulseLoop(intervalSec = 0.667) {
            if (!this._calibrationBuffer) this._buildCalibrationBuffer();
            
            // Clear any existing schedule
            if (this._pulseScheduleTimer) {
                clearTimeout(this._pulseScheduleTimer);
                this._pulseScheduleTimer = null;
            }
            
            const lookahead = 0.15;    // schedule 150ms ahead
            const checkInterval = 80;  // re-check every 80ms
            
            // First pulse: 50ms from now to allow routing to settle
            this._nextPulseTime = this.ctx.currentTime + 0.05;
            
            const schedule = () => {
                if (!this._syncTestActive) return;
                
                const now = this.ctx.currentTime;
                
                while (this._nextPulseTime < now + lookahead) {
                    this._emitCalibrationHitAt(this._nextPulseTime);
                    this._nextPulseTime += intervalSec;
                }
                
                this._pulseScheduleTimer = setTimeout(schedule, checkInterval);
            };
            
            schedule();
        }

        /**
         * PART A — Emit calibration hit at exact audio time
         * Sample-accurate scheduling via AudioContext
         * 
         * @param {number} time - ctx.currentTime when pulse should fire
         */
        _emitCalibrationHitAt(time) {
            if (!this.ctx || !this._calibrationBuffer) return;
            
            const src = this.ctx.createBufferSource();
            src.buffer = this._calibrationBuffer;
            
            const calibGain = this.ctx.createGain();
            calibGain.gain.value = 0.5;
            src.connect(calibGain);
            
            // BT path (always)
            calibGain.connect(this.dest);
            
            // Speakers path
            if (this._pulseDiagDirectMain) {
                // Direct to ctx.destination for experiment
                calibGain.connect(this.ctx.destination);
            } else if (this.routeMainEnabled && this.mainDest) {
                // Normal production path
                if (this.mainDelayNode) {
                    calibGain.connect(this.mainDelayNode);
                } else {
                    calibGain.connect(this.mainDest);
                }
            }
            
            // SAMPLE-ACCURATE: schedule at exact audio clock time
            src.start(time);
            
            src.onended = () => {
                try { src.disconnect(); } catch(_) {}
                try { calibGain.disconnect(); } catch(_) {}
            };
        }

        tapClick(){
            // Headphones-only pulse for TAP ritual
            // Does NOT route to speakers/main path — user-focused
            if (!this.ctx) return;
            const sampleRate = this.ctx.sampleRate;
            const frames = Math.floor(sampleRate * 0.015);
            const buf = this.ctx.createBuffer(1, frames, sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < frames; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (frames * 0.15));
            }
            const play = (destination) => {
                const src = this.ctx.createBufferSource();
                src.buffer = buf;
                const g = this.ctx.createGain();
                g.gain.value = 0.8;
                src.connect(g).connect(destination);
                src.start();
            };
            this.ensureOutputEl().then(() => {
                if (this.dest) play(this.dest);
            });
            // NOTE: No routing to mainDest — headphones only
        }

        /**
         * PART A — Dedicated Pulse session entry point
         * beginPulseCalibration(seedMs: number, intervalMs = 667)
         * 
         * FIRST ENTRY:
         * - create startup token
         * - set _syncTestActive = true
         * - snapshot autoMixArmed, preSessionVocalGain, seedDelayMs
         * - force compensateOn = 'main'
         * - mute vocal reinforcement
         * - resume AudioContext if needed
         * - ensureOutputEl(), ensureMainEl() if routeMainEnabled
         * - resetPulseSinkPipeline()
         * - previewDelayMs(seedMs) AFTER sink reset
         * - build calibration buffer if needed
         * - emit first pulse
         * - create interval
         * 
         * RE-ENTRY (same active session):
         * - do NOT overwrite snapshot
         * - do NOT repeat full preflight
         * - do NOT repeat sink reset
         * - set _syncTestActive = true
         * - call previewDelayMs(seedMs)
         * - build calibration buffer if needed
         * - emit first pulse
         * - create interval
         */
        async beginPulseCalibration(seedMs, intervalMs = 667) {
            // Guard against duplicate interval
            if (this._syncInterval || this._pulseScheduleTimer || this._syncTestActive) return;
            
            const startupToken = {};
            this._pulseStartupToken = startupToken;
            
            // Check if this is FIRST entry or RE-ENTRY
            const isFirstEntry = !this._pulseSessionSnapshot;
            
            if (isFirstEntry) {
                // ===== FIRST ENTRY: full preflight =====
                this._syncTestActive = true;
                
                // Create runtime-only snapshot
                this._pulseSessionSnapshot = {
                    autoMixArmed: this._hasAnyAutoMixEnabled(),
                    preSessionVocalGain: this.vocalToMainGain?.gain?.value ?? 0,
                    seedDelayMs: seedMs
                };
                
                // Force compensation truth to main
                this.compensateOn = 'main';
                
                // Mute vocal reinforcement for clean pulse
                if (this.vocalToMainGain?.gain) {
                    this.vocalToMainGain.gain.value = 0;
                }
                
                // Resume AudioContext if suspended
                if (this.ctx.state === 'suspended') {
                    try {
                        await this.ctx.resume();
                    } catch(e) {
                        console.warn('MonitorMix: ctx.resume() failed', e);
                    }
                }
                
                // Ensure output elements ready
                await this.ensureOutputEl();
                if (this.routeMainEnabled) {
                    await this.ensureMainEl();
                }
                
                // Reset sink pipeline to prevent stale-stream artifacts
                await this.resetPulseSinkPipeline();
                
                // Post-async validation: token still valid?
                if (this._pulseStartupToken !== startupToken) {
                    return;
                }
                
                // Post-async validation: sync test still active?
                if (!this._syncTestActive) {
                    return;
                }
                
                // Post-async validation: interval not already created?
                if (this._syncInterval) {
                    return;
                }
                
                // Ensure delay node exists for calibration
                // _setupRouting() creates full routing if instrumentalGain available
                this._setupRouting();
                if (!this.mainDelayNode) {
                    // No instrumentalGain yet — create standalone delay node for pulse calibration
                    this.mainDelayNode = this.ctx.createDelay(2.0);
                    this.mainDelayNode.delayTime.value = 0;
                    this.mainDelayNode.connect(this.mainDest);
                }
                
                // Apply delay AFTER sink reset and delay node creation
                this.previewDelayMs(seedMs);
                
                // Build calibration buffer if needed
                if (!this._calibrationBuffer) this._buildCalibrationBuffer();
                
                // Start precise AudioContext-scheduled pulse loop
                this._startPrecisePulseLoop(intervalMs / 1000);
            } else {
                // ===== RE-ENTRY: minimal restart =====
                this._syncTestActive = true;
                
                // Post-async validation: token still valid?
                if (this._pulseStartupToken !== startupToken) {
                    return;
                }
                
                // Post-async validation: interval not already created?
                if (this._syncInterval) {
                    return;
                }
                
                // Apply delay
                this.previewDelayMs(seedMs);
                
                // Build calibration buffer if needed
                if (!this._calibrationBuffer) this._buildCalibrationBuffer();
                
                // Start precise AudioContext-scheduled pulse loop
                this._startPrecisePulseLoop(intervalMs / 1000);
            }
        }
        
        /**
         * PART B — Pulse diagnostic mode setter (TEMPORARY)
         * setPulseDiagnosticMode(mode)
         * 
         * Allowed values:
         * - 'normal' → _pulseDiagDirectMain = false
         * - 'direct-main' → _pulseDiagDirectMain = true
         * 
         * Invalid value ignored with console.warn
         */
        setPulseDiagnosticMode(mode) {
            if (mode === 'normal') {
                this._pulseDiagDirectMain = false;
                console.log('[PULSE-DIAG] Mode set to: normal');
            } else if (mode === 'direct-main') {
                this._pulseDiagDirectMain = true;
                console.log('[PULSE-DIAG] Mode set to: direct-main');
            } else {
                console.warn('[PULSE-DIAG] Invalid mode:', mode, '. Use "normal" or "direct-main"');
            }
        }
        
        /**
         * PART A — Reset Pulse sink pipeline helper
         * Prevents stale-stream overlap / pitch artifact on Pulse session entry
         * 
         * Behavior:
         * - if mainEl && mainDest:
         *   - pause mainEl
         *   - set mainEl.srcObject = null
         *   - set mainEl.srcObject = this.mainDest.stream
         *   - await mainEl.play()
         * - if outputEl && dest:
         *   - pause outputEl
         *   - set outputEl.srcObject = null
         *   - set outputEl.srcObject = this.dest.stream
         *   - await outputEl.play()
         * - await stabilization timeout (60–80ms)
         * 
         * IMPORTANT:
         * - outputEl reconnects to this.dest.stream (NOT mainDest.stream)
         */
        async resetPulseSinkPipeline() {
            // Main path reset
            if (this.mainEl && this.mainDest) {
                try { this.mainEl.pause(); } catch(_) {}
                this.mainEl.srcObject = null;
                this.mainEl.srcObject = this.mainDest.stream;
                await this.mainEl.play();
            }
            
            // Output path reset (to dest.stream, NOT mainDest.stream)
            if (this.outputEl && this.dest) {
                try { this.outputEl.pause(); } catch(_) {}
                this.outputEl.srcObject = null;
                this.outputEl.srcObject = this.dest.stream;
                await this.outputEl.play();
            }
            
            // Stabilization timeout
            await new Promise(resolve => setTimeout(resolve, 70));
        }
        
        /**
         * PART A — End Pulse calibration session
         * endPulseCalibration()
         * 
         * Behavior:
         * - invalidate startup token
         * - clear interval if exists
         * - _syncTestActive = false
         * - DO NOT restore compensateOn
         * - if snapshot says autoMixArmed === true:
         *   - call _updateAutoVocalGainForLine(currentLine)
         * - else:
         *   - restore vocalToMainGain.gain.value = preSessionVocalGain
         * - clear _pulseSessionSnapshot
         * 
         * IMPORTANT:
         * - Do NOT call setDelayMs(this.delayMs) inside endPulseCalibration
         * - Pulse session permanently normalizes compensation truth to 'main'
         */
        endPulseCalibration() {
            // Invalidate startup token
            this._pulseStartupToken = null;
            
            // Clear interval
            if (this._syncInterval) {
                clearInterval(this._syncInterval);
                this._syncInterval = null;
            }
            
            // Clear precise pulse schedule
            if (this._pulseScheduleTimer) {
                clearTimeout(this._pulseScheduleTimer);
                this._pulseScheduleTimer = null;
            }
            this._nextPulseTime = 0;
            
            // End session
            this._syncTestActive = false;
            
            // Restore based on snapshot
            const snapshot = this._pulseSessionSnapshot;
            if (snapshot) {
                if (snapshot.autoMixArmed) {
                    // AutoMix armed — re-apply current block truth
                    this._updateAutoVocalGainForLine(
                        window.lyricsDisplay?.currentLine ?? 0
                    );
                } else {
                    // No AutoMix — restore manual vocal truth
                    if (this.vocalToMainGain?.gain) {
                        this.vocalToMainGain.gain.value = snapshot.preSessionVocalGain;
                    }
                }
                
                // Clear snapshot
                this._pulseSessionSnapshot = null;
            }
            
            // NOTE: Do NOT restore compensateOn
            // Do NOT call setDelayMs(this.delayMs)
            // Pulse session permanently normalizes compensation truth to 'main'
        }

        startSyncSequence(intervalMs = 500){
            if (this._syncInterval) return;
            this._syncTestActive = true;
            this._syncInterval = setInterval(() => this.syncClick(), intervalMs);
        }

        stopSyncSequence(){
            // Invalidate startup token to prevent late pulse restart
            this._pulseStartupToken = null;
            
            if (this._syncInterval) {
                clearInterval(this._syncInterval);
                this._syncInterval = null;
            }
            this._syncTestActive = false;
            
            // Clear precise pulse schedule
            if (this._pulseScheduleTimer) {
                clearTimeout(this._pulseScheduleTimer);
                this._pulseScheduleTimer = null;
            }
            this._nextPulseTime = 0;
            
            // ===== PULSE DIAGNOSTIC: reset timing state =====
            this._lastPulseTime = 0;
            this._pulseStartTime = 0;
        }
        
        /**
         * PART A — Pulse isolation helper
         * Suspend vocal reinforcement during Pulse calibration session
         * Runtime-only snapshot, no persistence
         */
        suspendForPulseLineUp() {
            // Capture runtime snapshot only if AutoMix is armed or vocalToMain is active
            const hasAutoMixArmed = this._hasAnyAutoMixEnabled();
            const vocalToMainActive = !!this.vocalToMain;
            
            this._pulseSessionSnapshot = {
                autoMixArmed: hasAutoMixArmed,
                vocalToMain: vocalToMainActive,
                vocalHallLevel: this.vocalHallLevel,
                vocalGainValue: this.vocalToMainGain?.gain?.value ?? 0
            };
            
            // Force vocal gain to zero for clean pulse-only reference
            if (this.vocalToMainGain?.gain) {
                this.vocalToMainGain.gain.value = 0;
            }
            
            // Do NOT persist anything
            // Do NOT change localStorage-backed flags
            // Do NOT disconnect routes
        }
        
        /**
         * PART A — Pulse isolation helper
         * Restore vocal truth after Pulse calibration session ends
         * If AutoMix armed: call _updateAutoVocalGainForLine()
         * Else: restore manual vocal truth
         */
        restoreAfterPulseLineUp() {
            const snapshot = this._pulseSessionSnapshot;
            if (!snapshot) return; // No snapshot to restore
            
            // Clear snapshot first
            this._pulseSessionSnapshot = null;
            
            // Restore based on what was captured
            if (snapshot.autoMixArmed) {
                // AutoMix is armed — re-apply current block truth
                this._updateAutoVocalGainForLine(
                    window.lyricsDisplay?.currentLine ?? 0
                );
            } else {
                // No AutoMix — restore manual vocal truth
                if (this.vocalToMainGain?.gain) {
                    this.vocalToMainGain.gain.value = snapshot.vocalToMain ? snapshot.vocalHallLevel : 0;
                }
            }
            
            // Do NOT persist anything
        }

        previewDelayMs(ms){
            const v = Math.max(0, Math.min(1000, Number(ms) || 0));
            if (this.compensateOn === 'main') {
                // Задерживаем speakers, BT без delay
                if (this.mainDelayNode) {
                    this.mainDelayNode.delayTime.value = v / 1000;
                }
                if (this.delayNode) {
                    this.delayNode.delayTime.value = 0;
                }
            } else {
                // Задерживаем BT, speakers без delay
                if (this.delayNode) {
                    this.delayNode.delayTime.value = v / 1000;
                }
                if (this.mainDelayNode) {
                    this.mainDelayNode.delayTime.value = 0;
                }
            }
        }

        async listOutputs(){
            try {
                const devices = await navigator.mediaDevices?.enumerateDevices?.();
                return (devices||[]).filter(d=>d.kind==='audiooutput');
            } catch(e){ console.warn('MonitorMix.enumerateDevices failed', e); return []; }
        }

        getState(){
            return { enabled: this.enabled, delayMs: this.delayMs, includeMusic: this.includeMusic, musicLevel: this.musicLevel, outputDeviceId: this.outputDeviceId, mainDeviceId: this.mainDeviceId, routeMainEnabled: this.routeMainEnabled, compensateOn: this.compensateOn, vocalToMain: this.vocalToMain, vocalHallLevel: this.vocalHallLevel, autoVerseOn: this.autoVerseOn, autoVerseLevel: this.autoVerseLevel, autoChorusOn: this.autoChorusOn, autoChorusLevel: this.autoChorusLevel, autoBridgeOn: this.autoBridgeOn, autoBridgeLevel: this.autoBridgeLevel, autoIntroOn: this.autoIntroOn, autoIntroLevel: this.autoIntroLevel, autoPreChorusOn: this.autoPreChorusOn, autoPreChorusLevel: this.autoPreChorusLevel, autoOutroOn: this.autoOutroOn, autoOutroLevel: this.autoOutroLevel };
        }

        _persist(){
            try {
                localStorage.setItem('monitor:delayMs', String(this.delayMs));
                localStorage.setItem('monitor:compensateOn', this.compensateOn||'monitor');
                localStorage.setItem('monitor:includeMusic', String(this.includeMusic));
                localStorage.setItem('monitor:musicLevel', String(this.musicLevel));
                localStorage.setItem('monitor:deviceId', this.outputDeviceId||'');
                localStorage.setItem('monitor:mainDeviceId', this.mainDeviceId||'');
                localStorage.setItem('monitor:routeMain', String(this.routeMainEnabled));
                localStorage.setItem('monitor:vocalToMain', String(this.vocalToMain));
                localStorage.setItem('monitor:vocalHallLevel', String(this.vocalHallLevel));
                localStorage.setItem('monitor:lineUpSource', this.lineUpSource || 'pulse');
                localStorage.setItem('monitor:autoVerseOn', String(this.autoVerseOn));
                localStorage.setItem('monitor:autoVerseLevel', String(this.autoVerseLevel));
                localStorage.setItem('monitor:autoChorusOn', String(this.autoChorusOn));
                localStorage.setItem('monitor:autoChorusLevel', String(this.autoChorusLevel));
                localStorage.setItem('monitor:autoBridgeOn', String(this.autoBridgeOn));
                localStorage.setItem('monitor:autoBridgeLevel', String(this.autoBridgeLevel));
                localStorage.setItem('monitor:autoIntroOn', String(this.autoIntroOn));
                localStorage.setItem('monitor:autoIntroLevel', String(this.autoIntroLevel));
                localStorage.setItem('monitor:autoPreChorusOn', String(this.autoPreChorusOn));
                localStorage.setItem('monitor:autoPreChorusLevel', String(this.autoPreChorusLevel));
                localStorage.setItem('monitor:autoOutroOn', String(this.autoOutroOn));
                localStorage.setItem('monitor:autoOutroLevel', String(this.autoOutroLevel));
            } catch(_) {}
        }

        // ===== MAIN ROUTING =====
        async setMainOutputDevice(deviceId){
            this.mainDeviceId = deviceId || '';
            await this.ensureMainEl();
            if (this.mainEl && typeof this.mainEl.setSinkId === 'function' && deviceId) {
                try { await this.mainEl.setSinkId(deviceId); } catch(e){ console.warn('MonitorMix.setMainOutputDevice failed', e); }
            }
            try { await this.mainEl.play(); } catch(_) {}
            this._persist();
        }

        async setRouteMain(on){
            this.routeMainEnabled = !!on;
            try {
                this._setupRouting();
                if (this.routeMainEnabled) {
                    await this.ensureMainEl();
                    this.defaultBranchGain && (this.defaultBranchGain.gain.value = 0.0);
                    this.mainBranchGain && (this.mainBranchGain.gain.value = 1.0);
                    try { await this.mainEl.play(); } catch(_) {}
                } else {
                    this.defaultBranchGain && (this.defaultBranchGain.gain.value = 1.0);
                    this.mainBranchGain && (this.mainBranchGain.gain.value = 0.0);
                }
                // Подмикшивание в монитор при необходимости (держим подключение)
                if (this.includeMusic) { this._connectMusicTap(); }
                // И вокал в зал при необходимости
                this._connectVocalToMain();
            } catch(e){ console.warn('MonitorMix.setRouteMain error', e); }
            this._persist();
            document.dispatchEvent(new CustomEvent('monitor-route-changed', { detail: this.getState() }));
        }

        setVocalToMain(on){
            this.vocalToMain = !!on;
            this.vocalToMainGain.gain.value = this.vocalToMain ? this.vocalHallLevel : 0;
            if (this.enabled) this._connectVocalToMain();
            this._persist();
        }

        setVocalHallLevel(level){
            const v = Math.max(0, Math.min(1, Number(level)||0));
            this.vocalHallLevel = v;
            if (this.vocalToMain) this.vocalToMainGain.gain.value = v;
            this._persist();
            if (this.enabled && this.vocalToMain) this._connectVocalToMain();
        }

        setLineUpSource(source){
            const validSources = ['pulse', 'voc'];
            if (!validSources.includes(source)) {
                console.warn('MonitorMix.setLineUpSource: invalid source', source);
                return;
            }
            this.lineUpSource = source;
        }

        // ===== AUTO MIX SETTERS =====
        setAutoVerse(on){ this.autoVerseOn = !!on; this._persist(); this._refreshVocalRouteFromAutoMixConfig(); this._updateAutoVocalGainForLine(); }
        setAutoVerseLevel(level){ this.autoVerseLevel = Math.max(0, Math.min(1, Number(level)||0)); this._persist(); this._refreshVocalRouteFromAutoMixConfig(); this._updateAutoVocalGainForLine(); }
        setAutoChorus(on){ this.autoChorusOn = !!on; this._persist(); this._refreshVocalRouteFromAutoMixConfig(); this._updateAutoVocalGainForLine(); }
        setAutoChorusLevel(level){ this.autoChorusLevel = Math.max(0, Math.min(1, Number(level)||0)); this._persist(); this._refreshVocalRouteFromAutoMixConfig(); this._updateAutoVocalGainForLine(); }
        setAutoBridge(on){ this.autoBridgeOn = !!on; this._persist(); this._refreshVocalRouteFromAutoMixConfig(); this._updateAutoVocalGainForLine(); }
        setAutoBridgeLevel(level){ this.autoBridgeLevel = Math.max(0, Math.min(1, Number(level)||0)); this._persist(); this._refreshVocalRouteFromAutoMixConfig(); this._updateAutoVocalGainForLine(); }
        setAutoIntro(on){ this.autoIntroOn = !!on; this._persist(); this._refreshVocalRouteFromAutoMixConfig(); this._updateAutoVocalGainForLine(); }
        setAutoIntroLevel(level){ this.autoIntroLevel = Math.max(0, Math.min(1, Number(level)||0)); this._persist(); this._refreshVocalRouteFromAutoMixConfig(); this._updateAutoVocalGainForLine(); }
        setAutoPreChorus(on){ this.autoPreChorusOn = !!on; this._persist(); this._refreshVocalRouteFromAutoMixConfig(); this._updateAutoVocalGainForLine(); }
        setAutoPreChorusLevel(level){ this.autoPreChorusLevel = Math.max(0, Math.min(1, Number(level)||0)); this._persist(); this._refreshVocalRouteFromAutoMixConfig(); this._updateAutoVocalGainForLine(); }
        setAutoOutro(on){ this.autoOutroOn = !!on; this._persist(); this._refreshVocalRouteFromAutoMixConfig(); this._updateAutoVocalGainForLine(); }
        setAutoOutroLevel(level){ this.autoOutroLevel = Math.max(0, Math.min(1, Number(level)||0)); this._persist(); this._refreshVocalRouteFromAutoMixConfig(); this._updateAutoVocalGainForLine(); }
    }

    window.MonitorMix = MonitorMix;
    // Создадим глобальный экземпляр, если доступен audioEngine
    try {
        if (!window.monitorMix && window.audioEngine) { window.monitorMix = new MonitorMix(window.audioEngine); }
    } catch(_) {}
})();




