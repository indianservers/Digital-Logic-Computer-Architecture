import { useState } from "react";
import type { FieldSlice } from "../../engines/isaarch/bits";

export function BitFields({ fields, wordBits }: { fields: FieldSlice[]; wordBits?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const active = fields.find((field) => field.name === hover);
  return (
    <div>
      {wordBits ? <p className="mono isa-word">{wordBits}</p> : null}
      <div className="isa-bits" onMouseLeave={() => setHover(null)}>
        {fields.map((field) => (
          <button
            key={`${field.name}-${field.hi}`}
            type="button"
            className={hover === field.name ? "isa-bit on" : "isa-bit"}
            style={{ background: `${field.color}55` }}
            onMouseEnter={() => setHover(field.name)}
            onFocus={() => setHover(field.name)}
            title={`${field.name} [${field.hi}:${field.lo}]`}
          >
            <span>{field.name}</span>
            <small>[{field.hi}:{field.lo}] {field.bits}</small>
          </button>
        ))}
      </div>
      {active ? <p className="tiny">{active.name}: {active.meaning} · value {active.value}</p> : <p className="tiny">Hover a field to read its bits and role.</p>}
    </div>
  );
}

export function IsaRegister({
  name, number, value, note, selected, onSelect, locked,
}: {
  name: string;
  number?: number;
  value: number;
  note?: string;
  selected?: boolean;
  onSelect?: () => void;
  locked?: boolean;
}) {
  const unsigned = value >>> 0;
  const signed = value | 0;
  const hex = `0x${unsigned.toString(16).toUpperCase().padStart(8, "0")}`;
  const binary = unsigned.toString(2).padStart(32, "0");
  return (
    <button type="button" className={selected ? "cpu-block on" : "cpu-block"} onClick={onSelect}>
      <strong>{name}{number !== undefined ? ` · ${number}` : ""}{locked ? " · frozen" : ""}</strong>
      <small>Binary {binary}</small>
      <small>Hex {hex}</small>
      <small>Unsigned {unsigned} · signed {signed}</small>
      {note ? <small>{note}</small> : null}
    </button>
  );
}

export function Datapath({ nodes, active }: { nodes: Array<{ id: string; label: string }>; active: string[] }) {
  const lit = new Set(active);
  return (
    <div className="dp-row" aria-label="Datapath">
      {nodes.map((node, index) => (
        <div key={node.id} className="dp-item">
          <div className={lit.has(node.id) ? "dp-node on" : "dp-node"}>{node.label}</div>
          {index < nodes.length - 1 ? <span className={lit.has(node.id) && lit.has(nodes[index + 1]?.id ?? "") ? "dp-wire on" : "dp-wire"} aria-hidden="true">→</span> : null}
        </div>
      ))}
    </div>
  );
}
