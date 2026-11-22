import { describe, expect, it } from 'vitest';
import { catalogDef } from '../../src/model/catalog';
import { fitCentre, fitResize, freeGaps, OPENING_PIER } from '../../src/model/openingFit';
import { defaultRoomStyle, openingsOfWall } from '../../src/model/rooms';
import { emptyDesign, normalizeDesign, Store } from '../../src/model/store';
import type { Design } from '../../src/model/types';

/** 6 m × 3 m room; wall 'c0' runs (0,0) → (6,0). */
function room(): Store {
  const d: Design = emptyDesign();
  d.rooms.push({
    id: 'r0',
    name: 'Room',
    corners: [
      { id: 'c0', x: 0, y: 0 },
      { id: 'c1', x: 6, y: 0 },
      { id: 'c2', x: 6, y: 3 },
      { id: 'c3', x: 0, y: 3 },
    ],
    style: defaultRoomStyle(),
    wallVisibility: {},
  });
  return new Store(normalizeDesign(d));
}

const door = catalogDef('door');
const win = catalogDef('window');

describe('openingFit (pure)', () => {
  it('free gaps leave a pier around every opening and the wall ends', () => {
    expect(freeGaps(6, [{ lo: 2, hi: 3 }])).toEqual([
      { lo: 0.05, hi: 2 - OPENING_PIER },
      { lo: 3 + OPENING_PIER, hi: 5.95 },
    ]);
  });

  it('fitCentre hops to the nearer free side, null when nothing is wide enough', () => {
    const gaps = freeGaps(6, [{ lo: 2, hi: 3 }]);
    expect(fitCentre(gaps, 1, 2.6)).toBeCloseTo(3.6); // nearer the right gap
    expect(fitCentre(gaps, 1, 2.4)).toBeCloseTo(1.4);
    expect(fitCentre(freeGaps(2, [{ lo: 0.6, hi: 1.4 }]), 1, 1)).toBeNull();
  });

  it('fitResize caps the width at its gap and grows toward the free side', () => {
    const gaps = freeGaps(6, [{ lo: 3, hi: 4 }]);
    const r = fitResize(gaps, 2, 2.5); // gap 0.05..2.9
    expect(r.width).toBeCloseTo(2);
    expect(r.offset + r.width / 2).toBeLessThanOrEqual(2.9 + 1e-9);
    expect(fitResize(gaps, 5, 2.5).width).toBeCloseTo(2.85);
  });
});

describe('store: openings never overlap', () => {
  it('a drag onto a neighbour stops beside it', () => {
    const s = room();
    const a = s.addOpening(win, 'c0', 2);
    const b = s.addOpening(door, 'c0', 4.5);
    s.updateOpening(b.id, { wallId: 'c0', offset: 2.2 });
    const gap = Math.abs(b.offset - a.offset) - (a.width + b.width) / 2;
    expect(gap).toBeGreaterThanOrEqual(OPENING_PIER - 1e-9);
  });

  it('a wider window grows away from its neighbour and stops at it', () => {
    const s = room();
    const d = s.addOpening(door, 'c0', 1);
    const w = s.addOpening(win, 'c0', 2.5);
    s.updateOpening(w.id, { width: 1.5 });
    expect(w.width).toBeCloseTo(1.5);
    expect(w.offset - w.width / 2 - (d.offset + d.width / 2)).toBeGreaterThanOrEqual(
      OPENING_PIER - 1e-9
    );
    s.updateOpening(w.id, { width: 10 });
    expect(w.offset - w.width / 2 - (d.offset + d.width / 2)).toBeGreaterThanOrEqual(
      OPENING_PIER - 1e-9
    );
  });

  it('a new opening aimed at an occupied spot slides clear; a full wall has no slot', () => {
    const s = room();
    s.addOpening(win, 'c0', 3);
    const n = s.addOpening(door, 'c0', 3);
    expect(Math.abs(n.offset - 3)).toBeGreaterThan(0.5);
    s.updateOpening(n.id, { width: 2.4 });
    expect(s.openingSlot('c0', 3, 3)).toBeNull();
  });

  it('a partition opening placed from the NON-owner side lands where it was aimed', () => {
    const s = room();
    s.addRoom({ against: { wallId: 'c1' }, d: 3 });
    const twin = s.allWalls().find((w) => w.shared && !w.shared.owner)!;
    const o = s.addOpening(door, twin.id, 1);
    const seen = openingsOfWall(s.design, twin).find((x) => x.id === o.id)!;
    expect(seen.offset).toBeCloseTo(1);
  });
});

describe('openingOverlap check', () => {
  it('flags an overlap that arrived in a file, and nothing once it is clear', async () => {
    const { runChecks } = await import('../../src/model/checks');
    const s = room();
    const a = s.addOpening(win, 'c0', 2);
    const b = s.addOpening(door, 'c0', 4);
    expect(runChecks(s.design).some((w) => w.kind === 'openingOverlap')).toBe(false);
    b.offset = 2.3; // as a file could hold it — no mutator in the way
    const w = runChecks(s.design).filter((x) => x.kind === 'openingOverlap');
    expect(w).toHaveLength(1);
    expect(w[0].severity).toBe('error');
    expect([a.id, b.id]).toContain(w[0].openingId);
  });
});
