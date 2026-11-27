import { drawInk } from "../ink.mjs";

const WIDTH = 1200;
const HEIGHT = 675;
const INK_SEED = 2;
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const mix = (a, b, u) => a + (b - a) * u;

const SURFACES = {
  palm: ["verse1", "#211e38", "#716786", "#f5c78c", "cloth"],
  notebook: ["prechorus", "#242c4c", "#594b68", "#da9a61", "wood"],
  note: ["verse2", "#202c40", "#444b67", "#be785c", "wood"],
  map: ["verse2", "#263b38", "#53594d", "#e1a867", "wood"],
  chalk: ["verse2", "#162e31", "#355750", "#7b9b77", "slate"],
  sketches: ["chorus2", "#333a50", "#787c85", "#d9a67b", "plaster"],
  book: ["chorus2", "#302639", "#635774", "#d19b69", "wood"]
};

function random(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function fill(g, data, color) {
  g.fillStyle = color;
  g.fill(new Path2D(data));
}

function line(g, data, color, width = 1) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke(new Path2D(data));
}

function gradient(g, x0, y0, x1, y1, stops) {
  const brush = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([at, color]) => brush.addColorStop(at, color));
  return brush;
}

function wash(g, x, y, radius, stops) {
  const brush = g.createRadialGradient(x, y, 0, x, y, radius);
  stops.forEach(([at, color]) => brush.addColorStop(at, color));
  g.fillStyle = brush;
  g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function ellipse(g, x, y, rx, ry, color, angle = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, angle, 0, 2 * Math.PI);
  g.fillStyle = color;
  g.fill();
}

function fiber(g, rnd, w, h, count, light, dark, length, rise = 2) {
  g.lineWidth = .8;
  for (const color of [light, dark]) {
    g.beginPath();
    for (let i = 0; i < count; i++) {
      const x = rnd() * w, y = rnd() * h;
      const width = (rnd() ** 2 + .02) * length;
      g.moveTo(x, y);
      g.quadraticCurveTo(x + width * .55, y + rise * rnd(), x + width, y + rise);
    }
    g.strokeStyle = color;
    g.stroke();
  }
}

function paperskin(g, rnd, w, h, colors) {
  g.fillStyle = gradient(g, 0, 0, w, h, colors.map((c, i) => [i / (colors.length - 1), c]));
  g.fillRect(0, 0, w, h);
  wash(g, w * .13, h * .15, w * .68, [[0, "#fff4cf66"], [1, "#fff4cf00"]]);
  wash(g, w * .88, h * .79, w * .50, [[0, "#6b637637"], [1, "#6b637600"]]);
  fiber(g, rnd, w, h, 350, "#fffbdd63", "#765a562b", 14);
}

function backdrop(g, rnd, name, palette) {
  const [, dark, middle, warm, material] = SURFACES[name];
  g.fillStyle = gradient(g, 85, 652, 920, -110, [[0, dark], [.59, middle], [1, warm]]);
  g.fillRect(0, 0, WIDTH, HEIGHT);
  wash(g, 165, 32, 660, [[0, palette.light + "8f"], [.3, warm + "5b"], [1, warm + "00"]]);
  wash(g, 1050, 590, 540, [[0, dark + "be"], [1, dark + "00"]]);

  if (material === "wood" || material === "cloth") {
    const cloth = material === "cloth";
    g.save();
    g.transform(1, cloth ? .11 : -.075, cloth ? -.54 : .22, 1, -140, 10);
    for (let y = -45; y < 840; y += cloth ? 76 : 112) {
      const wobble = rnd() * 24;
      line(g, `M0 ${y} Q750 ${y + wobble} 1750 ${y - 7}`, dark + "68", cloth ? 9 : 2.5);
      line(g, `M0 ${y + 3} Q750 ${y + wobble + 4} 1750 ${y - 4}`, warm + "69", cloth ? 4 : 1.5);
    }
    fiber(g, rnd, 1900, 880, 1700, "#ffe2ba22", "#1f223a2f", cloth ? 15 : 190, cloth ? 3 : -2);
    g.restore();
  } else {
    for (let i = 0; i < 105; i++) {
      const x = rnd() * WIDTH, y = rnd() * HEIGHT, r = 24 + rnd() * 106;
      wash(g, x, y, r, [[0, (i % 2 ? dark : warm) + "10"], [1, warm + "00"]]);
    }
    fiber(g, rnd, WIDTH, HEIGHT, 1950, "#e6dec824", "#212a372d", material === "slate" ? 60 : 8, -3);
  }

  if (name !== "sketches") {
    const beam = gradient(g, 354, 29, 205, 420,
      [[0, "#fff1bb9f"], [.54, "#ffe4a359"], [1, "#ffe4a300"]]);
    fill(g, "M-270 -90 H286 L1040 676 H694 Z", beam);
    fill(g, "M320 -72 H383 L1169 675 H1072 Z", "#ffdf9a26");
    fill(g, "M394 -75 H437 L1239 676 H1199 Z", dark + "47");
  }
  if (name === "chalk") {
    g.fillStyle = gradient(g, 0, 524, 0, 586, [[0, "#9a9d727f"], [.17, "#a3a487"], [.26, "#6d7579"], [.62, "#454956"], [1, "#282d3c"]]);
    g.fillRect(0, 530, WIDTH, 56);
    fill(g, "M0 586 H1200 V675 H0 Z", "#242e3d");
    line(g, "M0 535 L1200 535", "#e4d4a898", 2.5);
    for (let i = 0; i < 34; i++) ellipse(g, rnd() * WIDTH, 531 + rnd() * 15, 1 + rnd() * 3, .5 + rnd(), "#fff2c74e");
    fill(g, "M792 532 L849 526 L857 531 L850 541 L793 542 L787 538 Z", "#f6e6c7");
    fill(g, "M788 537 L793 542 L850 541 L857 531 L849 536 Z", "#aeb7af");
  }
}

const HAND = "M939 622 C878 573 829 534 776 505 C733 482 697 466 673 446 C637 452 599 436 569 415 C534 390 520 370 500 352 C478 334 450 319 431 310 C408 297 412 282 431 279 C456 278 481 289 509 303 C524 310 527 309 525 299 C519 276 498 260 474 242 L383 186 C363 173 365 155 380 151 C391 148 406 156 418 163 L480 197 L525 224 C535 231 539 226 532 218 C513 197 480 167 443 141 L421 121 C405 104 418 86 435 93 C450 100 470 115 485 128 C512 149 541 173 563 193 C574 203 579 203 574 192 C565 172 547 143 529 119 C514 98 521 82 537 83 C556 85 582 118 597 141 C611 161 626 187 638 214 C652 247 667 272 677 278 C688 285 700 281 699 261 C696 234 695 213 704 196 C713 180 738 175 746 196 C752 212 745 235 752 255 C765 287 768 312 756 343 C749 364 749 389 763 414 C792 457 862 478 978 550 Z";

function hand(g, rnd) {
  g.lineJoin = "round";
  const shape = new Path2D(HAND);
  g.save();
  g.translate(12, 23);
  g.fillStyle = "#251b3b49";
  g.fill(shape);
  g.restore();
  g.fillStyle = gradient(g, 400, 118, 880, 576,
    [[0, "#ffe1ac"], [.33, "#f3bf9c"], [.68, "#dc8f81"], [1, "#b27d8f"]]);
  g.fill(shape);
  g.save();
  g.clip(shape);
  fill(g, "M362 209 Q430 237 510 305 Q558 316 558 288 Q576 321 585 350 C614 380 661 396 715 384 Q749 384 764 411 Q833 483 1000 524 V655 H849 Q737 540 652 486 Q550 449 462 383 Z", "#a16e8f");
  fill(g, "M366 194 L437 219 Q500 252 538 272 Q540 285 550 300 Q528 309 498 286 Z M415 123 L481 162 Q533 195 569 235 Q559 239 544 229 L491 191 Z M525 108 C566 130 604 176 629 227 Q619 231 608 218 Q577 174 539 149 Z M698 208 Q718 222 710 262 Q707 286 679 301 Q667 298 675 282 Q700 285 699 261 Z", "#c98088");
  fill(g, "M437 281 Q496 290 552 325 C568 349 604 380 642 396 Q677 406 688 419 C631 426 576 395 543 369 Q474 315 430 308 Z", "#ca8590");
  fill(g, "M328 42 H518 L792 406 Q777 425 768 434 L333 211 Z",
    gradient(g, 448, 101, 737, 414, [[0, "#fff5cb9c"], [.65, "#fff0bf51"], [1, "#ffdda327"]]));
  wash(g, 599, 245, 151, [[0, "#fff0c76f"], [.56, "#ffd79932"], [1, "#ffdb9f00"]]);
  fiber(g, rnd, 1000, 630, 750, "#fff3cc2e", "#703e572a", 8, 4);
  g.restore();
  g.strokeStyle = "#966078bc";
  g.lineWidth = 1.7;
  g.stroke(shape);
  line(g, "M380 153 Q393 149 420 167 M426 96 Q444 97 477 125 M531 86 Q544 78 573 112 M710 191 Q724 179 738 189 M421 284 Q430 276 448 281", "#fff1c9dc", 2.5);
  line(g, "M545 279 Q571 302 574 336 Q580 357 608 377 M637 256 Q657 266 668 289 Q676 319 660 352 Q650 371 647 392 M673 408 Q690 407 703 394 M716 421 Q730 430 742 435", "#9c586b94", 2.2);
  line(g, "M615 268 Q626 276 632 291 M568 257 Q581 264 590 276 M470 207 Q480 207 486 214 M490 188 Q500 186 508 195 M558 141 Q568 143 573 153 M720 224 Q734 217 743 221 M719 230 Q728 226 739 227", "#a56e7778", 1.6);
}

function inkRows(g, rnd, w, h, columns) {
  const left = 20, top = 47;
  g.lineCap = "round";
  for (let row = 0; row < 8; row++) {
    const y = top + row * (h - 75) / 8;
    const shade = row % 4 ? "#3c3555d9" : "#683746d1";
    let x = left + rnd() * 9;
    for (let col = 0; col < columns && x < w - 27; col++) {
      const n = 8 + rnd() * 13, t = y + rnd() * 4 - 2;
      const k = Math.floor(rnd() * 4);
      const path = [
        `M${x} ${t - 6} q${n} -4 ${n * .79} 1 q-1 5 ${-n * .72} 8 m3 -2 q5 1 8 5`,
        `M${x + 3} ${t - 7} q-5 7 -2 11 q4 -2 9 -2 q6 1 0 7 m1 -17 l5 2`,
        `M${x} ${t - 4} q${n * .5} -1 ${n} 0 m${-n * .5} -5 q2 9 -6 15`,
        `M${x + 3} ${t - 6} l2 3 m4 -3 q-6 10 -5 12 q5 -4 12 -2`
      ][k];
      line(g, path, shade, 1.25 + rnd() * .7);
      x += n + 7;
    }
  }
}

function notebookPaper(g, rnd, w, h) {
  paperskin(g, rnd, w, h, ["#ebbe93", "#fff0d0", "#e4d5cb", "#b4a6ba"]);
  g.fillStyle = "#8058802d";
  g.fillRect(17, 19, 1.2, h - 35);
  for (let y = 33; y < h - 14; y += (h - 75) / 8) {
    line(g, `M0 ${y} Q${w / 2} ${y - 4} ${w} ${y + 1}`, "#7369882c");
  }
}

function spread(g, w, h, cover) {
  fill(g, `M${-w - 34} 45 Q-180 18 0 46 Q180 16 ${w + 34} 45 L${w + 66} ${h + 33} Q140 ${h + 25} 0 ${h + 57} Q-150 ${h + 34} ${-w - 65} ${h + 68} Z`, "#231d34a9");
  fill(g, `M${-w - 13} 4 Q-55 -8 0 19 Q97 0 ${w + 13} 4 L${w + 15} ${h + 18} Q110 ${h + 8} 0 ${h + 29} Q-109 ${h + 9} ${-w - 17} ${h + 17} Z`, cover);
  for (let y = 5; y <= 13; y += 4) {
    line(g, `M${-w - 3} ${h + y} Q-100 ${h + y - 7} 0 ${h + y + 10} Q100 ${h + y - 7} ${w + 3} ${h + y}`, y === 9 ? "#8d766e" : "#d6b48f", 2.7);
  }
}

function hinge(g, h) {
  const crease = gradient(g, -36, 0, 35, 0, [[0, "#3d293800"], [.46, "#392a4149"], [.51, "#3d293b7d"], [.59, "#fff0c868"], [1, "#fff0c800"]]);
  g.fillStyle = crease;
  g.fillRect(-36, 4, 71, h);
  line(g, `M0 6 Q-4 ${h / 2} 0 ${h + 1}`, "#4b363e63", 1);
}

function turn(g, image, w, h, p, tint) {
  if (p <= 0 || p >= 1) return;
  const side = Math.cos(p * Math.PI), lift = Math.sin(p * Math.PI);
  const direction = Math.sign(side) || 1;
  g.save();
  g.transform(side, -lift * .23, 0, 1 - lift * .09, 0, lift * 21);
  if (direction < 0) {
    g.translate(w, 0);
    g.scale(-1, 1);
  }
  g.drawImage(image, 0, 0, w, h);
  g.fillStyle = gradient(g, 0, 0, w, 0, [[0, "#49364773"], [.28, tint], [.85, "#fff2ca44"], [1, "#fff4cabb"]]);
  g.fillRect(0, 0, w, h);
  line(g, `M${w} 0 V${h}`, "#fff3d4", 1.4);
  g.restore();
}

const NOTE = "M0 5 Q123 -3 240 4 L459 0 L462 250 L428 243 L414 250 L388 245 L350 253 L325 246 L295 252 L272 247 L245 253 L219 246 L201 253 L174 247 L139 253 L110 248 L85 252 L63 246 L35 251 L5 245 Z";

function notePaper(g, rnd, w, h) {
  g.save();
  g.clip(new Path2D(NOTE));
  paperskin(g, rnd, w, h, ["#f3e4bc", "#f9e8cf", "#d6b8ac", "#bda5ab"]);
  fill(g, "M0 155 L462 238 V305 H0 Z", "#8f66792c");
  line(g, "M1 151 Q190 173 462 237", "#fff6d57c", 2);
  line(g, "M1 154 Q190 176 462 240", "#7e546852", 1.2);
  g.restore();
}

// An uneven, nearly round crater basin, shared by the map and pencil study.
const BASIN = "M-91 -5 C-98 -33 -68 -58 -38 -67 C-8 -78 25 -74 49 -61 C75 -53 99 -30 98 -4 C102 17 89 36 66 49 C40 69 13 68 -9 63 C-34 69 -65 59 -79 39 C-96 29 -100 13 -91 -5 Z";

function basin(g, color, stroke) {
  if (color) fill(g, BASIN, color);
  line(g, BASIN, stroke, 1.35);
}

function mapPanel(g, rnd, w, h, panel) {
  paperskin(g, rnd, w, h, ["#d2a57d", "#f1ddb0", "#e4ca9f", "#c6a383"]);
  for (let x = 12; x < w; x += 30) line(g, `M${x} 0 v${h}`, "#766b6537");
  for (let y = 10; y < h; y += 30) line(g, `M0 ${y} h${w}`, "#766b6537");
  g.strokeStyle = "#877c646f";
  g.strokeRect(7, 7, w - 14, h - 14);
  g.save();
  g.translate(panel === 0 ? w + 30 : panel === 2 ? -56 : w / 2, panel === 1 ? h * .54 : h * .53);
  for (let i = 10; i > 0; i--) {
    g.save();
    g.rotate(i * .007);
    g.scale(1 + i * .13, 1 + i * .145);
    basin(g, null, i % 3 ? "#786a5569" : "#806d579f");
    g.restore();
  }
  if (panel === 1) {
    basin(g, "#648d9b", "#3c5c71");
    g.save();
    g.scale(.88, .88);
    basin(g, "#729ca8", "#b6c5b47c");
    g.restore();
    line(g, "M-78 -12 Q-31 -22 24 -14 T86 -16 M-84 2 Q-34 7 1 2 T89 1 M-71 20 Q-27 15 8 22 T78 22", "#b8d2c689");
    line(g, "M-148 106 Q-92 77 -98 44 Q-104 24 -88 13", "#a13d46d8", 2);
    ellipse(g, -98, 44, 4, 4, "#ad424a");
    line(g, "M119 -106 V-68 M107 -86 H130 M119 -107 l-5 11 h10 Z", "#694e55", 1.5);
  }
  g.restore();
  fiber(g, rnd, w, h, 78, "#814e3e31", "#64594a5b", 28);
}

function slateMarks(g, rnd, w, h) {
  const chalk = "#e6debd";
  line(g, "M61 96 C59 56 114 45 168 54 C198 59 213 72 211 89 M52 229 Q173 252 280 235 M337 115 q69 -9 120 4 M357 144 q18 -6 57 1 M371 167 q26 -4 48 3 M381 194 q37 -4 79 3",
    "#d1c9a67f", 2.4);
  for (let i = 0; i < 17; i++) {
    const x = 19 + rnd() * 463, y = 34 + rnd() * 223;
    line(g, `M${x} ${y} l${2 + rnd() * 6} ${-3 - rnd() * 6}`, "#c9d3b077", 1.7);
  }
  fiber(g, rnd, w, h, 1160, "#fff2cd2e", "#dceccc25", 3.5);
  line(g, "M44 213 C2 146 22 40 95 23 C166 5 262 3 306 39", chalk + "55", 3.6);
}

function pencil(g, rnd, w, h, type) {
  const carbon = "#565268c7";
  if (type === 0) {
    line(g, `M14 ${h - 30} q35 -43 61 -11 q40 -50 96 -3 M9 ${h - 16} q62 -20 114 -6 M49 74 Q78 53 146 24 M53 80 Q93 58 148 29 M60 81 Q94 71 125 50 M146 20 l5 17 m-12 -6 l16 -6`, carbon, 1.25);
    for (let i = 0; i < 65; i++) ellipse(g, 12 + rnd() * (w - 24), 18 + rnd() * 77, .45 + rnd(), .48, "#7c697c94");
  } else if (type === 1) {
    g.save();
    g.translate(w * .52, h * .49);
    g.scale(.98, .85);
    for (const s of [1.16, 1.06, .96]) {
      g.save();
      g.scale(s, s);
      basin(g, null, carbon);
      g.restore();
    }
    line(g, "M-111 40 Q-48 32 12 39 Q54 37 99 28 M-94 23 Q-59 14 -15 23 M-108 -12 Q-56 -27 -5 -21 Q42 -14 95 -19 M41 3 q18 -3 49 -5", carbon, .9);
    g.restore();
    line(g, "M14 191 H198 M31 209 H207 M247 202 l13 -19 l17 3 l13 23 Z m5 -1 l8 -18 m11 2 l-1 16 M245 216 h52", carbon, 1.2);
  } else {
    line(g, "M65 32 l48 4 l23 49 l-25 42 l-55 -8 l-18 -46 Z M65 32 l-9 87 M113 36 l-2 91 M38 73 l98 12 M61 143 l88 6 M67 155 l55 6 M54 25 Q85 13 121 24", carbon, 1.35);
  }
  fiber(g, rnd, w, h, 110, "#65547139", "#6261714a", 18, -7);
}

function panorama(g, rnd, w, h) {
  g.fillStyle = gradient(g, 0, 0, 0, h, [[0, "#4e88bf"], [.34, "#9dcde4"], [.48, "#f7e5c2"], [.58, "#7ca4bf"], [1, "#315e90"]]);
  g.fillRect(0, 0, w, h);
  wash(g, w * .71, h * .29, 154, [[0, "#fff4bdc9"], [.55, "#eaf6ea4c"], [1, "#fff5c100"]]);
  const peaks = [
    "M0 141 L37 124 L74 119 L109 90 L141 69 L155 78 L182 51 L201 62 L223 86 L250 78 L286 101 L309 104 L337 131 L366 119 L402 100 L433 88 L465 98 L495 81 L541 109 L568 112 L608 138 L646 145 L680 132 L714 132 L714 185 L0 185 Z",
    "M0 155 L40 141 L81 144 L120 128 L143 138 L172 134 L201 156 L232 154 L266 167 L311 161 L359 170 L397 153 L426 141 L470 152 L511 135 L559 150 L595 145 L632 132 L674 138 L714 113 L714 190 L0 190 Z",
    "M0 171 L55 157 L83 165 L113 155 L136 163 L157 172 L192 176 L223 180 L266 174 L324 178 L373 179 L429 171 L475 173 L515 162 L574 166 L625 151 L660 149 L714 129 L714 180 Q646 166 570 193 Q504 202 466 192 Q444 182 350 199 Q262 191 207 195 Q141 189 85 199 L0 222 Z"
  ];
  for (const [i, peak] of peaks.entries()) {
    const colors = [["#6e8bb9", "#a3acc3"], ["#567ca2", "#8f9eab"], ["#485c7a", "#6d8c85"]][i];
    g.save();
    g.translate(0, 356);
    g.scale(1, -1);
    g.globalAlpha = .24 - i * .036;
    fill(g, peak, colors[0]);
    g.restore();
    fill(g, peak, gradient(g, 10, 130, 680, 178, [[0, colors[0]], [.66, colors[1]], [1, colors[0]]]));
  }
  fill(g, "M0 174 L55 157 L83 165 L113 155 L148 166 L128 172 L105 166 L80 178 L69 172 L34 181 Z M609 168 L647 152 L672 147 L714 129 V143 L689 145 L675 155 L658 154 Z", "#a4a391a4");
  fill(g, "M132 88 L156 78 L183 51 L201 62 L225 88 L204 77 L195 79 L191 64 L181 75 L173 73 L151 88 Z M445 92 L466 98 L495 81 L532 102 L502 95 L497 88 L481 99 L475 101 Z", "#d9e5e4b7");
  line(g, "M0 221 Q57 194 106 197 Q164 191 214 197 M433 190 Q469 192 507 193 Q538 193 581 189 Q653 170 714 178", "#e9d6a6c4", 1.8);
  for (let i = 0; i < 185; i++) {
    const x = rnd() * w, y = 185 + rnd() ** 1.6 * (h - 185), len = 3 + rnd() ** 2 * 94;
    const lit = Math.abs(x - w * .71) < 120 * (y / h);
    line(g, `M${x} ${y} q${len / 2} -1 ${len} 0`, lit ? "#ffe6af87" : "#bbe5ee62", .35 + rnd() * 1.45);
  }
  for (let i = 0; i < 49; i++) {
    const x = rnd() * w, y = 12 + rnd() * 45, r = 4 + rnd() * 37;
    ellipse(g, x, y, r, 1 + rnd() * 6, "#fff6d824", -.04);
  }
  fill(g, "M0 297 Q79 268 144 294 Q176 309 211 320 H0 Z M589 320 Q641 292 672 297 L714 286 V320 Z", "#385779");
  for (let i = 0; i < 43; i++) {
    const x = i % 2 ? rnd() * 137 : 595 + rnd() * 119;
    const y = 312 + rnd() * 25, a = 10 + rnd() * 42;
    line(g, `M${x} ${y} q-9 -8 -12 ${-a}`, i % 3 ? "#28416eb4" : "#dac69680", 1);
  }
  fiber(g, rnd, w, h, 910, "#e4f0e525", "#33477027", 14);
}
const SKETCHES = [
  { x: 274, y: 228, w: 164, h: 173, tilt: -.135 },
  { x: 430, y: 184, w: 322, h: 238, tilt: -.032 },
  { x: 764, y: 220, w: 173, h: 179, tilt: .102 }
];

const LOOKS = {
  palm: { exposure: 1.02, lift: [.024, .018, .038], gain: [1.08, .98, 1.02], glow: .29, bloom: .78, tilt: .33, rayX: .20, rayY: .15, rays: .34, leakColor: [1, .52, .26] },
  notebook: { exposure: 1.02, lift: [.027, .025, .053], gain: [1.07, .96, 1.08], glow: .24, bloom: .75, tilt: .29, rayX: .14, rayY: .13, rays: .28, leakColor: [1, .57, .35] },
  note: { exposure: 1.01, lift: [.021, .024, .039], gain: [1.04, .97, 1.04], glow: .23, bloom: .68, tilt: .33, rayX: .23, rayY: .12, rays: .25, leakColor: [1, .53, .31] },
  map: { exposure: 1.01, lift: [.02, .026, .036], gain: [1.05, 1, .96], glow: .25, bloom: .72, tilt: .25, rayX: .18, rayY: .14, rays: .27, leakColor: [1, .64, .37] },
  chalk: { exposure: .98, lift: [.012, .023, .031], gain: [1.03, 1.07, 1.03], glow: .27, bloom: .7, tilt: .32, rayX: .12, rayY: .22, rays: .20, leakColor: [1, .75, .48] },
  sketches: { exposure: 1.04, lift: [.028, .027, .048], gain: [1.07, .99, 1.03], glow: .26, bloom: .77, tilt: .31, rayX: .13, rayY: .14, rays: .31, leakColor: [1, .65, .42] },
  book: { exposure: 1.02, lift: [.025, .019, .043], gain: [1.05, .99, 1.08], glow: .29, bloom: .79, tilt: .31, rayX: .65, rayY: .35, rays: .32, leakColor: [1, .58, .31] }
};

export async function create({ THREE, scene, camera, back2d: g, kit, tier, seed }) {
  const resolution = { saver: 1280, smooth: 2048, ultra: 3072 }[tier];
  const rnd = random(seed);
  // Keep the soft backgrounds smaller than the focused drawings and paper fibers.
  function paint(w, h, draw, pixelScale = resolution / WIDTH) {
    return kit.paint(Math.ceil(w * pixelScale), Math.ceil(h * pixelScale), (ctx, pw, ph) => {
      ctx.scale(pw / w, ph / h);
      draw(ctx, w, h);
    }).image;
  }

  const grounds = {};
  for (const [name, [section]] of Object.entries(SURFACES)) {
    grounds[name] = paint(WIDTH, HEIGHT, ctx => backdrop(ctx, rnd, name, kit.palette(section)), resolution / WIDTH * .5);
  }

  const palm = paint(680, 557, ctx => {
    ctx.translate(-327, -72);
    hand(ctx, rnd);
  });
  const leafW = 350, leafH = 386;
  const notebook = paint(leafW, leafH, (ctx, w, h) => notebookPaper(ctx, rnd, w, h));
  const journalInk = [11, 117, 31].map(s => paint(leafW, leafH, (ctx, w, h) => inkRows(ctx, random(seed + s), w, h, 13)));
  const inkBleed = paint(leafW, leafH, (ctx, w, h) => {
    for (let i = 0; i < 36; i++) {
      const x = i % 2 ? rnd() * 61 : w - rnd() * 41;
      const y = 40 + rnd() * (h - 70), r = 6 + rnd() * 29;
      wash(ctx, x, y, r, [[0, "#562f57b0"], [.49, "#5f375570"], [1, "#85415c00"]]);
      ellipse(ctx, x, y, r * .34, r * .52, "#64335476", -.32);
    }
    fiber(ctx, rnd, w, h, 420, "#8c4c6f6c", "#3d2c574b", 11, -6);
  });
  const note = paint(464, 255, (ctx, w, h) => notePaper(ctx, rnd, w, h));
  const noteInk = paint(370, 234, (ctx, w, h) => inkRows(ctx, random(seed + 261), w, h, 16));
  const mapW = [193, 318, 193], mapH = 335;
  const map = mapW.map((w, i) => paint(w, mapH, (ctx, width, height) => mapPanel(ctx, rnd, width, height, i)));
  const chalk = paint(493, 293, (ctx, w, h) => slateMarks(ctx, rnd, w, h));
  const chalkSmear = paint(605, 270, (ctx, w, h) => {
    ctx.save();
    ctx.translate(13, 110);
    ctx.rotate(-.18);
    ctx.scale(1, .32);
    wash(ctx, 262, 225, 249, [[0, "#e9dbaf78"], [.5, "#e4d6a835"], [1, "#e4d6a800"]]);
    wash(ctx, 375, 318, 191, [[0, "#d6e0c741"], [1, "#d6e0c700"]]);
    ctx.restore();
    fiber(ctx, rnd, w, h, 900, "#ead8b136", "#e7e8d12e", 55, -8);
  });
  const sketchArt = SKETCHES.map(({w, h}, i) => ({
    sheet: paint(w, h, (ctx, width, height) => paperskin(ctx, rnd, width, height, ["#e6d2af", "#fbebc7", "#bbb7ba"])),
    drawing: paint(w, h, (ctx, width, height) => pencil(ctx, rnd, width, height, i))
  }));
  const landscape = paint(714, 320, (ctx, w, h) => panorama(ctx, rnd, w, h));
  const bookW = 389, bookH = 399;
  const linen = paint(bookW, bookH, (ctx, w, h) => {
    paperskin(ctx, rnd, w, h, ["#edd8ac", "#f1debb", "#cbb0a9"]);
    ctx.strokeStyle = "#9c716875";
    ctx.strokeRect(20, 23, w - 40, h - 46);
    ctx.strokeRect(23, 26, w - 46, h - 52);
    line(ctx, "M61 260 Q135 241 166 203 L218 223 Q271 191 311 221 M67 271 Q161 262 266 274 M114 283 Q190 278 304 284", "#896979a1", 1.4);
    ellipse(ctx, 224, 162, 2.5, 2.5, "#895765");
    line(ctx, "M224 154 V170 M217 162 H231", "#895765a8", .95);
  });
  // Prime both shared brushes before animation. Their cache belongs to ink.mjs.
  paint(1, 1, ctx => {
    drawInk(ctx, "結", { x: .5, y: .5, size: 1, progress: 1, seed: INK_SEED });
    drawInk(ctx, "時", { x: .5, y: .5, size: 1, progress: 1, seed: INK_SEED });
  }, 1);

  const atmosphere = new THREE.Group();
  const layers = { saver: [35, 6, 3], smooth: [72, 10, 4], ultra: [112, 15, 5] }[tier];
  const dust = kit.particles({
    kind: "dust", seed, count: layers[0], center: [-.62, .14, -5.4], box: [8.3, 5.4, 3.5],
    drift: [.08, .075, -.012], size: .024, color: "#ffe9b6", color2: "#e6dcff", intensity: 2.4,
    opacity: .66, on: "fast", beat: .42, wobble: .14
  });
  const bokeh = kit.particles({
    kind: "bokeh", seed: seed + 7, count: layers[1], center: [-1, .22, -5.7], box: [8.4, 5.6, 3],
    drift: [.045, .032, -.005], size: .19, color: "#ffdfa3", color2: "#c8d3ff", intensity: 1.5,
    opacity: .12, beat: .19, wobble: .11, twinkle: .72
  });
  const mist = kit.haze({
    seed: seed + 13, count: layers[2], center: [-2.8, 1.55, -7.6], box: [3.4, 1.2, .5],
    size: 3.0, additive: true, top: "#ffe9b6", bottom: "#c3b8ee", opacity: .06, drift: [.015, .001, 0]
  });
  atmosphere.add(dust, bokeh, mist);
  scene.add(atmosphere);

  function palmShot(f) {
    g.translate(-6 + f.shot.u * 13, 4 - f.shot.u * 7);
    g.drawImage(palm, 327, 72, 680, 557);
    g.save();
    g.translate(621, 328);
    g.rotate(-.21);
    // Small remnants of each stroke hold for a fraction of a fast beat.
    const u = clamp((f.shot.u - .08) / .88);
    const step = Math.min(1, (Math.floor(u * 11) + ease((u * 11) % 1) * .7) / 11);
    drawInk(g, "結", { x: 0, y: 0, size: 109, progress: 1 - step, alpha: .91 - u * .32 - .07 * f.pulse, color: "#532b45", seed: INK_SEED });
    g.restore();
  }

  function writing(page, width, height, progress) {
    const count = clamp(progress) * 8;
    const whole = Math.floor(count);
    const pixelHeight = page.height / height;
    const row = (height - 75) / 8;
    const y = 34 + whole * row;
    if (whole > 0) g.drawImage(page, 0, 0, page.width, y * pixelHeight, 0, 0, width, y);
    if (count <= whole || whole >= 8) return;
    const partialWidth = ease(count - whole) * width;
    g.drawImage(page, 0, y * pixelHeight, page.width * (partialWidth / width), row * pixelHeight, 0, y, partialWidth, row);
  }

  function journalShot(f) {
    const fast = f.shot.var === "fill";
    const u = f.shot.u;
    const zoom = fast ? 1.08 + .035 * u : 1;
    g.translate(602 - 10 * u, fast ? 116 - 8 * u : 127 - 5 * u);
    g.rotate(-.09 + .018 * (u - .5));
    g.scale(zoom, zoom);
    spread(g, leafW, leafH, "#563c58");
    g.drawImage(notebook, -leafW, 0, leafW, leafH);
    g.drawImage(notebook, 0, 0, leafW, leafH);
    const leaf = ((Math.floor(f.beat) % 3) + 3) % 3;
    const pageProgress = fast ? ease((f.fastPhase - .06) / .7) : ease((f.beatPhase - .08) / .34);
    g.save();
    g.translate(-leafW, 0);
    writing(journalInk[(leaf + 2) % 3], leafW, leafH, fast ? .65 + .35 * u : .92);
    if (fast) {
      g.globalAlpha = .7 * u ** 2;
      g.drawImage(inkBleed, 0, 0, leafW, leafH);
    }
    g.restore();
    const written = fast ? .24 + .65 * u ** 1.8 + .15 * ease(f.fastPhase) : .19 + .68 * u + .12 * ease(f.fastPhase);
    writing(journalInk[leaf], leafW, leafH, written);
    if (fast) {
      g.save();
      g.globalAlpha = clamp((u - .25) * 1.75) ** 1.3;
      g.drawImage(inkBleed, 0, 0, leafW, leafH);
      g.restore();
    }
    hinge(g, leafH);
    turn(g, notebook, leafW, leafH, pageProgress, "#b38ca446");
    if (!fast) {
      fill(g, "M372 257 L407 349 L440 474 L433 487 L421 474 L396 366 Z", "#241e3c6d");
      fill(g, "M385 211 L431 406 L425 425 L416 409 L374 214 Z", "#543c63");
      line(g, "M380 216 L422 405", "#cd9acac1", 2);
      fill(g, "M416 403 L431 400 L434 414 L425 432 L419 417 Z", "#ca9d88");
      fill(g, "M423 427 L425 432 L429 424 Z", "#423047");
    }
  }

  function noteShot(f) {
    const u = f.shot.u;
    g.translate(368 + 7 * u, 224 - 12 * u);
    g.rotate(-.22 + u * .024);
    fill(g, "M-65 81 Q211 110 496 41 L530 236 L51 332 L-48 260 Z", "#22213275");
    fill(g, "M-66 59 L441 -34 L516 226 L9 319 Z", "#754c60");
    fill(g, "M-66 59 L242 178 L441 -34 L245 126 Z", "#ab746d");
    line(g, "M-64 61 L242 178 L440 -33 M9 317 L158 146 M515 225 L334 101", "#e1a38d8f", 1.4);
    g.drawImage(note, 0, 0, 464, 255);
    g.save();
    g.clip(new Path2D(NOTE));
    const drain = ease((u - .06) / .84) + .07 * f.pulse;
    const rowH = 20;
    for (let i = 0; i < 8; i++) {
      const y = 35 + i * rowH;
      const ru = clamp((drain - .052 * (7 - i)) * 1.85);
      g.globalAlpha = 1 - ru ** .6;
      const srcY = noteInk.height * (y / 234), srcH = noteInk.height * (rowH / 234);
      g.drawImage(noteInk, 0, srcY, noteInk.width, srcH, 42 + ru * 37, y + ru * (252 - y), 370, rowH * (1 + ru * 1.15));
      if (ru > 0 && ru < 1) {
        g.globalAlpha = (1 - ru) * .52;
        line(g, `M${144 + i * 29} ${y + 9} q23 ${(247 - y) * ru} 25 ${(255 - y) * ru}`, "#874960", 1 + ru);
      }
    }
    g.restore();
  }

  function mapShot(f) {
    const p = ease((f.shot.u - .04) / .61);
    const right = ease((f.shot.u - .16) / .62);
    g.translate(597 - 15 * f.shot.u, 171 - 4 * f.shot.u);
    g.rotate(-.115 + .025 * f.shot.u);
    const center = mapW[1], leftW = mapW[0] * mix(.20, 1, p), rightW = mapW[2] * mix(.10, 1, right);
    g.fillStyle = "#28283568";
    g.fillRect(-center / 2 - leftW + 14, 19, center + leftW + rightW + 3, mapH + 8);
    g.drawImage(map[1], -center / 2, 0, center, mapH);
    for (const side of [-1, 1]) {
      const fraction = side === -1 ? p : right, width = side === -1 ? leftW : rightW;
      const x = side === -1 ? -center / 2 - width : center / 2;
      g.save();
      g.transform(1, side * (1 - fraction) * .25, 0, 1, x, (1 - fraction) * (side === -1 ? -3 : -width * .25));
      g.drawImage(map[side + 1], 0, 0, width, mapH);
      g.globalAlpha = .48 * (1 - fraction);
      g.fillStyle = side === -1 ? "#875f67" : "#554957";
      g.fillRect(0, 0, width, mapH);
      g.restore();
    }
    for (const x of [-center / 2, center / 2]) {
      line(g, `M${x - 1} 1 V${mapH}`, "#85665f81", 2);
      line(g, `M${x + 1} 1 V${mapH}`, "#fff0bb9d", 1.2);
    }
    line(g, "M-348 151 Q-145 147 0 159 T348 159", "#fff3ba5c", 1.5);
  }

  function chalkShot(f) {
    const write = f.shot.var === "write";
    const u = f.shot.u;
    const rub = write ? 0 : ease((u - .13) / .8);
    const progress = write ? .07 + .51 * ease(u * .79 + f.fastPhase * .21) : 1;
    g.translate(344 + (write ? 12 : -12) * u, 120 - 7 * u);
    g.rotate(-.075);
    g.save();
    g.globalAlpha = write ? .40 : .79 * (1 - rub * .7);
    g.drawImage(chalk, 0, 0, 493, 293);
    g.restore();
    if (rub < .99) {
      g.save();
      g.beginPath();
      g.rect(46 + 287 * rub, -45, 390, 444);
      g.clip();
      drawInk(g, "時", { x: 212, y: 153, size: 252, progress, alpha: .90, color: "#e9e2c1", seed: INK_SEED });
      g.restore();
    }
    g.save();
    g.globalAlpha = write ? .12 : .14 + .65 * rub;
    g.drawImage(chalkSmear, -72 + 136 * rub, 26, 605, 270);
    g.restore();
  }

  function sketchShot(f) {
    const position = mix(118, 1063, ease(f.shot.u));
    g.translate(10 - f.shot.u * 15, 2);
    for (const [i, paper] of SKETCHES.entries()) {
      const { x, y, w, h, tilt } = paper;
      g.save();
      g.translate(x, y);
      g.rotate(tilt);
      fill(g, `M3 8 Q${w * .7} -2 ${w + 4} 4 L${w + 21} ${h + 19} Q${w / 2} ${h + 4} 2 ${h + 28} Z`, "#22283b46");
      g.drawImage(sketchArt[i].sheet, 0, 0, w, h);
      g.globalAlpha = .94 * (1 - ease((position - x + w * .21) / (w * 1.05)));
      g.drawImage(sketchArt[i].drawing, 0, 0, w, h);
      g.globalAlpha = 1;
      fill(g, `M${w * .47} -10 l32 -3 l4 22 l-35 3 Z`, "#c6ae8b8d");
      ellipse(g, w * .56, 6, 5.2, 4.7, "#87646a");
      ellipse(g, w * .56 - 1, 4.3, 2, 1.8, "#fff1c4");
      line(g, `M3 ${h - 3} Q${w * .55} ${h - 9} ${w - 1} ${h - 1}`, "#fff1caa4", 1.4);
      g.restore();
    }
    g.save();
    g.transform(1, 0, .46, 1, position, 0);
    g.fillStyle = gradient(g, -174, 0, 108, 0, [[0, "#ffdf9c00"], [.33, "#ffe4a93e"], [.62, "#fff2bf9c"], [.69, "#fff7d07f"], [1, "#ffe9a900"]]);
    g.fillRect(-174, 0, 282, HEIGHT);
    g.restore();
  }

  function bookShot(f) {
    const u = f.shot.u, p = ease((u - .05) / .66);
    g.translate(600 - 8 * u, 130 - 6 * u);
    g.rotate(-.052 + .025 * u);
    spread(g, bookW, bookH, "#473451");
    g.drawImage(linen, -bookW, 0, bookW, bookH);
    g.drawImage(linen, 0, 0, bookW, bookH);
    g.save();
    g.globalAlpha = .23 + .77 * ease(u * 2.7);
    g.drawImage(landscape, -357, 32, 714, 320);
    g.restore();
    g.strokeStyle = "#fff1cfbb";
    g.lineWidth = 2;
    g.strokeRect(-357, 32, 714, 320);
    hinge(g, bookH);
    if (p === 0) g.drawImage(linen, 0, 0, bookW, bookH);
    turn(g, linen, bookW, bookH, p, "#ac94b058");
  }

  const shots = { palm: palmShot, notebook: journalShot, note: noteShot, map: mapShot, chalk: chalkShot, sketches: sketchShot, book: bookShot };

  return {
    update(f) {
      const name = f.shot.key === "paper" ? f.shot.var : f.shot.key;
      const draw = shots[name];
      if (!draw || f.W < 1 || f.H < 1) return;
      const u = clamp(f.shot.u);
      const scale = Math.min(f.H / HEIGHT, f.W / 900);
      g.drawImage(grounds[name], 0, 0, f.W, f.H);
      g.save();
      g.translate((f.W - WIDTH * scale) / 2, (f.H - HEIGHT * scale) / 2);
      g.scale(scale, scale);
      draw(f);
      g.restore();

      const look = LOOKS[name];
      const spilling = name === "notebook" && f.shot.var === "fill" ? u ** 3 : 0;
      const sweepX = name === "sketches" ? .15 + .75 * ease(u) : look.rayX;
      const rayX = .5 + (sweepX - .5) * WIDTH * scale / f.W;
      const rayY = .5 + (look.rayY - .5) * HEIGHT * scale / f.H;
      kit.look({
        ...look, focus: .53, band: .40, chroma: .22, vignette: .34, threshold: .58,
        rayX, rayY, leakX: rayX, leakY: rayY, leak: .10 + .045 * f.fastPulse + .08 * spilling,
        bloom: look.bloom + .21 * spilling
      });
      camera.position.set(Math.sin(f.t * .34) * .11, .05 + Math.sin(f.t * .21) * .04, .4);
      camera.lookAt(0, 0, -5.2);
      camera.fov = 46;
      kit.tick(f, dust, bokeh, mist);
    },
    setVisible(on) { atmosphere.visible = on; },
    dispose() { scene.remove(atmosphere); }
  };
}
