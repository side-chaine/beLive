import { useMonitorStore } from '../stores/monitor.store';
import s from './MonitorMixPanel.module.css';

export function MonitorMixPanel() {
  const st = useMonitorStore();

  if (!st.open) return null;

  const devOpts = st.devices.map(d => (
    <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
  ));

  return (
    <div className={s.overlay} onClick={() => st.setOpen(false)}>
      <div className={s.panel} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className={s.header}>
          <h3>🎧 Monitor</h3>
          <button className={s.closeBtn} onClick={() => st.setOpen(false)}>×</button>
        </div>

        {/* ── ROUTING ── */}
        <section className={s.section}>
          <div className={s.sectionTitle}>Routing</div>

          <div className={s.row}>
            <label className={s.label}>
              <input type="checkbox" className={s.chk}
                checked={st.enabled}
                onChange={() => st.enabled ? st.disable() : st.enable()} />
              Enable monitor
            </label>
          </div>

          <div className={s.row}>
            <span className={s.label}>В зал</span>
            <select className={s.select} value={st.mainDeviceId}
              onChange={e => st.setMainOutputDevice(e.target.value)}>
              <option value="">System default</option>
              {devOpts}
            </select>
          </div>

          <div className={s.row}>
            <label className={s.label}>
              <input type="checkbox" className={s.chk}
                checked={st.routeMainEnabled}
                onChange={() => st.setRouteMain(!st.routeMainEnabled)} />
              Музыка в зал
            </label>
          </div>

          <div className={s.row}>
            <span className={s.label}>Наушники</span>
            <select className={s.select} value={st.outputDeviceId}
              onChange={e => st.setOutputDevice(e.target.value)}>
              <option value="">System default</option>
              {devOpts}
            </select>
          </div>

          <Row label="Громкость зала" chk={true}
            onChk={() => {}} hideChk
            val={st.hallVolume} onVal={st.setHallVolume} />

          <Row label="Громкость наушников" chk={true}
            onChk={() => {}} hideChk
            val={st.monitorVolume} onVal={st.setMonitorVolume} />
        </section>

        {/* ── MIX ── */}
        <section className={s.section}>
          <div className={s.sectionTitle}>Подмес</div>

          <Row label="Музыка в наушники" chk={st.includeMusic}
            onChk={() => st.setIncludeMusic(!st.includeMusic)}
            val={st.musicLevel} onVal={st.setMusicLevel} />

          <Row label="Вокал в зал" chk={st.vocalToMain}
            onChk={() => st.setVocalToMain(!st.vocalToMain)}
            val={st.vocalHallLevel} onVal={st.setVocalHallLevel} />

          <Row label="Куплет авто" chk={st.autoVerseOn}
            onChk={() => st.setAutoVerse(!st.autoVerseOn)}
            val={st.autoVerseLevel} onVal={st.setAutoVerseLevel} />

          <Row label="Припев авто" chk={st.autoChorusOn}
            onChk={() => st.setAutoChorus(!st.autoChorusOn)}
            val={st.autoChorusLevel} onVal={st.setAutoChorusLevel} />

          <Row label="Бридж авто" chk={st.autoBridgeOn}
            onChk={() => st.setAutoBridge(!st.autoBridgeOn)}
            val={st.autoBridgeLevel} onVal={st.setAutoBridgeLevel} />
        </section>

        {/* ── DELAY ── */}
        <section className={s.section}>
          <div className={s.sectionTitle}>Задержка</div>

          <div className={s.row}>
            <span className={s.label}>Delay</span>
            <input type="range" className={s.slider}
              min={0} max={1000} value={st.delayMs}
              onChange={e => st.setDelayMs(+e.target.value)} />
            <span className={s.val}>{st.delayMs} ms</span>
          </div>

          <div className={s.row}>
            <span className={s.label}>Компенсация</span>
            <select className={s.select} value={st.compensateOn}
              onChange={e => st.setCompensateTarget(e.target.value as 'monitor' | 'main')}>
              <option value="monitor">В наушниках</option>
              <option value="main">В зале</option>
            </select>
            <button className={s.btnSmall}
              onClick={() => st.setDelayMs(Math.max(0, st.delayMs - 10))}>−10</button>
            <button className={s.btnSmall}
              onClick={() => st.setDelayMs(Math.min(1000, st.delayMs + 10))}>+10</button>
          </div>
        </section>

        {/* ── ACTIONS ── */}
        <div className={s.actions}>
          <button className={s.btnPrimary}
            onClick={async () => { await st.enable(); st.setOpen(false); }}>
            Activate
          </button>
          <button className={s.btn} onClick={() => st.testPulse()}>
            Test 🔊
          </button>
        </div>

        <p className={s.hint}>
          ℹ️ Bluetooth может давать задержку 150–300ms.
          Настройте слайдер или используйте ±10ms.
        </p>
      </div>
    </div>
  );
}

/* ── Reusable row: checkbox + slider + % ── */
function Row({ label, chk, onChk, val, onVal, hideChk }: {
  label: string;
  chk: boolean;
  onChk: () => void;
  val: number;       /* 0-1 */
  onVal: (v: number) => void;
  hideChk?: boolean;
}) {
  return (
    <div className={s.row}>
      <label className={s.label}>
        {!hideChk && <input type="checkbox" className={s.chk} checked={chk} onChange={onChk} />}
        {label}
      </label>
      <input type="range" className={s.slider}
        min={0} max={100} value={Math.round(val * 100)}
        onChange={e => onVal(+e.target.value / 100)} />
      <span className={s.val}>{Math.round(val * 100)}%</span>
    </div>
  );
}
