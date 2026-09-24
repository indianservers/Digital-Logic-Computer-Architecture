import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PalettePanel, SandboxPanel, SettingsPanel, TimingPanel, TruthPanel } from "../../components/circuit/CircuitPanels";
import { truthTable } from "../../components/circuit/engine";
import { useCircuit } from "../../components/circuit/useCircuit";
import { Icon } from "../../design-system/icons";

type Bit = 0 | 1;

export const LOGIC_GATE_TABS = [
  { id: "build", label: "Build & Simulate", icon: "play" as const },
  { id: "truth", label: "Truth Table", icon: "table" as const },
  { id: "kmap", label: "Karnaugh Map", icon: "map" as const },
  { id: "min", label: "Minimization", icon: "sheet" as const },
  { id: "compare", label: "Comparison", icon: "grid" as const },
  { id: "practice", label: "Practice", icon: "practice" as const },
  { id: "notes", label: "Notes", icon: "book" as const },
];

const TAKEAWAYS = [
  "Logic gates are the building blocks of digital circuits.",
  "Circuits compute Boolean functions based on input values.",
  "Signal propagation helps visualize how outputs are produced.",
  "Different gate combinations can implement the same function.",
  "Experimentation builds intuition for digital design.",
];

const GATE_CATEGORIES = ["inputs", "outputs", "basic", "universal", "special", "arithmetic", "multiplexing", "sequential", "timing", "probes"];

export function LogicGatesBoard({
  tab, onTab, notes, onNotes,
}: {
  tab: string;
  onTab: (id: string) => void;
  notes: string;
  onNotes: (value: string) => void;
}) {
  const circuit = useCircuit();
  const [menu, setMenu] = useState(false);
  const [hint, setHint] = useState("");
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const live = namedBits(circuit.doc.nodes, circuit.sim.signals);
  const liveKey = `${live.a}${live.b}${live.c}`;
  useEffect(() => {
    setSeen((prev) => (prev.has(liveKey) ? prev : new Set(prev).add(liveKey)));
  }, [liveKey]);
  const table = useMemo(() => truthTable(circuit.doc), [circuit.doc]);
  const basicOnly = circuit.doc.nodes.every((node) => ["input", "output", "and", "or", "not", "buf", "const"].includes(node.type));
  const verified = table.inputs.length === 3 && table.outputs.length === 1 && !table.tooBig && table.rows.every((row) => {
    const ones = row.values.filter((value) => value === 1).length;
    return row.outputs[0] === (ones >= 2 ? 1 : 0);
  });

  return (
    <div className="lgx">
      <header className="lgx-head">
        <div className="lgx-title">
          <span className="lgx-mark"><Icon name="gate" size={22} /></span>
          <div>
            <h1>Logic Gates Studio</h1>
            <p>Design, simulate, and explore logic circuits with an interactive sandbox. Build circuits, run simulations, and see how signals propagate in real time.</p>
          </div>
        </div>
        <div className="lgx-actions">
          <button className="lgx-share" onClick={() => void navigator.clipboard?.writeText(window.location.href)}>Share</button>
          <button className="lgx-more" aria-label="More actions" onClick={() => setMenu((value) => !value)}>•••</button>
          {menu ? (
            <div className="lgx-menu">
              <button onClick={() => { circuit.reset(); setMenu(false); }}>Reset studio</button>
              <button onClick={() => { setHint("Majority is 1 when at least two of A, B, and C are 1. The starter network is AB + BC."); setMenu(false); }}>About this circuit</button>
            </div>
          ) : null}
          <Link to="/" className="lgx-back"><Icon name="back" size={14} /> Back to Path</Link>
        </div>
      </header>
      <div className="lgx-tabs" role="tablist">
        {LOGIC_GATE_TABS.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? "on" : ""} onClick={() => onTab(item.id)}>
            <Icon name={item.icon} size={14} /> {item.label}
          </button>
        ))}
      </div>

      {tab === "build" ? (
        <div className="lgx-board">
          <PalettePanel circuit={circuit} categories={GATE_CATEGORIES} />
          <SandboxPanel circuit={circuit} />
          <TruthPanel circuit={circuit} />
          <TimingPanel circuit={circuit} />
          <SettingsPanel circuit={circuit} />
          <aside className="lgx-card lgx-takes">
            <h3>Key Takeaways</h3>
            <ul>{TAKEAWAYS.map((item) => <li key={item}>{item}</li>)}</ul>
          </aside>
          <section className="lgx-card lgx-challenge">
            <div>
              <h3><i>7</i> Practice Challenge</h3>
              <strong>Build a 3-input majority function</strong>
              <p>Create a circuit that outputs 1 when at least two of the inputs (A, B, C) are 1.</p>
            </div>
            <label><input type="checkbox" checked={basicOnly} readOnly /> Use only basic gates</label>
            <label><input type="checkbox" checked={seen.size >= 8} readOnly /> Test all 8 input combinations</label>
            <label><input type="checkbox" checked={verified} readOnly /> Verify with the truth table</label>
            <div className="lgx-challenge-actions">
              <button className="lgx-hint" onClick={() => setHint(hint ? "" : "Add an AND of A and C, then OR it with AB + BC. The truth table on this page is simulated from the canvas.")}>Hint ▾</button>
              <button className="lgx-check" onClick={() => setHint(verified ? "Majority check passed. Every simulated row matches at-least-two." : `The simulated table has ${table.inputs.length} inputs and ${table.outputs.length} outputs. Seen ${seen.size} of 8 A/B/C combinations.`)}>Check Solution</button>
            </div>
            {hint ? <p className="lgx-hint-text">{hint}</p> : null}
          </section>
        </div>
      ) : (
        <FocusTab tab={tab} a={live.a} b={live.b} c={live.c} notes={notes} onNotes={onNotes} seen={seen.size} />
      )}
    </div>
  );
}

function namedBits(nodes: Array<{ id: string; type: string; label: string }>, signals: Record<string, 0 | 1 | "X" | "Z">): { a: Bit; b: Bit; c: Bit } {
  const read = (label: string): Bit => {
    const node = nodes.find((item) => item.type === "input" && item.label === label);
    return node && signals[`${node.id}.Y`] === 1 ? 1 : 0;
  };
  return { a: read("A"), b: read("B"), c: read("C") };
}

function FocusTab({
  tab, a, b, c, notes, onNotes, seen,
}: {
  tab: string;
  a: Bit;
  b: Bit;
  c: Bit;
  notes: string;
  onNotes: (value: string) => void;
  seen: number;
}) {
  const rows = Array.from({ length: 8 }, (_, index) => {
    const aa = ((index >> 2) & 1) as Bit;
    const bb = ((index >> 1) & 1) as Bit;
    const cc = (index & 1) as Bit;
    const y: Bit = (aa && bb) || (bb && cc) ? 1 : 0;
    return { aa, bb, cc, y, key: `${aa}${bb}${cc}` };
  });
  return (
    <section className="lgx-card lgx-focus">
      {tab === "truth" ? (
        <>
          <h3>Truth table for the starter Y = AB + BC</h3>
          <p className="tiny">Sandbox inputs A={a} B={b} C={c}. The Build tab table is simulated from whatever circuit is on the canvas.</p>
          <table className="lgx-table">
            <thead><tr><th>A</th><th>B</th><th>C</th><th>Y</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className={row.aa === a && row.bb === b && row.cc === c ? "on" : ""}>
                  <td>{row.aa}</td><td>{row.bb}</td><td>{row.cc}</td><td className={row.y ? "y1" : "y0"}>{row.y}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      {tab === "kmap" ? (
        <>
          <h3>3-variable map for AB + BC</h3>
          <p className="tiny">Columns are BC in Gray order. 1-cells are the pairs that share B.</p>
          <Kmap />
        </>
      ) : null}
      {tab === "min" ? (
        <>
          <h3>Minimization</h3>
          <p>Canonical sum of the starter canvas: Y = AB + BC. A full majority function is Y = AB + BC + AC. The extra AC term covers A=1, B=0, C=1.</p>
        </>
      ) : null}
      {tab === "compare" ? (
        <>
          <h3>Same function, other gates</h3>
          <p>AB + BC is two AND gates into an OR. NAND-only needs five NAND symbols for the same equation. Build either form on the canvas; the simulator, not this paragraph, decides Y.</p>
        </>
      ) : null}
      {tab === "practice" ? (
        <>
          <h3>3-input majority</h3>
          <p>Output 1 when at least two inputs are 1. You have driven {seen} of 8 A/B/C combinations. Return to Build & Simulate, toggle the inputs, and add the AC term if the simulated table is still AB + BC.</p>
        </>
      ) : null}
      {tab === "notes" ? (
        <>
          <h3>Studio notes</h3>
          <textarea aria-label="Logic gates notes" value={notes} onChange={(event) => onNotes(event.target.value)} rows={8} />
        </>
      ) : null}
    </section>
  );
}

function Kmap() {
  const cells = [
    [0, 0, 1, 0],
    [0, 0, 1, 1],
  ];
  return (
    <table className="lgx-table">
      <thead><tr><th>A \ BC</th><th>00</th><th>01</th><th>11</th><th>10</th></tr></thead>
      <tbody>
        {cells.map((row, index) => (
          <tr key={index}>
            <td>{index}</td>
            {row.map((bit, cell) => <td key={cell} className={bit ? "y1" : ""}>{bit}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
