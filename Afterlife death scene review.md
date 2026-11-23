# Afterlife death scenes — release review

This review covers all 23 encounters listed in the current **Die on purpose** menu and the two NPC deaths in the graveyard. Fourteen player encounters can be replayed, nine are locked, and the NPC deaths occur in live play. The opening “You reaped a soul” transition is the setup for Afterlife.

**Evidence.** This is a review of the current scene code, triggers, animation, cameras, and aftermath. **Confirmed** means the behavior follows from the current implementation. **Check** identifies a visual, audio, or gameplay risk to reproduce before release. This review did not include a fresh, full visual playthrough of all scenes. Kiriko’s separation and Death’s return to chase were verified in the preceding implementation pass.

## Death and Hanako

| Scene | Availability | What happens and what works | Rough edges |
| --- | --- | --- | --- |
| **Scythe** | Locked | A quick swing drops Hanako into a ragdoll and returns control to her soul. It would make a clear baseline for Death’s longer encounters. | **Confirmed:** The current catch pool excludes the basic swing and the replay button is locked. The death text describes a strike through the body, while the effect calls for a neck bleed. **Check:** Blade placement, hit sound, and the first ragdoll frame should agree on where she was hit. |
| **Scythe beheading (held down)** | Replay and post-tug encounter | Death holds Hanako in place, winds up, then separates the head in a quick strike followed by a soul view and her line about the lantern and her shoes. The pause gives the swipe a readable beat. | **Check:** The victim uses a slowed idle during the restraint. Watch the hands, shoulders, and blade path for sliding or a gap at contact. Verify that the temporary slow motion recovers and that the head is visible from the actual play camera. |
| **Head rip, with the spine** | Replay and post-tug encounter | A side camera follows the reach, lift, staged pulls, and separation. Hanako’s weakening reaction, Death’s inspection, and the discard give it a beginning, climax, and aftermath. | **Confirmed:** It reuses the struggle loop during multiple beats and switches back and forth between two facial poses. **Check:** Repeated motion and neck scaling can read as rubbery up close. Inspect the hand-to-head contact, shoulder silhouette, and camera clearance beside graves. |
| **Tug of war for your soul** | Replay and progression encounter | F presses or touch taps pull Hanako’s visible soul back toward her body. Winning lets her escape during Death’s stagger in live play. Losing leaves a recoverable body. It puts a decision in the player’s hands during a death encounter. | **Confirmed:** Normal play retries after a loss at the same progression point. The later scythe/rip branch depends on a win. **Check:** The meter, translucent body, and tether should communicate the same progress under night lighting. Test touch taps, rapid keyboard input, and both replay outcomes. The loss cuts quickly from the visible soul to normal ghost control. |

## Demons, the tree, and the Doll Dealer

| Scene | Availability | What happens and what works | Rough edges |
| --- | --- | --- | --- |
| **Two demons — torn in half** | Replay and random catch | Opposing demons pull Hanako apart at the waist. The upper half tries to crawl, giving the scene a distinct final image after the initial impact. | **Check:** Both grips and the split seam must agree through the pull. The crawl switches to a custom pose after resetting the animation, so watch for a limb snap, hands skating, or the torso floating through uneven terrain. |
| **The skinning demon** | Replay and random catch | The demon holds Hanako, removes clothing in its own beat, and peels in stages. The dedicated held pose and separation timing give the scene more character than a single looping struggle. The removed skin takes on a looser shape. | **Check:** Watch for a garment clipping through the hand, pose intersections at the chest, or a visible swap from the posed body to the peel mesh. The empty skin needs a convincing change in weight and silhouette from the player’s camera. Verify which details remain visible with Blood off. |
| **The heart pull** | Replay and random catch | A focused attack culminates in a heart that continues beating in the demon’s hand. The pulse and Hanako’s reaction give the reveal a clean focal point. | **Check:** An open gap at hand-to-chest contact or a visible jump into the hand would make the reveal feel like a prop swap. Check the handoff, the beat sound against the pulse, and whether the dark scene hides the silhouette. |
| **The hanging tree** | Replay and random catch | The threat starts in the landscape. The tree rises, lifts Hanako, and leaves a body that draws the crows. Movement in the tree, rope, victim, and birds gives the aftermath a defined silhouette. | **Check:** Inspect the rope attachment during the yank and later sway, especially from the side. Verify that the tree fits the location, the camera shows both rope and victim on a phone, and the birds leave the final pose legible. |
| **The Doll Dealer** | Replay and random catch | A playable poker round with card handling, animated reactions, talking cabinet dolls, and an interactive doll. Winning has a relief and exit beat. On loss, the soul enters the doll, Hanako’s body compresses into a chip, and the doll can be controlled afterward. It has the most distinct outcome and aftermath. | **Check:** The full loss takes time after the result. Watch whether body compression reads as weight and resistance or as shrinking geometry. Verify the win handoff for the reported T-pose, card and finger contact, the loss-to-doll movement handoff, and panel focus on touch. Check that a win returns control as Death reappears in live play. |

## The Groundskeeper

| Scene | Availability | What happens and what works | Rough edges |
| --- | --- | --- | --- |
| **Groundskeeper (standard)** | Replay and stalker catch | A staged machete attack, a pause over the body, then a time cut to his worktable. The pause and matter-of-fact dialogue make the attacker recognizable across variants. | **Confirmed:** The interval between the last strike and blackout runs about five seconds. **Check:** It can feel like a stalled animation if his gaze, the blade withdrawal, and breathing are hard to see. Verify blade contact and the swap from the ragdoll to the table model. |
| **Groundskeeper’s kitchen** | Replay and stalker catch | He pulls Hanako’s soul out, followed by a kitchen scene. The second location gives the attack a distinct payoff and lets the soul and body carry different parts of the story. | **Check:** The opening may read like Death’s soul tug unless the audience can see what the Groundskeeper is doing differently. Follow where the soul goes across the time cut and verify that the kitchen payoff reads without subtitles. |
| **Groundskeeper’s broom** | Replay and stalker catch | An axe attack leads to a workshop reveal where Hanako’s hair becomes a broom. The distinctive prop connects the incident to the time jump. | **Confirmed:** This is the only replay with a dedicated Skip action. **Check:** Watch the axe contact and the transfer from recognizable hair to the finished broom. Trigger Skip during the transition and workshop, then verify that the blackout, dialogue, and camera all reset. |
| **Groundskeeper’s gallows** | Replay and stalker catch | The graveyard encounter leads to an execution at dawn. Daybreak, deliberate preparation, and the gallows silhouette contrast with the supernatural hanging tree. | **Check:** The wide framing can hide details on a portrait screen. Inspect the rope at the transition from support to suspension and make sure the dawn cut communicates a new scene promptly. |
| **Groundskeeper’s trophy** | Replay and stalker catch | A neck snap leads into a taxidermy workshop and shelf display. The collector motive pays off visually and ties the attack to his desire to preserve the hide. | **Check:** The snap is brief and may read as a pose jump unless the hold, reaction, and release land together. The nighttime workshop needs enough separation between the shelf, props, and final silhouette. Verify both Blood settings before starting the scene and how a setting change mid-scene behaves. |

## The White Thing

| Scene | Availability | What happens and what works | Rough edges |
| --- | --- | --- | --- |
| **The white thing (biology lesson)** | Replay and graveyard stalker | The White Thing separates Hanako into layers, folds the peeled skin, displays body parts with study interactions, and eventually takes the soul. The recognizable hair, continuing reactions, and clickable parts make this a distinctive game scene. | **Check:** The long transition from horror scene to lesson can feel stalled if the zoom, part labels, and **Let her go** action lack a clear order. Inspect hair and facial openings through the fold, layering and clipping during separation, selection of small parts on a phone, and whether Hanako’s last line can be read before release. |

## Locked encounters with scene code

| Scene | What happens and what works | Rough edges |
| --- | --- | --- |
| **Crows** | Standing still lets a flock land around Hanako. The flock lifts her soul away and leaves a body to recover. The gathering birds make a readable warning. | **Confirmed:** The stationary attack explicitly requires the unlocked flag. **Check:** Make sure moving is enough to break the warning state and that the flock, rising camera, and body location clearly explain the outcome. |
| **Hungry lantern** | A selected lantern’s flame leaps out and traps the soul. The player looks up and floats out, giving the aftermath its own small escape. | **Confirmed:** Normal revival does not seed a hungry lantern while it is locked. **Check:** The escape depends on looking and moving upward. Check whether players can read the cue after the jump, particularly using touch. |
| **The well** | The well pulls Hanako in headfirst, using the darkness and sound below the opening to sell the result. It turns an ordinary location into a threat. | **Confirmed:** A nearby player can see the lure text even though the death trigger is gated. This creates a misleading interaction prompt in the current build. **Check:** If enabled, watch for clipping around the rim and whether the camera sells the pull before the model disappears. |
| **The imps** | Multiple small attackers carry Hanako away piece by piece and leave clothing behind. The group behavior gives it a different tone from the single-attacker scenes. | **Confirmed:** It has a handler and a locked menu entry, with no normal start found in the current encounter routing. **Check:** Parts and clothing should stay visually associated with the imps during each handoff. The viewer needs time to register one action before the next. |
| **Puppet** | A hand controls Hanako through strings, makes her dance, lifts her, and cuts the strings. The forced dance is a strong visual premise before the fall. | **Confirmed:** It has a handler and locked menu entry, with no live trigger found. **Check:** String contact points and limb timing must match throughout the dance, and the camera should capture the hand and landing. |
| **Buried alive** | A lullaby leads Hanako into a grave. She wakes during the burial, and the bell gives the aftermath a recognizable image. | **Confirmed:** It has a handler and locked menu entry, with no live trigger found. **Check:** The scene needs enough readable movement from trance to panic. Test dirt occlusion and ensure the bell reads on small screens or at low audio volume. |
| **Petrification** | Looking at a statue leads to a gradual transformation and shattering. The change in material carries the tension before the impact. | **Confirmed:** It has a handler and locked menu entry, with no live trigger found. **Check:** If shipped with a gaze trigger, communicate when the player can still look away. Inspect the progression into stone and the swap to fragments. |
| **Moths** | Moths emerge and consume Hanako in stages, eventually leaving bones. Their motion and the gradual reveal give the scene a visual identity. | **Confirmed:** It has a handler and locked menu entry, with no live trigger found. **Check:** Balance swarm density against visibility and frame rate. Inspect when clothes, body, and skeleton change visibility so the swarm appears to cause each change. |

## NPC deaths

| Scene | What happens and what works | Rough edges |
| --- | --- | --- |
| **Nagi Mori — scythe beheading** | Death can target Nagi when he has line of sight and she is closer than the living player. There is a warning, a scythe strike, a separate head, a staggered collapse with twitching, and a soul that rises afterward. The sequence gives a passing NPC a story that continues after death. | **Check:** Reproduce the previously reported disappearance during a Hanako death scene. The current NPC update continues during those scenes and quiets dialogue, so inspect camera framing, occlusion, and body and soul visibility before and after the scene. Also check the warning face under cemetery lighting and the blade-to-neck contact. |
| **Kiriko — head rip** | Death can choose Kiriko by sight and proximity. She braces, lifts, and collapses as Death pulls away her head. Her face, hair, and headpiece stay together. The scene uses the same neck wound geometry as Nagi and honors the Blood setting. | **Confirmed:** There is no NPC replay command, dedicated shot, or soul aftermath for Kiriko. **Check:** From the player’s real viewing position, watch for arms stretching to reach, hands sliding, a dead frame between the grip and separation, or the head settling above or inside the ground. Hanako’s head rip has a longer buildup and a distinct spine beat. Kiriko’s shorter grab currently needs to read clearly from a distance. |

## Release priorities

1. **Fix what players can actually reach.** Resolve the well lure with a locked trigger. Decide whether the locked entries should stay visible in the release menu. Make the difference between practice, a recoverable loss, and a final death clear.
2. **Check contact before adding effects.** Start with Death’s scythe and the NPC head rip, then the two-demon pull, skin and garment handoffs, and both rope scenes. Watch each at normal speed from the player’s view, then inspect the contact frame.
3. **Test the return to control.** Run poker win and loss, tug win and loss, the White Thing’s release, and the broom’s Skip action. Verify camera, input, audio, and the casket or playable doll afterward. Repeat a different death immediately to catch state leaking between scenes.
4. **Run a phone and settings pass.** Prioritize the poker panel, the White Thing’s part selection, the gallows framing, and tug timing. Check Blood, reduced motion, and Killer chase, especially where an NPC is still a valid target while the live player is protected.

## Source map

- [Death’s progression and attack routing](index.html#L13059)
- [Scripted death dispatch](index.html#L13658)
- [Doll Dealer choreography](index.html#L14953)
- [Groundskeeper variant triggers](index.html#L15679)
- [White Thing sequence](index.html#L17105)
- [Replay menu and locked entries](index.html#L17226)
- [Nagi’s targeting and collapse](assets/nagi-mori/afterlife-nagi.mjs#L272)
- [Kiriko’s grab, separation, and fall](assets/kiriko/afterlife-kiriko.mjs#L41)
