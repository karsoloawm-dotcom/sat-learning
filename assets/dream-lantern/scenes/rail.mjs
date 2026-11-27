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
  const paper = paintMaterial(192,288,lanternArt,{opacity:.70, rimK:0, shade:"#ffd5a1", emissive:new T.Color(.42,.22,.06)});
  paper.depthWrite=false;
  if (!saver) place(ghost,card,paper,"#ffedd2",0,0,0,.81,1.24,1);
  const cord = paintMaterial(160,192,(g,w,h)=>{
    g.scale(w/160,h/192);
    for (const [color,lw] of [["#692d51",9],["#e6444c",6],["#ffba6c",1.6]]) {
      g.strokeStyle=color;g.lineWidth=lw;g.lineCap="round";g.setLineDash(lw<2?[4,4]:[]);
      g.beginPath();g.moveTo(66,13);g.bezierCurveTo(86,48,109,109,70,111);
      g.bezierCurveTo(21,108,64,53,80,91);g.bezierCurveTo(95,119,55,134,71,173);g.stroke();
    }
  },{opacity:.98,rimK:0,emissive:new T.Color(.22,.03,.02)});
  cord.depthWrite=false;
