// "The bathwater": something under the water pulls Hanako down while she soaks.
// Timeline in seconds. The tub's long axis is stage +z; its head (backrest) is -z
// and the room side, where the camera stands, is -x.
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const ease = (t, a, b) => smooth((t - a) / (b - a));
function sample(keys, t) {
  const i = keys.findIndex(key => key[0] > t);
  if (i <= 0) return keys[i === 0 ? 0 : keys.length - 1].slice(1);
  const a = keys[i - 1], b = keys[i], u = ease(t, a[0], b[0]);
  return a.slice(1).map((v, j) => v + (b[j + 1] - v) * u);
}

export const BATH_DURATION = 16.8;
const dieTime = 9.9, soulTime = 12.6;
const cues = [
  [1.15, "flicker"], [2.2, "gurgle"], [3.62, "grab"], [4.3, "splash"], [5.1, "splash"], [5.9, "splash"],
  [6.25, "gulp"], [6.6, "splash"], [7.05, "scratch"], [7.9, "bubble"], [8.8, "bubble"], [dieTime, "die"],
  [10.55, "surface"], [soulTime, "soul"], [14.2, "line"]
];
// Root: lean back from upright (rad), hips z, hips lift above the tub floor.
const rootKeys = [
  [0, -.55, -.38, .08], [3.55, -.55, -.38, .08], [3.85, -.62, -.42, .1], [4.5, -.72, -.42, .07],
  [5.3, -.98, -.27, .06], [6.15, -1.28, -.08, .05], [6.9, -1.43, -.02, .04], [7.6, -1.37, .01, .05],
  [8.6, -1.45, .02, .04], [10.4, -1.49, .03, .035]
];
const headKeys = [ // x (nod), y (turn), z (tilt)
  [0, .34, .05, .04], [2.0, .34, .05, .04], [2.5, .5, -.12, 0], [3.3, .46, .18, -.05], [3.7, -.28, -.1, .12],
  [4.4, -.42, .25, -.15], [5.0, -.3, -.3, .18], [5.7, -.5, .2, -.1], [6.5, -.45, -.15, .08], [8.0, -.5, .05, 0], [10, -.42, .1, .06]
];
// Hand targets: [t, x, y, z] in stage space.
const handKeys = {
  L: [[0, .4, .78, -.22], [3.55, .4, .78, -.22], [3.85, .16, .93, -.55], [4.35, .41, .8, -.12], [5.6, .41, .8, -.02],
    [6.0, .4, .62, .05], [6.6, .25, .42, -.05], [8, .2, .4, -.02], [10, .15, .38, -.04]],
  R: [[0, -.4, .78, -.22], [3.55, -.4, .78, -.22], [3.85, -.15, .93, -.55], [4.4, -.41, .8, -.05], [6.9, -.41, .8, .05],
    [7.3, -.42, .78, .3], [7.6, -.3, .66, .2], [8.1, -.2, 1.02, .16], [8.9, -.17, 1.06, .14], [9.6, -.14, .62, .1], [10.4, -.1, .4, .08]]
};
const cameraKeys = [
  [0, -1.9, 1.55, .95], [2.2, -1.5, 1.42, .5], [3.6, -1.22, 1.34, .12], [5.0, -1.15, 1.6, .35], [6.5, -.95, 1.86, .12],
  [8.0, -.95, 1.62, .42], [9.8, -1.05, 1.76, .25], [10.5, -1.1, .98, 1.15], [12.4, -1.15, 1.02, 1.05],
  [13.6, -1.7, 1.42, .95], [15.2, -2.35, 1.6, .9], [16.8, -2.4, 1.6, .9]
];
const aimKeys = [
  [0, 0, .85, -.35], [2.2, 0, .9, -.45], [3.6, 0, .84, -.5], [5.0, 0, .62, -.25], [6.5, 0, .58, -.05],
  [8.0, -.15, .78, .1], [9.8, 0, .6, 0], [10.5, 0, .66, .55], [12.4, 0, .66, .55], [13.6, -.2, .95, -.05],
  [15.2, -.55, 1.15, .05], [16.8, -.55, 1.15, .05]
];
const splashes = [4.3, 5.1, 5.9, 6.6];

export function playBathDeath(T, bath, o) {
  const tub = bath.tub, V = (x, y, z) => new T.Vector3(x, y, z);
  const stage = new T.Group();
  stage.name = "Bathwater remains";
  stage.position.set(bath.x, 0, bath.z);
  o.scene.add(stage);
  const materials = [], geometries = [];
  const own = (m) => { materials.push(m); return m; };
  const geo = (g) => { geometries.push(g); return g; };
  const lambert = (color, extra = {}) => own(new T.MeshLambertMaterial({color, flatShading: true, ...extra}));
  const skin = lambert(0xc4cfca, {emissive: 0x1d2826});
  const nail = lambert(0x6d7472);
  const hairMat = lambert(0x0c0b10);
  const socket = lambert(0x050506);
  const bubbleMat = own(new T.MeshLambertMaterial({color: 0xdfeef0, emissive: 0x1c2a2c, transparent: true, opacity: .55, depthWrite: false}));
  const dropMat = own(new T.MeshLambertMaterial({color: 0xc5d6d8, emissive: 0x18262a, transparent: true, opacity: .7, depthWrite: false}));
  const bloodMat = own(new T.MeshLambertMaterial({color: 0x7a0d16, emissive: 0x1c0204, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide}));
  const scratchMat = lambert(0x6a0a12, {emissive: 0x1a0204});
  const puddleMat = own(new T.MeshLambertMaterial({color: 0x2c3537, transparent: true, opacity: 0, depthWrite: false}));
  const unit = geo(new T.CylinderGeometry(1, 1, 1, 6));
  const ball = geo(new T.SphereGeometry(1, 10, 8));
  const up = V(0, 1, 0), dir = V(0, 0, 0);
  function rod(material, radius) {
    const m = new T.Mesh(unit, material); m.scale.set(radius, 1, radius); stage.add(m); return m;
  }
  function lay(m, a, b) {
    dir.subVectors(b, a); const length = dir.length();
    m.visible = length > 1e-4; if (!m.visible) return;
    m.position.copy(a).lerp(b, .5); m.scale.y = length;
    m.quaternion.setFromUnitVectors(up, dir.divideScalar(length));
  }
  function blob(material, r, sx = 1, sy = 1, sz = 1) {
    const m = new T.Mesh(ball, material); m.scale.set(r * sx, r * sy, r * sz); stage.add(m); return m;
  }

  // ---------- Hanako in the tub ----------
  const body = o.makeActor("solid"), soul = o.makeActor("ghost");
  stage.add(body, soul);
  o.bind(body);
  body.updateMatrixWorld(true);
  const bones = body.userData.bones;
  const hipsRest = bones.hips.getWorldPosition(V(0, 0, 0)).sub(stage.position);
  const lean = new T.Quaternion(), hipsGoal = V(0, 0, 0), turned = V(0, 0, 0);
  const shoulderL = V(0, 0, 0), shoulderR = V(0, 0, 0), headPoint = V(0, 0, 0), chestPoint = V(0, 0, 0);

  const parentRotation = new T.Quaternion(), desired = new T.Quaternion(), bendAxis = V(0, 0, 0);
  const shoulder = V(0, 0, 0), wrist = V(0, 0, 0), elbow = V(0, 0, 0);
  function aimBone(bone, child, from, to, mix) {
    bone.parent.getWorldQuaternion(parentRotation).invert();
    dir.copy(to).sub(from).normalize().applyQuaternion(parentRotation);
    desired.setFromUnitVectors(child.position.clone().normalize(), dir);
    bone.quaternion.slerp(desired, mix);
    bone.updateMatrixWorld(true);
  }
  // Two-bone reach toward a stage-space palm target, elbows out and down.
  function reachArm(side, palm, grip) {
    const b = bones, upper = b["upperarm_" + side], lower = b["forearm_" + side], hand = b["hand_" + side];
    upper.getWorldPosition(shoulder);
    wrist.copy(palm).add(stage.position);
    const a = lower.position.length(), c = hand.position.length();
    const length = Math.min(a + c - .001, Math.max(.06, shoulder.distanceTo(wrist)));
    const axis = wrist.clone().sub(shoulder).normalize();
    const along = (a * a + length * length - c * c) / (2 * length);
    const sign = side === "L" ? 1 : -1;
    bendAxis.set(sign * .8, -.5, -.2).addScaledVector(axis, -bendAxis.dot(axis)).normalize();
    elbow.copy(shoulder).addScaledVector(axis, along).addScaledVector(bendAxis, Math.sqrt(Math.max(0, a * a - along * along)));
    wrist.copy(shoulder).addScaledVector(axis, length);
    aimBone(upper, lower, shoulder, elbow, 1);
    aimBone(lower, hand, elbow, wrist, 1);
    hand.rotation.set(.1, sign * .2, sign * (.15 + .5 * grip));
    if (b["fingers_" + side]) b["fingers_" + side].rotation.z = -sign * (.1 + .9 * grip);
  }
  function posePerson(t) {
    o.bind(body);
    const [tilt, hz, lift] = sample(rootKeys, t);
    const thrash = ease(t, 4.1, 4.5) * (1 - ease(t, 7.4, 8.4));
    const roll = .16 * thrash * Math.sin(t * 9.3);
    lean.setFromEuler(new T.Euler(tilt, 0, roll));
    body.quaternion.copy(lean);
    hipsGoal.set(.03 * thrash * Math.sin(t * 7), tub.bottom + lift, hz);
    turned.copy(hipsRest).applyQuaternion(lean);
    body.position.copy(hipsGoal).sub(turned);
    const b = bones;
    const kick = .28 * thrash;
    b.thigh_L.rotation.set(-2.15 - tilt + kick * Math.sin(t * 11), 0, .12);
    b.thigh_R.rotation.set(-2.11 - tilt + kick * Math.sin(t * 11 + 2), 0, -.12);
    b.shin_L.rotation.x = 1.22 + .3 * thrash * Math.max(0, Math.sin(t * 11 + 1));
    b.shin_R.rotation.x = 1.15 + .3 * thrash * Math.max(0, Math.sin(t * 11 + 3));
    b.chest.rotation.set(.06 - .14 * ease(t, 3.6, 4.2), .1 * thrash * Math.sin(t * 6), 0);
    b.head.rotation.fromArray(sample(headKeys, t).map((v, i) => v + (i === 1 ? .2 * thrash * Math.sin(t * 8.4) : 0)));
    const face = t < 2.2 ? 4 : t < 3.6 ? "dread" : t < 6.2 ? "panic" : t < dieTime ? "rolledEyes" : "vacant";
    body.userData.face(face);
    body.updateMatrixWorld(true);
    const flail = (side, k) => V(...sample(handKeys[side], t)).add(V(0, .05 * thrash * Math.sin(t * 12 + k), .04 * thrash * Math.cos(t * 10 + k)));
    reachArm("L", flail("L", 0), t > 3.6 && t < 6.0 ? 1 : .3);
    reachArm("R", flail("R", 2), t > 3.6 && t < 7.3 ? 1 : t > 8.0 && t < 9.0 ? -.4 : .3);
    body.updateMatrixWorld(true);
    b.upperarm_L.getWorldPosition(shoulderL).sub(stage.position);
    b.upperarm_R.getWorldPosition(shoulderR).sub(stage.position);
    b.head.getWorldPosition(headPoint).sub(stage.position);
    b.chest.getWorldPosition(chestPoint).sub(stage.position);
  }

  // ---------- the thing under the water ----------
  const hands = [-1, 1].map(side => {
    const arm = rod(skin, .04), wristJoint = blob(skin, .038), palm = blob(skin, .062, 1, .38, 1.15);
    const fingers = [-1.5, -.5, .5, 1.5].map(() => [rod(skin, .012), rod(skin, .011), blob(nail, .012, 1, .6, 1)]);
    const thumb = [rod(skin, .013), rod(skin, .012)];
    return {side, arm, wristJoint, palm, fingers, thumb, list: [arm, wristJoint, palm, ...fingers.flat(), ...thumb]};
  });
  const elbowPoint = V(0, 0, 0), wristPoint = V(0, 0, 0), reach = V(0, 0, 0), across = V(0, 0, 0), knuckle = V(0, 0, 0);
  function poseHands(t) {
    const rise = ease(t, 3.25, 3.7), letGo = ease(t, 9.4, 10.6);
    for (const h of hands) {
      const visible = t > 3.05 && t < 10.8;
      for (const m of h.list) m.visible = visible;
      if (!visible) continue;
      const s = h.side, target = s < 0 ? shoulderR : shoulderL;
      clampTub(elbowPoint.set(s * .15, tub.bottom + .05, target.z - .3));
      const hold = V(target.x - s * .01, target.y + .1, target.z - .02);
      const start = V(s * .2, tub.water - .18, -.68);
      wristPoint.copy(start).lerp(hold, rise);
      wristPoint.y -= .5 * letGo; wristPoint.z -= .2 * letGo;
      lay(h.arm, elbowPoint, wristPoint);
      h.wristJoint.position.copy(wristPoint);
      reach.set(-s * .12, -.6, 1).normalize();
      across.set(1, 0, 0);
      knuckle.copy(wristPoint).addScaledVector(reach, .095);
      h.palm.position.copy(wristPoint).addScaledVector(reach, .048);
      h.palm.lookAt(stage.localToWorld(knuckle.clone()));
      const curl = rise * (1 - letGo);
      h.fingers.forEach(([a, b, tip], i) => {
        const offset = (i - 1.5) * .024;
        const base = knuckle.clone().addScaledVector(across, offset);
        const mid = base.clone().addScaledVector(reach, .06 - .025 * curl).add(V(0, .015 - .055 * curl, 0));
        const end = mid.clone().addScaledVector(reach, .042 - .03 * curl).add(V(0, -.06 * curl, 0));
        lay(a, base, mid); lay(b, mid, end); tip.position.copy(end);
      });
      const thumbBase = wristPoint.clone().addScaledVector(across, -s * .035);
      const thumbMid = thumbBase.clone().addScaledVector(reach, .03).add(V(-s * .02, -.02 * curl, 0));
      lay(h.thumb[0], thumbBase, thumbMid);
      lay(h.thumb[1], thumbMid, thumbMid.clone().addScaledVector(reach, .03).add(V(0, -.03 * curl, 0)));
    }
  }
  // Long black hair spreading over the surface from under her back.
  const strands = Array.from({length: 16}, (_, i) => {
    const angle = Math.PI + (i / 15 - .5) * 2.7;
    return {angle, length: .32 + .3 * ((i * 7) % 5) / 4, parts: Array.from({length: 6}, () => rod(hairMat, .0055))};
  });
  const r = (tub.W - 2 * tub.wall) / 2 - .03, half = (tub.L - 2 * tub.wall) / 2 - r - .02;
  function clampTub(p) {
    const cz = Math.max(-half, Math.min(half, p.z)), dx = p.x, dz = p.z - cz, d = Math.hypot(dx, dz);
    if (d > r) { p.x = dx * r / d; p.z = cz + dz * r / d; }
    return p;
  }
  function poseHair(t, level) {
    const grow = ease(t, 2.5, 4.0) * (1 - .35 * ease(t, 12.5, 15));
    const origin = V(0, level + .004, -.62);
    for (const strand of strands) {
      const visible = grow > .01;
      let previous = origin.clone();
      strand.parts.forEach((part, k) => {
        part.visible = visible;
        if (!visible) return;
        const u = (k + 1) / strand.parts.length, a = strand.angle + .25 * Math.sin(t * 1.1 + strand.angle * 3 + u * 4) * u;
        const next = clampTub(origin.clone().add(V(Math.sin(a) * strand.length * u * grow, 0, Math.cos(a) * strand.length * u * grow * 1.6)));
        next.y = level + .004;
        lay(part, previous, next); previous = next;
      });
    }
  }
  // The face that comes up at the foot end once she has stopped moving.
  const face = new T.Group(); stage.add(face);
  {
    const add = (m, x, y, z, sx, sy, sz) => { const mesh = new T.Mesh(ball, m); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); face.add(mesh); };
    add(skin, 0, 0, 0, .1, .13, .105);
    for (const s of [-1, 1]) add(socket, s * .038, .02, .085, .026, .018, .02);
    add(socket, 0, -.06, .09, .022, .006, .01);
    add(hairMat, 0, .03, -.03, .108, .125, .1);
    face.children[face.children.length - 1].scale.z = .1;
  }
  const bubbles = Array.from({length: 12}, () => blob(bubbleMat, .014));
  const drops = splashes.flatMap((start, i) => Array.from({length: 9}, (_, k) => {
    const a = k / 9 * Math.PI * 2 + i, speed = .9 + (k % 3) * .35;
    return {start, mesh: blob(dropMat, .012 + (k % 2) * .006), v: V(Math.cos(a) * speed * .45 - .25, 1.4 + (k % 4) * .35, Math.sin(a) * speed * .45)};
  }));
  const clouds = [[.05, -.25, .13], [-.12, -.05, .1], [.15, .1, .12], [-.05, .25, .09], [0, -.5, .11]].map(([x, z, s]) => {
    const disc = new T.Mesh(geo(new T.CircleGeometry(1, 16)), bloodMat);
    disc.rotation.x = -Math.PI / 2; disc.position.set(x, tub.water - .03, z); disc.userData.size = s; disc.renderOrder = 1; stage.add(disc); return disc;
  });
  const scratches = Array.from({length: 4}, (_, i) => {
    const m = new T.Mesh(geo(new T.BoxGeometry(.006, .004, .16)), scratchMat);
    m.position.set(-tub.W / 2 * 1.06 + .01 + i * .012, tub.rim + .007, .12 + i * .03); m.rotation.y = .1 * (i - 1.5); stage.add(m); return m;
  });
  const puddle = new T.Mesh(geo(new T.CircleGeometry(1, 20)), puddleMat);
  puddle.rotation.x = -Math.PI / 2; puddle.position.set(-.72, .143, .05); puddle.renderOrder = 1; stage.add(puddle);

  // ---------- the water itself ----------
  const water = bath.water, positions = water.geometry.attributes.position, rest = water.userData.rest;
  const baseColor = water.material.color.clone(), baseEmissive = water.material.emissive.clone(), baseOpacity = water.material.opacity;
  const murk = new T.Color(0x2b3739), red = new T.Color(0x5c0c15), redGlow = new T.Color(0x1a0204);
  const lampPower = bath.lamp.intensity, lampEmissive = bath.shade.material.emissive.clone();
  const sources = [V(0, 0, 0), V(0, 0, 0), V(0, 0, 0)];
  function ripple(t, gore) {
    const thrash = ease(t, 3.6, 4.2) * (1 - ease(t, 7.6, 9.6));
    const rise = ease(t, 10.4, 10.8) * (1 - ease(t, 11.4, 13));
    sources[0].copy(chestPoint); sources[1].copy(shoulderR); sources[2].set(0, 0, .55);
    const amps = [.022 * thrash + .0015, .014 * thrash, .012 * rise];
    for (let i = 0; i < positions.count; i++) {
      const x = rest[i * 3], z = rest[i * 3 + 2];
      let y = 0;
      for (let k = 0; k < 3; k++) {
        if (!amps[k]) continue;
        const d = Math.hypot(x - sources[k].x, z - sources[k].z);
        y += amps[k] * Math.sin(d * 38 - t * (k ? 11 : 9)) * Math.exp(-d * 3.2);
      }
      positions.setY(i, y);
    }
    positions.needsUpdate = true;
    water.geometry.computeVertexNormals();
    const dark = ease(t, 2.6, 4.2), blood = gore ? ease(t, 5.0, 9.0) : 0;
    water.material.color.copy(baseColor).lerp(murk, dark).lerp(red, blood);
    water.material.emissive.copy(baseEmissive).lerp(redGlow, blood);
    water.material.opacity = baseOpacity + .08 * dark;
  }
  let level = tub.water;

  // ---------- timeline ----------
  let cueIndex = 0, ended = false, clock = 0, goreShown = null;
  const point = V(0, 0, 0), cameraPoint = V(0, 0, 0), look = V(0, 0, 0);
  function goreState(on) {
    goreShown = on;
    const spread = on ? ease(clock, 5.0, 9.0) : 0;
    bloodMat.opacity = .55 * spread;
    for (const cloud of clouds) cloud.scale.setScalar(cloud.userData.size * (.3 + 1.7 * spread));
    for (const s of scratches) s.visible = on && clock > 7.05;
    puddleMat.color.setHex(on ? 0x4a2226 : 0x2c3537);
  }
  return {
    frame(t) {
      clock = t;
      const gore = o.gore();
      posePerson(t);
      poseHands(t);
      level = tub.water - .05 * ease(t, 13.5, 16.5);
      water.position.y = level;
      poseHair(t, level);
      ripple(t, gore);
      goreState(gore);
      // bubbles from her mouth once her head is under
      bubbles.forEach((bubble, i) => {
        const start = 6.2 + i * .3 + (i % 3) * .07, k = (t - start) / .55;
        bubble.visible = k > 0 && k < 1.25 && t < 10;
        if (!bubble.visible) return;
        const pop = Math.max(0, k - 1) * 4;
        bubble.position.set(headPoint.x + .03 * Math.sin(i * 2.3), Math.min(level + .005, headPoint.y + k * (level - headPoint.y)), headPoint.z + .02 * Math.cos(i));
        bubble.scale.setScalar(.012 * (1 + (i % 3) * .4) * (1 + pop));
        bubbleMat.opacity = .55 * (1 - .8 * Math.max(0, k - 1));
      });
      for (const drop of drops) {
        const k = t - drop.start;
        drop.mesh.visible = k > 0 && k < .7;
        if (!drop.mesh.visible) continue;
        point.set(chestPoint.x * .6, level, chestPoint.z * .6).addScaledVector(drop.v, k);
        point.y -= 4.9 * k * k;
        drop.mesh.visible = point.y > .15;
        drop.mesh.position.copy(point);
      }
      puddleMat.opacity = .55 * ease(t, 4.3, 7.0);
      puddle.scale.set(.16 + .2 * ease(t, 4.3, 8.0), .24 + .3 * ease(t, 4.3, 8.0), 1);
      // the face: eyes break the surface, watch, then sink back
      const surfaced = ease(t, 10.5, 11.6) * (1 - ease(t, 12.6, 13.6));
      face.visible = t > 10.3 && t < 13.8;
      face.position.set(0, level - .17 + .19 * surfaced, .5);
      face.lookAt(o.camera.position);
      // lamp flicker; the steam dies as the water goes cold
      const flicker = (t > 1.1 && t < 1.6) || (t > 3.4 && t < 4.4) || (t > 10.3 && t < 11.1)
        ? (Math.sin(t * 63) > .2 ? 1 : .18) : 1;
      const dim = 1 - .4 * ease(t, 9.6, 11);
      bath.lamp.intensity = lampPower * flicker * dim;
      bath.shade.material.emissive.copy(lampEmissive).multiplyScalar(flicker * dim);
      bath.steamFade = 1 - ease(t, 2.5, 4);
      // her soul rises out of the water and stands beside the tub
      const take = ease(t, soulTime, soulTime + 2.2);
      soul.visible = t > soulTime && t < BATH_DURATION; // the player's own ghost takes over at the end
      o.bind(soul);
      const s = soul.userData.bones;
      s.upperarm_L.rotation.z = -1.2 - .15 * take; s.upperarm_R.rotation.z = 1.2 + .15 * take;
      s.head.rotation.set(.25 * (1 - take) + .12, -.3 * take, .1 * take);
      s.thigh_L.rotation.x = -.3 * (1 - take); s.shin_L.rotation.x = .4 * (1 - take);
      soul.userData.face(7);
      soul.scale.setScalar(.62 + .3 * take);
      soul.rotation.set(-1.45 * (1 - take), -.6 * take, 0);
      soul.position.set(-.8 * take, tub.bottom + .05 + (.12 - .05 - tub.bottom) * take + .08 * Math.sin(t * 1.6) * take, -.15 + .3 * take);
      while (cueIndex < cues.length && t >= cues[cueIndex][0]) {
        const cue = cues[cueIndex++][1];
        if (cue === "die") o.die(); else o.cue(cue);
      }
      o.target.copy(stage.position).add(V(-.2, .8, 0));
      if (t >= BATH_DURATION && !ended) { ended = true; o.end(); }
    },
    camera(t) {
      const handoff = ease(t, BATH_DURATION - .7, BATH_DURATION);
      look.copy(stage.position).add(point.fromArray(sample(aimKeys, t)));
      o.camera.position.copy(stage.position).add(cameraPoint.fromArray(sample(cameraKeys, t))).lerp(o.handoff, handoff);
      look.lerp(o.target, handoff);
      o.camera.lookAt(look);
    },
    showGore(on) { if (on !== goreShown) goreState(on); },
    cleanup() {
      positions.array.set(rest); positions.needsUpdate = true; water.geometry.computeVertexNormals();
      water.position.y = tub.water;
      water.material.color.copy(baseColor); water.material.emissive.copy(baseEmissive); water.material.opacity = baseOpacity;
      bath.lamp.intensity = lampPower; bath.shade.material.emissive.copy(lampEmissive); bath.steamFade = 1;
      stage.removeFromParent();
      materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose());
      o.disposeActors();
    }
  };
}
