// src/character/sound/CharacterSoundManager.ts
// Провайдер-агностик. Слушает ТОЛЬКО aiHub. WebAudio standalone (мимо frozen AudioEngineV2).
// Звук параметризован через CueSpec — data-driven под персонажей (Billy/English/Vocal Coach).
import { aiHub, ASSISTANT_RESPONSE_COMPLETED } from '../../js/ai/registry';
import { getSoundEnabled } from '../../js/ai/settings/ai-settings.store';

export interface CueSpec {
  wave: OscillatorType;
  gain: number;
  dur: number;
  /** контур высоты тона во времени: [freqHz, atSeconds] */
  points: Array<[number, number]>;
}

export type SoundCue =
  | ({ kind: 'synth' } & CueSpec)
  | { kind: 'asset'; url: string; gain: number };

// Дизайн-контракт GPT (HARD CONTRACT §4): 880→1760 Гц, sine, ~0.2с, gain 0.15 — профиль Billy.
export const CUE_DEFAULT: CueSpec = {
  wave: 'sine',
  gain: 0.15,
  dur: 0.2,
  points: [[880, 0], [1760, 0.2]],
};

// Layer-2: мягкий cue прихода отчёта от Mac-команды (440→660, тише)
export const NOTIFY_CUE: CueSpec = {
  wave: 'sine',
  gain: 0.12,
  dur: 0.18,
  points: [[440, 0], [660, 0.18]],
};

export class CharacterSoundManager {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private lastPlayed = 0;
  private assetCache = new Map<string, AudioBuffer>();
  private static COOLDOWN_MS = 400; // защита от двойного фаера и «долбёжки» на каждый токен

  /** Подписка на единственный источник завершения ответа. Звать один раз при старте. */
  init(): void {
    // G2-fix: Billy/Expert-чаты никогда не зовут unlock() → AudioContext спит → звука нет.
    // Гарантируем resume по первому жесту юзера (autoplay-policy), до прихода ответа.
    if (typeof window !== 'undefined') {
      const unlockOnGesture = () => {
        this.unlock();
        window.removeEventListener('pointerdown', unlockOnGesture);
        window.removeEventListener('keydown', unlockOnGesture);
      };
      window.addEventListener('pointerdown', unlockOnGesture);
      window.addEventListener('keydown', unlockOnGesture);
    }
    aiHub.on(ASSISTANT_RESPONSE_COMPLETED, () => this.playCue());
    if (typeof window !== 'undefined') {
      window.addEventListener('team-m.report-arrived', () => this.playNotification());
    }
  }

  /** Жест юзера (клик отправки) → снимаем блокировку AudioContext (autoplay policy). */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setEnabled(v: boolean): void { this.enabled = v; }

  /** Проигрывает cue. По умолчанию — CUE_DEFAULT (контракт §4). Персонажи подменяют cue. */
  playCue(cue: SoundCue = { kind: 'synth', ...CUE_DEFAULT }): void {
    if (!this.enabled || !getSoundEnabled() || !this.ctx || this.ctx.state !== 'running') return;
    const now = performance.now();
    if (now - this.lastPlayed < CharacterSoundManager.COOLDOWN_MS) return;
    this.lastPlayed = now;
    if (cue.kind === 'asset') void this.playAsset(cue);
    else this.blip(cue);
  }

  /** Ассет-ветка (§13.4): декодируем один раз, кэшируем, антиклик-envelope. */
  private async playAsset(cue: { kind: 'asset'; url: string; gain: number }): Promise<void> {
    const ctx = this.ctx!;
    try {
      let buf = this.assetCache.get(cue.url);
      if (!buf) {
        const resp = await fetch(cue.url);
        if (!resp.ok) return;
        const arr = await resp.arrayBuffer();
        buf = await ctx.decodeAudioData(arr);
        this.assetCache.set(cue.url, buf);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(cue.gain, t + 0.01); // attack, антиклик
      gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.1, buf.duration));
      src.connect(gain).connect(ctx.destination);
      src.start(t);
    } catch {
      /* офлайн/нет ассета — тихо без звука (не блокер) */
    }
  }

  /** Layer-2: мягкий cue прихода отчёта от Mac-команды. */
  playNotification(): void {
    this.playCue({ kind: 'synth', ...NOTIFY_CUE });
  }

  private blip(spec: CueSpec): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = spec.wave;
    // Контур высоты тона
    osc.frequency.setValueAtTime(spec.points[0][0], t);
    for (let i = 1; i < spec.points.length; i++) {
      osc.frequency.exponentialRampToValueAtTime(spec.points[i][0], t + spec.points[i][1]);
    }
    // Огибающая громкости
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(spec.gain, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + spec.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + spec.dur + 0.02);
  }
}

export const characterSoundManager = new CharacterSoundManager();
