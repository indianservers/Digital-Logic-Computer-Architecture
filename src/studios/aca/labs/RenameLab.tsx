import { useMemo, useState } from "react";
import { findDeps, parsePipe, type PipeOp } from "../../../engines/aca/hazards";
import { RENAME_EXAMPLE, runRename } from "../../../engines/aca/rename";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";
import { RenameTravel } from "../animation/motionViews";
import { useGuideFocus } from "../guide/focus";

const POOL = ["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12", "P13", "P14", "P15"];

function Timeline({ cells, cycles, shown, label }: { cells: Array<Array<string | null>>; cycles: number; shown: number; label: string }) {
  return (
    <div>
      <b>{label}</b>
      <div className="vl-scroll">
        <table className="vl-time">
          <thead><tr><th />{Array.from({ length: cycles }, (_, index) => <th key={index}>{index + 1}</th>)}</tr></thead>
          <tbody>
            {cells.map((row, index) => (
              <tr key={`${label}-${index}`}><td>I{index + 1}</td>{Array.from({ length: cycles }, (_, cell) => {
                const token = row[cell];
                return <td key={cell}>{cell < shown && token ? <span className={`st ${token}`}>{token}</span> : ""}</td>;
              })}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RenameLab() {
  const [ops, setOps] = useState<PipeOp[]>(RENAME_EXAMPLE);
  const [enabled, setEnabled] = useState(true);
  const [showMap, setShowMap] = useState(true);
  const [selected, setSelected] = useState(0);
  const [pool, setPool] = useState(10);
  const result = useMemo(() => runRename(ops, pool), [ops, pool]);
  const deps = useMemo(() => findDeps(ops), [ops]);
  const play = usePlayback(Math.max(result.baselineCycles, result.renamedCycles));
  const shown = Math.max(play.cycle, 0);
  const cycles = enabled ? result.renamedCycles : result.baselineCycles;
  const stalls = enabled ? result.renamedStalls : result.baselineStalls;
  const ipc = (ops.length / Math.max(1, cycles)).toFixed(2);
  const baseIpc = (ops.length / Math.max(1, result.baselineCycles)).toFixed(2);
  const row = result.rows[selected];
  const { id: guideFocus } = useGuideFocus();
  const mark = (id: string) => guideFocus === id ? "aca-guide-on" : undefined;
  const hint = !enabled
    ? "Renaming is off. False Dependences still lists the WAR and WAW names. Turn Enable Register Renaming on to give those writes different physical registers."
    : result.renameStalls > 0
      ? "Rename stalled: no free physical register is left. Raise Physical registers, or Step until retirement returns one to the free list."
      : "Compare a WAW pair in Instruction Mapping. Their physical destinations should differ. A RAW still uses the producer’s physical register.";
  return (
    <LabChrome lab="register-renaming" hint={hint} kicker="Labs > Lab 4" title="Lab 4 — Scoreboarding with Register Renaming" subtitle="Compare false dependencies before renaming and see how a rename map and physical registers improve parallelism." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>WAR and WAW are name conflicts, not true value dependencies. A new physical register for every write removes them. A later read of the old name still waits on the physical register that produced it.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : shown >= cycles ? "Completed" : `Running · cycle ${shown}`}</p><p>Adjust the sequence, toggle renaming, and press Play.</p></article>
        <article><h2>Same instructions</h2><p>Both columns use the same scoreboard and three arithmetic units. The extra unit is a lab assumption so a WAW stall is not hidden behind a busy functional unit. Renaming removes that name stall. RAW waits remain.</p></article>
      </div>
      <div className="vl-cards three">
        <section className="vl-panel">
          <header><h2>Instruction Sequence</h2>
            <button type="button" onClick={() => { setOps(RENAME_EXAMPLE); setSelected(0); play.reset(); }}>Load Example</button>
          </header>
          <table>
            <thead><tr><th>#</th><th>Instruction</th><th>Comment</th></tr></thead>
            <tbody>{ops.map((op, index) => <tr key={`${op.text}-${index}`} className={selected === index ? "on" : ""} onClick={() => setSelected(index)}><td>{index + 1}</td><td><input aria-label={`Instruction ${index + 1}`} value={op.text} onChange={(event) => { const next = ops.slice(); next[index] = parsePipe(event.target.value, op.comment); setOps(next); play.reset(); }} /></td><td>{op.comment}</td></tr>)}</tbody>
          </table>
        </section>
        <section className="vl-panel">
          <h2>False Dependences (Before Renaming)</h2>
          {deps.filter((edge) => edge.type !== "RAW").map((edge, index) => (
            <div className="vl-hazard" key={`${edge.type}-${index}`}><b>{edge.type}</b> I{edge.from + 1} and I{edge.to + 1} share {edge.reg}. {edge.type === "WAW" ? "Both write the same architectural name." : "The later write reuses a name the earlier instruction reads."}</div>
          ))}
          {deps.filter((edge) => edge.type === "RAW").map((edge, index) => (
            <div className="vl-hazard raw" key={`raw-${index}`}><b>RAW</b> I{edge.from + 1} produces {edge.reg}. I{edge.to + 1} reads it. Renaming keeps this true dependency.</div>
          ))}
          <p>Counts before renaming: WAW {result.waw}, WAR {result.war}, RAW {result.raw}.</p>
        </section>
        <section className={`vl-panel ${mark("map") ?? ""}`}>
          <h2>Rename Map</h2>
          {showMap ? (
            <table>
              <thead><tr><th>Architectural</th><th>Physical</th><th>Valid</th></tr></thead>
              <tbody>{result.map.map((item) => <tr key={item.arch} className={row && (row.archDest === item.arch || row.archSrcs.split(", ").includes(item.arch)) ? "on" : ""}><td>{item.arch}</td><td>{item.phys}</td><td>{item.valid ? "yes" : "fixed"}</td></tr>)}</tbody>
            </table>
          ) : <p>Rename map hidden.</p>}
        </section>
      </div>
      <div className="vl-cards three">
        <article className={mark("free")}>
          <h2>Physical Register File / Free List</h2>
          <RenameTravel allocated={row?.physDest && row.physDest !== "stall" ? row.physDest : ""} free={result.free.length} stalled={result.renameStalls > 0} speed={play.speed} cycle={play.cycle + selected} />
          <p className="vl-legend"><i className="used" /> In use <i className="free" /> Free <i className="recent" /> Recently allocated</p>
          <div className="vl-pregs">{POOL.map((name) => <span key={name} className={result.recent.includes(name) ? "recent" : result.free.includes(name) ? "free" : "used"}>{name}</span>)}</div>
          <p>Free list: {result.free.join(", ") || "empty"}. A physical register returns here only when it is no longer the current mapping and no instruction in this program still reads it.</p>
        </article>
        <article>
          <h2>Instruction Mapping</h2>
          <table>
            <thead><tr><th>#</th><th>Arch dest</th><th>Phys dest</th><th>Arch srcs</th><th>Phys srcs</th></tr></thead>
            <tbody>{result.rows.map((item, index) => <tr key={`${item.text}-${index}`} className={selected === index ? "on" : ""} onClick={() => setSelected(index)}><td>{index + 1}</td><td>{item.archDest}</td><td>{item.physDest}</td><td>{item.archSrcs}</td><td>{item.physSrcs}</td></tr>)}</tbody>
          </table>
          {row ? <p>I{selected + 1} writes architectural {row.archDest} as {row.physDest} and reads {row.physSrcs}.</p> : null}
        </article>
        <article>
          <h2>Pipeline / Scheduling Timeline</h2>
          <Timeline cells={result.baselineCells} cycles={result.baselineCycles} shown={shown} label="Before renaming (scoreboard)" />
          {enabled ? <Timeline cells={result.renamedCells} cycles={result.renamedCycles} shown={shown} label="After renaming" /> : null}
          <p className="vl-legend"><i className="st IF" /> IF <i className="st ID" /> ID <i className="st EX" /> EX <i className="st MEM" /> MEM <i className="st WB" /> WB <i className="st STALL" /> Stall</p>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={enabled} label="Enable Register Renaming" onChange={setEnabled} />
          <label>Physical registers
            <select aria-label="Physical registers" value={pool} onChange={(event) => { setPool(Number(event.target.value)); play.reset(); }}>
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={10}>10</option>
            </select>
          </label>
          <Toggle on={showMap} label="Show Rename Map" onChange={setShowMap} />
          <Transport playing={play.playing} speed={play.speed} onSpeed={play.setSpeed} onPlay={() => play.setPlaying((value) => !value)} onStep={() => play.setCycle((value) => Math.min(Math.max(result.baselineCycles, result.renamedCycles), value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} />
        </article>
        <article>
          <h2>Results & Insights</h2>
          <div className="vl-metrics">
            <div><span>Total cycles</span><strong>{result.baselineCycles}</strong><span>before</span><strong>{cycles}</strong><span>shown</span></div>
            <div><span>IPC</span><strong>{baseIpc}</strong><span>before</span><strong>{ipc}</strong><span>shown</span></div>
            <div><span>Stall cycles</span><strong>{result.baselineStalls}</strong><span>before</span><strong>{stalls}</strong><span>shown</span></div>
          </div>
        </article>
        <article>
          <h2>Register Renaming</h2>
          <p>The second write of x1 receives a different physical register from the first, so the WAW disappears. The subtract still reads the first physical destination, so the RAW remains. Physical registers in use: {result.recent.length}.</p>
          {result.renameStalls > 0 ? <p>Rename stalled: no free physical registers. {result.renameStalls} write{result.renameStalls === 1 ? "" : "s"} kept the architectural name.</p> : null}
        </article>
      </div>
    </LabChrome>
  );
}
