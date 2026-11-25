import { useEffect, useRef, useState } from 'react';
import type { Note, Pattern } from '../../state/types';
import { engine, store, ui } from '../../app';
import { useProject, useRaf, useUi } from '../hooks';
import { DRUM_NAMES } from '../../state/specs';
import { uid } from '../../state/store';

const KEYS_W = 64;
const RULER_H = 20;
const VEL_H = 64;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const isBlack = (p: number) => [1, 3, 6, 8, 10].includes(p % 12);
export const noteName = (p: number) => `${NAMES[p % 12]}${Math.floor(p / 12) - 1}`;

type Drag =
  | { kind: 'move'; ids: Set<string>; startBeat: number; startPitch: number; orig: Map<string, Note>; copy: boolean }
  | { kind: 'resize'; ids: Set<string>; startBeat: number; orig: Map<string, Note> }
  | { kind: 'box'; x0: number; y0: number; x1: number; y1: number }
  | { kind: 'vel'; }
  | { kind: 'draw'; id: string; start: number };

function updatePattern(id: string, label: string, fn: (p: Pattern) => void, live = false) {
  store.update(label, (d) => {
    const pat = d.patterns[id];
    if (pat) fn(pat as Pattern);
  }, live ? { history: 'none' } : {});
}

export function PianoRoll({ trackId, patternId, compact = false }: { trackId: string; patternId: string; compact?: boolean }) {
  const pattern = useProject((p) => p.patterns[patternId]);
  const track = useProject((p) => p.tracks.find((t) => t.id === trackId));
  const snap = useProject((p) => p.snap);
  const linked = useProject((p) => p.tracks.flatMap((t) => t.clips).filter((c) => c.patternId === patternId).length);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const view = useRef({ ppb: compact ? 28 : 64, beat0: 0, top: 84, kh: compact ? 9 : 14 });
  const drag = useRef<Drag | null>(null);
  const lastDur = useRef(0.5);
  const dirty = useRef(true);
  const drums = track?.instrument === 'drums';

  // Centre the view on the notes when the pattern changes.
  useEffect(() => {
    if (!pattern) return;
    const pitches = pattern.notes.map((n) => n.pitch);
    const mid = pitches.length ? (Math.max(...pitches) + Math.min(...pitches)) / 2 : drums ? 44 : 60;
    const rows = (wrap.current?.clientHeight ?? 300) / view.current.kh;
    view.current.top = Math.round(mid + rows / 2 - 1);
    view.current.beat0 = 0;
    setSel(new Set());
    dirty.current = true;
  }, [patternId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => void (dirty.current = true), [pattern, sel, snap]);

  const geom = () => {
    const c = canvas.current!;
    const w = c.clientWidth;
    const h = c.clientHeight;
    const velH = compact ? 0 : VEL_H;
    return { w, h, gridH: h - RULER_H - velH, velH };
  };
  const toX = (b: number) => KEYS_W + (b - view.current.beat0) * view.current.ppb;
  const toBeat = (x: number) => (x - KEYS_W) / view.current.ppb + view.current.beat0;
  const toY = (p: number) => RULER_H + (view.current.top - p) * view.current.kh;
  const toPitch = (y: number) => Math.round(view.current.top - (y - RULER_H) / view.current.kh + 0.5);
  const snapB = (b: number, free = false) => (free || !snap ? b : Math.round(b / snap) * snap);
  const floorSnap = (b: number) => (snap ? Math.floor(b / snap) * snap : b);

  const draw = (playBeat: number | null, sounding: Set<number>) => {
    const c = canvas.current;
    if (!c || !pattern) return;
    const dpr = window.devicePixelRatio || 1;
    const { w, h, gridH, velH } = geom();
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const x = c.getContext('2d')!;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const v = view.current;
    x.fillStyle = '#211a16';
    x.fillRect(0, 0, w, h);
    // Rows
    const rows = Math.ceil(gridH / v.kh) + 1;
    for (let i = 0; i < rows; i++) {
      const p = v.top - i;
      const y = RULER_H + i * v.kh;
      x.fillStyle = drums ? (DRUM_NAMES[p] ? '#2e2520' : '#241d19') : isBlack(p) ? '#1e1714' : '#2b221d';
      x.fillRect(KEYS_W, y, w - KEYS_W, v.kh);
      if (p % 12 === 0) {
        x.fillStyle = '#3a2f28';
        x.fillRect(KEYS_W, y + v.kh - 1, w - KEYS_W, 1);
      }
    }
    // Beyond pattern end
    const endX = toX(pattern.length);
    if (endX < w) {
      x.fillStyle = 'rgba(0,0,0,0.35)';
      x.fillRect(Math.max(KEYS_W, endX), RULER_H, w, gridH);
    }
    // Grid lines
    const step = snap && snap * v.ppb >= 6 ? snap : 0.25;
    for (let b = Math.floor(v.beat0 / step) * step; toX(b) < w; b += step) {
      if (b < 0) continue;
      const X = Math.round(toX(b)) + 0.5;
      x.strokeStyle = b % 4 === 0 ? '#5a4a3e' : b % 1 === 0 ? '#3d3129' : '#2f2620';
      x.beginPath();
      x.moveTo(X, RULER_H);
      x.lineTo(X, RULER_H + gridH);
      x.stroke();
    }
    // Notes
    const col = track?.color ?? '#f2a541';
    for (const n of pattern.notes) {
      const X = toX(n.start);
      const Y = toY(n.pitch);
      const W = Math.max(3, n.dur * v.ppb - 1);
      if (X > w || X + W < KEYS_W || Y > RULER_H + gridH || Y + v.kh < RULER_H) continue;
      const selected = sel.has(n.id);
      const playingNow = playBeat !== null && playBeat >= n.start && playBeat < n.start + n.dur;
      x.globalAlpha = 0.55 + n.vel * 0.45;
      x.fillStyle = playingNow ? '#fff3d6' : selected ? '#ffe08a' : col;
      roundRect(x, X, Y + 1, W, v.kh - 2, 3);
      x.fill();
      x.globalAlpha = 1;
      x.strokeStyle = selected ? '#fff' : 'rgba(0,0,0,0.45)';
      x.stroke();
      if (v.kh >= 12 && W > 28) {
        x.fillStyle = 'rgba(0,0,0,0.6)';
        x.font = '600 9px Nunito';
        x.fillText(drums ? DRUM_NAMES[n.pitch] ?? noteName(n.pitch) : noteName(n.pitch), X + 3, Y + v.kh - 4);
      }
    }
    // Box select
    const d = drag.current;
    if (d?.kind === 'box') {
      x.strokeStyle = '#ffe08a';
      x.setLineDash([4, 3]);
      x.strokeRect(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
      x.setLineDash([]);
    }
    // Keys
    for (let i = 0; i < rows; i++) {
      const p = v.top - i;
      const y = RULER_H + i * v.kh;
      x.fillStyle = sounding.has(p) ? col : drums ? '#3a302a' : isBlack(p) ? '#1c1b1f' : '#f4efe6';
      x.fillRect(0, y, KEYS_W - 2, v.kh - 1);
      if (drums ? DRUM_NAMES[p] : p % 12 === 0) {
        x.fillStyle = drums || isBlack(p) ? '#f3e3c3' : '#6b4f3a';
        x.font = '700 9px Nunito';
        x.fillText(drums ? DRUM_NAMES[p] ?? '' : noteName(p), 4, y + v.kh - 3);
      }
    }
    // Ruler
    x.fillStyle = '#2a221d';
    x.fillRect(0, 0, w, RULER_H);
    x.fillStyle = '#c9b79c';
    x.font = '700 10px Nunito';
    for (let b = Math.ceil(v.beat0); toX(b) < w; b++) {
      if (b % 4 !== 0) continue;
      x.fillText(String(b / 4 + 1), toX(b) + 3, 14);
      x.fillRect(toX(b), 12, 1, 8);
    }
    // Velocity lane
    if (velH) {
      const vy = RULER_H + gridH;
      x.fillStyle = '#1b1512';
      x.fillRect(0, vy, w, velH);
      x.fillStyle = '#c9b79c';
      x.fillText('Velocity', 6, vy + 14);
      for (const n of pattern.notes) {
        const X = toX(n.start);
        if (X < KEYS_W || X > w) continue;
        const bh = (velH - 8) * n.vel;
        x.fillStyle = sel.has(n.id) ? '#ffe08a' : col;
        x.fillRect(X, vy + velH - bh - 2, 4, bh);
        x.beginPath();
        x.arc(X + 2, vy + velH - bh - 2, 3, 0, Math.PI * 2);
        x.fill();
      }
    }
    // Playhead
    if (playBeat !== null) {
      const X = toX(playBeat);
      x.fillStyle = '#ffd27a';
      x.fillRect(X, 0, 2, RULER_H + gridH);
    }
  };

  // Where in this pattern is the transport (if a clip of this track is playing it)?
  const patternBeat = () => {
    if (!engine.playing || !track) return null;
    const b = engine.position();
    const c = track.clips.find((k) => k.patternId === patternId && b >= k.start && b < k.start + k.length);
    if (!c || !pattern) return null;
    return (((b - c.start + c.offset) % pattern.length) + pattern.length) % pattern.length;
  };

  useRaf(() => {
    const pb = patternBeat();
    if (pb === null && !dirty.current) return;
    const sounding = new Set<number>();
    if (pb !== null && pattern) for (const n of pattern.notes) if (pb >= n.start && pb < n.start + n.dur) sounding.add(n.pitch);
    draw(pb, sounding);
    dirty.current = pb !== null;
  });

  const hitNote = (mx: number, my: number) => {
    if (!pattern) return null;
    for (let i = pattern.notes.length - 1; i >= 0; i--) {
      const n = pattern.notes[i];
      const X = toX(n.start);
      const Y = toY(n.pitch);
      const W = Math.max(3, n.dur * view.current.ppb);
      if (mx >= X && mx <= X + W && my >= Y && my <= Y + view.current.kh) return { n, edge: mx > X + W - 7 };
    }
    return null;
  };

  const preview = (pitch: number, vel = 0.8) => engine.preview(trackId, pitch, vel, 0.25);

  const onDown = (e: React.PointerEvent) => {
    if (!pattern) return;
    const r = canvas.current!.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    canvas.current!.setPointerCapture(e.pointerId);
    canvas.current!.focus();
    const { gridH, velH } = geom();
    if (velH && my > RULER_H + gridH) {
      drag.current = { kind: 'vel' };
      setVel(mx, my);
      return;
    }
    if (my < RULER_H) {
      // Ruler click: jump the transport to this point of the clip.
      const c = track?.clips.find((k) => k.patternId === patternId);
      if (c) engine.seek(c.start + Math.max(0, toBeat(mx)) - c.offset);
      return;
    }
    if (mx < KEYS_W) return preview(toPitch(my));
    const hit = hitNote(mx, my);
    if (e.button === 2 || (hit && e.detail === 2)) {
      if (hit) updatePattern(patternId, 'Delete note', (p) => void (p.notes = p.notes.filter((n) => n.id !== hit.n.id)));
      return;
    }
    if (hit) {
      let ids = sel;
      if (e.shiftKey) {
        ids = new Set(sel);
        if (ids.has(hit.n.id)) ids.delete(hit.n.id);
        else ids.add(hit.n.id);
      } else if (!sel.has(hit.n.id)) ids = new Set([hit.n.id]);
      setSel(ids);
      const orig = new Map(pattern.notes.filter((n) => ids.has(n.id)).map((n) => [n.id, n]));
      if (hit.edge) drag.current = { kind: 'resize', ids, startBeat: toBeat(mx), orig };
      else {
        drag.current = { kind: 'move', ids, startBeat: toBeat(mx), startPitch: toPitch(my), orig, copy: e.altKey || e.ctrlKey };
        preview(hit.n.pitch, hit.n.vel);
      }
      lastDur.current = hit.n.dur;
      return;
    }
    if (e.shiftKey) {
      drag.current = { kind: 'box', x0: mx, y0: my, x1: mx, y1: my };
      return;
    }
    // Draw a new note.
    const start = floorSnap(toBeat(mx));
    if (start < 0 || start >= pattern.length) return;
    const pitch = toPitch(my);
    const n: Note = { id: uid('n'), pitch, start, dur: drums ? Math.max(0.25, snap || 0.25) : lastDur.current, vel: 0.8 };
    updatePattern(patternId, 'Add note', (p) => void p.notes.push(n), true);
    setSel(new Set([n.id]));
    drag.current = { kind: 'draw', id: n.id, start };
    preview(pitch);
  };

  const setVel = (mx: number, my: number) => {
    if (!pattern) return;
    const { gridH, velH } = geom();
    const vel = Math.max(0.02, Math.min(1, (RULER_H + gridH + velH - 2 - my) / (velH - 8)));
    const b = toBeat(mx);
    const tol = 6 / view.current.ppb;
    const targets = pattern.notes.filter((n) => Math.abs(n.start - b) < tol && (sel.size === 0 || sel.has(n.id) || ![...sel].some((id) => pattern.notes.find((q) => q.id === id && Math.abs(q.start - b) < tol))));
    if (!targets.length) return;
    const ids = new Set(targets.map((n) => n.id));
    updatePattern(patternId, 'Velocity', (p) => p.notes.forEach((n) => ids.has(n.id) && (n.vel = vel)), true);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const r = canvas.current!.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    if (!d) {
      const hit = mx > KEYS_W && my > RULER_H ? hitNote(mx, my) : null;
      canvas.current!.style.cursor = hit ? (hit.edge ? 'ew-resize' : 'grab') : mx > KEYS_W ? 'crosshair' : 'pointer';
      return;
    }
    if (!pattern) return;
    if (d.kind === 'vel') return setVel(mx, my);
    if (d.kind === 'box') {
      d.x1 = mx;
      d.y1 = my;
      const b0 = toBeat(Math.min(d.x0, d.x1));
      const b1 = toBeat(Math.max(d.x0, d.x1));
      const p0 = toPitch(Math.max(d.y0, d.y1));
      const p1 = toPitch(Math.min(d.y0, d.y1));
      setSel(new Set(pattern.notes.filter((n) => n.start + n.dur > b0 && n.start < b1 && n.pitch >= p0 && n.pitch <= p1).map((n) => n.id)));
      dirty.current = true;
      return;
    }
    if (d.kind === 'draw') {
      const end = Math.max(d.start + (snap || 0.05), snapB(toBeat(mx), e.shiftKey));
      lastDur.current = end - d.start;
      updatePattern(patternId, 'Add note', (p) => {
        const n = p.notes.find((x) => x.id === d.id);
        if (n) n.dur = Math.min(end, p.length) - n.start;
      }, true);
      return;
    }
    if (d.kind === 'resize') {
      const delta = snapB(toBeat(mx) - d.startBeat, e.shiftKey);
      updatePattern(patternId, 'Resize notes', (p) => p.notes.forEach((n) => {
        const o = d.orig.get(n.id);
        if (o) n.dur = Math.max(snap || 0.05, o.dur + delta);
      }), true);
      return;
    }
    if (d.kind === 'move') {
      const db = snapB(toBeat(mx) - d.startBeat, e.shiftKey);
      const dp = toPitch(my) - d.startPitch;
      updatePattern(patternId, d.copy ? 'Copy notes' : 'Move notes', (p) => {
        if (d.copy && !p.notes.some((n) => n.id.endsWith('~c'))) for (const o of d.orig.values()) p.notes.push({ ...o, id: o.id + '~c' });
        p.notes.forEach((n) => {
          const o = d.orig.get(d.copy ? n.id.replace(/~c$/, '') : n.id);
          if (!o || (d.copy && !n.id.endsWith('~c'))) return;
          n.start = Math.max(0, o.start + db);
          n.pitch = Math.max(0, Math.min(127, o.pitch + dp));
        });
      }, true);
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    dirty.current = true;
    if (!d) return;
    if (d.kind === 'move' && d.copy) {
      // Give copied notes real ids.
      store.update('Copy notes', (s) => {
        const p = s.patterns[patternId];
        p?.notes.forEach((n) => n.id.endsWith('~c') && (n.id = uid('n')));
      }, { history: 'none' });
    }
    const labels = { move: 'Move notes', resize: 'Resize notes', draw: 'Add note', vel: 'Velocity', box: '' } as const;
    if (d.kind !== 'box') store.commitGesture(labels[d.kind]);
  };

  const onWheel = (e: React.WheelEvent) => {
    const v = view.current;
    if (e.ctrlKey || e.metaKey) {
      v.ppb = Math.max(12, Math.min(320, v.ppb * (e.deltaY > 0 ? 0.9 : 1.1)));
    } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      v.beat0 = Math.max(0, v.beat0 + (e.deltaX || e.deltaY) / v.ppb);
    } else {
      v.top = Math.max(12, Math.min(127, v.top - Math.sign(e.deltaY) * 3));
    }
    dirty.current = true;
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!pattern) return;
    const ids = sel;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.code === 'KeyA') {
      e.preventDefault();
      setSel(new Set(pattern.notes.map((n) => n.id)));
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && ids.size) {
      e.preventDefault();
      updatePattern(patternId, 'Delete notes', (p) => void (p.notes = p.notes.filter((n) => !ids.has(n.id))));
      setSel(new Set());
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && ids.size) {
      e.preventDefault();
      const d = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 12 : 1);
      updatePattern(patternId, 'Transpose', (p) => p.notes.forEach((n) => ids.has(n.id) && (n.pitch = Math.max(0, Math.min(127, n.pitch + d)))));
    } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && ids.size) {
      e.preventDefault();
      const d = (e.key === 'ArrowRight' ? 1 : -1) * (snap || 0.25);
      updatePattern(patternId, e.shiftKey ? 'Change length' : 'Nudge', (p) => p.notes.forEach((n) => {
        if (!ids.has(n.id)) return;
        if (e.shiftKey) n.dur = Math.max(snap || 0.05, n.dur + d);
        else n.start = Math.max(0, n.start + d);
      }));
    } else if (mod && e.code === 'KeyD' && ids.size) {
      e.preventDefault();
      const chosen = pattern.notes.filter((n) => ids.has(n.id));
      const span = Math.max(...chosen.map((n) => n.start + n.dur)) - Math.min(...chosen.map((n) => n.start));
      const copies = chosen.map((n) => ({ ...n, id: uid('n'), start: n.start + span }));
      updatePattern(patternId, 'Duplicate notes', (p) => void p.notes.push(...copies));
      setSel(new Set(copies.map((n) => n.id)));
    } else if (e.code === 'KeyQ') {
      quantize();
    } else return;
    e.stopPropagation();
  };

  const quantize = () => {
    const q = snap || 0.25;
    const ids = sel.size ? sel : null;
    updatePattern(patternId, 'Quantize', (p) => p.notes.forEach((n) => {
      if (ids && !ids.has(n.id)) return;
      n.start = Math.round(n.start / q) * q;
      n.dur = Math.max(q, Math.round(n.dur / q) * q);
    }));
  };

  const makeUnique = () => {
    const ec = ui.get().editClip;
    if (!pattern || !ec) return;
    const copy: Pattern = { ...structuredClone(pattern), id: uid('pat'), name: `${pattern.name} (copy)` };
    store.update('Make pattern unique', (d) => {
      d.patterns[copy.id] = copy;
      for (const t of d.tracks) for (const c of t.clips) if (c.id === ec) c.patternId = copy.id;
    });
    ui.set({ editPattern: copy.id });
  };

  if (!pattern || !track) return <div className="empty">Pick a clip to edit its notes.</div>;
  return (
    <div className={`pianoroll ${compact ? 'compact' : ''}`}>
      {!compact && (
        <div className="toolbar">
          <span className="dot" style={{ background: track.color }} />
          <input className="pat-name" value={pattern.name} onChange={(e) => updatePattern(patternId, 'Rename pattern', (p) => void (p.name = e.target.value))} aria-label="Pattern name" />
          <label>
            Length
            <select value={pattern.length} onChange={(e) => updatePattern(patternId, 'Pattern length', (p) => void (p.length = Number(e.target.value)))}>
              {[4, 8, 16, 32, 64].map((b) => <option key={b} value={b}>{b / 4} bar{b > 4 ? 's' : ''}</option>)}
            </select>
          </label>
          <label>
            Snap
            <select value={snap} onChange={(e) => store.update('Snap', (d) => void (d.snap = Number(e.target.value)))}>
              <option value={1}>1/4</option>
              <option value={0.5}>1/8</option>
              <option value={0.25}>1/16</option>
              <option value={0.125}>1/32</option>
              <option value={1 / 3}>1/8 triplet</option>
              <option value={0}>off</option>
            </select>
          </label>
          <button onClick={quantize} title="Snap note starts and lengths to the grid (Q)">Quantize{sel.size ? ' selected' : ''}</button>
          {linked > 1 && <button onClick={makeUnique} title="This pattern is used by several clips; edits change all of them">Make unique ({linked} linked)</button>}
          <span className="muted small grow">Click to draw · drag to move · edge to resize · Shift-drag to select · right-click deletes · Alt-drag copies</span>
        </div>
      )}
      <div className="pr-canvas" ref={wrap}>
        <canvas
          ref={canvas}
          tabIndex={0}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onWheel={onWheel}
          onKeyDown={onKey}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={`Piano roll for ${pattern.name}`}
        />
      </div>
    </div>
  );
}

function roundRect(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, r: number) {
  x.beginPath();
  x.roundRect(X, Y, W, H, Math.min(r, W / 2, H / 2));
}

// Drawer version for beginners: the same editor, compact.
export function MiniRoll({ trackId }: { trackId: string }) {
  const editPattern = useUi((s) => s.editPattern);
  const firstPattern = useProject((p) => p.tracks.find((t) => t.id === trackId)?.clips.find((c) => c.patternId)?.patternId);
  const pid = editPattern && store.get().tracks.find((t) => t.id === trackId)?.clips.some((c) => c.patternId === editPattern) ? editPattern : firstPattern;
  if (!pid) return <p className="muted">No part yet.</p>;
  return <PianoRoll trackId={trackId} patternId={pid} compact />;
}
