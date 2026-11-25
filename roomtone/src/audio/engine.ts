import type { Project } from '../state/types';
import type { ProjectStore } from '../state/store';
import { MixGraph, type NoteEvent } from './graph';
import type { Voice } from './instruments';
import { notesInRange } from './schedule';

// Realtime transport. A Worker timer (not requestAnimationFrame) drives a lookahead scheduler, so audio
// timing never depends on the 3D frame rate or a throttled main thread.

const LOOKAHEAD = 0.2; // seconds scheduled ahead; also gives animation ~200ms of anticipation
const TICK_MS = 25;

interface Anchor {
  time: number; // context time
  beat: number; // timeline beat at that time
}

export type EngineEvent =
  | { type: 'note'; note: NoteEvent }
  | { type: 'transport'; playing: boolean }
  | { type: 'loop'; time: number };

export class AudioEngine {
  ctx: AudioContext;
  graph: MixGraph;
  playing = false;
  private anchors: Anchor[] = [{ time: 0, beat: 0 }];
  private cursorBeat = 0;
  private cursorTime = 0;
  private stoppedBeat = 0;
  private worker: Worker;
  private listeners = new Set<(e: EngineEvent) => void>();
  private metronomeGain: GainNode;
  private liveVoices = new Map<string, Voice>();

  constructor(private store: ProjectStore) {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.graph = new MixGraph(this.ctx);
    this.metronomeGain = this.ctx.createGain();
    this.metronomeGain.gain.value = 0.3;
    this.metronomeGain.connect(this.ctx.destination);
    this.graph.sync(store.get());
    this.prepare(store.get());
    store.subscribe((p, prev) => {
      this.graph.sync(p);
      if (p.bpm !== prev.bpm && this.playing) this.reanchor();
      if (p.patterns !== prev.patterns || p.tracks !== prev.tracks) this.prepareSoon(p);
    });
    const src = `setInterval(() => postMessage(0), ${TICK_MS});`;
    this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    this.worker.onmessage = () => this.tick();
  }

  on(fn: (e: EngineEvent) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(e: EngineEvent) {
    for (const l of this.listeners) l(e);
  }

  async resume() {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  get project(): Project {
    return this.store.get();
  }

  private spb() {
    return 60 / this.project.bpm;
  }

  // Time the listener is hearing now: context time minus output latency.
  audibleTime() {
    const ts = this.ctx.getOutputTimestamp?.();
    if (ts && ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.contextTime > 0) {
      return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    }
    return this.ctx.currentTime - (this.ctx.outputLatency || 0) - (this.ctx.baseLatency || 0);
  }

  // Timeline beat at a given context time (defaults to what is audible now).
  position(time = this.audibleTime()): number {
    if (!this.playing) return this.stoppedBeat;
    let a = this.anchors[0];
    for (const x of this.anchors) if (x.time <= time) a = x;
    return Math.max(0, a.beat + (time - a.time) / this.spb());
  }

  async play(fromBeat?: number) {
    await this.resume();
    if (this.playing) this.stop(false);
    const beat = fromBeat ?? this.stoppedBeat;
    const t = this.ctx.currentTime + 0.06;
    this.anchors = [{ time: t, beat }];
    this.cursorBeat = beat;
    this.cursorTime = t;
    this.playing = true;
    const p = this.project;
    const timeOf = this.timeOf(t, beat);
    this.graph.scheduleAudio(p, beat, beat, timeOf, true);
    this.graph.scheduleAutomation(p, beat, beat, timeOf, true);
    this.emit({ type: 'transport', playing: true });
    this.tick();
  }

  stop(rewind = false) {
    if (!this.playing) {
      if (rewind) this.stoppedBeat = this.project.loop.enabled ? this.project.loop.start : 0;
      this.emit({ type: 'transport', playing: false });
      return;
    }
    this.stoppedBeat = rewind ? 0 : this.position();
    this.playing = false;
    const now = this.ctx.currentTime;
    this.graph.stopAll(now);
    // Automation events up to LOOKAHEAD ahead are already queued; restore static values after them.
    setTimeout(() => !this.playing && this.graph.restoreStatic(this.project), LOOKAHEAD * 1000 + 50);
    this.emit({ type: 'transport', playing: false });
  }

  seek(beat: number) {
    if (this.playing) this.play(beat);
    else this.stoppedBeat = Math.max(0, beat);
    this.emit({ type: 'transport', playing: this.playing });
  }

  private timeOf(anchorTime: number, anchorBeat: number) {
    const spb = this.spb();
    return (b: number) => anchorTime + (b - anchorBeat) * spb;
  }

  private reanchor() {
    // Tempo changed: restart scheduling from the current position with the new tempo.
    const beat = this.position(this.ctx.currentTime);
    this.play(beat);
  }

  private tick() {
    if (!this.playing) return;
    const p = this.project;
    const spb = this.spb();
    const horizon = this.ctx.currentTime + LOOKAHEAD;
    let guard = 0;
    while (this.cursorTime < horizon && guard++ < 8) {
      const loop = p.loop;
      const loopActive = loop.enabled && loop.end > loop.start && this.cursorBeat < loop.end;
      const segEnd = loopActive ? loop.end : Infinity;
      const endBeat = Math.min(this.cursorBeat + (horizon - this.cursorTime) / spb, segEnd);
      const timeOf = this.timeOf(this.cursorTime, this.cursorBeat);
      this.graph.scheduleNotes(p, this.cursorBeat, endBeat, timeOf, (note) => this.emit({ type: 'note', note }));
      this.graph.scheduleAudio(p, this.cursorBeat, endBeat, timeOf, false);
      this.graph.scheduleAutomation(p, this.cursorBeat, endBeat, timeOf, false);
      if (p.metronome) this.clicks(this.cursorBeat, endBeat, timeOf);
      this.cursorTime += (endBeat - this.cursorBeat) * spb;
      this.cursorBeat = endBeat;
      if (endBeat >= segEnd) {
        // Loop wrap: everything still ringing past the loop end is cut at the wrap point.
        this.cursorBeat = loop.start;
        this.anchors.push({ time: this.cursorTime, beat: loop.start });
        if (this.anchors.length > 8) this.anchors.splice(0, this.anchors.length - 8);
        const wrapTime = this.cursorTime;
        for (const ch of this.graph.channels.values()) for (const s of ch.liveSources) try { s.stop(wrapTime); } catch { /* done */ }
        const t2 = this.timeOf(wrapTime, loop.start);
        this.graph.scheduleAudio(p, loop.start, loop.start, t2, true);
        this.graph.scheduleAutomation(p, loop.start, loop.start, t2, true);
        this.emit({ type: 'loop', time: wrapTime });
      }
    }
  }

  private clicks(b0: number, b1: number, timeOf: (b: number) => number) {
    for (let b = Math.ceil(b0); b < b1; b++) {
      const t = timeOf(b);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.frequency.value = b % this.project.beatsPerBar === 0 ? 1760 : 1100;
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o.connect(g).connect(this.metronomeGain);
      o.start(t);
      o.stop(t + 0.06);
    }
  }

  // ---- live playing (computer keyboard, MIDI input, piano-roll previews) ----
  noteOn(trackId: string, pitch: number, vel = 0.8) {
    this.resume();
    const ch = this.graph.channels.get(trackId);
    if (!ch) return;
    const key = `${trackId}:${pitch}`;
    this.liveVoices.get(key)?.release(this.ctx.currentTime);
    const t = this.ctx.currentTime + 0.005;
    this.liveVoices.set(key, ch.instrument.noteOn(t, pitch, vel));
    this.emit({ type: 'note', note: { trackId, pitch, vel, beat: this.position(), dur: 0.25, time: t, end: t + 0.25 } });
  }
  noteOff(trackId: string, pitch: number) {
    const key = `${trackId}:${pitch}`;
    this.liveVoices.get(key)?.release(this.ctx.currentTime);
    this.liveVoices.delete(key);
  }
  preview(trackId: string, pitch: number, vel = 0.8, dur = 0.3) {
    this.resume();
    const ch = this.graph.channels.get(trackId);
    if (!ch) return;
    const t = this.ctx.currentTime + 0.01;
    ch.instrument.noteOn(t, pitch, vel, dur);
    this.emit({ type: 'note', note: { trackId, pitch, vel, beat: this.position(), dur, time: t, end: t + dur } });
  }

  // Meter levels (peak, 0..1+) read by UI and the 3D studio.
  private buf = new Float32Array(2048);
  level(trackId?: string) {
    const a = trackId ? this.graph.channels.get(trackId)?.analyser : this.graph.masterAnalyser;
    if (!a) return 0;
    const n = a.fftSize;
    const b = this.buf.subarray(0, n);
    a.getFloatTimeDomainData(b);
    let m = 0;
    for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(b[i]));
    return m;
  }

  // Pre-render cached tones for pitches the project uses, off the critical path.
  private prepTimer = 0;
  private prepareSoon(p: Project) {
    clearTimeout(this.prepTimer);
    this.prepTimer = window.setTimeout(() => this.prepare(p), 300);
  }
  private prepare(p: Project) {
    const byTrack = new Map<string, Set<number>>();
    for (const n of notesInRange(p, 0, 1e9)) {
      if (!byTrack.has(n.trackId)) byTrack.set(n.trackId, new Set());
      byTrack.get(n.trackId)!.add(n.pitch);
    }
    for (const [id, pitches] of byTrack) this.graph.channels.get(id)?.instrument.prepare?.([...pitches]);
  }
}
