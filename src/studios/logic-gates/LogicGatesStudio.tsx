import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GATE_EXPRESSIONS, evalGate, propagateDelay, resolveDrivers } from "../../simulation/digital/gates";
import type { GateKind, LogicValue } from "../../types/logic";
import { Card, ExplainBar, Segmented, SimControls, Toggle } from "../../design-system/ui";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";

const TABS = [
  { id: "build", label: "Build & Simulate" },
  { id: "universal", label: "Universal Gates" },
  { id: "multi", label: "Multi-input" },
  { id: "delay", label: "Propagation Delay" },
  { id: "fan", label: "Fan-in / Fan-out" },
  { id: "tri", label: "Tri-state" },
];

const GATES: GateKind[] = ["BUF", "NOT", "AND", "OR", "NAND", "NOR", "XOR", "XNOR"];

export function LogicGatesStudio() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "build";
  const { prefs } = usePrefs();
  const [resetKey, setResetKey] = useState(0);
  return (
    <StudioFrame icon="gate" title="Logic Gates Studio" description="Toggle an input and the wire, symbol, and truth table change together." tabs={TABS} tab={tab} onTab={(id) => setParams({ tab: id })} onReset={() => setResetKey((n) => n + 1)} guide={["Pick a gate and set its inputs", "Read the signal label, not only the color", "Compare a gate with its NAND-only form", "Step a delayed output on the timeline"]} takeaways={["0 and 1 are levels with names", "NAND and NOR are universal", "Z means the output has let go of the wire"]}>
      <div key={resetKey}>
        {prefs.explain ? <ExplainBar what="Input switches drive the gate engine." why="Each gate has a fixed rule. AND is 1 only when every input is 1." notice="High wires are thicker and labeled 1. Floating wires are dashed and labeled Z." /> : null}
        {tab === "build" ? <Explorer /> : null}
        {tab === "universal" ? <Universal /> : null}
        {tab === "multi" ? <Multi /> : null}
        {tab === "delay" ? <DelayLab /> : null}
        {tab === "fan" ? <FanLab /> : null}
        {tab === "tri" ? <TriLab /> : null}
      </div>
    </StudioFrame>
  );
}

export function GateSymbol({ kind, output }: { kind: GateKind; output?: LogicValue }) {
  const bubble = kind === "NAND" || kind === "NOR" || kind === "XNOR" || kind === "NOT";
  const body = kind === "NOT" || kind === "BUF" ? "buffer" : kind.includes("AND") || kind === "NAND" ? "and" : "or";
  const xor = kind === "XOR" || kind === "XNOR";
  return (
    <svg viewBox="0 0 140 80" width="180" height="100" role="img" aria-label={`${kind} gate output ${output ?? ""}`}>
      {xor ? <path d="M18 16c18 10 18 38 0 48" className="wire low" /> : null}
      {body === "buffer" ? <path d="M28 16 L78 40 L28 64 Z" fill="#fff" stroke="#122033" strokeWidth="2" /> : null}
      {body === "and" ? <path d="M28 16 H62 C86 16 86 64 62 64 H28 Z" fill="#fff" stroke="#122033" strokeWidth="2" /> : null}
      {body === "or" ? <path d="M28 16 C48 16 70 24 86 40 C70 56 48 64 28 64 C42 48 42 32 28 16 Z" fill="#fff" stroke="#122033" strokeWidth="2" /> : null}
      {bubble ? <circle cx="96" cy="40" r="6" fill="#fff" stroke="#122033" strokeWidth="2" /> : null}
      <path d={bubble ? "M102 40 H124" : "M86 40 H124"} className={output === 1 ? "wire high" : output === "Z" ? "wire z" : output === "X" ? "wire x" : "wire low"} />
      <text x="112" y="28" fontSize="11">{output ?? ""}</text>
    </svg>
  );
}

function Explorer() {
  const [kind, setKind] = useState<GateKind>("AND");
  const [a, setA] = useState<0 | 1>(0);
  const [b, setB] = useState<0 | 1>(1);
  const inputs = kind === "NOT" || kind === "BUF" ? [a] : [a, b];
  const output = evalGate(kind, inputs);
  const rows = useMemo(() => truthOf(kind), [kind]);
  return (
    <div className="grid cards-2">
      <Card title="Gate explorer">
        <div className="row">{GATES.map((gate) => <button key={gate} className={gate === kind ? "btn-primary" : "btn-ghost"} onClick={() => setKind(gate)}>{gate}</button>)}</div>
        <div className="row" style={{ marginTop: 8 }}>
          <Wire name="A" value={a} onToggle={() => setA(a === 1 ? 0 : 1)} />
          {inputs.length > 1 ? <Wire name="B" value={b} onToggle={() => setB(b === 1 ? 0 : 1)} /> : null}
        </div>
        <GateSymbol kind={kind} output={output} />
        <p className="mono">{GATE_EXPRESSIONS[kind](inputs.length > 1 ? ["A", "B"] : ["A"])}</p>
      </Card>
      <Card title="Truth table">
        <table className="data"><tbody>{rows.map((row) => <tr key={row} className={row.startsWith(inputs.join("")) ? "active" : ""}><td className="mono">{row}</td></tr>)}</tbody></table>
      </Card>
    </div>
  );
}

function Wire({ name, value, onToggle }: { name: string; value: LogicValue; onToggle?: () => void }) {
  return <button className={value === 1 ? "bit on" : "bit"} onClick={onToggle} aria-label={`${name} is ${value}`}>{name} {value}</button>;
}

function truthOf(kind: GateKind): string[] {
  const width = kind === "NOT" || kind === "BUF" ? 1 : 2;
  const rows: string[] = [];
  for (let i = 0; i < 2 ** width; i += 1) {
    const inputs = Array.from({ length: width }, (_, bit) => (((i >> (width - 1 - bit)) & 1) === 1 ? 1 : 0) as 0 | 1);
    rows.push(`${inputs.join(" ")} → ${evalGate(kind, inputs)}`);
  }
  return rows;
}

function Universal() {
  const [a, setA] = useState<0 | 1>(1);
  const [b, setB] = useState<0 | 1>(0);
  const nand = (x: LogicValue, y: LogicValue) => evalGate("NAND", [x, y]);
  const notN = nand(a, a);
  const andN = nand(nand(a, b), nand(a, b));
  const orN = nand(nand(a, a), nand(b, b));
  const nor = (x: LogicValue, y: LogicValue) => evalGate("NOR", [x, y]);
  return (
    <div className="grid cards-2">
      <Card title="NAND-only">
        <div className="row"><Wire name="A" value={a} onToggle={() => setA(a ? 0 : 1)} /><Wire name="B" value={b} onToggle={() => setB(b ? 0 : 1)} /></div>
        <p>NOT {notN} matches {evalGate("NOT", [a])}</p>
        <p>AND {andN} matches {evalGate("AND", [a, b])}</p>
        <p>OR {orN} matches {evalGate("OR", [a, b])}</p>
      </Card>
      <Card title="NOR-only">
        <p>NOT {nor(a, a)} matches {evalGate("NOT", [a])}</p>
        <p>OR {nor(nor(a, b), nor(a, b))} matches {evalGate("OR", [a, b])}</p>
        <p>AND {nor(nor(a, a), nor(b, b))} matches {evalGate("AND", [a, b])}</p>
      </Card>
    </div>
  );
}

function Multi() {
  const [count, setCount] = useState(3);
  const [kind, setKind] = useState<GateKind>("AND");
  const [bits, setBits] = useState<Array<0 | 1>>([1, 1, 0, 1, 0, 0, 1, 0]);
  const inputs = bits.slice(0, count);
  return (
    <Card title="Input count">
      <Segmented options={["2", "3", "4", "8"]} value={String(count)} onChange={(v) => setCount(Number(v))} />
      <div className="row" style={{ margin: "8px 0" }}>{GATES.filter((g) => g !== "NOT" && g !== "BUF" && g !== "TRI").map((g) => <button key={g} className={g === kind ? "btn-primary" : "btn-ghost"} onClick={() => setKind(g)}>{g}</button>)}</div>
      <div className="bits">{inputs.map((bit, i) => <button key={i} className={bit ? "bit on" : "bit"} onClick={() => setBits((prev) => prev.map((b, idx) => idx === i ? (b ? 0 : 1) : b))}>{bit}</button>)}</div>
      <p>Y = {evalGate(kind, inputs)}</p>
    </Card>
  );
}

function DelayLab() {
  const [input, setInput] = useState<0 | 1>(0);
  const [delay, setDelay] = useState(10);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const samples = propagateDelay(input === 1 ? 0 : 1, input, delay, delay + 10);
  const shown = samples[Math.min(step, samples.length - 1)];
  return (
    <Card title="Timeline">
      <div className="row">
        <Wire name="A" value={input} onToggle={() => { setInput(input ? 0 : 1); setStep(0); }} />
        <label>Delay ns <input type="number" min={1} max={50} value={delay} onChange={(e) => setDelay(Number(e.target.value))} /></label>
      </div>
      <SimControls playing={playing} onPlay={() => setPlaying((p) => !p)} onStep={() => setStep((s) => Math.min(samples.length - 1, s + 1))} onReset={() => { setStep(0); setPlaying(false); }} />
      <DelayTicker playing={playing} onTick={() => setStep((s) => (s + 1) % samples.length)} />
      <p>t = {shown?.timeNs ?? 0} ns · Y = {shown?.output ?? input}</p>
      <svg viewBox="0 0 240 60" width="100%" height="70" aria-label="Timing waveform">
        <path d={wave(samples.map((s) => s.output), 240)} className="wire high" />
      </svg>
    </Card>
  );
}

function DelayTicker({ playing, onTick }: { playing: boolean; onTick: () => void }) {
  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(onTick, 700);
    return () => window.clearInterval(id);
  }, [playing, onTick]);
  return null;
}

function wave(values: LogicValue[], width: number): string {
  const high = 16;
  const low = 44;
  return values.map((value, index) => `${index === 0 ? "M" : "L"} ${(index / Math.max(values.length - 1, 1)) * width} ${value === 1 ? high : low}`).join(" ");
}

function FanLab() {
  const [fanIn, setFanIn] = useState(3);
  const [fanOut, setFanOut] = useState(3);
  const [bits, setBits] = useState<Array<0 | 1>>([1, 0, 1, 1]);
  const output = evalGate("AND", bits.slice(0, fanIn));
  return (
    <div className="grid cards-2">
      <Card title="Fan-in">
        <input type="range" min={2} max={4} value={fanIn} aria-label="Fan-in" onChange={(e) => setFanIn(Number(e.target.value))} />
        <div className="bits">{bits.slice(0, fanIn).map((bit, i) => <button key={i} className={bit ? "bit on" : "bit"} onClick={() => setBits((p) => p.map((b, idx) => idx === i ? (b ? 0 : 1) : b))}>{bit}</button>)}</div>
        <p>{fanIn} inputs feed one AND. Y = {output}</p>
      </Card>
      <Card title="Fan-out">
        <input type="range" min={1} max={4} value={fanOut} aria-label="Fan-out" onChange={(e) => setFanOut(Number(e.target.value))} />
        <p>One output {output} drives {fanOut} inputs. This view counts loads; it does not model analog current.</p>
        <div className="row">{Array.from({ length: fanOut }, (_, i) => <span key={i} className={output === 1 ? "bit on" : "bit"}>L{i}</span>)}</div>
      </Card>
    </div>
  );
}

function TriLab() {
  const [d0, setD0] = useState<0 | 1>(1);
  const [e0, setE0] = useState(true);
  const [d1, setD1] = useState<0 | 1>(0);
  const [e1, setE1] = useState(false);
  const left = evalGate("TRI", [d0, e0 ? 1 : 0]);
  const right = evalGate("TRI", [d1, e1 ? 1 : 0]);
  const bus = resolveDrivers([left, right]);
  return (
    <Card title="Shared bus">
      <div className="row"><span>Driver A data</span><Wire name="D" value={d0} onToggle={() => setD0(d0 ? 0 : 1)} /><span>Enable</span><Toggle on={e0} label="Enable A" onChange={setE0} /></div>
      <div className="row"><span>Driver B data</span><Wire name="D" value={d1} onToggle={() => setD1(d1 ? 0 : 1)} /><span>Enable</span><Toggle on={e1} label="Enable B" onChange={setE1} /></div>
      <p>A drives {left}. B drives {right}. Bus is {bus}.</p>
      <p className="tiny">{bus === "X" ? "Both drivers are forcing different levels. That is a contention, shown as X." : bus === "Z" ? "Nobody is driving. The bus floats at Z." : "Exactly one driver owns the wire, which is how a shared bus stays valid."}</p>
    </Card>
  );
}
