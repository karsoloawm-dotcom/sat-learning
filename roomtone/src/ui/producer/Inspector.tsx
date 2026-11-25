import { useState } from 'react';
import { selectTrack, store, toast, ui } from '../../app';
import { useProject, useUi } from '../hooks';
import { INSTRUMENTS } from '../../state/specs';
import { FxChain } from '../FxChain';
import { connectMidi } from '../keyboard';
import { putAsset } from '../../audio/assets';
import { engine } from '../../app';
import { uid } from '../../state/store';
import type { Draft } from 'immer';
import type { Track } from '../../state/types';

export function Inspector() {
  const selected = useUi((s) => s.selected);
  const t = useProject((p) => p.tracks.find((x) => x.id === selected));
  const buses = useProject((p) => p.buses);
  const masterFx = useProject((p) => p.master.fx);
  const [tab, setTab] = useState<'track' | 'master'>('track');
  const set = (label: string, fn: (t: Draft<Track>) => void, coalesce?: string) =>
    store.update(label, (d) => {
      const x = d.tracks.find((k) => k.id === selected);
      if (x) fn(x);
    }, coalesce ? { coalesce } : {});
  return (
    <aside className="inspector">
      <nav className="tabs">
        <button className={tab === 'track' ? 'on' : ''} onClick={() => setTab('track')}>Track</button>
        <button className={tab === 'master' ? 'on' : ''} onClick={() => setTab('master')}>Master &amp; buses</button>
      </nav>
      {tab === 'master' ? (
        <div className="insp-body">
          <h4>Master chain</h4>
          <FxChain owner="master" ownerId="master" fx={masterFx} compact />
          {buses.map((b) => (
            <div key={b.id}>
              <h4>{b.name} bus</h4>
              <FxChain owner="bus" ownerId={b.id} fx={b.fx} compact />
            </div>
          ))}
        </div>
      ) : !t ? (
        <div className="insp-body"><p className="muted">Select a track to see its instrument and effects.</p></div>
      ) : (
        <div className="insp-body">
          <div className="row">
            <span className="avatar" style={{ background: t.musician.shirt, borderColor: t.color }}>{t.musician.name[0]}</span>
            <div className="grow">
              <b>{t.musician.name}</b> <small className="muted">{INSTRUMENTS[t.instrument].role}</small>
            </div>
            <input type="color" value={t.color} aria-label="Track colour" onChange={(e) => set('Track colour', (x) => void (x.color = e.target.value), `color:${t.id}`)} />
          </div>
          {t.kind === 'midi' && (
            <>
              <h4>Instrument</h4>
              <label className="row">
                <span>Sound</span>
                <select value={t.inst.preset} onChange={(e) => set('Change sound', (x) => void (x.inst.preset = e.target.value))}>
                  {INSTRUMENTS[t.instrument].presets.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
              <label className="row"><span>Tone</span><input type="range" min={0} max={1} step={0.01} value={t.inst.tone} onChange={(e) => set('Tone', (x) => void (x.inst.tone = Number(e.target.value)), `tone:${t.id}`)} /></label>
              {(t.instrument === 'synth' || t.inst.preset === 'Synth Bass') && (
                <>
                  <label className="row"><span>Attack</span><input type="range" min={0.002} max={1.5} step={0.001} value={t.inst.attack} onChange={(e) => set('Attack', (x) => void (x.inst.attack = Number(e.target.value)), `atk:${t.id}`)} /></label>
                  <label className="row"><span>Detune</span><input type="range" min={0} max={40} step={0.5} value={t.inst.detune} onChange={(e) => set('Detune', (x) => void (x.inst.detune = Number(e.target.value)), `det:${t.id}`)} /></label>
                </>
              )}
              <label className="row"><span>Release</span><input type="range" min={0.02} max={2} step={0.01} value={t.inst.release} onChange={(e) => set('Release', (x) => void (x.inst.release = Number(e.target.value)), `rel:${t.id}`)} /></label>
              {t.instrument === 'sampler' && (
                <label className="row">
                  <span>Sample</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const buf = await engine.ctx.decodeAudioData(await f.arrayBuffer());
                      const id = uid('aud');
                      putAsset(id, buf);
                      store.update('Load sample', (d) => {
                        d.audio[id] = { id, name: f.name, duration: buf.duration, sampleRate: buf.sampleRate, channels: buf.numberOfChannels };
                        const x = d.tracks.find((k) => k.id === t.id)!;
                        x.inst.sampleId = id;
                        x.inst.rootNote = 60;
                      });
                      toast(`Loaded ${f.name} into the sampler (root C4)`);
                    }}
                  />
                </label>
              )}
              <button className="ghost" onClick={async () => toast(await connectMidi())}>🎹 Connect MIDI keyboard</button>
            </>
          )}
          <h4>Effects chain <small className="muted">(signal flows top → bottom)</small></h4>
          <FxChain owner="track" ownerId={t.id} fx={t.fx} automated={t.automation.filter((l) => l.points.length).map((l) => l.target)} compact />
          <h4>Sends</h4>
          {buses.map((b) => (
            <label key={b.id} className="row">
              <span>{b.name}</span>
              <input type="range" min={0} max={1} step={0.01} value={t.sends[b.id] ?? 0} onChange={(e) => set('Send level', (x) => void (x.sends[b.id] = Number(e.target.value)), `send:${b.id}:${t.id}`)} />
            </label>
          ))}
          <button className="ghost" onClick={() => (ui.set({ view: 'director', panel: 'look' }), selectTrack(t.id))}>Customise {t.musician.name} ▸</button>
        </div>
      )}
    </aside>
  );
}
