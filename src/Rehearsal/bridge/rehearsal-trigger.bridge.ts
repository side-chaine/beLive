import { PeerConnectionManager } from '../services/peer-connection';
import {
  ControlPayload, ReplayGuard, EnvelopeSender, safeParseEnvelope, isStale,
} from '../types/protocol.types';
import { useRehearsalSessionStore } from '../store/rehearsal-session.store';
import { useAudioStore } from '../../stores/audio.store';
import { useLoopStore } from '../../stores/loop.store';
import { useStemStore } from '../../stem/stem.store';
import { PlaybackWatchdog, DriftCorrector, CommandCoalescer } from './sync-primitives';

type Role = 'teacher' | 'student';

export class RehearsalTriggerBridge {
  private guard = new ReplayGuard();
  private sender = new EnvelopeSender();
  private coalescer = new CommandCoalescer();
  private watchdog = new PlaybackWatchdog();
  private drift = new DriftCorrector();
  private clockWorker: Worker;
  private pendingApplies = new Map<string, { mediaTime?: number; isPlaying?: boolean }>();
  /** Последняя точка "истины": какой mediaTime был на какой момент
   *  wall-clock. От неё считается ожидаемая позиция для фонового
   *  drift-чека. Без этого DriftCorrector нечем кормить. */
  private lastKnownSync: { mediaTime: number; wallClockAtSync: number } | null = null;
  private driftCheckInterval: ReturnType<typeof setInterval> | null = null;

  /** Сохраняем ссылку на handler для removeEventListener в dispose */
  private onVisibilityChange = () => {
    if (document.visibilityState === 'visible') this.send({ type: 'sync-request' });
  };

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
    };

    document.addEventListener('visibilitychange', this.onVisibilityChange);
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
      // Точка отсчёта для фонового drift-чека — берём firedAt из
      // воркера (реальное время срабатывания), а не Date.now() здесь,
      // это чуть точнее.
      this.lastKnownSync = { mediaTime: merged.mediaTime, wallClockAtSync: msg.firedAt };
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
      if (!this.lastKnownSync) return;
      const ae = (window as any).audioEngine;
      const expected = this.lastKnownSync.mediaTime + (Date.now() - this.lastKnownSync.wallClockAtSync) / 1000;
      const actual = ae?.getCurrentTime?.() ?? 0;
      const driftMs = (actual - expected) * 1000;
      // Временный диагностический лог для живого теста (Definition of
      // Done) — по конвенции [test], как onClockSynced в Фазе 1.
      // Убрать после того, как живьём подтвердили что коррекция
      // реально срабатывает, не оставлять в проде — 2с интервал даёт
      // спам в консоль без пользы вне тестовой сессии.
      console.log('[test] drift check:', driftMs.toFixed(1), 'ms', Math.abs(driftMs) > 40 ? '← КОРРЕКЦИЯ' : '');
      this.drift.maybeCorrect(driftMs, expected, (t) => ae?.seekTo?.(t));
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
    // P1-3: ae?.play?.() может вернуть undefined (когда ae или play нет),
    // .catch на undefined бросит TypeError. Проверяем что Promise реально.
    const playPromise = ae?.play?.();
    if (playPromise) playPromise.catch(() => {
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
    // Сбрасываем отложенные apply'ы — snapshot приоритетнее, чем pending команды
    this.cancelPendingApplies();
    this.lastKnownSync = { mediaTime: s.currentTime, wallClockAtSync: Date.now() };
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

  dispose() {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.cancelPendingApplies();
    this.clockWorker.terminate();
    this.watchdog.stop();
    this.stopDriftMonitoring();
  }
}
