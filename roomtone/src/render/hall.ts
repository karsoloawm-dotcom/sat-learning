import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Room } from './rooms';
import { tagLight, type Station } from './studio';

// The concert hall: geometry modelled in Blender (scripts/blender/build_hall.py -> public/models/hall.gltf.json),
// lights, haze, light shafts and dust added here so they can scale with the quality preset.

const STAGE_Y = 0.55;

export const HALL_STATIONS: Station[] = [
  { pos: new THREE.Vector3(0, STAGE_Y + 0.5, -9.0), rotY: 0, name: 'Percussion riser' },
  { pos: new THREE.Vector3(3.4, STAGE_Y + 0.25, -7.0), rotY: -0.3, name: 'Riser right' },
  { pos: new THREE.Vector3(-3.4, STAGE_Y + 0.25, -7.0), rotY: 0.3, name: 'Riser left' },
  { pos: new THREE.Vector3(-4.6, STAGE_Y, -3.8), rotY: 0.55, name: 'Front left' },
  { pos: new THREE.Vector3(4.6, STAGE_Y, -3.8), rotY: -0.55, name: 'Front right' },
  { pos: new THREE.Vector3(-1.5, STAGE_Y, -3.4), rotY: 0.15, name: 'Centre left' },
  { pos: new THREE.Vector3(1.5, STAGE_Y, -3.4), rotY: -0.15, name: 'Centre right' },
  { pos: new THREE.Vector3(0, STAGE_Y, -2.6), rotY: 0, name: 'Soloist' },
];

// Floor height for walking: stalls, stage, the three orchestra risers and the choir steps.
export function hallFloorY(x: number, z: number) {
  if (z > -2) return 0;
  if (Math.abs(x) > 8.6) return STAGE_Y;
  if (z < -11.2 && Math.abs(x) < 7.5) return STAGE_Y + 1.1 + 0.42 * Math.min(3, Math.floor((-11.2 - z) / 0.7));
  const tiers: [number, number, number][] = [[-8, -6, 6.5], [-10, -8, 6.1], [-11.2, -10, 5.7]];
  for (let i = tiers.length - 1; i >= 0; i--) {
    const [z0, z1, hx] = tiers[i];
    if (z >= z0 && z < z1 && Math.abs(x) < hx) return STAGE_Y + 0.25 * (i + 1);
  }
  return STAGE_Y;
}

// Many nodes sharing one mesh (the seats) become a single InstancedMesh per material.
function instanceRepeats(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const groups = new Map<string, THREE.Mesh[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const k = `${m.geometry.uuid}|${(m.material as THREE.Material).uuid}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(m);
  });
  for (const list of groups.values()) {
    if (list.length < 8) continue;
    const inst = new THREE.InstancedMesh(list[0].geometry, list[0].material, list.length);
    list.forEach((m, i) => {
      inst.setMatrixAt(i, m.matrixWorld);
      m.parent?.remove(m);
    });
    inst.name = 'seats';
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    root.add(inst);
  }
}

const shaftMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color('#ffd9a8') }, uStrength: { value: 0.06 } },
    vertexShader: /* glsl */ `
      varying float vH; varying vec3 vN; varying vec3 vV;
      void main() {
        vH = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uStrength;
      varying float vH; varying vec3 vN; varying vec3 vV;
      void main() {
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); // soft silhouette edges
        float along = smoothstep(0.0, 0.25, 1.0 - vH) * (0.35 + 0.65 * vH); // fades near the floor and the lamp
        gl_FragColor = vec4(uColor * uStrength * edge * along, 1.0);
      }`,
  });

function buildShaft(from: THREE.Vector3, to: THREE.Vector3, angle: number) {
  const len = from.distanceTo(to);
  const geo = new THREE.ConeGeometry(Math.tan(angle) * len, len, 40, 1, true);
  geo.translate(0, -len / 2, 0); // apex at the lamp
  const m = new THREE.Mesh(geo, shaftMaterial());
  m.position.copy(from);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
  m.renderOrder = 10;
  return m;
}

// Dust motes that only show inside the light shafts.
function buildDust(shafts: { from: THREE.Vector3; to: THREE.Vector3; angle: number }[]) {
  const n = 1400;
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 14;
    pos[i * 3 + 1] = 0.6 + Math.random() * 10;
    pos[i * 3 + 2] = -12 + Math.random() * 11;
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uFrom: { value: shafts.map((s) => s.from) },
      uDir: { value: shafts.map((s) => s.to.clone().sub(s.from).normalize()) },
      uTan: { value: shafts.map((s) => Math.tan(s.angle)) },
      uPixel: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float seed; uniform float uTime; uniform vec3 uFrom[3]; uniform vec3 uDir[3]; uniform float uTan[3]; uniform float uPixel;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * (0.03 + seed * 0.05) - 0.6, 10.0) + 0.6;
        p.x += sin(uTime * 0.3 + seed * 30.0) * 0.25;
        p.z += cos(uTime * 0.25 + seed * 20.0) * 0.25;
        float lit = 0.0;
        for (int i = 0; i < 3; i++) {
          vec3 d = p - uFrom[i];
          float t = dot(d, uDir[i]);
          float r = length(d - uDir[i] * t);
          lit += t > 0.0 ? 1.0 - smoothstep(0.6, 1.0, r / max(0.01, t * uTan[i])) : 0.0;
        }
        vA = min(1.0, lit) * (0.4 + 0.6 * fract(seed * 7.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uPixel * (0.6 + seed * 0.9) * 30.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vec3(1.0, 0.88, 0.7) * vA * (1.0 - smoothstep(0.15, 0.5, d)) * 0.55, 1.0);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 11;
  return pts;
}

let cached: Promise<THREE.Group> | null = null;
function loadGeometry() {
  cached ??= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/hall.gltf.json`).then((g) => {
    instanceRepeats(g.scene);
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.receiveShadow = true;
      const name = (m.material as THREE.Material).name;
      // Big enclosing surfaces only receive; everything else also casts.
      m.castShadow = !['floor', 'wood_ceiling_dark', 'plaster', 'emit_downlight', 'emit_window'].includes(name);
      const mat = m.material as THREE.MeshStandardMaterial;
      if (name === 'stage_floor') mat.envMapIntensity = 1.6; // polished boards catch reflections
      if (name === 'emit_window') mat.emissiveIntensity = 1.1; // Blender's strength is for Cycles; tone it down for bloom
      if (name === 'emit_downlight') mat.emissiveIntensity = 6;
    });
    return g.scene;
  });
  return cached;
}

export async function hallRoom(): Promise<Room> {
  const root = new THREE.Group();
  root.name = 'hall';
  root.add(await loadGeometry());

  const hemi = tagLight(new THREE.HemisphereLight('#ffe2c0', '#4a3020', 0.3), 0.3, 0.1);
  const key = tagLight(new THREE.DirectionalLight('#ffe6c4', 2.0), 2.0, 0.5);
  key.position.set(3, 14, 6);
  key.target.position.set(0, STAGE_Y, -6.5);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 1, far: 40 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 4;

  const shaftDefs: { from: THREE.Vector3; to: THREE.Vector3; angle: number }[] = [];
  const spots = [-4.5, 0, 4.5].map((x, i) => {
    const s = tagLight(new THREE.SpotLight('#fff0d8', 40, 26, 0.36, 0.55, 1.2), 40, 90);
    s.userData.color = s.color.clone();
    s.position.set(x, 12.2, -1.0 + (i === 1 ? 1 : 0));
    s.target.position.set(x * 0.8, STAGE_Y, -6 - (i === 1 ? 1.5 : 0));
    s.shadow.bias = -0.0003;
    s.shadow.radius = 4;
    shaftDefs.push({ from: s.position.clone(), to: s.target.position.clone(), angle: 0.36 });
    return s;
  });
  const fills: THREE.Light[] = [];
  for (const side of [-1, 1]) {
    for (const z of [-6, 4, 14]) {
      const p = tagLight(new THREE.PointLight('#ffb766', 6, 11, 1.5), 6, 2, true);
      p.position.set(side * 7.8, 5.0, z);
      fills.push(p);
    }
  }
  const windowGlow = tagLight(new THREE.PointLight('#ffcf8a', 8, 12, 1.4), 8, 4, true);
  windowGlow.position.set(0, 9.5, -12.5);
  const house = tagLight(new THREE.PointLight('#ffe2bb', 7, 30, 1.2), 7, 2);
  house.position.set(0, 11.5, 9); // audience-area wash from the ceiling downlights
  const all: THREE.Light[] = [hemi, key, ...spots, ...fills, windowGlow, house];
  for (const l of all) {
    root.add(l);
    if ('target' in l) root.add((l as THREE.SpotLight).target);
  }

  const atmosphere: THREE.Object3D[] = shaftDefs.map((s) => buildShaft(s.from, s.to, s.angle));
  const dust = buildDust(shaftDefs);
  atmosphere.push(dust);
  for (const a of atmosphere) root.add(a);
  const dustMat = dust.material as THREE.ShaderMaterial;

  const columnZ: number[] = [];
  for (let z = -14 + 2.6; z < 21.5; z += 2.4) columnZ.push(z);
  return {
    id: 'hall',
    root,
    lights: { all, shadowKey: key, spots, secondaryShadows: spots },
    stations: HALL_STATIONS,
    colliders: [
      ...columnZ.flatMap((z) => [-1, 1].map((s) => ({ x: s * 7.25, z, r: 0.5 }))),
      { x: -0.8, z: 19.6, r: 0.55 },
      { x: 0, z: 19.6, r: 0.55 },
      { x: 0.8, z: 19.6, r: 0.55 },
      { x: -2.0, z: 20.4, r: 0.4 },
    ],
    boxes: [
      { minX: -3.35, maxX: 3.35, minZ: 1.2, maxZ: 18.0 },
      { minX: 3.5, maxX: 6.7, minZ: 1.2, maxZ: 18.0 },
      { minX: -6.7, maxX: -3.5, minZ: 1.2, maxZ: 18.0 },
    ],
    bounds: { minX: -8.7, maxX: 8.7, minZ: -13.6, maxZ: 21.6, height: 13 },
    floorY: hallFloorY,
    console: { pos: new THREE.Vector3(0, 0, 19.6), rotY: Math.PI },
    rack: { pos: new THREE.Vector3(-2.0, 0, 20.4), rotY: Math.PI - 0.35 },
    director: { pos: new THREE.Vector3(0, 6.2, 6.5), target: new THREE.Vector3(0, 1.4, -6), maxDistance: 30 },
    fpStart: { pos: new THREE.Vector3(0, 0, 0.6), yaw: 0 },
    stageCenter: new THREE.Vector3(0, STAGE_Y, -6),
    cutaways: [],
    atmosphere,
    fog: new THREE.FogExp2('#3b2a1f', 0.014),
    background: new THREE.Color('#3b2a1f'),
    envIntensity: 0.3,
    exposure: 0.82,
    update: (_dt, elapsed) => {
      dustMat.uniforms.uTime.value = elapsed;
    },
  };
}

// Exposed so the quality code can size dust points for the current pixel ratio.
export function setDustPixelRatio(room: Room, px: number) {
  for (const a of room.atmosphere) {
    const m = (a as THREE.Points).material as THREE.ShaderMaterial | undefined;
    if (m?.uniforms?.uPixel) m.uniforms.uPixel.value = px;
  }
}
