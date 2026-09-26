import { useMemo, useState } from "react";
import { IQ_PRESETS, runIssue, type IqConfig, type IqOp, type IqShot } from "../../../engines/aca/issueQueue";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";
import { WakeupPulse } from "../animation/phase2Views";
import { useGuideFocus } from "../guide/focus";

const POLICIES = ["Oldest Ready First"];

function layout(ops: IqOp[], edges: Array<{ from: number; to: number }>) {
  const depth = ops.map(() => 0);
  for (let pass = 0; pass < ops.length; pass += 1) {
    edges.forEach((edge) => { depth[edge.to] = Math.max(depth[edge.to] ?? 0, (depth[edge.from] ?? 0) + 1); });
  }
  const columns: number[][] = [];
  depth.forEach((value, index) => { (columns[value] ??= []).push(index); });
  const pos = new Map<number, { x: number; y: number }>();
  columns.forEach((column, columnIndex) => column.forEach((index, row) => pos.set(index, { x: columnIndex * 92 + 46, y: row * 52 + 28 })));
  return { pos, width: Math.max(1, columns.length) * 92, height: Math.max(1, ...columns.map((column) => column.length)) * 52 + 8 };
}

export function IssueQueueLab() {
  const [presetId, setPresetId] = useState(IQ_PRESETS[0]?.id ?? "mixed");
  const [windowSize, setWindowSize] = useState(8);
  const [issueWidth, setIssueWidth] = useState(2);
  const [units, setUnits] = useState("1 Load, 1 ALU, 1 MUL");
  const [readiness, setReadiness] = useState(true);
  const [selectedOn, setSelectedOn] = useState(true);
  const [arrows, setArrows] = useState(true);
  const [selected, setSelected] = useState(0);
  const preset = IQ_PRESETS.find((item) => item.id === presetId) ?? IQ_PRESETS[0];
  const config = useMemo<IqConfig>(() => ({
    ...(preset?.config ?? { window: 8, issueWidth: 2, alu: 1, mul: 1, load: 1, dispatch: 2 }),
    window: windowSize,
    issueWidth,
    load: units.startsWith("2") ? 2 : 1,
    alu: units.includes("2 ALU") ? 2 : 1,
    mul: 1,
  }), [preset, windowSize, issueWidth, units]);
  const result = useMemo(() => runIssue(preset?.ops ?? [], config), [preset, config]);
  const play = usePlayback(Math.max(0, result.shots.length - 1));
  const { id: guideFocus, setId: setGuideFocus } = useGuideFocus();
  if (!preset) return null;
  const shot = result.shots[Math.min(play.cycle, result.shots.length - 1)] ?? result.shots[0];
  const previous = result.shots[Math.min(play.cycle, result.shots.length - 1) - 1];
  if (!shot) return null;
  const graph = layout(preset.ops, result.edges);
  const completed = shot.entries.filter((entry, index) => (entry.state === "done" || entry.state === "wb") && previous?.entries[index]?.state !== "done" && previous?.entries[index]?.state !== "wb");
  const producer = completed[0];
  const queue = shot.entries.filter((entry) => entry.state === "waiting" || entry.state === "ready" || entry.state === "issued" || entry.state === "selected");
  const utilization = result.occupancy / Math.max(1, config.window);
  const notReady = queue.filter((entry) => entry.waiting.length > 0).length;
  const readyHeld = queue.filter((entry) => entry.waiting.length === 0 && !entry.selected).length;
  const hint = notReady > 0 && readyHeld > 0
    ? `${notReady} instructions are not ready. ${readyHeld} are ready and still waiting for an issue slot or a functional unit.`
    : notReady > 0
      ? "A consumer stays not-ready until its producer completes."
      : readyHeld > 0
        ? "These instructions are ready but were not selected. Issue width or the functional units are the limit."
        : "Step until several instructions are in the window, then compare Ready and Selected.";
  return (
    <LabChrome lab="issue-queue" kicker="Labs > Lab 12" title="Lab 12 — Instruction Window & Issue Queue" subtitle="Explore how an out-of-order processor tracks ready instructions and selects them for issue." badge="RISC-V (5-Stage Pipeline)" hint={hint}>
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Understand how the instruction window tracks operand readiness and uses wakeup and select to issue ready instructions out of program order.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : shot.event}</p><p>Selection policy: {POLICIES[0]}. An instruction issues only when every source is ready and a functional unit is free.</p></article>
        <article><h2>Window</h2><p>{shot.occupancy} occupied, {Math.max(0, config.window - shot.occupancy)} free, {shot.readyCount} ready, {shot.waitingCount} waiting.</p></article>
      </div>
      <div className="vl-cards three">
        <article className={guideFocus === "queue" ? "aca-guide-on" : undefined}>
          <header>
            <h2>Instruction Window</h2>
            <select aria-label="Load example" value={preset.id} onChange={(event) => { setPresetId(event.target.value); play.reset(); }}>
              {IQ_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </header>
          <table>
            <thead><tr><th>#</th><th>PC</th><th>Instruction</th><th>Operands</th><th>Ready?</th><th>State</th></tr></thead>
            <tbody>
              {shot.entries.map((entry) => (
                <tr key={entry.pc} className={selected === entry.index ? "on" : ""} onClick={() => setSelected(entry.index)}>
                  <td>{entry.index}</td>
                  <td>0x{entry.pc.toString(16)}</td>
                  <td>{entry.text}</td>
                  <td>{entry.srcs.join(", ") || "—"}</td>
                  <td className={entry.waiting.length === 0 ? "vl-ok" : "vl-bad"}>{readiness ? (entry.waiting.length === 0 ? "Yes" : "No") : "—"}</td>
                  <td className={`tag ${label(entry.state)}`}>{pretty(entry.state)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article>
          <h2>Dependency Graph</h2>
          <svg viewBox={`0 0 ${graph.width} ${graph.height}`} role="img" aria-label="RAW dependency graph">
            {arrows ? result.edges.map((edge) => {
              const from = graph.pos.get(edge.from);
              const to = graph.pos.get(edge.to);
              if (!from || !to) return null;
              const hot = shot.woken.includes(edge.to) && producer?.index === edge.from;
              return <line key={`${edge.from}-${edge.to}-${edge.reg}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={hot ? "#f59e0b" : "#94a3b8"} strokeWidth={hot ? 3 : 1.5} />;
            }) : null}
            {preset.ops.map((op, index) => {
              const at = graph.pos.get(index);
              const entry = shot.entries[index];
              if (!at || !entry) return null;
              const fill = entry.waiting.length > 0 ? "#fecaca" : op.fu === "load" ? "#bfdbfe" : op.fu === "mul" ? "#fde68a" : "#bbf7d0";
              return <g key={op.text} onClick={() => setSelected(index)}><rect x={at.x - 34} y={at.y - 16} width="68" height="32" rx="8" fill={fill} stroke={selected === index ? "#2563eb" : "#cbd5e1"} /><text x={at.x} y={at.y - 2} textAnchor="middle" fontSize="9">{op.text.split(" ")[0]}</text><text x={at.x} y={at.y + 10} textAnchor="middle" fontSize="9">{op.dest ?? ""}</text></g>;
            })}
          </svg>
        </article>
        <article className={guideFocus === "select" ? "aca-guide-on" : undefined}>
          <h2>Wakeup and Select</h2>
          <p><b>1. Wakeup.</b> {producer ? `${producer.text} produced ${preset.ops[producer.index]?.dest ?? "a result"}.` : "No result is broadcast this cycle."}</p>
          <p>{shot.woken.length ? `Matching source became ready for ${shot.woken.map((index) => `I${index + 1}`).join(", ")}.` : "No matching source wakes up."}</p>
          <WakeupPulse
            woken={shot.woken.map((index) => `I${index + 1}`)}
            selected={shot.entries.filter((entry) => entry.selected).map((entry) => `I${entry.index + 1}`)}
            readyWaiting={shot.entries.filter((entry) => entry.ready && !entry.selected && (entry.state === "ready" || entry.state === "waiting")).length}
            speed={play.speed}
            cycle={play.cycle}
          />
          <p><b>2. Select.</b> {POLICIES[0]}. Up to {config.issueWidth} instructions, and only one per free unit.</p>
          <p>Issued this cycle: {shot.issuedNow.length ? shot.issuedNow.map((index) => `I${index + 1}`).join(", ") : "none"}.</p>
          <h2>Ready Queue</h2>
          <table>
            <thead><tr><th>#</th><th>Instruction</th><th>Ready?</th><th>Age</th><th>Selected?</th></tr></thead>
            <tbody>
              {queue.map((entry) => <tr key={entry.index} className={selectedOn && entry.selected ? "on" : ""}><td>{entry.index}</td><td>{entry.text}</td><td className={entry.waiting.length === 0 ? "vl-ok" : "vl-bad"}>{entry.waiting.length === 0 ? "Yes" : "No"}</td><td>{entry.age}</td><td>{entry.selected ? "Yes" : "No"}</td></tr>)}
            </tbody>
          </table>
        </article>
      </div>
      <div className="vl-split">
        <section className="vl-panel">
          <header><h2>Issue Simulation Timeline</h2><b>Cycle {shot.cycle} / {result.cycles}</b></header>
          <div className="vl-scroll">
            <table className="vl-time">
              <thead><tr><th>Instruction</th>{Array.from({ length: shot.cycle }, (_, index) => <th key={index} className={index + 1 === shot.cycle ? "now" : ""}>{index + 1}</th>)}</tr></thead>
              <tbody>
                {preset.ops.map((op, index) => (
                  <tr key={op.text} className={selected === index ? "on" : ""} onClick={() => setSelected(index)}>
                    <td>{op.text}</td>
                    {Array.from({ length: shot.cycle }, (_, cell) => {
                      const token = shot.cells[index]?.[cell];
                      return <td key={cell}>{token ? <span className={`st ${token}`}>{token}</span> : ""}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="vl-legend"><i className="st IF" /> IF <i className="st IW" /> IW <i className="st IS" /> IS <i className="st EX" /> EX <i className="st WB" /> WB</p>
        </section>
        <section className="vl-panel">
          <h2>Simulation Controls</h2>
          <label>Instruction window size
            <select aria-label="Instruction window size" value={windowSize} onChange={(event) => { setWindowSize(Number(event.target.value)); play.reset(); }}>
              {[4, 8, 16, 32].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Issue width
            <select aria-label="Issue width" value={issueWidth} onChange={(event) => { setIssueWidth(Number(event.target.value)); play.reset(); }}>
              {[1, 2, 4].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Functional units
            <select aria-label="Functional units" value={units} onChange={(event) => { setUnits(event.target.value); play.reset(); }}>
              <option>1 Load, 1 ALU, 1 MUL</option>
              <option>1 Load, 2 ALU, 1 MUL</option>
              <option>2 Load, 2 ALU, 1 MUL</option>
            </select>
          </label>
          <p>Policy: {POLICIES[0]}</p>
          <Toggle on={readiness} label="Show Operand Readiness" onChange={setReadiness} />
          <Toggle on={selectedOn} label="Highlight Selected Instructions" onChange={setSelectedOn} />
          <Toggle on={arrows} label="Show Dependency Arrows" onChange={setArrows} />
          <Transport playing={play.playing} speed={play.speed} onSpeed={play.setSpeed} onPlay={() => play.setPlaying((value) => !value)} onStep={() => play.setCycle((value) => Math.min(result.shots.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={() => { setGuideFocus(""); play.reset(); }} />
        </section>
      </div>
      <div className="vl-metrics">
        <div><span>Total instructions</span><strong>{preset.ops.length}</strong></div>
        <div><span>Issued instructions</span><strong>{shot.issuedTotal}</strong></div>
        <div><span>Stalls</span><strong>{result.stalls}</strong></div>
        <div><span>Window utilization</span><strong>{Math.round(utilization * 100)}%</strong></div>
        <div><span>IPC</span><strong>{(shot.issuedTotal / Math.max(1, shot.cycle)).toFixed(2)}</strong></div>
      </div>
    </LabChrome>
  );
}

function pretty(state: IqShot["entries"][number]["state"]) {
  if (state === "waiting") return "Waiting";
  if (state === "ready") return "In Window";
  if (state === "issued" || state === "selected") return "Selected";
  if (state === "exec") return "Issued";
  if (state === "wb" || state === "done") return "Done";
  return "—";
}

function label(state: IqShot["entries"][number]["state"]) {
  if (state === "waiting") return "waiting";
  if (state === "ready") return "in";
  if (state === "issued" || state === "selected") return "selected";
  if (state === "exec") return "issued";
  return "ready";
}
