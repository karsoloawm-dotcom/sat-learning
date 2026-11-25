// helper: evaluate in page. Usage: cam(i) frames musician i from the front.
window.cam = (i, dist = 1.6, h = 0.95, side = 0) => {
  const r = window.roomtone; const w = r.world; const s = r.store.get();
  const t = s.tracks[i]; const m = [...w['musicians'].values()].find((x) => x.track.id === t.id);
  const p = m.group.position.clone(); const ry = m.group.rotation.y;
  const T = p.constructor;
  const pos = new T(Math.sin(ry + side) * dist, h, Math.cos(ry + side) * dist).add(p);
  w.debugCam = { pos, look: p.clone().add(new T(0, 0.65, 0)) };
};
window.V3 = (x, y, z) => new (window.roomtone.world.camera.position.constructor)(x, y, z);
window.dcam = (p, l) => { window.roomtone.world.debugCam = { pos: V3(...p), look: V3(...l) }; };
// Recruit a violinist and a cellist with a legato line + short notes, in the hall.
window.addStrings = () => {
  const r = window.roomtone;
  const v = r.act.recruit('strings');
  const c = r.act.recruit('strings');
  r.store.update('t', (d) => {
    const tv = d.tracks.find((t) => t.id === v), tc = d.tracks.find((t) => t.id === c);
    tc.inst.preset = 'Cello'; tc.name = 'Cello';
    const pv = d.patterns[tv.clips[0].patternId], pc = d.patterns[tc.clips[0].patternId];
    const line = [76, 74, 72, 71, 72, 74, 76, 79, 77, 76, 74, 72, 71, 69, 71, 72];
    pv.notes = line.map((p, i) => ({ id: 'v' + i, pitch: p, start: i, dur: i % 4 === 3 ? 0.5 : 1, vel: 0.8 }));
    pc.notes = [41, 40, 38, 36].map((p, i) => ({ id: 'c' + i, pitch: p, start: i * 4, dur: 3.8, vel: 0.8 }));
    tv.clips[0].length = tc.clips[0].length = 64; tv.clips[0].start = tc.clips[0].start = 0;
  });
  return [v, c];
};
