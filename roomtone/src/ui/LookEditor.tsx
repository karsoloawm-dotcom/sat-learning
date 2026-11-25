import { useState } from 'react';
import { store, toast } from '../app';
import type { Accessory, HairStyle, MusicianLook, Outfit, Track } from '../state/types';
import { CLOTH_COLORS, HAIR_COLORS, SKIN_TONES, randomLook } from '../state/defaults';
import { loadPresets, savePresets } from '../state/persistence';

const HAIR: HairStyle[] = ['bob', 'spiky', 'ponytail', 'bun', 'afro', 'buzz', 'long', 'mohawk', 'bald'];
const OUTFITS: Outfit[] = ['tee', 'hoodie', 'jacket', 'dress', 'overalls'];
const ACC: Accessory[] = ['none', 'glasses', 'shades', 'beanie', 'cap', 'headphones', 'bandana'];

function Swatches({ colors, value, onPick }: { colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="swatches">
      {colors.map((c) => (
        <button key={c} className={`sw ${c === value ? 'on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => onPick(c)} />
      ))}
      <input type="color" value={value} onChange={(e) => onPick(e.target.value)} aria-label="Custom colour" />
    </div>
  );
}

function Pills<T extends string | number>({ options, value, onPick, label = (x: T) => String(x) }: { options: T[]; value: T; onPick: (v: T) => void; label?: (x: T) => string }) {
  return (
    <div className="pills">
      {options.map((o) => (
        <button key={String(o)} className={o === value ? 'on' : ''} onClick={() => onPick(o)}>{label(o)}</button>
      ))}
    </div>
  );
}

export function LookEditor({ track }: { track: Track }) {
  const look = track.musician;
  const [presets, setPresets] = useState(loadPresets);
  const set = (patch: Partial<MusicianLook>, coalesce?: string) =>
    store.update('Change look', (d) => {
      const t = d.tracks.find((x) => x.id === track.id);
      if (t) Object.assign(t.musician, patch);
    }, coalesce ? { coalesce: `${coalesce}:${track.id}` } : {});
  return (
    <div className="look">
      <label className="row">
        <span>Name</span>
        <input value={look.name} maxLength={16} onChange={(e) => set({ name: e.target.value }, 'name')} />
      </label>
      <h4>Skin</h4>
      <Swatches colors={SKIN_TONES} value={look.skin} onPick={(c) => set({ skin: c })} />
      <h4>Hair</h4>
      <Pills options={HAIR} value={look.hair} onPick={(v) => set({ hair: v })} />
      <Swatches colors={HAIR_COLORS} value={look.hairColor} onPick={(c) => set({ hairColor: c })} />
      <h4>Face</h4>
      <div className="row"><span>Eyes</span><Pills options={[0, 1, 2, 3]} value={look.eyes} onPick={(v) => set({ eyes: v })} label={(i) => ['dots', 'ovals', 'bright', 'soft'][i]} /></div>
      <div className="row"><span>Brows</span><Pills options={[0, 1, 2]} value={look.brows} onPick={(v) => set({ brows: v })} label={(i) => ['calm', 'kind', 'bold'][i]} /></div>
      <div className="row"><span>Mouth</span><Pills options={[0, 1, 2]} value={look.mouth} onPick={(v) => set({ mouth: v })} label={(i) => ['smile', 'grin', 'cool'][i]} /></div>
      <div className="row"><span>Eye colour</span><Swatches colors={['#2b1d14', '#3d6bb3', '#3f7d4a', '#5a3a1e', '#7a5cc4']} value={look.eyeColor} onPick={(c) => set({ eyeColor: c })} /></div>
      <h4>Outfit</h4>
      <Pills options={OUTFITS} value={look.outfit} onPick={(v) => set({ outfit: v })} />
      <div className="row"><span>Top</span><Swatches colors={CLOTH_COLORS} value={look.shirt} onPick={(c) => set({ shirt: c })} /></div>
      <div className="row"><span>Bottom</span><Swatches colors={['#2f3b59', '#3a3a44', '#6b4f3a', '#c8b38a', '#4c6b4a', '#3f6fa8']} value={look.pants} onPick={(c) => set({ pants: c })} /></div>
      <div className="row"><span>Shoes</span><Swatches colors={['#f4efe6', '#2a2a2a', '#c2412f', '#4a7bd0', '#f2a541']} value={look.shoes} onPick={(c) => set({ shoes: c })} /></div>
      <h4>Accessory</h4>
      <Pills options={ACC} value={look.accessory} onPick={(v) => set({ accessory: v })} />
      {look.accessory !== 'none' && <Swatches colors={CLOTH_COLORS} value={look.accessoryColor} onPick={(c) => set({ accessoryColor: c })} />}
      <h4>Build &amp; personality</h4>
      <label className="row"><span>Height</span><input type="range" min={0.85} max={1.15} step={0.01} value={look.height} onChange={(e) => set({ height: Number(e.target.value) }, 'h')} /></label>
      <label className="row"><span>Build</span><input type="range" min={0.85} max={1.2} step={0.01} value={look.width} onChange={(e) => set({ width: Number(e.target.value) }, 'w')} /></label>
      <Pills options={['chill', 'energetic', 'shy', 'showoff'] as MusicianLook['personality'][]} value={look.personality} onPick={(v) => set({ personality: v })} />
      <div className="row gap">
        <button onClick={() => set({ ...randomLook(look.name) })}>🎲 Surprise me</button>
        <button
          onClick={() => {
            const next = [...presets.filter((p) => p.name !== look.name), look];
            savePresets(next);
            setPresets(next);
            toast(`Saved ${look.name} as a preset`);
          }}
        >
          💾 Save preset
        </button>
      </div>
      {presets.length > 0 && (
        <>
          <h4>Saved musicians</h4>
          <div className="presets">
            {presets.map((p) => (
              <span key={p.name} className="preset">
                <button onClick={() => set({ ...p })} title={`Apply ${p.name}'s look`}>
                  <span className="avatar" style={{ background: p.shirt }}>{p.name[0]}</span>
                  {p.name}
                </button>
                <button className="icon" title="Delete preset" onClick={() => { const next = presets.filter((x) => x !== p); savePresets(next); setPresets(next); }}>✕</button>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
