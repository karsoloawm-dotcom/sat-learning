/* A summer local on the Hoshikawa line. All distances are in metres.
   The countryside is painted in three seamless rolls; the carriage and permanent way are 3D. */
const TAU = Math.PI * 2;
function random(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function polygon(g, color, points) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) g.lineTo(...points[i]);
  g.closePath();
  g.fill();
}
function oval(g, color, x, y, rx, ry, angle = 0) {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, rx, ry, angle, 0, TAU);
  g.fill();
}
function wash(g, stops, x, y, h, width) {
  const gradient = g.createLinearGradient(0, y, 0, y + h);
  stops.forEach(([at, col]) => gradient.addColorStop(at, col));
  g.fillStyle = gradient;
  g.fillRect(x, y, width, h);
}
function ridge(x, layer) {
  const a = x * TAU / 1200;
  return 269 + 45 * layer + Math.sin(a * 2 + layer) * (25 - layer * 4)
    + Math.cos(a * 3 - layer * 2) * 19 + Math.sin(a * 7 + layer * 3) * 7
    + Math.sin(a * 13) * 2.8 + Math.sin(a * 51) * .9;
}

function countryside(kit, width, seed, dusk) {
  const h = Math.round(width * 640 / 1200);
  const palette = kit.palette(dusk ? "chorus2" : "verse2");
  function roll(draw) {
    return kit.paint(width, h, g => {
      g.scale(width / 1200, h / 640);
      draw(g, random(seed + 323));
    }).image;
  }
  const sky = roll((g, rand) => {
    wash(g, [[0, dusk ? palette.sky[0] : "#458bc1"], [.37, dusk ? "#e5a6a5" : "#b4e0e9"],
      [.61, dusk ? "#ffdc9b" : "#f4e5bc"], [1, palette.fog]], 0, 0, 640, 1200);
    // Stacked paint marks leave an irregular lit crest and a long, cool, level underside.
    for (let i = 0; i < 19; i++) {
      const cx = rand() * 1200, cy = 64 + rand() * 199, size = 13 + rand() * 39;
      const lobes = [];
      for (let l = 0; l < 20; l++) {
        const s = l / 19, radius = size * (.18 + Math.sin(s * Math.PI) * (.3 + rand() * .55));
        lobes.push([cx + (s - .5) * size * 5.5, cy - radius * .6, radius]);
      }
      for (const offset of [-1200, 0, 1200]) {
        for (const [x, y, r] of lobes) {
          oval(g, dusk ? "#f2c5ab" : "#eff4ec", x + offset, y, r * 1.7, r * .86);
          oval(g, dusk ? "#cea3ad" : "#d4e8e9", x + offset + r * .3, y + r * .35, r * 1.65, r * .67);
          oval(g, dusk ? "#b49bac" : "#bfd9e2", x + offset + r * .5, cy + 1, r * 2.6, r * .18);
        }
      }
    }
  });
  function mountains(g, rand, layer, base, shadow, light) {
    const edge = [];
    for (let x = 0; x <= 1200; x += 3) edge.push([x, ridge(x, layer)]);
    polygon(g, base, [...edge, [1200, 640], [0, 640]]);
    g.save();
    g.clip(); // Keep the broken brush marks inside this ridge's silhouette.
    for (let i = 0; i < 65; i++) {
      const x = rand() * 1200, y = ridge(x, layer), length = 18 + rand() * 84;
      for (const offset of [-1200, 0, 1200]) {
        const a = x + offset;
        polygon(g, shadow, [[a, y], [a + length * .2, y + 17], [a + length, y + 42], [a + 12, y + 28]]);
      }
    }
    for (let i = 0; i < 450; i++) {
      const x = rand() * 1200, y = ridge(x, layer) + rand() * 68;
      oval(g, i % 3 ? light : shadow, x, y, 1 + rand() * 7, .6 + rand() * 1.6, -.19);
    }
    g.restore();
  }
  const hills = roll((g, r) => {
    mountains(g, r, 0, dusk ? "#9784a1" : "#8cb0c2", dusk ? "#8e809d" : "#7da4ba", dusk ? "#bba0ac" : "#a5c0c6");
    mountains(g, r, 1, dusk ? "#9c8396" : "#749e9c", dusk ? "#87798d" : "#658e93", dusk ? "#bca195" : "#99b7a8");
  });
  const fields = roll((g, rand) => {
    mountains(g, rand, 2, dusk ? "#705f75" : "#577f72", dusk ? "#655d72" : "#446e69", dusk ? "#a38a82" : "#839d77");
    const rows = dusk ? ["#a38b70", "#9b786c", "#bb946f", "#736974"] : ["#b5be79", "#92ae6f", "#c2ca86", "#799d78"];
    for (let row = 0; row < 9; row++) {
      const y = 425 + row * 21;
      for (let j = -1; j < 10; j++) {
        const x = j * 150 + (row % 2) * 67;
        polygon(g, rows[Math.abs(j + row * 3) % 4], [[x, y], [x + 150, y], [x + 108, y + 22], [x - 42, y + 22]]);
        g.fillStyle = dusk ? "#b69e7e" : "#c4c696";
        g.fillRect(x, y, 150, 1);
      }
    }
    for (let i = 0; i < 25; i++) {
      const x = 15 + rand() * 1150, y = 414 + rand() * 68, s = 2 + rand() * 3;
      g.fillStyle = "#e4d4ae"; g.fillRect(x, y, s * 3.4, s * 1.4);
      polygon(g, dusk ? "#77677a" : "#637a85", [[x - s * .4, y], [x + s * .2, y - s], [x + s * 3, y - s], [x + s * 3.8, y]]);
      g.fillStyle = "#5f6c69"; g.fillRect(x + s * .8, y + .6, s * .6, s);
    }
    for (let i = 0; i < 250; i++) {
      const x = rand() * 1200, y = 390 + 13 * Math.sin(x * TAU / 600) + rand() * 14, s = 2 + rand() * 4;
      oval(g, dusk ? "#6e6170" : "#628a73", x, y, s * 1.6, s);
      oval(g, dusk ? "#9b8178" : "#8fa476", x - s * .4, y - s * .45, s, s * .68);
    }
  });
  return [sky, hills, fields];
}

// A rounded panel seen broadside. Front face normal is +Z. Unit bounds include the bevel.
function panelGeometry(T, r) {
  const s = new T.Shape(), a = .5, b = a - r;
  s.moveTo(-b, -a); s.lineTo(b, -a); s.quadraticCurveTo(a, -a, a, -b);
  s.lineTo(a, b); s.quadraticCurveTo(a, a, b, a); s.lineTo(-b, a);
  s.quadraticCurveTo(-a, a, -a, b); s.lineTo(-a, -b); s.quadraticCurveTo(-a, -a, -b, -a);
  const geom = new T.ExtrudeGeometry(s, {depth: .90, bevelThickness: .05, bevelSize: .012, bevelSegments: 2, curveSegments: 4});
  geom.translate(0, 0, -.45);
  return geom;
}

export async function create({ THREE: T, scene, camera, back2d, kit, tier, seed }) {
  const root = new T.Group(), allocated = new Set(), instances = [];
  scene.add(root);
  const saver = tier === "saver", ultra = tier === "ultra";
  const palette = kit.palette("verse2"), rand = random(seed + 829);
  const tint = c => new T.Color(c);
  function material(opts = {}) {
    const m = kit.toon({section: "verse2", rimK: .10, soft: .31, ambient: .43, lightDir: [-.62, .72, .39], ...opts});
    // The kit merges uniforms. Bind the owned original when using a painted texture.
    if (opts.map) m.uniforms.uMap.value = opts.map;
    return m;
  }
  const enamel = material(), metal = material({rimK: .34, rimPow: 3.8});
  const soft = material({rimK: .06, shade: "#9295ac", wrap: .45});
  const lit = material({rimK: 0, emissive: new T.Color(.62, .50, .32)});
  function geo(geometry) { allocated.add(geometry); return geometry; }
  const block = geo(new T.BoxGeometry()), round = geo(panelGeometry(T, .13));
  const rod = geo(new T.CylinderGeometry(.5, .5, 1, 10));
  const loop = geo(new T.TorusGeometry(.40, .065, 6, 20)), card = geo(new T.PlaneGeometry());
  const dummy = new T.Object3D(), batch = new Map();
  function group(parent = root) { const g = new T.Group(); parent.add(g); return g; }
  function place(parent, geometry, mat, color, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
    let byGeometry = batch.get(parent);
    if (!byGeometry) batch.set(parent, byGeometry = new Map());
    const key = geometry.id + "/" + mat.id;
    let set = byGeometry.get(key);
    if (!set) byGeometry.set(key, set = {geometry, mat, items: []});
    dummy.position.set(x, y, z); dummy.scale.set(w, h, d); dummy.rotation.set(rx, ry, rz);
    dummy.updateMatrix();
    set.items.push([dummy.matrix.clone(), tint(color)]);
  }
  function bake() {
    for (const [parent, sets] of batch) for (const {geometry, mat, items} of sets.values()) {
      const mesh = new T.InstancedMesh(geometry, mat, items.length);
      items.forEach(([matrix, color], i) => { mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color); });
      parent.add(mesh); instances.push(mesh);
    }
    batch.clear();
  }
  function paintMaterial(w, h, fn, opts) {
    return material({map: kit.paint(w, h, fn), ...opts});
  }
  function dust(parent, center, box, size, count, color) {
    const p = kit.particles({section: "verse2", seed, center, box, kind: "dust", count: saver ? count : ultra ? count * 4 : count * 2,
      color, color2: palette.rim, opacity: .52, size, wobble: .06, drift: [.06, .035, -.1], on: "fast"});
    parent.add(p); return p;
  }
  const day = countryside(kit, saver ? 800 : ultra ? 1440 : 1080, seed, false);
  const sunset = countryside(kit, saver ? 720 : 1080, seed, true);
  function landscape(f, rolls, motion, shiftY = 0) {
    const h = Math.max(f.H, f.W * .45), w = h * 1.875;
    const y = (f.H - h) * .5 + shiftY * h;
    rolls.forEach((img, i) => {
      const offset = motion * [4, 30, 105][i] * h / 640;
      const origin = (f.W - w) * .5 - offset;
      let x = ((origin % w) + w) % w - w;
      for (; x < f.W; x += w) back2d.drawImage(img, x, y, w + .7, h);
    });
    if (y > 0) { back2d.fillStyle = "#659cb9"; back2d.fillRect(0, 0, f.W, Math.ceil(y)); }
    if (y + h < f.H) { back2d.fillStyle = "#839377"; back2d.fillRect(0, Math.floor(y + h), f.W, f.H - y - h + 1); }
  }
  const cloth = paintMaterial(192, 128, (g, w, h) => {
    wash(g, [[0, "#faabb1"], [.13, "#b65d7d"], [.63, "#9a4564"], [.92, "#713952"], [1, "#ca788a"]], 0, 0, h, w);
    for (let y = 7; y < h; y += 9) for (let x = -3; x < w; x += 12) {
      const a = x + (y % 2) * 6;
      polygon(g, "#d38394", [[a, y], [a + 3, y - 1.4], [a + 1, y + .6], [a - 2, y + 1.8]]);
    }
  }, {shade: "#a690ae", rimK: .18});
  // Panels with signs and moquette need face UVs across the whole cap (ExtrudeGeometry uses world XY).
  const uv = round.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + .5, uv.getY(i) + .5);
  function sign(w, h, draw) { return paintMaterial(w, h, draw, {shade: "#b1c1c7", rimK: .02}); }
  const destination = sign(384, 96, (g, w, h) => {
    g.fillStyle = "#243a48"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#e2ad74"; g.font = '42px "Yu Mincho",serif'; g.fillText("星　川", 19, 55);
    g.font = '14px system-ui,sans-serif'; g.fillText("H O S H I K A W A", 21, 79);
    g.fillStyle = "#eee3bb"; g.font = 'bold 23px system-ui,sans-serif'; g.fillText("LOCAL", 263, 56);
    g.fillStyle = "#ab5d66"; g.fillRect(0, h - 5, w, 5);
  });
  const routeMap = sign(512, 74, (g, w, h) => {
    g.fillStyle = "#d7d5c3"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#657a76"; g.fillRect(23, 35, w - 48, 3);
    for (let i = 0; i < 10; i++) {
      const x = 26 + i * 50;
      oval(g, i === 6 ? "#c56355" : "#4f7280", x, 36, 5, 5);
      g.fillStyle = "#738084"; g.fillRect(x - 6, 48, 12 + i % 3 * 2, 2); g.fillRect(x - 5, 54, 9, 2);
    }
  });
  const carPane = paintMaterial(320, 144, (g,w,h) => {
    wash(g, [[0, "#bedae6"], [.60, "#fff7db"], [1, "#cbdabe"]], 0, 0, h, w);
    for (let i = 0; i < 2; i++) {
      const edge = [];
      for (let x = 0; x <= w; x += 4) edge.push([x, 92 + i * 16 + Math.sin(x * .025 + i) * 9 + Math.cos(x * .06) * 2]);
      polygon(g, i ? "#9cae94" : "#c2d1c2", [...edge, [w, h], [0,h]]);
    }
  }, {emissive: new T.Color(.30, .36, .33), rimK: .03, shade: "#e8f1ee"});
  const interior = group(), bands = group(interior);
  const aisleDust = dust(interior, [0, 1.35, -7], [3, 2.5, 19], .024, 46, "#ffe2a2");
  const sunPatch = paintMaterial(128, 128, (g,w,h) => {
    const light = g.createLinearGradient(0,0,w,h*.25);
    light.addColorStop(0,"rgba(255,222,159,0)"); light.addColorStop(.15,"rgba(255,226,181,.55)");
    light.addColorStop(.78,"rgba(255,245,209,.91)"); light.addColorStop(1,"rgba(255,246,218,.05)");
    g.fillStyle = light; g.fillRect(0,0,w,h);
  }, {opacity: .62, emissive: new T.Color(.38,.25,.10), rimK: 0});
  sunPatch.depthWrite = false;
  const aisleFloor = paintMaterial(192, 384, (g,w,h) => {
    wash(g, [[0,"#7d92a0"],[.5,"#778f9d"],[1,"#91a0a9"]], 0, 0, h, w);
    for (let i = 0; i < 2100; i++) {
      g.fillStyle = i % 2 ? "#8698a2" : "#627e90"; g.fillRect(rand()*w,rand()*h,1+rand()*3,1);
    }
  }, {rimK:.03});
  place(interior, block, enamel, "#45576a", 0,-.08,-6, 3.8,.15,25);
  place(interior, card, aisleFloor, "#ffffff", 0,.004,-6, 3.65,25,1,-Math.PI/2);
  place(interior, block, soft, "#c4c6bc", 0,2.83,-6, 3.7,.18,25);
  for (const side of [-1,1]) {
    const face = -side * Math.PI/2;
    place(interior, block, enamel, "#7b8d98", side*1.80,1.38,-6, .10,2.8,25);
    place(interior, block, metal, "#b4bcc0", side*1.64,2.51,-6, .30,.26,25,0,0,-side*.32);
    place(interior, rod, metal, "#aebac0", side*.99,2.35,-6, .045,24,.045,Math.PI/2);
    place(interior, block, lit, "#ffe8c8", side*.75,2.726,-6, .09,.035,24);
    place(interior, block, metal, "#b4bab6", side*1.67,1.04,-6, .12,.06,24);
    for (let i = 0; i < 9; i++) {
      const z = 4.2 - 2.48*i;
      place(interior, round, enamel, "#304758", side*1.70,1.65,z, 2.14,1.10,.10,0,face);
      place(interior, round, carPane, "#ffffff", side*1.637,1.65,z, 2.03,.99,.028,0,face);
      place(interior, block, metal, "#b2b7b4", side*1.61,1.91,z, .04,.035,1.99);
      place(interior, block, soft, "#a1aeb4", side*1.31,.28,z, .64,.42,2.00);
      place(interior, round, cloth, "#fff0f3", side*1.31,.55,z, 2.08,.18,.69,0,face);
      place(interior, round, cloth, "#e6c4d2", side*1.59,.79,z, 2.06,.48,.15,0,face,-side*.055);
      for (const dz of [-1.05,1.05]) {
        place(interior, rod, metal, "#cfccc1", side*1.09,.62,z+dz, .032,.37,.032);
        place(interior, rod, metal, "#e5e1cd", side*1.31,.80,z+dz, .038,.48,.038,0,0,Math.PI/2);
      }
      place(interior, rod, metal, "#e0dad0", side*.99,1.30,z-1.15,.034,2.14,.034);
      place(interior, block, soft, "#756955", side*.99,2.21,z,.025,.23,.049);
      place(interior, loop, soft, "#e8ddbf", side*.99,2.04,z, .245,.27,.22,0,side*.26);
      if (i % 2 === 0) place(interior, card, routeMap, "#ffffff", side*1.65,2.36,z, 1.48,.19,1,0,face);
    }
  }
  place(interior, block, soft, "#a2b0b5", 0,1.32,-17.3, 3.55,2.76,.15);
  place(interior, round, enamel, "#4b6372", 0,1.10,-17.19, 1.04,2.13,.08);
  place(interior, round, soft, "#abb6b7", 0,1.09,-17.12,.91,2.04,.08);
  place(interior, round, carPane, "#ffffff",0,1.50,-17.05,.68,.82,.04);
  place(interior, card, destination, "#ffffff",0,2.40,-17.18,1.10,.27,1);
  for (let i=-1; i<12; i++) {
    place(bands, card, sunPatch, "#fff2ce", -.05,.021,4-i*2.48,3.20,.79,1,-Math.PI/2,0,-.46);
    place(bands, card, sunPatch, "#fff2ce", -.05,.022,4-i*2.48+.47,3.10,.10,1,-Math.PI/2,0,-.46);
  }

  const windowSeat = group(), poles = group(windowSeat), ghost = group(windowSeat);
  const windowDust = dust(windowSeat, [0,1.4,.75], [4,2,.8], .013, 20, "#fee8aa");
  const reveal = material({color: "#fff5dd", shade:"#65798d", rimK:.16});
  // The reveal surrounds an actual opening: the lit landscape never intersects the window.
  for (const side of [-1,1]) {
    place(windowSeat, block, enamel, "#687e8b", side*7.04,1.6,0, 10.2,10,.12);
    place(windowSeat, block, enamel, "#687e8b", 0,1.63+side*6.03,0, 4.04,10,.12);
    for (const [inset, thick, depth, col] of [[0,.15,.13,"#bcc3c0"], [.078,.063,.16,"#273d4b"], [.118,.025,.185,"#dabf97"]]) {
      place(windowSeat, block, reveal, col,side*(1.99-inset),1.63,depth,thick,2.19-inset*2,.06);
      place(windowSeat, block, reveal, col,0,1.63+side*(1.06-inset),depth,3.98-inset*2,thick,.06);
    }
  }
  place(windowSeat, block, metal, "#a6adb0",0,2.28,.22,3.83,.032,.043);
  place(windowSeat, block, metal, "#b8bcb7",0,.56,.19,4.13,.08,.36);
  place(windowSeat, card, routeMap, "#ffffff",0,2.85,.08,2.08,.30,1);
  place(windowSeat, round, cloth, "#f4d6df",-1.75,.50,.81,1.45,.88,.30,-.12,-.12,-.04);
  place(windowSeat, round, cloth, "#ebc3d3",1.97,.39,.83,1.10,.70,.28,-.10,.12,.04);
  for (let i=-3;i<=3;i++) {
    const x = i*6.8;
    place(poles, rod, soft, "#515e63",x,1,-3,.095,8,.095,0,0,.018);
    place(poles, block, soft, "#52676c",x,3.14,-3,.8,.075,.10);
    for(const dx of [-.31,.30]) place(poles, rod, soft, "#acb4a9",x+dx,3.24,-3,.063,.15,.063);
  }
  for (const y of [2.78,2.86,3.10]) place(poles, block, soft, "#576779",0,y,-3,52,.013,.013,0,0,-.009);
  function lanternArt(g,w,h) {
    g.scale(w/200,h/300);
    g.lineWidth=2; g.strokeStyle="#916e58"; g.beginPath(); g.arc(100,80,28,Math.PI,TAU);g.stroke();
    const l=g.createRadialGradient(91,122,4,101,139,78);
    l.addColorStop(0,"#fff5bf"); l.addColorStop(.58,"#ffe09b"); l.addColorStop(.88,"#e9a974"); l.addColorStop(1,"#d28970");
    g.fillStyle=l;g.beginPath();g.moveTo(74,76);g.bezierCurveTo(28,87,25,161,53,187);
    g.bezierCurveTo(71,206,126,210,148,186);g.bezierCurveTo(177,152,164,90,126,76);g.closePath();g.fill();
    g.save();g.clip();
    for(let i=0;i<11;i++) { const y=80+i*11;g.strokeStyle="rgba(148,89,70,.50)";g.lineWidth=1.8;
      g.beginPath();g.moveTo(28,y);g.quadraticCurveTo(100,y+23,173,y-2);g.stroke(); }
    g.fillStyle="#dc9c76"; g.beginPath();g.arc(108,141,11,0,TAU);g.fill();
    g.restore();
    oval(g,"#786358",100,76,29,5);oval(g,"#97705b",100,199,26,5);
    g.strokeStyle="#c16e61";g.lineWidth=2.6;g.beginPath();g.moveTo(100,201);g.bezierCurveTo(98,213,121,219,106,234);g.stroke();
    polygon(g,"#c97765",[[107,229],[114,232],[110,252],[106,260],[105,244],[101,251]]);
  }
  const lanternMap = kit.paint(192,288,lanternArt);
  const paper = material({map:lanternMap, opacity:.96, rimK:0, shade:"#ffd5a1", emissive:new T.Color(.42,.22,.06)});
  paper.depthWrite=false;
  const reflection = material({map:lanternMap, opacity:.44, rimK:0, shade:"#edc7a3", emissive:new T.Color(.18,.09,.03)});
  reflection.depthWrite=false;
  if (!saver) {
    const echo = material({map:lanternMap, opacity:.16, rimK:0, shade:"#9bb7c0", emissive:new T.Color(.08,.07,.04)});
    echo.depthWrite=false;
    place(ghost,card,echo,"#d1e2e3",.034,.017,-.01,.81,1.24,1);
    place(ghost,card,reflection,"#ffe6cc",0,0,0,.81,1.24,1);
  }
  const cord = paintMaterial(160,192,(g,w,h)=>{
    g.scale(w/160,h/192);
    for (const [color,lw] of [["#56263d",17],["#ef3b47",12],["#ffc17b",2.5]]) {
      g.strokeStyle=color;g.lineWidth=lw;g.lineCap="round";g.setLineDash(lw<3?[4,4]:[]);
      g.beginPath();g.moveTo(53,17);g.bezierCurveTo(91,46,125,108,73,111);
      g.bezierCurveTo(20,111,61,51,86,88);g.bezierCurveTo(112,127,52,140,78,172);g.stroke();
    }
  },{opacity:.98,rimK:0,emissive:new T.Color(.22,.03,.02)});
  cord.depthWrite=false;
  const passing = group(), nearTrain = group(passing), farTrain = group(passing);
  const trainGlass = paintMaterial(160,128,(g,w,h) => {
    wash(g, [[0,"#344a62"], [.23,"#809fae"], [.70,"#a4b7b5"], [1,"#657b88"]],0,0,h,w);
    polygon(g,"#d4d8c7",[[24,0],[48,0],[13,h],[0,h],[0,89]]);
    polygon(g,"#c3ccc0",[[138,0],[145,0],[104,h],[96,h]]);
    g.fillStyle="#5c7280";g.fillRect(0,h*.79,w,3);
  }, {rimK:.04,shade:"#d1d9da"});
  const passingDust = dust(passing,[0,1.8,1],[22,6,7],.065,33,"#ffe7a9");
  function coach(parent, direction, stripe, symbol) {
    const carLength=11.9;
    place(parent,round,soft,"#c2c8c7",0,1.48,0,carLength,2.04,1.78);
    place(parent,round,metal,"#8999a4",0,2.46,0,11.65,.29,1.69);
    place(parent,block,enamel,"#364956",0,.40,0,11.32,.32,1.26);
    place(parent,block,soft,stripe,0,1.03,.902,11.55,.26,.046);
    place(parent,block,soft,"#dba971",0,.865,.906,11.55,.031,.046);
    for (let i=0;i<4;i++) place(parent,block,metal,"#98a5ad",0,.60+i*.055,.904,11.46,.018,.035);
    for (const x of [-4,4]) {
      place(parent,round,enamel,"#364455",x,.34,0,1.9,.43,1.30);
      for (const dx of [-.60,.60]) {
        place(parent,rod,enamel,"#273945",x+dx,.27,.60,.54,.17,.54,Math.PI/2);
        place(parent,rod,metal,"#81909a",x+dx,.27,.70,.23,.06,.23,Math.PI/2);
      }
      place(parent,round,metal,"#94a4ab",x,2.72,0,1.55,.18,1.07);
    }
    for (const x of [-4.72,-1.86,-.60,.66,1.92,4.79]) {
      place(parent,round,enamel,"#344b5b",x,1.73,.922,1.08,1.02,.055);
      place(parent,round,trainGlass,"#faf4de",x,1.74,.963,.96,.88,.026);
      place(parent,block,metal,"#a0a9a6",x,1.97,.994,.94,.022,.019);
    }
    for (const x of [-3.31,3.34]) {
      place(parent,block,enamel,"#788891",x,1.38,.93,1.20,1.85,.025);
      for (const dx of [-.29,.29]) {
        place(parent,block,soft,"#bbc3c5",x+dx,1.38,.952,.55,1.77,.022);
        place(parent,round,trainGlass,"#c7dbe0",x+dx,1.76,.978,.39,.77,.022);
        place(parent,block,soft,stripe,x+dx,1.03,.98,.55,.24,.021);
      }
    }
    const end=direction*5.96;
    place(parent,round,enamel,"#364e5e",end,1.85,0,1.58,1.02,.07,0,direction*Math.PI/2);
    for(const z of [-.57,.57]) {
      place(parent,round,lit,"#fff4c7",end+direction*.047,1.06,z,.29,.18,.075,0,direction*Math.PI/2);
    }
    place(parent,card,destination,"#ffecc9",direction*4.78,2.33,.941,1.20,.26,1);
    const markX=direction*1.92;
    place(parent,card,symbol,"#ffffff",markX,1.71,1.012,.83,1.00,1);
  }
  coach(nearTrain,1,"#668f98",saver ? cord : paper);
  if (!saver) coach(farTrain,-1,"#bb6669",cord);
  for(const [z,y] of [[0,-.02],[-4.4,1.32]]) {
    if (saver && z<0) continue;
    place(passing,block,enamel,"#657579",0,y-.27,z,55,.35,2.7);
    place(passing,block,metal,"#b1ada2",0,y-.045,z+.83,55,.08,.10);
    for(let x=-24;x<26;x+=4.3) {
      place(passing,block,soft,"#84928d",x,y-1.88,z,.53,3.1,1.29);
      place(passing,block,metal,"#788b8c",x+1.96,y-.53,z+.70,4.6,.11,.11,0,0,.22);
    }
  }
  for (const x of [-13,-3.2,8.5,20]) {
    place(passing,rod,metal,"#7b8e96",x,2.4,-6,.125,8,.125);
    place(passing,block,metal,"#80939c",x,5.05,-5,.08,.07,3.20);
  }
  place(passing,block,soft,"#5b7588",0,4.95,-1.32,70,.018,.018);

  const tracks=group(), crossing=group(tracks);
  const trackDust=dust(tracks,[0,1.4,-12],[16,4.5,31],.031,62,"#fff2ab");
  const air=kit.haze({section:"verse2",count:saver?5:11,seed:seed+2,center:[0,1,-60],
    box:[64,2,18],size:12,drift:[.005,0,0],top:"#f4edc7",bottom:"#9fb7aa",opacity:.15});
  tracks.add(air);
  function terrainPaint(ballast) {
    const size=256, texture=kit.paint(size,size,(g,w,h)=>{
      g.fillStyle=ballast?"#9b968b":"#98a765"; g.fillRect(0,0,w,h);
      const colors=ballast?["#777d7b","#bec0ac","#9c9b8d","#87898a","#d7cbb4"]:["#77966b","#bcc379","#859d6c","#c4c885","#6f895c"];
      for(let i=0;i<(ballast?4000:1600);i++){
        const x=rand()*w,y=rand()*h,s=1+rand()*(ballast?4:9);
        polygon(g,colors[i%colors.length],[[x,y],[x+s,y-s*.34],[x+s*.76,y+s*.46],[x+s*.14,y+s*.57]]);
      }
    });
    texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(ballast?2:23,ballast?55:35);
    // kit.toon samples vUv directly, so put tiling in the geometry UVs.
    const plane=geo(new T.PlaneGeometry()), uv=plane.attributes.uv;
    for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*texture.repeat.x,uv.getY(i)*texture.repeat.y);
    return [plane,material({map:texture,rimK:0,side:T.DoubleSide,shade:"#91a295"})];
  }
  const [meadow,meadowMat]=terrainPaint(false), [gravel,gravelMat]=terrainPaint(true);
  place(tracks,meadow,meadowMat,"#fff5d3",0,-.12,-45,110,160,1,-Math.PI/2);
  place(tracks,gravel,gravelMat,"#fff9dd",0,.001,-48,3.35,134,1,-Math.PI/2);
  place(tracks,gravel,gravelMat,"#efd8b6",3.48,-.064,-48,1.72,134,1,-Math.PI/2);
  for(let i=0;i<154;i++) {
    const z=12-i*.75;
    place(tracks,block,soft,i%3?"#74675d":"#887763",0,.045,z,2.43,.09,.21,0,(rand()-.5)*.012);
    for(const x of [-.76,.76]) place(tracks,block,enamel,"#62584f",x,.099,z,.22,.045,.16);
  }
  for(const x of [-.76,.76]) {
    place(tracks,block,enamel,"#7e6c5e",x,.16,-46,.079,.16,121);
    place(tracks,block,metal,"#d7d1ae",x,.252,-46,.105,.028,121);
  }
  for(let z=8;z>=-100;z-=2.85) {
    place(tracks,rod,soft,"#607d74",2.41,.48,z,.083,1.13,.083);
    place(tracks,rod,metal,"#c7ba96",2.41,1.06,z,.09,.043,.09);
  }
  for(const y of [.48,.95]) place(tracks,rod,soft,"#687d72",2.41,y,-46,.042,111,.042,Math.PI/2);
  // Curved catenary spans. The staggered droppers give scale without a forest of poles.
  for(let z=3;z>=-100;z-=14) {
    place(tracks,rod,metal,"#7b8685",-2.52,2.82,z,.13,5.88,.13);
    place(tracks,block,metal,"#a0a49a",-1.39,5.20,z,2.72,.08,.09);
    place(tracks,block,metal,"#87958e",-1.71,4.75,z,1.91,.053,.06,0,0,.41);
    for(let k=0;k<4;k++) {
      const y0=5.61-.52*Math.sin(k*Math.PI/4), y1=5.61-.52*Math.sin((k+1)*Math.PI/4);
      place(tracks,block,soft,"#687c84",0,(y0+y1)/2,z-(k+.5)*3.5,.016,.019,3.55,Math.atan2(y1-y0,3.5));
      place(tracks,rod,soft,"#718389",0,(4.97+y0)/2,z-k*3.5,.014,y0-4.97,.014);
    }
  }
  place(tracks,block,soft,"#768588",0,4.97,-45,.021,.021,130);
  const blades=geo(new T.BufferGeometry());
  blades.setAttribute("position",new T.Float32BufferAttribute([-.48,0,0,.07,0,.02,-.53,.62,.05, -.08,0,.03,.19,0,0,.49,.86,.04, -.24,0,.01,.13,0,.01,-.03,1,.07],3));
  blades.computeVertexNormals();
  const grassMat=material({side:T.DoubleSide,rimK:.04,shade:"#a7ab84"});
  const greens=["#b4bb75","#749268","#96a565","#cad17e","#6e8e68"];
  for(let i=0;i<(saver?1000:ultra?2800:1800);i++) {
    const z=9-rand()**1.7*88, side=rand()<.5?-1:1;
    let x=side*(1.72+rand()**1.8*14);
    if(x>2.60&&x<4.38)x+=2;
    const h=.10+rand()*.45;
    place(tracks,blades,grassMat,greens[i%5],x,-.10,z,h*.84,h,1,0,rand()*Math.PI);
  }
  const poleX=-1.90, poleZ=-4.0;
  place(crossing,rod,enamel,"#4e5656",poleX,1.90,poleZ,.125,3.85,.125);
  for(let i=0;i<9;i++) place(crossing,rod,soft,"#e1b459",poleX,.30+i*.38,poleZ,.129,.19,.129);
  for(const a of [-.71,.71]) {
    place(crossing,block,soft,"#e6b953",poleX,3.48,poleZ,1.13,.16,.084,0,0,a);
    for(const dx of [-.38,0,.38]) place(crossing,block,enamel,"#4a5052",poleX+dx*Math.cos(a),3.48+dx*Math.sin(a),poleZ+.057,.16,.16,.031,0,0,a);
  }
  const lamps=[];
  for(const side of [-1,1]) {
    const x=poleX+side*.34;
    place(crossing,rod,enamel,"#333c48",x,2.90,poleZ,.65,.33,.65,Math.PI/2);
    const bulb=material({rimK:.10,shade:"#ad6555"});
    lamps.push(bulb);
    place(crossing,rod,bulb,"#aa4039",x,2.90,poleZ+.193,.41,.059,.41,Math.PI/2);
    place(crossing,round,enamel,"#3e484b",x,3.16,poleZ+.168,.60,.11,.28,-.08);
  }
  place(crossing,block,enamel,"#e6b54f",-.12,.89,poleZ-1,3.80,.11,.10);
  for(let i=0;i<10;i++) place(crossing,block,enamel,"#4a5457",-1.88+i*.40,.89,poleZ-.94,.19,.11,.025);
  const views={interior,window:windowSeat,passing,tracks};
  bake();
  const fog=new T.Fog(palette.fog,12,110);
  const originalFog=scene.fog;
  function frameCamera(f, x,y,z, tx,ty,tz, fov) {
    camera.position.set(x,y,z); camera.up.set(0,1,0);camera.lookAt(tx,ty,tz);camera.fov=fov;
  }
  function tunnelWall(f) {
    back2d.fillStyle="#152533";back2d.fillRect(0,0,f.W,f.H);
    const h=f.H, pitch=h*.44, offset=(f.shot.lt*pitch*3)%pitch;
    for(let x=-offset;x<f.W+pitch;x+=pitch) {
      back2d.fillStyle="#1d3340";back2d.fillRect(x,h*.24,pitch*.024,h*.65);
      back2d.fillStyle="#936d58";back2d.fillRect(x,h*.46,pitch*.39,h*.012);
    }
  }
  return {
    update(f) {
      const {key, var:variant,lt}=f.shot;
      for(const [name,g] of Object.entries(views)) g.visible=name===key;
      scene.fog=key==="window"?null:fog;
      const sway=Math.sin(f.t*1.7)*.014;
      if(key==="interior") {
        fog.color.set("#afb9be");fog.near=7;fog.far=27;
        const low=variant==="low";
        frameCamera(f,low?-.66:.27,low?.60:1.19,1.55-lt*.58,low?-.96:-.15,low?.74:1.28,-8,low?61:65);
        camera.rotateZ(sway*.49);
        bands.position.z=f.beatPhase*2.48;
        kit.tick(f,aisleDust);
        kit.look({rays:.32,rayX:.08,rayY:.36,leak:.085+f.pulse*.055,leakX:.02,leakY:.40,glow:.28,tilt:.15,focus:.50,bloom:.65});
      } else if(key==="window") {
        const close=variant==="reflection", dark=variant==="tunnel"&&f.t>=68.554;
        if(dark) tunnelWall(f); else landscape(f,day,lt+1.7);
        poles.visible=!dark;poles.position.x=-((lt*5.8+3.1)%6.8);
        const focus=close?.47:0, camZ=close?2.29:3.32;
        frameCamera(f,.22+focus+sway,1.53+sway,camZ,focus,1.62,0,close?40:43);
        ghost.position.set(.47+.025*Math.sin(f.t*1.8),1.59+.024*Math.sin(f.t*2),.245);
        ghost.rotation.z=.04*Math.sin(f.t*1.9);
        reflection.uniforms.uOpacity.value=close?.64:dark?.40:.45;
        kit.tick(f,windowDust);
        kit.look({bloom:close?.7:.55,glow:dark?.12:.24,rays:dark?.01:.22,rayX:.72,rayY:.33,
          leak:dark?.004:close?.13:.045,leakX:.73,leakY:.26,tilt:.12,focus:.51,
          exposure:dark?.48+.18*f.downPulse:.90,sat:close?.42:1.01,gain:close?[1.17,.91,.65]:[.97,1,.99]});
      } else if(key==="passing") {
        landscape(f,day,.36+.12*lt,-.10);
        fog.color.set("#c4d2cd");fog.near=12;fog.far=46;
        nearTrain.position.set(-5.45+(lt-.67)*4.6,.0,0);
        farTrain.position.set(5.82-(lt-.67)*5.0,1.34,-4.4);
        trainGlass.uniforms.uEmissive.value.setRGB(.03+f.fastPulse*.23,.06+f.fastPulse*.22,.08+f.fastPulse*.17);
        frameCamera(f,3.1,1.44+sway,10.2,0,1.58,-1.2,41);
        kit.tick(f,passingDust);
        kit.look({rays:.19,rayX:.20,rayY:.33,leak:.065+f.fastPulse*.04,leakX:.16,leakY:.35,glow:.24,tilt:.14,focus:.51});
      } else if(key==="tracks") {
        const gate=variant==="gate",dusk=variant==="dusk";
        landscape(f,dusk?sunset:day,.14+lt*.018,-.13);
        fog.color.set(dusk?"#c6a28e":"#bed0bc");fog.near=dusk?5:14;fog.far=dusk?49:80;
        crossing.visible=gate;
        if(gate) frameCamera(f,-.54,1.61,-.35-lt*.18,poleX,2.64,poleZ,43);
        else if(dusk) frameCamera(f,3.61,.82,2.2-lt*.5,2.8,1.00,-9.6,48);
        else frameCamera(f,.05,.75,3.8-lt*.77,-.12,.98,-15,57);
        for(let i=0;i<2;i++){
          const on=(Math.floor(f.beat)%2)===i;
          lamps[i].uniforms.uEmissive.value.setRGB(on?2.6:.06,on?.065:.016,on?.035:.02);
        }
        meadowMat.uniforms.uColor.value.set(dusk?"#e6bb94":"#ffffff");
        grassMat.uniforms.uColor.value.set(dusk?"#f6cb99":"#ffffff");
        kit.tick(f,trackDust,air);
        kit.look({rays:dusk?.45:.20,rayX:dusk?.37:.16,rayY:.38,leak:dusk?.25:.055,leakX:dusk?.34:.14,leakY:.37,
          glow:dusk?.33:.25,tilt:gate?.17:.10,focus:.48,sat:dusk?1.06:1.02,gain:dusk?[1.18,.89,.77]:[1,1.01,.96]});
      }
    },
    setVisible(on) {root.visible=on;},
    dispose() {
      scene.remove(root);scene.fog=originalFog;
      for(const mesh of instances) mesh.dispose();
      for(const geometry of allocated) geometry.dispose();
    }
  };
}
