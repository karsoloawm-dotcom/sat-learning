# Asset pipeline

## What ships today

Every mesh in the repo is generated in code (`render/character`, `render/props.ts`, `render/studio.ts`), and every
sound is synthesised (`audio/instruments`). There are **no third-party asset files**, so there is nothing to license.

## Characters

`render/character/character.ts` builds a Mii-proportioned figure (≈1.15 m, big round head, mitten hands) on a
skeleton whose bones use **Mixamo names**:

```
Hips → Spine → Spine1 → Neck → Head
Spine1 → {Left,Right}Shoulder → {Left,Right}Arm → {Left,Right}ForeArm → {Left,Right}Hand
Hips → {Left,Right}UpLeg → {Left,Right}Leg → {Left,Right}Foot
```

Rig convention: each limb's child joint sits on the bone's local **−Y**; the character faces **+Z**; 1 unit = 1 m.
Body parts are smooth meshes parented to bones; the face (eyes, lids, brows, four mouth shapes, blush) is made of
small meshes placed on the head surface so expressions and blinks cost nothing. Customisation fields live in
`MusicianLook` (`state/types.ts`).

### Swapping in a skinned asset

Because performers only talk to bones by name and use IK, a skinned GLB with Mixamo bone names can replace the
procedural body:

1. Load the GLB, find bones by name, and build the same `bones` record `CharacterRig` exposes.
2. Re-express the rest pose: our IK assumes child joints along −Y; for Mixamo rigs (children along +Y), flip the
   sign in `aimBone` or add a per-bone offset quaternion.
3. Keep the face rig (or map it to morph targets / texture swaps) so moods and blinks still work.
4. Mixamo clips (idle, wave, cheer) can be layered under the procedural performance with an `AnimationMixer`;
   IK runs after the mixer each frame.

## Research: LowPolyCrate (checked 2026-11-25)

Read from <https://lowpolycrate.com/docs>, <https://lowpolycrate.com/docs/api> and <https://lowpolycrate.com/prompt.txt>.

- **What it has**: ~950 low-poly fantasy/medieval assets; animated characters are one skinned mesh on a 30-bone
  **Mixamo-named** humanoid skeleton with 50 in-place clips (Idle, Walk, Wave, Cheer, Talk, Sit_Idle,
  Play_Lute, …), RightHandSocket/LeftHandSocket bones for props. A character creator exports custom characters on
  the same skeleton (heights 0.7–1.5).
- **MCP**: `https://lowpolycrate.com/api/mcp` (streamable HTTP). Search tools work without sign-in
  (`search_assets`, `get_asset`, `list_kits`, …); `get_download_link` needs sign-in or an API key
  (`Authorization: Bearer lpc_…`). We queried it: e.g. `animated-villager-01` (1,864 tris, 1.9 m, free GLB).
- **Licence** (LowPolyCrate Standard License): commercial use and modification allowed, no attribution required,
  but **you may not redistribute the files themselves**, and they may not go into datasets for training generative
  models. The CDN `model_url` links are meant for prototyping, not shipping.
- **Fit for RoomTone**: the characters are realistic-proportion medieval villagers, not Mii-like, and committing
  their files to a public repository would be redistribution. **Decision**: don't bundle them. The Mixamo bone
  naming means a user (or a private build) can import LowPolyCrate characters later via the swap steps above,
  downloaded with their own account; the creator's *Play_Lute* and *Sit_Idle* clips would be useful idle layers.

## Other sources

| Source | Licence | Notes |
| --- | --- | --- |
| Quaternius (quaternius.com) | CC0 | Animated characters and furniture packs; downloads go through Google Drive/itch, so not scriptable from CI. Good candidates: Ultimate Animated Character Pack, furniture/interior packs for M2 rooms. Bundling is allowed. |
| Mixamo | Free with Adobe account; animations can be used in projects but not redistributed as standalone files | Use for idle/emote layers baked into our own GLBs. Requires manual login; cannot be automated here. |
| Rokoko Create | Account required | Mocap clips for performance mode; same redistribution caution as Mixamo. |
| Blender | GPL tool, outputs are yours | Use for building/retopologising a skinned Mii body to replace the rigid parts. |

## Adding assets (process)

1. Check the licence and record it in `public/assets/CREDITS.md` (create it with the first asset): source URL,
   licence, date, modifications.
2. Never commit files whose licence forbids redistribution; load them from the user's own disk instead.
3. Prefer GLB, metres, +Y up, +Z forward, pivot on the floor; run them through `gltf-transform optimize`.
4. Keep material names stable so the look editor can recolour them.
