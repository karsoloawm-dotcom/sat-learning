const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`${process.env.ROOMTONE_URL || 'http://localhost:5180'}/?demo`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const res = await page.evaluate(() => {
    const r = window.roomtone, w = r.world;
    const ms = [...w.musicians.values()];
    const T = w.camera.position.constructor;
    const out = {};
    const ctxAt = (now, beat) => ({ now, dt: 1 / 60, elapsed: now, beat, playing: true, level: 0.3, camera: new T(0, 1, 5), cameraNear: false, focus: null, loopPulse: 0 });
    // Drummer: snare (L), hat (R), floor tom (R) — measure tip-to-head distance at the hit instant and 80 ms before.
    const d = ms.find((m) => m.kit);
    const orig = d.armIK.bind(d); d.armIK = (side, t, pole) => { d['_last' + side] = t.clone(); orig(side, t, pole); };
    const hits = [[38, 10.0], [42, 10.25], [41, 10.5], [38, 10.75]];
    hits.forEach(([p, t]) => d.push({ trackId: d.track.id, pitch: p, vel: 0.9, beat: t * 2, dur: 0.1, time: t, end: t + 0.1 }));
    const tip = (side) => { const h = d.rig.bones[side + 'Hand']; return h.localToWorld(new T(0, 0, 0.26)); };
    out.drums = hits.map(([p, t]) => {
      const piece = d.kit.pieces[d.kit.pitchToPiece(p)];
      const res = {};
      for (const [lbl, dt] of [['at', 0], ['pre80ms', -0.08]]) {
        for (let k = 8; k >= 0; k--) d.update(ctxAt(t + dt - k / 60, (t + dt) * 2));
        const target = d.kit.group.localToWorld(piece.hit.clone());
        res[lbl] = Math.min(tip('Left').distanceTo(target), tip('Right').distanceTo(target)).toFixed(3);
      }
      return `${p}:${res.at}m(pre ${res.pre80ms}m)`;
    });
    // Keyboardist: key for pitch should be down at the note time.
    const k = ms.find((m) => m.kb);
    k.push({ trackId: k.track.id, pitch: 64, vel: 0.8, beat: 30, dur: 0.5, time: 15, end: 15.4 });
    for (let i = 10; i >= 0; i--) k.update(ctxAt(15.05 - i / 60, 30.1));
    const key = k.kb.keys.get(64);
    const hand = k.rig.bones.RightHand.getWorldPosition(new T());
    const keyPos = key.getWorldPosition(new T());
    out.keys = { keyRot: key.rotation.x.toFixed(3), handToKeyX: Math.abs(k.kb.group.worldToLocal(hand.clone()).x - k.kb.keyX(64)).toFixed(3) };
    // Guitarist: fretting hand near the fret for the note.
    const g = ms.find((m) => m.inst && m.kind === 'guitar');
    g.push({ trackId: g.track.id, pitch: 69, vel: 0.8, beat: 40, dur: 1, time: 20, end: 20.6 });
    for (let i = 20; i >= 0; i--) g.update(ctxAt(20.1 - i / 60, 40.2));
    const lh = g.inst.group.worldToLocal(g.rig.bones.LeftHand.getWorldPosition(new T()));
    out.guitar = { fretHandX: lh.x.toFixed(3), handToNeckZ: lh.z.toFixed(3) };
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})();
