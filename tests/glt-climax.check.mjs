// Self-check for the Girls' Last Tour egg climax. Run: node tests/glt-climax.check.mjs <site-dir-with-index.html-and-sounds/>
// Starts the egg from the search bar, checks the hardcoded song is the egg's track, seeks it, and checks the scene and the
// Kettenkrad that rides the page follow the song (appear after 63 s, hide again when seeking back before it).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "playwright");
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import assert from "node:assert/strict";
const dir = path.resolve(process.argv[2] || ".");
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split("?")[0]); const f = path.join(dir, u === "/" ? "index.html" : u);
  if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" }); fs.createReadStream(f).pipe(r); }).listen(0);
const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = [];
p.on("pageerror", e => errs.push(String(e)));
await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await p.goto(`http://127.0.0.1:${server.address().port}/`); await p.waitForTimeout(4000);
await p.click("#gsearch"); await p.keyboard.type("girlslasttour"); await p.waitForTimeout(2000);
const st = await p.evaluate(() => ({ slot: EggSound.eggSlot(), t: EggSound.eggAudio() && EggSound.eggAudio().currentTime }));
assert.equal(st.slot, "egg_glt", "the egg plays its own song"); assert.ok(st.t > .5, "the song is playing");
const tv = () => p.evaluate(() => { const e = document.querySelector(".glt-travel"); return e ? +e.style.opacity : 0; });
await p.evaluate(() => { EggSound.eggAudio().currentTime = 61 }); await p.waitForTimeout(4500);
assert.equal(await tv(), 1, "after 63 s the Kettenkrad rides the page");
await p.evaluate(() => EggSound.eggAudio().pause()); const x0 = await p.evaluate(() => document.querySelector(".glt-travel").style.transform);
await p.waitForTimeout(800); assert.equal(await p.evaluate(() => document.querySelector(".glt-travel").style.transform), x0, "pausing the song pauses it");
await p.evaluate(() => { const a = EggSound.eggAudio(); a.currentTime = 50; a.play() }); await p.waitForTimeout(700);
assert.equal(await tv(), 0, "seeking back before the hand-off hides it");
await p.click("#gsearch"); await p.fill("#gsearch", ""); await p.keyboard.type("frieren"); await p.waitForTimeout(800);
assert.notEqual(await p.evaluate(() => EggSound.eggSlot()), "egg_glt", "another egg replaces the song");
assert.deepEqual(errs, [], "no page errors");
console.log("PASS glt-climax"); await b.close(); server.close();
