import { describe, expect, it } from 'vitest';
import { defaultRoomStyle } from '../../src/model/rooms';
import { rotationFromInward } from '../../src/model/snapping';
import { emptyDesign, normalizeDesign, Store } from '../../src/model/store';
import type { Design } from '../../src/model/types';

/** 4 m × 3 m room. Walls: c0 top (0,0)→(4,0), c1 right (4,0)→(4,3). */
function room(): Store {
  const d: Design = emptyDesign();
  d.rooms.push({
    id: 'r0',
    name: 'Room',
    corners: [
      { id: 'c0', x: 0, y: 0 },
      { id: 'c1', x: 4, y: 0 },
      { id: 'c2', x: 4, y: 3 },
      { id: 'c3', x: 0, y: 3 },
    ],
    style: defaultRoomStyle(),
    wallVisibility: {},
  });
  return new Store(normalizeDesign(d));
}

/** an item placed back-against the right wall, the way snapItem seats it */
function onRightWall(s: Store, y: number, defId = 'base-cabinet') {
  const w = s.wallById('c1')!;
  const it = s.addItem(s.defOf(defId), 0, 0, rotationFromInward(w.inward));
  s.updateItem(it.id, { x: 4 - w.faceOffset - it.d / 2, y });
  return s.itemById(it.id)!;
}

describe('wall-mounted items follow their wall', () => {
  it('a typed wall length carries the items on the moved wall', () => {
    const s = room();
    const it = onRightWall(s, 1.5);
    const sock = onRightWall(s, 2.4, 'outlet');
    const x0 = it.x;
    s.setWallLength('c0', 4.5); // the right wall moves +0.5 in x
    expect(s.itemById(it.id)!.x).toBeCloseTo(x0 + 0.5);
    expect(s.itemById(it.id)!.y).toBeCloseTo(1.5);
    expect(s.itemById(sock.id)!.x).toBeCloseTo(4.5 - s.itemById(sock.id)!.d / 2, 3);
  });

  it('a corner drag rotates the wall and the item turns with it', () => {
    const s = room();
    const it = onRightWall(s, 1.5);
    s.moveCorner('c2', 5, 3, false); // right wall now leans
    const w = s.wallById('c1')!;
    const moved = s.itemById(it.id)!;
    expect(moved.rotation).toBeCloseTo(rotationFromInward(w.inward));
    // still flush: back on the face, measured from the unmoved start corner
    const t = (moved.x - w.a.x) * w.dir.x + (moved.y - w.a.y) * w.dir.y;
    expect(t).toBeCloseTo(1.5, 1);
  });

  it('items away from the edited walls stay put', () => {
    const s = room();
    const free = s.addItem(s.defOf('base-cabinet'), 2, 1.5, 0);
    s.setWallLength('c0', 5);
    expect(s.itemById(free.id)!.x).toBeCloseTo(2);
  });
});

describe('partition corners move in every room', () => {
  it('a wall-length edit stretches the neighbour instead of tearing the partition', () => {
    const s = room();
    const next = s.addRoom({ against: { wallId: 'c2' }, d: 2 })!; // below, shares the bottom wall
    const sharedBefore = s.allWalls().filter((w) => w.shared).length;
    expect(sharedBefore).toBe(2);
    s.setWallLength('c0', 4.6);
    const after = s.allWalls().filter((w) => w.shared);
    expect(after).toHaveLength(2);
    const xs = s.design.rooms.find((r) => r.id === next.id)!.corners.map((k) => k.x);
    expect(Math.max(...xs)).toBeCloseTo(4.6);
  });

  it('dragging a shared corner drags it in both rings', () => {
    const s = room();
    s.addRoom({ against: { wallId: 'c2' }, d: 2 });
    s.moveCorner('c2', 4.3, 3, false);
    expect(s.allWalls().filter((w) => w.shared)).toHaveLength(2);
  });
});

describe('placement snaps to a wall the cursor is NEAR, however near', () => {
  it('a cursor between the snapped centre and the wall face still snaps flush', async () => {
    const { snapItem } = await import('../../src/model/snapping');
    const s = room();
    const def = s.defOf('sofa');
    const w = s.wallById('c1')!;
    // 5 cm off the right wall face — closer than the sofa's half depth
    const r = snapItem(s, def, null, 4 - w.faceOffset - 0.05, 1.5, 0);
    expect(r.rotation).toBeCloseTo(rotationFromInward(w.inward));
    expect(r.x).toBeCloseTo(4 - w.faceOffset - def.d / 2);
  });
});

describe('keepInsideWalls', () => {
  it('a turned item that swung into a wall is pushed back out flush', async () => {
    const { keepInsideWalls } = await import('../../src/model/wallFollow');
    const s = room();
    const it = s.addItem(s.defOf('base-cabinet'), 0, 0, 0);
    s.updateItem(it.id, { w: 2, d: 0.6, x: 3.5, y: 1.5, rotation: 0 });
    const item = s.itemById(it.id)!;
    keepInsideWalls(s.design, item); // 2 m long now runs across x: 2.5..4.5
    expect(item.x + 1).toBeLessThanOrEqual(4 + 1e-6);
    expect(item.x + 1).toBeCloseTo(4 - s.wallById('c1')!.faceOffset);
  });
});

describe('typed width keeps the touching edge', () => {
  it('a unit in the corner shrinks away from the open side, not from both', () => {
    const s = room();
    const w = s.wallById('c1')!; // right wall runs y 0 → 3
    const it = onRightWall(s, 0.3); // 60 cm unit flush in the top corner
    expect(it.y - it.w / 2).toBeCloseTo(0);
    s.updateItem(it.id, { w: 0.4 });
    const after = s.itemById(it.id)!;
    expect(after.y - after.w / 2).toBeCloseTo(0); // still in the corner
    expect(Math.abs(after.x - (4 - w.faceOffset - after.d / 2))).toBeLessThan(1e-6);
  });

  it('a free-standing unit still resizes about its centre', () => {
    const s = room();
    const it = s.addItem(s.defOf('base-cabinet'), 2, 1.5, 0);
    s.updateItem(it.id, { w: 1 });
    expect(s.itemById(it.id)!.x).toBeCloseTo(2);
  });
});
