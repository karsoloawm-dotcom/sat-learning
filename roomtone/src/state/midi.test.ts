import { describe, expect, it } from 'vitest';
import { parseMidi } from './midi';

// Builds a format-1 file: track 0 = name meta, track 1 = C4 for 1 beat, then E4 (running status, vel-0 off).
function sample() {
  const ppq = 480;
  const vlq = (n: number) => {
    const out = [n & 0x7f];
    while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
    return out;
  };
  const trk = (bytes: number[]) => [...'MTrk'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, bytes.length], bytes);
  const name = [0, 0xff, 0x03, 4, ...[...'Keys'].map((c) => c.charCodeAt(0)), 0, 0xff, 0x2f, 0];
  const notes = [0, 0x90, 60, 100, ...vlq(480), 0x80, 60, 0, 0, 0x90, 64, 64, ...vlq(240), 64, 0, 0, 0xff, 0x2f, 0];
  const head = [...'MThd'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 6, 0, 1, 0, 2, ppq >> 8, ppq & 0xff]);
  return new Uint8Array([...head, ...trk(name), ...trk(notes)]).buffer;
}

describe('parseMidi', () => {
  it('reads notes in beats with running status and velocity-0 note-offs', () => {
    const m = parseMidi(sample());
    expect(m.trackNames[0]).toBe('Keys');
    expect(m.notes).toEqual([
      { pitch: 60, start: 0, dur: 1, vel: 100 / 127, channel: 0, track: 1 },
      { pitch: 64, start: 1, dur: 0.5, vel: 64 / 127, channel: 0, track: 1 },
    ]);
    expect(m.lengthBeats).toBe(1.5);
  });
  it('rejects non-MIDI data', () => {
    expect(() => parseMidi(new Uint8Array(20).buffer)).toThrow();
  });
});
