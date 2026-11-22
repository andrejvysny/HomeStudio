import { useEffect, useId, useRef, type ReactElement } from 'react';
import { useStore } from '../services';
import { useNativeChange } from './useNativeChange';

export interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  /** one line under the row saying what the switch actually does */
  hint?: string;
}

/**
 * The switch row — src/ui/ui.ts's toggleRow: `.toggle-row` > label +
 * `label.switch` > checkbox + `span.track` (the track is what style.css draws;
 * the checkbox itself is visually hidden).
 *
 * A checkbox is one of the cases where React's onChange IS the native change
 * event, but it goes through useNativeChange anyway: one commit rule, one
 * place to read it, and the eslint rule stays free of per-type exceptions.
 */
export function ToggleRow({ label, value, onChange, hint }: ToggleRowProps): ReactElement {
  const store = useStore();
  const box = useRef<HTMLInputElement>(null);
  const id = useId();

  // `defaultChecked` is a mount-only prop, so mirror later model changes (undo,
  // an edit from elsewhere). Unlike a text field there is no half-typed value
  // to protect, so a FOCUSED switch is synced too — otherwise Ctrl+Z right
  // after clicking it left the switch showing the undone state.
  useEffect(() => {
    const el = box.current;
    if (el) el.checked = value;
  });

  useNativeChange(box, (el) => {
    onChange(el.checked);
    store.commit();
  });

  const row = (
    <div className="toggle-row">
      {/* the text label toggles too — the switch alone is a small target */}
      <label htmlFor={id}>{label}</label>
      <label className="switch">
        <input id={id} type="checkbox" defaultChecked={value} ref={box} />
        <span className="track"></span>
      </label>
    </div>
  );
  if (!hint) return row;
  return (
    <>
      {row}
      <div className="prop-hint">{hint}</div>
    </>
  );
}
