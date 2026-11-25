// The project document. Plain JSON: everything the app needs to rebuild audio, UI and the 3D studio.
// Times are in beats (quarter notes) unless a field says otherwise.

export type InstrumentType = 'drums' | 'bass' | 'guitar' | 'keys' | 'synth' | 'sampler' | 'vocal';

export interface Note {
  id: string;
  pitch: number; // MIDI note number
  start: number; // beats from pattern start
  dur: number; // beats
  vel: number; // 0..1
}

export interface Pattern {
  id: string;
  name: string;
  length: number; // beats; clips longer than this loop the pattern
  notes: Note[];
}

export interface Clip {
  id: string;
  start: number; // beats on the timeline
  length: number; // beats
  patternId?: string; // MIDI clips
  audioId?: string; // audio clips
  offset: number; // beats into the pattern / seconds into the audio asset
  gain: number; // linear
}

export type EffectType = 'eq' | 'compressor' | 'reverb' | 'delay' | 'distortion' | 'amp' | 'chorus';

export interface Effect {
  id: string;
  type: EffectType;
  enabled: boolean;
  params: Record<string, number>;
}

export interface AutomationPoint {
  t: number; // beats
  v: number; // value in the target parameter's own units
}

export interface AutomationLane {
  id: string;
  target: string; // 'volume' | 'pan' | `fx:${effectId}:${param}`
  points: AutomationPoint[];
  enabled: boolean;
}

export type HairStyle = 'bob' | 'spiky' | 'ponytail' | 'bun' | 'afro' | 'buzz' | 'long' | 'mohawk' | 'bald';
export type Accessory = 'none' | 'glasses' | 'shades' | 'beanie' | 'cap' | 'headphones' | 'bandana';
export type Outfit = 'tee' | 'hoodie' | 'jacket' | 'dress' | 'overalls';

export interface MusicianLook {
  name: string;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  eyes: number; // index into eye shapes
  brows: number;
  mouth: number;
  eyeColor: string;
  outfit: Outfit;
  shirt: string;
  pants: string;
  shoes: string;
  accessory: Accessory;
  accessoryColor: string;
  height: number; // 0.85..1.15
  width: number; // 0.85..1.2
  personality: 'chill' | 'energetic' | 'shy' | 'showoff';
}

export interface InstrumentParams {
  preset: string;
  // Generic tone controls every instrument understands; each maps them to its own synthesis.
  tone: number; // 0..1 brightness
  attack: number; // seconds
  release: number; // seconds
  detune: number; // cents (synth)
  sampleId?: string; // sampler
  rootNote?: number; // sampler
}

export interface Track {
  id: string;
  name: string;
  kind: 'midi' | 'audio';
  instrument: InstrumentType;
  inst: InstrumentParams;
  color: string;
  volume: number; // dB
  pan: number; // -1..1
  mute: boolean;
  solo: boolean;
  armed: boolean;
  fx: Effect[];
  sends: Record<string, number>; // busId -> linear send level
  clips: Clip[];
  automation: AutomationLane[];
  musician: MusicianLook;
  station: number; // index into the studio's station list
}

export interface Bus {
  id: string;
  name: string;
  volume: number; // dB
  fx: Effect[];
}

export interface AudioAssetMeta {
  id: string;
  name: string;
  duration: number; // seconds
  sampleRate: number;
  channels: number;
}

export interface Project {
  version: 1;
  name: string;
  bpm: number;
  beatsPerBar: number;
  loop: { enabled: boolean; start: number; end: number };
  metronome: boolean;
  snap: number; // beats; 0 = off
  tracks: Track[];
  patterns: Record<string, Pattern>;
  buses: Bus[];
  master: { volume: number; fx: Effect[] };
  audio: Record<string, AudioAssetMeta>;
}
