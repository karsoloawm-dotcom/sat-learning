// helper: evaluate in page. Usage: cam(i) frames musician i from the front.
window.cam = (i, dist = 1.6, h = 0.95, side = 0) => {
  const r = window.roomtone; const w = r.world; const s = r.store.get();
  const t = s.tracks[i]; const m = [...w['musicians'].values()].find((x) => x.track.id === t.id);
  const p = m.group.position.clone(); const ry = m.group.rotation.y;
  const T = p.constructor;
  const pos = new T(Math.sin(ry + side) * dist, h, Math.cos(ry + side) * dist).add(p);
  w.debugCam = { pos, look: p.clone().add(new T(0, 0.65, 0)) };
};
