/* Dream Lantern scene-module template, and the core's fallback when a module is missing or throws.
   Copy it to scenes/<module>.mjs. The contract (section 6 of the v2 plan):
   create({THREE, scene, camera, ctx2d, back2d, renderer, kit, tier, seed, timing, base, jsm}) -> {update(f), setVisible(on), dispose()}
   - Build with the kit (kit.mjs) so every module shares one look: kit.toon() materials, kit.sky(), kit.haze(), kit.particles(),
     kit.paint(), and kit.look({...}) each frame for this shot's post (bloom, glow, tilt-shift, rays, leak, grade).
   - scene/camera are yours alone. Leave scene.background null so back2d (your painting, behind the 3D) shows through.
   - back2d / ctx2d arrive cleared, clipped and translated to your viewport: draw in device pixels in [0, f.W] x [0, f.H].
     back2d goes through the post (it glows and is graded with the 3D); ctx2d sits on top, crisp and ungraded.
   - update(f) must be a pure function of f (f.t, f.shot.key / var / u / lt, the beat fields), so seeking and split screens work.
   - Paint costly 2D art once into offscreen canvases and blit it; dispose what you made (kit objects are freed by kit.dispose()). */
export async function create({ THREE, scene, camera, ctx2d, back2d, kit, tier }) {
  const paint = new Map(); /* section -> painted sky, made on first use */
  function painting(sec) {
    if (paint.has(sec)) return paint.get(sec);
    const c = document.createElement("canvas"); c.width = tier === "saver" ? 480 : 960; c.height = c.width * 9 / 16;
    const g = c.getContext("2d"), st = kit.palette(sec).sky, gr = g.createLinearGradient(0, 0, 0, c.height);
    st.forEach((col, i) => gr.addColorStop(i / (st.length - 1), col));
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 160; i++) { const y = Math.random() * c.height * .55; g.globalAlpha = (1 - y / (c.height * .55)) * Math.random() * .9; g.fillStyle = "#fff"; g.fillRect(Math.random() * c.width, y, 1.4, 1.4) }
    g.globalAlpha = 1; const P = kit.palette(sec); /* a few cumulus near the horizon, lit from below */
    for (let i = 0; i < 4; i++) kit.cloud2d(g, c.width * (.12 + i * .26), c.height * (.72 + .05 * (i % 2)), c.width * .34, c.height * .24, P.shade, P.light, i + 1);
    paint.set(sec, c); return c;
  }
  const group = new THREE.Group(); scene.add(group);
  /* a paper lantern: lathe body, toon-shaded paper, lit from inside (HDR emissive, so it blooms) */
  const prof = [[0, -.5], [.18, -.5], [.32, -.4], [.42, -.2], [.45, 0], [.42, .2], [.32, .38], [.18, .47], [0, .48]].map(([x, y]) => new THREE.Vector2(x, y));
  const paper = kit.toon({ color: "#ffd9a8", emissive: new THREE.Color(.55, .24, .07), rimK: .9, soft: .3 });
  const lantern = new THREE.Mesh(new THREE.LatheGeometry(prof, tier === "saver" ? 12 : 24), paper);
  lantern.position.set(0, 0, -6); group.add(lantern);
  const clouds = kit.haze({ count: { saver: 14, smooth: 30, ultra: 60 }[tier], center: [0, -3.2, -26], box: [70, 3, 40], size: 16, opacity: .55 });
  const sparks = kit.particles({ kind: "spark", count: { saver: 120, smooth: 400, ultra: 1200 }[tier], center: [0, 0, -8], box: [14, 8, 10], size: .1, drift: [0, .15, 0], on: "fast" });
  group.add(clouds, sparks);
  return {
    update(f) {
      const img = painting(f.section), drift = Math.sin(f.t * .1) * .03 * f.W;
      back2d.drawImage(img, drift - f.W * .05, 0, f.W * 1.1, f.H); /* cover the viewport, whatever its aspect */
      const top = kit.palette(f.section);
      clouds.userData.material.uniforms.uTop.value.set(top.shade); clouds.userData.material.uniforms.uBot.value.set(top.light).multiplyScalar(1.25);
      lantern.position.y = Math.sin(f.beat * Math.PI * .5) * .12 + f.downPulse * .1;
      lantern.rotation.y = f.t * .3; lantern.scale.setScalar(1 + f.pulse * .05);
      /* a slow, floating camera: drift and ease, never snap */
      camera.position.set(Math.sin(f.t * .21) * .4, .2 + Math.sin(f.t * .17) * .15, 0); camera.lookAt(0, 0, -6); camera.fov = 45;
      kit.tick(f, clouds, sparks);
      kit.look({ rays: .3, rayX: .5, rayY: .5, glow: .35 });
      if (f.debug) { ctx2d.fillStyle = "#fff"; ctx2d.font = `${14 * f.dpr}px system-ui`; ctx2d.fillText(`${f.shot.key}${f.shot.var ? ":" + f.shot.var : ""} ${f.shot.side || ""}`, 12 * f.dpr, f.H - 14 * f.dpr) }
    },
    setVisible(on) { group.visible = on },
    dispose() { scene.remove(group); lantern.geometry.dispose(); for (const c of paint.values()) c.width = 0; paint.clear() /* paper, clouds, sparks: kit.dispose() */ }
  };
}
