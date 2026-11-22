import { describe, expect, it } from 'vitest';
import { pointInPolygon } from '../../src/model/geometry';
import { insideView } from '../../src/view3d/view3d';

describe('insideView', () => {
  it('stands inside an L-shaped room whose centroid is outside it', () => {
    // L: the centroid of this ring falls in the notch
    const ring = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 6 },
      { x: 0, y: 6 },
    ];
    const v = insideView(ring);
    expect(pointInPolygon(v.eye, ring)).toBe(true);
    // looks down one of the two long arms
    expect(Math.hypot(v.look.x - v.eye.x, v.look.y - v.eye.y)).toBeGreaterThan(3);
  });
});
