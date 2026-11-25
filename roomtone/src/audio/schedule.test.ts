import { describe, expect, it } from 'vitest';
import { demoProject } from '../state/defaults';
import { ProjectStore } from '../state/store';
import { automationValue, notesInRange } from './schedule';

describe('notesInRange', () => {
  it('loops a pattern across a longer clip and respects clip bounds', () => {
    const p = structuredClone(demoProject());
    const keys = p.tracks[3];
    const pat = p.patterns[keys.clips[0].patternId!];
    const perLoop = pat.notes.length;
    const all = notesInRange(p, 0, 64).filter((n) => n.trackId === keys.id);
    expect(all.length).toBe(perLoop * 4); // 64-beat clip of a 16-beat pattern
    expect(notesInRange(p, 16, 32).filter((n) => n.trackId === keys.id).length).toBe(perLoop);
    // Drums start at beat 8: nothing before.
    expect(notesInRange(p, 0, 8).some((n) => n.trackId === p.tracks[0].id)).toBe(false);
  });

  it('splits ranges without dropping or duplicating notes', () => {
    const p = demoProject();
    const whole = notesInRange(p, 0, 64).length;
    let parts = 0;
    for (let b = 0; b < 64; b += 0.37) parts += notesInRange(p, b, Math.min(64, b + 0.37)).length;
    expect(parts).toBe(whole);
  });

  it('honours clip offset', () => {
    const p = structuredClone(demoProject());
    const t = p.tracks[3];
    t.clips[0].offset = 4;
    t.clips[0].length = 4;
    const pat = p.patterns[t.clips[0].patternId!];
    const expected = pat.notes.filter((n) => n.start >= 4 && n.start < 8).length;
    expect(notesInRange(p, 0, 64).filter((n) => n.trackId === t.id).length).toBe(expected);
  });
});

describe('automationValue', () => {
  it('interpolates linearly and clamps at ends', () => {
    const lane = { id: 'a', target: 'volume', enabled: true, points: [{ t: 0, v: 0 }, { t: 4, v: -12 }] };
    expect(automationValue(lane, -1)).toBe(0);
    expect(automationValue(lane, 2)).toBe(-6);
    expect(automationValue(lane, 9)).toBe(-12);
  });
});

describe('ProjectStore', () => {
  it('undoes, redoes and coalesces gestures', () => {
    const s = new ProjectStore(demoProject());
    const v0 = s.get().bpm;
    s.update('tempo', (d) => void (d.bpm = 100));
    s.update('tempo', (d) => void (d.bpm = 101), { coalesce: 'bpm' });
    s.update('tempo', (d) => void (d.bpm = 102), { coalesce: 'bpm' });
    s.undo();
    expect(s.get().bpm).toBe(100);
    s.undo();
    expect(s.get().bpm).toBe(v0);
    s.redo();
    expect(s.get().bpm).toBe(100);
    s.update('drag', (d) => void (d.tracks[0].volume = -20), { history: 'none' });
    s.update('drag', (d) => void (d.tracks[0].volume = -10), { history: 'none' });
    s.commitGesture('drag');
    s.undo();
    expect(s.get().tracks[0].volume).toBe(-5);
  });
});
