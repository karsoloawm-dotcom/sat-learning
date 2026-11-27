/* Dream Lantern's cloud sea. The atlas stores light, not a particular time of day:
   each depth plane can catch a different colour from the same rising light. */
const TAU = Math.PI * 2;
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x) };
const mix = (a, b, t) => a + (b - a) * t;
const lens = 2 * Math.tan(46 * Math.PI / 360);

function random(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 };
}

// The first colour in a pair fills the unlit paper; the second catches the light.
const skies = {
  night: {
    sky: ['#010414', '#030b21', '#0e2044', '#344b70', '#997662'],
    far: ['#394862', '#aa9c9e'], middle: ['#293752', '#8393a9'], near: ['#152239', '#536785'],
    mist: '#afa0ad', sun: '#ffa368', power: .125
  },
  approach: {
    sky: ['#02051a', '#070e27', '#10264a', '#2d4f73', '#745d74'],
    far: ['#384566', '#9387a5'], middle: ['#1b3153', '#727998'], near: ['#10182c', '#4c597a'],
    mist: '#737eaa', sun: '#ac9dce', power: .04
  },
  split: {
    sky: ['#010a23', '#071b40', '#15426e', '#287897', '#73b9bc'],
    far: ['#25617f', '#9ee1dd'], middle: ['#15344e', '#66bfcd'], near: ['#091b32', '#4488ac'],
    mist: '#54bbe0', sun: '#77dcff', power: .08
  },
  day: {
    sky: ['#164dae', '#175ec4', '#328ad5', '#74bfec', '#b8dbec'],
    far: ['#94b4d7', '#fffeeb'], middle: ['#7795c4', '#fff7e8'], near: ['#607dae', '#fffbe7'],
    mist: '#e3effa', sun: '#f5faff', power: .065
  },
  indigo: {
    sky: ['#090b23', '#1b1a42', '#30345b', '#514469', '#766985'],
    far: ['#49415f', '#9d8195'], middle: ['#2c2a4b', '#6e5c76'], near: ['#1d2037', '#51495e'],
    mist: '#716988', sun: '#e4bbaa', power: .04
  },
  teal: {
    sky: ['#061d31', '#123b4c', '#285c64', '#4e8384', '#89a59e'],
    far: ['#4a717e', '#b4cdc2'], middle: ['#254a59', '#82a9a6'], near: ['#183640', '#63878c'],
    mist: '#90c5bb', sun: '#a7eee4', power: .07
  },
  dusk: {
    sky: ['#28264e', '#555284', '#a26d9b', '#ef9eaf', '#ffd4ad'],
    far: ['#a57e97', '#ffd0bc'], middle: ['#755a7f', '#f3acaf'], near: ['#4a405f', '#bc879c'],
    mist: '#f3c6bf', sun: '#ffb9a3', power: .15
  },
  dawn: {
    sky: ['#514b78', '#7b7498', '#d59da5', '#f6c397', '#ffe29e'],
    far: ['#ad919b', '#ffe0ac'], middle: ['#957181', '#ffd09a'], near: ['#554660', '#dd9f91'],
    mist: '#ffdcc3', sun: '#ffdea8', power: .22
  },
  twilight: {
    sky: ['#393155', '#6c5984', '#b67b94', '#f2ae99', '#ffdb9c'],
    far: ['#a28498', '#ffdbad'], middle: ['#846078', '#f6bba4'], near: ['#53425f', '#ce969c'],
    mist: '#ffd3b6', sun: '#ffce95', power: .19
  },
  fire: {
    sky: ['#010613', '#081226', '#0c1b32', '#263047', '#604354'],
    far: ['#343346', '#98756e'], middle: ['#222638', '#785859'], near: ['#101b2d', '#4d404b'],
    mist: '#866b73', sun: '#ff9146', power: .10
  }
};

function skyName(key, variant) {
  switch (key) {
    case 'cometsplit': return variant === 'approach' ? 'approach' : 'split';
    case 'bluesky': return 'day';
    case 'meteor': return variant === 'teal' ? 'teal' : 'indigo';
    case 'twilight': return variant || 'twilight';
    case 'impact': return 'fire';
    default: return 'night';
  }
}

function paintStars(g, w, h, rnd) {
  // A dust river threads through the sparser, colder fixed stars.
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2300; i++) {
    const x = rnd(), band = i % 3 !== 0;
    const y = band ? .16 + x * .25 + (rnd() + rnd() + rnd() - 1.5) * .17 : rnd();
    const r = (.45 + Math.pow(rnd(), 9) * 1.35) * w / 1280;
    g.fillStyle = i % 7 === 0 ? '#ffe2b3' : i % 3 === 0 ? '#a8ceff' : '#e5eaff';
    g.globalAlpha = (.12 + rnd() * (band ? .44 : .79)) * clamp((.63 - y) * 3.9);
    g.fillRect(x * w, y * h, r, r);
    if (r > w / 655) {
      g.globalAlpha *= .42;
      g.fillRect(x * w - r, y * h + r * .35, r * 3, r * .32);
      g.fillRect(x * w + r * .35, y * h - r, r * .32, r * 3);
    }
  }
  g.globalAlpha = 1;
}

function paintIon(g, w, h, rnd) {
  // Many filaments share a nucleus. Their tips disperse into the solar wind.
  for (let i = 0; i < 104; i++) {
    const start = rnd() ** 2 * .67, fan = (rnd() - .5) * .62;
    const width = (.003 + rnd() ** 3 * .07), phase = rnd() * TAU;
    const gradient = g.createLinearGradient(w * start, 0, w * .96, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(.3, 'rgba(255,255,255,.12)');
    gradient.addColorStop(.82, 'rgba(255,255,255,.65)');
    gradient.addColorStop(1, '#fff');
    g.fillStyle = gradient;
    g.beginPath();
    for (const direction of [1, -1]) {
      for (let j = 0; j <= 32; j++) {
        const t = direction === 1 ? j / 32 : 1 - j / 32, d = 1 - t;
        const x = mix(start, .965, t);
        const y = .5 + d * (fan + .13 * Math.sin(4 * d + phase)) - .12 * d * d;
        const yy = y + direction * width * Math.sin(Math.PI * t) * d;
        if (j === 0 && direction === 1) g.moveTo(w * x, h * yy);
        else g.lineTo(w * x, h * yy);
      }
    }
    g.fill();
  }
}

function paintCorona(g, w, h) {
  g.translate(w / 2, h / 2);
  const r = w / 2, aura = g.createRadialGradient(0, 0, 0, 0, 0, r);
  for (const [p, a] of [[0, 1], [.045, 1], [.09, .69], [.19, .23], [.48, .047], [1, 0]]) {
    aura.addColorStop(p, 'rgba(255,255,255,' + a + ')');
  }
  g.fillStyle = aura; g.fillRect(-r, -r, w, h);
  for (let k = 0; k < 4; k++) {
    const reach = (k % 2 ? .35 : .8) * r;
    g.rotate(Math.PI / 4);
    const grad = g.createLinearGradient(-reach, 0, reach, 0);
    grad.addColorStop(0, 'transparent'); grad.addColorStop(.5, 'white'); grad.addColorStop(1, 'transparent');
    g.fillStyle = grad; g.beginPath(); g.moveTo(-reach, 0); g.lineTo(0, -r * .024);
    g.lineTo(reach, 0); g.lineTo(0, r * .024); g.fill();
  }
}

function paintCirrus(g, w, h, rnd) {
  for (let i = 0; i < 85; i++) {
    const origin = rnd(), y = rnd() ** 2 * .66 + .15 * Math.sin(origin * 6);
    const len = .025 + rnd() ** 2 * .48, thick = (.001 + rnd() ** 2 * .015) * h;
    const x = origin * w, yy = y * h;
    const grad = g.createLinearGradient(x, 0, x + len * w, 0);
    grad.addColorStop(0, 'transparent'); grad.addColorStop(.54, 'rgba(255,255,255,.65)'); grad.addColorStop(1, 'transparent');
    g.fillStyle = grad; g.beginPath(); g.moveTo(x, yy);
    g.quadraticCurveTo(x + len * w * .41, yy + thick * 3, x + len * w, yy - thick * 3);
    g.quadraticCurveTo(x + len * w * .45, yy + thick * 5.5, x, yy); g.fill();
  }
}

function paintSummit(g, w, h, rnd) {
  g.fillStyle = '#23213a'; g.beginPath(); g.moveTo(0, h);
  for (let i = 0; i <= 480; i++) {
    const x = i / 480;
    const y = .70 + .085 * Math.sin(x * 7.4 - 1.4) + .021 * Math.sin(19 * x) + .011 * Math.sin(46 * x) + rnd() * .004;
    g.lineTo(x * w, y * h);
  }
  g.lineTo(w, h); g.closePath(); g.fill();
  for (let i = 0; i < 240; i++) {
    const x = rnd(), y = .70 + .085 * Math.sin(x * 7.4 - 1.4) + .021 * Math.sin(19 * x) + .011 * Math.sin(46 * x);
    g.strokeStyle = i % 5 ? '#29263e' : '#6f5367'; g.lineWidth = .7 + rnd() * .8;
    const length = 2 + rnd() ** 3 * 12;
    g.beginPath(); g.moveTo(x * w, y * h + 2); g.quadraticCurveTo(x * w + 2, y * h - length, x * w + 7, y * h - length); g.stroke();
  }
  // Negative space between the two profiles holds the pillar.
  for (const [x, size, facing] of [[.424, .066, 1], [.583, .057, -1]]) {
    const y = .70 + .085 * Math.sin(x * 7.4 - 1.4) + .021 * Math.sin(19 * x) + .011 * Math.sin(46 * x);
    g.save(); g.translate(x * w, y * h + 1); g.scale(size * h * facing, size * h);
    g.fillStyle = '#1d1b32'; g.beginPath(); g.ellipse(.005, -.88, .087, .116, -.15, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-.06, -.79); g.quadraticCurveTo(-.14, -.73, -.12, -.45);
    g.lineTo(-.17, -.34); g.lineTo(-.105, -.31); g.lineTo(-.135, 0); g.lineTo(-.075, 0);
    g.lineTo(.006, -.31); g.lineTo(.066, 0); g.lineTo(.13, 0); g.lineTo(.072, -.43);
    g.lineTo(.11, -.49); g.lineTo(.077, -.72); g.lineTo(.05, -.79); g.closePath(); g.fill(); g.restore();
  }
}

function paintGrid(g, w, h, rnd) {
  // Two pylons, sagging conductors, a low field fence and windblown grass.
  g.scale(w / 1200, h / 675); g.strokeStyle = '#141828'; g.fillStyle = '#141828';
  function line(ax, ay, bx, by, weight) {
    g.lineWidth = weight; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  }
  function tower(x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    const levels = [[0, 1.4], [52, 6], [104, 8], [174, 10], [230, 15], [305, 26], [391, 45]];
    for (let i = 1; i < levels.length; i++) {
      const [a, aw] = levels[i - 1], [b, bw] = levels[i];
      for (const sign of [-1, 1]) {
        line(sign * aw, a, sign * bw, b, 3.8); line(sign * aw, a, -sign * bw, b, 1.8);
      }
      line(-bw, b, bw, b, 1.8);
    }
    for (const [yy, ww] of [[52, 41], [104, 55], [164, 64]]) {
      for (const sign of [-1, 1]) {
        line(0, yy - 17, sign * ww, yy + 2, 2.7); line(sign * ww, yy + 2, 0, yy + 13, 2.7);
        line(sign * (ww - 3), yy + 3, sign * (ww - 3), yy + 16, 2);
        for (let j = 0; j < 4; j++) line(sign * ww - 6, yy + 6 + j * 2.5, sign * ww, yy + 6 + j * 2.5, 1.5);
      }
    }
    g.restore();
  }
  tower(262, 140, 1.22); tower(967, 373, .50);
  for (const [yy, arm] of [[52, 41], [104, 55], [164, 64]]) {
    for (const side of [-1, 1]) {
      const x = 262 + side * arm * 1.22, y = 140 + (yy + 16) * 1.22;
      g.lineWidth = 1.2; g.beginPath(); g.moveTo(-10, y - 33); g.quadraticCurveTo(120, y + 15, x, y);
      g.quadraticCurveTo(631, y + 173, 967 + side * arm * .50, 373 + (yy + 16) * .50);
      g.quadraticCurveTo(1129, 460 + yy * .4, 1210, 402 + yy * .42); g.stroke();
    }
  }
  g.beginPath(); g.moveTo(0, 675); g.lineTo(0, 580);
  for (let i = 0; i <= 1200; i += 4) g.lineTo(i, 572 - 15 * Math.sin(i * .005) - rnd() * 7);
  g.lineTo(1200, 675); g.fill();
  for (let i = 0; i < 14; i++) {
    const x = i * 107 - 44, y = 538 + 9 * Math.sin(i * .7); line(x, y + 53, x + 3, y, 4.2);
    for (const offset of [7, 23]) {
      g.beginPath(); g.lineWidth = 1.4; g.moveTo(x + 3, y + offset);
      g.quadraticCurveTo(x + 59, y + offset + 6, x + 110, 538 + 9 * Math.sin((i + 1) * .7) + offset); g.stroke();
    }
  }
}

export async function create({ THREE, scene, camera, ctx2d, back2d, kit, tier, seed = 1, timing }) {
  const [image, deckImage] = await Promise.all(['cloud-relief', 'cloud-deck'].map(async name => {
    const img = new Image();
    img.src = new URL('./sky/' + name + '.webp', import.meta.url).href;
    await img.decode(); return img;
  }));
  const root = new THREE.Group(), owned = [], rnd = random(seed + 264);
  const quality = { saver: [16, 150, 768], smooth: [240, 500, 1024], ultra: [1024, 1500, 1280] }[tier];
  const [hazeCount, tailCount, paperWidth] = quality;
  const geometry = g => (owned.push(g), g);
  const quad = geometry(new THREE.PlaneGeometry(1, 1));
  const shape = new THREE.Object3D();
  const ink = (map, options = {}) => {
    const mat = kit.toon({ light: '#fff', ambient: 0, rimK: 0, opacity: .999, fog: false, ...options });
    mat.depthWrite = false;
    if (map) { mat.uniforms.uMap.value = map; mat.uniforms.uMapOn.value = 1 }
    return mat;
  };
  function card(map, order, additive = false) {
    const mesh = new THREE.Mesh(quad, ink(map));
    if (additive) mesh.material.blending = THREE.AdditiveBlending;
    mesh.renderOrder = order; mesh.frustumCulled = false; root.add(mesh); return mesh;
  }
  const palette = kit.palette('intro');
  const dome = kit.sky({ stops: palette.sky, stars: .045, sun: 0 });
  // Preserve target alpha under the dome so the back2d star painting shows through.
  Object.assign(dome.material, { transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
  dome.rotation.x = -.12; root.add(dome);
  const ramps = Object.fromEntries(Object.entries(skies).map(([k, p]) => [k, kit.ramp(p.sky)]));
  const stars = kit.paint(paperWidth, paperWidth / 2, (g, w, h) => paintStars(g, w, h, rnd)).image;
  const cirrus = card(kit.paint(768, 320, (g, w, h) => paintCirrus(g, w, h, rnd)), -8);
  const deck = card(kit.paint(960, 320, (g, w, h) => {
    g.drawImage(deckImage, 0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const fade = g.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, 'transparent'); fade.addColorStop(.08, '#fffb'); fade.addColorStop(.16, '#fff');
    g.fillStyle = fade; g.fillRect(0, 0, w, h);
  }), -7);
  const haze = kit.haze({ count: hazeCount, box: [200, 3, 51], center: [0, -8.2, -79], size: tier === 'ultra' ? 4.3 : 7.5,
    opacity: .38, drift: [.022, 0, 0], renderOrder: -6, seed: seed + 43 });
  root.add(haze);
  const tiles = Array.from({ length: 6 }, (_, i) => kit.paint(640, 352, g => {
    if (i >= 3) { g.translate(640, 0); g.scale(-1, 1) }
    g.drawImage(image, 0, (i % 3) * 352, 640, 352, 0, 0, 640, 352);
  }));
  const bands = Array.from({ length: 6 }, (_, i) => {
    const n = [8, 7, 6, 5, 4, 3][i];
    const mesh = new THREE.InstancedMesh(quad, ink(tiles[i % 3]), n);
    mesh.frustumCulled = false; mesh.renderOrder = i + 1; root.add(mesh); owned.push(mesh);
    return mesh;
  });
  const recipes = new Map();
  function cloudLayout(name, aspect) {
    // Rows converge at the horizon. Near clouds cross the lens much faster.
    const cacheKey = name + ':' + aspect;
    if (recipes.has(cacheKey)) return recipes.get(cacheKey);
    const rows = [], day = name === 'day', night = name === 'night';
    const rng = random(seed + { day: 99, night: 151, teal: 37, indigo: 48, split: 192, approach: 281, fire: 61 }[name] || seed + 22);
    for (let row = 0; row < bands.length; row++) {
      const n = bands[row].count, z = [112, 84, 60, 42, 29, 18][row];
      const height = lens * z, width = height * aspect;
      const mats = [];
      for (let i = 0; i < n; i++) {
        const u = (i - .55) / (n - 2), jitter = (rng() - .5) * .33 / n;
        const x = u + jitter;
        let y = [.631, .676, .723, .805, .93, 1.11][row] + (rng() - .5) * (.022 + .012 * row);
        let w = (1.8 + rng() * .65) * width / (n - 2);
        let h = height * [.093, .15, .25, .33, .46, .68][row] * (.84 + rng() * .35);
        if (day) {
          const wall = Math.exp(-Math.pow((x - .72) / .25, 2));
          y -= .030 + wall * [.04, .10, .17, .19, .04, 0][row];
          h *= 1.39 + wall * 1.7;
        } else if (name === 'teal' || name === 'indigo') {
          const slope = name === 'teal' ? x - .5 : .5 - x;
          y += .08 + slope * .26;
          if (row === 3) { y = (name === 'teal' ? .02 : -.16) + slope * .32; h *= .60; }
        } else if (name === 'split') {
          y += Math.sin(x * 8.4 + row * .37) * .06 - .045;
        } else if (night) {
          y -= Math.cos(x * 6 + row * .7) * row * .008;
        }
        w = Math.max(w, h * 1.12);
        shape.position.set((x - .5) * width, (.5 - y) * height, -z);
        shape.rotation.set(0, 0, (rng() - .5) * .07);
        shape.scale.set(w, h, 1);
        shape.updateMatrix(); mats.push(shape.matrix.clone());
      }
      rows.push(mats);
    }
    // Viewport widths can vary every frame in the film.
    if (recipes.size >= 8) recipes.delete(recipes.keys().next().value);
    recipes.set(cacheKey, rows); return rows;
  }
  const haloMap = kit.paint(192, 192, paintCorona);
  const ionMap = kit.paint(768, 176, (g, w, h) => paintIon(g, w, h, rnd));
  function comet() {
    const group = new THREE.Group(), tail = card(ionMap, -4, true), head = card(haloMap, -3, true);
    const dust = kit.particles({ count: tailCount, kind: 'spark', box: [2, 2, 2], center: [0, 0, 0],
      size: .078, drift: [0, 0, 0], wobble: 0, intensity: 2.2, color: '#ddf5ff', color2: '#83a8ff',
      on: 'fast', twinkle: .75, seed: seed + 53 });
    const pos = dust.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const d = rnd() ** 1.5;
      pos.setXYZ(i, -d * .97, d * (.024 * Math.sin(8 * d) + (rnd() + rnd() - 1) * .10), (rnd() - .5) * .04);
    }
    pos.needsUpdate = true; dust.renderOrder = -3; group.add(tail, head, dust); root.add(group);
    return { group, tail, head, dust };
  }
  const main = comet(), fragment = comet();
  const beamMap = kit.paint(160, 384, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    for (const [s, a] of [[0, 0], [.27, .022], [.43, .18], [.489, .62], [.50, 1], [.511, .62], [.57, .18], [.73, .022], [1, 0]]) {
      grad.addColorStop(s, 'rgba(255,255,255,' + a + ')');
    }
    g.fillStyle = grad; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'destination-in';
    const fade = g.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, 'transparent'); fade.addColorStop(.37, '#fffb'); fade.addColorStop(.91, '#fff'); fade.addColorStop(1, 'transparent');
    g.fillStyle = fade; g.fillRect(0, 0, w, h);
  });
  const beam = card(beamMap, -3, true), sundog = card(haloMap, -2, true);
  const ridge = card(kit.paint(paperWidth, Math.round(paperWidth * .5625), (g, w, h) => paintSummit(g, w, h, rnd)), 10);
  const pylon = card(kit.paint(paperWidth, Math.round(paperWidth * .5625), (g, w, h) => paintGrid(g, w, h, rnd)), 10);
  const flame = new THREE.Group(), fireGlow = card(haloMap, 7, true);
  for (let i = 0; i < 7; i++) {
    const lobe = card(tiles[i % 3], 7 + i * .025);
    const a = i * 2.4;
    lobe.position.set(Math.cos(a) * .25 * Math.sqrt(i / 6), Math.sin(a) * .15 + .08, 0);
    lobe.scale.set(.67 - .045 * i, .66 - .035 * i, 1);
    lobe.material.uniforms.uColor.value.setRGB(3.9, .86, .052);
    lobe.material.uniforms.uEmissive.value.setRGB(.65, .075, .024);
    flame.add(lobe);
  }
  root.add(flame);
  const embers = kit.particles({ count: Math.floor(tailCount * .4), kind: 'spark', center: [0,0,0], box: [9, 7, 2],
    color: '#ffb148', color2: '#fff0b6', size: .077, drift: [.15,.52,0], on: 'fast', intensity: 3, seed: seed + 12 });
  embers.renderOrder = 8; root.add(embers);
  const paper = kit.paint(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#ad4033'); gr.addColorStop(.47, '#ffb75d'); gr.addColorStop(.68, '#ffdd99'); gr.addColorStop(1, '#bf573e');
    g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#963e36';
    for (let y = 4; y < h; y += 20) g.fillRect(0, y, w, 2);
    g.fillStyle = '#5b3943'; g.fillRect(0, 0, w, 7); g.fillRect(0, h - 7, w, 7);
  });
  const body = geometry(new THREE.LatheGeometry([[0,-.44],[.20,-.44],[.33,-.35],[.40,.04],[.32,.37],[.20,.45],[0,.45]]
    .map(([x,y]) => new THREE.Vector2(x,y)), 12));
  const lanternMat = ink(paper, { section: 'chorus1', light: '#fff8dd', shade: '#91625d', rimK: .12 });
  const lanterns = [0, 1].map(() => { const m = new THREE.Mesh(body, lanternMat); m.renderOrder = 7; root.add(m); return m });
  scene.add(root);

  const du = dome.material.uniforms;
  const dark = new THREE.Color();
  let lastName = '', lastAspect = 0;
  function dressClouds(name, aspect) {
    if (name === lastName && aspect === lastAspect) return;
    const p = skies[name], rows = cloudLayout(name, aspect);
    // Draw planes in depth order, including the transparent sides of mirrored instances.
    bands.forEach((m, i) => {
      const [shadow, light] = i < 2 ? p.far : i < 4 ? p.middle : p.near;
      const u = m.material.uniforms;
      u.uEmissive.value.set(shadow); u.uColor.value.set(light).sub(dark.set(shadow));
      u.uMap.value = tiles[(name === 'day' ? (i === 0 ? 1 : 2) : i % 2) + (i % 3 === 1 ? 3 : 0)];
      rows[i].forEach((mat, j) => m.setMatrixAt(j, mat)); m.instanceMatrix.needsUpdate = true;
    });
    du.uRamp.value = ramps[name]; du.uSunCol.value.set(p.sun); du.uSun.value = p.power;
    haze.material.uniforms.uTop.value.set(p.mist); haze.material.uniforms.uBot.value.set(p.far[0]);
    cirrus.material.uniforms.uColor.value.set(p.mist);
    deck.material.uniforms.uColor.value.set(p.middle[1]).multiplyScalar(.75);
    deck.material.uniforms.uEmissive.value.set(p.middle[0]);
    lastName = name; lastAspect = aspect;
  }
  function place(obj, x, y, z, aspect) {
    const h = lens * z; obj.position.set((x - .5) * h * aspect, (.5 - y) * h, -z);
  }
  function paintStreak(f, start, right) {
    const q = (f.t - start) / .55;
    if (q < -.03 || q >= 1) return;
    const u = clamp(q), x = (right ? .60 : .19) + .19 * u, y = .20 + .15 * u;
    const dx = Math.min(f.W * .13, f.H * .24), dy = f.H * .072;
    const px = x * f.W, py = y * f.H;
    ctx2d.save(); ctx2d.globalAlpha = (1 - u) * (.72 + .28 * f.fastPulse);
    const g = ctx2d.createLinearGradient(px - dx, py - dy, px, py);
    g.addColorStop(0, 'transparent'); g.addColorStop(.80, '#addaff'); g.addColorStop(1, '#fff4c7');
    ctx2d.fillStyle = g; ctx2d.beginPath(); ctx2d.moveTo(px - dx, py - dy);
    ctx2d.lineTo(px, py - f.dpr); ctx2d.lineTo(px + f.dpr, py); ctx2d.fill(); ctx2d.restore();
  }
  function drawComet(c, f, x, y, length, angle, width, color, intensity, headSize) {
    const z = 68, h = lens * z, aspect = f.W / f.H;
    place(c.group, x, y, z, aspect); c.group.rotation.z = angle;
    const span = length * h, thick = width * h;
    c.tail.scale.set(span, thick, 1); c.tail.position.x = span * -.465;
    c.tail.material.uniforms.uColor.value.set(color).multiplyScalar(intensity);
    c.head.scale.setScalar(headSize * h);
    c.head.material.uniforms.uColor.value.set(color).multiplyScalar(intensity * 2.7);
    c.dust.scale.set(span, thick * 2.3, 1);
    c.dust.material.uniforms.uCol.value.set(color).multiplyScalar(2.3);
    c.dust.material.uniforms.uSize.value = .042 + .14 * headSize;
    kit.tick(f, c.dust);
  }
  const splitHit = timing.hits.find(t => Math.abs(t - 24.465) < .03) ?? 24.465;
  const impactStart = timing.beats.findIndex(t => t >= 104.621 - .025);
  return {
    update(f) {
      const { key, var: variant, u, lt } = f.shot;
      const name = skyName(key, variant), aspect = Math.max(.001, f.W / f.H);
      const isNight = name === 'night' || name === 'approach' || name === 'split';
      const twilight = key === 'twilight', impact = key === 'impact', day = name === 'day';
      const shard = key === 'meteor', approach = name === 'approach';
      dressClouds(name, aspect);
      camera.fov = approach ? mix(47, 42, ease(u)) : name === 'split' ? mix(44, 48, ease(u)) : 46;
      const glide = name === 'night' ? 1.9 : .34;
      camera.position.set(twilight ? 0 : .24 * Math.sin(lt * .47) * glide,
        twilight ? 0 : .055 * Math.sin(lt * .68), twilight ? 0 : -.23 * lt * glide);
      camera.rotation.set(0, 0, 0);
      dome.position.copy(camera.position);
      const lightX = twilight ? (variant === 'dawn' ? 1 : variant === 'dusk' ? 0 : .51) : impact ? .67 : day ? .24 : .62;
      du.uSunDir.value.set((lightX - .5) * aspect * lens, day ? .28 : .022, -1).normalize();
      du.uStars.value = isNight ? .02 + .065 * f.pulse : 0;
      if (isNight) {
        back2d.save(); back2d.globalAlpha = (name === 'split' ? .47 : .87) + .10 * f.pulse;
        const w = Math.max(f.W * 1.045, f.H * 1.48);
        back2d.drawImage(stars, (f.W - w) * .5 + f.H * .005 * Math.sin(lt * .29), 0, w, f.H);
        back2d.restore();
      }
      if (name === 'night') { paintStreak(f, 7.519, false); paintStreak(f, 12.80, true) }
      cirrus.position.set(Math.sin(f.t * .07) * .4, 0, -125);
      cirrus.scale.set(125 * lens * aspect * 1.04, 125 * lens, 1);
      cirrus.material.uniforms.uOpacity.value = day ? .29 : twilight ? .20 : .10;
      place(deck, .5, .816, 116, aspect); deck.scale.set(lens * 116 * aspect * 1.07, lens * 116 * .47, 1);
      kit.tick(f, dome, haze);
      main.group.visible = isNight || shard;
      fragment.group.visible = name === 'split' && f.t >= splitHit;
      let rayX = lightX, rayY = day ? .28 : .60;
      if (main.group.visible) {
        const split = name === 'split';
        let x, y, length, angle, width, hue, strength, size;
        if (shard) {
          const teal = name === 'teal';
          x = teal ? .42 + .27 * u : .55 + .06 * u;
          y = teal ? .47 - .16 * u : .28 + .28 * u;
          angle = teal ? .43 : -1.16; length = teal ? .86 : .51;
          width = teal ? .045 : .035; hue = teal ? '#b6fffc' : '#ff9a50'; strength = 3.1; size = .095;
        } else {
          x = name === 'night' ? .26 + lt * .015 : split ? .65 + .10 * ease(u) : .48 + .12 * ease(u);
          y = name === 'night' ? .25 + .007 * lt : split ? .39 + .065 * u : .265 + .095 * u;
          length = name === 'night' ? .17 : split ? .99 : mix(.29, .85, ease(u));
          angle = name === 'night' ? -.31 : -.29; width = name === 'night' ? .024 : .105;
          hue = split ? '#8adfff' : '#a4cfff'; strength = name === 'night' ? 1.55 : 2.55; size = name === 'night' ? .052 : .15;
        }
        drawComet(main, f, x, y, length, angle, width, hue, strength, size);
        if (fragment.group.visible) {
          const s = ease((f.t - splitHit) / 1.45);
          drawComet(fragment, f, x - .028 - .045 * s, y + .009 + .135 * s, .18 + .39 * s,
            -.30 - .33 * s, .056, '#ffa5c4', 2.2 + .55 * f.hit, .094);
        }
        rayX = x; rayY = y;
      }
      beam.visible = sundog.visible = twilight;
      if (twilight) {
        place(beam, lightX, .316, 67, aspect); beam.scale.set(lens * 67 * .115, lens * 67 * .72, 1);
        beam.material.uniforms.uColor.value.setRGB(2.4, .73, 1.02).multiplyScalar(.84 + .31 * f.downPulse);
        place(sundog, lightX, .602, 76, aspect); sundog.scale.setScalar(76 * lens * .28);
        sundog.material.uniforms.uColor.value.setRGB(3, 1.14, .75);
        rayX = .5;
      }
      ridge.visible = name === 'twilight'; pylon.visible = flame.visible = fireGlow.visible = embers.visible = impact;
      const cutout = impact ? pylon : ridge;
      if (cutout.visible) {
        place(cutout, .5, .53, 13, aspect);
        cutout.scale.set(13 * lens * Math.max(aspect * 1.07, 1.06), 13 * lens * 1.04, 1);
      }
      if (impact) {
        const stepped = Math.max(0, Math.floor(f.beat) - impactStart);
        const grow = .15 + .11 * ease(u) + .038 * Math.min(3, stepped) + .025 * f.downPulse;
        place(flame, .66, .745 - grow * .25, 23, aspect); flame.scale.set(23 * lens * grow, 23 * lens * grow * 1.75, 1);
        place(fireGlow, .66, .707, 24, aspect); fireGlow.scale.setScalar(24 * lens * grow * 2.05);
        fireGlow.material.uniforms.uColor.value.setRGB(3.4, .73, .095);
        place(embers, .66, .53, 22, aspect); kit.tick(f, embers);
      }
      for (let i = 0; i < lanterns.length; i++) {
        const obj = lanterns[i]; obj.visible = day;
        if (day) {
          place(obj, i ? .885 : .14, (i ? .30 : .40) - lt * .011 + .004 * Math.sin(f.t + i), 26 + 8 * i, aspect);
          obj.rotation.set(.06, lt * .19 + i, Math.sin(lt * 1.2 + i) * .09);
          obj.scale.setScalar(i ? .59 : .82);
        }
      }
      kit.look({ rays: impact ? .47 : twilight ? .34 : .23, rayX, rayY, glow: day ? .12 : .24,
        bloom: impact ? .90 : .74, threshold: day ? .91 : .57, tilt: .10, focus: .51,
        lift: isNight ? [.003, .006, .017] : impact ? [.004, .007, .018] : twilight ? [.018, .011, .028] : [.008, .015, .024],
        chroma: .12, leak: impact ? .014 + .025 * f.downPulse : 0, leakX: .66, leakY: .70 });
    },
    setVisible(on) { root.visible = on },
    dispose() { scene.remove(root); for (const o of owned) o.dispose(); recipes.clear() }
  };
}
