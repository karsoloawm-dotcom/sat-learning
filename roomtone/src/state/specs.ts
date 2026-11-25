import type { EffectType, InstrumentType } from './types';

// One table describes every effect parameter. Audio, mixer UI, 3D equipment knobs and automation all read it,
// which keeps the physical gear and the conventional mixer in sync by construction.
export interface ParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  def: number;
  unit?: string;
  log?: boolean; // knob travel is logarithmic
}

export type GearForm = 'pedal' | 'rack' | 'amp';

export interface EffectSpec {
  type: EffectType;
  name: string; // what the beginner sees
  gearName: string; // what the physical object is called in the studio
  form: GearForm;
  color: string;
  params: ParamSpec[];
}

export const EFFECTS: Record<EffectType, EffectSpec> = {
  distortion: {
    type: 'distortion', name: 'Distortion', gearName: 'Fuzz Muffin pedal', form: 'pedal', color: '#e8553d',
    params: [
      { key: 'drive', label: 'Drive', min: 0, max: 1, def: 0.5 },
      { key: 'tone', label: 'Tone', min: 0, max: 1, def: 0.5 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, def: 1 },
    ],
  },
  chorus: {
    type: 'chorus', name: 'Chorus', gearName: 'Shimmer Swirl pedal', form: 'pedal', color: '#4ab3c9',
    params: [
      { key: 'rate', label: 'Rate', min: 0.1, max: 6, def: 1.2, unit: 'Hz', log: true },
      { key: 'depth', label: 'Depth', min: 0, max: 1, def: 0.5 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, def: 0.5 },
    ],
  },
  delay: {
    type: 'delay', name: 'Delay', gearName: 'Echo Snail pedal', form: 'pedal', color: '#6fbf5e',
    params: [
      { key: 'time', label: 'Time', min: 0.0625, max: 1, def: 0.375, unit: 'beats' },
      { key: 'feedback', label: 'Repeats', min: 0, max: 0.92, def: 0.35 },
      { key: 'tone', label: 'Tone', min: 0, max: 1, def: 0.6 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, def: 0.3 },
    ],
  },
  reverb: {
    type: 'reverb', name: 'Reverb', gearName: 'Cathedral-in-a-Box', form: 'rack', color: '#8f7ad6',
    params: [
      { key: 'size', label: 'Size', min: 0.2, max: 6, def: 2, unit: 's', log: true },
      { key: 'damp', label: 'Damping', min: 0, max: 1, def: 0.4 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, def: 0.3 },
    ],
  },
  compressor: {
    type: 'compressor', name: 'Compressor', gearName: 'Squeezebox 76', form: 'rack', color: '#d9a441',
    params: [
      { key: 'threshold', label: 'Threshold', min: -60, max: 0, def: -18, unit: 'dB' },
      { key: 'ratio', label: 'Ratio', min: 1, max: 20, def: 4, log: true },
      { key: 'attack', label: 'Attack', min: 0.001, max: 0.3, def: 0.01, unit: 's', log: true },
      { key: 'release', label: 'Release', min: 0.02, max: 1, def: 0.2, unit: 's', log: true },
      { key: 'makeup', label: 'Makeup', min: 0, max: 24, def: 4, unit: 'dB' },
    ],
  },
  eq: {
    type: 'eq', name: 'EQ', gearName: 'Tone Shelf EQ', form: 'rack', color: '#5b8fd9',
    params: [
      { key: 'low', label: 'Low', min: -15, max: 15, def: 0, unit: 'dB' },
      { key: 'mid', label: 'Mid', min: -15, max: 15, def: 0, unit: 'dB' },
      { key: 'midFreq', label: 'Mid Freq', min: 200, max: 5000, def: 1000, unit: 'Hz', log: true },
      { key: 'high', label: 'High', min: -15, max: 15, def: 0, unit: 'dB' },
    ],
  },
  amp: {
    type: 'amp', name: 'Amp', gearName: 'Toaster 30 amplifier', form: 'amp', color: '#3b3330',
    params: [
      { key: 'gain', label: 'Gain', min: 0, max: 1, def: 0.4 },
      { key: 'bass', label: 'Bass', min: -12, max: 12, def: 2, unit: 'dB' },
      { key: 'mid', label: 'Mid', min: -12, max: 12, def: 0, unit: 'dB' },
      { key: 'treble', label: 'Treble', min: -12, max: 12, def: 1, unit: 'dB' },
      { key: 'level', label: 'Level', min: 0, max: 1, def: 0.6 },
    ],
  },
};

export const defaultParams = (type: EffectType): Record<string, number> =>
  Object.fromEntries(EFFECTS[type].params.map((p) => [p.key, p.def]));

export const paramSpec = (type: EffectType, key: string) => EFFECTS[type].params.find((p) => p.key === key)!;

// Normalised knob position <-> value.
export function toNorm(p: ParamSpec, v: number) {
  if (p.log) return Math.log(v / p.min) / Math.log(p.max / p.min);
  return (v - p.min) / (p.max - p.min);
}
export function fromNorm(p: ParamSpec, n: number) {
  n = Math.min(1, Math.max(0, n));
  if (p.log) return p.min * Math.pow(p.max / p.min, n);
  return p.min + n * (p.max - p.min);
}

export function formatParam(p: ParamSpec, v: number) {
  const digits = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  if (!p.unit && p.max === 1 && p.min === 0) return `${Math.round(v * 100)}%`;
  return `${v.toFixed(digits)}${p.unit ? ' ' + p.unit : ''}`;
}

export interface InstrumentInfo {
  type: InstrumentType;
  label: string;
  role: string; // musician job title shown to beginners
  presets: string[];
  color: string;
  defaultOctave: number;
}

export const INSTRUMENTS: Record<InstrumentType, InstrumentInfo> = {
  drums: { type: 'drums', label: 'Drums', role: 'Drummer', presets: ['Studio Kit', 'Tight Funk', 'Big Room'], color: '#e8553d', defaultOctave: 3 },
  bass: { type: 'bass', label: 'Bass Guitar', role: 'Bassist', presets: ['Finger Bass', 'Pick Bass', 'Synth Bass'], color: '#6fbf5e', defaultOctave: 2 },
  guitar: { type: 'guitar', label: 'Electric Guitar', role: 'Guitarist', presets: ['Clean Strat', 'Jangle', 'Muted Funk'], color: '#d9a441', defaultOctave: 4 },
  keys: { type: 'keys', label: 'Piano', role: 'Pianist', presets: ['Upright Piano', 'Electric Piano', 'Organ'], color: '#5b8fd9', defaultOctave: 4 },
  synth: { type: 'synth', label: 'Synthesizer', role: 'Synth Wizard', presets: ['Warm Pad', 'Saw Lead', 'Square Pluck'], color: '#c45fd0', defaultOctave: 4 },
  strings: { type: 'strings', label: 'Strings', role: 'String Player', presets: ['Violin', 'Cello', 'String Section'], color: '#b5651d', defaultOctave: 4 },
  sampler: { type: 'sampler', label: 'Sampler', role: 'Beatmaker', presets: ['One-shot', 'Chromatic'], color: '#d96a9b', defaultOctave: 4 },
  vocal: { type: 'vocal', label: 'Vocals / Audio', role: 'Vocalist', presets: ['Audio'], color: '#f08a5d', defaultOctave: 4 },
};

export const DRUM_NAMES: Record<number, string> = {
  35: 'Kick 2', 36: 'Kick', 37: 'Rim', 38: 'Snare', 39: 'Clap', 40: 'Snare 2', 41: 'Floor Tom', 42: 'Closed Hat',
  43: 'Floor Tom 2', 44: 'Pedal Hat', 45: 'Low Tom', 46: 'Open Hat', 47: 'Mid Tom', 48: 'High Tom', 49: 'Crash',
  50: 'High Tom 2', 51: 'Ride', 53: 'Ride Bell', 56: 'Cowbell', 57: 'Crash 2',
};

export const AUTOMATION_TARGETS = (fx: { id: string; type: EffectType }[]) => [
  { target: 'volume', label: 'Volume', min: -60, max: 6 },
  { target: 'pan', label: 'Pan', min: -1, max: 1 },
  ...fx.flatMap((e) =>
    EFFECTS[e.type].params.map((p) => ({ target: `fx:${e.id}:${p.key}`, label: `${EFFECTS[e.type].name} ${p.label}`, min: p.min, max: p.max })),
  ),
];

// Fader law shared by the on-screen mixer and the physical console: 0 dB sits at ~83% of travel.
export const volumeToNorm = (db: number) => (db <= -60 ? 0 : Math.pow((db + 60) / 66, 2));
export const normToVolume = (n: number) => (n <= 0.0005 ? -60 : Math.min(6, -60 + 66 * Math.sqrt(n)));
