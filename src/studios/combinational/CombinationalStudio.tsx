import { useMemo, useState } from "react";
import { CircuitCanvas, Glyph } from "../../components/circuit/CircuitPanels";
import { muxChallengeBoard, patchNode, serialize, signalOf, starterAbPlusC, truthTable } from "../../components/circuit/engine";
import { getComponent } from "../../components/circuit/registry";
import type { Bit, CircuitDoc } from "../../components/circuit/types";
import { useCircuit } from "../../components/circuit/useCircuit";
import { Icon } from "../../design-system/icons";
import { Toggle } from "../../design-system/ui";
import { useStudioTab } from "../../layout/useStudioTab";

const TABS = [
  { id: "basic", label: "Basic Gates", icon: "gate" as const },
  { id: "canvas", label: "Basic Gates", icon: "gate" as const },
  { id: "combinational", label: "Combinational", icon: "grid" as const },
  { id: "arithmetic", label: "Arithmetic", icon: "table" as const },
  { id: "mux", label: "Multiplexers", icon: "map" as const },
  { id: "codec", label: "Encoders / Decoders", icon: "sheet" as const },
  { id: "compare", label: "Comparators", icon: "practice" as const },
  { id: "custom", label: "Custom", icon: "project" as const },
];

type Part = { type: string; label: string; icon: string; params?: Record<string, number | string> };

const BASIC: Part[] = [
  { type: "and", label: "AND", icon: "and" },
  { type: "or", label: "OR", icon: "or" },
  { type: "not", label: "NOT", icon: "not" },
  { type: "nand", label: "NAND", icon: "nand" },
  { type: "nor", label: "NOR", icon: "nor" },
  { type: "xor", label: "XOR", icon: "xor" },
  { type: "xnor", label: "XNOR", icon: "xnor" },
  { type: "buf", label: "Buffer", icon: "buf" },
  { type: "input", label: "Input", icon: "input" },
  { type: "output", label: "Output", icon: "output" },
  { type: "const", label: "Constant 0", icon: "const", params: { value: 0 } },
  { type: "const", label: "Constant 1", icon: "const1", params: { value: 1 } },
];

const DISPLAYS: Part[] = [
  { type: "bulb", label: "Bulb", icon: "bulb" },
  { type: "buzzer", label: "Buzzer", icon: "buzzer" },
  { type: "bicolor", label: "Bi-color", icon: "bicolor" },
  { type: "rgb", label: "RGB LED", icon: "rgb" },
  { type: "bar", label: "LED bar", icon: "bar" },
  { type: "hex", label: "Hex digit", icon: "hex" },
  { type: "seg7", label: "7-segment", icon: "seg7" },
  { type: "traffic", label: "Traffic lamp", icon: "traffic" },
  { type: "lights", label: "Traffic lights", icon: "lights" },
  { type: "motor", label: "Motor", icon: "motor" },
  { type: "relay", label: "Relay", icon: "relay" },
];

const MORE: Part[] = [
  { type: "led", label: "LED", icon: "led" },
  { type: "probe", label: "Probe", icon: "probe" },
  { type: "button", label: "Button", icon: "button" },
  { type: "ha", label: "Half adder", icon: "ha" },
  { type: "fa", label: "Full adder", icon: "fa" },
  { type: "hsub", label: "Half sub", icon: "hsub" },
  { type: "fsub", label: "Full sub", icon: "fsub" },
  { type: "mux2", label: "MUX 2:1", icon: "mux2" },
  { type: "dec2", label: "Decoder", icon: "dec2" },
];

const PALETTE: Record<string, Part[]> = {
  basic: BASIC,
  combinational: BASIC.filter((part) => part.type !== "const").concat(MORE.filter((part) => ["led", "probe", "ha", "mux2"].includes(part.type)), DISPLAYS),
  arithmetic: MORE.filter((part) => ["ha", "fa", "hsub", "fsub"].includes(part.type)).concat(BASIC.filter((part) => ["xor", "and", "or", "input", "output"].includes(part.type))),
  mux: [{ type: "mux2", label: "MUX 2:1", icon: "mux2" }, ...BASIC.filter((part) => ["and", "or", "not", "input", "output", "buf"].includes(part.type))],
  codec: [{ type: "dec2", label: "Decoder 2:4", icon: "dec2" }, ...BASIC.filter((part) => ["and", "or", "not", "nand", "input", "output"].includes(part.type)), { type: "led", label: "LED", icon: "led" }],
  compare: BASIC.filter((part) => ["xnor", "xor", "and", "or", "not", "input", "output"].includes(part.type)),
  custom: [...BASIC, ...MORE, ...DISPLAYS],
};

const STEPS = [
  ["Understand the Problem", "Read the description and identify inputs, outputs, and required behavior."],
  ["Build the Circuit", "Drag components and connect them on the canvas."],
  ["Simulate & Verify", "Use input controls and simulation monitor to verify your circuit."],
  ["Generate Truth Table", "Automatically create and analyze the truth table."],
  ["Optimize (Optional)", "Simplify using Boolean algebra or try a different design."],
  ["Challenge Mode", "Solve the extended challenge to deepen your understanding."],
];

const TAKEAWAYS = [
  "Combinational circuits produce outputs based only on current inputs.",
  "Use truth tables to verify behavior.",
  "Different gate combinations can implement the same logic function.",
  "Simulate thoroughly and check edge cases.",
  "Apply these designs in real-world systems (e.g., adders, multiplexers).",
];

const OPS = [
  ["AND", "∧", "Y = A · B"],
  ["OR", "∨", "Y = A + B"],
  ["NOT", "¬", "Y = A'"],
  ["NAND", "⊼", "Y = (A · B)'"],
  ["NOR", "⊽", "Y = (A + B)'"],
  ["XOR", "⊕", "Y = A ⊕ B"],
  ["XNOR", "⊙", "Y = (A ⊕ B)'"],
];

export function CombinationalStudio() {
  const [tab, setTab] = useStudioTab(TABS, "basic");
  const view = tab === "canvas" ? "basic" : tab;
  const circuit = useCircuit({ storage: "logiclab.circuit.combinational.v1", starter: starterAbPlusC });
  const [query, setQuery] = useState("");
  const [more, setMore] = useState(false);
  const [analysis, setAnalysis] = useState<"value" | "timing" | "expr">("value");
  const [step, setStep] = useState(0);
  const [hint, setHint] = useState(false);
  const [verdict, setVerdict] = useState("");
  const [saved, setSaved] = useState("");
  const [propsHost, setPropsHost] = useState<HTMLDivElement | null>(null);
  const table = useMemo(() => truthTable(circuit.doc), [circuit.doc]);
  const inputs = circuit.doc.nodes.filter((node) => node.type === "input");
  const output = circuit.doc.nodes.find((node) => node.type === "output") ?? circuit.doc.nodes.find((node) => node.type === "led" || node.type === "probe");
  const level = output ? signalOf(circuit.shown, output.id, "A") : "X";
  const liveIndex = inputs.reduce((acc, node, index) => acc + (node.params.value === 1 ? 1 : 0) * 2 ** (inputs.length - 1 - index), 0);
  const parts = (PALETTE[view] ?? BASIC).filter((part) => part.label.toLowerCase().includes(query.trim().toLowerCase()));
  const shownParts = more ? parts : parts.slice(0, 12);

  function download() {
    const blob = new Blob([JSON.stringify(circuit.doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "combinational-circuit.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function checkMux() {
    setVerdict(muxVerdict(circuit.doc));
  }

  return (
    <div className="cmb">
      <header className="cmb-head">
        <div className="cmb-title">
          <span className="cmb-mark" aria-hidden="true"><Icon name="gate" size={22} /></span>
          <div>
            <h1>Combinational Circuit Design</h1>
            <p>Design, simulate, and analyze combinational logic circuits. Combine logic gates to create circuits, verify with truth tables, and explore real-world applications.</p>
          </div>
        </div>
        <div className="cmb-actions">
          <button className="cmb-ghost" onClick={() => { localStorage.setItem("logiclab.circuit.combinational.v1", serialize(circuit.doc)); setSaved("Saved on this device"); }}>Save</button>
          <button className="cmb-ghost" onClick={download}>Download</button>
          <button className="cmb-share" onClick={() => void navigator.clipboard?.writeText(window.location.href)}>Share</button>
        </div>
      </header>
      {saved ? <p className="tiny">{saved}</p> : null}
      <div className="cmb-tabs" role="tablist" aria-label="Circuit families">
        {TABS.filter((item) => item.id !== "canvas").map((item) => (
          <button key={item.id} role="tab" aria-selected={view === item.id} className={view === item.id ? "on" : ""} onClick={() => setTab(item.id)}>
            <Icon name={item.icon} size={14} /> {item.label}
          </button>
        ))}
      </div>
      <div className="cmb-grid">
        <section className="cmb-card">
          <h2>Components</h2>
          <label className="cmb-search">
            <Icon name="search" size={14} />
            <input aria-label="Search components" placeholder="Search components..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="cmb-family">Family
            <select aria-label="Component family" value={view} onChange={(event) => setTab(event.target.value)}>
              {TABS.filter((item) => item.id !== "canvas").map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <div className="cmb-parts">
            {shownParts.map((part) => (
              <button
                key={`${part.type}-${part.label}`}
                className={circuit.armed === part.type ? "on" : ""}
                draggable
                title={`Drag ${part.label} onto the canvas, or click it and then click the canvas.`}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/circuit-type", part.type);
                  if (part.params) event.dataTransfer.setData("text/circuit-params", JSON.stringify(part.params));
                  circuit.arm(part.type, part.params);
                }}
                onClick={() => circuit.arm(circuit.armed === part.type ? null : part.type, part.params)}
              >
                <Glyph type={part.icon} />
                <span>{part.label}</span>
              </button>
            ))}
          </div>
          {parts.length > 12 ? <button className="cmb-more" onClick={() => setMore((value) => !value)}>{more ? "Fewer components" : "More Components"}</button> : null}
        </section>

        <section className="cmb-card cmb-canvas-card">
          <div className="cmb-bar">
            <h2>Circuit Canvas</h2>
            <span className="tiny">{circuit.armed ? `Click the canvas to place ${getComponent(circuit.armed)?.displayName ?? "the part"}` : "Drag a part onto the canvas"}</span>
          </div>
          <div className="cmb-tools" role="toolbar" aria-label="Canvas tools">
            <button className={circuit.armed ? "" : "on"} title="Select" aria-label="Select" onClick={() => circuit.arm(null)}>▣</button>
            <button title="Delete selection" aria-label="Delete selection" onClick={circuit.removeSelection}>⌫</button>
            <button title="Undo" aria-label="Undo" onClick={circuit.undo} disabled={!circuit.canUndo}>↩</button>
            <button title="Redo" aria-label="Redo" onClick={circuit.redo} disabled={!circuit.canRedo}>↪</button>
            <button title="Zoom out" aria-label="Zoom out" onClick={() => circuit.setView({ ...circuit.view, zoom: Math.max(0.1, circuit.view.zoom - 0.1) })}>−</button>
            <button title="Zoom in" aria-label="Zoom in" onClick={() => circuit.setView({ ...circuit.view, zoom: Math.min(4, circuit.view.zoom + 0.1) })}>+</button>
            <span className="cmb-zoom">{Math.round(circuit.view.zoom * 100)}%</span>
            <button onClick={() => circuit.setView({ x: 16, y: 12, zoom: 1 })}>Fit</button>
            <button className={circuit.snap ? "on" : ""} aria-pressed={circuit.snap} title="Snap to grid" onClick={() => circuit.setSnap(!circuit.snap)}>▦</button>
          </div>
          <CircuitCanvas circuit={circuit} dockProperties propertiesHost={propsHost} />
        </section>

        <section className="cmb-card cmb-props-card">
          <h2>Properties</h2>
          <div ref={setPropsHost} className="cmb-props-host" />
        </section>
      </div>

      <div className="cmb-bottom">
        <section className="cmb-card">
          <div className="cmb-bar"><h2>Output Analysis</h2><span className="cmb-live">Live</span></div>
            <div className="cmb-seg" role="tablist">
              {(["value", "timing", "expr"] as const).map((id) => (
                <button key={id} className={analysis === id ? "on" : ""} aria-selected={analysis === id} onClick={() => setAnalysis(id)}>
                  {id === "value" ? "Output Value" : id === "timing" ? "Timing" : "Logic Expression"}
                </button>
              ))}
            </div>
            {analysis === "value" ? (
              <div className="cmb-readout">
                <span>{output?.label ?? "Y"} (Output)</span>
                <strong className={level === 1 ? "high" : level === 0 ? "low" : ""}>{level === 1 ? "HIGH" : level === 0 ? "LOW" : String(level)}</strong>
                <b>{level}</b>
              </div>
            ) : null}
            {analysis === "timing" ? (
              <ol className="cmb-frames">
                {circuit.sim.frames.slice(-6).map((frame, index) => (
                  <li key={`${frame.time}-${index}`}>{frame.time} ns · {circuit.doc.nodes.find((node) => node.id === frame.nodeId)?.label ?? frame.nodeId}</li>
                ))}
                {circuit.sim.frames.length === 0 ? <li>This circuit settles in the same step.</li> : null}
              </ol>
            ) : null}
            {analysis === "expr" ? <p className="cmb-expr">{output ? formula(circuit.doc, output.id, []) : "Add an output to read the expression."}</p> : null}
        </section>
        <section className="cmb-card">
            <div className="cmb-bar"><h2>Simulation Monitor</h2><span className="tiny">Step</span></div>
            <div className="cmb-run">
              <button className="cmb-run-btn" onClick={() => circuit.setPlaying(true)}><Icon name="play" size={14} /> Run</button>
              <button onClick={() => circuit.commit({ ...circuit.doc, nodes: circuit.doc.nodes.map((node) => node.type === "clock" ? { ...node, params: { ...node.params, level: node.params.level === 1 ? 0 : 1 } } : node) })}>Step</button>
              <button onClick={circuit.reset}>Reset</button>
              <select aria-label="Simulation speed" value={String(circuit.speed)} onChange={(event) => circuit.setSpeed(Number(event.target.value))}>
                {[0.25, 0.5, 1, 2, 4, 8].map((value) => <option key={value} value={value}>{value}×</option>)}
              </select>
            </div>
        </section>
        <section className="cmb-card">
            <h2>Input Controls</h2>
            {inputs.length === 0 ? <p className="tiny">Add input switches to drive the circuit.</p> : null}
            {inputs.map((node) => (
              <div className="cmb-input" key={node.id}>
                <span>{node.label}</span>
                <Toggle on={node.params.value === 1} showLabel={false} label={`${node.label} value`} onChange={(next) => circuit.commit(patchNode(circuit.doc, node.id, { params: { value: next ? 1 : 0 } }))} />
                <b>{node.params.value === 1 ? 1 : 0}</b>
              </div>
            ))}
        </section>
        <section className="cmb-card cmb-steps">
          <h2>Design Steps</h2>
          <ol>
            {STEPS.map(([title, body], index) => (
              <li key={title} className={step === index ? "on" : ""}>
                <button onClick={() => setStep(index)}><i>{index + 1}</i><span>{title}</span></button>
                {step === index ? <p>{body}</p> : null}
              </li>
            ))}
          </ol>
        </section>
        <section className="cmb-card">
          <div className="cmb-bar">
            <h2>Truth Table Generator</h2>
            <span className="cmb-vars">{table.inputs.length} ({table.inputs.map((item) => item.label).join(", ") || "—"})</span>
            <button className="cmb-gen" onClick={() => setSaved(table.tooBig ? table.note : "Generated from the simulated circuit.")}>Generate</button>
          </div>
          {table.tooBig ? <p className="tiny">{table.note}</p> : (
            <div className="cmb-scroll">
              <table className="cmb-table">
                <thead>
                  <tr><th>#</th>{table.inputs.map((item) => <th key={item.id}>{item.label}</th>)}{table.outputs.map((item) => <th key={item.id}>{item.label}</th>)}</tr>
                </thead>
                <tbody>
                  {table.rows.map((row, index) => (
                    <tr key={index} className={index === liveIndex ? "on" : ""}>
                      <td>{index}</td>
                      {row.values.map((value, bit) => <td key={bit}>{value}</td>)}
                      {row.outputs.map((value, bit) => <td key={bit} className={value === 1 ? "y1" : value === 0 ? "y0" : ""}>{value}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="cmb-card">
          <div className="cmb-bar"><h2>Challenge Mode</h2><span className="cmb-try">Try It!</span></div>
          <p><strong>Build a 2-to-1 multiplexer using basic gates.</strong></p>
          <p className="tiny">Inputs: A, B, S (select)</p>
          <p className="tiny">Output: Y = S'·A + S·B</p>
          <div className="cmb-hint">
            <span>Hint</span>
            <Toggle on={hint} showLabel={false} label="Show mux hint" onChange={setHint} />
          </div>
          {hint ? <p className="tiny">Use NOT, AND and OR gates. Y should equal A when S = 0, and B when S = 1.</p> : null}
          {verdict ? <p className={verdict.startsWith("Correct") ? "cmb-ok" : "cmb-bad"}>{verdict}</p> : null}
          <div className="cmb-challenge">
            <button onClick={() => { circuit.replace(muxChallengeBoard()); setVerdict(""); }}>Reset Challenge</button>
            <button className="cmb-check" onClick={checkMux}>Check Answer</button>
          </div>
        </section>
        <section className="cmb-card">
          <h2>Operation Table</h2>
          <table className="cmb-ops">
            <thead><tr><th>Gate</th><th>Symbol</th><th>Boolean Expression</th></tr></thead>
            <tbody>
              {OPS.map(([gate, symbol, expr]) => (
                <tr key={gate}><td>{gate}</td><td>{symbol}</td><td>{expr}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="cmb-card">
          <h2>Key Takeaways</h2>
          <ul className="cmb-takes">
            {TAKEAWAYS.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}

function formula(doc: CircuitDoc, id: string, stack: string[]): string {
  if (stack.includes(id)) return "loop";
  const node = doc.nodes.find((item) => item.id === id);
  const spec = node ? getComponent(node.type) : undefined;
  if (!node || !spec) return "?";
  if (node.type === "input" || node.type === "const" || node.type === "button" || node.type === "clock") return node.label;
  if (node.type === "output" || node.type === "led" || node.type === "probe") {
    const wire = doc.wires.find((item) => item.to === node.id);
    return wire ? formula(doc, wire.from, [...stack, id]) : "X";
  }
  const ports = spec.ports(node.params).filter((port) => port.dir === "in");
  const names = ports.map((port) => {
    const wire = doc.wires.find((item) => item.to === node.id && item.toPort === port.id);
    if (!wire) return "X";
    const inner = formula(doc, wire.from, [...stack, id]);
    return /[+·⊕]/.test(inner) ? `(${inner})` : inner;
  });
  return spec.expression?.(names) ?? names.join(" · ");
}

function muxVerdict(doc: CircuitDoc): string {
  const table = truthTable(doc);
  const labels = table.inputs.map((item) => item.label);
  if (!["A", "B", "S"].every((name) => labels.includes(name))) return "Place inputs named A, B, and S.";
  const output = table.outputs.findIndex((item) => item.label === "Y");
  if (output < 0) return "Add an output named Y.";
  const ai = labels.indexOf("A");
  const bi = labels.indexOf("B");
  const si = labels.indexOf("S");
  for (const row of table.rows) {
    const a = row.values[ai];
    const b = row.values[bi];
    const s = row.values[si];
    const y = row.outputs[output];
    const expect: Bit = s === 1 ? b ?? "X" : a ?? "X";
    if (y !== expect) return `When A=${a} B=${b} S=${s}, Y is ${y}. A 2-to-1 mux gives ${expect}.`;
  }
  return "Correct. Y follows A when S is 0 and B when S is 1.";
}
