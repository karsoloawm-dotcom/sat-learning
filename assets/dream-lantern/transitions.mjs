/* Dream Lantern transitions. Each one lives in a window around its cut: `pre` fast beats before, `post` after.
   x = seconds from the cut (negative before it). The core renders both shots for "dissolve" and "cord";
   the rest are drawn over a hard cut on the front canvas by cover(). */
const TAU = Math.PI * 2;
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), mix = (a, b, k) => a + (b - a) * k;
const sm = (a, b, x) => { x = cl((x - a) / (b - a)); return x * x * (3 - 2 * x) };
const eio = x => { x = cl(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 };
const hash = i => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v) };

export const WINDOWS = { /* [pre, post] in fast beats */
  flash: [0, 4], black: [.6, 1.6], fade: [0, 3], washi: [.75, .75], ink: [1, 1.5], leak: [1.5, 2.5], cord: [1, 1], dissolve: [1.5, 1.5]
};
export const BOTH = new Set(["dissolve", "cord"]);

let washi = null;
function paper(g) { /* the washi sheet: fibres on cream, made once */
  if (!washi) {
    const c = document.createElement("canvas"); c.width = c.height = 256; const w = c.getContext("2d");
    w.fillStyle = "#efe4cf"; w.fillRect(0, 0, 256, 256); w.strokeStyle = "rgba(170,140,100,.18)"; w.lineWidth = .7;
    for (let i = 0; i < 260; i++) { const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * TAU, l = 6 + Math.random() * 26; w.beginPath(); w.moveTo(x, y); w.quadraticCurveTo(x + Math.cos(a + 1) * l * .5, y + Math.sin(a + 1) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); w.stroke() }
    washi = { c, pat: null, g: null };
  }
  if (washi.g !== g) { washi.g = g; washi.pat = g.createPattern(washi.c, "repeat") }
  return washi.pat;
}
export function clear() { if (washi) washi.c.width = 0; washi = null }

/* the red braided cord along a vertical line at x (device px), swaying; used for split seams and the cord wipe */
export function cordLine(g, x, h, k, t, sway = 1) {
  g.save(); g.lineCap = "round";
  const path = () => { g.beginPath(); for (let y = -10 * k; y <= h + 10 * k; y += 12 * k) g.lineTo(x + Math.sin(y / h * 5 + t * 3) * 4 * k * sway, y) };
  path(); g.lineWidth = 6 * k; g.strokeStyle = "#a3121b"; g.stroke();
  g.lineWidth = 1.8 * k; g.strokeStyle = "#f0b23c"; g.setLineDash([9 * k, 7 * k]); g.lineDashOffset = -t * 160; g.stroke();
  g.restore();
}
/* the torn washi seam between the halves of a split screen */
export function tornSeam(g, x, h, k, t, seed) {
  g.save(); g.fillStyle = paper(g); g.beginPath(); g.moveTo(x - 7 * k, 0);
  for (let y = 0; y <= h; y += 14 * k) g.lineTo(x - (5 + hash(y * .37 + seed) * 5) * k, y);
  for (let y = h; y >= 0; y -= 14 * k) g.lineTo(x + (5 + hash(y * .61 + 3 + seed) * 5) * k, y);
  g.closePath(); g.fill(); g.restore();
  cordLine(g, x, h, k, t, .4);
}

/* cover-style transitions, drawn over everything on the front canvas (w, h device px, k = 2D pixel ratio) */
export function cover(g, type, x, pre, post, w, h, k, seed, t) {
  if (type === "flash") { const a = .78 * Math.exp(-x / Math.max(.05, post * .28)); if (a > .004) { g.fillStyle = `rgba(255,240,218,${a})`; g.fillRect(0, 0, w, h) } return }
  if (type === "black" || type === "fade") {
    const a = x < 0 ? sm(-pre, 0, x) : 1 - sm(0, post, x);
    if (a > .004) { g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(0, 0, w, h) } return;
  }
  if (type === "washi") { /* a sheet sweeps across with the cord on its edge, covering the frame at the cut */
    const p = (x + pre) / (pre + post), x0 = mix(-1.5, 1.1, p) * w, bw = 1.3 * w, sk = .12 * Math.min(w, h);
    g.save(); g.beginPath(); g.moveTo(x0 + sk, 0);
    for (let y = 0; y <= h; y += 18 * k) g.lineTo(x0 + sk * (1 - y / h) + hash(y * .13 + seed) * 9 * k, y);
    g.lineTo(x0 + bw, h); for (let y = h; y >= 0; y -= 18 * k) g.lineTo(x0 + bw + sk * (1 - y / h) + hash(y * .29 + seed) * 9 * k, y);
    g.closePath(); g.fillStyle = paper(g); g.fill();
    g.lineWidth = 5 * k; g.strokeStyle = "#b3131b"; g.beginPath(); g.moveTo(x0 + bw + sk, 0); g.lineTo(x0 + bw, h); g.stroke();
    g.lineWidth = 1.6 * k; g.strokeStyle = "#f0b23c"; g.setLineDash([10 * k, 8 * k]); g.lineDashOffset = -t * 200; g.stroke(); g.restore();
    return;
  }
  if (type === "ink") { /* sumi blooms from a point until it covers the frame on the cut, then opens from the centre */
    const R = Math.hypot(w, h) * .62, cx = w * (.3 + .4 * hash(seed)), cy = h * (.35 + .3 * hash(seed + 1));
    const blot = (r, ox, oy, s) => { for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, j = 1 + .16 * Math.sin(a * 5 + s) + .09 * Math.sin(a * 11 + s * 2) + .05 * (hash(i + s) - .5); g[i ? "lineTo" : "moveTo"](ox + Math.cos(a) * r * j, oy + Math.sin(a) * r * j) } g.closePath() };
    g.save(); g.fillStyle = "#120d10"; g.beginPath();
    if (x < 0) { const r = R * eio((x + pre) / pre) * 1.12; blot(r, cx, cy, seed); for (let i = 0; i < 4; i++) blot(r * (.18 + .1 * hash(seed + i * 7)), cx + Math.cos(i * 1.7 + seed) * r * .95, cy + Math.sin(i * 1.7 + seed) * r * .8, seed + i) }
    else { const r = R * eio(x / post) * 1.15; if (r >= R * 1.1) { g.restore(); return } g.rect(0, 0, w, h); blot(r, w / 2, h / 2, seed + 3) }
    g.fill("evenodd"); g.restore(); return;
  }
  if (type === "leak") { /* warm light blooms in from the right edge and washes the cut */
    const a = x < 0 ? sm(-pre, 0, x) : 1 - sm(0, post, x); if (a < .004) return;
    g.save(); g.globalCompositeOperation = "lighter";
    const blob = (px, py, r, c, al) => { const gr = g.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, `rgba(${c},${al})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h) };
    const drift = Math.sin(t * .7) * .05;
    blob(w * (1.02 + drift), h * .35, Math.max(w, h) * (.45 + .4 * a), "255,168,96", .9 * a);
    blob(w * (.82 - drift), h * .75, Math.max(w, h) * (.3 + .3 * a), "255,110,150", .55 * a);
    blob(w * .55, h * .45, Math.max(w, h) * .5, "255,236,210", .7 * a * a);
    g.restore();
  }
}
