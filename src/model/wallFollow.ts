/**
 * Things mounted on a wall move WITH the wall. Pure.
 *
 * A wall edit (corner drag, typed wall length) used to leave every outlet and
 * every wall-snapped cabinet standing where the wall had been — floating in
 * the room or buried in the slab. The store now captures, before the edit,
 * which items stand back-against which wall (`hugWall`, the same test
 * fit-to-room uses) and re-seats them on the edited wall afterwards.
 *
 * Position along the wall is kept from whichever end did NOT move, so
 * stretching a wall from its far end leaves the items near its start alone.
 */

import { hugWall, wallFreeSegments } from './fit';
import { projectOnWall, rot, wallPoint } from './geometry';
import { allWalls, roomOfItem, wallsOf } from './rooms';
import { rotationFromInward } from './snapping';
import type { Design, Item, Point } from './types';

export interface WallAnchor {
  itemId: string;
  wallId: string;
  /** distance along the wall of the item's centre, before the edit */
  t: number;
  a: Point;
  b: Point;
  len: number;
}

const SAME = 1e-6;
const same = (p: Point, q: Point): boolean =>
  Math.abs(p.x - q.x) < SAME && Math.abs(p.y - q.y) < SAME;

/** Every free-standing item that stands back-against a wall right now. */
export function captureWallAnchors(design: Design): WallAnchor[] {
  const out: WallAnchor[] = [];
  for (const item of design.items) {
    if (item.attach) continue; // hosted appliances follow their host instead
    const hug = hugWall(design, item);
    if (!hug) continue;
    const { wall } = hug;
    out.push({
      itemId: item.id,
      wallId: wall.id,
      t: hug.t,
      a: { ...wall.a },
      b: { ...wall.b },
      len: wall.len,
    });
  }
  return out;
}

/** Re-seat anchored items on their (edited) walls; untouched walls are skipped. */
export function applyWallAnchors(design: Design, anchors: WallAnchor[]): void {
  if (!anchors.length) return;
  const walls = new Map(allWalls(design.rooms).map((w) => [w.id, w]));
  for (const an of anchors) {
    const item = design.items.find((i) => i.id === an.itemId);
    const w = walls.get(an.wallId);
    if (!item || !w) continue;
    const aSame = same(w.a, an.a);
    const bSame = same(w.b, an.b);
    if (aSame && bSame) continue;
    const t = Math.min(w.len, Math.max(0, !aSame && bSame ? w.len - (an.len - an.t) : an.t));
    const p = wallPoint(w, t);
    const off = w.faceOffset + item.d / 2;
    item.x = p.x + w.inward.x * off;
    item.y = p.y + w.inward.y * off;
    item.rotation = rotationFromInward(w.inward);
  }
}

/**
 * Push an item back out of the walls of its own room, along each wall's
 * inward normal. Rotating a bed that stood against a wall swings half of it
 * into the slab; this lands it flush again instead. Mutates `item`.
 */
export function keepInsideWalls(design: Design, item: Item): void {
  const room = roomOfItem(design, item);
  if (!room) return;
  const local = [
    { x: -item.w / 2, y: -item.d / 2 },
    { x: item.w / 2, y: -item.d / 2 },
    { x: item.w / 2, y: item.d / 2 },
    { x: -item.w / 2, y: item.d / 2 },
  ];
  for (let pass = 0; pass < 2; pass++) {
    for (const wall of wallsOf(design.rooms, room.id)) {
      let worst = 0;
      for (const l of local) {
        const r = rot(l, item.rotation);
        const pr = projectOnWall(wall, { x: item.x + r.x, y: item.y + r.y });
        if (pr.t < 0 || pr.t > wall.len) continue;
        // only what crossed the face from inside: a corner far behind the
        // wall belongs to a different stretch of the room, not this slab
        const depth = wall.faceOffset - pr.side;
        if (depth > worst && depth < wall.thickness + item.d) worst = depth;
      }
      if (worst > 1e-6) {
        item.x += wall.inward.x * worst;
        item.y += wall.inward.y * worst;
      }
    }
  }
}

/** how close an edge must sit to whatever bounds it to count as touching (m) */
const TOUCH = 0.02;

/**
 * A typed width change on an item standing against a wall keeps the edge
 * that TOUCHES something (a wall end, a neighbouring unit, a door) where it
 * is, instead of growing or shrinking from the centre and pulling away from
 * both sides. Returns the centre shift, or null to resize about the centre
 * (free-standing, or touching nothing). Both edges touching keeps the edge
 * nearer the wall's start.
 */
export function anchoredResizeShift(design: Design, item: Item, newW: number): Point | null {
  const hug = hugWall(design, item);
  if (!hug) return null;
  const segs = wallFreeSegments(design, hug.wall, {
    exceptId: item.id,
    elevation: item.elevation,
    height: item.h,
  });
  const lo = hug.t - item.w / 2;
  const hi = hug.t + item.w / 2;
  const seg = segs.find((g) => g.t0 - TOUCH <= hug.t && hug.t <= g.t1 + TOUCH);
  if (!seg) return null;
  const touchLo = Math.abs(lo - seg.t0) < TOUCH;
  const touchHi = Math.abs(hi - seg.t1) < TOUCH;
  if (!touchLo && !touchHi) return null;
  const shift = ((newW - item.w) / 2) * (touchLo ? 1 : -1);
  return { x: hug.wall.dir.x * shift, y: hug.wall.dir.y * shift };
}
