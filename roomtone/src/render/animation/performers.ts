import * as THREE from 'three';
import type { Track } from '../../state/types';
import type { NoteEvent } from '../../audio/graph';
import { buildCharacter, type CharacterRig, type BoneName } from '../character/character';
import { buildDrumKit, buildKeyboard, buildMic, buildPads, buildStringed, fingering, fretX, type DrumKitProp, type KeyboardProp, type PadsProp, type StringedProp, M, mesh } from '../props';
import { aimBone, damp, orientWorld, smoothstep, solveTwoBone } from './ik';

// Musicians perform the notes the audio engine schedules. Each NoteEvent carries the AudioContext time of
// its onset ~200 ms before it sounds, so limbs can wind up and land exactly on the audible hit.

export interface FrameCtx {
  now: number; // audible AudioContext time
  dt: number;
  elapsed: number;
  beat: number; // transport position in beats
  playing: boolean;
  level: number; // this track's meter level
  camera: THREE.Vector3;
  cameraNear: boolean; // first-person player is close and facing this musician
  focus: THREE.Vector3 | null; // something everyone glances at (e.g. the soloist)
  loopPulse: number; // >0 shortly after a loop wrap / section start
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);
const tmp = V();
const tmp2 = V();

type Mood = 'rest' | 'happy' | 'joy' | 'focus' | 'sing';

export abstract class Musician {
  readonly group = new THREE.Group(); // at the station
  rig!: CharacterRig;
  protected rest = new Map<THREE.Object3D, THREE.Quaternion>();
  protected restPos = new Map<THREE.Object3D, THREE.Vector3>();
  protected events: NoteEvent[] = [];
  protected lookYaw = 0;
  protected lookPitch = 0;
  protected lookTarget = V();
  protected lookTimer = 0;
  protected blinkTimer = 1 + Math.random() * 3;
  protected blinkPhase = -1;
  protected lastNoteTime = -10;
  protected mood: Mood = 'rest';
  protected energy = 0;
  protected idleGesture: { kind: string; t: number; dur: number } | null = null;
  protected idleTimer = 3 + Math.random() * 6;
  protected feet: Record<'L' | 'R', THREE.Vector3> = { L: V(), R: V() };
  protected spawn = 0; // 0..1 pop-in
  removing = false;
  removed = false;
  readonly pickables: THREE.Object3D[] = [];

  constructor(public track: Track) {
    this.group.userData.trackId = track.id;
  }

  protected init() {
    this.rig = buildCharacter(this.track.musician);
    this.group.add(this.rig.root);
    this.rig.root.traverse((o) => {
      o.userData.trackId = this.track.id;
      this.rest.set(o, o.quaternion.clone());
      this.restPos.set(o, o.position.clone());
    });
    this.pickables.push(this.rig.root);
    this.group.scale.setScalar(0.001);
  }

  get b() {
    return this.rig.bones;
  }

  setLook(track: Track) {
    // Rebuild the character mesh in place; keeps queued notes and props.
    const old = this.rig;
    this.group.remove(old.root);
    old.dispose();
    this.track = track;
    this.rest.clear();
    this.restPos.clear();
    this.pickables.length = 0;
    this.rig = buildCharacter(track.musician);
    this.group.add(this.rig.root);
    this.rig.root.traverse((o) => {
      o.userData.trackId = track.id;
      this.rest.set(o, o.quaternion.clone());
      this.restPos.set(o, o.position.clone());
    });
    this.pickables.push(this.rig.root);
    this.attachProps();
  }

  protected attachProps() {}

  push(e: NoteEvent) {
    this.events.push(e);
    this.onNote(e);
  }
  protected onNote(_e: NoteEvent) {}

  clearFuture(now: number) {
    this.events = this.events.filter((e) => e.time <= now);
  }

  protected active(now: number) {
    return this.events.filter((e) => e.time <= now && e.end > now);
  }
  protected upcoming(now: number, within: number) {
    return this.events.filter((e) => e.time > now && e.time < now + within);
  }

  update(f: FrameCtx) {
    // Pop-in / pop-out
    this.spawn = damp(this.spawn, this.removing ? 0 : 1, this.removing ? 10 : 6, f.dt);
    const s = this.removing ? this.spawn : 1 + Math.sin(Math.min(1, this.spawn) * Math.PI) * 0.15 * (1 - this.spawn);
    this.group.scale.setScalar(Math.max(0.001, this.spawn * s));
    if (this.removing && this.spawn < 0.01) this.removed = true;

    this.events = this.events.filter((e) => e.end > f.now - 1.5);
    for (const [o, q] of this.rest) o.quaternion.copy(q);
    for (const [o, p] of this.restPos) o.position.copy(p);

    const sounding = this.active(f.now);
    if (sounding.length) this.lastNoteTime = f.now;
    const busy = f.now - this.lastNoteTime < 1.2;
    const recent = this.events.filter((e) => e.time > f.now - 2 && e.time <= f.now);
    const density = recent.length / 2;
    const loud = recent.reduce((m, e) => Math.max(m, e.vel), 0);
    this.energy = damp(this.energy, busy ? Math.min(1, 0.35 + density * 0.06 + loud * 0.4) : 0, 3, f.dt);
    this.mood = !busy ? 'rest' : density > 7 ? 'focus' : loud > 0.85 || f.loopPulse > 0 ? 'joy' : 'happy';

    this.body(f, busy);
    this.perform(f);
    this.head(f, busy);
    this.faceUpdate(f);
  }

  // Breathing, groove bounce and planted feet.
  protected body(f: FrameCtx, busy: boolean) {
    const b = this.b;
    const pers = this.track.musician.personality;
    const amt = (pers === 'energetic' ? 1.4 : pers === 'showoff' ? 1.2 : pers === 'shy' ? 0.6 : 0.9) * this.energy;
    const phase = f.beat % 1;
    const groove = f.playing && busy ? Math.pow(Math.cos(phase * Math.PI), 2) : 0;
    const breath = Math.sin(f.elapsed * 1.6 + this.track.id.length) * 0.5 + 0.5;
    b.Spine.rotation.x += breath * 0.015 + groove * amt * 0.05;
    b.Spine1.rotation.x += groove * amt * 0.03;
    if (!this.seated()) {
      b.Hips.position.y -= groove * amt * 0.025 + breath * 0.003;
      b.Hips.rotation.z = Math.sin(f.beat * Math.PI) * 0.03 * amt;
      b.Spine.rotation.z = -Math.sin(f.beat * Math.PI) * 0.03 * amt;
      this.legsPlanted();
    }
  }

  protected seated() {
    return false;
  }

  protected legsPlanted() {
    const b = this.b;
    const fwd = tmp2.set(0, 0.3, 1).applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()));
    if (this.feet.L.lengthSq() === 0) {
      this.rig.root.updateMatrixWorld(true);
      b.LeftFoot.getWorldPosition(this.feet.L);
      b.RightFoot.getWorldPosition(this.feet.R);
      this.feet.L.y -= 0.004;
      this.feet.R.y -= 0.004;
    }
    solveTwoBone(b.LeftUpLeg, b.LeftLeg, b.LeftFoot, this.feet.L, fwd);
    solveTwoBone(b.RightUpLeg, b.RightLeg, b.RightFoot, this.feet.R, fwd);
    this.flatFoot(b.LeftFoot);
    this.flatFoot(b.RightFoot);
  }

  protected flatFoot(foot: THREE.Object3D) {
    const fwd = V().set(0, 0, 1).applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()));
    orientWorld(foot, fwd, UP);
  }

  protected abstract perform(f: FrameCtx): void;
  protected abstract instrumentFocus(): THREE.Vector3; // where the musician looks while playing

  protected head(f: FrameCtx, busy: boolean) {
    this.lookTimer -= f.dt;
    if (this.lookTimer <= 0) {
      this.lookTimer = 1.5 + Math.random() * 3;
      const r = Math.random();
      if (f.cameraNear) this.lookTarget.copy(f.camera);
      else if (busy && r < 0.6) this.lookTarget.copy(this.instrumentFocus());
      else if (f.focus && r < 0.8) this.lookTarget.copy(f.focus);
      else this.lookTarget.copy(this.group.position).add(tmp.set((Math.random() - 0.5) * 4, 1 + Math.random() * 0.6, 2 + Math.random() * 2));
    }
    if (f.cameraNear) this.lookTarget.lerp(f.camera, 0.2);
    if (f.loopPulse > 0.8) this.lookTarget.copy(f.focus ?? f.camera);
    const local = this.rig.root.worldToLocal(tmp.copy(this.lookTarget));
    local.y -= 0.9;
    const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.1, 1.1);
    const pitch = THREE.MathUtils.clamp(Math.atan2(-local.y, Math.hypot(local.x, local.z)), -0.4, 0.55);
    this.lookYaw = damp(this.lookYaw, yaw, 4, f.dt);
    this.lookPitch = damp(this.lookPitch, pitch, 4, f.dt);
    const b = this.b;
    b.Neck.rotation.y += this.lookYaw * 0.4;
    b.Head.rotation.y += this.lookYaw * 0.6;
    b.Head.rotation.x += this.lookPitch * 0.7;
    // Nod on the beat while playing.
    if (f.playing && busy) {
      const pers = this.track.musician.personality;
      const amt = pers === 'energetic' ? 0.16 : pers === 'shy' ? 0.05 : 0.1;
      b.Head.rotation.x += Math.pow(Math.cos((f.beat % 1) * Math.PI), 4) * amt * this.energy;
    } else {
      b.Head.rotation.z += Math.sin(f.elapsed * 0.7 + this.track.id.length) * 0.05;
    }
  }

  protected faceUpdate(f: FrameCtx) {
    const face = this.rig.face;
    // Blink
    this.blinkTimer -= f.dt;
    if (this.blinkTimer <= 0 && this.blinkPhase < 0) {
      this.blinkPhase = 0;
      this.blinkTimer = 2 + Math.random() * 4;
    }
    let lid = this.mood === 'focus' ? 0.35 : 0;
    if (this.blinkPhase >= 0) {
      this.blinkPhase += f.dt / 0.14;
      lid = Math.max(lid, Math.sin(Math.min(1, this.blinkPhase) * Math.PI));
      if (this.blinkPhase >= 1) this.blinkPhase = -1;
    }
    for (const l of face.lids) l.scale.y = Math.max(0.001, lid * l.scale.x * 1.3);
    // Brows: raise with joy, knit with focus.
    for (const b of face.brows) {
      const side = b.userData.side as number;
      const base = b.userData.base as number;
      const target = this.mood === 'focus' ? base - side * 0.25 : this.mood === 'joy' ? base + side * 0.15 : base;
      b.rotation.z = damp(b.rotation.z, target, 8, f.dt);
    }
    const rest = (['smile', 'grin', 'flat'] as const)[this.track.musician.mouth % 3];
    const want = this.mood === 'sing' ? 'o' : this.mood === 'focus' ? 'flat' : this.mood === 'joy' ? 'grin' : this.mood === 'happy' ? (rest === 'flat' ? 'smile' : rest) : rest;
    for (const [k, m] of Object.entries(face.mouths)) m.visible = k === want;
    const blushOp = 0.25 + this.energy * 0.35;
    for (const b of face.blush) (b.material as THREE.MeshStandardMaterial).opacity = blushOp;
  }

  // Idle gestures: wave at the player, stretch, instrument-specific fidgets.
  protected idle(f: FrameCtx, busy: boolean): string | null {
    if (busy && f.playing) {
      this.idleGesture = null;
      return null;
    }
    this.idleTimer -= f.dt;
    if (!this.idleGesture && f.cameraNear && Math.random() < f.dt * 0.6) this.idleGesture = { kind: 'wave', t: 0, dur: 2.2 };
    if (!this.idleGesture && this.idleTimer <= 0) {
      this.idleTimer = 5 + Math.random() * 8;
      const options = this.idleOptions();
      this.idleGesture = { kind: options[Math.floor(Math.random() * options.length)], t: 0, dur: 2.5 };
    }
    if (this.idleGesture) {
      this.idleGesture.t += f.dt;
      if (this.idleGesture.t > this.idleGesture.dur) this.idleGesture = null;
    }
    return this.idleGesture?.kind ?? null;
  }
  protected idleOptions() {
    return ['look'];
  }

  protected gestureEnvelope() {
    const g = this.idleGesture;
    if (!g) return 0;
    return smoothstep(g.t / 0.4) * smoothstep((g.dur - g.t) / 0.4);
  }

  // Raise the right arm and wave.
  protected wave(f: FrameCtx, side: 'Left' | 'Right' = 'Right') {
    const k = this.gestureEnvelope();
    if (k <= 0) return;
    const b = this.b;
    const s = side === 'Left' ? 1 : -1;
    const sh = b[`${side}Arm` as BoneName].getWorldPosition(V());
    const target = this.rig.root.localToWorld(V().set(s * 0.3, 1.05, 0.12));
    target.lerp(sh.clone().add(V(0, -0.3, 0)), 1 - k);
    target.add(V().set(Math.sin(f.elapsed * 12) * 0.06 * k, 0, 0).applyQuaternion(this.group.quaternion));
    solveTwoBone(b[`${side}Arm` as BoneName], b[`${side}ForeArm` as BoneName], b[`${side}Hand` as BoneName], target, V().set(s, -0.5, -0.3).applyQuaternion(this.group.quaternion));
  }

  dispose() {
    this.rig.dispose();
  }

  // World-space helpers
  protected world(obj: THREE.Object3D, x: number, y: number, z: number) {
    return obj.localToWorld(V().set(x, y, z));
  }
  protected armIK(side: 'Left' | 'Right', target: THREE.Vector3, pole: THREE.Vector3) {
    const b = this.b;
    solveTwoBone(b[`${side}Arm` as BoneName], b[`${side}ForeArm` as BoneName], b[`${side}Hand` as BoneName], target, pole);
  }
  protected outward(side: 'Left' | 'Right', down = -0.6, back = -0.4) {
    return V().set(side === 'Left' ? 1 : -1, down, back).applyQuaternion(this.group.quaternion).normalize();
  }
}

// ---------------------------------------------------------------- Drummer

interface Hit {
  time: number;
  piece: string;
  vel: number;
  hand: 'L' | 'R' | 'F' | 'P';
  fired?: boolean;
}

export class Drummer extends Musician {
  kit: DrumKitProp;
  private hits: Hit[] = [];
  private sticks: THREE.Mesh[] = [];
  private twirl = 0;
  constructor(track: Track) {
    super(track);
    this.kit = buildDrumKit(track.color);
    this.group.add(this.kit.group);
    this.init();
    this.attachProps();
  }
  protected seated() {
    return true;
  }
  protected attachProps() {
    this.sticks = [];
    for (const side of ['Left', 'Right'] as const) {
      const stick = mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.3, 8), M('#e8c07d', 0.5), this.b[`${side}Hand`], 0, -0.04, 0.11);
      stick.rotation.x = Math.PI / 2;
      this.sticks.push(stick);
    }
    this.b.Hips.position.y = (this.kit.seatY + 0.035) / this.track.musician.height;
    this.restPos.set(this.b.Hips, this.b.Hips.position.clone());
  }
  protected onNote(e: NoteEvent) {
    const piece = this.kit.pitchToPiece(e.pitch);
    const p = this.kit.pieces[piece];
    let hand: Hit['hand'] = e.pitch === 44 ? 'P' : p.hand;
    if (hand === 'L' || hand === 'R') {
      // If this hand is already striking at (nearly) the same time, use the other hand.
      const clash = this.hits.find((h) => h.hand === hand && Math.abs(h.time - e.time) < 0.07);
      if (clash) hand = hand === 'L' ? 'R' : 'L';
    }
    this.hits.push({ time: e.time, piece, vel: e.vel, hand });
    this.hits.sort((a, b) => a.time - b.time);
  }
  clearFuture(now: number) {
    super.clearFuture(now);
    this.hits = this.hits.filter((h) => h.time <= now);
  }
  protected idleOptions() {
    return ['twirl', 'look', 'tap'];
  }
  protected instrumentFocus() {
    return this.world(this.kit.group, 0.1, 0.45, 0.3);
  }
  protected perform(f: FrameCtx) {
    const b = this.b;
    this.hits = this.hits.filter((h) => h.time > f.now - 2);
    // Fire piece reactions as hits become audible.
    for (const h of this.hits) {
      if (!h.fired && h.time <= f.now) {
        h.fired = true;
        const p = this.kit.pieces[h.piece];
        if (p) p.wobble = Math.max(p.wobble, h.vel);
      }
    }
    for (const p of Object.values(this.kit.pieces)) {
      p.wobble = damp(p.wobble, 0, p.kind === 'cymbal' ? 3 : 14, f.dt);
      const w = p.wobble;
      if (p.kind === 'cymbal') {
        p.obj.rotation.z = Math.sin(f.elapsed * 22) * w * 0.12;
        p.obj.rotation.x = (p.obj.userData.baseX as number) + Math.cos(f.elapsed * 17) * w * 0.06;
      } else if (p.kind === 'drum') p.obj.scale.set(1 + w * 0.03, 1 - w * 0.05, 1 + w * 0.03);
      else if (p.kind === 'kick') p.obj.scale.set(1 + w * 0.025, 1, 1 + w * 0.025);
      else if (p.kind === 'hat') p.obj.rotation.z = Math.sin(f.elapsed * 25) * w * 0.05;
    }
    // Feet: kick pedal (right), hat pedal (left).
    const kickCurve = this.strikeCurve('F', f.now);
    this.kit.beater.rotation.x = -0.55 + (1 - kickCurve.lift) * 0.75;
    const hatCurve = this.strikeCurve('P', f.now);
    this.kit.hatTop.position.y = 0.006 + hatCurve.lift * 0.03 + (f.playing ? 0 : 0.012);
    const rf = this.world(this.kit.group, -0.03, 0.05 + kickCurve.lift * 0.05, 0.19);
    const lf = this.world(this.kit.group, 0.33, 0.045 + hatCurve.lift * 0.03, 0.1);
    const knee = V().set(0, 0.6, 1).applyQuaternion(this.group.quaternion);
    solveTwoBone(b.RightUpLeg, b.RightLeg, b.RightFoot, rf, knee);
    solveTwoBone(b.LeftUpLeg, b.LeftLeg, b.LeftFoot, lf, knee);
    this.flatFoot(b.RightFoot);
    this.flatFoot(b.LeftFoot);
    b.RightFoot.rotateX(-kickCurve.lift * 0.4);

    // Hands with sticks.
    const gesture = this.idle(f, f.now - this.lastNoteTime < 1.2);
    for (const side of ['Left', 'Right'] as const) {
      const hand = side === 'Left' ? 'L' : 'R';
      const c = this.strikeCurve(hand, f.now);
      const fromP = this.kit.pieces[c.from ?? (hand === 'L' ? 'snare' : 'hat')].hit;
      const toP = this.kit.pieces[c.to ?? (hand === 'L' ? 'snare' : 'hat')].hit;
      const tip = this.kit.group.localToWorld(V().lerpVectors(fromP, toP, c.travel));
      let lift = c.lift;
      if (gesture === 'tap') lift = 0.04 + Math.abs(Math.sin(f.elapsed * 6 + (hand === 'L' ? 0 : 1.5))) * 0.05;
      const shoulder = b[`${side}Arm`].getWorldPosition(V());
      const dir = tip.clone().sub(shoulder.clone().add(V(0, -0.12, 0))).normalize();
      const L = 0.21;
      const handPos = tip.clone().addScaledVector(dir, -L).add(V(0, lift * 0.6 + 0.01, 0));
      this.armIK(side, handPos, this.outward(side, -0.4, -0.6));
      // Stick points from the hand towards the strike point, cocked up by the lift.
      const aim = tip.clone().add(V(0, lift * 1.6, 0)).sub(handPos).normalize();
      orientWorld(b[`${side}Hand`], aim, UP);
      if (gesture === 'twirl' && side === 'Right') {
        this.twirl += f.dt * 14;
        b.RightHand.rotateZ(this.twirl);
      }
    }
  }
  // lift: 0 at the moment of a hit, rising between hits. travel: 0..1 from previous to next piece.
  private strikeCurve(hand: Hit['hand'], now: number) {
    let prev: Hit | undefined;
    let next: Hit | undefined;
    for (const h of this.hits) {
      if (h.hand !== hand) continue;
      if (h.time <= now) prev = h;
      else if (!next) next = h;
    }
    const restLift = 0.07;
    const pt = prev ? now - prev.time : 10;
    const nt = next ? next.time - now : 10;
    if (nt > 0.8 && pt > 0.4) return { lift: restLift, travel: 1, from: prev?.piece, to: prev?.piece };
    const amp = 0.05 + 0.13 * (next?.vel ?? 0.6);
    const up = Math.min(1, pt / 0.07); // rebound after a hit
    const down = Math.min(1, nt / 0.13); // wind-up before the next
    const lift = nt > 0.8 ? THREE.MathUtils.lerp(0, restLift, Math.min(1, pt / 0.3)) : amp * Math.pow(up, 0.7) * Math.pow(down, 0.8);
    const span = prev && next ? next.time - prev.time : 0.2;
    const travel = next ? smoothstep(1 - nt / Math.max(0.05, span)) : 1;
    return { lift, travel, from: prev?.piece ?? next?.piece, to: next?.piece ?? prev?.piece };
  }
}

// ---------------------------------------------------------------- Keyboardist

export class Keyboardist extends Musician {
  kb: KeyboardProp;
  private hand = new Map<NoteEvent, 'L' | 'R'>();
  private hx = { L: 0.12, R: -0.12 };
  constructor(track: Track, private variant: 'piano' | 'synth') {
    super(track);
    this.kb = buildKeyboard(variant, variant === 'piano' ? '#2b2523' : track.color);
    this.kb.group.position.set(0, 0, 0.3);
    this.group.add(this.kb.group);
    this.init();
  }
  private split() {
    return this.variant === 'piano' ? 60 : 64;
  }
  protected onNote(e: NoteEvent) {
    // Chords: lowest notes of a wide chord go left; everything else by split point.
    const simultaneous = this.events.filter((x) => Math.abs(x.time - e.time) < 0.03);
    const lows = simultaneous.map((x) => x.pitch).sort((a, b) => a - b);
    const wide = lows[lows.length - 1] - lows[0] > 12;
    this.hand.set(e, e.pitch < this.split() || (wide && e.pitch === lows[0]) ? 'L' : 'R');
  }
  protected idleOptions() {
    return ['noodle', 'look', 'wave'];
  }
  protected instrumentFocus() {
    return this.world(this.kb.group, 0, this.kb.keyTopY, 0.05);
  }
  protected perform(f: FrameCtx) {
    const kb = this.kb;
    for (const e of [...this.hand.keys()]) if (e.end < f.now - 1) this.hand.delete(e);
    // Keys go down while their notes sound.
    const down = new Set(this.active(f.now).map((e) => kb.fold(e.pitch)));
    for (const [p, k] of kb.keys) k.rotation.x = damp(k.rotation.x, down.has(p) ? -0.07 : 0, 40, f.dt);
    if (this.variant === 'synth') kb.knobs.forEach((k, i) => (k.rotation.y = Math.sin(f.elapsed * 0.3 + i) * 0.4 + this.energy * i * 0.1));

    const gesture = this.idle(f, f.now - this.lastNoteTime < 1.2);
    for (const side of ['L', 'R'] as const) {
      const mine = this.events.filter((e) => this.hand.get(e) === side);
      const act = mine.filter((e) => e.time <= f.now && e.end > f.now);
      const next = mine.find((e) => e.time > f.now && e.time < f.now + 0.35);
      const targetX = act.length ? act.reduce((s, e) => s + kb.keyX(kb.fold(e.pitch)), 0) / act.length : next ? kb.keyX(kb.fold(next.pitch)) : side === 'L' ? 0.12 : -0.12;
      this.hx[side] = damp(this.hx[side], targetX, act.length ? 30 : 9, f.dt);
      const lastStart = mine.filter((e) => e.time <= f.now).reduce((m, e) => Math.max(m, e.time), -10);
      const press = Math.max(0, 1 - (f.now - lastStart) / 0.12);
      const pre = next ? smoothstep(1 - (next.time - f.now) / 0.2) : 0;
      let y = kb.keyTopY + 0.035 + pre * 0.03 - press * 0.015 + (act.length ? 0 : 0.02);
      if (gesture === 'noodle') y += Math.abs(Math.sin(f.elapsed * 7 + (side === 'L' ? 0 : 2))) * 0.03;
      const target = this.world(kb.group, this.hx[side], y, -0.035);
      const s = side === 'L' ? 'Left' : 'Right';
      if (gesture === 'wave' && side === 'L') this.wave(f, 'Left');
      else this.armIK(s, target, this.outward(s, -0.5, -0.5));
      if (!(gesture === 'wave' && side === 'L')) {
        const fwd = V().set(0, -0.8, 0.6).applyQuaternion(this.group.quaternion);
        aimBone(this.b[`${s}Hand`], fwd, V().set(0, 0.6, 0.8).applyQuaternion(this.group.quaternion));
      }
    }
    // Lean into the keys a bit with energy.
    this.b.Spine.rotation.x += 0.08 + this.energy * 0.05;
  }
}

// ---------------------------------------------------------------- Guitarist / bassist

export class StringPlayer extends Musician {
  inst!: StringedProp;
  private fret = 5;
  private fretX = 0;
  private fing = new Map<NoteEvent, { string: number; fret: number }>();
  private strokes: { time: number; down: boolean; vel: number }[] = [];
  constructor(track: Track, private kind: 'guitar' | 'bass') {
    super(track);
    this.init();
    this.attachProps();
  }
  protected attachProps() {
    this.inst = buildStringed(this.kind, this.track.color);
    const g = this.inst.group;
    g.position.set(0.02, -0.1, 0.15);
    g.rotation.set(-0.12, 0.12, 0.42);
    this.b.Spine1.add(g);
    // Strap: from the tail pin, around the back, over the left shoulder, to the horn.
    g.updateMatrix();
    const tail = V(-0.17 * (this.kind === 'bass' ? 1.12 : 1), 0, -0.02).applyMatrix4(g.matrix);
    const horn = V(0.1, 0.09, -0.01).applyMatrix4(g.matrix);
    const strap = new THREE.CatmullRomCurve3([tail, V(-0.14, -0.06, -0.09), V(-0.03, 0.04, -0.12), V(0.09, 0.07, -0.05), V(0.1, 0.07, 0.06), horn]);
    mesh(new THREE.TubeGeometry(strap, 40, 0.011, 6), M('#3b2a20', 0.8), this.b.Spine1);
    g.traverse((o) => (o.userData.trackId = this.track.id));
    this.fretX = fretX(this.inst, this.fret);
  }
  protected onNote(e: NoteEvent) {
    const fg = fingering(this.inst, e.pitch, this.fret);
    this.fing.set(e, fg);
    // Group chord notes into a single stroke; alternate direction on off-beats.
    const last = this.strokes[this.strokes.length - 1];
    if (last && Math.abs(last.time - e.time) < 0.04) return;
    const off = Math.abs((e.beat * 2) % 1) > 0.25 && Math.abs((e.beat * 2) % 1) < 0.75;
    const sub = (e.beat * 2) % 2;
    this.strokes.push({ time: e.time, down: !(off || (sub >= 1 && this.kind === 'guitar' && e.dur < 0.3)), vel: e.vel });
  }
  clearFuture(now: number) {
    super.clearFuture(now);
    this.strokes = this.strokes.filter((s) => s.time <= now);
  }
  protected idleOptions() {
    return ['tune', 'look', 'wave', 'tune'];
  }
  protected instrumentFocus() {
    return this.inst.group.localToWorld(V().set(this.fretX, 0, 0));
  }
  protected perform(f: FrameCtx) {
    const inst = this.inst;
    this.strokes = this.strokes.filter((s) => s.time > f.now - 1);
    for (const e of [...this.fing.keys()]) if (e.end < f.now - 1) this.fing.delete(e);
    const act = this.active(f.now);
    const next = this.upcoming(f.now, 0.3)[0];
    const fretted = [...act, ...(next ? [next] : [])].map((e) => this.fing.get(e)).filter((x) => x && x.fret > 0) as { string: number; fret: number }[];
    let stringIdx = 2;
    if (fretted.length) {
      const target = fretted[fretted.length > 1 && next ? fretted.length - 1 : 0];
      this.fret = target.fret;
      stringIdx = target.string;
    }
    this.fretX = damp(this.fretX, fretX(inst, this.fret), act.length ? 25 : 12, f.dt);
    // String vibration while sounding.
    const ringing = new Set(act.map((e) => this.fing.get(e)?.string));
    inst.strings.forEach((s, i) => {
      const v = ringing.has(i) ? 1 : 0;
      s.scale.x = 1 + v * Math.sin(f.elapsed * 90 + i) * 1.6;
    });

    const gesture = this.idle(f, f.now - this.lastNoteTime < 1.2);
    // Fretting hand (left).
    let fretTarget = inst.group.localToWorld(V().set(this.fretX, inst.stringY(stringIdx) * 0.5, inst.topZ + 0.035));
    if (gesture === 'tune') {
      const k = this.gestureEnvelope();
      fretTarget = fretTarget.lerp(inst.group.localToWorld(V().set(inst.headX + 0.02, 0.04, 0.03)), k);
    }
    this.armIK('Left', fretTarget, this.outward('Left', -0.8, -0.2));
    const neckDir = inst.group.localToWorld(V().set(1, 0, 0)).sub(inst.group.localToWorld(V()));
    aimBone(this.b.LeftHand, V().set(0, 0, -1).applyQuaternion(inst.group.getWorldQuaternion(new THREE.Quaternion())).add(V(0, -0.3, 0)), neckDir);

    // Picking hand (right): strokes across the strings.
    let prev = undefined as (typeof this.strokes)[number] | undefined;
    let nxt = undefined as (typeof this.strokes)[number] | undefined;
    for (const s of this.strokes) {
      if (s.time <= f.now) prev = s;
      else if (!nxt) nxt = s;
    }
    const amp = this.kind === 'bass' ? 0.018 : 0.04;
    let y = 0;
    let z = inst.topZ + 0.04;
    if (prev && f.now - prev.time < 0.12) {
      const k = smoothstep((f.now - prev.time + 0.03) / 0.09);
      y = (prev.down ? 1 - 2 * k : -1 + 2 * k) * amp * (0.6 + prev.vel * 0.5);
      if (this.kind === 'bass') z += (1 - k) * -0.012;
    } else if (nxt && nxt.time - f.now < 0.12) {
      const k = smoothstep(1 - (nxt.time - f.now) / 0.12);
      y = (nxt.down ? 1 : -1) * amp * k;
    } else if (prev) {
      y = (prev.down ? -1 : 1) * amp * Math.max(0, 1 - (f.now - prev.time) / 0.4);
    }
    if (gesture === 'wave') this.wave(f, 'Right');
    else {
      const pick = inst.group.localToWorld(V().set(inst.strumX, y, z));
      this.armIK('Right', pick, this.outward('Right', -0.3, -0.7));
    }
    // A little guitar sway with energy.
    inst.group.rotation.z = 0.42 + Math.sin(f.beat * Math.PI) * 0.03 * this.energy;
    if (this.track.musician.personality === 'showoff' && this.energy > 0.6) this.b.Spine.rotation.z += Math.sin(f.beat * Math.PI * 0.5) * 0.05;
  }
}

// ---------------------------------------------------------------- Beatmaker (sampler pads)

export class Beatmaker extends Musician {
  pads: PadsProp;
  constructor(track: Track) {
    super(track);
    this.pads = buildPads(track.color);
    this.pads.group.position.set(0, 0, 0.32);
    this.group.add(this.pads.group);
    this.init();
  }
  protected instrumentFocus() {
    return this.world(this.pads.group, 0, 0.6, 0);
  }
  protected perform(f: FrameCtx) {
    const act = this.active(f.now);
    const lit = new Set(act.map((e) => ((e.pitch % 16) + 16) % 16));
    this.pads.pads.forEach((p, i) => {
      const m = p.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = damp(m.emissiveIntensity, lit.has(i) ? 2.2 : 0.05, 20, f.dt);
    });
    const gesture = this.idle(f, f.now - this.lastNoteTime < 1.2);
    for (const side of ['Left', 'Right'] as const) {
      const mine = this.events.filter((e) => (((e.pitch % 16) + 16) % 16) % 4 < 2 === (side === 'Left'));
      const prev = [...mine].reverse().find((e) => e.time <= f.now);
      const next = mine.find((e) => e.time > f.now && e.time < f.now + 0.4);
      const idx = next ? next.pitch : prev ? prev.pitch : side === 'Left' ? 0 : 3;
      const pos = this.pads.padPos(((idx % 16) + 16) % 16);
      const nt = next ? next.time - f.now : 1;
      const pt = prev ? f.now - prev.time : 1;
      const lift = 0.02 + 0.06 * Math.min(1, nt / 0.12) * Math.min(1, pt / 0.08);
      const target = this.world(this.pads.group, pos.x, pos.y + 0.03 + lift, pos.z + 0.02);
      if (gesture === 'wave' && side === 'Right') this.wave(f);
      else this.armIK(side, target, this.outward(side, -0.5, -0.5));
    }
  }
  protected idleOptions() {
    return ['look', 'wave'];
  }
}

// ---------------------------------------------------------------- Vocalist (audio tracks)

export class Vocalist extends Musician {
  mic: ReturnType<typeof buildMic>;
  private mouthOpen = 0;
  constructor(track: Track) {
    super(track);
    this.mic = buildMic(0.78 * track.musician.height);
    this.mic.group.position.set(0, 0, 0.05);
    this.group.add(this.mic.group);
    this.init();
  }
  protected instrumentFocus() {
    return this.mic.mic.getWorldPosition(V()).add(V(0, 0, 1.5).applyQuaternion(this.group.quaternion));
  }
  protected perform(f: FrameCtx) {
    // Audio tracks have no note events: the mouth and gestures follow the real signal level.
    const lvl = Math.min(1, f.level * 2.2);
    this.mouthOpen = damp(this.mouthOpen, lvl, 18, f.dt);
    if (lvl > 0.05) this.lastNoteTime = f.now;
    const singing = this.mouthOpen > 0.06;
    if (singing) {
      this.mood = 'sing';
      this.energy = Math.max(this.energy, this.mouthOpen);
    }
    const o = this.rig.face.mouths.o;
    o.scale.set(1 + this.mouthOpen * 0.4, 0.4 + this.mouthOpen * 2.2, 1);
    const micPos = this.mic.mic.getWorldPosition(V());
    this.armIK('Right', micPos.clone().add(V(0, -0.07, -0.02)), this.outward('Right', -0.6, -0.4));
    const gesture = this.idle(f, singing);
    if (gesture === 'wave') this.wave(f, 'Left');
    else {
      const raise = this.mouthOpen;
      const t = this.rig.root.localToWorld(V().set(0.22 + raise * 0.1, 0.55 + raise * 0.3, 0.15 + raise * 0.1));
      this.armIK('Left', t, this.outward('Left', -0.7, -0.4));
    }
    this.b.Head.rotation.x -= this.mouthOpen * 0.15;
  }
  protected idleOptions() {
    return ['look', 'wave'];
  }
}

export function createMusician(track: Track): Musician {
  switch (track.instrument) {
    case 'drums':
      return new Drummer(track);
    case 'keys':
      return new Keyboardist(track, 'piano');
    case 'synth':
      return new Keyboardist(track, 'synth');
    case 'guitar':
      return new StringPlayer(track, 'guitar');
    case 'bass':
      return new StringPlayer(track, 'bass');
    case 'sampler':
      return new Beatmaker(track);
    default:
      return new Vocalist(track);
  }
}
