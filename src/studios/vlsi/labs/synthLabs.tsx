import { useMemo, useState } from "react";
import {
  RTL_EXAMPLES,
  classifyRtl,
  designGates,
  fsmHardware,
  mapNetwork,
  mappedCost,
  networkMetrics,
  optimizeBoolean,
  optimizeNetwork,
  synthesisDemo,
  type FsmEncode,
  type MapTarget,
} from "../flowModel";
import { VlsiGrid } from "../shell";
import { Badge, Choice, Measure, Observe } from "../widgets";

export function RtlLab() {
  const [exampleId, setExampleId] = useState(RTL_EXAMPLES[0]?.id ?? "assign");
  const [line, setLine] = useState(1);
  const [block, setBlock] = useState("logic");
  const [custom, setCustom] = useState("assign y = a & b;");
  const example = RTL_EXAMPLES.find((item) => item.id === exampleId) ?? RTL_EXAMPLES[0];
  const verdict = classifyRtl(custom);
  if (!example) {
    return <VlsiGrid controls={<p>No example is loaded.</p>} stage={<p className="vlsi-callout">The RTL subset is empty.</p>} readouts={<p />} />;
  }
  const activeBlock = example.lines.find((item) => item.line === line)?.block ?? block;
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Example" value={example.id} options={RTL_EXAMPLES.map((item) => ({ id: item.id, label: item.title }))} onChange={(value) => { setExampleId(value); setLine(1); }} />
          <label className="vlsi-slider">
            <span>Try a line</span>
            <textarea aria-label="RTL source" value={custom} onChange={(event) => setCustom(event.target.value)} rows={4} />
          </label>
          <Badge tone={verdict.supported ? "on" : "bad"}>{verdict.supported ? verdict.blocks.join(", ") || "logic" : verdict.reason}</Badge>
          <Observe
            change="Click a line of the example, or type fork, generate, or $display."
            see="A supported line lights the hardware block. An unsupported word is rejected."
            why="This is a small Verilog subset: assign, if, +, registers, and case."
            experiment="Open the counter and click the add line, then the clocked line."
            takeaway="The picture is the hardware the line names, not a full compiler."
          />
        </>
      }
      stage={
        <>
          <h2>{example.title}</h2>
          <div className="vlsi-split">
            <div className="vlsi-code">
              {example.lines.map((item) => (
                <button key={item.line} type="button" className={item.line === line || item.block === block ? "on" : ""} onClick={() => { setLine(item.line); setBlock(item.block); }}>{item.text}</button>
              ))}
            </div>
            <svg className="vlsi-layout" viewBox="0 0 220 160" role="img" aria-label="Hardware blocks">
              {example.blocks.map((item, index) => (
                <g key={item.id} onClick={() => { setBlock(item.id); const match = example.lines.find((lineItem) => lineItem.block === item.id); if (match) setLine(match.line); }}>
                  <rect x="20" y={16 + index * 36} width="160" height="28" className={item.id === activeBlock ? "vlsi-gate on" : "vlsi-gate"} />
                  <text className="vlsi-svg-label" x="28" y={34 + index * 36}>{item.label}</text>
                </g>
              ))}
            </svg>
          </div>
        </>
      }
      readouts={
        <>
          <Measure label="Selected line" value={String(line)} />
          <Measure label="Block" value={activeBlock} />
          <Measure label="Clocked" value={example.blocks.some((item) => item.kind === "register") ? "yes" : "no"} />
        </>
      }
    />
  );
}

export function SynthesisLab() {
  const demo = useMemo(() => synthesisDemo(), []);
  const [design, setDesign] = useState<"adder" | "mux" | "counter">("adder");
  const before = designGates(design);
  const primary = design === "adder" ? ["sum", "cout"] : design === "counter" ? ["n0", "n1"] : ["y"];
  const after = optimizeNetwork(before, primary);
  const beforeM = networkMetrics(demo.before);
  const afterM = networkMetrics(demo.after);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Example network" value={design} options={[{ id: "adder", label: "Adder" }, { id: "mux", label: "Mux" }, { id: "counter", label: "Counter" }]} onChange={setDesign} />
          <Observe
            change="Read the rewrite list. The adder, mux, and counter are already small, so they may not shrink."
            see="The demonstration network drops a double inversion, a duplicate AND, and a dead gate."
            why="Educational synthesis: constant fold, involution, common subexpressions, then dead-code removal."
            experiment="Compare gate count on the demonstration before and after."
            takeaway="This is not a commercial synthesizer. It shows a few real rewrites."
          />
        </>
      }
      stage={
        <>
          <h2>Boolean network</h2>
          <ul className="vlsi-drc-list">
            {demo.steps.map((step) => <li key={step} className="vlsi-callout">{step}</li>)}
          </ul>
          <div className="vlsi-split">
            <section>
              <h3>Before</h3>
              {demo.before.map((gate) => <p key={gate.id} className="vlsi-callout">{gate.output} = {gate.op} {gate.inputs.join(" ")}</p>)}
            </section>
            <section>
              <h3>After</h3>
              {demo.after.map((gate) => <p key={gate.id} className="vlsi-callout">{gate.output} = {gate.op} {gate.inputs.join(" ")}</p>)}
            </section>
          </div>
        </>
      }
      readouts={
        <>
          <Measure label="Demo gates before" value={String(beforeM.count)} />
          <Measure label="Demo gates after" value={String(afterM.count)} />
          <Measure label="Demo depth before" value={String(beforeM.depth)} />
          <Measure label="Demo depth after" value={String(afterM.depth)} />
          <Measure label={`${design} gates`} value={String(networkMetrics(after.gates).count)} hint={`${networkMetrics(before).count} before this design's rewrites`} />
          <Measure label="Estimated area" value={afterM.area.toFixed(1)} />
          <Measure label="Estimated delay" value={`${afterM.delay.toFixed(0)} ps`} />
        </>
      }
    />
  );
}

export function MappingLab() {
  const [target, setTarget] = useState<MapTarget>("balanced");
  const gates = useMemo(() => [
    { id: "and1", op: "and" as const, inputs: ["a", "b"], output: "ab" },
    { id: "inv1", op: "not" as const, inputs: ["ab"], output: "y" },
    { id: "or1", op: "or" as const, inputs: ["y", "c"], output: "z" },
  ], []);
  const mapped = mapNetwork(gates, target);
  const cost = mappedCost(mapped, 8);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Target" value={target} options={[{ id: "area", label: "Area" }, { id: "timing", label: "Timing" }, { id: "power", label: "Power" }, { id: "balanced", label: "Balanced" }]} onChange={setTarget} />
          <Observe
            change="Switch the target from area (X1) to timing (X4)."
            see="The same NAND2 replacement stays, and delay drops because the library cell is sized up."
            why="AND plus INV with a single fanout becomes NAND2. A lone OR becomes NOR2 plus INV."
            experiment="Watch cell area and delay while you change the target."
            takeaway="Mapping uses the educational library, so the numbers match the cell explorer."
          />
        </>
      }
      stage={
        <>
          <h2>Generic netlist and mapped cells</h2>
          <div className="vlsi-split">
            <section>
              <h3>Generic</h3>
              {gates.map((gate) => {
                const covered = mapped.some((cell) => cell.replaced.includes(gate.id) && cell.cell === "NAND2");
                return <p key={gate.id} className="vlsi-callout">{covered ? "→ " : ""}{gate.output} = {gate.op}({gate.inputs.join(", ")})</p>;
              })}
            </section>
            <section>
              <h3>Mapped</h3>
              {mapped.map((cell) => (
                <p key={cell.id} className="vlsi-callout">{cell.cell} X{cell.drive} · {cell.output} · replaced {cell.replaced.join("+")}</p>
              ))}
            </section>
          </div>
        </>
      }
      readouts={
        <>
          <Measure label="Cells" value={String(cost.count)} />
          <Measure label="Area" value={cost.area.toFixed(1)} />
          <Measure label="Delay" value={`${cost.delay.toFixed(1)} ps`} />
          <Measure label="Power" value={cost.power.toFixed(2)} />
          <Badge tone="info">Educational library</Badge>
        </>
      }
    />
  );
}

const EXPRESSIONS = ["!!a", "a & 1", "(a & b) | (a & !b)", "a | (a & b)"];

export function BooleanOptLab() {
  const [expression, setExpression] = useState(EXPRESSIONS[0] ?? "!!a");
  const result = optimizeBoolean(expression);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Expression" value={expression} options={EXPRESSIONS.map((id) => ({ id, label: id }))} onChange={setExpression} />
          <Observe
            change="Pick a different expression."
            see="Gate count and depth come from the existing Boolean simplifier."
            why="The VLSI lab only frames that result with area and delay estimates."
            experiment="Compare !!a with a & 1."
            takeaway="The original Boolean studio is unchanged."
          />
        </>
      }
      stage={
        <>
          <h2>Before and after</h2>
          <p className="vlsi-callout">Before: {result.before}</p>
          <p className="vlsi-callout">After: {result.after}</p>
          <ul className="vlsi-drc-list">
            {result.steps.map((step) => <li key={`${step.law}-${step.after}`} className="vlsi-callout">{step.law}: {step.before} → {step.after}</li>)}
          </ul>
        </>
      }
      readouts={
        <>
          <Measure label="Gates before" value={String(result.beforeGates)} />
          <Measure label="Gates after" value={String(result.afterGates)} />
          <Measure label="Depth before" value={String(result.beforeDepth)} />
          <Measure label="Depth after" value={String(result.afterDepth)} />
          <Measure label="Area estimate" value={`${result.areaBefore.toFixed(1)} → ${result.areaAfter.toFixed(1)}`} />
          <Measure label="Delay estimate" value={`${result.delayBefore.toFixed(0)} → ${result.delayAfter.toFixed(0)} ps`} />
        </>
      }
    />
  );
}

export function FsmSynthLab() {
  const [encoding, setEncoding] = useState<FsmEncode>("binary");
  const hardware = fsmHardware(encoding);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Encoding" value={encoding} options={[{ id: "binary", label: "Binary" }, { id: "one-hot", label: "One-hot" }, { id: "gray", label: "Gray" }]} onChange={setEncoding} />
          <Observe
            change="Switch between binary, one-hot, and Gray."
            see="One-hot uses one flip-flop per state. Binary and Gray use two for four states."
            why="Flip-flop count comes from the existing encoder. Gray is the binary index with a single-bit difference."
            experiment="Compare area: more registers, often less next-state logic."
            takeaway="Encoding changes the hardware, not the state sequence."
          />
        </>
      }
      stage={
        <>
          <h2>State register and next-state logic</h2>
          <svg className="vlsi-layout" viewBox="0 0 360 140" role="img" aria-label="FSM hardware">
            <rect x="16" y="40" width="90" height="50" className="vlsi-gate" />
            <text className="vlsi-svg-label" x="24" y="68">Next state</text>
            {hardware.codes.map((code, index) => (
              <g key={code}>
                <rect x={130 + index * 52} y="36" width="44" height="58" className="vlsi-gate on" />
                <text className="vlsi-svg-label" x={136 + index * 52} y="60">FF{index}</text>
                <text className="vlsi-svg-label" x={136 + index * 52} y="78">{code}</text>
              </g>
            ))}
            <rect x="130" y="104" width="120" height="24" className="vlsi-gate" />
            <text className="vlsi-svg-label" x="140" y="120">Output logic</text>
          </svg>
          <p className="vlsi-callout">{hardware.note}</p>
        </>
      }
      readouts={
        <>
          <Measure label="Flip-flops" value={String(hardware.flipFlops)} />
          <Measure label="Next-state gates" value={String(hardware.logicGates)} />
          <Measure label="Area estimate" value={hardware.area.toFixed(1)} />
          <Measure label="Delay estimate" value={`${hardware.delay.toFixed(0)} ps`} />
          <Measure label="Codes" value={hardware.codes.join(" ")} />
        </>
      }
    />
  );
}
