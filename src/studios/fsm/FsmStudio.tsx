import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Segmented, Toggle } from "../../design-system/ui";
import { Icon } from "../../design-system/icons";
import { encodeStates, type EncodingKind } from "../../engines/fsm/encoding";
import { FSM_EXAMPLES } from "../../engines/fsm/examples";
import { minimizeMachine } from "../../engines/fsm/minimization";
import { outputOf, parseStream, runSequence, stepMachine } from "../../engines/fsm/simulator";
import { addState, addTransition, moveState, removeState, removeTransition, renameState, setInitial, setOutput, stateById, type FsmMachine } from "../../engines/fsm/stateMachine";
import { synthesizeD } from "../../engines/fsm/synthesis";
import { chosenTransition, conditionMatches } from "../../engines/fsm/transition";

type Page = "studio" | "diagram" | "table" | "minimize" | "sequence" | "examples";

const PAGES: Array<{ id: Page; label: string }> = [
  { id: "studio", label: "FSM Studio" },
  { id: "diagram", label: "State Diagram" },
  { id: "table", label: "State Table" },
  { id: "minimize", label: "State Minimization" },
  { id: "sequence", label: "Sequence Simulation" },
  { id: "examples", label: "More examples" },
];

const LEGACY: Record<string, Page> = {
  encoding: "studio",
  circuit: "studio",
  diagram: "diagram",
};

const CONCEPTS = [
  "What is a finite state machine?",
  "Moore vs. Mealy machines",
  "State diagrams and state tables",
  "State minimization",
  "State encoding techniques",
];

const LABS = [
  { title: "Traffic Light Controller", to: "/studios/fsm?tab=examples" },
  { title: "Vending Machine", to: "/studios/fsm?tab=examples" },
  { title: "Sequence Detector", to: "/studios/fsm?tab=examples" },
  { title: "Elevator Controller", to: "/studios/fsm?tab=examples" },
  { title: "FSM with Moore vs. Mealy", to: "/studios/fsm?tab=studio" },
];

function demoMachine(): FsmMachine {
  return {
    name: "Sequence sketch",
    kind: "moore",
    inputs: ["x"],
    states: [
      { id: "s0", name: "S0", x: 90, y: 92, output: "0" },
      { id: "s1", name: "S1", x: 210, y: 92, output: "0" },
      { id: "s2", name: "S2", x: 330, y: 92, output: "0" },
      { id: "s3", name: "S3", x: 450, y: 92, output: "1" },
    ],
    transitions: [
      { id: "a", from: "s0", to: "s0", when: "0", output: "0" },
      { id: "b", from: "s0", to: "s1", when: "1", output: "0" },
      { id: "c", from: "s1", to: "s2", when: "0", output: "0" },
      { id: "d", from: "s1", to: "s2", when: "1", output: "0" },
      { id: "e", from: "s2", to: "s2", when: "0", output: "0" },
      { id: "f", from: "s2", to: "s3", when: "1", output: "1" },
      { id: "g", from: "s3", to: "s0", when: "0", output: "0" },
      { id: "h", from: "s3", to: "s3", when: "1", output: "1" },
    ],
    initialId: "s0",
  };
}

export function FsmStudio() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") ?? "studio";
  const page: Page = PAGES.some((item) => item.id === raw) ? raw as Page : LEGACY[raw] ?? "studio";
  const [machine, setMachine] = useState<FsmMachine>(demoMachine);
  const [selected, setSelected] = useState("s0");
  const [current, setCurrent] = useState("s0");
  const [stream, setStream] = useState("1 0 1 1 0 0 1");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [showSeq, setShowSeq] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [alphabet, setAlphabet] = useState("0, 1");
  const [notes, setNotes] = useState<Record<string, string>>({ s0: "Start state" });
  const [zoom, setZoom] = useState(1);
  const [encoding, setEncoding] = useState<EncodingKind>("binary");
  const [hint, setHint] = useState("");

  const symbols = alphabet.split(",").map((item) => item.trim()).filter(Boolean);
  const active = stateById(machine, current);
  const picked = stateById(machine, selected) ?? active;
  const values = parseStream(stream);
  const nextSymbol = values[index] ?? symbols[1] ?? "1";
  const preview = stepMachine(machine, current, nextSymbol);
  const history = useMemo(() => runSequence(machine, values.slice(0, index), machine.initialId), [machine, values, index]);
  const encoded = useMemo(() => encodeStates(machine, encoding), [machine, encoding]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setIndex((cursor) => {
        const symbol = parseStream(stream)[cursor];
        if (!symbol) {
          setPlaying(false);
          return cursor;
        }
        setCurrent((state) => stepMachine(machine, state, symbol).toId);
        return cursor + 1;
      });
    }, speed);
    return () => window.clearInterval(timer);
  }, [playing, stream, machine, speed]);

  function go(next: Page) {
    const query = new URLSearchParams(params);
    query.set("tab", next);
    setParams(query);
  }

  function load(next: FsmMachine) {
    setMachine(next);
    setSelected(next.initialId);
    setCurrent(next.initialId);
    setIndex(0);
    setPlaying(false);
  }

  function reset() {
    setPlaying(false);
    setCurrent(machine.initialId);
    setIndex(0);
  }

  function step() {
    const symbol = values[index];
    if (!symbol) return;
    setCurrent(stepMachine(machine, current, symbol).toId);
    setIndex(index + 1);
  }

  const visited = [machine.initialId, ...history.map((step) => step.toId)];
  const output = outputOf(machine, current, machine.kind === "mealy" ? nextSymbol : null);

  return (
    <div className="fsmx">
      <header className="fsmx-head">
        <div className="lgx-title">
          <span className="lgx-mark"><Icon name="map" size={22} /></span>
          <div>
            <h1>Finite State Machines <span className="fsmx-badge">17 concepts</span></h1>
            <p>Design, simulate, and analyze finite state machines. Build intuition with interactive visualizations and real-world examples.</p>
          </div>
        </div>
        <button className="lgx-check" type="button" onClick={() => go("studio")}>Start Learning</button>
      </header>
      <div className="fsmx-stats">
        <span><b>6</b> Interactive Labs</span>
        <span><b>17</b> Concepts</span>
        <span><b>8</b> Practice Problems</span>
        <span><b>12</b> Real-World Examples</span>
      </div>
      <div className="lgx-tabs" role="tablist">
        {PAGES.map((item) => (
          <button key={item.id} role="tab" aria-selected={page === item.id} className={page === item.id ? "on" : ""} onClick={() => go(item.id)}>{item.label}</button>
        ))}
      </div>

      {page === "table" ? <TablePage machine={machine} symbols={symbols} current={current} onChange={setMachine} /> : null}
      {page === "minimize" ? <MinPage machine={machine} onUse={load} /> : null}
      {page === "examples" ? <ExamplesPage onUse={(next) => { load(next); go("studio"); }} /> : null}
      {page === "studio" || page === "diagram" || page === "sequence" ? (
        <div className="fsmx-grid">
          <section className="lgx-card fsmx-diagram">
            <div className="lgx-card-bar">
              <h3>State Diagram</h3>
              <div className="row">
                <Segmented options={["Moore", "Mealy"]} value={machine.kind === "moore" ? "Moore" : "Mealy"} onChange={(value) => setMachine({ ...machine, kind: value === "Moore" ? "moore" : "mealy" })} />
                <button type="button" className="fsmx-icon" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.7, value - 0.1))}>−</button>
                <button type="button" className="fsmx-icon" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.6, value + 0.1))}>+</button>
                <button type="button" className="fsmx-icon" onClick={() => load(demoMachine())}>Clear</button>
              </div>
            </div>
            <p className="tiny">Build and simulate your finite state machine. Click a state or transition to edit.</p>
            <Diagram machine={machine} current={highlight ? current : ""} selected={selected} zoom={zoom} onSelect={setSelected} onMove={(id, x, y) => setMachine(moveState(machine, id, x, y))} />
          </section>

          <section className="lgx-card">
            <h3>State Editor</h3>
            <p className="tiny">Select a state to edit its properties.</p>
            <label>State Name<input aria-label="State name" value={picked?.name ?? ""} onChange={(event) => picked && setMachine(renameState(machine, picked.id, event.target.value))} /></label>
            <label>Output ({machine.kind === "moore" ? "Moore" : "Mealy"})<input aria-label="State output" value={picked?.output ?? ""} onChange={(event) => picked && setMachine(setOutput(machine, picked.id, event.target.value))} /></label>
            <label>Description<textarea aria-label="State description" rows={2} value={picked ? notes[picked.id] ?? "" : ""} onChange={(event) => picked && setNotes({ ...notes, [picked.id]: event.target.value })} /></label>
            <div className="spread">
              <span>Set as Start State</span>
              <Toggle on={picked?.id === machine.initialId} onChange={() => picked && setMachine(setInitial(machine, picked.id))} label="Start state" showLabel={false} />
            </div>
            <div className="row">
              <Button onClick={() => picked && setMachine(removeState(machine, picked.id))}><Icon name="reset" size={14} /> Delete State</Button>
              <Button variant="primary" onClick={() => {
                const next = addState(machine, `${picked?.name ?? "S"} copy`);
                const added = next.states[next.states.length - 1];
                if (added && picked) setMachine(setOutput(next, added.id, picked.output));
                if (added) setSelected(added.id);
              }}>Duplicate</Button>
            </div>
          </section>

          <section className="lgx-card">
            <h3>Input Alphabet</h3>
            <p className="tiny">Define the input symbols for the FSM.</p>
            <label>Inputs (comma separated)<input aria-label="Input alphabet" value={alphabet} onChange={(event) => setAlphabet(event.target.value)} /></label>
            <div className="fsmx-quick">
              {["0, 1", "0, 1, X"].map((item) => <button key={item} type="button" className={alphabet === item ? "on" : ""} onClick={() => setAlphabet(item)}>{item === "0, 1, X" ? "0 1 X" : item.replace(", ", "")}</button>)}
              <button type="button" onClick={() => setAlphabet("0, 1")}>Custom</button>
            </div>
            <h3>Output Display</h3>
            <p className="tiny">View the output for the current state ({machine.kind === "moore" ? "Moore" : "transition (Mealy)"}).</p>
            <div className="fsmx-readout"><span>Output</span><b>{output}</b></div>
          </section>

          <section className="lgx-card">
            <h3>Simulation Controls</h3>
            <p className="tiny">Run, step through, or reset the simulation.</p>
            <div className="row">
              <button className="lgx-play" type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Run"}</button>
              <Button onClick={step}>Step</Button>
              <Button onClick={reset}>Reset</Button>
            </div>
            <label className="lgx-slider">Simulation Speed
              <input aria-label="Simulation speed" type="range" min={150} max={1000} step={50} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
              <span>{speed} ms</span>
            </label>
            <Toggle on={showSeq} onChange={setShowSeq} label="Show input sequence" />
            <Toggle on={highlight} onChange={setHighlight} label="Highlight active state" />
          </section>

          <section className="lgx-card">
            <h3>Input Sequence</h3>
            <p className="tiny">Provide an input string to simulate the FSM.</p>
            {showSeq ? <input aria-label="Input sequence" value={stream} onChange={(event) => { setStream(event.target.value); setIndex(0); setCurrent(machine.initialId); }} /> : null}
            <div className="fsmx-quick">
              {["1010", "1100", "0010"].map((item) => <button key={item} type="button" onClick={() => { setStream(item.split("").join(" ")); reset(); }}>{item}</button>)}
              <button type="button" onClick={() => setStream("1 0 1 1 0 0 1")}>Custom</button>
              <button className="lgx-play" type="button" onClick={step}>Play</button>
            </div>
          </section>

          <section className="lgx-card">
            <h3>Transition Table</h3>
            <p className="tiny">State transitions and outputs.</p>
            <table className="lgx-table">
              <thead><tr><th>Present State</th>{symbols.map((symbol) => <th key={symbol}>Input {symbol}</th>)}<th>Output</th></tr></thead>
              <tbody>
                {machine.states.map((state) => (
                  <tr key={state.id} className={state.id === current ? "on" : ""}>
                    <td>{state.name}</td>
                    {symbols.map((symbol) => <td key={symbol}>{stateById(machine, chosenTransition(machine, state.id, symbol)?.to ?? "")?.name ?? "—"}</td>)}
                    <td>{state.output}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="lgx-card">
            <h3>Current State</h3>
            <p className="tiny">Live simulation status.</p>
            <div className="fsmx-readout"><span>Current State</span><b>{active?.name ?? "—"}</b></div>
            <div className="fsmx-readout"><span>Next State (for input = {nextSymbol})</span><b>{preview.toName}</b></div>
            <div className="fsmx-readout"><span>Output</span><b>{output}</b></div>
          </section>

          <section className="lgx-card fsmx-wide">
            <h3>State Sequence (Simulation Timeline)</h3>
            <p className="tiny">Visualize the states visited during simulation.</p>
            <div className="fsmx-time">
              {visited.map((id, stepIndex) => {
                const state = stateById(machine, id);
                return (
                  <div key={`${id}-${stepIndex}`} className={id === current && stepIndex === visited.length - 1 ? "on" : ""}>
                    <b>{state?.name ?? id}</b>
                    <small>{state?.output ?? ""}</small>
                    <span>{stepIndex}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="lgx-card">
            <h3>State Encoding</h3>
            <p className="tiny">Choose an encoding scheme for implementation.</p>
            <label>Encoding Scheme
              <select aria-label="Encoding scheme" value={encoding} onChange={(event) => setEncoding(event.target.value as EncodingKind)}>
                <option value="binary">Binary (Auto)</option>
                <option value="one-hot">One-hot</option>
              </select>
            </label>
            <p className="tiny">Number of Bits {encoded.flipFlops}</p>
            <div className="fsmx-codes">
              {encoded.states.map((state) => <span key={state.id}><b>{state.name}</b> {state.code}</span>)}
            </div>
          </section>
        </div>
      ) : null}

      <div className="fsmx-foot">
        <section className="lgx-card">
          <h3>Key Concepts ({CONCEPTS.length})</h3>
          <ol>{CONCEPTS.map((item, index) => <li key={item}>{index + 1}. {item}</li>)}</ol>
        </section>
        <section className="lgx-card">
          <h3>Interactive Labs ({LABS.length})</h3>
          <ul>{LABS.map((item) => <li key={item.title}><Link to={item.to}>{item.title}</Link></li>)}</ul>
        </section>
        <section className="lgx-card">
          <h3>Real-World Applications</h3>
          <ul>
            <li>Traffic Lights — control traffic flow with a finite state machine</li>
            <li>Vending Machines — handle product selection and dispensing</li>
            <li>Elevator Systems — manage floor requests and door control</li>
            <li>Input Pattern Detection — detect sequences in digital systems</li>
          </ul>
        </section>
        <section className="lgx-card">
          <div className="spread"><h3>Practice Challenge</h3><button className="lgx-hint" type="button" onClick={() => { load(FSM_EXAMPLES.find((item) => item.id === "light")?.build() ?? demoMachine()); go("studio"); }}>Try it</button></div>
          <p>Design a traffic light controller with four states: North-South Green, Yellow, and East-West Green. Simulate it and verify the timing sequence.</p>
          <button className="lgx-check" type="button" onClick={() => setHint(hint ? "" : "Load the traffic example, then Step. Each 1 advances NS Green → NS Yellow → EW Green → EW Yellow.")}>{hint ? "Hide hint" : "View hint"}</button>
          {hint ? <p className="tiny">{hint}</p> : null}
        </section>
      </div>
    </div>
  );
}

function Diagram({ machine, current, selected, zoom, onSelect, onMove }: {
  machine: FsmMachine;
  current: string;
  selected: string;
  zoom: number;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [edge, setEdge] = useState<string | null>(null);
  return (
    <svg className="fsmx-svg" viewBox="0 0 560 210" role="img" aria-label="State diagram" style={{ transform: `scale(${zoom})` }}
      onPointerMove={(event) => {
        if (!drag) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 560 - drag.dx;
        const y = ((event.clientY - rect.top) / rect.height) * 210 - drag.dy;
        onMove(drag.id, Math.max(40, Math.min(520, x)), Math.max(40, Math.min(170, y)));
      }}
      onPointerUp={() => setDrag(null)}
    >
      <defs><marker id="fsm-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6" fill="#60a5fa" /></marker></defs>
      {stateById(machine, machine.initialId) ? <path d={`M 16 ${stateById(machine, machine.initialId)?.y ?? 90} H ${(stateById(machine, machine.initialId)?.x ?? 90) - 28}`} stroke="#60a5fa" markerEnd="url(#fsm-arrow)" fill="none" /> : null}
      <text x="8" y={(stateById(machine, machine.initialId)?.y ?? 90) - 8} fontSize="11" fill="#64748b">Start</text>
      {machine.transitions.map((item) => {
        const from = stateById(machine, item.from);
        const to = stateById(machine, item.to);
        if (!from || !to) return null;
        const loop = from.id === to.id;
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2 - (from.y === to.y ? 16 : 0);
        const path = loop
          ? `M ${from.x - 8} ${from.y - 22} C ${from.x - 36} ${from.y - 70}, ${from.x + 36} ${from.y - 70}, ${from.x + 12} ${from.y - 22}`
          : `M ${from.x + 26} ${from.y} Q ${midX} ${midY - 10} ${to.x - 26} ${to.y}`;
        return (
          <g key={item.id} onClick={() => { setEdge(item.id); onSelect(from.id); }}>
            <path d={path} fill="none" stroke={edge === item.id || current === from.id ? "#2563eb" : "#93c5fd"} strokeWidth={edge === item.id ? 2.5 : 1.6} markerEnd="url(#fsm-arrow)" />
            <text x={loop ? from.x : midX} y={loop ? from.y - 62 : midY - 8} textAnchor="middle" fontSize="12" fontWeight="700" fill="#2563eb">{item.when}{machine.kind === "mealy" ? `/${item.output}` : ""}</text>
          </g>
        );
      })}
      {machine.states.map((state) => (
        <g key={state.id} onPointerDown={(event) => {
          const svg = event.currentTarget.ownerSVGElement;
          if (!svg) return;
          const rect = svg.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 560;
          const y = ((event.clientY - rect.top) / rect.height) * 210;
          setDrag({ id: state.id, dx: x - state.x, dy: y - state.y });
          onSelect(state.id);
        }}>
          <circle cx={state.x} cy={state.y} r="26" fill={state.id === current ? "#eff6ff" : "white"} stroke={state.id === selected || state.id === machine.initialId ? "#2563eb" : "#93c5fd"} strokeWidth={state.id === selected ? 3 : 1.6} />
          {state.id === machine.initialId ? <circle cx={state.x} cy={state.y} r="30" fill="none" stroke="#2563eb" /> : null}
          <text x={state.x} y={state.y - 2} textAnchor="middle" fontSize="13" fontWeight="800">{state.name}</text>
          <text x={state.x} y={state.y + 14} textAnchor="middle" fontSize="11" fill="#64748b">{machine.kind === "moore" ? state.output : "·"}</text>
        </g>
      ))}
    </svg>
  );
}

function TablePage({ machine, symbols, current, onChange }: { machine: FsmMachine; symbols: string[]; current: string; onChange: (machine: FsmMachine) => void }) {
  return (
    <section className="lgx-card">
      <h3>State Table</h3>
      <p className="tiny">Edit the next state for each input. The diagram uses the same transitions.</p>
      <table className="lgx-table">
        <thead><tr><th>Present</th>{symbols.map((symbol) => <th key={symbol}>Input {symbol}</th>)}<th>Output</th></tr></thead>
        <tbody>
          {machine.states.map((state) => (
            <tr key={state.id} className={state.id === current ? "on" : ""}>
              <td>{state.name}</td>
              {symbols.map((symbol) => {
                const edge = chosenTransition(machine, state.id, symbol);
                return (
                  <td key={symbol}>
                    <select aria-label={`${state.name} on ${symbol}`} value={edge?.to ?? ""} onChange={(event) => onChange(retarget(machine, state.id, symbol, event.target.value))}>
                      <option value="">—</option>
                      {machine.states.map((next) => <option key={next.id} value={next.id}>{next.name}</option>)}
                    </select>
                  </td>
                );
              })}
              <td><input aria-label={`${state.name} output`} value={state.output} onChange={(event) => onChange(setOutput(machine, state.id, event.target.value))} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function retarget(machine: FsmMachine, from: string, symbol: string, to: string): FsmMachine {
  let next = machine;
  for (const edge of machine.transitions) {
    if (edge.from === from && conditionMatches(machine, edge.when, symbol)) next = removeTransition(next, edge.id);
  }
  if (!to) return next;
  return addTransition(next, from, to, symbol, "0");
}

function MinPage({ machine, onUse }: { machine: FsmMachine; onUse: (machine: FsmMachine) => void }) {
  const result = useMemo(() => minimizeMachine(machine), [machine]);
  return (
    <section className="lgx-card">
      <h3>State Minimization</h3>
      <p>{result.reason}</p>
      {result.steps.map((step) => (
        <p key={step.label}><strong>{step.label}:</strong> {step.blocks.map((block) => `{${block.map((id) => stateById(machine, id)?.name ?? id).join(", ")}}`).join("  ")}</p>
      ))}
      {result.machine ? <Button variant="primary" onClick={() => onUse(result.machine as FsmMachine)}>Use minimized machine</Button> : null}
    </section>
  );
}

function ExamplesPage({ onUse }: { onUse: (machine: FsmMachine) => void }) {
  return (
    <div className="grid cards-3">
      {FSM_EXAMPLES.map((example) => (
        <section key={example.id} className="lgx-card">
          <h3>{example.label}</h3>
          <Button variant="primary" onClick={() => onUse(example.build())}>Load into studio</Button>
        </section>
      ))}
      <SynthesisNote />
    </div>
  );
}

function SynthesisNote() {
  const circuit = useMemo(() => synthesizeD(demoMachine()), []);
  return (
    <section className="lgx-card">
      <h3>D synthesis of the sketch</h3>
      <p className="tiny">{circuit.reason}</p>
      {circuit.equations.slice(0, 2).map((row) => <p key={row.signal}><strong>{row.signal}</strong> = {row.expression}</p>)}
    </section>
  );
}
