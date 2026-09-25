import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "../../design-system/icons";
import { createPipe, nonPipelinedCycles, speedup, stepPipe, type PipeState, type Slot } from "../../engines/isa/pipeline";

type Page = "simulator" | "registers" | "hazards" | "performance" | "datapath" | "control";

const PAGES: Array<{ id: Page; label: string }> = [
  { id: "simulator", label: "Pipeline Simulator" },
  { id: "registers", label: "Pipeline Registers" },
  { id: "hazards", label: "Hazards & Stalls" },
  { id: "performance", label: "Performance" },
  { id: "datapath", label: "Datapath View" },
  { id: "control", label: "Control Signals" },
];

const PROGRAMS = [
  {
    id: "sample1",
    label: "Sample Program 1",
    source: "LOAD R1, 0(R2)\nADD R1, R1, R3\nSUB R4, R2, R5\nAND R6, R4, R7\nSTORE R6, 0(R2)\nHALT\n",
    lines: ["I1: lw $t0, 0($s1)", "I2: add $t0, $t0, $t3", "I3: sub $t4, $t2, $t5", "I4: and $t6, $t4, $t7", "I5: sw $t6, 0($s4)"],
  },
  {
    id: "sample2",
    label: "Sample Program 2",
    source: "ADDI R1, R0, 5\nADDI R2, R0, 3\nADD R3, R1, R2\nSUB R4, R3, R1\nAND R5, R4, R2\nHALT\n",
    lines: ["I1: addi $t1, $zero, 5", "I2: addi $t2, $zero, 3", "I3: add $t3, $t1, $t2", "I4: sub $t4, $t3, $t1", "I5: and $t5, $t4, $t2"],
  },
  {
    id: "sample3",
    label: "Sample Program 3",
    source: "ADDI R1, R0, 1\nADDI R2, R0, 1\nBEQ R1, R2, 2\nADD R3, R1, R2\nSUB R4, R1, R2\nHALT\n",
    lines: ["I1: addi $t1, $zero, 1", "I2: addi $t2, $zero, 1", "I3: beq $t1, $t2, +2", "I4: add $t3, $t1, $t2", "I5: sub $t4, $t1, $t2"],
  },
];

const CONCEPTS = [
  "What is pipelining?",
  "The 5 pipeline stages (IF, ID, EX, MEM, WB)",
  "Throughput vs. latency",
  "Pipeline hazards (data, control, structural)",
  "Forwarding and stalling",
  "Pipeline registers",
  "Control signals",
  "Speedup and CPI",
  "Load-use hazards",
  "Branch flushing",
  "Instruction overlap",
  "Ideal vs. stalled schedules",
  "Superscalar and advanced pipelining",
];

const STAGES = [
  { id: "IF", title: "Instruction Fetch (IF)", note: "Fetch instruction from memory (PC)", tone: "if" },
  { id: "ID", title: "Instruction Decode (ID)", note: "Decode instruction and read registers", tone: "id" },
  { id: "EX", title: "Execute (EX)", note: "Perform operation (ALU / address calc.)", tone: "ex" },
  { id: "MEM", title: "Memory Access (MEM)", note: "Read or write data memory", tone: "mem" },
  { id: "WB", title: "Write Back (WB)", note: "Write result back to register file", tone: "wb" },
] as const;

function pageOf(raw: string | null): Page {
  if (raw === "registers" || raw === "regs") return "registers";
  if (raw === "hazards") return "hazards";
  if (raw === "performance" || raw === "metrics") return "performance";
  if (raw === "datapath") return "datapath";
  if (raw === "control") return "control";
  return "simulator";
}

function trace(source: string, forwarding: boolean): PipeState[] {
  const created = createPipe(source, { forwarding, data: { 0: 7 } });
  if ("error" in created) return [];
  const frames = [created];
  let state = created;
  for (let index = 0; index < 24 && !state.halted; index += 1) {
    state = stepPipe(state);
    frames.push(state);
  }
  return frames;
}

function labelFor(text: string, lines: string[]): string {
  const pc = Number(text.split("@")[1] ?? -1);
  return lines[pc] ?? text;
}

export function PipelineStudio() {
  const [params, setParams] = useSearchParams();
  const page = pageOf(params.get("tab"));
  const [programId, setProgramId] = useState(PROGRAMS[0]?.id ?? "sample1");
  const [hazard, setHazard] = useState<"stall" | "forward">("stall");
  const [speed, setSpeed] = useState(500);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(6);
  const [stallsOn, setStallsOn] = useState(true);
  const [forwardOn, setForwardOn] = useState(false);
  const [highlight, setHighlight] = useState(true);
  const [concepts, setConcepts] = useState(false);
  const program = PROGRAMS.find((item) => item.id === programId) ?? PROGRAMS[0]!;
  const frames = useMemo(() => trace(program.source, hazard === "forward"), [program.source, hazard]);
  const frame = frames[Math.min(cursor, frames.length - 1)] ?? frames[0];
  const final = frames[frames.length - 1];
  const instructions = program.lines.length;
  const piped = final?.cycles ?? 0;
  const plain = nonPipelinedCycles(instructions);
  const tick = useRef<() => void>(() => undefined);
  tick.current = () => setCursor((value) => (value >= frames.length - 1 ? value : value + 1));

  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => tick.current(), speed);
    return () => window.clearInterval(id);
  }, [playing, speed]);

  function go(next: Page) {
    const query = new URLSearchParams(params);
    query.set("tab", next);
    setParams(query);
  }

  function reload(nextCursor = 6) {
    setPlaying(false);
    setCursor(nextCursor);
  }

  return (
    <div className="pipe">
      <header className="fsmx-head">
        <div className="lgx-title">
          <span className="lgx-mark"><Icon name="step" size={22} /></span>
          <div>
            <p className="tiny">Studio 22</p>
            <h1>CPU Pipelining <span className="fsmx-badge">13 concepts</span></h1>
            <p>Explore how instruction pipelining increases performance. Visualize instruction flow through the 5-stage pipeline and see the impact of hazards and stalls.</p>
          </div>
        </div>
        <button className="lgx-check" type="button" onClick={() => { setProgramId("sample1"); setHazard("stall"); reload(6); go("simulator"); }}>Start Learning</button>
      </header>
      <div className="fsmx-stats">
        <span><b>6</b> interactive labs</span>
        <span><b>13</b> Concepts</span>
        <span>Practice Problems</span>
        <span>Real-World Examples</span>
      </div>
      <div className="lgx-tabs" role="tablist">
        {PAGES.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={page === item.id} className={page === item.id ? "on" : ""} onClick={() => go(item.id)}>{item.label}</button>
        ))}
      </div>

      {page === "simulator" || page === "datapath" ? (
        <section className="lgx-card">
          <div className="lgx-card-bar">
            <div>
              <h3>Interactive Pipeline Simulator</h3>
              <p className="tiny">Load a program and step through the pipeline cycle by cycle. Watch instructions move through the 5 stages.</p>
            </div>
            <div className="pipe-tools">
              <label>Program
                <select aria-label="Program" value={programId} onChange={(event) => { setProgramId(event.target.value); reload(6); }}>
                  {PROGRAMS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label>Hazard Handling
                <select aria-label="Hazard handling" value={hazard} onChange={(event) => { setHazard(event.target.value as "stall" | "forward"); setForwardOn(event.target.value === "forward"); reload(6); }}>
                  <option value="stall">Stall (No Forwarding)</option>
                  <option value="forward">Forwarding</option>
                </select>
              </label>
              <button type="button" className="pipe-reset" onClick={() => reload(0)}>Reset</button>
            </div>
          </div>
          <div className="pipe-runbar">
            <button type="button" className="ctrx-go" onClick={() => setPlaying((value) => !value)}><Icon name={playing ? "pause" : "play"} size={14} /> {playing ? "Pause" : "Run"}</button>
            <button type="button" onClick={() => tick.current()}><Icon name="step" size={14} /> Step</button>
            <button type="button" onClick={() => reload(0)}><Icon name="reset" size={14} /> Reset</button>
            <label className="ctrx-speed">Simulation Speed
              <input aria-label="Simulation speed" type="range" min={100} max={1000} step={50} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
              <b>{speed} ms</b>
            </label>
            <div className="pipe-views">
              <span>View Options</span>
              <ToggleChip on={stallsOn} label="Show Stalls" onChange={setStallsOn} />
              <ToggleChip on={forwardOn} label="Show Forwarding" onChange={setForwardOn} />
              <ToggleChip on={highlight} label="Highlight Hazards" onChange={setHighlight} />
            </div>
          </div>
          {frame ? <StageRow frame={frame} lines={program.lines} highlight={highlight} forwardOn={forwardOn} canvas={page === "datapath"} /> : <p>The program could not be loaded.</p>}
        </section>
      ) : null}

      {page === "simulator" && frame ? (
        <>
          <RegisterRow frame={frame} />
          <div className="pipe-bottom">
            <Timeline frame={frame} lines={program.lines} stallsOn={stallsOn} highlight={highlight} />
            <Compare instructions={instructions} plain={plain} piped={piped} stalls={final?.stalls ?? 0} />
          </div>
        </>
      ) : null}
      {page === "registers" && frame ? <RegisterDetail frame={frame} /> : null}
      {page === "hazards" && frame ? <HazardPanel frame={frame} hazard={hazard} onHazard={(value) => { setHazard(value); setForwardOn(value === "forward"); reload(6); }} /> : null}
      {page === "performance" && final ? <Compare instructions={instructions} plain={plain} piped={piped} stalls={final.stalls} wide /> : null}
      {page === "control" && frame ? <ControlPanel frame={frame} lines={program.lines} /> : null}

      <div className="fsmx-foot">
        <section className="lgx-card">
          <div className="lgx-card-bar"><h3>Key Concepts (13)</h3><button type="button" className="fsmx-icon" onClick={() => setConcepts((value) => !value)}>{concepts ? "Show less" : "View All"}</button></div>
          <ol>{(concepts ? CONCEPTS : CONCEPTS.slice(0, 5)).map((item, index) => <li key={item}>{index + 1}. {item}</li>)}</ol>
        </section>
        <section className="lgx-card">
          <h3>Interactive Labs (6)</h3>
          <ul>
            <li><button type="button" onClick={() => go("simulator")}>Build a 5-stage pipeline simulator</button></li>
            <li><button type="button" onClick={() => go("hazards")}>Explore data hazards</button></li>
            <li><button type="button" onClick={() => go("hazards")}>Try forwarding vs. stalling</button></li>
            <li><button type="button" onClick={() => go("control")}>Visualize control hazards</button></li>
            <li><button type="button" onClick={() => go("performance")}>Measure speedup and CPI</button></li>
            <li><button type="button" onClick={() => go("datapath")}>Modify pipeline depth</button></li>
          </ul>
        </section>
        <section className="lgx-card">
          <h3>Real-World Applications</h3>
          <ul>
            <li>Modern CPUs (Intel, AMD, ARM, RISC-V)</li>
            <li>High-performance processors</li>
            <li>Embedded systems and IoT devices</li>
            <li>Mobile and game consoles</li>
            <li>Cloud and data center infrastructure</li>
            <li>Graphics and AI accelerators (GPU, TPU)</li>
          </ul>
        </section>
        <section className="lgx-card">
          <div className="lgx-card-bar"><h3>Practice Challenge</h3><button type="button" className="lgx-check" onClick={() => { setProgramId("sample1"); setHazard("stall"); reload(0); go("simulator"); }}>Try It</button></div>
          <p>Given a short instruction sequence with data and control hazards, simulate its execution on a 5-stage pipeline and determine the total cycles with and without forwarding.</p>
        </section>
      </div>
    </div>
  );
}

function ToggleChip({ on, label, onChange }: { on: boolean; label: string; onChange: (value: boolean) => void }) {
  return <button type="button" className={on ? "pipe-chip on" : "pipe-chip"} aria-pressed={on} onClick={() => onChange(!on)}>{label}</button>;
}

function StageRow({ frame, lines, highlight, forwardOn, canvas }: { frame: PipeState; lines: string[]; highlight: boolean; forwardOn: boolean; canvas: boolean }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  return (
    <div
      className={canvas ? "pipe-canvas grabbing-ready" : "pipe-stages"}
      style={canvas ? { transform: `translate(${pan.x}px, ${pan.y}px)` } : undefined}
      onPointerDown={canvas ? (event) => {
        if ((event.target as HTMLElement).closest("button, select, input")) return;
        drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.classList.add("panning");
      } : undefined}
      onPointerMove={canvas ? (event) => {
        if (!drag.current) return;
        setPan({ x: drag.current.px + event.clientX - drag.current.x, y: drag.current.py + event.clientY - drag.current.y });
      } : undefined}
      onPointerUp={canvas ? (event) => { drag.current = null; event.currentTarget.classList.remove("panning"); } : undefined}
    >
      {STAGES.map((stage) => {
        const slot = frame[stage.id];
        const hazard = highlight && (slot.mark === "stall" || slot.mark === "flush" || slot.kind === "bubble");
        return (
          <article key={stage.id} className={`pipe-stage ${stage.tone}${hazard ? " hazard" : ""}`}>
            <b>{stage.title}</b>
            <span>{slot.kind === "inst" ? labelFor(`${slot.text} @${slot.pc}`, lines) : slot.kind === "bubble" ? "BUBBLE" : "—"}</span>
            <small>{stage.note}{forwardOn && slot.mark.startsWith("EX") || forwardOn && slot.mark.startsWith("MEM") ? ` · forward ${slot.mark}` : ""}</small>
          </article>
        );
      })}
    </div>
  );
}

function RegisterRow({ frame }: { frame: PipeState }) {
  const cards = [
    { name: "IF/ID", tone: "id", lines: [`PC ${frame.IF.pc}`, `Instruction ${frame.IF.text || "—"}`, `NPC ${frame.pc}`] },
    { name: "ID/EX", tone: "if", lines: [`Read Data 1 ${frame.EX.v1}`, `Read Data 2 ${frame.EX.v2}`, `Imm/Control ${frame.ID.text || "—"}`] },
    { name: "EX/MEM", tone: "mem", lines: [`ALU Result ${frame.MEM.alu}`, `Write Data ${frame.MEM.v2}`, `Control ${frame.MEM.mark || "—"}`] },
    { name: "MEM/WB", tone: "wb", lines: [`Memory Data ${frame.WB.loaded}`, `ALU Result ${frame.WB.alu}`, `Control ${frame.WB.text || "—"}`] },
  ];
  return (
    <section className="lgx-card">
      <h3>Pipeline Registers</h3>
      <div className="pipe-regs">
        {cards.map((card) => (
          <article key={card.name} className={`pipe-reg ${card.tone}`}>
            <b>{card.name}</b>
            {card.lines.map((line) => <span key={line}>{line}</span>)}
          </article>
        ))}
      </div>
    </section>
  );
}

function RegisterDetail({ frame }: { frame: PipeState }) {
  const slots: Array<[string, Slot]> = [["IF", frame.IF], ["ID", frame.ID], ["EX", frame.EX], ["MEM", frame.MEM], ["WB", frame.WB]];
  return (
    <section className="lgx-card">
      <h3>Pipeline register contents · cycle {frame.cycles}</h3>
      <div className="pipe-regs">
        {slots.map(([name, slot]) => (
          <article key={name} className="pipe-reg id">
            <b>{name}</b>
            <span>{slot.text || slot.kind}</span>
            <span>PC {slot.pc}</span>
            <span>v1 {slot.v1} · v2 {slot.v2}</span>
            <span>ALU {slot.alu} · loaded {slot.loaded}</span>
            <span>mark {slot.mark || "—"}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function Timeline({ frame, lines, stallsOn, highlight }: { frame: PipeState; lines: string[]; stallsOn: boolean; highlight: boolean }) {
  const cycles = Math.max(10, frame.cycles);
  return (
    <section className="lgx-card">
      <h3>Instruction Pipeline Timeline</h3>
      <table className="pipe-time">
        <thead>
          <tr><th>Cycle</th>{Array.from({ length: cycles }, (_, index) => <th key={index}>{index + 1}</th>)}</tr>
        </thead>
        <tbody>
          {frame.rows.filter((row) => !row.text.startsWith("HALT")).map((row) => (
            <tr key={row.text}>
              <th>{labelFor(row.text, lines)}</th>
              {Array.from({ length: cycles }, (_, index) => {
                const cell = row.cells[index] ?? "";
                const shown = cell === "ST" && !stallsOn ? "" : cell;
                return <td key={index} className={`${shown.toLowerCase()}${highlight && shown === "ST" ? " hazard" : ""}`}>{shown}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Compare({ instructions, plain, piped, stalls, wide }: { instructions: number; plain: number; piped: number; stalls: number; wide?: boolean }) {
  const gain = speedup(plain, piped);
  return (
    <div className={wide ? "pipe-metrics wide" : "pipe-metrics"}>
      <section className="lgx-card">
        <h3>Performance Comparison</h3>
        <div className="pipe-cols">
          <div>
            <b>Non-Pipelined</b>
            <p>Instructions <span>{instructions}</span></p>
            <p>Cycles per instruction <span>5</span></p>
            <p>Total cycles <span>{plain}</span></p>
            <p>CPI <span>5.0</span></p>
          </div>
          <div>
            <b>Pipelined Execution</b>
            <p>Instructions <span>{instructions}</span></p>
            <p>Total cycles <span>{piped}</span></p>
            <p>CPI (ideal) <span>1.0</span></p>
            <p>Speedup <span>{gain.toFixed(2)}×</span></p>
          </div>
        </div>
        <div className="pipe-bars">
          <span>Non-Pipelined</span><i style={{ width: "100%" }} /> <em>{plain} cycles</em>
          <span>Pipelined</span><i className="fast" style={{ width: `${Math.max(8, (piped / Math.max(plain, 1)) * 100)}%` }} /> <em>{piped} cycles</em>
        </div>
      </section>
      <section className="lgx-card">
        <h3>Pipeline Metrics</h3>
        <p>Throughput <b>{piped ? (instructions / piped).toFixed(2) : "0"} instr/cycle</b></p>
        <p>Latency <b>5 cycles</b></p>
        <p>Pipeline Depth <b>5 stages</b></p>
        <p>Total Instructions <b>{instructions}</b></p>
        <p>Stalls (Hazards) <b>{stalls}</b></p>
      </section>
    </div>
  );
}

function HazardPanel({ frame, hazard, onHazard }: { frame: PipeState; hazard: "stall" | "forward"; onHazard: (value: "stall" | "forward") => void }) {
  return (
    <section className="lgx-card">
      <h3>Hazards and stalls</h3>
      <p>A load followed by an instruction that reads the loaded register is a load-use hazard. Without forwarding the pipeline stalls. Forwarding still inserts one stall for a load, and removes the stall for an ALU result.</p>
      <div className="pipe-tools">
        <button type="button" className={hazard === "stall" ? "on" : ""} onClick={() => onHazard("stall")}>Stall (No Forwarding)</button>
        <button type="button" className={hazard === "forward" ? "on" : ""} onClick={() => onHazard("forward")}>Forwarding</button>
      </div>
      <p>Cycle {frame.cycles}. Stalls so far {frame.stalls}. Forwards so far {frame.forwards}. Flushes {frame.flushes}.</p>
      <p className="tiny">{frame.log.at(-1) ?? "Step until a dependence appears between ID and EX or MEM."}</p>
    </section>
  );
}

function ControlPanel({ frame, lines }: { frame: PipeState; lines: string[] }) {
  const slot = frame.ID.kind === "inst" ? frame.ID : frame.EX;
  const decoded = slot.decoded;
  const signals: Array<[string, string]> = decoded ? [
    ["RegWrite", decoded.regWrite ? "1" : "0"],
    ["MemRead", decoded.memRead ? "1" : "0"],
    ["MemWrite", decoded.memWrite ? "1" : "0"],
    ["ALUSrc", decoded.aluSrc],
    ["MemToReg", decoded.memToReg ? "1" : "0"],
    ["Branch", decoded.branch ? "1" : "0"],
    ["ALUOp", decoded.aluOp],
  ] : [];
  return (
    <section className="lgx-card">
      <h3>Control signals</h3>
      <p>{slot.kind === "inst" ? labelFor(`${slot.text} @${slot.pc}`, lines) : "No instruction is in decode."}</p>
      <div className="pipe-regs">
        {signals.map(([name, value]) => <article key={name} className={value === "1" || value === "imm" ? "pipe-reg mem" : "pipe-reg id"}><b>{name}</b><span>{value}</span></article>)}
      </div>
    </section>
  );
}
