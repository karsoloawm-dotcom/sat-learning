/* Dream Lantern fallback scene: what the core shows for a module that is missing, slow or throwing. It is v1's world in the
   dream look, so a failure never looks worse than v1: the crater lake (lake.glb: terrain, torii, stone lanterns) in toon/ramp
   shading, a painted section sky behind it, paper lanterns floating and rising with their mirror images, the red cord over
   the water, fog banks and sparkles. The framing changes with the shot, so consecutive fallback shots do not repeat. */
const ANG = [ /* camera position, look-at, fov: wide, low over the water, the torii, the shore, high over the crater */
  [[0, 4.5, 34], [0, 7, -24], 55], [[.3, 1.1, 10], [.2, 2, -20], 46], [[-7, .9, -7], [0, 3.2, -20], 42],
  [[-22, 1.4, -18], [-6, 2, -34], 44], [[14, 46, 40], [0, 0, -6], 48]];
export async function create({ THREE, scene, camera, back2d, kit, tier, jsm, base }) {
  const N = { saver: [70, 16], smooth: [180, 40], ultra: [420, 90] }[tier] || [180, 40], rnd = mulberry(5);
  const world = new THREE.Group(), mirror = new THREE.Group(); mirror.scale.y = -1; scene.add(world, mirror);
  const owned = []; const own = o => (owned.push(o), o);
  const terrMat = kit.toon({ vertexColors: true, color: "#b9a6c2", soft: .35, rimK: .35, side: THREE.DoubleSide });
  const propMat = kit.toon({ vertexColors: true, soft: .2, rimK: .5, side: THREE.DoubleSide });
  /* lake.glb has no normals: smooth ones for the hills, faceted ones for the torii and stone lanterns */
  try {
    const { GLTFLoader } = await import(jsm + "loaders/GLTFLoader.js");
    const gl = await new GLTFLoader().loadAsync(base + "lake.glb");
    const by = n => gl.scene.getObjectByName(n), prep = (o, flat) => o.traverse(m => { if (!m.isMesh) return; if (flat) m.geometry = own(m.geometry.toNonIndexed()); m.geometry.computeVertexNormals(); own(m.geometry); m.material = flat ? propMat : terrMat });
    const terr = by("terrain"), torii = by("torii"), toro = by("toro");
    if (terr) { prep(terr, false); terr.scale.set(1.15, .48, 1.15); world.add(terr) }
    if (torii) { prep(torii, true); torii.position.set(0, -.15, -20); torii.scale.setScalar(1.15); world.add(torii) }
    if (toro) { prep(toro, true); [[-9, -31.4], [9, -31.4], [-19, -26.3], [19, -26.3], [-27, -18]].forEach(([x, z], i) => { const o = i ? toro.clone() : toro; o.position.set(x, -.25, z); o.rotation.y = Math.atan2(x, z); world.add(o) }) }
    for (const o of [...world.children]) mirror.add(o.clone()); /* their reflections (shared geometry) */
  } catch (e) { console.warn("Dream Lantern fallback: lake.glb unavailable", e) }
  /* paper lanterns: a ribbed lathe, warm inside */
  const prof = [[0, -.5], [.16, -.5], [.3, -.42], [.4, -.24], [.43, -.02], [.4, .2], [.3, .38], [.17, .47], [0, .48]].map(([x, y]) => new THREE.Vector2(x, y));
  const lg = own(new THREE.LatheGeometry(prof, tier === "saver" ? 8 : 14)), pos = lg.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), k = .55 + .45 * Math.exp(-y * y * 8), rib = .8 + .2 * Math.cos(y * 60); col[i * 3] = k * rib; col[i * 3 + 1] = k * rib * .86; col[i * 3 + 2] = k * rib * .7 }
  lg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const paper = kit.toon({ vertexColors: true, color: "#ffe0b0", emissive: new THREE.Color(.7, .28, .07), soft: .4, rimK: .8, side: THREE.DoubleSide, fog: false });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const float = new THREE.InstancedMesh(lg, paper, N[0]), rise = new THREE.InstancedMesh(lg, paper, N[1]);
  for (let i = 0; i < N[0]; i++) { const r = 5 + 26 * Math.sqrt(rnd()), a = rnd() * 6.283; let x = Math.cos(a) * r, z = Math.sin(a) * r - 4; if (Math.abs(x) < 3 && z < -14 && z > -26) x += 6 * Math.sign(x || 1); M.compose(P.set(x, .3, z), Q.setFromAxisAngle(up, rnd() * 6), S.setScalar(.7 + .5 * rnd())); float.setMatrixAt(i, M) }
  const RP = Array.from({ length: N[1] }, () => [(rnd() - .5) * 50, -4 - rnd() * 30, rnd(), .5 + rnd() * .5]);
  const floatM = new THREE.InstancedMesh(lg, paper, N[0]); floatM.instanceMatrix = float.instanceMatrix;
  const riseM = new THREE.InstancedMesh(lg, paper, N[1]); riseM.instanceMatrix = rise.instanceMatrix;
  rise.instanceMatrix.setUsage(THREE.DynamicDrawUsage); [float, rise, floatM, riseM].forEach(m => m.frustumCulled = false);
  world.add(float, rise); mirror.add(floatM, riseM);
  /* the red cord: a braided loop over the water */
  const loop = []; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; loop.push(new THREE.Vector3(Math.sin(a) * 27, 2.4 + 1.4 * Math.sin(a * 3), -Math.cos(a) * 27 - 3)) }
  const cord = new THREE.Mesh(own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop, true), tier === "saver" ? 300 : 700, .14, 8, true)), kit.toon({ color: "#c0182a", emissive: new THREE.Color(.25, .02, .03), rim: "#ffb070", rimK: .9 }));
  world.add(cord); mirror.add(cord.clone());
  /* water: a dark, tinted pane over the mirrored world; the painted sky shows through it */
  const water = new THREE.Mesh(own(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2)), own(new THREE.MeshBasicMaterial({ color: "#1a1530", transparent: true, opacity: .42, depthWrite: false })));
  water.renderOrder = 1; scene.add(water);
  const fog = kit.haze({ count: { saver: 14, smooth: 36, ultra: 80 }[tier], center: [0, 1.2, -18], box: [90, 2, 60], size: 18, opacity: .38 });
  const glints = kit.particles({ kind: "spark", count: { saver: 200, smooth: 700, ultra: 2000 }[tier], center: [0, .05, -10], box: [60, .1, 50], size: .09, drift: [0, 0, 0], wobble: .05, twinkle: .9, on: "fast" });
  const motes = kit.particles({ kind: "glow", count: { saver: 150, smooth: 500, ultra: 1500 }[tier], center: [0, 4, -12], box: [50, 8, 40], size: .12, drift: [.05, .12, 0] });
  scene.add(fog, glints, motes);
  scene.fog = new THREE.Fog(0x000000, 40, 170);
  const paint = new Map(); /* the sky for each section, painted once: the gradient, stars, soft cloud bands, its reflection below */
  function sky(sec) {
    if (paint.has(sec)) return paint.get(sec);
    const c = document.createElement("canvas"); c.width = tier === "saver" ? 640 : 1280; c.height = c.width * 9 / 16;
    const g = c.getContext("2d"), st = kit.palette(sec).sky, H = c.height, hz = H * .58, gr = g.createLinearGradient(0, 0, 0, hz), gr2 = g.createLinearGradient(0, hz, 0, H);
    st.forEach((s, i) => { gr.addColorStop(i / (st.length - 1), s); gr2.addColorStop(1 - i / (st.length - 1), s) });
    g.fillStyle = gr; g.fillRect(0, 0, c.width, hz); g.globalAlpha = .7; g.fillStyle = gr2; g.fillRect(0, hz, c.width, H - hz); g.globalAlpha = 1;
    const r = mulberry(sec.length * 31);
    for (let i = 0; i < 260; i++) { const y = r() * hz * .7; g.globalAlpha = (1 - y / (hz * .7)) * r() * .9; g.fillStyle = "#fff"; g.fillRect(r() * c.width, y, 1.5, 1.5) }
    g.globalAlpha = 1; /* soft cloud bands: round gradients squashed into long ellipses */
    for (let i = 0; i < 26; i++) { const x = r() * c.width, y = hz * (.45 + r() * .5), rx = 80 + r() * 260, gg = g.createRadialGradient(0, 0, 0, 0, 0, rx); gg.addColorStop(0, "rgba(255,230,220,.16)"); gg.addColorStop(1, "rgba(255,230,220,0)"); g.save(); g.translate(x, y); g.scale(1, .22); g.fillStyle = gg; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore() }
    paint.set(sec, c); return c;
  }
  const V = new THREE.Vector3(), V2 = new THREE.Vector3();
  return {
    update(f) {
      const P0 = kit.palette(f.section);
      back2d.drawImage(sky(f.section), -f.W * .03 + Math.sin(f.t * .05) * f.W * .02, 0, f.W * 1.06, f.H);
      scene.fog.color.set(P0.fog); water.material.color.set(P0.shade).multiplyScalar(.35);
      fog.userData.material.uniforms.uTop.value.set(P0.fog); fog.userData.material.uniforms.uBot.value.set(P0.shade);
      /* the rising lanterns loop upward; their mirror images follow */
      for (let i = 0; i < N[1]; i++) { const [x, z, ph, sp] = RP[i], y = ((f.t * .6 * sp + ph * 40) % 40), s = .8 * (1 - y / 46); M.compose(P.set(x + Math.sin(f.t * .3 + ph * 9) * 1.2, y + .3, z), Q.setFromAxisAngle(up, f.t * .2 + ph * 6), S.setScalar(Math.max(.01, s))); rise.setMatrixAt(i, M) }
      rise.instanceMatrix.needsUpdate = true;
      world.position.y = Math.sin(f.t * .8) * .03;
      paper.uniforms.uEmissive.value.setRGB(.7, .28, .07).multiplyScalar(1 + .4 * f.pulse);
      /* framing: one of five set-ups per shot, a slow drift through it */
      const a = ANG[((f.shot.i * 7 + (f.shot.side === "R" ? 3 : 0)) % ANG.length + ANG.length) % ANG.length], u = f.shot.u, e = u * u * (3 - 2 * u);
      camera.position.set(...a[0]).add(V.set(Math.sin(f.t * .2) * .6 + (e - .5) * 3, Math.sin(f.t * .15) * .2, -(e - .5) * 3));
      camera.lookAt(V2.set(...a[1])); camera.fov = a[2];
      kit.tick(f, fog, glints, motes);
      kit.look({ glow: .4, bloom: .9, rays: .35, rayX: .5, rayY: .55, tilt: a === ANG[4] ? .8 : .25, focus: .55 });
    },
    setVisible(on) { world.visible = mirror.visible = water.visible = fog.visible = glints.visible = motes.visible = on },
    dispose() {
      scene.remove(world, mirror, water, fog, glints, motes); scene.fog = null;
      for (const o of owned) o.dispose(); [float, rise, floatM, riseM].forEach(m => m.dispose());
      for (const c of paint.values()) c.width = 0; paint.clear(); /* toon materials, haze, particles: kit.dispose() */
    }
  };
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
