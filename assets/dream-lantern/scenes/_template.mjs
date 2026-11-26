/* Dream Lantern scene-module template, and the core's fallback when a module is missing or throws.
   Copy it to scenes/<module>.mjs. The contract (see the v2 plan):
   create({THREE, scene, camera, ctx2d, back2d, renderer, tier, seed, timing, base, jsm}) -> {update(f), setVisible(on), dispose()}
   - scene/camera are yours alone. Leave scene.background null to let back2d (painted, behind the 3D) show through.
   - back2d / ctx2d arrive cleared, clipped and translated to your viewport: draw in device pixels in [0, f.W] x [0, f.H].
   - update(f) must be a pure function of f (f.t, f.shot.key / var / u / lt, the beat fields), so seeking and split screens work.
   - Paint costly 2D art once into offscreen canvases and blit it; dispose every GPU resource you made. */
const PAL = {
  intro: ["#07172B", "#254777", "#617390", "#F7B578"], verse1: ["#091324", "#34638D", "#65C6F7", "#E4A06F"],
  prechorus: ["#26344D", "#AFC6ED", "#F4DEEC", "#C47C4B"], chorus1: ["#0E0C18", "#4489CB", "#D6B5E5", "#F9F6FB"],
  verse2: ["#314353", "#8CABB6", "#A59278", "#AF3C32"], build: ["#152437", "#385C77", "#266344", "#F8CE90"],
  chorus2: ["#0A2034", "#6C6792", "#DCB094", "#F18B36"], outro: ["#66A8EB", "#EDF2ED", "#68855B", "#CF8742"]
};
export async function create({ THREE, scene, camera, ctx2d, back2d, tier }) {
  const paint = new Map(); /* section -> offscreen painting, made on first use */
  function painting(sec) {
    if (paint.has(sec)) return paint.get(sec);
    const c = document.createElement("canvas"); c.width = tier === "saver" ? 480 : 960; c.height = c.width * 9 / 16;
    const g = c.getContext("2d"), p = PAL[sec] || PAL.intro, gr = g.createLinearGradient(0, 0, 0, c.height);
    p.forEach((col, i) => gr.addColorStop(i / (p.length - 1), col));
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = .08; for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? "#fff" : "#000"; g.beginPath(); g.ellipse(Math.random() * c.width, Math.random() * c.height, 40 + Math.random() * 160, 10 + Math.random() * 30, 0, 0, 7); g.fill() }
    paint.set(sec, c); return c;
  }
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.3, .6) });
  const lantern = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat);
  lantern.position.set(0, 0, -9); scene.add(lantern);
  return {
    update(f) {
      const img = painting(f.section), drift = Math.sin(f.t * .1) * .03 * f.W;
      back2d.drawImage(img, drift - f.W * .05, 0, f.W * 1.1, f.H); /* cover the viewport, whatever its aspect */
      lantern.position.y = Math.sin(f.beat * Math.PI) * .3 + f.downPulse * .4;
      lantern.rotation.y = f.t * .4; lantern.scale.setScalar(1 + f.pulse * .12);
      camera.position.set(0, 0, 0); camera.lookAt(0, 0, -9); camera.fov = 50;
      ctx2d.fillStyle = `rgba(255,236,200,${.8 * f.fastPulse})`; /* a sparkle on every 178 BPM beat */
      for (let i = 0; i < 12; i++) { const a = i * 2.4 + Math.floor(f.fast), r = f.H * (.2 + .15 * Math.sin(a * 3)); ctx2d.fillRect(f.W / 2 + Math.cos(a) * r, f.H / 2 + Math.sin(a) * r, 3 * f.dpr, 3 * f.dpr) }
      if (f.debug) { ctx2d.fillStyle = "#fff"; ctx2d.font = `${14 * f.dpr}px system-ui`; ctx2d.fillText(`${f.shot.key}${f.shot.var ? ":" + f.shot.var : ""} ${f.shot.side || ""}`, 12 * f.dpr, f.H - 14 * f.dpr) }
    },
    setVisible(on) { lantern.visible = on },
    dispose() { scene.remove(lantern); lantern.geometry.dispose(); mat.dispose(); for (const c of paint.values()) c.width = 0; paint.clear() }
  };
}
