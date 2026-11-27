import { settings } from './Settings';

/**
 * Áudio: efeitos (OGG da Kenney, CC0) e trilha procedural gerada em tempo real
 * (sem arquivos de música pesados — ideal para mobile).
 */
type Mood = 'lobby' | 'flight' | 'work' | 'tense' | 'none';

const SOUNDS = ['jump', 'land', 'coin', 'break', 'fall', 'walking', 'engine', 'impact', 'skid', 'ambience'] as const;
export type SoundId = (typeof SOUNDS)[number] | 'click' | 'whoosh' | 'horn' | 'chime' | 'error' | 'pop' | 'door' | 'success' | 'fail' | 'thruster';

export class AudioSys {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private mood: Mood = 'none';
  private seqTimer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private loops = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  listener = { x: 0, y: 0, z: 0 };

  /** precisa de um gesto do usuário (política dos navegadores) */
  unlock(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyVolumes();
    settings.on(() => this.applyVolumes());
    for (const s of SOUNDS) void this.load(s);
    if (this.mood !== 'none') this.startSeq();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const d = settings.data;
    this.master.gain.value = d.masterVolume;
    this.sfx.gain.value = d.sfxVolume;
    this.music.gain.value = d.musicVolume * 0.5;
  }

  private async load(id: string): Promise<void> {
    if (!this.ctx) return;
    try {
      const r = await fetch(`/assets/sounds/${id}.ogg`);
      const buf = await this.ctx.decodeAudioData(await r.arrayBuffer());
      this.buffers.set(id, buf);
    } catch { /* som opcional */ }
  }

  /** toca um som; com `at` usa atenuação por distância */
  play(id: SoundId, opts: { at?: { x: number; y: number; z: number }; vol?: number; rate?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    let vol = opts.vol ?? 1;
    if (opts.at) {
      const d = Math.hypot(opts.at.x - this.listener.x, opts.at.y - this.listener.y, opts.at.z - this.listener.z);
      vol *= Math.max(0, 1 - d / 35);
      if (vol < 0.02) return;
    }
    const buf = this.buffers.get(id);
    const g = ctx.createGain();
    g.gain.value = vol;
    g.connect(this.sfx);
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = opts.rate ?? 1;
      src.connect(g);
      src.start();
      return;
    }
    this.synth(id, g);
  }

  /** som em loop (motor, ambiente). Ajuste com setLoop. */
  loop(key: string, id: string, vol: number, rate = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    let l = this.loops.get(key);
    let buf = this.buffers.get(id);
    if (!buf && id.startsWith('noise:')) { buf = this.noiseBuffer(); this.buffers.set(id, buf); }
    if (!l && buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      if (id === 'noise:water') {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;
        src.connect(bp).connect(gain).connect(this.sfx);
      } else src.connect(gain).connect(id === 'ambience' ? this.music : this.sfx);
      src.start();
      l = { src, gain };
      this.loops.set(key, l);
    }
    if (l) {
      l.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.15);
      l.src.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.1);
    }
  }
  private noiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 2;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = last * (0.7 + 0.3 * Math.sin(i / 900)); }
    return b;
  }

  stopLoop(key: string): void {
    const l = this.loops.get(key);
    if (!l || !this.ctx) return;
    l.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    const src = l.src;
    setTimeout(() => { try { src.stop(); } catch { /* */ } }, 600);
    this.loops.delete(key);
  }

  /** efeitos sintetizados (UI, buzina, propulsores) */
  private synth(id: SoundId, out: GainNode): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const tone = (f: number, d: number, type: OscillatorType = 'sine', v = 0.3, f2?: number, delay = 0) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t + delay);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + delay + d);
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(v, t + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + d);
      o.connect(g).connect(out);
      o.start(t + delay);
      o.stop(t + delay + d + 0.05);
    };
    switch (id) {
      case 'click': tone(880, 0.06, 'triangle', 0.15); break;
      case 'pop': tone(520, 0.09, 'sine', 0.25, 900); break;
      case 'chime': tone(784, 0.25, 'sine', 0.2); tone(1175, 0.35, 'sine', 0.15, undefined, 0.08); break;
      case 'success': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, undefined, i * 0.1)); break;
      case 'fail': [392, 330, 262].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.08, undefined, i * 0.15)); break;
      case 'error': tone(200, 0.15, 'square', 0.08); break;
      case 'horn': tone(311, 0.9, 'sawtooth', 0.12); tone(392, 0.9, 'sawtooth', 0.1); break;
      case 'whoosh': this.noise(out, 0.9, 400, 2400); break;
      case 'door': this.noise(out, 0.5, 1800, 600); tone(140, 0.2, 'sine', 0.15, undefined, 0.35); break;
      case 'thruster': this.noise(out, 1.6, 200, 900); break;
      default: tone(440, 0.1, 'sine', 0.1);
    }
  }

  private noise(out: GainNode, dur: number, f1: number, f2: number): void {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(f1, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(f2, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.value = 0.35;
    src.connect(f).connect(g).connect(out);
    src.start();
  }

  /* ------------------------- trilha procedural ------------------------- */

  setMood(m: Mood): void {
    if (m === this.mood) return;
    this.mood = m;
    if (this.ctx && m !== 'none') this.startSeq();
  }

  private startSeq(): void {
    if (this.seqTimer !== null || !this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.seqTimer = window.setInterval(() => this.schedule(), 50);
  }

  private schedule(): void {
    const ctx = this.ctx!;
    if (this.mood === 'none') return;
    const bpm = { lobby: 104, flight: 92, work: 124, tense: 84, none: 100 }[this.mood];
    const spb = 60 / bpm / 2; // colcheias
    // progressões (semitons a partir de C4=261.63)
    const prog: Record<Exclude<Mood, 'none'>, number[][]> = {
      lobby: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]],
      flight: [[0, 4, 7, 11], [5, 9, 12, 16], [9, 12, 16, 19], [7, 11, 14, 17]],
      work: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]],
      tense: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 11, 14]],
    };
    while (this.nextTime < ctx.currentTime + 0.25) {
      const chords = prog[this.mood as Exclude<Mood, 'none'>];
      const bar = Math.floor(this.step / 8) % chords.length;
      const chord = chords[bar];
      const s = this.step % 8;
      const t = this.nextTime;
      const hz = (n: number, oct = 0) => 261.63 * Math.pow(2, n / 12 + oct);
      if (s === 0) for (const n of chord) this.note(hz(n, -1), t, spb * 7.5, 'triangle', 0.045, 900);
      // arpejo
      const arp = chord[(s * (this.mood === 'tense' ? 3 : 1)) % chord.length];
      if (this.mood !== 'tense' || s % 2 === 0) this.note(hz(arp, this.mood === 'flight' ? 1 : 0), t, spb * 0.9, 'sine', 0.05, 2400);
      // baixo
      if (s % 4 === 0) this.note(hz(chord[0], -2), t, spb * 3, 'sine', 0.09, 400);
      // percussão leve
      if (this.mood === 'lobby' || this.mood === 'work') {
        if (s % 4 === 0) this.kick(t);
        if (s % 2 === 1) this.hat(t);
      }
      this.nextTime += spb;
      this.step++;
    }
  }

  private note(f: number, t: number, d: number, type: OscillatorType, v: number, cutoff: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = cutoff;
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(fl).connect(g).connect(this.music);
    o.start(t);
    o.stop(t + d + 0.05);
  }
  private kick(t: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + 0.2);
  }
  private hat(t: number): void {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.value = 0.03;
    src.connect(f).connect(g).connect(this.music);
    src.start(t);
  }
}

export const audio = new AudioSys();
