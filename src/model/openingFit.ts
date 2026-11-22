/**
 * Openings may not overlap each other on a wall. Pure helpers shared by the
 * store's opening mutators (placement, drag, inspector resize) and the
 * `openingOverlap` check that flags files which already contain overlaps.
 *
 * Positions are measured along the wall from its start corner, exactly like
 * `Opening.offset` (the opening's CENTRE). Partition twins arrive mirrored via
 * `openingsOfWall`, so a door on the other side of a shared wall counts too.
 */

import { openingsOfWall, type RoomWall } from './rooms';
import type { Design } from './types';

/** Minimum solid wall left between two openings (m). */
export const OPENING_PIER = 0.1;
/** Matches `clampOpeningTo`: an opening keeps this much wall at each end. */
const WALL_END = 0.05;
const EPS = 1e-6;

export interface Span {
  lo: number;
  hi: number;
}

/** Jamb-to-jamb extents of every OTHER opening on `wall`, sorted along it. */
export function occupiedSpans(design: Design, wall: RoomWall, exceptId?: string): Span[] {
  return openingsOfWall(design, wall)
    .filter((o) => o.id !== exceptId)
    .map((o) => ({ lo: o.offset - o.width / 2, hi: o.offset + o.width / 2 }))
    .sort((a, b) => a.lo - b.lo);
}

/** The stretches of a wall of length `len` an opening's jambs may occupy. */
export function freeGaps(len: number, spans: Span[], pier = OPENING_PIER): Span[] {
  const out: Span[] = [];
  let cursor = WALL_END;
  for (const s of spans) {
    if (s.lo - pier > cursor + EPS) out.push({ lo: cursor, hi: s.lo - pier });
    cursor = Math.max(cursor, s.hi + pier);
  }
  if (len - WALL_END > cursor + EPS) out.push({ lo: cursor, hi: len - WALL_END });
  return out;
}

const clampTo = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Centre nearest `want` at which an opening of `width` overlaps nothing, or
 * null when no gap is wide enough. Dragging through a neighbour therefore
 * hops to whichever side is nearer instead of stacking on it.
 */
export function fitCentre(gaps: Span[], width: number, want: number): number | null {
  let best: number | null = null;
  for (const g of gaps) {
    if (g.hi - g.lo < width - EPS) continue;
    const c = clampTo(want, g.lo + width / 2, g.hi - width / 2);
    if (best === null || Math.abs(c - want) < Math.abs(best - want)) best = c;
  }
  return best;
}

/**
 * A resize stays inside the gap holding the opening's centre: the width is
 * capped at the gap, and the centre slides so the opening grows toward the
 * free side instead of into its neighbour.
 */
export function fitResize(
  gaps: Span[],
  width: number,
  centre: number
): { width: number; offset: number } {
  const dist = (g: Span): number =>
    centre < g.lo ? g.lo - centre : centre > g.hi ? centre - g.hi : 0;
  let gap: Span | undefined;
  for (const g of gaps) if (!gap || dist(g) < dist(gap)) gap = g;
  if (!gap) return { width, offset: centre };
  const w = Math.min(width, gap.hi - gap.lo);
  return { width: w, offset: clampTo(centre, gap.lo + w / 2, gap.hi - w / 2) };
}

/** Pairs of openings on one wall whose leaves overlap (ids, sorted). */
export function overlappingOpenings(design: Design, wall: RoomWall): [string, string][] {
  const os = openingsOfWall(design, wall);
  const out: [string, string][] = [];
  for (let i = 0; i < os.length; i++) {
    for (let j = i + 1; j < os.length; j++) {
      const a = os[i];
      const b = os[j];
      const gap = Math.abs(a.offset - b.offset) - (a.width + b.width) / 2;
      if (gap < -0.005) out.push([a.id, b.id].sort() as [string, string]);
    }
  }
  return out;
}
