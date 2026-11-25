# Development

## Commands

```bash
npm install
npm run dev          # Vite dev server on :5180
npm test             # vitest unit tests
npm run typecheck
npm run build        # typecheck + bundle
```

## Debug handles

In the browser console, `window.roomtone` exposes `{ store, engine, world, ui, renderProject }`.

- `roomtone.engine.play(32)` — play from beat 32.
- `roomtone.world.debugCam = { pos, look }` — freeze the camera (Three.js `Vector3`s) for screenshots; `null` to release.
- `roomtone.renderProject(project, { start, end })` — offline bounce, returns an `AudioBuffer`.
- `?demo` in the URL ignores the autosave and loads the demo song.

## Verification scripts (`scripts/`)

All use the preinstalled Playwright Chromium against a running dev server (`ROOMTONE_URL`, default
`http://localhost:5180`). Screenshots go to `$SHOTS_DIR` (default `/tmp`). Look at the screenshots — compiling
is not the bar.

| Script | Checks |
| --- | --- |
| `check-sync.cjs` | Drum stick tip distance to the drum head at the hit time and 80 ms before; key depression; fret hand position |
| `check-levels.cjs` | Offline render of bars 9–12: peak/RMS of the mix and every track solo, NaN count |
| `check-gear.cjs` | Drags the 3D distortion pedal's Drive knob with the mouse; checks the project value, the live audio unit and undo |
| `check-pianoroll.cjs` | Draws a note with the mouse in the piano roll, undoes it |
| `check-autosave.cjs` | Edits, reloads, confirms the edit survived |
| `shots.cjs <prefix> <setupJs> <shotJs…>` | Evaluates JS, waits, screenshots, per step (`cam(i)` from `cams.js` frames musician *i*) |

Reference results at the end of M0: mix peak −2 to −3 dBFS / RMS ≈ −18 dBFS; stick tip 3–6 mm from the head on hits.

## Conventions

- Every document mutation goes through `store.update(label, recipe, opts)` (or `actions.ts`). Never mutate
  `store.get()` results — they are frozen.
- Continuous gestures: `{ history: 'none' }` while dragging, then `store.commitGesture(label)`.
- Audio code must accept any `BaseAudioContext` so offline export reuses it.
- Rendering code reads `engine.audibleTime()` / `position()` / `level()` and note events; it must never schedule audio.
- Never add a control that does nothing. If a feature isn't built, leave the control out.
- Comment the *why*. Shortcuts get `shortcut: <limit>, <when to upgrade>`.

## Gotchas found the hard way

- **`DynamicsCompressorNode` adds automatic makeup gain** (≈0.6 × −threshold × (1 − 1/ratio) dB). `effects.ts`
  cancels it (`autoMakeupDb`) so the Makeup knob is honest. Forgetting this added ~10 dB to the mix.
- **Waveshaper drive is also gain**: `tanh(kx)/tanh(k)` multiplies typical signals by up to *k*. Distortion and amp
  compensate at a reference level (`compensate()`), so drive changes tone, not loudness.
- **Per-instrument headroom trims** (`TRIM` in `graph.ts`) balance the synthesised instruments; re-run
  `check-levels.cjs` after changing instrument synthesis.
- **Prop world matrices**: performers read kit/keyboard positions through world matrices; `Musician.update`
  refreshes them first, otherwise a pop-in scale change leaves them a frame stale.
- **Stick geometry and IK share `STICK`** in `performers.ts`; change both together.
- **CSS class collisions**: the Producer uses `.bottom`; overlays use `lb-*` names. Prefer specific class names.
- Software GL (headless Chromium) renders a few fps; camera transitions are time-based, so wait long enough
  before screenshots or set `world.debugCam`.
- `PCFSoftShadowMap` was removed in three r187; we use `PCFShadowMap`.
