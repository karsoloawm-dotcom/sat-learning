/* Dream Lantern v2 · cut-paper shadows and transmitted light */

const WIDTH = 960, HEIGHT = 540;
const SIZE = { saver: 1280, smooth: 2048, ultra: 3072 };
const LINE_COUNT = { saver: 80, smooth: 200, ultra: 400 };
const TAU = Math.PI * 2;
const clamp = (x, min, max) => Math.max(min, Math.min(x, max));
const ease = x => x * x * (3 - 2 * x);
const mix = (a, b, t) => a + (b - a) * t;

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function gradient(g, y0, y1, stops) {
  const fill = g.createLinearGradient(0, y0, 0, y1);
  for (const [offset, color] of stops) fill.addColorStop(offset, color);
  return fill;
}

function wash(g, x, y, rx, ry, color, opacity = 1) {
  g.save();
  g.translate(x, y);
  g.scale(rx, ry);
  g.globalAlpha *= opacity;
  const fill = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  fill.addColorStop(0, color);
  fill.addColorStop(1, color.slice(0, 7) + "00");
  g.fillStyle = fill;
  g.fillRect(-1, -1, 2, 2);
  g.restore();
}

function fillPath(g, path, fill) {
  g.fillStyle = fill;
  g.fill(path);
}

function strokePath(g, path, stroke, width) {
  g.strokeStyle = stroke;
  g.lineWidth = width;
  g.stroke(path);
}

function paperTile(kit, rnd) {
  return kit.paint(160, 160, g => {
    const pixels = g.createImageData(160, 160);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const value = rnd() < .48 ? 25 : 255;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
      pixels.data[i + 3] = rnd() * 52;
    }
    g.putImageData(pixels, 0, 0);
    for (let i = 0; i < 185; i++) {
      const x = rnd() * 160, y = rnd() * 160;
      const fiber = new Path2D();
      fiber.moveTo(x, y);
      fiber.quadraticCurveTo(x + 2, y + 3, x + 4 + rnd() * 7, y + rnd() * 5);
      strokePath(g, fiber, i % 2 ? "#fff9e54c" : "#32243e47", .4 + rnd() * .5);
    }
  }).image;
}

function texturePaper(g, tile, opacity) {
  g.save();
  g.globalAlpha = opacity;
  g.globalCompositeOperation = "soft-light";
  const pattern = g.createPattern(tile, "repeat");
  g.fillStyle = pattern;
  g.fillRect(0, 0, WIDTH, HEIGHT);
  g.restore();
}

function wallPainting(g, p, rnd) {
  const slats = [-38, 98, 250, 420, 607, 804, 1034];
  g.fillStyle = gradient(g, 0, HEIGHT, [[0, p.sky[0]], [.41, p.sky[1]], [1, p.ambGround]]);
  g.fillRect(0, 0, WIDTH, HEIGHT);
  wash(g, 630, 192, 640, 423, p.sky[2], .94);
  wash(g, 670, 177, 367, 287, p.rim, .85);
  wash(g, 716, 154, 171, 138, p.light, .87);
  wash(g, 192, 399, 231, 153, "#33406e", .65);

  // Cool light skims across translucent paper at an angle. The joints interrupt it.
  const rake = g.createLinearGradient(304, 240, 466, 433);
  rake.addColorStop(0, "#91ddff00");
  rake.addColorStop(.43, "#91ddff08");
  rake.addColorStop(.74, "#b2ebff30");
  rake.addColorStop(1, "#91ddff04");
  fillPath(g, new Path2D("M966 -22 L967 130 C613 268 341 394 0 538 L0 394 C354 242 658 161 966 -22 Z"), rake);
  fillPath(g, new Path2D("M961 77 L961 102 C652 239 470 293 207 434 C461 276 689 218 961 77 Z"), "#d6f2ff13");
  for (let i = 0; i < slats.length; i++) {
    const x = slats[i];
    if (i < slats.length - 1) {
      g.fillStyle = i % 2 ? "#e0fbff08" : "#040e3016";
      g.fillRect(x, 0, slats[i + 1] - x, HEIGHT);
    }
    fillPath(g, new Path2D(`M${x - 8} 0 h5 l${i * 2 - 7} 540 h-8 Z`), "#080f2c8a");
    fillPath(g, new Path2D(`M${x - 3} 0 h1.4 l${i * 2 - 6} 540 h-1.9 Z`), "#a4deee47");
  }
  fillPath(g, new Path2D("M0 95 L960 68 v4 L0 102 Z M0 506 L960 484 v14 L0 523 Z"), "#111b36a3");
  strokePath(g, new Path2D("M0 102 L960 73 M0 504 L960 482"), "#bdecff4d", 1.2);
  const sweep = new Path2D();
  for (let i = 0; i < 98; i++) {
    const x = rnd() * WIDTH, y = 370 - x * .29 + rnd() * 136, len = 7 + rnd() * 37;
    sweep.moveTo(x, y);
    sweep.quadraticCurveTo(x + len * .28, y - len * .05, x + len, y - len * .36);
  }
  strokePath(g, sweep, "#abd9f81e", .8);
  for (let i = 0; i < 114; i++) {
    const x = 54 + rnd() * 856, y = 85 + rnd() * 389, a = rnd() * .14;
    g.fillStyle = `rgba(211,241,255,${a})`;
    g.fillRect(x, y, 1 + rnd() * 2.8, .45 + rnd() * .8);
  }
}

function platformPainting(g, p, rnd) {
  g.fillStyle = gradient(g, 0, 298, [[0, p.sky[0]], [.48, "#967c8e"], [.78, "#db9b81"], [1, p.light]]);
  g.fillRect(0, 0, WIDTH, HEIGHT);
  wash(g, 721, 211, 461, 232, "#ffbe91", .8);
  wash(g, 721, 211, 219, 122, "#ffedd5", .8);
  const strokes = new Path2D();
  for (let i = 0; i < 72; i++) {
    const x = rnd() * WIDTH, y = 43 + rnd() * 180, w = 13 + rnd() * 180;
    strokes.moveTo(x, y);
    strokes.quadraticCurveTo(x + w * .6, y + 3.5, x + w, y + 1);
  }
  strokePath(g, strokes, "#ffe7d61d", 1.5);
  fillPath(g, new Path2D("M0 270 Q124 201 253 254 Q350 212 482 262 Q586 233 714 260 Q803 218 960 262 V324 H0 Z"), "#514d66");
  fillPath(g, new Path2D("M0 274 L157 245 L305 265 L487 253 L672 277 L826 248 L960 253 V333 H0 Z"), "#343e56");
  fillPath(g, new Path2D("M0 59 L287 42 L421 98 L282 104 L0 167 Z M126 128 l5 -1 9 159 -8 2 Z M297 96 l4 1 6 184 -5 1 Z"), "#303950");
  strokePath(g, new Path2D("M0 166 L280 103 L421 98 M267 106 L268 139 L319 132 L318 104"), "#dfb3929a", 1.6);
  fillPath(g, new Path2D("M275 113 L312 109 L312 128 L275 133 Z"), "#625a6d");
  strokePath(g, new Path2D("M283 121 l22 -3 M283 125 l11 -1"), "#ece1c68e", 1);
  const wires = new Path2D("M0 129 Q336 168 960 139 M0 157 Q451 195 960 166 M542 149 l0 100 M789 139 l0 134 M530 168 h27 M774 156 h30");
  strokePath(g, wires, "#353849b8", 1.4);
  fillPath(g, new Path2D("M0 308 L960 290 V540 H0 Z"), gradient(g, 292, 540, [[0, "#c6a199"], [.13, "#ad8d8f"], [.5, "#75677c"], [1, "#54566e"]]));
  fillPath(g, new Path2D("M0 312 L960 296 v11 L0 330 Z"), "#f7bd88");
  fillPath(g, new Path2D("M0 332 L960 309 v2 L0 337 Z"), "#604d68");
  wash(g, 711, 330, 464, 209, "#fbb284", .51);

  const seams = new Path2D();
  for (let i = -5; i <= 6; i++) {
    seams.moveTo(665 + i * 43, 306);
    seams.lineTo(665 + i * 223, 540);
  }
  for (const y of [351, 385, 442, 519]) {
    seams.moveTo(0, y);
    seams.lineTo(WIDTH, y - 17);
  }
  strokePath(g, seams, "#423a5376", 1.35);
  g.translate(1, 1.6);
  strokePath(g, seams, "#f6d5b23b", 1);
  g.translate(-1, -1.6);
  const paving = new Path2D();
  for (let i = 0; i < 92; i++) {
    const x = rnd() * WIDTH, y = 328 + rnd() * 12 - 19 * x / WIDTH;
    paving.moveTo(x, y);
    paving.lineTo(x + 3 + rnd() * 7, y - .6);
  }
  strokePath(g, paving, "#ffd0a694", 1.2);
}

const CREST = [[0, 455], [92, 450], [175, 428], [256, 421], [338, 408], [400, 401], [450, 408],
  [480, 416], [512, 414], [569, 398], [645, 404], [719, 421], [817, 431], [960, 459]];

function crestAt(x) {
  let i = 1;
  while (i < CREST.length - 1 && x > CREST[i][0]) i++;
  const [x0, y0] = CREST[i - 1], [x1, y1] = CREST[i];
  return mix(y0, y1, (x - x0) / (x1 - x0));
}

function cloudBank(g, rnd, x, y, w, h, underside, crest) {
  const rim = new Path2D();
  rim.moveTo(x, y);
  let a = x, b = y;
  for (let i = 1; i <= 5; i++) {
    const next = i === 5 ? x + w : x + (i + rnd() * .55) * w / 5;
    const step = next - a;
    const rise = h * (.15 + rnd() * .58);
    const level = i === 5 ? y : y - h * Math.sin(Math.PI * i / 5) * (.18 + rnd() * .53);
    rim.bezierCurveTo(a + step * .27, b - rise, next - step * .31, level - rise, next, level);
    a = next;
    b = level;
  }
  const body = new Path2D(rim);
  body.bezierCurveTo(x + w * .8, y + h, x + w * .14, y + h * .66, x, y);
  fillPath(g, body, gradient(g, y - h, y + h * .55, [[0, crest], [.51, crest.slice(0, 7) + "8c"], [1, underside]]));
  strokePath(g, rim, crest.slice(0, 7) + "4e", .65);
}

function ridgePainting(g, p, rnd) {
  g.fillStyle = gradient(g, 0, HEIGHT, [[0, p.sky[0]], [.28, p.sky[1]], [.49, "#c886a6"], [.61, "#f3b193"], [.73, p.sky[4]], [1, "#a77f9c"]]);
  g.fillRect(0, 0, WIDTH, HEIGHT);
  wash(g, 480, 321, 485, 205, "#ffd3a8", .64);
  wash(g, 488, 315, 241, 105, "#fff3dc", .9);
  for (let row = 0; row < 7; row++) {
    for (let i = 0; i < 14; i++) {
      const x = i * 76 - 98 + rnd() * 137, y = 233 + row * 25 + (rnd() - .5) * (16 + 5 * row);
      const warm = x > 225 && x < 650;
      cloudBank(g, rnd, x, y, 55 + rnd() * (137 + row * 28), 4 + row * 2 + rnd() * 16,
        row < 3 ? "#a66e9d22" : "#625d8b56", warm ? "#ffdeb4a0" : "#f0afd56b");
    }
  }
  wash(g, 505, 299, 277, 51, "#ffedc9", .48);
  fillPath(g, new Path2D("M0 385 L67 375 L105 367 L158 374 L228 367 L284 390 L341 395 L403 414 L0 483 Z"), "#63587789");
  fillPath(g, new Path2D("M960 360 L904 350 L849 371 L816 375 L769 392 L727 397 L665 435 L960 496 Z"), "#634e728e");
  const peak = new Path2D();
  peak.moveTo(...CREST[0]);
  for (const point of CREST.slice(1)) peak.lineTo(...point);
  const rock = new Path2D(peak);
  rock.lineTo(WIDTH, HEIGHT);
  rock.lineTo(0, HEIGHT);
  rock.closePath();
  fillPath(g, rock, gradient(g, 400, HEIGHT, [[0, "#55435f"], [.35, "#38334e"], [1, "#201f3b"]]));
  strokePath(g, peak, "#fab58fa3", 2);
  const flecks = new Path2D(), light = new Path2D();
  for (let i = 0; i < 340; i++) {
    const x = rnd() * WIDTH, y = crestAt(x) + 2 + rnd() * 96, l = rnd() * 19;
    if (y > HEIGHT) continue;
    const strokes = i % 3 === 0 ? light : flecks;
    strokes.moveTo(x, y);
    strokes.lineTo(x + l, y + rnd() * 4 - 2);
  }
  strokePath(g, flecks, "#e9a49a2d", .9);
  strokePath(g, light, "#f9bb874a", 1.1);
  const grass = new Path2D();
  const seedHeads = new Path2D();
  for (let i = 0; i < 39; i++) {
    const origin = rnd() * WIDTH;
    for (let j = 0; j < 4; j++) {
      const x = origin + rnd() * 11, y = crestAt(x) + rnd() * 6;
      const tipX = x + 1 + rnd() * 9, tipY = y - 3 - rnd() ** 2 * 17;
      grass.moveTo(x, y);
      grass.quadraticCurveTo(x + 2.5, tipY + 4, tipX, tipY);
      if (j === 0) {
        seedHeads.moveTo(tipX - 2, tipY + 1);
        seedHeads.lineTo(tipX + 2, tipY - 2);
      }
    }
  }
  strokePath(g, grass, "#4d3a58", 1.1);
  strokePath(g, seedHeads, "#e7b6a477", .75);
}

function whipPainting(g, p) {
  g.fillStyle = gradient(g, 0, HEIGHT, [[0, p.sky[0]], [.4, p.shade], [.65, "#85598a"], [1, "#402750"]]);
  g.fillRect(0, 0, WIDTH, HEIGHT);
  wash(g, 688, 264, 567, 228, "#ed8d82", .88);
  wash(g, 737, 248, 367, 82, "#fed1a0", .86);

  const folds = [
    ["M-30 73 C294 60 505 251 966 189 L984 221 C599 284 333 103 -30 111 Z", "#a07bad17"],
    ["M-20 149 C253 51 455 239 984 129 L984 145 C611 217 467 198 233 151 C104 125 62 144 -20 166 Z", "#f4a4af50"],
    ["M-40 275 C275 137 535 335 988 197 L982 217 C655 358 352 205 110 271 L-40 320 Z", "#eda681"],
    ["M-48 300 C241 227 474 345 668 293 C805 256 892 198 981 193 L981 230 C737 259 754 410 442 339 C256 297 102 282 -48 354 Z", "#e58a715e"],
    ["M-26 345 C214 246 297 408 593 332 C713 301 794 264 980 267 L980 293 C786 287 764 326 620 367 C301 450 225 301 -26 413 Z", "#502c6d"],
    ["M-40 388 C277 257 336 531 982 388 L982 416 C575 516 354 408 157 409 C97 409 21 437 -40 465 Z", "#a7729d9f"],
    ["M-30 200 C257 33 530 383 981 294 L983 305 C524 406 248 112 -30 225 Z", "#ffc197b2"],
    ["M-40 504 C280 353 499 580 982 455 L982 491 C628 596 305 438 -40 537 Z", "#2d1d4d9c"],
  ];
  for (const [path, color] of folds) fillPath(g, new Path2D(path), color);
  strokePath(g, new Path2D("M-18 285 C283 170 558 346 979 199 M0 202 C270 78 503 382 960 302"), "#ffdfb4b8", 1.65);
  strokePath(g, new Path2D("M-10 350 C214 268 298 405 592 340 S758 282 976 269 M-4 399 C320 267 467 556 979 397"), "#e1afd4a3", 1.45);
  strokePath(g, new Path2D("M-5 329 C239 202 421 209 535 294 C634 370 517 385 478 351 C419 299 629 239 969 259"), "#ffd2b376", 1.65);
  strokePath(g, new Path2D("M-4 124 C269 53 247 163 401 186 C527 205 735 152 970 166 M-12 485 C209 330 270 508 533 469"), "#efe0ff58", .95);
}

function speedPainting(g, rnd, count) {
  const groups = Array.from({ length: 4 }, () => new Path2D());
  for (let i = 0; i < count; i++) {
    const x = rnd() * 1130 - 85, y = 26 + rnd() * 488;
    const length = (12 + rnd() ** 2.2 * 150) * (.7 + Math.abs(270 - y) / 330);
    const line = groups[i % groups.length], lift = -length * (.05 + (y - 270) * .00049);
    line.moveTo(x, y);
    line.quadraticCurveTo(x + length * .52, y + lift * .27, x + length, y + lift);
  }
  const colors = ["#fff0cb75", "#eea38294", "#dba9e381", "#301d54ac"];
  groups.forEach((path, i) => strokePath(g, path, colors[i], i === 0 ? .82 : .52 + i * .37));
}

function crowdPainting(g, p, rnd) {
  g.fillStyle = gradient(g, 0, HEIGHT, [[0, "#80789f"], [.38, "#c6b5d7"], [.63, "#e3c8dc"], [1, p.shade]]);
  g.fillRect(0, 0, WIDTH, HEIGHT);
  wash(g, 542, 187, 467, 345, "#f5e5f2", .96);
  wash(g, 581, 213, 260, 234, "#ffe9d9", .83);
  wash(g, 25, 275, 224, 352, "#8682b9", .72);
  fillPath(g, new Path2D("M0 0 H30 L345 540 H229 Z M151 0 H184 L324 540 H277 Z M770 0 H808 L633 540 H594 Z"), "#7774a129");
  const glass = new Path2D("M87 16 L253 454 M111 0 L269 451 M815 0 L701 386 M852 0 L716 412 M0 109 L960 138 M0 119 L960 147");
  strokePath(g, glass, "#eee2f275", 1.5);
  const floor = new Path2D("M448 356 L277 540 M534 356 L668 540 M577 356 L837 540 M0 459 H960 M0 501 H960");
  strokePath(g, floor, "#f2e2fb3c", 1.6);
  for (let i = 0; i < 34; i++) {
    const x = rnd() * WIDTH, y = 104 + rnd() * 272;
    g.fillStyle = "#fff4f86c";
    g.fillRect(x, y, .6 + rnd() * 1.3, .75);
  }
}

// The silhouettes share an ankle anchor. A and B have different outlines and
// proportions, with small negative spaces between their arms and bodies.
const FIGURE_A = "M-7 -99 Q-2 -103 7 -99 L9 -94 L8 -90 L11 -87 L9 -85 L8 -82 L3 -81 L3 -76 Q14 -73 15 -61 L19 -42 L21 -35 L17 -32 L14 -37 L10 -51 L9 -59 L8 -43 L12 -26 L7 -25 L7 -18 L12 -4 L19 -2 L19 1 L6 1 L2 -6 L-1 -24 L-4 -26 L-7 -12 L-8 -3 L-4 -1 L-5 1 L-16 1 L-15 -6 L-14 -23 L-17 -24 L-12 -46 L-12 -58 L-16 -50 L-18 -38 L-17 -32 L-20 -31 L-23 -36 L-22 -48 L-18 -67 Q-16 -73 -6 -76 L-5 -80 Q-12 -84 -10 -94 L-11 -97 Z";
const FIGURE_B = "M-7 -97 Q0 -103 7 -99 Q11 -96 10 -90 L13 -87 L11 -85 L10 -81 L4 -80 L3 -76 Q13 -72 14 -61 L20 -45 L24 -41 L22 -37 L18 -38 L14 -45 L8 -56 L8 -43 Q13 -34 15 -26 L8 -23 L8 -19 L13 -4 L19 -2 L20 1 L8 1 L3 -6 L0 -22 L-3 -22 L-7 -5 L-4 -2 L-3 1 L-14 1 L-14 -3 L-11 -15 L-11 -23 L-18 -24 Q-17 -34 -11 -47 L-12 -58 L-16 -49 L-19 -34 L-24 -35 L-22 -49 Q-20 -70 -9 -74 Q-13 -76 -10 -82 Q-13 -78 -21 -76 Q-25 -75 -27 -69 Q-29 -80 -20 -85 L-12 -87 Q-13 -93 -7 -97 Z";
const PAIR = [new Path2D(FIGURE_A), new Path2D(FIGURE_B)];

function figure(g, x, y, scale, dir, type, color, rim, lean = 0, stride = 0) {
  g.save();
  g.translate(x, y);
  g.transform(scale * dir, 0, scale * lean, scale * (1 + stride), 0, 0);
  fillPath(g, PAIR[type], color);
  if (rim) strokePath(g, PAIR[type], rim, .48);
  g.restore();
}

function cord(g, fromX, fromY, toX, toY, sag, flutter, scale = 1) {
  const dx = toX - fromX;
  const thread = new Path2D();
  thread.moveTo(fromX, fromY);
  thread.bezierCurveTo(fromX + dx * .19, fromY + sag, toX - dx * .22, toY + sag + flutter, toX, toY);
  strokePath(g, thread, "#542c5ba3", 4.7 * scale);
  strokePath(g, thread, "#a72f52", 2.65 * scale);
  g.save();
  g.translate(0, -.55 * scale);
  strokePath(g, thread, "#f56f78", .9 * scale);
  g.setLineDash([.95 * scale, 4.8 * scale]);
  strokePath(g, thread, "#ffc29b", .7 * scale);
  g.restore();
}

function makeCrowd(rnd) {
  const rows = [[21, .29, .43, .34, "#9591ad"], [17, .52, .63, .82, "#79718e"], [11, .88, .83, 1.28, "#655e7e"]];
  const cuts = rows.flatMap(([count, size, floor, depth, color]) => Array.from({ length: count }, (_, i) => ({
    x: (i + rnd() * 1.9 - .95) / (count - 1), y: (floor + (rnd() - .15) * .15) * HEIGHT,
    size: size * (.65 + rnd() * .65), phase: rnd() * TAU, depth, color,
    dir: rnd() < .42 ? 1 : -1, type: rnd() < .41 ? 1 : 0
  })));
  return cuts.sort((a, b) => a.y - b.y);
}

export async function create({ THREE, scene, camera, ctx2d, back2d, kit, tier, seed }) {
  const rnd = random(seed);
  const tile = paperTile(kit, rnd);
  const width = SIZE[tier], height = width * HEIGHT / WIDTH;
  function paint(section, painting, grain = .64) {
    return kit.paint(width, height, g => {
      g.scale(width / WIDTH, height / HEIGHT);
      painting(g, kit.palette(section), rnd);
      if (grain) texturePaper(g, tile, grain);
    }).image;
  }
  const plates = {
    wall: paint("verse1", wallPainting, .9),
    platform: paint("verse2", platformPainting),
    ridge: paint("chorus2", ridgePainting),
    whip: paint("chorus2", whipPainting),
    crowd: paint("chorus2", crowdPainting, .72),
  };
  const speed = paint("chorus2", g => speedPainting(g, rnd, LINE_COUNT[tier]), 0);
  const crowd = makeCrowd(rnd);
  const atmosphere = new THREE.Group();
  atmosphere.visible = false;
  scene.add(atmosphere);
  const dust = kit.particles({ kind: "dust", count: { saver: 30, smooth: 66, ultra: 105 }[tier],
    seed, center: [0, 0, -10], box: [39, 10.4, 1.5], size: .037, drift: [.15, .17, 0],
    wobble: .13, on: "fast", beat: 1.2, twinkle: .75, opacity: .61 });
  const sparkles = kit.particles({ kind: "spark", count: { saver: 12, smooth: 32, ultra: 60 }[tier],
    seed: seed + 2, center: [0, .3, -11], box: [38, 8.5, 2], size: .078, drift: [.17, .12, 0],
    wobble: .15, on: "fast", beat: 2.1, twinkle: .84, opacity: .55, intensity: 2.3 });
  const haze = kit.haze({ count: { saver: 7, smooth: 12, ultra: 18 }[tier], seed: seed + 1,
    center: [0, -.6, -15], box: [30, 5.5, .3], size: 6.5, drift: [.035, .003, 0], additive: true });
  const source = kit.particles({ kind: "glow", count: 1, seed: seed + 5, size: 2.15,
    center: [0, 0, -12], box: [.001, .001, .001], drift: [0, 0, 0], wobble: 0,
    twinkle: 0, beat: .18, intensity: 2.3 });
  atmosphere.add(haze, dust, sparkles, source);

  function paintWall(f, g, subjectScale) {
    const apart = f.shot.var === "apart", separation = apart ? ease(f.shot.u) : 0;
    const nudge = apart ? f.pulse * Math.sin(Math.PI * f.shot.u) * 3 : 0;
    const breath = Math.sin(f.shot.lt * 1.55) * 2;
    const xA = 480 - 55 * subjectScale - separation * 133 - nudge;
    const xB = 480 + 46 * subjectScale + separation * 133 + nudge;
    const y = 490, a = 2.81 * subjectScale, b = 2.56 * subjectScale;
    const flutter = .025 * Math.sin(f.t * 3.3) + .024 * f.fastPulse;
    g.save();
    g.globalAlpha = .31;
    figure(g, xA - 11 * subjectScale, y + 8, a * 1.04, -1, 0, "#2b2d62", null, flutter);
    figure(g, xB + 9 * subjectScale, y + 7, b * 1.05, 1, 1, "#2b2d62", null, -flutter);
    g.restore();
    figure(g, xA, y + breath, a, -1, 0, "#172648e8", "#85c4e055", flutter);
    figure(g, xB, y - breath, b, 1, 1, "#19294be8", "#b3dbef65", -flutter);
    if (apart) cord(g, xA + 10 * a, y - a * 45, xB - 10 * b, y - b * 46,
      mix(27, 6, separation) * subjectScale, Math.sin(f.t * 5.2) * 4 + f.fastPulse * 4, mix(.96, .67, separation));
  }

  function train(f, g) {
    const offset = f.shot.lt * 710, y = 177;
    const glow = .53 + f.fastPulse * .43;
    fillPath(g, new Path2D("M0 183 Q220 179 960 171 V290 L0 310 Z"),
      gradient(g, 171, 310, [[0, "#434559"], [.18, "#6b6475"], [.68, "#565267"], [1, "#363d57"]]));
    strokePath(g, new Path2D("M0 183 L960 171 M0 281 L960 265"), "#fad0b9a6", 1.8);
    g.save();
    g.transform(1, -.014, 0, 1, 0, y);
    const windows = new Path2D(), frame = new Path2D(), flashes = new Path2D(), posts = new Path2D();
    for (let i = -1; i < 13; i++) {
      const x = i * 108 - ((offset % 108) + 108) % 108;
      const w = i % 3 === 0 ? 55 : 80;
      frame.roundRect(x, 30, w + 8, 48, 5.2);
      windows.roundRect(x + 4, 34, w, 39, 3.5);
      flashes.moveTo(x + 15, 71);
      flashes.lineTo(x + 54, 35);
      flashes.lineTo(x + 59, 35);
      flashes.lineTo(x + 24, 71);
      flashes.closePath();
      posts.rect(x + w + 14, 13, 2, 91);
    }
    fillPath(g, frame, "#333346");
    fillPath(g, windows, gradient(g, 32, 75, [[0, "#f5bc93"], [.22, "#fff4cf"], [.62, "#e8987b"], [1, "#8b5f74"]]));
    g.save();
    g.clip(windows);
    g.globalAlpha = glow;
    fillPath(g, flashes, "#fff9dc");
    g.restore();
    fillPath(g, posts, "#c89e9966");
    g.restore();
  }

  function castShadow(g, fromX, fromY, toX, toY, thickness, type) {
    g.save();
    g.translate(fromX, fromY);
    g.transform(thickness, .16 * Math.sign(toX - fromX), (fromX - toX) / 96, (fromY - toY) / 96, 0, 0);
    fillPath(g, PAIR[type], "#24283eb9");
    strokePath(g, PAIR[type], "#98708460", 1.3);
    g.restore();
  }

  function paintPlatform(f, g, subjectScale) {
    train(f, g);
    const overlap = 1 - ease(clamp(Math.abs(f.shot.u - .5) * 2, 0, 1));
    const drift = overlap * 76;
    castShadow(g, -20, 496, 443 + drift, 342 - 12 * overlap, 1.04 * subjectScale, 0);
    castShadow(g, 980, 510, 529 - drift, 342 + 7 * overlap, .97 * subjectScale, 1);
  }

  function paintRidge(f, g, subjectScale) {
    const y = crestAt(480);
    const light = .82 + .13 * f.pulse;
    wash(g, 480, 224, 47, 253, "#ffa7c9", light);
    wash(g, 480, 359, 150, 73, "#ffd1bb", .66);
    fillPath(g, new Path2D(`M479 28 Q477 152 477 259 L474 ${y} L486 ${y} Q481 284 481 258 L481 30 Z`),
      gradient(g, 28, y, [[0, "#ffb1d000"], [.32, "#f5a3c2af"], [.79, "#ffd6e5"], [1, "#fff3e1"]]));
    strokePath(g, new Path2D(`M480 104 L480 ${y - 1}`), "#fff4eec7", 1.45);
    const step = ease(f.shot.u), reach = 35 + 106 * step;
    const a = 480 - reach, b = 480 + reach * .93;
    const sway = Math.sin(f.fast * Math.PI) * .044;
    figure(g, a, crestAt(a), .9 * subjectScale, -1, 0, "#342a44", "#ffdcb5b3", sway, -.018 * f.fastPulse);
    figure(g, b, crestAt(b), .83 * subjectScale, 1, 1, "#3c2c43", "#ffd3b29f", -sway, -.024 * f.fastPulse);
  }

  function paintWhip(f, g) {
    const kick = Math.max(f.hit, f.downPulse, f.fastPulse * .42);
    const shift = (ease(f.shot.u) - .5) * 182 + 21 * kick;
    g.save();
    g.globalAlpha = .46 + .38 * kick;
    g.drawImage(speed, shift - 146, -10, WIDTH + 268, HEIGHT + 20);
    g.globalAlpha = .13 + .23 * kick;
    g.drawImage(speed, shift - 180, -5, WIDTH + 290, HEIGHT + 11);
    g.restore();
  }

  function paintCrowd(f, g, subjectScale) {
    for (const cut of crowd) {
      const swing = Math.sin(f.fast * Math.PI + cut.phase);
      const walk = (f.shot.u - .5) * cut.dir * cut.depth * 47;
      const y = cut.y - Math.abs(swing) * cut.depth * 2;
      figure(g, cut.x * WIDTH + walk, y, cut.size * (1.19 + .23 * subjectScale), cut.dir, cut.type,
        cut.color, "#e2cfe543", .054 * swing);
    }
    const x = 515 + ease(f.shot.u) * 89;
    const a = 2.57 * subjectScale, y = 489 - f.fastPulse * 2.8;
    const flutter = Math.sin(f.t * 8) * 10 + 7 * f.fastPulse;
    cord(g, x - 7 * a, y - 46 * a, x - 230, 419, 62, flutter, 1.29);
    figure(g, x, y, a, 1, 1, "#4a3957", "#f8d4ddbd", .07);
    const knot = new Path2D();
    knot.ellipse(x - 10 * a, y - 46 * a, 3.8 * subjectScale, 2.5, -.5, 0, TAU);
    fillPath(g, knot, "#e76075");
  }

  const setups = {
    wall: { draw: paintWall, section: "verse1", x: .744, y: .285, haze: .115, glow: .61, rays: .49, bloom: .97, tint: [1, .50, .46], threshold: .43, sat: 1.15 },
    platform: { draw: paintPlatform, section: "verse2", x: .752, y: .315, haze: .075, glow: .43, rays: .39, bloom: .85, tint: [1, .56, .36], threshold: .52, sat: 1.03 },
    ridge: { draw: paintRidge, section: "chorus2", x: .5, y: .60, haze: .11, glow: .54, rays: .46, bloom: 1.1, tint: [1, .46, .52], threshold: .50, sat: 1.09 },
    whip: { draw: paintWhip, section: "chorus2", x: .767, y: .46, haze: .08, glow: .48, rays: .41, bloom: 1, tint: [1, .5, .37], threshold: .5, sat: 1.16 },
    crowd: { draw: paintCrowd, section: "chorus2", x: .602, y: .39, haze: .10, glow: .57, rays: .33, bloom: .87, tint: [1, .54, .66], threshold: .56, sat: .86 },
  };
  for (const setup of Object.values(setups)) {
    const p = kit.palette(setup.section);
    setup.light = new THREE.Color(p.light);
    setup.rim = new THREE.Color(p.rim);
    setup.fog = new THREE.Color(p.fog);
  }

  function lighting(f, setup, x, y) {
    const aspect = f.W / f.H, fov = 45;
    const span = 12 * Math.tan(fov * Math.PI / 360) * 2;
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.fov = fov;
    source.position.set((x - .5) * span * aspect, (.5 - y) * span, 0);
    const sourceU = source.material.uniforms;
    sourceU.uCol.value.copy(setup.light).multiplyScalar(2.14);
    sourceU.uCol2.value.copy(setup.rim).multiplyScalar(2.14);
    sourceU.uSize.value = Math.min(3.0, .16 * span * aspect);
    sourceU.uOpacity.value = .71 + f.fastPulse * .18;
    const hazeU = haze.material.uniforms;
    hazeU.uTop.value.copy(setup.light);
    hazeU.uBot.value.copy(setup.fog);
    hazeU.uOpacity.value = setup.haze;
    for (const points of [dust, sparkles]) {
      const u = points.material.uniforms;
      u.uCol.value.copy(setup.light).multiplyScalar(2);
      u.uCol2.value.copy(setup.rim).multiplyScalar(2);
    }
    kit.tick(f, haze, dust, sparkles, source);
    kit.look({ bloom: setup.bloom, threshold: setup.threshold, halation: setup.tint,
      glow: setup.glow, rays: setup.rays + f.hit * .28, rayX: x, rayY: y, sat: setup.sat,
      tilt: .28, band: .44, focus: .53, chroma: .20, exposure: 1.02, vignette: .39,
      leak: .022 + f.fastPulse * .022, leakColor: setup.tint, leakX: x, leakY: y });
  }

  return {
    update(f) {
      const { key, var: variant } = f.shot, setup = setups[key];
      const aspect = f.W / f.H;
      const scale = clamp(aspect / 1.27, .42, 1);
      const mirror = key === "whip" && variant === "reverse";
      back2d.save();
      back2d.scale(f.W / WIDTH, f.H / HEIGHT);
      if (mirror) {
        back2d.translate(WIDTH, 0);
        back2d.scale(-1, 1);
      }
      back2d.drawImage(plates[key], 0, 0, WIDTH, HEIGHT);
      setup.draw(f, back2d, scale);
      back2d.restore();
      lighting(f, setup, mirror ? 1 - setup.x : setup.x, setup.y);
    },
    setVisible(on) {
      atmosphere.visible = on;
    },
    dispose() {
      scene.remove(atmosphere);
      atmosphere.clear();
      // The kit owns the painted canvases and the atmospheric resources.
    },
  };
}
