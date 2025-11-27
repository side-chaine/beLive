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
            // авто-подмешивание по блокам
            this.autoVerseOn = localStorage.getItem('monitor:autoVerseOn') === 'true';
            this.autoVerseLevel = Number(localStorage.getItem('monitor:autoVerseLevel')||0.1);
            this.autoChorusOn = localStorage.getItem('monitor:autoChorusOn') === 'true';
            this.autoChorusLevel = Number(localStorage.getItem('monitor:autoChorusLevel')||0.3);
            this.autoBridgeOn = localStorage.getItem('monitor:autoBridgeOn') === 'true';
            this.autoBridgeLevel = Number(localStorage.getItem('monitor:autoBridgeLevel')||0.25);

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

            this.setDelayMs(this.delayMs);
            this.musicGain.gain.value = this.includeMusic ? this.musicLevel : 0;
            this.vocalToMainGain.gain.value = this.vocalToMain ? this.vocalHallLevel : 0;
            this._bindBlockAutoMix();
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

        async enable(){
            if (this.enabled) return true;
            // mic
            await this.engine.enableMicrophone();
            this.micSource = this.engine.microphoneSource || (this.engine.microphoneStream ? this.ctx.createMediaStreamSource(this.engine.microphoneStream) : null);
            if (!this.micSource) throw new Error('MonitorMix: no microphone');
            try { this.micSource.disconnect(); } catch(_) {}
            this.micSource.connect(this.delayNode);
            this.delayNode.connect(this.monitorGain);
            if (this.includeMusic) { this._connectMusicTap(); }
            this.monitorGain.connect(this.dest);
            this._connectVocalToMain();
            // если основной тракт задействован, убедимся что он слышен
            if (this.routeMainEnabled) { try { await this.ensureMainEl(); await this.mainEl.play(); } catch(_) {} }
            await this.ensureOutputEl();
            this.enabled = true;
            this._persist();
            document.dispatchEvent(new CustomEvent('monitor-state-changed', { detail: this.getState() }));
            return true;
        }

        disable(){
            if (!this.enabled) return;
            try { this.monitorGain.disconnect(); } catch(_) {}
            try { this.musicGain.disconnect(); } catch(_) {}
            try { this.vocalToMainGain.disconnect(); } catch(_) {}
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

        _connectVocalToMain(){
            try { this.vocalToMainGain.disconnect(); } catch(_) {}
            if (!this.vocalToMain) return;
            this._setupRouting();
            this.ensureMainEl().then(()=>{ try { this.mainEl.play(); } catch(_) {} });

            // Пытаемся подключиться к источнику вокальной дорожки из AudioEngine
            const src = this.engine && this.engine.vocalsSourceNode ? this.engine.vocalsSourceNode : null;
            if (!src) { setTimeout(()=> this._connectVocalToMain(), 500); return; }

            this.vocalToMainGain.gain.value = this.vocalHallLevel;
            try { src.disconnect(this.vocalToMainGain); } catch(_) {}
            src.connect(this.vocalToMainGain);

            try { this.vocalToMainGain.disconnect(); } catch(_) {}
            if (this.compensateOn === 'main') {
                if (!this.mainDelayNode) {
                    this.mainDelayNode = this.ctx.createDelay(2.0);
                    this.mainDelayNode.delayTime.value = (this.delayMs||0)/1000;
                    if (this.mainBranchGain) { this.mainBranchGain.connect(this.mainDelayNode); }
                    this.mainDelayNode.connect(this.mainDest);
                } else {
                    this.mainDelayNode.delayTime.value = (this.delayMs||0)/1000;
                }
                this.vocalToMainGain.connect(this.mainDelayNode);
            } else {
                this.vocalToMainGain.connect(this.mainDest);
            }
            try { console.log('MonitorMix: vocalToMain connected (VOCAL TRACK)', { level: this.vocalHallLevel, compensateOn: this.compensateOn }); } catch(_) {}
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

        _getBlockTypeByLine(lineIndex){
            try {
                const ld = window.lyricsDisplay;
                if (!ld) return 'unknown';
                const rawBlocks = (typeof ld._splitLargeBlocks === 'function') ? ld._splitLargeBlocks(ld.textBlocks||[]) : (ld.textBlocks||[]);
                for (const blk of rawBlocks||[]) {
                    if (blk && Array.isArray(blk.lineIndices) && blk.lineIndices.includes(lineIndex)) {
                        const t = (blk.type||'').toLowerCase();
                        if (t === 'chorus' || t === 'bridge' || t === 'verse') return t;
                        return 'unknown';
                    }
                }
            } catch(_) {}
            return 'unknown';
        }

        _updateAutoVocalGainForLine(lineIndex){
            // Если авто выключено — не мешаем ручной логике
            if (!this.autoVerseOn && !this.autoChorusOn && !this.autoBridgeOn) {
                this.vocalToMainGain.gain.value = this.vocalToMain ? this.vocalHallLevel : 0;
                return;
            }
            // Убедимся, что подключение есть
            if (this.enabled && (this.autoVerseOn || this.autoChorusOn || this.autoBridgeOn)) { this._connectVocalToMain(); }
            const t = this._getBlockTypeByLine(typeof lineIndex === 'number' ? lineIndex : (window.lyricsDisplay ? window.lyricsDisplay.currentLine : 0));
            let target = 0;
            if (t === 'verse' && this.autoVerseOn) target = this.autoVerseLevel;
            if (t === 'chorus' && this.autoChorusOn) target = this.autoChorusLevel;
            else if (t === 'bridge' && this.autoBridgeOn) target = this.autoBridgeLevel;
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

        async listOutputs(){
            try {
                const devices = await navigator.mediaDevices?.enumerateDevices?.();
                return (devices||[]).filter(d=>d.kind==='audiooutput');
            } catch(e){ console.warn('MonitorMix.enumerateDevices failed', e); return []; }
        }

        getState(){
            return { enabled: this.enabled, delayMs: this.delayMs, includeMusic: this.includeMusic, musicLevel: this.musicLevel, outputDeviceId: this.outputDeviceId, mainDeviceId: this.mainDeviceId, routeMainEnabled: this.routeMainEnabled, compensateOn: this.compensateOn, vocalToMain: this.vocalToMain, vocalHallLevel: this.vocalHallLevel };
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
                localStorage.setItem('monitor:autoVerseOn', String(this.autoVerseOn));
                localStorage.setItem('monitor:autoVerseLevel', String(this.autoVerseLevel));
                localStorage.setItem('monitor:autoChorusOn', String(this.autoChorusOn));
                localStorage.setItem('monitor:autoChorusLevel', String(this.autoChorusLevel));
                localStorage.setItem('monitor:autoBridgeOn', String(this.autoBridgeOn));
                localStorage.setItem('monitor:autoBridgeLevel', String(this.autoBridgeLevel));
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

        // ===== AUTO MIX SETTERS =====
        setAutoVerse(on){ this.autoVerseOn = !!on; this._persist(); this._updateAutoVocalGainForLine(); }
        setAutoVerseLevel(level){ this.autoVerseLevel = Math.max(0, Math.min(1, Number(level)||0)); this._persist(); this._updateAutoVocalGainForLine(); }
        setAutoChorus(on){ this.autoChorusOn = !!on; this._persist(); this._updateAutoVocalGainForLine(); }
        setAutoChorusLevel(level){ this.autoChorusLevel = Math.max(0, Math.min(1, Number(level)||0)); this._persist(); this._updateAutoVocalGainForLine(); }
        setAutoBridge(on){ this.autoBridgeOn = !!on; this._persist(); this._updateAutoVocalGainForLine(); }
        setAutoBridgeLevel(level){ this.autoBridgeLevel = Math.max(0, Math.min(1, Number(level)||0)); this._persist(); this._updateAutoVocalGainForLine(); }
    }

    window.MonitorMix = MonitorMix;
    // Создадим глобальный экземпляр, если доступен audioEngine
    try {
        if (!window.monitorMix && window.audioEngine) { window.monitorMix = new MonitorMix(window.audioEngine); }
    } catch(_) {}
})();


