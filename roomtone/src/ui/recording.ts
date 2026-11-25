import { engine, selectTrack, store, toast, ui } from '../app';
import { putAsset } from '../audio/assets';
import { newPattern } from '../state/defaults';
import { uid } from '../state/store';

// Recording onto the armed track: live MIDI notes (computer keyboard / MIDI input) or microphone audio.

interface Take {
  trackId: string;
  kind: 'midi' | 'audio';
  startBeat: number;
  notes: { pitch: number; vel: number; beat: number; end?: number }[];
  stop?: () => Promise<void>;
}
let take: Take | null = null;

function armedTrack() {
  const p = store.get();
  let t = p.tracks.find((x) => x.armed);
  if (!t) {
    const sel = p.tracks.find((x) => x.id === ui.get().selected);
    if (sel) {
      store.update('Arm track', (d) => void (d.tracks.find((x) => x.id === sel.id)!.armed = true));
      t = store.get().tracks.find((x) => x.id === sel.id);
    }
  }
  return t;
}

export async function startRecording() {
  const t = armedTrack();
  if (!t) {
    toast('Select or arm a musician to record');
    return;
  }
  const startBeat = engine.playing ? engine.position() : engine.position();
  if (t.kind === 'midi') {
    take = { trackId: t.id, kind: 'midi', startBeat, notes: [] };
    if (!engine.playing) await engine.play();
    ui.set({ recording: true, typing: true });
    toast(`Recording ${t.musician.name}: play with your keyboard or MIDI controller`);
    return;
  }
  // Audio: capture raw PCM through an AudioWorklet so timing is sample-accurate.
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch {
    toast('Microphone permission was denied');
    return;
  }
  const ctx = engine.ctx;
  const src = `registerProcessor('rt-rec', class extends AudioWorkletProcessor { process(i) { if (i[0] && i[0][0]) this.port.postMessage([currentFrame, i[0][0].slice()]); return true; } });`;
  await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  const input = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'rt-rec');
  const chunks: Float32Array[] = [];
  let firstFrame = -1;
  node.port.onmessage = (e) => {
    const [frame, data] = e.data as [number, Float32Array];
    if (firstFrame < 0) firstFrame = frame;
    chunks.push(data);
  };
  input.connect(node);
  if (!engine.playing) await engine.play();
  ui.set({ recording: true });
  toast(`Recording audio on ${t.name}…`);
  take = {
    trackId: t.id,
    kind: 'audio',
    startBeat,
    notes: [],
    stop: async () => {
      input.disconnect();
      node.disconnect();
      stream.getTracks().forEach((x) => x.stop());
      const len = chunks.reduce((s, c) => s + c.length, 0);
      if (!len) return;
      const buf = new AudioBuffer({ length: len, numberOfChannels: 1, sampleRate: ctx.sampleRate });
      const data = buf.getChannelData(0);
      let o = 0;
      for (const c of chunks) (data.set(c, o), (o += c.length));
      // Place the take where its first sample was heard, compensating input + output latency.
      const latency = (ctx.baseLatency || 0) + (ctx.outputLatency || 0);
      const beat = Math.max(0, engine.position(firstFrame / ctx.sampleRate - latency));
      const id = uid('aud');
      putAsset(id, buf);
      store.update('Record audio', (d) => {
        d.audio[id] = { id, name: `Take ${Object.keys(d.audio).length + 1}`, duration: buf.duration, sampleRate: buf.sampleRate, channels: 1 };
        d.tracks.find((x) => x.id === take!.trackId)?.clips.push({ id: uid('clip'), audioId: id, start: beat, length: (buf.duration * d.bpm) / 60, offset: 0, gain: 1 });
      });
    },
  };
}

export async function stopRecording() {
  const t = take;
  take = null;
  ui.set({ recording: false });
  if (!t) return;
  const endBeat = engine.position();
  engine.stop();
  if (t.kind === 'audio') return t.stop?.();
  const notes = t.notes.filter((n) => n.beat >= t.startBeat - 0.25);
  if (!notes.length) return toast('Nothing was played');
  const p = store.get();
  const bar = p.beatsPerBar;
  const start = Math.floor(Math.min(...notes.map((n) => n.beat)) / bar) * bar;
  const end = Math.ceil(Math.max(endBeat, ...notes.map((n) => n.end ?? n.beat + 0.25)) / bar) * bar;
  const pat = newPattern('Recorded take', end - start, notes.map((n) => ({ id: uid('n'), pitch: n.pitch, vel: n.vel, start: n.beat - start, dur: Math.max(0.05, (n.end ?? n.beat + 0.25) - n.beat) })));
  store.update('Record notes', (d) => {
    d.patterns[pat.id] = pat;
    d.tracks.find((x) => x.id === t.trackId)?.clips.push({ id: uid('clip'), patternId: pat.id, start, length: end - start, offset: 0, gain: 1 });
  });
  selectTrack(t.trackId, false);
  ui.set({ editPattern: pat.id });
  toast(`Recorded ${notes.length} notes`);
}

export function recordNoteOn(trackId: string, pitch: number, vel: number) {
  if (take?.kind === 'midi' && take.trackId === trackId && engine.playing) take.notes.push({ pitch, vel, beat: engine.position() });
}
export function recordNoteOff(trackId: string, pitch: number) {
  if (take?.kind !== 'midi' || take.trackId !== trackId) return;
  const n = [...take.notes].reverse().find((x) => x.pitch === pitch && x.end === undefined);
  if (n) n.end = engine.position();
}
