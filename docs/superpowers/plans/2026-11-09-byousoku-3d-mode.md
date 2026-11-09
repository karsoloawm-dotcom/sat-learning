# Byousoku 3D Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 3D button in the Byousoku 5 Centimeter scene that opens a walkable Three.js version of the scene, exited by clicking a 3D letter.

**Architecture:** One new `<script>` block appended to `index.html` defines `window.Byo3D` ({on, enter(), exit()}); it lazy-imports Three.js from jsDelivr on first use and builds the whole scene procedurally. Three small hooks in existing code: the sky-control button, a pause check at the top of the 2D `Sky` frame loop, and `Sky.prem()` to expose today's premiere-day key.

**Tech Stack:** Vanilla JS, Three.js 0.160.0 (`https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js`), WebAudio via existing `SFX.ding/train`. Test: Playwright (pre-installed) with the CDN routed to a local npm copy.

**Spec:** `docs/superpowers/specs/2026-11-09-byousoku-3d-mode-design.md`

## Global Constraints
- Site is `index.html` inside `Katawaredoki Vocab.zip`; edit it and re-zip with the two `grand-piano.*.txt` files unchanged.
- Three.js loads only when 3D is pressed. Load failure → `Search.say(T("b3_fail"))`, stay 2D.
- New strings in `I18N.en/vi/ja`: `b3_btn`, `b3_hint`, `b3_touch`, `b3_fail`, `b3_letter`.
- Quotes: `ja` uses the Japanese list from the spec; `en` and `vi` use the English list.
- Music is never touched. Crossing sounds: `SFX.ding(k)` per lamp blink (k alternates 0/1), `SFX.train(3.6)` as the train reaches the crossing.

## Review Focus
1. Clicks inside 3D must not reach the egg module's document click handler (it would exit sky view) — overlay stops propagation.
2. Esc first releases pointer lock (browser); a second Esc exits 3D and must not also toggle sky view — capture-phase listener with `stopImmediatePropagation`.
3. Exit must dispose renderer, geometries, materials, textures and listeners; entering twice must not leak.
4. Window resize / phone rotation while in 3D keeps the aspect right.
5. Reduced-motion users: 3D still works (it is opt-in), petals fall slower.

---

### Task 1: 3D module + hooks

**Files:**
- Modify: `index.html` (inside the zip): `#skyctl` markup (add `<button class="ghost" id="sk-3d" type="button" hidden>`), egg module `labels()` (show `#sk-3d` when `KEEPABLE[lastEgg]==="byosoku"||Sky.kept()==="byosoku"||Sky.prem()==="byosoku"`), Sky `frame()` (early return while `window.Byo3D&&Byo3D.on`), Sky return object (`prem:()=>PV.k`), I18N strings, new script block at end.
- Test: `tests/byo3d.check.mjs`

**Interfaces:**
- Produces: `window.Byo3D = {on:boolean, enter():Promise<void>, exit():void}`; overlay root `#byo3d` (fixed, z-index 60) containing the canvas, a hint line and a touch joystick.

- [ ] Step 1: Write `tests/byo3d.check.mjs`: unzip to a temp dir, open `index.html` in Chromium with jsDelivr routed to `node_modules`-style local copy, type `5centimeterspersecond` into `#gsearch`, enter sky view, assert `#sk-3d` visible, click it, assert `Byo3D.on===true` and the canvas has non-blank pixels, hold `w` 1 s and assert camera moved, call the letter click via `Byo3D._clickLetter()`, assert `Byo3D.on===false` and `#byo3d` removed. Save screenshots to the scratchpad.
- [ ] Step 2: Run it; expect FAIL (`#sk-3d` missing).
- [ ] Step 3: Implement hooks and the module: sky shader dome, fog, mountains, ground with instanced wind grass, rails/ballast/sleepers, crossing (striped poles, lamps, arrow box, 踏切注意 sign, barrier arm, concrete slabs), poles + wires, cherry tree (instanced blossom clusters), 6-car train (cream body, blue stripe, windows, doors, roof units, pantograph, 各停 新宿 board, bogies), instanced petals, 3D letter on a stand with the quote on a canvas texture, walk controls (keys + pointer-lock mouse; touch joystick + drag look), crossing cycle with sounds, quality tier by `matchMedia("(pointer:coarse)")`.
- [ ] Step 4: Run the check; expect PASS; inspect screenshots against the 2D scene and the train reference.
- [ ] Step 5: Re-zip, commit, push.
