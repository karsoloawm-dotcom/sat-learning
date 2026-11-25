import { useRef, useState } from 'react';
import { engine, setView, store, toast, ui, replaceProject } from '../app';
import { useProject, useRaf, useUi } from './hooks';
import { formatPosition } from '../audio/schedule';
import { demoProject, emptyProject } from '../state/defaults';
import { download, exportProjectFile, importProjectFile } from '../state/persistence';
import { encodeWav, renderProject } from '../audio/export';
import { startRecording, stopRecording } from './recording';
import type { ViewMode } from '../render/world';

const VIEWS: { id: ViewMode; label: string; icon: string; hint: string }[] = [
  { id: 'first', label: 'Walk', icon: '🚶', hint: 'First-person: walk the studio and play with the gear (1)' },
  { id: 'director', label: 'Director', icon: '🎬', hint: 'Overhead: manage your band at a glance (2)' },
  { id: 'producer', label: 'Producer', icon: '🎛️', hint: 'Full DAW: arrangement, piano roll, mixer (3)' },
  { id: 'perform', label: 'Perform', icon: '✨', hint: 'Cinematic show of your song (4)' },
];

export function TopBar() {
  const view = useUi((s) => s.view);
  const recording = useUi((s) => s.recording);
  const name = useProject((p) => p.name);
  const bpm = useProject((p) => p.bpm);
  const loop = useProject((p) => p.loop.enabled);
  const metro = useProject((p) => p.metronome);
  const typing = useUi((s) => s.typing);
  const busy = useUi((s) => s.busy);
  const [playing, setPlaying] = useState(engine.playing);
  const pos = useRef<HTMLSpanElement>(null);
  const fileOpen = useUi((s) => s.fileOpen);
  const fileInput = useRef<HTMLInputElement>(null);
  useProject((p) => p); // re-render for undo availability
  useRaf(() => {
    if (engine.playing !== playing) setPlaying(engine.playing);
    const p = store.get();
    const b = engine.position();
    const secs = (b * 60) / p.bpm;
    if (pos.current) pos.current.textContent = `${formatPosition(p, b)}  ·  ${Math.floor(secs / 60)}:${(secs % 60).toFixed(1).padStart(4, '0')}`;
  });

  const exportWav = async () => {
    ui.set({ busy: 'Rendering your song…', fileOpen: false });
    try {
      const buf = await renderProject(store.get());
      download(encodeWav(buf, 16), `${store.get().name || 'roomtone'}.wav`);
      toast('Exported WAV');
    } catch (e) {
      toast(`Export failed: ${(e as Error).message}`);
    } finally {
      ui.set({ busy: null });
    }
  };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">◉</span> RoomTone
        <input className="proj-name" value={name} aria-label="Project name" onChange={(e) => store.update('Rename project', (d) => void (d.name = e.target.value), { coalesce: 'name' })} />
      </div>
      <div className="transport">
        <button className="tbtn" title="Back to start" onClick={() => engine.seek(store.get().loop.enabled ? store.get().loop.start : 0)}>⏮</button>
        <button className={`tbtn play ${playing ? 'on' : ''}`} title="Play / stop (Space)" onClick={() => (engine.playing ? engine.stop() : engine.play())}>
          {playing ? '■' : '▶'}
        </button>
        <button className={`tbtn rec ${recording ? 'on' : ''}`} title="Record onto the armed track (R)" onClick={() => (recording ? stopRecording() : startRecording())}>●</button>
        <button className={`tbtn ${loop ? 'on' : ''}`} title="Loop the highlighted region" onClick={() => store.update('Toggle loop', (d) => void (d.loop.enabled = !d.loop.enabled))}>⟲</button>
        <button className={`tbtn ${metro ? 'on' : ''}`} title="Metronome" onClick={() => store.update('Toggle metronome', (d) => void (d.metronome = !d.metronome))}>𝅘𝅥</button>
        <label className="bpm" title="Tempo (drag or type)">
          <input type="number" min={40} max={240} value={bpm} onChange={(e) => store.update('Tempo', (d) => void (d.bpm = Math.max(40, Math.min(240, Number(e.target.value) || 120))), { coalesce: 'bpm' })} />
          <span>BPM</span>
        </label>
        <span className="position" ref={pos} />
        <button className={`tbtn small ${typing ? 'on' : ''}`} title="Musical typing: play the selected musician with your keyboard (Z–M, Q–U rows)" onClick={() => ui.set({ typing: !typing })}>⌨</button>
      </div>
      <nav className="views" aria-label="Perspective">
        {VIEWS.map((v) => (
          <button key={v.id} className={view === v.id ? 'on' : ''} title={v.hint} onClick={() => setView(v.id)}>
            <span>{v.icon}</span> {v.label}
          </button>
        ))}
      </nav>
      <div className="right">
        <button className="tbtn" title={`Undo ${store.undoLabel() ?? ''} (Ctrl+Z)`} disabled={!store.canUndo()} onClick={store.undo}>↶</button>
        <button className="tbtn" title={`Redo ${store.redoLabel() ?? ''} (Ctrl+Shift+Z)`} disabled={!store.canRedo()} onClick={store.redo}>↷</button>
        <div className="menu">
          <button className="tbtn wide" onClick={() => ui.set({ fileOpen: !fileOpen })}>File ▾</button>
          {fileOpen && (
            <div className="menu-pop" onMouseLeave={() => ui.set({ fileOpen: false })}>
              <button onClick={() => (replaceProject(emptyProject()), ui.set({ fileOpen: false }))}>New empty studio</button>
              <button onClick={() => (replaceProject(demoProject()), ui.set({ fileOpen: false }))}>Load demo song</button>
              <hr />
              <button onClick={async () => (download(await exportProjectFile(store.get()), `${store.get().name || 'project'}.roomtone`), ui.set({ fileOpen: false }))}>Save project file…</button>
              <button onClick={() => fileInput.current?.click()}>Open project file…</button>
              <hr />
              <button onClick={exportWav} disabled={!!busy}>Export song as WAV</button>
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".roomtone,application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                replaceProject(await importProjectFile(f, engine.ctx));
                toast(`Opened ${f.name}`);
              } catch (err) {
                toast((err as Error).message);
              }
              ui.set({ fileOpen: false });
              e.target.value = '';
            }}
          />
        </div>
      </div>
    </header>
  );
}
