import type { CommandRegistry } from '../commands/registry';
import { KEY_BINDINGS, matchBindings, type KeyBinding } from './bindings';

export interface KeyboardOptions {
  /** override for tests; defaults to the app table */
  bindings?: readonly KeyBinding[];
}

/**
 * The DOM adapter for the key map: it translates a `keydown` into a lookup in
 * the pure binding table and one `registry.execute()`. All of the decision-
 * making lives in those two — this class only owns a listener and its
 * lifecycle.
 *
 * It has exactly ONE gate of its own now: typing. The Part Studio's
 * "modal open" suppression went with the drafts it protected (WS-SPEC WP 3.1,
 * decision D2) — with live-apply there is no unsaved state a global key could
 * destroy, and Ctrl+Z in the Workshop is the feature rather than the hazard.
 * What the suppression really bought — not editing an invisible selection while
 * a workspace pane covers the canvases — is a `canExecute` precondition on the
 * commands that need it (`onCanvas` in commands/appCommands.ts), which is
 * per-command and therefore lets undo through.
 *
 * Same lifecycle contract the three views have carried since Phase A:
 * `attach(target)` is idempotent for the target it already holds (React
 * StrictMode mounts effects twice), and `dispose()` aborts the listener and can
 * be called repeatedly.
 */
export class KeyboardController {
  private readonly commands: CommandRegistry;
  private readonly bindings: readonly KeyBinding[];

  private target: EventTarget | null = null;
  private ac: AbortController | null = null;

  constructor(commands: CommandRegistry, opts: KeyboardOptions = {}) {
    this.commands = commands;
    this.bindings = opts.bindings ?? KEY_BINDINGS;
  }

  /** Listen on `target`. Re-attaching the SAME target is a no-op. */
  attach(target: EventTarget): void {
    if (this.target === target) return;
    this.detach();
    this.target = target;
    this.ac = new AbortController();
    target.addEventListener('keydown', this.onKeyDown as EventListener, {
      signal: this.ac.signal,
    });
    // capture phase: a field's own handlers may stop propagation
    target.addEventListener('input', markDirty, { signal: this.ac.signal, capture: true });
    target.addEventListener('change', markClean, { signal: this.ac.signal, capture: true });
    target.addEventListener('focusin', markClean, { signal: this.ac.signal, capture: true });
  }

  /** Release the listener; idempotent. */
  detach(): void {
    this.ac?.abort();
    this.ac = null;
    this.target = null;
  }

  /** Permanent teardown — same shape as the views', nothing extra to free. */
  dispose(): void {
    this.detach();
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const candidates = matchBindings(
      e.key.toLowerCase(),
      { mod: e.ctrlKey || e.metaKey, shift: e.shiftKey },
      this.bindings
    );

    // Table order is the priority, and a candidate that cannot run passes the
    // key on rather than swallowing it — that is what lets one key mean two
    // things in two contexts (Backspace: the wall tool's dimension box while a
    // ring is in flight, the selection at rest). The typing gate is evaluated
    // PER candidate for the same reason: a blocked row must not hide the one
    // below it.
    const typing = isTyping(e.target);
    for (const binding of candidates) {
      if (typing && !binding.allowWhileTyping) {
        if (!binding.allowWhenCommitted || isDirty(e.target)) continue;
        // the field keeps its text while focused (useSyncedValue never writes
        // into the active element), so it must let go before the model moves
        (e.target as Partial<HTMLElement>).blur?.();
      }

      // preventDefault only on a command that actually ran, so a binding whose
      // canExecute says no still reaches the browser (Ctrl+D with no selection)
      if (!this.commands.execute(binding.commandId)) continue;
      if (binding.preventDefault !== false) e.preventDefault();
      return;
    }
  };
}

/** input types that are not text entry: a focused toggle or slider must not eat R / Delete */
const NON_TEXT_INPUTS = new Set([
  'checkbox',
  'radio',
  'range',
  'button',
  'submit',
  'color',
  'file',
]);

function isTyping(target: EventTarget | null): boolean {
  return (
    (target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type)) ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

const DIRTY = 'kpDirty';

function datasetOf(target: EventTarget | null): DOMStringMap | undefined {
  return (target as Partial<HTMLElement> | null)?.dataset;
}

function markDirty(e: Event): void {
  const ds = datasetOf(e.target);
  if (ds) ds[DIRTY] = '1';
}

function markClean(e: Event): void {
  const ds = datasetOf(e.target);
  if (ds) delete ds[DIRTY];
}

/** typed into since its last commit (or since it took focus) */
function isDirty(target: EventTarget | null): boolean {
  return datasetOf(target)?.[DIRTY] === '1';
}
