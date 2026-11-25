import type { RefObject } from 'react';
import { ui } from '../../app';
import { useUi } from '../hooks';
import { Arrangement } from './Arrangement';
import { PianoRoll } from './PianoRoll';
import { Mixer } from './Mixer';
import { Inspector } from './Inspector';
import { AudioEditor } from './AudioEditor';

export function Producer({ previewRef }: { previewRef: RefObject<HTMLDivElement | null> }) {
  const bottom = useUi((s) => s.bottom);
  const selected = useUi((s) => s.selected);
  const editPattern = useUi((s) => s.editPattern);
  return (
    <div className="producer">
      <section className="prod-main">
        <Arrangement />
        <div className="bottom">
          <nav className="tabs">
            {(['piano', 'mixer', 'audio'] as const).map((b) => (
              <button key={b} className={bottom === b ? 'on' : ''} onClick={() => ui.set({ bottom: b })}>
                {{ piano: 'Piano roll', mixer: 'Mixer', audio: 'Audio editor' }[b]}
              </button>
            ))}
          </nav>
          <div className="bottom-body">
            {bottom === 'piano' && (selected && editPattern ? <PianoRoll trackId={selected} patternId={editPattern} /> : <div className="empty">Click a clip in the arrangement to edit its notes (double-click empty space to create one).</div>)}
            {bottom === 'mixer' && <Mixer />}
            {bottom === 'audio' && <AudioEditor />}
          </div>
        </div>
      </section>
      <section className="prod-side">
        <div className="preview" ref={previewRef} title="Your band, live" />
        <Inspector />
      </section>
    </div>
  );
}
