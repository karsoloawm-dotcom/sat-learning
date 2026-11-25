import { useEffect, useRef } from 'react';
import { act, engine, selectTrack, store, toast as showToast, ui, world } from '../app';
import { QUALITY } from '../render/quality';
import { World } from '../render/world';
import { useUi } from './hooks';
import { TopBar } from './TopBar';
import { BandPanel, DirectorLabels } from './BandPanel';
import { MusicianDrawer } from './MusicianDrawer';
import { Producer } from './producer/Producer';
import { installKeyboard } from './keyboard';
import { renderProject } from '../audio/export';

export function App() {
  const view = useUi((s) => s.view);
  const toast = useUi((s) => s.toast);
  const busy = useUi((s) => s.busy);
  const stageRef = useRef<HTMLDivElement>(null);
  const previewSlot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (world.current || !stageRef.current) return;
    const w = new World(stageRef.current, store, engine);
    world.current = w;
    w.onSelect = (id) => selectTrack(id);
    w.onHover = (h) => ui.set({ hover: h });
    w.onLock = (locked) => ui.set({ locked });
    w.onQuality = (quality, auto) => {
      ui.set({ quality });
      if (auto) showToast(`Graphics lowered to ${QUALITY[quality].label} to keep things smooth`);
    };
    installKeyboard();
    (window as unknown as { roomtone: unknown }).roomtone = { store, engine, world: w, ui, renderProject, act };
  }, []);

  // In Producer view the live studio shrinks into a preview window; the canvas element is moved, never rebuilt.
  useEffect(() => {
    const canvasHost = stageRef.current;
    if (!canvasHost) return;
    const target = view === 'producer' ? previewSlot.current : document.getElementById('stage-slot');
    if (target && canvasHost.parentElement !== target) target.appendChild(canvasHost);
  }, [view]);

  return (
    <div className={`app view-${view}`}>
      <TopBar />
      <main className="main">
        <div id="stage-slot" className="stage-slot">
          <div ref={stageRef} className="stage" />
        </div>
        {view !== 'producer' && <StageOverlay />}
        {view === 'producer' && <Producer previewRef={previewSlot} />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
      {busy && (
        <div className="busy" role="status">
          <div className="spinner" />
          {busy}
        </div>
      )}
    </div>
  );
}

function StageOverlay() {
  const view = useUi((s) => s.view);
  const hover = useUi((s) => s.hover);
  const locked = useUi((s) => s.locked);
  return (
    <div className="overlay">
      {view === 'director' && (
        <>
          <DirectorLabels />
          <BandPanel />
        </>
      )}
      {view === 'first' && (
        <>
          <div className={`crosshair ${hover ? 'hot' : ''}`} />
          {!locked && (
            <div className="fp-hint card">
              <b>Click the studio to look around.</b> WASD to walk · Shift to hurry · look at a knob or fader and <b>drag</b> or <b>scroll</b> to turn it · click a pedal's footswitch to bypass · click a musician to chat · Esc to release the mouse
            </div>
          )}
        </>
      )}
      {view === 'perform' && <PerformOverlay />}
      {(view === 'director' || view === 'first') && <MusicianDrawer />}
      {hover && (
        <div className="tooltip" style={{ left: `${hover.x * 100}%`, top: `${hover.y * 100}%` }}>
          <b>{hover.label}</b>
          <span>{hover.value}</span>
        </div>
      )}
    </div>
  );
}

function PerformOverlay() {
  return (
    <>
      <div className="letterbox lb-top" />
      <div className="letterbox lb-bottom">
        <span className="perform-title">{store.get().name}</span>
        <span className="muted">Space to play · Esc to leave the show</span>
      </div>
    </>
  );
}
