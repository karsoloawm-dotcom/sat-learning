// Standard MIDI File (format 0/1) -> notes in beats. Tempo changes are ignored on purpose: positions are
// read in ticks/PPQ, i.e. musical beats, which is what the piano roll edits.

export interface MidiNote {
  pitch: number;
  start: number; // beats
  dur: number; // beats
  vel: number; // 0..1
  channel: number;
  track: number;
}

export interface MidiFile {
  notes: MidiNote[];
  trackNames: string[];
  lengthBeats: number;
}

export function parseMidi(buf: ArrayBuffer): MidiFile {
  const d = new DataView(buf);
  let p = 0;
  const str = (n: number) => String.fromCharCode(...new Uint8Array(buf, p, n));
  if (buf.byteLength < 14 || str(4) !== 'MThd') throw new Error('Not a MIDI file');
  const headerLen = d.getUint32(4);
  const ntracks = d.getUint16(10);
  const division = d.getUint16(12);
  if (division & 0x8000) throw new Error('SMPTE-timed MIDI files are not supported');
  const ppq = division;
  p = 8 + headerLen;
  const notes: MidiNote[] = [];
  const trackNames: string[] = [];
  for (let t = 0; t < ntracks && p + 8 <= buf.byteLength; t++) {
    if (str(4) !== 'MTrk') throw new Error('Corrupt MIDI track');
    const len = d.getUint32(p + 4);
    const end = Math.min(buf.byteLength, p + 8 + len);
    p += 8;
    let tick = 0;
    let status = 0;
    const open = new Map<number, { tick: number; vel: number }[]>(); // key: channel*128+pitch
    const vlq = () => {
      let v = 0;
      for (let i = 0; i < 4 && p < end; i++) {
        const b = d.getUint8(p++);
        v = (v << 7) | (b & 0x7f);
        if (!(b & 0x80)) break;
      }
      return v;
    };
    const close = (ch: number, pitch: number) => {
      const q = open.get(ch * 128 + pitch);
      const on = q?.shift();
      if (on) notes.push({ pitch, start: on.tick / ppq, dur: Math.max(1, tick - on.tick) / ppq, vel: on.vel / 127, channel: ch, track: t });
    };
    while (p < end) {
      tick += vlq();
      let s = d.getUint8(p);
      if (s & 0x80) p++;
      else s = status; // running status
      if (s === 0xff) {
        const type = d.getUint8(p++);
        const l = vlq();
        if (type === 0x03) trackNames[t] = new TextDecoder().decode(new Uint8Array(buf, p, l));
        p += l;
        continue;
      }
      if (s === 0xf0 || s === 0xf7) {
        p += vlq();
        continue;
      }
      status = s;
      const type = s & 0xf0;
      const ch = s & 0x0f;
      const a = d.getUint8(p++);
      const b = type === 0xc0 || type === 0xd0 ? 0 : d.getUint8(p++);
      if (type === 0x90 && b > 0) {
        const k = ch * 128 + a;
        if (!open.has(k)) open.set(k, []);
        open.get(k)!.push({ tick, vel: b });
      } else if (type === 0x80 || (type === 0x90 && b === 0)) close(ch, a);
    }
    for (const k of [...open.keys()]) while (open.get(k)!.length) close(Math.floor(k / 128), k % 128); // hanging notes end at track end
    p = end;
  }
  notes.sort((x, y) => x.start - y.start || x.pitch - y.pitch);
  return { notes, trackNames, lengthBeats: notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0) };
}
