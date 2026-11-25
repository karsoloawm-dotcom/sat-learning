import type { InstrumentParams, InstrumentType } from '../../state/types';
import { type Instrument, type Voice, VoicePool, envelope, mtof, clamp, noiseBuffer } from './common';
import { DrumKit } from './drums';
import { audioAssets } from '../assets';

// ---------- Pre-rendered tones (plucked strings, piano) ----------
// Physical-ish models are computed once per pitch into an AudioBuffer and cached. Playback is then a cheap
// buffer source, identical in realtime and offline export.

const toneCache = new Map<string, Float32Array>();

function normalize(a: Float32Array, peak: number) {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  if (m > 0) for (let i = 0; i < a.length; i++) a[i] *= peak / m;
  return a;
}

// Karplus-Strong plucked string with fractional-delay tuning.
export function pluckTone(sr: number, freq: number, seconds: number, bright: number, t60: number, pickPos: number) {
  const len = Math.floor(sr * seconds);
  const y = new Float32Array(len);
  const N = sr / freq;
  const D = N - 0.5; // the two-tap averaging filter adds half a sample of delay
  const g = Math.pow(10, -3 / (t60 * freq));
  const excLen = Math.floor(N);
  const exc = new Float32Array(excLen);
  let lp = 0;
  const c = 0.08 + bright * 0.9;
  for (let i = 0; i < excLen; i++) {
    lp += c * (Math.random() * 2 - 1 - lp);
    exc[i] = lp;
  }
  const pick = Math.max(1, Math.round(pickPos * N));
  for (let i = excLen - 1; i >= pick; i--) exc[i] -= exc[i - pick];
  const read = (x: number) => {
    if (x < 0) return 0;
    const i = Math.floor(x);
    const f = x - i;
    return y[i] * (1 - f) + (i + 1 < len ? y[i + 1] : 0) * f;
  };
  for (let n = 0; n < len; n++) {
    const fb = n >= D ? g * 0.5 * (read(n - D) + read(n - D - 1)) : 0;
    y[n] = (n < excLen ? exc[n] : 0) + fb;
  }
  return normalize(y, 0.6);
}

// Additive piano: inharmonic partials, two detuned strings, two-stage decay, hammer thump.
export function pianoTone(sr: number, midi: number) {
  const f = mtof(midi);
  const seconds = clamp(5 - (midi - 40) * 0.06, 1.6, 5);
  const len = Math.floor(sr * seconds);
  const out = new Float32Array(len);
  const B = 0.00008 * Math.pow(2, (midi - 60) / 24);
  const tauSlow = clamp(3.2 - (midi - 48) * 0.04, 0.5, 3.6);
  const P = Math.min(18, Math.floor(9000 / f));
  for (let k = 1; k <= P; k++) {
    const fk = k * f * Math.sqrt(1 + B * k * k);
    if (fk > sr * 0.45) break;
    const amp = (Math.abs(Math.sin(Math.PI * k * 0.12)) + 0.15) / Math.pow(k, 1.05);
    const d1 = Math.exp(-1 / (sr * (0.3 / (1 + 0.3 * k))));
    const d2 = Math.exp(-1 / (sr * (tauSlow / (1 + 0.18 * k))));
    for (const det of [1, 1.0007]) {
      const w = (2 * Math.PI * fk * det) / sr;
      const cw = Math.cos(w);
      const sw = Math.sin(w);
      let c = 1;
      let s = 0;
      let e1 = 0.55 * amp;
      let e2 = 0.45 * amp;
      for (let n = 0; n < len; n++) {
        out[n] += s * (e1 + e2);
        const nc = c * cw - s * sw;
        s = c * sw + s * cw;
        c = nc;
        e1 *= d1;
        e2 *= d2;
      }
    }
  }
  // Hammer: a short burst of low-passed noise.
  let lp = 0;
  const hl = Math.floor(sr * 0.03);
  for (let n = 0; n < hl; n++) {
    lp += 0.2 * (Math.random() * 2 - 1 - lp);
    out[n] += lp * 0.4 * (1 - n / hl);
  }
  // Fade the tail so the buffer end is silent.
  const fl = Math.floor(sr * 0.2);
  for (let n = 0; n < fl; n++) out[len - 1 - n] *= n / fl;
  return normalize(out, 0.6);
}

function cachedBuffer(ctx: BaseAudioContext, key: string, make: () => Float32Array) {
  const k = `${ctx.sampleRate}|${key}`;
  let data = toneCache.get(k);
  if (!data) {
    data = make();
    toneCache.set(k, data);
  }
  const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
  b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
  return b;
}

// ---------- Instruments ----------

abstract class BaseInstrument implements Instrument {
  output: GainNode;
  protected pool = new VoicePool();
  constructor(protected ctx: BaseAudioContext, protected p: InstrumentParams) {
    this.output = ctx.createGain();
  }
  setParams(p: InstrumentParams) {
    this.p = p;
  }
  abstract noteOn(time: number, pitch: number, vel: number, dur?: number): Voice;
  allNotesOff(time: number) {
    this.pool.stopAll(time);
  }
  dispose() {
    this.output.disconnect();
  }
  protected lowpass(freq: number, q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }
  protected osc(type: OscillatorType, freq: number, time: number, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.start(time);
    return o;
  }
}

const STRING_PRESETS: Record<string, { bright: number; t60: number; pick: number; seconds: number; release: number; octaveLayer?: boolean }> = {
  'Clean Strat': { bright: 0.6, t60: 3, pick: 0.14, seconds: 3, release: 0.08 },
  Jangle: { bright: 0.85, t60: 3.5, pick: 0.1, seconds: 3, release: 0.12, octaveLayer: true },
  'Muted Funk': { bright: 0.5, t60: 0.35, pick: 0.2, seconds: 0.8, release: 0.04 },
  'Finger Bass': { bright: 0.22, t60: 3.5, pick: 0.25, seconds: 3, release: 0.06 },
  'Pick Bass': { bright: 0.55, t60: 3, pick: 0.12, seconds: 3, release: 0.06 },
};

export class PluckedString extends BaseInstrument {
  private preset() {
    return STRING_PRESETS[this.p.preset] ?? STRING_PRESETS['Clean Strat'];
  }
  prepare(pitches: number[]) {
    const pr = this.preset();
    for (const p of pitches) this.buffer(p, pr);
  }
  private buffer(pitch: number, pr = this.preset()) {
    return cachedBuffer(this.ctx, `pluck|${this.p.preset}|${pitch}`, () => pluckTone(this.ctx.sampleRate, mtof(pitch), pr.seconds, pr.bright, pr.t60, pr.pick));
  }
  noteOn(time: number, pitch: number, vel: number, dur?: number) {
    const pr = this.preset();
    const srcs: AudioScheduledSourceNode[] = [];
    const lp = this.lowpass(600 + (this.p.tone + 0.3) * 7000 * (0.4 + vel * 0.6));
    const play = (p: number, gain: number) => {
      const s = this.ctx.createBufferSource();
      s.buffer = this.buffer(p, pr);
      const g = this.ctx.createGain();
      g.gain.value = gain;
      s.connect(g).connect(lp);
      s.start(time);
      srcs.push(s);
    };
    play(pitch, 1);
    if (pr.octaveLayer) play(pitch + 12, 0.35);
    const { gain, voice, end } = envelope(this.ctx, this.output, time, vel * 0.9, 0.002, pr.release + this.p.release * 0.2, srcs, dur);
    lp.connect(gain);
    return this.pool.add(voice, end, this.ctx);
  }
}

export class Piano extends BaseInstrument {
  prepare(pitches: number[]) {
    if (this.p.preset === 'Upright Piano') for (const p of pitches) this.buffer(p);
  }
  private buffer(pitch: number) {
    return cachedBuffer(this.ctx, `piano|${pitch}`, () => pianoTone(this.ctx.sampleRate, pitch));
  }
  noteOn(time: number, pitch: number, vel: number, dur?: number) {
    if (this.p.preset === 'Electric Piano') return this.ep(time, pitch, vel, dur);
    if (this.p.preset === 'Organ') return this.organ(time, pitch, vel, dur);
    const s = this.ctx.createBufferSource();
    s.buffer = this.buffer(pitch);
    s.start(time);
    const lp = this.lowpass(900 + vel * vel * 9000 * (this.p.tone + 0.5));
    const { gain, voice, end } = envelope(this.ctx, this.output, time, 0.25 + vel * 0.75, 0.002, 0.15 + this.p.release * 0.3, [s], dur);
    s.connect(lp).connect(gain);
    return this.pool.add(voice, end, this.ctx);
  }
  // Two-operator FM electric piano: the modulation index decays, giving the bark-to-bell tine sound.
  private ep(time: number, pitch: number, vel: number, dur?: number) {
    const f = mtof(pitch);
    const car = this.osc('sine', f, time);
    const mod = this.osc('sine', f, time);
    const modGain = this.ctx.createGain();
    const idx = f * (0.8 + vel * 2.2) * (0.5 + this.p.tone);
    modGain.gain.setValueAtTime(idx, time);
    modGain.gain.setTargetAtTime(idx * 0.12, time, 0.35);
    mod.connect(modGain).connect(car.frequency);
    const bell = this.osc('sine', f * 4.01, time);
    const bellG = this.ctx.createGain();
    bellG.gain.setValueAtTime(0.18 * vel, time);
    bellG.gain.setTargetAtTime(0, time, 0.05);
    const { gain, voice, end } = envelope(this.ctx, this.output, time, 0.2 + vel * 0.55, 0.003, 0.2 + this.p.release * 0.3, [car, mod, bell], dur, { level: 0.0, tau: clamp(2.6 - (pitch - 48) * 0.03, 0.6, 3) });
    car.connect(gain);
    bell.connect(bellG).connect(gain);
    return this.pool.add(voice, end, this.ctx);
  }
  private organ(time: number, pitch: number, vel: number, dur?: number) {
    const f = mtof(pitch);
    const bars: [number, number][] = [[0.5, 0.45], [1, 1], [2, 0.7], [3, 0.35], [4, 0.3], [6, 0.12 + this.p.tone * 0.2], [8, 0.08 + this.p.tone * 0.2]];
    const srcs = bars.filter(([r]) => f * r < 12000).map(([r]) => this.osc('sine', f * r, time));
    const { gain, voice, end } = envelope(this.ctx, this.output, time, 0.12 + vel * 0.08, 0.008, 0.06, srcs, dur);
    srcs.forEach((o, i) => {
      const g = this.ctx.createGain();
      g.gain.value = bars[i][1];
      o.connect(g).connect(gain);
    });
    // Key click.
    const n = this.ctx.createBufferSource();
    n.buffer = noiseBuffer(this.ctx);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.05 * vel, time);
    ng.gain.setTargetAtTime(0, time, 0.004);
    n.connect(this.lowpass(3000)).connect(ng).connect(this.output);
    n.start(time);
    n.stop(time + 0.05);
    return this.pool.add(voice, end, this.ctx);
  }
}

export class Synth extends BaseInstrument {
  noteOn(time: number, pitch: number, vel: number, dur?: number) {
    const f = mtof(pitch);
    const pr = this.p.preset;
    const t = this.p.tone;
    let srcs: OscillatorNode[];
    let lp: BiquadFilterNode;
    let attack = this.p.attack;
    let release = this.p.release;
    let decay: { level: number; tau: number } | undefined;
    if (pr === 'Warm Pad') {
      srcs = [this.osc('sawtooth', f, time, -this.p.detune), this.osc('sawtooth', f, time, this.p.detune), this.osc('triangle', f / 2, time)];
      lp = this.lowpass(300 + t * 3500, 1);
      attack = Math.max(0.25, attack);
      release = Math.max(0.7, release);
    } else if (pr === 'Square Pluck') {
      srcs = [this.osc('square', f, time), this.osc('square', f * 2, time, this.p.detune)];
      lp = this.lowpass(300, 2);
      lp.frequency.setValueAtTime(800 + t * 7000 * vel, time);
      lp.frequency.setTargetAtTime(300, time, 0.08);
      decay = { level: 0.0, tau: 0.35 };
      release = Math.min(release, 0.15);
    } else if (pr === 'Synth Bass') {
      srcs = [this.osc('sawtooth', f, time), this.osc('square', f / 2, time)];
      lp = this.lowpass(200, 5);
      lp.frequency.setValueAtTime(400 + t * 3000 * vel, time);
      lp.frequency.setTargetAtTime(180, time, 0.12);
      release = Math.min(release, 0.12);
    } else {
      // Saw Lead
      srcs = [this.osc('sawtooth', f, time, -this.p.detune / 2), this.osc('sawtooth', f, time, this.p.detune / 2)];
      lp = this.lowpass(1200, 3);
      lp.frequency.setValueAtTime(1500 + t * 8000, time);
      lp.frequency.setTargetAtTime(900 + t * 3000, time, 0.2);
      release = Math.min(release, 0.25);
    }
    const peak = (pr === 'Synth Bass' ? 0.35 : 0.18) * (0.4 + vel * 0.6);
    const { gain, voice, end } = envelope(this.ctx, this.output, time, peak, Math.max(0.003, attack), release, srcs, dur, decay);
    for (const o of srcs) o.connect(lp);
    lp.connect(gain);
    return this.pool.add(voice, end, this.ctx);
  }
}

// Plays a user sample, pitched chromatically from its root note (or unpitched in One-shot mode).
export class Sampler extends BaseInstrument {
  noteOn(time: number, pitch: number, vel: number, dur?: number) {
    const buf = this.p.sampleId ? audioAssets.get(this.p.sampleId) : undefined;
    if (!buf) return { release() {}, stop() {} };
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    if (this.p.preset !== 'One-shot') s.playbackRate.value = Math.pow(2, (pitch - (this.p.rootNote ?? 60)) / 12);
    s.start(time);
    const length = buf.duration / s.playbackRate.value;
    const hold = this.p.preset === 'One-shot' ? length : dur;
    const { gain, voice, end } = envelope(this.ctx, this.output, time, vel, 0.002, Math.max(0.02, this.p.release * 0.5), [s], hold);
    s.connect(gain);
    return this.pool.add(voice, Math.min(end, time + length + 0.1), this.ctx);
  }
}

class Silent extends BaseInstrument {
  noteOn(): Voice {
    return { release() {}, stop() {} };
  }
}

export function createInstrument(ctx: BaseAudioContext, type: InstrumentType, p: InstrumentParams): Instrument {
  switch (type) {
    case 'drums':
      return new DrumKit(ctx, p);
    case 'bass':
      return p.preset === 'Synth Bass' ? new Synth(ctx, p) : new PluckedString(ctx, p);
    case 'guitar':
      return new PluckedString(ctx, p);
    case 'keys':
      return new Piano(ctx, p);
    case 'synth':
      return new Synth(ctx, p);
    case 'sampler':
      return new Sampler(ctx, p);
    default:
      return new Silent(ctx, p);
  }
}
