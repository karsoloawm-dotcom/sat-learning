import { defaultParams, INSTRUMENTS } from './specs';
import type { Effect, EffectType, InstrumentType, MusicianLook, Note, Pattern, Project, Track } from './types';
import { uid } from './store';

export const SKIN_TONES = ['#fde3cf', '#f6cfae', '#e9b48d', '#d39a6d', '#b0764c', '#8a5634', '#6b3f26', '#4a2a19'];
export const HAIR_COLORS = ['#1f1a17', '#3b2a20', '#6a4328', '#a8693a', '#d8a85b', '#f0d48a', '#c2412f', '#e7e3dc', '#6a7ec9', '#d46aa8', '#5fae8b'];
export const CLOTH_COLORS = ['#e8553d', '#f2a541', '#f7d65a', '#6fbf5e', '#3f9d8f', '#4a7bd0', '#7a5cc4', '#d4609b', '#f4efe6', '#3a3a44', '#8b5a3c', '#c8d6e5'];

export function makeEffect(type: EffectType, params: Record<string, number> = {}): Effect {
  return { id: uid('fx'), type, enabled: true, params: { ...defaultParams(type), ...params } };
}

const NAMES = ['Juno', 'Bo', 'Pip', 'Mika', 'Toto', 'Ren', 'Lulu', 'Ziggy', 'Noor', 'Kip', 'Suki', 'Otis', 'Bea', 'Momo', 'Ivy', 'Dash'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function randomLook(name?: string): MusicianLook {
  return {
    name: name ?? pick(NAMES),
    skin: pick(SKIN_TONES),
    hair: pick(['bob', 'spiky', 'ponytail', 'bun', 'afro', 'buzz', 'long', 'mohawk'] as const),
    hairColor: pick(HAIR_COLORS),
    eyes: Math.floor(Math.random() * 4),
    brows: Math.floor(Math.random() * 3),
    mouth: Math.floor(Math.random() * 3),
    eyeColor: pick(['#2b1d14', '#3d6bb3', '#3f7d4a', '#5a3a1e']),
    outfit: pick(['tee', 'hoodie', 'jacket', 'dress', 'overalls'] as const),
    shirt: pick(CLOTH_COLORS),
    pants: pick(['#2f3b59', '#3a3a44', '#6b4f3a', '#c8b38a', '#4c6b4a']),
    shoes: pick(['#f4efe6', '#2a2a2a', '#c2412f', '#4a7bd0']),
    accessory: pick(['none', 'none', 'glasses', 'beanie', 'cap', 'headphones', 'bandana', 'shades'] as const),
    accessoryColor: pick(CLOTH_COLORS),
    height: 0.92 + Math.random() * 0.16,
    width: 0.92 + Math.random() * 0.18,
    personality: pick(['chill', 'energetic', 'shy', 'showoff'] as const),
  };
}

const FX_BY_INSTRUMENT: Record<InstrumentType, () => Effect[]> = {
  drums: () => [makeEffect('compressor', { threshold: -16, ratio: 3, attack: 0.008, makeup: 3 })],
  bass: () => [makeEffect('compressor', { threshold: -20, ratio: 5, makeup: 5 }), makeEffect('eq', { low: 3, mid: -2, high: -3 })],
  guitar: () => [makeEffect('distortion', { drive: 0.25, tone: 0.55, mix: 0.6 }), makeEffect('amp', { gain: 0.3 }), makeEffect('delay', { mix: 0.22 })],
  keys: () => [makeEffect('eq', { low: -1, high: 2 }), makeEffect('chorus', { mix: 0.25, depth: 0.35 })],
  synth: () => [makeEffect('chorus'), makeEffect('delay', { mix: 0.2 })],
  sampler: () => [makeEffect('compressor')],
  vocal: () => [makeEffect('eq', { low: -4, high: 3 }), makeEffect('compressor', { threshold: -22, ratio: 4 })],
};

export const STATION_COUNT = 8;

export function newTrack(instrument: InstrumentType, station: number, look?: MusicianLook): Track {
  const info = INSTRUMENTS[instrument];
  return {
    id: uid('trk'),
    name: info.label,
    kind: instrument === 'vocal' ? 'audio' : 'midi',
    instrument,
    inst: { preset: info.presets[0], tone: 0.5, attack: 0.005, release: 0.3, detune: 8 },
    color: info.color,
    volume: -6,
    pan: 0,
    mute: false,
    solo: false,
    armed: false,
    fx: FX_BY_INSTRUMENT[instrument](),
    sends: { reverb: instrument === 'drums' ? 0.12 : 0.25, delay: 0 },
    clips: [],
    automation: [],
    musician: look ?? randomLook(),
    station,
  };
}

export function newPattern(name: string, length = 16, notes: Note[] = []): Pattern {
  return { id: uid('pat'), name, length, notes };
}

const n = (pitch: number, start: number, dur: number, vel = 0.8): Note => ({ id: uid('n'), pitch, start, dur, vel });

function drumPattern(): Note[] {
  const out: Note[] = [];
  for (let bar = 0; bar < 4; bar++) {
    const b = bar * 4;
    out.push(n(36, b, 0.25, 0.95), n(36, b + 1.75, 0.25, 0.6), n(36, b + 2.5, 0.25, 0.85));
    out.push(n(38, b + 1, 0.25, 0.9), n(38, b + 3, 0.25, bar === 3 ? 0.8 : 0.92));
    for (let i = 0; i < 8; i++) {
      if (bar === 3 && i === 7) continue;
      out.push(n(42, b + i * 0.5, 0.25, i % 2 ? 0.45 : 0.75));
    }
    if (bar === 1 || bar === 3) out.push(n(38, b + 2.75, 0.25, 0.35)); // ghost note
  }
  out.push(n(49, 0, 1, 0.8));
  out.push(n(46, 15.5, 0.5, 0.7));
  out.push(n(48, 15, 0.25, 0.7), n(47, 15.25, 0.25, 0.75), n(45, 15.5, 0.25, 0.8), n(41, 15.75, 0.25, 0.85));
  return out;
}

// IV - iii - ii - I in C: Fmaj7 Em7 Dm7 Cmaj9
const CHORDS = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [52, 55, 59, 62],
];
const ROOTS = [41, 40, 38, 36];

function keysPattern(): Note[] {
  const out: Note[] = [];
  CHORDS.forEach((ch, bar) => {
    const b = bar * 4;
    const hits: [number, number, number][] = [
      [0, 1.4, 0.75],
      [1.5, 0.45, 0.55],
      [2.5, 1.4, 0.68],
    ];
    for (const [t, d, v] of hits) ch.forEach((p, i) => out.push(n(p, b + t + i * 0.012, d, v - i * 0.03)));
  });
  return out;
}

function bassPattern(): Note[] {
  const out: Note[] = [];
  ROOTS.forEach((r, bar) => {
    const b = bar * 4;
    const next = ROOTS[(bar + 1) % 4];
    out.push(n(r, b, 0.9, 0.9), n(r, b + 1.5, 0.4, 0.7), n(r + 7, b + 2, 0.45, 0.75), n(r + 12, b + 2.5, 0.4, 0.7), n(r, b + 3, 0.45, 0.75));
    out.push(n(next + (next > r ? -1 : 2), b + 3.5, 0.45, 0.7));
  });
  return out;
}

function guitarPattern(): Note[] {
  const s: [number, number, number][][] = [
    [[69, 0, 0.5], [72, 0.5, 0.5], [76, 1, 1], [74, 2.5, 0.5], [72, 3, 1]],
    [[71, 0, 1.5], [67, 1.5, 0.5], [71, 2, 0.5], [74, 2.5, 1.5]],
    [[77, 0, 0.5], [76, 0.5, 0.5], [74, 1, 0.5], [72, 1.5, 0.5], [69, 2, 1.5], [72, 3.5, 0.5]],
    [[71, 0, 0.5], [67, 0.5, 0.5], [64, 1, 1], [67, 2, 0.5], [71, 2.5, 0.5], [72, 3, 1]],
  ];
  return s.flatMap((bar, i) => bar.map(([p, t, d]) => n(p, i * 4 + t, d * 0.95, 0.7 + Math.random() * 0.15)));
}

export function demoProject(): Project {
  const drums = newTrack('drums', 0, {
    ...randomLook('Juno'), skin: SKIN_TONES[2], hair: 'afro', hairColor: '#1f1a17', outfit: 'tee', shirt: '#e8553d',
    pants: '#2f3b59', accessory: 'headphones', accessoryColor: '#3a3a44', personality: 'energetic', height: 1, width: 1.05,
    eyes: 0, brows: 1, mouth: 0,
  });
  const bass = newTrack('bass', 1, {
    ...randomLook('Bo'), skin: SKIN_TONES[5], hair: 'buzz', hairColor: '#1f1a17', outfit: 'overalls', shirt: '#f2a541',
    pants: '#3f6fa8', accessory: 'shades', accessoryColor: '#222', personality: 'chill', height: 1.08, width: 1.1,
    eyes: 2, brows: 0, mouth: 1,
  });
  const guitar = newTrack('guitar', 2, {
    ...randomLook('Pip'), skin: SKIN_TONES[0], hair: 'spiky', hairColor: '#d8a85b', outfit: 'jacket', shirt: '#4a7bd0',
    pants: '#3a3a44', accessory: 'none', personality: 'showoff', height: 0.96, width: 0.95, eyes: 1, brows: 2, mouth: 2,
  });
  const keys = newTrack('keys', 3, {
    ...randomLook('Mika'), skin: SKIN_TONES[1], hair: 'bun', hairColor: '#6a4328', outfit: 'dress', shirt: '#6fbf5e',
    pants: '#2f3b59', accessory: 'glasses', accessoryColor: '#8b5a3c', personality: 'shy', height: 0.94, width: 0.95,
    eyes: 3, brows: 0, mouth: 0,
  });
  keys.inst.preset = 'Electric Piano';
  guitar.pan = 0.25;
  keys.pan = -0.2;
  bass.volume = -2;
  guitar.volume = -4;
  keys.volume = -4;
  drums.volume = -3;

  const dp = newPattern('Groove A', 16, drumPattern());
  const kp = newPattern('Chords', 16, keysPattern());
  const bp = newPattern('Bassline', 16, bassPattern());
  const gp = newPattern('Melody', 16, guitarPattern());

  const clip = (patternId: string, start: number, length: number) => ({ id: uid('clip'), patternId, start, length, offset: 0, gain: 1 });
  keys.clips = [clip(kp.id, 0, 64)];
  drums.clips = [clip(dp.id, 8, 56)];
  bass.clips = [clip(bp.id, 16, 48)];
  guitar.clips = [clip(gp.id, 32, 32)];

  return {
    version: 1,
    name: 'Sunday Session',
    bpm: 92,
    beatsPerBar: 4,
    loop: { enabled: true, start: 0, end: 64 },
    metronome: false,
    snap: 0.25,
    tracks: [drums, bass, guitar, keys],
    patterns: { [dp.id]: dp, [kp.id]: kp, [bp.id]: bp, [gp.id]: gp },
    buses: [
      { id: 'reverb', name: 'Reverb Room', volume: 0, fx: [makeEffect('reverb', { size: 2.4, mix: 1, damp: 0.45 })] },
      { id: 'delay', name: 'Echo Bus', volume: -3, fx: [makeEffect('delay', { mix: 1, feedback: 0.4, time: 0.75 })] },
    ],
    master: { volume: 0, fx: [makeEffect('compressor', { threshold: -10, ratio: 2, attack: 0.02, release: 0.25, makeup: 1 })] },
    audio: {},
  };
}

export function emptyProject(): Project {
  return { ...demoProject(), name: 'Untitled', tracks: [], patterns: {}, audio: {} };
}
