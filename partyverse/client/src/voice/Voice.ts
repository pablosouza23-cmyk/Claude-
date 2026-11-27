/**
 * Chat de voz por proximidade — WebRTC (P2P em malha, ≤10 jogadores) com
 * sinalização pelo servidor do jogo, isolada por mundo (lobby / partida).
 *
 * Envio (microfone):
 *   getUserMedia { echoCancellation, noiseSuppression, autoGainControl }  ← processamento nativo
 *   → passa-alta 100 Hz (vento, zumbido, batidas)
 *   → realce de presença 2.8 kHz (+3 dB, clareza)
 *   → passa-baixa 8 kHz (chiado)
 *   → noise gate (abre com voz, fecha em silêncio; ataque/soltura suaves)
 *   → compressor (nivela a voz) → limitador (-2 dBFS, evita estouro)
 *   → mute → trilha enviada ao WebRTC (Opus)
 * Recepção (por jogador):
 *   stream remoto → ganho por distância (curva suave) → passa-baixa de oclusão
 *   (paredes) → pan estéreo pela direção → volume individual → volume de voz.
 */
import type { CollisionWorld } from '../../../shared/collision';
import { colliderBottom, colliderTop, overlaps2D } from '../../../shared/collision';
import { settings } from '../core/Settings';

export interface VoicePeerInfo { id: number; name: string; pos: { x: number; y: number; z: number } | null }

interface Peer {
  id: number;
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement | null;
  src: MediaStreamAudioSourceNode | null;
  gain: GainNode;
  occl: BiquadFilterNode;
  pan: StereoPannerNode;
  analyser: AnalyserNode;
  level: number;
  speaking: boolean;
  makingOffer: boolean;
  polite: boolean;
  connected: boolean;
}

export type VoiceState = 'off' | 'requesting' | 'on' | 'listen-only' | 'denied' | 'unsupported';

const NEAR = 4; // até aqui, volume cheio (m)
const FAR = 30; // além daqui, silêncio

export class VoiceChat {
  state: VoiceState = 'off';
  micMuted = false;
  /** jogadores silenciados individualmente (userId) */
  readonly blocked = new Set<string>();
  readonly peers = new Map<number, Peer>();
  /** ids que estão com voz ativada no mundo atual */
  readonly voiceIds = new Set<number>();
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private stream: MediaStream | null = null;
  private sendTrack: MediaStreamTrack | null = null;
  private muteGain: GainNode | null = null;
  private gate: GainNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private gateOpen = false;
  private gateHold = 0;
  micLevel = 0;
  selfSpeaking = false;
  iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  myId = 0;
  onChange: (() => void) | null = null;

  constructor(private sendSignal: (to: number, d: unknown) => void, private sendState: (on: boolean, mic: boolean) => void) {
    settings.on(() => this.applyVolume());
  }

  static supported(): boolean {
    return typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  private audioCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      this.out = this.ctx.createGain();
      this.out.connect(this.ctx.destination);
      this.applyVolume();
    }
    void this.ctx.resume();
    return this.ctx;
  }

  private applyVolume(): void {
    if (this.out) this.out.gain.value = settings.data.voiceVolume * settings.data.masterVolume;
  }

  /** Ativa a voz. Pede o microfone; se negado, entra em modo só-ouvir. */
  async enable(): Promise<VoiceState> {
    if (!VoiceChat.supported()) { this.state = 'unsupported'; this.onChange?.(); return this.state; }
    if (this.state === 'on' || this.state === 'listen-only') return this.state;
    this.state = 'requesting';
    this.onChange?.();
    const ctx = this.audioCtx();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 },
        video: false,
      });
      this.buildSendChain(ctx, this.stream);
      this.state = 'on';
    } catch {
      this.state = 'denied';
    }
    this.micMuted = false;
    this.sendState(true, this.state === 'on');
    this.onChange?.();
    // conecta-se a quem já estava com voz
    for (const id of this.voiceIds) this.ensurePeer(id);
    if (this.state === 'denied') this.state = 'listen-only';
    return this.state;
  }

  disable(): void {
    for (const p of [...this.peers.values()]) this.closePeer(p.id);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.sendTrack = null;
    this.state = 'off';
    this.sendState(false, false);
    this.onChange?.();
  }

  setMicMuted(m: boolean): void {
    this.micMuted = m;
    if (this.muteGain && this.ctx) this.muteGain.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
    this.sendState(this.state !== 'off', this.state === 'on' && !m);
    this.onChange?.();
  }

  private buildSendChain(ctx: AudioContext, stream: MediaStream): void {
    const src = ctx.createMediaStreamSource(stream);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 100; hp.Q.value = 0.7;
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking'; presence.frequency.value = 2800; presence.Q.value = 1; presence.gain.value = 3;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 8000; lp.Q.value = 0.7;
    this.micAnalyser = ctx.createAnalyser();
    this.micAnalyser.fftSize = 512;
    this.gate = ctx.createGain();
    this.gate.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -26; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.15;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.05;
    this.muteGain = ctx.createGain();
    const dest = ctx.createMediaStreamDestination();
    src.connect(hp).connect(presence).connect(lp);
    lp.connect(this.micAnalyser);
    lp.connect(this.gate).connect(comp).connect(limiter).connect(this.muteGain).connect(dest);
    this.sendTrack = dest.stream.getAudioTracks()[0];
  }

  /* ------------------------------ sinalização ------------------------------ */

  /** lista de quem tem voz ativa no mundo atual (vinda do servidor) */
  setVoiceIds(ids: number[], myId: number): void {
    this.myId = myId;
    const set = new Set(ids.filter((i) => i !== myId));
    for (const id of [...this.peers.keys()]) if (!set.has(id)) this.closePeer(id);
    this.voiceIds.clear();
    for (const id of set) this.voiceIds.add(id);
    if (this.state === 'on' || this.state === 'listen-only') for (const id of set) this.ensurePeer(id);
    this.onChange?.();
  }

  /** troca de mundo: derruba todas as conexões */
  reset(): void {
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    this.voiceIds.clear();
  }

  private ensurePeer(id: number): Peer {
    let p = this.peers.get(id);
    if (p) return p;
    const ctx = this.audioCtx();
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const occl = ctx.createBiquadFilter();
    occl.type = 'lowpass'; occl.frequency.value = 20000;
    const pan = ctx.createStereoPanner();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    gain.connect(occl).connect(pan).connect(this.out!);
    p = { id, pc, audioEl: null, src: null, gain, occl, pan, analyser, level: 0, speaking: false, makingOffer: false, polite: this.myId > id, connected: false };
    this.peers.set(id, p);
    const peer = p;
    if (this.sendTrack && this.state === 'on') pc.addTrack(this.sendTrack, new MediaStream([this.sendTrack]));
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      // Chrome só entrega áudio remoto ao WebAudio se houver um <audio> consumindo o stream
      const el = new Audio();
      el.srcObject = stream;
      el.muted = true;
      void el.play().catch(() => {});
      peer.audioEl = el;
      peer.src?.disconnect();
      peer.src = ctx.createMediaStreamSource(stream);
      peer.src.connect(peer.analyser);
      peer.src.connect(peer.gain);
    };
    pc.onicecandidate = (ev) => { if (ev.candidate) this.sendSignal(id, { ice: ev.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      peer.connected = pc.connectionState === 'connected';
      if (pc.connectionState === 'failed') { pc.restartIce(); }
      this.onChange?.();
    };
    // "perfect negotiation" (W3C): resolve colisões de oferta
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        this.sendSignal(id, { sdp: pc.localDescription });
      } catch { /* */ } finally { peer.makingOffer = false; }
    };
    return p;
  }

  async onSignal(from: number, d: { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit }): Promise<void> {
    if (this.state !== 'on' && this.state !== 'listen-only') return;
    const p = this.ensurePeer(from);
    const pc = p.pc;
    try {
      if (d.sdp) {
        const collision = d.sdp.type === 'offer' && (p.makingOffer || pc.signalingState !== 'stable');
        if (collision && !p.polite) return;
        await pc.setRemoteDescription(d.sdp);
        if (d.sdp.type === 'offer') {
          await pc.setLocalDescription();
          this.sendSignal(from, { sdp: pc.localDescription });
        }
      } else if (d.ice) {
        try { await pc.addIceCandidate(d.ice); } catch { /* candidato atrasado */ }
      }
    } catch (e) {
      console.warn('[voz] sinalização', e);
    }
  }

  private closePeer(id: number): void {
    const p = this.peers.get(id);
    if (!p) return;
    try { p.pc.close(); } catch { /* */ }
    p.src?.disconnect();
    p.gain.disconnect();
    if (p.audioEl) { p.audioEl.srcObject = null; }
    this.peers.delete(id);
  }

  /* ------------------------------ por quadro ------------------------------ */

  /**
   * Atualiza volumes por proximidade/oclusão/direção, o noise gate e quem está falando.
   * `listener` = posição da cabeça do jogador local; `yaw` = direção da câmera.
   */
  update(listener: { x: number; y: number; z: number }, camYaw: number, info: Map<number, VoicePeerInfo & { userId: string }>, col: CollisionWorld | null, partyIds: Set<number> | null): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    // noise gate do microfone
    if (this.micAnalyser && this.gate) {
      this.micLevel = rms(this.micAnalyser);
      const db = 20 * Math.log10(this.micLevel + 1e-8);
      const open = db > -48;
      if (open) { this.gateHold = 0.3; }
      else this.gateHold -= 1 / 60;
      const want = open || this.gateHold > 0;
      if (want !== this.gateOpen) {
        this.gateOpen = want;
        this.gate.gain.setTargetAtTime(want ? 1 : 0.0, t, want ? 0.01 : 0.12);
      }
      this.selfSpeaking = want && !this.micMuted && this.state === 'on' && db > -45;
    }
    for (const p of this.peers.values()) {
      const pi = info.get(p.id);
      p.level = rms(p.analyser);
      p.speaking = p.level > 0.02;
      let g = 0, cutoff = 20000, panv = 0;
      if (pi && pi.pos && !this.blocked.has(pi.userId)) {
        const dx = pi.pos.x - listener.x, dy = pi.pos.y - listener.y, dz = pi.pos.z - listener.z;
        const d = Math.hypot(dx, dy, dz);
        if (partyIds?.has(p.id)) g = 1; // canal da sala (opcional no lobby)
        else if (d <= NEAR) g = 1;
        else if (d < FAR) { const k = (d - NEAR) / (FAR - NEAR); g = (1 - k) * (1 - k); }
        if (g > 0 && col && !partyIds?.has(p.id) && blockedLine(col, listener, pi.pos)) { g *= 0.45; cutoff = 1400; }
        // direção relativa à câmera para o pan estéreo
        const ang = Math.atan2(dx, dz) - (camYaw + Math.PI);
        panv = Math.max(-0.8, Math.min(0.8, -Math.sin(ang) * Math.min(1, d / 6)));
      }
      p.gain.gain.setTargetAtTime(g, t, 0.15);
      p.occl.frequency.setTargetAtTime(cutoff, t, 0.2);
      p.pan.pan.setTargetAtTime(panv, t, 0.1);
    }
  }

  isSpeaking(id: number): boolean {
    return id === this.myId ? this.selfSpeaking : !!this.peers.get(id)?.speaking;
  }
}

function rms(a: AnalyserNode): number {
  const buf = new Float32Array(a.fftSize);
  a.getFloatTimeDomainData(buf);
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

/** a linha entre ouvinte e falante atravessa alguma parede? (amostragem) */
function blockedLine(col: CollisionWorld, a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.min(24, Math.ceil(d / 0.8));
  const set = new Set<never>();
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k, z = a.z + (b.z - a.z) * k;
    col.query(x, z, 0.1, set as never);
    for (const c of set as Set<import('../../../shared/collision').Collider>) {
      if (c.kind === 'box' && c.noFloor) continue;
      if (y < colliderBottom(c) || y > colliderTop(c)) continue;
      if (colliderTop(c) - colliderBottom(c) < 1.5) continue; // só paredes altas
      if (overlaps2D(x, z, 0.05, c)) return true;
    }
  }
  return false;
}
