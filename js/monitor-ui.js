/**
 * UI для настроек мониторинга (модальное окно как Styles)
 * Первая версия: только UI + события. Аудиограф реализуем отдельно (MonitorMix).
 */
(function(){
    try { console.log('MonitorUI: script loaded'); } catch(_) {}
    class MonitorUI {
        constructor(app){
            this.app = app;
            this.panel = null;
            this.opened = false;
            this._bind();
            this._monitorActive = false;
        }

        _bind(){
            const attach = ()=>{
                const btn = document.getElementById('monitor-btn');
                if (btn && !btn.__monitorBound) {
                    btn.addEventListener('click', ()=> { try { console.log('MonitorUI: button click'); } catch(_) {}; this.toggle(); });
                    btn.__monitorBound = true;
                    try { console.log('MonitorUI: button bound'); } catch(_) {}
                }
            };
            if (document.readyState === 'loading') {
                window.addEventListener('DOMContentLoaded', attach);
            } else {
                attach();
            }
            // Экспортируем глобальный вызов на всякий случай
            window.openMonitor = ()=> this.toggle();
            window.__openMonitorForce = ()=> { try { this._createPanel(); this.panel.style.display = 'block'; } catch(e) { console.warn('openMonitorForce failed', e); } };
        }

        async toggle(){
            try { console.log('MonitorUI: toggle()'); } catch(_) {}
            if (!this.panel) { this._createPanel(); }
            const shown = this.panel.style.display === 'block';
            this.panel.style.display = shown ? 'none' : 'block';
            // Поднимем поверх всего
            try { this.panel.style.zIndex = '999999'; } catch(_) {}
            this.opened = !shown;
            if (this.opened) { await this._refreshOutputs(); }
            // обновим фидбэк на кнопке
            const mix = window.app?.monitorMix || window.monitorMix;
            if (mix) this._markMonitorButtonActive(!!mix.getState().enabled, mix);
        }

        _createPanel(){
            const container = document.createElement('div');
            container.id = 'monitor-modal';
            container.className = '';
            container.innerHTML = `
                <div class="modal-content small">
                    <div class="modal-header">
                        <h3>Monitor</h3>
                        <button id="monitor-close" class="close-btn">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <label><input type="checkbox" id="monitor-enable"> Enable monitor</label>
                        </div>
                        <div class="row">
                            <label>Main output</label>
                            <select id="monitor-main-output"></select>
                            <label style="margin-left:8px;display:flex;align-items:center;gap:6px"><input type="checkbox" id="monitor-route-main"> Route instrumental here</label>
                        </div>
                        <div class="row">
                            <label>Monitor output</label>
                            <select id="monitor-output"></select>
                        </div>
                        <div class="row">
                            <label><input type="checkbox" id="monitor-inc-music"> Include music</label>
                            <input type="range" id="monitor-music-level" min="0" max="100" value="15">
                        </div>
                        <div class="row">
                            <label><input type="checkbox" id="monitor-vocal-hall"> Include vocal to Main (hall)</label>
                            <input type="range" id="monitor-vocal-hall-level" min="0" max="100" value="20">
                        </div>
                        <div class="row" style="margin-top:6px">
                            <label style="min-width:110px"><input type="checkbox" id="monitor-auto-verse"> Verse auto</label>
                            <input type="range" id="monitor-auto-verse-level" min="0" max="100" value="10">
                        </div>
                        <div class="row">
                            <label style="min-width:110px"><input type="checkbox" id="monitor-auto-chorus"> Chorus auto</label>
                            <input type="range" id="monitor-auto-chorus-level" min="0" max="100" value="30">
                        </div>
                        <div class="row">
                            <label style="min-width:110px"><input type="checkbox" id="monitor-auto-bridge"> Bridge auto</label>
                            <input type="range" id="monitor-auto-bridge-level" min="0" max="100" value="25">
                        </div>
                        <div class="row">
                            <label>Delay <span id="monitor-delay-label">120 ms</span></label>
                            <input type="range" id="monitor-delay" min="0" max="1000" value="120">
                        </div>
                        <div class="row" style="gap:8px;align-items:center">
                            <label>Compensate on</label>
                            <select id="monitor-compensate">
                                <option value="monitor">Monitor (AirPods)</option>
                                <option value="main">Main (3.5mm)</option>
                            </select>
                            <button id="monitor-minus-10" class="unified-btn">-10ms</button>
                            <button id="monitor-plus-10" class="unified-btn">+10ms</button>
                        </div>
                        <div class="row" style="justify-content:flex-end;gap:8px">
                            <button id="monitor-activate" class="unified-btn">Activate</button>
                        </div>
                        <div class="row">
                            <button id="monitor-test" class="unified-btn">Test</button>
                        </div>
                        <p class="help">Bluetooth может давать задержку. Используйте слайдер для подстройки. Для лучшей синхронизации — проводные наушники.</p>
                    </div>
                </div>`;
            document.body.appendChild(container);
            this.panel = container;

            // Минимальные inline-стили, чтобы модалка была видна даже без CSS
            try {
                this.panel.style.position = 'fixed';
                this.panel.style.left = '0';
                this.panel.style.top = '0';
                this.panel.style.right = '0';
                this.panel.style.bottom = '0';
                this.panel.style.background = 'rgba(0,0,0,0.45)';
                this.panel.style.zIndex = '999999';
                this.panel.style.display = 'none';
                const content = this.panel.querySelector('.modal-content');
                if (content) {
                    content.style.position = 'absolute';
                    content.style.left = '50%';
                    content.style.top = '50%';
                    content.style.transform = 'translate(-50%, -50%)';
                    content.style.width = 'min(92vw, 520px)';
                    content.style.background = '#111';
                    content.style.borderRadius = '12px';
                    content.style.padding = '16px 16px 12px';
                    content.style.color = '#eaeaea';
                    content.style.boxShadow = '0 8px 24px rgba(0,0,0,.5)';
                    content.style.zIndex = '1000000';
                }
            } catch(_) {}

            // bind controls
            this.els = {
                close: document.getElementById('monitor-close'),
                enable: document.getElementById('monitor-enable'),
                mainOutput: document.getElementById('monitor-main-output'),
                routeMain: document.getElementById('monitor-route-main'),
                output: document.getElementById('monitor-output'),
                inc: document.getElementById('monitor-inc-music'),
                level: document.getElementById('monitor-music-level'),
                vocalHall: document.getElementById('monitor-vocal-hall'),
                vocalHallLevel: document.getElementById('monitor-vocal-hall-level'),
                autoVerse: document.getElementById('monitor-auto-verse'),
                autoVerseLevel: document.getElementById('monitor-auto-verse-level'),
                autoChorus: document.getElementById('monitor-auto-chorus'),
                autoChorusLevel: document.getElementById('monitor-auto-chorus-level'),
                autoBridge: document.getElementById('monitor-auto-bridge'),
                autoBridgeLevel: document.getElementById('monitor-auto-bridge-level'),
                delay: document.getElementById('monitor-delay'),
                delayLabel: document.getElementById('monitor-delay-label'),
                test: document.getElementById('monitor-test'),
                compensate: document.getElementById('monitor-compensate'),
                minus10: document.getElementById('monitor-minus-10'),
                plus10: document.getElementById('monitor-plus-10'),
                btPreset: document.getElementById('monitor-bt-preset'),
                activate: document.getElementById('monitor-activate')
            };
            this.els.close.addEventListener('click', ()=> this.toggle());

            // Взаимодействие с MonitorMix если есть
            this._wireToMonitorMix();
        }

        _wireToMonitorMix(){
            const mix = window.app?.monitorMix || window.monitorMix;
            if (!mix) { return; }
            const st = mix.getState();
            this.els.enable.checked = st.enabled;
            if (this.els.routeMain) this.els.routeMain.checked = !!st.routeMainEnabled;
            this.els.inc.checked = st.includeMusic;
            this.els.level.value = Math.round(st.musicLevel*100);
            if (this.els.vocalHall) this.els.vocalHall.checked = !!st.vocalToMain;
            if (this.els.vocalHallLevel) this.els.vocalHallLevel.value = Math.round((st.vocalHallLevel||0.2)*100);
            if (this.els.autoVerse) this.els.autoVerse.checked = !!st.autoVerseOn;
            if (this.els.autoVerseLevel) this.els.autoVerseLevel.value = Math.round((st.autoVerseLevel||0.1)*100);
            if (this.els.autoChorus) this.els.autoChorus.checked = !!st.autoChorusOn;
            if (this.els.autoChorusLevel) this.els.autoChorusLevel.value = Math.round((st.autoChorusLevel||0.3)*100);
            if (this.els.autoBridge) this.els.autoBridge.checked = !!st.autoBridgeOn;
            if (this.els.autoBridgeLevel) this.els.autoBridgeLevel.value = Math.round((st.autoBridgeLevel||0.25)*100);
            this.els.delay.value = String(st.delayMs);
            this.els.delayLabel.textContent = `${st.delayMs} ms`;
            if (this.els.compensate) this.els.compensate.value = st.compensateOn || 'monitor';

            this.els.enable.onchange = async ()=>{ if (this.els.enable.checked) { await mix.enable(); } else { mix.disable(); } };
            this.els.output.onchange = async ()=>{ await mix.setOutputDevice(this.els.output.value); };
            if (this.els.mainOutput) this.els.mainOutput.onchange = async ()=>{ await mix.setMainOutputDevice(this.els.mainOutput.value); };
            if (this.els.routeMain) this.els.routeMain.onchange = async ()=>{ await mix.setRouteMain(this.els.routeMain.checked); };
            this.els.inc.onchange = ()=> mix.setIncludeMusic(this.els.inc.checked);
            this.els.level.oninput = ()=> mix.setMusicLevel(this.els.level.value/100);
            if (this.els.vocalHall) this.els.vocalHall.onchange = ()=> mix.setVocalToMain(this.els.vocalHall.checked);
            if (this.els.vocalHallLevel) this.els.vocalHallLevel.oninput = ()=> mix.setVocalHallLevel(this.els.vocalHallLevel.value/100);
            if (this.els.autoVerse) this.els.autoVerse.onchange = ()=> mix.setAutoVerse(this.els.autoVerse.checked);
            if (this.els.autoVerseLevel) this.els.autoVerseLevel.oninput = ()=> mix.setAutoVerseLevel(this.els.autoVerseLevel.value/100);
            if (this.els.autoChorus) this.els.autoChorus.onchange = ()=> mix.setAutoChorus(this.els.autoChorus.checked);
            if (this.els.autoChorusLevel) this.els.autoChorusLevel.oninput = ()=> mix.setAutoChorusLevel(this.els.autoChorusLevel.value/100);
            if (this.els.autoBridge) this.els.autoBridge.onchange = ()=> mix.setAutoBridge(this.els.autoBridge.checked);
            if (this.els.autoBridgeLevel) this.els.autoBridgeLevel.oninput = ()=> mix.setAutoBridgeLevel(this.els.autoBridgeLevel.value/100);
            this.els.delay.oninput = ()=> { mix.setDelayMs(Number(this.els.delay.value)); this.els.delayLabel.textContent = `${this.els.delay.value} ms`; };
            this.els.test.onclick = ()=> mix.testPulse();
            if (this.els.compensate) this.els.compensate.onchange = ()=> { mix.setCompensateTarget(this.els.compensate.value); };
            if (this.els.minus10) this.els.minus10.onclick = ()=> { const v = Math.max(0, Number(this.els.delay.value)-10); this.els.delay.value = String(v); this.els.delay.dispatchEvent(new Event('input')); };
            if (this.els.plus10) this.els.plus10.onclick = ()=> { const v = Math.min(1000, Number(this.els.delay.value)+10); this.els.delay.value = String(v); this.els.delay.dispatchEvent(new Event('input')); };
            if (this.els.activate) this.els.activate.onclick = async ()=> { this.els.enable.checked = true; await mix.enable(); this._markMonitorButtonActive(true, mix); this.toggle(); };
        }

        _markMonitorButtonActive(on, mix){
            try {
                const btn = document.getElementById('monitor-btn');
                if (!btn) return;
                if (on) {
                    btn.style.background = '#2ecc71';
                    btn.style.color = '#000';
                    const devSel = this.els?.output || document.getElementById('monitor-output');
                    const devLabel = (devSel && devSel.options && devSel.selectedIndex >= 0) ? devSel.options[devSel.selectedIndex].textContent : '';
                    btn.title = devLabel ? `Monitor: ${devLabel}` : 'Monitor enabled';
                } else {
                    btn.style.background = '';
                    btn.style.color = '';
                    btn.title = '';
                }
            } catch(_) {}
        }

        async _refreshOutputs(){
            const mix = window.app?.monitorMix || window.monitorMix || window.monitorMix;
            if (!mix) { return; }
            try {
                let outs = await mix.listOutputs();
                const labelsMissing = !outs || outs.length <= 2 || outs.every(d => !d.label);
                if (labelsMissing && navigator.mediaDevices?.getUserMedia) {
                    try { await navigator.mediaDevices.getUserMedia({ audio: true }); outs = await mix.listOutputs(); } catch(_) {}
                }
                const fill = (sel, selectedId)=>{
                    if (!sel) return;
                    sel.innerHTML = '';
                    const def = document.createElement('option'); def.value=''; def.textContent='System default'; sel.appendChild(def);
                    (outs||[]).forEach(d=>{
                        const o=document.createElement('option');
                        o.value=d.deviceId; o.textContent=d.label || (d.deviceId==='default' ? 'System default' : `Device ${d.deviceId.slice(-4)}`);
                        sel.appendChild(o);
                    });
                    if (selectedId) sel.value = selectedId;
                };
                fill(this.els.output, mix.outputDeviceId);
                fill(this.els.mainOutput, mix.mainDeviceId);
            } catch(e){ console.warn('MonitorUI: list outputs failed', e); }
        }
    }

    // Экспорт и ранняя инициализация
    window.MonitorUI = MonitorUI;
    if (!window.monitorUI) { window.monitorUI = new MonitorUI(window.app || null); }
    if (!window.openMonitor) { window.openMonitor = () => window.monitorUI.toggle(); }
})();


