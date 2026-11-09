// Self-check for the Byousoku 3D mode. Run: node tests/byo3d.check.mjs [path/to/site-dir] [screenshot-dir]
// The site dir holds the unzipped index.html. Set THREE_MODULE=/path/to/three.module.min.js to serve Three.js locally
// instead of from jsDelivr (for sandboxes without CDN access).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const dir = path.resolve(process.argv[2] || ".");
const shots = path.resolve(process.argv[3] || ".");
const server = http.createServer((q, r) => {
  const f = path.join(dir, decodeURIComponent(q.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!f.startsWith(dir) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
  fs.createReadStream(f).pipe(r);
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// software GL is slow: the functional check runs the phone tier
if (!process.env.BYO3D_HI) await page.addInitScript(() => { window.BYO3D_LOW = true; });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text()); });
if (process.env.THREE_MODULE) await page.route(/cdn\.jsdelivr\.net\/npm\/three@/, r => r.fulfill({ path: process.env.THREE_MODULE, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" } }));
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());

await page.goto(url);
await page.waitForFunction(() => window.Byo3D && document.querySelector("#gsearch"));
await page.waitForTimeout(1500);
// The 3D button stays hidden outside the Byousoku scene
assert.equal(await page.locator("#sk-3d").isVisible(), false, "3D button hidden by default");

await page.fill("#gsearch", "5centimeterspersecond");
await page.waitForTimeout(1500);
await page.evaluate(() => Search.enterView());
await page.waitForTimeout(500);
assert.equal(await page.locator("#sk-3d").isVisible(), true, "3D button shows in the Byousoku scene");

await page.click("#sk-3d");
await page.waitForFunction(() => Byo3D.on, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(shots, "byo3d-start.png") });

// The scene renders something that isn't blank
const px = await page.evaluate(() => {
  const r = Byo3D.debug().renderer, gl = r.getContext(), b = new Uint8Array(4 * 64);
  r.render(Byo3D.debug().scene, Byo3D.debug().camera);
  gl.readPixels(0, gl.drawingBufferHeight / 2, 64, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
  return Array.from(b);
});
assert.ok(px.some(v => v > 20), "canvas has rendered pixels");

// Clicks inside 3D don't leave sky view behind; walking moves the camera
const p0 = await page.evaluate(() => Byo3D.debug().pos.toArray());
await page.keyboard.down("w"); await page.waitForTimeout(1200); await page.keyboard.up("w");
const p1 = await page.evaluate(() => Byo3D.debug().pos.toArray());
assert.ok(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > .5, `walked (${p0} -> ${p1})`);
assert.ok(await page.evaluate(() => document.documentElement.classList.contains("skyview")), "still in sky view");

// Look at the letter, screenshot it, then click it to go back
await page.evaluate(() => {
  const d = Byo3D.debug(), L = d.letter.position;
  d.pos.set(L.x + 1.3, 1.6, L.z + 1.6);
});
await page.waitForTimeout(100);
const at = await page.evaluate(() => {
  const d = Byo3D.debug(), p = d.paper.getWorldPosition(d.camera.position.clone());
  d.aim(p.x, p.y, p.z);
  return { quote: d.quote, author: d.author };
});
// software GL is slow: freeze the loop and draw one frame for the screenshot and the click
await page.evaluate(() => { const d = Byo3D.debug(); cancelAnimationFrame(d.raf()); d.step(.016); });
await page.screenshot({ path: path.join(shots, "byo3d-letter.png"), timeout: 120000 });
assert.ok(at.quote.length > 10 && at.author.length > 1, "letter has a quote");

const sc = await page.evaluate(() => {
  const d = Byo3D.debug(), v = d.paper.getWorldPosition(d.camera.position.clone()).project(d.camera);
  return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
});
await page.mouse.click(sc.x, sc.y);
await page.waitForFunction(() => !Byo3D.on, null, { timeout: 5000 });
assert.equal(await page.locator("#byo3d").count(), 0, "3D overlay removed");
assert.equal(await page.evaluate(() => [...document.body.children].some(e => e.inert)), false, "page is interactive again");

// Enter again and leave with Esc (no leaks, no stuck state)
await page.click("#sk-3d");
await page.waitForFunction(() => Byo3D.on, null, { timeout: 30000 });
await page.keyboard.press("Escape");
await page.waitForFunction(() => !Byo3D.on, null, { timeout: 5000 });

// If 3D breaks mid-frame, it must fall back to the normal page (no overlay left, nothing locked)
await page.click("#sk-3d");
await page.waitForFunction(() => Byo3D.on, null, { timeout: 30000 });
await page.evaluate(() => { Byo3D.debug().pos.distanceTo = null; });
await page.waitForFunction(() => !Byo3D.on, null, { timeout: 10000 });
assert.equal(await page.locator("#byo3d").count(), 0, "overlay removed after a 3D failure");
assert.equal(await page.evaluate(() => [...document.body.children].some(e => e.inert)), false, "page unlocked after a 3D failure");
errors.splice(0, errors.length, ...errors.filter(e => !/distanceTo is not a function/.test(e)));

assert.deepEqual(errors, [], "no page errors");
console.log("PASS byo3d", at);
await browser.close(); server.close();
