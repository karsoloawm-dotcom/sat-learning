/* ===== 夢灯籠 Dream Lantern: a music-video easter egg, opened by typing "dream lantern" in the search bar.
   v2 is a shot sequencer. shots.json (written by build_shots.py) lists 93 shots on the song's 178 BPM grid; each shot names
   a scene module (scenes/<id>.mjs) and a setup in it, or two of them side by side. The core loads each module a few seconds
   before it is needed, renders it through the dream-look pipeline (kit.mjs: the module's painted back canvas and its 3D in one
   HDR image, then one post chain: bloom, glow, tilt-shift, rays, grade), lays the module's crisp front canvas on top, draws the
   transitions (transitions.mjs), the titles, letterbox and grain, and disposes modules it will not need soon, so memory stays bounded. A module that is missing or throws is replaced by scenes/_template.mjs for the rest of the run.
   Clock: the song, read from audio.currentTime every frame so it cannot drift. Like the site's other films it comes from the
   Sounds panel (EggSound slot egg_dreamlantern); else assets/local/dream-lantern.* on this machine (gitignored), else a file the
   viewer picks; with none, a silent clock on the same beat map. The opening title is brushed over the site's own Your Name sky
   (Sky.yourname(): the starry twilight with the comet), which keeps drawing underneath for that one shot (DreamLantern.skyThrough).
   Quality follows the site's sky setting: saver/phone, smooth, ultra (richer post). Every image is original.
   Debug: DreamLantern.seek(seconds), DreamLantern.pause(true|false), DreamLantern.state(); DreamLantern.onFrame(layers) runs after
   each rendered frame, while the WebGL layer can still be read (stills). ===== */
import { loadTiming, frameAt, lastIdx } from "./timing.mjs";
import * as TR from "./transitions.mjs";
import { createPipeline, createKit, lookFor } from "./kit.mjs";
const BASE = new URL("./", import.meta.url).href;
const JSM = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/";
const TAU = Math.PI * 2;
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), mix = (a, b, k) => a + (b - a) * k;
const sm = (a, b, x) => { x = cl((x - a) / (b - a)); return x * x * (3 - 2 * x) };
const eio = x => { x = cl(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }, eo = x => 1 - Math.pow(1 - cl(x), 3);
const hash = i => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v) };
const L = a => a[{ vi: 1, ja: 2 }[typeof LANG === "string" ? LANG : "en"]] || a[0];
const MIN = '"Shippori Mincho B1","Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif', SANS = '"Zen Kaku Gothic New",system-ui,sans-serif';
const CORE = new Set(["title", "black"]), FALLBACK = "_template";

const API = window.DreamLantern = window.DreamLantern || { on: false };
let S = null;
export function start() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (S) return true;
  S = { dead: false }; API.on = true;
  boot(S).catch(e => { console.warn("Dream Lantern failed", e); stop() });
  return true;
}
export function stop() { const s = S; S = null; API.on = false; if (s) teardown(s) }
Object.assign(API, { start, stop, seek: t => S && S.seek && S.seek(t), pause: on => S && S.pause && S.pause(on !== false), state: () => S && S.state && S.state() });

/* ---------------- the shot list ---------------- */
function prepShots(SJ, TM) {
  const SH = SJ.shots;
  SH.forEach((s, j) => {
    s.parts = s.mod === "split" ? [Object.assign({ side: "L" }, s.L), Object.assign({ side: "R" }, s.R)] : [{ side: "F", mod: s.mod, key: s.key, var: s.var }];
    /* the transition window around this shot's cut, in seconds, kept inside both neighbouring shots */
    const w = TR.WINDOWS[s.tin], k = lastIdx(TM.fast, s.t + .01), fb = TM.fast[k + 1] ? TM.fast[k + 1] - TM.fast[k] : .337;
    s.win = !w ? null : [j ? Math.min(w[0] * fb, .9 * (s.t - SH[j - 1].t)) : 0, Math.min(w[1] * fb, .9 * (s.t1 - s.t))];
  });
  const uses = {};
  SH.forEach(s => s.parts.forEach(p => { if (!CORE.has(p.mod)) (uses[p.mod] = uses[p.mod] || []).push([s.t - (s.win ? s.win[0] : 0) - .05, s.t1 + .6]) }));
  return { SH, uses, ids: Object.keys(uses) };
}

async function boot(s) {
  const [TM, SJ] = await Promise.all([loadTiming(BASE + "timing.json"), fetch(BASE + "shots.json").then(r => r.ok ? r.json() : null).catch(() => null)]);
  if (s.dead) return;
  if (!SJ || !SJ.shots || !SJ.shots.length) throw Error("shots.json is missing");
  const { SH, uses, ids: IDS } = prepShots(SJ, TM);
  const tier = API.forceTier || (() => {
    try { const m = perfMode(); if (m === "ultra") return "ultra"; if (m === "saver" || PC.fps === -2) return "saver"; return "smooth" } catch (e) { return "smooth" }
  })();
  const fpsCap = (() => { try { return PC.egg || 999 } catch (e) { return 999 } })();
  /* preload this far ahead, dispose what is not needed this far ahead, and never hold more than cap modules */
  const CFG = { saver: { pre: 3, keep: 5, cap: 3 }, smooth: { pre: 4, keep: 8, cap: 4 }, ultra: { pre: 4, keep: 8, cap: 5 } }[tier];

  /* ---------- DOM ---------- */
  const el = document.createElement("div");
  el.className = "dl-film"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "夢灯籠 · Dream Lantern");
  el.style.cssText = "position:fixed;inset:0;z-index:2147480000;background:#000;opacity:0;transition:opacity .6s;overflow:hidden;touch-action:none";
  const CV = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  el.innerHTML = `<canvas class="dl-3d" style="${CV}"></canvas><canvas class="dl-2d" style="${CV}"></canvas>
<div class="dl-hud" style="position:absolute;inset:0;pointer-events:none;font:500 13px ${SANS};color:#f6ead8">
 <button class="dl-x" type="button" style="pointer-events:auto;position:absolute;top:14px;right:14px;width:40px;height:40px;border-radius:50%;border:1px solid #fff3;background:#0007;color:#fff;font-size:18px;cursor:pointer">✕</button>
 <div class="dl-song" style="pointer-events:auto;position:absolute;left:14px;bottom:14px;display:flex;gap:8px;align-items:center;opacity:.85">
  <button class="dl-pick" type="button" hidden style="border:1px solid #fff4;background:#0008;color:#fff;border-radius:999px;padding:7px 12px;font:inherit;cursor:pointer"></button>
  <input class="dl-file" type="file" accept="audio/*,video/mp4,video/webm" hidden>
  <span class="dl-st" aria-live="polite" style="text-shadow:0 1px 3px #000"></span>
 </div>
 <button class="dl-go" type="button" hidden style="pointer-events:auto;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border:1px solid #fff6;background:#000a;color:#fff;border-radius:999px;padding:14px 22px;font:600 16px ${SANS};cursor:pointer"></button>
</div>`;
  document.body.appendChild(el);
  s.el = el;
  const $ = q => el.querySelector(q), cvB = document.createElement("canvas"), cv3 = $(".dl-3d"), cv2 = $(".dl-2d"), bg = cvB.getContext("2d"), g = cv2.getContext("2d");
  $(".dl-x").setAttribute("aria-label", L(["Close", "Đóng", "閉じる"]));
  $(".dl-x").onclick = () => stop();
  const st = $(".dl-st"), pick = $(".dl-pick"), file = $(".dl-file"), go = $(".dl-go");
  pick.textContent = "🎵 " + L(["Load your copy of the song", "Chọn bài hát của bạn", "手元の曲を読み込む"]);
  const onKey = e => { if (e.key === "Escape") { e.preventDefault(); stop() } };
  addEventListener("keydown", onKey, true);
  s.off = [() => removeEventListener("keydown", onKey, true), () => TR.clear()];
  requestAnimationFrame(() => { el.style.opacity = "1" });
  try { $(".dl-x").focus() } catch (e) { }
  st.textContent = L(["Loading…", "Đang tải…", "読み込み中…"]);

  /* ---------- clock + audio ---------- */
  const clk = { audio: null, url: null, t0: performance.now() / 1000, held: true, heldAt: 0, lastAt: -1, lastP: 0 };
  const now = () => {
    const pn = performance.now() / 1000, a = clk.audio;
    if (a) {
      if (a.paused) return a.currentTime;
      const at = a.currentTime;
      if (at !== clk.lastAt) { clk.lastAt = at; clk.lastP = pn }
      /* currentTime only advances in steps on some browsers: interpolate from the last step, never more than 0.12 s */
      return at + Math.min(.12, (pn - clk.lastP) * (a.playbackRate || 1));
    }
    return clk.held ? clk.heldAt : pn - clk.t0;
  };
  s.seek = t => { t = Math.max(0, +t || 0); if (clk.audio) clk.audio.currentTime = t; else if (clk.paused) clk.heldAt = t; else { clk.held = false; clk.t0 = performance.now() / 1000 - t } };
  s.pause = on => {
    if (clk.audio) { on ? clk.audio.pause() : clk.audio.play().catch(() => { }); return }
    if (on && !clk.paused) { clk.heldAt = now(); clk.held = clk.paused = true }
    else if (!on && clk.paused) { clk.paused = clk.held = false; clk.t0 = performance.now() / 1000 - clk.heldAt }
  };
  const ES = typeof EggSound !== "undefined" ? EggSound : null;
  const mine = () => { try { const sl = ES && ES.eggSlot(); return !!sl && sl.indexOf("egg_dreamlantern") === 0 } catch (e) { return false } };
  function useShared(a) { /* the Sounds panel's element: read it, never tear it down (EggSound owns it) */
    clk.audio = a; clk.shared = true; clk.lastAt = -1; pick.hidden = true;
    const end = () => { if (clk.audio === a) stop() }; a.addEventListener("ended", end); s.off.push(() => a.removeEventListener("ended", end));
    st.textContent = "♪ Dream Lantern"; setTimeout(() => { if (st.textContent === "♪ Dream Lantern") st.textContent = "" }, 6000);
  }
  function useAudio(url, label, own) {
    if (s.dead) return;
    if (clk.shared) { clk.shared = false; if (mine()) ES.egg(null) } else if (clk.audio) { clk.audio.pause(); clk.audio.src = "" }
    if (clk.url) URL.revokeObjectURL(clk.url);
    clk.url = own ? url : null;
    const a = new Audio(); a.preload = "auto"; a.src = url; clk.audio = a; clk.lastAt = -1;
    a.addEventListener("ended", () => { if (clk.audio === a) stop() });
    pick.hidden = true; go.hidden = true;
    st.textContent = "♪ " + label;
    a.play().then(() => { setTimeout(() => { if (st.textContent === "♪ " + label) st.textContent = "" }, 6000) }).catch(() => {
      if (clk.audio !== a) return;
      go.hidden = false; go.textContent = "▶ " + L(["Play", "Phát", "再生"]);
      go.onclick = () => { go.hidden = true; a.play().catch(() => { }) };
    });
  }
  file.onchange = () => { const f = file.files && file.files[0]; if (f) useAudio(URL.createObjectURL(f), f.name, true) };
  pick.onclick = () => file.click();
  const findLocal = async () => {
    /* the song is gitignored, so it can only exist where the site is served from this machine: do not probe (and 404) anywhere else */
    if (!/^(localhost|127.|[::1]|0.0.0.0)/.test(location.hostname) && location.protocol !== "file:") return null;
    for (const ext of ["m4a", "mp3", "ogg", "wav"]) {
      try { const r = await fetch(BASE + "../local/dream-lantern." + ext, { method: "HEAD", cache: "no-store" }); if (r.ok) return BASE + "../local/dream-lantern." + ext } catch (e) { }
    }
    return null;
  };

  /* ---------- three.js ---------- */
  const THREE = await import("three");
  if (s.dead) return;
  /* the scene renders into the pipeline's HDR target (MSAA there), and its last pass writes this canvas */
  const R = new THREE.WebGLRenderer({ canvas: cv3, antialias: false, powerPreference: "high-performance" });
  s.R = R;
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.NoToneMapping;
  R.setClearColor(0, 0); R.autoClear = false;
  const pipe = createPipeline(THREE, R, tier); s.pipe = pipe;
  let drawInk = inkStandIn;
  try { const ink = await import("./ink.mjs"); drawInk = ink.drawInk; s.off.push(() => ink.clearCache && ink.clearCache()) } catch (e) { console.warn("Dream Lantern: ink module failed", e) }
  if (s.dead) return;

  /* ---------- 2D helpers ---------- */
  let W = 0, H = 0, d2 = 1, hold = null;
  const grain = document.createElement("canvas"); grain.width = grain.height = 160;
  { const gg = grain.getContext("2d"), im = gg.createImageData(160, 160); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255 } gg.putImageData(im, 0, 0) }
  const grainPat = g.createPattern(grain, "repeat");
  function resize() {
    /* the post chain works at the drawing-buffer size, so the pixel ratio is capped lower than v1's: 1 / 1.5 / 2 */
    const dpr = Math.min(tier === "ultra" ? 2 : tier === "saver" ? 1 : 1.5, (typeof pcDpr === "function" ? pcDpr() : devicePixelRatio) || 1);
    W = el.clientWidth || innerWidth; H = el.clientHeight || innerHeight;
    R.setPixelRatio(dpr); R.setSize(W, H, false); pipe.resize(W, H);
    d2 = dpr;
    for (const c of [cvB, cv2]) { c.width = W * d2 | 0; c.height = H * d2 | 0 }
    if (hold) hold.width = 0; hold = null;
  }
  resize(); addEventListener("resize", resize); s.off.push(() => removeEventListener("resize", resize), () => { if (hold) hold.width = 0 });

  /* ---------- scene modules: lazy load, preload ahead of the cut, fall back, dispose behind the cut ---------- */
  const MODS = new Map(); s.mods = MODS;
  let loading = null, drawn = new Set(), wasDrawn = new Set();
  const nextUse = (id, t) => { for (const [a, b] of uses[id] || []) if (b > t) return Math.max(a, t); return Infinity };
  const timeout = (p, ms, what) => { let k; return Promise.race([p, new Promise((_, no) => { k = setTimeout(() => no(Error(what + " took over " + ms / 1000 + " s")), ms) })]).finally(() => clearTimeout(k)) };
  function disposeMod(m) {
    try { m.inst && m.inst.dispose() } catch (e) { console.warn("Dream Lantern: " + m.id + ".dispose failed", e) }
    m.inst = null; m.kit.dispose();
    m.scene.traverse(o => { /* whatever the module left behind */
      if (o.geometry) o.geometry.dispose();
      for (const mt of o.material ? [].concat(o.material) : []) { for (const k in mt) { const v = mt[k]; if (v && v.isTexture) v.dispose() } mt.dispose() }
      if (o.isInstancedMesh) o.dispose();
    });
    m.scene.clear(); if (m.scene.background && m.scene.background.isTexture) m.scene.background.dispose(); m.scene.background = null;
  }
  function fail(m, e) {
    if (m.st === "fail") return;
    console.warn(`Dream Lantern: scene module "${m.id}" failed; its shots use the fallback`, e);
    m.st = "fail"; disposeMod(m);
  }
  function retire(m) { MODS.delete(m.id); disposeMod(m) }
  async function spawn(id) {
    const m = { id, st: "load", vis: false, inst: null, scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(50, W / H, .1, 3000), kit: createKit(THREE, tier) };
    MODS.set(id, m);
    const gone = () => s.dead || MODS.get(id) !== m || m.st !== "load";
    try {
      const lib = await timeout(import(BASE + "scenes/" + id + ".mjs"), 8000, "loading " + id);
      if (gone()) return m;
      const made = Promise.resolve(lib.create({ THREE, scene: m.scene, camera: m.cam, ctx2d: g, back2d: bg, renderer: R, kit: m.kit, tier, seed: 7 + IDS.indexOf(id), timing: TM, base: BASE, jsm: JSM }));
      made.then(inst => { if (gone() && !m.inst) { m.inst = inst; disposeMod(m) } }, () => { }); /* a create that finishes after we gave up on it */
      m.inst = await timeout(made, 8000, id + ".create");
      if (gone()) { disposeMod(m); return m }
      /* compile the shaders now, not on the cut */
      R.setRenderTarget(pipe.target);
      const cp = R.compileAsync ? R.compileAsync(m.scene, m.cam) : Promise.resolve(R.compile(m.scene, m.cam));
      R.setRenderTarget(null);
      await timeout(cp, 8000, "compiling " + id);
      if (gone()) { disposeMod(m); return m }
      m.st = "ok";
    } catch (e) { fail(m, e) }
    return m;
  }
  function manage(t) {
    for (const m of [...MODS.values()]) if (m.st === "ok" && m.id !== FALLBACK && !drawn.has(m) && nextUse(m.id, t) > t + CFG.keep) retire(m);
    if (loading) return;
    let want = null, wt = Infinity;
    for (const id of IDS) { if (MODS.has(id)) continue; const u = nextUse(id, t); if (u < t + CFG.pre && u < wt) { wt = u; want = id } }
    if (!want) return;
    const live = [...MODS.values()].filter(m => m.st !== "fail" && m.id !== FALLBACK);
    if (live.length >= CFG.cap) { /* make room: drop the module used furthest ahead, if that is later than the one we want */
      const v = live.filter(m => m.st === "ok" && !drawn.has(m)).sort((a, b) => nextUse(b.id, t) - nextUse(a.id, t))[0];
      if (!v || nextUse(v.id, t) <= wt) return;
      retire(v);
    }
    loading = spawn(want).finally(() => { loading = null });
  }

  /* ---------- the song: the Sounds slot first, then the local file, then the picker and the silent clock ---------- */
  st.textContent = "";
  if (ES) try { ES.egg("dreamlantern", 0) } catch (e) { }
  /* a slot without a file stays set but never plays: give it 2.5 s, as the other films do */
  const waitSlot = async () => { for (let k = 0; k < 25 && !s.dead && mine(); k++) { const a = ES.eggAudio(); if (a && !a.paused && a.currentTime > .01) return a; await new Promise(r => setTimeout(r, 100)) } return null };
  const [, local, shared] = await Promise.all([spawn(FALLBACK), findLocal(), waitSlot()]);
  if (s.dead) return;
  if (shared) useShared(shared);
  else {
    if (mine()) ES.egg(null);
    /* load it into memory first: a plain static server may not allow range requests, and then the song cannot be seeked */
    const blob = local ? await fetch(local).then(r => r.ok ? r.blob() : null).catch(() => null) : null;
    if (s.dead) return;
    if (blob) useAudio(URL.createObjectURL(blob), L(["Dream Lantern (local file)", "Dream Lantern (tệp trên máy)", "夢灯籠（ローカルファイル）"]), true);
    else { pick.hidden = false; st.textContent = L(["♪ No song file found: playing silently. Add one under Sounds → Dream Lantern.", "♪ Không tìm thấy bài hát: đang chạy không tiếng. Thêm bài trong Âm thanh → Dream Lantern.", "♪ 曲が見つからないため無音で再生中。サウンド → Dream Lantern で追加できます。"]) }
  }
  clk.held = false; clk.t0 = performance.now() / 1000;

  /* the opening: the site's own Your Name sky (the starry twilight, the comet speeding in), seen through the title shot */
  const skyCv = document.getElementById("sky");
  try { if (typeof Sky !== "undefined" && Sky.yourname) Sky.yourname() } catch (e) { }

  /* ---------- drawing a shot ---------- */
  const shotAt = t => { let k = 0; for (let i = 0; i < SH.length; i++) if (SH[i].t <= t) k = i; return k };
  function layout(s1, t) { /* viewports in CSS px: [x, y, w, h]; a split's seam drifts a little */
    if (s1.mod !== "split") return { F: [0, 0, W, H] };
    const x = Math.round(W * (.5 + .04 * Math.sin((t - s1.t) * .9)));
    return { L: [0, 0, x, H], R: [x, 0, W - x, H] };
  }
  function drawShot(j, f0, clip) {
    const s1 = SH[j], vps = layout(s1, f0.t);
    for (const p of s1.parts) drawPart(j, p, vps[p.side], clip, f0);
    if (vps.R && (!clip || (vps.R[0] > clip[0] && vps.R[0] < clip[1]))) TR.tornSeam(g, vps.R[0] * d2, H * d2, d2, f0.t, j);
  }
  function drawPart(j, p, vp, clip, f0) {
    const s1 = SH[j], x0 = clip ? Math.max(vp[0], clip[0]) : vp[0], x1 = clip ? Math.min(vp[0] + vp[2], clip[1]) : vp[0] + vp[2];
    if (x1 - x0 < 1) return;
    const shot = { i: j, key: p.key, var: p.var || "", t0: s1.t, t1: s1.t1, lt: f0.t - s1.t, u: cl((f0.t - s1.t) / (s1.t1 - s1.t)), side: p.side, tin: s1.tin, layer: s1.layer, sec: s1.sec };
    const w = vp[2] * d2 | 0, h = vp[3] * d2 | 0;
    for (const c of [bg, g]) { c.save(); c.beginPath(); c.rect(x0 * d2, vp[1] * d2, (x1 - x0) * d2, vp[3] * d2); c.clip(); c.translate(vp[0] * d2, vp[1] * d2) }
    try {
      if (CORE.has(p.mod)) { extra.push({ look: lookFor(f0.section), x0: x0 / W, x1: x1 / W }); return coreShot(p, shot, f0, w, h) }
      let m = MODS.get(p.mod);
      if (!m || m.st !== "ok") m = MODS.get(FALLBACK);
      if (!m || m.st !== "ok") return;
      drawn.add(m);
      if (!m.vis) { m.vis = true; try { m.inst.setVisible(true) } catch (e) { return fail(m, e) } }
      m.cam.aspect = vp[2] / vp[3];
      try { m.inst.update(Object.assign({}, f0, { tier, W: w, H: h, dpr: d2, debug: false, shot })) } catch (e) { return fail(m, e) }
      m.cam.updateProjectionMatrix();
      pipe.part(m.scene, m.cam, vp, clip ? [x0, x1] : null, m.kit.takeLook(f0.section));
    } finally { bg.restore(); g.restore() }
  }
  /* the core's own shots: the titles and the black */
  function coreShot(p, shot, f, w, h) {
    const t = f.t, fb = TM.bp / 2;
    if (p.mod === "black") { /* near-silence: one red thread glints across the dark */
      const a = .5 * sm(0, .25, shot.lt), x = mix(-.2, 1.2, shot.u) * w;
      const gr = g.createLinearGradient(x - w * .25, 0, x + w * .25, 0); gr.addColorStop(0, "rgba(160,20,30,0)"); gr.addColorStop(.5, `rgba(255,120,110,${a})`); gr.addColorStop(1, "rgba(160,20,30,0)");
      g.fillStyle = gr; g.fillRect(0, h / 2 - 1.2 * d2, w, 2.4 * d2); return;
    }
    const size = Math.min(w * .2, h * .24);
    if (p.var === "white") { /* out of white: pale blush and lilac, drifting light flecks, the title resolving in plum ink */
      const gr = bg.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#fdf9fc"); gr.addColorStop(.55, "#f6e9f3"); gr.addColorStop(1, "#e6dcf4");
      bg.fillStyle = gr; bg.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        const sp = .03 + .05 * hash(i * 3.1), x = (hash(i) * 1.2 - .1 + Math.sin(t * .3 + i) * .02) * w, y = ((hash(i * 7.3) - shot.lt * sp) % 1 + 1) % 1 * h;
        const r = (1 + 3 * hash(i * 5.7)) * d2 * (1 + f.fastPulse * .6), hue = hash(i * 2.9) < .5 ? "236,150,190" : "190,160,240";
        bg.fillStyle = `rgba(${hue},${.35 + .4 * hash(i * 9.1)})`; bg.beginPath(); bg.arc(x, y, r, 0, TAU); bg.fill();
      }
      ["夢", "灯", "籠"].forEach((ch, i) => { const q = cl((shot.lt - .2 - i * 2 * fb) / (4 * fb)); if (q > 0) drawInk(g, ch, { x: w / 2 + (i - 1) * size * 1.05, y: h * .44, size, progress: q, alpha: 1, color: "#4b2c55", seed: i + 7 }) });
      const sa = sm(10 * fb, 13 * fb, shot.lt);
      if (sa > 0) { g.globalAlpha = sa; g.fillStyle = "#6b4c78"; g.font = `500 ${Math.round(size * .13)}px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("DREAM LANTERN  ·  RADWIMPS", w / 2, h * .44 + size * .78); g.globalAlpha = 1 }
      return;
    }
    /* the opening: over the site's sky, an ink flame lights on the first hit, then 夢灯籠 is brushed one glyph per half bar */
    if (skyCv && skyCv.width) bg.drawImage(skyCv, 0, 0, w, h);
    const t0 = TM.hits[0] || TM.downbeats[0] || 1.875, a = sm(0, .8, t) * (1 - sm(shot.t1 - shot.t0 - 2 * fb, shot.t1 - shot.t0 - .05, shot.lt));
    const fx0 = w / 2, fy = h * .64, fr = Math.min(w, h) * (.05 + .015 * f.pulse) * sm(t0 - .15, t0 + .3, t);
    if (fr > 0) { const gr = g.createRadialGradient(fx0, fy, 0, fx0, fy, fr * 3); gr.addColorStop(0, `rgba(255,214,150,${.9 * a})`); gr.addColorStop(.25, `rgba(255,140,60,${.35 * a})`); gr.addColorStop(1, "rgba(255,100,40,0)"); g.fillStyle = gr; g.beginPath(); g.arc(fx0, fy, fr * 3, 0, TAU); g.fill() }
    ["夢", "灯", "籠"].forEach((ch, i) => { const q = cl((t - t0 - i * 4 * fb) / (3 * fb)); if (q > 0) drawInk(g, ch, { x: w / 2 + (i - 1) * size * 1.05, y: h * .4, size, progress: q, alpha: a, color: "#f3e6cf", seed: i + 1 }) });
    const sa = a * sm(t0 + 10 * fb, t0 + 12 * fb, t);
    if (sa > 0) { g.globalAlpha = sa; g.fillStyle = "#f3e6cf"; g.font = `500 ${Math.round(size * .14)}px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("DREAM LANTERN  ·  RADWIMPS", w / 2, h * .4 + size * .78); g.globalAlpha = 1 }
  }

  /* ---------- per-frame ---------- */
  let lastF = 0, raf = 0, ended = false, extra = [];
  function transitionAt(t, i) { /* the cut whose window holds t: this shot's (after it) or the next one's (before it) */
    const a = SH[i], b = SH[i + 1];
    const xa = t - a.t, xb = b ? t - b.t : -1e9;
    const A = a.win && i && xa < a.win[1] ? { j: i, type: a.tin, x: xa, pre: a.win[0], post: a.win[1] } : null;
    const B = b && b.win && -xb < b.win[0] ? { j: i + 1, type: b.tin, x: xb, pre: b.win[0], post: b.win[1] } : null;
    return A && B ? (Math.abs(A.x) < Math.abs(B.x) ? A : B) : A || B;
  }
  function frame() {
    raf = requestAnimationFrame(frame);
    if (s.dead) return;
    const pn = performance.now();
    if (fpsCap < 999 && pn - lastF < 1000 / fpsCap - 2) return;
    const dt = Math.min(.1, (pn - (lastF || pn)) / 1000); lastF = pn;
    const t = now();
    if (t > TM.duration + .8 && !clk.audio) { if (!ended) { ended = true; stop() } return }
    const f0 = frameAt(TM, t, dt), i = shotAt(t), X = transitionAt(t, i), w = W * d2, h = H * d2;
    API.skyThrough = SH[i].mod === "title" && !SH[i].var; /* the site's sky keeps drawing under the opening title only */
    [wasDrawn, drawn] = [drawn, wasDrawn]; drawn.clear();
    const clearAll = () => {
      bg.setTransform(1, 0, 0, 1, 0, 0); bg.clearRect(0, 0, w, h); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
      extra = []; pipe.begin();
    };
    const finish = () => pipe.end(cvB, t, extra);
    clearAll();
    if (X && X.type === "dissolve") { /* finish the outgoing shot, keep the picture, finish the incoming, lay the kept picture over it */
      drawShot(X.j - 1, f0, null); finish();
      if (!hold) { hold = document.createElement("canvas"); hold.width = tier === "saver" ? w / 2 : w; hold.height = tier === "saver" ? h / 2 : h }
      const hg = hold.getContext("2d"); hg.clearRect(0, 0, hold.width, hold.height);
      for (const c of [cv3, cv2]) hg.drawImage(c, 0, 0, hold.width, hold.height);
      clearAll(); drawShot(X.j, f0, null); finish();
      g.globalAlpha = 1 - eio((X.x + X.pre) / (X.pre + X.post)); g.drawImage(hold, 0, 0, w, h); g.globalAlpha = 1;
    } else if (X && X.type === "cord") { /* the red cord sweeps right to left as the seam between the two shots */
      const sx = Math.round(W * (1 - eio((X.x + X.pre) / (X.pre + X.post))));
      drawShot(X.j - 1, f0, [0, sx]); drawShot(X.j, f0, [sx, W]); finish();
      TR.cordLine(g, sx * d2, h, d2, t, 1.6);
    } else { drawShot(i, f0, null); finish() }
    for (const m of wasDrawn) if (!drawn.has(m) && m.vis) { m.vis = false; try { m.inst && m.inst.setVisible(false) } catch (e) { fail(m, e) } }
    post(t, f0, i, X, w, h);
    if (API.onFrame) try { API.onFrame([cv3, cv2]) } catch (e) { }
    manage(t);
  }
  function post(t, f, i, X, w, h) {
    const sh = SH[i], tEnd = SH[SH.length - 2].t;
    if (X && !TR.BOTH.has(X.type)) TR.cover(g, X.type, X.x, X.pre, X.post, w, h, d2, X.j, t);
    if (!(X && X.type === "flash") && f.hit > .02) { g.fillStyle = `rgba(255,236,206,${.1 * f.hit})`; g.fillRect(0, 0, w, h) }
    if (t >= tEnd) { /* the end title brushes in over the knot, holds over the landing, then black on the decay */
      const lt = t - tEnd, size = Math.min(w * .14, h * .16);
      ["夢", "灯", "籠"].forEach((ch, k) => drawInk(g, ch, { x: w / 2 + (k - 1) * size * 1.05, y: h * .3, size, progress: cl((lt - k * TM.bp / 2) / TM.bp), alpha: .95 * sm(0, TM.bp, lt), color: "#fbf1de", seed: k + 4 }));
      const end = sm(TM.duration - 1.2, TM.duration - .05, t);
      if (end > 0) { g.fillStyle = `rgba(0,0,0,${end})`; g.fillRect(0, 0, w, h) }
    }
    /* letterbox (wider on the golden thread inserts of the final chorus) and grain; the vignette is in the post */
    const lbk = sh.mod === "title" ? 0 : sh.sec === "chorus2" && sh.mod === "cord" && sh.key === "marudai" ? .13 : .085;
    if (lbk) { g.fillStyle = "#000"; g.fillRect(0, 0, w, h * lbk); g.fillRect(0, h - h * lbk, w, h * lbk) }
    g.save(); g.globalAlpha = tier === "saver" ? .035 : .05; g.translate(-Math.random() * 160, -Math.random() * 160); g.fillStyle = grainPat; g.fillRect(0, 0, w + 160, h + 160); g.restore();
  }
  s.state = () => {
    const t = now(), f = frameAt(TM, t, 0), i = shotAt(t), sh = SH[i];
    return { t, tier, shot: i + 1, setup: sh.parts.map(p => p.mod + (CORE.has(p.mod) ? "" : "." + p.key) + (p.var ? ":" + p.var : "")).join(" | "),
      audio: !!clk.audio, audioT: clk.audio ? clk.audio.currentTime : null, beat: f.beat, bar: f.bar, section: f.section,
      modules: Object.fromEntries([...MODS.values()].map(m => [m.id, m.st])), gpu: { geometries: R.info.memory.geometries, textures: R.info.memory.textures, programs: (R.info.programs || []).length } };
  };
  s.clk = clk; s.stopRaf = () => cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

/* used until ink.mjs loads, or if it fails */
function inkStandIn(g, glyph, { x, y, size, progress, alpha = 1, color = "#1a1410" }) {
  if (progress <= 0 || alpha <= 0) return;
  g.save(); g.globalAlpha = alpha; g.beginPath(); g.rect(x - size, y - size * .6, size * 2, size * 1.2 * eo(progress)); g.clip();
  g.fillStyle = color; g.font = `700 ${Math.round(size)}px ${MIN}`; g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = "rgba(255,170,90,.45)"; g.shadowBlur = size * .08; g.fillText(glyph, x, y); g.restore();
}

function teardown(s) {
  s.dead = true;
  try { s.stopRaf && s.stopRaf() } catch (e) { }
  (s.off || []).forEach(f => { try { f() } catch (e) { } });
  const c = s.clk;
  try { const sl = EggSound.eggSlot(); if (sl && sl.indexOf("egg_dreamlantern") === 0) EggSound.egg(null) } catch (e) { } /* our Sounds slot, adopted or still starting */
  if (c && c.audio && !c.shared) { try { c.audio.pause(); c.audio.removeAttribute("src"); c.audio.load() } catch (e) { } }
  API.skyThrough = false;
  if (c && c.url) URL.revokeObjectURL(c.url);
  for (const m of s.mods ? s.mods.values() : []) {
    try { m.inst && m.inst.dispose() } catch (e) { }
    try { m.kit.dispose() } catch (e) { }
    m.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); for (const mt of o.material ? [].concat(o.material) : []) { for (const k in mt) { const v = mt[k]; if (v && v.isTexture) v.dispose() } mt.dispose() } });
  }
  try { s.pipe && s.pipe.dispose() } catch (e) { }
  if (s.R) { try { s.R.dispose(); s.R.forceContextLoss() } catch (e) { } }
  const el = s.el;
  if (el) { el.style.opacity = "0"; setTimeout(() => el.remove(), 600) }
  try { const i = document.getElementById("gsearch"); i && i.focus && i.focus({ preventScroll: true }) } catch (e) { }
}
