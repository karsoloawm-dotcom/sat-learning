// Interior finishes, furniture and the bathroom of the Groundskeeper's mansion.
// Everything here is static and gets merged by material in buildMansion, except
// the objects listed in `live` (the bath water, steam and lamp), which animate.
export function furnishInterior(THREE, kit) {
  const {group, box, mesh, mat, maps, window: addWindow, wall, sign, centerZ, solid} = kit;
  const live = new Set();
  let seed = 11;
  const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;

  // ---------- painted canvas textures ----------
  function paint(w, h, draw, repeat = true) {
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    draw(canvas.getContext("2d"), w, h);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    maps.push(texture);
    return texture;
  }
  // Stains drawn in all nine wrap positions so the tile stays seamless.
  function grime(c, s, count, color, min, max) {
    for (let i = 0; i < count; i++) {
      const x = rnd() * s, y = rnd() * s, r = min + rnd() * (max - min);
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g; c.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r);
      }
    }
  }
  function damask(bg, ink, line) {
    return paint(256, 256, (c, s) => {
      c.fillStyle = bg; c.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 32) { c.fillStyle = "rgba(0,0,0,.07)"; c.fillRect(x, 0, 3, s); }
      const motif = (cx, cy, k) => {
        c.save(); c.translate(cx, cy); c.scale(k, k); c.fillStyle = ink;
        for (const d of [-1, 1]) {
          c.beginPath(); c.moveTo(0, -46 * d);
          c.bezierCurveTo(24, -30 * d, 25, -8 * d, 0, 0); c.bezierCurveTo(-25, -8 * d, -24, -30 * d, 0, -46 * d); c.fill();
          c.beginPath(); c.ellipse(26 * d, 0, 17, 7, 0, 0, Math.PI * 2); c.fill();
          c.beginPath(); c.arc(17 * d, -20, 5, 0, Math.PI * 2); c.arc(17 * d, 20, 5, 0, Math.PI * 2); c.fill();
        }
        c.strokeStyle = line; c.lineWidth = 2.2;
        c.beginPath(); c.ellipse(0, 0, 36, 52, 0, 0, Math.PI * 2); c.stroke();
        c.restore();
      };
      motif(64, 64, 1); motif(192, 192, 1); motif(192, 64, .42); motif(64, 192, .42);
      grime(c, s, 10, "rgba(20,10,6,.16)", 18, 60);
    });
  }
  function plaster(base, spots, cracks = 6) {
    return paint(256, 256, (c, s) => {
      c.fillStyle = base; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 900; i++) {
        c.fillStyle = rnd() < .5 ? "rgba(255,250,235,.05)" : "rgba(30,20,15,.06)";
        c.fillRect(rnd() * s, rnd() * s, 2 + rnd() * 5, 2 + rnd() * 5);
      }
      grime(c, s, 9, spots, 20, 70);
      c.strokeStyle = "rgba(35,25,20,.35)"; c.lineWidth = 1;
      for (let i = 0; i < cracks; i++) {
        let x = 20 + rnd() * (s - 40), y = 20 + rnd() * (s - 40);
        c.beginPath(); c.moveTo(x, y);
        for (let j = 0; j < 6; j++) { x += (rnd() - .5) * 26; y += rnd() * 16; c.lineTo(x, y); }
        c.stroke();
      }
    });
  }
  // One raised panel per tile; light from the upper left.
  function panels(wood, dark, light) {
    return paint(256, 256, (c, s) => {
      c.fillStyle = wood; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 60; i++) { c.fillStyle = rnd() < .5 ? "rgba(0,0,0,.06)" : "rgba(255,240,210,.04)"; c.fillRect(0, rnd() * s, s, 1 + rnd() * 2); }
      const m = 34;
      c.fillStyle = dark; c.fillRect(m, m, s - 2 * m, s - 2 * m);
      c.fillStyle = wood; c.fillRect(m + 10, m + 10, s - 2 * m - 20, s - 2 * m - 20);
      c.fillStyle = light; c.fillRect(m, m, s - 2 * m, 4); c.fillRect(m, m, 4, s - 2 * m);
      c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(m, s - m - 4, s - 2 * m, 4); c.fillRect(s - m - 4, m, 4, s - 2 * m);
      c.fillStyle = "rgba(0,0,0,.4)"; c.fillRect(0, 0, 3, s); c.fillRect(0, 0, s, 3);
    });
  }
  function tiles(n, grout, faces, decorate) {
    return paint(256, 256, (c, s) => {
      c.fillStyle = grout; c.fillRect(0, 0, s, s);
      const t = s / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        c.fillStyle = faces[(i + j * 3 + Math.floor(rnd() * 2)) % faces.length];
        c.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
        if (decorate) decorate(c, i * t + t / 2, j * t + t / 2, t);
      }
      grime(c, s, 5, "rgba(40,30,20,.12)", 20, 50);
    });
  }
  const subway = paint(256, 256, (c, s) => {
    c.fillStyle = "#9b9e94"; c.fillRect(0, 0, s, s);
    for (let row = 0; row < 8; row++) for (let col = -1; col < 4; col++) {
      const x = col * 64 + (row % 2) * 32, y = row * 32;
      c.fillStyle = ["#e7e6dc", "#dfe0d6", "#e9e4d7"][(row + col + 3) % 3];
      c.fillRect(x + 2, y + 2, 60, 28);
      c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(x + 4, y + 4, 54, 3);
    }
    grime(c, s, 6, "rgba(90,85,50,.16)", 14, 46);
  });
  const herringbone = paint(256, 256, (c, s) => {
    c.fillStyle = "#3b2619"; c.fillRect(0, 0, s, s);
    const tones = ["#6b4a33", "#5e3f2b", "#77543a", "#654430"];
    c.save(); c.translate(s / 2, s / 2); c.rotate(Math.PI / 4); c.translate(-s, -s);
    for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) {
      c.fillStyle = tones[(i * 7 + j * 3) % 4];
      if ((i + j) % 2) c.fillRect(i * 16 + 1, j * 16 + 1, 30, 14); else c.fillRect(i * 16 + 1, j * 16 + 1, 14, 30);
    }
    c.restore();
    grime(c, s, 6, "rgba(10,5,0,.18)", 20, 60);
  });
  const checker = paint(256, 256, (c, s) => {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      c.fillStyle = (i + j) % 2 ? "#1e1c1f" : "#d6cfbf"; c.fillRect(i * 128, j * 128, 128, 128);
      c.strokeStyle = "rgba(0,0,0,.25)"; c.strokeRect(i * 128 + 1, j * 128 + 1, 126, 126);
    }
    grime(c, s, 8, "rgba(60,45,30,.16)", 20, 60);
  });
  const mosaic = paint(256, 256, (c, s) => {
    c.fillStyle = "#8f8b84"; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      const flower = [[7, 7], [8, 7], [7, 8], [8, 8], [6, 7], [9, 8], [7, 6], [8, 9]].some(([a, b]) => (i % 16 === a && j % 16 === b));
      c.fillStyle = flower ? "#2a2f33" : (i + j) % 5 ? "#ece9e1" : "#e0ddd3";
      c.beginPath(); c.arc(i * 16 + 8, j * 16 + 8, 7, 0, Math.PI * 2); c.fill();
    }
  });
  const flags = paint(256, 256, (c, s) => {
    c.fillStyle = "#2b2830"; c.fillRect(0, 0, s, s);
    const rows = [[0, 90, [0, 110, 200]], [90, 80, [40, 150, 230]], [170, 86, [0, 70, 180]]];
    for (const [y, h, cuts] of rows) for (let k = 0; k < cuts.length; k++) {
      const x0 = cuts[k], x1 = k + 1 < cuts.length ? cuts[k + 1] : cuts[0] + s;
      const v = 82 + Math.floor(rnd() * 26);
      c.fillStyle = `rgb(${v},${v - 4},${v + 6})`;
      c.fillRect(x0 + 3, y + 3, x1 - x0 - 6, h - 6);
      if (x1 > s) c.fillRect(x0 + 3 - s, y + 3, x1 - x0 - 6, h - 6);
    }
    grime(c, s, 12, "rgba(10,10,15,.25)", 15, 45);
  });
  const blocks = paint(256, 256, (c, s) => {
    c.fillStyle = "#3a3540"; c.fillRect(0, 0, s, s);
    for (let row = 0; row < 4; row++) for (let col = -1; col < 3; col++) {
      const x = col * 128 + (row % 2) * 64, y = row * 64, v = 92 + Math.floor(rnd() * 24);
      c.fillStyle = `rgb(${v},${v - 6},${v - 2})`; c.fillRect(x + 3, y + 3, 122, 58);
      c.fillStyle = "rgba(255,255,255,.08)"; c.fillRect(x + 3, y + 3, 122, 4);
    }
    grime(c, s, 10, "rgba(20,15,10,.25)", 15, 50);
  });
  const ceiling = plaster("#8f8676", "rgba(70,55,35,.20)", 4);
  const whitewash = plaster("#b2aa98", "rgba(80,65,40,.22)", 8);
  const tan = plaster("#8c7357", "rgba(50,35,20,.25)", 5);
  const grey = plaster("#6f6a68", "rgba(30,25,25,.25)", 7);
  const green = damask("#26372d", "#3b5140", "#6b7a52");
  const crimson = damask("#4b1a20", "#682a2d", "#a17b4e");
  const olive = damask("#3e3c26", "#55532f", "#8b7d4b");
  const bathPaper = paint(256, 256, (c, s) => {
    c.fillStyle = "#a9b39c"; c.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 64) { c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(x + 28, 0, 8, s); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * 64 + (j % 2) * 32 + 10, y = j * 64 + 20;
      c.fillStyle = "#7d8a73"; c.beginPath(); c.ellipse(x, y + 12, 3, 12, .3, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#b9786f";
      for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + 6 * Math.cos(k * 1.26), y + 6 * Math.sin(k * 1.26), 4, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = "#e8d38e"; c.beginPath(); c.arc(x, y, 2.5, 0, Math.PI * 2); c.fill();
    }
    grime(c, s, 8, "rgba(80,90,40,.18)", 20, 60);
  });
  const smallCheck = paint(256, 256, (c, s) => {
    c.fillStyle = "#bfae8b"; c.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 32) { c.fillStyle = "rgba(120,60,40,.18)"; c.fillRect(x, 0, 6, s); c.fillRect(0, x, s, 6); }
    grime(c, s, 8, "rgba(80,50,20,.2)", 20, 60);
  });
  const delft = tiles(4, "#cfcab9", ["#eae6d8", "#e3e0d2"], (c, x, y, t) => {
    c.strokeStyle = "#3e5f99"; c.lineWidth = 2;
    c.beginPath(); c.arc(x, y, t * .22, 0, Math.PI * 2); c.stroke();
    for (const a of [0, 1.57, 3.14, 4.71]) { c.beginPath(); c.moveTo(x + Math.cos(a) * t * .3, y + Math.sin(a) * t * .3); c.lineTo(x + Math.cos(a) * t * .45, y + Math.sin(a) * t * .45); c.stroke(); }
  });
  const oakPanel = panels("#4d3426", "#2a1b14", "#73513a");
  const darkPanel = panels("#2f1f19", "#160d0a", "#4c3326");
  function rugTexture(w, h, field, border, ink) {
    return paint(w, h, (c) => {
      c.fillStyle = border; c.fillRect(0, 0, w, h);
      c.fillStyle = ink; c.fillRect(12, 12, w - 24, h - 24);
      c.fillStyle = field; c.fillRect(30, 30, w - 60, h - 60);
      c.strokeStyle = ink; c.lineWidth = 3;
      for (let x = 36; x < w - 36; x += 18) { c.beginPath(); c.moveTo(x, 18); c.lineTo(x + 9, 26); c.lineTo(x + 18, 18); c.stroke(); c.beginPath(); c.moveTo(x, h - 18); c.lineTo(x + 9, h - 26); c.lineTo(x + 18, h - 18); c.stroke(); }
      const cx = w / 2, cy = h / 2;
      c.fillStyle = border; c.beginPath(); c.moveTo(cx, cy - h * .3); c.lineTo(cx + w * .22, cy); c.lineTo(cx, cy + h * .3); c.lineTo(cx - w * .22, cy); c.closePath(); c.fill();
      c.fillStyle = ink; c.beginPath(); c.moveTo(cx, cy - h * .18); c.lineTo(cx + w * .12, cy); c.lineTo(cx, cy + h * .18); c.lineTo(cx - w * .12, cy); c.closePath(); c.fill();
      for (let i = 0; i < 40; i++) { c.fillStyle = rnd() < .5 ? border : ink; c.fillRect(40 + rnd() * (w - 80), 40 + rnd() * (h - 80), 5, 5); }
      for (let i = 0; i < 12; i++) { const g = c.createRadialGradient(rnd() * w, rnd() * h, 0, rnd() * w, rnd() * h, 60); g.addColorStop(0, "rgba(0,0,0,.18)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h); }
    }, false);
  }
  const runnerTexture = paint(128, 256, (c, w, h) => {
    c.fillStyle = "#4a1d1f"; c.fillRect(0, 0, w, h);
    c.fillStyle = "#c19a5e"; c.fillRect(8, 0, 6, h); c.fillRect(w - 14, 0, 6, h);
    c.fillStyle = "#2c1a2e"; c.fillRect(18, 0, w - 36, h);
    c.fillStyle = "#8b2f30";
    for (let y = 0; y < h; y += 64) { c.beginPath(); c.moveTo(w / 2, y + 6); c.lineTo(w - 26, y + 32); c.lineTo(w / 2, y + 58); c.lineTo(26, y + 32); c.closePath(); c.fill(); }
    c.fillStyle = "#c19a5e"; for (let y = 0; y < h; y += 64) c.fillRect(w / 2 - 4, y + 28, 8, 8);
  });
  function portraitTexture(sky, skin, hair, coat, scratched) {
    return paint(128, 160, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h * .4, 10, w / 2, h * .45, 110);
      g.addColorStop(0, sky); g.addColorStop(1, "#0c0a0d"); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = coat; c.beginPath(); c.ellipse(w / 2, h + 10, 58, 62, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = skin; c.fillRect(w / 2 - 9, 92, 18, 22);
      c.fillStyle = hair; c.beginPath(); c.ellipse(w / 2, 70, 30, 38, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = skin; c.beginPath(); c.ellipse(w / 2, 76, 22, 29, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = hair; c.beginPath(); c.ellipse(w / 2, 52, 25, 12, 0, Math.PI, Math.PI * 2); c.fill();
      if (scratched) {
        c.strokeStyle = "#e9e1d4"; c.lineWidth = 3;
        for (const x of [w / 2 - 9, w / 2 + 9]) for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x - 7 + k * 3, 66); c.lineTo(x - 3 + k * 3, 82); c.stroke(); }
      } else {
        c.fillStyle = "#1a1210"; for (const x of [w / 2 - 9, w / 2 + 9]) { c.beginPath(); c.ellipse(x, 74, 3.2, 2.2, 0, 0, Math.PI * 2); c.fill(); }
      }
      c.fillStyle = "rgba(90,30,30,.55)"; c.fillRect(w / 2 - 6, 91, 12, 2);
      c.strokeStyle = "rgba(0,0,0,.25)"; for (let i = 0; i < 30; i++) { c.beginPath(); const x = rnd() * w, y = rnd() * h; c.moveTo(x, y); c.lineTo(x + 6, y + 3); c.stroke(); }
    }, false);
  }
  const landscapeTexture = paint(192, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#151d36"); g.addColorStop(.6, "#3a4560"); g.addColorStop(1, "#1d2219");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = "#f1e7c8"; c.beginPath(); c.arc(140, 30, 13, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#1b2418"; c.beginPath(); c.moveTo(0, 90); c.quadraticCurveTo(60, 62, 120, 84); c.quadraticCurveTo(160, 96, w, 78); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    c.fillStyle = "#0d110c"; for (const x of [30, 52, 75, 96]) { c.fillRect(x, 82, 3, 16); c.fillRect(x - 5, 87, 13, 3); }
    c.fillStyle = "#2b2a33"; c.fillRect(150, 58, 22, 30); c.beginPath(); c.moveTo(146, 58); c.lineTo(161, 44); c.lineTo(176, 58); c.fill();
    c.fillStyle = "#e0a85a"; c.fillRect(158, 68, 5, 6);
  }, false);
  const clockTexture = paint(128, 128, (c, w) => {
    c.fillStyle = "#e9dfc6"; c.beginPath(); c.arc(64, 64, 60, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#2b211b"; c.lineWidth = 3; c.beginPath(); c.arc(64, 64, 58, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.lineWidth = i % 3 ? 2 : 5; c.beginPath(); c.moveTo(64 + Math.sin(a) * 46, 64 - Math.cos(a) * 46); c.lineTo(64 + Math.sin(a) * 54, 64 - Math.cos(a) * 54); c.stroke(); }
    c.lineWidth = 4; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + 26 * Math.sin(-2.6), 64 - 26 * Math.cos(-2.6)); c.stroke();
    c.lineWidth = 2.5; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + 40 * Math.sin(3.05), 64 - 40 * Math.cos(3.05)); c.stroke();
  }, false);
  const hideTexture = paint(128, 128, (c, w) => {
    c.clearRect(0, 0, w, w);
    c.fillStyle = "#8a5a37"; c.beginPath();
    const pts = [[64, 6], [86, 18], [118, 10], [108, 44], [122, 70], [104, 96], [116, 122], [80, 112], [64, 124], [48, 112], [12, 122], [24, 96], [6, 70], [20, 44], [10, 10], [42, 18]];
    c.moveTo(...pts[0]); for (const p of pts.slice(1)) c.lineTo(...p); c.closePath(); c.fill();
    for (let i = 0; i < 80; i++) { c.fillStyle = rnd() < .5 ? "rgba(60,30,15,.25)" : "rgba(200,150,100,.15)"; c.fillRect(20 + rnd() * 88, 20 + rnd() * 88, 3, 3); }
  }, false);

  // ---------- materials ----------
  const lam = (color, options = {}) => new THREE.MeshLambertMaterial({color, side: THREE.DoubleSide, ...options});
  const M = {
    oak: mat(0x4a3326), walnut: mat(0x34241c), mahogany: mat(0x4a2220), cream: mat(0xd8cdb4), white: mat(0xe2ddd0),
    brass: mat(0xb08a52, null, 0x1a1006), iron: mat(0x23212a), copper: mat(0xa4613d), plate: mat(0xd9d3c3),
    flame: mat(0xffd8a0, null, 0xffa040), wax: mat(0xe8dcc4), glassDark: mat(0x1f2933, null, 0x080b10),
    mirror: mat(0x58646b, null, 0x111820), porcelain: mat(0xe9e4d8), towel: mat(0xb8b0a1), curtain: mat(0x56614f),
    bone: mat(0xd5c7aa), leather: mat(0x5b2f22), straw: mat(0x9c8152), cloth: mat(0x3e3348), bottleGreen: mat(0x2f4a33, null, 0x05100a),
    plaster: mat(0xffffff, ceiling), hide: lam(0xffffff, {map: hideTexture, alphaTest: .5}),
    clockFace: mat(0xffffff, clockTexture), landscape: mat(0xffffff, landscapeTexture),
    runner: mat(0xffffff, runnerTexture)
  };
  const paintings = [
    portraitTexture("#4a3b32", "#d8bfa4", "#2a1c18", "#1e1a24", false),
    portraitTexture("#3b4250", "#e1cdb8", "#5b3b2a", "#3a2027", true),
    portraitTexture("#45402c", "#cdb497", "#bdb7a6", "#24261d", false)
  ].map(map => mat(0xffffff, map));
  const finishes = {
    hall:    {paper: mat(0xffffff, green), tile: .8, low: mat(0xffffff, oakPanel), lowU: .9, lowH: 1.0, rail: M.oak, crown: M.oak},
    broom:   {paper: mat(0xffffff, whitewash), tile: 2, crown: null, posts: true},
    kitchen: {paper: mat(0xffffff, smallCheck), tile: .5, low: mat(0xffffff, delft), lowU: .6, lowV: .6, lowH: 1.25, rail: M.cream, crown: M.cream},
    leather: {paper: mat(0xffffff, tan), tile: 2, low: mat(0xffffff, oakPanel), lowU: .9, lowH: .95, rail: M.oak, crown: M.oak},
    passage: {paper: mat(0xffffff, crimson), tile: .8, low: mat(0xffffff, oakPanel), lowU: .9, lowH: 1.2, rail: M.oak, crown: M.oak, picture: 3.4},
    gallows: {paper: mat(0xffffff, grey), tile: 2, low: mat(0xffffff, blocks), lowU: 1.2, lowV: 1.2, lowH: 2.6, rail: M.iron, crown: null},
    trophy:  {paper: mat(0xffffff, olive), tile: .8, low: mat(0xffffff, darkPanel), lowU: .9, lowV: 1.2, lowH: 2.4, rail: M.oak, crown: M.oak},
    bath:    {paper: mat(0xffffff, bathPaper), tile: .5, low: mat(0xffffff, subway), lowU: .6, lowV: .6, lowH: 1.35, rail: M.white, crown: M.white}
  };

  // ---------- geometry helpers ----------
  // A box whose texture is tiled in metres, continuing across neighbouring boxes.
  function slab(w, h, d, material, x, y, z, tu, tv = tu, u0 = 0, v0 = 0) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    const size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * size[f][0] + u0) / tu, (uv.getY(k) * size[f][1] + v0) / tv);
    }
    return mesh(g, material, x, y, z);
  }
  // Lining strip on a wall face. axis "z": face at z=c along x; "x": face at x=c along z.
  function strip(axis, c, n, s0, s1, y0, y1, depth, material, tu, tv) {
    const len = s1 - s0, mid = (s0 + s1) / 2, off = c + n * (depth / 2 + .003);
    return axis === "z"
      ? slab(len, y1 - y0, depth, material, mid, (y0 + y1) / 2, off, tu, tv, s0, y0 - FLOOR)
      : slab(depth, y1 - y0, len, material, off, (y0 + y1) / 2, mid, tu, tv, s0, y0 - FLOOR);
  }
  const FLOOR = .13;
  function face(axis, c, n, a0, a1, h, f, openings = []) {
    const gaps = openings.slice().sort((p, q) => p[0] - q[0]);
    const spans = [];
    let cursor = a0;
    for (const [o0, o1, top] of gaps) {
      if (o0 > cursor) spans.push([cursor, o0, FLOOR]);
      spans.push([Math.max(o0, a0), Math.min(o1, a1), top]);
      cursor = Math.max(cursor, o1);
    }
    if (cursor < a1) spans.push([cursor, a1, FLOOR]);
    for (const [s0, s1, from] of spans) {
      if (from >= h - .01 || s1 - s0 < .01) continue;
      const lowTop = f.low ? f.lowH : FLOOR;
      if (f.low && from < lowTop) strip(axis, c, n, s0, s1, from, lowTop, .035, f.low, f.lowU, f.lowV ?? lowTop - FLOOR);
      strip(axis, c, n, s0, s1, Math.max(from, lowTop), h, .03, f.paper, f.tile, f.tile);
      if (f.low && f.rail && from < lowTop) strip(axis, c, n, s0, s1, lowTop - .03, lowTop + .03, .06, f.rail, 1, 1);
      if (from <= FLOOR + .001) strip(axis, c, n, s0, s1, FLOOR, FLOOR + .17, .05, M.walnut, 1, 1);
      if (f.crown) {
        strip(axis, c, n, s0, s1, h - .12, h, .085, f.crown, 1, 1);
        strip(axis, c, n, s0, s1, h - .19, h - .12, .05, f.crown, 1, 1);
      }
      if (f.picture && from < f.picture) strip(axis, c, n, s0, s1, f.picture - .02, f.picture + .02, .045, f.rail, 1, 1);
      if (f.posts) {
        for (let s = s0 + .4; s < s1 - .2; s += 1.6) strip(axis, c, n, s - .07, s + .07, Math.max(from, FLOOR), h, .07, M.oak, 1, 1);
        if (from < 1.0) strip(axis, c, n, s0, s1, .96, 1.06, .065, M.oak, 1, 1);
        strip(axis, c, n, s0, s1, h - .16, h, .075, M.oak, 1, 1);
      }
    }
  }
  function floor(x0, x1, z0, z1, material, tile, tv = tile, y = .134) {
    slab(x1 - x0, .008, z1 - z0, material, (x0 + x1) / 2, y, (z0 + z1) / 2, tile, tv, x0, z0).receiveShadow = true;
  }
  function ceil(x0, x1, z0, z1, y) {
    slab(x1 - x0, .01, z1 - z0, M.plaster, (x0 + x1) / 2, y, (z0 + z1) / 2, 2, 2, x0, z0);
  }
  function cyl(r0, r1, h, material, x, y, z, seg = 10) {
    return mesh(new THREE.CylinderGeometry(r0, r1, h, seg), material, x, y, z);
  }
  function sphere(r, material, x, y, z, sx = 1, sy = 1, sz = 1) {
    const o = mesh(new THREE.SphereGeometry(r, 10, 8), material, x, y, z);
    o.scale.set(sx, sy, sz); return o;
  }
  // Furniture frame: lx/lz are local to an object turned by rot (multiples of pi/2).
  function place(ox, oz, rot = 0) {
    const c = Math.round(Math.cos(rot)), s = Math.round(Math.sin(rot)), turned = s !== 0;
    const at = (lx, lz) => [ox + lx * c + lz * s, oz - lx * s + lz * c];
    return {
      at,
      b(lx, y, lz, w, h, d, material, solid = false) {
        const [x, z] = at(lx, lz);
        return box(turned ? d : w, h, turned ? w : d, material, x, y, z, solid);
      },
      c(lx, y, lz, r0, r1, h, material, seg) { const [x, z] = at(lx, lz); return cyl(r0, r1, h, material, x, y, z, seg); },
      s(lx, y, lz, r, material, sx, sy, sz) { const [x, z] = at(lx, lz); return turned ? sphere(r, material, x, y, z, sz, sy, sx) : sphere(r, material, x, y, z, sx, sy, sz); },
      xyz(lx, y, lz) { const [x, z] = at(lx, lz); return [x, y, z]; },
      p(lx, y, lz, w, h, material, extra = 0) { // a picture plane facing local +z
        const [x, z] = at(lx, lz);
        const o = mesh(new THREE.PlaneGeometry(w, h), material, x, y, z);
        o.rotation.y = rot + extra; return o;
      }
    };
  }
  // A framed picture hanging on a wall face, facing into the room.
  function picture(axis, c, n, along, y, w, h, material) {
    const rot = axis === "z" ? (n > 0 ? 0 : Math.PI) : (n > 0 ? Math.PI / 2 : -Math.PI / 2);
    const [x, z] = axis === "z" ? [along, c] : [c, along];
    const f = place(x, z, rot);
    f.b(0, y, .045, w + .16, h + .16, .05, M.brass);
    f.b(0, y, .06, w + .06, h + .06, .04, M.walnut);
    f.p(0, y, .084, w, h, material);
    f.b(0, y + h / 2 + .2, .02, .012, .4, .012, M.iron);
  }
  function sconce(axis, c, n, along, y) {
    const rot = axis === "z" ? (n > 0 ? 0 : Math.PI) : (n > 0 ? Math.PI / 2 : -Math.PI / 2);
    const [x, z] = axis === "z" ? [along, c] : [c, along];
    const f = place(x, z, rot);
    f.b(0, y, .05, .12, .22, .03, M.brass);
    f.b(0, y - .04, .14, .03, .03, .18, M.brass);
    f.c(0, y + .02, .22, .05, .035, .03, M.brass);
    f.c(0, y + .1, .22, .018, .018, .14, M.wax, 6);
    f.s(0, y + .2, .22, .018, M.flame, 1, 1.8, 1);
  }
  function candle(x, y, z, h = .12) {
    cyl(.02, .022, h, M.wax, x, y + h / 2, z, 6);
    sphere(.014, M.flame, x, y + h + .018, z, 1, 1.9, 1);
  }

  // ---------- wall linings ----------
  const H = 3.39, HA = 6.74;
  const F = finishes;
  face("z", 6.375, -1, -4.71, 4.71, H, F.hall, [[-2.0, 2.0, 2.37]]);
  face("z", -2.55, 1, -4.71, 4.71, H, F.hall, [[-2.04, 2.04, 2.53]]);
  face("x", -4.71, 1, -2.55, 6.375, H, F.hall, [[-.77, 2.23, 2.5]]);
  face("x", 4.71, -1, -2.55, 6.375, H, F.hall, [[-.77, 2.23, 2.5]]);
  face("z", 6.375, -1, -11.87, -4.89, H, F.broom);
  face("z", -2.55, 1, -11.87, -4.89, H, F.broom);
  face("x", -11.87, 1, -2.55, 6.375, H, F.broom);
  face("x", -4.89, -1, -2.55, 6.375, H, F.broom, [[-.77, 2.23, 2.5]]);
  face("z", 6.375, -1, 4.89, 11.87, H, F.kitchen);
  face("z", -2.55, 1, 4.89, 11.87, H, F.kitchen);
  face("x", 4.89, 1, -2.55, 6.375, H, F.kitchen, [[-.77, 2.23, 2.5]]);
  face("x", 11.87, -1, -2.55, 6.375, H, F.kitchen, [[2.55, 4.44, 2.36]]);
  face("z", -2.75, -1, -11.87, 11.87, H, F.leather, [[-2.04, 2.04, 2.53]]);
  face("z", -6.37, 1, -11.87, 11.87, H, F.leather, [[-2.0, 2.0, 2.4]]);
  face("x", -11.87, 1, -6.37, -2.75, H, F.leather);
  face("x", 11.87, -1, -6.37, -2.75, H, F.leather);
  const door = [-12.77, -9.39, 2.85], hatch = [-16.6, -15.33, .8];
  face("x", -2.02, 1, -26.31, -6.63, HA, F.passage, [door]);
  face("x", 2.02, -1, -26.31, -6.63, HA, F.passage, [door, hatch]);
  face("z", -6.63, -1, -2.02, 2.02, HA, F.passage, [[-2.0, 2.0, 2.4]]);
  face("z", -26.31, 1, -2.02, 2.02, HA, F.passage);
  face("x", -11.86, 1, -26.31, -6.63, HA, F.gallows);
  face("x", -2.22, -1, -26.31, -6.63, HA, F.gallows, [door]);
  face("z", -6.63, -1, -11.86, -2.22, HA, F.gallows);
  face("z", -26.31, 1, -11.86, -2.22, HA, F.gallows);
  face("x", 2.22, 1, -26.31, -6.63, HA, F.trophy, [door, hatch]);
  face("x", 11.86, -1, -26.31, -11.29, HA, F.trophy);
  face("z", -6.63, -1, 2.22, 5.31, HA, F.trophy);
  face("z", -26.31, 1, 2.22, 11.86, HA, F.trophy);

  // ---------- floors and ceilings ----------
  floor(-4.71, 4.71, -2.55, 6.375, mat(0xffffff, herringbone), .8);
  floor(4.89, 11.87, -2.55, 6.375, mat(0xffffff, checker), .8);
  floor(-2.02, 2.02, -21.1, -6.63, mat(0x9a8a80, herringbone), .8);
  floor(-11.86, -2.22, -26.31, -6.63, mat(0xffffff, flags), 2);
  floor(2.22, 11.86, -26.31, -11.29, mat(0x9a8a80, herringbone), .8);
  floor(2.22, 5.31, -11.29, -6.63, mat(0x9a8a80, herringbone), .8);
  for (const [x0, x1, z0, z1] of [[-4.71, 4.71, -2.55, 6.375], [-11.87, -4.89, -2.55, 6.375], [4.89, 11.87, -2.55, 6.375], [-11.87, 11.87, -6.37, -2.75]])
    ceil(x0, x1, z0, z1, 3.388);
  // Hall coffers, broom-room joists and the annex roof trusses.
  for (const x of [-2.36, 2.36]) box(.16, .16, 8.9, M.walnut, x, 3.3, 1.91);
  for (const z of [-.05, 4.35]) box(9.4, .16, .16, M.walnut, 0, 3.3, z);
  for (let x = -11.2; x <= -5.4; x += 1.45) box(.14, .18, 8.9, M.oak, x, 3.29, 1.91);
  for (let x = -10.5; x <= 10.5; x += 3) box(.14, .16, 3.6, M.oak, x, 3.3, -4.56);
  for (const [x0, x1] of [[-11.86, -2.22], [2.22, 11.86]]) for (let z = -8.6; z > -26; z -= 3.6) {
    const mid = (x0 + x1) / 2, w = x1 - x0;
    box(w, .24, .22, M.oak, mid, 6.45, z);
    box(.18, .5, .18, M.oak, mid, 6.62, z);
    kit.beam(x0 + .1, 5.6, z, x0 + 1.1, 6.38, z, .14, M.oak);
    kit.beam(x1 - .1, 5.6, z, x1 - 1.1, 6.38, z, .14, M.oak);
  }

  // ---------- entrance hall ----------
  { // chandelier over the runner; the light itself stays where it always was
    const y = 3.05, z = 2.7;
    cyl(.012, .012, .32, M.iron, 0, 3.23, z, 5);
    mesh(new THREE.TorusGeometry(.42, .022, 6, 24), M.brass, 0, y, z).rotation.x = Math.PI / 2;
    mesh(new THREE.TorusGeometry(.2, .018, 6, 16), M.brass, 0, y + .14, z).rotation.x = Math.PI / 2;
    sphere(.07, M.brass, 0, y - .06, z, 1, 1.4, 1);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, x = Math.cos(a) * .42, zz = z + Math.sin(a) * .42;
      cyl(.03, .02, .03, M.brass, x, y + .02, zz, 6);
      candle(x, y + .03, zz, .1);
      kit.beam(0, y + .14, z, x, y + .02, zz, .012, M.brass);
    }
    ceil(-.25, .25, z - .25, z + .25, 3.38);
  }
  { // grandfather clock beside the broom-room door
    const f = place(-4.42, 4.75, Math.PI / 2);
    f.b(0, 1.05, 0, .52, 1.84, .34, M.mahogany, true);
    f.b(0, 2.12, 0, .6, .32, .4, M.mahogany);
    f.b(0, 2.33, 0, .66, .08, .44, M.walnut);
    f.b(0, .2, 0, .6, .14, .42, M.walnut);
    f.p(0, 2.1, .205, .3, .3, M.clockFace);
    f.b(0, 1.2, .175, .26, .9, .01, M.glassDark);
    f.c(0, .98, .19, .06, .06, .012, M.brass, 14).rotation.x = Math.PI / 2;
    f.b(0, 1.3, .19, .012, .6, .008, M.brass);
    for (const s of [-1, 1]) f.c(s * .2, 2.48, 0, .025, .025, .14, M.brass, 6);
  }
  { // console table, mirror and dead flowers on the kitchen side
    const f = place(4.45, 4.25, -Math.PI / 2);
    f.b(0, .8, 0, 1.3, .06, .4, M.walnut, true);
    for (const s of [-1, 1]) f.b(s * .58, .4, 0, .06, .78, .32, M.walnut);
    f.b(0, .25, 0, 1.2, .04, .34, M.walnut);
    f.b(0, 1.62, -.2, .8, 1.05, .04, M.brass);
    f.b(0, 1.62, -.17, .7, .95, .02, M.mirror);
    f.c(-.36, .95, 0, .07, .05, .24, M.bottleGreen, 8);
    for (let i = 0; i < 5; i++) {
      const [x, z] = f.at(-.36 + (i - 2) * .025, 0);
      kit.beam(x, 1.05, z, x + (i - 2) * .05, 1.38 + (i % 2) * .08, z + .03, .01, M.straw);
      sphere(.025, M.leather, x + (i - 2) * .05, 1.4 + (i % 2) * .08, z + .03);
    }
    candle(...f.xyz(.35, .83, .05), .16);
    f.b(.1, .86, .02, .2, .05, .14, M.leather);
  }
  { // settee by the broom door and a coat stand by the entrance
    const f = place(-4.4, 3.22, Math.PI / 2);
    f.b(0, .45, 0, 1.2, .1, .46, M.cloth, true);
    f.b(0, .78, -.2, 1.2, .56, .08, M.cloth);
    for (const s of [-1, 1]) { f.b(s * .58, .58, 0, .06, .36, .46, M.walnut); f.b(s * .55, .2, .16, .05, .3, .05, M.walnut); f.b(s * .55, .2, -.16, .05, .3, .05, M.walnut); }
    cyl(.03, .035, 1.8, M.walnut, -3.2, 1.03, 5.85, 6);
    cyl(.2, .24, .05, M.walnut, -3.2, .16, 5.85, 8);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; kit.beam(-3.2, 1.75, 5.85, -3.2 + Math.cos(a) * .16, 1.85, 5.85 + Math.sin(a) * .16, .02, M.brass); }
    box(.42, .9, .12, M.cloth, -3.2, 1.36, 5.98).rotation.y = .2;
    cyl(.12, .1, .55, M.copper, 3.55, .41, 5.95, 10);
    for (const dx of [-.04, .05]) { const x = 3.55 + dx; kit.beam(x, .5, 5.95, x + dx, 1.0, 5.93, .02, M.iron); }
  }
  picture("z", -2.55, 1, -3.35, 1.95, .6, .76, paintings[0]);
  picture("z", -2.55, 1, 3.35, 1.95, .6, .76, paintings[2]);
  picture("x", 4.71, -1, -1.6, 1.9, .5, .62, paintings[1]);
  for (const x of [-2.55, 2.55]) sconce("z", 6.375, -1, x, 1.95);
  for (const z of [3.3, 5.6]) sconce("x", -4.71, 1, z, 2.0);

  // ---------- broom workshop ----------
  box(.62, .1, 1.95, M.oak, -11.4, 1.66, 2.5);
  box(.62, 1.76, 1.9, kit.brick, -11.56, 2.5, 2.5);
  for (const z of [2.1, 2.9]) candle(-11.3, 1.71, z, .14);
  box(.9, 1.95, .34, M.oak, -8.3, 1.1, 6.18, true);
  for (const y of [.5, 1.0, 1.5, 2.0]) box(.92, .04, .36, M.walnut, -8.3, y, 6.18);
  for (let i = 0; i < 8; i++) {
    const x = -8.62 + (i % 4) * .2, y = (i < 4 ? .62 : 1.12);
    cyl(.06, .07, .2, i % 3 ? M.plate : M.bottleGreen, x, y, 6.15, 8);
  }
  for (let i = 0; i < 7; i++) { // dried herb bundles under the joists
    const x = -10.65 + i * .55, z = 4.0 + (i % 2) * .5;
    cyl(.004, .004, .3, M.straw, x, 3.24, z, 4);
    mesh(new THREE.ConeGeometry(.08, .35, 6), mat(0x5b6541), x, 2.92, z).rotation.x = Math.PI;
  }
  for (let i = 0; i < 3; i++) cyl(.17, .14, .3, M.straw, -6.0 + i * .42, .28, 5.95, 10);
  { // braided rug and a stool by the work table
    const r = mesh(new THREE.CircleGeometry(1, 28), mat(0x6a4a3a), -8.4, .142, 2.1);
    r.rotation.x = -Math.PI / 2; r.scale.set(1.25, .85, 1);
    const r2 = mesh(new THREE.RingGeometry(.7, .82, 28), mat(0x3f3a52), -8.4, .1435, 2.1);
    r2.rotation.x = -Math.PI / 2; r2.scale.set(1.25, .85, 1);
    cyl(.17, .17, .05, M.oak, -9.0, .6, .95, 10);
    for (let i = 0; i < 3; i++) { const a = i * 2.09; kit.beam(-9.0 + Math.cos(a) * .12, .58, .95 + Math.sin(a) * .12, -9.0 + Math.cos(a) * .2, .14, .95 + Math.sin(a) * .2, .03, M.oak); }
  }

  // ---------- kitchen ----------
  { // iron range with stovepipe
    const f = place(6.1, -2.18);
    f.b(0, .55, 0, 1.3, .84, .68, M.iron, true);
    f.b(0, .99, 0, 1.36, .05, .72, M.iron);
    for (const s of [-1, 1]) {
      f.b(s * .32, .52, .345, .5, .42, .02, mat(0x2e2b33));
      f.b(s * .32, .62, .37, .26, .025, .03, M.brass);
    }
    for (const [x, z] of [[-.35, -.1], [.3, -.1], [-.05, .15]]) f.c(x, 1.025, z, .15, .15, .02, mat(0x16151a), 14);
    f.c(.5, 2.2, -.2, .075, .075, 2.4, M.iron, 10);
    f.b(0, 1.32, -.3, 1.3, .5, .04, kit.brick);
    f.c(-.3, 1.12, .1, .14, .12, .16, M.copper, 12);
  }
  { // open shelves with plates over the long counter
    for (const y of [1.55, 2.05]) box(2.6, .04, .3, M.walnut, 8.3, y, -2.38);
    for (let i = 0; i < 10; i++) {
      const x = 7.15 + i * .25, y = i % 2 ? 1.75 : 2.25;
      const plate = cyl(.11, .11, .02, M.plate, x, y, -2.42, 14);
      plate.rotation.x = Math.PI / 2 - .2;
    }
    for (let i = 0; i < 4; i++) cyl(.05, .06, .2, [M.copper, M.plate, M.bottleGreen, M.plate][i], 7.3 + i * .55, 1.67, -2.38, 8);
  }
  { // hanging pot rack above the register counter
    box(2.0, .04, .04, M.iron, 8.15, 2.6, .2);
    for (const x of [7.25, 9.05]) cyl(.008, .008, .78, M.iron, x, 3.0, .2, 4);
    for (let i = 0; i < 5; i++) {
      const x = 7.4 + i * .38;
      cyl(.006, .006, .16, M.iron, x, 2.5, .2, 4);
      cyl(.1 + (i % 2) * .03, .08, .14 + (i % 3) * .03, M.copper, x, 2.33, .2, 12);
    }
  }
  { // kitchen table and two chairs
    box(1.4, .06, .86, M.oak, 8.1, .82, 2.25, true);
    for (const x of [7.48, 8.72]) for (const z of [1.88, 2.62]) box(.07, .7, .07, M.oak, x, .45, z);
    for (const [x, s] of [[7.0, 1], [9.2, -1]]) {
      box(.42, .05, .42, M.oak, x, .5, 2.25);
      for (const dx of [-.17, .17]) for (const dz of [-.17, .17]) box(.04, .45, .04, M.oak, x + dx, .3, 2.25 + dz);
      box(.04, .55, .42, M.oak, x - s * .19, .8, 2.25);
    }
    candle(8.1, .85, 2.25, .2);
    cyl(.14, .1, .08, M.plate, 8.45, .89, 2.05, 12);
  }
  sconce("z", 6.375, -1, 8.3, 1.95);

  // ---------- leather workshop ----------
  for (const x of [-4.2, 4.2]) { // hides stretched on frames
    box(1.24, .06, .06, M.oak, x, 2.3, -6.28); box(1.24, .06, .06, M.oak, x, .9, -6.28);
    for (const s of [-1, 1]) box(.06, 1.46, .06, M.oak, x + s * .6, 1.6, -6.28);
    const hide = mesh(new THREE.PlaneGeometry(1.08, 1.3), M.hide, x, 1.6, -6.25);
    hide.castShadow = false;
    for (const [dx, dy] of [[-.54, .62], [.54, .62], [-.54, -.62], [.54, -.62], [0, .66], [0, -.66]])
      kit.beam(x + dx * .82, 1.6 + dy * .85, -6.25, x + dx, 1.6 + dy * 1.07, -6.27, .006, M.straw);
  }
  for (const [x, n] of [[-11.87, 1], [11.87, -1]]) { // tool boards
    const bx = x + n * .055;
    box(.03, 1.0, 1.6, M.oak, bx, 1.6, -4.55);
    const t = bx + n * .03;
    box(.02, .5, .04, M.iron, t, 1.7, -5.1); box(.02, .06, .14, M.oak, t, 1.95, -5.1);
    box(.02, .3, .03, M.oak, t, 1.6, -4.75); box(.02, .05, .12, M.iron, t, 1.77, -4.75);
    box(.02, .03, .34, M.iron, t, 1.4, -4.3); box(.02, .26, .03, M.oak, t, 1.3, -4.1);
    mesh(new THREE.TorusGeometry(.12, .015, 6, 14), M.leather, t, 1.75, -3.95).rotation.y = Math.PI / 2;
  }
  for (const x of [-7.3, 7.3]) { // work lamps over the long tables
    cyl(.006, .006, .7, M.iron, x, 3.04, -5.58, 4);
    mesh(new THREE.ConeGeometry(.2, .16, 10, 1, true), M.iron, x, 2.62, -5.58);
    sphere(.05, M.flame, x, 2.56, -5.58);
  }
  sconce("z", -2.75, -1, -5.5, 1.9); sconce("z", -2.75, -1, 5.5, 1.9);

  // ---------- rear passage ----------
  floor(-.72, .72, -20.9, -7.0, M.runner, 1.44, 2.88, .1395);
  picture("x", -2.02, 1, -15.0, 1.95, .55, .7, paintings[1]);
  picture("x", -2.02, 1, -18.6, 1.95, .55, .7, paintings[2]);
  picture("x", 2.02, -1, -18.6, 1.95, .55, .7, paintings[0]);
  picture("x", 2.02, -1, -13.95, 1.75, .78, .52, M.landscape);
  for (const z of [-8.1, -17.0, -20.2]) { sconce("x", -2.02, 1, z, 2.1); sconce("x", 2.02, -1, z, 2.1); }

  // ---------- gallows hall ----------
  { // iron candle ring above the old study
    const x = -6.6, z = -11.2, y = 4.3;
    cyl(.012, .012, 2.0, M.iron, x, 5.3, z, 4);
    mesh(new THREE.TorusGeometry(.6, .03, 6, 24), M.iron, x, y, z).rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; candle(x + Math.cos(a) * .6, y + .02, z + Math.sin(a) * .6, .14); kit.beam(x, 4.9, z, x + Math.cos(a) * .6, y, z + Math.sin(a) * .6, .01, M.iron); }
  }
  for (let i = 0; i < 4; i++) { // barrels and crates along the back wall
    const x = -10.9 + i * .9;
    if (i % 2) { box(.7, .7, .7, M.oak, x, .48, -25.8, true); box(.72, .06, .72, M.walnut, x, .82, -25.8); }
    else { cyl(.34, .3, .9, M.oak, x, .58, -25.8, 12); for (const y of [.3, .85]) mesh(new THREE.TorusGeometry(.33, .015, 4, 16), M.iron, x, y, -25.8).rotation.x = Math.PI / 2; solid(.6, .9, .6, x, .58, -25.8); }
  }
  for (const z of [-9.6, -22.6]) { // chains on the west wall
    box(.06, .08, .3, M.iron, -11.8, 2.6, z);
    for (let k = 0; k < 9; k++) mesh(new THREE.TorusGeometry(.04, .01, 4, 8), M.iron, -11.76, 2.5 - k * .07, z).rotation.y = (k % 2) * Math.PI / 2;
  }
  for (const z of [-8.4, -20.8]) sconce("x", -11.86, 1, z, 2.3);

  // ---------- trophy workshop ----------
  for (const z of [-13.6, -17.6, -21.6]) { // antlers mounted above the panelling
    const x = 11.86 - .05;
    box(.05, .42, .32, M.walnut, x, 3.1, z);
    sphere(.09, M.bone, x - .1, 3.08, z, 1.3, .9, .8);
    for (const s of [-1, 1]) {
      kit.beam(x - .12, 3.15, z + s * .06, x - .2, 3.55, z + s * .32, .03, M.bone);
      kit.beam(x - .2, 3.55, z + s * .32, x - .18, 3.85, z + s * .36, .022, M.bone);
      kit.beam(x - .17, 3.4, z + s * .2, x - .32, 3.62, z + s * .18, .018, M.bone);
      kit.beam(x - .2, 3.6, z + s * .34, x - .36, 3.78, z + s * .45, .016, M.bone);
    }
  }
  {
    const rug = mesh(new THREE.PlaneGeometry(5.0, 3.4), mat(0xffffff, rugTexture(512, 352, "#5c1a1f", "#d7c08a", "#1c2541")), 7.1, .142, -18.9);
    rug.rotation.x = -Math.PI / 2; rug.castShadow = false;
  }
  for (const z of [-13.0, -24.6]) sconce("x", 11.86, -1, z, 2.6);
  picture("z", -26.31, 1, 5.0, 3.0, .9, .6, M.landscape);

  // ---------- the bathroom ----------
  // Built inside the front of the trophy workshop: x 5.31..11.86, z -11.29..-6.63.
  const bx0 = 5.4, bz1 = -11.2, BH = 3.15;
  wall(.18, 6.74, 1.0, bx0, 3.40, -7.05);
  wall(.18, 6.74, 2.54, bx0, 3.40, -10.02);
  box(.18, 4.44, 1.2, kit.plasterWall, bx0, 4.52, -8.15);
  wall(6.55, 6.74, .18, 8.585, 3.40, bz1);
  const bathDoor = [-8.75, -7.55, 2.3];
  face("x", bx0 - .09, -1, -11.29, -6.63, HA, F.trophy, [bathDoor]);
  face("z", bz1 - .09, -1, 5.31, 11.86, HA, F.trophy);
  face("x", bx0 + .09, 1, -11.11, -6.63, BH, F.bath, [bathDoor]);
  face("x", 11.86, -1, -11.11, -6.63, BH, F.bath);
  face("z", -6.63, -1, 5.49, 11.86, BH, F.bath);
  face("z", bz1 + .09, 1, 5.49, 11.86, BH, F.bath);
  floor(5.49, 11.86, -11.11, -6.63, mat(0xffffff, mosaic), .5);
  box(6.4, .1, 4.5, M.plaster, 8.67, BH + .05, -8.87);
  for (const s of [-1, 1]) { // door casings on both sides
    box(.32, 2.36, .1, M.white, bx0, 1.31, -8.15 + s * .65);
  }
  box(.32, .12, 1.42, M.white, bx0, 2.36, -8.15);
  box(.05, 2.24, 1.16, M.oak, 5.6, 1.25, -9.36);
  box(.06, .05, .12, M.brass, 5.66, 1.15, -9.86);
  const bathSign = sign("BATH", bx0 - .15, 2.62, -8.15, .7);
  bathSign.rotation.y = -Math.PI / 2;
  addWindow(12.15, 2.05, -8.9, .9, 1.1, Math.PI / 2);
  addWindow(11.83, 2.05, -8.9, .9, 1.1, -Math.PI / 2, false);
  for (const z of [-8.65, -8.9, -9.15]) candle(11.74, 1.445, z, .08 + (z === -8.9 ? .05 : 0));

  // Clawfoot tub, its long side along z, head (backrest) at the south end.
  const tub = {x: 11.3, z: -8.9, L: 1.72, W: .84, wall: .055, base: .23, H: .52, flare: .06};
  tub.rim = tub.base + tub.H; tub.bottom = tub.base + .045; tub.water = .63;
  function stadium(L, W) {
    const r = W / 2, half = L / 2 - r, shape = new THREE.Shape();
    shape.absarc(0, half, r, 0, Math.PI, false);
    shape.absarc(0, -half, r, Math.PI, Math.PI * 2, false);
    shape.closePath();
    return shape;
  }
  const flareAt = y => 1 + tub.flare * Math.max(0, Math.min(1, (y - tub.base) / tub.H));
  function flared(geometry) {
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = flareAt(p.getY(i) + tub.base); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    geometry.computeVertexNormals();
    return geometry;
  }
  {
    const outer = stadium(tub.L, tub.W), inner = stadium(tub.L - 2 * tub.wall, tub.W - 2 * tub.wall);
    const ring = outer.clone(); ring.holes.push(inner);
    const shell = new THREE.ExtrudeGeometry(ring, {depth: tub.H, bevelEnabled: false, curveSegments: 12});
    shell.rotateX(-Math.PI / 2);
    mesh(flared(shell), M.porcelain, tub.x, tub.base, tub.z);
    const lip = stadium(tub.L + .04, tub.W + .04); lip.holes.push(stadium(tub.L - 2 * tub.wall + .01, tub.W - 2 * tub.wall + .01));
    const rim = new THREE.ExtrudeGeometry(lip, {depth: .035, bevelEnabled: false, curveSegments: 12});
    rim.rotateX(-Math.PI / 2); rim.scale(flareAt(tub.rim), 1, flareAt(tub.rim));
    mesh(rim, M.white, tub.x, tub.rim - .03, tub.z);
    for (const [y, shape] of [[tub.base, outer], [tub.bottom, inner]]) {
      const plate = new THREE.ShapeGeometry(shape, 12); plate.rotateX(-Math.PI / 2);
      mesh(plate, M.porcelain, tub.x, y, tub.z);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // claw feet
      const x = tub.x + sx * .27, z = tub.z + sz * .6;
      sphere(.045, M.brass, x, .18, z);
      cyl(.04, .03, .1, M.brass, x, .23, z, 8);
      for (let k = 0; k < 3; k++) sphere(.022, M.brass, x + Math.cos(k * 2.1) * .04, .15, z + Math.sin(k * 2.1) * .04, 1.4, .7, 1);
    }
    solid(tub.W + .04, tub.H, tub.L, tub.x, tub.base + tub.H / 2, tub.z);
    // brass mixer and spout at the foot end
    const fz = tub.z + tub.L / 2 + .02;
    cyl(.018, .018, .38, M.brass, tub.x, tub.rim + .12, fz, 8);
    mesh(new THREE.TorusGeometry(.09, .016, 6, 12, Math.PI), M.brass, tub.x, tub.rim + .31, fz - .09).rotation.y = Math.PI / 2;
    cyl(.022, .016, .08, M.brass, tub.x, tub.rim + .27, fz - .18, 8);
    for (const s of [-1, 1]) { cyl(.012, .012, .12, M.brass, tub.x + s * .06, tub.rim + .2, fz, 6).rotation.z = Math.PI / 2; sphere(.022, M.white, tub.x + s * .12, tub.rim + .2, fz); }
    kit.beam(tub.x + .08, tub.rim + .02, fz - .1, tub.x + .1, tub.bottom + .02, tub.z + .5, .006, M.brass);
  }
  // Bath water, rebuilt as a stadium-shaped grid so the cinematic can ripple it.
  const waterL = (tub.L - 2 * tub.wall) * flareAt(tub.water) - .01, waterW = (tub.W - 2 * tub.wall) * flareAt(tub.water) - .01;
  const waterGeo = new THREE.PlaneGeometry(waterW, waterL, 10, 26);
  waterGeo.rotateX(-Math.PI / 2);
  {
    const p = waterGeo.attributes.position, r = waterW / 2, half = waterL / 2 - r;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), cz = Math.max(-half, Math.min(half, z)), d = Math.hypot(x, z - cz);
      if (d > r) { p.setX(i, x * r / d); p.setZ(i, cz + (z - cz) * r / d); }
    }
    waterGeo.computeVertexNormals();
  }
  const waterMat = new THREE.MeshPhongMaterial({color: 0x52676a, emissive: 0x0a1416, specular: 0x9fb5b8, shininess: 70, transparent: true, opacity: .84, depthWrite: false});
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.name = "Bath water"; water.position.set(tub.x, tub.water, tub.z); water.renderOrder = 2;
  water.userData.rest = Float32Array.from(waterGeo.attributes.position.array);
  group.add(water); live.add(water);
  const steamMat = new THREE.MeshBasicMaterial({color: 0xe8eef0, transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide});
  const steamGeo = new THREE.PlaneGeometry(.5, .5);
  const steam = Array.from({length: 7}, (_, i) => {
    const puff = new THREE.Mesh(steamGeo, steamMat);
    puff.userData.phase = i / 7; puff.renderOrder = 3;
    group.add(puff); live.add(puff); return puff;
  });
  // Pendant lamp over the tub. The cinematic flickers it.
  const lampMat = new THREE.MeshLambertMaterial({color: 0xffe0b0, emissive: 0xd89848, side: THREE.DoubleSide});
  cyl(.006, .006, .7, M.iron, tub.x - .25, BH - .35, tub.z, 4);
  const shade = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 8, 0, Math.PI * 2, 0, 1.7), lampMat);
  shade.position.set(tub.x - .25, BH - .72, tub.z); group.add(shade); live.add(shade);
  const lamp = new THREE.PointLight(0xffc98a, 9, 7, 1.65);
  lamp.position.set(tub.x - .25, BH - .85, tub.z); group.add(lamp);

  { // washstand and mirror on the north wall
    const f = place(7.1, -6.86, Math.PI);
    f.c(0, .5, 0, .09, .14, .74, M.porcelain, 12);
    solid(.62, .9, .38, ...f.xyz(0, .55, 0));
    f.s(0, .9, -.02, .3, M.porcelain, 1, .35, .72);
    f.c(0, .97, -.02, .2, .17, .06, mat(0x7d8b8d), 14);
    f.c(0, 1.08, -.2, .015, .015, .16, M.brass, 6);
    mesh(new THREE.TorusGeometry(.29, .03, 6, 22), M.brass, ...f.xyz(0, 1.75, -.17)).scale.set(1, 1.3, 1);
    const glassy = mesh(new THREE.CircleGeometry(.28, 22), M.mirror, ...f.xyz(0, 1.75, -.16));
    glassy.scale.set(1, 1.3, 1); glassy.rotation.y = Math.PI;
    f.b(0, 1.28, -.12, .5, .03, .12, M.white);
    for (let i = 0; i < 3; i++) f.c(-.15 + i * .15, 1.36, -.12, .025, .03, .12 + i * .03, [M.bottleGreen, M.copper, M.porcelain][i], 6);
  }
  { // high-tank toilet in the corner by the door
    cyl(.18, .14, .4, M.porcelain, 6.05, .33, -10.75, 12);
    box(.42, .05, .45, M.oak, 6.05, .55, -10.75);
    box(.48, .3, .2, M.oak, 6.05, 2.3, -10.96);
    cyl(.018, .018, 1.7, M.brass, 5.85, 1.35, -10.95, 6);
    cyl(.004, .004, .6, M.brass, 6.25, 1.85, -10.9, 4);
    box(.06, .14, .06, M.white, 6.25, 1.5, -10.9);
    solid(.4, .45, .5, 6.05, .4, -10.75);
  }
  { // towel rail, folding screen, stool and a bath mat
    box(.9, .025, .025, M.brass, 8.5, 1.2, -11.0);
    for (const x of [8.08, 8.92]) box(.03, .03, .1, M.brass, x, 1.2, -11.05);
    box(.46, .62, .02, M.towel, 8.32, .93, -10.98);
    box(.36, .5, .02, mat(0x9b6f66), 8.76, .99, -10.97);
    for (let i = 0; i < 3; i++) {
      const panel = box(.62, 1.7, .03, M.curtain, 9.55 + i * .5, 1.0, -10.55 - (i % 2) * .22);
      panel.rotation.y = (i % 2 ? -.55 : .55);
    }
    cyl(.18, .16, .05, M.oak, 11.2, .55, -10.75, 10);
    for (let i = 0; i < 3; i++) { const a = i * 2.09; kit.beam(11.2 + Math.cos(a) * .1, .53, -10.75 + Math.sin(a) * .1, 11.2 + Math.cos(a) * .17, .14, -10.75 + Math.sin(a) * .17, .03, M.oak); }
    box(.3, .06, .22, M.towel, 11.2, .61, -10.75);
    box(.07, .03, .05, M.cream, 11.25, .65, -10.72);
    const mat2 = mesh(new THREE.PlaneGeometry(.55, 1.0), mat(0x6f7c86), 10.45, .142, -8.9);
    mat2.rotation.x = -Math.PI / 2;
    // wet footprints that lead from the door into the tub
    for (let i = 0; i < 7; i++) {
      const t = i / 6, x = 5.95 + t * 4.4, z = -8.15 - t * .75 + (i % 2 ? .1 : -.1);
      const print = mesh(new THREE.CircleGeometry(.06, 10), mat(0x3b4142), x, .1415, z);
      print.rotation.x = -Math.PI / 2; print.scale.set(1.7, .75, 1); print.rotation.z = -.15;
    }
  }

  const bath = {
    tub, water, lamp, shade, steam, stand: {x: 10.35, z: tub.z + centerZ},
    x: tub.x, z: tub.z + centerZ, ceiling: BH,
    inside: (x, z) => x > bx0 + .1 && x < 11.86 && z - centerZ < -6.63 && z - centerZ > bz1 + .1,
    near(p) { return bath.inside(p.x, p.z) && Math.hypot(p.x - tub.x, p.z - bath.z) < 1.35; },
    step(dt, time) {
      for (const puff of steam) {
        const k = (time * .09 + puff.userData.phase) % 1;
        puff.position.set(tub.x + .16 * Math.sin(time * .5 + puff.userData.phase * 9), tub.water + .05 + k * 1.1,
          tub.z + (puff.userData.phase - .5) * 1.1);
        puff.scale.setScalar(.6 + k * 1.4);
        puff.rotation.y = puff.userData.phase * 6 + time * .1;
        puff.visible = bath.steamOn !== false;
      }
      steamMat.opacity = .12 * (bath.steamFade ?? 1);
    },
    steamOn: true,
    dispose() { steamGeo.dispose(); steamMat.dispose(); waterGeo.dispose(); waterMat.dispose(); lampMat.dispose(); }
  };
  return {live, bath};
}
