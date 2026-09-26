import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ACA_HOME, acaRoute } from "../../../data/acaLabs";
import { LabGuideButton } from "../guide/LabGuide";
import { LAB_GUIDES } from "../guide";
import { HAZARD_EXAMPLE, parsePipe, reorder, runPipeline, scheduleOps } from "../../../engines/aca/hazards";

const LINKS = [
  { id: "home", label: "Home", to: ACA_HOME },
  { id: "data-hazards", label: "Lab 1\nData Hazards & Instruction Scheduling", to: acaRoute("data-hazards") },
  { id: "scoreboard", label: "Lab 2\nDynamic Scheduling with Scoreboard", to: acaRoute("scoreboard") },
  { id: "tomasulo", label: "Lab 3\nTomasulo Algorithm", to: acaRoute("tomasulo") },
  { id: "register-renaming", label: "Lab 4\nScoreboarding with Register Renaming", to: acaRoute("register-renaming") },
  { id: "reorder-buffer", label: "Lab 5\nOut-of-Order Execution & In-Order Commit", to: acaRoute("reorder-buffer") },
  { id: "branch-predictor", label: "Lab 6\n1-Bit & 2-Bit Branch Predictor", to: acaRoute("branch-predictor") },
  { id: "correlating-predictor", label: "Lab 7\nCorrelating Branch Predictor", to: acaRoute("correlating-predictor") },
  { id: "branch-target-buffer", label: "Lab 8\nBranch Target Buffer Explorer", to: acaRoute("branch-target-buffer") },
  { id: "tournament-predictor", label: "Lab 9\nTournament & Hybrid Predictor", to: acaRoute("tournament-predictor") },
  { id: "speculative-execution", label: "Lab 10\nSpeculative Execution & Recovery", to: acaRoute("speculative-execution") },
  { id: "superscalar", label: "Lab 11\nSuperscalar Pipeline Explorer", to: acaRoute("superscalar") },
  { id: "issue-queue", label: "Lab 12\nInstruction Window & Issue Queue", to: acaRoute("issue-queue") },
  { id: "physical-register-file", label: "Lab 13\nPhysical Register File & Rename Map", to: acaRoute("physical-register-file") },
  { id: "load-store-queue", label: "Lab 14\nLoad / Store Queue Simulator", to: acaRoute("load-store-queue") },
  { id: "memory-disambiguation", label: "Lab 15\nMemory Disambiguation", to: acaRoute("memory-disambiguation") },
  { id: "execution-ports", label: "Lab 16\nExecution Port & Functional Unit Scheduler", to: acaRoute("execution-ports") },
  { id: "mesi", label: "Lab 17\nMSI & MESI Coherence Simulator", to: acaRoute("mesi") },
  { id: "moesi", label: "Lab 18\nMOESI Coherence Simulator", to: acaRoute("moesi") },
  { id: "directory-coherence", label: "Lab 19\nDirectory-Based Cache Coherence", to: acaRoute("directory-coherence") },
  { id: "false-sharing", label: "Lab 20\nFalse Sharing Visualizer", to: acaRoute("false-sharing") },
  { id: "coherence-traffic", label: "Lab 21\nCache-Coherence Traffic Analyzer", to: acaRoute("coherence-traffic") },
  { id: "snooping-vs-directory", label: "Lab 22\nSnooping vs Directory Coherence", to: acaRoute("snooping-vs-directory") },
  { id: "mshr", label: "Lab 23\nNon-Blocking Cache & MSHR Lab", to: acaRoute("mshr") },
  { id: "prefetching", label: "Lab 24\nHardware Prefetcher Laboratory", to: acaRoute("prefetching") },
  { id: "dram-controller", label: "Lab 25\nDRAM Bank & Memory Controller Simulator", to: acaRoute("dram-controller") },
  { id: "memory-consistency", label: "Lab 26\nMemory Consistency Model Explorer", to: acaRoute("memory-consistency") },
  { id: "atomic-operations", label: "Lab 27\nAtomic Operations & Synchronization", to: acaRoute("atomic-operations") },
  { id: "amdahl", label: "Lab 28\nMulticore Scaling & Amdahl's Law", to: acaRoute("amdahl") },
  { id: "roofline", label: "Lab 29\nRoofline Analysis", to: acaRoute("roofline") },
  { id: "cpi-ipc", label: "Lab 30\nCPI / IPC Bottleneck Analyzer", to: acaRoute("cpi-ipc") },
  { id: "performance-counters", label: "Lab 31\nCPU Performance Counter Laboratory", to: acaRoute("performance-counters") },
];

export function LabChrome({ lab, title, kicker, subtitle, badge, children }: { lab: string; title: string; kicker: string; subtitle: string; badge: string; children: ReactNode }) {
  const guide = LAB_GUIDES[lab];
  return (
    <div className="vl">
      <aside className="vl-side">
        <p>Virtual Labs</p>
        <nav aria-label="Advanced Computer Architecture labs">
          {LINKS.map((link) => (
            <Link key={link.id} to={link.to} className={link.id === lab ? "on" : ""}>
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="vl-main">
        <header className="vl-head">
          <div>
            <p className="vl-crumb">{kicker}</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="vl-head-tools">
            <span className="vl-badge">{badge}</span>
            <LabGuideButton labId={lab} />
          </div>
        </header>
        {guide ? (
          <details className="vl-try">
            <summary>Try changing</summary>
            <ul>{guide.controls.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul>
            <p>Challenges</p>
            <ol>{guide.variations.map((item) => <li key={item}>{item}</li>)}</ol>
          </details>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function usePlayback(length: number) {
  const [cycle, setCycle] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setCycle((current) => {
        if (current >= length) { setPlaying(false); return current; }
        return current + 1;
      });
    }, 1000 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, length]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (event.code === "Space") { event.preventDefault(); setPlaying((value) => !value); }
      if (event.code === "ArrowRight") setCycle((value) => Math.min(length, value + 1));
      if (event.code === "ArrowLeft") setCycle((value) => Math.max(0, value - 1));
      if (event.key === "r" || event.key === "R") { setPlaying(false); setCycle(0); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [length]);
  return { cycle, setCycle, playing, setPlaying, speed, setSpeed, reset: () => { setPlaying(false); setCycle(0); } };
}

export function Transport({ playing, onPlay, onBack, onStep, onReset, speed, onSpeed }: { playing: boolean; onPlay: () => void; onBack?: () => void; onStep: () => void; onReset: () => void; speed: number; onSpeed: (value: number) => void }) {
  return (
    <div className="vl-transport">
      <button type="button" className="vl-play" onClick={onPlay} disabled={playing}>Play</button>
      <button type="button" className="vl-pause" onClick={onPlay} disabled={!playing}>Pause</button>
      <button type="button" className="vl-step" onClick={() => onBack?.()} disabled={!onBack}>Previous</button>
      <button type="button" className="vl-step" onClick={onStep}>Step</button>
      <button type="button" className="vl-reset" onClick={onReset}>Reset</button>
      <label>Simulation Speed
        <input aria-label="Simulation speed" type="range" min={0.25} max={4} step={0.25} value={speed} onChange={(event) => onSpeed(Number(event.target.value))} />
        <span>{speed}x</span>
      </label>
    </div>
  );
}

export function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <button type="button" className={on ? "vl-toggle on" : "vl-toggle"} aria-pressed={on} onClick={() => onChange(!on)}>
      <span>{label}</span><i />
    </button>
  );
}

const HAZARD_PRESETS = [
  { id: "raw", label: "RAW chain", ops: HAZARD_EXAMPLE },
  { id: "load", label: "Load-use", ops: [parsePipe("LW x1, 0(x2)", "# load"), parsePipe("ADD x3, x1, x4", "# uses x1"), parsePipe("ADD x5, x6, x7", "# independent")] },
  { id: "war", label: "WAR and WAW", ops: [parsePipe("ADD x4, x1, x3", "# reads x1"), parsePipe("SUB x1, x5, x6", "# writes x1"), parsePipe("MUL x1, x4, x5", "# writes x1 again")] },
];

export function DataHazardsLab() {
  const [ops, setOps] = useState(HAZARD_EXAMPLE);
  const [base, setBase] = useState(HAZARD_EXAMPLE);
  const [forwarding, setForwarding] = useState(true);
  const [stallsOn, setStallsOn] = useState(true);
  const [showDeps, setShowDeps] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [kind, setKind] = useState<"RAW" | "WAR" | "WAW">("RAW");
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(0);
  const run = runPipeline(ops, forwarding, stallsOn);
  const original = runPipeline(base, forwarding, stallsOn);
  const scheduled = reorder(ops, scheduleOps(ops));
  const optimized = runPipeline(scheduled, forwarding, stallsOn);
  const play = usePlayback(run.cycles);
  const edges = run.deps.filter((edge) => edge.type === kind);
  const edge = edges.find((item) => item.from === selected || item.to === selected) ?? edges[0];
  const edgeStalls = edge ? (run.cells[edge.to] ?? []).filter((cell) => cell === "STALL").length : 0;
  const shown = Math.max(play.cycle, 1);
  const move = (index: number, delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= ops.length) return;
    const copy = ops.slice();
    const [item] = copy.splice(index, 1);
    if (!item) return;
    copy.splice(next, 0, item);
    setOps(copy);
    play.reset();
  };
  return (
    <LabChrome lab="data-hazards" kicker="Labs > Lab 1" title="Lab 1 — Data Hazards & Instruction Scheduling" subtitle="Experiment with a pipelined processor, identify data hazards, and see how forwarding or instruction scheduling changes the stall count." badge="RISC-V (5-stage pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>RAW hazards stall a simple in-order pipeline. WAR and WAW are name dependences. They matter when execution can pass program order. Forwarding removes most ALU stalls. A load that feeds the next instruction still needs one bubble.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : play.cycle >= run.cycles ? "Completed" : `Running · cycle ${shown}`}</p></article>
        <article><h2>Pipeline note</h2><p>With forwarding {forwarding ? "on" : "off"} and stalls {stallsOn ? "inserted" : "left unresolved"}, this order takes {run.cycles} cycles and {run.stalls} stall cycles.</p></article>
      </div>
      <div className="vl-split">
        <section className="vl-panel">
          <header><h2>Instruction Sequence</h2><button type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Done" : "Edit Instructions"}</button>
            <button type="button" onClick={() => { const next = parsePipe("ADD x1, x2, x3", "# custom"); setOps([...ops, next]); play.reset(); }}>Add instruction</button>
            <button type="button" onClick={() => { if (ops.length < 2) return; setOps(ops.slice(0, -1)); setSelected(0); play.reset(); }}>Remove last</button>
            <select aria-label="Load example" value="" onChange={(event) => { const preset = HAZARD_PRESETS.find((item) => item.id === event.target.value); if (preset) { const copy = preset.ops.map((op) => ({ ...op, srcs: [...op.srcs] })); setOps(copy); setBase(copy); play.reset(); } }}>
              <option value="">Load Example</option>
              {HAZARD_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            </select>
          </header>
          <table>
            <thead><tr><th>#</th><th>Instruction (RISC-V)</th><th>Comment</th></tr></thead>
            <tbody>
              {ops.map((op, index) => (
                <tr key={`${op.text}-${index}`} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const from = Number(event.dataTransfer.getData("text/plain")); const copy = ops.slice(); const [item] = copy.splice(from, 1); if (!item) return; copy.splice(index, 0, item); setOps(copy); play.reset(); }} className={selected === index ? "on" : ""} onClick={() => setSelected(index)}>
                  <td>{index + 1}</td>
                  <td>{editing ? <input aria-label={`Instruction ${index + 1}`} value={op.text} onChange={(event) => setOps(ops.map((item, itemIndex) => itemIndex === index ? parsePipe(event.target.value, item.comment) : item))} /> : op.text}</td>
                  <td>{editing ? <input aria-label={`Comment ${index + 1}`} value={op.comment} onChange={(event) => setOps(ops.map((item, itemIndex) => itemIndex === index ? { ...item, comment: event.target.value } : item))} /> : op.comment}</td>
                  <td><button type="button" aria-label="Move up" onClick={() => move(index, -1)}>↑</button><button type="button" aria-label="Move down" onClick={() => move(index, 1)}>↓</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tiny">Drag a row, or use the arrows, to try another legal schedule.</p>
          {ops.some((op) => !["ADD", "SUB", "AND", "OR", "ADDI", "SW", "LW", "MUL", "LD", "SD", "NOP"].includes((op.text.split(" ")[0] ?? "").toUpperCase())) ? <p className="tiny">An unrecognized opcode is treated as an ALU operation. Use ADD, SUB, AND, OR, ADDI, LW, SW, or MUL.</p> : null}
        </section>
        <section className="vl-panel">
          <header><h2>Pipeline Execution Timeline</h2><b>Cycle {shown} / {run.cycles}</b></header>
          <div className="vl-scroll">
            <table className="vl-time">
              <thead><tr><th>Inst.</th>{Array.from({ length: run.cycles }, (_, index) => <th key={index} className={index + 1 === shown ? "now" : ""}>{index + 1}</th>)}</tr></thead>
              <tbody>
                {ops.map((op, index) => (
                  <tr key={`${op.text}-t-${index}`} className={selected === index ? "on" : ""}>
                    <td>I{index + 1}: {op.text.split(" ")[0]}</td>
                    {Array.from({ length: run.cycles }, (_, cell) => {
                      const token = cell < shown ? run.cells[index]?.[cell] ?? "" : "";
                      const hot = highlight && edge && token && (index === edge.from || index === edge.to);
                      return <td key={cell} className={`${token ? `st ${token}` : ""} ${hot ? "hot" : ""}`}>{token}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="vl-legend"><i className="st IF" /> IF <i className="st ID" /> ID <i className="st EX" /> EX <i className="st MEM" /> MEM <i className="st WB" /> WB <i className="st STALL" /> Stall</p>
        </section>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Hazard Detector</h2>
          {edge ? <p><b>{edge.type} on {edge.reg}</b><br />I{edge.to + 1} {edge.type === "RAW" ? `reads ${edge.reg}` : edge.type === "WAR" ? `writes ${edge.reg} after an earlier read` : `also writes ${edge.reg}`}. I{edge.from + 1} is the earlier instruction. {edge.type === "RAW" ? (edgeStalls > 0 ? `The consumer row inserts ${edgeStalls} stall ${edgeStalls === 1 ? "cycle" : "cycles"} before EX.` : "Forwarding supplies the value, so this edge inserts no stall.") : "This in-order pipeline keeps program order, so the name dependence does not insert a stall."}</p> : <p>No {kind} dependence in this sequence.</p>}
          {showDeps ? <ul>{run.deps.map((item, index) => <li key={`${item.type}-${index}`}>I{item.from + 1} → I{item.to + 1} {item.type} {item.reg}</li>)}</ul> : null}
        </article>
        <article>
          <h2>Hazard Types</h2>
          <div className="vl-pills">{(["RAW", "WAR", "WAW"] as const).map((item) => <button type="button" key={item} className={kind === item ? "on" : ""} onClick={() => setKind(item)}>{item}</button>)}</div>
          <p>{kind === "RAW" ? "The consumer reads a register before the producer writes it. Forwarding can supply an ALU result from EX/MEM. A load result is only ready after MEM." : kind === "WAR" ? "A later instruction writes a register an earlier instruction still needs to read. Issue order in this pipeline already prevents it." : "Two instructions write the same register. The in-order pipeline writes them in program order, so the second result is the one that remains."}</p>
        </article>
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={forwarding} label="Enable Data Forwarding" onChange={(next) => { setForwarding(next); play.reset(); }} />
          <Toggle on={stallsOn} label="Auto Insert Stalls" onChange={(next) => { setStallsOn(next); play.reset(); }} />
          <Toggle on={showDeps} label="Show Dependency Edges" onChange={setShowDeps} />
          <Toggle on={highlight} label="Highlight Hazards" onChange={setHighlight} />
          <Transport playing={play.playing} speed={play.speed} onSpeed={play.setSpeed} onPlay={() => play.setPlaying((value) => !value)} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onStep={() => play.setCycle((value) => Math.min(run.cycles, value + 1))} onReset={play.reset} />
          {run.forwards.length ? <p className="tiny">{run.forwards.map((item) => `${item.reg} forwarded ${item.path} from I${item.from + 1} to I${item.to + 1}`).join(" · ")}</p> : <p className="tiny">No value is forwarded in this configuration.</p>}
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Instruction Scheduler</h2>
          <button type="button" onClick={() => { setOps(scheduled); play.reset(); }}>Auto Schedule</button>
          <button type="button" onClick={() => { setOps(base); play.reset(); }}>Reset Order</button>
          <p>Only instructions with no unfinished RAW, WAR, WAW, or memory edge move ahead. Scheduled order: {scheduled.map((op) => op.text.split(" ")[0]).join(" → ")}</p>
        </article>
        <article>
          <h2>Results & Insights</h2>
          <p><b>{original.cycles}</b> original cycles</p>
          <p><b>{optimized.cycles}</b> after a safe schedule</p>
          <p><b>{optimized.cycles > 0 ? (original.cycles / optimized.cycles).toFixed(2) : "1.00"}×</b> speedup of the safe schedule</p>
          <p><b>{run.stalls}</b> stall cycles in this order · forwarding events {run.forwards.length}</p>
          <p>CPI is cycles divided by {ops.length} instructions: {(run.cycles / Math.max(1, ops.length)).toFixed(2)}</p>
        </article>
        <article>
          <h2>Forwarding / Rescheduling</h2>
          <p>ALU-to-ALU RAW hazards use the EX/MEM latch, so the consumer does not wait. A load-use pair still inserts one bubble, because the loaded word is not valid until the end of MEM. WAR and WAW stay visible in the detector, and this in-order pipeline does not stall for them.</p>
        </article>
      </div>
    </LabChrome>
  );
}
