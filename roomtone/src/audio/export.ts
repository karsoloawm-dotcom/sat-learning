import type { Project } from '../state/types';
import { MixGraph } from './graph';
import { songEnd } from './schedule';

// Offline bounce: the same MixGraph and scheduling code as realtime playback, rendered faster than realtime.
export async function renderProject(p: Project, opts: { sampleRate?: number; start?: number; end?: number; tail?: number } = {}) {
  const sr = opts.sampleRate ?? 44100;
  const start = opts.start ?? 0;
  const end = opts.end ?? Math.max(songEnd(p), start + p.beatsPerBar);
  const spb = 60 / p.bpm;
  const seconds = (end - start) * spb + (opts.tail ?? 2.5);
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
  const graph = new MixGraph(ctx);
  graph.sync(p);
  graph.setInitial(p);
  const timeOf = (b: number) => (b - start) * spb;
  graph.scheduleAutomation(p, start, end, timeOf, true);
  graph.scheduleAudio(p, start, end, timeOf, true);
  graph.scheduleNotes(p, start, end, timeOf);
  // Let effect parameter microtasks (reverb impulses) settle before rendering.
  await Promise.resolve();
  return ctx.startRendering();
}

export function encodeWav(buf: AudioBuffer, bits: 16 | 24 = 16): Blob {
  const ch = buf.numberOfChannels;
  const bytes = bits / 8;
  const len = buf.length * ch * bytes;
  const out = new DataView(new ArrayBuffer(44 + len));
  const w = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  out.setUint32(4, 36 + len, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, ch, true);
  out.setUint32(24, buf.sampleRate, true);
  out.setUint32(28, buf.sampleRate * ch * bytes, true);
  out.setUint16(32, ch * bytes, true);
  out.setUint16(34, bits, true);
  w(36, 'data');
  out.setUint32(40, len, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  const max = bits === 16 ? 0x7fff : 0x7fffff;
  for (let i = 0; i < buf.length; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.round(Math.max(-1, Math.min(1, data[c][i])) * max);
      if (bits === 16) out.setInt16(o, v, true);
      else {
        out.setUint8(o, v & 0xff);
        out.setUint8(o + 1, (v >> 8) & 0xff);
        out.setUint8(o + 2, (v >> 16) & 0xff);
      }
      o += bytes;
    }
  }
  return new Blob([out.buffer], { type: 'audio/wav' });
}

export function decodeWav(ab: ArrayBuffer, ctx: BaseAudioContext) {
  return ctx.decodeAudioData(ab.slice(0));
}
