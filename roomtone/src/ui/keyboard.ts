import { engine, setView, store, ui, world } from '../app';
import { recordNoteOff, recordNoteOn, startRecording, stopRecording } from './recording';
import { INSTRUMENTS } from '../state/specs';

// Global shortcuts, musical typing (FL-style two rows) and Web MIDI input.

const LOWER = ['KeyZ', 'KeyS', 'KeyX', 'KeyD', 'KeyC', 'KeyV', 'KeyG', 'KeyB', 'KeyH', 'KeyN', 'KeyJ', 'KeyM', 'Comma'];
const UPPER = ['KeyQ', 'Digit2', 'KeyW', 'Digit3', 'KeyE', 'KeyR', 'Digit5', 'KeyT', 'Digit6', 'KeyY', 'Digit7', 'KeyU', 'KeyI'];
const held = new Map<string, number>();
let octaveShift = 0;

function targetTrack() {
  const p = store.get();
  return p.tracks.find((t) => t.id === ui.get().selected && t.kind === 'midi') ?? p.tracks.find((t) => t.armed && t.kind === 'midi');
}

export function liveOn(pitch: number, vel = 0.8) {
  const t = targetTrack();
  if (!t) return;
  engine.noteOn(t.id, pitch, vel);
  recordNoteOn(t.id, pitch, vel);
}
export function liveOff(pitch: number) {
  const t = targetTrack();
  if (!t) return;
  engine.noteOff(t.id, pitch);
  recordNoteOff(t.id, pitch);
}

export function installKeyboard() {
  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.code === 'KeyZ') {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
      return;
    }
    if (mod && e.code === 'KeyY') {
      e.preventDefault();
      store.redo();
      return;
    }
    if (mod) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (engine.playing) {
        if (ui.get().recording) stopRecording();
        else engine.stop();
      } else engine.play();
      return;
    }
    const s = ui.get();
    if (s.typing && s.view !== 'first') {
      const i = LOWER.indexOf(e.code);
      const j = UPPER.indexOf(e.code);
      if (i >= 0 || j >= 0) {
        e.preventDefault();
        if (e.repeat || held.has(e.code)) return;
        const t = targetTrack();
        const base = (t ? INSTRUMENTS[t.instrument].defaultOctave : 4) * 12 + 12 + octaveShift * 12;
        const pitch = i >= 0 ? base + i : base + 12 + j;
        held.set(e.code, pitch);
        liveOn(pitch, e.shiftKey ? 1 : 0.8);
        return;
      }
      if (e.code === 'Minus') return void (octaveShift = Math.max(-3, octaveShift - 1));
      if (e.code === 'Equal') return void (octaveShift = Math.min(3, octaveShift + 1));
    }
    if (s.view === 'first' && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) return;
    if (!s.typing) {
      const views = { Digit1: 'first', Digit2: 'director', Digit3: 'producer', Digit4: 'perform' } as const;
      if (e.code in views) return setView(views[e.code as keyof typeof views]);
      if (e.code === 'KeyR') return void (s.recording ? stopRecording() : startRecording());
      if (e.code === 'Escape' && s.view === 'perform') return setView('director');
    }
    void world;
  });
  window.addEventListener('keyup', (e) => {
    const p = held.get(e.code);
    if (p !== undefined) {
      held.delete(e.code);
      liveOff(p);
    }
  });
}

let midiReady = false;
export async function connectMidi(): Promise<string> {
  if (midiReady) return 'MIDI already connected';
  if (!navigator.requestMIDIAccess) return 'This browser has no Web MIDI support';
  const access = await navigator.requestMIDIAccess();
  const bind = () =>
    access.inputs.forEach((input) => {
      input.onmidimessage = (m) => {
        const [st, d1, d2] = m.data ?? [];
        const cmd = st & 0xf0;
        if (cmd === 0x90 && d2 > 0) liveOn(d1, d2 / 127);
        else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) liveOff(d1);
      };
    });
  bind();
  access.onstatechange = bind;
  midiReady = true;
  return access.inputs.size ? `Connected ${access.inputs.size} MIDI input(s)` : 'MIDI enabled — plug in a controller';
}
