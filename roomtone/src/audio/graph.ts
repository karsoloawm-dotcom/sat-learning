import type { Bus, Effect, Project, Track } from '../state/types';
import { createInstrument, type Instrument } from './instruments';
import { autoMakeupDb, createFx, type FxUnit } from './effects';
import { audioAssets } from './assets';
import { audibleTrackIds, automationValue, dbToGain, notesInRange, type ScheduledNote } from './schedule';

// The mixer as Web Audio nodes, built for any BaseAudioContext (realtime or offline export).
// `sync(project)` diffs the document against the nodes; scheduling functions turn timeline ranges into
// sample-accurate events.

class FxChain {
  units = new Map<string, FxUnit>();
  private wiredKey = '';
  constructor(private ctx: BaseAudioContext, readonly input: AudioNode, readonly output: AudioNode) {
    input.connect(output);
  }
  sync(fx: readonly Effect[], bpm: number, skip?: (fxId: string, key: string) => boolean) {
    const ids = new Set(fx.map((e) => e.id));
    for (const [id, u] of this.units) if (!ids.has(id)) (u.dispose(), this.units.delete(id));
    for (const e of fx) {
      let u = this.units.get(e.id);
      if (!u) this.units.set(e.id, (u = createFx(this.ctx, e, bpm)));
      else {
        const params = skip ? Object.fromEntries(Object.entries(e.params).filter(([k]) => !skip(e.id, k))) : e.params;
        u.set(params, bpm);
      }
    }
    const key = fx.map((e) => `${e.id}:${e.enabled}`).join('|');
    if (key === this.wiredKey) return;
    this.wiredKey = key;
    this.input.disconnect();
    for (const u of this.units.values()) u.output.disconnect();
    let node: AudioNode = this.input;
    for (const e of fx) {
      if (!e.enabled) continue;
      const u = this.units.get(e.id)!;
      node.connect(u.input);
      node = u.output;
    }
    node.connect(this.output);
  }
  dispose() {
    for (const u of this.units.values()) u.dispose();
    this.input.disconnect();
  }
}

export class Channel {
  instrument: Instrument;
  instKey: string;
  input: GainNode; // instrument + audio clips enter here
  fx: FxChain;
  volume: GainNode;
  pan: StereoPannerNode;
  mute: GainNode;
  analyser: AnalyserNode;
  sends = new Map<string, GainNode>();
  liveSources = new Set<AudioBufferSourceNode>();

  constructor(private ctx: BaseAudioContext, t: Track, master: AudioNode) {
    this.input = ctx.createGain();
    this.volume = ctx.createGain();
    this.pan = ctx.createStereoPanner();
    this.mute = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.fx = new FxChain(ctx, this.input, this.volume);
    this.volume.connect(this.pan).connect(this.mute).connect(this.analyser).connect(master);
    this.instrument = createInstrument(ctx, t.instrument, t.inst);
    this.instKey = instKey(t);
    // Headroom trim: synthesized instruments peak near full scale on their own.
    this.trim = ctx.createGain();
    this.trim.gain.value = TRIM[t.instrument];
    this.trim.connect(this.input);
    this.instrument.output.connect(this.trim);
  }
  trim: GainNode;

  replaceInstrument(t: Track) {
    this.instrument.allNotesOff(this.ctx.currentTime);
    const old = this.instrument;
    setTimeout(() => old.dispose(), 500);
    this.instrument = createInstrument(this.ctx, t.instrument, t.inst);
    this.instKey = instKey(t);
    this.trim.gain.value = TRIM[t.instrument];
    this.instrument.output.connect(this.trim);
  }

  dispose() {
    this.instrument.allNotesOff(this.ctx.currentTime);
    this.instrument.dispose();
    this.fx.dispose();
    for (const s of this.liveSources) try { s.stop(); } catch { /* done */ }
    this.analyser.disconnect();
  }
}

// Per-instrument headroom trims, measured so each part sits in a similar range at 0 dB (see docs/DEVELOPMENT.md).
const TRIM: Record<Track['instrument'], number> = { drums: 1.1, bass: 1.2, guitar: 1.6, keys: 0.17, synth: 0.3, sampler: 0.8, vocal: 1 };

const instKey = (t: Track) => `${t.instrument}|${t.inst.preset === 'Synth Bass' ? 'sb' : ''}`;

class BusNode {
  input: GainNode;
  fx: FxChain;
  volume: GainNode;
  constructor(ctx: BaseAudioContext, master: AudioNode) {
    this.input = ctx.createGain();
    this.volume = ctx.createGain();
    this.fx = new FxChain(ctx, this.input, this.volume);
    this.volume.connect(master);
  }
}

export interface NoteEvent extends ScheduledNote {
  time: number; // AudioContext time of the onset
  end: number; // AudioContext time of the release
}

export class MixGraph {
  channels = new Map<string, Channel>();
  buses = new Map<string, BusNode>();
  masterIn: GainNode;
  masterFx: FxChain;
  masterVol: GainNode;
  masterAnalyser: AnalyserNode;
  private project: Project | null = null;

  constructor(readonly ctx: BaseAudioContext) {
    this.masterIn = ctx.createGain();
    this.masterVol = ctx.createGain();
    this.masterFx = new FxChain(ctx, this.masterIn, this.masterVol);
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    this.masterAnalyser = ctx.createAnalyser();
    this.masterAnalyser.fftSize = 2048;
    // Soft clip after the limiter: linear below 0.8, saturating smoothly so the output never exceeds ±0.99.
    const safety = ctx.createWaveShaper();
    const n = 4096;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 4 - 2;
      const a = Math.abs(x);
      curve[i] = Math.sign(x) * (a < 0.8 ? a : 0.8 + 0.19 * Math.tanh((a - 0.8) / 0.19));
    }
    safety.curve = curve;
    const pre = ctx.createGain();
    pre.gain.value = 0.5; // the shaper's input range is ±2 mapped onto ±1
    pre.gain.value = 0.5 * Math.pow(10, -autoMakeupDb(-1, 20) / 20);
    this.masterVol.connect(limiter).connect(pre).connect(safety).connect(this.masterAnalyser).connect(ctx.destination);
  }

  private hasLane(t: Track, target: string) {
    return t.automation.some((l) => l.enabled && l.target === target && l.points.length > 0);
  }

  sync(p: Project) {
    const prev = this.project;
    this.project = p;
    const now = this.ctx.currentTime;
    // Buses
    for (const b of p.buses) {
      let n = this.buses.get(b.id);
      if (!n) this.buses.set(b.id, (n = new BusNode(this.ctx, this.masterIn)));
      n.fx.sync(b.fx, p.bpm);
      n.volume.gain.setTargetAtTime(dbToGain(b.volume), now, 0.02);
    }
    // Tracks
    const ids = new Set(p.tracks.map((t) => t.id));
    for (const [id, ch] of this.channels) if (!ids.has(id)) (ch.dispose(), this.channels.delete(id));
    const audible = audibleTrackIds(p);
    for (const t of p.tracks) {
      let ch = this.channels.get(t.id);
      if (!ch) this.channels.set(t.id, (ch = new Channel(this.ctx, t, this.masterIn)));
      const old = prev?.tracks.find((x) => x.id === t.id);
      if (old === t && prev?.bpm === p.bpm && prev.tracks.length === p.tracks.length && prev.tracks.every((x, i) => x.solo === p.tracks[i].solo)) continue;
      if (ch.instKey !== instKey(t)) ch.replaceInstrument(t);
      else ch.instrument.setParams(t.inst);
      ch.fx.sync(t.fx, p.bpm, (fxId, key) => this.hasLane(t, `fx:${fxId}:${key}`));
      if (!this.hasLane(t, 'volume')) ch.volume.gain.setTargetAtTime(dbToGain(t.volume), now, 0.02);
      if (!this.hasLane(t, 'pan')) ch.pan.pan.setTargetAtTime(t.pan, now, 0.02);
      ch.mute.gain.setTargetAtTime(audible.has(t.id) ? 1 : 0, now, 0.01);
      for (const b of p.buses) {
        let s = ch.sends.get(b.id);
        if (!s) {
          s = this.ctx.createGain();
          ch.mute.connect(s).connect(this.buses.get(b.id)!.input);
          ch.sends.set(b.id, s);
        }
        s.gain.setTargetAtTime(t.sends[b.id] ?? 0, now, 0.02);
      }
    }
    this.masterFx.sync(p.master.fx, p.bpm);
    this.masterVol.gain.setTargetAtTime(dbToGain(p.master.volume), now, 0.02);
  }

  setInitial(p: Project) {
    // Offline contexts: jump params to their values with no ramps.
    for (const t of p.tracks) {
      const ch = this.channels.get(t.id)!;
      ch.volume.gain.value = dbToGain(t.volume);
      ch.pan.pan.value = t.pan;
    }
  }

  // Schedule every note with onset in [b0, b1). timeOf maps a timeline beat to context time.
  scheduleNotes(p: Project, b0: number, b1: number, timeOf: (b: number) => number, onNote?: (e: NoteEvent) => void) {
    const spb = 60 / p.bpm;
    for (const n of notesInRange(p, b0, b1, audibleTrackIds(p))) {
      const ch = this.channels.get(n.trackId);
      if (!ch) continue;
      const time = timeOf(n.beat);
      ch.instrument.noteOn(time, n.pitch, n.vel, n.dur * spb);
      onNote?.({ ...n, time, end: time + n.dur * spb });
    }
  }

  // Start audio clips whose start lies in [b0, b1), plus (when `resume`) clips already sounding at b0.
  scheduleAudio(p: Project, b0: number, b1: number, timeOf: (b: number) => number, resume: boolean) {
    const spb = 60 / p.bpm;
    const audible = audibleTrackIds(p);
    for (const t of p.tracks) {
      const ch = this.channels.get(t.id);
      if (!ch || !audible.has(t.id)) continue;
      for (const c of t.clips) {
        if (!c.audioId) continue;
        const buf = audioAssets.get(c.audioId);
        if (!buf) continue;
        const end = c.start + c.length;
        let startBeat: number;
        if (c.start >= b0 && c.start < b1) startBeat = c.start;
        else if (resume && c.start < b0 && end > b0) startBeat = b0;
        else continue;
        const offset = c.offset + (startBeat - c.start) * spb;
        const dur = (end - startBeat) * spb;
        if (offset >= buf.duration || dur <= 0) continue;
        const s = this.ctx.createBufferSource();
        s.buffer = buf;
        const g = this.ctx.createGain();
        g.gain.value = c.gain;
        s.connect(g).connect(ch.input);
        const when = timeOf(startBeat);
        s.start(when, offset, Math.min(dur, buf.duration - offset));
        ch.liveSources.add(s);
        s.onended = () => ch.liveSources.delete(s);
      }
    }
  }

  // Automation: ramp each automated parameter across [b0, b1]. `jump` sets the starting value first.
  scheduleAutomation(p: Project, b0: number, b1: number, timeOf: (b: number) => number, jump: boolean) {
    for (const t of p.tracks) {
      const ch = this.channels.get(t.id);
      if (!ch) continue;
      for (const lane of t.automation) {
        if (!lane.enabled || lane.points.length === 0) continue;
        const points = [b0, ...lane.points.filter((pt) => pt.t > b0 && pt.t < b1).map((pt) => pt.t), b1];
        points.forEach((b, i) => {
          const v = automationValue(lane, b)!;
          const time = timeOf(b);
          const mode = i === 0 && jump ? 'set' : 'linear';
          if (i === 0 && !jump) return;
          if (lane.target === 'volume') ramp(ch.volume.gain, dbToGain(v), time, mode);
          else if (lane.target === 'pan') ramp(ch.pan.pan, v, time, mode);
          else if (lane.target.startsWith('fx:')) {
            const [, fxId, key] = lane.target.split(':');
            ch.fx.units.get(fxId)?.setParam(key, v, time, mode);
          }
        });
      }
    }
  }

  stopAll(time: number) {
    for (const ch of this.channels.values()) {
      ch.instrument.allNotesOff(time);
      for (const s of ch.liveSources) try { s.stop(time); } catch { /* done */ }
      ch.liveSources.clear();
    }
  }

  // After stop, put automated params back to their static values.
  restoreStatic(p: Project) {
    this.project = null;
    this.sync(p);
  }

  busNode(b: Bus) {
    return this.buses.get(b.id);
  }
}

function ramp(param: AudioParam, v: number, time: number, mode: 'set' | 'linear') {
  if (mode === 'set') {
    param.cancelScheduledValues(time);
    param.setValueAtTime(v, time);
  } else param.linearRampToValueAtTime(v, time);
}
