import { PeerConnectionManager } from '../services/peer-connection';
import {
  ControlPayload, ReplayGuard, EnvelopeSender, safeParseEnvelope, isStale,
} from '../types/protocol.types';
import { useRehearsalSessionStore } from '../store/rehearsal-session.store';
import { useAudioStore } from '../../stores/audio.store';
import { useLoopStore } from '../../stores/loop.store';
import { useStemStore } from '../../stem/stem.store';
import { PlaybackWatchdog, DriftCorrector, CommandCoalescer, VirtualClock } from './sync-primitives';

type Role = 'teacher' | 'student';

export class RehearsalTriggerBridge {
  private guard = new ReplayGuard();
  private sender = new EnvelopeSender();
  private coalescer = new CommandCoalescer();
  private watchdog = new PlaybackWatchdog();
  private drift = new DriftCorrector();
  private vclock = new VirtualClock();
  private clockWorker: Worker;
  private pendingApplies = new Map<string, { mediaTime?: number; isPlaying?: boolean }>();
  private driftCheckInterval: ReturnType<typeof setInterval> | null = null;
  private telemetryStats = { worstDriftMs: 0, resyncCount: 0, lastReportAt: 0 };
  private statusEl: HTMLDivElement | null = null;

  /** Сохраняем ссылку на handler для removeEventListener в dispose.
   *  [ПРАВКА ПО ЖИВОМУ ТЕСТУ 2026-07-07]: раньше обработчик ничего
   *  не делал на hide — setInterval в фоне троттлился браузером,
   *  накапливал Date.now() прыжок, и при возврате drift-чек считал
   *  десятки секунд "дрифта" и дёргал seek. Лог: "drift check: 72398.7 ms".
   *  Фикс: на hide — стоп мониторинга, на visible — свежий якорь. */
  private onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.send({ type: 'sync-request' });
      // Переанкоровка: берём текущую реальную позицию как новую точку отсчёта
      if (this.driftCheckInterval != null) {
        const ae = (window as any).audioEngine;
        const t = ae?.getCurrentTime?.() ?? 0;
        this.vclock.anchor(t, ae?.playbackRate ?? 1);
        this.startDriftMonitoring();
      }
    } else {
      this.stopDriftMonitoring(); // таймер в фоне троттлится — не меряем вслепую
    }
  };

  /** Создаёт плашку статуса синхронизации прямо на странице.
   *  Нужна для теста телефона: не требует USB debugging,
   *  просто открываешь страницу и видишь цифры глазами. */
  private createStatusOverlay(): void {
    if (this.statusEl) return;
    const el = document.createElement('div');
    el.id = 'bl-rehearsal-status';
    el.style.cssText = `
      position: fixed; top: 72px; right: 8px; z-index: 99999;
      background: rgba(0,0,0,0.85); color: #0f0; font: 12px/1.4 monospace;
      padding: 10px 14px; border-radius: 8px; border: 1px solid #333;
      min-width: 260px; pointer-events: none; user-select: none;
      backdrop-filter: blur(4px); box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `;
    el.innerHTML = '🔄 connecting...';
    document.body.appendChild(el);
    this.statusEl = el;
  }

  private updateStatusOverlay(): void {
    const el = this.statusEl;
    if (!el) return;
    const s = useRehearsalSessionStore.getState();
    const ae = (window as any).audioEngine;
    const driftMs = (() => {
      try { return ((ae?.getCurrentTime?.() ?? 0) - this.vclock.getPosition()) * 1000; } catch { return 0; }
    })();
    const connIcon = s.connectionState === 'connected' ? '🟢' : s.connectionState === 'reconnecting' ? '🟡' : '🔴';
    const playIcon = useAudioStore.getState().isPlaying ? '▶️' : '⏸';
    el.innerHTML = `
      ${connIcon} <b>${s.connectionState}</b> &nbsp;|&nbsp; 🕐 offset: <b>${s.clockOffset.toFixed(1)}ms</b> &nbsp;|&nbsp; 🔁 rtt: <b>${s.rtt.toFixed(0)}ms</b><br>
      📊 drift: <b>${driftMs.toFixed(1)}ms</b> &nbsp; ${playIcon} ${s.isResyncing ? '🔄 resync' : ''}<br>
      👤 ${s.role ?? '—'} &nbsp;|&nbsp; 🆔 ${s.roomId ?? '—'}
    `;
  }

  private removeStatusOverlay(): void {
    if (this.statusEl) { this.statusEl.remove(); this.statusEl = null; }
  }

  constructor(private pc: PeerConnectionManager, private role: Role) {
    this.clockWorker = new Worker(
      new URL('../workers/clock-scheduler.worker.ts', import.meta.url),
      { type: 'module' },
    );
    this.clockWorker.onmessage = (e) => this.onWorkerFire(e.data);

    pc.onControlMessage = (raw) => this.handleControl(raw);
    pc.onHardReset = () => {
      this.sender.newEpoch();
      this.cancelPendingApplies();
      this.stopDriftMonitoring();
      this.drift.reset(); // [FM-11] не тащим старый бэкофф в новый цикл
    };

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.createStatusOverlay();
    this.updateStatusOverlay();
    // Обновляем плашку при любом изменении состояния сессии
    useRehearsalSessionStore.subscribe(() => this.updateStatusOverlay());

    // ★ Teacher: авто-перехват play/pause/seek — broadcast через bridge
    if (role === 'teacher') this.hijackAudioTransport();
  }

  /** Патчит window.audioEngine.play/pause/seekTo — каждый вызов
   *  автоматически шлёт broadcastTransport удалённому Student'у.
   *  Без этого Phase 3 UI интеграции — teacher тыкает кнопки, student молчит. */
  private hijackAudioTransport() {
    const ae = (window as any).audioEngine;
    if (!ae) { setTimeout(() => this.hijackAudioTransport(), 500); return; }

    const origPlay = ae.play.bind(ae);
    const origPause = ae.pause.bind(ae);
    const origSeekTo = ae.seekTo.bind(ae);

    ae.play = (...args: unknown[]) => {
      const result = origPlay(...args);
      this.broadcastTransport({ type: 'play', mediaTime: ae.getCurrentTime?.() ?? 0, wallClockTime: Date.now() });
      return result;
    };
    ae.pause = (...args: unknown[]) => {
      const result = origPause(...args);
      this.broadcastTransport({ type: 'pause', mediaTime: ae.getCurrentTime?.() ?? 0, wallClockTime: Date.now() });
      return result;
    };
    ae.seekTo = (t: number, ...args: unknown[]) => {
      const result = origSeekTo(t, ...args);
      this.broadcastTransport({ type: 'seek', mediaTime: t, wallClockTime: Date.now() });
      return result;
    };
  }

  // --- Приём ---

  private handleControl(raw: unknown) {
    const envelope = safeParseEnvelope(raw);
    if (!envelope) return;
    if (!this.guard.accept(envelope)) return;

    if (isStale(envelope)) {
      this.send({ type: 'sync-request' });
      return;
    }

    const payload = envelope.payload as ControlPayload;

    switch (payload.type) {
      case 'play':
      case 'pause':
      case 'seek':
        this.coalescer.push(
          {
            mediaTime: 'mediaTime' in payload ? payload.mediaTime : undefined,
            isPlaying: payload.type === 'play' ? true : payload.type === 'pause' ? false : undefined,
          },
          (merged) => this.scheduleApply(merged, 'wallClockTime' in payload ? payload.wallClockTime : Date.now()),
        );
        break;
      case 'state-snapshot':
        this.coalescer.cancel();
        this.applySnapshot(payload);
        break;
      case 'sync-request':
        if (this.role === 'teacher') this.sendSnapshot();
        break;
      case 'set-loop':
        useLoopStore.setState({
          isLooping: true,
          loopStartTime: payload.start,
          loopEndTime: payload.end,
          loopBlockIds: [],
          loopSubBlockKeys: [],
          loopStartLine: null,
          loopEndLine: null,
        });
        break;
      case 'clear-loop':
        useLoopStore.getState().clearLoop();
        break;
      case 'set-stem-volume': {
        const { stemId, volume } = payload;
        (window as any).audioEngine?.setStemVolume?.(stemId, volume);
        useStemStore.getState().setStemVolume(stemId, volume);
        break;
      }
      case 'set-playback-rate': {
        const { rate } = payload;
        (window as any).audioEngine?.setPlaybackRate?.(rate);
        this.vclock.setRate(rate);
        break;
      }
    }
  }

  private scheduleApply(merged: { mediaTime?: number; isPlaying?: boolean }, wallClockTime: number) {
    const localTarget = wallClockTime - this.pc.getClockOffset(); // FM-1: вычитаем offset (он = remote - local)
    const id = crypto.randomUUID();
    this.pendingApplies.set(id, merged);
    this.clockWorker.postMessage({ id, fireAtWallClock: localTarget });
  }

  private onWorkerFire(msg: { id: string; firedAt: number }) {
    const merged = this.pendingApplies.get(msg.id);
    this.pendingApplies.delete(msg.id);
    if (!merged) return;
    const ae = (window as any).audioEngine;
    if (merged.mediaTime != null) {
      ae?.seekTo?.(merged.mediaTime);
      this.vclock.anchor(merged.mediaTime, ae?.playbackRate ?? 1);
    }
    if (merged.isPlaying === true) {
      this.playWithWatchdog();
      this.startDriftMonitoring();
    } else if (merged.isPlaying === false) {
      ae?.pause?.();
      this.stopDriftMonitoring(); // на паузе сверять нечего
    }
  }

  /** РАНЬШЕ ОТСУТСТВОВАЛО: DriftCorrector был спроектирован (3 раунда
   *  обсуждений — экспоненциальный бэкофф) и объявлен полем, но нигде
   *  не вызывался. 007 механически удалил поле как неиспользуемое
   *  (TS6133) — это вскрыло реальный пробел, не косметику для Фазы 3.
   *  Раз в 2с, пока реально играет: сверяем текущий currentTime с тем,
   *  что должно быть по последней точке синхронизации + прошедшему
   *  wall-clock времени. */
  private startDriftMonitoring() {
    this.stopDriftMonitoring();
    this.driftCheckInterval = setInterval(() => {
      const ae = (window as any).audioEngine;
      const expected = this.vclock.getPosition();
      const actual = ae?.getCurrentTime?.() ?? 0;
      const driftMs = (actual - expected) * 1000;
      this.updateStatusOverlay();

      // Telemetry
      if (Math.abs(driftMs) > Math.abs(this.telemetryStats.worstDriftMs)) {
        this.telemetryStats.worstDriftMs = driftMs;
      }
      if (Math.abs(driftMs) > 40) this.telemetryStats.resyncCount++;
      if (Date.now() - this.telemetryStats.lastReportAt > 10000) {
        console.log('[telemetry] drift:', this.telemetryStats.worstDriftMs.toFixed(1),
          'ms, resyncs:', this.telemetryStats.resyncCount);
        this.telemetryStats.lastReportAt = Date.now();
      }

      // getOutputTimestamp cross-check
      if (Math.abs(driftMs) > 100 && ae?.audioContext) {
        try {
          const ts = ae.audioContext.getOutputTimestamp();
          const anchorWall = ts.performanceTime + (ts.contextTime - ae.getCurrentTime()) * 1000;
          if (Math.abs(anchorWall - performance.now()) > 200) {
            console.log('[clock] getOutputTimestamp drift:', (anchorWall - performance.now()).toFixed(1), 'ms');
          }
        } catch {}
      }

      // Защита от артефактов (GC-пауза, троттлинг)
      if (Math.abs(driftMs) > 10000) {
        console.log('[sanity-reanchor] driftMs=', driftMs.toFixed(1), '— re-anchoring');
        this.vclock.anchor(actual, ae?.playbackRate ?? 1);
        return;
      }

      this.drift.maybeCorrect(driftMs, expected, (t) => {
        ae?.seekTo?.(t);
        this.vclock.anchor(t);
      });
    }, 2000);
  }

  private stopDriftMonitoring() {
    if (this.driftCheckInterval != null) clearInterval(this.driftCheckInterval);
    this.driftCheckInterval = null;
  }

  /** Сброс всех отложенных apply'ов — при snapshot или hardReset */
  private cancelPendingApplies() {
    for (const id of this.pendingApplies.keys()) {
      this.clockWorker.postMessage({ cancel: id });
    }
    this.pendingApplies.clear();
  }

  private playWithWatchdog(retriesLeft = 2) {
    const ae = (window as any).audioEngine;
    // [найдено чужой верификацией] ae?.play?.() короткозамыкается в
    // undefined целиком, если ae отсутствует — .catch() на undefined
    // кидает TypeError. Ранний return + прямой вызов ae.play().
    if (!ae?.play) {
      useRehearsalSessionStore.getState().setRequiresUserInteraction(true);
      return;
    }
    void ae.play().catch(() => {
      // iOS autoplay gate — тот же механизм, что и для холодного старта,
      // отдельного пути для "очнулись после сна" не городим (Раунд 3, Слой 2).
      useRehearsalSessionStore.getState().setRequiresUserInteraction(true);
    });
    this.watchdog.start(
      () => ae?.getCurrentTime?.() ?? 0,
      () => {},
      () => { if (retriesLeft > 0) this.playWithWatchdog(retriesLeft - 1); },
    );
  }

  private applySnapshot(s: Extract<ControlPayload, { type: 'state-snapshot' }>) {
    if (s.loop) {
      useLoopStore.setState({
        isLooping: true,
        loopStartTime: s.loop.start,
        loopEndTime: s.loop.end,
        loopBlockIds: [],
        loopSubBlockKeys: [],
        loopStartLine: null,
        loopEndLine: null,
      });
    } else {
      useLoopStore.getState().clearLoop();
    }
    // Применяем stemVolumes (FM-8: были отправлены в sendSnapshot, но не применялись)
    for (const [stemId, volume] of Object.entries(s.stemVolumes)) {
      (window as any).audioEngine?.setStemVolume?.(stemId, volume);
      useStemStore.getState().setStemVolume(stemId, volume);
    }
    (window as any).audioEngine?.seekTo?.(s.currentTime);
    if ('playbackRate' in s) (window as any).audioEngine?.setPlaybackRate?.(s.playbackRate);
    this.vclock.anchor(s.currentTime, s.playbackRate ?? (window as any).audioEngine?.playbackRate ?? 1);
    // Сбрасываем отложенные apply'ы — snapshot приоритетнее, чем pending команды
    this.cancelPendingApplies();
    this.drift.reset(); // [FM-11] свежий snapshot — свежий бэкофф
    if (s.isPlaying) { this.playWithWatchdog(); this.startDriftMonitoring(); }
    else { (window as any).audioEngine?.pause?.(); this.stopDriftMonitoring(); }
    useRehearsalSessionStore.getState().setResyncing(false);
  }

  // --- Отправка ---

  private sendSnapshot() {
    const ae = (window as any).audioEngine;
    const { isLooping, loopStartTime, loopEndTime } = useLoopStore.getState();
    this.send({
      type: 'state-snapshot',
      currentTime: ae?.getCurrentTime?.() ?? 0,
      isPlaying: useAudioStore.getState().isPlaying,
      playbackRate: ae?.playbackRate ?? 1,
      stemVolumes: useStemStore.getState().stemVolumes,
      loop: isLooping && loopStartTime != null && loopEndTime != null
        ? { start: loopStartTime, end: loopEndTime }
        : null,
    });
  }

  private send(payload: ControlPayload) {
    this.pc.controlChannel?.send(JSON.stringify(this.sender.wrap(payload)));
  }

  broadcastTransport(payload: Extract<ControlPayload, { type: 'play' | 'pause' | 'seek' }>) {
    this.send({ ...payload, wallClockTime: Date.now() });
  }

  /** Педагог меняет темп → шлём Student'у */
  broadcastSetPlaybackRate(rate: number): void {
    this.send({ type: 'set-playback-rate', rate });
    this.vclock.setRate(rate);
  }

  dispose() {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.cancelPendingApplies();
    this.clockWorker.terminate();
    this.watchdog.stop();
    this.stopDriftMonitoring();
    this.removeStatusOverlay();
  }
}
