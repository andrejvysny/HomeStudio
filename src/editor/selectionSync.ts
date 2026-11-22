/**
 * The ONE wire between the editor's selection and the store's lifetime.
 *
 * The selection moved off the Store in M18, so a delete can no longer clear it
 * inline. Instead: after every SETTLED change, whatever is held is re-checked
 * against the design. A wholesale swap to a DIFFERENT document (file load, New)
 * drops it outright; an undo/redo restore only prunes what no longer resolves.
 *
 * Transient ticks are skipped deliberately. A drag cannot delete anything, and
 * `entityExists` resolves a wall through `allWalls()` — far too much work to
 * repeat at pointer rate.
 *
 * `Store` arrives as a TYPE-only import (the same inversion commands/types.ts
 * uses), so src/editor still pulls no store runtime.
 */

import type { Store } from '../model/store';
import type { EditorState } from './editorState';

/** Returns a disposer that drops both subscriptions. */
export function syncSelection(store: Store, editor: EditorState): () => void {
  const offChange = store.on('change', (info) => {
    if (!info.transient) editor.pruneSelection((ref) => store.entityExists(ref));
  });
  // undo/redo keeps whatever still resolves (losing the selection made the
  // next R / arrow key silently do nothing); a different document clears it
  const offReset = store.on('reset', ({ kind }) => {
    if (kind === 'replace') editor.select({ kind: 'none' });
    else editor.pruneSelection((ref) => store.entityExists(ref));
  });
  return () => {
    offChange();
    offReset();
  };
}
