import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { ProjectStore } from '../state/store';
import type { Project } from '../state/types';
import type { AudioEngine } from '../audio/engine';
import { gainReduction } from '../audio/effects';
import { actions } from '../state/actions';
import { EFFECTS, fromNorm, normToVolume, toNorm, volumeToNorm } from '../state/specs';
import { buildLights, buildStudio, RISER, ROOM, STATIONS, type Collider } from './studio';
import { createMusician, type Musician, type FrameCtx } from './animation/performers';
import { damp } from './animation/ik';
import { GearManager, type Control } from './gear';

// Owns the Three.js scene. Reads project state and the audio engine's clock every frame; never drives audio.
// All four perspectives share this one scene, so switching views never touches playback.

export type ViewMode = 'first' | 'director' | 'producer' | 'perform';

export interface Hover {
  label: string;
  value: string;
  x: number;
  y: number;
}

export interface LabelPos {
  x: number;
  y: number;
  visible: boolean;
}

const EYE = 1.02;

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, 0.05, 60);
  private composer: EffectComposer;
  private gtao: GTAOPass;
  private bloom: UnrealBloomPass;
  private orbit: OrbitControls;
  private dirCam = new THREE.PerspectiveCamera(50, 1, 0.05, 60); // the director view's own camera, blended into `camera`
  private clock = new THREE.Timer();
  private cutaways: THREE.Object3D[] = [];
  private musicians = new Map<string, Musician>();
  private gear = new GearManager();
  private colliders: Collider[];
  private lights: ReturnType<typeof buildLights>;
  private studio: ReturnType<typeof buildStudio>;
  private act: ReturnType<typeof actions>;
  private selectRing: THREE.Mesh;
  mode: ViewMode = 'director';
  quality: 'high' | 'low' = 'high';
  selected: string | null = null;
  labels = new Map<string, LabelPos>();
  hover: Hover | null = null;
  pointerLocked = false;
  onSelect: (trackId: string | null) => void = () => {};
  onHover: (h: Hover | null) => void = () => {};
  onLock: (locked: boolean) => void = () => {};

  // First-person state
  private fp = { pos: new THREE.Vector3(0, EYE, 3.9), yaw: Math.PI, pitch: -0.08, keys: new Set<string>() };
  // Camera transition
  private trans = { t: 1, fromPos: new THREE.Vector3(), fromQuat: new THREE.Quaternion() };
  debugCam: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null; // fixed camera for screenshots/tests
  private cine = { shot: -1, shotStart: 0, lastBar: -1, seed: 0 };
  private loopPulse = 0;
  private drag: { control: Control; startNorm: number; acc: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(-10, -10);
  private frameTimes: number[] = [];
  private raf = 0;
  private disposed = false;

  constructor(private container: HTMLElement, private store: ProjectStore, private engine: AudioEngine) {
    this.act = actions(store);
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);
    r.domElement.style.display = 'block';
    r.domElement.tabIndex = 0;

    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    this.scene.background = new THREE.Color('#2a1e18');
    this.scene.fog = new THREE.Fog('#2a1e18', 14, 30);

    this.studio = buildStudio();
    this.scene.add(this.studio.root);
    this.studio.root.traverse((o) => o.userData.cutaway && this.cutaways.push(o));
    this.colliders = this.studio.colliders;
    this.lights = buildLights(this.scene);
    this.scene.add(this.gear.root);

    this.selectRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 8, 48), new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false, transparent: true, opacity: 0.9 }));
    this.selectRing.rotation.x = -Math.PI / 2;
    this.selectRing.visible = false;
    this.scene.add(this.selectRing);

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.gtao = new GTAOPass(this.scene, this.camera, 1, 1);
    this.gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.5, scale: 1.2 });
    this.gtao.blendIntensity = 0.85;
    this.composer.addPass(this.gtao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.4, 1.6);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.orbit = new OrbitControls(this.dirCam, r.domElement);
    this.orbit.target.set(0, 0.45, -1.3);
    this.orbit.enableDamping = true;
    this.orbit.minDistance = 3;
    this.orbit.maxDistance = 13;
    this.orbit.maxPolarAngle = 1.25;
    this.orbit.minPolarAngle = 0.2;
    this.dirCam.position.set(0, 4.3, 3.0);
    this.orbit.update();

    this.syncProject(store.get());
    store.subscribe((p) => this.syncProject(p));
    engine.on((e) => {
      if (e.type === 'note') this.musicians.get(e.note.trackId)?.push(e.note);
      else if (e.type === 'transport') {
        if (!e.playing) for (const m of this.musicians.values()) m.clearFuture(engine.audibleTime());
        else this.loopPulse = 1;
      } else if (e.type === 'loop') this.loopPulse = 1;
    });

    this.bindInput();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.setView('director', true);
    this.loop();
  }

  // ------------------------------------------------------------ project sync
  private syncProject(p: Project) {
    const ids = new Set(p.tracks.map((t) => t.id));
    for (const [id, m] of this.musicians) if (!ids.has(id)) m.removing = true;
    for (const t of p.tracks) {
      let m = this.musicians.get(t.id);
      if (m && (m.track.instrument !== t.instrument || m.track.station !== t.station)) {
        this.scene.remove(m.group);
        m.dispose();
        this.musicians.delete(t.id);
        m = undefined;
      }
      if (!m) {
        m = createMusician(t);
        const st = STATIONS[t.station] ?? STATIONS[0];
        m.group.position.copy(st.pos);
        m.group.rotation.y = st.rotY;
        this.scene.add(m.group);
        this.musicians.set(t.id, m);
      } else if (m.track.musician !== t.musician || m.track.color !== t.color) {
        m.setLook(t);
      } else m.track = t;
    }
    this.gear.sync(p);
    // Station colliders for first-person walking.
    this.colliders = [...this.studio.colliders, ...p.tracks.map((t) => ({ x: STATIONS[t.station].pos.x, z: STATIONS[t.station].pos.z, r: t.instrument === 'drums' ? 0.85 : 0.6 }))];
  }

  // ------------------------------------------------------------ view modes
  setView(mode: ViewMode, instant = false) {
    if (mode !== 'first' && document.pointerLockElement) document.exitPointerLock();
    this.mode = mode;
    this.trans.t = instant ? 1 : 0;
    this.trans.fromPos.copy(this.camera.position);
    this.trans.fromQuat.copy(this.camera.quaternion);
    this.orbit.enabled = mode === 'director';
    this.cine.shot = -1;
    if (mode === 'first') {
      // Start where the camera is, at eye height, looking the same way.
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.fp.yaw = Math.atan2(-dir.x, -dir.z);
      this.fp.pitch = -0.08;
      if (this.fp.pos.distanceTo(new THREE.Vector3(0, EYE, 3.9)) > 0.01 && !instant) this.fp.pos.y = EYE;
    }
    this.quality = mode === 'producer' ? 'low' : this.quality === 'low' && this.frameTimes.length < 10 ? 'high' : this.quality;
  }

  setQuality(q: 'high' | 'low') {
    this.quality = q;
  }

  select(trackId: string | null) {
    this.selected = trackId;
  }

  // Director: frame a musician.
  focusOn(trackId: string) {
    const st = STATIONS[this.store.get().tracks.find((t) => t.id === trackId)?.station ?? 0];
    if (this.mode === 'director') {
      this.trans.t = 0;
      this.trans.fromPos.copy(this.camera.position);
      this.trans.fromQuat.copy(this.camera.quaternion);
      this.orbit.target.copy(st.pos).add(new THREE.Vector3(0, 0.6, 0));
      const off = new THREE.Vector3(0, 1.6, 2.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), st.rotY);
      this.dirCam.position.copy(st.pos).add(off);
    } else if (this.mode === 'first') {
      const off = new THREE.Vector3(0, 0, 1.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), st.rotY);
      this.fp.pos.copy(st.pos).add(off).setY(EYE);
      this.fp.yaw = Math.atan2(off.x, off.z);
    }
  }

  // ------------------------------------------------------------ input
  private bindInput() {
    const el = this.renderer.domElement;
    el.addEventListener('pointermove', (e) => this.onPointerMove(e));
    el.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointerup', () => this.endDrag());
    el.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === el;
      this.onLock(this.pointerLocked);
    });
    window.addEventListener('keydown', (e) => {
      if (this.mode !== 'first' || (e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      this.fp.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.fp.keys.delete(e.code));
    window.addEventListener('blur', () => this.fp.keys.clear());
  }

  private pick(): { control?: Control; trackId?: string; obj?: THREE.Object3D } {
    const ndc = this.pointerLocked ? new THREE.Vector2(0, 0) : this.pointer;
    this.raycaster.setFromCamera(ndc, this.camera);
    this.raycaster.far = this.mode === 'first' ? 3.2 : 40;
    const targets: THREE.Object3D[] = [...this.gear.interactables];
    for (const m of this.musicians.values()) targets.push(m.group);
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      if (h.object.userData.control) return { control: h.object.userData.control as Control, obj: h.object };
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.trackId) o = o.parent;
      if (o?.userData.trackId) return { trackId: o.userData.trackId as string, obj: h.object };
    }
    return {};
  }

  private onPointerMove(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    if (this.drag) {
      this.adjust(this.drag.control, -(e.movementY || 0) * 0.005 + (e.movementX || 0) * 0.002, true);
      return;
    }
    if (this.mode === 'first' && this.pointerLocked) {
      this.fp.yaw -= e.movementX * 0.0022;
      this.fp.pitch = THREE.MathUtils.clamp(this.fp.pitch - e.movementY * 0.0022, -1.3, 1.2);
    }
  }

  private onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const hit = this.pick();
    if (hit.control) {
      const c = hit.control;
      if (c.kind === 'bypass') this.act.toggleFx(c.owner, c.ownerId, c.fxId);
      else if (c.kind === 'mute' || c.kind === 'solo') this.act.toggle(c.trackId, c.kind);
      else {
        this.drag = { control: c, startNorm: 0, acc: 0 };
        this.orbit.enabled = false;
        if (!this.pointerLocked) this.renderer.domElement.setPointerCapture(e.pointerId);
      }
      return;
    }
    if (hit.trackId) {
      this.onSelect(hit.trackId);
      if (this.pointerLocked) document.exitPointerLock();
      return;
    }
    if (this.mode === 'first' && !this.pointerLocked) this.renderer.domElement.requestPointerLock?.();
    if (this.mode !== 'first' && this.mode !== 'director') return;
    if (this.mode === 'director') this.onSelect(null);
  }

  private endDrag() {
    if (!this.drag) return;
    this.store.commitGesture(this.drag.control.label);
    this.drag = null;
    this.orbit.enabled = this.mode === 'director';
  }

  private onWheel(e: WheelEvent) {
    const hit = this.pick();
    if (hit.control && hit.control.kind !== 'bypass' && hit.control.kind !== 'mute' && hit.control.kind !== 'solo') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.adjust(hit.control, -Math.sign(e.deltaY) * 0.03, false);
    }
  }

  private controlNorm(c: Control, p: Project): number {
    if (c.kind === 'fx') {
      const list = c.owner === 'master' ? p.master.fx : c.owner === 'bus' ? p.buses.find((b) => b.id === c.ownerId)?.fx : p.tracks.find((t) => t.id === c.ownerId)?.fx;
      const fx = list?.find((x) => x.id === c.fxId);
      if (!fx) return 0;
      const ps = EFFECTS[fx.type].params.find((x) => x.key === c.param)!;
      return toNorm(ps, fx.params[c.param]);
    }
    if (c.kind === 'volume') return volumeToNorm(c.trackId === 'master' ? p.master.volume : p.tracks.find((t) => t.id === c.trackId)?.volume ?? 0);
    if (c.kind === 'pan') return ((p.tracks.find((t) => t.id === c.trackId)?.pan ?? 0) + 1) / 2;
    return 0;
  }

  private adjust(c: Control, delta: number, live: boolean) {
    const p = this.store.get();
    const n = THREE.MathUtils.clamp(this.controlNorm(c, p) + delta, 0, 1);
    if (c.kind === 'fx') {
      const list = c.owner === 'master' ? p.master.fx : c.owner === 'bus' ? p.buses.find((b) => b.id === c.ownerId)?.fx : p.tracks.find((t) => t.id === c.ownerId)?.fx;
      const fx = list?.find((x) => x.id === c.fxId);
      if (!fx) return;
      const ps = EFFECTS[fx.type].params.find((x) => x.key === c.param)!;
      this.act.setFxParam(c.owner, c.ownerId, c.fxId, c.param, fromNorm(ps, n), live);
    } else if (c.kind === 'volume') this.act.setVolume(c.trackId, normToVolume(n), live);
    else if (c.kind === 'pan') this.act.setPan(c.trackId, n * 2 - 1, live);
  }

  private hoverText(c: Control, p: Project) {
    if (c.kind === 'fx') {
      const list = c.owner === 'master' ? p.master.fx : c.owner === 'bus' ? p.buses.find((b) => b.id === c.ownerId)?.fx : p.tracks.find((t) => t.id === c.ownerId)?.fx;
      const fx = list?.find((x) => x.id === c.fxId);
      if (!fx) return '';
      const ps = EFFECTS[fx.type].params.find((x) => x.key === c.param)!;
      const v = fx.params[c.param];
      return ps.unit ? `${v.toFixed(Math.abs(v) < 10 ? 2 : 1)} ${ps.unit}` : ps.max === 1 && ps.min === 0 ? `${Math.round(v * 100)}%` : v.toFixed(2);
    }
    if (c.kind === 'bypass') return findOn(p, c) ? 'on — click to bypass' : 'bypassed — click to enable';
    if (c.kind === 'volume') {
      const v = c.trackId === 'master' ? p.master.volume : p.tracks.find((t) => t.id === c.trackId)?.volume ?? 0;
      return v <= -60 ? '-∞ dB' : `${v.toFixed(1)} dB`;
    }
    if (c.kind === 'pan') {
      const v = p.tracks.find((t) => t.id === c.trackId)?.pan ?? 0;
      return Math.abs(v) < 0.02 ? 'centre' : `${Math.round(Math.abs(v) * 100)}% ${v < 0 ? 'L' : 'R'}`;
    }
    const t = p.tracks.find((x) => x.id === c.trackId);
    return t?.[c.kind] ? 'on' : 'off';
  }

  // ------------------------------------------------------------ frame
  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.clock.update();
    const dt = Math.min(0.05, this.clock.getDelta());
    this.frame(dt);
  };

  frame(dt: number) {
    const p = this.store.get();
    const elapsed = this.clock.getElapsed();
    const now = this.engine.audibleTime();
    const playing = this.engine.playing;
    const beat = this.engine.position(now);
    this.loopPulse = Math.max(0, this.loopPulse - dt);

    // Find who is loudest (soloist) for glances and cinematic focus.
    let loudest: Musician | null = null;
    let best = 0.05;
    const levels = new Map<string, number>();
    for (const t of p.tracks) {
      const l = this.engine.level(t.id);
      levels.set(t.id, l);
      const m = this.musicians.get(t.id);
      if (m && l > best) {
        best = l;
        loudest = m;
      }
    }
    const focus = loudest ? loudest.rig.bones.Head.getWorldPosition(new THREE.Vector3()) : null;

    for (const [id, m] of this.musicians) {
      if (m.removed) {
        this.scene.remove(m.group);
        m.dispose();
        this.musicians.delete(id);
        continue;
      }
      const camNear = this.mode === 'first' && this.camera.position.distanceTo(m.group.position) < 2.4 && this.facing(m.group.position);
      const ctx: FrameCtx = { now, dt, elapsed, beat, playing, level: levels.get(id) ?? 0, camera: this.camera.position, cameraNear: camNear, focus: focus && loudest !== m ? focus : null, loopPulse: this.loopPulse };
      m.update(ctx);
    }
    this.gear.update(p, beat, playing, (id) => this.engine.level(id), (trackId, fxId) => {
      const units = trackId === 'master' ? this.engine.graph.masterFx.units : this.engine.graph.channels.get(trackId)?.fx.units;
      const u = units?.get(fxId);
      return u ? gainReduction(u) : 0;
    });

    // Selection ring
    const sel = this.selected ? this.musicians.get(this.selected) : undefined;
    this.selectRing.visible = !!sel && this.mode !== 'perform';
    if (sel) {
      this.selectRing.position.copy(sel.group.position).setY(sel.group.position.y + 0.02);
      this.selectRing.scale.setScalar(1 + Math.sin(elapsed * 3) * 0.04);
    }

    this.updateCamera(dt, beat, playing, focus);
    for (const o of this.cutaways) {
      const c = o.userData.cutaway as { kind: string; normal?: THREE.Vector3; point?: THREE.Vector3 };
      o.visible = c.kind === 'ceiling' ? this.camera.position.y < ROOM.height - 0.05 : this.camera.position.clone().sub(c.point!).dot(c.normal!) > -0.05;
    }
    this.updateLighting(dt, beat, playing);

    // Hover tooltip (not while dragging)
    if (!this.drag && (this.pointerLocked || this.pointer.x > -2)) {
      const hit = this.pick();
      const c = hit.control;
      this.renderer.domElement.style.cursor = c ? 'ns-resize' : hit.trackId ? 'pointer' : '';
      if (c && (c.kind === 'bypass' || c.kind === 'mute' || c.kind === 'solo')) this.renderer.domElement.style.cursor = 'pointer';
      const next: Hover | null = c
        ? { label: c.label, value: this.hoverText(c, p), x: this.pointerLocked ? 0.5 : (this.pointer.x + 1) / 2, y: this.pointerLocked ? 0.5 : (1 - this.pointer.y) / 2 }
        : hit.trackId
          ? { label: p.tracks.find((t) => t.id === hit.trackId)?.musician.name ?? '', value: 'click to open', x: this.pointerLocked ? 0.5 : (this.pointer.x + 1) / 2, y: this.pointerLocked ? 0.5 : (1 - this.pointer.y) / 2 }
          : null;
      if (JSON.stringify(next) !== JSON.stringify(this.hover)) {
        this.hover = next;
        this.onHover(next);
      }
    } else if (this.drag) {
      const v = this.hoverText(this.drag.control, p);
      if (this.hover && this.hover.value !== v) {
        this.hover = { ...this.hover, value: v };
        this.onHover(this.hover);
      }
    }

    // Labels for the director overlay
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    for (const [id, m] of this.musicians) {
      const v = m.rig.bones.Head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.55, 0)).project(this.camera);
      this.labels.set(id, { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 });
    }
    for (const id of this.labels.keys()) if (!this.musicians.has(id)) this.labels.delete(id);

    this.render(dt);
  }

  private facing(pos: THREE.Vector3) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir.dot(pos.clone().sub(this.camera.position).setY(0).normalize()) > 0.6;
  }

  private render(dt: number) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 90) this.frameTimes.shift();
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    // Adaptive quality: drop ambient occlusion when frames get slow.
    if (this.quality === 'high' && this.frameTimes.length >= 90 && avg > 1 / 28) {
      this.quality = 'low';
      this.frameTimes.length = 0;
    }
    this.gtao.enabled = this.quality === 'high';
    this.bloom.strength = this.mode === 'perform' ? 0.7 : 0.35;
    this.composer.render(dt);
  }

  // ------------------------------------------------------------ cameras
  private updateCamera(dt: number, beat: number, playing: boolean, focus: THREE.Vector3 | null) {
    const target = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    if (this.debugCam) {
      target.copy(this.debugCam.pos);
      quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(this.debugCam.pos, this.debugCam.look, new THREE.Vector3(0, 1, 0)));
      this.trans.t = 1;
    } else if (this.mode === 'director') {
      this.orbit.update();
      target.copy(this.dirCam.position);
      quat.copy(this.dirCam.quaternion);
    } else if (this.mode === 'first') {
      this.walk(dt);
      target.copy(this.fp.pos);
      quat.setFromEuler(new THREE.Euler(this.fp.pitch, this.fp.yaw, 0, 'YXZ'));
    } else if (this.mode === 'producer') {
      const a = Math.sin(this.clock.getElapsed() * 0.05) * 0.25;
      target.set(Math.sin(a) * 6.5, 3.4, -1.2 + Math.cos(a) * 6.5);
      const m = new THREE.Matrix4().lookAt(target, new THREE.Vector3(0, 0.7, -1.6), new THREE.Vector3(0, 1, 0));
      quat.setFromRotationMatrix(m);
    } else {
      this.cinematic(beat, playing, focus, target, quat);
    }
    if (this.trans.t < 1) {
      this.trans.t = Math.min(1, this.trans.t + dt / 0.9);
      const k = this.trans.t * this.trans.t * (3 - 2 * this.trans.t);
      this.camera.position.lerpVectors(this.trans.fromPos, target, k);
      this.camera.quaternion.slerpQuaternions(this.trans.fromQuat, quat, k);
    } else {
      this.camera.position.copy(target);
      this.camera.quaternion.copy(quat);
    }
    const fov = this.mode === 'first' ? 70 : this.mode === 'perform' ? 40 : 50;
    this.camera.fov = damp(this.camera.fov, fov, 4, dt);
    this.camera.updateProjectionMatrix();
  }

  private walk(dt: number) {
    const k = this.fp.keys;
    const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? 3.2 : 1.8) * dt;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    if (!f && !s) return;
    const fwd = new THREE.Vector3(-Math.sin(this.fp.yaw), 0, -Math.cos(this.fp.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = fwd.multiplyScalar(f).add(right.multiplyScalar(s)).normalize().multiplyScalar(speed);
    const next = this.fp.pos.clone().add(move);
    const pad = 0.3;
    next.x = THREE.MathUtils.clamp(next.x, ROOM.minX + pad, ROOM.maxX - pad);
    next.z = THREE.MathUtils.clamp(next.z, ROOM.minZ + pad, ROOM.maxZ - pad);
    for (const c of this.colliders) {
      const dx = next.x - c.x;
      const dz = next.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + 0.25;
      if (d < min && d > 1e-4) {
        next.x = c.x + (dx / d) * min;
        next.z = c.z + (dz / d) * min;
      }
    }
    // Step up onto the stage riser.
    const onStage = next.z < RISER.z + Math.sqrt(Math.max(0, RISER.r * RISER.r - next.x * next.x));
    next.y = damp(this.fp.pos.y, EYE + (onStage ? 0.1 : 0) + Math.sin(this.clock.getElapsed() * 9) * 0.012, 12, dt);
    this.fp.pos.copy(next);
  }

  // Performance mode: cut between shots on bar lines, favouring whoever is loudest.
  private cinematic(beat: number, playing: boolean, focus: THREE.Vector3 | null, pos: THREE.Vector3, quat: THREE.Quaternion) {
    const p = this.store.get();
    const bar = Math.floor(beat / p.beatsPerBar);
    const barsPerShot = 2;
    if (this.cine.shot < 0 || (playing && bar !== this.cine.lastBar && bar % barsPerShot === 0)) {
      this.cine.lastBar = bar;
      this.cine.shot = (this.cine.shot + 1 + Math.floor(Math.random() * 3)) % 6;
      this.cine.shotStart = this.clock.getElapsed();
      this.cine.seed = Math.random();
      this.trans.t = 1; // hard cut
    }
    const t = this.clock.getElapsed() - this.cine.shotStart;
    const tracks = p.tracks;
    const subject = focus ?? new THREE.Vector3(0, 0.8, -1.8);
    let look = subject.clone();
    switch (this.cine.shot) {
      case 0: // wide dolly
        pos.set(Math.sin(t * 0.08 + this.cine.seed * 6) * 2.5, 1.6, 3.6 - t * 0.05);
        look = new THREE.Vector3(0, 0.7, -1.8);
        break;
      case 1: {
        // close on the soloist
        pos.copy(subject).add(new THREE.Vector3(Math.sin(t * 0.2 + this.cine.seed * 6) * 1.1, 0.1, 1.2));
        break;
      }
      case 2: {
        // drummer over-the-kit
        const d = tracks.find((x) => x.instrument === 'drums');
        const st = STATIONS[d?.station ?? 0].pos;
        pos.set(st.x + 0.9 - t * 0.03, 1.3, st.z + 1.5);
        look = st.clone().add(new THREE.Vector3(0, 0.6, 0));
        break;
      }
      case 3: // low hero angle
        pos.set(-2 + t * 0.06, 0.35, 0.8);
        look = new THREE.Vector3(0, 1.1, -2);
        break;
      case 4: // overhead crane
        pos.set(Math.cos(t * 0.1) * 2.6, 2.75, -1.0 + Math.sin(t * 0.1) * 1.4);
        look = new THREE.Vector3(0, 0, -1.6);
        break;
      default: {
        // profile track along a random musician
        const m = tracks[Math.floor(this.cine.seed * tracks.length)];
        const st = m ? STATIONS[m.station].pos : new THREE.Vector3(0, 0, -1.5);
        pos.copy(st).add(new THREE.Vector3(1.4 - t * 0.04, 1.0, 0.6));
        look = st.clone().add(new THREE.Vector3(0, 0.8, 0));
      }
    }
    quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, new THREE.Vector3(0, 1, 0)));
  }

  private updateLighting(dt: number, beat: number, playing: boolean) {
    const perform = this.mode === 'perform';
    const L = this.lights;
    const master = Math.min(1, this.engine.level() * 1.5);
    L.hemi.intensity = damp(L.hemi.intensity, perform ? 0.18 : 0.55, 3, dt);
    L.sun.intensity = damp(L.sun.intensity, perform ? 0.5 : 2.4, 3, dt);
    L.key.intensity = damp(L.key.intensity, perform ? 4 + master * 6 : 6, 6, dt);
    const bar = Math.floor(beat / 4);
    const pulse = playing ? Math.pow(1 - (beat % 1), 3) : 0;
    L.spots.forEach((s, i) => {
      s.intensity = damp(s.intensity, perform ? 30 + pulse * 25 + master * 20 : 0, 8, dt);
      if (perform) {
        const hue = ((bar * 0.17 + i * 0.33) % 1 + 1) % 1;
        s.color.setHSL(hue, 0.8, 0.6);
        const st = STATIONS[(i + bar) % 4].pos;
        s.target.position.lerp(st, 0.05);
      }
    });
    this.scene.environmentIntensity = damp(this.scene.environmentIntensity, perform ? 0.12 : 0.35, 3, dt);
  }

  // Snapshot of the canvas (used by tests and the "photo" button).
  screenshot() {
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
  }
}

function findOn(p: Project, c: { owner: 'track' | 'bus' | 'master'; ownerId: string; fxId: string }) {
  const list = c.owner === 'master' ? p.master.fx : c.owner === 'bus' ? p.buses.find((b) => b.id === c.ownerId)?.fx : p.tracks.find((t) => t.id === c.ownerId)?.fx;
  return list?.find((x) => x.id === c.fxId)?.enabled ?? false;
}
