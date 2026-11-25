import * as THREE from 'three';

// Toy-scale instruments and studio gear (sized for ~1.15 m musicians). Builders return the meshes plus the
// anchor points the performers aim at, so animation never guesses where a drum head or fret is.

const cache = new Map<string, THREE.Material>();
export function M(color: string, rough = 0.6, metal = 0, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  const k = `${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  let m = cache.get(k);
  if (!m) cache.set(k, (m = new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: metal, ...extra })));
  return m;
}
export const CHROME = () => M('#d8dde3', 0.18, 1);
export const BLACK = () => M('#1c1b1f', 0.5);

export function mesh(geo: THREE.BufferGeometry, m: THREE.Material, parent?: THREE.Object3D, x = 0, y = 0, z = 0, shadow = true) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = shadow;
  o.receiveShadow = true;
  parent?.add(o);
  return o;
}

export function label(text: string, opts: { w?: number; h?: number; bg?: string; fg?: string; font?: string; size?: number } = {}) {
  const c = document.createElement('canvas');
  c.width = (opts.w ?? 256) * 2;
  c.height = (opts.h ?? 64) * 2;
  const x = c.getContext('2d')!;
  x.fillStyle = opts.bg ?? 'rgba(0,0,0,0)';
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = opts.fg ?? '#fff';
  x.font = `800 ${(opts.size ?? 30) * 2}px Nunito, sans-serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------------- Drum kit ----------------

export interface DrumPiece {
  obj: THREE.Object3D; // wobbles on hits
  hit: THREE.Vector3; // kit-local strike point
  hand: 'L' | 'R' | 'F';
  wobble: number;
  kind: 'drum' | 'cymbal' | 'kick' | 'hat';
}

export interface DrumKitProp {
  group: THREE.Group;
  pieces: Record<string, DrumPiece>;
  pitchToPiece: (p: number) => string;
  beater: THREE.Object3D;
  hatTop: THREE.Object3D;
  seatY: number;
}

export function buildDrumKit(shellColor = '#c2412f'): DrumKitProp {
  const group = new THREE.Group();
  group.name = 'drumkit';
  const shell = M(shellColor, 0.25, 0.1, { clearcoat: 1, clearcoatRoughness: 0.15 });
  const head = M('#d9cfbd', 0.9);
  const brass = M('#d9a441', 0.28, 0.85);
  const pieces: Record<string, DrumPiece> = {};

  const drum = (name: string, r: number, depth: number, x: number, y: number, z: number, tilt: number, hand: 'L' | 'R') => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.x = tilt;
    group.add(g);
    mesh(new THREE.CylinderGeometry(r, r, depth, 32), shell, g);
    mesh(new THREE.CylinderGeometry(r * 0.985, r * 0.985, 0.004, 32), head, g, 0, depth / 2 + 0.002, 0);
    for (const s of [-1, 1]) {
      const rim = mesh(new THREE.TorusGeometry(r, 0.006, 6, 32), CHROME(), g, 0, (s * depth) / 2, 0);
      rim.rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mesh(new THREE.BoxGeometry(0.008, depth * 0.6, 0.012), CHROME(), g, Math.cos(a) * (r + 0.006), 0, Math.sin(a) * (r + 0.006));
    }
    // Stand leg
    const leg = mesh(new THREE.CylinderGeometry(0.007, 0.007, y, 8), CHROME(), group, x, y / 2, z);
    leg.castShadow = false;
    const hit = new THREE.Vector3(0, depth / 2 + 0.004, r * 0.25).applyEuler(g.rotation).add(g.position);
    pieces[name] = { obj: g, hit, hand, wobble: 0, kind: 'drum' };
    return g;
  };

  const cymbal = (name: string, r: number, x: number, y: number, z: number, tilt: number, hand: 'L' | 'R') => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    group.add(g);
    const pts = [new THREE.Vector2(0.001, 0.012), new THREE.Vector2(r * 0.12, 0.012), new THREE.Vector2(r * 0.18, 0.004), new THREE.Vector2(r, -0.01), new THREE.Vector2(r, -0.013), new THREE.Vector2(0.001, -0.002)];
    const c = mesh(new THREE.LatheGeometry(pts, 40), brass, g);
    c.rotation.x = tilt;
    c.userData.baseX = tilt;
    mesh(new THREE.CylinderGeometry(0.006, 0.006, y, 8), CHROME(), group, x, y / 2, z).castShadow = false;
    const hit = new THREE.Vector3(0, 0.002, r * 0.65).applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt).add(g.position);
    pieces[name] = { obj: c, hit, hand, wobble: 0, kind: 'cymbal' };
    return c;
  };

  // Kick drum: lies on its side facing the audience.
  const kick = new THREE.Group();
  kick.position.set(0, 0.19, 0.43);
  kick.rotation.x = Math.PI / 2;
  group.add(kick);
  mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.28, 40), shell, kick);
  const front = mesh(new THREE.CylinderGeometry(0.186, 0.186, 0.004, 40), M('#1c1b1f', 0.6), kick, 0, -0.142, 0);
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.11, 32), new THREE.MeshStandardMaterial({ map: label('RoomTone', { w: 256, h: 256, bg: '#f3efe6', fg: '#c2412f', size: 46 }), roughness: 0.6 }));
  front.add(logo);
  logo.rotation.set(Math.PI / 2, 0, 0);
  logo.position.set(0, -0.003, 0);
  for (const s of [-1, 1]) mesh(new THREE.TorusGeometry(0.19, 0.008, 6, 40), CHROME(), kick, 0, (s * 0.28) / 2, 0).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    const spur = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 6), CHROME(), group, s * 0.17, 0.05, 0.5);
    spur.rotation.z = s * 0.6;
  }
  pieces.kick = { obj: kick, hit: new THREE.Vector3(0, 0.19, 0.29), hand: 'F', wobble: 0, kind: 'kick' };
  // Pedal + beater
  mesh(new THREE.BoxGeometry(0.06, 0.012, 0.16), BLACK(), group, -0.0, 0.015, 0.2).rotation.x = -0.18;
  const beater = new THREE.Group();
  beater.position.set(0, 0.04, 0.27);
  group.add(beater);
  mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 6), CHROME(), beater, 0, 0.07, 0);
  mesh(new THREE.SphereGeometry(0.018, 12, 8), M('#f3efe6'), beater, 0, 0.14, 0);
  beater.rotation.x = -0.5;

  drum('snare', 0.12, 0.07, 0.17, 0.4, 0.22, -0.12, 'L');
  drum('tom1', 0.09, 0.09, 0.09, 0.56, 0.37, -0.5, 'L');
  drum('tom2', 0.1, 0.1, -0.11, 0.56, 0.37, -0.5, 'R');
  drum('floor', 0.135, 0.16, -0.3, 0.33, 0.17, 0, 'R');
  cymbal('crash', 0.16, 0.32, 0.8, 0.42, -0.3, 'R');
  cymbal('ride', 0.18, -0.36, 0.72, 0.38, -0.2, 'R');

  // Hi-hat: two cymbals; the top one closes with the pedal.
  const hat = new THREE.Group();
  hat.position.set(0.34, 0.52, 0.18);
  group.add(hat);
  const hp = [new THREE.Vector2(0.001, 0.008), new THREE.Vector2(0.02, 0.008), new THREE.Vector2(0.12, -0.006), new THREE.Vector2(0.12, -0.009), new THREE.Vector2(0.001, 0)];
  mesh(new THREE.LatheGeometry(hp, 32), brass, hat).rotation.x = Math.PI;
  const hatTop = mesh(new THREE.LatheGeometry(hp, 32), brass, hat, 0, 0.018, 0);
  mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.52, 8), CHROME(), group, 0.34, 0.26, 0.18).castShadow = false;
  mesh(new THREE.BoxGeometry(0.05, 0.01, 0.13), BLACK(), group, 0.34, 0.012, 0.12);
  pieces.hat = { obj: hat, hit: new THREE.Vector3(0.34, 0.545, 0.25), hand: 'R', wobble: 0, kind: 'hat' };

  // Throne
  mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.06, 24), M('#2a2524', 0.8), group, 0, 0.3, -0.02);
  mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 8), CHROME(), group, 0, 0.14, -0.02);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const l = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6), CHROME(), group, Math.cos(a) * 0.07, 0.05, -0.02 + Math.sin(a) * 0.07);
    l.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
  }

  const map: Record<number, string> = {
    35: 'kick', 36: 'kick', 37: 'snare', 38: 'snare', 39: 'snare', 40: 'snare', 41: 'floor', 43: 'floor', 42: 'hat', 44: 'hat', 46: 'hat',
    45: 'tom2', 47: 'tom2', 48: 'tom1', 50: 'tom1', 49: 'crash', 57: 'crash', 51: 'ride', 53: 'ride', 56: 'ride',
  };
  return { group, pieces, pitchToPiece: (p) => map[p] ?? 'snare', beater, hatTop, seatY: 0.33 };
}

// ---------------- Guitar & bass ----------------

export interface StringedProp {
  group: THREE.Group;
  strings: THREE.Mesh[];
  tuning: number[]; // open-string MIDI notes, low to high
  scale: number; // nut-to-bridge
  nutX: number;
  stringY: (i: number) => number;
  topZ: number;
  strumX: number; // where the picking hand plays
  headX: number;
}

export function buildStringed(kind: 'guitar' | 'bass', color: string): StringedProp {
  const group = new THREE.Group();
  group.name = kind;
  const bass = kind === 'bass';
  const body = M(color, 0.22, 0.05, { clearcoat: 1, clearcoatRoughness: 0.1 });
  const wood = M('#8b5a3c', 0.55);
  const board = M('#3b2a20', 0.6);
  const s = bass ? 1.12 : 1;
  // Double-cutaway body outline (neck points +X).
  const sh = new THREE.Shape();
  sh.moveTo(-0.17 * s, 0);
  sh.bezierCurveTo(-0.17 * s, 0.12 * s, -0.06 * s, 0.13 * s, -0.01 * s, 0.08 * s);
  sh.bezierCurveTo(0.03 * s, 0.06 * s, 0.06 * s, 0.11 * s, 0.1 * s, 0.1 * s);
  sh.bezierCurveTo(0.12 * s, 0.09 * s, 0.07 * s, 0.04 * s, 0.07 * s, 0.0);
  sh.bezierCurveTo(0.07 * s, -0.04 * s, 0.1 * s, -0.07 * s, 0.08 * s, -0.09 * s);
  sh.bezierCurveTo(0.05 * s, -0.11 * s, 0.0, -0.06 * s, -0.03 * s, -0.08 * s);
  sh.bezierCurveTo(-0.08 * s, -0.13 * s, -0.17 * s, -0.12 * s, -0.17 * s, 0);
  const bodyGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 4, curveSegments: 24 });
  bodyGeo.translate(0, 0, -0.0175);
  mesh(bodyGeo, body, group);
  // Pickguard
  const pg = new THREE.Shape();
  pg.moveTo(-0.13 * s, -0.05 * s);
  pg.bezierCurveTo(-0.1 * s, 0.07 * s, 0.0, 0.06 * s, 0.04 * s, 0.03 * s);
  pg.lineTo(0.04 * s, -0.05 * s);
  pg.bezierCurveTo(0.0, -0.08 * s, -0.1 * s, -0.09 * s, -0.13 * s, -0.05 * s);
  mesh(new THREE.ShapeGeometry(pg), M('#f4efe6', 0.4), group, 0, 0, 0.027);

  const scale = bass ? 0.56 : 0.44;
  const bridgeX = -0.1 * s;
  const nutX = bridgeX + scale;
  const neckLen = nutX - 0.03;
  const width = bass ? 0.04 : 0.042;
  mesh(new THREE.BoxGeometry(neckLen, width, 0.02), wood, group, 0.03 + neckLen / 2, 0, 0.012);
  mesh(new THREE.BoxGeometry(neckLen - 0.005, width, 0.006), board, group, 0.03 + neckLen / 2, 0, 0.025);
  // Frets and inlays
  for (let n = 1; n <= 20; n++) {
    const x = nutX - scale * (1 - Math.pow(2, -n / 12));
    if (x < 0.035) break;
    mesh(new THREE.BoxGeometry(0.002, width, 0.003), CHROME(), group, x, 0, 0.029, false);
    if ([3, 5, 7, 9, 15, 17].includes(n) || n === 12) {
      const xm = nutX - scale * (1 - Math.pow(2, -(n - 0.5) / 12));
      mesh(new THREE.CircleGeometry(0.004, 10), M('#f4efe6', 0.3), group, xm, 0, 0.0285, false);
    }
  }
  // Headstock + tuners
  const head = mesh(new THREE.BoxGeometry(0.11, bass ? 0.06 : 0.055, 0.015), body, group, nutX + 0.06, 0.008, 0.012);
  head.rotation.z = 0.08;
  const count = bass ? 4 : 6;
  for (let i = 0; i < count; i++) {
    const tx = nutX + 0.02 + (i % (bass ? 2 : 3)) * 0.03;
    const ty = i < count / 2 ? 0.035 : -0.022;
    mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 8), CHROME(), group, tx, ty, 0.012).rotation.x = Math.PI / 2;
  }
  // Pickups, bridge, knobs
  for (const px of bass ? [-0.03] : [-0.05, 0.0]) mesh(new THREE.BoxGeometry(0.022, 0.07 * s, 0.01), M('#1c1b1f', 0.4), group, px * s, 0, 0.03);
  mesh(new THREE.BoxGeometry(0.02, 0.07 * s, 0.012), CHROME(), group, bridgeX, 0, 0.032);
  for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(0.01, 0.011, 0.012, 14), M('#f4efe6', 0.4), group, -0.1 * s + i * 0.03, -0.065 * s, 0.032).rotation.x = Math.PI / 2;

  const tuning = bass ? [28, 33, 38, 43] : [40, 45, 50, 55, 59, 64];
  const span = width * 0.78;
  const stringY = (i: number) => -span / 2 + (i / (count - 1)) * span;
  const strings: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const r = bass ? 0.0016 - i * 0.0002 : 0.0011 - i * 0.00011;
    const str = mesh(new THREE.CylinderGeometry(r, r, nutX - bridgeX, 4), M('#e9e4da', 0.25, 0.9), group, (nutX + bridgeX) / 2, stringY(i), 0.033, false);
    str.rotation.z = Math.PI / 2;
    strings.push(str);
  }

  return { group, strings, tuning, scale, nutX, stringY, topZ: 0.034, strumX: bass ? -0.05 : -0.03, headX: nutX + 0.06 };
}

export function fretX(p: StringedProp, fret: number) {
  // Fingers sit just behind the fret wire.
  const f = Math.max(0, fret - 0.35);
  return p.nutX - p.scale * (1 - Math.pow(2, -f / 12));
}

// Choose string and fret for a pitch, preferring positions near the hand's current fret.
export function fingering(p: StringedProp, pitch: number, nearFret: number) {
  let best = { string: 0, fret: 0, cost: Infinity };
  p.tuning.forEach((open, i) => {
    let fret = pitch - open;
    while (fret > 17) fret -= 12;
    while (fret < 0) fret += 12;
    const cost = Math.abs(fret - nearFret) + (fret === 0 ? 1.5 : 0) + i * 0.05;
    if (cost < best.cost) best = { string: i, fret, cost };
  });
  return best;
}

// ---------------- Keyboards ----------------

export interface KeyboardProp {
  group: THREE.Group;
  keys: Map<number, THREE.Mesh>;
  low: number;
  high: number;
  keyX: (pitch: number) => number; // local x of key centre (player faces +z, low notes at +x)
  keyTopY: number;
  keyZ: number;
  knobs: THREE.Object3D[];
  fold: (pitch: number) => number;
}

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export function buildKeyboard(variant: 'piano' | 'synth', color: string): KeyboardProp {
  const group = new THREE.Group();
  const low = variant === 'piano' ? 36 : 48;
  const high = 84;
  const ww = 0.022;
  const whites: number[] = [];
  for (let p = low; p <= high; p++) if (!BLACK_KEYS.has(p % 12)) whites.push(p);
  const W = whites.length * ww;
  const standH = 0.5;
  const bodyM = variant === 'piano' ? M(color, 0.3, 0.05, { clearcoat: 0.8 }) : M(color, 0.35, 0.2);
  // X-stand
  for (const s of [-1, 1]) {
    const a = mesh(new THREE.BoxGeometry(0.02, 0.62, 0.02), BLACK(), group, s * W * 0.32, standH / 2, 0);
    a.rotation.x = 0.6;
    const b = mesh(new THREE.BoxGeometry(0.02, 0.62, 0.02), BLACK(), group, s * W * 0.32, standH / 2, 0);
    b.rotation.x = -0.6;
  }
  const deck = new THREE.Group();
  deck.position.y = standH;
  group.add(deck);
  mesh(new THREE.BoxGeometry(W + 0.06, 0.05, 0.2), bodyM, deck, 0, 0.025, -0.02);
  mesh(new THREE.BoxGeometry(W + 0.06, 0.03, 0.06), bodyM, deck, 0, 0.065, 0.06);
  const keys = new Map<number, THREE.Mesh>();
  const keyX = (p: number) => {
    const wi = whites.indexOf(BLACK_KEYS.has(p % 12) ? p - 1 : p);
    const x = W / 2 - (wi + 0.5) * ww;
    return BLACK_KEYS.has(p % 12) ? x - ww / 2 : x;
  };
  // Player stands at -Z. Key origins sit at the back (hinge) so a negative X rotation dips the front edge.
  const whiteGeo = new THREE.BoxGeometry(ww * 0.92, 0.014, 0.1);
  whiteGeo.translate(0, 0, -0.05);
  const blackGeo = new THREE.BoxGeometry(ww * 0.55, 0.014, 0.062);
  blackGeo.translate(0, 0, -0.031);
  for (let p = low; p <= high; p++) {
    const black = BLACK_KEYS.has(p % 12);
    const k = mesh(black ? blackGeo : whiteGeo, black ? M('#1c1b1f', 0.35) : M('#f8f5ee', 0.35), deck, keyX(p), black ? 0.063 : 0.055, 0.028, !black);
    keys.set(p, k);
  }
  const knobs: THREE.Object3D[] = [];
  if (variant === 'synth') {
    const panel = mesh(new THREE.BoxGeometry(W + 0.06, 0.02, 0.08), M('#2a2830', 0.5), deck, 0, 0.09, 0.1);
    panel.rotation.x = 0.4;
    for (let i = 0; i < 8; i++) {
      const k = mesh(new THREE.CylinderGeometry(0.01, 0.011, 0.014, 14), M(['#f2a541', '#4ab3c9', '#d4609b', '#f4efe6'][i % 4], 0.4), deck, -W / 2 + 0.05 + i * 0.06, 0.105, 0.1);
      knobs.push(k);
    }
    const screen = mesh(new THREE.PlaneGeometry(0.1, 0.035), new THREE.MeshBasicMaterial({ color: '#7fe0c9' }), deck, W / 2 - 0.08, 0.112, 0.094);
    screen.rotation.x = -Math.PI / 2 + 0.4;
  } else {
    // Music stand with a little score.
    const ms = mesh(new THREE.BoxGeometry(0.22, 0.13, 0.006), M('#f4efe6', 0.9), deck, 0, 0.15, 0.09);
    ms.rotation.x = -0.25;
  }
  const fold = (p: number) => {
    while (p < low) p += 12;
    while (p > high) p -= 12;
    return p;
  };
  return { group, keys, low, high, keyX, keyTopY: standH + 0.07, keyZ: 0.0, knobs, fold };
}

// ---------------- Sampler pads ----------------
export interface PadsProp {
  group: THREE.Group;
  pads: THREE.Mesh[];
  padPos: (i: number) => THREE.Vector3;
}
export function buildPads(color: string): PadsProp {
  const group = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.55, 10), BLACK(), group, 0, 0.275, 0);
  mesh(new THREE.BoxGeometry(0.3, 0.05, 0.25), M(color, 0.4), group, 0, 0.57, 0);
  const pads: THREE.Mesh[] = [];
  const padPos = (i: number) => new THREE.Vector3(0.105 - (i % 4) * 0.07, 0.6, -0.08 + Math.floor(i / 4) * 0.055);
  for (let i = 0; i < 16; i++) {
    const p = padPos(i);
    const pad = mesh(new THREE.BoxGeometry(0.055, 0.012, 0.045), new THREE.MeshStandardMaterial({ color: '#3a3a44', emissive: color, emissiveIntensity: 0, roughness: 0.6 }), group, p.x, 0.598, p.z);
    pads.push(pad);
  }
  return { group, pads, padPos };
}

// ---------------- Mic stand ----------------
export function buildMic(height: number) {
  const group = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.02, 24), BLACK(), group, 0, 0.01, 0);
  mesh(new THREE.CylinderGeometry(0.008, 0.008, height, 8), CHROME(), group, 0, height / 2, 0);
  const boom = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 8), CHROME(), group, 0, height, 0.08);
  boom.rotation.x = Math.PI / 2 - 0.3;
  const mic = new THREE.Group();
  mic.position.set(0, height + 0.03, 0.17);
  group.add(mic);
  mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.08, 12), BLACK(), mic).rotation.x = Math.PI / 2 - 0.3;
  mesh(new THREE.SphereGeometry(0.024, 16, 12), M('#9aa0a8', 0.5, 0.6), mic, 0, 0.012, 0.045);
  return { group, mic };
}

// ---------------- Studio gear (effects as objects) ----------------

export interface Knob {
  obj: THREE.Object3D; // rotates around its local Y
  param: string;
}

export interface GearProp {
  group: THREE.Group;
  knobs: Knob[];
  footswitch?: THREE.Object3D;
  led?: THREE.Mesh;
  meter?: THREE.Object3D; // needle for compressors / levels
  cableIn: THREE.Vector3;
  cableOut: THREE.Vector3;
}

function knob(parent: THREE.Object3D, x: number, y: number, z: number, r: number, color: string, axis: 'y' | 'z' = 'y') {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  if (axis === 'z') pivot.rotation.x = Math.PI / 2;
  parent.add(pivot);
  mesh(new THREE.CylinderGeometry(r, r * 1.1, r * 0.9, 18), M(color, 0.35), pivot, 0, r * 0.45, 0);
  const tick = mesh(new THREE.BoxGeometry(r * 0.18, r * 0.2, r * 0.9), M('#ffffff', 0.4), pivot, 0, r * 0.95, -r * 0.45);
  tick.castShadow = false;
  return pivot;
}

export function buildPedal(color: string, name: string, params: string[]): GearProp {
  const group = new THREE.Group();
  const body = M(color, 0.3, 0.3, { clearcoat: 0.6 });
  mesh(new THREE.BoxGeometry(0.1, 0.035, 0.14), body, group, 0, 0.0175, 0);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.05), new THREE.MeshStandardMaterial({ map: label(name.split(' ')[0], { w: 180, h: 100, fg: '#fff', size: 34 }), transparent: true, roughness: 0.5 }));
  top.rotation.x = -Math.PI / 2;
  top.position.set(0, 0.0355, 0.0);
  group.add(top);
  const knobs = params.slice(0, 4).map((p, i, a) => ({ obj: knob(group, (i - (a.length - 1) / 2) * 0.026, 0.035, -0.045, 0.009, '#1c1b1f'), param: p }));
  const footswitch = mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.012, 14), CHROME(), group, 0, 0.041, 0.045);
  const led = mesh(new THREE.SphereGeometry(0.0045, 8, 6), new THREE.MeshStandardMaterial({ color: '#ff3b30', emissive: '#ff3b30', emissiveIntensity: 2 }), group, 0, 0.037, 0.018, false);
  return { group, knobs, footswitch, led, cableIn: new THREE.Vector3(0.05, 0.02, 0), cableOut: new THREE.Vector3(-0.05, 0.02, 0) };
}

export function buildAmp(name: string, params: string[]): GearProp {
  const group = new THREE.Group();
  const tolex = M('#2b2523', 0.85);
  mesh(new THREE.BoxGeometry(0.4, 0.34, 0.2), tolex, group, 0, 0.17, 0);
  const grill = mesh(new THREE.PlaneGeometry(0.36, 0.22), M('#c9b48a', 0.95), group, 0, 0.14, 0.101);
  grill.receiveShadow = true;
  const plate = mesh(new THREE.BoxGeometry(0.38, 0.06, 0.01), M('#e9e4da', 0.4, 0.3), group, 0, 0.29, 0.1);
  plate.castShadow = false;
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.035), new THREE.MeshStandardMaterial({ map: label(name.split(' ')[0], { w: 200, h: 60, fg: '#f2a541', size: 34 }), transparent: true }));
  logo.position.set(0.11, 0.21, 0.102);
  group.add(logo);
  const knobs = params.map((p, i) => ({ obj: knob(group, -0.15 + i * 0.055, 0.29, 0.106, 0.011, '#1c1b1f', 'z'), param: p }));
  const led = mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshStandardMaterial({ color: '#ff3b30', emissive: '#ff3b30', emissiveIntensity: 2 }), group, 0.17, 0.29, 0.107, false);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), M('#c9b48a', 0.5, 0.6), group, s * 0.19, 0.33, 0.09);
  mesh(new THREE.BoxGeometry(0.12, 0.012, 0.02), BLACK(), group, 0, 0.35, 0);
  return { group, knobs, led, cableIn: new THREE.Vector3(0.18, 0.05, 0.1), cableOut: new THREE.Vector3(-0.18, 0.05, 0.1) };
}

export function buildRackUnit(color: string, name: string, params: string[], meter = false): GearProp {
  const group = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.42, 0.075, 0.24), M('#25232a', 0.5, 0.3), group, 0, 0, -0.12);
  const face = mesh(new THREE.BoxGeometry(0.46, 0.08, 0.01), M(color, 0.35, 0.4), group, 0, 0, 0.005);
  face.castShadow = false;
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.03), new THREE.MeshStandardMaterial({ map: label(name, { w: 260, h: 64, fg: '#fff', size: 26 }), transparent: true }));
  lbl.position.set(-0.15, 0.018, 0.0105);
  group.add(lbl);
  const knobs = params.map((p, i) => ({ obj: knob(group, -0.06 + i * 0.05, -0.012, 0.011, 0.012, '#f4efe6', 'z'), param: p }));
  let needle: THREE.Object3D | undefined;
  if (meter) {
    const vu = mesh(new THREE.PlaneGeometry(0.07, 0.045), new THREE.MeshStandardMaterial({ color: '#f6e7b0', emissive: '#f2c25b', emissiveIntensity: 0.4 }), group, 0.18, 0.005, 0.011, false);
    vu.castShadow = false;
    needle = new THREE.Group();
    needle.position.set(0.18, -0.017, 0.012);
    group.add(needle);
    mesh(new THREE.BoxGeometry(0.0015, 0.04, 0.001), M('#1c1b1f'), needle, 0, 0.02, 0, false);
  }
  for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.003, 10), CHROME(), group, s * 0.215, 0.02, 0.011).rotation.x = Math.PI / 2;
  const led = mesh(new THREE.SphereGeometry(0.004, 8, 6), new THREE.MeshStandardMaterial({ color: '#58d68d', emissive: '#58d68d', emissiveIntensity: 2 }), group, -0.2, -0.02, 0.012, false);
  return { group, knobs, led, meter: needle, cableIn: new THREE.Vector3(0.2, 0, -0.24), cableOut: new THREE.Vector3(-0.2, 0, -0.24) };
}
