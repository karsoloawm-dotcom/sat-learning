const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto(`${process.env.ROOMTONE_URL || 'http://localhost:5180'}/?demo`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.evaluate(() => { const r = window.roomtone; r.store.update('t', (d) => { d.bpm = 117; d.tracks[1].musician.name = 'Bobo'; }); });
  await p.waitForTimeout(1200);
  await p.goto(`${process.env.ROOMTONE_URL || 'http://localhost:5180'}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  console.log(await p.evaluate(() => JSON.stringify({ bpm: window.roomtone.store.get().bpm, name: window.roomtone.store.get().tracks[1].musician.name })));
  await b.close();
})();
