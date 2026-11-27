/* Two chōchin, one vermilion ribbon and one indigo. Their silhouettes stay
   registered through the hook; the dye on the paper cuts with the music. */
const TAU = Math.PI * 2;
const RIBS = 24;
const dyes = {
  ivory: ["#ab6654", "#f3bd82", "#fff1c5", "#966052"],
  stripe: ["#354568", "#a8bfd2", "#f7e8c6", "#475071"],
  maple: ["#652b3b", "#cd613e", "#f8ac63", "#763438"],
  rain: ["#19223e", "#364665", "#77768d", "#202943"],
  pearl: ["#897a93", "#d6c6bc", "#fff0da", "#9b8495"],
  hemp: ["#192951", "#375887", "#7a9eb7", "#263958"],
  frost: ["#5c2137", "#ad3946", "#ef7161", "#69263b"],
  stars: ["#11192c", "#22283b", "#514354", "#181f32"],
  blush: ["#b87b8b", "#f4b9b0", "#ffe3ce", "#be8592"]
};
const hook = ["ivory", "stripe", "maple", "rain", "pearl", "hemp", "frost", "stars"];

function randomSequence(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function wash(g, x, y, radius, stops) {
  const gradient = g.createRadialGradient(x, y, 0, x, y, radius);
  for (const [at, color] of stops) gradient.addColorStop(at, color);
  g.fillStyle = gradient;
  g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function line(g, points) {
  g.beginPath();
  points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.stroke();
}

function maple(g) {
  const tips = [[-10, 4], [-25, -3], [-15, -5], [-28, -19], [-10, -11],
    [-13, -32], [-2, -17], [3, -41], [9, -16], [22, -29], [16, -10],
    [32, -14], [20, -2], [27, 1], [9, 6], [2, 8], [-2, 17], [-4, 16], [-1, 6]];
  g.beginPath();
  tips.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.closePath(); g.fill();
  g.strokeStyle = "#f6ad73"; g.lineWidth = 1.6;
  line(g, [[0, 6], [3, -30]]); line(g, [[1, 4], [-18, -14]]); line(g, [[1, 5], [18, -17]]);
}

function snowCrystal(g) {
  g.strokeStyle = "#fff1d6"; g.lineWidth = 2.7; g.lineCap = "round";
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    g.moveTo(0, 0); g.lineTo(0, -23);
    for (const h of [9, 16]) {
      g.moveTo(-5, -h - 5); g.lineTo(0, -h); g.lineTo(5, -h - 5);
    }
    g.rotate(TAU / 6);
  }
  g.stroke();
}

function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = i * TAU / 8, size = i % 2 ? r * .19 : r;
    const px = x + Math.cos(angle) * size, py = y + Math.sin(angle) * size * 1.32;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath(); g.fill();
}

function dyePattern(g, name) {
  const rand = randomSequence(79);
  if (name === "stripe") {
    for (let x = 0; x < 1024; x += 64) {
      g.fillStyle = "#34446a"; g.fillRect(x, 0, 17, 512);
      g.fillStyle = "#617994"; g.fillRect(x + 21, 0, 3, 512);
      g.fillStyle = "#a98461"; g.fillRect(x + 36, 0, 2, 512);
    }
  } else if (name === "hemp") {
    // Asanoha: six open kites meet in each hexagon of the staggered lattice.
    const r = 1024 / (16 * Math.sqrt(3)), dx = Math.sqrt(3) * r;
    g.strokeStyle = "#c8d8d2"; g.lineWidth = 1.9; g.beginPath();
    for (let row = -1; row < 12; row++) for (let col = -1; col < 17; col++) {
      const x = dx * (col + (row & 1) / 2), y = row * 1.5 * r;
      for (let i = 0; i < 6; i++) {
        const a = (i + .5) * TAU / 6, b = a + TAU / 6;
        const ax = x + r * Math.cos(a), ay = y + r * Math.sin(a);
        const bx = x + r * Math.cos(b), by = y + r * Math.sin(b);
        const cx = (x + ax + bx) / 3, cy = (y + ay + by) / 3;
        g.moveTo(x, y); g.lineTo(ax, ay); g.lineTo(bx, by);
        g.moveTo(ax, ay); g.lineTo(cx, cy); g.lineTo(bx, by);
        g.moveTo(cx, cy); g.lineTo(x, y);
      }
    }
    g.stroke();
  } else if (name === "maple" || name === "frost") {
    // Offset repeat, including the copies which straddle the UV seam.
    for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) {
      const x = 128 * (col + .5 * (row % 2)) + rand() * 40;
      const y = 30 + row * 105 + rand() * 36, angle = (rand() - .5) * 1.7, s = .75 + rand() * .6;
      const ink = rand() < .55 ? "#893638" : "#f4ca80";
      for (const wrap of [0, -1024, 1024]) {
        if (x + wrap < -60 || x + wrap > 1084) continue;
        g.save(); g.translate(x + wrap, y); g.rotate(angle); g.scale(s, s);
        g.fillStyle = ink;
        if (name === "maple") maple(g); else snowCrystal(g);
        g.restore();
      }
    }
  } else if (name === "stars") {
    g.fillStyle = "#fff4de";
    for (let i = 0; i < 230; i++) star(g, rand() * 1024, rand() * 512, i % 6 ? 1.5 + rand() * 2 : 5 + rand() * 6);
  } else if (name === "rain") {
    g.strokeStyle = "#8facc4"; g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < 260; i++) {
      const x = rand() * 1024, y = rand() * 512, n = 3 + rand() * 17;
      g.moveTo(x, y); g.lineTo(x - n * .46, y + n);
    }
    g.stroke();
  }
}

function paperTexture(kit, size, name, fibers) {
  return kit.paint(size, size / 2, (g, w, h) => {
    g.scale(w / 1024, h / 512);
    const [edge, field, heart, foot] = dyes[name], gr = g.createLinearGradient(0, 0, 0, 512);
    for (const [t, color] of [[0, edge], [.18, field], [.57, heart], [.79, field], [1, foot]]) gr.addColorStop(t, color);
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
    dyePattern(g, name);
    g.fillStyle = g.createPattern(fibers, "repeat"); g.fillRect(0, 0, 1024, 512);
    // Horizontal cane leaves a narrow cast shadow and a fine transmitted edge.
    for (let i = 0; i <= RIBS; i++) {
      const y = i * 512 / RIBS;
      g.fillStyle = "rgba(55,27,43,.23)"; g.fillRect(0, y, 1024, 2.5);
      g.fillStyle = "rgba(255,221,171,.42)"; g.fillRect(0, y + 3, 1024, 1.3);
    }
    for (let x = 0; x < 1024; x += 128) {
      g.fillStyle = "rgba(72,41,44,.17)"; g.fillRect(x, 0, 5, 512);
      g.fillStyle = "rgba(255,242,206,.27)"; g.fillRect(x + 5, 0, 2, 512);
    }
  });
}

function cloudBank(g, x, y, w, h, tint, shadow, rand) {
  // Broad, interlocking scallops with broken dry-brush marks along the light.
  const phase = rand() * TAU, crest = [];
  const edge = u => Math.pow(Math.max(0, Math.sin(Math.PI * u)), .70) *
    (.48 + .28 * Math.sin(8 * u + phase) + .24 * Math.abs(Math.sin(17 * u + phase)) +
     .12 * Math.abs(Math.sin(49 * u + phase)) + .05 * Math.sin(93 * u));
  for (let i = 0; i <= 76; i++) crest.push([x + w * i / 76, y - h * edge(i / 76)]);
  const gr = g.createLinearGradient(0, y - h, 0, y + h * .35);
  gr.addColorStop(0, tint); gr.addColorStop(.49, tint); gr.addColorStop(.82, shadow); gr.addColorStop(1, shadow);
  g.fillStyle = gr; g.beginPath(); g.moveTo(...crest[0]);
  for (const p of crest) g.lineTo(...p);
  g.bezierCurveTo(x + w * .8, y + h * .5, x + w * .23, y + h * .56, x, y);
  g.fill();
  g.fillStyle = tint;
  for (let j = 0; j < 14; j++) {
    const u = .09 + rand() * .82, xx = x + u * w, yy = y - h * edge(u) + h * rand() * .24;
    g.beginPath(); g.ellipse(xx, yy, w * (.012 + rand() * .036), Math.max(.45, h * .018), -.06, 0, TAU); g.fill();
  }
}

function cloudPainting(kit, size, foreground) {
  return kit.paint(size, Math.round(size * .54), (g, w, h) => {
    g.scale(w / 1024, h / 552);
    const rand = randomSequence(foreground ? 128 : 54);
    if (foreground) {
      cloudBank(g, -300, 505, 640, 103, "#535e85", "#252f50", rand);
      cloudBank(g, -315, 537, 770, 110, "#354260", "#171f39", rand);
      cloudBank(g, 820, 537, 520, 124, "#686680", "#262b48", rand);
      return;
    }
    const gr = g.createLinearGradient(0, 0, 0, 552), P = kit.palette("intro");
    for (const [u, c] of [[0, P.sky[0]], [.35, "#14284b"], [.62, "#535977"], [.73, "#b2838c"], [.78, P.sky[4]], [.84, "#68647c"], [1, "#253753"]]) gr.addColorStop(u, c);
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 552);
    g.save(); g.translate(325, 423); g.scale(1, .13);
    wash(g, 0, 0, 500, [[0, "#ffcf93"], [.4, "rgba(255,186,135,.51)"], [1, "rgba(255,180,134,0)"]]); g.restore();
    for (let i = 0; i < 450; i++) {
      const x = rand() * 1024, y = rand() * 349, r = .36 + rand() ** 4 * 1.15;
      g.globalAlpha = (.18 + rand() * .67) * (1 - y / 450); g.fillStyle = i % 4 ? "#b9d1e8" : "#ffe4bd";
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    const shades = [["#bda1a1", "#836f89"], ["#aaa0b1", "#63637f"], ["#9293aa", "#4d5776"],
      ["#858ba5", "#3f4b6a"], ["#77819e", "#354460"], ["#727c98", "#2e3c58"]];
    shades.forEach(([hi, lo], row) => {
      const y = 415 + row ** 1.6 * 8;
      for (let i = 0; i < 12 - row; i++) {
        const x = (i - 1) * 1024 / (10 - row) + rand() * 45, width = 120 + 42 * row + rand() * 86;
        cloudBank(g, x, y + rand() * 12, width, 13 + row * 10 + rand() * 16, hi, lo, rand);
      }
    });
  });
}

function goldGround(kit, size, fibers) {
  return kit.paint(size, Math.round(size * .60), (g, w, h) => {
    g.scale(w / 1024, h / 614);
    const gr = g.createLinearGradient(60, 0, 970, 614);
    gr.addColorStop(0, "#f9dd99"); gr.addColorStop(.3, "#eab970");
    gr.addColorStop(.64, "#cd9256"); gr.addColorStop(1, "#997352");
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 614);
    const rand = randomSequence(43);
    g.save(); g.translate(512, 307); g.rotate(-.24);
    for (let row = -4; row < 4; row++) for (let col = -6; col < 6; col++) {
      g.globalAlpha = .018 + rand() * .075; g.fillStyle = rand() > .4 ? "#fff4b7" : "#916855";
      g.fillRect(col * 145, row * 145, 144, 144);
    }
    g.restore(); g.globalAlpha = .46;
    g.fillStyle = g.createPattern(fibers, "repeat"); g.fillRect(0, 0, 1024, 614); g.globalAlpha = 1;
    // Loose gold leaf flakes, with more caught in the folds of the sheet.
    for (let i = 0; i < 850; i++) {
      const x = rand() * 1024, y = rand() * 614, s = .5 + rand() ** 4 * 4;
      g.fillStyle = i % 3 ? "#f1cb89" : "#bd905c";
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y - s * .4);
      g.lineTo(x + s * 1.7, y + s * .23); g.lineTo(x + s * .4, y + s * .7); g.fill();
    }
  });
}

function shadowStamp(kit) {
  return kit.paint(128, 192, g => {
    g.translate(60, 156); g.transform(1, 0, -.19, .94, 0, 0);
    g.fillStyle = "#574358"; g.shadowColor = "#625057"; g.shadowBlur = 3;
    // The feet touch a tiny dark point; the shoulders and head stretch away.
    g.beginPath(); g.moveTo(-4, 0); g.lineTo(-10, -48); g.lineTo(-19, -65);
    g.quadraticCurveTo(-14, -84, -25, -103); g.quadraticCurveTo(-21, -113, -10, -114);
    g.bezierCurveTo(-18, -133, 6, -137, 7, -117);
    g.quadraticCurveTo(20, -112, 19, -94); g.lineTo(25, -69); g.lineTo(19, -65);
    g.lineTo(11, -81); g.lineTo(13, -53); g.lineTo(5, -2); g.lineTo(1, -2);
    g.lineTo(2, -45); g.lineTo(-1, -44); g.lineTo(0, 0); g.closePath(); g.fill();
  });
}

function ribbonGeometry(THREE) {
  const pos = [], uv = [], indices = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12, a = .16 - .78 * u + .25 * Math.sin(u * TAU);
    for (const side of [-1, 1]) {
      const w = side * (.046 + .029 * Math.sin(Math.PI * u));
      pos.push(.14 * u * u + w * Math.cos(a), -.54 * u + w * Math.sin(u * 2) * .24, .08 * Math.sin(u * 3.4) + w * Math.sin(a));
      uv.push((side + 1) / 2, 1 - u);
    }
    const j = i * 2;
    if (i < 12) indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}

export async function create({ THREE, scene, camera, kit, tier, ctx2d, back2d }) {
  const size = tier === "saver" ? 512 : 1024;
  const segments = { saver: 32, smooth: 48, ultra: 64 }[tier];
  const own = [], keep = geo => (own.push(geo), geo);
  const root = new THREE.Group(); scene.add(root);
  const fibers = kit.paint(128, 128, g => {
    const rand = randomSequence(402);
    for (const ink of ["rgba(96,51,42,.12)", "rgba(255,245,206,.26)"]) {
      g.strokeStyle = ink; g.lineWidth = .65; g.beginPath();
      for (let i = 0; i < 640; i++) {
        const x = rand() * 128, y = rand() * 128, dx = rand() * 9 - 4;
        g.moveTo(x, y); g.quadraticCurveTo(x + dx, y - 1, x + dx * 1.7, y + rand() * 4);
      }
      g.stroke();
    }
  }).image;
  const papers = Object.fromEntries(Object.keys(dyes).map(key => [key, paperTexture(kit, size, key, fibers)]));
  const clouds = cloudPainting(kit, size, false).image, nearClouds = cloudPainting(kit, size, true).image;
  const gold = goldGround(kit, size, fibers).image, shadow = shadowStamp(kit).image;
  const rings = [];
  for (let i = 0; i <= RIBS * 4; i++) {
    const u = i / (RIBS * 4), bow = Math.max(0, Math.sin(Math.PI * u)) ** .72;
    const r = .34 + bow * .43 + .010 * Math.cos(TAU * RIBS * u);
    rings.push(new THREE.Vector2(r, (u - .5) * 1.48));
  }
  const body = keep(new THREE.LatheGeometry(rings, segments));
  const lathe = profile => keep(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments));
  const collar = lathe([[.255, -.046], [.346, -.046], [.375, -.034], [.375, -.019], [.357, -.011],
    [.362, .018], [.375, .029], [.37, .047], [.25, .047], [.25, -.046]]);
  const lip = lathe([[.363, -.006], [.378, -.006], [.378, .006], [.363, .006]]);
  const tube = (xyz, radius, n) => keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(xyz.map(p => new THREE.Vector3(...p))), n, radius, 6, false));
  const arch = tube([[-.31,.73,.03],[-.31,.95,.03],[-.22,1.13,.07],[.01,1.21,.09],[.23,1.12,.07],[.32,.94,.03],[.31,.73,.03]], .016, 32);
  const string = tube([[.16,-.73,.08],[.11,-.82,.12],[.065,-.89,.16],[.09,-.95,.16]], .011, 12);
  const ribbon = keep(ribbonGeometry(THREE));
  const cross = keep(new THREE.CylinderGeometry(.013,.013,.60,6));
  const flame = lathe([[0,0],[.085,.035],[.098,.105],[.073,.19],[.030,.29],[0,.39]]);
  const hot = kit.toon({ emissive: new THREE.Color(3.6, 1.4, .27), color: "#ffcc74", rimK: .15 });
  const wood = kit.toon({ color: "#593730", shade: "#734454", rim: "#ffcf9b", rimK: .38, soft: .35 });
  const brass = kit.toon({ color: "#d6a76f", shade: "#a0695d", rim: "#ffdda7", rimK: .55 });
  const paper = kit.toon({ light: "#fff4e4", shade: "#d9b5a9", rim: "#ffe2ad", rimK: .30, rimPow: 4,
    wrap: .36, soft: .65, ambient: .12, side: THREE.DoubleSide });
  // Assign the owned textures directly. toon() copies its initial uniforms.
  paper.uniforms.uMapOn.value = 1;
  const halo = kit.paint(128, 128, g => wash(g, 64, 64, 64, [[0,"rgba(255,231,166,.58)"], [.26,"rgba(255,179,116,.24)"], [.53,"rgba(244,153,119,.07)"], [1,"rgba(230,134,117,0)"]]));
  const aura = kit.toon({ opacity: .52, shade: "#fff6ef", light: "#fff5de", ambient: 0, rimK: 0 });
  aura.uniforms.uMap.value = halo; aura.uniforms.uMapOn.value = 1;
  aura.depthWrite = false; aura.blending = THREE.AdditiveBlending;
  const haloPlane = keep(new THREE.PlaneGeometry(3.9, 3.9));
  function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z); parent.add(m); return m;
  }
  function lantern(id) {
    const group = new THREE.Group(), model = new THREE.Group(); root.add(group); group.add(model);
    const tagMap = kit.paint(64, 192, g => {
      g.fillStyle = id ? "#415176" : "#be4b44"; g.fillRect(0, 0, 64, 192);
      g.fillStyle = "#f7d499";
      for (const y of [9, 16, 164, 170]) g.fillRect(0, y, 64, 3);
      for (let i = 0; i < 4; i++) {
        const y = 45 + i * 22;
        g.beginPath(); g.ellipse(32, y, 5, 10, i % 2 ? .65 : -.65, 0, TAU); g.fill();
      }
      g.fillStyle = g.createPattern(fibers, "repeat"); g.fillRect(0, 0, 64, 192);
    });
    const silk = kit.toon({ shade: "#c9a6b1", rimK: .17, side: THREE.DoubleSide });
    silk.uniforms.uMap.value = tagMap; silk.uniforms.uMapOn.value = 1;
    mesh(model, body, paper);
    for (const y of [-.74, .74]) {
      mesh(model, collar, wood, 0, y, 0); mesh(model, lip, brass, 0, y + .011, 0);
    }
    mesh(model, arch, brass); mesh(model, string, brass);
    const tail = mesh(model, ribbon, silk, .09, -.95, .16);
    for (const angle of [0, Math.PI / 2]) {
      const bar = mesh(model, cross, wood, 0, .66, 0); bar.rotation.set(Math.PI / 2, 0, angle, "YXZ");
    }
    const wick = mesh(model, flame, hot, 0, .28, 0);
    const glow = mesh(group, haloPlane, aura); glow.renderOrder = -1;
    model.scale.set(id ? .92 : 1, id ? 1.035 : 1, id ? .92 : 1);
    return { group, model, tail, wick, glow };
  }
  const lamps = [lantern(0), lantern(1)];
  const mist = kit.haze({ section: "intro", count: { saver: 7, smooth: 12, ultra: 20 }[tier], seed: 77,
    center: [0,-2.9,-5], box: [18, .7, 3], size: 3.8, top: "#9d95ae", bottom: "#546385", opacity: .22, drift: [.018,0,0] });
  const sparks = kit.particles({ kind: "spark", count: { saver: 160, smooth: 340, ultra: 580 }[tier],
    center: [0,1,-7], box: [23,12,11], seed: 39, size: .067, drift: [.026,.048,0], color: "#ffdbb4", color2: "#bbd6ff", twinkle: .8 });
  root.add(mist, sparks);
  const weather = Array.from({ length: 105 }, (() => {
    const rand = randomSequence(888); return () => [rand(), rand(), rand(), rand()];
  })());
  function precipitation(f, snow) {
    const g = ctx2d, unit = Math.min(f.W, f.H), count = tier === "saver" ? 48 : weather.length;
    g.save(); g.fillStyle = "#ebeff8"; g.strokeStyle = "#afc2df"; g.lineCap = "round";
    for (let i = 0; i < count; i++) {
      const [a,b,c,d] = weather[i], y = ((b + f.t * (snow ? .065 : .65) * (.5 + c)) % 1.1 - .05) * f.H;
      const x = ((a + (snow ? .015 * Math.sin(f.t + d * 16) : -.039 * y / f.H) + 1) % 1) * f.W;
      g.globalAlpha = .11 + c * c * .52;
      if (snow) {
        g.beginPath(); g.arc(x,y,Math.max(.45, (.0007 + .0024 * d * d) * unit),0,TAU); g.fill();
      } else {
        g.lineWidth = Math.max(.55,unit * .0012); line(g, [[x,y],[x - unit * .004,y + unit * (.010 + .021 * d)]]);
      }
    }
    g.restore();
  }
  return {
    update(f) {
      const { W, H, shot, t } = f, rise = shot.key === "rise", top = shot.key === "hero", alone = shot.var === "alone";
      const index = Number(shot.var), pair = !rise && !top && !alone;
      const name = pair ? hook[index] : alone ? "blush" : "ivory";
      const u = shot.u, drift = Math.sin(t * .69), unit = Math.min(H, W / 1.52);
      back2d.save();
      if (rise) {
        const h = H * 1.19, w = Math.max(W * 1.09, h * clouds.width / clouds.height);
        back2d.drawImage(clouds, (W-w)*.48 - u * .012 * w, H-h + u * H * .12, w, h);
        ctx2d.save(); ctx2d.globalAlpha = .70;
        ctx2d.drawImage(nearClouds, (W-w)*.51 - u*w*.056, H-h + u*H*.21, w*1.07, h);
        ctx2d.restore();
      } else if (top) {
        back2d.drawImage(gold, 0, 0, W, H);
        back2d.save(); back2d.translate(W*.5 + unit*.29, H*.5 + unit*.20);
        back2d.rotate(-.70); back2d.globalAlpha = .82;
        back2d.drawImage(shadow, -unit*.072, -unit*.13, unit*.144, unit*.216); back2d.restore();
      } else {
        back2d.fillStyle = alone ? "#eac7cb" : "#000"; back2d.fillRect(0, 0, W, H);
        if (alone) {
          back2d.save(); back2d.translate(W*.39,H*.45); back2d.scale(1.5,1);
          wash(back2d,0,0,H*.95,[[0,"#ffedcf"],[.5,"rgba(250,222,211,.67)"],[1,"rgba(224,186,204,0)"]]);
          back2d.restore();
        }
      }
      back2d.restore();
      if (pair && (index === 3 || index === 7)) precipitation(f, index === 7);
      mist.visible = sparks.visible = rise;
      if (rise) {
        kit.tick(f, mist, sparks);
        sparks.material.uniforms.uOpacity.value = .58 + .4 * f.downPulse;
      }
      camera.fov = 36;
      const zoom = H / unit, distance = (rise ? 7.3 : top ? 6.1 : 5.45) * zoom;
      camera.up.set(0, top ? 0 : 1, top ? -1 : 0);
      if (top) {
        camera.position.set(0,distance,0); camera.lookAt(0,0,0);
      } else {
        const y = rise ? -.72 + u * .46 : -.17;
        camera.position.set(rise ? .13 * drift : 0, y, distance); camera.lookAt(0,rise ? -.25 + u*.32 : -.065,0);
      }
      paper.uniforms.uMap.value = papers[name];
      const fire = .06 * f.fastPulse + .09 * f.pulse, dark = name === "rain" || name === "stars";
      paper.uniforms.uLight.value.setRGB(1.12 + fire, .96 + fire*.64, .84 + fire*.26);
      paper.uniforms.uRimK.value = (dark ? .42 : .27) + .05 * f.pulse;
      aura.uniforms.uOpacity.value = (dark ? .29 : .53) + .10 * f.pulse;
      const sway = Math.sin(shot.lt * 11) * Math.exp(-Math.abs(shot.lt)*6) * .032;
      for (let i = 0; i < lamps.length; i++) {
        const {group,model,tail,wick,glow} = lamps[i]; group.visible = !i || pair;
        if (!group.visible) continue;
        const side = (i ? 1 : -1) * (index >= 4 && pair ? -1 : 1);
        group.position.set(top ? -.65 : rise ? -.38 + .38*u : alone ? -.81 : side*.99,
          top ? .28 : rise ? -.42 + .93*u : .075, top ? -.28 : 0);
        model.rotation.set(top ? .11 : .025, top ? .55 + u*.13 : (i ? -.43 : .39) + (rise ? u*.38 : 0),
          (i ? -.037 : .045) + sway + (pair ? 0 : drift*.026));
        tail.rotation.z = .07 * Math.sin(t*1.8+i) + sway;
        wick.scale.set(1,1 + .20 * f.fastPulse + .04*Math.sin(t*24+i),1);
        glow.visible = !top;
        glow.position.set(0,.04,-.88); glow.quaternion.copy(camera.quaternion);
      }
      if (pair) kit.look({ lift: [0,0,0], glow: .24, bloom: .77, threshold: .69, chroma: .25, sat: 1.02 });
      else if (rise) kit.look({ lift: [.003,.006,.016], bloom: .78, glow: .31, rays: .26, rayX: .45, rayY: .45, tilt: .16, band: .57 });
      else if (top) kit.look({ rays: .32, rayX: .19, rayY: .1, glow: .28, tilt: .20, focus: .52, band: .48, sat: .99 });
      else kit.look({ bloom: .74, glow: .32, threshold: .86, sat: .88, rays: .17, rayX: .34, rayY: .43, lift: [.042,.029,.044] });
    },
    setVisible(on) { root.visible = on; },
    dispose() { scene.remove(root); for (const geometry of own) geometry.dispose(); }
  };
}
