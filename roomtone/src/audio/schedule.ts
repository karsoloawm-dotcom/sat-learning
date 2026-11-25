import type { AutomationLane, Clip, Project, Track } from '../state/types';

// Pure timeline maths shared by realtime playback, offline export, UI and animation previews.

export interface ScheduledNote {
  trackId: string;
  pitch: number;
  vel: number;
  beat: number; // absolute timeline beat
  dur: number; // beats
}

export function audibleTrackIds(p: Project): Set<string> {
  const anySolo = p.tracks.some((t) => t.solo);
  return new Set(p.tracks.filter((t) => !t.mute && (!anySolo || t.solo)).map((t) => t.id));
}

// Notes whose onset falls in [b0, b1). Clips longer than their pattern loop it.
export function notesInRange(p: Project, b0: number, b1: number, only?: Set<string>): ScheduledNote[] {
  const out: ScheduledNote[] = [];
  for (const t of p.tracks) {
    if (t.kind !== 'midi' || (only && !only.has(t.id))) continue;
    for (const c of t.clips) collectClip(p, t, c, b0, b1, out);
  }
  out.sort((a, b) => a.beat - b.beat);
  return out;
}

function collectClip(p: Project, t: Track, c: Clip, b0: number, b1: number, out: ScheduledNote[]) {
  const pat = c.patternId ? p.patterns[c.patternId] : undefined;
  if (!pat || pat.length <= 0) return;
  const cs = c.start;
  const ce = c.start + c.length;
  const lo = Math.max(b0, cs);
  const hi = Math.min(b1, ce);
  if (hi <= lo) return;
  const base = cs - c.offset; // timeline beat of pattern start (loop 0)
  const L = pat.length;
  const kMin = Math.floor((lo - base) / L) - 1;
  const kMax = Math.ceil((hi - base) / L);
  for (let k = Math.max(0, kMin); k <= kMax; k++) {
    for (const n of pat.notes) {
      if (n.start >= L || n.start < 0) continue;
      const beat = base + k * L + n.start;
      if (beat < lo || beat >= hi) continue;
      out.push({ trackId: t.id, pitch: n.pitch, vel: n.vel, beat, dur: Math.max(0.01, Math.min(n.dur, ce - beat)) });
    }
  }
}

export function automationValue(lane: AutomationLane, beat: number): number | undefined {
  const pts = lane.points;
  if (!lane.enabled || pts.length === 0) return undefined;
  if (beat <= pts[0].t) return pts[0].v;
  const last = pts[pts.length - 1];
  if (beat >= last.t) return last.v;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (beat <= b.t) return b.t === a.t ? b.v : a.v + ((b.v - a.v) * (beat - a.t)) / (b.t - a.t);
  }
  return last.v;
}

export function songEnd(p: Project): number {
  let end = 0;
  for (const t of p.tracks) for (const c of t.clips) end = Math.max(end, c.start + c.length);
  return end;
}

export const beatsToSeconds = (p: Project, beats: number) => (beats * 60) / p.bpm;

export function formatPosition(p: Project, beat: number) {
  const bar = Math.floor(beat / p.beatsPerBar) + 1;
  const b = Math.floor(beat % p.beatsPerBar) + 1;
  const tick = Math.floor((beat % 1) * 4) + 1;
  return `${bar}.${b}.${tick}`;
}

export const dbToGain = (db: number) => (db <= -60 ? 0 : Math.pow(10, db / 20));
