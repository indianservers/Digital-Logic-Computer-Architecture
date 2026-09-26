import { useMemo, useState } from "react";
import { OOO_EXAMPLE, parseOooProgram, runOoo } from "../../../engines/aca/ooo";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";
import { RobLife } from "../animation/motionViews";
import { useGuideFocus } from "../guide/focus";

const DEFAULT_PROGRAM = OOO_EXAMPLE.map((op) => op.text).join("\n");

function robLabel(state: string) {
  if (state === "ISSUED") return "Issued";
  if (state === "EXE") return "Executing";
  if (state === "WB") return "Waiting to Commit";
  if (state === "C") return "Committed";
  if (state === "FLUSH") return "Flushed";
  return "Waiting";
}

const FLOW = [
  ["fetch", "1. Fetch", "Fetch from the instruction stream"],
  ["decode", "2. Decode", "Decode and rename sources"],
  ["dispatch", "3. Dispatch", "Enter the issue window"],
  ["execute", "4. Execute", "Run when operands and a unit are free"],
  ["writeback", "5. Writeback", "Publish the result"],
  ["commit", "6. Commit", "Retire only from the ROB head"],
];

export function OooLab() {
  const [fault, setFault] = useState(false);
  const [faultAt, setFaultAt] = useState(1);
  const [robSize, setRobSize] = useState(16);
  const [issueWidth, setIssueWidth] = useState(2);
  const [commitWidth, setCommitWidth] = useState(1);
  const [alus, setAlus] = useState(2);
  const [muls, setMuls] = useState(1);
  const [mems, setMems] = useState(1);
  const [program, setProgram] = useState(DEFAULT_PROGRAM);
  const [showPipe, setShowPipe] = useState(true);
  const [selected, setSelected] = useState(0);
  const parsed = useMemo(() => parseOooProgram(program), [program]);
  const ops = parsed.ops.length ? parsed.ops : OOO_EXAMPLE;
  const shots = useMemo(
    () => runOoo(ops, fault ? Math.min(faultAt, ops.length - 1) : null, robSize, { issueWidth, commitWidth, alu: alus, mul: muls, mem: mems }),
    [ops, fault, faultAt, robSize, issueWidth, commitWidth, alus, muls, mems],
  );
  const play = usePlayback(Math.max(0, shots.length - 1));
  const { id: guideFocus } = useGuideFocus();
  const shot = shots[Math.min(play.cycle, shots.length - 1)] ?? shots[0];
  const last = shots.at(-1);
  if (!shot || !last) return null;
  const mark = (id: string) => guideFocus === id ? "aca-guide-on" : undefined;
  const occupied = shot.entries.filter((entry) => entry.state !== "C" && entry.state !== "WAIT" && entry.state !== "FLUSH").length;
  const width = Math.max(8, last.cycle);
  const hint = shot.flushed > 0
    ? "Younger instructions were flushed. Entries older than the fault can still be Committed."
    : occupied >= robSize
      ? "The reorder buffer is full. Dispatch waits until the head commits."
      : "A younger instruction may reach Waiting to Commit first. It stays there until it is the ROB head.";
  const done = shot.committed;
  return (
    <LabChrome lab="reorder-buffer" hint={hint} kicker="Labs > Lab 5" title="Lab 5 — Out-of-Order Execution & In-Order Commit" subtitle="Observe how instructions execute out of order while retirement preserves precise architectural state." badge="RISC-V (Superscalar OoO)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Writeback publishes a result to younger instructions. Commit updates architectural state, and only from the head of the reorder buffer.</p></article>
        <article><h2>Experiment Status</h2><p>{shot.done ? "Completed" : play.cycle === 0 ? "Ready to run" : `Cycle ${shot.cycle}`}</p></article>
        <article><h2>Latencies</h2><p>ALU 1, multiply 3, load/store 3. Two ALUs, one multiplier, one memory unit. These are lab assumptions.</p></article>
      </div>
      <div className="vl-flow">{FLOW.map(([kind, title, text]) => <span key={kind} className={kind}><b>{title}</b><br />{text}</span>)}</div>
      <RobLife state={robLabel(shot.entries[selected]?.state ?? "WAIT")} flushed={shot.flushed} committed={shot.committed} speed={play.speed} cycle={play.cycle} text={ops[selected]?.text ?? "The selected instruction"} />
      <div className="vl-cards three">
        <article>
          <h2>Instruction Window / Issue Queue</h2>
          <table>
            <thead><tr><th>#</th><th>Instruction</th><th>State</th><th>Ready</th><th>Waiting</th></tr></thead>
            <tbody>{shot.window.map((row, index) => <tr key={row.text} className={selected === index ? "on" : ""} onClick={() => setSelected(index)}><td>{index + 1}</td><td>{row.text}</td><td>{row.state}</td><td className={row.ready ? "vl-ok" : "vl-bad"}>{row.ready ? "yes" : "no"}</td><td>{row.waiting}</td></tr>)}</tbody>
          </table>
        </article>
        <article>
          <h2>Execution Units</h2>
          {shot.units.map((unit) => (
            <div className="vl-unit" key={unit.name}>
              <b>{unit.name}</b> {unit.remain}
              <meter min={0} max={unit.name.includes("ALU") ? 2 : 1} value={Number(unit.remain.split("/")[0])} />
              <p>{unit.busy}</p>
            </div>
          ))}
        </article>
        <article className={mark("rob")}>
          <h2>Reorder Buffer</h2>
          <table>
            <thead><tr><th>Idx</th><th>Instruction</th><th>Dest</th><th>Value</th><th>State</th></tr></thead>
            <tbody>{shot.entries.map((entry) => <tr key={entry.index} className={selected === entry.index ? "on" : ""} onClick={() => setSelected(entry.index)}><td>{entry.index}</td><td>{entry.text}</td><td>{entry.dest}</td><td>{entry.value}</td><td className={`tag ${entry.state}`}>{robLabel(entry.state)}</td></tr>)}</tbody>
          </table>
        </article>
      </div>
      <div className="vl-cards three">
        <article><h2>Writeback & Retirement</h2><p><b>Writeback:</b> {shot.writeback}</p><p>A writeback is not a commit. Younger instructions may use the value while the producer is still waiting at the head.</p><p><b>Next commit:</b> {shot.commit}</p><p>Committed so far: {shot.committed}</p>{shot.entries.filter((entry) => entry.state !== "C" && entry.state !== "WAIT" && entry.state !== "FLUSH").length >= robSize ? <p>Dispatch stalled: the reorder buffer is full.</p> : null}</article>
        <article className={mark("flush")}><h2>Exception / Flush</h2><p>{shot.exception}</p><p>Flushed instructions: {shot.flushed}</p>          <Toggle on={fault} label="Inject a precise exception" onChange={(next) => { setFault(next); play.reset(); }} />
          <label>Faulting instruction
            <select aria-label="Faulting instruction" value={faultAt} onChange={(event) => { setFaultAt(Number(event.target.value)); play.reset(); }}>
              {ops.map((op, index) => <option key={op.text} value={index}>I{index + 1} {op.text}</option>)}
            </select>
          </label>
          <p>Older instructions may commit. The faulting instruction and everything younger are flushed and do not update architectural state.</p></article>
        <article>
          <h2>Cycle Simulation Controls</h2>
          <p>Cycle {shot.cycle} / {last.cycle}</p>
          <label>Instruction stream
            <textarea aria-label="Instruction stream" rows={6} value={program} onChange={(event) => { setProgram(event.target.value); setSelected(0); play.reset(); }} spellCheck={false} />
          </label>
          {parsed.errors[0] ? <p className="vl-bad">{parsed.errors[0]}</p> : null}
          <label>Reorder buffer entries
            <select aria-label="Reorder buffer size" value={robSize} onChange={(event) => { setRobSize(Number(event.target.value)); play.reset(); }}>
              {[2, 4, 8, 16].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Issue width
            <select aria-label="Issue width" value={issueWidth} onChange={(event) => { setIssueWidth(Number(event.target.value)); play.reset(); }}>
              {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Commit width
            <select aria-label="Commit width" value={commitWidth} onChange={(event) => { setCommitWidth(Number(event.target.value)); play.reset(); }}>
              {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>ALU / multiply / memory units
            <select aria-label="ALU count" value={alus} onChange={(event) => { setAlus(Number(event.target.value)); play.reset(); }}>
              {[1, 2, 3].map((value) => <option key={value} value={value}>{value} ALU</option>)}
            </select>
            <select aria-label="Multiply count" value={muls} onChange={(event) => { setMuls(Number(event.target.value)); play.reset(); }}>
              {[1, 2].map((value) => <option key={value} value={value}>{value} MUL</option>)}
            </select>
            <select aria-label="Memory unit count" value={mems} onChange={(event) => { setMems(Number(event.target.value)); play.reset(); }}>
              {[1, 2].map((value) => <option key={value} value={value}>{value} MEM</option>)}
            </select>
          </label>
          <Toggle on={showPipe} label="Show Pipeline Animation" onChange={setShowPipe} />
          <Transport playing={play.playing} speed={play.speed} onSpeed={play.setSpeed} onPlay={() => play.setPlaying((value) => !value)} onStep={() => play.setCycle((value) => Math.min(shots.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} />
        </article>
      </div>
      {showPipe ? (
        <section className="vl-panel">
          <header><h2>Pipeline Visualization</h2><b>Cycle {shot.cycle} / {last.cycle}</b></header>
          <div className="vl-scroll">
            <table className="vl-time">
              <thead><tr><th>Instruction</th>{Array.from({ length: width }, (_, index) => <th key={index} className={index + 1 === shot.cycle ? "now" : ""}>{index + 1}</th>)}</tr></thead>
              <tbody>
                {ops.map((op, index) => (
                  <tr key={op.text} className={selected === index ? "on" : ""} onClick={() => setSelected(index)}><td>{op.text}</td>{Array.from({ length: width }, (_, cell) => {
                    const token = shot.cells[index]?.[cell];
                    const kind = token === "F" ? "IF" : token === "D" ? "ID" : token === "IS" ? "IS" : token === "C" ? "WB" : token ?? "";
                    return <td key={cell}>{cell < shot.cycle && token ? <span className={`st ${kind}`}>{token}</span> : ""}</td>;
                  })}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="vl-legend"><i className="st IF" /> F <i className="st ID" /> D <i className="st IS" /> IS <i className="st EX" /> EX <i className="st WB" /> WB / C</p>
        </section>
      ) : null}
      <div className="vl-cards three">
        <article>
          <h2>Results</h2>
          <div className="vl-metrics">
            <div><span>Committed</span><strong>{done}</strong></div>
            <div><span>Total cycles</span><strong>{last.cycle}</strong></div>
            <div><span>IPC so far</span><strong>{(shot.committed / Math.max(1, shot.cycle)).toFixed(2)}</strong></div>
          </div>
          <p>Selected I{selected + 1} {ops[selected]?.text}: {robLabel(shot.entries[selected]?.state ?? "WAIT")}. Trace: program → issue window → {ops[selected]?.fu ?? "unit"} → writeback → ROB → commit.</p>
          <p>{fault && shot.flushed > 0 ? "The fault is precise: only instructions older than the faulting ROB head committed. Younger completed work was discarded." : shot.entries[selected]?.state === "WB" ? "This instruction has written back, but it cannot retire until every older ROB entry has committed." : "Commit walks the ROB from the head. A finished younger instruction waits there."}</p>
        </article>
        <article>
          <h2>Out-of-Order Execution</h2>
          <p>SUB has no dependence on the multiply, so it can write back first. It still cannot commit until LD and ADD, which are older, have left the head. Execution order is not commit order.</p>
        </article>
        <article>
          <h2>Precise state</h2>
          <p>Architectural updates happen only at commit. With the exception injected, flushed results stay out of the committed count.</p>
        </article>
      </div>
    </LabChrome>
  );
}
