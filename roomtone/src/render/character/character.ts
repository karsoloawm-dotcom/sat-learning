import * as THREE from 'three';
import type { MusicianLook } from '../../state/types';

// A Mii-proportioned character on a shared skeleton. Bones use Mixamo names (Hips, Spine1, LeftArm, ...),
// so retargeted Mixamo / LowPolyCrate clips or a skinned GLB body can replace these parts later
// (see docs/ASSET_PIPELINE.md). Body parts are smooth meshes parented to bones.

export const BONES = [
  'Hips', 'Spine', 'Spine1', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
] as const;
export type BoneName = (typeof BONES)[number];

export const DIM = {
  hipY: 0.44,
  spine: 0.1,
  chest: 0.16,
  neck: 0.07,
  headR: 0.2,
  shoulderX: 0.135,
  upperArm: 0.19,
  foreArm: 0.17,
  thigh: 0.22,
  shin: 0.2,
  hipX: 0.075,
};

export interface FaceRig {
  eyes: THREE.Object3D[];
  lids: THREE.Mesh[];
  brows: THREE.Object3D[];
  mouths: Record<'smile' | 'grin' | 'o' | 'flat', THREE.Object3D>;
  blush: THREE.Mesh[];
}

export interface CharacterRig {
  root: THREE.Group; // positioned/rotated by the station; scaled by look height
  bones: Record<BoneName, THREE.Object3D>;
  face: FaceRig;
  look: MusicianLook;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
  dispose(): void;
}

const mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, rough = 0.7, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const key = `${color}|${rough}|${JSON.stringify(extra)}`;
  let m = mats.get(key);
  if (!m) mats.set(key, (m = new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra })));
  return m;
}

function shade(hex: string, f: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

export function buildCharacter(look: MusicianLook): CharacterRig {
  const geos: THREE.BufferGeometry[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => (geos.push(x), x);
  const root = new THREE.Group();
  root.name = `musician:${look.name}`;
  const bones = {} as Record<BoneName, THREE.Object3D>;
  const bone = (name: BoneName, parent: THREE.Object3D | null, x: number, y: number, z: number) => {
    const b = new THREE.Object3D();
    b.name = name;
    b.position.set(x, y, z);
    (parent ?? root).add(b);
    bones[name] = b;
    return b;
  };
  const D = DIM;
  const hips = bone('Hips', null, 0, D.hipY, 0);
  const spine = bone('Spine', hips, 0, D.spine, 0);
  const chest = bone('Spine1', spine, 0, D.chest, 0);
  const neck = bone('Neck', chest, 0, 0.05, 0);
  const head = bone('Head', neck, 0, D.neck, 0);
  for (const side of ['Left', 'Right'] as const) {
    const s = side === 'Left' ? 1 : -1;
    const sh = bone(`${side}Shoulder`, chest, s * 0.03, 0.0, 0);
    const arm = bone(`${side}Arm`, sh, s * (D.shoulderX - 0.03), -0.005, 0);
    const fore = bone(`${side}ForeArm`, arm, 0, -D.upperArm, 0);
    bone(`${side}Hand`, fore, 0, -D.foreArm, 0);
    arm.rotation.z = s * 0.12;
    const up = bone(`${side}UpLeg`, hips, s * D.hipX, -0.02, 0);
    const leg = bone(`${side}Leg`, up, 0, -D.thigh, 0);
    bone(`${side}Foot`, leg, 0, -D.shin, 0);
  }

  const skin = mat(look.skin, 0.62);
  const shirt = mat(look.shirt, 0.8, { metalness: 0 });
  const pants = mat(look.pants, 0.85);
  const shoes = mat(look.shoes, 0.55);
  const hairM = mat(look.hairColor, 0.55);
  const dark = mat('#1d1613', 0.3);
  const white = mat('#ffffff', 0.25);
  const accM = mat(look.accessoryColor, 0.45);

  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };

  // ---------- Torso: a soft bean via lathe ----------
  const w = look.width;
  const torsoProfile = (flare: number, bottom: number) => {
    const pts: THREE.Vector2[] = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const t = i / n; // 0 bottom .. 1 top
      const y = bottom + t * (D.spine + D.chest + 0.05 - bottom);
      let r = 0.13 + 0.025 * Math.sin(t * Math.PI) - 0.035 * Math.pow(t, 3);
      r += flare * Math.pow(1 - t, 2);
      if (t > 0.92) r *= 1 - (t - 0.92) * 6;
      pts.push(new THREE.Vector2(Math.max(0.001, r * w), y));
    }
    pts.unshift(new THREE.Vector2(0.001, bottom));
    return pts;
  };
  const torsoMat = look.outfit === 'overalls' ? pants : shirt;
  const torso = mesh(g(new THREE.LatheGeometry(torsoProfile(look.outfit === 'dress' ? 0.12 : 0.0, look.outfit === 'dress' ? -0.2 : -0.03), 28)), torsoMat, hips);
  torso.scale.z = 0.82;
  if (look.outfit === 'overalls') {
    // Shirt shows at the top, straps over it.
    const top = mesh(g(new THREE.SphereGeometry(0.118 * w, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42)), shirt, chest, 0, -0.04, 0);
    top.scale.set(1, 1.15, 0.85);
    for (const s of [-1, 1]) {
      const strap = mesh(g(new THREE.BoxGeometry(0.03, 0.17, 0.015)), pants, chest, s * 0.06 * w, -0.02, 0.098);
      strap.rotation.x = -0.12;
    }
    mesh(g(new THREE.BoxGeometry(0.08 * w, 0.07, 0.02)), pants, chest, 0, -0.085, 0.102);
  }
  if (look.outfit === 'hoodie') {
    const hood = mesh(g(new THREE.TorusGeometry(0.085, 0.035, 10, 20)), shirt, chest, 0, 0.03, -0.045);
    hood.rotation.x = Math.PI / 2.4;
    mesh(g(new THREE.BoxGeometry(0.14 * w, 0.06, 0.02)), mat(shade(look.shirt, 0.85), 0.8), spine, 0, 0.02, 0.105);
  }
  if (look.outfit === 'jacket') {
    // Open jacket: a light tee panel down the front.
    const tee = mesh(g(new THREE.BoxGeometry(0.075 * w, 0.24, 0.02)), mat('#f4efe6', 0.8), spine, 0, 0.07, 0.104);
    tee.rotation.x = 0.04;
    for (const s of [-1, 1]) {
      const lapel = mesh(g(new THREE.BoxGeometry(0.025, 0.12, 0.02)), mat(shade(look.shirt, 0.75), 0.7), chest, s * 0.045 * w, -0.02, 0.104);
      lapel.rotation.z = s * 0.25;
    }
  }
  // Collar / neck
  mesh(g(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 14)), skin, neck, 0, 0.02, 0);

  // ---------- Arms ----------
  const longSleeves = look.outfit === 'hoodie' || look.outfit === 'jacket';
  for (const side of ['Left', 'Right'] as const) {
    const s = side === 'Left' ? 1 : -1;
    const arm = bones[`${side}Arm`];
    const fore = bones[`${side}ForeArm`];
    const hand = bones[`${side}Hand`];
    mesh(g(new THREE.SphereGeometry(0.052, 16, 12)), torsoMat === pants ? shirt : shirt, arm, 0, 0, 0); // shoulder ball
    mesh(g(new THREE.CapsuleGeometry(0.043, D.upperArm - 0.04, 6, 12)), look.outfit === 'dress' ? skin : shirt, arm, 0, -D.upperArm / 2, 0);
    mesh(g(new THREE.CapsuleGeometry(0.038, D.foreArm - 0.04, 6, 12)), longSleeves ? shirt : skin, fore, 0, -D.foreArm / 2, 0);
    if (longSleeves) mesh(g(new THREE.CylinderGeometry(0.044, 0.044, 0.035, 12)), mat(shade(look.shirt, 0.8)), fore, 0, -D.foreArm + 0.02, 0);
    // Mitten hand: palm + thumb.
    const palm = mesh(g(new THREE.SphereGeometry(0.05, 16, 12)), skin, hand, 0, -0.035, 0);
    palm.scale.set(0.85, 1.05, 0.7);
    const thumb = mesh(g(new THREE.SphereGeometry(0.021, 10, 8)), skin, hand, s * 0.04, -0.02, 0.02);
    thumb.scale.set(1, 1.4, 1);
  }

  // ---------- Legs ----------
  for (const side of ['Left', 'Right'] as const) {
    const up = bones[`${side}UpLeg`];
    const leg = bones[`${side}Leg`];
    const foot = bones[`${side}Foot`];
    const legMat = look.outfit === 'dress' ? skin : pants;
    mesh(g(new THREE.CapsuleGeometry(0.055, D.thigh - 0.05, 6, 12)), look.outfit === 'dress' ? skin : pants, up, 0, -D.thigh / 2, 0);
    mesh(g(new THREE.CapsuleGeometry(0.048, D.shin - 0.05, 6, 12)), legMat, leg, 0, -D.shin / 2, 0);
    const shoe = mesh(g(new THREE.SphereGeometry(0.06, 16, 10)), shoes, foot, 0, -0.01, 0.03);
    shoe.scale.set(0.95, 0.65, 1.45);
    const sole = mesh(g(new THREE.CylinderGeometry(0.058, 0.058, 0.014, 16)), mat('#f4efe6', 0.8), foot, 0, -0.04, 0.03);
    sole.scale.set(0.95, 1, 1.45);
  }

  // ---------- Head ----------
  const R = D.headR;
  const headMesh = mesh(g(new THREE.SphereGeometry(R, 40, 28)), skin, head, 0, R * 0.95, 0);
  headMesh.scale.set(1, 0.96, 0.94);
  const headTop = new THREE.Group();
  headTop.position.y = R * 0.95;
  head.add(headTop);
  // Ears and nose
  for (const s of [-1, 1]) {
    const ear = mesh(g(new THREE.SphereGeometry(0.035, 12, 10)), skin, headTop, s * R * 0.98, -0.01, 0);
    ear.scale.set(0.55, 1, 0.8);
  }
  const nose = mesh(g(new THREE.SphereGeometry(0.024, 14, 10)), mat(shade(look.skin, 0.93), 0.6), headTop, 0, -0.035, R * 0.94);
  nose.scale.set(1.1, 0.9, 0.8);

  // Features sit on the face surface; `onFace` maps (x, y) on the face to a point/orientation on the head.
  const onFace = (obj: THREE.Object3D, x: number, y: number, lift = 0.004) => {
    const nx = x / R;
    const ny = y / R;
    const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
    const n = new THREE.Vector3(nx, ny * 0.96, nz * 0.94).normalize();
    obj.position.set(nx * R, ny * R * 0.96, nz * R * 0.94).addScaledVector(n, lift);
    obj.lookAt(obj.position.clone().add(n));
    headTop.add(obj);
    return obj;
  };

  const eyeShapes = [
    { w: 0.024, h: 0.034, white: false }, // round dots
    { w: 0.02, h: 0.042, white: false }, // tall ovals
    { w: 0.03, h: 0.026, white: true }, // big friendly
    { w: 0.026, h: 0.03, white: true },
  ];
  const es = eyeShapes[look.eyes % eyeShapes.length];
  const eyes: THREE.Object3D[] = [];
  const lids: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    if (es.white) {
      const sclera = new THREE.Mesh(g(new THREE.CircleGeometry(1, 24)), white);
      sclera.scale.set(es.w * 1.25, es.h * 1.2, 1);
      eye.add(sclera);
    }
    const iris = new THREE.Mesh(g(new THREE.CircleGeometry(1, 24)), mat(es.white ? look.eyeColor : '#1d1613', 0.3));
    iris.scale.set(es.white ? es.w * 0.8 : es.w, es.white ? es.h * 0.9 : es.h, 1);
    iris.position.z = 0.001;
    eye.add(iris);
    const glint = new THREE.Mesh(g(new THREE.CircleGeometry(1, 12)), white);
    glint.scale.setScalar(es.w * 0.32);
    glint.position.set(es.w * 0.3, es.h * 0.35, 0.002);
    eye.add(glint);
    // Eyelid: a skin disc that scales down over the eye to blink.
    const lid = new THREE.Mesh(g(new THREE.CircleGeometry(1, 24, 0, Math.PI)), skin);
    lid.scale.set(es.w * 1.5, 0.001, 1);
    lid.position.set(0, es.h * 1.25, 0.003);
    lid.rotation.z = Math.PI;
    eye.add(lid);
    lids.push(lid);
    onFace(eye, s * 0.068, 0.028);
    eyes.push(eye);
  }
  const brows: THREE.Object3D[] = [];
  const browTilt = [0, 0.18, -0.15][look.brows % 3];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    const b = new THREE.Mesh(g(new THREE.CapsuleGeometry(0.008, 0.04, 4, 8)), mat(look.hairColor === '#e7e3dc' ? '#b9b2a6' : look.hairColor, 0.6));
    b.rotation.z = Math.PI / 2;
    pivot.add(b);
    pivot.userData.base = s * browTilt;
    pivot.rotation.z = pivot.userData.base;
    onFace(pivot, s * 0.07, 0.085, 0.006);
    pivot.userData.side = s;
    brows.push(pivot);
  }
  const mouthMat = mat('#6b2a2a', 0.5);
  const smile = new THREE.Mesh(g(new THREE.TorusGeometry(0.035, 0.007, 6, 16, Math.PI)), mouthMat);
  smile.rotation.z = Math.PI;
  const smileG = onFace(new THREE.Group().add(smile), 0, -0.075, 0.003);
  const grin = new THREE.Group();
  const grinShape = new THREE.Mesh(g(new THREE.CircleGeometry(0.04, 20, Math.PI, Math.PI)), mouthMat);
  const teeth = new THREE.Mesh(g(new THREE.PlaneGeometry(0.05, 0.01)), white);
  teeth.position.set(0, -0.006, 0.001);
  grin.add(grinShape, teeth);
  onFace(grin, 0, -0.07, 0.003);
  const o = new THREE.Mesh(g(new THREE.CircleGeometry(0.022, 18)), mouthMat);
  o.scale.y = 1.25;
  const oG = onFace(new THREE.Group().add(o), 0, -0.085, 0.003);
  const flat = new THREE.Mesh(g(new THREE.CapsuleGeometry(0.006, 0.035, 4, 8)), mouthMat);
  flat.rotation.z = Math.PI / 2;
  const flatG = onFace(new THREE.Group().add(flat), 0, -0.08, 0.003);
  const mouths = { smile: smileG, grin, o: oG, flat: flatG };
  const restMouth = (['smile', 'grin', 'flat'] as const)[look.mouth % 3];
  for (const [k, m] of Object.entries(mouths)) m.visible = k === restMouth;
  const blush: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(g(new THREE.CircleGeometry(0.026, 16)), new THREE.MeshStandardMaterial({ color: '#f08a8a', transparent: true, opacity: 0.35, roughness: 1, depthWrite: false }));
    onFace(b, s * 0.11, -0.04, 0.002);
    blush.push(b);
  }

  // ---------- Hair ----------
  const hair = new THREE.Group();
  headTop.add(hair);
  const cap = (scale: number, theta: number, tilt: number) => {
    const c = new THREE.Mesh(g(new THREE.SphereGeometry(R * scale, 36, 18, 0, Math.PI * 2, 0, theta)), hairM);
    c.rotation.x = -tilt;
    c.scale.set(1, 0.98, 0.98);
    c.castShadow = true;
    hair.add(c);
    return c;
  };
  const blob = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, m: THREE.Material = hairM) => {
    const b = mesh(g(new THREE.SphereGeometry(r, 16, 12)), m, hair, x, y, z);
    b.scale.set(sx, sy, sz);
    return b;
  };
  switch (look.hair) {
    case 'bob':
      cap(1.07, Math.PI * 0.62, 0.4);
      for (const s of [-1, 1]) blob(0.09, s * 0.15, -0.06, -0.02, 0.7, 1.4, 1.1);
      blob(0.13, 0, -0.04, -0.1, 1.4, 1.2, 0.9);
      break;
    case 'spiky': {
      cap(1.05, Math.PI * 0.5, 0.45);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const cone = mesh(g(new THREE.ConeGeometry(0.045, 0.12, 8)), hairM, hair, Math.cos(a) * 0.11, 0.15, Math.sin(a) * 0.1 - 0.03);
        cone.rotation.set(Math.sin(a) * 0.7 - 0.2, 0, -Math.cos(a) * 0.7);
      }
      mesh(g(new THREE.ConeGeometry(0.05, 0.15, 8)), hairM, hair, 0, 0.2, -0.02);
      break;
    }
    case 'ponytail': {
      cap(1.06, Math.PI * 0.55, 0.38);
      blob(0.012, 0, 0.02, -0.215, 3, 3, 3, accM);
      const tail = blob(0.07, 0, -0.08, -0.25, 0.9, 1.9, 0.9);
      tail.rotation.x = 0.35;
      break;
    }
    case 'bun':
      cap(1.06, Math.PI * 0.56, 0.36);
      blob(0.085, 0, 0.19, -0.08);
      blob(0.013, 0, 0.12, -0.07, 6, 1.6, 6, accM);
      break;
    case 'afro':
      for (let i = 0; i < 40; i++) {
        const phi = Math.acos(1 - (i + 0.5) / 40 * 1.25);
        const th = i * 2.39996;
        const r = R * 1.18;
        const p = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)).multiplyScalar(r);
        if (p.z > R * 0.6 && p.y < R * 0.55) continue; // keep the face clear
        blob(0.075, p.x, p.y + 0.03, p.z - 0.02);
      }
      break;
    case 'buzz':
      cap(1.015, Math.PI * 0.55, 0.42);
      break;
    case 'long':
      cap(1.07, Math.PI * 0.6, 0.38);
      blob(0.15, 0, -0.14, -0.1, 1.35, 1.9, 0.6);
      for (const s of [-1, 1]) blob(0.07, s * 0.16, -0.12, 0.0, 0.7, 2.1, 1);
      break;
    case 'mohawk':
      cap(1.012, Math.PI * 0.5, 0.42).material = mat(shade(look.hairColor, 0.7), 0.7);
      for (let i = 0; i < 6; i++) {
        const a = -0.5 + i * 0.32;
        const b = blob(0.04, 0, Math.cos(a) * 0.21, Math.sin(-a) * 0.21, 0.6, 1.8, 1);
        b.rotation.x = a;
      }
      break;
    case 'bald':
      break;
  }

  // ---------- Accessories ----------
  const acc = new THREE.Group();
  headTop.add(acc);
  switch (look.accessory) {
    case 'glasses':
    case 'shades':
      for (const s of [-1, 1]) {
        const ring = new THREE.Mesh(g(new THREE.TorusGeometry(0.034, 0.006, 8, 20)), look.accessory === 'shades' ? dark : accM);
        onFace(ring, s * 0.068, 0.025, 0.018);
        if (look.accessory === 'shades') {
          const lens = new THREE.Mesh(g(new THREE.CircleGeometry(0.033, 20)), mat('#141414', 0.1, { metalness: 0.4 }));
          onFace(lens, s * 0.068, 0.025, 0.017);
        }
      }
      onFace(new THREE.Mesh(g(new THREE.BoxGeometry(0.04, 0.006, 0.006)), look.accessory === 'shades' ? dark : accM), 0, 0.03, 0.02);
      break;
    case 'beanie': {
      const b = cap(1.1, Math.PI * 0.45, 0.25);
      b.material = accM;
      const fold = mesh(g(new THREE.TorusGeometry(R * 0.98, 0.025, 8, 32)), mat(shade(look.accessoryColor, 0.8)), acc, 0, 0.07, -0.03);
      fold.rotation.x = Math.PI / 2 - 0.25;
      blob(0.04, 0, 0.23, -0.04, 1, 1, 1, mat('#f4efe6', 0.9));
      break;
    }
    case 'cap': {
      const c = new THREE.Mesh(g(new THREE.SphereGeometry(R * 1.08, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42)), accM);
      c.rotation.x = -0.15;
      c.castShadow = true;
      acc.add(c);
      const visor = mesh(g(new THREE.CylinderGeometry(0.13, 0.13, 0.012, 24, 1, false, -Math.PI / 2, Math.PI)), accM, acc, 0, 0.08, 0.14);
      visor.rotation.x = 0.15;
      visor.scale.set(1, 1, 0.9);
      break;
    }
    case 'headphones': {
      const band = mesh(g(new THREE.TorusGeometry(R * 1.12, 0.014, 8, 28, Math.PI)), accM, acc, 0, 0.0, 0);
      band.rotation.y = 0;
      for (const s of [-1, 1]) {
        const cup = mesh(g(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 20)), accM, acc, s * R * 1.08, -0.01, 0);
        cup.rotation.z = Math.PI / 2;
        mesh(g(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 20)), mat('#e8553d', 0.5), acc, s * R * 1.13, -0.01, 0).rotation.z = Math.PI / 2;
      }
      break;
    }
    case 'bandana': {
      const b = mesh(g(new THREE.TorusGeometry(R * 1.0, 0.022, 8, 32)), accM, acc, 0, 0.09, -0.02);
      b.rotation.x = Math.PI / 2 - 0.3;
      blob(0.03, 0, 0.04, -0.21, 1, 0.6, 1.5, accM);
      break;
    }
  }

  // Scale the whole figure. Height mostly stretches the body, not the head, to keep Mii proportions.
  root.scale.setScalar(look.height);
  head.scale.setScalar(1 / Math.sqrt(look.height));

  const allMats = new Set<THREE.Material>();
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) allMats.add((o as THREE.Mesh).material as THREE.Material);
  });

  return {
    root,
    bones,
    face: { eyes, lids, brows, mouths, blush },
    look,
    materials: [...allMats],
    geometries: geos,
    dispose() {
      for (const x of geos) x.dispose();
      // Shared materials are cached; only blush materials are per-character.
      for (const b of blush) (b.material as THREE.Material).dispose();
    },
  };
}
