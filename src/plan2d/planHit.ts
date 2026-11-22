/**
 * What a point in the plan is over, as a value.
 *
 * `Plan2D.hitAt()` is the only producer: it runs the SAME private hit testers
 * `onPointerDown` runs, in the same order minus the drag handles (corner /
 * rotate / wall-bend), and reports the answer instead of starting a gesture.
 * Nothing here re-derives geometry.
 *
 * The type lives in its own module so the menu model (src/ui/contextMenuModel.ts)
 * can import it without importing Plan2D itself — and so the dependency keeps
 * pointing the sanctioned way, ui → plan2d, never back.
 */
export type ContextHit =
  /** a placed item — the topmost of the stack under the point */
  | { kind: 'item'; itemId: string }
  /**
   * a wall. `t` is the click's distance from the wall's START corner, in METRES —
   * exactly what `store.splitWall(wallId, t)` takes, not a 0..1 fraction.
   */
  | { kind: 'wall'; wallId: string; t: number }
  /**
   * a door or window. `wallId`/`t` are its host wall and the click along it,
   * so a wall-level fallback stays possible.
   */
  | { kind: 'opening'; openingId: string; wallId: string; t: number }
  /** bare floor inside a room's polygon */
  | { kind: 'room'; roomId: string }
  /** outside every room, and over nothing modelled */
  | { kind: 'empty' };
