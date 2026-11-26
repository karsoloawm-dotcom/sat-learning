export const GLYPHS = Object.freeze(['夢', '灯', '籠', '結', '時']);

// Each stroke is a series of x, y, brush-radius triples on a 100-unit grid.
// Low pressure at the end gives a flick. Sustained pressure leaves a wet foot.
const strokesByGlyph = new Map([
  ['夢', [
    [13, 11, 1, 34, 9, 2.6, 59, 8, 2.3, 86, 5, 0.7],
    [34, 3, 2.3, 35, 9, 2.1, 36, 17, 0.4],
    [64, 2, 2.6, 63, 9, 2.2, 59, 17, 0.5],
    [24, 20, 2, 24, 29, 2.4, 26, 36, 1.1],
    [25, 22, 1, 49, 20, 2.2, 76, 18, 2.4, 75, 25, 2.1, 71, 33, 2.3],
    [41, 22, 1.7, 43, 33, 1.8],
    [58, 21, 1.8, 57, 32, 1.8],
    [26, 35, 1.9, 52, 33, 2, 72, 32, 1],
    [17, 41, 1.5, 17, 48, 2.2, 12, 56, 0.7],
    [19, 45, 1, 51, 42, 2.3, 87, 39, 2.7, 88, 42, 2.2, 80, 54, 0.6],
    [47, 52, 2.5, 43, 61, 3, 32, 70, 2.5, 21, 76, 0.5],
    [42, 62, 1.3, 56, 60, 2.4, 72, 57, 2.4, 70, 64, 3, 56, 82, 3.9, 39, 93, 3.2, 16, 101, 0.5],
    [37, 70, 2, 45, 72, 3.1, 50, 78, 2.7],
  ]],
  ['灯', [
    [15, 35, 2.8, 15, 43, 4, 10, 54, 1.6],
    [48, 27, 3.5, 42, 34, 2.7, 34, 40, 0.7],
    [31, 12, 2.7, 32, 34, 3.1, 29, 55, 4.1, 22, 73, 4.4, 12, 86, 3.2, 3, 92, 0.5],
    [29, 60, 1.2, 40, 69, 3.4, 47, 77, 4.3],
    [49, 26, 2, 65, 25, 3.5, 84, 22, 4, 97, 20, 2.4],
    [74, 26, 3.2, 74, 46, 3.5, 75, 68, 3.7, 74, 87, 4.2, 70, 92, 3.9, 59, 83, 0.6],
  ]],
  ['籠', [
    [23, 1, 2.1, 20, 8, 2.6, 13, 17, 0.5],
    [20, 10, 1.2, 32, 9, 2.1, 46, 7, 0.7],
    [31, 11, 1.1, 35, 18, 2.5],
    [60, 0, 2.1, 57, 7, 2.5, 50, 15, 0.5],
    [57, 8, 1.2, 71, 7, 2, 87, 5, 1],
    [69, 10, 1.2, 74, 16, 2.3],
    [27, 22, 1.9, 31, 27, 2.6],
    [12, 32, 1.3, 28, 30, 2.4, 46, 28, 1.3],
    [20, 35, 1.6, 22, 43, 2.3],
    [39, 32, 2.2, 37, 39, 2, 33, 44, 0.5],
    [10, 49, 1.2, 30, 46, 2.6, 48, 44, 1.3],
    [16, 55, 2.7, 17, 75, 3, 16, 95, 2.1],
    [17, 57, 1.2, 40, 54, 2.5, 42, 60, 2.6, 41, 94, 3.2, 39, 97, 2.7, 31, 91, 0.5],
    [18, 69, 1.3, 39, 67, 2],
    [18, 80, 1.3, 39, 78, 2],
    [63, 22, 1.9, 68, 28, 2.4],
    [51, 33, 1.3, 67, 31, 2.5, 88, 28, 1.8, 86, 39, 2.3, 82, 48, 1.9],
    [55, 40, 1.5, 69, 38, 2, 86, 37, 1.4],
    [54, 49, 1.4, 82, 46, 2.1],
    [57, 33, 2.6, 57, 57, 2.8, 56, 79, 2.9, 57, 95, 3.7, 65, 99, 3.3, 88, 97, 3.9, 95, 94, 3.5, 97, 85, 0.5],
    [59, 57, 1.2, 75, 56, 2.4, 86, 53, 2],
    [59, 67, 1.3, 75, 65, 2.3, 85, 63, 1.8],
    [59, 77, 1.3, 74, 75, 2.3, 85, 73, 1.5],
    [59, 87, 1.2, 73, 85, 2.1, 84, 83, 1.6],
  ]],
  ['結', [
    [31, 6, 2.7, 26, 16, 3.5, 16, 28, 3.2, 12, 33, 2.7, 28, 32, 1.2],
    [39, 17, 2.8, 32, 31, 3.1, 12, 52, 3.2, 11, 55, 2.6, 27, 51, 2.5, 39, 47, 0.7],
    [35, 41, 1.3, 41, 48, 2.7, 43, 55, 3.1],
    [26, 53, 2.5, 27, 73, 2.9, 25, 96, 2.2],
    [12, 66, 2, 10, 75, 3.3, 5, 85, 0.7],
    [36, 64, 1.8, 43, 73, 3.6],
    [46, 27, 1.6, 63, 24, 3.1, 88, 22, 3.6, 98, 21, 1.3],
    [73, 5, 2.7, 72, 25, 3, 70, 43, 3.3],
    [51, 45, 1.5, 66, 44, 3.2, 90, 40, 2.4],
    [53, 59, 2.7, 56, 74, 3.4, 57, 95, 2.6],
    [55, 62, 1.4, 71, 60, 3, 89, 56, 3.7, 91, 59, 3.3, 88, 72, 2.7, 85, 87, 3.3],
    [58, 88, 1.8, 73, 86, 3.4, 90, 85, 2],
  ]],
  ['時', [
    [11, 23, 2.8, 12, 46, 3.6, 12, 69, 3.1, 13, 79, 2],
    [12, 26, 1.3, 24, 25, 2.6, 37, 22, 3.4, 39, 25, 3.4, 38, 49, 3, 36, 73, 3.1],
    [13, 47, 1.3, 24, 45, 2.6, 37, 44, 1.8],
    [13, 73, 1.5, 24, 71, 2.8, 38, 69, 2],
    [49, 24, 1.8, 65, 22, 3, 89, 19, 1.9],
    [69, 5, 2.8, 69, 22, 3.1, 67, 39, 2.8],
    [43, 43, 1.6, 63, 40, 3.1, 91, 37, 3.3, 100, 35, 1.2],
    [45, 59, 1.7, 65, 56, 3, 83, 54, 3.2, 97, 51, 1.4],
    [80, 45, 2.4, 80, 65, 3.5, 82, 89, 3.5, 78, 98, 4, 68, 97, 3.1, 61, 91, 0.5],
    [53, 66, 1.6, 58, 69, 2.8, 63, 76, 3.9],
  ]],
]);

const HEIGHT = 320;
const TILE = 512;
const CACHE_LIMIT = 10;
const INK = '#1a1410';
const cache = new Map();
let work;

function surface(width, height) {
  const canvas = typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(width, height)
    : document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d');
}

function randomStream(seed) {
  let state = (seed | 0) ^ 0x6ac690c5;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
}

function sample(stroke, rand) {
  const points = [];
  const phase = rand() * 6.28;
  let distance = 0;
  for (let i = 0; i < stroke.length - 3; i += 3) {
    const dx = stroke[i + 3] - stroke[i];
    const dy = stroke[i + 4] - stroke[i + 1];
    const length = Math.hypot(dx, dy);
    const steps = Math.ceil(length * 2.5);
    for (let j = i === 0 ? 0 : 1; j <= steps; j++) {
      const t = j / steps;
      const s = distance + t * length;
      const wobble = Math.sin(s * 0.48 + phase) * 0.14;
      points.push({
        x: stroke[i] + dx * t - dy / length * wobble,
        y: stroke[i + 1] + dy * t + dx / length * wobble,
        r: (stroke[i + 2] + (stroke[i + 5] - stroke[i + 2]) * t)
          * (0.58 + Math.min(s / 2, 1) * 0.42),
        left: 0.96 + 0.07 * Math.sin(s * 3.1 + phase) + rand() * 0.10,
        right: 0.94 + 0.08 * Math.sin(s * 2.6 - phase) + rand() * 0.12,
      });
    }
    distance += length;
  }

  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(i - 2, 0)];
    const b = points[Math.min(i + 2, points.length - 1)];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    points[i].nx = -(b.y - a.y) / length;
    points[i].ny = (b.x - a.x) / length;
  }

  const streaks = Array.from({ length: Math.ceil(distance / 4) + 3 }, () => {
    const start = Math.floor(rand() * (points.length - 1));
    return {
      start,
      end: Math.min(points.length - 1, start + 4 + Math.floor(rand() * 57)),
      lane: (rand() < 0.5 ? -1 : 1) * (0.23 + rand() * 0.75),
      width: 0.045 + rand() * 0.14,
      lift: 0.42 + rand() * 0.53,
    };
  });
  return { points, streaks };
}

function edge(g, p, offset) {
  g.lineTo(p.x + p.nx * offset, p.y + p.ny * offset);
}

function paint(g, { points, streaks }, end) {
  const start = points[0];
  const tip = points[end];
  g.beginPath();
  for (let i = 0; i <= end; i++) edge(g, points[i], points[i].r * points[i].left);
  g.quadraticCurveTo(tip.x + tip.ny * tip.r * 1.5, tip.y - tip.nx * tip.r * 1.5,
    tip.x - tip.nx * tip.r * tip.right, tip.y - tip.ny * tip.r * tip.right);
  for (let i = end - 1; i >= 0; i--) edge(g, points[i], -points[i].r * points[i].right);
  g.quadraticCurveTo(start.x - start.ny * start.r, start.y + start.nx * start.r,
    start.x + start.nx * start.r * start.left, start.y + start.ny * start.r * start.left);
  g.fill();

  // Pull fine gaps through the wet shape along the bristles, with pointed ends.
  g.globalCompositeOperation = 'destination-out';
  for (const { start, end: finish, lane, width, lift } of streaks) {
    if (start >= end) continue;
    const last = Math.min(finish, end);
    const length = finish - start;
    g.globalAlpha = lift;
    g.beginPath();
    for (let i = start; i <= last; i++) {
      const taper = Math.min((i - start) / 5, (finish - i) / 8, 1);
      edge(g, points[i], points[i].r * lane + width * taper);
    }
    for (let i = last; i >= start; i--) {
      const taper = Math.min((i - start) / 5, (finish - i) / 8, 1);
      edge(g, points[i], points[i].r * (lane + 0.08 * (i - start) / length) - width * taper);
    }
    g.fill();
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  // Finish held strokes with a round wet pool. The fine end of a flick stays dry.
  if (end === points.length - 1 && tip.r > 1.5) {
    g.globalAlpha = 0.63;
    g.beginPath();
    g.arc(tip.x, tip.y, tip.r * 0.79, 0, 2 * Math.PI);
    g.fill();
    g.globalAlpha = 1;
  }
}

function bake(strokes, seed) {
  const rand = randomStream(seed);
  const paths = strokes.map(stroke => sample(stroke, rand));
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const { points } of paths) {
    for (const p of points) {
      const margin = p.r * 1.27 + 0.35;
      left = Math.min(left, p.x - margin);
      top = Math.min(top, p.y - margin);
      right = Math.max(right, p.x + margin);
      bottom = Math.max(bottom, p.y + margin);
    }
  }
  const scale = HEIGHT / (bottom - top);
  const width = Math.ceil((right - left) * scale);
  const raster = surface(width, HEIGHT);
  raster.fillStyle = INK;
  const complete = surface(width, HEIGHT);
  const pages = [];
  let page;
  let column = 0;
  let row = 0;
  let rowHeight = 0;
  const reveals = [];
  const prefixes = [];

  for (const path of paths) {
    const count = path.points.length - 1;
    const steps = Math.ceil(count / 4);
    const frames = [];
    let x0 = width;
    let y0 = HEIGHT;
    let x1 = 0;
    let y1 = 0;
    let included = 0;
    for (let step = 1; step <= steps; step++) {
      const end = Math.round(step * count / steps);
      for (; included <= end; included++) {
        const p = path.points[included];
        const margin = p.r * 1.27 + 0.35;
        x0 = Math.min(x0, Math.floor((p.x - margin - left) * scale));
        y0 = Math.min(y0, Math.floor((p.y - margin - top) * scale));
        x1 = Math.max(x1, Math.ceil((p.x + margin - left) * scale));
        y1 = Math.max(y1, Math.ceil((p.y + margin - top) * scale));
      }
      const w = Math.min(width, x1) - x0;
      const h = Math.min(HEIGHT, y1) - y0;
      raster.resetTransform();
      raster.clearRect(x0, y0, w, h);
      raster.setTransform(scale, 0, 0, scale, -left * scale, -top * scale);
      paint(raster, path, end);

      // The final stroke state lives in the flattened prefix.
      if (step === steps) {
        complete.drawImage(raster.canvas, x0, y0, w, h, x0, y0, w, h);
        continue;
      }

      if (column + w > TILE) {
        column = 0;
        row += rowHeight;
        rowHeight = 0;
      }
      if (!page || row + h > TILE) {
        page = surface(TILE, TILE);
        pages.push(page.canvas);
        column = row = rowHeight = 0;
      }
      page.drawImage(raster.canvas, x0, y0, w, h, column, row, w, h);
      frames.push({ page: page.canvas, u: column, v: row, x: x0, y: y0, w, h });
      column += w + 1;
      rowHeight = Math.max(rowHeight, h + 1);
    }
    reveals.push(frames);
    if (reveals.length < paths.length) {
      const prefix = surface(width, HEIGHT);
      prefix.drawImage(complete.canvas, 0, 0);
      prefixes.push(prefix.canvas);
    }
  }
  release(raster.canvas);
  return { width, reveals, prefixes, complete: complete.canvas, pages };
}

function blit(g, frame) {
  g.drawImage(frame.page, frame.u, frame.v, frame.w, frame.h, frame.x, frame.y, frame.w, frame.h);
}

function release(canvas) {
  canvas.width = canvas.height = 0;
}

function releaseGlyph(ink) {
  release(ink.complete);
  for (const prefix of ink.prefixes) release(prefix);
  for (const page of ink.pages) release(page);
}

export function drawInk(g, glyph, { x, y, size, progress, alpha = 1, color = '#1a1410', seed = 1 }) {
  if (!(size > 0 && progress > 0 && alpha > 0)) return;
  const strokes = strokesByGlyph.get(glyph);
  if (!strokes) return;

  // A numeric key avoids creating strings or option objects on a warmed frame.
  const key = (seed | 0) * GLYPHS.length + GLYPHS.indexOf(glyph);
  let ink = cache.get(key);
  if (!ink) {
    ink = bake(strokes, seed);
    if (cache.size === CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      releaseGlyph(cache.get(oldest));
      cache.delete(oldest);
    }
    cache.set(key, ink);
  }

  const { width, reveals, prefixes, complete } = ink;
  let source = complete;
  if (progress < 1 || color !== INK) {
    work ??= surface(TILE, HEIGHT);
    work.clearRect(0, 0, width, HEIGHT);
    if (progress >= 1) {
      work.drawImage(complete, 0, 0);
    } else {
      const position = progress * reveals.length;
      const finished = Math.floor(position);
      if (finished > 0) work.drawImage(prefixes[finished - 1], 0, 0);
      const frames = reveals[finished];
      const active = Math.floor((position - finished) * (frames.length + 1));
      if (active > 0) blit(work, frames[active - 1]);
    }
    if (color !== INK) {
      work.globalCompositeOperation = 'source-in';
      work.fillStyle = INK;
      work.fillStyle = color;
      work.fillRect(0, 0, width, HEIGHT);
      work.globalCompositeOperation = 'source-over';
    }
    source = work.canvas;
  }

  const drawnWidth = size * width / HEIGHT;
  const previousAlpha = g.globalAlpha;
  g.globalAlpha = previousAlpha * Math.min(alpha, 1);
  try {
    g.drawImage(source, 0, 0, width, HEIGHT, x - drawnWidth / 2, y - size / 2, drawnWidth, size);
  } finally {
    g.globalAlpha = previousAlpha;
  }
}

export function clearCache() {
  for (const ink of cache.values()) releaseGlyph(ink);
  cache.clear();
  if (work) release(work.canvas);
  work = undefined;
}
