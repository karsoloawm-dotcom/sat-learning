const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`${process.env.ROOMTONE_URL || 'http://localhost:5180'}/?demo`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const res = await page.evaluate(async () => {
    const r = window.roomtone;
    const stats = (buf) => {
      let peak = 0, sum = 0, nan = 0;
      for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = d[i]; if (!Number.isFinite(v)) nan++; peak = Math.max(peak, Math.abs(v)); sum += v * v; } }
      return { secs: +buf.duration.toFixed(2), peakDb: +(20 * Math.log10(peak)).toFixed(1), rmsDb: +(10 * Math.log10(sum / (buf.length * buf.numberOfChannels))).toFixed(1), nan };
    };
    const p = r.store.get();
    const out = { mix: stats(await r.renderProject(p, { start: 32, end: 48 })) };
    for (const t of p.tracks) {
      const solo = structuredClone(p);
      solo.tracks.forEach((x) => (x.solo = x.id === t.id));
      out[t.name] = stats(await r.renderProject(solo, { start: 32, end: 48 }));
    }
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})();
