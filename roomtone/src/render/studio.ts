import * as THREE from 'three';
import { BLACK, CHROME, label, M, mesh } from './props';

// The rehearsal studio: a cosy, slightly miniature room with a stage riser, a control desk and a vocal booth.
// Stations are where musicians stand; colliders keep the first-person walker out of furniture.

export interface Station {
  pos: THREE.Vector3;
  rotY: number;
  name: string;
}

export interface Collider {
  x: number;
  z: number;
  r: number;
}

export const ROOM = { minX: -6, maxX: 6, minZ: -4.2, maxZ: 4.6, height: 3.1 };
export const STAGE_Y = 0.1;
export const RISER = { z: -3.2, r: 3.9 };

export const STATIONS: Station[] = [
  { pos: new THREE.Vector3(0, STAGE_Y, -2.35), rotY: 0, name: 'Drum riser' },
  { pos: new THREE.Vector3(-1.45, STAGE_Y, -1.65), rotY: 0.4, name: 'Stage left' },
  { pos: new THREE.Vector3(1.45, STAGE_Y, -1.65), rotY: -0.4, name: 'Stage right' },
  { pos: new THREE.Vector3(-2.6, STAGE_Y, -0.75), rotY: 0.75, name: 'Keys corner' },
  { pos: new THREE.Vector3(2.6, STAGE_Y, -0.75), rotY: -0.75, name: 'Synth corner' },
  { pos: new THREE.Vector3(-0.8, STAGE_Y, -0.45), rotY: 0.12, name: 'Front left' },
  { pos: new THREE.Vector3(0.8, STAGE_Y, -0.45), rotY: -0.12, name: 'Front right' },
  { pos: new THREE.Vector3(4.6, 0, 2.9), rotY: -1.75, name: 'Vocal booth' },
];

export const CONSOLE_POS = new THREE.Vector3(0, 0, 2.7);
export const MASTER_RACK_POS = new THREE.Vector3(-1.75, 0, 3.0);

function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

const rand = (() => {
  let s = 7;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
})();

export function buildStudio() {
  const root = new THREE.Group();
  root.name = 'studio';
  const colliders: Collider[] = [];
  const W = ROOM.maxX - ROOM.minX;
  const Dz = ROOM.maxZ - ROOM.minZ;
  const cx = (ROOM.maxX + ROOM.minX) / 2;
  const cz = (ROOM.maxZ + ROOM.minZ) / 2;

  // ---- Floor: warm planks ----
  const floorTex = canvasTex(1024, 1024, (x) => {
    const rows = 16;
    for (let r = 0; r < rows; r++) {
      let px = -rand() * 300;
      while (px < 1024) {
        const len = 220 + rand() * 260;
        const l = 52 + rand() * 12;
        x.fillStyle = `hsl(${26 + rand() * 6}, ${42 + rand() * 10}%, ${l}%)`;
        x.fillRect(px, r * 64, len, 64);
        x.strokeStyle = 'rgba(60,35,20,0.35)';
        x.lineWidth = 3;
        x.strokeRect(px, r * 64, len, 64);
        for (let g = 0; g < 6; g++) {
          x.strokeStyle = `rgba(90,55,30,${0.05 + rand() * 0.08})`;
          x.beginPath();
          const gy = r * 64 + 6 + rand() * 52;
          x.moveTo(px, gy);
          x.bezierCurveTo(px + len * 0.3, gy + rand() * 6 - 3, px + len * 0.6, gy + rand() * 6 - 3, px + len, gy);
          x.stroke();
        }
        px += len;
      }
    }
  }, [W / 4, Dz / 4]);
  const floor = mesh(new THREE.PlaneGeometry(W, Dz), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55 }), root, cx, 0, cz, false);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;

  // ---- Stage riser and rug ----
  const riser = new THREE.Shape();
  riser.absarc(0, 0, RISER.r, 0, Math.PI, false);
  riser.lineTo(-RISER.r, 0);
  const riserGeo = new THREE.ExtrudeGeometry(riser, { depth: STAGE_Y, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 3, curveSegments: 48 });
  const stageTex = canvasTex(512, 512, (x) => {
    x.fillStyle = '#6b4a33';
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 16; i++) {
      x.fillStyle = `hsl(24, 35%, ${30 + rand() * 8}%)`;
      x.fillRect(0, i * 32, 512, 30);
    }
  }, [2, 2]);
  // Shape lies in XY with the arc toward +Y; rotating +90 deg about X puts the arc toward the audience (+Z)
  // and extrudes downward from the top face at STAGE_Y.
  const stage = mesh(riserGeo, new THREE.MeshStandardMaterial({ map: stageTex, roughness: 0.6 }), root, 0, STAGE_Y, RISER.z);
  stage.rotation.x = Math.PI / 2;

  const rugTex = canvasTex(1024, 1024, (x) => {
    const cols = ['#b5483a', '#e0a458', '#f3e3c3', '#2f5d62', '#b5483a', '#e8c07d', '#7a3b33'];
    for (let i = 0; i < 7; i++) {
      x.fillStyle = cols[i];
      x.beginPath();
      x.arc(512, 512, 500 - i * 66, 0, Math.PI * 2);
      x.fill();
    }
    x.strokeStyle = 'rgba(255,240,220,0.5)';
    x.lineWidth = 6;
    for (let a = 0; a < 48; a++) {
      const ang = (a / 48) * Math.PI * 2;
      x.beginPath();
      x.moveTo(512 + Math.cos(ang) * 300, 512 + Math.sin(ang) * 300);
      x.lineTo(512 + Math.cos(ang) * 330, 512 + Math.sin(ang) * 330);
      x.stroke();
    }
  });
  const rug = mesh(new THREE.CircleGeometry(2.1, 64), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.95 }), root, 0, STAGE_Y + 0.004, -1.75, false);
  rug.rotation.x = -Math.PI / 2;
  rug.receiveShadow = true;
  const rug2 = mesh(new THREE.PlaneGeometry(3.4, 2.2), new THREE.MeshStandardMaterial({ map: canvasTex(512, 340, (x) => {
    x.fillStyle = '#2f5d62';
    x.fillRect(0, 0, 512, 340);
    x.strokeStyle = '#e0a458';
    x.lineWidth = 10;
    x.strokeRect(20, 20, 472, 300);
    for (let i = 0; i < 12; i++) {
      x.fillStyle = i % 2 ? '#f3e3c3' : '#b5483a';
      x.beginPath();
      x.moveTo(60 + i * 36, 170);
      x.lineTo(78 + i * 36, 140);
      x.lineTo(96 + i * 36, 170);
      x.lineTo(78 + i * 36, 200);
      x.fill();
    }
  }), roughness: 1 }), root, 0, 0.004, 3.0, false);
  rug2.rotation.x = -Math.PI / 2;
  rug2.receiveShadow = true;

  // ---- Walls ----
  const wallTex = canvasTex(512, 512, (x) => {
    x.fillStyle = '#efe2cf';
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2000; i++) {
      x.fillStyle = `rgba(150,110,80,${rand() * 0.04})`;
      x.fillRect(rand() * 512, rand() * 512, 2, 2);
    }
  }, [6, 2]);
  const wallM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
  const panelTex = canvasTex(256, 1024, (x) => {
    for (let i = 0; i < 16; i++) {
      x.fillStyle = `hsl(25, 38%, ${36 + (i % 2) * 4 + rand() * 3}%)`;
      x.fillRect(i * 16, 0, 16, 1024);
      x.fillStyle = 'rgba(0,0,0,0.25)';
      x.fillRect(i * 16 + 15, 0, 1, 1024);
    }
  }, [W / 1.5, 1]);
  const wainscot = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.6 });
  const H = ROOM.height;
  const wall = (len: number, x: number, z: number, ry: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    root.add(g);
    mesh(new THREE.PlaneGeometry(len, H), wallM, g, 0, H / 2, 0, false).receiveShadow = true;
    mesh(new THREE.BoxGeometry(len, 0.9, 0.04), wainscot, g, 0, 0.45, 0.02);
    mesh(new THREE.BoxGeometry(len, 0.05, 0.07), M('#5b3a26', 0.5), g, 0, 0.92, 0.035);
    mesh(new THREE.BoxGeometry(len, 0.1, 0.05), M('#4a2f1f', 0.5), g, 0, H - 0.05, 0.025);
    // Dollhouse cutaway: the world hides a wall when the camera is behind it.
    g.userData.cutaway = { kind: 'wall', normal: new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry), point: new THREE.Vector3(x, 0, z) };
    return g;
  };
  const back = wall(W, cx, ROOM.minZ, 0);
  wall(W, cx, ROOM.maxZ, Math.PI);
  const left = wall(Dz, ROOM.minX, cz, Math.PI / 2);
  const right = wall(Dz, ROOM.maxX, cz, -Math.PI / 2);
  const ceil = mesh(new THREE.PlaneGeometry(W, Dz), M('#e8d9c4', 0.95), root, cx, H, cz, false);
  ceil.rotation.x = Math.PI / 2;
  const ceiling = new THREE.Group();
  ceiling.userData.cutaway = { kind: 'ceiling' };
  root.add(ceiling);
  ceiling.add(ceil);
  for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(W, 0.14, 0.14), M('#6e4a32', 0.7), ceiling, cx, H - 0.07, ROOM.minZ + 0.8 + i * 1.9);

  // ---- Acoustic panels on the back wall ----
  const panelCols = ['#d9a441', '#2f5d62', '#c2412f', '#e8c07d', '#2f5d62', '#d9a441', '#c2412f'];
  for (let i = 0; i < 7; i++) {
    const p = mesh(new THREE.BoxGeometry(0.9, 0.9, 0.08), M(panelCols[i], 0.98), back, -4.2 + i * 1.4, 1.75 + (i % 2) * 0.25, 0.05);
    p.castShadow = false;
    // soft quilting
    for (let q = 0; q < 4; q++) mesh(new THREE.BoxGeometry(0.4, 0.4, 0.02), M(panelCols[i], 0.98), back, -4.2 + i * 1.4 + (q % 2 ? 0.2 : -0.2), 1.75 + (i % 2) * 0.25 + (q < 2 ? 0.2 : -0.2), 0.1, false);
  }
  // Big wordmark sign with glow
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: label('RoomTone', { w: 520, h: 130, fg: '#ffd27a', size: 92 }), transparent: true, toneMapped: false }));
  sign.position.set(0, 2.72, 0.07);
  back.add(sign);

  // ---- Window with sunset ----
  const sky = canvasTex(512, 512, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#5d6bb5');
    g.addColorStop(0.45, '#f2a086');
    g.addColorStop(0.7, '#ffd08a');
    g.addColorStop(1, '#ffe7b0');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    x.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 6; i++) {
      x.beginPath();
      x.ellipse(rand() * 512, 80 + rand() * 160, 60 + rand() * 60, 14 + rand() * 8, 0, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = '#ffb35c';
    x.beginPath();
    x.arc(330, 390, 46, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#3c4a3a';
    for (let i = 0; i < 9; i++) {
      x.beginPath();
      x.arc(i * 64 + rand() * 20, 470 + rand() * 20, 50 + rand() * 30, 0, Math.PI * 2);
      x.fill();
    }
    x.fillRect(0, 480, 512, 40);
  });
  for (const wz of [-1.6, 0.9]) {
    const win = new THREE.Group();
    win.position.set(wz, 1.65, 0.03);
    left.add(win);
    mesh(new THREE.PlaneGeometry(1.6, 1.3), new THREE.MeshBasicMaterial({ map: sky, toneMapped: false }), win, 0, 0, 0, false);
    const frameM = M('#f4efe6', 0.5);
    for (const [w, h, x, y] of [[1.75, 0.08, 0, 0.69], [1.75, 0.1, 0, -0.7], [0.08, 1.4, -0.84, 0], [0.08, 1.4, 0.84, 0], [0.05, 1.3, 0, 0], [1.6, 0.05, 0, 0.1]] as const) mesh(new THREE.BoxGeometry(w, h, 0.06), frameM, win, x, y, 0.03);
    mesh(new THREE.BoxGeometry(1.8, 0.05, 0.18), frameM, win, 0, -0.74, 0.08);
    // Little plant on the sill
    const pot = mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.09, 14), M('#c46a4a', 0.8), win, -0.5, -0.67, 0.1);
    void pot;
    for (let l = 0; l < 6; l++) {
      const leaf = mesh(new THREE.SphereGeometry(0.04, 8, 6), M('#5a9a5a', 0.7), win, -0.5 + Math.cos(l) * 0.04, -0.58 + rand() * 0.06, 0.1 + Math.sin(l) * 0.04);
      leaf.scale.set(0.7, 1.4, 0.5);
    }
  }

  // ---- Posters, records & shelves on the right wall ----
  const poster = (text: string, sub: string, bg: string, fg: string) =>
    canvasTex(300, 420, (x) => {
      x.fillStyle = bg;
      x.fillRect(0, 0, 300, 420);
      x.fillStyle = fg;
      x.beginPath();
      x.arc(150, 170, 95, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = bg;
      x.beginPath();
      x.arc(150, 170, 30, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = fg;
      x.font = '900 44px Nunito, sans-serif';
      x.textAlign = 'center';
      x.fillText(text, 150, 340);
      x.font = '700 22px Nunito, sans-serif';
      x.fillText(sub, 150, 380);
    });
  [['LIVE!', 'friday jam', '#2f5d62', '#ffd27a'], ['GROOVE', 'side B', '#c2412f', '#f3e3c3'], ['ECHO', 'tour 26', '#e0a458', '#3b2a20']].forEach(([t, s, b, f], i) => {
    const p = mesh(new THREE.PlaneGeometry(0.6, 0.84), new THREE.MeshStandardMaterial({ map: poster(t, s, b, f), roughness: 0.8 }), right, -2.6 + i * 0.8, 1.8, 0.02, false);
    p.rotation.z = (rand() - 0.5) * 0.06;
  });
  for (let i = 0; i < 5; i++) {
    const rec = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.01, 32), M('#151515', 0.3), back, 3.9 + (i % 3) * 0.38 - 0.2, 2.35 - Math.floor(i / 3) * 0.38 - 0.5, 0.03, false);
    rec.rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 20), M(panelCols[i], 0.6), back, rec.position.x, rec.position.y, 0.035, false).rotation.x = Math.PI / 2;
  }

  // ---- String lights along the ceiling ----
  const bulbM = new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffb357', emissiveIntensity: 3, toneMapped: false });
  const bulbGeo = new THREE.SphereGeometry(0.03, 8, 6);
  for (const z of [-3.6, -1.2]) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-5.8, 2.85, z), new THREE.Vector3(-3, 2.55, z + 0.2), new THREE.Vector3(0, 2.6, z), new THREE.Vector3(3, 2.55, z + 0.2), new THREE.Vector3(5.8, 2.85, z)]);
    mesh(new THREE.TubeGeometry(curve, 60, 0.005, 4), M('#2a2524'), ceiling, 0, 0, 0, false);
    for (let i = 0; i <= 28; i++) mesh(bulbGeo, bulbM, ceiling, ...curve.getPointAt(i / 28).add(new THREE.Vector3(0, -0.04, 0)).toArray(), false);
  }

  // ---- Control area: desk, monitors, chairs ----
  const desk = new THREE.Group();
  desk.position.copy(CONSOLE_POS);
  desk.rotation.y = Math.PI; // faces the band
  root.add(desk);
  const woodM = M('#7a4f33', 0.45, 0, { clearcoat: 0.4 });
  mesh(new THREE.BoxGeometry(2.6, 0.06, 0.8), woodM, desk, 0, 0.56, 0);
  for (const sx of [-1.2, 1.2]) mesh(new THREE.BoxGeometry(0.08, 0.56, 0.7), woodM, desk, sx, 0.28, 0);
  mesh(new THREE.BoxGeometry(2.4, 0.4, 0.04), M('#5e3d27', 0.6), desk, 0, 0.32, 0.36);
  for (const s of [-1, 1]) {
    const mon = new THREE.Group();
    mon.position.set(s * 1.0, 0.59, 0.25);
    mon.rotation.y = -s * 0.35 + Math.PI;
    desk.add(mon);
    mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), M('#2b2523', 0.5), mon, 0, 0.15, 0);
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 24), M('#d9a441', 0.4, 0.6), mon, 0, 0.1, -0.1).rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 18), M('#d9a441', 0.4, 0.6), mon, 0, 0.23, -0.1).rotation.x = Math.PI / 2;
  }
  colliders.push({ x: CONSOLE_POS.x - 0.8, z: CONSOLE_POS.z, r: 0.55 }, { x: CONSOLE_POS.x, z: CONSOLE_POS.z, r: 0.55 }, { x: CONSOLE_POS.x + 0.8, z: CONSOLE_POS.z, r: 0.55 });
  // Producer's chair
  const chair = new THREE.Group();
  chair.position.set(0.3, 0, 3.5);
  root.add(chair);
  mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 20), M('#c2412f', 0.8), chair, 0, 0.36, 0);
  mesh(new THREE.BoxGeometry(0.36, 0.38, 0.06), M('#c2412f', 0.8), chair, 0, 0.58, 0.2).rotation.x = -0.1;
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 8), CHROME(), chair, 0, 0.17, 0);
  mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 5), BLACK(), chair, 0, 0.03, 0);

  // ---- Couch, side table, lamp ----
  const couch = new THREE.Group();
  couch.position.set(-4.4, 0, 3.4);
  couch.rotation.y = Math.PI * 0.85;
  root.add(couch);
  const fabric = M('#2f5d62', 0.95);
  mesh(new THREE.BoxGeometry(1.7, 0.28, 0.7), fabric, couch, 0, 0.2, 0);
  mesh(new THREE.BoxGeometry(1.7, 0.45, 0.2), fabric, couch, 0, 0.45, 0.28);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.2, 0.42, 0.7), fabric, couch, s * 0.85, 0.27, 0);
  for (const s of [-1, 1]) {
    const cushion = mesh(new THREE.SphereGeometry(0.2, 16, 12), M(s > 0 ? '#e0a458' : '#c2412f', 0.95), couch, s * 0.5, 0.48, 0.12);
    cushion.scale.set(1, 0.9, 0.45);
  }
  colliders.push({ x: -4.4, z: 3.4, r: 0.9 });
  const lamp = new THREE.Group();
  lamp.position.set(-5.4, 0, 2.2);
  root.add(lamp);
  mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.04, 20), M('#3b2a20', 0.5), lamp, 0, 0.02, 0);
  mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 8), M('#3b2a20', 0.4, 0.5), lamp, 0, 0.75, 0);
  mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.3, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#f6d9a8', emissive: '#ffb357', emissiveIntensity: 0.6, side: THREE.DoubleSide, roughness: 1 }), lamp, 0, 1.55, 0, false);
  colliders.push({ x: -5.4, z: 2.2, r: 0.3 });

  // ---- Plants ----
  const plant = (x: number, z: number, s = 1) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    root.add(g);
    mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.36, 20), M('#c46a4a', 0.8), g, 0, 0.18, 0);
    mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 20), M('#3b2a20', 1), g, 0, 0.35, 0);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const leaf = mesh(new THREE.SphereGeometry(0.16, 10, 8), M(i % 2 ? '#4f8f4f' : '#6aa860', 0.75), g, Math.cos(a) * 0.17, 0.62 + rand() * 0.35, Math.sin(a) * 0.17);
      leaf.scale.set(0.45, 1.25, 0.18);
      leaf.lookAt(g.position.clone().add(new THREE.Vector3(Math.cos(a) * 2, 2.5, Math.sin(a) * 2)));
    }
    colliders.push({ x, z, r: 0.3 * s });
  };
  plant(-5.5, -3.7, 1.2);
  plant(5.5, -3.7, 1.1);
  plant(-5.5, 4.1);
  plant(2.3, 4.15, 0.9);

  // ---- Vocal booth: glass walls in the front-right corner ----
  const glass = new THREE.MeshPhysicalMaterial({ color: '#cfe7ef', transmission: 0.0, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0, depthWrite: false });
  const booth = new THREE.Group();
  booth.position.set(4.7, 0, 2.95);
  root.add(booth);
  const frame = M('#4a2f1f', 0.5);
  mesh(new THREE.BoxGeometry(2.6, 0.05, 3.2), M('#40413f', 0.95), booth, 0, 0.025, 0, false).receiveShadow = true;
  const gw = mesh(new THREE.PlaneGeometry(3.2, 2.2), glass, booth, -1.3, 1.1, 0, false);
  gw.rotation.y = Math.PI / 2;
  gw.castShadow = false;
  mesh(new THREE.BoxGeometry(0.08, 2.3, 0.08), frame, booth, -1.3, 1.15, 1.6);
  mesh(new THREE.BoxGeometry(0.08, 0.08, 3.2), frame, booth, -1.3, 2.25, 0);
  mesh(new THREE.BoxGeometry(0.08, 2.3, 0.08), frame, booth, -1.3, 1.15, -0.6);
  const gw2 = mesh(new THREE.PlaneGeometry(2.6, 2.2), glass, booth, 0, 1.1, -1.6, false);
  gw2.castShadow = false;
  mesh(new THREE.BoxGeometry(2.6, 0.08, 0.08), frame, booth, 0, 2.25, -1.6);
  mesh(new THREE.BoxGeometry(0.08, 2.3, 0.08), frame, booth, -1.3, 1.15, -1.6);
  const onAir = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), new THREE.MeshBasicMaterial({ map: label('ON AIR', { w: 200, h: 64, bg: '#7a1f1a', fg: '#ffd0c0', size: 38 }), toneMapped: false }));
  onAir.position.set(-1.29, 2.45, 0.6);
  onAir.rotation.y = -Math.PI / 2;
  booth.add(onAir);
  for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(0.06, 0.5, 0.5), M('#3b3f4a', 1), booth, 1.27, 0.8 + (i % 2) * 0.6, -1.1 + Math.floor(i / 2) * 0.8, false);

  // Booth walls are solid for walking, except a door gap near the front.
  for (let z = -1.5; z <= 0.4; z += 0.35) colliders.push({ x: 4.7 - 1.3, z: 2.95 + z, r: 0.12 });
  for (let x = -1.2; x <= 1.2; x += 0.35) colliders.push({ x: 4.7 + x, z: 2.95 - 1.6, r: 0.12 });

  // ---- Master rack in the control area ----
  const masterRack = new THREE.Group();
  masterRack.position.copy(MASTER_RACK_POS);
  masterRack.rotation.y = Math.PI - 0.35;
  root.add(masterRack);
  mesh(new THREE.BoxGeometry(0.56, 0.9, 0.34), M('#3b2a20', 0.5), masterRack, 0, 0.45, -0.12);
  colliders.push({ x: MASTER_RACK_POS.x, z: MASTER_RACK_POS.z, r: 0.4 });
  const rackLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.09), new THREE.MeshStandardMaterial({ map: label('MASTER & BUSES', { w: 320, h: 56, fg: '#f3e3c3', size: 30 }), transparent: true }));
  rackLabel.position.set(0, 0.95, 0.06);
  masterRack.add(rackLabel);

  return { root, colliders, consoleGroup: desk, masterRack, onAir };
}

// ---- Lights ----
export function buildLights(scene: THREE.Scene) {
  const hemi = new THREE.HemisphereLight('#ffe9d0', '#6b4f3a', 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffc78f', 2.4);
  sun.position.set(-9, 6, -1);
  sun.target.position.set(1, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 25;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 6;
  scene.add(sun, sun.target);
  const key = new THREE.SpotLight('#fff1dc', 9, 10, 0.95, 0.8, 1.2);
  key.position.set(0.4, 3.0, 1.6);
  key.target.position.set(0, 0, -1.9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  key.shadow.radius = 5;
  scene.add(key, key.target);
  const lampLight = new THREE.PointLight('#ffb357', 3.5, 6, 1.5);
  lampLight.position.set(-5.4, 1.55, 2.2);
  scene.add(lampLight);
  const warm = new THREE.PointLight('#ffcf8a', 4, 8, 1.4);
  warm.position.set(0, 2.5, 2.8);
  scene.add(warm);
  const booth = new THREE.PointLight('#ffd6a8', 2.2, 4, 1.5);
  booth.position.set(4.8, 2.2, 3.0);
  scene.add(booth);
  // Coloured stage spots: subtle in the studio, driven harder in Performance mode.
  const colors = ['#ff6b6b', '#6bc4ff', '#ffd36b'];
  const spots = colors.map((c, i) => {
    const s = new THREE.SpotLight(c, 0, 10, 0.45, 0.5, 1.3);
    s.position.set(-3 + i * 3, 3.0, 1.5);
    s.target.position.set(STATIONS[i].pos.x, 0, STATIONS[i].pos.z);
    scene.add(s, s.target);
    return s;
  });
  return { hemi, sun, key, lampLight, warm, spots };
}
