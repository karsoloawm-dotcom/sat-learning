# Byousoku 3D mode — design

## Intent
The 5 Centimeters per Second (Byousoku 5 Centimeter) scene in Katawaredoki Vocab is a 2D canvas: dusk sky, cherry tree, utility poles, mountains, a railway crossing and falling petals, with a train passing now and then. The owner wants a **3D mode** for that scene: a quiet place to walk around, keeping the 2D scene's atmosphere but with high-quality grass, sky, petals and a detailed train. It is a delight feature, not a study feature.

## Goals
- A **3D button** that swaps the 2D scene for a walkable 3D version of it.
- **Atmosphere matches the 2D scene**: purple/pink dusk sky, soft clouds, cherry tree, utility poles and wires, distant mountains, crossing with lights and barrier, petals falling.
- **High quality**: dense wind-blown grass, a real sky with clouds, tumbling petals, and a **detailed commuter train** in the style of the owner's reference (cream body, blue stripe, door pairs, window frames, roof AC units, pantograph, destination board reading 各停 新宿, bogies under the body).
- **Detailed crossing** like the reference: yellow/black striped poles, red lamps, arrow indicator box, 踏切注意 sign, striped barrier arm, concrete crossing slabs, rails on ballast with grass between.
- The **train passes the crossing on a loop**; the barrier lowers, the lamps flash and the existing synthesized crossing-bell and train sounds play.
- The **2D scene's music keeps playing** (the egg_byosoku track, haru-dorobou.m4a) — 3D mode does not touch the audio element.
- **A 3D letter stands near the train track.** Clicking or tapping it exits 3D mode back to the normal UI. Each entry shows one random quote on it, from the list below.

## Non-goals
- No game, goals, scores or collectibles.
- No characters or people in the scene.
- No new music or sounds; reuse what exists.
- No 3D for any other egg or special day.

## Anti-goals (a failure even if it works)
- The normal site gets slower to load. Three.js must load **only when 3D is pressed**.
- The scene looks like generic low-poly clip art instead of the 2D scene's painted dusk.
- Phones stutter or overheat.
- Getting stuck in 3D with no way out.

## Quotes (owner-supplied, use verbatim)
1. "He's always looking past me, at something far off in the distance. And he'll never look at me. Not ever." — Kanae Sumida
2. "I just started to envy the ones who had real ambitions." — Risa Mizuno
3. "The feelings you've been hiding from me…the things you'd never want me to see. Show them to me." — Kanae Sumida
4. "My heart has been…how do I put this…it's like I've lost my resilience. That sense of fulfillment, of being moved when I look at something beautiful, my enthusiasm — was being whittled away." — Takaki Tohno
5. "To hold on to that feeling even if we'd be far apart. And that became my compass in life." — Takaki Tohno
6. "The chains of your past made you who you are now." — Risa Mizuno
7. "At least as I am…I can only wish you but not grant you happiness." — Risa Mizuno
8. "But I hope we meet again, in some new way, as new people, and that something new starts." — Risa Mizuno
9. "…they say it's five centimeters per second. The speed of a falling cherry petal. Five centimeters per second." — Akari Shinohara

(Quote 4: owner's text said "being move"; fixed to "being moved" — builder's call, flag to owner.)

## Constraints
- The site is one file, `index.html`, inside `Katawaredoki Vocab.zip` (with two SoundFont files). The change edits that `index.html` and re-zips.
- It already loads Google Fonts from the network, so loading Three.js from a CDN at runtime is acceptable. If the load fails, show a toast and stay in 2D.
- The UI is in English, Tiếng Việt and 日本語 through `T()`. New UI strings (button label, hints) go into all three. The quotes stay in English, as supplied.
- Sounds are synthesized with WebAudio (`train()`, the crossing bells). The music is a separate audio file. Both keep running.
- Sky view (`html.skyview`, `#sk-view`, controls in `#skyctl`) already hides the UI; the 3D button lives in that control group.

## Approaches considered
1. **Three.js, hand-built procedural scene (chosen).** Everything (sky shader, instanced grass, instanced petals, train, crossing) is code. Small download (Three.js only, roughly 150 KB gzipped), matches the painted look, can be tuned to the 2D palette. Cost: more tuning by eye.
2. **Three.js plus downloaded glTF models.** More realistic, but adds megabytes to a single-file site and depends on finding CC0 models that match an anime look.
3. **PlayCanvas.** Better editor, but needs its own hosted project; does not fit one `index.html`.

The owner described outcomes and left the how to us; option 1 is the builder's call.

## The how, as decided
- **Entry:** a 3D button in `#skyctl`, shown when the Byousoku scene is on screen (search egg or 3 March). *Builder's call — owner may want it always visible.*
- **Exit:** click/tap the 3D letter. *Builder's call:* Esc also exits, as an accessibility safety net.
- **Walking:** WASD/arrow keys + mouse look (pointer lock on click) on desktop; a left-thumb joystick + drag-to-look on touch. Eye height ~1.6 m, walk speed ~1.4 m/s, a soft boundary keeps you within ~60 m of the crossing and off the rails' path while the train runs.
- **Look:** sky as a gradient + cloud shader in the 2D palette (violet top, pink/peach horizon, pale band), distance fog in the same tones, mountain silhouettes, one large cherry tree near the crossing, poles with sagging wires, warm low sun.
- **Grass:** instanced blades with a vertex-shader wind sway, densest near the camera.
- **Petals:** instanced quads that tumble and drift, falling at an unhurried pace (a nod to five centimetres per second), recycled around the player.
- **Train:** a 6-car procedural model following the reference; passes on a loop with ~40–60 s gaps; barrier and lamps animate before and after.
- **Letter:** an envelope/letter mesh on a small stand beside the track near the crossing, with the quote drawn onto a canvas texture; a soft glow and a "tap the letter to return" hint so it is findable.
- **Quality tiers:** phones get fewer grass blades and petals, lower pixel ratio and no shadows; desktop gets more.

## Left to the builder
- Exact geometry, counts, colours and timings, tuned against the 2D scene.
- Three.js version (pin an exact version from a CDN).
- How the 3D canvas layers over the page (it covers the viewport; the 2D canvas pauses while 3D is on).
- Disposal of all GPU resources on exit.

## Done when
- The 3D button appears in the Byousoku scene; pressing it loads 3D without reloading the page.
- You can walk on desktop and on a phone-sized touch screen.
- The train passes, the barrier lowers, bells and train sounds play, and music continues.
- Clicking the letter returns to the normal UI with nothing left running in 3D.
- Screenshots from the 3D scene look like the 2D scene's dusk, and the train reads as the reference's style.
