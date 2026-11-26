/* Dream Lantern timing: the beat map (timing.json) and the per-frame object every scene module receives.
   Shared by the core (dream-lantern.mjs) and the module preview (tools/dream-lantern-preview/module.html). */
export const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

function defaultTiming() {
  const bp = 60 / 89.1, duration = 126.76, beats = [];
  for (let t = 0; t < duration; t += bp) beats.push(+t.toFixed(3));
  const secs = [["intro", 0], ["verse1", 24], ["chorus1", 52], ["verse2", 63.2], ["build", 84], ["chorus2", 90], ["outro", 124]];
  return { duration, beats, downbeats: beats.filter((_, i) => i % 4 === 0), accents: [], sections: secs.map(([name, t0], i) => ({ name, t0, t1: secs[i + 1] ? secs[i + 1][1] : duration })) };
}
export function prepTiming(j) {
  const d = defaultTiming(), T = {
    duration: j && j.duration || d.duration,
    beats: j && j.beats && j.beats.length > 8 ? j.beats : d.beats,
    downbeats: j && j.downbeats && j.downbeats.length > 2 ? j.downbeats : null,
    accents: j && j.accents || [],
    hits: j && j.hits || [],
    sections: j && j.sections && j.sections.length ? j.sections : d.sections,
    cues: j && j.cues || {}
  };
  T.fast = j && j.fast && j.fast.length ? j.fast : T.beats;
  if (!T.downbeats) T.downbeats = T.beats.filter((_, i) => i % 4 === 0);
  T.bp = T.beats.length > 1 ? (T.beats[T.beats.length - 1] - T.beats[0]) / (T.beats.length - 1) : .673;
  return T;
}
export const loadTiming = url => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null).then(prepTiming);
export const lastIdx = (a, t) => { if (!a.length || t < a[0]) return -1; let lo = 0, hi = a.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (a[m] <= t) lo = m; else hi = m - 1 } return lo };
/* float index into a sorted time list, extrapolated at both ends */
export function along(a, t, per) {
  const i = lastIdx(a, t);
  if (i < 0) return (t - a[0]) / per;
  const b0 = a[i], b1 = a[i + 1] !== undefined ? a[i + 1] : b0 + per;
  return i + cl((t - b0) / (b1 - b0));
}
const decay = (a, t, k) => { const i = lastIdx(a, t); return i < 0 ? 0 : Math.exp(-(t - a[i]) / k) };
/* The frame object. beat = 89 BPM pulse, fast = every 178 BPM beat, bar = half-time bar (8 fast beats).
   Pulses are 1 on their event and decay: pulse .16 s, fastPulse .08 s, downPulse .3 s, accent .4 s, hit .35 s. */
export function frameAt(TM, t, dt) {
  const beat = along(TM.beats, t, TM.bp), bar = along(TM.downbeats, t, TM.bp * 4), fast = along(TM.fast, t, TM.bp / 2);
  let si = 0; for (let i = 0; i < TM.sections.length; i++) if (TM.sections[i].t0 <= t) si = i;
  const sec = TM.sections[si];
  return {
    t, dt, beat, bar, fast, beatPhase: beat - Math.floor(beat), barPhase: bar - Math.floor(bar), fastPhase: fast - Math.floor(fast),
    pulse: decay(TM.beats, t, .16), fastPulse: decay(TM.fast, t, .08), downPulse: decay(TM.downbeats, t, .3),
    accent: decay(TM.accents, t, .4), hit: decay(TM.hits, t, .35),
    section: sec.name, secT: cl((t - sec.t0) / (sec.t1 - sec.t0))
  };
}
/* the downbeat n bars after the downbeat nearest t */
export function barsFrom(TM, t, n) {
  const D = TM.downbeats; let k = lastIdx(D, t);
  if (k < 0) k = 0; else if (D[k + 1] !== undefined && D[k + 1] - t < t - D[k]) k++;
  const j = k + n, c = Math.max(0, Math.min(D.length - 1, j));
  return D[c] + (j - c) * TM.bp * 4;
}
