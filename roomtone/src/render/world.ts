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
import type { Collider } from './studio';
import { studioRoom, type Room, type RoomId } from './rooms';
import { hallRoom, setDustPixelRatio } from './hall';
import { defaultQuality, QUALITY, QUALITY_ORDER, savedQuality, type QualityId } from './quality';
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
  private musicians = new Map<string, Musician>();
  private gear = new GearManager();
  private colliders: Collider[] = [];
  room!: Room;
  private rooms = new Map<RoomId, Room>();
  private roomLoading: RoomId | null = null;
  private act: ReturnType<typeof actions>;
  private selectRing: THREE.Mesh;
  mode: ViewMode = 'director';
  quality: QualityId = savedQuality() ?? defaultQuality();
  autoQuality = savedQuality() === null; // step down on slow frames unless the user picked a preset
  onQuality: (q: QualityId, auto: boolean) => void = () => {};
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
    this.scene.add(this.gear.root);

    this.selectRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 8, 48), new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false, transparent: true, opacity: 0.9 }));
    this.selectRing.rotation.x = -Math.PI / 2;
    this.selectRing.visible = false;
    this.scene.add(this.selectRing);

    this.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
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
    this.orbit.maxDistance = 30;
    this.orbit.maxPolarAngle = 1.25;
    this.orbit.minPolarAngle = 0.2;
    this.useRoom(studioRoom());
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
    const want = p.room ?? 'studio';
    if (want !== this.room.id && this.roomLoading !== want) this.switchRoom(want);
    const ids = new Set(p.tracks.map((t) => t.id));
    for (const [id, m] of this.musicians) if (!ids.has(id)) m.removing = true;
    for (const t of p.tracks) {
      let m = this.musicians.get(t.id);
      if (m && (m.track.instrument !== t.instrument || m.track.station !== t.station || (t.instrument === 'strings' && m.track.inst.preset !== t.inst.preset))) {
        this.scene.remove(m.group);
        m.dispose();
        this.musicians.delete(t.id);
        m = undefined;
      }
      if (!m) {
        m = createMusician(t);
        this.place(m);
        this.scene.add(m.group);
        this.musicians.set(t.id, m);
      } else if (m.track.musician !== t.musician || m.track.color !== t.color) {
        m.setLook(t);
      } else m.track = t;
    }
    this.gear.sync(p);
    // Station colliders for first-person walking.
    const st = this.room.stations;
    this.colliders = [...this.room.colliders, ...p.tracks.map((t) => ({ x: st[t.station].pos.x, z: st[t.station].pos.z, r: t.instrument === 'drums' ? 0.85 : 0.6 }))];
  }

  private place(m: Musician) {
    const st = this.room.stations[m.track.station] ?? this.room.stations[0];
    m.group.position.copy(st.pos);
    m.group.rotation.y = st.rotY;
    m.replant();
  }

  // ------------------------------------------------------------ rooms
  private async switchRoom(id: RoomId) {
    this.roomLoading = id;
    let room = this.rooms.get(id);
    try {
      room ??= id === 'hall' ? await hallRoom() : studioRoom();
    } catch (e) {
      console.error('Could not load room', id, e);
      this.roomLoading = null;
      return;
    }
    this.roomLoading = null;
    if ((this.store.get().room ?? 'studio') !== id) return; // changed again while loading
    this.useRoom(room);
    this.syncProject(this.store.get());
  }

  private useRoom(room: Room) {
    if (this.room) this.scene.remove(this.room.root);
    this.rooms.set(room.id, room);
    this.room = room;
    this.scene.add(room.root);
    this.scene.fog = room.fog;
    this.scene.background = room.background;
    this.scene.environmentIntensity = room.envIntensity;
    this.renderer.toneMappingExposure = room.exposure;
    this.gear.setRoom(room);
    this.gear.sync(this.store.get());
    for (const m of this.musicians.values()) this.place(m);
    this.orbit.target.copy(room.director.target);
    this.orbit.maxDistance = room.director.maxDistance;
    this.dirCam.position.copy(room.director.pos);
    this.orbit.update();
    this.fp.pos.copy(room.fpStart.pos).setY(EYE + room.floorY(room.fpStart.pos.x, room.fpStart.pos.z));
    this.fp.yaw = room.fpStart.yaw;
    this.trans.t = 0;
    this.trans.fromPos.copy(this.camera.position);
    this.trans.fromQuat.copy(this.camera.quaternion);
    this.applyQuality();
  }

  // ------------------------------------------------------------ graphics quality
  setQuality(q: QualityId, auto = false) {
    this.quality = q;
    if (!auto) this.autoQuality = false;
    this.frameTimes.length = 0;
    this.applyQuality();
    this.onQuality(q, auto);
  }

  private applyQuality() {
    if (!this.room) return;
    const Q = QUALITY[this.quality];
    const w = Math.max(1, this.container.clientWidth);
    const pr = Q.pixelRatio(window.devicePixelRatio || 1, w);
    if (this.renderer.getPixelRatio() !== pr) {
      this.renderer.setPixelRatio(pr);
      this.resize();
    }
    const setShadow = (l: THREE.Light & { shadow?: THREE.LightShadow }, on: boolean, size: number) => {
      l.castShadow = on && size > 0;
      if (!l.shadow || !l.castShadow || l.shadow.mapSize.x === size) return;
      l.shadow.mapSize.set(size, size);
      l.shadow.map?.dispose();
      l.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    };
    const L = this.room.lights;
    setShadow(L.shadowKey, true, Q.shadowSize);
    for (const l of L.secondaryShadows) setShadow(l, Q.spotShadows, Math.min(2048, Q.shadowSize));
    for (const l of L.all) if (l.userData.extra) l.visible = Q.extraLights;
    for (const a of this.room.atmosphere) a.visible = Q.atmosphere;
    setDustPixelRatio(this.room, pr * Math.max(1, this.container.clientHeight) / 800);
    this.renderer.shadowMap.needsUpdate = true;
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (rt.samples !== Q.msaa) {
        rt.samples = Q.msaa;
        rt.dispose();
      }
    }
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
    }
  }

  select(trackId: string | null) {
    this.selected = trackId;
  }

  // Director: frame a musician.
  focusOn(trackId: string) {
    const st = this.room.stations[this.store.get().tracks.find((t) => t.id === trackId)?.station ?? 0];
    if (this.mode === 'director') {
      this.trans.t = 0;
      this.trans.fromPos.copy(this.camera.position);
      this.trans.fromQuat.copy(this.camera.quaternion);
      this.orbit.target.copy(st.pos).add(new THREE.Vector3(0, 0.6, 0));
      const off = new THREE.Vector3(0, 1.6, 2.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), st.rotY);
      this.dirCam.position.copy(st.pos).add(off);
    } else if (this.mode === 'first') {
      const off = new THREE.Vector3(0, 0, 1.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), st.rotY);
      this.fp.pos.copy(st.pos).add(off);
      this.fp.pos.y = EYE + this.room.floorY(this.fp.pos.x, this.fp.pos.z);
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
    this.room.update?.(dt, elapsed, this.engine.level());
    for (const o of this.room.cutaways) {
      const c = o.userData.cutaway as { kind: string; normal?: THREE.Vector3; point?: THREE.Vector3 };
      o.visible = c.kind === 'ceiling' ? this.camera.position.y < this.room.bounds.height - 0.05 : this.camera.position.clone().sub(c.point!).dot(c.normal!) > -0.05;
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
    // Adaptive quality: step one preset down after ~3 s of slow frames (only while the user hasn't chosen).
    const idx = QUALITY_ORDER.indexOf(this.quality);
    if (this.autoQuality && idx > 0 && this.frameTimes.length >= 90 && avg > 1 / 28 && document.visibilityState === 'visible') this.setQuality(QUALITY_ORDER[idx - 1], true);
    const Q = QUALITY[this.quality];
    // The producer preview is small; skip AO there.
    this.gtao.enabled = Q.ao && this.mode !== 'producer';
    this.bloom.enabled = Q.bloom;
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
      const c = this.room.stageCenter;
      const d = this.room.id === 'hall' ? 11 : 6.5;
      target.set(c.x + Math.sin(a) * d, c.y + d * 0.5, c.z + 0.6 + Math.cos(a) * d);
      const m = new THREE.Matrix4().lookAt(target, c.clone().add(new THREE.Vector3(0, 0.6, 0)), new THREE.Vector3(0, 1, 0));
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
    const B = this.room.bounds;
    next.x = THREE.MathUtils.clamp(next.x, B.minX + pad, B.maxX - pad);
    next.z = THREE.MathUtils.clamp(next.z, B.minZ + pad, B.maxZ - pad);
    for (const b of this.room.boxes) {
      // Push out of a box along the shallowest axis.
      const x0 = b.minX - 0.25, x1 = b.maxX + 0.25, z0 = b.minZ - 0.25, z1 = b.maxZ + 0.25;
      if (next.x <= x0 || next.x >= x1 || next.z <= z0 || next.z >= z1) continue;
      const opts = [[next.x - x0, 'x', x0], [x1 - next.x, 'x', x1], [next.z - z0, 'z', z0], [z1 - next.z, 'z', z1]] as const;
      const [, axis, v] = [...opts].sort((p, q) => p[0] - q[0])[0];
      next[axis] = v;
    }
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
    // Step up onto stages and risers.
    next.y = damp(this.fp.pos.y, EYE + this.room.floorY(next.x, next.z) + Math.sin(this.clock.getElapsed() * 9) * 0.012, 12, dt);
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
    const C = this.room.stageCenter;
    const S = this.room.id === 'hall' ? 1.6 : 1; // shots open up in the bigger room
    const at = (x: number, y: number, z: number) => new THREE.Vector3(C.x + x * S, C.y + y * S, C.z + z * S);
    const subject = focus ?? at(0, 0.7, 0);
    let look = subject.clone();
    switch (this.cine.shot) {
      case 0: // wide dolly
        pos.copy(at(Math.sin(t * 0.08 + this.cine.seed * 6) * 2.5, 1.5, 5.4 - t * 0.05));
        look = at(0, 0.6, 0);
        break;
      case 1: {
        // close on the soloist
        pos.copy(subject).add(new THREE.Vector3(Math.sin(t * 0.2 + this.cine.seed * 6) * 1.1, 0.1, 1.2));
        break;
      }
      case 2: {
        // drummer over-the-kit
        const d = tracks.find((x) => x.instrument === 'drums');
        const st = this.room.stations[d?.station ?? 0].pos;
        pos.set(st.x + 0.9 - t * 0.03, st.y + 1.2, st.z + 1.5);
        look = st.clone().add(new THREE.Vector3(0, 0.6, 0));
        break;
      }
      case 3: // low hero angle
        pos.copy(at(-2 + t * 0.06, 0.25, 2.6));
        look = at(0, 1.0, -0.2);
        break;
      case 4: // overhead crane
        pos.copy(at(Math.cos(t * 0.1) * 2.6, 2.65, 0.8 + Math.sin(t * 0.1) * 1.4));
        look = at(0, -0.1, 0.2);
        break;
      default: {
        // profile track along a random musician
        const m = tracks[Math.floor(this.cine.seed * tracks.length)];
        const st = m ? this.room.stations[m.station].pos : C;
        pos.copy(st).add(new THREE.Vector3(1.4 - t * 0.04, 1.0, 0.6));
        look = st.clone().add(new THREE.Vector3(0, 0.8, 0));
      }
    }
    quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, new THREE.Vector3(0, 1, 0)));
  }

  private updateLighting(dt: number, beat: number, playing: boolean) {
    const perform = this.mode === 'perform';
    const L = this.room.lights;
    const master = Math.min(1, this.engine.level() * 1.5);
    const bar = Math.floor(beat / 4);
    const pulse = playing ? Math.pow(1 - (beat % 1), 3) : 0;
    for (const l of L.all) {
      if (L.spots.includes(l as THREE.SpotLight)) continue;
      l.intensity = damp(l.intensity, perform ? l.userData.perform * (1 + master * 0.4) : l.userData.base, 4, dt);
    }
    L.spots.forEach((s, i) => {
      s.intensity = damp(s.intensity, perform ? s.userData.perform * (1 + pulse * 0.8 + master * 0.6) : s.userData.base, 8, dt);
      if (perform) {
        s.color.setHSL((((bar * 0.17 + i * 0.33) % 1) + 1) % 1, 0.8, 0.6);
        const st = this.room.stations[(i + bar) % 4].pos;
        s.target.position.lerp(st, 0.05);
      } else if (s.userData.color) s.color.lerp(s.userData.color, Math.min(1, dt * 4));
    });
    this.scene.environmentIntensity = damp(this.scene.environmentIntensity, perform ? 0.12 : this.room.envIntensity, 3, dt);
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
