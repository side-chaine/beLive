import { SignalingClient } from './signaling-client';

export type Role = 'teacher' | 'student';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

interface ClockSample { offset: number; rtt: number; }

export class PeerConnectionManager {
  private pc: RTCPeerConnection;
  private readonly signaling: SignalingClient;
  private readonly polite: boolean;
  private makingOffer = false;
  private ignoreOffer = false;
  private recovering = false;
  private destroyed = false;

  controlChannel: RTCDataChannel | null = null;
  triggerChannel: RTCDataChannel | null = null;

  private clockOffset = 0;
  private rtt = 0;
  private pingSeq = 0;
  private pendingPings = new Map<number, number>();
  private samples: ClockSample[] = [];
  private lastPongAt = 0;

  onRemoteStream: ((stream: MediaStream) => void) | null = null;
  onControlMessage: ((data: string) => void) | null = null;
  onTriggerMessage: ((data: string) => void) | null = null;
  onConnectionStateChange: ((state: RTCPeerConnectionState) => void) | null = null;
  onClockSynced: ((offset: number, rtt: number) => void) | null = null;
  onHardReset: (() => void) | null = null;

  constructor(signaling: SignalingClient, role: Role) {
    this.signaling = signaling;
    this.polite = role === 'student';
    this.pc = this.createPeerConnection();
    this.wireSignaling();
  }

  private createPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.addEventListener('icecandidate', (e) => {
      if (e.candidate) this.signaling.sendICE(e.candidate.toJSON());
    });

    pc.addEventListener('track', (e) => { if (e.streams[0]) this.onRemoteStream?.(e.streams[0]); });

    pc.addEventListener('connectionstatechange', () => {
      this.onConnectionStateChange?.(pc.connectionState);
      if (pc.connectionState === 'failed') void this.recover();
    });

    pc.addEventListener('negotiationneeded', async () => {
      try {
        this.makingOffer = true;
        await pc.setLocalDescription(await pc.createOffer());
        this.signaling.sendSDP(pc.localDescription!.toJSON());
      } catch (err) {
        console.error('[Rehearsal] negotiation error', err);
      } finally {
        this.makingOffer = false;
      }
    });

    pc.addEventListener('datachannel', (e) => this.attachChannel(e.channel));
    return pc;
  }

  private wireSignaling() {
    this.signaling.onSDP = async (sdp) => {
      const offerCollision = sdp.type === 'offer' && (this.makingOffer || this.pc.signalingState !== 'stable');
      this.ignoreOffer = !this.polite && offerCollision;
      if (this.ignoreOffer) return;

      await this.pc.setRemoteDescription(sdp);
      if (sdp.type === 'offer') {
        await this.pc.setLocalDescription(await this.pc.createAnswer());
        this.signaling.sendSDP(this.pc.localDescription!.toJSON());
      }
    };
    this.signaling.onICE = async (candidate) => {
      try { await this.pc.addIceCandidate(candidate); }
      catch (err) { if (!this.ignoreOffer) console.warn('[Rehearsal] ICE candidate error', err); }
    };
  }

  createDataChannels() {
    // Никаких maxRetransmits/maxPacketLifeTime на control — это и есть
    // reliable+ordered канал. maxRetransmits: Infinity — невалидный
    // конфиг (спека требует unsigned short 0-65535).
    const control = this.pc.createDataChannel('control', { ordered: true });
    const trigger = this.pc.createDataChannel('trigger', { ordered: false, maxRetransmits: 0 });
    this.attachChannel(control);
    this.attachChannel(trigger);
  }

  private attachChannel(channel: RTCDataChannel) {
    if (channel.label === 'control') {
      this.controlChannel = channel;
      channel.addEventListener('message', (e) => this.onControlMessage?.(e.data));
    } else if (channel.label === 'trigger') {
      this.triggerChannel = channel;
      channel.addEventListener('open', () => this.startClockSync());
      channel.addEventListener('message', (e) => this.handleTriggerMessage(e.data));
    }
  }

  private handleTriggerMessage(raw: unknown) {
    if (typeof raw !== 'string') return;
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'clock-ping') {
      this.triggerChannel!.send(JSON.stringify({ type: 'clock-pong', seq: msg.seq, t2: Date.now() }));
      return;
    }
    if (msg.type === 'clock-pong') {
      const t4 = Date.now();
      const t1 = this.pendingPings.get(msg.seq);
      this.pendingPings.delete(msg.seq);
      if (t1 == null) return;
      const rtt = t4 - t1;
      this.recordClockSample(msg.t2 - t1 - rtt / 2, rtt);
      return;
    }
    this.onTriggerMessage?.(raw);
  }

  private startClockSync() {
    this.samples = [];
    this.lastPongAt = Date.now();
    this.sendClockPing();
    let rounds = 1;
    const iv = setInterval(() => {
      if (rounds >= 5 || this.triggerChannel?.readyState !== 'open') { clearInterval(iv); return; }
      this.sendClockPing();
      rounds++;
    }, 300);

    setInterval(() => {
      if (this.triggerChannel?.readyState === 'open') this.sendClockPing();
    }, 4000);
  }

  private sendClockPing() {
    const seq = this.pingSeq++;
    this.pendingPings.set(seq, Date.now());
    this.triggerChannel!.send(JSON.stringify({ type: 'clock-ping', seq }));
  }

  private recordClockSample(offset: number, rtt: number) {
    this.lastPongAt = Date.now();
    this.samples.push({ offset, rtt });
    const best = [...this.samples].sort((a, b) => a.rtt - b.rtt).slice(0, 3);
    this.clockOffset = best.reduce((s, x) => s + x.offset, 0) / best.length;
    this.rtt = best.reduce((s, x) => s + x.rtt, 0) / best.length;
    this.onClockSynced?.(this.clockOffset, this.rtt);
  }

  getClockOffset() { return this.clockOffset; }
  getRtt() { return this.rtt; }

  private async recover() {
    if (this.recovering || this.destroyed) return;
    this.recovering = true;

    try {
      if (typeof this.pc.restartIce === 'function') {
        this.pc.restartIce();
      } else {
        this.makingOffer = true;
        const offer = await this.pc.createOffer({ iceRestart: true } as RTCOfferOptions);
        await this.pc.setLocalDescription(offer);
        this.signaling.sendSDP(this.pc.localDescription!.toJSON());
        this.makingOffer = false;
      }

      await new Promise((r) => setTimeout(r, 6000));

      if (this.destroyed) { this.recovering = false; return; }

      const heartbeatAlive = Date.now() - this.lastPongAt < 8000;
      if (this.pc.connectionState === 'connected' || heartbeatAlive) { this.recovering = false; return; }
    } catch (err) {
      console.warn('[Rehearsal] restartIce failed, falling back to hard reset', err);
    }

    if (this.destroyed) { this.recovering = false; return; }
    this.hardReset();
    this.recovering = false;
  }

  private hardReset() {
    this.pc.getSenders().forEach((s) => { try { s.replaceTrack(null); } catch { /* noop */ } });
    this.pc.close();
    this.pc = this.createPeerConnection();
    this.wireSignaling();
    this.controlChannel = null;
    this.triggerChannel = null;
    this.onHardReset?.();
  }

  attachLocalTracks(stream: MediaStream) {
    stream.getTracks().forEach((track) => this.pc.addTrack(track, stream));
  }

  close() {
    this.destroyed = true;
    this.pc.close();
  }
}
