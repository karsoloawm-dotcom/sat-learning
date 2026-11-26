// "The old blade": the rusted katana on the trophy-room rack stirs, rises on its own, cuts off
// Hanako's flight and takes her head with one flat swing. The body stands for a beat, then folds.
// Stage space: she starts at the origin facing +z, the rack is ~.77 ahead of her.
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const ease = (t, a, b) => smooth((t - a) / (b - a));
function sample(keys, t) {
  const i = keys.findIndex(key => key[0] > t);
  if (i <= 0) return keys[i === 0 ? 0 : keys.length - 1].slice(1);
  const a = keys[i - 1], b = keys[i], u = ease(t, a[0], b[0]);
  return a.slice(1).map((v, j) => v + (b[j + 1] - v) * u);
}

// The swing: an invisible hand holds the hilt at SWING.hilt and sweeps the blade flat, from her left to her right.
const SWING = {hilt: [0, 1.36, -1.66], from: 3.6, to: -.45, start: 6.95, length: .2};
const cutAt = SWING.start + SWING.length * (Math.PI / 2 - SWING.from) / (SWING.to - SWING.from);
export const BLADE = {hum: 1.4, rise: [2.3, 3.4],
  swing: [SWING.start, SWING.start + SWING.length], cut: cutAt, buckle: [8.25, 8.85], fall: [8.85, 9.45],
  death: 9.6, home: [10.0, 12.2], soul: 12.4, duration: 16.4};
const cues = [
  [BLADE.hum, "hum"], [2.3, "rise"], [2.45, "gasp"], [3.7, "turn"], [4.35, "step"], [4.75, "step"], [4.55, "whoosh"],
  [5.05, "skid"], [5.6, "sob"], [6.5, "whoosh"], [SWING.start + .02, "swing"], [cutAt, "cut"], [7.62, "headLand"],
  [7.9, "headLand"], [8.8, "knees"], [9.4, "body"], [BLADE.death, "die"], [12.05, "rest"], [BLADE.soul, "soul"], [14.4, "line"]
];
// Her knees as the pivot: [t, x, y, z, yaw, lean]. The root is placed so the knee point lands on (x,y,z).
const knee = [0, .511, -.02];
const rootKeys = [
  [0, 0, .511, 0, 0, 0], [1.4, 0, .511, .03, 0, .03], [2.4, 0, .511, .03, 0, 0], [3.0, 0, .511, -.32, 0, -.05],
  [3.6, 0, .511, -.40, 0, -.04], [4.1, .02, .50, -.55, Math.PI, .10], [4.55, .03, .53, -1.0, Math.PI, .14],
  [5.0, .02, .50, -1.55, Math.PI, .12], [5.25, 0, .505, -1.66, Math.PI, -.14], [5.8, 0, .511, -1.42, Math.PI, -.08],
  [6.4, 0, .511, -1.18, Math.PI, -.10], [7.0, 0, .511, -1.16, Math.PI, -.06], [7.3, 0, .511, -1.14, Math.PI, -.10],
  [8.25, 0, .511, -1.13, Math.PI, -.03], [8.85, 0, .065, -1.15, Math.PI, .12], [9.45, 0, .10, -1.2, Math.PI, 1.5]
];
const legKeys = { // thigh_L.x, shin_L.x, thigh_R.x, shin_R.x, foot_L.x, foot_R.x
  hold: [[0, 0, 0, 0, 0, 0, 0], [2.65, 0, 0, 0, 0, 0, 0], [2.8, -.45, .7, 0, 0, 0, 0], [3.0, 0, .1, -.1, .25, 0, 0], [3.2, 0, 0, 0, 0, 0, 0],
    [5.0, 0, 0, 0, 0, 0, 0], [5.3, -.35, .25, .2, .15, 0, 0], [5.55, .25, .55, -.2, .1, 0, 0], [5.8, -.05, .1, .15, .5, 0, 0],
    [6.05, .2, .45, 0, .1, 0, 0], [6.4, 0, .1, .05, .1, 0, 0], [8.25, 0, .05, 0, .05, 0, 0],
    [8.85, -.12, 1.6, -.1, 1.55, .55, .55], [9.45, .05, .15, .1, .1, .1, .1]]
};
const headKeys = [ // x (nod), y (turn), z (tilt)
  [0, .2, 0, 0], [1.4, .26, .05, 0], [2.3, .1, 0, 0], [2.9, -.22, 0, .04], [3.6, -.16, .08, 0],
  [4.1, .05, -.3, 0], [4.5, -.05, .7, .1], [4.8, .05, 0, 0], [5.1, -.2, 0, 0], [6.4, -.05, 0, 0], [6.9, .02, .6, -.05]
];
// Palms in her own body frame (x to her left, y up, z ahead) and how strongly the arms reach for them.
const palmKeys = {
  L: [[0, .2, .95, .08], [2.5, .2, .95, .08], [2.9, .07, 1.22, .16], [3.6, .09, 1.28, .2], [5.1, .14, 1.35, .26],
    [5.4, .17, 1.45, .32], [6.4, .13, 1.4, .3], [6.8, .06, 1.12, .15], [7.3, .07, 1.1, .16], [8.2, .2, 1.0, .12]],
  R: [[0, -.2, .95, .08], [2.5, -.2, .95, .08], [2.9, -.07, 1.24, .15], [3.6, -.09, 1.3, .19], [5.1, -.14, 1.37, .25],
    [5.4, -.18, 1.44, .3], [6.4, -.14, 1.42, .3], [6.8, -.06, 1.13, .15], [7.3, -.08, 1.1, .16], [8.2, -.2, 1.0, .12]]
};
// The sword: [t, hilt x,y,z, tip dir x,y,z, edge dir x,y,z], before and after the swing.
const flyKeys = [
  [2.3, null], [3.0, -.12, 1.55, .55, .25, .15, -.95, 0, 1, 0], [3.5, -.1, 1.5, .45, .15, .05, -.99, 0, 1, 0],
  [3.9, -.1, 1.75, .1, .1, .5, -.85, 0, 1, 0], [4.55, -.05, 2.05, -1.2, 0, -.2, -1, 0, 1, 0],
  [5.0, 0, 1.45, -2.65, 0, 0, 1, 1, 0, 0], [5.6, -.05, 1.42, -2.45, 0, .05, 1, 1, 0, 0], [6.3, -.25, 1.4, -2.15, -.4, 0, 1, 0, -1, 0],
  [6.75, -.55, 1.38, -2.0, -.85, 0, -.5, -.5, 0, .85], [SWING.start, "swing"]
];
const homeKeys = [
  [SWING.start + SWING.length, "swing"], [7.6, .65, 1.55, -1.55, .6, .5, .62, 0, 1, 0], [8.6, .55, 1.75, -1.4, .2, .9, .4, 0, 0, 1],
  [9.8, .4, 1.7, -.6, -.1, .95, .1, 0, 0, 1], [10.6, -.35, 1.55, .3, .3, -.1, -.95, 0, 1, 0], [BLADE.home[1], null]
];
// Severed head: [t, x, y, z, roll, wobble]. It rolls one full turn and comes to rest upright on the cut, facing the camera.
const headFlight = [
  [cutAt, 0, 0, 0, 0, 0], [7.2, .1, .06, -.1, .35, .1], [7.42, .22, -.6, -.35, 1.3, .25], [7.62, .32, -1.31, -.6, 2.2, .1],
  [7.76, .4, -1.23, -.75, 3.0, -.05], [7.9, .47, -1.31, -.88, 3.9, .05], [8.45, .57, -1.31, -1.05, 5.2, 0], [8.9, .6, -1.31, -1.13, 5.9, 0]
];
const cameraKeys = [ // eye x,y,z then look x,y,z (stage space)
  [0, 0.55, 1.62, -1.0, -0.05, 1.3, .75], [1.6, 0.5, 1.55, -.8, 0, 1.32, .75], [2.4, 1.1, 1.3, -1.35, 0, 1.45, .45],
  [3.5, 1.35, 1.25, -1.7, 0, 1.5, .3], [3.85, .35, 1.5, -3.3, 0, 1.3, -.8], [4.9, .35, 1.5, -3.4, 0, 1.35, -1.4],
  [5.3, 1.35, 1.5, -2.6, 0, 1.35, -1.6], [6.6, 1.25, 1.5, -2.5, -0.1, 1.35, -1.4], [6.9, 1.05, 1.42, -2.25, 0, 1.35, -1.2],
  [7.25, 1.15, 1.4, -2.35, 0.1, 1.25, -1.2], [8.2, 1.7, 1.2, -2.75, 0.35, .85, -1.25], [9.6, 1.9, 1.05, -3.05, 0.45, .45, -1.45],
  [10.0, 1.35, .4, -3.0, .45, .12, -2.2], [11.3, 1.25, .36, -2.9, .45, .12, -2.2], [11.8, 0.7, 1.5, -2.2, 0.1, 1.3, .6],
  [12.4, 0.7, 1.5, -2.2, 0.1, 1.3, .6], [13.2, 1.8, 1.45, -3.3, 0.2, .9, -1.3], [BLADE.duration, 2.0, 1.5, -3.5, 0.2, 1.0, -1.2]
];

export function playBladeDeath(T, blade, o) {
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const stage = new T.Group(); stage.name = "The old blade";
  stage.position.set(blade.stand.x, o.floor, blade.stand.z); stage.rotation.y = Math.PI / 2;
  o.scene.add(stage); stage.updateMatrixWorld(true);
  const materials = [], geometries = [];
  const own = m => { materials.push(m); return m; }, geo = g => { geometries.push(g); return g; };

  // ---- the sword: borrowed from the rack for the scene, put back in cleanup ----
  const sword = blade.sword, home = sword.parent, restPos = sword.position.clone(), restRot = sword.quaternion.clone();
  stage.attach(sword);
  const restLocal = {p: sword.position.clone(), q: sword.quaternion.clone()};
  const restDir = V(1, 0, 0).applyQuaternion(restLocal.q), restEdge = V(0, 1, 0).applyQuaternion(restLocal.q);
  const steel = blade.steel, steelEmissive = steel.emissive.clone();
  const glow = new T.PointLight(0xff3a2a, 0, 2.4); stage.add(glow);
  const smear = new T.Mesh(geo(new T.PlaneGeometry(.34, .014)), own(new T.MeshLambertMaterial({color: 0x6e0710, emissive: 0x1a0204, side: T.DoubleSide})));
  smear.position.set(.36, .006, 0); smear.visible = false; sword.add(smear);
  const smear2 = smear.clone(); smear2.position.y = .002; smear2.position.z = .0001; smear2.scale.set(.6, 1.4, 1); sword.add(smear2);
  const basis = new T.Matrix4(), xAxis = V(0, 0, 0), yAxis = V(0, 0, 0), zAxis = V(0, 0, 0);
  function orient(dir, edge, out) {
    xAxis.copy(dir).normalize(); zAxis.crossVectors(xAxis, edge).normalize(); yAxis.crossVectors(zAxis, xAxis);
    return out.setFromRotationMatrix(basis.makeBasis(xAxis, yAxis, zAxis));
  }
  const swingPose = (u, pos, quat) => {
    const a = SWING.from + (SWING.to - SWING.from) * u, d = V(Math.cos(a), 0, Math.sin(a));
    pos.fromArray(SWING.hilt);
    const way = Math.sign(SWING.to - SWING.from), edge = V(-Math.sin(a) * way, 0, Math.cos(a) * way);
    orient(d, edge, quat);
    return [pos.x, pos.y, pos.z, d.x, d.y, d.z, edge.x, edge.y, edge.z];
  };
  const restKey = [restLocal.p.x, restLocal.p.y, restLocal.p.z, restDir.x, restDir.y, restDir.z, restEdge.x, restEdge.y, restEdge.z];
  const scratch = V(0, 0, 0), scratchQ = new T.Quaternion();
  const fill = keys => keys.map(([t, ...k]) => [t, ...(k[0] === null ? restKey : k[0] === "swing" ? swingPose(t <= SWING.start ? 0 : 1, scratch, scratchQ) : k)]);
  const fly = fill(flyKeys), back = fill(homeKeys);
  const swordDir = V(0, 0, 0), swordEdge = V(0, 0, 0);
  function poseSword(t) {
    let k;
    if (t < BLADE.rise[0]) {
      const shiver = ease(t, BLADE.hum, BLADE.hum + .4);
      sword.position.copy(restLocal.p); sword.position.y += .006 * shiver * Math.sin(t * 47) + .02 * ease(t, 1.9, 2.3);
      sword.quaternion.copy(restLocal.q);
      sword.rotateX(.05 * shiver * Math.sin(t * 31));
      return;
    }
    if (t >= BLADE.swing[0] && t <= BLADE.swing[1]) { swingPose((t - SWING.start) / SWING.length, sword.position, sword.quaternion); return; }
    k = sample(t < SWING.start ? fly : back, t);
    sword.position.set(k[0], k[1] + (t > 3.4 && t < 6.6 ? .025 * Math.sin(t * 3.3) : 0), k[2]);
    swordDir.set(k[3], k[4], k[5]); swordEdge.set(k[6], k[7], k[8]);
    orient(swordDir, swordEdge, sword.quaternion);
  }

  // ---- Hanako: a whole body until the cut, then a headless body and a head-only actor ----
  const body = o.makeActor(false), head = o.makeActor(true), soul = o.makeActor("ghost");
  stage.add(body, head, soul);
  body.rotation.order = "YXZ";
  const bones = body.userData.bones, mesh = body.userData.mesh, whole = mesh.geometry;
  o.bind(body); o.bind(head); head.updateMatrixWorld(true);
  head.matrixAutoUpdate = false; head.visible = false;
  const headLocal = head.userData.bones.head.matrixWorld.clone().premultiply(head.matrixWorld.clone().invert()).invert();
  const headAt = new T.Matrix4(), headStart = new T.Matrix4(), spin = new T.Quaternion(), headPos = V(0, 0, 0), headQ = new T.Quaternion(), headS = V(1, 1, 1);
  const stageInverse = stage.matrixWorld.clone().invert();
  let caps = null, cut = false;
  function setCut(on, gore) {
    if (on === cut && (!on || caps?.gore === gore)) return;
    if (caps) { for (const c of [caps.body, caps.head]) { c.removeFromParent(); c.traverse(m => m.geometry?.dispose()); } caps = null; }
    cut = on;
    mesh.geometry = on ? o.headless : whole;
    head.visible = on;
    if (on) {
      caps = {gore, body: o.cap("body", !gore), head: o.cap("head", !gore)};
      body.userData.sockets.neck.add(caps.body); head.userData.sockets.head.add(caps.head);
    }
  }

  const parentRotation = new T.Quaternion(), desired = new T.Quaternion(), bendAxis = V(0, 0, 0), dir = V(0, 0, 0);
  const shoulder = V(0, 0, 0), wrist = V(0, 0, 0), elbow = V(0, 0, 0);
  function aimBone(b, child, from, to, mix) {
    b.parent.getWorldQuaternion(parentRotation).invert();
    dir.copy(to).sub(from).normalize().applyQuaternion(parentRotation);
    desired.setFromUnitVectors(child.position.clone().normalize(), dir);
    b.quaternion.slerp(desired, mix); b.updateMatrixWorld(true);
  }
  function reachArm(side, palm, weight) {
    if (weight <= 0) return;
    const upper = bones["upperarm_" + side], lower = bones["forearm_" + side], hand = bones["hand_" + side];
    upper.getWorldPosition(shoulder); wrist.copy(palm);
    const a = lower.position.length(), c = hand.position.length();
    const length = Math.min(a + c - .001, Math.max(.06, shoulder.distanceTo(wrist)));
    const axis = wrist.clone().sub(shoulder).normalize(), along = (a * a + length * length - c * c) / (2 * length);
    const sign = side === "L" ? 1 : -1;
    body.getWorldQuaternion(bodyTurn);
    bendAxis.set(sign * .6, -1, 0).applyQuaternion(bodyTurn);
    bendAxis.addScaledVector(axis, -bendAxis.dot(axis)).normalize();
    elbow.copy(shoulder).addScaledVector(axis, along).addScaledVector(bendAxis, Math.sqrt(Math.max(0, a * a - along * along)));
    wrist.copy(shoulder).addScaledVector(axis, length);
    aimBone(upper, lower, shoulder, elbow, weight); aimBone(lower, hand, elbow, wrist, weight);
    hand.rotation.z += sign * .5 * weight;
    if (bones["fingers_" + side]) bones["fingers_" + side].rotation.z = -sign * .25;
  }
  const kneeRotated = V(0, 0, 0), neckPoint = V(0, 0, 0), neckUp = V(0, 0, 0);
  function posePerson(t) {
    o.bind(body);
    const [x, y, z, yaw, lean] = sample(rootKeys, t);
    body.rotation.set(lean, yaw, 0);
    kneeRotated.fromArray(knee).applyEuler(body.rotation);
    body.position.set(x, y, z).sub(kneeRotated);
    const b = bones;
    // Her flight: two hard strides away from the rack, arms pumping.
    const run = ease(t, 4.05, 4.25) * (1 - ease(t, 4.95, 5.15)), stride = Math.sin((t - 4.1) * 11.5);
    const [tl, sl, tr, sr, fl, fr] = sample(legKeys.hold, t);
    b.thigh_L.rotation.x = tl - .7 * run * stride; b.shin_L.rotation.x = sl + 1.1 * run * Math.max(0, stride);
    b.thigh_R.rotation.x = tr + .7 * run * stride; b.shin_R.rotation.x = sr + 1.1 * run * Math.max(0, -stride);
    b.foot_L.rotation.x = fl; b.foot_R.rotation.x = fr;
    body.position.y += .03 * run * Math.abs(Math.cos((t - 4.1) * 11.5));
    // Backing away: her knees shake.
    const shake = ease(t, 5.2, 5.5) * (1 - ease(t, 7.0, 7.3));
    b.shin_L.rotation.x += .06 * shake * Math.max(0, Math.sin(t * 29)); b.shin_R.rotation.x += .06 * shake * Math.max(0, Math.sin(t * 31 + 1));
    const limp = ease(t, cutAt + .15, 8.4), fold = ease(t, BLADE.buckle[0], BLADE.fall[1]);
    b.chest.rotation.set(.12 * ease(t, 0, 1.4) * (1 - ease(t, 2.2, 2.6)) - .12 * shake + .2 * run + .25 * fold, .05 * shake * Math.sin(t * 13), 0);
    b.head.rotation.fromArray(sample(headKeys, t));
    b.head.rotation.y += .22 * ease(t, 5.4, 5.7) * (1 - ease(t, 6.3, 6.6)) * Math.sin(t * 14);   // "no, no"
    b.upperarm_L.rotation.set(0, .65 * run * stride, -1.3 + .25 * limp);
    b.upperarm_R.rotation.set(0, .65 * run * stride, 1.3 - .25 * limp);
    b.forearm_L.rotation.y = .4 + .9 * run; b.forearm_R.rotation.y = -.4 - .9 * run;
    if (fold > 0) { b.upperarm_L.rotation.y -= .5 * fold; b.upperarm_R.rotation.y += .5 * fold; }
    body.userData.face(t < 2.25 ? 0 : t < 3.6 ? "dread" : "panic");
    body.updateMatrixWorld(true);
    const reach = ease(t, 2.45, 2.85) * (1 - run) * (1 - ease(t, cutAt + .2, 8.3));
    for (const side of ["L", "R"]) {
      const [px, py, pz] = sample(palmKeys[side], t), tremble = .012 * shake * Math.sin(t * 37 + (side === "L" ? 0 : 2));
      reachArm(side, body.localToWorld(V(px + tremble, py + tremble, pz)), reach);
    }
    body.updateMatrixWorld(true);
    body.userData.sockets.neck.getWorldPosition(neckPoint);
    neckUp.set(0, 1, 0).transformDirection(bones.neck.matrixWorld);
  }
  // Where the head bone was at the instant of the cut, in stage space; the flight is laid over that.
  function captureCut() {
    posePerson(cutAt);
    headStart.copy(stageInverse).multiply(bones.head.matrixWorld);
  }
  const heading = V(0, 0, 0), sideways = V(1, 0, 0), upright = V(0, 1, 0), wobbleQ = new T.Quaternion(), bodyTurn = new T.Quaternion();
  function poseHead(t) {
    const [dx, dy, dz, turn, wobble] = sample(headFlight, t);
    headStart.decompose(headPos, headQ, headS);
    const start = headPos.y;
    heading.set(-.88, 0, -.47).normalize();                             // roll axis for a head rolling forward (-z) and toward +x
    spin.setFromAxisAngle(heading, turn);
    headQ.premultiply(spin).premultiply(wobbleQ.setFromAxisAngle(sideways, wobble));
    headQ.premultiply(wobbleQ.setFromAxisAngle(upright, -1.3 * ease(t, 7.9, 8.9)));   // settles three-quarters toward the camera
    headPos.set(headPos.x + dx, Math.max(.07, start + dy), headPos.z + dz);   // the floor keys sit below .07 on purpose
    headAt.compose(headPos, headQ, headS).multiply(headLocal);
    head.matrix.copy(headAt); head.updateMatrixWorld(true);
    head.userData.face(t < 7.75 ? "panic" : "vacant");
  }

  // ---- blood (Blood on only): pools under the neck and the head, a smear on the blade ----
  const poolMat = own(new T.MeshLambertMaterial({color: 0x5e0911, emissive: 0x140103, transparent: true, opacity: .92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2}));
  const disc = geo(new T.CircleGeometry(1, 20));
  const pool = (x, z) => { const m = new T.Mesh(disc, poolMat); m.rotation.x = -Math.PI / 2; m.position.set(x, .006, z); m.renderOrder = 1; stage.add(m); return m; };
  const neckPool = pool(0, -2.14), headPool = pool(.6, -2.3), dashes = [pool(.25, -1.6), pool(.42, -1.95), pool(-.1, -1.3)];
  let goreShown = null, clock = 0;
  function showGore(on) {
    goreShown = on;
    const t = clock;
    if (cut) setCut(true, on);
    smear.visible = smear2.visible = on && t > cutAt;
    neckPool.visible = on && t > BLADE.fall[1] - .1; neckPool.scale.setScalar(.05 + .3 * ease(t, BLADE.fall[1] - .1, 13.5));
    neckPool.scale.x *= 1.3;
    headPool.visible = on && t > 8.3; headPool.scale.setScalar(.03 + .13 * ease(t, 8.3, 12));
    dashes.forEach((d, i) => { d.visible = on && t > 7.3 + i * .15; d.scale.set(.05 + .02 * i, .025, 1); });
  }

  let cueIndex = 0, ended = false;
  const cameraEye = V(0, 0, 0), look = V(0, 0, 0), handoff = o.handoff.clone(), target = V(0, 0, 0);
  captureCut();
  return {
    frame(t) {
      clock = t;
      const gore = o.gore();
      if (t < cutAt) { setCut(false, gore); }
      posePerson(t);
      if (t >= cutAt) { setCut(true, gore); poseHead(t); }
      poseSword(t);
      showGore(gore);
      // The blade wakes: a red sheen along the steel and a light that follows it, gone once it is back on the rack.
      const wake = ease(t, BLADE.hum, BLADE.rise[0]) * (1 - ease(t, BLADE.home[0] + 1, BLADE.home[1] + .3));
      const flick = .75 + .25 * Math.sin(t * 23) * Math.sin(t * 7);
      steel.emissive.copy(steelEmissive).lerp(new T.Color(0x6a0c08), wake * flick);
      glow.intensity = 3.2 * wake * flick; sword.localToWorld(glow.position.set(.35, 0, .06)); stage.worldToLocal(glow.position);
      // Her soul climbs out of the body and stands, looking back at her head.
      const rise = ease(t, BLADE.soul, BLADE.soul + 2.4);
      soul.visible = t > BLADE.soul && t < BLADE.duration;
      o.bind(soul);
      const s = soul.userData.bones;
      s.upperarm_L.rotation.z = -1.25; s.upperarm_R.rotation.z = 1.25;
      s.head.rotation.set(.35 * rise, .5 * rise, 0);
      s.thigh_L.rotation.x = -.5 * (1 - rise); s.shin_L.rotation.x = .9 * (1 - rise);
      soul.userData.face(7);
      soul.scale.setScalar(.7 + .25 * rise);
      soul.rotation.set(1.3 * (1 - rise), Math.PI + .9 * rise, 0);
      soul.position.set(.25 * rise, .12 + .05 * Math.sin(t * 1.6) * rise, -1.6 + .35 * rise);
      while (cueIndex < cues.length && t >= cues[cueIndex][0]) {
        const cue = cues[cueIndex++][1];
        if (cue === "die") o.die();
        else if (cue === "cut") o.cue(cue, {at: neckPoint.clone(), dir: V(1, .25, 0).transformDirection(stage.matrixWorld), neck: () => neckPoint, up: () => neckUp});
        else o.cue(cue);
      }
      o.target.copy(t < cutAt ? neckPoint : stage.localToWorld(V(.3, .4, -2.0)));
      if (t >= BLADE.duration && !ended) { ended = true; o.end(); }
    },
    camera(t) {
      const k = sample(cameraKeys, t), out = ease(t, BLADE.duration - .7, BLADE.duration);
      stage.localToWorld(cameraEye.set(k[0], k[1], k[2]));
      stage.localToWorld(look.set(k[3], k[4], k[5]));
      if (t > SWING.start - .05 && t < cutAt + .25) { const jolt = .012 * Math.sin(t * 90) * ease(t, cutAt, cutAt + .02); cameraEye.y += jolt; }
      o.camera.position.copy(cameraEye).lerp(handoff, out);
      look.lerp(target.copy(o.target), out);
      o.camera.lookAt(look);
    },
    showGore(on) { if (on !== goreShown) showGore(on); },
    cleanup() {
      setCut(false, false);
      home.add(sword); sword.position.copy(restPos); sword.quaternion.copy(restRot);
      smear.removeFromParent(); smear2.removeFromParent();
      steel.emissive.copy(steelEmissive);
      stage.removeFromParent();
      materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose());
      o.disposeActors();
    }
  };
}
