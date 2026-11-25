import type { Draft } from 'immer';
import type { Track } from '../state/types';
import { act, selectTrack, setView, store, toast, ui } from '../app';
import { useProject, useUi } from './hooks';
import { INSTRUMENTS, volumeToNorm, normToVolume } from '../state/specs';
import { FxChain } from './FxChain';
import { LookEditor } from './LookEditor';
import { MiniRoll } from './producer/PianoRoll';

const TABS = [
  { id: 'play', label: 'Play' },
  { id: 'part', label: 'Part' },
  { id: 'effects', label: 'Gear' },
  { id: 'look', label: 'Look' },
] as const;

export function MusicianDrawer() {
  const selected = useUi((s) => s.selected);
  const tab = useUi((s) => s.panel);
  const track = useProject((p) => p.tracks.find((t) => t.id === selected));
  if (!track || !tab) return null;
  const info = INSTRUMENTS[track.instrument];
  const set = (label: string, fn: (t: Draft<Track>) => void, coalesce?: string) =>
    store.update(label, (d) => {
      const t = d.tracks.find((x) => x.id === track.id);
      if (t) fn(t);
    }, coalesce ? { coalesce } : {});
  return (
    <aside className="drawer card" aria-label={`${track.musician.name}'s panel`}>
      <header>
        <span className="avatar big" style={{ background: track.musician.shirt, borderColor: track.color }}>{track.musician.name[0]}</span>
        <div>
          <h2>{track.musician.name}</h2>
          <small>{info.role} · {track.name}</small>
        </div>
        <button className="icon close" title="Close" onClick={() => selectTrack(null)}>✕</button>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => ui.set({ panel: t.id })}>{t.label}</button>
        ))}
      </nav>
      <div className="drawer-body">
        {tab === 'play' && (
          <div className="stack">
            <label className="row">
              <span>Volume</span>
              <input type="range" min={0} max={1} step={0.001} value={volumeToNorm(track.volume)} onChange={(e) => act.setVolume(track.id, normToVolume(Number(e.target.value)))} />
              <output>{track.volume <= -60 ? '-∞' : track.volume.toFixed(1)} dB</output>
            </label>
            <label className="row">
              <span>Pan</span>
              <input type="range" min={-1} max={1} step={0.01} value={track.pan} onChange={(e) => act.setPan(track.id, Number(e.target.value))} onDoubleClick={() => act.setPan(track.id, 0)} />
              <output>{Math.abs(track.pan) < 0.02 ? 'C' : `${Math.round(Math.abs(track.pan) * 100)}${track.pan < 0 ? 'L' : 'R'}`}</output>
            </label>
            <div className="row">
              <span>Status</span>
              <button className={`chip ${track.mute ? 'mute' : ''}`} onClick={() => act.toggle(track.id, 'mute')}>Mute</button>
              <button className={`chip ${track.solo ? 'solo' : ''}`} onClick={() => act.toggle(track.id, 'solo')}>Solo</button>
              <button className={`chip ${track.armed ? 'arm' : ''}`} onClick={() => act.toggle(track.id, 'armed')}>Rec arm</button>
            </div>
            {track.kind === 'midi' && (
              <>
                <label className="row">
                  <span>Sound</span>
                  <select value={track.inst.preset} onChange={(e) => set('Change sound', (t) => void (t.inst.preset = e.target.value))}>
                    {info.presets.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </label>
                <label className="row">
                  <span>Tone</span>
                  <input type="range" min={0} max={1} step={0.01} value={track.inst.tone} onChange={(e) => set('Tone', (t) => void (t.inst.tone = Number(e.target.value)), `tone:${track.id}`)} />
                  <output>{Math.round(track.inst.tone * 100)}%</output>
                </label>
              </>
            )}
            <label className="row">
              <span>Reverb send</span>
              <input type="range" min={0} max={1} step={0.01} value={track.sends.reverb ?? 0} onChange={(e) => set('Reverb send', (t) => void (t.sends.reverb = Number(e.target.value)), `send:r:${track.id}`)} />
              <output>{Math.round((track.sends.reverb ?? 0) * 100)}%</output>
            </label>
            <label className="row">
              <span>Echo send</span>
              <input type="range" min={0} max={1} step={0.01} value={track.sends.delay ?? 0} onChange={(e) => set('Echo send', (t) => void (t.sends.delay = Number(e.target.value)), `send:d:${track.id}`)} />
              <output>{Math.round((track.sends.delay ?? 0) * 100)}%</output>
            </label>
            <p className="muted small">Tip: turn on ⌨ musical typing in the top bar to play {track.musician.name} live with the Z–M keys.</p>
          </div>
        )}
        {tab === 'part' && (
          <div className="stack">
            {track.kind === 'midi' ? <MiniRoll trackId={track.id} /> : <p className="muted">Audio tracks hold recordings. Arm {track.musician.name} and press ● to record from your microphone, or drop audio files in Producer view.</p>}
            <button className="primary" onClick={() => setView('producer')}>Open in Producer ▸</button>
          </div>
        )}
        {tab === 'effects' && (
          <>
            <p className="muted small">Each effect is a real piece of gear next to {track.musician.name}: pedals on the floor, rack units in the tower, the amp behind. Turn knobs here or on the gear itself.</p>
            <FxChain owner="track" ownerId={track.id} fx={track.fx} automated={track.automation.map((l) => l.target)} />
          </>
        )}
        {tab === 'look' && <LookEditor track={track} />}
      </div>
      <footer>
        <button
          className="danger ghost"
          onClick={() => {
            if (!confirm(`Say goodbye to ${track.musician.name}? Their track and parts are removed (you can undo).`)) return;
            act.dismiss(track.id);
            selectTrack(null);
            toast(`${track.musician.name} left the studio (Ctrl+Z to bring them back)`);
          }}
        >
          Dismiss {track.musician.name}
        </button>
      </footer>
    </aside>
  );
}
