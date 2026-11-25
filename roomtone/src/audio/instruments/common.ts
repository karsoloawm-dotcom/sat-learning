import type { InstrumentParams } from '../../state/types';

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export interface Voice {
  release(time: number): void; // start the release phase at `time`
  stop(time?: number): void; // hard stop (transport stop)
}

export interface Instrument {
  output: AudioNode;
  // Plays a note at `time` (AudioContext seconds). With `dur` the release is scheduled too; without it the
  // caller releases the returned voice (live playing / recording).
  noteOn(time: number, pitch: number, vel: number, dur?: number): Voice;
  allNotesOff(time: number): void;
  setParams(p: InstrumentParams): void;
  prepare?(pitches: number[]): void; // pre-render any cached tones for these pitches
  dispose(): void;
}

// Tracks live voices so transport stop can silence everything that is still ringing.
export class VoicePool {
  private voices = new Set<Voice>();
  add(v: Voice, endTime: number, ctx: BaseAudioContext) {
    this.voices.add(v);
    // Forget voices after they are surely over. Offline contexts never need cleanup.
    if (ctx instanceof AudioContext) {
      const ms = Math.max(0, (endTime - ctx.currentTime) * 1000) + 500;
      setTimeout(() => this.voices.delete(v), ms);
    }
    return v;
  }
  stopAll(time: number) {
    for (const v of this.voices) v.stop(time);
    this.voices.clear();
  }
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
export function noiseBuffer(ctx: BaseAudioContext) {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

// A gain node with an attack/hold/release envelope; returns a Voice that controls it.
export function envelope(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  peak: number,
  attack: number,
  release: number,
  sources: AudioScheduledSourceNode[],
  dur?: number,
  sustainDecay?: { level: number; tau: number },
): { gain: GainNode; voice: Voice; end: number } {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(peak, time + attack);
  if (sustainDecay) g.gain.setTargetAtTime(peak * sustainDecay.level, time + attack, sustainDecay.tau);
  g.connect(dest);
  let released = false;
  const release_ = (t: number) => {
    if (released) return;
    released = true;
    t = Math.max(t, time + attack);
    g.gain.cancelScheduledValues(t);
    // Hold the current curve value, then fall. setTargetAtTime never reaches 0, so stop sources later.
    if ('cancelAndHoldAtTime' in g.gain) (g.gain as AudioParam & { cancelAndHoldAtTime(t: number): void }).cancelAndHoldAtTime(t);
    g.gain.setTargetAtTime(0, t, release / 4);
    for (const s of sources) {
      try {
        s.stop(t + release + 0.05);
      } catch {
        /* already stopped */
      }
    }
  };
  const voice: Voice = {
    release: release_,
    stop: (t?: number) => {
      const now = t ?? ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0, now, 0.01);
      for (const s of sources) {
        try {
          s.stop(now + 0.06);
        } catch {
          /* already stopped */
        }
      }
    },
  };
  const end = dur !== undefined ? time + dur + release + 0.05 : time + 60;
  if (dur !== undefined) release_(time + dur);
  return { gain: g, voice, end };
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
