import { useRef } from 'react';
import { act, engine, selectTrack, store, toast, ui, world } from '../app';
import { useProject, useRaf, useUi } from './hooks';
import { INSTRUMENTS } from '../state/specs';
import type { InstrumentType } from '../state/types';
import { freeStation } from '../state/actions';

export function BandPanel() {
  const tracks = useProject((p) => p.tracks);
  const selected = useUi((s) => s.selected);
  const recruitOpen = useUi((s) => s.recruitOpen);
  const meters = useRef(new Map<string, HTMLElement>());
  useRaf(() => {
    for (const [id, el] of meters.current) el.style.transform = `scaleX(${Math.min(1, engine.level(id) * 1.4)})`;
  });
  const recruit = (inst: InstrumentType) => {
    const id = act.recruit(inst);
    ui.set({ recruitOpen: false });
    if (!id) return toast('The studio is full — dismiss someone first');
    selectTrack(id);
    ui.set({ panel: 'look' });
    toast(`${store.get().tracks.find((t) => t.id === id)?.musician.name} joined the band!`);
  };
  return (
    <aside className="band card">
      <h2>Your band</h2>
      <ul>
        {tracks.map((t) => (
          <li key={t.id} className={selected === t.id ? 'sel' : ''} onClick={() => (selectTrack(t.id), world.current?.focusOn(t.id))}>
            <span className="avatar" style={{ background: t.musician.shirt, borderColor: t.color }}>{t.musician.name[0]}</span>
            <span className="who">
              <b>{t.musician.name}</b>
              <small>{INSTRUMENTS[t.instrument].role} · {t.inst.preset}</small>
              <span className="meter"><span ref={(el) => void (el ? meters.current.set(t.id, el) : meters.current.delete(t.id))} style={{ background: t.color }} /></span>
            </span>
            <span className="ms" onClick={(e) => e.stopPropagation()}>
              <button className={`chip ${t.mute ? 'mute' : ''}`} title="Mute" onClick={() => act.toggle(t.id, 'mute')}>M</button>
              <button className={`chip ${t.solo ? 'solo' : ''}`} title="Solo" onClick={() => act.toggle(t.id, 'solo')}>S</button>
            </span>
          </li>
        ))}
      </ul>
      {recruitOpen ? (
        <div className="recruit">
          {(Object.keys(INSTRUMENTS) as InstrumentType[]).map((k) => (
            <button key={k} disabled={freeStation(store.get(), k) === null} onClick={() => recruit(k)}>
              <span className="dot" style={{ background: INSTRUMENTS[k].color }} />
              {INSTRUMENTS[k].role}
              <small>{INSTRUMENTS[k].label}</small>
            </button>
          ))}
          <button className="ghost" onClick={() => ui.set({ recruitOpen: false })}>Cancel</button>
        </div>
      ) : (
        <button className="primary block" onClick={() => ui.set({ recruitOpen: true })}>＋ Recruit a musician</button>
      )}
    </aside>
  );
}

// Name tags that float above each musician in the overhead view. Positioned imperatively every frame.
export function DirectorLabels() {
  const tracks = useProject((p) => p.tracks);
  const refs = useRef(new Map<string, HTMLDivElement>());
  useRaf(() => {
    const w = world.current;
    if (!w) return;
    for (const [id, el] of refs.current) {
      const l = w.labels.get(id);
      if (!l || !l.visible) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      el.style.transform = `translate(${l.x}px, ${l.y}px) translate(-50%, -100%)`;
      const ring = el.querySelector('.lvl') as HTMLElement | null;
      if (ring) ring.style.transform = `scale(${0.6 + Math.min(1, engine.level(id) * 1.6) * 0.6})`;
    }
  });
  return (
    <div className="labels">
      {tracks.map((t) => (
        <div key={t.id} className={`nametag ${t.mute ? 'muted' : ''}`} ref={(el) => void (el ? refs.current.set(t.id, el) : refs.current.delete(t.id))} onClick={() => selectTrack(t.id)}>
          <span className="lvl" style={{ background: t.color }} />
          {t.musician.name}
          {t.solo && <em>solo</em>}
          {t.mute && <em>muted</em>}
        </div>
      ))}
    </div>
  );
}
