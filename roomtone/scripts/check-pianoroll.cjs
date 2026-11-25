const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto(`${process.env.ROOMTONE_URL || 'http://localhost:5180'}/?demo`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.click('text=Producer');
  await p.waitForTimeout(300);
  await p.locator('.thead').nth(2).click(); // guitar
  await p.waitForTimeout(300);
  const count = () => p.evaluate(() => { const r = window.roomtone; const id = r.ui.get().editPattern; return r.store.get().patterns[id].notes.length; });
  const n0 = await count();
  const box = await p.locator('.pr-canvas canvas').boundingBox();
  // Draw a note with a drag (sets its length), in an empty spot.
  await p.mouse.move(box.x + 64 + 60, box.y + 40);
  await p.mouse.down();
  await p.mouse.move(box.x + 64 + 140, box.y + 40, { steps: 4 });
  await p.mouse.up();
  const n1 = await count();
  const added = await p.evaluate(() => { const r = window.roomtone; const n = r.store.get().patterns[r.ui.get().editPattern].notes; return n[n.length - 1]; });
  await p.keyboard.press('Control+z');
  const n2 = await count();
  // Arrangement: alt-drag duplicates a clip, then undo.
  const clips = () => p.evaluate(() => window.roomtone.store.get().tracks.reduce((s, t) => s + t.clips.length, 0));
  const c0 = await clips();
  const ab = await p.locator('.arr-canvas').boundingBox();
  await p.locator('.arr-canvas').click({ position: { x: 20, y: 300 } });
  await p.keyboard.press('Control+z');
  console.log(JSON.stringify({ n0, n1, added: { start: added.start, dur: added.dur, pitch: added.pitch }, afterUndo: n2, clips: c0 }));
  await b.close();
})();
