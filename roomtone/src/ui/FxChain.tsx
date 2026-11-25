import { EFFECTS } from '../state/specs';
import type { Effect, EffectType } from '../state/types';
import { act } from '../app';
import type { FxOwner } from '../state/actions';
import { Knob } from './Knob';

const FORM_ICON = { pedal: '🦶', rack: '🗄️', amp: '🔊' } as const;

export function FxChain({ owner, ownerId, fx, automated = [], compact }: { owner: FxOwner; ownerId: string; fx: readonly Effect[]; automated?: string[]; compact?: boolean }) {
  return (
    <div className="fxchain">
      {fx.length === 0 && <p className="muted small">No effects yet. Add a pedal or rack unit below — it appears in the studio too.</p>}
      {fx.map((e, i) => {
        const spec = EFFECTS[e.type];
        return (
          <div key={e.id} className={`fx ${e.enabled ? '' : 'off'}`} style={{ ['--fx' as string]: spec.color }}>
            <div className="fx-head">
              <button className={`led ${e.enabled ? 'on' : ''}`} title={e.enabled ? 'Bypass' : 'Enable'} aria-pressed={e.enabled} onClick={() => act.toggleFx(owner, ownerId, e.id)} />
              <span className="fx-name">
                {spec.name}
                {!compact && <small> · {FORM_ICON[spec.form]} {spec.gearName}</small>}
              </span>
              <span className="fx-tools">
                <button className="icon" disabled={i === 0} onClick={() => act.moveFx(owner, ownerId, e.id, -1)} title="Earlier in the chain">↑</button>
                <button className="icon" disabled={i === fx.length - 1} onClick={() => act.moveFx(owner, ownerId, e.id, 1)} title="Later in the chain">↓</button>
                <button className="icon" onClick={() => act.removeFx(owner, ownerId, e.id)} title="Remove">✕</button>
              </span>
            </div>
            <div className="fx-knobs">
              {spec.params.map((ps) => (
                <Knob key={ps.key} spec={ps} value={e.params[ps.key]} color={spec.color} automated={automated.includes(`fx:${e.id}:${ps.key}`)} onChange={(v, live) => act.setFxParam(owner, ownerId, e.id, ps.key, v, live)} />
              ))}
            </div>
          </div>
        );
      })}
      <select
        className="add-fx"
        value=""
        onChange={(ev) => {
          if (ev.target.value) act.addFx(owner, ownerId, ev.target.value as EffectType);
        }}
      >
        <option value="">＋ Add effect…</option>
        {Object.values(EFFECTS).map((s) => (
          <option key={s.type} value={s.type}>
            {s.name} — {s.gearName}
          </option>
        ))}
      </select>
    </div>
  );
}
