// Applies every graphics preset in the hall, reports renderer state, and screenshots Phone and Ultra.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(`${process.env.ROOMTONE_URL || 'http://localhost:5180'}/?demo`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.evaluate(fs.readFileSync(__dirname + '/cams.js', 'utf8'));
  await p.evaluate(() => { window.roomtone.store.update('room', (d) => { d.room = 'hall'; }); document.querySelector('.band').style.display = 'none'; });
  await p.waitForFunction(() => window.roomtone.world.room.id === 'hall', null, { timeout: 60000 });
  for (const q of ['phone', 'low', 'medium', 'high', 'ultra']) {
    const info = await p.evaluate((q) => {
      const w = window.roomtone.world;
      w.setQuality(q);
      window.dcam([0, 2.2, 6], [0, 3, -8]);
      const L = w.room.lights;
      return { q, pixelRatio: +w.renderer.getPixelRatio().toFixed(2), canvas: `${w.renderer.domElement.width}x${w.renderer.domElement.height}`, keyShadow: L.shadowKey.castShadow ? L.shadowKey.shadow.mapSize.x : 0, spotShadows: L.secondaryShadows.filter((l) => l.castShadow).length, atmosphere: w.room.atmosphere[0].visible };
    }, q);
    await p.waitForTimeout(q === 'ultra' ? 9000 : 3000);
    if (q === 'phone' || q === 'ultra') await p.screenshot({ path: `${process.env.SHOTS_DIR || '/tmp'}/quality-${q}.png` });
    console.log(JSON.stringify(info));
  }
  console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
  await b.close();
})();
