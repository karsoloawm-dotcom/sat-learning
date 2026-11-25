const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`${process.env.ROOMTONE_URL || 'http://localhost:5180'}/?demo`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // Frame Pip's pedalboard and find the Fuzz pedal's Drive knob on screen.
  const pt = await page.evaluate(() => {
    const r = window.roomtone, w = r.world, T = w.camera.position.constructor;
    document.querySelector('.band').style.display = 'none';
    const g = r.store.get().tracks[2];
    const fx = g.fx.find((e) => e.type === 'distortion');
    const knob = w.gear.interactables.find((o) => o.userData.control.kind === 'fx' && o.userData.control.fxId === fx.id && o.userData.control.param === 'drive');
    const p = knob.getWorldPosition(new T());
    w.debugCam = { pos: p.clone().add(new T(0.05, 0.45, 0.35)), look: p };
    return { fxId: fx.id, before: fx.params.drive };
  });
  await page.waitForTimeout(1500);
  const scr = await page.evaluate((fxId) => {
    const w = window.roomtone.world, T = w.camera.position.constructor;
    const knob = w.gear.interactables.find((o) => o.userData.control.fxId === fxId && o.userData.control.param === 'drive');
    const v = knob.getWorldPosition(new T()).project(w.camera);
    const rect = w.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (v.x + 1) / 2 * rect.width, y: rect.top + (1 - v.y) / 2 * rect.height };
  }, pt.fxId);
  await page.mouse.move(scr.x, scr.y);
  await page.waitForTimeout(600);
  const hover = await page.evaluate(() => document.querySelector('.tooltip')?.textContent);
  await page.mouse.down();
  for (let i = 0; i < 10; i++) await page.mouse.move(scr.x, scr.y - i * 6);
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${process.env.SHOTS_DIR || '/tmp'}/knob.png` });
  const after = await page.evaluate((fxId) => {
    const r = window.roomtone;
    const fx = r.store.get().tracks[2].fx.find((e) => e.id === fxId);
    const unit = r.engine.graph.channels.get(r.store.get().tracks[2].id).fx.units.get(fxId);
    const v = fx.params.drive, u = unit.params.drive;
    r.store.undo();
    return { after: v, unitParam: u, undone: r.store.get().tracks[2].fx.find((e) => e.id === fxId).params.drive, label: r.store.redoLabel() };
  }, pt.fxId);
  console.log(JSON.stringify({ hover, ...pt, ...after }));
  await browser.close();
})();
