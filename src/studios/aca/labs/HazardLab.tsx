import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ACA_HOME, ACA_LABS } from "../../../data/acaLabs";
import { LAB_GUIDES } from "../guide";
import { QuickGuide, WalkthroughDoc } from "../guide/LabGuide";
import { useGuideFocus } from "../guide/focus";
import { HAZARD_EXAMPLE, parsePipe, reorder, runPipeline, scheduleOps } from "../../../engines/aca/hazards";
import { AcaIcon } from "../icons/AcaIcon";
import { ForwardPath, SmoothNumber, StageLegend } from "../animation/motionViews";

const SECTIONS = ["Aim", "Theory", "Pretest", "Procedure", "Simulation", "Posttest", "References", "Contributors", "Feedback"] as const;
type Section = (typeof SECTIONS)[number];

const SLOGANS: Record<string, string> = {
  "data-hazards": "Small Experiments Big Understanding",
  scoreboard: "Schedule the Units Watch the Stalls",
  tomasulo: "Tags Carry the Values",
  "register-renaming": "New Names Remove False Waits",
  "reorder-buffer": "Execute Wide Commit in Order",
  "branch-predictor": "Small Experiments Big Understanding",
  "correlating-predictor": "History Makes the Next Guess",
  "branch-target-buffer": "Remember Where Branches Go",
  "tournament-predictor": "Let the Chooser Learn",
  "speculative-execution": "Guess Ahead Recover Cleanly",
  superscalar: "Wider Is Not Always Faster",
  "issue-queue": "Wake the Ready Instructions",
  "physical-register-file": "Every Write Needs a Name",
  "load-store-queue": "Memory Order Is a Queue",
  "memory-disambiguation": "Guess the Address Then Check",
  "execution-ports": "A Free Port Is Throughput",
  mesi: "Coherence in Action Cores Stronger Systems",
  moesi: "Ownership Keeps Memory Quiet",
  "directory-coherence": "Ask the Directory Not the Bus",
  "false-sharing": "Same Line Different Variables",
  "coherence-traffic": "Count the Messages",
  "snooping-vs-directory": "Scale Changes the Winner",
  mshr: "Misses Can Overlap",
  prefetching: "Fetch the Line Before the Load",
  "dram-controller": "Better Scheduling Faster Systems",
  "memory-consistency": "Order Is a Contract",
  "atomic-operations": "One Winner at a Time",
  amdahl: "The Serial Slice Sets the Ceiling",
  roofline: "Know Your Limits Then Go Beyond",
  "cpi-ipc": "Find the Stall That Dominates",
  "performance-counters": "Measure Then Explain",
  "wallace-tree": "Compress the Columns Then Add",
  "array-multiplier": "AND the Bits Then Add the Rows",
  "booth-multiplier": "Recode the Run Then Shift",
};

export function StudioTop() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const hits = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return [];
    return ACA_LABS.filter((item) => item.title.toLowerCase().includes(text)).slice(0, 8);
  }, [query]);
  return (
    <header className="aca-top">
      <Link to="/" className="aca-app-home">LogicLab</Link>
      <Link to={ACA_HOME} className="aca-brand">
        <span className="aca-mark" aria-hidden="true">ACA</span>
        <div>
          <strong>Advanced Computer Architecture Studio</strong>
          <p className="aca-tag">Explore · Experiment · Learn · Build Expertise</p>
        </div>
      </Link>
      <label className="aca-search">
        <span aria-hidden="true">⌕</span>
        <input aria-label="Search labs" placeholder="Search labs, topics..." value={query} onChange={(event) => setQuery(event.target.value)} />
        {hits.length > 0 ? (
          <div className="aca-search-pop">
            {hits.map((item) => (
              <button key={item.id} type="button" onClick={() => { setQuery(""); navigate(`${ACA_HOME}/${item.slug}`); }}>{item.title}</button>
            ))}
          </div>
        ) : null}
      </label>
      <button type="button" className="aca-bell" aria-label="Notifications stay on this device">🔔</button>
      <span className="aca-student"><b>S</b> Student</span>
    </header>
  );
}

export function LabChrome({ lab, title, kicker, subtitle, badge, hint, reading, children }: { lab: string; title: string; kicker: string; subtitle: string; badge: string; hint?: string; reading?: string; children: ReactNode }) {
  const guide = LAB_GUIDES[lab];
  const index = ACA_LABS.findIndex((item) => item.id === lab);
  const [section, setSection] = useState<Section>("Simulation");
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState("");
  const { setId: setGuideFocus } = useGuideFocus();
  useEffect(() => {
    setSection("Simulation");
    setGuideFocus("");
    setNotes(window.localStorage.getItem(`aca-lab-notes:${lab}`) ?? "");
    const onNote = (event: Event) => {
      const detail = (event as CustomEvent<{ labId: string; text: string }>).detail;
      if (detail?.labId === lab) setNotes(detail.text);
    };
    window.addEventListener("aca-notes", onNote);
    return () => window.removeEventListener("aca-notes", onNote);
  }, [lab, setGuideFocus]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      setGuideFocus("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="aca-studio-page">
      <StudioTop />
      <div className="aca-studio-body">
        <aside className="aca-lab-nav">
          <p>Virtual Labs</p>
          <Link to="/">LogicLab</Link>
          <Link to={ACA_HOME}>Studio home</Link>
          <span className="aca-current">{index >= 0 ? `Lab ${index + 1}\n${ACA_LABS[index]?.title ?? title}` : title}</span>
          {SECTIONS.map((item) => (
            <button key={item} type="button" className={section === item ? "on" : ""} onClick={() => setSection(item)}>{item}</button>
          ))}
          <div className="aca-watermark">
            <svg width="120" height="64" viewBox="0 0 120 64" aria-hidden="true">
              <path d="M8 52 V28 L24 16 L40 28 V52" fill="#dbe7f5" />
              <path d="M48 52 V22 L70 8 L92 22 V52" fill="#e8eef6" />
              <rect x="16" y="34" width="8" height="8" fill="#fff" />
              <rect x="60" y="30" width="8" height="8" fill="#fff" />
              <rect x="74" y="30" width="8" height="8" fill="#fff" />
            </svg>
            Architecture Today for Smarter Tomorrow
          </div>
        </aside>
        <div className="vl">
          <header className="vl-head">
            <div>
              <nav className="vl-crumb" aria-label="Breadcrumb">
                <Link to="/">LogicLab</Link>
                <span aria-hidden="true">/</span>
                <Link to="/studios">Studios</Link>
                <span aria-hidden="true">/</span>
                <Link to={ACA_HOME}>Advanced Computer Architecture</Link>
                <span aria-hidden="true">/</span>
                <span>{index >= 0 ? `Lab ${index + 1}` : kicker}</span>
              </nav>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            <div className="vl-head-tools">
              <span className="vl-badge">{badge}</span>
              <p className="aca-slogan">{SLOGANS[lab] ?? "Small Experiments Big Understanding"}</p>
            </div>
          </header>
          {section === "Simulation" ? <><QuickGuide labId={lab} hint={hint} reading={reading} />{children}</> : (
            <section className="vl-panel aca-doc">
              {section === "Aim" && guide ? <><h2>Aim</h2><p>{guide.aim}</p><p>{guide.purpose}</p><ul>{guide.learningObjectives.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
              {section === "Theory" && guide ? <><h2>Theory</h2>{guide.theory.map((item) => <p key={item}>{item}</p>)}<ul>{guide.keyTerms.map((item) => <li key={item.term}><b>{item.term}.</b> {item.meaning}</li>)}</ul></> : null}
              {section === "Pretest" && guide ? <><h2>Pretest</h2>{guide.selfCheck.map((item, itemIndex) => <div key={item.prompt}><p>{itemIndex + 1}. {item.prompt}</p>{item.choices.map((choice, choiceIndex) => <button type="button" key={choice} className={picked[itemIndex] === choiceIndex ? "on" : ""} onClick={() => setPicked((current) => ({ ...current, [itemIndex]: choiceIndex }))}>{choice}</button>)}{picked[itemIndex] !== undefined ? <p>{picked[itemIndex] === item.answer ? "Correct. " : "Try the other idea. "}{item.why}</p> : null}</div>)}</> : null}
              {section === "Procedure" && guide?.walkthrough ? <WalkthroughDoc walk={guide.walkthrough} /> : null}
              {section === "Procedure" && guide && !guide.walkthrough ? <><h2>Procedure</h2><ol>{guide.procedure.map((item) => <li key={item}>{item}</li>)}</ol><h2>Try changing</h2><ul>{guide.controls.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul><h2>Challenges</h2><ol>{guide.variations.map((item) => <li key={item}>{item}</li>)}</ol></> : null}
              {section === "Posttest" && guide ? <><h2>Posttest</h2>{guide.walkthrough ? <><h3>Check yourself</h3><ol>{guide.walkthrough.check.map((item) => <li key={item}>{item}</li>)}</ol></> : null}{guide.viva.map((item) => <p key={item.question}><b>{item.question}</b> {item.answer}</p>)}<h2>Learning outcomes</h2><ul>{guide.learningOutcomes.map((item) => <li key={item}>{item}</li>)}</ul><p>{guide.summary}</p></> : null}
              {section === "References" && guide ? <><h2>References</h2>{guide.formulas.map((item) => <p key={item.name}><b>{item.name}.</b> {item.expression} {item.note}</p>)}<ul>{guide.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
              {section === "Contributors" ? <><h2>Contributors</h2><p>Advanced Computer Architecture Studio, built in LogicLab for browser-side experiments. The lab engines run on this device.</p></> : null}
              {section === "Feedback" ? <><h2>Feedback</h2><p>Notes stay in this browser.</p><textarea aria-label="Lab notes" rows={6} value={notes} onChange={(event) => { setNotes(event.target.value); window.localStorage.setItem(`aca-lab-notes:${lab}`, event.target.value); }} /></> : null}
            </section>
          )}
        </div>
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
      <button type="button" className="vl-play" onClick={onPlay} disabled={playing}><AcaIcon name="play" decorative /> Play</button>
      <button type="button" className="vl-pause" onClick={onPlay} disabled={!playing}><AcaIcon name="pause" decorative /> Pause</button>
      <button type="button" className="vl-step" onClick={() => onBack?.()} disabled={!onBack}><AcaIcon name="previous" decorative /> Previous</button>
      <button type="button" className="vl-step" onClick={onStep}><AcaIcon name="step" decorative /> Step</button>
      <button type="button" className="vl-reset" onClick={onReset}><AcaIcon name="reset" decorative /> Reset</button>
      <label className="vl-speed">Simulation Speed
        <span className="vl-speed-row">
          <span>Slow</span>
          <input aria-label="Simulation speed" type="range" min={0.25} max={4} step={0.25} value={speed} onChange={(event) => onSpeed(Number(event.target.value))} />
          <span>Fast</span>
        </span>
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
  const [hover, setHover] = useState<number | null>(null);
  const run = runPipeline(ops, forwarding, stallsOn);
  const original = runPipeline(base, forwarding, stallsOn);
  const scheduled = reorder(ops, scheduleOps(ops));
  const optimized = runPipeline(scheduled, forwarding, stallsOn);
  const play = usePlayback(run.cycles);
  const edges = run.deps.filter((edge) => edge.type === kind);
  const edge = edges.find((item) => item.from === selected || item.to === selected) ?? edges[0];
  const edgeStalls = edge ? (run.cells[edge.to] ?? []).filter((cell) => cell === "STALL").length : 0;
  const shown = Math.max(play.cycle, 1);
  const { id: guideFocus } = useGuideFocus();
  const mark = (id: string) => guideFocus === id ? "aca-guide-on" : undefined;
  const hint = !forwarding && run.stalls > 0
    ? "Forwarding is off and this sequence still has stall cycles. Turn Enable Data Forwarding on, Reset, and compare."
    : run.stalls > 0
      ? "A STALL cell is on the timeline. A load used by the next instruction keeps one bubble even with forwarding."
      : run.forwards.length > 0
        ? "A value is on the forwarding path. Turn Enable Data Forwarding off to see the stalls come back."
        : "Step the timeline and watch IF, ID, EX, MEM, WB, and any STALL cell.";
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
    <LabChrome lab="data-hazards" hint={hint} kicker="Labs > Lab 1" title="Lab 1 — Data Hazards & Instruction Scheduling" subtitle="Experiment with a pipelined processor, identify data hazards, and see how forwarding or instruction scheduling changes the stall count." badge="RISC-V (5-stage pipeline)">
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
                <tr key={`${op.text}-${index}`} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const from = Number(event.dataTransfer.getData("text/plain")); const copy = ops.slice(); const [item] = copy.splice(from, 1); if (!item) return; copy.splice(index, 0, item); setOps(copy); play.reset(); }} className={`${selected === index ? "on" : ""} ${hover === index ? "hot-row" : ""}`.trim()} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)} onClick={() => setSelected(index)}>
                  <td>{index + 1}</td>
                  <td className={editing ? undefined : "vl-code"}>{editing ? <input aria-label={`Instruction ${index + 1}`} value={op.text} onChange={(event) => setOps(ops.map((item, itemIndex) => itemIndex === index ? parsePipe(event.target.value, item.comment) : item))} /> : op.text}</td>
                  <td className="vl-note">{editing ? <input aria-label={`Comment ${index + 1}`} value={op.comment} onChange={(event) => setOps(ops.map((item, itemIndex) => itemIndex === index ? { ...item, comment: event.target.value } : item))} /> : op.comment}</td>
                  <td><button type="button" className="vl-icon vl-up" aria-label="Move instruction up" title="Move up" onClick={() => move(index, -1)}><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 3.2 11 8.2H3Z" fill="currentColor" /></svg></button><button type="button" className="vl-icon vl-down" aria-label="Move instruction down" title="Move down" onClick={() => move(index, 1)}><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 10.8 3 5.8h8Z" fill="currentColor" /></svg></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tiny">Drag a row, or use the arrows, to try another legal schedule.</p>
          {ops.some((op) => !["ADD", "SUB", "AND", "OR", "ADDI", "SW", "LW", "MUL", "LD", "SD", "NOP"].includes((op.text.split(" ")[0] ?? "").toUpperCase())) ? <p className="tiny">An unrecognized opcode is treated as an ALU operation. Use ADD, SUB, AND, OR, ADDI, LW, SW, or MUL.</p> : null}
        </section>
        <section className={`vl-panel ${mark("timeline") ?? ""}`}>
          <header><h2>Pipeline Execution Timeline</h2><span className="vl-cycle">Cycle {shown} / {run.cycles}</span></header>
          <div className="vl-scroll">
            <table className="vl-time">
              <thead><tr><th>Inst.</th>{Array.from({ length: run.cycles }, (_, index) => <th key={index} className={index + 1 === shown ? "now" : ""}>{index + 1}</th>)}</tr></thead>
              <tbody>
                {ops.map((op, index) => (
                  <tr key={`${op.text}-t-${index}`} className={`${selected === index ? "on" : ""} ${hover === index ? "hot-row" : ""}`.trim()} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)} onClick={() => setSelected(index)}>
                    <td>I{index + 1}: {op.text.split(" ")[0]}</td>
                    {Array.from({ length: run.cycles }, (_, cell) => {
                      const token = cell < shown ? run.cells[index]?.[cell] ?? "" : "";
                      const hot = highlight && edge && token && (index === edge.from || index === edge.to);
                      const tip = token === "IF" ? "IF — instruction fetch" : token === "ID" ? "ID — instruction decode" : token === "EX" ? "EX — execute" : token === "MEM" ? "MEM — memory" : token === "WB" ? "WB — write back" : token === "STALL" ? "Stall — the pipeline waits for a value" : token === "FLUSH" ? "Flush — this instruction is discarded" : undefined;
                      return <td key={cell} className={`${token ? `st ${token}` : ""} ${hot ? "hot" : ""} ${cell + 1 === shown ? "col-now" : ""}`.trim()} title={tip}>{token}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <StageLegend names={[{ icon: "fetch", label: "IF" }, { icon: "decode", label: "ID" }, { icon: "execute", label: "EX" }, { icon: "memory", label: "MEM" }, { icon: "writeback", label: "WB" }, { icon: "stall", label: "Stall" }]} />
          <ForwardPath
            active={run.forwards.length > 0 && forwarding}
            text={edge ? `${edge.type} on ${edge.reg}. ${run.forwards[0] ? `${run.forwards[0].reg} travels ${run.forwards[0].path} from I${run.forwards[0].from + 1} to I${run.forwards[0].to + 1}.` : "This edge does not forward."}` : "No dependence is selected."}
            speed={play.speed}
            cycle={shown}
          />
        </section>
      </div>
      <div className="vl-cards three">
        <article className={mark("hazards")}>
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
          <p><b><SmoothNumber value={run.stalls} speed={play.speed} /></b> stall cycles in this order · forwarding events {run.forwards.length}</p>
          <p>CPI is cycles divided by {ops.length} instructions: {(run.cycles / Math.max(1, ops.length)).toFixed(2)}</p>
        </article>
        <article className={mark("forward")}>
          <h2>Forwarding / Rescheduling</h2>
          <p>ALU-to-ALU RAW hazards use the EX/MEM latch, so the consumer does not wait. A load-use pair still inserts one bubble, because the loaded word is not valid until the end of MEM. WAR and WAW stay visible in the detector, and this in-order pipeline does not stall for them.</p>
        </article>
      </div>
    </LabChrome>
  );
}
