// node multi.cjs <prefix> <setupJs> <shotJs1> <shotJs2> ...   (each shot: eval js, wait, screenshot)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [prefix, setup, ...shots] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
  const logs = [];
  page.on('console', (m) => { if (!/GL Driver|vite|DevTools|deprecated/.test(m.text())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`${process.env.ROOMTONE_URL || 'http://localhost:5180'}/?demo`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(fs.readFileSync(__dirname + '/cams.js', 'utf8'));
  if (setup) await page.evaluate(setup);
  let i = 0;
  for (const s of shots) {
    await page.evaluate(s);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${process.env.SHOTS_DIR || '/tmp'}/${prefix}${i++}.png` });
  }
  console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
