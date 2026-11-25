import * as THREE from 'three';
import type { Effect, Project, Track } from '../state/types';
import { EFFECTS, toNorm, volumeToNorm } from '../state/specs';
import { automationValue } from '../audio/schedule';
import { buildAmp, buildPedal, buildRackUnit, type GearProp, label, M, mesh } from './props';
import { CONSOLE_POS, MASTER_RACK_POS, STATIONS } from './studio';

// Effects become objects: pedals on a pedalboard, rack units in a tower, an amp behind the player.
// Knobs read the same project values as the mixer every frame, and carry `userData.control` so the
// interaction layer can turn them. The mixing console mirrors every channel strip.

export type Control =
  | { kind: 'fx'; owner: 'track' | 'bus' | 'master'; ownerId: string; fxId: string; param: string; label: string }
  | { kind: 'bypass'; owner: 'track' | 'bus' | 'master'; ownerId: string; fxId: string; label: string }
  | { kind: 'volume'; trackId: string | 'master'; label: string }
  | { kind: 'pan'; trackId: string; label: string }
  | { kind: 'mute' | 'solo'; trackId: string; label: string };

interface PlacedGear {
  fx: Effect;
  prop: GearProp;
}

interface StationGear {
  group: THREE.Group;
  key: string;
  gear: PlacedGear[];
  cable: THREE.Mesh | null;
  cableMat: THREE.MeshStandardMaterial;
}

function tag(obj: THREE.Object3D, control: Control) {
  obj.traverse((o) => (o.userData.control = control));
}

const knobRot = (n: number) => -(n - 0.5) * 4.6;

export class GearManager {
  readonly root = new THREE.Group();
  readonly interactables: THREE.Object3D[] = [];
  private stations = new Map<string, StationGear>();
  private master = new THREE.Group();
  private masterKey = '';
  private masterGear: { owner: 'bus' | 'master'; ownerId: string; gear: PlacedGear[] }[] = [];
  private console = new THREE.Group();
  private consoleKey = '';
  private strips = new Map<string, { fader: THREE.Object3D; pan: THREE.Object3D; mute: THREE.Mesh; solo: THREE.Mesh; leds: THREE.Mesh[] }>();

  constructor() {
    this.root.name = 'gear';
    this.master.position.copy(MASTER_RACK_POS);
    this.master.rotation.y = Math.PI - 0.35;
    this.root.add(this.master);
    this.console.position.copy(CONSOLE_POS);
    this.console.rotation.y = Math.PI;
    this.root.add(this.console);
  }

  sync(p: Project) {
    // Track stations
    const ids = new Set(p.tracks.map((t) => t.id));
    for (const [id, sg] of this.stations) if (!ids.has(id)) (this.root.remove(sg.group), this.stations.delete(id));
    for (const t of p.tracks) {
      const key = `${t.station}|${t.color}|` + t.fx.map((f) => `${f.id}:${f.type}`).join(',');
      const sg = this.stations.get(t.id);
      if (sg && sg.key === key) continue;
      if (sg) this.root.remove(sg.group);
      this.stations.set(t.id, this.buildStation(t, key));
    }
    // Master rack: bus and master effects
    const mkey = [...p.buses.map((b) => b.id + ':' + b.fx.map((f) => f.id).join(',')), p.master.fx.map((f) => f.id).join(',')].join('|');
    if (mkey !== this.masterKey) {
      this.masterKey = mkey;
      this.master.clear();
      this.masterGear = [];
      let slot = 0;
      const add = (owner: 'bus' | 'master', ownerId: string, fx: readonly Effect[], name: string) => {
        const gear: PlacedGear[] = [];
        for (const e of fx) {
          const spec = EFFECTS[e.type];
          const prop = buildRackUnit(spec.color, `${name}: ${spec.name}`, spec.params.map((x) => x.key), e.type === 'compressor');
          prop.group.position.set(0, 0.84 - slot * 0.088, 0.06);
          prop.group.scale.setScalar(1.15);
          this.master.add(prop.group);
          this.wire(prop, owner, ownerId, e);
          gear.push({ fx: e, prop });
          slot++;
        }
        this.masterGear.push({ owner, ownerId, gear });
      };
      for (const b of p.buses) add('bus', b.id, b.fx, b.name.split(' ')[0]);
      add('master', 'master', p.master.fx, 'Master');
    }
    this.syncConsole(p);
    this.refreshInteractables();
  }

  private wire(prop: GearProp, owner: 'track' | 'bus' | 'master', ownerId: string, e: Effect) {
    const spec = EFFECTS[e.type];
    for (const k of prop.knobs) {
      const ps = spec.params.find((x) => x.key === k.param)!;
      tag(k.obj, { kind: 'fx', owner, ownerId, fxId: e.id, param: k.param, label: `${spec.gearName} · ${ps.label}` });
    }
    if (prop.footswitch) tag(prop.footswitch, { kind: 'bypass', owner, ownerId, fxId: e.id, label: `${spec.gearName} · on/off` });
    else if (prop.led) tag(prop.led, { kind: 'bypass', owner, ownerId, fxId: e.id, label: `${spec.gearName} · on/off` });
  }

  private buildStation(t: Track, key: string): StationGear {
    const st = STATIONS[t.station] ?? STATIONS[0];
    const group = new THREE.Group();
    group.position.copy(st.pos);
    group.rotation.y = st.rotY;
    this.root.add(group);
    const gear: PlacedGear[] = [];
    const pedals = t.fx.filter((e) => EFFECTS[e.type].form === 'pedal');
    const racks = t.fx.filter((e) => EFFECTS[e.type].form === 'rack');
    const amps = t.fx.filter((e) => EFFECTS[e.type].form === 'amp');
    const drums = t.instrument === 'drums';
    // Pedalboard in front
    if (pedals.length) {
      const board = new THREE.Group();
      board.position.set(drums ? 0.75 : 0.32, 0, drums ? 0.55 : 0.5);
      board.rotation.y = -0.15;
      group.add(board);
      const w = pedals.length * 0.13 + 0.04;
      mesh(new THREE.BoxGeometry(w, 0.025, 0.2), M('#2a2830', 0.6), board, 0, 0.0125, 0);
      pedals.forEach((e, i) => {
        const spec = EFFECTS[e.type];
        const prop = buildPedal(spec.color, spec.gearName, spec.params.map((p) => p.key));
        prop.group.position.set(w / 2 - 0.08 - i * 0.13, 0.025, 0);
        board.add(prop.group);
        this.wire(prop, 'track', t.id, e);
        gear.push({ fx: e, prop });
      });
    }
    // Rack tower to the side
    if (racks.length) {
      const tower = new THREE.Group();
      tower.position.set(drums ? -0.85 : -0.62, 0, drums ? 0.05 : -0.1);
      tower.rotation.y = 0.5;
      group.add(tower);
      const h = racks.length * 0.085 + 0.22;
      mesh(new THREE.BoxGeometry(0.42, h, 0.28), M('#3b2a20', 0.5), tower, 0, h / 2, -0.12);
      racks.forEach((e, i) => {
        const spec = EFFECTS[e.type];
        const prop = buildRackUnit(spec.color, spec.name, spec.params.map((p) => p.key), e.type === 'compressor');
        prop.group.position.set(0, h - 0.06 - i * 0.085, 0.025);
        prop.group.scale.setScalar(0.85);
        tower.add(prop.group);
        this.wire(prop, 'track', t.id, e);
        gear.push({ fx: e, prop });
      });
    }
    // Amp behind
    amps.forEach((e, i) => {
      const spec = EFFECTS[e.type];
      const prop = buildAmp(spec.gearName, spec.params.map((p) => p.key));
      prop.group.position.set(0.55 + i * 0.45, 0, -0.45);
      prop.group.rotation.y = -0.4;
      group.add(prop.group);
      this.wire(prop, 'track', t.id, e);
      gear.push({ fx: e, prop });
    });
    // Signal cable: instrument -> each device in chain order -> floor snake toward the console.
    const cableMat = new THREE.MeshStandardMaterial({ color: t.color, roughness: 0.5, emissive: t.color, emissiveIntensity: 0 });
    const pts: THREE.Vector3[] = [new THREE.Vector3(0.05, 0.02, 0.2)];
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    for (const e of t.fx) {
      const g = gear.find((x) => x.fx.id === e.id);
      if (!g) continue;
      g.prop.group.updateMatrixWorld(true);
      const pIn = g.prop.group.localToWorld(g.prop.cableIn.clone()).applyMatrix4(inv);
      const pOut = g.prop.group.localToWorld(g.prop.cableOut.clone()).applyMatrix4(inv);
      pts.push(new THREE.Vector3(pIn.x, 0.012, pIn.z), pIn, pOut, new THREE.Vector3(pOut.x, 0.012, pOut.z));
    }
    pts.push(new THREE.Vector3(0, 0.012, -0.7), new THREE.Vector3(0, 0.012, -0.9));
    let cable: THREE.Mesh | null = null;
    if (pts.length > 2) {
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.3);
      cable = mesh(new THREE.TubeGeometry(curve, pts.length * 14, 0.0055, 6), cableMat, group, 0, 0, 0, false);
    }
    group.traverse((o) => {
      if (!o.userData.control) o.userData.trackId = t.id;
    });
    return { group, key, gear, cable, cableMat };
  }

  private syncConsole(p: Project) {
    const key = p.tracks.map((t) => `${t.id}:${t.name}:${t.color}`).join('|');
    if (key === this.consoleKey) return;
    this.consoleKey = key;
    this.console.clear();
    this.strips.clear();
    const n = p.tracks.length + 1;
    const sw = 0.11;
    const width = Math.max(1.0, n * sw + 0.1);
    const body = new THREE.Group();
    body.position.set(0, 0.6, 0.05);
    body.rotation.x = 0.12; // slopes up toward the band
    this.console.add(body);
    mesh(new THREE.BoxGeometry(width, 0.05, 0.56), M('#3a3540', 0.45, 0.2), body, 0, 0, 0);
    mesh(new THREE.BoxGeometry(width + 0.04, 0.02, 0.58), M('#7a4f33', 0.45), body, 0, -0.03, 0);
    const strip = (id: string, name: string, color: string, i: number, isMaster: boolean) => {
      const g = new THREE.Group();
      g.position.set(width / 2 - 0.08 - i * sw, 0.026, 0);
      body.add(g);
      // Fader slot (operator side is local -Z after the desk's 180 degree turn)
      mesh(new THREE.BoxGeometry(0.008, 0.002, 0.2), M('#111'), g, 0, 0.001, -0.14, false);
      const fader = new THREE.Group();
      g.add(fader);
      mesh(new THREE.BoxGeometry(0.045, 0.022, 0.025), M(isMaster ? '#c2412f' : '#e9e4da', 0.35), fader, 0, 0.012, 0);
      tag(fader, { kind: 'volume', trackId: isMaster ? 'master' : id, label: `${name} · volume` });
      const pan = new THREE.Group();
      pan.position.set(0, 0.0, 0.06);
      g.add(pan);
      mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.018, 16), M('#1c1b1f', 0.4), pan, 0, 0.009, 0);
      mesh(new THREE.BoxGeometry(0.003, 0.004, 0.012), M('#fff'), pan, 0, 0.019, 0.007, false);
      const btn = (c: string, x: number) => mesh(new THREE.BoxGeometry(0.022, 0.012, 0.018), new THREE.MeshStandardMaterial({ color: '#555', emissive: c, emissiveIntensity: 0, roughness: 0.5 }), g, x, 0.006, 0.11);
      const mute = btn('#ffcc33', -0.014);
      const solo = btn('#33aaff', 0.014);
      if (!isMaster) {
        tag(pan, { kind: 'pan', trackId: id, label: `${name} · pan` });
        tag(mute, { kind: 'mute', trackId: id, label: `${name} · mute` });
        tag(solo, { kind: 'solo', trackId: id, label: `${name} · solo` });
      } else {
        mute.visible = solo.visible = pan.visible = false;
      }
      const leds: THREE.Mesh[] = [];
      for (let l = 0; l < 8; l++) {
        const c = l > 6 ? '#ff4a3a' : l > 4 ? '#ffc23a' : '#58d68d';
        leds.push(mesh(new THREE.BoxGeometry(0.02, 0.006, 0.01), new THREE.MeshStandardMaterial({ color: '#222', emissive: c, emissiveIntensity: 0 }), g, 0, 0.004, 0.15 + l * 0.013, false));
      }
      const nameTex = label(name.slice(0, 8), { w: 160, h: 48, bg: color, fg: '#fff', size: 26 });
      const tagMesh = mesh(new THREE.PlaneGeometry(0.09, 0.027), new THREE.MeshStandardMaterial({ map: nameTex }), g, 0, 0.003, -0.255, false);
      tagMesh.rotation.x = -Math.PI / 2;
      tagMesh.rotation.z = Math.PI;
      this.strips.set(isMaster ? 'master' : id, { fader, pan, mute, solo, leds });
    };
    p.tracks.forEach((t, i) => strip(t.id, t.name, t.color, i, false));
    strip('master', 'Master', '#c2412f', p.tracks.length, true);
  }

  private refreshInteractables() {
    this.interactables.length = 0;
    this.root.traverse((o) => {
      if (o.userData.control && (o as THREE.Mesh).isMesh) this.interactables.push(o);
    });
  }

  // Per-frame: knob angles, LEDs, cable glow, console faders and meters.
  update(p: Project, beat: number, playing: boolean, level: (trackId?: string) => number, reduction: (trackId: string, fxId: string) => number) {
    const value = (t: Track | null, e: Effect, key: string) => {
      const lane = playing && t ? t.automation.find((l) => l.target === `fx:${e.id}:${key}`) : undefined;
      return (lane && automationValue(lane, beat)) ?? e.params[key];
    };
    const setKnobs = (t: Track | null, gear: PlacedGear[], fxList: readonly Effect[]) => {
      for (const g of gear) {
        const e = fxList.find((x) => x.id === g.fx.id) ?? g.fx;
        const spec = EFFECTS[e.type];
        for (const k of g.prop.knobs) {
          const ps = spec.params.find((x) => x.key === k.param)!;
          k.obj.rotation.y = knobRot(toNorm(ps, value(t, e, k.param)));
        }
        if (g.prop.led) (g.prop.led.material as THREE.MeshStandardMaterial).emissiveIntensity = e.enabled ? 2.5 : 0.05;
        if (g.prop.footswitch) g.prop.footswitch.position.y = e.enabled ? 0.041 : 0.037;
        if (g.prop.meter) g.prop.meter.rotation.z = 0.7 - Math.min(1.4, Math.abs(reduction(t?.id ?? 'master', e.id)) / 12);
      }
    };
    for (const t of p.tracks) {
      const sg = this.stations.get(t.id);
      if (!sg) continue;
      setKnobs(t, sg.gear, t.fx);
      sg.cableMat.emissiveIntensity = Math.min(1.5, level(t.id) * 2.5);
    }
    for (const mg of this.masterGear) {
      const fx = mg.owner === 'master' ? p.master.fx : p.buses.find((b) => b.id === mg.ownerId)?.fx ?? [];
      setKnobs(null, mg.gear, fx);
    }
    for (const [id, s] of this.strips) {
      const t = p.tracks.find((x) => x.id === id);
      const volLane = playing && t ? t.automation.find((l) => l.target === 'volume') : undefined;
      const vol = id === 'master' ? p.master.volume : ((volLane && automationValue(volLane, beat)) ?? t!.volume);
      s.fader.position.z = -0.23 + volumeToNorm(vol) * 0.18;
      if (t) {
        const panLane = playing ? t.automation.find((l) => l.target === 'pan') : undefined;
        s.pan.rotation.y = -((panLane && automationValue(panLane, beat)) ?? t.pan) * 2.3;
        (s.mute.material as THREE.MeshStandardMaterial).emissiveIntensity = t.mute ? 2 : 0;
        (s.solo.material as THREE.MeshStandardMaterial).emissiveIntensity = t.solo ? 2 : 0;
      }
      const lv = level(id === 'master' ? undefined : id);
      const lit = Math.round(Math.min(1, lv) * 8);
      s.leds.forEach((l, i) => ((l.material as THREE.MeshStandardMaterial).emissiveIntensity = i < lit ? 2.2 : 0));
    }
  }

  stationCenter(trackId: string) {
    return this.stations.get(trackId)?.group.position;
  }
}
