// MIDI import: builds a 2-track .mid, loads it through the piano roll's Import button and by dropping it on the
// arrangement's Piano row; checks notes, pattern/clip lengths and undo.
const { chromium } = require('playwright');
function midi() {
  const vlq = (n) => { const o = [n & 0x7f]; while ((n >>= 7)) o.unshift((n & 0x7f) | 0x80); return o; };
  const trk = (b) => [0x4d, 0x54, 0x72, 0x6b, (b.length >> 24) & 255, (b.length >> 16) & 255, (b.length >> 8) & 255, b.length & 255, ...b];
  const line = (pitches, ch) => pitches.flatMap((p) => [0, 0x90 | ch, p, 90, ...vlq(480), 0x80 | ch, p, 0]).concat([0, 0xff, 0x2f, 0]);
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 2, 0x01, 0xe0];
  return Buffer.from([...head, ...trk(line([60, 62, 64, 65, 67, 69, 71, 72, 74], 0)), ...trk(line([48, 43, 45, 41], 1))]);
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto(`${process.env.ROOMTONE_URL || 'http://localhost:5180'}/?demo`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.click('text=Producer');
  await p.locator('.thead').nth(3).click(); // Piano
  await p.waitForTimeout(300);
  const state = () => p.evaluate(() => {
    const r = window.roomtone, id = r.ui.get().editPattern, pat = r.store.get().patterns[id];
    const clip = r.store.get().tracks.flatMap((t) => t.clips).find((c) => c.patternId === id);
    return { notes: pat.notes.length, len: pat.length, clipLen: clip.length, name: pat.name, toast: r.ui.get().toast };
  });
  const before = await state();
  await p.setInputFiles('.pianoroll input[type=file]', { name: 'tune.mid', mimeType: 'audio/midi', buffer: midi() });
  await p.waitForTimeout(400);
  const imported = await state();
  await p.keyboard.press('Control+z');
  const undone = await state();
  // Drop onto the arrangement's Piano row at bar 17.
  const clipsBefore = await p.evaluate(() => window.roomtone.store.get().tracks[3].clips.length);
  const box = await p.locator('.arr-canvas').boundingBox();
  const data = midi().toString('base64');
  await p.evaluate(({ data, x, y }) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'drop.mid', { type: 'audio/midi' }));
    const el = document.querySelector('.arr-canvas');
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, clientX: x, clientY: y, bubbles: true, cancelable: true }));
  }, { data, x: box.x + 600, y: box.y + 30 + 58 * 3 + 20 });
  await p.waitForTimeout(500);
  const dropped = await p.evaluate(() => { const t = window.roomtone.store.get().tracks[3]; const c = t.clips[t.clips.length - 1]; return { clips: t.clips.length, start: c.start, length: c.length, notes: window.roomtone.store.get().patterns[c.patternId].notes.length }; });
  console.log(JSON.stringify({ before, imported, undone, clipsBefore, dropped }));
  await b.close();
})();
