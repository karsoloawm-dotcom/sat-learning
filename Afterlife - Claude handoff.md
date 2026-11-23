# Afterlife handoff for Claude

This handoff describes the local Afterlife build packaged on November 23, 2026. Use the attached ZIP as the implementation baseline. Extract it as a folder and preserve the relative paths under `assets/`.

## Original and current builds

- [Original Claude artifact](https://claude.ai/artifact/RpAAfV9Ux984ysfG1MF42p) is the original reference link.
- The original file comparison uses `Katawaredoki Vocab.zip`, which contained seven root files and no `assets/` directory. In the current build, `index.html`, `reaper-girl.txt`, and `reaper-girl-v4.txt` differ by content. The four other original files, the two sky scene files and two piano files, match by SHA-256.
- [Current local build](http://127.0.0.1:8765/) opens on the PC hosting the project. For a different computer, serve the extracted folder locally. The artifact link points to the historical version. The latest build travels in the attached ZIP.

## Run the current build

1. Open a terminal in the extracted folder beside `index.html`.
2. Run `python -m http.server 8765 --bind 127.0.0.1`. On Windows, `py` can substitute for `python`.
3. Open [http://127.0.0.1:8765/](http://127.0.0.1:8765/) in a WebGL-capable browser and click **Reap a soul**.
4. Press **K** or choose **Die** for practice scenes, **B** to toggle Blood, and **F** for freecam. The page fetches renderer libraries from a CDN, so the browser needs internet access. The original artifact's hosted music and gallery media are external to this local project. Missing songs may print a warning while the game continues to load.

## What changed

| Area | Current implementation | Where to start |
| --- | --- | --- |
| Graveyard and mansion | Expanded the map north into a walkable mansion with furnished interiors, solid walls, routes and hiding opportunities. Groundskeeper scenes stage in dedicated rooms, including the kitchen and broom workshop. | `assets/mansion/afterlife-mansion.mjs`, `keeper-hunt.mjs`, and the encounter code in `index.html` |
| Night progression and hunts | Added a night objective flow, named clues, encounter triggers, an escape route, and persistent progress. Groundskeeper pursuit considers sight, obstacles, and sound. Existing practice access remains available. | `assets/mansion/afterlife-night.mjs`, `afterlife-encounters.mjs`, `keeper-hunt.mjs` |
| Death scene staging | The original already had the Reaper, Groundskeeper, White Thing and practice replays. The current build includes rewritten staging and effects in existing scenes, as well as new mansion staircase, bell loft, portrait, Hollower, Broom Room Rebirth, and Doll Dealer poker scenes. | `index.html` near the scene implementations and `DMK`, plus `assets/mansion/afterlife-set-pieces.mjs`, `afterlife-hollower.mjs`, `hollower-rebirth.mjs`, and `stair-*.mjs` |
| Doll Dealer | Added a playable poker encounter, redesigned display dolls, animated resolution, and a possessed-doll form that can move using the normal controls. | Search `dPoker`, `possessedDoll`, and `shelfDollLibrary` in `index.html` |
| Hanako | Updated the active rig, retained separate clothing, expanded facial variants, improved the anatomy used by gore scenes, and added breathing, exertion and hair movement. Love Potion affects the meter, appearance, movement and some lines. Mature Mode is a separate setting from Blood. | `assets/hanako/hanako-rig-2.txt`, `faces.mjs`, `anatomy.mjs`, and `index.html` |
| Nagi Mori | Added the rigged NPC, attached facial expressions, separate garments, proportionate skeleton, organs and muscle bundles. Freecam settings isolate the anatomy layers. The bag can collect her remains and let her soul follow Hanako in eligible scenes. Nagi can also lift and comfort Hanako's severed head. | `assets/nagi-mori/afterlife-nagi.mjs`, `nagi-face.mjs`, and `nagi-anatomy.mjs` |
| Nagi's White Thing scene | Added the separate practice replay **The White Thing · Nagi**. Garments drop independently, the hide slides away with the hair and folds, the exposed muscle layer retains the eyes, organs are extracted in groups, and the muscle shell folds. A skeleton remains for the aftermath while the White Thing consumes the soul. Blood off uses a simplified presentation. | `assets/nagi-mori/nagi-white-thing.mjs`, `afterlife-nagi.mjs`, and `startNagiWhiteReplay` in `index.html` |
| Latest launch fix | Versioned the Nagi module imports after a cached older script caused a launch crash on the garment controls. Made the optional appearance controls tolerant of an older actor interface. Verified launch in the in-app browser after the fix. | Search `?v=white-thing` and `nagi.garment?.` in `index.html` |

Kiriko's trial assets are in the source archive for continuity. The current game entry point has no active Kiriko import or playable option.

## Verification and handoff notes

- The latest Nagi replay was tested through the normal practice menu with Blood on and off, a full playthrough, and cancellation using Esc and K. It restored the NPC and player view and left the death counter alone.
- The in-app browser launch was rechecked after fixing the cached-script crash. The other scenes have not all been retested for this handoff.
- The older `Afterlife - game design and build plan.md` and `Afterlife death scene review.md` are included as context. Check the current implementation before treating a planned feature or older issue as current.
- For a new edit, follow the existing Three.js scene and the modular files above. Keep practice sequences isolated from live progression and preserve Blood-off behavior. When updating a module's interface, update its import revision in the page too.
