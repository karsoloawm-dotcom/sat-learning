import { ProjectStore, UiStore } from './state/store';
import { demoProject } from './state/defaults';
import { actions } from './state/actions';
import { AudioEngine } from './audio/engine';
import type { World, ViewMode, Hover } from './render/world';
import type { Project } from './state/types';

// App-wide singletons. Project state, audio and the 3D world are independent modules wired together here.

export interface UiState {
  view: ViewMode;
  selected: string | null; // track id
  panel: 'play' | 'part' | 'effects' | 'look' | null; // musician drawer tab (beginner views)
  bottom: 'piano' | 'mixer' | 'audio';
  editPattern: string | null;
  editClip: string | null;
  hover: Hover | null;
  locked: boolean;
  typing: boolean;
  recording: boolean;
  recruitOpen: boolean;
  fileOpen: boolean;
  toast: string | null;
  busy: string | null;
  autoExpand: Record<string, string | null>; // trackId -> automation target shown in arrangement
}

export const store = new ProjectStore(demoProject());
export const ui = new UiStore<UiState>({
  view: 'director',
  selected: null,
  panel: null,
  bottom: 'piano',
  editPattern: null,
  editClip: null,
  hover: null,
  locked: false,
  typing: false,
  recording: false,
  recruitOpen: false,
  fileOpen: false,
  toast: null,
  busy: null,
  autoExpand: {},
});
export const engine = new AudioEngine(store);
export const act = actions(store);
export const world: { current: World | null } = { current: null };

let toastTimer = 0;
export function toast(msg: string) {
  ui.set({ toast: msg });
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ui.set({ toast: null }), 3200);
}

export function selectTrack(id: string | null, openPanel = true) {
  const p = store.get();
  const t = p.tracks.find((x) => x.id === id);
  const clip = t?.clips.find((c) => c.patternId) ?? null;
  ui.set({
    selected: id,
    panel: id && openPanel && ui.get().view !== 'producer' ? ui.get().panel ?? 'play' : id ? ui.get().panel : null,
    editPattern: clip?.patternId ?? ui.get().editPattern,
    editClip: clip?.id ?? null,
  });
  world.current?.select(id);
}

export function replaceProject(p: Project) {
  engine.stop(true);
  store.replace(p);
  selectTrack(null);
}

export function setView(v: ViewMode) {
  ui.set({ view: v, panel: v === 'producer' || v === 'perform' ? null : ui.get().panel });
  world.current?.setView(v);
}
