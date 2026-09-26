import { useMemo, useState } from "react";
import { OOO_EXAMPLE, runOoo } from "../../../engines/aca/ooo";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";

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
  const [robSize, setRobSize] = useState(16);
  const [showPipe, setShowPipe] = useState(true);
  const [selected, setSelected] = useState(0);
  const shots = useMemo(() => runOoo(OOO_EXAMPLE, fault ? 1 : null, robSize), [fault, robSize]);
  const play = usePlayback(Math.max(0, shots.length - 1));
  const shot = shots[Math.min(play.cycle, shots.length - 1)] ?? shots[0];
  const last = shots.at(-1);
  if (!shot || !last) return null;
  const width = Math.max(8, last.cycle);
  const done = shot.committed;
  return (
    <LabChrome lab="reorder-buffer" kicker="Labs > Lab 5" title="Lab 5 — Out-of-Order Execution & In-Order Commit" subtitle="Observe how instructions execute out of order while retirement preserves precise architectural state." badge="RISC-V (Superscalar OoO)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Writeback publishes a result to younger instructions. Commit updates architectural state, and only from the head of the reorder buffer.</p></article>
        <article><h2>Experiment Status</h2><p>{shot.done ? "Completed" : play.cycle === 0 ? "Ready to run" : `Cycle ${shot.cycle}`}</p></article>
        <article><h2>Latencies</h2><p>ALU 1, multiply 3, load/store 3. Two ALUs, one multiplier, one memory unit. These are lab assumptions.</p></article>
      </div>
      <div className="vl-flow">{FLOW.map(([kind, title, text]) => <span key={kind} className={kind}><b>{title}</b><br />{text}</span>)}</div>
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
        <article>
          <h2>Reorder Buffer</h2>
          <table>
            <thead><tr><th>Idx</th><th>Instruction</th><th>Dest</th><th>Value</th><th>State</th></tr></thead>
            <tbody>{shot.entries.map((entry) => <tr key={entry.index} className={selected === entry.index ? "on" : ""} onClick={() => setSelected(entry.index)}><td>{entry.index}</td><td>{entry.text}</td><td>{entry.dest}</td><td>{entry.value}</td><td className={`tag ${entry.state}`}>{entry.state}</td></tr>)}</tbody>
          </table>
        </article>
      </div>
      <div className="vl-cards three">
        <article><h2>Writeback & Retirement</h2><p><b>Writeback:</b> {shot.writeback}</p><p>A writeback is not a commit. Younger instructions may use the value while the producer is still waiting at the head.</p><p><b>Next commit:</b> {shot.commit}</p><p>Committed so far: {shot.committed}</p>{shot.entries.filter((entry) => entry.state !== "C" && entry.state !== "WAIT" && entry.state !== "FLUSH").length >= robSize ? <p>Dispatch stalled: the reorder buffer is full.</p> : null}</article>
        <article><h2>Exception / Flush</h2><p>{shot.exception}</p><p>Flushed instructions: {shot.flushed}</p><Toggle on={fault} label="Inject Exception on ADD" onChange={(next) => { setFault(next); play.reset(); }} /><p>Older instructions may commit. The faulting instruction and everything younger are removed and do not update architectural state.</p></article>
        <article>
          <h2>Cycle Simulation Controls</h2>
          <p>Cycle {shot.cycle} / {last.cycle}</p>
          <label>Reorder buffer entries
            <select aria-label="Reorder buffer size" value={robSize} onChange={(event) => { setRobSize(Number(event.target.value)); play.reset(); }}>
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={16}>16</option>
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
                {OOO_EXAMPLE.map((op, index) => (
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
          <p>Selected I{selected + 1}: {shot.entries[selected]?.state}. Completed means writeback. Committed means the head retired it.</p>
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
