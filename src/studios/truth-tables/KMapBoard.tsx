import { useRef, useState } from "react";
import { cellMinterm, describeImplicant, headerBits, kmapLayout } from "../../engines/kmap/map";
import { maskToMinterms } from "../../engines/kmap/quine";
import type { Cell } from "./logic";

const COLORS = ["#16a34a", "#2f6fed", "#7c3aed", "#b54708", "#0f766e"];

export function KMapBoard({
  names,
  cells,
  groups,
  hover,
  activeMask,
  manual,
  onHover,
  onCycle,
  onTogglePick,
  onCreate,
  groupError,
}: {
  names: string[];
  cells: Cell[];
  groups: string[];
  hover: number | null;
  activeMask: string | null;
  manual: boolean;
  onHover: (index: number | null) => void;
  onCycle: (index: number) => void;
  onTogglePick: (index: number) => void;
  onCreate: (indexes: number[]) => void;
  groupError: string;
}) {
  const layout = kmapLayout(names.length);
  const [drag, setDrag] = useState<number[] | null>(null);
  const dragRef = useRef<number[] | null>(null);
  const shown = activeMask ? [activeMask] : groups;

  function setDragBoth(indexes: number[] | null) {
    dragRef.current = indexes;
    setDrag(indexes);
  }

  function finish() {
    const indexes = dragRef.current ?? [];
    setDragBoth(null);
    if (indexes.length > 1) onCreate(indexes);
  }

  return (
    <div className="twb-maps">
      {Array.from({ length: layout.maps }, (_, map) => (
        <MapPlane
          key={map}
          names={names}
          cells={cells}
          map={map}
          groups={shown}
          hover={hover}
          drag={drag}
          manual={manual}
          onHover={onHover}
          onCycle={onCycle}
          onTogglePick={onTogglePick}
          onDrag={setDragBoth}
          onFinish={finish}
        />
      ))}
      {groupError ? <p className="cwb-error" role="status">{groupError}</p> : null}
      {activeMask ? <GroupNote mask={activeMask} names={names} cells={cells} /> : null}
    </div>
  );
}

function MapPlane({
  names, cells, map, groups, hover, drag, manual, onHover, onCycle, onTogglePick, onDrag, onFinish,
}: {
  names: string[];
  cells: Cell[];
  map: number;
  groups: string[];
  hover: number | null;
  drag: number[] | null;
  manual: boolean;
  onHover: (index: number | null) => void;
  onCycle: (index: number) => void;
  onTogglePick: (index: number) => void;
  onDrag: (indexes: number[] | null) => void;
  onFinish: () => void;
}) {
  const layout = kmapLayout(names.length);
  const rowHeads = headerBits(layout.rowBits);
  const colHeads = headerBits(layout.colBits);
  const rowVars = names.slice(0, layout.rowBits).join("") || names[0];
  const colVars = names.slice(layout.rowBits, layout.rowBits + layout.colBits).join("");
  const planes = Math.max(0, names.length - layout.rowBits - layout.colBits);
  const plane = planes > 0 ? names.slice(-planes).map((name, bit) => `${name} = ${(map >> (planes - 1 - bit)) & 1}`).join(", ") : "";

  return (
    <div className="twb-map-wrap">
      {plane ? <p className="twb-plane">{plane} = {map}</p> : null}
      <span className="ttx-axis">{colVars}</span>
      <table className="ttx-map">
        <thead>
          <tr><th>{rowVars}</th>{colHeads.map((head) => <th key={head}>{head}</th>)}</tr>
        </thead>
        <tbody>
          {rowHeads.map((rowHead, row) => (
            <tr key={rowHead}>
              <th>{rowHead}</th>
              {colHeads.map((_, col) => {
                const index = cellMinterm(names.length, map, row, col);
                const cell = cells[index] ?? 0;
                const rings = groups.flatMap((mask, order) => (maskToMinterms(mask.padStart(names.length, "0")).includes(index) ? [COLORS[order % COLORS.length] ?? "#16a34a"] : []));
                const absorbed = cell === "X" && rings.length > 0;
                return (
                  <td key={col}>
                    <button
                      type="button"
                      className={`twb-cell ${cell === 1 ? "one" : cell === "X" ? "dont" : "zero"}${hover === index ? " hot" : ""}${absorbed ? " used" : ""}`}
                      style={{ boxShadow: rings.map((color, ring) => `inset 0 0 0 ${2 + ring * 2}px ${color}`).join(", ") || undefined }}
                      aria-label={`K-map cell m${index}, value ${cell}${absorbed ? ", don't care used in a group" : ""}`}
                      onMouseEnter={() => onHover(index)}
                      onMouseLeave={() => onHover(null)}
                      onClick={(event) => {
                        if (event.ctrlKey || event.metaKey) onTogglePick(index);
                        else onCycle(index);
                      }}
                      onPointerDown={(event) => {
                        if (!manual) return;
                        event.currentTarget.setPointerCapture(event.pointerId);
                        onDrag([index]);
                      }}
                      onPointerEnter={() => {
                        if (!manual || !drag) return;
                        onDrag(drag.includes(index) ? drag : [...drag, index]);
                      }}
                      onPointerUp={() => { if (manual && drag) onFinish(); }}
                    >
                      {cell}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupNote({ mask, names, cells }: { mask: string; names: string[]; cells: Cell[] }) {
  const info = describeImplicant(mask.padStart(names.length, "0"), names);
  const listed = info.covered.filter((index) => cells[index] !== 0);
  return (
    <p className="twb-note">
      Cells: {listed.map((index) => `m${index}`).join(", ") || "none"}.
      {" "}{info.kept}. {info.eliminated === "none" ? "No variable changes." : `${info.eliminated} changes.`}
      {" "}Term: {info.term}.
    </p>
  );
}
