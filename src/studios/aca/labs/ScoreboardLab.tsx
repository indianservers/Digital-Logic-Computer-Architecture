import { useMemo, useState } from "react";
import { SCORE_EXAMPLE, parseScore, runScoreboard, type ScoreOp } from "../../../engines/aca/scoreboard";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";
import { ScoreboardFlow } from "../animation/motionViews";
import { useGuideFocus } from "../guide/focus";

const PRESETS: Array<{ id: string; label: string; ops: ScoreOp[] }> = [
  { id: "classic", label: "Load / multiply chain", ops: SCORE_EXAMPLE },
  { id: "waw", label: "WAW on x1", ops: [parseScore("LD x1, 0(x2)", "# writes x1"), parseScore("ADD x1, x3, x4", "# also writes x1")] },
  { id: "war", label: "WAR on x8", ops: [parseScore("LD x1, 0(x2)"), parseScore("ADD x4, x1, x8"), { ...parseScore("SUB x8, x5, x6"), latency: 1 }] },
  { id: "struct", label: "One multiplier", ops: [parseScore("MUL x1, x2, x3"), parseScore("MUL x4, x5, x6"), parseScore("ADD x7, x1, x4")] },
];

export function ScoreboardLab() {
  const [ops, setOps] = useState(SCORE_EXAMPLE);
  const [hazards, setHazards] = useState(true);
  const [structural, setStructural] = useState(true);
  const [aluSlots, setAluSlots] = useState(2);
  const [mulLatency, setMulLatency] = useState(6);
  const tuned = useMemo(() => ops.map((op) => op.fu === "Multiplier" ? { ...op, latency: mulLatency } : op), [ops, mulLatency]);
  const shots = useMemo(() => runScoreboard(tuned, 80, aluSlots), [tuned, aluSlots]);
  const play = usePlayback(Math.max(0, shots.length - 1));
  const { id: guideFocus } = useGuideFocus();
  const shot = shots[Math.min(play.cycle, shots.length - 1)] ?? shots[0];
  const last = shots.at(-1);
  const busyCycles = shots.filter((item) => item.units.some((unit) => unit.busy)).length;
  const util = (name: string) => {
    const used = shots.filter((item) => item.units.find((unit) => unit.name === name)?.busy).length;
    return Math.round((used / Math.max(1, shots.length - 1)) * 100);
  };
  if (!shot || !last) return null;
  const mark = (id: string) => guideFocus === id ? "aca-guide-on" : undefined;
  const hazard = shot.events.find((event) => event.hazard);
  const hint = hazard ? `${hazard.hazard}: ${hazard.text}` : "Step and read Instruction Status, Functional Unit Status, and Register Result Status together.";
  const completed = shot.rows.filter((row) => row.state === "Completed").length;
  return (
    <LabChrome lab="scoreboard" hint={hint} kicker="Labs > Lab 2" title="Lab 2 — Dynamic Scheduling with Scoreboard" subtitle="Issue when a functional unit is free and the destination is not pending. Read operands on RAW. Delay the write when an earlier instruction still has to read that register." badge="RISC-V (Scoreboard)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>The scoreboard issues out of lockstep with execution, but it does not rename registers. A second write of the same register waits. A write also waits for an earlier unread use.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : shot.done ? "Completed" : `Cycle ${shot.cycle}`}</p></article>
        <article><h2>Rule of the cycle</h2><p>Each cycle tries one write, advances execution, reads one ready instruction, then issues the next instruction.</p></article>
      </div>
      <div className="vl-split">
        <section className="vl-panel">
          <header><h2>Instruction Sequence</h2>
            <button type="button" onClick={() => { setOps([...ops, parseScore("ADD x1, x2, x3", "# custom")]); play.reset(); }}>Add instruction</button>
            <button type="button" onClick={() => { if (ops.length < 2) return; setOps(ops.slice(0, -1)); play.reset(); }}>Remove last</button>
            <select aria-label="Load example" value="" onChange={(event) => { const preset = PRESETS.find((item) => item.id === event.target.value); if (!preset) return; setOps(preset.ops); play.reset(); }}>
              <option value="">Load Example</option>
              {PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            </select>
          </header>
          <table>
            <thead><tr><th>#</th><th>Instruction</th><th>Comment</th></tr></thead>
            <tbody>{ops.map((op, index) => <tr key={`${op.text}-${index}`}><td>{index + 1}</td><td><input aria-label={`Instruction ${index + 1}`} value={op.text} onChange={(event) => { const next = ops.slice(); next[index] = parseScore(event.target.value, op.comment); setOps(next); play.reset(); }} /></td><td>{op.comment}</td></tr>)}</tbody>
          </table>
        </section>
        <section className={`vl-panel ${mark("status") ?? ""}`}>
          <header><h2>Instruction Status (Scoreboard)</h2></header>
          <table>
            <thead><tr><th>#</th><th>Instruction</th><th>Issue</th><th>Read</th><th>Execute</th><th>Write</th><th>Status</th></tr></thead>
            <tbody>
              {shot.rows.map((row, index) => (
                <tr key={`${ops[index]?.text ?? index}`}>
                  <td>{index + 1}</td>
                  <td>{ops[index]?.text}</td>
                  <td>{row.issue ?? "-"}</td>
                  <td>{row.read ?? "-"}</td>
                  <td>{row.execStart ? `${row.execStart}–${row.execEnd ?? "…"}` : "-"}</td>
                  <td>{row.write ?? "-"}</td>
                  <td className={`tag ${row.state}`}>{row.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ScoreboardFlow
            state={shot.rows.find((row) => row.state !== "Completed")?.state ?? "Completed"}
            unit={shot.units.find((unit) => unit.busy)?.name ?? "Units"}
            speed={play.speed}
            cycle={play.cycle}
            blocked={shot.units.some((unit) => unit.qj || unit.qk) ? "A source tag is still false, so operand read waits on the producer." : "Sources that are ready can be read. A later write waits while an earlier reader still needs the old value."}
          />
        </section>
      </div>
      <div className="vl-cards three">
        <article className={mark("units")}>
          <h2>Functional Unit Status</h2>
          <table>
            <thead><tr><th>Unit</th><th>Busy</th><th>Op</th><th>Fi</th><th>Fj</th><th>Fk</th><th>Qj</th><th>Qk</th><th>Rem</th></tr></thead>
            <tbody>
              {shot.units.map((unit) => (
                <tr key={unit.name}><td>{unit.name}</td><td>{unit.busy ? "Yes" : "No"}</td><td>{unit.op}</td><td>{unit.fi}</td><td>{unit.fj}</td><td>{unit.fk}</td><td>{unit.qj}</td><td>{unit.qk}</td><td>{unit.remain ?? "-"}</td></tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className={mark("regs")}>
          <h2>Register Result Status</h2>
          <table>
            <tbody>
              {(shot.registers.length ? shot.registers : [{ name: "—", fu: "—" }]).map((reg) => <tr key={reg.name}><td>{reg.name}</td><td>{reg.fu}</td></tr>)}
            </tbody>
          </table>
        </article>
        <article>
          <h2>Simulation Controls</h2>
          <p>Current cycle {shot.cycle}</p>
          <label>Integer units
            <select aria-label="Integer units" value={aluSlots} onChange={(event) => { setAluSlots(Number(event.target.value)); play.reset(); }}>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
          <label>Multiply latency
            <input aria-label="Multiply latency" type="number" min={1} max={20} value={mulLatency} onChange={(event) => { setMulLatency(Math.max(1, Math.min(20, Number(event.target.value) || 1))); play.reset(); }} />
          </label>
          <Toggle on={hazards} label="Show Data Hazards" onChange={setHazards} />
          <Toggle on={structural} label="Show Structural Conflicts" onChange={setStructural} />
          <Transport playing={play.playing} speed={play.speed} onSpeed={play.setSpeed} onPlay={() => play.setPlaying((value) => !value)} onStep={() => play.setCycle((value) => Math.min(shots.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={() => { setOps(SCORE_EXAMPLE); play.reset(); }} />
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Hazard Monitor</h2>
          <ul>
            {shot.events.filter((event) => event.hazard && (event.hazard === "Structural" ? structural : hazards)).map((event, index) => <li key={`${event.text}-${index}`}><b>{event.hazard}</b> {event.text}</li>)}
            {shot.events.every((event) => !event.hazard) ? <li>No new hazard stall on this cycle.</li> : null}
          </ul>
        </article>
        <article>
          <h2>Results & Insights</h2>
          <p><b>{last.cycle}</b> total cycles</p>
          <p><b>{completed}</b> / {ops.length} completed by this cycle</p>
          <p><b>{(last.cycle / ops.length).toFixed(2)}</b> CPI</p>
          <p>{busyCycles} cycles had at least one busy unit.</p>
        </article>
        <article>
          <h2>Functional Unit Utilization</h2>
          {shot.units.map((unit) => <p key={unit.name}>{unit.name} {util(unit.name)}%</p>)}
          <p className="tiny">Utilization is the share of cycles that unit stayed busy. Scoreboarding does not rename, so a WAW still blocks issue.</p>
        </article>
      </div>
    </LabChrome>
  );
}
