# Afterlife • Game design and implementation handoff

**For Sol 6.2.** Build one playable night around Hanako. The player explores a graveyard and an occupied mansion, learns what draws each presence, and tries to bring a name back to the casket before dawn. Deaths should tell the player something about the place, the killer, or the route they chose. The first milestone is one excellent chase that a new player can understand and survive.

## 1. Starting point and boundaries

Source inspection on 20 November 2026 found the following integration points. Search by symbol in the checkout because line numbers move.

| Owning source | What Sol should reuse |
|---|---|
| `index.html` | Reap a soul entry, existing player and camera, Model Lab, `loadGirl`, `makeGirl`, soul and ragdoll helpers, encounter dispatcher, `practice`, `OPEN`, `DMK`, `countDeath`, settings, translated controls and touch UI. Keep the rest of the vocabulary site outside this change. |
| `assets/mansion/afterlife-mansion.mjs` | Existing north mansion, workrooms and staircase. Build sight blockers, patrol nodes, escape routes and scene anchors against the actual geometry. |
| `assets/mansion/stair-performance.mjs`, `stair-sound.mjs` | Reference for a scene-specific performance and timed sound. Impact is at 1.64 s, twitch ends three seconds later, performance ends at 5.85 s. Preserve the settled body and Blood toggle through the camera handoff. |
| `Hanako - game rig.blend`, `reaper-girl.txt` | Candidate authoring file and confirmed default runtime payload. The packed header has 20 bones, three draw groups, clothing metadata and six clips: float, drift, idle, run, struggle, lie. Compare the Blender file with the decoded runtime mesh before editing. The active Lab default is v3. Leave the v4 base out of production work. |
| `assets/nagi-mori/afterlife-nagi.mjs` | Existing bystander, model, targeting and aftermath. Its creation site passes graves and sight trees as occluders. Include mansion occlusion when a sight line crosses the mansion. Keep Kiriko out of the game. |

The current practice catalog has **15 open entries** and **nine locked entries**. The older death review is background, not the shipping inventory. Everything below concerning objectives, chase rules, numerical tuning, new endings or new deaths is a proposed design. Capture today's live and practice behavior before changing it.

## 2. One complete night

| Beat | Player action | What changes |
|---|---|---|
| Wake at the casket | Read the blank brass nameplate. A rubbing shows three missing fields. Walk past a lit gate while Death crosses the path beyond it. | Teach camera, movement and a sight break before any lethal pursuit. The casket remains recognizable from the main path. |
| Find the surname | Read two grave inscriptions and choose the one matching the crest on the rubbing. | Ink fills the first field. Disturbing the marked grave draws Death; a mausoleum corner and a longer yew route both lead out. |
| Find the house number | Enter through the north gate. Compare the service register in the kitchen with a number carved under a workbench. | The Groundskeeper starts his rounds. Unbar the service door from inside to connect the kitchen to the yard. The player can leave between clues. |
| Find the witness | Listen to the cabinet dolls. One completes a line from the register. The Dealer offers a quicker poker route; patient listening provides a second way to identify the witness. | The third field fills. A possessed doll can reach the register through a low service opening and continue the objective. |
| Return the name | Carry the completed rubbing back by the service yard or front gallery and choose whether to read the name aloud. | Reading it frees the witness; sealing it in the casket keeps the house quiet and the cabinet occupied. Give both endings a short authored image and a return to free practice. |

Target first clear: 20–30 minutes, measured in playtests. Use the existing five-death progression for live consequences. Route the fifth counted death through the current ending flow; add a **Restart night** choice there. Practice never consumes a life or grants clue progress. Preserve secured clues across a recoverable death. On return from an existing soul recovery, resume at the last safe objective state. Add a versioned night save at safe transitions only. Save clues, shortcuts and counted live consequences together; reconstruct patrols at safe anchors on load. Test reloads during poker, a pending capture and the fifth death for duplicate counting.

## 3. Build a map the player can reason about

Use this as a connection diagram. Fit routes to the current mansion footprint after walking it.

    Casket ── grave rows ── mausoleum ── north gate ── front gallery
       └──── yew path ───── service yard ── kitchen ────────┘
                                 │            │
                             broom shop ── leather shop ── rear hall
                                                           ├─ trophy room / cabinet
                                                           ├─ gallows hall
                                                           └─ trapped stairs / optional bell loft

Make the graveyard legible by the casket lantern, the mansion by its tower, and the service exit by a faded blue door. Give every mandatory clue room two usable escape choices by the time it can start a hunt. A closet plus one doorway is insufficient if the killer watched Hanako enter. Walk both exits at ordinary speed in both directions. Split long corridors with real corners or opaque furniture taller than Hanako’s shoulders. Give each room a walkable boundary, portal, floor height, authored capture spot and survivor exit. The Groundskeeper carries a capture into the appropriate existing room through a motivated cut; save the original capture position separately for recovery.

## 4. A hunt with evidence and an escape

Implement one shared perception layer and one director. Each hunter supplies its senses and habits. Keep Death’s current progression and the Groundskeeper’s existing scene routes as the capture destinations. Replace conflicting random capture rolls only after the corresponding live trigger passes its tests.

1. **Patrol.** Follow authored reachable points. Select one active lethal pursuit at a time. A second presence may make a distant warning, but reserves no capture until the first releases it. Disable live player targeting during practice, menus that pause simulation, soul recovery and the post-revival grace period.
2. **Notice.** Sample sight at an initial 8 Hz. Test distance and horizontal cone first, then trace from eye height to Hanako’s chest and head against solid room geometry. A high wall that blocks both samples breaks sight. A low marker hiding only her knees does not. Use the actual open angle of a door. Tag thin lace, ghosts, effects, and glass deliberately. Prevent detection between stacked floors through the ceiling. Show suspicion by the hunter turning or a blade stopping; pair sound with a visible cue.
3. **Investigate.** Footsteps publish a position, room and loudness. Start with walking audible within 4 m and running within 9 m in the same open room. Closed doors attenuate sound to the next room. A hunter goes to where it heard the sound. It gets new information only from fresh evidence.
4. **Hunt.** Start after continuous visible exposure, initially 0.9 s for Death and 1.2 s for the Keeper. Give a recognizable commitment animation. Use reachable room portals for movement. At a corner, keep only the last seen position and direction. Capture requires current visibility, reach, a clear path, and a short readable windup at its final check. Breaking contact before commitment cancels it.
5. **Search.** After sight breaks, move to the last seen point, check at most two plausible exits, then return to patrol after approximately 6 s without renewed evidence. Entering a wardrobe unseen works; entering in full view lets the hunter inspect that wardrobe after a warning. A wardrobe has a manual exit throughout the warning. Shadows lower detection speed; an opaque wall fully blocks sight. Expose the same hide, leave and quiet-move actions on keyboard and touch.
6. **Release.** Begin with 10 s of grace after a successful escape and 12 s after revival. Spawn the hunter beyond sight and off the recovery route. Freeze hunt clocks when the game is paused. Drive movement and detection by elapsed simulation time so a phone at 30 fps affords the same escape window as a desktop.

**Fairness target.** On the first greybox route, a player who notices the warning late should still reach solid cover at ordinary movement speed. Measure time from cue to first possible capture against time from that spot to cover, and require at least 0.75 s spare on the teaching route. Start Death slightly slower than a sustained player run. If a straight sprint wins every pursuit, improve route choices and search behavior before raising hunter speed. Log transitions, evidence, room and capture cause in a local development overlay. Never expose the live player's hidden coordinates to the search routine.

## 5. Trigger and survival catalog

These are the proposed live rules. Practice launches the existing scene directly. Stationary hazards and voluntary encounters retain their own rules instead of borrowing a roaming hunter's chase.

| Presence / location | What triggers it and how the warning reads | How Hanako survives; what a failure selects |
|---|---|---|
| Death • graves and gate | Disturb the marked inscription or cross his patrol in view. He stops, turns his hood, then raises his free hand. | Turn behind the mausoleum, take a second corner and leave quietly. On a close catch preserve the existing soul tug and its progression into held scythe or head rip. A tug win creates a real stagger window. Offer hold-to-resist alongside repeated F/tap. |
| Groundskeeper • mansion | Open the service register during rounds, run on the boards near him, or cross his view. His work rhythm stops; keys sound at the actual approaching door. | Walk away from the noise point and circle through the adjoining shop, or hide unseen. His home patrol stays inside. Select leather/standard, kitchen, broom, gallows or trophy aftermath from the nearest eligible room at capture. Show that room's motif before the cut. |
| Twin demons • paired grave markers | Cross between two answering lanterns while both shadows are visible. Each shadow takes a distinct side. | Back out of the gap before they meet or use a stone screen to break one sight line. A successful pincer dispatches `d_half`; either demon alone cannot claim the catch. |
| Skinning demon • abandoned laundry | Disturb a hanging sheet. Its moving silhouette advances through two rows of cloth. | Leave by the side opening or put a solid partition between the figures. Loose cloth flickers and conceals only briefly. Capture dispatches `d_skin`; the released skin and clothing keep separate ownership through the transition. |
| Heart demon • memorial alcove | Hold the red votive past its first pulse. A second pulse answers from the arch. | Set it down or step behind the stone divider before the answering pulse completes. Failure dispatches `d_heart`. A visual ring duplicates the beat for muted play. |
| Hanging tree • old yew | Stay inside the moving root-shadow after the leaves fall silent. An overhead branch shadow crosses the ground. | Step sideways out of the marked ground before the shadow closes. Keep the perimeter route wide enough for touch steering. Failure dispatches `d_hang`. |
| White Thing • study | Disturb the covered specimen. A reflected white outline crosses one doorway at a time. | Shut a solid door, move to the alternate exit and avoid its next sight sweep. Capture starts `parts`. Keep the study interactions and Let her go exit reachable with touch. |
| Doll Dealer • cabinet | Sit and explicitly accept the stake. The dolls explain the loss before the deal. | Decline freely, use the witness-listening route, or win the hand. Preserve poker actions and a clean win-to-idle blend. A loss runs `d_poker` and hands movement to the possessed doll. Give doll form a marked route back to recovery. |
| Staircase • rear hall | Step on the existing loose tread. Use the existing click and visible movement. | Add a visible worn path around the tread before enabling live trigger changes. Crossing the safe edge must succeed using normal controls. Failure runs `stairSpike`, with its persistent aftermath. |

**Locked catalog.** Leave these locked until each telegraph and escape has a demonstrated live route. Enable one at a time.

| Entry | Proposed trigger → escape |
|---|---|
| Basic scythe | A later Death patrol gives a broad sweep cue → retreat beyond reach during the windup. |
| Crows | Remain beneath a gathering flock → leave the perch shadow before the last bird lands. |
| Hungry lantern | Inspect a lantern whose flame leans toward Hanako → release inspection and back away while it flares. |
| Well | Answer the echo twice → step away from the rim after the first reply. Hide the lure while locked. |
| Imps | Pick up a jingling charm → drop it where they can collect it, then leave the ring. |
| Puppet | Stand below visible descending strings → cross the lit gap before they tighten. |
| Buried alive | Follow the lullaby into the open grave → turn back at the bell; pause the lure during dialogue. |
| Petrification | Hold the statue in view as stone creeps inward from the screen edge → look away to drain the buildup. |
| Moths | Carry the glowing lamp through the swarm → shutter it and walk out along the reflective floor markers. |

Nagi remains a bystander. Keep Death's existing nearer-visible-target behavior when no capture owns the actor. Once a capture commits, keep its victim and camera consistent. Test a hidden Hanako with visible Nagi, visible Hanako with hidden Nagi, and both visible at nearly equal distances. Keep Killer chase off useful for sightseeing; practice always works. Explicitly opt into voluntary stakes and marked hazards in sightseeing mode.

## 6. Death direction and two additions

Use a common sequence of warning, commitment, contact, follow-through, settled aftermath, then handoff. Give each scene a named owner for actor visibility, camera, sound, dialogue, remains and cleanup. Sample world-space contact on the last intact pose. Attach blood, fragments and garments to that sampled pose or to the receiving surface. Give Blood off a complete silhouette, contact sound, and ending. Use lowered camera motion and fewer airborne effects for reduced motion. Keep ambient lines paused during the performance, allow Hanako's own line to finish, and restore dialogue on interrupt. Never count the same death both at impact and at handoff.

**New • The bell tolls twice.** Optional bell loft beyond the safe stair route. The first chime brings Hanako's shadow upright while she stands still. The second leaves a brief opening to retreat over the threshold. If she stays, the spectral bell passes through her upper body. Show a fracture through the reflected silhouette, a broken-away section of the rib cage and a fan of blood on the bell's inner surface. The bell swings back with the stain rotating on it; the body settles below, one hand still curled around the name rubbing. Hold the wide shot through the last vibration. Blood off shows the cracked reflection and escaping soul. Hanako: “I heard the second one from downstairs.” Build after the rib cage upgrade. The effect is supernatural and needs no physical trap simulation.

**New • The portrait keeps its sitter.** Optional trophy-room portrait. Matching Hanako's pose to the painted figure wakes it. Its painted eyes look at the door first; she can turn the canvas away or leave its line of sight while her reflection lags behind. On failure the portrait takes her outline in three strokes. Her body falls out of the frame as a hollow shell, while a bloodied handprint stays on the inside of the glass. The painted Hanako slowly opens one eye after the real one is still. Blood off uses flaking pigment, the empty sleeve and the moving painted eye. Hanako: “That handprint is on the wrong side.” Reuse the skin-shell and face controls; art-direct the collapse into folds. The portrait owns its remains until replay, exit or restart.

Prioritize existing scenes before those additions. For head rip, author a single escape step, lost footing and asymmetric recovery, then one readable pull; connect the revealed spine to the last intact pose. For the held scythe, plant the supporting foot and brace the shoulder, clear the face with the shaft during anticipation, and let the braced side release first. For the staircase, retain the present three-second taper to limp; verify spray lands on the actual wall, risers and floor. For poker, sample the win-to-idle handoff and the loss-to-doll handoff. For the White Thing, keep hair rooted to its detachable shell and face openings legible through the fold. Get these performances readable at normal speed before increasing particle density.

## 7. Hanako • art, animation rig and visible anatomy

**Start with a compatibility specimen.** Decode the active payload and record bone names, bind matrices, hierarchy, vertex and index counts, material groups, garment selections, shape settings, clips and atlas layout. Render front, profile, back and three-quarter views in neutral light and under the mansion lights. Save a clothed idle and a staircase contact frame beside the Blender reference. Compare scale, handedness, garment seams and bone axes. Keep an original export for a side-by-side switch in development.

| Pass | Authoring work | Acceptance shot |
|---|---|---|
| Silhouette and clothing | Preserve Hanako's face, proportions and purple hair. Refine eyelids, lips, ear rim, knuckles, ankle and shoe profile where visible. Give collar, cuffs and hems thickness. Fit cloth over the same deformation cage as the body. Maintain removable garment identity from authoring through export; preserve existing Lab controls and old saves. | Idle, full stride, high step, torso twist and sideways fall. Toggle each garment on its own, then repeat on the posed model. Watch heels, inner sleeve and waist seam at normal camera distance. |
| Deformation skeleton | Retain all 20 legacy names and their animation meaning. Add optional forearm twist, thigh twist, toe roll, jaw, eye aim, grouped finger controls and short hair chains where each improves a shot. Keep authoring IK separate from exported deform bones. Maintain four normalized influences per vertex where the loader expects four. Version the packed clip stride and map legacy tracks by bone name. New bones use bind-local defaults on old clips. | Compare old and new rigs playing all six original clips; verify planted hands, left/right shoes, head socket, soul overlay and ragdoll handoff. In particular inspect the stair-specific foot-weight correction before enabling it on the upgraded rig. |
| Visible skeleton | Sculpt a coherent skull and mandible, stacked vertebrae with a continuous neck silhouette, a tapered rib cage with sternum, paired clavicles and scapulae, pelvis, distinct forearm and lower-leg bones, and simplified hands and feet. Match bone endpoints to the rig in bind pose. Give the skull, spine, rib cage and pelvis independent render sections. Build compatible cut faces for the neck and waist. Author fixed sockets for the head, inner neck, spine tip and heart. | Overlay skin and skeleton in a turntable, then scrub head rip, waist split and White Thing separation. There must be one visible set of ribs, no floating jaw and no gap between neck and spine at the handoff. |
| Surface and interiors | Use restrained skin roughness variation, soft joint color, hair highlights and fabric weave only at the distances where they read. Keep skin tone and body hair settings independent of lighting. Reuse existing organ assets and align them to the upgraded cage. Build authored inner and outer surfaces for exposed sections, with a warmer inner surface on the skin shell. | Check each skin variant in graveyard blue and kitchen amber. With Blood off, verify hidden inner layers from front, side and below. With Blood on, check depth ordering and shadows during separation and folding. |
| Performance | Blend breathing, blink and small gaze shifts over locomotion. Lead starts with weight transfer, plant the outside foot for turns, and recover over a planted step on stop. Hair gets damped follow-through and a reset after teleports. Use eyes, brows, lids and mouth together for recognition, fear, impact and exhaustion. Add scene-specific held, braced and released poses. | Record start–turn–stop, hide entry/exit, an exhausted idle and a death-to-soul transition. Check for foot sliding, repeated symmetric struggle, fixed stares, hair lag after a cut and bind-pose flashes. |

Keep high-detail internal anatomy unloaded or hidden during exploration. Use shared materials, pooled effects and a cheaper distant hair silhouette. Measure the current frame time and draw calls on the same camera route before setting budgets. Initial shipping targets are stable 30 fps on a representative phone and 60 fps on a representative desktop. If a scene misses budget, reduce offscreen internal draws, shadow casters and spray density before sacrificing readable contact poses.

## 8. Build order for Sol 6.2

Deliver each row as an independently playable change. Keep the local game launchable at every handoff.

| Order | Deliverable and dependencies | Gate before advancing |
|---|---|---|
| 0 • Baseline | Run Reap a soul, live recovery, a practice replay, poker win/loss and staircase twice. Record the starting rig/scene inventory and settings. | Save representative frames, counter values, frame times and current bugs. Trace actual state ownership and current movement bindings. |
| 1 • One fair hunt | Service register → Keeper notice → kitchen pursuit → sight break → search → escape or existing kitchen capture. Implement room blockers, two exits, director ownership and local debugging. Use existing Hanako. | A new player can describe what alerted him and escape twice using different exits. Closing a solid door in his face breaks visual tracking. No capture through walls or between floors. |
| 2 • One complete night | Add clue state, safe checkpoints, service shortcut, witness, casket choices and ending. Connect possessed-doll recovery. | Finish once without a death, once after a recoverable loss, and once using the doll. Reload each checkpoint. No clue or counter changes in practice. |
| 3 • Remaining open encounters | Route Death, demons, tree, Dealer and White Thing to their proposed triggers. Route all Keeper scenes to mansion rooms. Keep the staircase optional. | Demonstrate a warning, a successful escape and the intended failure for each applicable row. Test voluntary refusal and both poker/tug outcomes. |
| 4 • Rig and visible skeleton | Build a versioned export alongside the current asset. Upgrade clothing, face and anatomy in passes. Move to default only after parity. | Old saves load; comparisons in section 7 pass. All 15 open practice entries can complete and replay with the upgraded model. |
| 5 • Performance and new deaths | Polish head rip, scythe and existing handoffs. Ship bell loft first; add portrait after shell and facial checks. | Blood on/off, reduced motion, interruption and persisted remains pass for each scene. Capture actual gameplay frames of warning, contact and aftermath. |
| 6 • Release candidate | Test the whole night and tune from survivor evidence. Revisit the nine locked scenes individually; a finished release may keep them locked. | Keyboard and touch routes pass, no duplicate counters or stranded souls, no stale camera or sound after exits, and a complete repeatable ending. |

## 9. Verification and build prompt

For every hunter run a visible crossing, unseen turn behind cover, noisy diversion while hidden, witnessed hide entry, closed-door crossing and interrupted capture. For every changed death use **Reap a soul → Die on purpose** in the running browser, both Blood settings, two consecutive runs, and Wake up or Esc during anticipation and aftermath. Walk away from persistent remains and return. Confirm garments, scene-owned effects, controls, camera, ambient dialogue, death counter and replay menu after cleanup. Test the same endpoint once through live play; practice bypasses the hunt and cannot validate survivability.

For tuning, have five unfamiliar players try the Keeper route without spoken coaching. Record where each first understood the cue, chose cover, lost sight, or was caught. Aim for four of five to identify the cue and three of five to escape by their second encounter. With small samples, inspect each failure individually. A player who reached opaque cover and still died is a perception or capture bug. A player who never saw a door is a framing or navigation issue. Fix the cause before tuning speed.

**Paste into Sol 6.2 to start**

> Read “Afterlife - game design and build plan.md” in the katawaredoki project. Implement milestones 0 and 1 only. Use the current Reap a soul entry, existing controller, current Hanako asset and kitchen capture. Start with a browser baseline. Build the register-triggered Groundskeeper hunt, two real escape routes, sight and sound evidence, and the last-seen search. Preserve Killer chase off, practice, soul recovery, Blood settings and the vocabulary site. Verify two escapes and one live capture, then replay the kitchen scene twice and interrupt it once. Report changed files, controls, measured cue-to-cover margin, browser observations and anything unverified. Stop after the milestone gate so I can play it.
