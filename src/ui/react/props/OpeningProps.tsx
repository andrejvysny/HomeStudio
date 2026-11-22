import type { ReactElement } from 'react';
import { useStore } from '../services';
import { ChoiceRow } from '../fields/ChoiceRow';
import { LengthField } from '../fields/LengthField';

const HINGE: readonly (readonly [string, string])[] = [
  ['left', 'Hinge left'],
  ['right', 'Hinge right'],
];

const SWING: readonly (readonly [string, string])[] = [
  ['in', 'Opens in'],
  ['out', 'Opens out'],
];

const KIND: readonly (readonly [string, string])[] = [
  ['door', 'Door'],
  ['window', 'Window'],
];

/**
 * A selected door or window — src/ui/ui.ts's renderOpeningProps.
 *
 * Position is given as the two GAPS between the opening's edges and the wall
 * ends — the same numbers the plan's dimension lines show — named left/right
 * as seen from inside the room facing the wall. (It used to be "From corner",
 * the centre offset from an unnamed corner, which never matched the plan.)
 * The left gap is `live`: it follows a plan drag through the 'transient'
 * channel without re-rendering the panel.
 */
export function OpeningProps({ id }: { id: string }): ReactElement | null {
  const store = useStore();
  const o = store.openingById(id);
  if (!o) return null;
  const wall = store.wallById(o.wallId);
  const one = [o];
  // facing the wall from inside, is its START on the viewer's left?
  const startOnLeft = wall ? wall.inward.y * wall.dir.x - wall.inward.x * wall.dir.y > 0 : true;
  const len = wall?.len ?? 0;
  const gapStart = (x: typeof o): number => x.offset - x.width / 2;
  const gapEnd = (x: typeof o): number => len - x.offset - x.width / 2;
  const setGapStart = (m: number): void => store.updateOpening(id, { offset: m + o.width / 2 });
  const setGapEnd = (m: number): void => store.updateOpening(id, { offset: len - m - o.width / 2 });

  return (
    <>
      <h2 className="props-title">{o.type === 'door' ? 'Door' : 'Window'}</h2>
      <p className="props-sub">Drag it along the wall in the plan, or type the gaps below</p>

      <div className="prop-section">
        <div className="prop-section-title">Size</div>
        <ChoiceRow
          options={KIND}
          current={o.type}
          onPick={(v) => {
            // a door stands on the floor; a window keeps its sill (0 = French window)
            store.updateOpening(id, v === 'door' ? { type: 'door', sill: 0 } : { type: 'window' });
          }}
        />
        <LengthField
          label="Width"
          items={one}
          read={(x) => x.width}
          onCommit={(m) => store.updateOpening(id, { width: m })}
          min={0.3}
          max={4}
        />
        <LengthField
          label="Height"
          items={one}
          read={(x) => x.height}
          onCommit={(m) => store.updateOpening(id, { height: m })}
          min={0.3}
          max={3}
        />
        {o.type === 'window' ? (
          <LengthField
            label="Sill height"
            items={one}
            read={(x) => x.sill}
            onCommit={(m) => store.updateOpening(id, { sill: m })}
            min={0}
            max={2.5}
          />
        ) : null}
        {wall ? (
          <>
            <LengthField
              label="Gap left"
              items={one}
              read={startOnLeft ? gapStart : gapEnd}
              onCommit={startOnLeft ? setGapStart : setGapEnd}
              min={0}
              max={wall.len}
              cls="opening-off"
              live
            />
            <LengthField
              label="Gap right"
              items={one}
              read={startOnLeft ? gapEnd : gapStart}
              onCommit={startOnLeft ? setGapEnd : setGapStart}
              min={0}
              max={wall.len}
              cls="opening-off-end"
              live
            />
          </>
        ) : null}
      </div>

      {o.type === 'door' ? (
        <div className="prop-section">
          <div className="prop-section-title">Swing</div>
          <ChoiceRow
            options={HINGE}
            current={o.hinge ?? 'left'}
            onPick={(v) => store.updateOpening(id, { hinge: v as 'left' | 'right' })}
          />
          <ChoiceRow
            options={SWING}
            current={o.swing ?? 'in'}
            onPick={(v) => store.updateOpening(id, { swing: v as 'in' | 'out' })}
          />
        </div>
      ) : null}

      <div className="prop-section">
        <div className="prop-section-title">Actions</div>
        <div className="btn-row">
          <button
            className="btn danger"
            onClick={() => {
              store.deleteOpening(id);
              store.commit();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
