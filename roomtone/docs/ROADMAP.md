# Roadmap

## M0 — Vertical slice ✅ (this milestone)

One rehearsal studio, four customisable musicians, sequencing, piano roll, mixing with real effects as physical
gear, animation synchronised to note events, Walk / Director / Producer / Perform views, undo, autosave,
project files, WAV export. See the README feature table.

Known gaps inside M0, worth doing next:

- [ ] Mic recording and Web MIDI input are implemented but were not exercised with real devices (no hardware in CI).
- [ ] Audio clips do not follow tempo changes (no time-stretch); they keep their length in seconds.
- [ ] Automation lanes are linear point-to-point only (no curves, no draw-with-pencil mode).
- [ ] The Perform camera can cut to shots partly blocked by gear; add occlusion checks.
- [ ] Characters are rigid parts on bones; add a skinned body mesh for smoother elbows/shoulders.
- [ ] Piano roll: scale highlighting, chord stamps, note-off velocity, MIDI CC lanes.
- [ ] Musicians walking to their station when recruited (currently a pop-in) and walking out when dismissed.
- [ ] Unit tests for effect parameter maths and project-file round trip.

## M1 — Deeper DAW

- Tempo and time-signature tracks; tempo automation in the scheduler (anchor list already supports re-anchoring).
- MIDI file import/export; stems export (one WAV per track); loop-region export.
- Sample library browser with one-shot drag-to-pad; slicing for the sampler.
- Sidechain input on the compressor; more effects (phaser, tremolo, gate, multiband, convolution cabinets).
- Clip-level fades and crossfades; comping takes on audio tracks.
- Performance: move instruments' heavy voice graphs to AudioWorklets where node counts get large.

## M2 — More rooms

- Orchestral hall (strings, brass, woodwinds, percussion) with bowing / breathing performers: bow position and
  speed from note duration and dynamics, breath before phrases, section leaders.
- Electronic room: synth rack with patch cables, drum machines, sampler pads, a DJ booth.
- Room travel: each room is a set of stations; tracks can be moved between rooms; the control room listens to all.
- Room acoustics: each room's reverb impulse becomes its default bus.

## M3 — Native engine and plugins

- JUCE engine with the `Project` JSON contract (see ARCHITECTURE.md), VST3/AU hosting, plugin windows.
- Instrument plugins recruit musicians, effect plugins become gear; manual classification UI.
- Low-latency monitoring and ASIO/CoreAudio device selection.

## M4 — Shows and sharing

- Music-video export: render Perform mode frame-by-frame against the offline bounce (deterministic, not screen capture).
- Camera director with editable shot list; lighting cues on the timeline.
- Stage customisation (rug, lights, posters, props) and shareable band presets.
