import type { Effect, EffectType } from '../state/types';

// Every effect is a small node graph between `input` and `output`. `set` applies parameters smoothly.
// Bypass is handled by the channel (it re-wires around disabled effects), not here.
export interface FxUnit {
  type: EffectType;
  input: GainNode;
  output: GainNode;
  set(params: Record<string, number>, bpm: number, time?: number): void;
  setParam(key: string, value: number, time: number, ramp: 'set' | 'linear'): void;
  dispose(): void;
}

const SMOOTH = 0.015;

function tanhCurve(amount: number, asym = 0) {
  const n = 2048;
  const c = new Float32Array(n);
  const k = 1 + amount * 40;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * (x + asym)) / Math.tanh(k) - Math.tanh(k * asym) / Math.tanh(k);
  }
  return c;
}

// The tanh curve multiplies a typical guitar-level signal (`ref`) by up to ~k; divide that out so drive
// adds grit and sustain, not raw loudness. `target` is the gain kept at that reference level.
function compensate(amount: number, pre: number, target: number, ref = 0.15) {
  const k = 1 + amount * 40;
  const gainAtRef = Math.tanh(k * pre * ref) / Math.tanh(k) / ref;
  return target / gainAtRef;
}

abstract class Base implements FxUnit {
  input: GainNode;
  output: GainNode;
  protected dry: GainNode;
  protected wet: GainNode;
  protected params: Record<string, number> = {};
  protected bpm = 120;
  constructor(protected ctx: BaseAudioContext, public type: EffectType) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.input.connect(this.dry).connect(this.output);
    this.wet.connect(this.output);
  }
  protected p(param: AudioParam, v: number, time?: number) {
    if (time === 0) {
      param.value = v; // construction: no ramp from the node's default
      return;
    }
    param.setTargetAtTime(v, time ?? this.ctx.currentTime, SMOOTH);
  }
  protected mix(m: number, time?: number) {
    // Equal-power crossfade.
    this.p(this.dry.gain, Math.cos((m * Math.PI) / 2), time);
    this.p(this.wet.gain, Math.sin((m * Math.PI) / 2), time);
  }
  set(params: Record<string, number>, bpm: number, time?: number) {
    this.bpm = bpm;
    for (const [k, v] of Object.entries(params)) {
      if (this.params[k] === v) continue;
      this.params[k] = v;
      this.apply(k, v, time);
    }
  }
  setParam(key: string, value: number, time: number, ramp: 'set' | 'linear') {
    this.params[key] = value;
    this.applyAt(key, value, time, ramp);
  }
  // Automation path: by default reuse apply (smoothed). Units with direct AudioParams override for exact ramps.
  protected applyAt(key: string, value: number, time: number, _ramp: 'set' | 'linear') {
    this.apply(key, value, time);
  }
  protected abstract apply(key: string, v: number, time?: number): void;
  dispose() {
    this.input.disconnect();
    this.output.disconnect();
  }
}

class Distortion extends Base {
  private pre: GainNode;
  private shaper: WaveShaperNode;
  private tone: BiquadFilterNode;
  private post: GainNode;
  constructor(ctx: BaseAudioContext) {
    super(ctx, 'distortion');
    this.pre = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '4x';
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.post = ctx.createGain();
    this.input.connect(this.pre).connect(this.shaper).connect(this.tone).connect(this.post).connect(this.wet);
  }
  protected apply(k: string, v: number, time?: number) {
    if (k === 'drive') {
      this.shaper.curve = tanhCurve(v, 0.05);
      this.p(this.pre.gain, 1 + v * 3, time);
      this.p(this.post.gain, compensate(v, 1 + v * 3, 1.4), time);
    } else if (k === 'tone') this.p(this.tone.frequency, 800 * Math.pow(12, v), time);
    else if (k === 'mix') this.mix(v, time);
  }
}

class Chorus extends Base {
  private lfo: OscillatorNode;
  private depthL: GainNode;
  private depthR: GainNode;
  constructor(ctx: BaseAudioContext) {
    super(ctx, 'chorus');
    const dl = ctx.createDelay(0.05);
    const dr = ctx.createDelay(0.05);
    dl.delayTime.value = 0.012;
    dr.delayTime.value = 0.017;
    this.lfo = ctx.createOscillator();
    this.depthL = ctx.createGain();
    this.depthR = ctx.createGain();
    this.lfo.connect(this.depthL).connect(dl.delayTime);
    this.lfo.connect(this.depthR).connect(dr.delayTime);
    this.lfo.start();
    const merger = ctx.createChannelMerger(2);
    this.input.connect(dl).connect(merger, 0, 0);
    this.input.connect(dr).connect(merger, 0, 1);
    merger.connect(this.wet);
  }
  protected apply(k: string, v: number, time?: number) {
    if (k === 'rate') this.p(this.lfo.frequency, v, time);
    else if (k === 'depth') {
      this.p(this.depthL.gain, v * 0.006, time);
      this.p(this.depthR.gain, -v * 0.006, time);
    } else if (k === 'mix') this.mix(v, time);
  }
  dispose() {
    this.lfo.stop();
    super.dispose();
  }
}

class Delay extends Base {
  private delay: DelayNode;
  private fb: GainNode;
  private tone: BiquadFilterNode;
  constructor(ctx: BaseAudioContext) {
    super(ctx, 'delay');
    this.delay = ctx.createDelay(4);
    this.fb = ctx.createGain();
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.input.connect(this.delay).connect(this.tone).connect(this.fb).connect(this.delay);
    this.tone.connect(this.wet);
  }
  set(params: Record<string, number>, bpm: number, time?: number) {
    const tempoChanged = bpm !== this.bpm;
    super.set(params, bpm, time);
    if (tempoChanged) this.apply('time', params.time, time);
  }
  protected apply(k: string, v: number, time?: number) {
    if (k === 'time') this.p(this.delay.delayTime, Math.min(4, (v * 60) / this.bpm), time);
    else if (k === 'feedback') this.p(this.fb.gain, v, time);
    else if (k === 'tone') this.p(this.tone.frequency, 600 * Math.pow(20, v), time);
    else if (k === 'mix') this.mix(v, time);
  }
}

// Exponentially decaying stereo noise, progressively low-passed: a cheap but convincing room.
function impulse(ctx: BaseAudioContext, seconds: number, damp: number) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const coef = 1 - damp * 0.9 * t; // brighter early, darker late
      lp += coef * (Math.random() * 2 - 1 - lp);
      d[i] = lp * Math.pow(1 - t, 3) * (i < ctx.sampleRate * 0.004 ? i / (ctx.sampleRate * 0.004) : 1);
    }
  }
  return b;
}

class Reverb extends Base {
  private conv: ConvolverNode;
  private pending = 0;
  constructor(ctx: BaseAudioContext) {
    super(ctx, 'reverb');
    this.conv = ctx.createConvolver();
    const pre = ctx.createDelay(0.1);
    pre.delayTime.value = 0.012;
    this.input.connect(pre).connect(this.conv).connect(this.wet);
  }
  protected apply(k: string, v: number, time?: number) {
    if (k === 'mix') return this.mix(v, time);
    // Size/damping rebuild the impulse; debounce while a knob is being dragged.
    const rebuild = () => (this.conv.buffer = impulse(this.ctx, this.params.size ?? 2, this.params.damp ?? 0.4));
    if (!(this.ctx instanceof AudioContext)) return queueMicrotask(rebuild);
    clearTimeout(this.pending);
    this.pending = window.setTimeout(rebuild, this.conv.buffer ? 120 : 0);
  }
  set(params: Record<string, number>, bpm: number, time?: number) {
    super.set(params, bpm, time);
    if (!this.conv.buffer && !(this.ctx instanceof AudioContext)) this.conv.buffer = impulse(this.ctx, params.size, params.damp);
  }
}

class Compressor extends Base {
  private comp: DynamicsCompressorNode;
  private makeup: GainNode;
  constructor(ctx: BaseAudioContext) {
    super(ctx, 'compressor');
    this.dry.gain.value = 0;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.knee.value = 6;
    this.makeup = ctx.createGain();
    this.input.connect(this.comp).connect(this.makeup).connect(this.wet);
  }
  protected apply(k: string, v: number, time?: number) {
    const c = this.comp;
    const cur = this.params;
    if (k === 'threshold') this.p(c.threshold, v, time);
    else if (k === 'ratio') this.p(c.ratio, v, time);
    else if (k === 'attack') this.p(c.attack, v, time);
    else if (k === 'release') this.p(c.release, v, time);
    if (k === 'threshold' || k === 'ratio' || k === 'makeup') this.p(this.makeup.gain, Math.pow(10, ((cur.makeup ?? 0) - autoMakeupDb(cur.threshold, cur.ratio)) / 20), time);
  }
  reduction() {
    return this.comp.reduction;
  }
}

class EQ extends Base {
  private lo: BiquadFilterNode;
  private mid: BiquadFilterNode;
  private hi: BiquadFilterNode;
  constructor(ctx: BaseAudioContext) {
    super(ctx, 'eq');
    this.dry.gain.value = 0;
    const f = (type: BiquadFilterType, freq: number) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = freq;
      return b;
    };
    this.lo = f('lowshelf', 120);
    this.mid = f('peaking', 1000);
    this.mid.Q.value = 0.9;
    this.hi = f('highshelf', 6000);
    this.input.connect(this.lo).connect(this.mid).connect(this.hi).connect(this.wet);
  }
  protected apply(k: string, v: number, time?: number) {
    if (k === 'low') this.p(this.lo.gain, v, time);
    else if (k === 'mid') this.p(this.mid.gain, v, time);
    else if (k === 'midFreq') this.p(this.mid.frequency, v, time);
    else if (k === 'high') this.p(this.hi.gain, v, time);
  }
}

// Preamp clipping -> tone stack -> speaker cabinet response.
class Amp extends Base {
  private pre: GainNode;
  private shaper: WaveShaperNode;
  private bass: BiquadFilterNode;
  private midF: BiquadFilterNode;
  private treble: BiquadFilterNode;
  private level: GainNode;
  private makeup: GainNode;
  constructor(ctx: BaseAudioContext) {
    super(ctx, 'amp');
    this.dry.gain.value = 0;
    const f = (type: BiquadFilterType, freq: number, q = 0.7) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = freq;
      b.Q.value = q;
      return b;
    };
    this.pre = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '4x';
    this.bass = f('lowshelf', 110);
    this.midF = f('peaking', 750, 0.8);
    this.treble = f('highshelf', 3200);
    const cabHp = f('highpass', 85);
    const cabLp = f('lowpass', 5200, 1.1);
    const cabRes = f('peaking', 2400, 1.5);
    cabRes.gain.value = 3;
    this.level = ctx.createGain();
    this.makeup = ctx.createGain();
    this.input.connect(this.pre).connect(this.shaper).connect(this.bass).connect(this.midF).connect(this.treble);
    this.treble.connect(cabHp).connect(cabRes).connect(cabLp).connect(this.makeup).connect(this.level).connect(this.wet);
  }
  protected apply(k: string, v: number, time?: number) {
    if (k === 'gain') {
      this.shaper.curve = tanhCurve(v * 0.8, 0.1);
      this.p(this.pre.gain, 1 + v * 4, time);
      this.p(this.makeup.gain, compensate(v * 0.8, 1 + v * 4, 1.2), time);
    } else if (k === 'bass') this.p(this.bass.gain, v, time);
    else if (k === 'mid') this.p(this.midF.gain, v, time);
    else if (k === 'treble') this.p(this.treble.gain, v, time);
    else if (k === 'level') this.p(this.level.gain, v * 1.6, time);
  }
}

export function createFx(ctx: BaseAudioContext, e: Effect, bpm: number): FxUnit {
  const C = { distortion: Distortion, chorus: Chorus, delay: Delay, reverb: Reverb, compressor: Compressor, eq: EQ, amp: Amp }[e.type];
  const u = new C(ctx);
  u.set(e.params, bpm, 0);
  return u;
}

// DynamicsCompressorNode adds its own makeup gain (spec: (1/gain at 0 dBFS)^0.6). We cancel it so the
// Makeup knob is the only makeup. Knee is ignored, which is within ~0.5 dB for our 6 dB knee.
export function autoMakeupDb(threshold = -24, ratio = 12) {
  return 0.6 * -threshold * (1 - 1 / ratio);
}

export function gainReduction(u: FxUnit): number {
  return u instanceof Compressor ? u.reduction() : 0;
}
