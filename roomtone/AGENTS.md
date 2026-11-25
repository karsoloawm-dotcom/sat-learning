# AGENTS.md — RoomTone

You are continuing **RoomTone**, a functional DAW presented as a cozy 3D recording studio. Read, in order:
`README.md` (what exists), `docs/ARCHITECTURE.md` (how), `docs/ROADMAP.md` (what's next),
`docs/DEVELOPMENT.md` (how to verify), `docs/ASSET_PIPELINE.md` (before adding any asset).

## Non-negotiables

1. **No fake controls.** A button, knob or menu item must change real state or audio. Unbuilt features are absent.
2. **Audio never depends on rendering.** Scheduling stays in `src/audio/` on the Worker clock; the renderer only reads.
3. **One source of truth.** All edits go through `ProjectStore.update` / `state/actions.ts`; the 3D gear, mixer and
   panels all read the same values. New effect parameters are added to `state/specs.ts` only.
4. **Undo for everything** the user can change in the document; drags are one undo step (`history: 'none'` + `commitGesture`).
5. **Offline = realtime.** Audio code takes `BaseAudioContext`; export must sound like playback.
6. **Licences.** Do not commit assets whose licence forbids redistribution (this includes LowPolyCrate files).
7. **Verify by running it.** After visual or audio changes, run the dev server and the scripts in `scripts/`, and look
   at screenshots. Report what you could not test (real microphones, MIDI hardware, GPUs).

## Where things go

| Change | Files |
| --- | --- |
| New effect | `state/types.ts` (EffectType), `state/specs.ts` (params, gear form), `audio/effects.ts` (unit) — gear and UI pick it up |
| New instrument | `state/specs.ts` (INSTRUMENTS), `audio/instruments/`, `render/props.ts` (prop), `render/animation/performers.ts` (performer), `state/actions.ts` (station preference) |
| New view/panel | `ui/`, wire in `ui/App.tsx`; camera behaviour in `render/world.ts` |
| Project format change | `state/types.ts` + bump `version` and add a migration in `state/persistence.ts` |

## Style

TypeScript strict, small modules, no new dependencies for a few lines of code, comments explain *why*.
