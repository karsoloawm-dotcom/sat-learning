/* Dream Lantern v2 scene module "cord": the kumihimo cord, the film's main symbol (plan section 8.4).
   Setups: sky:release, sky:loop · marudai (bobbins, -, top, pastel, indigo, raking) · knot:tie, knot:rail · drift (-, tumble, indigo) · bell.
   Every cord is one rope primitive: a tube skinned on the GPU along a path the CPU recomputes from f each frame (a float texture
   of points, parallel-transport frames, radius and tint), shaded with kit.toon() plus v1's braid pattern, silk sheen and its
   travelling glow. Two ropes (the cord, and a bundle of fine strands) serve all setups; only one setup is on screen at a time. */
export async function create({ THREE, scene, camera, ctx2d, back2d, kit, tier, seed = 1, timing }) {
  const V3 = THREE.Vector3, TAU = Math.PI * 2, PI = Math.PI;
  const TI = { saver: 0, smooth: 1, ultra: 2 }[tier] ?? 1, pick = (...a) => a[TI];
  const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x, mix = (a, b, k) => a + (b - a) * k;
  const ss = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k) };
  const eo = x => 1 - (1 - cl(x)) ** 3, eio = x => (x = cl(x), x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
  const hash = x => { const s = Math.sin(x * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s) };
  const rng = s => () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const mine = [], own = x => (mine.push(x), x); /* geometries, textures and materials made outside the kit */
  const root = new THREE.Group(); root.name = "cord"; scene.add(root);
  scene.fog = new THREE.Fog(0x000000, 10, 80); /* set once so every toon shader compiles with fog; retinted per shot */
  const CUE = timing && timing.cues && timing.cues.cord || 40.18; /* the release jolts: 40.18 and 40.36 */
  const B0 = timing && timing.beats ? Math.max(0, timing.beats.findIndex(b => b >= 79.9)) : 0; /* the braid starts growing at the marudai shots */

  /* ---------------- the rope primitive ---------------- */
  const NP = pick(128, 192, 256);
  const VH = `uniform sampler2D uPath;uniform float uNP,uRows;varying vec4 vRope;
vec4 pth(float i,float r){return texture2D(uPath,vec2((clamp(i,0.,uNP-1.)+.5)/uNP,(r+.5)/uRows));}
void main(){`;
  const VN = `float rk=position.x,fi=uv.x*(uNP-1.),i1=min(floor(fi),uNP-2.),fr=fi-i1,f2=fr*fr,f3=f2*fr;
  vec4 a0=pth(i1-1.,rk),a1=pth(i1,rk),a2=pth(i1+1.,rk),a3=pth(i1+2.,rk);
  vec3 cp=.5*(2.*a1.xyz+(a2.xyz-a0.xyz)*fr+(2.*a0.xyz-5.*a1.xyz+4.*a2.xyz-a3.xyz)*f2+(3.*a1.xyz-a0.xyz-3.*a2.xyz+a3.xyz)*f3);
  vec3 nn=normalize(mix(pth(i1,rk+1.).xyz,pth(i1+1.,rk+1.).xyz,fr)),bb=normalize(mix(pth(i1,rk+2.).xyz,pth(i1+1.,rk+2.).xyz,fr));
  float ang=uv.y*6.2831853;vec3 objectNormal=nn*cos(ang)+bb*sin(ang);
  vec3 cordP=cp+objectNormal*mix(a1.w,a2.w,fr);vRope=mix(pth(i1,rk+3.),pth(i1+1.,rk+3.),fr);`;
  const FH = `uniform float uLen,uOff,uTime,uPulse,uKind,uG0,uG1,uHeadA,uHeadB,uSheen;uniform vec3 uC1,uC2,uC3,uC4,uGlowCol;varying vec4 vRope;float rdg=1.;
vec3 braid(vec2 q){float a=q.x*uLen+uOff,b=q.y;
  if(uKind<.5){float s1=fract(a*1.6+b*4.),s2=fract(a*1.6-b*4.);vec3 c=mix(uC1,uC2,step(.55,s1)*step(.55,s2)+step(.92,s1)*.6);
    float band=fract(a*.11);if(band<.1)c=mix(uC3,uC4,step(.5,fract(a*3.2+b*2.)));else if(band<.13)c=uC2;
    rdg=.5+.5*max(sin(6.2832*(a*3.2+b*8.)),sin(6.2832*(a*3.2-b*8.)));return c;}
  if(uKind<1.5){float s=fract(a*1.3+b)*3.;rdg=sin(fract(s)*3.1416);return s<1.?uC1:s<2.?uC2:uC3;}
  rdg=.78+.22*sin(6.2832*(a*9.+b*3.));return uC1;}
void main(){if(vUv.x<uG0||vUv.x>uG1)discard;vec3 base=uColor*braid(vUv)*vRope.rgb;`;
  const FL = `uRimK*(.35+.65*lit);c*=mix(.55,1.,rdg);c+=uLight*pow(rdg,8.)*uSheen*lit;
  c+=uGlowCol*(exp(-pow((fract(vUv.x*3.-uTime*.35)-.5)*14.,2.))*uPulse+vRope.w+(1.-smoothstep(uG0,uG0+.03,vUv.x))*uHeadA+smoothstep(uG1-.03,uG1,vUv.x)*uHeadB);`;
  function patch(m, key, a, b) { if (!m[key].includes(a)) throw new Error("cord: kit.toon shader changed (" + a + ")"); m[key] = m[key].replace(a, b) }
  function rope(strands, seg, radial) {
    const rows = 4 * strands, data = new Float32Array(NP * rows * 4);
    const tex = own(new THREE.DataTexture(data, NP, rows, THREE.RGBAFormat, THREE.FloatType));
    tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
    const per = (seg + 1) * (radial + 1), pos = new Float32Array(per * strands * 3), uv = new Float32Array(per * strands * 2), idx = [];
    for (let k = 0, v = 0; k < strands; k++) for (let i = 0; i <= seg; i++) for (let j = 0; j <= radial; j++, v++) {
      pos[v * 3] = k * 4; uv[v * 2] = i / seg; uv[v * 2 + 1] = j / radial;
      if (i < seg && j < radial) { const b = v + radial + 1; idx.push(v, b, v + 1, b, b + 1, v + 1) }
    }
    const geo = own(new THREE.BufferGeometry()); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
    const mat = kit.toon({ color: "#ffffff", side: THREE.DoubleSide, soft: .2, wrap: .3, rimK: .7, rimPow: 2.5 });
    patch(mat, "vertexShader", "void main(){", VH); patch(mat, "vertexShader", "#include <beginnormal_vertex>", VN); patch(mat, "vertexShader", "#include <begin_vertex>", "vec3 transformed=cordP;");
    patch(mat, "fragmentShader", "void main(){vec3 base=uColor;", FH); patch(mat, "fragmentShader", "uRimK*(.35+.65*lit);", FL);
    const U = mat.uniforms, C = c => ({ value: new THREE.Color(c) });
    Object.assign(U, { uPath: { value: tex }, uNP: { value: NP }, uRows: { value: rows }, uLen: { value: 10 }, uOff: { value: 0 }, uTime: { value: 0 }, uPulse: { value: 0 }, uKind: { value: 0 },
      uG0: { value: 0 }, uG1: { value: 1 }, uHeadA: { value: 0 }, uHeadB: { value: 0 }, uSheen: { value: .3 }, uC1: C("#9e0a12"), uC2: C("#ffa632"), uC3: C("#1a1f6b"), uC4: C("#f2e6d2"), uGlowCol: { value: new THREE.Color(1, .72, .4) } });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; root.add(mesh);
    const v = new V3(), col = new THREE.Color(), RS = NP * 4;
    return {
      mesh, mat, U, strands,
      /* strand k follows fn(s, out) for s in 0..1 (tail to head); radius rad or rad(s); tint c (multiplies the pattern); emissive glow */
      set(k, fn, rad, c = "#ffffff", glow = 0) {
        const o = k * 4 * RS, oN = o + RS, oB = oN + RS, oC = oB + RS, rf = typeof rad === "function";
        col.set(c);
        for (let i = 0; i < NP; i++) {
          const s = i / (NP - 1), q = o + i * 4, w = oC + i * 4; fn(s, v);
          data[q] = v.x; data[q + 1] = v.y; data[q + 2] = v.z; data[q + 3] = (rf ? rad(s) : rad) * Math.sqrt(ss(0, .012, s) * ss(1, .988, s));
          data[w] = col.r; data[w + 1] = col.g; data[w + 2] = col.b; data[w + 3] = glow;
        }
        let tx = 0, ty = 1, tz = 0, nx = 1, ny = 0, nz = 0;
        for (let i = 0; i < NP; i++) {
          const a = o + Math.max(0, i - 1) * 4, b = o + Math.min(NP - 1, i + 1) * 4;
          const x = data[b] - data[a], y = data[b + 1] - data[a + 1], z = data[b + 2] - data[a + 2], l = Math.hypot(x, y, z);
          if (l > 1e-9) { tx = x / l; ty = y / l; tz = z / l }
          if (i > 0) { const d = nx * tx + ny * ty + nz * tz; nx -= d * tx; ny -= d * ty; nz -= d * tz }
          let m = Math.hypot(nx, ny, nz);
          if (i === 0 || m < 1e-6) { const ux = Math.abs(ty) > .9 ? 1 : 0, uy = 1 - ux; nx = -tz * uy; ny = tz * ux; nz = tx * uy - ty * ux; m = Math.hypot(nx, ny, nz) || 1 }
          nx /= m; ny /= m; nz /= m;
          const p = oN + i * 4, r = oB + i * 4;
          data[p] = nx; data[p + 1] = ny; data[p + 2] = nz; data[r] = ty * nz - tz * ny; data[r + 1] = tz * nx - tx * nz; data[r + 2] = tx * ny - ty * nx;
        }
        tex.needsUpdate = true;
      },
      hide(k) { const o = k * 4 * RS; data.fill(0, o, o + RS); for (let i = 0; i < NP; i++) { data[o + RS + i * 4] = 1; data[o + 2 * RS + i * 4 + 2] = 1 } tex.needsUpdate = true },
      look(o) {
        U.uKind.value = o.kind ?? 0; U.uLen.value = o.len ?? 10; U.uOff.value = o.off ?? 0; U.uPulse.value = o.pulse ?? 0; U.uSheen.value = o.sheen ?? .3;
        U.uG0.value = o.g0 ?? 0; U.uG1.value = o.g1 ?? 1; U.uHeadA.value = o.headA ?? 0; U.uHeadB.value = o.headB ?? 0;
        const cs = o.cols || ["#9e0a12", "#ffa632", "#1a1f6b", "#f2e6d2"]; U.uC1.value.set(cs[0]); U.uC2.value.set(cs[1]); U.uC3.value.set(cs[2]); U.uC4.value.set(cs[3]);
        U.uGlowCol.value.set(o.glowCol || "#ffb878").multiplyScalar(o.glowK ?? 1);
      }
    };
  }
  const cord = rope(1, pick(300, 900, 2000), pick(8, 10, 12));
  const FIB = pick(6, 10, 12), fib = rope(FIB, pick(110, 240, 380), pick(5, 6, 8));

  /* ---------------- materials and props ---------------- */
  const grain = kit.paint(256, 64, (g, w, h) => {
    g.fillStyle = "#c08a5a"; g.fillRect(0, 0, w, h); const r = rng(seed + 5);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${70 + r() * 40},${40 + r() * 20},20,${.08 + r() * .18})`; g.lineWidth = .5 + r() * 2; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w * .3, y + (r() - .5) * 6, w * .6, y + (r() - .5) * 6, w, y + (r() - .5) * 4); g.stroke() }
  });
  const washi = kit.paint(256, 256, (g, w, h) => {
    g.fillStyle = "#fff4e2"; g.fillRect(0, 0, w, h); const r = rng(seed + 9);
    for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(255,255,255,${.2 + r() * .4})`; g.lineWidth = .6; g.beginPath(); const x = r() * w, y = r() * h, a = r() * TAU, l = 4 + r() * 16; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke() }
    for (let i = 1; i < 10; i++) { const y = i / 10 * h; g.fillStyle = "rgba(120,60,30,.55)"; g.fillRect(0, y - 1.6, w, 3.2); g.fillStyle = "rgba(255,200,140,.4)"; g.fillRect(0, y + 1.6, w, 1.5) }
  });
  const T = o => kit.toon(Object.assign({ soft: .25, rimK: .6 }, o));
  const wood = T({ color: "#ffffff", map: grain }), lacq = T({ color: "#6b2a1e", rimPow: 4, rimK: .8 }), spoolM = T({ color: "#e0b27a", map: grain });
  const windM = T({ color: "#ffffff" }), threadM = T({ color: "#ffffff", rimK: 1, rimPow: 2 }), bagM = T({ color: "#5c3462" });
  const railM = T({ color: "#c8392c", rimK: .9, rimPow: 3 }), bambooM = T({ color: "#b9945a" }), capM = T({ color: "#2a1a18", rimK: .5 });
  const paperM = T({ color: "#ffffff", map: washi, shade: new THREE.Color(1.55, .72, .28), light: new THREE.Color(2.1, 1.12, .5), rim: "#ffd6a0", rimK: .8, ambient: .1 });
  const TONED = [cord.mat, fib.mat, wood, lacq, spoolM, windM, threadM, bagM, railM, bambooM, capM];
  /* LatheGeometry faces outward when the profile runs counter-clockwise (outer surface bottom to top); the profiles below that run the other way are reversed */
  const lathe = (pts, n) => own(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), n));
  const LS = pick(32, 56, 80);

  /* the marudai: mirror (kagami) on four legs, bobbins (tama) hanging on threads, the braid down the centre with its weight */
  const NB = pick(8, 16, 16), H = NB / 2;
  const maru = new THREE.Group(); root.add(maru);
  maru.add(new THREE.Mesh(lathe([[.15, -.09], [.15, 0], [.95, 0], [.99, -.012], [1.005, -.045], [.99, -.078], [.95, -.09], [.15, -.09]].reverse(), LS * 2), lacq));
  maru.add(new THREE.Mesh(lathe([[.0, -1.66], [1.02, -1.66], [1.06, -1.7], [1.02, -1.76], [0, -1.76]].reverse(), LS), wood));
  const legs = new THREE.InstancedMesh(own(new THREE.CylinderGeometry(.045, .055, 1.6, 10)), wood, 4), M4 = new THREE.Matrix4();
  for (let i = 0; i < 4; i++) legs.setMatrixAt(i, M4.makeTranslation(Math.cos(i * PI / 2 + PI / 4) * .7, -.88, Math.sin(i * PI / 2 + PI / 4) * .7));
  maru.add(legs);
  const bag = new THREE.Mesh(lathe([[0, 0], [.05, -.01], [.13, -.06], [.16, -.16], [.13, -.27], [.06, -.32], [0, -.33]].reverse(), 20), bagM); maru.add(bag);
  const spools = new THREE.InstancedMesh(lathe([[0, .15], [.068, .15], [.074, .135], [.05, .11], [.05, -.11], [.074, -.135], [.068, -.15], [0, -.15]].reverse(), 16), spoolM, NB);
  const winds = new THREE.InstancedMesh(own(new THREE.CylinderGeometry(.064, .064, .2, 14)), windM, NB);
  const threads = new THREE.InstancedMesh(own(new THREE.CylinderGeometry(1, 1, 1, pick(4, 5, 6), 1, true)), threadM, NB * 2);
  for (const m of [spools, winds, threads]) { m.frustumCulled = false; maru.add(m) }
  const white = new THREE.Color(1, 1, 1); for (let i = 0; i < NB * 2; i++) { threads.setColorAt(i, white); if (i < NB) winds.setColorAt(i, white) }

  /* a paper lantern lit from inside (paper shaded light-on-both-sides so it glows evenly and its ribs read dark), bamboo handle */
  const lan = new THREE.Group(); root.add(lan);
  lan.add(new THREE.Mesh(lathe([[0, -.5], [.2, -.5], [.34, -.42], [.44, -.24], [.47, 0], [.44, .24], [.34, .42], [.2, .5], [0, .5]], LS), paperM));
  for (const y of [-.5, .5]) { const c = new THREE.Mesh(lathe([[.17, -.035], [.23, -.035], [.235, .035], [.17, .035]], 24), capM); c.position.y = y; lan.add(c) }
  const handle = new THREE.Mesh(own(new THREE.TorusGeometry(.24, .014, 6, 32, PI)), bambooM); handle.position.y = .5; lan.add(handle);

  /* a red stair rail and its post */
  const rail = new THREE.Group(); root.add(rail);
  const pipe = new THREE.Mesh(own(new THREE.CylinderGeometry(.045, .045, 9, 18)), railM); rail.add(pipe);
  const post = new THREE.Mesh(own(new THREE.CylinderGeometry(.04, .04, 4, 14)), railM); rail.add(post);

  /* the bell's gold ring-waves: flat rings facing the camera, HDR so they bloom */
  const rings = new THREE.Group(); root.add(rings);
  const ringGeo = own(new THREE.RingGeometry(.94, 1, 96));
  for (let i = 0; i < 3; i++) rings.add(new THREE.Mesh(ringGeo, own(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.75, .7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))));

  /* shared kit particles, retargeted per shot (made in a wide box so any smaller box is evenly filled) */
  const P = (o, n) => { const p = kit.particles(Object.assign({ count: n, box: [60, 60, 60], center: [0, 0, 0] }, o)); root.add(p); return p };
  const spark = P({ kind: "spark", drift: [0, .12, 0], wobble: .25, on: "fast" }, pick(150, 700, 2200));
  const bokeh = P({ kind: "bokeh", drift: [.05, .03, 0], wobble: .2, twinkle: .3 }, pick(60, 160, 400));
  const fleck = P({ kind: "petal", drift: [.08, -.22, 0], wobble: .35, on: "fast" }, pick(500, 3000, 10000));
  const dust = P({ kind: "dust", drift: [.02, .05, 0], wobble: .15, twinkle: .6 }, pick(300, 1200, 4000));
  const clouds = kit.haze({ count: pick(14, 30, 60), center: [0, -3, -16], box: [34, 3, 28], size: 8, opacity: .6, top: "#fff4f6", bottom: "#b4acdc", drift: [.25, 0, 0], seed: seed + 3 });
  root.add(clouds);
  const PARTS = [spark, bokeh, fleck, dust];
  function pset(p, o) {
    p.visible = true; const u = p.userData.material.uniforms;
    u.uCenter.value.set(...o.c); u.uBox.value.set(...o.b); u.uCol.value.set(o.col).multiplyScalar(o.i ?? 1.6); u.uCol2.value.set(o.col2 || o.col).multiplyScalar(o.i ?? 1.6);
    u.uSize.value = o.size; u.uOpacity.value = o.op ?? 1; p.geometry.setDrawRange(0, o.n ?? Infinity);
  }

  /* ---------------- painted backgrounds (made once, on first use) ---------------- */
  const PW = pick(640, 1024, 1536), PH = Math.round(PW * 9 / 16), paints = new Map();
  const rgba = (c, a) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})` };
  const vg = (g, w, h, st) => { const gr = g.createLinearGradient(0, 0, 0, h); st.forEach((c, i) => gr.addColorStop(i / (st.length - 1), c)); g.fillStyle = gr; g.fillRect(0, 0, w, h) };
  const blob = (g, x, y, r, c, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(c, a)); gr.addColorStop(1, rgba(c, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r) };
  const blur = (g, px) => { if ("filter" in g) g.filter = px ? `blur(${px}px)` : "none" };
  function bokehs(g, r, n, x0, y0, x1, y1, cols, rmin, rmax, a) {
    for (let i = 0; i < n; i++) {
      const x = mix(x0, x1, r()), y = mix(y0, y1, r()), rr = mix(rmin, rmax, r() * r()), c = cols[i % cols.length], al = a * (.4 + .6 * r());
      const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, rgba(c, al * .55)); gr.addColorStop(.82, rgba(c, al * .8)); gr.addColorStop(.92, rgba(c, al)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    }
  }
  function cloud(g, r, x, y, cw, ch, lit, mid, sh) {
    const C = [];
    for (let i = 0, n = 14 + (r() * 10 | 0); i < n; i++) { const u = r() * 2 - 1, k = 1 - u * u; C.push([x + u * cw * .5, y - k * ch * (.3 + r() * .6), (.25 + .75 * k) * ch * (.3 + r() * .38)]) }
    for (let i = 0; i < 6; i++) C.push([x + (r() * 2 - 1) * cw * .42, y, ch * (.18 + r() * .14)]);
    const pass = (c, dx, dy, s) => { g.fillStyle = c; g.beginPath(); for (const [px, py, pr] of C) { g.moveTo(px + dx + pr * s, py + dy); g.arc(px + dx, py + dy, pr * s, 0, TAU) } g.fill() };
    g.save(); g.beginPath(); g.rect(x - cw, y - ch * 3, cw * 2, ch * 3.16); g.clip();
    pass(sh, 0, 0, 1); pass(mid, -ch * .03, -ch * .07, .87); pass(lit, -ch * .07, -ch * .15, .66); g.restore();
  }
  function shafts(g, r, x, y, a0, a1, n, len, c, a) {
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      const an = mix(a0, a1, r()), wd = .015 + r() * .05, gr = g.createLinearGradient(x, y, x + Math.cos(an) * len, y + Math.sin(an) * len);
      gr.addColorStop(0, rgba(c, a * (.4 + .6 * r()))); gr.addColorStop(1, rgba(c, 0)); g.fillStyle = gr;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an - wd) * len, y + Math.sin(an - wd) * len); g.lineTo(x + Math.cos(an + wd) * len, y + Math.sin(an + wd) * len); g.fill();
    }
    g.restore();
  }
  const PAINT = {
    blush(g, w, h, r) { /* pre-chorus: periwinkle to blush, a cream sun, pink wisps */
      vg(g, w, h, ["#a7b5ec", "#c4c2f1", "#ecd0ea", "#ffe0dc", "#fff0e6"]);
      blob(g, w * .84, h * .1, w * .55, "#fff1e4", .9); blob(g, w * .84, h * .1, w * .12, "#ffffff", 1);
      blur(g, w * .004); for (let i = 0; i < 14; i++) { g.save(); g.translate(w * r(), h * (.45 + r() * .5)); g.scale(1, .12 + r() * .1); blob(g, 0, 0, w * (.12 + r() * .2), r() < .5 ? "#fff6f8" : "#f6cfe2", .35 + r() * .3); g.restore() }
      blur(g, w * .0012); for (let i = 0; i < 4; i++) cloud(g, r, w * (.1 + r() * .8), h * (.86 + r() * .1), w * (.16 + r() * .14), h * (.1 + r() * .06), "#fff5f4", "#f3d8e8", "#c9b7e3");
      blur(g, 0); shafts(g, r, w * .84, h * .1, PI * .55, PI * 1.0, 9, w * 1.1, "#fff4e8", .08);
    },
    peri(g, w, h, r) { /* the loop: periwinkle sky over a pink-lit cloud sea */
      vg(g, w, h, ["#7f98e2", "#9fb0ee", "#c6c6f2", "#efd8ec", "#fde6e6"]);
      blob(g, w * .72, h * .2, w * .5, "#fff2ea", .75); blob(g, w * .72, h * .2, w * .09, "#ffffff", 1);
      blur(g, w * .0015); for (let i = 0; i < 9; i++) cloud(g, r, w * (i / 8 + (r() - .5) * .1), h * (.9 + r() * .08), w * (.18 + r() * .12), h * (.14 + r() * .1), "#fff7f2", "#f0d9e9", "#b6b0e0");
      for (let i = 0; i < 3; i++) cloud(g, r, w * (.15 + r() * .7), h * (.32 + r() * .2), w * .1, h * .05, "#ffffff", "#ebe4f6", "#c3c0ea");
      blur(g, 0); shafts(g, r, w * .72, h * .2, 0, TAU, 14, w * .8, "#fff6ee", .06);
    },
    shoji(g, w, h, r) { /* a dim warm room before a glowing shoji screen, out of focus; cool steel shadows */
      vg(g, w, h, ["#2b2530", "#3a2c2c", "#1c1a24"]);
      blur(g, w * .009);
      const x0 = w * .12, x1 = w * 1.02, y0 = h * .02, y1 = h * .78, gr = g.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, "#fff4de"); gr.addColorStop(.6, "#ffe2b4"); gr.addColorStop(1, "#ffcf96"); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.fillStyle = "#4a3428"; for (let x = x0; x < x1; x += w * .075) g.fillRect(x, y0, w * .006, y1 - y0); for (let y = y0; y < y1; y += h * .13) g.fillRect(x0, y, x1 - x0, h * .009);
      g.fillStyle = "#24181a"; g.fillRect(x0 - w * .03, 0, w * .04, h); g.fillRect(w * .55, 0, w * .035, h); g.fillRect(0, y1, w, h - y1);
      blur(g, 0);
      blob(g, w * .7, h * .35, w * .55, "#fff0cc", .45); blob(g, w * .35, h * .3, w * .3, "#ffe6b8", .3);
      g.fillStyle = "rgba(40,48,72,.35)"; g.fillRect(0, y1, w, h - y1); blob(g, w * .6, h * .9, w * .35, "#ffcf96", .25);
      shafts(g, r, w * .75, h * .1, PI * .62, PI * .9, 10, w * 1.1, "#ffe8c0", .07);
      bokehs(g, r, 22, 0, 0, w, h * .8, ["#ffe6b0", "#ffd090", "#fff2d8"], w * .01, w * .045, .3);
    },
    floor(g, w, h, r) { /* tatami from above, a sun patch through shoji */
      g.fillStyle = "#8d7f4e"; g.fillRect(0, 0, w, h);
      const mw = w * .42, mh = mw / 2;
      for (let my = -mh; my < h + mh; my += mh) for (let mx = -mw * (my / mh % 2 ? .5 : 0); mx < w; mx += mw) {
        g.fillStyle = `rgb(${130 + r() * 14},${120 + r() * 12},${70 + r() * 10})`; g.fillRect(mx, my, mw, mh);
        g.strokeStyle = "rgba(60,50,20,.18)"; g.lineWidth = 1; for (let k = 0; k < mw; k += 3) { g.beginPath(); g.moveTo(mx + k, my); g.lineTo(mx + k, my + mh); g.stroke() }
        g.fillStyle = "#26301e"; g.fillRect(mx, my, mw, h * .012); g.fillRect(mx, my + mh - h * .012, mw, h * .012);
      }
      blur(g, w * .004); g.save(); g.globalCompositeOperation = "lighter"; g.translate(w * .55, h * .5); g.transform(1, 0, -.35, 1, 0, 0);
      g.fillStyle = "rgba(255,232,190,.5)"; g.fillRect(-w * .25, -h * .5, w * .5, h);
      g.fillStyle = "rgba(0,0,0,.3)"; g.globalCompositeOperation = "source-over"; for (let x = -w * .25; x < w * .25; x += w * .08) g.fillRect(x, -h * .5, w * .006, h); for (let y = -h * .5; y < h * .5; y += h * .14) g.fillRect(-w * .25, y, w * .5, h * .008);
      g.restore(); blur(g, 0);
      const v = g.createRadialGradient(w * .5, h * .5, h * .2, w * .5, h * .5, w * .7); v.addColorStop(0, "rgba(20,24,40,0)"); v.addColorStop(1, "rgba(20,24,40,.65)"); g.fillStyle = v; g.fillRect(0, 0, w, h);
    },
    peach(g, w, h, r) { /* pastel peach light, big soft bokeh */
      vg(g, w, h, ["#f6c4ae", "#fbe0d2", "#f8d2d6", "#f0bcc4"]);
      blob(g, w * .2, h * .15, w * .6, "#fff6ea", .85);
      bokehs(g, r, 26, 0, 0, w, h, ["#fff4e8", "#ffd8c8", "#ffe8f0", "#e8f6ec"], w * .03, w * .12, .35);
    },
    indigo(g, w, h, r) { /* a slow indigo float: deep blue, faint stars, cool bokeh */
      vg(g, w, h, ["#070a22", "#141c4a", "#1c2660", "#0c1236"]);
      blob(g, w * .62, h * .42, w * .5, "#3c56b8", .4); blob(g, w * .3, h * .7, w * .35, "#5a3c9a", .22);
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(220,230,255,${r() * .7})`; const s = r() * 1.6 + .4; g.fillRect(r() * w, r() * h, s, s) }
      bokehs(g, r, 24, 0, 0, w, h, ["#6f8cff", "#9a7cff", "#7fd0ff"], w * .01, w * .06, .25);
    },
    gold(g, w, h, r) { /* raking gold light out of warm dark */
      vg(g, w, h, ["#1c1009", "#3a2412", "#170d07"]);
      blob(g, w * .62, h * .42, w * .6, "#ffa040", .6); blob(g, w * .62, h * .42, w * .2, "#ffe6b0", .85);
      shafts(g, r, w * .62, h * .42, 0, TAU, 22, w * .9, "#ffcf80", .09);
      bokehs(g, r, 30, 0, 0, w, h, ["#ffd080", "#ffb050", "#fff0c0"], w * .006, w * .035, .4);
    },
    sky(g, w, h, r) { /* outro morning: deep cyan sky, crisp white cumulus, a hot sun */
      vg(g, w, h, ["#2a7fdc", "#4f9ee8", "#8cc6f2", "#d4ecf8", "#f2f8f6"]);
      blob(g, w * .86, h * .08, w * .45, "#fffbea", .85); blob(g, w * .86, h * .08, w * .07, "#ffffff", 1);
      blur(g, w * .001);
      cloud(g, r, w * .22, h * .98, w * .55, h * .5, "#ffffff", "#e8eef9", "#a9bde4"); cloud(g, r, w * .8, h * 1.02, w * .5, h * .38, "#ffffff", "#eaf0fa", "#b0c4e8");
      for (let i = 0; i < 5; i++) cloud(g, r, w * (.1 + r() * .8), h * (.25 + r() * .3), w * (.08 + r() * .08), h * (.05 + r() * .05), "#ffffff", "#eef3fb", "#bccdec");
      blur(g, 0); shafts(g, r, w * .86, h * .08, PI * .5, PI * 1.1, 10, w * 1.2, "#ffffff", .06);
    },
    lav(g, w, h, r) { /* lavender-white space, watercolour washes */
      vg(g, w, h, ["#e4dcf6", "#f6f2fc", "#fbf8fe", "#eae2f6"]);
      blur(g, w * .02);
      for (let i = 0; i < 16; i++) blob(g, w * r(), h * r(), w * (.12 + r() * .25), ["#c9b8f2", "#f7c9de", "#c6f0e0", "#ffffff"][i % 4], .25 + r() * .25);
      blur(g, w * .003); g.lineCap = "round";
      for (let i = 0; i < 10; i++) { g.strokeStyle = rgba(["#b9a6ee", "#f0b8d0", "#ffffff"][i % 3], .18 + r() * .14); g.lineWidth = w * (.004 + r() * .01); g.beginPath(); const x = w * r(), y = h * r(); g.moveTo(x, y); g.bezierCurveTo(x + w * .2, y - h * .3 * r(), x + w * .4, y + h * .3 * r(), x + w * (.5 + r() * .3), y - h * .1); g.stroke() }
      blur(g, 0); blob(g, w * .5, h * .45, w * .45, "#ffffff", .6);
    },
    shrine(g, w, h, r) { /* dark shrine eaves, gold light pouring from the bell above */
      vg(g, w, h, ["#2a1610", "#1c0e10", "#0c0608"]);
      blob(g, w * .5, -h * .05, w * .55, "#ffb860", .75); blob(g, w * .5, -h * .02, w * .16, "#fff0c8", .9);
      blur(g, w * .006); g.fillStyle = "#120808"; g.fillRect(w * .04, 0, w * .08, h); g.fillRect(w * .86, 0, w * .09, h); g.fillRect(0, 0, w, h * .06);
      g.fillStyle = "rgba(255,170,90,.35)"; g.fillRect(w * .115, 0, w * .006, h); g.fillRect(w * .855, 0, w * .006, h);
      g.fillStyle = "#e8e0d0"; for (let i = 0; i < 5; i++) { const x = w * (.2 + i * .15); g.beginPath(); g.moveTo(x, h * .06); g.lineTo(x + w * .02, h * .14); g.lineTo(x - w * .005, h * .17); g.lineTo(x + w * .018, h * .25); g.lineTo(x + w * .006, h * .25); g.lineTo(x - w * .015, h * .17); g.lineTo(x + w * .008, h * .14); g.closePath(); g.globalAlpha = .35; g.fill() } g.globalAlpha = 1; /* paper shide */
      blur(g, 0); blob(g, w * .15, h * .85, w * .4, "#c04028", .22);
      shafts(g, r, w * .5, -h * .05, PI * .3, PI * .7, 16, h * 1.3, "#ffd090", .08);
      bokehs(g, r, 34, 0, 0, w, h, ["#ffcf80", "#ffa850", "#fff0c8"], w * .006, w * .04, .45);
    }
  };
  function painting(k) {
    let c = paints.get(k);
    if (!c) { c = document.createElement("canvas"); c.width = PW; c.height = PH; PAINT[k](c.getContext("2d"), PW, PH, rng(seed * 977 + k.length * 131 + k.charCodeAt(0))); paints.set(k, c) }
    return c;
  }
  function cover(k, f, zoom = 1.08, dx = 0, dy = 0) { /* fill the viewport whatever its aspect; dx, dy in -1..1 slide within the margin */
    const img = painting(k), s = Math.max(f.W / img.width, f.H / img.height) * zoom, w = img.width * s, h = img.height * s;
    back2d.drawImage(img, (f.W - w) / 2 * (1 + cl(dx, -1, 1)), (f.H - h) / 2 * (1 + cl(dy, -1, 1)), w, h);
  }

  /* ---------------- shared per-shot helpers ---------------- */
  const TONES = {
    pastel: ["#fff1e0", "#9c8cc8", "#ffe0f0", "#cfc8f2", "#8a6f80", [.5, .6, .45]],
    warm: ["#ffe2bc", "#46557a", "#ffcf96", "#c9a080", "#22202c", [-.2, .45, -.85]],
    peach: ["#fff0e4", "#d49aa6", "#fff0e0", "#f6d6d0", "#a87878", [.4, .7, .5]],
    night: ["#9fb2ff", "#181a48", "#88a0ff", "#3a4a9a", "#0a0c22", [-.3, .6, .5]],
    gold: ["#ffc878", "#3a2018", "#ffd890", "#a06030", "#1a0c08", [-.2, .25, -1]],
    high: ["#ffffff", "#b4a6e0", "#ffffff", "#ece6ff", "#b8a8d0", [.3, .7, .6]],
    morning: ["#fff6e2", "#6f86b8", "#ffffff", "#a8ccf0", "#6a7a5a", [.6, .65, .45]],
    shrine: ["#ffd08a", "#4a2650", "#ffc060", "#8a5030", "#180a10", [.1, 1, .3]]
  };
  function tone(k, lk = 1) {
    const [li, sh, rim, sk, gr, dir] = TONES[k];
    for (const m of TONED) { const u = m.uniforms; u.uLight.value.set(li).multiplyScalar(lk); u.uShade.value.set(sh); u.uRim.value.set(rim); u.uAmbSky.value.set(sk).multiplyScalar(.35); u.uAmbGround.value.set(gr).multiplyScalar(.35); u.uLightDir.value.set(...dir).normalize() }
  }
  const OBJ = { cord: cord.mesh, fib: fib.mesh, maru, lan, rail, rings, clouds };
  function show(...on) { for (const k in OBJ) OBJ[k].visible = on.includes(k); for (const p of PARTS) p.visible = false }
  const fogc = (c, n, f) => { scene.fog.color.set(c); scene.fog.near = n; scene.fog.far = f };
  const sp = new V3();
  function scr(x, y, z) { camera.updateMatrixWorld(); camera.updateProjectionMatrix(); sp.set(x, y, z).project(camera); return [cl(sp.x * .5 + .5, -.2, 1.2), cl(.5 - sp.y * .5, -.2, 1.2)] }
  function cam(px, py, pz, lx, ly, lz, fov, roll = 0) { camera.up.set(0, 1, 0); camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz); if (roll) camera.rotateZ(roll); camera.fov = fov }
  const grade = (sec, o) => Object.assign({}, GR[sec], o);
  const GR = { /* full grade per atmosphere, so a shot that starts before its section boundary (the release at 40.16) keeps its own look */
    pre: { exposure: 1.06, bloom: .85, threshold: .68, glow: .45, sat: .94, lift: [.07, .055, .085], gain: [1.04, .98, 1.02], chroma: .6, vignette: .3 },
    warm: { exposure: 1.0, bloom: .95, threshold: .6, glow: .42, sat: .96, lift: [.035, .035, .05], gain: [1.07, 1, .92], vignette: .5 },
    c2: { exposure: 1.08, bloom: .9, threshold: .66, glow: .48, sat: 1.08, lift: [.06, .035, .08], gain: [1.05, .98, .98], vignette: .38 },
    night: { exposure: 1.0, bloom: .95, threshold: .55, glow: .45, sat: 1.05, lift: [.02, .02, .065], gain: [.95, .98, 1.1], vignette: .5 },
    out: { exposure: 1.08, bloom: .75, threshold: .76, glow: .38, sat: 1.08, lift: [.05, .06, .06], gain: [1.02, 1.02, 1], vignette: .3 }
  };
  const tv = new V3(), tv2 = new V3();
  function trk(curve, len, x, out) { /* point on a track, extended straight past both ends */
    if (x >= 0 && x <= 1) return curve.getPoint(x, out);
    const e = x < 0 ? 0 : 1; curve.getPoint(e, out); curve.getTangent(e, tv2); return out.addScaledVector(tv2, (x - e) * len);
  }

  /* the release track: in from the lower right, a slip loop, out to the upper left */
  const REL = new THREE.CatmullRomCurve3([[4.2, -2.9, -3.1], [2.7, -1.75, -3.5], [1.6, -.75, -3.9], [.95, .05, -4.1], [.25, .42, -3.9], [-.28, .06, -3.7], [-.02, -.48, -3.85], [.6, -.3, -4.05],
    [.78, .32, -4.2], [.15, .92, -4.3], [-1.0, 1.18, -4.2], [-2.2, 1.45, -4.0], [-3.6, 2.15, -3.8], [-5.3, 3.0, -3.6]].map(a => new V3(...a)), false, "centripetal");
  const RELL = REL.getLength();
  /* the loop track: from beside the camera out into a vertical loop over the cloud sea */
  const LOOP = new THREE.CatmullRomCurve3([[.95, -1.25, 1.2], [.75, -.95, -1.0], [.45, -.45, -3.4], [.15, .2, -5.8], [-.15, 1.35, -7.9], [-.2, 3.1, -8.6], [-.05, 4.5, -7.5], [.25, 4.35, -5.8],
    [.55, 2.85, -5.3], [.85, 1.25, -6.5], [1.25, .45, -9.4], [1.7, .2, -13], [2.4, .45, -18.5]].map(a => new V3(...a)), false, "centripetal");
  const LOOPL = LOOP.getLength();
  /* the bow, in the knot's frame (x along the bar, y up, z toward the viewer): tail, wrap, left loop, right loop, cover, tail */
  const BOW = [[-.11, -.6, .03], [-.075, -.35, .06], [-.035, -.12, .075], [-.012, -.055, .062], [-.004, .0, .066], [.0, .06, .012], [.008, .01, -.06], [.014, -.058, -.01], [.02, -.03, .055],
    [-.08, .05, .072], [-.25, .155, .05], [-.345, .05, .02], [-.28, -.085, .04], [-.12, -.06, .08], [0, -.01, .092],
    [.12, .06, .08], [.285, .155, .05], [.355, .04, .02], [.27, -.085, .035], [.1, -.05, .085], [.0, -.022, .1], [.035, -.1, .08], [.072, -.35, .06], [.12, -.58, .03]];
  const NBOW = BOW.length, LOOPS = [9, 19], KN = new V3(0, -.01, .09), bowPts = BOW.map(() => new V3()), BOWC = new THREE.CatmullRomCurve3(bowPts, false, "centripetal");
  function bow(k, lam, t, wind, tailK) { /* k: how far it has tied itself (0 straight .. 1 tied); lam: loop size; wind: breeze */
    for (let j = 0; j < NBOW; j++) {
      const [x, y, z] = BOW[j], q = bowPts[j], isLoop = j >= LOOPS[0] && j < LOOPS[1], tail = j < 3 ? (3 - j) / 3 : j > NBOW - 4 ? (j - NBOW + 4) / 3 : 0;
      q.set(x, y, z); if (isLoop) q.sub(KN).multiplyScalar(lam).add(KN);
      if (tail) { q.y = mix(-.02, q.y, tailK); q.x += wind * .07 * tail * Math.sin(t * 6.3 + j * 1.7); q.z += wind * .08 * tail * Math.sin(t * 4.9 + j * 2.3 + 1) }
      if (isLoop) { q.z += wind * .02 * Math.sin(t * 5.1 + j); q.y += wind * .012 * Math.sin(t * 6.7 + j * 1.3) }
      const w = eio(cl((k - .55 * j / (NBOW - 1)) / .45)); /* straight cord, draped from the upper left, ties itself from the left tail on */
      if (w < 1) { const s = j / (NBOW - 1); q.lerp(tv.set(mix(-1.1, .55, s), mix(.85, -.95, s) + .25 * Math.sin(s * PI), .12 + .2 * Math.sin(s * PI * 2 + t)), 1 - w) }
    }
  }
  const bx = new V3(), by = new V3(), bz = new V3(), bo = new V3();
  function bowSet(sc, rad, glow) { cord.set(0, (s, v) => { BOWC.getPoint(s, v); const x = v.x, y = v.y, z = v.z; v.copy(bo).addScaledVector(bx, x * sc).addScaledVector(by, y * sc).addScaledVector(bz, z * sc) }, rad, "#ffffff", glow) }
  const SILK = ["#ffffff", "#ffffff", "#ffffff", "#ffffff"], KUMI = { kind: 0, sheen: .35, cols: ["#a00c16", "#ffaa38", "#1c216e", "#f4e8d4"] };

  /* marudai thread colours per look (one per opposite pair, so a crossing never changes the pattern) */
  const MCOL = {
    warm: ["#b8142a", "#e8a030", "#b8142a", "#2a3478", "#f0e6d0", "#b8142a", "#e8a030", "#6a2a72"],
    pastel: ["#ffb0a0", "#ffe2d2", "#f6a6be", "#fff4e6", "#c8ecdc", "#ffc8a8", "#f8d0e8", "#ffe8c0"],
    indigo: ["#e8e8ff", "#1a2056", "#26307a", "#141a48", "#2c3a88", "#1c2462", "#323e90", "#18204e"],
    gold: ["#ffb648", "#ff9c30", "#ffc868", "#e88a22", "#ffd890", "#ffa840", "#f09030", "#ffc060"]
  };
  const mq = new THREE.Quaternion(), mY = new V3(0, 1, 0), ma = new V3(), mb = new V3(), mc = new V3(), mdir = new V3(), msc = new V3(), mcol = new THREE.Color(), C0 = new V3(0, .055, 0);
  function seg(i, A, B, r) { mdir.subVectors(B, A); const l = mdir.length(); if (l > 1e-6) mq.setFromUnitVectors(mY, mdir.multiplyScalar(1 / l)); ma.addVectors(A, B).multiplyScalar(.5); threads.setMatrixAt(i, M4.compose(ma, mq, msc.set(r, Math.max(l, 1e-4), r))) }
  const hangAt = (th, k, t, out) => out.set(Math.cos(th) * 1.045 + .012 * Math.sin(t * 1.9 + k), -.3 - .1 * (k % 2) + .01 * Math.sin(t * 2.3 + k * 2), Math.sin(th) * 1.045 + .012 * Math.cos(t * 1.7 + k));
  function marudai(f, look, rot = 0, glowThread = 0) {
    const cols = MCOL[look], b = Math.floor(f.beat), e = eo(f.beatPhase / .55), pA = ((b % H) + H) % H, pB = (pA + (H >> 1)) % H, t = f.t;
    for (let k = 0; k < NB; k++) {
      const kk = k % H, th = (k + .5) / NB * TAU + rot;
      if (kk === pA || kk === pB) { /* this pair crosses over the mirror, on the beat */
        const q = (k + H) % NB, thq = (q + .5) / NB * TAU + rot, side = k < H ? 1 : -1, lift = ss(0, .2, e), drop = ss(.8, 1, e), m = eio(cl((e - .12) / .76));
        hangAt(th, k, t, mb); hangAt(thq, q, t, mc);
        ma.set(mix(Math.cos(th), Math.cos(thq), m) * .97 - Math.sin(th) * side * .3 * Math.sin(PI * m), .36 + .16 * Math.sin(PI * m), mix(Math.sin(th), Math.sin(thq), m) * .97 + Math.cos(th) * side * .3 * Math.sin(PI * m));
        mb.lerp(ma, lift).lerp(mc, drop);
      } else hangAt(th, k, t, mb);
      /* the thread: braid point -> over the rim -> bobbin (or straight to a lifted bobbin) */
      const rr = Math.hypot(mb.x, mb.z);
      if (rr > .99 && mb.y < .01) mc.set(mb.x / rr * .995, .006, mb.z / rr * .995); else mc.copy(mb);
      seg(k * 2, C0, mc, .0085); seg(k * 2 + 1, mc, mb, .0085);
      spools.setMatrixAt(k, M4.makeTranslation(mb.x, mb.y - .15, mb.z)); winds.setMatrixAt(k, M4.makeTranslation(mb.x, mb.y - .15, mb.z));
      mcol.set(cols[kk % cols.length]); if (look === "indigo" && kk === 0) mcol.multiplyScalar(1.6 + glowThread);
      threads.setColorAt(k * 2, mcol); threads.setColorAt(k * 2 + 1, mcol); winds.setColorAt(k, mcol);
    }
    for (const m of [spools, winds, threads]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true }
    /* the braid grows down through the hole a little on every beat; the new braid forms at the glowing point on top */
    const gb = cl(f.beat - B0, 0, 24), grow = Math.floor(gb) + eo((gb - Math.floor(gb)) / .55), L = .95 + .045 * grow;
    cord.look(Object.assign({}, KUMI, { len: L * 7, off: -grow * .32, pulse: .25 + .9 * f.pulse, headA: .7 + 1.6 * f.pulse, glowK: 1.2 }));
    cord.set(0, (s, v) => v.set(.012 * Math.sin(s * 4 + t * .9), mix(.06, -L, s), .01 * Math.cos(s * 3 + t * .7)), .036);
    bag.position.set(.012 * Math.sin(4 + t * .9), -L, .01 * Math.cos(3 + t * .7));
  }

  /* ---------------- the setups ---------------- */
  const BELL = new V3(0, 3.3, -3), JOLT = [[CUE, .15], [CUE + .18, .32]], jl = (t, tj, k = .09) => t > tj ? Math.exp(-(t - tj) / k) : 0;
  const S = {
    "sky:release"(f) { /* the cord pulls free of its slip loop and whips out on the paired accents, against a blush sky */
      const t = f.t, lt = f.shot.lt, j1 = jl(t, CUE), j2 = jl(t, CUE + .18);
      show("cord"); tone("pastel", 1.05); fogc("#f0dcea", 6, 40);
      cover("blush", f, 1.1, -.3 + .1 * Math.sin(t * .3) + .25 * eo((t - CUE - .18) / .4), .2);
      const p = .03 * lt + .13 * eo((t - CUE) / .1) + .52 * eo((t - CUE - .18) / .24);
      cord.look(Object.assign({}, KUMI, { len: 34, pulse: .35 + 1.4 * (j1 + j2), headB: 0, glowK: 1.4 }));
      cord.set(0, (s, v) => {
        const x = p + s * .92; trk(REL, RELL, x, v); trk(REL, RELL, x + .004, tv);
        const tx = tv.x - v.x, ty = tv.y - v.y, l = Math.hypot(tx, ty) || 1; let d = 0;
        for (const [tj, A] of JOLT) if (t > tj) { const z = s - (1 - (t - tj) * 2.6); d += A * Math.exp(-z * z / .03) * Math.sin(z * 22) * Math.exp(-(t - tj) / .7) }
        v.x -= ty / l * d; v.y += tx / l * d; v.z += d * .4;
      }, .075, "#ffffff", .15 * (j1 + j2));
      cam(.04 * Math.sin(t * .5) - .08 * j2, .03 * Math.cos(t * .4) + .04 * j1, 0, 0, .05, -4, 45, .015 * j1 - .03 * j2);
      pset(spark, { c: [0, 0, -4], b: [8, 5, 3], col: "#ffd8b0", col2: "#ffc0dc", size: .05, op: .7 + 1.2 * (j1 + j2) });
      pset(bokeh, { c: [0, 0, -2.3], b: [6, 3.6, 1.6], col: "#fff0f4", col2: "#ffd8e8", size: .32, op: .22, i: 1.1 });
      pset(dust, { c: [0, 0, -3.5], b: [8, 5, 3], col: "#fff4e8", size: .025, op: .8 });
      for (const [tj, A] of JOLT) { /* anime smear lines along the pull, crisp, for a moment after each jolt */
        const a = jl(t, tj, .08); if (a < .02) continue;
        ctx2d.save(); ctx2d.lineCap = "round"; ctx2d.strokeStyle = `rgba(255,244,250,${.55 * a})`;
        for (let i = 0; i < 7; i++) { const o = (i - 3) * f.H * .035 * (A > .2 ? 1.6 : 1), cx = f.W * (.42 + .05 * hash(i + tj)), cy = f.H * (.48 + .04 * hash(i * 3 + tj)), L = f.W * (.12 + .2 * hash(i * 7 + tj));
          ctx2d.lineWidth = f.dpr * (.8 + 1.6 * hash(i + 9)); ctx2d.beginPath(); ctx2d.moveTo(cx + o * .5 + L * .87 * .3, cy + o * .87 + L * .5 * .3); ctx2d.lineTo(cx + o * .5 - L * .87, cy + o * .87 - L * .5); ctx2d.stroke() }
        ctx2d.restore();
      }
      kit.look(grade("pre", { rays: .38, rayX: .84, rayY: .1, leak: .5 * j1 + 1.1 * j2, leakX: .9, leakY: .2, tilt: .15 }));
    },
    "sky:loop"(f) { /* match on the cord: it loops across a periwinkle sky over a cloud sea; the camera rides along it */
      const t = f.t, u = f.shot.u, xc = .012 + .16 * eio(cl((f.shot.lt + .1) / 2.2));
      show("cord", "clouds"); tone("pastel", 1.05); fogc("#e6dcf2", 8, 46);
      cover("peri", f, 1.12, -.4 + .5 * u, .3 - .4 * u);
      cord.look(Object.assign({}, KUMI, { len: LOOPL / 1.1, pulse: .3 + 1.1 * f.pulse, glowK: 1.3 }));
      cord.set(0, (s, v) => { LOOP.getPoint(s, v); const w = ss(0, .25, s); v.x += w * .1 * Math.sin(s * 9 + t * 1.3); v.y += w * .08 * Math.cos(s * 7 + t * 1.1) }, .085);
      trk(LOOP, LOOPL, xc, tv); trk(LOOP, LOOPL, xc + .1, tv2);
      cam(tv.x + .55, tv.y + .42, tv.z + .25, tv2.x, tv2.y + .3, tv2.z, 52, -.08 + .04 * Math.sin(t * .8));
      kit.tick(f, clouds);
      pset(spark, { c: [0, 2, -7], b: [12, 9, 14], col: "#fff0d8", col2: "#ffd0e8", size: .06, op: .8 });
      pset(bokeh, { c: [tv.x, tv.y, tv.z - 2], b: [7, 5, 4], col: "#ffffff", col2: "#f0d8ff", size: .3, op: .18, i: 1.1 });
      kit.look(grade("pre", { rays: .42, rayX: .7, rayY: .2, tilt: .4, focus: .5, band: .42, sat: .98 }));
    },
    "marudai:bobbins"(f) { /* close on the hanging bobbins and their coiled threads, warm shoji backlight */
      const t = f.t, u = f.shot.u, th = (2.5 / NB) * TAU;
      show("maru", "cord"); tone("warm", 1.1); fogc("#3a3040", 3, 14); cover("shoji", f, 1.1, .5 - .3 * u, 0);
      marudai(f, "warm");
      cam(Math.cos(th + .42) * 1.85, -.32 + .05 * u, Math.sin(th + .42) * 1.85, Math.cos(th) * 1.05, -.45, Math.sin(th) * 1.05, 34);
      pset(dust, { c: [Math.cos(th) * 1.2, -.3, Math.sin(th) * 1.2], b: [1.6, 1.2, 1.6], col: "#ffe4b8", size: .012, op: 1 });
      pset(bokeh, { c: [Math.cos(th + .42) * 1.4, -.2, Math.sin(th + .42) * 1.4], b: [1.2, .8, 1.2], col: "#ffe0b0", size: .09, op: .2, i: 1.2 });
      kit.look(grade("warm", { rays: .4, rayX: .7, rayY: .3, tilt: .75, focus: .5, band: .24 }));
    },
    "marudai"(f) { /* the braiding stand: bobbins cross on every beat as the cord grows */
      const t = f.t, u = f.shot.u, az = .55 + .22 * eio(cl((f.shot.lt + .3) / 1.9)), r = 3.35 - .35 * u;
      show("maru", "cord"); tone("warm", 1.1); fogc("#3a3040", 4, 16); cover("shoji", f, 1.1, -.2 + .4 * u, 0);
      marudai(f, "warm");
      cam(Math.cos(az) * r, .95 - .1 * u, Math.sin(az) * r, 0, -.4, 0, 40);
      pset(dust, { c: [0, .2, 0], b: [3, 2.4, 3], col: "#ffe4b8", size: .014, op: 1 });
      const [rx, ry] = scr(0, .06, 0);
      kit.look(grade("warm", { rays: .35, rayX: rx, rayY: ry - .2, tilt: .3, focus: .55, band: .4 }));
    },
    "marudai:top"(f) { /* overhead: the threads radiate from the braid point, which spirals as the stand turns */
      const t = f.t, u = f.shot.u, a = .3 + .45 * u;
      show("maru", "cord"); tone("warm", 1.15); fogc("#3a3040", 4, 18);
      cover("floor", f, 1.1, Math.sin(a) * .5, Math.cos(a) * .3);
      marudai(f, "warm", .35 * f.shot.lt);
      camera.position.set(0, 3.25 - .45 * eio(u), .001); camera.up.set(Math.sin(a), 0, Math.cos(a)); camera.lookAt(0, 0, 0); camera.fov = 44;
      pset(dust, { c: [0, 1.2, 0], b: [2.6, 2, 2.6], col: "#ffe4b8", size: .014, op: 1 });
      kit.look(grade("warm", { rays: .3, rayX: .5, rayY: .5, tilt: .45, focus: .5, band: .34, glow: .4 }));
    },
    "marudai:pastel"(f) { /* extreme close: strands passing into the braid point, pastel peach light */
      const t = f.t, lt = f.shot.lt, az = .9 + .25 * lt;
      show("maru", "cord"); tone("peach", 1.15); fogc("#f6d0c8", 1.2, 6); cover("peach", f, 1.12, -.3 + .4 * lt, 0);
      marudai(f, "pastel");
      cam(Math.cos(az) * .52, .2 - .03 * lt, Math.sin(az) * .52, 0, .05, 0, 30);
      pset(bokeh, { c: [Math.cos(az) * .3, .14, Math.sin(az) * .3], b: [.5, .3, .5], col: "#fff4ea", col2: "#ffd8e0", size: .05, op: .25, i: 1.2 });
      pset(spark, { c: [0, .1, 0], b: [.7, .4, .7], col: "#fff0e0", size: .012, op: 1 });
      kit.look(grade("c2", { exposure: 1.12, glow: .58, sat: .9, lift: [.09, .065, .07], gain: [1.06, .98, .95], tilt: .9, focus: .5, band: .2, leak: .35, leakX: .1, leakY: .15 }));
    },
    "marudai:indigo"(f) { /* a pale thread through dark indigo strands */
      const t = f.t, lt = f.shot.lt, az = 2.2 + .18 * lt;
      show("maru", "cord"); tone("night", 1.0); fogc("#0c1236", 1.5, 7); cover("indigo", f, 1.1, .3 - .4 * lt, 0);
      marudai(f, "indigo", 0, f.pulse);
      cam(Math.cos(az) * .85, .1, Math.sin(az) * .85, 0, .04, 0, 28);
      pset(spark, { c: [0, .1, 0], b: [1.4, .5, 1.4], col: "#c8d8ff", col2: "#a090ff", size: .014, op: .9 });
      pset(bokeh, { c: [Math.cos(az) * .5, .1, Math.sin(az) * .5], b: [.8, .4, .8], col: "#7f8fff", col2: "#b090ff", size: .06, op: .2 });
      kit.look(grade("night", { tilt: .75, focus: .5, band: .2, rays: .25, rayX: .5, rayY: .5 }));
    },
    "marudai:raking"(f) { /* low raking angle along taut amber threads in gold light */
      const t = f.t, lt = f.shot.lt, az = 4.0 - .12 * lt;
      show("maru", "cord"); tone("gold", 1.4); fogc("#2a180c", 2, 8); cover("gold", f, 1.1, -.2 + .3 * lt, 0);
      marudai(f, "gold");
      cam(Math.cos(az) * 1.3, .075 + .02 * lt, Math.sin(az) * 1.3, 0, .05, 0, 36);
      pset(dust, { c: [0, .3, 0], b: [2.4, .8, 2.4], col: "#ffd890", size: .014, op: 1 });
      const [rx, ry] = scr(0, .06, 0);
      kit.look(grade("c2", { exposure: 1.04, bloom: 1.05, threshold: .55, glow: .5, sat: 1.1, lift: [.05, .03, .01], gain: [1.12, 1, .8], rays: .75, rayX: rx, rayY: ry, tilt: .6, focus: .5, band: .25 }));
    },
    "knot:tie"(f) { /* the finished cord ties itself into a bow on a lantern's handle; it cinches on the beat */
      const t = f.t, lt = f.shot.lt, u = f.shot.u, tb = f.shot.t0 + (timing && timing.bp || .674), k = eio(cl(lt / .62)), cin = t > tb ? eo((t - tb) / .12) : 0;
      show("cord", "lan"); tone("warm", 1.1); fogc("#2c2430", 3, 14); cover("shoji", f, 1.1, .3 - .3 * u, .1);
      lan.position.set(0, -1.0, 0); lan.scale.setScalar(1); lan.rotation.set(.04 * Math.sin(t * 1.3), .3 + .05 * Math.sin(t * .7), .03 * Math.sin(t * 1.1 + f.beat * .4));
      lan.updateMatrixWorld(); bo.set(0, .74, 0).applyMatrix4(lan.matrixWorld); bx.set(1, 0, 0).transformDirection(lan.matrixWorld); by.set(0, 1, 0).transformDirection(lan.matrixWorld); bz.crossVectors(bx, by);
      bow(k, 1.12 - .12 * cin, t, .25, .5); cord.look(Object.assign({}, KUMI, { len: 9, pulse: .2 + .8 * f.pulse, glowK: 1.3 }));
      bowSet(.62, .016, .9 * jl(t, tb, .2));
      cam(.32 - .1 * u, -.28, 1.55 - .25 * eio(u), 0, -.38, 0, 40);
      pset(dust, { c: [0, -.4, .3], b: [2, 1.6, 1.4], col: "#ffe0b0", size: .012, op: 1 });
      pset(bokeh, { c: [0, -.3, .9], b: [1.4, 1, .5], col: "#ffd8a0", size: .07, op: .16, i: 1.2 });
      const [rx, ry] = scr(0, -1.0, 0);
      kit.look(grade("warm", { rays: .6, rayX: rx, rayY: ry, tilt: .35, focus: .62, band: .4, glow: .48 }));
    },
    "knot:rail"(f) { /* outro: the bow on a red stair rail, fluttering in the morning breeze, blue sky and white cloud */
      const t = f.t, lt = f.shot.lt, u = f.shot.u, a = .45;
      show("cord", "rail"); tone("morning", 1.15); fogc("#cfe4f2", 6, 40); cover("sky", f, 1.1, .3 - .35 * u, -.2);
      bo.set(0, 0, 0); bx.set(Math.cos(a), Math.sin(a), 0); by.set(-Math.sin(a), Math.cos(a), 0); bz.set(0, 0, 1);
      pipe.position.set(0, 0, 0); pipe.quaternion.setFromUnitVectors(mY, bx);
      post.position.set(-1.15 * Math.cos(a), -1.15 * Math.sin(a) - 2, 0);
      bow(1, 1, t, 1 + .6 * f.pulse, 1); cord.look(Object.assign({}, KUMI, { len: 9, pulse: .15 + .6 * f.pulse, glowK: 1.2 }));
      bowSet(1.25, .027, 0);
      cam(.4 - .1 * u, -.16, 1.25 - .15 * eio(cl((lt + .5) / 1.85)), .02, -.12, 0, 40);
      pset(spark, { c: [0, 0, .2], b: [3, 2, 1.5], col: "#ffffff", col2: "#fff2c8", size: .03, op: .9 });
      pset(bokeh, { c: [.4, .2, .6], b: [2, 1.4, .6], col: "#ffffff", col2: "#d8f0ff", size: .09, op: .2, i: 1.2 });
      kit.look(grade("out", { rays: .45, rayX: .86, rayY: .08, leak: .45 + .3 * f.downPulse, leakX: .95, leakY: .05, tilt: .3, focus: .5, band: .42 }));
    },
    "drift"(f) { /* red and blue strands drift in lavender-white space; mint and gold flecks; they fray apart */
      const t = f.t, u = f.shot.u, spread = .05 + .32 * eo(u);
      show("fib"); tone("high", 1.1); fogc("#f4f0fa", 4, 20); cover("lav", f, 1.1, -.2 + .3 * u, 0);
      strands(f, (i, s, v) => {
        const z = -2.6 - 2.8 * hash(i + 1), ph = hash(i + 5) * TAU, o = (i - (FIB - 1) / 2) * spread;
        v.set(mix(-4.8, 4.8, s), mix(-2.1, 2.3, s) + o + .35 * Math.sin(s * 3.2 + ph + t * .9), z + .3 * Math.cos(s * 2.5 + ph * 1.3 + t * .7));
      });
      cam(.05 * Math.sin(t * .6), .04 * Math.cos(t * .5), 0, 0, 0, -4, 44, .05);
      pset(fleck, { c: [0, 0, -3.5], b: [9, 6, 4], col: "#9ff0d2", col2: "#ffd070", size: .07, op: .9, i: 1.1 });
      pset(spark, { c: [0, 0, -3.5], b: [9, 6, 4], col: "#fff0c0", size: .04, op: .8 });
      kit.look(grade("c2", { exposure: 1.12, glow: .55, sat: 1.1, lift: [.08, .06, .1], gain: [1.03, .98, 1.04], threshold: .72, tilt: .35, focus: .5, band: .45 }));
    },
    "drift:tumble"(f) { /* falling through the cord lines; crisp speed lines */
      const t = f.t, lt = f.shot.lt, u = f.shot.u, cy = -(3.2 * lt + 3.4 * lt * Math.abs(lt)), spread = .37 + .4 * eo(u);
      show("fib"); tone("high", 1.1); fogc("#f2ecfa", 3, 22); cover("lav", f, 1.12, .3, cl(-.8 + 1.6 * u, -1, 1));
      strands(f, (i, s, v) => {
        const a = hash(i + 11) * TAU, r = .5 + 2.6 * hash(i + 17) * (1 + spread), ph = hash(i + 5) * TAU;
        v.set(Math.cos(a) * r + .3 * Math.sin(s * 5 + ph + t), mix(10, -28, s), -2.2 + Math.sin(a) * r * .8 + .3 * Math.cos(s * 4 + ph + t * .8));
      });
      cam(0, cy, 0, .2 * Math.sin(t), cy - 2.2, -3.2, 52, .25 * Math.sin(lt * 1.6) + .35 * lt);
      pset(fleck, { c: [0, cy - 1, -3], b: [8, 8, 6], col: "#9ff0d2", col2: "#ffd070", size: .07, op: .9, i: 1.1 });
      pset(spark, { c: [0, cy - 1, -3], b: [8, 8, 6], col: "#fff0c0", size: .04, op: .8 });
      const n = pick(36, 70, 110), v = 1.2 + 4 * Math.abs(lt), Hh = f.H * 1.6; /* speed lines: crisp, streaming up past the falling camera */
      ctx2d.save(); ctx2d.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const h1 = hash(i * 1.3 + 2), h2 = hash(i * 2.7 + 5), x = h1 * f.W, len = (.06 + .22 * h2) * f.H * Math.min(2, v * .4), y = (((h2 * Hh - lt * f.H * v * (.6 + h2)) % Hh) + Hh) % Hh - f.H * .3;
        ctx2d.strokeStyle = `rgba(${h1 < .3 ? "196,176,240" : "255,255,255"},${.25 + .35 * h2})`; ctx2d.lineWidth = f.dpr * (.6 + 1.8 * hash(i + 31));
        ctx2d.beginPath(); ctx2d.moveTo(x, y); ctx2d.lineTo(x, y + len); ctx2d.stroke();
      }
      ctx2d.restore();
      kit.look(grade("c2", { exposure: 1.12, glow: .55, sat: 1.1, lift: [.08, .06, .1], gain: [1.03, .98, 1.04], threshold: .72, chroma: 1.2, tilt: .3, focus: .5, band: .5 }));
    },
    "drift:indigo"(f) { /* a slow indigo float: a red loop passes a small suspended lantern */
      const t = f.t, lt = f.shot.lt, cx = -1.15 + 1.5 * (lt + .3) / 1.2, ro = .35 + .22 * lt, c = Math.cos(ro), sn = Math.sin(ro);
      show("cord", "fib", "lan"); tone("night", 1.05); fogc("#0c1236", 3, 14); cover("indigo", f, 1.1, -.3 + .3 * lt, .1);
      lan.position.set(.62, .28 + .03 * Math.sin(t * 1.4), -3.3); lan.scale.setScalar(.3); lan.rotation.set(0, t * .3, .05 * Math.sin(t * 1.1));
      cord.look(Object.assign({}, KUMI, { len: 12, pulse: .3 + f.pulse, glowK: 1.3 }));
      cord.set(0, (s, v) => { const p = mix(-1.15 * PI, 1.15 * PI, s), x = .3 * p - .55 * Math.sin(p), y = -.46 * Math.cos(p); v.set(cx + x * c - y * sn, -.05 + x * sn + y * c + .04 * Math.sin(t + s * 4), -2.3 + .25 * Math.sin(p * .5)) }, .045);
      for (let i = 1; i < FIB; i++) fib.hide(i);
      fib.look({ kind: 2, len: 30, sheen: .2, cols: SILK }); fib.set(0, (s, v) => v.set(.62, mix(.28 + .03 * Math.sin(t * 1.4) + .16, 3.2, s), -3.3), .005, "#e8dccc");
      cam(.04 * Math.sin(t * .4), .03 * Math.cos(t * .5), 0, .1, .05, -3, 42);
      pset(bokeh, { c: [0, 0, -4.5], b: [8, 5, 4], col: "#6f86ff", col2: "#a07cff", size: .35, op: .3 });
      pset(spark, { c: [0, 0, -3.5], b: [6, 4, 3], col: "#d8e4ff", col2: "#ffd8a0", size: .03, op: .7 });
      const [rx, ry] = scr(.62, .28, -3.3);
      kit.look(grade("night", { rays: .45, rayX: rx, rayY: ry, tilt: .3, focus: .5, band: .45 }));
    },
    "bell"(f) { /* a thick braided bell rope swings; the bell, out of frame above, rings in gold waves on the beat */
      const t = f.t, ph = f.beat, top = BELL, len = 6.4;
      show("cord", "rings"); tone("shrine", 1.25); fogc("#1c0e10", 4, 18); cover("shrine", f, 1.1, .2 * Math.sin(PI * ph) * .5, -.3);
      cord.look({ kind: 1, len: 7, sheen: .45, cols: ["#c41e2c", "#f6efe2", "#5c3a90", "#f6efe2"], pulse: .3 + .6 * f.pulse, glowK: 1.1, glowCol: "#ffc070" });
      let x = top.x, y = top.y, z = top.z, ls = 0;
      cord.set(0, (s, v) => { /* integrate down the rope; each point lags the swing a little more, so it bends like a heavy rope */
        if (s === 0) { x = top.x; y = top.y; z = top.z; ls = 0 }
        else { const th = .32 * Math.cos(PI * (ph - .32 * s)), tz = .12 * Math.sin(PI * (ph - .2 * s) + .6), d = (s - ls) * len; x += Math.sin(th) * d; y -= Math.cos(th) * Math.cos(tz) * d; z += Math.sin(tz) * d; ls = s }
        v.set(x, y, z);
      }, s => .17 * (1 + .1 * ss(.85, 1, s)));
      cam(.5, -.55, 1.4, 0, .9, -3, 44, -.04);
      camera.updateMatrixWorld();
      rings.children.forEach((r, i) => { /* a pair of rings per beat, the newest brightest */
        const age = (f.beatPhase + (i === 2 ? 1 : 0)) * (timing && timing.bp || .674) - (i === 1 ? .09 : 0), a = age < 0 ? 0 : (1 - cl(age / .75)) ** 2;
        r.position.set(0, 3.6, -3); r.quaternion.copy(camera.quaternion); r.scale.setScalar(.4 + age * 7); r.material.opacity = a * (i === 2 ? .5 : 1) * (.7 + .5 * f.downPulse); r.visible = a > .003;
      });
      pset(dust, { c: [0, .8, -2.5], b: [5, 5, 3], col: "#ffd890", size: .02, op: 1 });
      pset(bokeh, { c: [0, .5, -1], b: [4, 3, 1.5], col: "#ffcf80", col2: "#ff9a50", size: .14, op: .2, i: 1.3 });
      kit.look(grade("c2", { exposure: 1.0, bloom: 1.0, threshold: .58, glow: .46, sat: 1.1, lift: [.04, .02, .04], gain: [1.1, .98, .88], rays: .7, rayX: .5, rayY: .0, leak: .25 + .35 * (1 - f.beatPhase) ** 3, leakX: .5, leakY: 0 }));
    }
  };
  function strands(f, fn) { /* the fine strands: red, blue and one gold, silk-shaded */
    fib.look({ kind: 2, len: 40, sheen: .45, pulse: 0, cols: SILK });
    for (let i = 0; i < FIB; i++) fib.set(i, (s, v) => fn(i, s, v), .022 + .022 * hash(i + 3), i % 5 === 4 ? "#ffcf5a" : i % 2 ? "#3b62d8" : "#e02436", i % 5 === 4 ? .3 : 0);
  }

  return {
    update(f) {
      const id = f.shot.var ? f.shot.key + ":" + f.shot.var : f.shot.key;
      (S[id] || S.marudai)(f);
      if (f.debug) globalThis.__cordDbg = { maru, spools, winds, threads, bag, legs, cord, fib, dust, spark, bokeh, mirror: maru.children[0], base: maru.children[1] }; /* TEMP debug */
      kit.tick(f, ...PARTS);
      for (const r of [cord, fib]) r.U.uTime.value = f.t;
    },
    setVisible(on) { root.visible = on },
    dispose() {
      scene.remove(root); scene.fog = null;
      for (const m of [legs, spools, winds, threads]) m.dispose();
      for (const x of mine) x.dispose();
      for (const c of paints.values()) c.width = 0; paints.clear(); /* toon materials, paintings, particles, haze: kit.dispose() */
    }
  };
}
