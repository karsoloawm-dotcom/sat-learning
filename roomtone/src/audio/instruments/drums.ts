import type { InstrumentParams } from '../../state/types';
import { type Instrument, type Voice, VoicePool, noiseBuffer } from './common';

// Synthesised drum kit on General MIDI note numbers. Every hit is built from oscillators and noise, so the
// kit costs no downloads and renders identically in the offline (export) context.

const TOMS: Record<number, number> = { 41: 82, 43: 98, 45: 115, 47: 138, 48: 165, 50: 196 };
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];

export class DrumKit implements Instrument {
  output: GainNode;
  private pool = new VoicePool();
  private openHat: { g: GainNode; srcs: AudioScheduledSourceNode[] } | null = null;
  private p: InstrumentParams;

  constructor(private ctx: BaseAudioContext, p: InstrumentParams) {
    this.output = ctx.createGain();
    this.p = p;
  }

  setParams(p: InstrumentParams) {
    this.p = p;
  }

  private get decayScale() {
    return this.p.preset === 'Tight Funk' ? 0.7 : this.p.preset === 'Big Room' ? 1.5 : 1;
  }

  private noise(t: number, dur: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = noiseBuffer(this.ctx);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur);
    return s;
  }

  private hitGain(t: number, peak: number, decay: number, dest: AudioNode = this.output) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
    g.connect(dest);
    return g;
  }

  private filter(type: BiquadFilterType, freq: number, q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  noteOn(t: number, pitch: number, vel: number): Voice {
    const ctx = this.ctx;
    const srcs: AudioScheduledSourceNode[] = [];
    const ds = this.decayScale;
    const tone = 0.5 + this.p.tone; // 0.5..1.5 brightness
    const v = vel * vel; // perceptual velocity curve
    let end = t + 0.5;

    const osc = (type: OscillatorType, f: number, dur: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      o.start(t);
      o.stop(t + dur);
      srcs.push(o);
      return o;
    };
    const metal = (dur: number, dest: AudioNode, base = 1) => {
      for (const f of METAL) osc('square', f * base, dur).connect(dest);
    };

    if (pitch === 35 || pitch === 36) {
      const dur = 0.5 * ds;
      const o = osc('sine', 160, dur);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
      o.connect(this.hitGain(t, 1.1 * v, dur));
      const click = this.noise(t, 0.02);
      srcs.push(click);
      const hp = this.filter('highpass', 1500 * tone);
      click.connect(hp).connect(this.hitGain(t, 0.35 * v, 0.02));
      end = t + dur;
    } else if (pitch === 38 || pitch === 40 || pitch === 37) {
      const rim = pitch === 37;
      const dur = (rim ? 0.05 : 0.24) * ds;
      const nz = this.noise(t, dur);
      srcs.push(nz);
      nz.connect(this.filter('bandpass', rim ? 1700 : 1900 * tone, rim ? 3 : 0.6)).connect(this.hitGain(t, (rim ? 0.6 : 0.75) * v, dur));
      const o = osc('triangle', rim ? 400 : 190, dur);
      o.frequency.exponentialRampToValueAtTime(rim ? 380 : 150, t + 0.08);
      o.connect(this.hitGain(t, 0.55 * v, rim ? 0.03 : 0.12));
      end = t + dur;
    } else if (pitch === 39) {
      const g = this.hitGain(t + 0.02, 0.8 * v, 0.22 * ds);
      const bp = this.filter('bandpass', 1200, 0.8);
      bp.connect(g);
      for (let i = 0; i < 3; i++) {
        const nz = this.noise(t + i * 0.011, 0.01);
        srcs.push(nz);
        nz.connect(bp);
      }
      const tail = this.noise(t + 0.033, 0.2 * ds);
      srcs.push(tail);
      tail.connect(bp);
      end = t + 0.3;
    } else if (pitch === 42 || pitch === 44 || pitch === 46) {
      // Closed and pedal hats choke a ringing open hat.
      if (this.openHat) {
        this.openHat.g.gain.cancelScheduledValues(t);
        this.openHat.g.gain.setTargetAtTime(0, t, 0.01);
        for (const s of this.openHat.srcs) try { s.stop(t + 0.08); } catch { /* done */ }
        this.openHat = null;
      }
      const dur = (pitch === 46 ? 0.45 : pitch === 44 ? 0.04 : 0.07) * ds;
      const g = this.hitGain(t, (pitch === 44 ? 0.25 : 0.38) * v, dur);
      const hp = this.filter('highpass', 7000 * tone);
      const bp = this.filter('bandpass', 10000, 0.8);
      bp.connect(hp).connect(g);
      metal(dur, bp);
      const nz = this.noise(t, dur);
      srcs.push(nz);
      nz.connect(hp);
      if (pitch === 46) this.openHat = { g, srcs };
      end = t + dur;
    } else if (TOMS[pitch]) {
      const f = TOMS[pitch];
      const dur = 0.45 * ds;
      const o = osc('sine', f * 1.6, dur);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
      o.connect(this.hitGain(t, 0.9 * v, dur));
      const nz = this.noise(t, 0.05);
      srcs.push(nz);
      nz.connect(this.filter('lowpass', 2500)).connect(this.hitGain(t, 0.2 * v, 0.05));
      end = t + dur;
    } else if (pitch === 49 || pitch === 57 || pitch === 51 || pitch === 53) {
      const ride = pitch === 51 || pitch === 53;
      const dur = (ride ? 1.4 : 2.2) * ds;
      const g = this.hitGain(t, (ride ? 0.22 : 0.4) * v, dur);
      const hp = this.filter('highpass', (ride ? 5000 : 3500) * tone);
      hp.connect(g);
      const bp = this.filter('bandpass', ride ? 8000 : 6000, 0.5);
      bp.connect(hp);
      metal(dur, bp, ride ? 1.2 : 1);
      const nz = this.noise(t, dur);
      srcs.push(nz);
      nz.connect(hp);
      if (pitch === 53) osc('sine', 2400, 0.6).connect(this.hitGain(t, 0.12 * v, 0.6));
      end = t + dur;
    } else if (pitch === 56) {
      const g = this.hitGain(t, 0.35 * v, 0.3);
      const bp = this.filter('bandpass', 800, 2);
      bp.connect(g);
      osc('square', 540, 0.3).connect(bp);
      osc('square', 800, 0.3).connect(bp);
      end = t + 0.3;
    } else {
      // Unmapped pitches get a short percussive blip so nothing is silently dropped.
      const o = osc('triangle', 200 + (pitch % 12) * 40, 0.12);
      o.connect(this.hitGain(t, 0.4 * v, 0.12));
      end = t + 0.12;
    }

    const voice: Voice = {
      release: () => {},
      stop: (time?: number) => {
        const now = time ?? ctx.currentTime;
        for (const s of srcs) try { s.stop(now + 0.02); } catch { /* done */ }
      },
    };
    return this.pool.add(voice, end, ctx);
  }

  allNotesOff(time: number) {
    this.pool.stopAll(time);
    this.openHat = null;
  }

  dispose() {
    this.output.disconnect();
  }
}
