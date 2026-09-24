import { useEffect, useRef } from "react";
import type { FnState } from "./logic";

export function TruthGrid({
  state,
  hover,
  selected,
  onHover,
  onCycle,
  onRename,
  onToggleRow,
  onFocusRow,
}: {
  state: FnState;
  hover: number | null;
  selected: number[];
  onHover: (index: number | null) => void;
  onCycle: (index: number) => void;
  onRename: (index: number, name: string) => void;
  onToggleRow: (index: number, extend: boolean) => void;
  onFocusRow: (index: number) => void;
}) {
  const focus = useRef<HTMLButtonElement | null>(null);
  const fromKeys = useRef(false);
  const width = state.names.length;

  useEffect(() => {
    if (!fromKeys.current) return;
    fromKeys.current = false;
    focus.current?.focus();
  }, [hover]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (hover === null) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const next = event.key === "ArrowDown" ? Math.min(state.cells.length - 1, hover + 1) : Math.max(0, hover - 1);
        fromKeys.current = true;
        onFocusRow(next);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hover, onFocusRow, state.cells.length]);

  return (
    <div className="twb-scroll" role="grid" aria-label="Truth table">
      <table className="ttx-table twb-grid">
        <thead>
          <tr>
            <th></th>
            <th>#</th>
            {state.names.map((name, index) => (
              <th key={index}>
                <input aria-label={`Name of variable ${index + 1}`} value={name} onChange={(event) => onRename(index, event.target.value)} />
              </th>
            ))}
            <th>{state.output}</th>
          </tr>
        </thead>
        <tbody>
          {state.cells.map((cell, index) => {
            const bits = state.names.map((_, bit) => ((index >> (width - 1 - bit)) & 1) === 1 ? "1" : "0");
            const on = hover === index;
            return (
              <tr key={index} className={on ? "hot" : ""} onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(null)}>
                <td>
                  <input type="checkbox" aria-label={`Select row ${index}`} checked={selected.includes(index)} onChange={(event) => onToggleRow(index, event.nativeEvent instanceof MouseEvent && event.nativeEvent.shiftKey)} />
                </td>
                <td>{index}</td>
                {bits.map((bit, bitIndex) => <td key={bitIndex}>{bit}</td>)}
                <td>
                  <button
                    ref={on ? focus : undefined}
                    type="button"
                    className={`twb-bit ${cell === 1 ? "one" : cell === "X" ? "dont" : "zero"}`}
                    aria-label={`F row ${index}, currently ${cell}. Click to cycle 0, 1, X.`}
                    onClick={() => onCycle(index)}
                    onFocus={() => onFocusRow(index)}
                    onKeyDown={(event) => {
                      if (event.key === " " || event.key === "Enter") {
                        event.preventDefault();
                        onCycle(index);
                      }
                    }}
                  >
                    {cell}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
