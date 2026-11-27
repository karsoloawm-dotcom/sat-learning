/* Dream Lantern scene module "stairs" (outro, shots 87 to 93): high-key morning, the stairs, the meeting.
   street  - two round traffic mirrors on an orange pole, in focus; sunlit leaves blur in front, the street is a blur of light behind.
   lane    - a narrow lane into a low sun; an empty yellow bicycle coasts away, its long shadow trailing back toward us.
   wide, flight:climb, flight:pass, landing - one hillside stone stair with red rails above a town. Two faceless shadow figures:
             one at the top and one at the bottom, then climbing and descending on the beat, passing; a red cord flutters on the rail;
             the landing looks out over the sunlit streets for the end title.
   Built with the kit (toon materials, particles, haze, look()); the sky, the street and every texture are painted once in create(). */
export async function create({ THREE, scene, camera, ctx2d, back2d, kit, tier, timing, seed = 1 }) {
  const SEC = "outro", TQ = { saver: 0, smooth: 1, ultra: 2 }[tier] ?? 1, q = (...a) => a[TQ];
  const PX = q(1280, 2048, 2560); /* long side of the back paintings */
  const V = (x, y, z) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0), ONE = V(1, 1, 1);
  const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), mix = (a, b, k) => a + (b - a) * k;
  const sm = (a, b, x) => { x = cl((x - a) / (b - a)); return x * x * (3 - 2 * x) };
  const prng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
  const R = prng(seed * 977 + 11);

  /* what this module makes outside the kit; freed in dispose() */
  const GEOS = new Set(), MATS = new Set(), INST = [], CANV = [];
  const geo = g => (GEOS.add(g), g), bmat = m => (MATS.add(m), m);
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; CANV.push(c); return c };
  const scratch = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c };
  const TOONS = [];
  const toon = o => { const m = kit.toon(Object.assign({ section: SEC }, o)); TOONS.push(m); return m };
  const paint = (w, h, fn, rep) => { const t = kit.paint(w, h, fn); if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t };
  const inst = (g, m, n) => { const im = new THREE.InstancedMesh(g, m, n); INST.push(im); return im };

  /* ---------- geometry helpers: parts merged into one mesh (vertex colours), so a set costs few draw calls ---------- */
  function merge(parts) {
    let nv = 0, ni = 0;
    for (const p of parts) { const n = p.g.attributes.position.count; nv += n; ni += p.g.index ? p.g.index.count : n }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
    const v = new THREE.Vector3(), nm = new THREE.Matrix3(), c = new THREE.Color(); let ov = 0, oi = 0;
    for (const { g, m, color, us = 1, vs = 1 } of parts) {
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, n = P.count;
      if (m) nm.getNormalMatrix(m); c.set(color || "#ffffff");
      for (let i = 0; i < n; i++) {
        const o = (ov + i) * 3;
        v.fromBufferAttribute(P, i); if (m) v.applyMatrix4(m); pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z;
        v.fromBufferAttribute(N, i); if (m) v.applyMatrix3(nm).normalize(); nor[o] = v.x; nor[o + 1] = v.y; nor[o + 2] = v.z;
        if (U) { uv[(ov + i) * 2] = U.getX(i) * us; uv[(ov + i) * 2 + 1] = U.getY(i) * vs }
        col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.getX(i) + ov; else for (let i = 0; i < n; i++) idx[oi + i] = ov + i;
      ov += n; oi += g.index ? g.index.count : n; g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    out.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); out.setAttribute("color", new THREE.BufferAttribute(col, 3)); out.setIndex(new THREE.BufferAttribute(idx, 1));
    return geo(out);
  }
  const at = (x, y, z, ry = 0, s = ONE) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, ry), s);
  const rod = (a, b, r, color, seg = 6) => { const d = b.clone().sub(a), l = d.length(); return { g: new THREE.CylinderGeometry(r, r, l, seg, 1), m: new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), ONE), color } };
  const box = (x, y, z, w, h, d, color, us, vs, ry = 0) => ({ g: new THREE.BoxGeometry(w, h, d), m: at(x, y, z, ry), color, us, vs });
  const wire = (a, b, sag, color) => { const mid = a.clone().add(b).multiplyScalar(.5); mid.y -= sag * 2; return { g: new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 12, .018, 3, false), color } };
  function prism() { /* a gable roof over a unit footprint, ridge along z */
    const p = [-.5, 0, .5, .5, 0, .5, 0, 1, .5, .5, 0, -.5, -.5, 0, -.5, 0, 1, -.5, -.5, 0, .5, 0, 1, .5, 0, 1, -.5, -.5, 0, .5, 0, 1, -.5, -.5, 0, -.5,
      .5, 0, .5, .5, 0, -.5, 0, 1, -.5, .5, 0, .5, 0, 1, -.5, 0, 1, .5];
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(p.length / 3 * 2), 2)); g.computeVertexNormals(); return geo(g);
  }
  function blob() { /* a lumpy tree crown: a sphere pushed in and out, normals kept round so it shades like a soft painted clump */
    const g = new THREE.SphereGeometry(1, q(10, 14, 18), q(7, 10, 12)), P = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const k = 1 + .17 * Math.sin(5 * v.x + 1.3) * Math.sin(4 * v.y + .7) * Math.sin(6 * v.z + 2.1) + .09 * Math.sin(11 * v.x + 9 * v.z); P.setXYZ(i, v.x * k, v.y * k * .86, v.z * k) }
    return geo(g);
  }

  /* ---------- painted textures ---------- */
  const speckle = (g, w, h, n, cols, s = 2) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; const r = s * (.4 + R()); g.fillRect(R() * w, R() * h, r, r) } };
  const tread = paint(512, 128, (g, w, h) => {
    g.fillStyle = "#ddd5c6"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { const x = R() * w, y = R() * h, r = 8 + R() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, R() < .5 ? "rgba(170,160,145,.25)" : "rgba(250,246,236,.35)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r) }
    speckle(g, w, h, 2600, ["rgba(110,104,96,.35)", "rgba(255,255,250,.5)", "rgba(150,140,128,.3)"], 2);
    g.strokeStyle = "rgba(120,110,100,.25)"; g.lineWidth = 1; for (let i = 0; i < 5; i++) { g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) g.lineTo(x += (R() - .3) * 30, y += (R() - .5) * 12); g.stroke() }
    g.fillStyle = "rgba(255,250,238,.55)"; g.fillRect(0, 0, w, 5); g.fillStyle = "rgba(90,84,80,.25)"; g.fillRect(0, h - 6, w, 6);
  });
  const stones = paint(512, 512, (g, w, h) => { /* a dry-laid stone retaining wall: irregular blocks, dark joints, a little moss */
    g.fillStyle = "#6d675e"; g.fillRect(0, 0, w, h);
    const rows = 8, cols = 6, ch = h / rows, cw = w / cols;
    for (let j = -1; j <= rows; j++) for (let i = -1; i <= cols; i++) {
      const x0 = (i + (j & 1) * .5) * cw, y0 = j * ch, pts = [];
      for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + .5, rx = cw * .5 - 3, ry = ch * .5 - 3; pts.push([x0 + cw / 2 + Math.cos(a) * rx * (.86 + R() * .14), y0 + ch / 2 + Math.sin(a) * ry * (.86 + R() * .14)]) }
      const l = 168 + R() * 50 | 0; g.fillStyle = `rgb(${l},${l - 6},${l - 18})`;
      g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
      const gr = g.createLinearGradient(x0, y0, x0 + cw, y0 + ch); gr.addColorStop(0, "rgba(255,248,232,.35)"); gr.addColorStop(.6, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(40,40,70,.3)"); g.fillStyle = gr; g.fill();
      if (R() < .35) { g.fillStyle = `rgba(${90 + R() * 40 | 0},${130 + R() * 40 | 0},70,.45)`; g.beginPath(); g.ellipse(x0 + cw * (.2 + R() * .6), y0 + ch * .8, cw * .25, ch * .12, 0, 0, 6.283); g.fill() }
    }
    speckle(g, w, h, 3000, ["rgba(60,56,50,.3)", "rgba(255,250,240,.3)"], 2);
  }, true);
  const grass = paint(256, 256, (g, w, h) => {
    g.fillStyle = "#79b24e"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.strokeStyle = ["#5f9a3e", "#8ec65a", "#a9d86a", "#4f8a44", "#6aa64a"][i % 5]; g.lineWidth = 1 + R() * 2; const x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 6, y - 4 - R() * 9); g.stroke() }
  }, true);
  const asphalt = paint(256, 256, (g, w, h) => {
    g.fillStyle = "#b4b0a8"; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5000, ["rgba(80,80,86,.35)", "rgba(240,236,226,.45)", "rgba(140,136,130,.4)"], 1.6);
    g.strokeStyle = "rgba(70,70,76,.35)"; g.lineWidth = 1.2; for (let i = 0; i < 4; i++) { g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) g.lineTo(x += (R() - .5) * 26, y += R() * 20); g.stroke() }
    g.fillStyle = "rgba(252,250,244,.92)"; g.fillRect(w * .045, 0, w * .03, h); g.fillRect(w * .925, 0, w * .03, h); /* edge lines */
  }, true);
  const facade = paint(128, 128, (g, w, h) => { /* plaster house wall, two floors of windows (tinted per house) */
    g.fillStyle = "#f6f3ec"; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 500, ["rgba(180,170,150,.18)", "rgba(255,255,255,.4)"], 2);
    for (const y of [.2, .62]) for (const x of [.14, .58]) {
      g.fillStyle = "#d8d2c6"; g.fillRect(x * w - 2, y * h - 2, w * .28 + 4, h * .2 + 4);
      const gr = g.createLinearGradient(0, y * h, 0, (y + .2) * h); gr.addColorStop(0, "#9fc0dc"); gr.addColorStop(.5, "#5d7d9e"); gr.addColorStop(1, "#46607e"); g.fillStyle = gr; g.fillRect(x * w, y * h, w * .28, h * .2);
      g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(x * w + 2, y * h + 2, w * .06, h * .16);
    }
    g.fillStyle = "rgba(120,110,100,.25)"; g.fillRect(0, h * .47, w, 3);
  });
  const blocks = paint(256, 128, (g, w, h) => { /* concrete block fence, a lighter cap row */
    g.fillStyle = "#958f84"; g.fillRect(0, 0, w, h);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const l = 196 + R() * 24 | 0; g.fillStyle = `rgb(${l},${l - 4},${l - 12})`; g.fillRect(i * w / 4 + (j & 1 ? w / 8 : 0) - (j & 1 ? w / 4 : 0) + 2, j * h / 4 + 2, w / 4 - 4, h / 4 - 4); g.fillRect(i * w / 4 + (j & 1 ? w / 8 : 0) + 2, j * h / 4 + 2, w / 4 - 4, h / 4 - 4) }
    g.fillStyle = "#e4ded2"; g.fillRect(0, 0, w, h * .08);
    const gr = g.createLinearGradient(0, h * .7, 0, h); gr.addColorStop(0, "rgba(90,110,60,0)"); gr.addColorStop(1, "rgba(90,110,60,.45)"); g.fillStyle = gr; g.fillRect(0, h * .7, w, h * .3);
    speckle(g, w, h, 1400, ["rgba(70,66,60,.3)", "rgba(255,255,250,.35)"], 1.5);
  }, true);
  const dapple = paint(256, 256, (g, w, h) => { /* leaf texture multiplied over the tree crowns */
    g.fillStyle = "#e9eee0"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { g.fillStyle = R() < .55 ? `rgba(40,70,60,${.18 + R() * .2})` : `rgba(255,255,225,${.25 + R() * .3})`; g.beginPath(); g.ellipse(R() * w, R() * h, 3 + R() * 6, 2 + R() * 3, R() * 3, 0, 6.283); g.fill() }
  }, true);
  const soft = paint(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.55, "rgba(255,255,255,.8)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h) });
  const sunTex = paint(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.12, "rgba(255,250,235,.9)"); gr.addColorStop(.35, "rgba(255,236,200,.25)"); gr.addColorStop(1, "rgba(255,230,190,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h) });
  const cordTex = paint(256, 16, (g, w, h) => { /* the braided cord: scarlet with gold twill, an indigo and white band near the end */
    g.fillStyle = "#c8182a"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,196,90,.75)"; g.lineWidth = 1.4; for (let x = -16; x < w; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, h); g.stroke() }
    g.fillStyle = "#25306e"; g.fillRect(w * .78, 0, w * .07, h); g.fillStyle = "#f4f0e6"; g.fillRect(w * .85, 0, w * .03, h); g.fillStyle = "#25306e"; g.fillRect(w * .88, 0, w * .04, h);
  }, true);
  const leafTex = paint(512, 512, (g, w, h) => { /* a sunlit leafy spray, pre-blurred: it sits out of focus in front of the lens */
    const c = scratch(w, h), k = c.getContext("2d");
    k.strokeStyle = "#3f4a2c"; k.lineWidth = 7; k.lineCap = "round"; k.beginPath(); k.moveTo(-10, h * .15); k.bezierCurveTo(w * .3, h * .2, w * .55, h * .45, w * .95, h * .62); k.stroke();
    for (let i = 0; i < 90; i++) {
      const s = R(), x = mix(-10, w * .95, s) + (R() - .5) * 60, y = h * (.15 + .47 * s * s) + (R() - .5) * 120 * (1 - s * .4), a = (R() - .5) * 2.4 + .4, lit = R() < .62;
      k.save(); k.translate(x, y); k.rotate(a); const L = 30 + R() * 26, Wd = 11 + R() * 7;
      const gr = k.createLinearGradient(-L, 0, L, 0); gr.addColorStop(0, lit ? "#c9ee70" : "#3e7d4c"); gr.addColorStop(1, lit ? "#78c040" : "#2b5d5e");
      k.fillStyle = gr; k.beginPath(); k.ellipse(0, 0, L, Wd, 0, 0, 6.283); k.fill();
      k.strokeStyle = lit ? "rgba(255,255,200,.5)" : "rgba(160,220,160,.25)"; k.lineWidth = 1.5; k.beginPath(); k.moveTo(-L * .9, 0); k.lineTo(L * .9, 0); k.stroke(); k.restore();
    }
    g.filter = "blur(5px)"; g.drawImage(c, 0, 0); g.filter = "none"; c.width = 0;
  });
  /* the two people: faceless silhouettes, side poses (climb, passing, descend) and a front pose; a warm rim where the sky lights them */
  const atlas = paint(512, 512, g => {
    const poses = ["climb", "pass", "desc", "stand"], tmp = scratch(512, 512), t = tmp.getContext("2d");
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const cx = c * 128 + 64, fy = r * 256 + 250;
      figure(g, cx, fy, r, poses[c], "#1c2250");
      t.clearRect(0, 0, 512, 512); t.globalCompositeOperation = "source-over"; figure(t, cx, fy, r, poses[c], "#ffd6a4");
      t.globalCompositeOperation = "destination-out"; t.save(); t.translate(3.5, 2.5); figure(t, cx, fy, r, poses[c], "#000"); t.restore();
      g.globalCompositeOperation = "source-atop"; g.drawImage(tmp, 0, 0); g.globalCompositeOperation = "source-over";
    }
    tmp.width = 0;
  });
  function figure(g, cx, fy, who, pose, col) {
    g.fillStyle = g.strokeStyle = col; g.lineCap = g.lineJoin = "round";
    const seg = (a, b, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke() };
    const disc = (x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.283); g.fill() };
    const tw = who ? 25 : 29, hairLong = who === 1;
    if (pose === "stand") {
      const y = fy; seg([cx - 8, y - 112], [cx - 9, y - 6], 16); seg([cx + 8, y - 112], [cx + 9, y - 6], 16);
      disc(cx - 10, y - 4, 8, 5); disc(cx + 10, y - 4, 8, 5);
      seg([cx, y - 118], [cx, y - 184], tw + 10);
      seg([cx - tw * .7, y - 182], [cx - tw * .8, y - 142], 11); seg([cx - tw * .8, y - 142], [cx - tw * .78, y - 106], 10);
      seg([cx + tw * .7, y - 182], [cx + tw * .8, y - 142], 11); seg([cx + tw * .8, y - 142], [cx + tw * .78, y - 106], 10);
      seg([cx, y - 190], [cx, y - 202], 11); disc(cx, y - 214, 15, 16);
      if (hairLong) disc(cx, y - 204, 18, 22); else disc(cx, y - 217, 16.5, 15);
      return;
    }
    /* side poses, facing +x: [thigh, shin] angles from straight down, + forward */
    const L = { climb: [[.95, -.05], [-.25, -.3]], pass: [[.45, -.35], [.02, .02]], desc: [[.32, .38], [-.18, -.75]] }[pose];
    const A = { climb: [[.55, 1.1], [-.45, -.25]], pass: [[.12, .35], [-.1, .1]], desc: [[.35, .7], [-.3, -.1]] }[pose];
    const lean = pose === "climb" ? .12 : pose === "desc" ? -.04 : .04;
    const end = (a, [t1, t2], l1, l2) => { const k = [a[0] + Math.sin(t1) * l1, a[1] + Math.cos(t1) * l1]; return [k, [k[0] + Math.sin(t2) * l2, k[1] + Math.cos(t2) * l2]] };
    const legs = L.map(p => end([0, 0], p, 60, 58)), drop = Math.max(legs[0][1][1], legs[1][1][1]);
    const hip = [cx, fy - drop - 4], sh = [hip[0] + Math.sin(lean) * 76, hip[1] - Math.cos(lean) * 76];
    for (const [k, e] of legs) { const K = [hip[0] + k[0], hip[1] + k[1]], E = [hip[0] + e[0], hip[1] + e[1]]; seg(hip, K, 17); seg(K, E, 13); disc(E[0] + 6, E[1] + 1, 10, 5) }
    seg([hip[0], hip[1] - 6], [sh[0], sh[1] + 8], tw);
    for (const p of A) { const [k, e] = end(sh, p, 46, 42); seg(sh, k, 12); seg(k, e, 10) }
    if (!who) { g.beginPath(); g.roundRect(hip[0] - 26, hip[1] - 30, 17, 24, 4); g.fill(); seg([sh[0] + 4, sh[1]], [hip[0] - 18, hip[1] - 26], 3) }
    const hd = [sh[0] + Math.sin(lean) * 26 + 3, sh[1] - 24]; seg(sh, hd, 11); disc(hd[0], hd[1], 15, 16);
    if (hairLong) disc(hd[0] - 7, hd[1] + 8, 12, 21); else disc(hd[0] - 2, hd[1] - 3, 16.5, 15);
  }
  const mirrorTex = [0, 1].map(kind => paint(256, 256, (g, w, h) => { /* what the two round mirrors see: the stair and the sky */
    g.save(); g.beginPath(); g.arc(128, 128, 124, 0, 6.283); g.clip();
    let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#4f97e2"); gr.addColorStop(.55, "#bfe0f6"); gr.addColorStop(1, "#f3efe4"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (kind === 0) {
      g.fillStyle = "#cfc8ba"; g.beginPath(); g.arc(128, 470, 300, 0, 6.283); g.fill();
      for (let i = 0; i < 9; i++) { const a = -1.2 + i * .3; g.save(); g.translate(128, 470); g.rotate(a); g.fillStyle = ["#efe6d6", "#f6f1e8", "#e6dccb", "#f0e2d0"][i % 4]; g.fillRect(-26, -318, 46, 44 + (i * 7 % 30)); g.fillStyle = "#5f7c9a"; g.fillRect(-16, -308, 10, 10); g.fillRect(2, -308, 10, 10); g.restore() }
      g.fillStyle = "#e9e3d6"; g.beginPath(); g.moveTo(108, 256); g.lineTo(122, 150); g.lineTo(136, 150); g.lineTo(152, 256); g.fill();
      g.strokeStyle = "#d43c2c"; g.lineWidth = 3; g.beginPath(); g.moveTo(104, 256); g.lineTo(120, 146); g.moveTo(156, 256); g.lineTo(138, 146); g.stroke();
      g.fillStyle = "#4f9a44"; for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(R() < .5 ? 20 + R() * 50 : 190 + R() * 50, 120 + R() * 60, 10 + R() * 14, 0, 6.283); g.fill() }
    } else {
      for (let i = 0; i < 40; i++) { const x = 70 + R() * 140, y = 150 - R() * 70 * (1 - Math.abs(x - 140) / 90); const r = 16 + R() * 22; gr = g.createRadialGradient(x - 5, y - 6, 0, x, y, r); gr.addColorStop(0, "#ffffff"); gr.addColorStop(.7, "#eef3fb"); gr.addColorStop(1, "rgba(220,230,245,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill() }
      g.strokeStyle = "rgba(50,56,64,.8)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 60); g.quadraticCurveTo(128, 90, 256, 50); g.moveTo(0, 78); g.quadraticCurveTo(128, 108, 256, 70); g.stroke();
      g.fillStyle = "#3f8a48"; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(R() * 256, 230 + R() * 40, 14 + R() * 18, 0, 6.283); g.fill() }
    }
    gr = g.createLinearGradient(40, 30, 150, 140); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(.45, "rgba(255,255,255,.55)"); gr.addColorStop(.6, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    gr = g.createRadialGradient(128, 128, 90, 128, 128, 126); gr.addColorStop(0, "rgba(40,50,80,0)"); gr.addColorStop(1, "rgba(40,50,80,.35)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.restore();
  }));

  /* ---------- the back paintings: one high-key sky, and the street as a blur of light ---------- */
  const skyC = canvas(PX, PX >> 1), HZ = .78;
  {
    const g = skyC.getContext("2d"), w = skyC.width, h = skyC.height, hz = h * HZ;
    let gr = g.createLinearGradient(0, 0, 0, h);
    [[0, "#2c78d4"], [.3, "#4e9ae6"], [.56, "#8ec4f2"], [.72, "#cfe7f6"], [.78, "#edf5f1"], [1, "#f1eee2"]].forEach(([k, c]) => gr.addColorStop(k, c));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const cc = scratch(w, h), k = cc.getContext("2d");
    k.strokeStyle = "rgba(255,255,255,.3)"; k.lineCap = "round";
    for (let i = 0; i < 16; i++) { const x = R() * w, y = h * (.04 + R() * .3), l = w * (.06 + R() * .16); k.lineWidth = h * (.003 + R() * .008); k.beginPath(); k.moveTo(x, y); k.bezierCurveTo(x + l * .3, y - h * .02, x + l * .6, y + h * .015, x + l, y - h * .01); k.stroke() }
    const towers = [[.16, .34], [.62, .44], [.9, .3]];
    for (let i = 0; i < 9; i++) {
      const tall = towers[i], cx = tall ? tall[0] * w : (i + R()) / 9 * w, base = hz - h * (.005 + R() * .03), cw = w * (tall ? .16 : .06 + R() * .08), ch = h * (tall ? tall[1] : .05 + R() * .08);
      const P = []; for (let j = 0; j < (tall ? 70 : 26); j++) { const u = R() - .5, top = ch * Math.pow(Math.max(0, 1 - 4 * u * u), .55); const r = (.16 + .28 * R()) * Math.min(cw, ch * 1.4) * (.55 + .45 * (1 - Math.abs(2 * u))); P.push([cx + u * cw, base - R() * top * .82 - r * .4, r]) }
      k.save(); k.beginPath(); k.rect(0, 0, w, base); k.clip();
      for (const [x, y, r] of P) { k.fillStyle = "#b9cbe8"; k.beginPath(); k.arc(x, y + r * .12, r, 0, 6.283); k.fill() }
      for (const [x, y, r] of P) { gr = k.createRadialGradient(x - r * .32, y - r * .38, 0, x, y, r); gr.addColorStop(0, "#ffffff"); gr.addColorStop(.55, "#f7f9fd"); gr.addColorStop(.85, "rgba(226,234,248,.6)"); gr.addColorStop(1, "rgba(214,226,246,0)"); k.fillStyle = gr; k.beginPath(); k.arc(x, y - r * .08, r * .95, 0, 6.283); k.fill() }
      for (const [x, y, r] of P) if (R() < .3) { k.fillStyle = "rgba(255,244,222,.55)"; k.beginPath(); k.arc(x - r * .35, y - r * .45, r * .35, 0, 6.283); k.fill() }
      k.restore();
    }
    g.filter = `blur(${(w * .0011).toFixed(2)}px)`; g.drawImage(cc, 0, 0); g.filter = "none"; cc.width = 0;
    gr = g.createLinearGradient(0, hz - h * .1, 0, hz + h * .01); gr.addColorStop(0, "rgba(236,244,242,0)"); gr.addColorStop(1, "rgba(236,244,242,.95)"); g.fillStyle = gr; g.fillRect(0, hz - h * .1, w, h * .11);
    for (let i = 0; i < 220; i++) { const x = R() * w, bw = w * (.002 + R() * .01), bh = h * (.004 + Math.pow(R(), 3) * .05); g.fillStyle = `rgba(${150 + R() * 30 | 0},${182 + R() * 25 | 0},${212 + R() * 20 | 0},${.3 + R() * .3})`; g.fillRect(x, hz - bh, bw, bh + 2) }
    gr = g.createLinearGradient(0, hz - h * .05, 0, hz + 2); gr.addColorStop(0, "rgba(238,245,242,0)"); gr.addColorStop(1, "rgba(238,245,242,.7)"); g.fillStyle = gr; g.fillRect(0, hz - h * .05, w, h * .05 + 2);
    g.fillStyle = "#eef2ea"; g.fillRect(0, hz + 2, w, h - hz);
  }
  const streetC = canvas(PX, PX * 9 / 16 | 0);
  {
    const g = streetC.getContext("2d"), w = streetC.width, h = streetC.height, c = scratch(w, h), k = c.getContext("2d");
    k.drawImage(skyC, skyC.width * .2, 0, skyC.width * .5, skyC.height * .78, 0, 0, w, h * .62);
    const bld = (x, y, bw, bh, col) => { k.fillStyle = col; k.fillRect(x, y, bw, bh); for (let yy = y + bh * .06; yy < y + bh - h * .05; yy += h * .085) for (let xx = x + bw * .08; xx < x + bw - w * .03; xx += w * .05) { k.fillStyle = "#6f8fae"; k.fillRect(xx, yy, w * .028, h * .045); k.fillStyle = "rgba(255,255,255,.8)"; k.fillRect(xx + 2, yy + 2, w * .008, h * .03) } };
    bld(w * .52, h * .24, w * .3, h * .56, "#f4f1ea"); bld(-w * .02, h * .12, w * .3, h * .7, "#efe3cf"); bld(w * .27, h * .38, w * .2, h * .42, "#e8ddd0");
    const tree = (x, y, r, n) => { for (let i = 0; i < n; i++) { const a = R() * 6.283, d = R() * r, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .8, rr = r * (.25 + R() * .3); k.fillStyle = py < y ? (R() < .5 ? "#9ed35f" : "#7cbf4c") : (R() < .5 ? "#3f8050" : "#2f6a5a"); k.beginPath(); k.arc(px, py, rr, 0, 6.283); k.fill() } };
    tree(w * .4, h * .42, w * .09, 60); tree(w * .93, h * .3, w * .14, 90); tree(w * .18, h * .78, w * .07, 30);
    k.fillStyle = "#c9c2b6"; k.fillRect(0, h * .78, w, h * .22);
    k.fillStyle = "rgba(255,255,250,.9)"; for (let i = 0; i < 7; i++) { const x = w * (.1 + i * .12); k.beginPath(); k.moveTo(x, h * .84); k.lineTo(x + w * .05, h * .84); k.lineTo(x + w * .07, h); k.lineTo(x - w * .01, h); k.fill() }
    k.fillStyle = "#8d8f90"; k.fillRect(w * .46, 0, w * .014, h * .8); k.fillStyle = "#7a7c80"; k.fillRect(w * .44, h * .12, w * .05, h * .012);
    k.strokeStyle = "#454a52"; k.lineWidth = 3; k.beginPath(); k.moveTo(0, h * .06); k.quadraticCurveTo(w * .3, h * .16, w * .47, h * .13); k.quadraticCurveTo(w * .7, h * .2, w, h * .1); k.stroke();
    k.fillStyle = "#9a9c9e"; k.fillRect(w * .695, h * .5, w * .006, h * .32); k.fillStyle = "#f4f4f4"; k.beginPath(); k.arc(w * .698, h * .48, w * .04, 0, 6.283); k.fill(); k.fillStyle = "#1f5fc4"; k.beginPath(); k.arc(w * .698, h * .48, w * .034, 0, 6.283); k.fill();
    k.strokeStyle = "#fff"; k.lineWidth = w * .007; k.beginPath(); k.moveTo(w * .684, h * .49); k.lineTo(w * .71, h * .49); k.moveTo(w * .7, h * .465); k.lineTo(w * .712, h * .49); k.lineTo(w * .7, h * .515); k.stroke();
    for (let i = 0; i < 50; i++) { k.fillStyle = `rgba(255,${235 + R() * 20 | 0},${200 + R() * 55 | 0},${.5 + R() * .5})`; k.beginPath(); k.arc(R() * w, R() * h * .8, 2 + R() * 5, 0, 6.283); k.fill() }
    g.filter = `blur(${(w * .007).toFixed(1)}px)`; g.drawImage(c, 0, 0); g.filter = "none"; c.width = 0;
    const gr = g.createRadialGradient(w * .08, -h * .05, 0, w * .08, -h * .05, w * .6); gr.addColorStop(0, "rgba(255,246,222,.95)"); gr.addColorStop(.35, "rgba(255,236,200,.4)"); gr.addColorStop(1, "rgba(255,236,200,0)");
    g.globalCompositeOperation = "lighter"; g.fillStyle = gr; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over";
  }

  /* ---------- the hillside stair, its walls, rails and the town below (wide, flight, landing) ---------- */
  const N = 44, RISE = .19, RUN = .36, HW = 1.4, HT = N * RISE, LEN = N * RUN;
  const S = z => cl(-z / LEN) * HT, stepY = k => (k + 1) * RISE, stepZ = k => -(k + .5) * RUN;
  const railY = z => S(z) + RISE * .5 + .9; /* handrail height above the nosing line */
  const root = new THREE.Group(); scene.add(root);
  const world = new THREE.Group(), lane = new THREE.Group(), street = new THREE.Group(), cast = new THREE.Group();
  root.add(world, lane, street, cast);
  scene.fog = new THREE.Fog("#e4eef0", 40, 600);

  const stoneM = toon({ color: "#f2ede4", map: tread, soft: .18, rimK: .35 }), wallM = toon({ color: "#f4efe6", map: stones, soft: .2, rimK: .3 });
  const grassM = toon({ color: "#ffffff", map: grass, soft: .3, rimK: .2 }), groundM = toon({ color: "#d9d3c6", rimK: 0, soft: .4 });
  const asphaltM = toon({ color: "#ffffff", map: asphalt, rimK: 0, soft: .4 }), houseM = toon({ color: "#ffffff", map: facade, soft: .16, rimK: .35 });
  const roofM = toon({ color: "#ffffff", soft: .14, rimK: .5 }), treeM = toon({ color: "#ffffff", map: dapple, light: "#fff3d2", shade: "#5c74ae", rim: "#efffd8", rimK: .55, soft: .3, wrap: .35 });
  const vcM = toon({ vertexColors: true, soft: .2, rimK: .6, rimPow: 2.5 }), blockM = toon({ color: "#ffffff", map: blocks, soft: .2, rimK: .25 });

  const steps = inst(geo(new THREE.BoxGeometry(2 * HW, RISE, RUN)), stoneM, N);
  for (let k = 0; k < N; k++) { steps.setMatrixAt(k, at(0, (k + .5) * RISE, -(k + .5) * RUN)); const l = .93 + R() * .1; steps.setColorAt(k, new THREE.Color(l, l, l * .98)) }
  world.add(steps);
  const profile = (pts, depth, x0, mat, us = .4) => { /* a side shape in (distance up the stair, height), extruded across x */
    const sh = new THREE.Shape(pts.map(([s, y]) => new THREE.Vector2(s, y))), g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
    g.rotateY(Math.PI / 2); g.translate(x0, 0, 0); const U = g.attributes.uv; for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i) * us, U.getY(i) * us);
    const m = new THREE.Mesh(geo(g), mat); world.add(m); return m;
  };
  const stairLine = []; for (let k = 0; k < N; k++) stairLine.push([k * RUN, k * RISE + RISE], [(k + 1) * RUN, k * RISE + RISE]);
  profile([[0, -1], ...stairLine, [LEN + 4.6, HT], [LEN + 4.6, HT - 1.4], [0, -1.2]].map(([s, y]) => [s, y]), .3, HW, wallM);
  profile([[-2, -.5], [-2, 2.2], [0, 2.3], [LEN, HT + 2.3], [LEN + 34, HT + 2.3], [LEN + 34, -.5]], 1.2, -HW - 1.2, wallM);
  const terrace = new THREE.Mesh(geo(new THREE.BoxGeometry(6.6, 1.2, 4.6)), stoneM); terrace.position.set(1.9, HT - .6, -LEN - 2.3); world.add(terrace);

  /* terrain: a plateau above the wall on the left, a slope falling away to the right, the street in front */
  {
    const xs = [-60, -40, -28, -18, -11, -6, -3.2, -2.6, -2, 1.8, 2.6, 4, 6, 9, 13, 18, 25, 34, 45, 60], zs = [-90, -70, -52, -40, -32, -26, -LEN - 4.6, -LEN, -12, -8, -4, -1, .5, 2.5];
    const T = (x, z) => {
      if (z > 1) return x < -2.6 ? Math.max(0, 2.3 - (z - 1) * 2) : 0;
      const s = z < -LEN - 4.6 ? HT + Math.min(5, (-LEN - 4.6 - z) * .12) : S(z);
      if (x < -2.4) return s + 2.3 + (z < -LEN - 4.6 ? Math.max(0, -x - 8) * .05 : 0);
      if (x <= 2) return z < -LEN - 4.6 ? s : s - .8;
      return z < -LEN - 4.6 ? s - Math.max(0, x - 6) * .2 : Math.max(0, s - 1 - (x - 2) * .5);
    };
    const pos = [], uv = [], idx = [];
    zs.forEach(z => xs.forEach(x => { pos.push(x, T(x, z), z); uv.push(x / 5, z / 5) }));
    for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) { const a = j * xs.length + i, b = a + 1, c = a + xs.length, d = c + 1; idx.push(a, c, b, b, c, d) }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    world.add(new THREE.Mesh(geo(g), grassM));
    world.userData.T = T;
  }
  const T = world.userData.T;
  const ground = new THREE.Mesh(geo(new THREE.PlaneGeometry(1600, 900).rotateX(-Math.PI / 2).translate(0, -.03, 450)), groundM); world.add(ground);
  { const g = new THREE.PlaneGeometry(13, 60).rotateX(-Math.PI / 2).translate(0, .01, 29); const U = g.attributes.uv; for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i), U.getY(i) * 60 / 13); world.add(new THREE.Mesh(geo(g), asphaltM)) }

  /* rails, lamp posts, utility poles and wires: one mesh with vertex colours */
  {
    const P = [], RED = "#d8432c", GREY = "#a7a7a1", DARK = "#3b4048";
    for (const x of [-HW + .22, HW - .16]) {
      for (let k = 0; k < N; k += 4) { const z = stepZ(k); P.push(rod(V(x, stepY(k), z), V(x, railY(z) + .03, z), .028, RED)) }
      const z0 = stepZ(0) + .1, z1 = stepZ(N - 1);
      P.push(rod(V(x, railY(z0), z0), V(x, railY(z1), z1), .036, RED, 8), rod(V(x, railY(z0) - .45, z0), V(x, railY(z1) - .45, z1), .022, RED));
      P.push(rod(V(x, stepY(N - 1), z1), V(x, railY(z1) + .03, z1), .028, RED));
    }
    const ty = HT + .95; /* the terrace's overlook rail */
    for (let i = 0; i <= 3; i++) { const x = HW + .1 + i * 1.2; P.push(rod(V(x, HT, -LEN - .1), V(x, ty, -LEN - .1), .028, RED)) }
    for (let i = 1; i <= 3; i++) { const z = -LEN - .1 - i * 1.4; P.push(rod(V(5.1, HT, z), V(5.1, ty, z), .028, RED)) }
    P.push(rod(V(HW + .1, ty, -LEN - .1), V(5.1, ty, -LEN - .1), .036, RED, 8), rod(V(5.1, ty, -LEN - .1), V(5.1, ty, -LEN - 4.4), .036, RED, 8));
    P.push(rod(V(HW + .1, ty - .45, -LEN - .1), V(5.1, ty - .45, -LEN - .1), .022, RED), rod(V(5.1, ty - .45, -LEN - .1), V(5.1, ty - .45, -LEN - 4.4), .022, RED));
    for (const [x, y, z] of [[4.4, HT, -LEN - 3.8], [2.6, 0, 1.2]]) { P.push(rod(V(x, y, z), V(x, y + 4.2, z), .06, GREY), rod(V(x, y + 4.2, z), V(x - .5, y + 4.4, z), .04, GREY), box(x - .62, y + 4.32, z, .34, .12, .22, "#f4f2ea")) }
    const poles = [[-6.4, 3], [6.4, 6], [-6.4, 19], [6.4, 22], [-6.4, 35], [6.4, 38], [6.4, 52], [-6.4, 50]];
    for (const [x, z] of poles) { P.push(rod(V(x, 0, z), V(x, 9.4, z), .15, GREY, 8), box(x, 8.6, z, 1.6, .1, .12, GREY), { g: new THREE.CylinderGeometry(.22, .22, .7, 8), m: at(x + Math.sign(x) * .32, 7.2, z), color: "#8f9294" }) }
    for (const side of [-6.4, 6.4]) { const ps = poles.filter(p => p[0] === side).sort((a, b) => a[1] - b[1]); for (let i = 0; i < ps.length - 1; i++) for (const dx of [-.7, 0, .7]) P.push(wire(V(side + dx, 8.65, ps[i][1]), V(side + dx, 8.65, ps[i + 1][1]), .35 + Math.abs(dx) * .1, DARK)) }
    P.push(wire(V(-6.4, 8.65, 3), V(6.4, 8.65, 6), .4, DARK), wire(V(-6.4, 8.2, 19), V(6.4, 8.2, 22), .5, DARK), wire(V(-6.4, 8.65, 35), V(6.4, 8.65, 38), .4, DARK), wire(V(-6.4, 7.6, 3), V(-2.6, 4.6, -1), .2, DARK));
    world.add(new THREE.Mesh(merge(P), vcM));
  }

  /* houses and trees: instanced. A tight cluster around the stair, then the town spreading toward the haze */
  const boxG = geo(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0)), roofG = prism(), blobG = blob();
  const WALLS = ["#f4efe3", "#efe6d6", "#e9e3d9", "#f7f2e9", "#dedad2", "#f0e2d0", "#e6e9ec", "#f2e9e4"], ROOFS = ["#5d6f86", "#6c7a8a", "#8a4c3c", "#4f5d70", "#9a6a52", "#3f5a6a", "#7a8794", "#4d6a78"];
  const GREENS = ["#5d9c3a", "#6fae45", "#4e8c3c", "#7fb84b", "#579f52", "#88c25a", "#4a8a50"];
  function houses(list, parent) {
    const hm = inst(boxG, houseM, list.length), rm = inst(roofG, roofM, list.length), c = new THREE.Color();
    list.forEach(([x, y, z, w, d, h, ry, flat], i) => {
      hm.setMatrixAt(i, at(x, y, z, ry, V(w, h, d))); hm.setColorAt(i, c.set(WALLS[i * 7 % WALLS.length]));
      rm.setMatrixAt(i, at(x, y + h, z, ry, flat ? V(w * 1.02, .25, d * 1.02) : V(w * 1.12, Math.min(w, d) * .36, d * 1.08))); rm.setColorAt(i, c.set(flat ? "#c9c5bc" : ROOFS[i * 5 % ROOFS.length]));
    });
    parent.add(hm, rm);
  }
  function trees(list, parent) {
    const tm = inst(blobG, treeM, list.length), c = new THREE.Color(), e = new THREE.Euler(), qt = new THREE.Quaternion(), M = new THREE.Matrix4();
    list.forEach(([x, y, z, r], i) => { qt.setFromEuler(e.set(R() * .4, R() * 6.28, R() * .4)); M.compose(V(x, y, z), qt, V(r * (1 + R() * .25), r, r * (1 + R() * .25))); tm.setMatrixAt(i, M); tm.setColorAt(i, c.set(GREENS[i % GREENS.length]).multiplyScalar(.9 + R() * .2)) });
    parent.add(tm);
  }
  {
    const H = [], Tr = [];
    const ok = (x, z) => !(z < 52 && Math.abs(x) < 7.5) && !(x > -3.2 && x < 6 && z < 2 && z > -LEN - 6);
    for (let i = 0; i < 18; i++) { const z = -2 - i * 2.6 - R(), x = -6.5 - R() * 10, w = 5 + R() * 3; H.push([x - w / 2, T(x, z) - .2, z, w, 4.5 + R() * 2, 4.5 + R() * 1.8, R() * .1]) }
    for (let i = 0; i < 16; i++) { const z = -3 - i * 3 - R() * 2, x = 10 + R() * 22; H.push([x, T(x, z) - 3, z, 5 + R() * 3, 5 + R() * 3, 7 + R() * 2, R() * .2 - .1]) }
    for (let i = 0; i < 9; i++) for (const s of [-1, 1]) { const z = 3 + i * 5.5 + R(), w = 6 + R() * 3; H.push([s * (8.2 + w / 2 + R()), 0, z, w, 5 + R() * 2, 5 + R() * 2.5, (R() - .5) * .06, R() < .2]) }
    const nTown = q(450, 1100, 2300);
    for (let i = 0, guard = 0; i < nTown && guard < nTown * 6; guard++) {
      const z = 8 + Math.pow(R(), 1.35) * 640, x = (R() - .5) * 2 * (70 + z * 1.1);
      if (!ok(x, z) || Math.abs(((x + 1700) % 38) - 19) < 3 || Math.abs(((z + 1700) % 31) - 15.5) < 2.4) continue;
      const big = R(), tower = z > 220 && big < .05, apt = !tower && big < .14, w = tower ? 18 + R() * 16 : apt ? 12 + R() * 10 : 6 + R() * 4;
      H.push([x, 0, z, w, tower ? w : apt ? 9 + R() * 6 : 6 + R() * 4, tower ? 40 + R() * 70 : apt ? 10 + R() * 10 : 5 + R() * 2.5, (R() - .5) * .3, tower || apt]); i++;
    }
    houses(H, world);
    for (let z = 1.5; z > -LEN - 8; z -= 1.25) { const x = -3 - R() * 1.6, r = .85 + R() * .9; Tr.push([x, T(-4, z) + r * .45, z, r]) }
    for (let i = 0; i < q(30, 60, 90); i++) { const x = -8 - R() * 40, z = 2 - R() * 60, r = 1.8 + R() * 2.4; Tr.push([x, T(x, z) + r * .9 + R() * 2, z, r]) }
    for (let i = 0; i < q(20, 40, 60); i++) { const z = -1 - R() * (LEN + 4), x = (z > -13 && z < -1 ? 9 : 2.6) + R() * 14, r = .9 + R() * 1.6; Tr.push([x, T(x, z) + r * .6, z, r]) }
    for (let i = 0; i < q(30, 60, 90); i++) { const s = R() < .5 ? -1 : 1, x = s * (4 + R() * 20) + (s > 0 ? 3 : 0), z = -LEN - 7 - R() * 40, r = 2.4 + R() * 2.4; Tr.push([x, T(x, z) + r * .8 + 2 + R() * 3, z, r]) }
    for (let i = 0; i < q(120, 300, 650); i++) { const z = 8 + Math.pow(R(), 1.2) * 500, x = (R() - .5) * 2 * (60 + z), r = 2 + R() * 3; if (ok(x, z)) Tr.push([x, r * .8 + 1.5, z, r]) }
    trees(Tr, world);
  }

  /* the two shadow figures: cards cut from the atlas, turned toward the camera */
  const fig = [0, 1].map(who => {
    const g = geo(new THREE.PlaneGeometry(who ? .86 : .92, who ? 1.72 : 1.84).translate(0, who ? .84 : .9, 0));
    const m = new THREE.Mesh(g, bmat(new THREE.MeshBasicMaterial({ map: atlas, transparent: true, opacity: .92, depthWrite: false })));
    m.renderOrder = 5; world.add(m); return m;
  });
  function pose(m, who, cell, flip) {
    const U = m.geometry.attributes.uv, u0 = cell / 4, u1 = (cell + 1) / 4, v1 = 1 - who / 2, v0 = v1 - .5, a = flip ? u1 : u0, b = flip ? u0 : u1;
    U.setXY(0, a, v1); U.setXY(1, b, v1); U.setXY(2, a, v0); U.setXY(3, b, v0); U.needsUpdate = true;
  }
  /* the red cord tied to the rail: two tails, rebuilt each frame from time (no state) */
  const CORD = 22, cordG = geo(new THREE.BufferGeometry());
  { const p = new Float32Array(2 * 2 * (CORD + 1) * 3), uv = new Float32Array(2 * 2 * (CORD + 1) * 2), idx = [];
    for (let t = 0; t < 2; t++) for (let i = 0; i <= CORD; i++) { const o = (t * (CORD + 1) + i) * 2; uv.set([i / CORD, 0, i / CORD, 1], o * 2); if (i < CORD) idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2) }
    cordG.setAttribute("position", new THREE.BufferAttribute(p, 3).setUsage(THREE.DynamicDrawUsage)); cordG.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); cordG.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(p.length).fill(0).map((_, i) => i % 3 === 0 ? 1 : 0), 3)); cordG.setIndex(idx) }
  const cordM = toon({ color: "#ffffff", map: cordTex, side: THREE.DoubleSide, emissive: new THREE.Color(.16, .01, .02), rimK: .5, soft: .3 });
  const cord = new THREE.Mesh(cordG, cordM); cord.frustumCulled = false; world.add(cord);
  const KNOT_K = 19, knotZ = stepZ(KNOT_K) + .1, knotP = V(HW - .16, railY(knotZ) + .01, knotZ);
  const knot = new THREE.Mesh(geo(new THREE.TorusGeometry(.05, .022, 6, 12)), toon({ color: "#c8182a", emissive: new THREE.Color(.1, 0, 0), rimK: .6 })); knot.position.copy(knotP); knot.rotation.y = Math.PI / 2; world.add(knot);

  /* ---------- the lane (its own little set, far to the side) ---------- */
  const LX = 400;
  lane.position.x = LX;
  {
    const g = new THREE.PlaneGeometry(3.4, 150).rotateX(-Math.PI / 2).translate(0, 0, -70); const U = g.attributes.uv; for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i), U.getY(i) * 150 / 3.4);
    lane.add(new THREE.Mesh(geo(g), asphaltM));
    lane.add(new THREE.Mesh(geo(new THREE.PlaneGeometry(200, 220).rotateX(-Math.PI / 2).translate(0, -.02, -80)), groundM));
    const F = [], P = [], GREY = "#a9a9a3", DARK = "#3b4048";
    for (const s of [-1, 1]) { let z = 6; while (z > -150) { const l = 6 + R() * 12, gap = R() < .5 ? 1.2 + R() * 1.5 : 0; F.push(box(s * 1.82, .75, z - l / 2, .16, 1.5, l, "#ffffff", l / 1.6, 1)); z -= l + gap } }
    lane.add(new THREE.Mesh(merge(F), blockM));
    const poles = [[1.5, -9], [-1.5, -24], [1.5, -38], [1.5, -66], [-1.5, -80], [1.5, -96], [1.5, -126]];
    for (const [x, z] of poles) { P.push(rod(V(x, 0, z), V(x, 8.6, z), .13, GREY, 8), box(x, 7.9, z, 1.4, .09, .1, GREY), { g: new THREE.CylinderGeometry(.2, .2, .6, 8), m: at(x + .3, 6.6, z), color: "#8f9294" }) }
    for (let i = 0; i < poles.length - 1; i++) for (const dx of [-.55, .55]) P.push(wire(V(poles[i][0] + dx, 7.95, poles[i][1]), V(poles[i + 1][0] + dx, 7.95, poles[i + 1][1]), .3, DARK));
    for (const [x, z] of poles) P.push(wire(V(x, 7.4, z), V(x > 0 ? 5 : -5, 4.6, z - 2), .15, DARK));
    lane.add(new THREE.Mesh(merge(P), vcM));
    const H = [], Tr = [];
    for (const s of [-1, 1]) for (let z = 4; z > -150; z -= 7 + R() * 5) { const w = 6 + R() * 3; H.push([s * (3.6 + w / 2 + R() * 2), 0, z, w, 5 + R() * 3, 5.2 + R() * 2.2, (R() - .5) * .08, R() < .12]) }
    H.push([0, 0, -158, 30, 8, 9, 0, true]);
    houses(H, lane);
    for (const s of [-1, 1]) for (let z = 3; z > -150; z -= 2.2 + R() * 5) { const r = .9 + R() * 1.3; Tr.push([s * (2.4 + R() * 1.6), 1.6 + r * .7 + R() * 1.5, z, r]) }
    trees(Tr, lane);
  }
  /* long shadows thrown back toward the camera by the low sun ahead: soft ellipses, one draw call */
  const LANE_SUN = V(.2, .27, -.94).normalize(), sh2 = V(-LANE_SUN.x, 0, -LANE_SUN.z).normalize(), shLen = 1 / Math.tan(Math.asin(LANE_SUN.y));
  {
    const P = [];
    const quad = (x, z, len, w, ang) => ({ g: new THREE.PlaneGeometry(w, len).rotateX(-Math.PI / 2).translate(0, .02, -len / 2), m: new THREE.Matrix4().compose(V(x, 0, z), new THREE.Quaternion().setFromAxisAngle(UP, ang), ONE) });
    const ang = Math.atan2(-sh2.x, -sh2.z);
    for (const [x, z] of [[1.5, -9], [-1.5, -24], [1.5, -38], [1.5, -66], [-1.5, -80], [1.5, -96], [1.5, -126]]) P.push(quad(x, z, 8.6 * shLen, .5, ang));
    for (let z = 4; z > -150; z -= 1.6 + R() * 2) P.push(quad(1.75, z, 2 + R() * 3, .7 + R() * .9, ang + (R() - .5) * .3));
    for (let z = 2; z > -150; z -= 4 + R() * 6) P.push(quad(1.9, z, 4 + R() * 6, 1 + R() * 1.4, ang));
    const m = new THREE.Mesh(merge(P), bmat(new THREE.MeshBasicMaterial({ color: "#3d4f96", map: soft, transparent: true, opacity: .34, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })));
    m.renderOrder = 1; lane.add(m);
  }
  /* the yellow bicycle (a step-through town bike with a front basket), and its long shadow */
  const bike = new THREE.Group(); lane.add(bike);
  {
    const Y = "#f7c21b", D = "#2c2f36", S = "#c9ccd2", P = [], wr = .33;
    for (const z of [.52, -.52]) { P.push({ g: new THREE.TorusGeometry(wr, .026, 6, 28).rotateY(Math.PI / 2), m: at(0, wr, z), color: D }, { g: new THREE.TorusGeometry(wr - .03, .008, 4, 28).rotateY(Math.PI / 2), m: at(0, wr, z), color: S }, { g: new THREE.TorusGeometry(wr + .05, .03, 4, 16, 2.2).rotateY(Math.PI / 2).rotateX(.5), m: at(0, wr, z), color: Y }) }
    const hub = [V(0, wr, .52), V(0, wr, -.52)], bb = V(0, .3, .08), seat = V(0, .86, .3), head = V(0, .82, -.4);
    P.push(rod(hub[0], bb, .02, Y), rod(hub[0], V(0, .78, .34), .018, Y), rod(bb, V(0, .8, .3), .026, Y), rod(bb, V(0, .5, -.25), .03, Y), rod(V(0, .5, -.25), head, .03, Y), rod(head, hub[1], .02, S));
    P.push(rod(head, V(0, 1.02, -.36), .018, S), rod(V(-.28, 1.03, -.3), V(.28, 1.03, -.3), .016, S), box(0, .92, .32, .12, .06, .24, D), box(0, .78, .62, .26, .03, .3, S), box(0, .84, -.64, .34, .24, .3, "#d6d9de"), box(.04, .3, .2, .03, .14, .36, Y));
    const bm = new THREE.Mesh(merge(P), vcM); bike.add(bm); bike.userData.wheels = [];
    const bs = paint(64, 256, (g, w, h) => { g.fillStyle = "#fff"; g.filter = "blur(2px)"; g.lineWidth = 7; g.strokeStyle = "#fff"; for (const y of [.18, .62]) { g.beginPath(); g.ellipse(w / 2, h * y, w * .3, h * .16, 0, 0, 6.283); g.stroke() } g.fillRect(w * .44, h * .2, w * .12, h * .5) });
    const shM = bmat(new THREE.MeshBasicMaterial({ color: "#3d4f96", map: bs, transparent: true, opacity: .4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    const shadow = new THREE.Mesh(geo(new THREE.PlaneGeometry(.9, 1.1 * shLen + 1).rotateX(-Math.PI / 2).translate(0, .025, -((1.1 * shLen + 1) / 2 - .4))), shM);
    shadow.renderOrder = 2; bike.add(shadow); bike.userData.shadow = shadow;
  }

  /* ---------- the street corner: two round mirrors on an orange pole, leaves in front ---------- */
  const SX = -400; street.position.x = SX;
  {
    const O = "#f2782a", P = [rod(V(0, 0, 0), V(0, 3.05, 0), .045, O, 10), rod(V(-.62, 2.86, 0), V(.62, 2.86, 0), .03, O)];
    const mir = [[-.5, .5, .25], [.5, -.42, -.12]];
    mir.forEach(([x, ry, rx]) => { const m = new THREE.Matrix4().compose(V(x, 2.86, .06), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), ONE); P.push({ g: new THREE.CylinderGeometry(.43, .43, .07, 28).rotateX(Math.PI / 2).translate(0, 0, -.04), m, color: O }, { g: new THREE.TorusGeometry(.415, .03, 6, 28), m, color: O }) });
    street.add(new THREE.Mesh(merge(P), vcM));
    mir.forEach(([x, ry, rx], i) => { const f = new THREE.Mesh(geo(new THREE.CircleGeometry(.39, 32)), bmat(new THREE.MeshBasicMaterial({ map: mirrorTex[i], color: new THREE.Color(1.35, 1.32, 1.28) }))); f.position.set(x, 2.86, .06); f.rotation.set(rx, ry, 0); f.translateZ(.005); street.add(f) });
    /* leaves placed in the base camera's view (corners of a 16:9 frame), so they frame the shot out of focus */
    const L = [], bc = new THREE.PerspectiveCamera(23, 16 / 9, .1, 10), th = Math.tan(23 * Math.PI / 360);
    bc.position.set(SX + .95, 2.32, 5.4); bc.lookAt(SX + .1, 2.82, 0); bc.updateMatrixWorld();
    for (const [nx, ny, d, s, r] of [[-.92, .78, 1.7, .62, -.5], [.95, .9, 1.9, .58, 2.5], [1.0, -.72, 1.6, .6, 3.7], [-1.0, -.6, 2.1, .45, .9]]) {
      const p = V(nx * d * th * 16 / 9, ny * d * th, -d).applyMatrix4(bc.matrixWorld); p.x -= SX;
      L.push({ g: new THREE.PlaneGeometry(s, s), m: new THREE.Matrix4().compose(p, bc.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), r)), ONE) });
    }
    const lm = toon({ color: "#ffffff", map: leafTex, opacity: .999, emissive: new THREE.Color(.04, .07, .015), soft: .4, rimK: 0, side: THREE.DoubleSide }); lm.depthWrite = false;
    const leaves = new THREE.Mesh(merge(L), lm); leaves.renderOrder = 6; street.add(leaves);
  }

  /* ---------- light: the sun (a bloom source in 3D), haze, dust, sparkles, bokeh ---------- */
  const sun = new THREE.Mesh(geo(new THREE.PlaneGeometry(1, 1)), bmat(new THREE.MeshBasicMaterial({ map: sunTex, color: new THREE.Color(7, 6.3, 5.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  sun.renderOrder = -5; root.add(sun);
  const haze = kit.haze({ section: SEC, count: q(12, 26, 44), center: [0, 18, 300], box: [700, 18, 420], size: 110, top: "#ffffff", bottom: "#d8e6f0", opacity: .3, drift: [.6, 0, 0], seed: seed + 4 });
  const dust = kit.particles({ section: SEC, kind: "dust", count: q(300, 1200, 3200), center: [0, 0, 0], box: [9, 5, 9], drift: [.05, .05, -.02], size: .028, color: "#fff4dc", color2: "#d4f2ff", intensity: 1.5, twinkle: .4, wobble: .25, seed: seed + 5 });
  const spark = kit.particles({ section: SEC, kind: "spark", count: q(40, 120, 300), center: [0, 0, 0], box: [7, 4, 7], drift: [.02, .03, 0], size: .07, color: "#fffaf0", color2: "#c8f4ff", intensity: 2.6, twinkle: .85, on: "fast", wobble: .15, seed: seed + 6 });
  const bokeh = kit.particles({ section: SEC, kind: "bokeh", count: q(60, 200, 500), center: [0, 0, 0], box: [6, 3.2, 2.4], drift: [.04, .02, 0], size: .17, color: "#ffe1b0", color2: "#bdf1ff", intensity: 1, twinkle: .3, opacity: .5, on: "fast", beat: .6, wobble: .2, seed: seed + 7 });
  root.add(haze, dust, spark, bokeh);

  /* ---------- per-frame helpers ---------- */
  const tmp = new THREE.Vector3(), fwd = new THREE.Vector3();
  const fastAt = t => { const a = timing.fast; let lo = 0, hi = a.length - 1; if (t <= a[0]) return (t - a[0]) / (timing.bp / 2); while (lo < hi) { const m = (lo + hi + 1) >> 1; if (a[m] <= t) lo = m; else hi = m - 1 } const b = a[lo + 1] ?? a[lo] + timing.bp / 2; return lo + cl((t - a[lo]) / (b - a[lo])) };
  function shoot(f, pos, look, fov) { camera.position.copy(pos); camera.lookAt(look); camera.fov = fov; camera.aspect = f.W / Math.max(1, f.H); camera.updateProjectionMatrix(); camera.updateMatrixWorld() }
  function screen(dir, f) { tmp.copy(camera.position).addScaledVector(dir, 1000).project(camera); return { x: (tmp.x + 1) / 2 * f.W, y: (1 - tmp.y) / 2 * f.H, front: tmp.z < 1 } }
  function drawSky(f, glow) {
    const g = back2d, W = f.W, H = f.H; camera.getWorldDirection(fwd);
    const pitch = Math.asin(cl(fwd.y, -1, 1)), yaw = Math.atan2(fwd.x, -fwd.z), ppr = H / 2 / Math.tan(camera.fov * Math.PI / 360);
    const dw = Math.max(W * 1.4, ppr * 2.3), dh = dw * skyC.height / skyC.width, hy = H / 2 + Math.tan(pitch) * ppr;
    const x = cl(W / 2 - dw / 2 - (yaw - f.yaw0) * ppr, W - dw, 0), y = hy - HZ * dh;
    if (y > 0) { g.fillStyle = "#2c78d4"; g.fillRect(0, 0, W, y + 2) }
    g.drawImage(skyC, x, y, dw, dh);
    if (y + dh < H) { g.fillStyle = "#f1eee2"; g.fillRect(0, y + dh - 1, W, H - y - dh + 1) }
    if (glow && glow.front) { const r = H * .75, gr = g.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, r); gr.addColorStop(0, "rgba(255,250,236,.95)"); gr.addColorStop(.12, "rgba(255,240,214,.55)"); gr.addColorStop(.45, "rgba(255,236,210,.14)"); gr.addColorStop(1, "rgba(255,236,210,0)"); g.save(); g.globalCompositeOperation = "lighter"; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore() }
  }
  const GHOSTS = [[.35, .035, "160,255,210", .1], [.62, .07, "255,214,150", .06], [.95, .02, "190,170,255", .14], [1.28, .11, "130,210,255", .05], [1.55, .045, "255,170,190", .08]];
  function flare(f, s, k) { /* ghosts and a faint rainbow ring along the line from the sun through the centre; crisp, on the front canvas */
    if (!s.front || k < .01) return;
    const g = ctx2d, cx = f.W / 2, cy = f.H / 2, dx = cx - s.x, dy = cy - s.y, D = Math.min(f.W, f.H), vis = k * sm(1.6, .6, Math.hypot(dx / f.W, dy / f.H) * 1.2);
    if (vis < .01) return;
    g.save(); g.globalCompositeOperation = "lighter";
    for (const [m, r, col, a] of GHOSTS) { const x = s.x + dx * m, y = s.y + dy * m, rr = r * D, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(${col},${a * vis * .5})`); gr.addColorStop(.75, `rgba(${col},${a * vis})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr) }
    const x = s.x + dx * 1.15, y = s.y + dy * 1.15, rr = .36 * D, gr = g.createRadialGradient(x, y, rr * .8, x, y, rr);
    [[0, "255,90,90,0"], [.2, `255,110,90,${.07 * vis}`], [.4, `255,220,90,${.07 * vis}`], [.6, `120,255,150,${.06 * vis}`], [.8, `110,170,255,${.07 * vis}`], [1, "190,120,255,0"]].forEach(([o, c]) => gr.addColorStop(o, `rgba(${c})`));
    g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
    g.restore();
  }
  const place = (o, x, y, z) => o.position.set(x, y, z);
  function walk(m, who, k, side, flip, cam) { /* k: float step index on the stair (on the beat), side: x across the stair */
    const n = Math.floor(k), ph = k - n, e = sm(0, .62, ph), kk = n + e, z = -(kk + .5) * RUN, y = (kk + 1) * RISE + Math.sin(e * Math.PI) * .045;
    m.position.set(side, y, z); m.rotation.y = Math.atan2(cam.x - side, cam.z - z);
    pose(m, who, e < .45 && e > .05 ? 1 : flip === "up" ? 0 : 2, (flip === "up") !== (cam.x > side));
  }
  function stand(m, who, x, y, z, t) { m.position.set(x, y + Math.sin(t * 1.3 + who) * .01, z); m.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z); pose(m, who, 3, false) }
  function updateCord(f, wind) {
    const P = cordG.attributes.position, cam = camera.position, t = f.t;
    for (let tail = 0; tail < 2; tail++) {
      const len = tail ? .42 : .56, ph = tail * 1.7;
      let prev = null;
      for (let i = 0; i <= CORD; i++) {
        const s = i / CORD, sw = s * s;
        const x = knotP.x + .03 + Math.cos(t * 5.1 - s * 5 + ph) * .05 * sw * wind + s * .06;
        const y = knotP.y - .03 - s * len * (1 - .35 * wind) + Math.sin(t * 3.3 + ph) * .03 * sw * wind;
        const z = knotP.z + (tail ? .03 : -.03) + Math.sin(t * 7 - s * 6 + ph) * .09 * sw * wind + s * len * .55 * wind;
        tmp.set(x, y, z); const d = prev ? tmp.clone().sub(prev) : V(0, -1, 0), side = d.cross(fwd.copy(cam).sub(tmp)).normalize().multiplyScalar(.012);
        const o = (tail * (CORD + 1) + i) * 2; P.setXYZ(o, x + side.x, y + side.y, z + side.z); P.setXYZ(o + 1, x - side.x, y - side.y, z - side.z); prev = V(x, y, z);
      }
    }
    P.needsUpdate = true;
  }

  /* ---------- the setups ---------- */
  const SUN = { street: V(-.5, .55, -.67).normalize(), lane: LANE_SUN, wide: V(.42, .42, -.8).normalize(), climb: V(.58, .62, .53).normalize(), pass: V(.62, .38, .69).normalize(), landing: V(-.72, .36, .6).normalize() };
  const FOG = { street: [30, 400], lane: [25, 150], wide: [40, 420], climb: [30, 300], pass: [30, 420], landing: [60, 640] };
  const show = (...gs) => { for (const g of [world, lane, street]) g.visible = gs.includes(g) };
  function setup(f) {
    const k = f.shot.key, v = f.shot.var;
    return k === "street" ? "street" : k === "lane" ? "lane" : k === "flight" ? (v === "pass" ? "pass" : "climb") : k === "landing" ? "landing" : "wide";
  }

  return {
    update(f) {
      const id = setup(f), lt = f.shot.lt, u = lt / Math.max(.1, f.shot.t1 - f.shot.t0), sd = SUN[id];
      for (const m of TOONS) m.uniforms.uLightDir.value.copy(sd);
      scene.fog.near = FOG[id][0]; scene.fog.far = FOG[id][1];
      let look = {}, flareK = .6, glow = true;
      fig[0].visible = fig[1].visible = cord.visible = knot.visible = false; haze.visible = id === "landing" || id === "wide";
      if (id === "street") {
        show(street);
        const dx = Math.sin(lt * .55) * .08 + lt * .14;
        shoot(f, V(SX + .95 + dx, 2.32 + lt * .03, 5.4 - lt * .12), V(SX + .1 + dx * .3, 2.82, 0), 23);
        place(bokeh, SX + .2, 2.9, -2.4); place(spark, SX, 2.9, .2); place(dust, SX + .4, 2.6, 2);
        look = { tilt: .7, focus: .5, band: .26, glow: .46, bloom: .9, threshold: .68, rays: .55, leak: .14 + .22 * f.downPulse, leakX: 0, leakY: 0, exposure: 1.08 };
        glow = false;
      } else if (id === "lane") {
        show(lane);
        const z = -3.2 - (5.4 * lt - .7 * lt * lt), wob = Math.sin(lt * 2.4) * .045;
        bike.position.set(-.38 + lt * .05, 0, z); bike.rotation.set(0, .05, wob); bike.userData.shadow.rotation.set(0, Math.atan2(-sh2.x, -sh2.z) - .05, -wob);
        shoot(f, V(LX + .95, .92 + Math.sin(lt * 1.7) * .02, 5 - lt * .55), V(LX - .25, 1.45, -40), 38);
        place(bokeh, LX + .3, 1.3, 1.2); place(spark, LX, 1.6, -6); place(dust, LX, 1.5, -1);
        look = { glow: .42, bloom: .85, threshold: .7, rays: .62, tilt: .3, focus: .55, band: .4, leak: .1 + .2 * f.downPulse, exposure: 1.06 };
      } else if (id === "wide") {
        show(world);
        shoot(f, V(9.2 - lt * .08, 6.6 + Math.sin(lt * .8) * .03, 39 - lt * .25), V(-.4, 4.1, -8), 33);
        fig[0].visible = fig[1].visible = true;
        stand(fig[0], 0, .2, HT, -LEN - .7, f.t); stand(fig[1], 1, -.35, 0, .9, f.t);
        place(bokeh, 7.8, 6.4, 34.5); place(spark, 2, 6, 22); place(dust, 7, 6.3, 31);
        const e = sm(0, .9, lt);
        look = { exposure: mix(1.45, 1.08, e), glow: mix(.7, .44, e), bloom: .9, threshold: .7, rays: .72, tilt: .22, focus: .52, band: .5, sat: 1.08 };
      } else if (id === "climb") {
        show(world);
        const km = 19, cz = stepZ(km) - lt * .3, cy = stepY(km) + lt * .3 * RISE / RUN;
        shoot(f, V(6.3, cy + 1.25, cz + .9), V(0, cy + .55, cz - .5), 37);
        fig[0].visible = fig[1].visible = true;
        const n = f.fast - fastAt(f.shot.t0);
        walk(fig[1], 1, 12 + n, -.45, "up", camera.position); walk(fig[0], 0, 27 - n, .45, "down", camera.position);
        place(bokeh, 5, cy + 1.2, cz + .6); place(spark, 1, cy + 1, cz); place(dust, 3, cy + 1, cz);
        look = { glow: .44, bloom: .85, threshold: .7, rays: .5, tilt: .32, focus: .45, band: .42, leak: .12 + .2 * f.downPulse, leakX: 0, leakY: 0 };
      } else if (id === "pass") {
        show(world);
        const km = 18, cz = stepZ(km) + lt * .2, cy = stepY(km) - lt * .2 * RISE / RUN;
        shoot(f, V(-2.05, cy + 1.05, cz - .35), V(6, cy + .2, cz + 1.7), 41);
        fig[0].visible = fig[1].visible = cord.visible = knot.visible = true;
        const n = f.fast - fastAt(f.shot.t0);
        walk(fig[1], 1, 16.4 + n, -.45, "up", camera.position); walk(fig[0], 0, 20.6 - n, .45, "down", camera.position);
        updateCord(f, .55 + .45 * f.pulse);
        place(bokeh, -.6, cy + 1, cz + .4); place(spark, 1.4, cy + 1, cz + 1); place(dust, 0, cy + 1, cz + .5);
        const fl = Math.exp(-Math.max(0, lt) * 3);
        look = { glow: .48 + .25 * fl, bloom: .9, threshold: .68, rays: .75, exposure: 1.08 + .35 * fl, tilt: .25, focus: .5, band: .5, leak: .2 + .35 * fl, leakX: 1, leakY: .15 };
      } else {
        show(world);
        const p = lt * .22;
        shoot(f, V(.7 + p * .3, HT + 1.6 + p * .15, -LEN - 3.1 + p), V(2.4 + p * .2, HT - 3.6, -LEN + 18 + p), 47);
        place(bokeh, 1.6, HT + 1.5, -LEN - 1.4); place(spark, 2.5, HT + 1, -LEN + 3); place(dust, 1.5, HT + 1.5, -LEN);
        look = { glow: .44, bloom: .88, threshold: .7, rays: .55, tilt: .5, focus: .42, band: .36, exposure: 1.08 + .04 * Math.sin(lt * 1.5), sat: 1.06 };
      }
      f.yaw0 = { street: 0, lane: -.03, wide: -.2, climb: -1.35, pass: 1.82, landing: 3.06 }[id];
      /* the sun: a bloom source in 3D, a warm glow on the painted sky, rays, a flare */
      const s = screen(sd, f);
      sun.position.copy(camera.position).addScaledVector(sd, 1400); sun.lookAt(camera.position); sun.scale.setScalar(380 * (1 + .06 * f.pulse)); sun.visible = id !== "street";
      if (id === "street") { const W = f.W, H = f.H, sc = Math.max(W / streetC.width, H / streetC.height) * 1.08; back2d.drawImage(streetC, (W - streetC.width * sc) / 2 - lt * W * .012, (H - streetC.height * sc) / 2, streetC.width * sc, streetC.height * sc) }
      else drawSky(f, glow && s);
      const sx = id === "street" ? -.05 : s.x / f.W, sy = id === "street" ? -.08 : s.y / f.H;
      look.rayX = cl(sx, -.6, 1.6); look.rayY = cl(sy, -.6, 1.6);
      kit.look(look);
      kit.tick(f, haze, dust, spark, bokeh);
      if (id !== "street") flare(f, s, flareK * (1 + .35 * f.pulse));
      else flare(f, { x: -.05 * f.W, y: -.08 * f.H, front: true }, .5 * (1 + .35 * f.pulse));
    },
    setVisible(on) { root.visible = on },
    dispose() {
      scene.remove(root); scene.fog = null;
      for (const im of INST) im.dispose();
      for (const g of GEOS) g.dispose(); for (const m of MATS) m.dispose();
      for (const c of CANV) c.width = 0;
      GEOS.clear(); MATS.clear(); INST.length = 0; CANV.length = 0; /* toon materials, textures, haze, particles: kit.dispose() */
    }
  };
}
