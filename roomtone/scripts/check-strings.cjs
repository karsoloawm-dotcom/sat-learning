// Bowed strings: audio levels (offline render) and bow contact (hair on the string while a note sounds).
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto(`${process.env.ROOMTONE_URL || 'http://localhost:5180'}/?demo`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.evaluate(fs.readFileSync(__dirname + '/cams.js', 'utf8'));
  const out = await p.evaluate(async () => {
    const r = window.roomtone, w = r.world, T = w.camera.position.constructor;
    const [v, c] = window.addStrings();
    const st = (buf) => { let pk = 0, s = 0, nan = 0; const d = buf.getChannelData(0); for (const x of d) { if (!Number.isFinite(x)) nan++; pk = Math.max(pk, Math.abs(x)); s += x * x; } return `peak ${(20 * Math.log10(pk)).toFixed(1)} rms ${(10 * Math.log10(s / d.length)).toFixed(1)} nan ${nan}`; };
    const res = {};
    for (const [id, name] of [[v, 'violin'], [c, 'cello']]) {
      const pr = structuredClone(r.store.get());
      pr.tracks.forEach((t) => (t.solo = t.id === id));
      res[name] = st(await r.renderProject(pr, { start: 0, end: 16 }));
    }
    // Bow contact: drive the violinist through a note and measure hair-to-contact distance.
    const m = [...w.musicians.values()].find((x) => x.track.id === v);
    m.push({ trackId: v, pitch: 72, vel: 0.8, beat: 10, dur: 1, time: 30, end: 30.8 });
    const T0 = { dt: 1 / 60, beat: 20, playing: true, level: 0.3, camera: new T(0, 1, 5), cameraNear: false, focus: null, loopPulse: 0 };
    let worst = 0;
    for (let i = 0; i < 40; i++) {
      const now = 30.05 + i * 0.018;
      m.update({ ...T0, now, elapsed: now });
      const bow = m.inst.bow; // stick along +Z from the frog
      const a = bow.localToWorld(new T(0, 0, 0)), e = bow.localToWorld(new T(0, 0, m.inst.bowLen));
      const cp = m.inst.group.localToWorld(new T(m.inst.contactX, m.inst.stringY(m.fing.values().next().value?.string ?? 1), m.inst.topZ + 0.008));
      const ab = e.clone().sub(a), t = Math.max(0, Math.min(1, cp.clone().sub(a).dot(ab) / ab.lengthSq()));
      worst = Math.max(worst, a.clone().addScaledVector(ab, t).distanceTo(cp));
    }
    res.bowContactWorstM = worst.toFixed(3);
    return res;
  });
  console.log(JSON.stringify(out));
  await b.close();
})();
