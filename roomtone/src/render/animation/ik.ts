import * as THREE from 'three';

// Analytic two-bone IK for limbs whose child joint sits along the bone's local -Y axis (our rig convention).
// The bend plane is set by a pole direction (where the elbow/knee should point).

const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _bend = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();

// Rotate `bone` (in world space) so its local -Y points along `along`, with local +Z leaning to `side`.
export function aimBone(bone: THREE.Object3D, along: THREE.Vector3, side: THREE.Vector3) {
  _y.copy(along).normalize().negate();
  _z.copy(side).addScaledVector(_y, -side.dot(_y));
  if (_z.lengthSq() < 1e-8) _z.set(0, 0, 1).addScaledVector(_y, -_y.z);
  _z.normalize();
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z);
  _q.setFromRotationMatrix(_m);
  bone.parent!.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q));
  bone.updateMatrixWorld(true);
}

export function solveTwoBone(upper: THREE.Object3D, lower: THREE.Object3D, end: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3, softness = 0.002) {
  upper.parent!.updateWorldMatrix(true, false);
  upper.updateMatrixWorld(true);
  upper.getWorldPosition(_s);
  const a = lower.position.length() * worldScale(upper);
  const b = end.position.length() * worldScale(lower);
  _dir.subVectors(target, _s);
  const d = THREE.MathUtils.clamp(_dir.length(), Math.abs(a - b) + 1e-4, a + b - softness);
  _dir.normalize();
  const cosA = THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  _bend.copy(pole).addScaledVector(_dir, -pole.dot(_dir));
  if (_bend.lengthSq() < 1e-8) _bend.set(0, 0, -1);
  _bend.normalize();
  _e.copy(_s).addScaledVector(_dir, a * cosA).addScaledVector(_bend, a * sinA);
  aimBone(upper, _v.subVectors(_e, _s), _bend);
  const t = _dir.clone().multiplyScalar(d).add(_s);
  aimBone(lower, _v.subVectors(t, _e), _bend);
}

function worldScale(o: THREE.Object3D) {
  const s = new THREE.Vector3();
  o.getWorldScale(s);
  return s.y;
}

// Set an object's world orientation to look from its position toward `point` (+Z forward), with `up`.
export function orientWorld(obj: THREE.Object3D, forward: THREE.Vector3, up: THREE.Vector3) {
  _z.copy(forward).normalize();
  _x.crossVectors(up, _z).normalize();
  _y.crossVectors(_z, _x).normalize();
  _m.makeBasis(_x, _y, _z);
  _q.setFromRotationMatrix(_m);
  obj.parent!.getWorldQuaternion(_pq);
  obj.quaternion.copy(_pq.invert().multiply(_q));
  obj.updateMatrixWorld(true);
}

export const damp = (a: number, b: number, lambda: number, dt: number) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));
export const smoothstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
