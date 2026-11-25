import { useEffect, useRef, useState } from 'react';
import { engine, store, toast, ui } from '../../app';
import { useProject, useRaf, useUi } from '../hooks';
import { audioAssets, putAsset } from '../../audio/assets';
import { uid } from '../../state/store';
import { importAudioFile } from './Arrangement';

// Destructive edits write a new audio asset and point the clip at it, so every edit is undoable.
function edit(clipId: string, label: string, fn: (src: AudioBuffer, a: number, b: number) => AudioBuffer, sel: [number, number] | null) {
  const p = store.get();
  const t = p.tracks.find((x) => x.clips.some((c) => c.id === clipId));
  const clip = t?.clips.find((c) => c.id === clipId);
  const src = clip?.audioId ? audioAssets.get(clip.audioId) : undefined;
  if (!t || !clip || !src) return;
  const [a, b] = sel ?? [0, src.length];
  const out = fn(src, Math.min(a, b), Math.max(a, b));
  const id = uid('aud');
  putAsset(id, out);
  store.update(label, (d) => {
    d.audio[id] = { id, name: `${p.audio[clip.audioId!]?.name ?? 'Audio'} (${label.toLowerCase()})`, duration: out.duration, sampleRate: out.sampleRate, channels: out.numberOfChannels };
    const c = d.tracks.find((x) => x.id === t.id)!.clips.find((k) => k.id === clipId)!;
    c.audioId = id;
    if (label === 'Crop') {
      c.offset = 0;
      c.length = (out.duration * d.bpm) / 60;
    }
  });
}

function copyBuf(src: AudioBuffer, len = src.length) {
  return new AudioBuffer({ length: Math.max(1, len), numberOfChannels: src.numberOfChannels, sampleRate: src.sampleRate });
}

const OPS: Record<string, (s: AudioBuffer, a: number, b: number) => AudioBuffer> = {
  Normalize: (s, a, b) => {
    let m = 0;
    for (let c = 0; c < s.numberOfChannels; c++) {
      const d = s.getChannelData(c);
      for (let i = a; i < b; i++) m = Math.max(m, Math.abs(d[i]));
    }
    const g = m > 0 ? 0.98 / m : 1;
    const o = copyBuf(s);
    for (let c = 0; c < s.numberOfChannels; c++) {
      const d = s.getChannelData(c).slice();
      for (let i = a; i < b; i++) d[i] *= g;
      o.copyToChannel(d, c);
    }
    return o;
  },
  Reverse: (s, a, b) => {
    const o = copyBuf(s);
    for (let c = 0; c < s.numberOfChannels; c++) {
      const d = s.getChannelData(c).slice();
      d.subarray(a, b).reverse();
      o.copyToChannel(d, c);
    }
    return o;
  },
  'Fade in': (s, a, b) => {
    const o = copyBuf(s);
    for (let c = 0; c < s.numberOfChannels; c++) {
      const d = s.getChannelData(c).slice();
      for (let i = 0; i < a; i++) d[i] = 0;
      for (let i = a; i < b; i++) d[i] *= (i - a) / Math.max(1, b - a);
      o.copyToChannel(d, c);
    }
    return o;
  },
  'Fade out': (s, a, b) => {
    const o = copyBuf(s);
    for (let c = 0; c < s.numberOfChannels; c++) {
      const d = s.getChannelData(c).slice();
      for (let i = a; i < b; i++) d[i] *= 1 - (i - a) / Math.max(1, b - a);
      for (let i = b; i < d.length; i++) d[i] = 0;
      o.copyToChannel(d, c);
    }
    return o;
  },
  Silence: (s, a, b) => {
    const o = copyBuf(s);
    for (let c = 0; c < s.numberOfChannels; c++) {
      const d = s.getChannelData(c).slice();
      d.fill(0, a, b);
      o.copyToChannel(d, c);
    }
    return o;
  },
  Crop: (s, a, b) => {
    const o = copyBuf(s, b - a);
    for (let c = 0; c < s.numberOfChannels; c++) o.copyToChannel(s.getChannelData(c).slice(a, b), c);
    return o;
  },
};

export function AudioEditor() {
  const clipId = useUi((s) => s.editClip);
  const clip = useProject((p) => p.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId && c.audioId));
  const meta = useProject((p) => (clip?.audioId ? p.audio[clip.audioId] : undefined));
  const canvas = useRef<HTMLCanvasElement>(null);
  const [sel, setSel] = useState<[number, number] | null>(null);
  const dragging = useRef(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => setSel(null), [clip?.audioId]);
  const buf = clip?.audioId ? audioAssets.get(clip.audioId) : undefined;

  useRaf(() => {
    const c = canvas.current;
    if (!c || !buf || !clip) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const x = c.getContext('2d')!;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = '#1b1512';
    x.fillRect(0, 0, w, h);
    const p = store.get();
    // Region the clip actually plays
    const sp = buf.sampleRate;
    const s0 = (clip.offset * sp) / buf.length;
    const s1 = Math.min(1, (clip.offset + (clip.length * 60) / p.bpm) * sp / buf.length);
    x.fillStyle = 'rgba(242,165,65,0.08)';
    x.fillRect(s0 * w, 0, (s1 - s0) * w, h);
    const ch = buf.getChannelData(0);
    const step = ch.length / w;
    x.fillStyle = '#f2a541';
    for (let px = 0; px < w; px++) {
      let lo = 0;
      let hi = 0;
      const end = Math.min(ch.length, Math.floor((px + 1) * step));
      for (let i = Math.floor(px * step); i < end; i += Math.max(1, Math.floor(step / 64))) {
        lo = Math.min(lo, ch[i]);
        hi = Math.max(hi, ch[i]);
      }
      x.fillRect(px, h / 2 - hi * h * 0.45 * clip.gain, 1, Math.max(1, (hi - lo) * h * 0.45 * clip.gain));
    }
    if (sel) {
      x.fillStyle = 'rgba(255,243,214,0.18)';
      x.fillRect((Math.min(...sel) / buf.length) * w, 0, (Math.abs(sel[1] - sel[0]) / buf.length) * w, h);
    }
    // Playhead inside this clip
    if (engine.playing) {
      const b = engine.position();
      if (b >= clip.start && b < clip.start + clip.length) {
        const sec = clip.offset + ((b - clip.start) * 60) / p.bpm;
        x.fillStyle = '#ffd27a';
        x.fillRect((sec / buf.duration) * w, 0, 2, h);
      }
    }
  });

  if (!clip || !buf) {
    return (
      <div className="empty">
        <p>Select an audio clip in the arrangement, drop audio files onto it, or record from a microphone onto an armed audio track.</p>
        <button onClick={() => file.current?.click()}>Import audio file…</button>
        <input ref={file} type="file" accept="audio/*" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await importAudioFile(f, ui.get().selected, Math.floor(engine.position())).catch(() => toast('Could not decode that file'));
          e.target.value = '';
        }} />
      </div>
    );
  }
  const toSample = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * buf.length);
  };
  return (
    <div className="audio-editor">
      <div className="toolbar">
        <b>{meta?.name}</b>
        <span className="muted small">{buf.duration.toFixed(2)} s · {buf.sampleRate} Hz · {buf.numberOfChannels === 1 ? 'mono' : 'stereo'}</span>
        <label>
          Clip gain
          <input type="range" min={0} max={2} step={0.01} value={clip.gain} onChange={(e) => store.update('Clip gain', (d) => {
            for (const t of d.tracks) for (const c of t.clips) if (c.id === clip.id) c.gain = Number(e.target.value);
          }, { coalesce: `gain:${clip.id}` })} />
        </label>
        <span className="grow" />
        {Object.keys(OPS).map((op) => (
          <button key={op} disabled={op === 'Crop' && !sel} onClick={() => (edit(clip.id, op, OPS[op], sel), setSel(null))} title={sel ? `${op} the selection` : `${op} the whole file`}>
            {op}
          </button>
        ))}
      </div>
      <canvas
        ref={canvas}
        className="wave"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          dragging.current = true;
          const s = toSample(e);
          setSel([s, s]);
        }}
        onPointerMove={(e) => dragging.current && setSel((v) => (v ? [v[0], toSample(e)] : v))}
        onPointerUp={() => {
          dragging.current = false;
          setSel((v) => (v && Math.abs(v[1] - v[0]) < 64 ? null : v));
        }}
        aria-label="Waveform: drag to select a region"
      />
    </div>
  );
}
