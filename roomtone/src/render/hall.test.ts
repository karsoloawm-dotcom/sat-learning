import { describe, expect, it } from 'vitest';
import { hallFloorY, HALL_STATIONS } from './hall';

describe('hall floor heights', () => {
  it('stalls, stage, risers and choir steps', () => {
    expect(hallFloorY(0, 5)).toBe(0); // stalls
    expect(hallFloorY(0, -3)).toBeCloseTo(0.55); // stage
    expect(hallFloorY(0, -7)).toBeCloseTo(0.8); // first riser
    expect(hallFloorY(0, -9)).toBeCloseTo(1.05);
    expect(hallFloorY(0, -10.5)).toBeCloseTo(1.3);
    expect(hallFloorY(0, -11.5)).toBeCloseTo(1.65); // first choir step
    expect(hallFloorY(8.0, -7)).toBeCloseTo(0.55); // beside the riser
  });
  it('every station stands on the floor it is placed over', () => {
    for (const s of HALL_STATIONS) expect(s.pos.y).toBeCloseTo(hallFloorY(s.pos.x, s.pos.z));
  });
});
