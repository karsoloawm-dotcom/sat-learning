# Architecture

## Technology choice

| Option | Verdict |
| --- | --- |
| **Web: TypeScript + Web Audio + Three.js + React** (chosen for v0.x) | Runs anywhere, instant iteration, excellent 3D tooling, Web Audio gives sample-accurate scheduling and offline rendering. Cannot host VST3. |
| JUCE desktop app with an embedded renderer | Native plugin hosting and low latency, but slow UI/3D iteration and no browser demo. |
| Unity / Godot | Great 3D, weak DAW-grade audio and no plugin hosting without native plugins of our own. |

The plan is a **hybrid**: keep the TypeScript app as the UI, 3D studio and project model, and add a native audio
engine (JUCE) behind the same `AudioEngine` surface when plugin hosting is needed (see *Native engine* below).
Nothing outside `src/audio/` touches Web Audio directly, which keeps that swap contained.

## Module map

```
src/
  state/        Project document, store (undo/redo), actions, specs, persistence      — no audio, no 3D
    types.ts      The JSON project schema (tracks, clips, patterns, effects, automation, musicians)
    specs.ts      Single table of effect parameters, instrument presets, fader law
    store.ts      ProjectStore (immer snapshots, undo/redo, gesture coalescing) + UiStore
    actions.ts    Mutations shared by React UI, 3D studio and shortcuts
    defaults.ts   Demo song, new tracks, random looks
    persistence.ts Autosave (localStorage + IndexedDB), .roomtone files, musician presets
  audio/        Everything Web Audio                                                  — no React, no Three
    engine.ts     Realtime transport + lookahead scheduler on a Worker clock; live notes; meters
    graph.ts      MixGraph: channels, fx chains, buses, master. Built for ANY BaseAudioContext
    schedule.ts   Pure timeline maths (notes in range, clip looping, automation, mute/solo)
    instruments/  Drum synth, plucked strings, piano/EP/organ, synth, sampler
    effects.ts    EQ, compressor, reverb, delay, distortion, chorus, amp
    export.ts     Offline bounce (same MixGraph) + WAV encoder
    assets.ts     Decoded AudioBuffers by asset id
  render/       Three.js                                                              — reads state, never writes audio
    world.ts      Renderer, post-processing, cameras for all views, picking, per-frame sync
    rooms.ts      Room interface (geometry, lights, stations, walk heights, cameras, atmosphere) + studio room
    studio.ts     The rehearsal studio: furniture, stations, lights, dollhouse cutaways
    hall.ts       The concert hall: loads the Blender glTF, instancing, lights, haze, light shafts, dust
    quality.ts    Graphics presets (Phone → Ultra 4K)
    props.ts      Instruments and gear meshes with the anchor points animation needs
    gear.ts       Effects as physical equipment, the console, interactive controls
    character/    Mii-style character on a shared Mixamo-named skeleton
    animation/    IK + per-instrument performers driven by note events
  ui/           React                                                                 — views and panels
    App.tsx, TopBar, BandPanel (director), MusicianDrawer, LookEditor, FxChain, Knob
    producer/     Arrangement, PianoRoll, Mixer, AudioEditor, Inspector
    keyboard.ts   Shortcuts, musical typing, Web MIDI
    recording.ts  MIDI and microphone recording
  app.ts        Wires the singletons: store, ui store, engine, world
```

Dependency direction: `ui → (state, audio, render)`, `render → (state, audio read-only)`, `audio → state`, `state → nothing`.

## Data flow

```
 user input (React panels, 3D knobs, keyboard/MIDI)
        │  actions.ts / store.update(label, recipe, opts)
        ▼
 ProjectStore ── immutable snapshot ──► subscribers
        │                     │                     │
        ▼                     ▼                     ▼
 AudioEngine.graph.sync   World.syncProject       React (useSyncExternalStore)
 (diff by reference)      (musicians, gear)       (re-render what changed)
```

* Every document change goes through `store.update`. Drags use `{ history: 'none' }` and end with
  `store.commitGesture()` so a whole gesture is one undo step; wheel/slider tweaks use `coalesce` keys.
* The physical studio and the mixer read **the same values**, so they cannot drift. Effect parameters are
  described once in `specs.ts` (range, unit, log taper); knobs everywhere use `toNorm/fromNorm`.

## Timing model (why audio never depends on frame rate)

1. A Worker posts a tick every 25 ms (Worker timers are not throttled like `requestAnimationFrame`).
2. `AudioEngine.tick()` schedules everything between the scheduling cursor and `currentTime + 200 ms`:
   notes (`instrument.noteOn(time, …)` with exact AudioContext times), audio clips, automation ramps, metronome.
   Loop wraps split the window and push a new *anchor* (time ↔ beat), so positions stay exact across wraps.
3. Each scheduled note is also emitted as a `NoteEvent { time, end, pitch, vel }` **before** it sounds.
4. The renderer asks `engine.audibleTime()` (`getOutputTimestamp`, i.e. what the listener hears now) each frame
   and poses musicians for that instant. Because events arrive ~200 ms early, a drummer can wind up and land the
   stick exactly at `time`. Frame drops only make animation choppier; they can never delay a note.
5. Offline export (`renderProject`) builds the same `MixGraph` in an `OfflineAudioContext` and calls the same
   scheduling functions for the whole range at once.

## Musician animation

Performers (`render/animation/performers.ts`) are per-instrument controllers over a common base:

* **Base**: rest pose restore → breathing, groove bounce on the beat (scaled by personality and recent note
  density) → planted feet via two-bone leg IK → instrument performance → head look-at (instrument, soloist,
  the player, random) → face (blink, brows, mouth by mood: rest / happy / joy / focus / sing).
* **Drummer**: each hit is assigned a limb (pieces have a default hand; simultaneous hits swap hands). A strike
  curve gives `lift = 0` at every hit time and rises between hits (wind-up ≈130 ms, rebound ≈70 ms); travel
  interpolates between drums. Hand position is solved so the **stick tip** lands on the head; kick pedal and
  hi-hat follow the feet. Drums squash and cymbals wobble on the audible hit.
* **Keyboardist**: notes are split between hands (split point, wide chords give the low note to the left);
  hands track the average key of their sounding notes and anticipate the next; keys depress while sounding.
* **Guitarist / bassist**: each note gets a string/fret fingering near the current hand position; the fretting
  hand slides to that fret; the picking hand strokes down on beats and up on off-beats; strings vibrate.
* **Vocalist** (audio tracks): no notes exist, so the mouth and gestures follow the track's real meter level.

Measured with `scripts/check-sync.cjs`: stick tip within 3–6 mm of the drum head at the hit time (raised
17–26 cm 80 ms before), the right key down with the hand within 4 mm of it.

## Native engine and VST3 (planned)

Target: a JUCE application (`native/`) that owns audio I/O, plugin hosting (VST3/AU via `AudioPluginFormatManager`)
and the realtime graph, with the existing TypeScript UI in a JUCE 8 `WebBrowserComponent` (or Tauri/Electron
talking to a JUCE sidecar over a local socket).

* **Contract**: the native engine accepts the same `Project` JSON and patches (`graph.sync` equivalent), and
  streams back `NoteEvent`s with sample times plus meter levels. `World` only needs `audibleTime()`, `position()`,
  `level()` and the event stream, which is exactly the surface `AudioEngine` exposes today.
* **Plugins in the project model**: add `InstrumentType = 'plugin'` and `EffectType = 'plugin'` with
  `{ pluginId, state (base64 chunk), classification }`. Classification maps an instrument plugin to a musician
  role (keys/synth/drums/strings…) and an effect plugin to a gear form (pedal/rack/amp). Automatic guess from
  plugin category/name; the user can override it. "Open plugin window" asks the native host to show the editor.
* Until then, plugin tracks would be rejected with a clear message in the browser build (never faked).
