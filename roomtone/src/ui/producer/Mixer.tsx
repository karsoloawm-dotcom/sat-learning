import { useRef } from 'react';
import { act, engine, selectTrack, store } from '../../app';
import { useProject, useRaf, useUi } from '../hooks';
import { EFFECTS, normToVolume, volumeToNorm } from '../../state/specs';
import { Knob } from '../Knob';

const PAN = { key: 'pan', label: 'Pan', min: -1, max: 1, def: 0 };
const SEND = { key: 'send', label: '', min: 0, max: 1, def: 0 };

function Fader({ db, onChange, label }: { db: number; onChange: (db: number, live: boolean) => void; label: string }) {
  return (
    <input
      className="fader"
      type="range"
      min={0}
      max={1}
      step={0.001}
      value={volumeToNorm(db)}
      aria-label={label}
      onChange={(e) => onChange(normToVolume(Number(e.target.value)), true)}
      onPointerUp={() => store.commitGesture(label)}
      onKeyUp={() => store.commitGesture(label)}
      onDoubleClick={() => onChange(0, false)}
    />
  );
}

export function Mixer() {
  const tracks = useProject((p) => p.tracks);
  const buses = useProject((p) => p.buses);
  const master = useProject((p) => p.master);
  const selected = useUi((s) => s.selected);
  const meters = useRef(new Map<string, HTMLDivElement>());
  const peaksHold = useRef(new Map<string, number>());
  useRaf((dt) => {
    for (const [id, el] of meters.current) {
      const l = engine.level(id === 'master' ? undefined : id);
      const db = 20 * Math.log10(Math.max(1e-5, l));
      const h = Math.max(0, Math.min(1, (db + 54) / 60));
      const held = Math.max(h, (peaksHold.current.get(id) ?? 0) - dt * 0.4);
      peaksHold.current.set(id, held);
      (el.firstChild as HTMLElement).style.transform = `scaleY(${h})`;
      (el.lastChild as HTMLElement).style.bottom = `${held * 100}%`;
      el.classList.toggle('clip', l >= 0.99);
    }
  });
  const meter = (id: string) => (
    <div className="vu" ref={(el) => void (el ? meters.current.set(id, el) : meters.current.delete(id))}>
      <span className="vu-fill" />
      <span className="vu-peak" />
    </div>
  );
  return (
    <div className="mixer">
      {tracks.map((t) => (
        <div key={t.id} className={`strip ${selected === t.id ? 'sel' : ''}`} style={{ borderTopColor: t.color }} onClick={() => selectTrack(t.id, false)}>
          <div className="strip-name" title={t.name}>
            <span className="avatar sm" style={{ background: t.musician.shirt }}>{t.musician.name[0]}</span>
            {t.name}
          </div>
          <div className="strip-fx">
            {t.fx.map((e) => (
              <span key={e.id} className={`fx-pill ${e.enabled ? '' : 'off'}`} style={{ background: EFFECTS[e.type].color }} title={`${EFFECTS[e.type].gearName}${e.enabled ? '' : ' (bypassed)'}`}>
                {EFFECTS[e.type].name}
              </span>
            ))}
          </div>
          <div className="sends">
            {buses.map((b) => (
              <Knob key={b.id} size={30} spec={{ ...SEND, label: b.name.split(' ')[0] }} value={t.sends[b.id] ?? 0} color="#4ab3c9" onChange={(v, live) => store.update('Send level', (d) => void (d.tracks.find((x) => x.id === t.id)!.sends[b.id] = v), live ? { history: 'none' } : { coalesce: `send:${b.id}:${t.id}` })} />
            ))}
          </div>
          <Knob size={34} spec={PAN} value={t.pan} onChange={(v, live) => act.setPan(t.id, v, live)} automated={t.automation.some((l) => l.target === 'pan' && l.points.length > 0)} />
          <div className="fader-wrap">
            {meter(t.id)}
            <Fader db={t.volume} label={`${t.name} volume`} onChange={(db, live) => act.setVolume(t.id, db, live)} />
          </div>
          <div className="db">{t.volume <= -60 ? '-∞' : t.volume.toFixed(1)}</div>
          <div className="ms">
            <button className={`chip ${t.mute ? 'mute' : ''}`} onClick={(e) => (e.stopPropagation(), act.toggle(t.id, 'mute'))}>M</button>
            <button className={`chip ${t.solo ? 'solo' : ''}`} onClick={(e) => (e.stopPropagation(), act.toggle(t.id, 'solo'))}>S</button>
          </div>
        </div>
      ))}
      {buses.map((b) => (
        <div key={b.id} className="strip bus">
          <div className="strip-name">{b.name}</div>
          <div className="strip-fx">
            {b.fx.map((e) => (
              <span key={e.id} className="fx-pill" style={{ background: EFFECTS[e.type].color }}>{EFFECTS[e.type].name}</span>
            ))}
          </div>
          <div className="fader-wrap">
            <Fader db={b.volume} label={`${b.name} volume`} onChange={(db, live) => store.update('Bus volume', (d) => void (d.buses.find((x) => x.id === b.id)!.volume = db), live ? { history: 'none' } : {})} />
          </div>
          <div className="db">{b.volume <= -60 ? '-∞' : b.volume.toFixed(1)}</div>
        </div>
      ))}
      <div className="strip master">
        <div className="strip-name">Master</div>
        <div className="strip-fx">
          {master.fx.map((e) => (
            <span key={e.id} className="fx-pill" style={{ background: EFFECTS[e.type].color }}>{EFFECTS[e.type].name}</span>
          ))}
        </div>
        <div className="fader-wrap">
          {meter('master')}
          <Fader db={master.volume} label="Master volume" onChange={(db, live) => act.setVolume('master', db, live)} />
        </div>
        <div className="db">{master.volume.toFixed(1)}</div>
      </div>
    </div>
  );
}
