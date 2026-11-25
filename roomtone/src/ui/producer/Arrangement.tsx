import { useEffect, useRef } from 'react';
import type { Clip, Project, Track } from '../../state/types';
import { act, engine, selectTrack, store, toast, ui } from '../../app';
import { useProject, useRaf, useUi } from '../hooks';
import { AUTOMATION_TARGETS, INSTRUMENTS } from '../../state/specs';
import { audioAssets, peaks, putAsset } from '../../audio/assets';
import { songEnd } from '../../audio/schedule';
import { newPattern } from '../../state/defaults';
import { uid } from '../../state/store';
import { parseMidi } from '../../state/midi';

const ROW = 58;
const AUTO_ROW = 46;
const RULER = 30;
const HEAD_W = 190;

type Drag =
  | { kind: 'clip'; trackId: string; clipId: string; mode: 'move' | 'end' | 'start'; x0: number; orig: Clip; copy: boolean; rowY: number }
  | { kind: 'loop'; b0: number }
  | { kind: 'seek' }
  | { kind: 'auto'; trackId: string; laneId: string; index: number };

interface RowInfo {
  track: Track;
  y: number;
  autoY: number | null;
  target: string | null;
}

function layout(p: Project, expand: Record<string, string | null>): RowInfo[] {
  let y = RULER;
  return p.tracks.map((t) => {
    const target = expand[t.id] ?? null;
    const r = { track: t, y, autoY: target ? y + ROW : null, target };
    y += ROW + (target ? AUTO_ROW : 0);
    return r;
  });
}

export async function importAudioFile(file: File, trackId: string | null, beat: number) {
  const buf = await engine.ctx.decodeAudioData(await file.arrayBuffer());
  const id = uid('aud');
  putAsset(id, buf);
  let tid = trackId;
  const p = store.get();
  if (!tid || p.tracks.find((t) => t.id === tid)?.kind !== 'audio') {
    tid = act.recruit('vocal');
    if (!tid) return toast('The studio is full');
  }
  store.update('Import audio', (d) => {
    d.audio[id] = { id, name: file.name.replace(/\.[^.]+$/, ''), duration: buf.duration, sampleRate: buf.sampleRate, channels: buf.numberOfChannels };
    d.tracks.find((t) => t.id === tid)?.clips.push({ id: uid('clip'), audioId: id, start: beat, length: (buf.duration * d.bpm) / 60, offset: 0, gain: 1 });
  });
  toast(`Imported ${file.name}`);
}

// A dropped .mid becomes a new clip (all MIDI tracks merged) on the MIDI track under the cursor, bar-aligned.
async function importMidiClip(file: File, trackId: string | null, beat: number) {
  const p = store.get();
  const t = p.tracks.find((x) => x.id === trackId);
  if (!t || t.kind !== 'midi') return toast('Drop MIDI files onto an instrument track');
  try {
    const m = parseMidi(await file.arrayBuffer());
    if (!m.notes.length) return toast(`${file.name} has no notes`);
    const bar = p.beatsPerBar;
    const length = Math.max(bar, Math.ceil(m.lengthBeats / bar) * bar);
    const start = Math.floor(beat / bar) * bar;
    const pat = newPattern(file.name.replace(/\.midi?$/i, ''), length, m.notes.map((n) => ({ id: uid('n'), pitch: n.pitch, start: n.start, dur: n.dur, vel: n.vel })));
    const clipId = uid('clip');
    store.update(`Import ${file.name}`, (d) => {
      d.patterns[pat.id] = pat;
      d.tracks.find((x) => x.id === t.id)!.clips.push({ id: clipId, patternId: pat.id, start, length, offset: 0, gain: 1 });
    });
    selectTrack(t.id, false);
    ui.set({ editPattern: pat.id, editClip: clipId, bottom: 'piano' });
    toast(`Imported ${m.notes.length} notes onto ${t.name}`);
  } catch (e) {
    toast(`Could not import ${file.name}: ${(e as Error).message}`);
  }
}

export function Arrangement() {
  const project = useProject((p) => p);
  const selected = useUi((s) => s.selected);
  const editClip = useUi((s) => s.editClip);
  const expand = useUi((s) => s.autoExpand);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const view = useRef({ ppb: 14, beat0: 0 });
  const drag = useRef<Drag | null>(null);
  const dirty = useRef(true);
  const rows = layout(project, expand);
  const totalH = rows.length ? rows[rows.length - 1].y + ROW + (rows[rows.length - 1].autoY ? AUTO_ROW : 0) + 40 : 200;

  useEffect(() => void (dirty.current = true), [project, selected, editClip, expand]);

  const toX = (b: number) => (b - view.current.beat0) * view.current.ppb;
  const toBeat = (x: number) => x / view.current.ppb + view.current.beat0;
  const snapB = (b: number, free: boolean) => (free ? b : Math.round(b));
  const rowAt = (y: number) => rows.find((r) => y >= r.y && y < r.y + ROW) ?? null;
  const autoAt = (y: number) => rows.find((r) => r.autoY !== null && y >= r.autoY && y < r.autoY + AUTO_ROW) ?? null;

  const autoRange = (t: Track, target: string) => AUTOMATION_TARGETS(t.fx).find((a) => a.target === target) ?? { min: 0, max: 1, label: target, target };

  const draw = () => {
    const c = canvas.current;
    if (!c) return;
    const p = store.get();
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = totalH;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.height = `${h}px`;
    }
    const x = c.getContext('2d')!;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const v = view.current;
    x.fillStyle = '#211a16';
    x.fillRect(0, 0, w, h);
    // Bars
    for (let b = Math.floor(v.beat0); toX(b) < w; b++) {
      if (b < 0) continue;
      const X = Math.round(toX(b)) + 0.5;
      x.strokeStyle = b % (p.beatsPerBar * 4) === 0 ? '#5a4a3e' : b % p.beatsPerBar === 0 ? '#3d3129' : 'rgba(61,49,41,0.35)';
      x.beginPath();
      x.moveTo(X, RULER);
      x.lineTo(X, h);
      x.stroke();
    }
    // Rows
    for (const r of rows) {
      x.fillStyle = r.track.id === selected ? 'rgba(255,210,122,0.06)' : 'rgba(0,0,0,0.0)';
      x.fillRect(0, r.y, w, ROW);
      x.fillStyle = '#2f2620';
      x.fillRect(0, r.y + ROW - 1, w, 1);
      for (const clip of r.track.clips) drawClip(x, p, r.track, clip, toX(clip.start), r.y + 4, clip.length * v.ppb, ROW - 8, clip.id === editClip);
      if (r.autoY !== null && r.target) {
        const ay = r.autoY;
        x.fillStyle = '#1b1512';
        x.fillRect(0, ay, w, AUTO_ROW);
        const lane = r.track.automation.find((l) => l.target === r.target);
        const rg = autoRange(r.track, r.target);
        const toAY = (val: number) => ay + AUTO_ROW - 4 - ((val - rg.min) / (rg.max - rg.min)) * (AUTO_ROW - 8);
        x.strokeStyle = r.track.color;
        x.lineWidth = 2;
        x.beginPath();
        if (lane?.points.length) {
          x.moveTo(0, toAY(lane.points[0].v));
          for (const pt of lane.points) x.lineTo(toX(pt.t), toAY(pt.v));
          x.lineTo(w, toAY(lane.points[lane.points.length - 1].v));
        }
        x.stroke();
        x.lineWidth = 1;
        x.fillStyle = '#fff3d6';
        for (const pt of lane?.points ?? []) {
          x.beginPath();
          x.arc(toX(pt.t), toAY(pt.v), 4, 0, Math.PI * 2);
          x.fill();
        }
        x.fillStyle = '#8d7b66';
        x.font = '700 10px Nunito';
        x.fillText(`${rg.label}${lane?.points.length ? '' : ' — click to add points'}`, 6, ay + 12);
      }
    }
    // Ruler + loop
    x.fillStyle = '#2a221d';
    x.fillRect(0, 0, w, RULER);
    if (p.loop.end > p.loop.start) {
      x.fillStyle = p.loop.enabled ? 'rgba(242,165,65,0.55)' : 'rgba(242,165,65,0.18)';
      x.fillRect(toX(p.loop.start), 0, (p.loop.end - p.loop.start) * v.ppb, 9);
      if (p.loop.enabled) {
        x.fillStyle = 'rgba(242,165,65,0.05)';
        x.fillRect(toX(p.loop.start), RULER, (p.loop.end - p.loop.start) * v.ppb, h);
      }
    }
    x.fillStyle = '#c9b79c';
    x.font = '700 11px Nunito';
    for (let b = Math.ceil(v.beat0); toX(b) < w; b++) {
      if (b % p.beatsPerBar !== 0) continue;
      const bar = b / p.beatsPerBar + 1;
      if (v.ppb * p.beatsPerBar < 26 && bar % 2 === 0) continue;
      x.fillText(String(bar), toX(b) + 3, 24);
      x.fillRect(toX(b), 12, 1, RULER - 12);
    }
    // Playhead
    const pb = engine.position();
    x.fillStyle = '#ffd27a';
    x.fillRect(toX(pb), 0, 2, h);
  };

  useRaf(() => {
    if (!engine.playing && !dirty.current) return;
    // Follow the playhead when it leaves the view.
    const c = canvas.current;
    if (c && engine.playing) {
      const pb = engine.position();
      const span = c.clientWidth / view.current.ppb;
      if (pb > view.current.beat0 + span * 0.92 || pb < view.current.beat0) view.current.beat0 = Math.max(0, pb - span * 0.1);
    }
    draw();
    dirty.current = false;
  });

  const findClip = (mx: number, my: number) => {
    const r = rowAt(my);
    if (!r) return null;
    const b = toBeat(mx);
    const clip = [...r.track.clips].reverse().find((c) => b >= c.start && b < c.start + c.length);
    if (!clip) return { row: r, clip: null, edge: null as null | 'start' | 'end' };
    const px = (mx - toX(clip.start));
    const edge: 'start' | 'end' | null = px < 7 ? 'start' : toX(clip.start + clip.length) - mx < 8 ? 'end' : null;
    return { row: r, clip, edge };
  };

  const mutateClip = (trackId: string, clipId: string, label: string, fn: (c: Clip) => void, live = true) =>
    store.update(label, (d) => {
      const c = d.tracks.find((t) => t.id === trackId)?.clips.find((k) => k.id === clipId);
      if (c) fn(c as Clip);
    }, live ? { history: 'none' } : {});

  const onDown = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    canvas.current!.setPointerCapture(e.pointerId);
    canvas.current!.focus();
    const p = store.get();
    if (my < RULER) {
      if (my < 10) {
        const b0 = Math.round(toBeat(mx) / p.beatsPerBar) * p.beatsPerBar;
        drag.current = { kind: 'loop', b0 };
      } else {
        drag.current = { kind: 'seek' };
        engine.seek(Math.max(0, snapB(toBeat(mx), e.shiftKey)));
      }
      return;
    }
    const ar = autoAt(my);
    if (ar && ar.target) {
      const t = ar.track;
      const rg = autoRange(t, ar.target);
      const val = rg.min + (1 - (my - ar.autoY! - 4) / (AUTO_ROW - 8)) * (rg.max - rg.min);
      const beat = Math.max(0, toBeat(mx));
      const lane = t.automation.find((l) => l.target === ar.target);
      const idx = lane?.points.findIndex((pt) => Math.abs(toX(pt.t) - mx) < 6) ?? -1;
      if (e.button === 2) {
        if (lane && idx >= 0) store.update('Delete automation point', (d) => void d.tracks.find((x) => x.id === t.id)!.automation.find((l) => l.id === lane.id)!.points.splice(idx, 1));
        return;
      }
      let laneId = lane?.id;
      let index = idx;
      if (idx < 0) {
        laneId = laneId ?? uid('auto');
        store.update('Add automation point', (d) => {
          const tt = d.tracks.find((x) => x.id === t.id)!;
          let l = tt.automation.find((x) => x.target === ar.target);
          if (!l) tt.automation.push((l = { id: laneId!, target: ar.target!, points: [], enabled: true }));
          l.points.push({ t: beat, v: Math.max(rg.min, Math.min(rg.max, val)) });
          l.points.sort((a, b) => a.t - b.t);
          index = l.points.findIndex((pt) => pt.t === beat);
        }, { history: 'none' });
      }
      drag.current = { kind: 'auto', trackId: t.id, laneId: laneId!, index };
      return;
    }
    const hit = findClip(mx, my);
    if (!hit) return;
    if (!hit.clip) {
      selectTrack(hit.row.track.id, false);
      if (e.detail === 2 && hit.row.track.kind === 'midi') {
        const start = Math.floor(toBeat(mx) / p.beatsPerBar) * p.beatsPerBar;
        const pat = newPattern(`${hit.row.track.musician.name}'s part`, 16);
        const clipId = uid('clip');
        store.update('New clip', (d) => {
          d.patterns[pat.id] = pat;
          d.tracks.find((t) => t.id === hit.row.track.id)!.clips.push({ id: clipId, patternId: pat.id, start, length: 16, offset: 0, gain: 1 });
        });
        ui.set({ editPattern: pat.id, editClip: clipId, bottom: 'piano' });
      }
      return;
    }
    const clip = hit.clip;
    if (e.button === 2) {
      store.update('Delete clip', (d) => {
        const t = d.tracks.find((x) => x.id === hit.row.track.id)!;
        t.clips = t.clips.filter((c) => c.id !== clip.id);
      });
      return;
    }
    selectTrack(hit.row.track.id, false);
    ui.set({ editClip: clip.id, editPattern: clip.patternId ?? ui.get().editPattern, bottom: clip.audioId ? 'audio' : e.detail === 2 ? 'piano' : ui.get().bottom });
    let id = clip.id;
    if (e.altKey && !hit.edge) {
      id = uid('clip');
      store.update('Duplicate clip', (d) => void d.tracks.find((x) => x.id === hit.row.track.id)!.clips.push({ ...clip, id }), { history: 'none' });
    }
    drag.current = { kind: 'clip', trackId: hit.row.track.id, clipId: id, mode: (hit.edge ?? 'move') as 'move' | 'start' | 'end', x0: mx, orig: clip, copy: e.altKey, rowY: hit.row.y };
  };

  const onMove = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const d = drag.current;
    const p = store.get();
    if (!d) {
      const hit = my > RULER ? findClip(mx, my) : null;
      canvas.current!.style.cursor = hit?.edge ? 'ew-resize' : hit?.clip ? 'grab' : my < 10 ? 'col-resize' : 'default';
      return;
    }
    if (d.kind === 'seek') return engine.seek(Math.max(0, snapB(toBeat(mx), e.shiftKey)));
    if (d.kind === 'loop') {
      const b1 = Math.round(toBeat(mx) / p.beatsPerBar) * p.beatsPerBar;
      const [s, en] = d.b0 < b1 ? [d.b0, b1] : [b1, d.b0];
      if (en > s) store.update('Set loop', (s2) => void (s2.loop = { enabled: true, start: Math.max(0, s), end: en }), { history: 'none' });
      return;
    }
    if (d.kind === 'auto') {
      const t = p.tracks.find((x) => x.id === d.trackId)!;
      const rowInfo = rows.find((x) => x.track.id === d.trackId)!;
      const lane = t.automation.find((l) => l.id === d.laneId);
      if (!lane || rowInfo.autoY === null) return;
      const rg = autoRange(t, lane.target);
      const val = Math.max(rg.min, Math.min(rg.max, rg.min + (1 - (my - rowInfo.autoY - 4) / (AUTO_ROW - 8)) * (rg.max - rg.min)));
      const beat = Math.max(0, e.shiftKey ? toBeat(mx) : Math.round(toBeat(mx) * 4) / 4);
      store.update('Move automation point', (s2) => {
        const l = s2.tracks.find((x) => x.id === d.trackId)!.automation.find((x) => x.id === d.laneId)!;
        const pt = l.points[d.index];
        if (!pt) return;
        pt.t = beat;
        pt.v = val;
        l.points.sort((a, b) => a.t - b.t);
        d.index = l.points.indexOf(pt);
      }, { history: 'none' });
      return;
    }
    const db = snapB((mx - d.x0) / view.current.ppb, e.shiftKey);
    const o = d.orig;
    if (d.mode === 'move') {
      mutateClip(d.trackId, d.clipId, 'Move clip', (c) => void (c.start = Math.max(0, o.start + db)));
      // Move to another track of the same kind.
      const target = rowAt(my);
      if (target && target.track.id !== d.trackId && target.track.kind === p.tracks.find((t) => t.id === d.trackId)?.kind) {
        const from = d.trackId;
        store.update('Move clip', (s2) => {
          const src = s2.tracks.find((t) => t.id === from)!;
          const c = src.clips.find((k) => k.id === d.clipId);
          if (!c) return;
          src.clips = src.clips.filter((k) => k.id !== d.clipId);
          s2.tracks.find((t) => t.id === target.track.id)!.clips.push(c);
        }, { history: 'none' });
        d.trackId = target.track.id;
      }
    } else if (d.mode === 'end') {
      const maxLen = o.audioId ? ((audioAssets.get(o.audioId)?.duration ?? 0) - o.offset) * (p.bpm / 60) : Infinity;
      mutateClip(d.trackId, d.clipId, 'Resize clip', (c) => void (c.length = Math.min(maxLen, Math.max(e.shiftKey ? 0.25 : 1, o.length + db))));
    } else {
      const delta = Math.min(o.length - 1, Math.max(-o.start, db));
      const offsetDelta = o.audioId ? (delta * 60) / p.bpm : delta;
      if (o.offset + offsetDelta < 0) return;
      mutateClip(d.trackId, d.clipId, 'Trim clip', (c) => {
        c.start = o.start + delta;
        c.length = o.length - delta;
        c.offset = o.offset + offsetDelta;
      });
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.kind === 'seek') return;
    store.commitGesture({ clip: 'Edit clip', loop: 'Set loop', auto: 'Automation' }[d.kind]);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const id = ui.get().editClip;
    const t = store.get().tracks.find((x) => x.clips.some((c) => c.id === id));
    if (!id || !t) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      store.update('Delete clip', (d) => {
        const tt = d.tracks.find((x) => x.id === t.id)!;
        tt.clips = tt.clips.filter((c) => c.id !== id);
      });
      ui.set({ editClip: null });
    } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
      e.preventDefault();
      const c = t.clips.find((x) => x.id === id)!;
      const nid = uid('clip');
      store.update('Duplicate clip', (d) => void d.tracks.find((x) => x.id === t.id)!.clips.push({ ...c, id: nid, start: c.start + c.length }));
      ui.set({ editClip: nid });
    } else return;
    e.stopPropagation();
  };

  const onWheel = (e: React.WheelEvent) => {
    const v = view.current;
    if (e.ctrlKey || e.metaKey) {
      const r = canvas.current!.getBoundingClientRect();
      const anchor = toBeat(e.clientX - r.left);
      v.ppb = Math.max(3, Math.min(120, v.ppb * (e.deltaY > 0 ? 0.88 : 1.12)));
      v.beat0 = Math.max(0, anchor - (e.clientX - r.left) / v.ppb);
      e.preventDefault();
    } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      v.beat0 = Math.max(0, v.beat0 + (e.deltaX || e.deltaY) / v.ppb);
    } else return;
    dirty.current = true;
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const r = canvas.current!.getBoundingClientRect();
    const row = rowAt(e.clientY - r.top);
    const beat = Math.max(0, Math.round(toBeat(e.clientX - r.left)));
    for (const f of Array.from(e.dataTransfer.files)) {
      if (/\.midi?$/i.test(f.name)) {
        await importMidiClip(f, row?.track.id ?? null, beat);
        continue;
      }
      try {
        await importAudioFile(f, row?.track.id ?? null, beat);
      } catch {
        toast(`Could not read ${f.name} as audio`);
      }
    }
  };

  return (
    <div className="arrangement" ref={scroller} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <div className="arr-inner" style={{ height: totalH }}>
        <div className="arr-heads" style={{ width: HEAD_W }}>
          <div className="arr-corner" style={{ height: RULER }}>
            <span className="muted small">{Math.ceil(songEnd(project) / project.beatsPerBar)} bars</span>
          </div>
          {rows.map((r) => (
            <TrackHead key={r.track.id} row={r} selected={r.track.id === selected} />
          ))}
          <AddTrack />
        </div>
        <canvas
          ref={canvas}
          className="arr-canvas"
          tabIndex={0}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onWheel={onWheel}
          onKeyDown={onKey}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Arrangement timeline"
        />
      </div>
    </div>
  );
}

function TrackHead({ row, selected }: { row: RowInfo; selected: boolean }) {
  const t = row.track;
  const targets = AUTOMATION_TARGETS(t.fx);
  return (
    <>
      <div className={`thead ${selected ? 'sel' : ''}`} style={{ height: ROW, borderLeftColor: t.color }} onClick={() => selectTrack(t.id, false)}>
        <div className="thead-top">
          <span className="avatar sm" style={{ background: t.musician.shirt }}>{t.musician.name[0]}</span>
          <input value={t.name} onChange={(e) => store.update('Rename track', (d) => void (d.tracks.find((x) => x.id === t.id)!.name = e.target.value), { coalesce: `rename:${t.id}` })} aria-label="Track name" />
        </div>
        <div className="thead-btns" onClick={(e) => e.stopPropagation()}>
          <button className={`chip ${t.mute ? 'mute' : ''}`} onClick={() => act.toggle(t.id, 'mute')} title="Mute">M</button>
          <button className={`chip ${t.solo ? 'solo' : ''}`} onClick={() => act.toggle(t.id, 'solo')} title="Solo">S</button>
          <button className={`chip ${t.armed ? 'arm' : ''}`} onClick={() => act.toggle(t.id, 'armed')} title="Arm for recording">●</button>
          <select
            className="auto-pick"
            value={row.target ?? ''}
            title="Show an automation lane"
            onChange={(e) => ui.set({ autoExpand: { ...ui.get().autoExpand, [t.id]: e.target.value || null } })}
          >
            <option value="">Automation…</option>
            {targets.map((a) => (
              <option key={a.target} value={a.target}>
                {t.automation.some((l) => l.target === a.target && l.points.length) ? '● ' : ''}
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {row.autoY !== null && row.target && (
        <div className="thead auto" style={{ height: AUTO_ROW }}>
          <small>{targets.find((a) => a.target === row.target)?.label}</small>
          <button
            className="chip"
            title="Clear this lane"
            onClick={() => store.update('Clear automation', (d) => {
              const tt = d.tracks.find((x) => x.id === t.id)!;
              tt.automation = tt.automation.filter((l) => l.target !== row.target);
            })}
          >
            Clear
          </button>
        </div>
      )}
    </>
  );
}

function AddTrack() {
  return (
    <select
      className="add-track"
      value=""
      onChange={(e) => {
        const id = act.recruit(e.target.value as keyof typeof INSTRUMENTS);
        if (!id) toast('The studio is full');
        else selectTrack(id, false);
      }}
    >
      <option value="">＋ Add track (recruits a musician)</option>
      {Object.values(INSTRUMENTS).map((i) => (
        <option key={i.type} value={i.type}>
          {i.label} — {i.role}
        </option>
      ))}
    </select>
  );
}

function drawClip(x: CanvasRenderingContext2D, p: Project, t: Track, c: Clip, X: number, Y: number, W: number, H: number, sel: boolean) {
  if (X > 4000 || X + W < 0) return;
  x.save();
  x.beginPath();
  x.roundRect(X + 1, Y, Math.max(4, W - 2), H, 6);
  x.fillStyle = t.color + (sel ? 'ee' : 'aa');
  x.fill();
  x.strokeStyle = sel ? '#fff3d6' : 'rgba(0,0,0,0.4)';
  x.lineWidth = sel ? 2 : 1;
  x.stroke();
  x.clip();
  x.fillStyle = 'rgba(0,0,0,0.25)';
  x.fillRect(X, Y, W, 14);
  x.fillStyle = '#fff';
  x.font = '800 10px Nunito';
  const pat = c.patternId ? p.patterns[c.patternId] : undefined;
  const name = pat?.name ?? (c.audioId ? p.audio[c.audioId]?.name : '') ?? '';
  x.fillText(name, X + 6, Y + 10);
  const ppb = W / c.length;
  if (pat && pat.notes.length) {
    const ps = pat.notes.map((n) => n.pitch);
    const lo = Math.min(...ps);
    const hi = Math.max(...ps) + 1;
    x.fillStyle = 'rgba(30,20,15,0.75)';
    for (let k = 0; k * pat.length < c.length + c.offset; k++) {
      for (const n of pat.notes) {
        const b = k * pat.length + n.start - c.offset;
        if (b < 0 || b >= c.length) continue;
        const ny = Y + 16 + (1 - (n.pitch - lo + 0.5) / (hi - lo)) * (H - 22);
        x.fillRect(X + b * ppb, ny, Math.max(1.5, n.dur * ppb - 1), 2.5);
      }
      if (k > 0) {
        x.fillStyle = 'rgba(255,255,255,0.25)';
        x.fillRect(X + (k * pat.length - c.offset) * ppb, Y + 14, 1, H);
        x.fillStyle = 'rgba(30,20,15,0.75)';
      }
    }
  } else if (c.audioId) {
    const pk = peaks(c.audioId);
    const buf = audioAssets.get(c.audioId);
    if (pk && buf) {
      const secPerBeat = 60 / p.bpm;
      x.fillStyle = 'rgba(30,20,15,0.7)';
      const mid = Y + 14 + (H - 14) / 2;
      for (let px = 0; px < W; px += 2) {
        const sec = c.offset + (px / ppb) * secPerBeat;
        const i = Math.floor((sec / buf.duration) * pk.length);
        if (i >= pk.length) break;
        const a = pk[i] * (H - 18) * 0.5 * c.gain;
        x.fillRect(X + px, mid - a, 1.5, a * 2);
      }
    }
  }
  x.restore();
}
