import { useEffect, useRef } from 'react';
import { useProject as useP, useUi as useU } from '../state/store';
import { store, ui, type UiState } from '../app';
import type { Project } from '../state/types';

export const useProject = <T,>(sel: (p: Project) => T) => useP(store, sel);
export const useUi = <T,>(sel: (s: UiState) => T) => useU(ui, sel);

// Calls fn every animation frame while mounted (for playheads and meters, which never go through React state).
export function useRaf(fn: (dt: number) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let id = 0;
    let last = performance.now();
    const tick = (t: number) => {
      ref.current((t - last) / 1000);
      last = t;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
}
