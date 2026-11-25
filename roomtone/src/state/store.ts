import { produce, type Draft, freeze } from 'immer';
import { useSyncExternalStore } from 'react';
import type { Project } from './types';

// The single source of truth for the project document. Audio engine, 3D studio and React UI subscribe to it;
// none of them own project state. Immutable snapshots (immer structural sharing) make undo trivial and let
// subscribers diff by reference.

type Listener = (p: Project, prev: Project) => void;

interface HistoryEntry {
  state: Project;
  label: string;
  key?: string;
  at: number;
}

export interface UpdateOptions {
  // 'push' (default): new undo step. 'none': live change during a gesture (call commitGesture after).
  // A string key coalesces repeated updates with the same key within a short window into one undo step.
  history?: 'push' | 'none';
  coalesce?: string;
}

const MAX_HISTORY = 200;

export class ProjectStore {
  private state: Project;
  private listeners = new Set<Listener>();
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private gestureStart: Project | null = null;

  constructor(initial: Project) {
    this.state = freeze(initial, true);
  }

  get = () => this.state;

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  update(label: string, recipe: (d: Draft<Project>) => void, opts: UpdateOptions = {}) {
    const prev = this.state;
    const next = produce(prev, recipe);
    if (next === prev) return;
    if (opts.history === 'none') {
      if (!this.gestureStart) this.gestureStart = prev;
    } else {
      const top = this.undoStack[this.undoStack.length - 1];
      const now = performance.now();
      if (opts.coalesce && top && top.key === opts.coalesce && now - top.at < 1200) {
        top.at = now;
      } else {
        this.pushUndo({ state: this.gestureStart ?? prev, label, key: opts.coalesce, at: now });
        this.gestureStart = null;
      }
    }
    this.set(next);
  }

  // Ends a drag that used history:'none' so the whole gesture is one undo step.
  commitGesture(label: string) {
    if (!this.gestureStart) return;
    if (this.gestureStart !== this.state) this.pushUndo({ state: this.gestureStart, label, at: performance.now() });
    this.gestureStart = null;
  }

  private pushUndo(e: HistoryEntry) {
    this.undoStack.push(e);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
  }

  undo = () => {
    const e = this.undoStack.pop();
    if (!e) return;
    this.redoStack.push({ ...e, state: this.state });
    this.set(e.state);
  };

  redo = () => {
    const e = this.redoStack.pop();
    if (!e) return;
    this.undoStack.push({ ...e, state: this.state });
    this.set(e.state);
  };

  canUndo = () => this.undoStack.length > 0;
  canRedo = () => this.redoStack.length > 0;
  undoLabel = () => this.undoStack[this.undoStack.length - 1]?.label;
  redoLabel = () => this.redoStack[this.redoStack.length - 1]?.label;

  // Replace the whole document (load / new project). Clears history.
  replace(p: Project) {
    this.undoStack = [];
    this.redoStack = [];
    this.gestureStart = null;
    this.set(freeze(p, true));
  }

  private set(next: Project) {
    const prev = this.state;
    this.state = next;
    for (const l of this.listeners) l(next, prev);
  }
}

// Small UI-only state (selection, view) that is not part of the document and not undoable.
export class UiStore<T extends object> {
  private listeners = new Set<() => void>();
  constructor(private state: T) {}
  get = () => this.state;
  set = (patch: Partial<T>) => {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  };
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
}

export function useProject<T>(store: ProjectStore, select: (p: Project) => T): T {
  return useSyncExternalStore(store.subscribe as (cb: () => void) => () => void, () => select(store.get()));
}

export function useUi<T extends object, R>(store: UiStore<T>, select: (s: T) => R): R {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}

let counter = 0;
export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
