import type { Draft } from 'immer';
import type { Effect, EffectType, InstrumentType, MusicianLook, Project } from './types';
import { makeEffect, newPattern, newTrack, STATION_COUNT } from './defaults';
import { type ProjectStore, uid } from './store';
import { EFFECTS, INSTRUMENTS } from './specs';

// Document mutations shared by the React UI, the 3D studio and keyboard shortcuts.

export type FxOwner = 'track' | 'bus' | 'master';

export function fxList(d: Draft<Project> | Project, owner: FxOwner, ownerId: string): Effect[] | undefined {
  if (owner === 'master') return d.master.fx as Effect[];
  if (owner === 'bus') return d.buses.find((b) => b.id === ownerId)?.fx as Effect[] | undefined;
  return d.tracks.find((t) => t.id === ownerId)?.fx as Effect[] | undefined;
}

export function findFx(p: Project, owner: FxOwner, ownerId: string, fxId: string) {
  return fxList(p, owner, ownerId)?.find((e) => e.id === fxId);
}

const PREFERRED_STATION: Record<InstrumentType, number[]> = {
  drums: [0, 5, 6, 1, 2, 3, 4],
  bass: [1, 2, 5, 6, 3, 4, 0],
  guitar: [2, 1, 6, 5, 4, 3, 0],
  keys: [3, 4, 5, 6, 1, 2, 0],
  synth: [4, 3, 6, 5, 2, 1, 0],
  sampler: [5, 6, 4, 3, 2, 1, 0],
  vocal: [7, 6, 5, 4, 3, 2, 1, 0],
};

export function freeStation(p: Project, inst: InstrumentType): number | null {
  const used = new Set(p.tracks.map((t) => t.station));
  for (const s of PREFERRED_STATION[inst]) if (!used.has(s)) return s;
  for (let s = 0; s < STATION_COUNT; s++) if (!used.has(s)) return s;
  return null;
}

export const actions = (store: ProjectStore) => ({
  recruit(inst: InstrumentType, look?: MusicianLook) {
    const p = store.get();
    const station = freeStation(p, inst);
    if (station === null) return null;
    const t = newTrack(inst, station, look);
    const sameKind = p.tracks.filter((x) => x.instrument === inst).length;
    if (sameKind) t.name = `${INSTRUMENTS[inst].label} ${sameKind + 1}`;
    if (t.kind === 'midi') {
      const pat = newPattern(`${t.musician.name}'s part`, 16);
      store.update(`Recruit ${t.musician.name}`, (d) => {
        d.patterns[pat.id] = pat;
        t.clips = [{ id: uid('clip'), patternId: pat.id, start: 0, length: 16, offset: 0, gain: 1 }];
        d.tracks.push(t);
      });
    } else store.update(`Recruit ${t.musician.name}`, (d) => void d.tracks.push(t));
    return t.id;
  },
  dismiss(trackId: string) {
    store.update('Remove musician', (d) => {
      d.tracks = d.tracks.filter((t) => t.id !== trackId);
      // Drop patterns no clip references any more.
      const used = new Set(d.tracks.flatMap((t) => t.clips.map((c) => c.patternId)));
      for (const id of Object.keys(d.patterns)) if (!used.has(id)) delete d.patterns[id];
    });
  },
  setFxParam(owner: FxOwner, ownerId: string, fxId: string, key: string, v: number, live = false) {
    store.update(
      'Adjust effect',
      (d) => {
        const e = fxList(d, owner, ownerId)?.find((x) => x.id === fxId);
        if (e) e.params[key] = v;
      },
      live ? { history: 'none' } : { coalesce: `fx:${fxId}:${key}` },
    );
  },
  toggleFx(owner: FxOwner, ownerId: string, fxId: string) {
    store.update('Toggle effect', (d) => {
      const e = fxList(d, owner, ownerId)?.find((x) => x.id === fxId);
      if (e) e.enabled = !e.enabled;
    });
  },
  addFx(owner: FxOwner, ownerId: string, type: EffectType) {
    store.update(`Add ${EFFECTS[type].name}`, (d) => void fxList(d, owner, ownerId)?.push(makeEffect(type)));
  },
  removeFx(owner: FxOwner, ownerId: string, fxId: string) {
    store.update('Remove effect', (d) => {
      const list = fxList(d, owner, ownerId);
      const i = list?.findIndex((e) => e.id === fxId) ?? -1;
      if (list && i >= 0) list.splice(i, 1);
      for (const t of d.tracks) t.automation = t.automation.filter((l) => !l.target.startsWith(`fx:${fxId}:`));
    });
  },
  moveFx(owner: FxOwner, ownerId: string, fxId: string, dir: -1 | 1) {
    store.update('Reorder effects', (d) => {
      const list = fxList(d, owner, ownerId);
      if (!list) return;
      const i = list.findIndex((e) => e.id === fxId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
    });
  },
  setVolume(trackId: string | 'master', db: number, live = false) {
    store.update(
      'Volume',
      (d) => {
        if (trackId === 'master') d.master.volume = db;
        else {
          const t = d.tracks.find((x) => x.id === trackId);
          if (t) t.volume = db;
        }
      },
      live ? { history: 'none' } : { coalesce: `vol:${trackId}` },
    );
  },
  setPan(trackId: string, pan: number, live = false) {
    store.update(
      'Pan',
      (d) => {
        const t = d.tracks.find((x) => x.id === trackId);
        if (t) t.pan = Math.max(-1, Math.min(1, pan));
      },
      live ? { history: 'none' } : { coalesce: `pan:${trackId}` },
    );
  },
  toggle(trackId: string, what: 'mute' | 'solo' | 'armed') {
    store.update(what === 'armed' ? 'Arm track' : what === 'mute' ? 'Mute' : 'Solo', (d) => {
      const t = d.tracks.find((x) => x.id === trackId);
      if (t) t[what] = !t[what];
    });
  },
});

export type Actions = ReturnType<typeof actions>;
