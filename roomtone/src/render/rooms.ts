import * as THREE from 'three';
import { buildLights, buildStudio, CONSOLE_POS, MASTER_RACK_POS, RISER, ROOM, STATIONS, type Collider, type RoomLights, type Station } from './studio';

// A room is everything location-specific: geometry, lights, where musicians stand, where you can walk.
// World holds one Room at a time; musicians, gear and cameras re-read it on switch.

export type RoomId = 'studio' | 'hall';

export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Room {
  id: RoomId;
  root: THREE.Group;
  lights: RoomLights;
  stations: Station[];
  colliders: Collider[];
  boxes: BoxCollider[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; height: number };
  floorY: (x: number, z: number) => number;
  console: { pos: THREE.Vector3; rotY: number };
  rack: { pos: THREE.Vector3; rotY: number };
  director: { pos: THREE.Vector3; target: THREE.Vector3; maxDistance: number };
  fpStart: { pos: THREE.Vector3; yaw: number };
  stageCenter: THREE.Vector3; // what cinematic and producer cameras frame
  cutaways: THREE.Object3D[];
  atmosphere: THREE.Object3D[]; // shafts/dust, shown on presets with atmosphere
  fog: THREE.Fog | THREE.FogExp2;
  background: THREE.Color;
  envIntensity: number;
  exposure: number;
  update?: (dt: number, elapsed: number, level: number) => void;
}

export function studioRoom(): Room {
  const s = buildStudio();
  const lights = buildLights(s.root);
  const cutaways: THREE.Object3D[] = [];
  s.root.traverse((o) => o.userData.cutaway && cutaways.push(o));
  return {
    id: 'studio',
    root: s.root,
    lights,
    stations: STATIONS,
    colliders: s.colliders,
    boxes: [],
    bounds: ROOM,
    floorY: (x, z) => (z < RISER.z + Math.sqrt(Math.max(0, RISER.r * RISER.r - x * x)) ? 0.1 : 0),
    console: { pos: CONSOLE_POS, rotY: Math.PI },
    rack: { pos: MASTER_RACK_POS, rotY: Math.PI - 0.35 },
    director: { pos: new THREE.Vector3(0, 4.3, 3.0), target: new THREE.Vector3(0, 0.45, -1.3), maxDistance: 13 },
    fpStart: { pos: new THREE.Vector3(0, 0, 3.9), yaw: 0 },
    stageCenter: new THREE.Vector3(0, 0.1, -1.8),
    cutaways,
    atmosphere: [],
    fog: new THREE.Fog('#2a1e18', 14, 30),
    background: new THREE.Color('#2a1e18'),
    envIntensity: 0.35,
    exposure: 1.05,
  };
}
