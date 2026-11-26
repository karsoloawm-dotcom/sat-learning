/* ===== 夢灯籠 Dream Lantern: a music-video easter egg, opened by typing "dream lantern" in the search bar.
   "Two skies, one cord": katawaredoki, the twilight hour. Itomori's crater lake below (a Blender-built terrain and torii,
   lake.glb), an upside-down Tokyo hanging from the sky above, a 3D kumihimo braid running through every shot, a comet that
   crosses both skies and splits, and paper lanterns that rise off the water on the beat. The 2D layer on top (a canvas) adds
   the ink titles, washi-paper wipes on every cut, the flash, grain and letterbox. Every image is original.
   Clock: the song when there is one (assets/local/dream-lantern.* on this machine, which is gitignored, or a file the viewer
   picks), read from audio.currentTime every frame so it cannot drift; otherwise a silent clock on the same beat map.
   Timing (beats, downbeats, accents, sections) comes from timing.json, measured from the song; shots are cut on its downbeats.
   Quality follows the site's sky setting: saver/phone, smooth, ultra (4K, bloom, more lanterns).
   Debug: DreamLantern.seek(seconds), DreamLantern.state(). ===== */
const BASE = new URL("./", import.meta.url).href;
const JSM = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/";
/* parallel-built scene modules (scene-tokyo.mjs, ink.mjs); the stand-ins below take over if one fails to load */
const MODS = { tokyo: true, ink: true };
const TAU = Math.PI * 2, PI = Math.PI;
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), mix = (a, b, k) => a + (b - a) * k;
const sm = (a, b, x) => { x = cl((x - a) / (b - a)); return x * x * (3 - 2 * x) };
const eio = x => { x = cl(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }, eo = x => 1 - Math.pow(1 - cl(x), 3);
const hash = i => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v) };
const L = a => a[{ vi: 1, ja: 2 }[typeof LANG === "string" ? LANG : "en"]] || a[0];
const MIN = '"Shippori Mincho B1","Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif', SANS = '"Zen Kaku Gothic New",system-ui,sans-serif';

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
Object.assign(API, { start, stop, seek: t => S && S.seek && S.seek(t), state: () => S && S.state && S.state() });

/* ---------------- timing ---------------- */
function defaultTiming() {
  const bp = 60 / 89.1, duration = 126.76, beats = [];
  for (let t = 0; t < duration; t += bp) beats.push(+t.toFixed(3));
  const secs = [["intro", 0], ["verse1", 24], ["chorus1", 52], ["verse2", 63.2], ["build", 84], ["chorus2", 90], ["outro", 124]];
  return { duration, beats, downbeats: beats.filter((_, i) => i % 4 === 0), accents: [], sections: secs.map(([name, t0], i) => ({ name, t0, t1: secs[i + 1] ? secs[i + 1][1] : duration })) };
}
function prepTiming(j) {
  const d = defaultTiming(), T = {
    duration: j && j.duration || d.duration,
    beats: j && j.beats && j.beats.length > 8 ? j.beats : d.beats,
    downbeats: j && j.downbeats && j.downbeats.length > 2 ? j.downbeats : null,
    accents: j && j.accents || [],
    sections: j && j.sections && j.sections.length ? j.sections : d.sections,
    cues: j && j.cues || {}
  };
  T.fast = j && j.fast && j.fast.length ? j.fast : T.beats;
  if (!T.downbeats) T.downbeats = T.beats.filter((_, i) => i % 4 === 0);
  return T;
}
const lastIdx = (a, t) => { if (!a.length || t < a[0]) return -1; let lo = 0, hi = a.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (a[m] <= t) lo = m; else hi = m - 1 } return lo };
function along(a, t, per) { /* float index into a sorted time list, extrapolated at both ends */
  const i = lastIdx(a, t);
  if (i < 0) return (t - a[0]) / per;
  const b0 = a[i], b1 = a[i + 1] !== undefined ? a[i + 1] : b0 + per;
  return i + cl((t - b0) / (b1 - b0));
}
function frameAt(TM, t, dt) {
  const B = TM.beats, D = TM.downbeats, beat = along(B, t, TM.bp), bar = along(D, t, TM.bp * 4);
  const bi = lastIdx(B, t), di = lastIdx(D, t), ai = lastIdx(TM.accents, t);
  let si = 0; for (let i = 0; i < TM.sections.length; i++) if (TM.sections[i].t0 <= t) si = i;
  const sec = TM.sections[si];
  return {
    t, dt, beat, bar, beatPhase: beat - Math.floor(beat), barPhase: bar - Math.floor(bar),
    pulse: bi < 0 ? 0 : Math.exp(-(t - B[bi]) / .16), downPulse: di < 0 ? 0 : Math.exp(-(t - D[di]) / .3),
    accent: ai < 0 ? 0 : Math.exp(-(t - TM.accents[ai]) / .4),
    section: sec.name, secT: cl((t - sec.t0) / (sec.t1 - sec.t0))
  };
}
/* the downbeat n bars after the downbeat nearest t */
function barsFrom(TM, t, n) {
  const D = TM.downbeats; let k = lastIdx(D, t);
  if (k < 0) k = 0; else if (D[k + 1] !== undefined && D[k + 1] - t < t - D[k]) k++;
  const j = k + n; if (j >= 0 && j < D.length) return D[j];
  return D[Math.max(0, Math.min(D.length - 1, j))] + (j - Math.max(0, Math.min(D.length - 1, j))) * TM.bp * 4;
}
const sectionT = (TM, name, fb) => { const s = TM.sections.find(x => x.name === name); return s ? s.t0 : fb };
function buildShots(TM) {
  const C = (n, fb) => sectionT(TM, n, fb), Q = TM.cues, sh = [], add = (t, id, o) => sh.push(Object.assign({ t, id }, o || {}));
  const near = t => { const D = TM.downbeats; let k = 0; for (let i = 0; i < D.length; i++) if (Math.abs(D[i] - t) < Math.abs(D[k] - t)) k = i; return D.length ? D[k] : t };
  const v1 = C("verse1", 24), pc = C("prechorus", 40.5), c1 = C("chorus1", 52), v2 = C("verse2", 63), bd = C("build", 84), c2 = C("chorus2", 90), out = C("outro", 114.4);
  const bursts = Q.bursts || [], burst = (i, ids) => bursts[i] && add(bursts[i][0], "burst", { ids });
  add(0, "title"); add(barsFrom(TM, v1, -4), "lone");
  /* verse 1: a cut every two bars, each a washi wipe; the pre-chorus opens on the cord's release */
  ["wide", "torii", "upward"].forEach((id, k) => add(barsFrom(TM, v1, 2 * k), id, { wipe: true }));
  add(pc, "shore", { wipe: true }); add(barsFrom(TM, pc, 2), "crater", { wipe: true });
  /* the hook: quick cuts on the beat into the lift, then the comet */
  burst(0, ["comet", "torii", "upward", "wide"]);
  add(bursts[0] ? bursts[0][1] : c1, "comet", { flash: .8 });
  add(v2, "diptych", { wipe: true });
  burst(1, ["torii", "upward", "shore", "wide"]);
  add(bursts[1] ? bursts[1][1] : barsFrom(TM, v2, 6), "crater", { wipe: true });
  add(bd, "dive", { wipe: true });
  add(c2, "tunnel", { flash: 1 });
  add(near(Q.twilight || barsFrom(TM, c2, 4)), "split", { wipe: true });
  add(near(Q.dissolve || barsFrom(TM, c2, 6)), "crater");
  burst(2, ["upward", "torii", "comet", "shore"]);
  add(bursts[2] ? bursts[2][1] : barsFrom(TM, c2, 8), "rise", { wipe: true });
  /* the outro's hard re-entry: the fragment hits the lake; the white flash ties the knot; the title lands on the last hit */
  add(out, "impact", { flash: 1.6 });
  const kn = Q.flash || barsFrom(TM, out, 1);
  add(kn, "knot", { flash: 1.2 });
  add(Math.min((Q.end || TM.duration) - 3.6, barsFrom(TM, kn, 1)), "outro", { wipe: true });
  sh.sort((a, b) => a.t - b.t);
  sh.forEach((x, i) => x.t1 = sh[i + 1] ? sh[i + 1].t : TM.duration + 2);
  return sh;
}

/* ---------------- shaders ---------------- */
const SKY = `
uniform float uTime,uStars,uBand,uBandOn,uFlash;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec3 skyCol(vec3 d){
  float y=d.y,h=clamp(y,0.,1.);
  vec3 zen=vec3(.012,.016,.06),mid=vec3(.10,.05,.20),hor=vec3(.95,.36,.22),gold=vec3(1.,.62,.26);
  vec3 c=mix(hor,mid,smoothstep(0.,.2,h));c=mix(c,zen,smoothstep(.16,.75,h));
  vec3 fl=normalize(vec3(d.x,0.,d.z)+1e-4);
  float s=max(dot(fl,normalize(vec3(.32,0.,-1.))),0.);
  c+=gold*pow(s,7.)*exp(-max(y,0.)*7.)*1.2;
  if(y<0.)c=mix(hor*.55,vec3(.05,.03,.08),smoothstep(0.,-.25,y));
  vec2 p=vec2(atan(d.z,d.x),asin(clamp(y,-1.,1.)))*vec2(160.,160.);
  vec2 cell=floor(p);float r=h21(cell);
  float st=smoothstep(1.-.02*uStars,1.,r)*smoothstep(.05,.3,y);
  float tw=.6+.4*sin(uTime*(2.+r*5.)+r*40.);
  float dd=length(fract(p)-.5);c+=vec3(.9,.92,1.)*st*tw*smoothstep(.35,.0,dd)*2.5;
  float az=atan(d.x,-d.z);
  c+=vec3(1.,.45,.6)*uBandOn*exp(-pow((az-uBand)*3.,2.))*smoothstep(-.02,.1,y)*exp(-y*2.5)*.9;
  return c+vec3(1.,.85,.6)*uFlash;
}`;
const TM_OUT = "\n#include <tonemapping_fragment>\n#include <colorspace_fragment>";

async function boot(s) {
  const TM = prepTiming(await fetch(BASE + "timing.json").then(r => r.ok ? r.json() : null).catch(() => null));
  TM.bp = TM.beats.length > 1 ? (TM.beats[TM.beats.length - 1] - TM.beats[0]) / (TM.beats.length - 1) : .673;
  if (s.dead) return;
  const SH = buildShots(TM);
  const tier = API.forceTier || (() => {
    try { const m = perfMode(); if (m === "ultra") return "ultra"; if (m === "saver" || PC.fps === -2) return "saver"; return "smooth" } catch (e) { return "smooth" }
  })();
  const fpsCap = (() => { try { return PC.egg || 999 } catch (e) { return 999 } })();

  /* ---------- DOM ---------- */
  const el = document.createElement("div");
  el.className = "dl-film"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "夢灯籠 · Dream Lantern");
  el.style.cssText = "position:fixed;inset:0;z-index:2147480000;background:#000;opacity:0;transition:opacity .6s;overflow:hidden;touch-action:none";
  el.innerHTML = `<canvas class="dl-3d" style="position:absolute;inset:0;width:100%;height:100%;display:block"></canvas>
<canvas class="dl-2d" style="position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none"></canvas>
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
  const $ = q => el.querySelector(q), cv3 = $(".dl-3d"), cv2 = $(".dl-2d"), g = cv2.getContext("2d");
  $(".dl-x").setAttribute("aria-label", L(["Close", "Đóng", "閉じる"]));
  $(".dl-x").onclick = () => stop();
  const st = $(".dl-st"), pick = $(".dl-pick"), file = $(".dl-file"), go = $(".dl-go");
  pick.textContent = "🎵 " + L(["Load your copy of the song", "Chọn bài hát của bạn", "手元の曲を読み込む"]);
  const onKey = e => { if (e.key === "Escape") { e.preventDefault(); stop() } };
  addEventListener("keydown", onKey, true);
  s.off = [() => removeEventListener("keydown", onKey, true)];
  requestAnimationFrame(() => { el.style.opacity = "1" });
  try { $(".dl-x").focus() } catch (e) { }
  st.textContent = L(["Loading…", "Đang tải…", "読み込み中…"]);

  /* ---------- clock + audio ---------- */
  const clk = { audio: null, url: null, t0: performance.now() / 1000, held: true, lastAt: -1, lastP: 0 };
  const now = () => {
    const pn = performance.now() / 1000, a = clk.audio;
    if (a) {
      if (a.paused) return a.currentTime;
      const at = a.currentTime;
      if (at !== clk.lastAt) { clk.lastAt = at; clk.lastP = pn }
      /* currentTime only advances in steps on some browsers: interpolate from the last step, never more than 0.12 s */
      return at + Math.min(.12, (pn - clk.lastP) * (a.playbackRate || 1));
    }
    return clk.held ? 0 : pn - clk.t0;
  };
  s.seek = t => { t = Math.max(0, +t || 0); if (clk.audio) clk.audio.currentTime = t; else { clk.held = false; clk.t0 = performance.now() / 1000 - t } };
  function useAudio(url, label, own) {
    if (s.dead) return;
    if (clk.audio) { clk.audio.pause(); clk.audio.src = "" }
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
  const [THREE, GL] = await Promise.all([import("three"), import(JSM + "loaders/GLTFLoader.js")]);
  const fx = tier === "ultra" ? await Promise.all(["postprocessing/EffectComposer.js", "postprocessing/RenderPass.js", "postprocessing/UnrealBloomPass.js", "postprocessing/OutputPass.js"].map(p => import(JSM + p))).catch(e => { console.warn("Dream Lantern: no bloom", e); return null }) : null;
  if (s.dead) return;
  const R = new THREE.WebGLRenderer({ canvas: cv3, antialias: tier !== "saver", powerPreference: "high-performance" });
  s.R = R;
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, 1, .1, 2500);
  const FOGC = new THREE.Color(.42, .2, .22);
  scene.fog = new THREE.FogExp2(FOGC, .0062);
  s.scene = scene;
  scene.add(new THREE.HemisphereLight(0x7a6fc0, 0x1a1020, 1.35));
  const sun = new THREE.DirectionalLight(0xffa070, 2.2); sun.position.set(-30, 18, -100); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8090ff, .35); fill.position.set(20, 30, 60); scene.add(fill);

  /* sky */
  const skyU = { uTime: { value: 0 }, uStars: { value: 0 }, uBand: { value: 0 }, uBandOn: { value: 0 }, uFlash: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 48, 24), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vD;void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}",
    fragmentShader: SKY + "varying vec3 vD;void main(){gl_FragColor=vec4(skyCol(normalize(vD)),1.);" + TM_OUT + "}"
  }));
  sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

  /* lake: a planar reflection (rendered from a flipped scene into a half-size target) seen through ripples */
  const useRef = tier !== "saver";
  const refRT = useRef ? new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }) : null;
  s.refRT = refRT;
  const lakeU = { uRef: { value: refRT ? refRT.texture : null }, uHas: { value: useRef ? 1 : 0 }, uVp: { value: new THREE.Vector4(0, 0, 1, 1) }, uTime: skyU.uTime, uStars: skyU.uStars, uBand: skyU.uBand, uBandOn: skyU.uBandOn, uFlash: skyU.uFlash, uRip: { value: 1 }, uWave: { value: new THREE.Vector4(0, 0, -1, 0) }, uFog: { value: FOGC } };
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-PI / 2), new THREE.ShaderMaterial({
    uniforms: lakeU, fog: false,
    vertexShader: "varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}",
    fragmentShader: SKY + `uniform sampler2D uRef;uniform float uHas,uRip;uniform vec4 uVp,uWave;uniform vec3 uFog;varying vec3 vW;
void main(){
  vec3 v=normalize(vW-cameraPosition);float dist=length(vW-cameraPosition);
  vec2 p=vW.xz;float k=uRip/(1.+dist*.05);
  vec2 n=vec2(sin(p.x*.9+uTime*1.1+sin(p.y*.4))+sin(p.x*2.3-uTime*1.9+p.y*.7)*.5, sin(p.y*1.1-uTime*1.4+p.x*.3)+sin(p.y*2.9+uTime*2.2)*.4);
  float wr=length(p-uWave.xy),wt=uWave.z;
  if(wt>=0.){float ring=exp(-pow((wr-wt*24.)*.35,2.))*exp(-wt*.6);n+=normalize(p-uWave.xy+1e-3)*ring*3.;}
  vec2 off=n*k*.012;
  vec3 ref=uHas>.5?texture2D(uRef,(gl_FragCoord.xy-uVp.xy)/uVp.zw+off).rgb:skyCol(reflect(v,normalize(vec3(n.x*k*.08,1.,n.y*k*.08))));
  float fres=.35+.65*pow(1.-max(-v.y,0.),3.);
  vec3 c=mix(vec3(.01,.012,.03),ref*.9,fres);
  if(wt>=0.){c+=vec3(1.,.8,.55)*exp(-pow((wr-wt*24.)*.5,2.))*exp(-wt*.9)*1.5;}
  c=mix(c,uFog,1.-exp(-pow(dist*.0045,2.)));
  gl_FragColor=vec4(c,1.);` + TM_OUT + "}"
  }));
  lake.renderOrder = -5; scene.add(lake);

  /* the world above the water, flipped for the reflection */
  const world = new THREE.Group(); scene.add(world);
  const clip = [new THREE.Plane(new THREE.Vector3(0, -1, 0), .05)];

  /* terrain, torii and stone lanterns: lake.glb, built in Blender by build_lake.py */
  const terrMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: new THREE.Color(.62, .5, .62) });
  const propMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const toroGlow = [];
  new GL.GLTFLoader().load(BASE + "lake.glb", gl => {
    if (s.dead) return;
    gl.scene.traverse(o => { if (o.isMesh) o.material = o.name.startsWith("terrain") ? terrMat : propMat });
    const by = n => gl.scene.getObjectByName(n);
    const terr = by("terrain"), torii = by("torii"), toro = by("toro");
    if (terr) { terr.scale.set(1.15, .48, 1.15); world.add(terr) } /* low hills, so the twilight sky shows over the rim */
    if (torii) { torii.position.set(0, -.15, -20); torii.scale.setScalar(1.15); world.add(torii) }
    if (toro) [[-9, -31.4], [9, -31.4], [-19, -26.3], [19, -26.3], [-27, -18]].forEach(([x, z], i) => {
      const o = i ? toro.clone() : toro; o.position.set(x, -.25, z); o.rotation.y = Math.atan2(x, z); world.add(o); toroGlow.push(new THREE.Vector3(x, 1.75, z));
    });
  }, undefined, e => console.warn("Dream Lantern: lake.glb unavailable", e));

  /* glow points (lantern halos, comet, sparks): one additive shader, size in world units */
  const ptU = { uScale: { value: 400 } };
  const ptMat = () => new THREE.ShaderMaterial({
    uniforms: ptU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: "attribute float aS;attribute vec3 aC;varying vec3 vC;uniform float uScale;void main(){vC=aC;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=min(256.,aS*uScale/max(.1,-mv.z));gl_Position=projectionMatrix*mv;}",
    fragmentShader: "varying vec3 vC;void main(){vec2 p=gl_PointCoord-.5;float d=dot(p,p);float a=(exp(-d*16.)+exp(-d*90.)*.8)*smoothstep(.25,.12,d);if(a<.004)discard;gl_FragColor=vec4(vC*a,1.);" + TM_OUT + "}"
  });
  function points(n) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aS", new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aC", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const p = new THREE.Points(geo, ptMat()); p.frustumCulled = false; return p;
  }

  /* paper lanterns: one instanced lathe, lit from inside */
  const NL = { saver: 160, smooth: 450, ultra: 1400 }[tier];
  const prof = [[0, -.5], [.16, -.5], [.3, -.42], [.4, -.24], [.43, -.02], [.4, .2], [.3, .38], [.17, .47], [0, .48]].map(([x, y]) => new THREE.Vector2(x, y));
  const lgeo = new THREE.LatheGeometry(prof, tier === "saver" ? 8 : 12);
  { const pos = lgeo.attributes.position, c = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), k = Math.exp(-y * y * 9), rib = .82 + .18 * Math.cos(y * 60); c[i * 3] = (.35 + 1.9 * k) * rib; c[i * 3 + 1] = (.08 + 1.05 * k) * rib; c[i * 3 + 2] = (.04 + .38 * k) * rib }
    lgeo.setAttribute("color", new THREE.BufferAttribute(c, 3)) }
  const lmat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const lan = new THREE.InstancedMesh(lgeo, lmat, NL);
  lan.instanceMatrix.setUsage(THREE.DynamicDrawUsage); lan.frustumCulled = false;
  lan.setColorAt(0, new THREE.Color(1, 1, 1)); lan.instanceColor.setUsage(THREE.DynamicDrawUsage);
  world.add(lan);
  const halo = points(NL + 8); world.add(halo);
  /* per-lantern plan: where it floats, when it appears on the water, when it is let go (on a beat) */
  const beatsIn = (a, b) => TM.beats.filter(t => t >= a && t < b);
  const tLone = SH.find(x => x.id === "lone").t, tC1 = sectionT(TM, "chorus1", 52), tV2 = sectionT(TM, "verse2", 63), tC2 = sectionT(TM, "chorus2", 90);
  const tImp = SH.find(x => x.id === "impact").t, tOut = SH.find(x => x.id === "outro").t;
  const wave1 = beatsIn(tC1, tV2), wave2 = beatsIn(tC2, tImp), appearB = beatsIn(tLone, tC1);
  const LP = [];
  for (let i = 0; i < NL; i++) {
    const r = 5 + 27 * Math.sqrt(hash(i * 3.1)), a = hash(i * 7.7) * TAU;
    let x = Math.cos(a) * r, z = Math.sin(a) * r - 4;
    if (Math.abs(x) < 3.2 && z < -14 && z > -26) x += 6 * Math.sign(x || 1); /* keep the torii clear */
    const grp = hash(i * 1.3);
    const rel = i === 0 ? Infinity : grp < .45 ? wave1[i % Math.max(1, wave1.length)] : grp < .85 ? wave2[i % Math.max(1, wave2.length)] : tImp + hash(i) * .25;
    LP.push({ x, z, app: appearB.length ? appearB[i % appearB.length] + hash(i * 5.3) * .1 : tLone, rel, v: .8 + .9 * hash(i * 9.1), ph: hash(i * 2.2) * TAU, s: .7 + .5 * hash(i * 4.4), boost: rel >= tImp - .01 ? 2.2 : 1 });
  }
  LP[0].x = .9; LP[0].z = 3.2; LP[0].app = 0; LP[0].s = 1.1; /* the hero lantern, near the camera in the first and last shots */

  /* the comet: a head and two tails of glow points */
  const NCT = { saver: 160, smooth: 320, ultra: 700 }[tier];
  const comet = points(NCT * 2); world.add(comet);
  const ctr = []; for (let i = 0; i < NCT; i++) ctr.push([hash(i * 1.7), hash(i * 3.9) - .5, hash(i * 6.1) - .5, hash(i * 8.3)]);
  const dirAE = (az, el, d) => new THREE.Vector3(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, -Math.cos(az) * Math.cos(el) * d);
  const tSplit = SH.find(x => x.id === "split").t;
  function cometHead(t, which) {
    let u, a0, a1, e0, e1;
    if (t >= tC1 - 2 && t < tV2 + 3) { u = (t - tC1 + 2) / (tV2 - tC1 + 5); a0 = -1.1; a1 = .75; e0 = .62; e1 = .3 }
    else if (t >= tC2 - 2 && t < tImp + .2) { u = (t - tC2 + 2) / (tImp - tC2 + 6); a0 = -.75; a1 = .35; e0 = .78; e1 = .36 }
    else return null;
    const p = dirAE(mix(a0, a1, u), mix(e0, e1, u), 520);
    if (which === 1) { /* the fragment that breaks away and falls into the lake at the impact */
      if (t < tSplit || t >= tImp) return null;
      const k = eio((t - tSplit) / (tImp - tSplit)), q = p.clone().add(new THREE.Vector3(30, -10, 0).multiplyScalar(sm(0, .15, k)));
      return q.lerp(new THREE.Vector3(0, 0, -6), Math.pow(k, 2.2));
    }
    return p;
  }

  /* the kumihimo cord: a braided tube around the lake, and the knot it ties at the end */
  const braidMat = (len, cols) => new THREE.ShaderMaterial({
    uniforms: { uGrow: { value: 0 }, uLen: { value: len }, uTime: skyU.uTime, uPulse: { value: 0 }, uGlow: { value: 1 } }, fog: false,
    vertexShader: "varying vec2 vUv;varying vec3 vN,vV;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}",
    fragmentShader: `uniform float uGrow,uLen,uTime,uPulse,uGlow;varying vec2 vUv;varying vec3 vN,vV;
void main(){ if(vUv.x>uGrow)discard;
  float a=vUv.x*uLen,b=vUv.y;
  vec3 red=${cols[0]},gold=${cols[1]},ind=${cols[2]},wht=vec3(.95,.9,.82);
  float s1=fract(a*1.6+b*4.),s2=fract(a*1.6-b*4.);
  vec3 c=mix(red,gold,step(.55,s1)*step(.55,s2)+step(.92,s1)*.6);
  float band=fract(a*.11);
  if(band<.1)c=mix(ind,wht,step(.5,fract(a*3.2+b*2.)));else if(band<.13)c=gold;
  float lit=.45+.55*max(dot(vN,normalize(vec3(-.3,.5,-.8))),0.)+.35*pow(1.-max(dot(vN,vV),0.),2.);
  c*=lit;
  float head=smoothstep(uGrow-.012,uGrow,vUv.x);
  float pls=exp(-pow((fract(vUv.x*3.-uTime*.35)-.5)*14.,2.))*uPulse;
  c+=vec3(1.,.72,.4)*(head*2.5+pls*1.6)*uGlow;
  gl_FragColor=vec4(c,1.);` + TM_OUT + "}"
  });
  const loopPts = []; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; loopPts.push(new THREE.Vector3(Math.sin(a) * 29, 2.6 + 1.6 * Math.sin(a * 3) + (i % 2) * .4, -Math.cos(a) * 29 - 3)) }
  const loopCurve = new THREE.CatmullRomCurve3(loopPts, true, "centripetal");
  const cordMat = braidMat(loopCurve.getLength() / 1.2, ["vec3(.62,.04,.06)", "vec3(1.,.64,.16)", "vec3(.1,.12,.42)"]);
  const cord = new THREE.Mesh(new THREE.TubeGeometry(loopCurve, tier === "saver" ? 500 : 900, .16, tier === "saver" ? 6 : 10, true), cordMat);
  world.add(cord);
  class Knot extends THREE.Curve { getPoint(u, o = new THREE.Vector3()) { const a = u * TAU; return o.set(Math.sin(a) + 2 * Math.sin(2 * a), Math.cos(a) - 2 * Math.cos(2 * a), -Math.sin(3 * a)).multiplyScalar(.85) } }
  const knotMat = braidMat(14, ["vec3(.75,.05,.07)", "vec3(1.,.7,.2)", "vec3(.12,.14,.5)"]);
  const knot = new THREE.Mesh(new THREE.TubeGeometry(new Knot(), 600, .14, 10, true), knotMat);
  knot.position.set(0, 4.2, -15.5); knot.visible = false; world.add(knot);

  /* the shockwave ring on the water at the impact */
  const ring = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 96).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 1.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  ring.position.set(0, .06, -6); ring.visible = false; scene.add(ring);

  /* upside-down Tokyo: the parallel-built module, or a simple stand-in */
  let tokyo = null;
  if (MODS.tokyo) { try { tokyo = (await import("./scene-tokyo.mjs")).create({ THREE, scene: world, tier, seed: 7 }); if (tokyo.group) tokyo.group.position.y += 17 } catch (e) { console.warn("Dream Lantern: Tokyo module failed, using the stand-in", e) } }
  if (!tokyo) tokyo = tokyoStandIn(THREE, world, tier);
  let drawInk = inkStandIn;
  if (MODS.ink) { try { const ink = await import("./ink.mjs"); drawInk = ink.drawInk; s.off.push(() => ink.clearCache && ink.clearCache()) } catch (e) { console.warn("Dream Lantern: ink module failed", e) } }
  s.mods = [tokyo];
  if (s.dead) return;

  /* bloom on Ultra */
  let comp = null, bloom = null;
  if (fx) {
    comp = new fx[0].EffectComposer(R); const rp = new fx[1].RenderPass(scene, cam); comp.addPass(rp);
    bloom = new fx[2].UnrealBloomPass(new THREE.Vector2(256, 256), .4, .5, .95); comp.addPass(bloom); comp.addPass(new fx[3].OutputPass());
    s.comp = comp;
  }

  /* ---------- 2D helpers ---------- */
  let W = 0, H = 0, d2 = 1, vig = null;
  const grain = document.createElement("canvas"); grain.width = grain.height = 160;
  { const gg = grain.getContext("2d"), im = gg.createImageData(160, 160); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255 } gg.putImageData(im, 0, 0) }
  const grainPat = g.createPattern(grain, "repeat");
  const washi = document.createElement("canvas"); washi.width = washi.height = 256;
  { const wg = washi.getContext("2d"); wg.fillStyle = "#efe4cf"; wg.fillRect(0, 0, 256, 256); wg.strokeStyle = "rgba(170,140,100,.18)"; wg.lineWidth = .7;
    for (let i = 0; i < 260; i++) { const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * TAU, l = 6 + Math.random() * 26; wg.beginPath(); wg.moveTo(x, y); wg.quadraticCurveTo(x + Math.cos(a + 1) * l * .5, y + Math.sin(a + 1) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); wg.stroke() } }
  const washiPat = g.createPattern(washi, "repeat");
  function resize() {
    const dpr = Math.min(tier === "ultra" ? 3 : tier === "saver" ? 1 : 2, (typeof pcDpr === "function" ? pcDpr() : devicePixelRatio) || 1);
    W = el.clientWidth || innerWidth; H = el.clientHeight || innerHeight;
    R.setPixelRatio(dpr); R.setSize(W, H, false);
    if (comp) { comp.setPixelRatio(dpr); comp.setSize(W, H); bloom.resolution.set(W * dpr / 2, H * dpr / 2) }
    if (refRT) refRT.setSize(Math.max(4, W * dpr / 2 | 0), Math.max(4, H * dpr / 2 | 0));
    d2 = Math.min(2, devicePixelRatio || 1); cv2.width = W * d2 | 0; cv2.height = H * d2 | 0;
    vig = g.createRadialGradient(W * d2 / 2, H * d2 / 2, Math.min(W, H) * d2 * .35, W * d2 / 2, H * d2 / 2, Math.hypot(W, H) * d2 * .6);
    vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(5,2,12,.55)");
  }
  resize(); addEventListener("resize", resize); s.off.push(() => removeEventListener("resize", resize));

  /* ---------- the song ---------- */
  st.textContent = "";
  const local = await findLocal();
  if (s.dead) return;
  /* load it into memory first: a plain static server may not allow range requests, and then the song cannot be seeked */
  const blob = local ? await fetch(local).then(r => r.ok ? r.blob() : null).catch(() => null) : null;
  if (s.dead) return;
  if (blob) useAudio(URL.createObjectURL(blob), L(["Dream Lantern (local file)", "Dream Lantern (tệp trên máy)", "夢灯籠（ローカルファイル）"]), true);
  else { pick.hidden = false; st.textContent = L(["Playing silently on the beat map", "Đang chạy không tiếng theo nhịp", "ビートに合わせて無音で再生中"]) }
  clk.held = false; clk.t0 = performance.now() / 1000;

  /* ---------- per-frame ---------- */
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), camB = cam.clone();
  let lastShot = null, lastF = 0, raf = 0, endT = 0;
  const camSet = (c, p, look, fov = 50, roll = 0) => { c.position.copy(p); c.up.set(Math.sin(roll), Math.cos(roll), 0); c.lookAt(look); if (c.fov !== fov) { c.fov = fov; c.updateProjectionMatrix() } };
  function shotCam(c, id, lt, u, f, side) {
    const t = f.t, br = Math.sin(t * .7) * .15;
    switch (id) {
      case "title": case "lone": camSet(c, V.set(.3 + br * .2, mix(1.05, 1.5, u), mix(11.5, 8.5, eio(u))), V2.set(.2, mix(1.3, 2.8, u), -20), 46); break;
      case "wide": camSet(c, V.set(mix(-2, 2, u), 4.5, mix(36, 31, u)), V2.set(0, 9, -24), 55); break;
      case "torii": camSet(c, V.set(mix(-9, -3, u), .9, mix(-6, -9, u)), V2.set(0, 3.2, -20), 42, -.04); break;
      case "upward": camSet(c, V.set(0, 1.8, mix(4, -2, u)), V2.set(mix(-8, 8, u), 34, -42), 62, mix(-.12, .1, u)); break;
      case "shore": camSet(c, V.set(mix(-24, -12, u), 1.3, mix(-17, -27, u)), V2.set(mix(-10, 0, u), 2, -36), 44); break;
      case "crater": camSet(c, V.set(Math.sin(u * .6) * 20, mix(62, 52, u), mix(46, 40, u)), V2.set(0, 0, -6), 48); break;
      case "comet": camSet(c, V.set(Math.sin(u * .9) * 6, 2.6, mix(24, 18, u)), V2.set(mix(-30, 25, u), mix(60, 42, u), -140), 58, .05 * Math.sin(u * 3)); break;
      case "diptych": if (side) camSet(c, V.set(mix(-3, 3, u), 2.5, -4), V2.set(0, 30, -52), 64, .08);
        else camSet(c, V.set(mix(7, 3, u), 1.1, mix(-6, -9, u)), V2.set(0, 3, -20), 46); break;
      case "dive": { const k = eio(u); camSet(c, V.set(Math.sin(k * 2) * 4, mix(70, 1.0, Math.pow(k, .8)), mix(40, 6, k)), V2.set(0, mix(0, 2, k), mix(-4, -24, k)), mix(40, 58, k), k * .3); break }
      case "tunnel": { const q = (.62 + u * .55) % 1; loopCurve.getPointAt(q, V); loopCurve.getPointAt((q + .035) % 1, V2); V.y += .9; V.x *= .9; V.z = (V.z + 3) * .9 - 3; V2.y += 1.4; camSet(c, V, V2, 66, Math.sin(f.bar * PI) * .18); break }
      case "rise": camSet(c, V.set(Math.sin(u * 2) * 5, mix(1.2, 3, u), mix(14, 10, u)), V2.set(0, mix(20, 60, eio(u)), -60), 62, -.06); break;
      case "split": camSet(c, V.set(0, 1.6, mix(20, 16, u)), V2.set(mix(-60, 10, u), mix(150, 120, u), -380), 54); break;
      case "impact": camSet(c, V.set(mix(-6, 6, u), mix(16, 12, u), mix(46, 40, u)), V2.set(0, 2, -8), 52); break;
      case "knot": camSet(c, V.set(Math.sin(u * 1.2) * 3, 4.4, mix(-5, -8, eio(u))), V2.set(0, 4.2, -15.5), 46); break;
      case "outro": camSet(c, V.set(.3, mix(1.3, 1.8, u), mix(10, 8, u)), V2.set(.4, mix(2, 6, u), -20), 46); break;
    }
  }
  function lanterns(t, f) {
    const M = lan.instanceMatrix.array, CI = lan.instanceColor.array, hp = halo.geometry.attributes.position.array, hs = halo.geometry.attributes.aS.array, hc = halo.geometry.attributes.aC.array;
    const outroFade = 1 - sm(tOut - 1, tOut + 2.5, t);
    for (let i = 0; i < NL; i++) {
      const P = LP[i];
      let vis = i === 0 ? 1 - sm(tLone + 6, tLone + 9, t) * (1 - sm(tOut, tOut + 1, t)) : sm(P.app, P.app + .5, t) * (P.rel === Infinity ? 1 : outroFade);
      let x = P.x + Math.sin(t * .23 + P.ph) * .35, z = P.z + Math.cos(t * .19 + P.ph) * .35, y = .32 + Math.sin(t * 1.3 + P.ph) * .05, sc = P.s;
      if (i === 0 && t > tOut) { y += eo((t - tOut) / 6) * 1.6; x += eo((t - tOut) / 3) * 2.6 } /* drifts aside so the knot stays in view */
      if (t > P.rel) {
        const d = t - P.rel, v = P.v * P.boost;
        y += v * (d - 1.6 * (1 - Math.exp(-d / 1.6)));
        x += Math.sin(d * .6 + P.ph) * Math.min(d, 5) * .25 + d * .25 * (P.boost > 1 ? Math.sin(P.ph) * 2 : 1);
        z += Math.cos(d * .5 + P.ph) * Math.min(d, 5) * .2 - d * .12;
        sc *= mix(1, .35, sm(40, 110, y));
      }
      if (vis < .01) sc = 0;
      const r = P.ph + t * .1, c = Math.cos(r) * sc, sn = Math.sin(r) * sc, o = i * 16;
      M[o] = c; M[o + 1] = 0; M[o + 2] = -sn; M[o + 3] = 0; M[o + 4] = 0; M[o + 5] = sc; M[o + 6] = 0; M[o + 7] = 0; M[o + 8] = sn; M[o + 9] = 0; M[o + 10] = c; M[o + 11] = 0; M[o + 12] = x; M[o + 13] = y; M[o + 14] = z; M[o + 15] = 1;
      const fl = (.86 + .14 * Math.sin(t * 11 + P.ph * 7)) * (1 + f.pulse * .35 + f.accent * .4) * vis;
      const star = sm(45, 120, y);
      CI[i * 3] = fl * mix(1, 1.6, star); CI[i * 3 + 1] = fl * mix(1, 2.2, star); CI[i * 3 + 2] = fl * mix(1, 3.2, star);
      hp[i * 3] = x; hp[i * 3 + 1] = y; hp[i * 3 + 2] = z; hs[i] = sc * (1.9 + f.pulse * .5) * (vis > .01 ? 1 : 0);
      const hk = bloom ? .55 : 1; hc[i * 3] = .55 * hk * fl * mix(1, .7, star); hc[i * 3 + 1] = .28 * hk * fl * mix(1, 1.1, star); hc[i * 3 + 2] = .1 * hk * fl * mix(1, 2.4, star);
    }
    for (let j = 0; j < 8; j++) { const k = NL + j, p = toroGlow[j], on = p ? 1 : 0;
      if (p) { hp[k * 3] = p.x; hp[k * 3 + 1] = p.y; hp[k * 3 + 2] = p.z } hs[k] = on * (1.4 + f.pulse * .3); hc[k * 3] = .7 * on; hc[k * 3 + 1] = .42 * on; hc[k * 3 + 2] = .16 * on }
    lan.instanceMatrix.needsUpdate = true; lan.instanceColor.needsUpdate = true;
    halo.geometry.attributes.position.needsUpdate = halo.geometry.attributes.aS.needsUpdate = halo.geometry.attributes.aC.needsUpdate = true;
  }
  function comets(t, f) {
    const P = comet.geometry.attributes.position.array, Sz = comet.geometry.attributes.aS.array, Cc = comet.geometry.attributes.aC.array;
    for (let w = 0; w < 2; w++) {
      const h = cometHead(t, w), hb = h && cometHead(t - .5, w);
      for (let i = 0; i < NCT; i++) {
        const o = (w * NCT + i);
        if (!h || !hb) { Sz[o] = 0; continue }
        const [k, a, b, c] = ctr[i], dir = V.subVectors(hb, h);
        const dl = dir.length() || 1; dir.multiplyScalar(1 / dl);
        const ion = c < .4, len = (w ? 26 : 70) * (ion ? 1.3 : 1), kk = Math.pow(k, ion ? 1 : 1.4);
        const sp = (ion ? 1.2 : 6) * kk * (w ? .6 : 1);
        P[o * 3] = h.x + dir.x * len * kk + a * sp + (ion ? 0 : kk * kk * 9); P[o * 3 + 1] = h.y + dir.y * len * kk + b * sp; P[o * 3 + 2] = h.z + dir.z * len * kk + (a - b) * sp;
        const fade = (1 - k) * (.6 + .4 * Math.sin(t * 6 + i));
        Sz[o] = (i === 0 ? (w ? Math.min(16, h.length() * .012) : 16 + f.downPulse * 10) : (ion ? 2.2 : 3.4) * (1 - k * .6)) * (w ? .7 : 1);
        if (i === 0) { Cc[o * 3] = 2.6; Cc[o * 3 + 1] = 2.5; Cc[o * 3 + 2] = 2.3 }
        else if (ion) { Cc[o * 3] = .25 * fade; Cc[o * 3 + 1] = .55 * fade; Cc[o * 3 + 2] = 1.1 * fade }
        else { Cc[o * 3] = 1.0 * fade; Cc[o * 3 + 1] = .62 * fade; Cc[o * 3 + 2] = .3 * fade }
      }
    }
    const g2 = comet.geometry.attributes; g2.position.needsUpdate = g2.aS.needsUpdate = g2.aC.needsUpdate = true;
  }
  function render(c, vp, split) {
    c.aspect = vp[2] / vp[3]; c.updateProjectionMatrix();
    const pr = R.getPixelRatio();
    if (refRT) {
      const rv = ring.visible; lake.visible = false; ring.visible = false; scene.scale.y = -1;
      R.setRenderTarget(refRT); R.clippingPlanes = clip; R.clear(); R.render(scene, c);
      R.clippingPlanes = []; R.setRenderTarget(null); scene.scale.y = 1; lake.visible = true; ring.visible = rv;
      lakeU.uVp.value.set(vp[0] * pr, (H - vp[1] - vp[3]) * pr, vp[2] * pr, vp[3] * pr);
    }
    if (split) { R.setScissorTest(true); R.setScissor(vp[0], H - vp[1] - vp[3], vp[2], vp[3]); R.setViewport(vp[0], H - vp[1] - vp[3], vp[2], vp[3]); R.render(scene, c); R.setScissorTest(false); R.setViewport(0, 0, W, H) }
    else if (comp) { comp.passes[0].camera = c; comp.render() }
    else R.render(scene, c);
  }
  function frame() {
    raf = requestAnimationFrame(frame);
    if (s.dead) return;
    const pn = performance.now();
    if (fpsCap < 999 && pn - lastF < 1000 / fpsCap - 2) return;
    const dt = Math.min(.1, (pn - (lastF || pn)) / 1000); lastF = pn;
    const t = now(), f = frameAt(TM, t, dt);
    if (t > TM.duration + .8 && !clk.audio) { if (!endT) { endT = 1; stop() } return }
    let si = 0; for (let i = 0; i < SH.length; i++) if (SH[i].t <= t) si = i;
    const shot = SH[si], lt = t - shot.t, u = cl(lt / (shot.t1 - shot.t));
    /* bursts cut on every second fast beat (the 89 BPM pulse): every 178 BPM beat reads as strobing */
    const fi = lastIdx(TM.beats, t), sid = shot.id === "burst" ? shot.ids[((fi - lastIdx(TM.beats, shot.t + .01)) % shot.ids.length + shot.ids.length) % shot.ids.length] : shot.id;
    if (shot !== lastShot) { lastShot = shot }
    /* uniforms */
    skyU.uTime.value = t;
    skyU.uStars.value = t < tLone ? 0 : mix(.15, 1, sm(tLone, tLone + (tC1 - tLone) * .6, t)) * (1 + f.pulse * .25);
    skyU.uBandOn.value = shot.id === "diptych" ? 1 : 0; skyU.uBand.value = mix(-1.4, 1.4, ((f.bar % 4) + 4) % 4 / 4);
    skyU.uFlash.value = f.accent * .05;
    lakeU.uRip.value = shot.id === "lone" || shot.id === "title" || shot.id === "outro" ? .35 : 1 + f.pulse * .6;
    const wt = t - tImp; lakeU.uWave.value.set(0, -6, wt >= 0 && wt < 6 ? wt : -1, 0);
    ring.visible = wt >= 0 && wt < 3; if (ring.visible) { ring.scale.setScalar(.5 + wt * 24); ring.material.opacity = Math.exp(-wt * 1.1) }
    cordMat.uniforms.uGrow.value = mix(.0, 1, eo((t - sectionT(TM, "verse1", 24)) / (tC1 - sectionT(TM, "verse1", 24)))) * 1.001;
    cordMat.uniforms.uPulse.value = .4 + f.pulse; cord.visible = t > sectionT(TM, "verse1", 24) && shot.id !== "knot" && shot.id !== "outro";
    knot.visible = shot.id === "knot" || shot.id === "outro"; knotMat.uniforms.uGrow.value = shot.id === "knot" ? eio(u * 1.08) * 1.001 : 1.001; knotMat.uniforms.uPulse.value = .3 + f.pulse;
    knotMat.uniforms.uGlow.value = shot.id === "outro" ? .4 : 1;
    lanterns(t, f); comets(t, f);
    tokyo.update && tokyo.update(f);
    if (tokyo.setVisible) tokyo.setVisible(!(shot.id === "title"));
    if (bloom) bloom.strength = .38 + f.accent * .3 + (shot.flash ? Math.exp(-lt * 2.5) * .5 : 0);
    ptU.uScale.value = (H * R.getPixelRatio()) / (2 * Math.tan(cam.fov * PI / 360));
    /* camera + render */
    const dip = TM.cues.dip !== undefined && t >= TM.cues.dip && t < sectionT(TM, "verse1", 24);
    const black = shot.id === "title" || dip ? 1 : shot.id === "lone" ? 1 - sm(0, TM.bp * 6, lt) : 0;
    if (black < 1) {
      if (shot.id === "diptych") {
        const k = Math.floor(f.bar), sp = mix(k % 2 ? .4 : .6, k % 2 ? .6 : .4, eo(f.barPhase * 4)) ;
        const xL = Math.round(W * sp);
        shotCam(cam, "diptych", lt, u, f, 0); render(cam, [0, 0, xL, H], true);
        shotCam(camB, "diptych", lt, u, f, 1); render(camB, [xL, 0, W - xL, H], true);
        s.split = xL;
      } else { shotCam(cam, sid, lt, sid === shot.id ? u : .5 + .5 * Math.sin(fi), f); render(cam, [0, 0, W, H], false); s.split = 0 }
    } else R.clear();
    draw2D(t, f, shot, lt, u, black);
  }

  /* ---------- 2D layer ---------- */
  function draw2D(t, f, shot, lt, u, black) {
    const w = W * d2, h = H * d2, k = d2;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
    if (black > 0) { g.fillStyle = `rgba(0,0,0,${black})`; g.fillRect(0, 0, w, h) }
    /* title: an ink flame, then 夢灯籠 brushed in one glyph per bar */
    if (shot.id === "title" || (shot.id === "lone" && lt < TM.bp * 8)) {
      const a = shot.id === "title" ? sm(0, .8, t) : 1 - sm(TM.bp * 2, TM.bp * 7, lt);
      const fx0 = w / 2, fy = h * .64, fr = Math.min(w, h) * (.05 + .015 * f.pulse);
      const gr = g.createRadialGradient(fx0, fy, 0, fx0, fy, fr * 3); gr.addColorStop(0, `rgba(255,214,150,${.9 * a})`); gr.addColorStop(.25, `rgba(255,140,60,${.35 * a})`); gr.addColorStop(1, "rgba(255,100,40,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(fx0, fy, fr * 3, 0, TAU); g.fill();
      const t0 = TM.downbeats[0] !== undefined ? TM.downbeats[0] : TM.bp * 4, size = Math.min(w * .2, h * .24);
      ["夢", "灯", "籠"].forEach((ch, i) => {
        const p = cl((t - t0 - i * TM.bp * 4) / (TM.bp * 3));
        if (p > 0) drawInk(g, ch, { x: w / 2 + (i - 1) * size * 1.05, y: h * .4, size, progress: p, alpha: a, color: "#f3e6cf", seed: i + 1 });
      });
      const sa = a * sm(t0 + TM.bp * 12, t0 + TM.bp * 14, t);
      if (sa > 0) { g.globalAlpha = sa; g.fillStyle = "#f3e6cf"; g.font = `500 ${Math.round(size * .14)}px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText("DREAM LANTERN  ·  RADWIMPS", w / 2, h * .4 + size * .78); g.globalAlpha = 1 }
    }
    /* build: one kanji per beat, brushed fast */
    if (shot.id === "dive") {
      const gl = ["結", "時", "夢", "灯", "籠"], bi = Math.floor(f.beat), size = Math.min(w, h) * .42;
      g.save(); g.globalAlpha = .9 * (1 - f.beatPhase * .6);
      drawInk(g, gl[((bi % gl.length) + gl.length) % gl.length], { x: w / 2 + (bi % 2 ? 1 : -1) * w * .16, y: h * .48, size, progress: cl(f.beatPhase * 3.2), alpha: 1, color: "#fff4e2", seed: bi });
      g.restore();
    }
    /* outro title, then fade to black on the last downbeat */
    if (shot.id === "outro") {
      const a = sm(0, TM.bp * 4, lt), size = Math.min(w * .12, h * .14);
      ["夢", "灯", "籠"].forEach((ch, i) => drawInk(g, ch, { x: w / 2 + (i - 1) * size * 1.05, y: h * .3, size, progress: cl((lt - i * TM.bp) / (TM.bp * 2)), alpha: a * .92, color: "#f6ead6", seed: i + 4 }));
      const end = sm(TM.cues.end || TM.duration - TM.bp * 3, TM.duration - .1, t);
      if (end > 0) { g.fillStyle = `rgba(0,0,0,${end})`; g.fillRect(0, 0, w, h) }
    }
    /* diptych: a torn washi seam between the two halves */
    if (shot.id === "diptych" && s.split) {
      const x = s.split * k; g.save(); g.fillStyle = washiPat; g.beginPath(); g.moveTo(x - 7 * k, 0);
      for (let y = 0; y <= h; y += 14 * k) g.lineTo(x - (5 + hash(y * .37) * 5) * k, y);
      for (let y = h; y >= 0; y -= 14 * k) g.lineTo(x + (5 + hash(y * .61 + 3) * 5) * k, y);
      g.closePath(); g.fill(); g.strokeStyle = "#b3131b"; g.lineWidth = 2.2 * k; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.restore();
    }
    /* the cut: a sheet of washi sweeps across with the red cord on its edge, fully covering the frame on the downbeat */
    for (const sh of SH) {
      if (!sh.wipe) continue; const p = (t - sh.t) / .5 + .5; if (p <= 0 || p >= 1) continue;
      const x0 = mix(-1.5, 1.1, p) * w, bw = 1.3 * w, sk = .12 * Math.min(w, h);
      g.save(); g.beginPath(); g.moveTo(x0 + sk, 0);
      for (let y = 0; y <= h; y += 18 * k) g.lineTo(x0 + sk * (1 - y / h) + hash(y * .13 + sh.t) * 9 * k, y);
      g.lineTo(x0 + bw, h); for (let y = h; y >= 0; y -= 18 * k) g.lineTo(x0 + bw + sk * (1 - y / h) + hash(y * .29 + sh.t) * 9 * k, y);
      g.closePath(); g.fillStyle = washiPat; g.fill();
      g.lineWidth = 5 * k; g.strokeStyle = "#b3131b"; g.beginPath(); g.moveTo(x0 + bw + sk, 0); g.lineTo(x0 + bw, h); g.stroke();
      g.lineWidth = 1.6 * k; g.strokeStyle = "#f0b23c"; g.setLineDash([10 * k, 8 * k]); g.lineDashOffset = -t * 200; g.stroke(); g.restore();
    }
    /* flash on the big hits and accents */
    const fl = (shot.flash ? Math.exp(-lt * 3.2) * .55 * shot.flash : 0) + f.accent * .12;
    if (fl > .005) { g.fillStyle = `rgba(255,236,206,${Math.min(.9, fl)})`; g.fillRect(0, 0, w, h) }
    /* letterbox, vignette, grain */
    const lb = h * .085 * (shot.id === "title" ? 0 : 1);
    if (lb > 0) { g.fillStyle = "#000"; g.fillRect(0, 0, w, lb); g.fillRect(0, h - lb, w, lb) }
    if (vig) { g.fillStyle = vig; g.fillRect(0, 0, w, h) }
    g.save(); g.globalAlpha = tier === "saver" ? .035 : .05; g.translate(-Math.random() * 160, -Math.random() * 160); g.fillStyle = grainPat; g.fillRect(0, 0, w + 160, h + 160); g.restore();
  }
  s.state = () => { const t = now(), f = frameAt(TM, t, 0); let si = 0; for (let i = 0; i < SH.length; i++) if (SH[i].t <= t) si = i; return { t, tier, shot: SH[si].id, audio: !!clk.audio, audioT: clk.audio ? clk.audio.currentTime : null, beat: f.beat, bar: f.bar, section: f.section, shots: SH.map(x => [x.id, +x.t.toFixed(3)]) } };
  s.clk = clk; s.stopRaf = () => cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

/* ---------- stand-ins used until the parallel modules land ---------- */
function inkStandIn(g, glyph, { x, y, size, progress, alpha = 1, color = "#1a1410" }) {
  if (progress <= 0 || alpha <= 0) return;
  g.save(); g.globalAlpha = alpha; g.beginPath(); g.rect(x - size, y - size * .6, size * 2, size * 1.2 * eo(progress)); g.clip();
  g.fillStyle = color; g.font = `700 ${Math.round(size)}px ${MIN}`; g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = "rgba(255,170,90,.45)"; g.shadowBlur = size * .08; g.fillText(glyph, x, y); g.restore();
}
function tokyoStandIn(THREE, scene, tier) {
  const n = { saver: 260, smooth: 800, ultra: 2200 }[tier], grp = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0x0b0f2a, fog: false });
  const m = new THREE.InstancedMesh(geo, mat, n), M = new THREE.Matrix4(), col = new THREE.Color();
  const win = new THREE.BufferGeometry(), wp = [], wc = [];
  for (let i = 0; i < n; i++) {
    const x = (hash(i * 1.1) - .5) * 170, z = -15 - Math.pow(hash(i * 2.3), .8) * 110, hgt = 4 + Math.pow(hash(i * 3.7), 3) * 22 * (1 - Math.abs(x) / 120), wd = 2 + hash(i * 4.1) * 3.5;
    M.makeScale(wd, hgt, wd).setPosition(x, 62 - hgt, z); m.setMatrixAt(i, M); m.setColorAt(i, col.setHSL(.64 + hash(i) * .06, .5, .5 + hash(i * 5) * .5));
    for (let j = 0; j < 3; j++) { wp.push(x + (hash(i * 7 + j) - .5) * wd, 62 - hgt * hash(i * 9 + j * 3), z + wd / 2 + .05); const warm = hash(i * 11 + j) < .6; wc.push(warm ? 1.4 : .9, warm ? .9 : 1, warm ? .45 : 1.3) }
  }
  grp.add(m);
  win.setAttribute("position", new THREE.Float32BufferAttribute(wp, 3)); win.setAttribute("color", new THREE.Float32BufferAttribute(wc, 3));
  const pts = new THREE.Points(win, new THREE.PointsMaterial({ size: .6, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  grp.add(pts); scene.add(grp);
  return {
    group: grp,
    update(f) { pts.material.opacity = .65 + .35 * f.pulse + .3 * f.accent; grp.rotation.z = f.section === "chorus2" ? f.secT * .25 * Math.sin(f.t * .2) : 0 },
    setVisible(on) { grp.visible = on },
    dispose() { scene.remove(grp); geo.dispose(); mat.dispose(); m.dispose(); win.dispose(); pts.material.dispose() }
  };
}

function teardown(s) {
  s.dead = true;
  try { s.stopRaf && s.stopRaf() } catch (e) { }
  (s.off || []).forEach(f => { try { f() } catch (e) { } });
  const c = s.clk;
  if (c && c.audio) { try { c.audio.pause(); c.audio.removeAttribute("src"); c.audio.load() } catch (e) { } }
  if (c && c.url) URL.revokeObjectURL(c.url);
  (s.mods || []).forEach(m => { try { m && m.dispose && m.dispose() } catch (e) { } });
  if (s.scene) s.scene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const ms = o.material ? [].concat(o.material) : [];
    ms.forEach(m => { for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose() } m.dispose() });
    if (o.isInstancedMesh) o.dispose();
  });
  try { s.comp && s.comp.dispose && s.comp.dispose() } catch (e) { }
  if (s.refRT) s.refRT.dispose();
  if (s.R) { try { s.R.dispose(); s.R.forceContextLoss() } catch (e) { } }
  const el = s.el;
  if (el) { el.style.opacity = "0"; setTimeout(() => el.remove(), 600) }
  try { const i = document.getElementById("gsearch"); i && i.focus && i.focus({ preventScroll: true }) } catch (e) { }
}
