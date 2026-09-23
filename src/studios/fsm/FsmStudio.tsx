import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStudioTab } from "../../layout/useStudioTab";
import { Button, Card, ExplainBar, Metric, Segmented } from "../../design-system/ui";
import { encodeStates } from "../../engines/fsm/encoding";
import { FSM_EXAMPLES } from "../../engines/fsm/examples";
import { minimizeMachine } from "../../engines/fsm/minimization";
import { parseStream, runSequence, stepMachine } from "../../engines/fsm/simulator";
import { addState, addTransition, blankMachine, moveState, removeState, removeTransition, renameState, setInitial, setOutput, stateById, symbolsOf, updateTransition, type FsmMachine } from "../../engines/fsm/stateMachine";
import { synthesizeD } from "../../engines/fsm/synthesis";
import { chosenTransition, conditionMatches } from "../../engines/fsm/transition";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";
import { saveRecord } from "../../store/projects";

const TABS = [
  { id: "diagram", label: "State Diagram" },
  { id: "table", label: "State Table" },
  { id: "encoding", label: "Encoding" },
  { id: "minimize", label: "Minimization" },
  { id: "examples", label: "Examples" },
  { id: "circuit", label: "Synthesis" },
];

export function FsmStudio() {
  const [tab, setTab] = useStudioTab(TABS, "diagram");
  const [machine, setMachine] = useState<FsmMachine>(blankMachine);
  const [current, setCurrent] = useState(machine.initialId);
  const [selected, setSelected] = useState(machine.initialId);
  const [stream, setStream] = useState("1 0 1 1 0 1");
  const [index, setIndex] = useState(0);
  const [last, setLast] = useState("Reset to the initial state.");
  const [playing, setPlaying] = useState(false);
  const { prefs } = usePrefs();
  const symbols = useMemo(() => columnSymbols(machine), [machine]);
  const active = stateById(machine, current);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      const values = parseStream(stream);
      setIndex((cursor) => {
        const symbol = values[cursor];
        if (!symbol) {
          setPlaying(false);
          return cursor;
        }
        setCurrent((state) => {
          const step = stepMachine(machine, state, symbol);
          setLast(step.explain);
          return step.toId;
        });
        return cursor + 1;
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [playing, stream, machine]);

  function reset() {
    setPlaying(false);
    setCurrent(machine.initialId);
    setIndex(0);
    setLast("Reset to the initial state. Moore output follows the current state; Mealy output waits for an input.");
  }

  function step() {
    const symbol = parseStream(stream)[index];
    if (!symbol) return;
    const moved = stepMachine(machine, current, symbol);
    setCurrent(moved.toId);
    setLast(moved.explain);
    setIndex(index + 1);
  }

  return (
    <StudioFrame
      icon="map"
      title="Finite State Machines"
      description="Draw states, label transitions, and step an input stream through a Moore or Mealy machine."
      tabs={TABS}
      tab={tab}
      onTab={setTab}
      onReset={() => { setMachine(blankMachine()); reset(); }}
      guide={["A Moore output belongs to the state.", "A Mealy output belongs to the transition.", "Minimization merges states with the same future behavior."]}
      takeaways={["Binary encoding uses fewer flip-flops.", "One-hot uses one flip-flop per state.", "D synthesis turns the next-state table into equations."]}
    >
      {prefs.explain ? <ExplainBar what={last} why={machine.kind === "moore" ? "The output is a function of the state you are in after the clock." : "The output is a function of the state and the input that caused the transition."} notice="The highlighted edge is the transition that matched." /> : null}
      {tab === "diagram" ? (
        <div className="builder">
          <Card title="Machine">
            <Segmented options={["Moore", "Mealy"]} value={machine.kind === "moore" ? "Moore" : "Mealy"} onChange={(value) => setMachine({ ...machine, kind: value === "Moore" ? "moore" : "mealy" })} />
            <div className="row" style={{ marginTop: 8 }}>
              <Button onClick={() => setMachine(addState(machine))}>Add state</Button>
              <Button onClick={() => { setMachine(removeState(machine, selected)); }}>Delete</Button>
              <Button onClick={() => setMachine(setInitial(machine, selected))}>Initial</Button>
            </div>
            <label className="tiny">Name<input className="text-input" value={stateById(machine, selected)?.name ?? ""} onChange={(event) => setMachine(renameState(machine, selected, event.target.value))} /></label>
            <label className="tiny">Moore output<input className="text-input" value={stateById(machine, selected)?.output ?? ""} onChange={(event) => setMachine(setOutput(machine, selected, event.target.value))} /></label>
            <Button onClick={() => void saveRecord({ id: `fsm-${machine.name}`, kind: "fsm", name: machine.name, data: JSON.stringify(machine), updated: Date.now() })}>Save FSM</Button>
          </Card>
          <Card title={machine.name}>
            <Diagram machine={machine} current={current} selected={selected} onSelect={setSelected} onMove={(id, x, y) => setMachine(moveState(machine, id, x, y))} />
          </Card>
          <Card title="Step">
            <label className="tiny">Input stream<input className="text-input" aria-label="Input stream" value={stream} onChange={(event) => { setStream(event.target.value); setIndex(0); }} /></label>
            <div className="row">
              <Button variant="primary" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play"}</Button>
              <Button onClick={step}>Step</Button>
              <Button onClick={reset}>Reset</Button>
            </div>
            <Metric label="Current" value={active?.name ?? "—"} />
            <Metric label="Output" value={active && machine.kind === "moore" ? active.output : "—"} />
            <p className="tiny">Next symbol: {parseStream(stream)[index] ?? "end"}</p>
          </Card>
        </div>
      ) : null}
      {tab === "table" ? <StateTable machine={machine} symbols={symbols} onChange={setMachine} /> : null}
      {tab === "encoding" ? <EncodingView machine={machine} /> : null}
      {tab === "minimize" ? <MinimizeView machine={machine} onUse={setMachine} /> : null}
      {tab === "examples" ? <ExamplesView onUse={(next) => { setMachine(next); setCurrent(next.initialId); setSelected(next.initialId); setIndex(0); }} /> : null}
      {tab === "circuit" ? <SynthesisView machine={machine} /> : null}
      {tab === "diagram" ? <TransitionEditor machine={machine} onChange={setMachine} /> : null}
    </StudioFrame>
  );
}

function columnSymbols(machine: FsmMachine): string[] {
  const binary = symbolsOf(machine);
  const used = [...new Set(machine.transitions.map((edge) => edge.when))];
  if (used.every((item) => binary.includes(item))) return binary;
  return used.length > 0 ? used : binary;
}

function Diagram({ machine, current, selected, onSelect, onMove }: {
  machine: FsmMachine;
  current: string;
  selected: string;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  return (
    <svg className="canvas" viewBox="0 0 640 320" role="img" aria-label="State diagram"
      onPointerMove={(event) => {
        if (!drag) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 640 - drag.dx;
        const y = ((event.clientY - rect.top) / rect.height) * 320 - drag.dy;
        onMove(drag.id, Math.max(36, Math.min(600, x)), Math.max(36, Math.min(280, y)));
      }}
      onPointerUp={() => setDrag(null)}
    >
      {machine.transitions.map((edge) => {
        const from = stateById(machine, edge.from);
        const to = stateById(machine, edge.to);
        if (!from || !to) return null;
        const loop = from.id === to.id;
        const x2 = loop ? from.x + 28 : to.x;
        const y2 = loop ? from.y - 36 : to.y;
        const active = current === from.id;
        return (
          <g key={edge.id}>
            <path d={loop ? `M ${from.x - 10} ${from.y - 24} C ${from.x - 40} ${from.y - 80}, ${from.x + 40} ${from.y - 80}, ${from.x + 16} ${from.y - 24}` : `M ${from.x} ${from.y} L ${x2} ${y2}`} fill="none" stroke={active ? "#2F6FED" : "#8AA0BD"} strokeWidth={active ? 3 : 1.5} markerEnd="url(#arrow)" />
            <text x={(from.x + x2) / 2} y={(from.y + y2) / 2 - 6} textAnchor="middle" fontSize="11" fontWeight="700">{edge.when}{machine.kind === "mealy" ? ` / ${edge.output}` : ""}</text>
          </g>
        );
      })}
      {machine.states.map((state) => (
        <g key={state.id} onPointerDown={(event) => {
          const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 640;
          const y = ((event.clientY - rect.top) / rect.height) * 320;
          setDrag({ id: state.id, dx: x - state.x, dy: y - state.y });
          onSelect(state.id);
        }}>
          {state.id === current ? <circle cx={state.x} cy={state.y} r="38" fill="none" stroke="#2F6FED" strokeWidth="3" strokeDasharray="4 3" /> : null}
          <rect x={state.x - 32} y={state.y - 24} width="64" height="48" rx="14" fill={state.id === selected ? "#E8F0FE" : "white"} stroke={state.id === machine.initialId ? "#2F6FED" : "#C5D2E4"} strokeWidth={state.id === machine.initialId ? 3 : 1.5} />
          <text x={state.x} y={state.y - 2} textAnchor="middle" fontSize="13" fontWeight="800">{state.name}</text>
          <text x={state.x} y={state.y + 14} textAnchor="middle" fontSize="10" fill="#5C6F89">{machine.kind === "moore" ? state.output : "Mealy"}</text>
        </g>
      ))}
      <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#8AA0BD" /></marker></defs>
    </svg>
  );
}

function TransitionEditor({ machine, onChange }: { machine: FsmMachine; onChange: (machine: FsmMachine) => void }) {
  const [from, setFrom] = useState(machine.initialId);
  const [to, setTo] = useState(machine.states[1]?.id ?? machine.initialId);
  const [when, setWhen] = useState("1");
  const [output, setOut] = useState("0");
  return (
    <Card title="Transitions">
      <div className="row">
        <select aria-label="From state" value={from} onChange={(event) => setFrom(event.target.value)}>{machine.states.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}</select>
        <input className="text-input" aria-label="Condition" value={when} onChange={(event) => setWhen(event.target.value)} style={{ maxWidth: 120 }} />
        <select aria-label="To state" value={to} onChange={(event) => setTo(event.target.value)}>{machine.states.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}</select>
        <input className="text-input" aria-label="Mealy output" value={output} onChange={(event) => setOut(event.target.value)} style={{ maxWidth: 80 }} />
        <Button variant="primary" onClick={() => onChange(addTransition(machine, from, to, when, output))}>Add</Button>
      </div>
      {machine.transitions.map((edge) => (
        <div key={edge.id} className="spread" style={{ marginTop: 6 }}>
          <span>{stateById(machine, edge.from)?.name} — {edge.when} → {stateById(machine, edge.to)?.name}{machine.kind === "mealy" ? ` / ${edge.output}` : ""}</span>
          <span>
            <input aria-label={`Edit ${edge.id}`} value={edge.when} onChange={(event) => onChange(updateTransition(machine, edge.id, { when: event.target.value }))} style={{ width: 80 }} />
            <Button onClick={() => onChange(removeTransition(machine, edge.id))}>Delete</Button>
          </span>
        </div>
      ))}
    </Card>
  );
}

function StateTable({ machine, symbols, onChange }: { machine: FsmMachine; symbols: string[]; onChange: (machine: FsmMachine) => void }) {
  return (
    <Card title="Derived state table">
      <table className="data">
        <thead><tr><th>Current</th>{symbols.map((symbol) => <th key={symbol}>Input {symbol}</th>)}<th>Output</th></tr></thead>
        <tbody>
          {machine.states.map((state) => (
            <tr key={state.id}>
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
    </Card>
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

function EncodingView({ machine }: { machine: FsmMachine }) {
  const [kind, setKind] = useState("Binary");
  const encoded = encodeStates(machine, kind === "One-hot" ? "one-hot" : "binary");
  return (
    <div className="grid cards-2">
      <Card title="Assignment">
        <Segmented options={["Binary", "One-hot"]} value={kind} onChange={setKind} />
        {encoded.states.map((state) => <div key={state.id} className="spread"><strong>{state.name}</strong><code>{state.code}</code></div>)}
        <Metric label="Flip-flops" value={String(encoded.flipFlops)} />
      </Card>
      <Card title="Trade-off"><p>{encoded.note}</p></Card>
    </div>
  );
}

function MinimizeView({ machine, onUse }: { machine: FsmMachine; onUse: (machine: FsmMachine) => void }) {
  const result = useMemo(() => minimizeMachine(machine), [machine]);
  return (
    <Card title="Partition refinement">
      <p>{result.reason}</p>
      {result.steps.map((step) => (
        <p key={step.label}><strong>{step.label}:</strong> {step.blocks.map((block) => `{${block.map((id) => stateById(machine, id)?.name ?? id).join(", ")}}`).join("  ")}</p>
      ))}
      {result.machine ? <Button variant="primary" onClick={() => onUse(result.machine as FsmMachine)}>Use minimized machine</Button> : null}
    </Card>
  );
}

function ExamplesView({ onUse }: { onUse: (machine: FsmMachine) => void }) {
  return (
    <div className="grid cards-3">
      {FSM_EXAMPLES.map((example) => {
        const built = example.build();
        const demo = example.id === "vend" ? ["5", "5", "5"] : example.id === "light" ? ["1", "1", "1", "1"] : example.id === "lift" ? ["1", "1", "1", "1"] : ["1", "0", "1", "1"];
        const steps = runSequence(built, demo);
        return (
          <Card key={example.id} title={example.label}>
            <p className="tiny">{steps.map((step) => `${step.toName}:${step.output}`).join(" → ")}</p>
            <Button onClick={() => onUse(built)}>Load</Button>
          </Card>
        );
      })}
    </div>
  );
}

function SynthesisView({ machine }: { machine: FsmMachine }) {
  const circuit = useMemo(() => synthesizeD({ ...machine, kind: machine.kind }), [machine]);
  const equation = circuit.equations[0]?.expression ?? "";
  return (
    <Card title="D flip-flop synthesis">
      <p>{circuit.reason}</p>
      {circuit.encoding.map((line) => <div key={line}>{line}</div>)}
      <table className="data">
        <thead><tr><th>Present</th><th>Input</th><th>Next</th><th>Output</th></tr></thead>
        <tbody>{circuit.rows.map((row, index) => <tr key={`${row.present}-${row.input}-${index}`}><td>{row.present}</td><td>{row.input}</td><td>{row.next}</td><td>{row.output}</td></tr>)}</tbody>
      </table>
      {circuit.equations.map((row) => <p key={row.signal}><strong>{row.signal}</strong> = {row.expression}</p>)}
      {circuit.ok ? <Link to={`/studios/boolean-algebra?tab=play&expr=${encodeURIComponent(equation)}`}>Open the next-state equation</Link> : null}
    </Card>
  );
}
