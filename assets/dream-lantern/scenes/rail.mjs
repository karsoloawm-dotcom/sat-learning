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
