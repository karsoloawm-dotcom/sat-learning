import { copyFile, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist');

// Public runtime files only. Keep this list in sync with index.html, module
// imports and the scene IDs in assets/dream-lantern/shots.json.
const files = [
  'index.html',
  'byo3d-scene.txt',
  'byo3d-scene-hq.txt',
  'grand-piano.1.txt', // Built-in playable SoundFont, split into two text chunks.
  'grand-piano.2.txt',
  'reaper-girl.txt',
  'reaper-girl-v4.txt',
  'assets/dream-lantern/dream-lantern.mjs',
  'assets/dream-lantern/ink.mjs',
  'assets/dream-lantern/kit.mjs',
  'assets/dream-lantern/lake.glb',
  'assets/dream-lantern/shots.json',
  'assets/dream-lantern/timing.json',
  'assets/dream-lantern/timing.mjs',
  'assets/dream-lantern/transitions.mjs',
  'assets/dream-lantern/scenes/_fallback.mjs',
  'assets/dream-lantern/scenes/_template.mjs',
  'assets/dream-lantern/scenes/city.mjs',
  'assets/dream-lantern/scenes/city/cloud-day.webp',
  'assets/dream-lantern/scenes/city/cloud-night.webp',
  'assets/dream-lantern/scenes/city/lookout.webp',
  'assets/dream-lantern/scenes/cord.mjs',
  'assets/dream-lantern/scenes/lake.mjs',
  'assets/dream-lantern/scenes/lanterns.mjs',
  'assets/dream-lantern/scenes/pages.mjs',
  'assets/dream-lantern/scenes/rail.mjs',
  'assets/dream-lantern/scenes/rooms.mjs',
  'assets/dream-lantern/scenes/shadows.mjs',
  'assets/dream-lantern/scenes/sky.mjs',
  'assets/dream-lantern/scenes/sky/cloud-deck.webp',
  'assets/dream-lantern/scenes/sky/cloud-relief.webp',
  'assets/dream-lantern/scenes/stairs.mjs',
  'assets/hanako/anatomy.mjs',
  'assets/hanako/faces.mjs',
  'assets/hanako/hanako-rig-2.txt',
  'assets/mansion/afterlife-encounters.mjs',
  'assets/mansion/afterlife-hollower.mjs',
  'assets/mansion/afterlife-mansion.mjs',
  'assets/mansion/afterlife-night.mjs',
  'assets/mansion/afterlife-set-pieces.mjs',
  'assets/mansion/bath-death.mjs',
  'assets/mansion/bell-and-portrait.json',
  'assets/mansion/blade-death.mjs',
  'assets/mansion/hollower-feed.mjs',
  'assets/mansion/hollower-head.mjs',
  'assets/mansion/hollower-rebirth.mjs',
  'assets/mansion/hollower-rig.mjs',
  'assets/mansion/hollower-torso.mjs',
  'assets/mansion/keeper-hunt.mjs',
  'assets/mansion/mansion-interior.mjs',
  'assets/mansion/stair-performance.mjs',
  'assets/mansion/stair-sound.mjs',
  'assets/nagi-mori/Nagi Mori.glb',
  'assets/nagi-mori/afterlife-nagi.mjs',
  'assets/nagi-mori/nagi-anatomy.mjs',
  'assets/nagi-mori/nagi-face.mjs',
  'assets/nagi-mori/nagi-white-thing.mjs',
];

// Serve a dedicated page for missing paths.
const notFound = '<!doctype html><meta charset="utf-8"><title>Page not found</title><h1>Page not found</h1>\n';
// Omit the optional train sound and anime voice clip embedded in the source.
const index = (await readFile(join(root, 'index.html'), 'utf8'))
  .replace(/^const (?:TRN_SND|TRN_GLTV)="data:audio\/[^"\r\n]+";\r?\n/gm, '');
const fileCount = files.length + 1;

let bytes = Buffer.byteLength(notFound);
for (const file of files) {
  const stat = await lstat(join(root, file));
  if (!stat.isFile()) throw new Error(`${file} must be a regular file.`);
  const size = file === 'index.html' ? Buffer.byteLength(index) : stat.size;
  bytes += size;
}

await rm(output, { recursive: true, force: true });
for (const file of files) {
  const target = join(output, file);
  await mkdir(dirname(target), { recursive: true });
  if (file === 'index.html') await writeFile(target, index);
  else await copyFile(join(root, file), target);
}
await writeFile(join(output, '404.html'), notFound);

console.log(`Built dist/ with ${fileCount} files (${(bytes / 1024 ** 2).toFixed(2)} MiB).`);
