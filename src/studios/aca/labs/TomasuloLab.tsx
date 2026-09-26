import { useMemo, useState } from "react";
import { TOMA_PRESETS, TOMA_SHAPE, parseTomasulo, snapshotTomasulo, runTomasulo, type TomaShape } from "../../../engines/aca/tomasulo";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";
import { CdbBroadcast } from "../animation/motionViews";
import { useGuideFocus } from "../guide/focus";

export function TomasuloLab() {
  const [presetId, setPresetId] = useState(TOMA_PRESETS[0]?.id ?? "mixed");
  const preset = TOMA_PRESETS.find((item) => item.id === presetId) ?? TOMA_PRESETS[0];
  const [lines, setLines] = useState((preset?.ops ?? []).map((op) => op.text).join("\n"));
  const [addStations, setAddStations] = useState(TOMA_SHAPE.add);
  const [mulLatency, setMulLatency] = useState(6);
  const shape = useMemo<TomaShape>(() => ({ ...TOMA_SHAPE, add: addStations }), [addStations]);
  const ops = useMemo(() => lines.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const op = parseTomasulo(line);
    return op.kind === "mul" ? { ...op, latency: mulLatency } : op;
  }), [lines, mulLatency]);
  const full = useMemo(() => runTomasulo(ops, { F2: 8 }, shape), [ops, shape]);
  const play = usePlayback(full.cycles);
  const { id: guideFocus } = useGuideFocus();
  const view = useMemo(() => snapshotTomasulo(ops, play.cycle, { F2: 8 }, shape), [ops, play.cycle, shape]);
  const [showTags, setShowTags] = useState(true);
  const [showCdb, setShowCdb] = useState(true);
  const group = (kind: "add" | "mul" | "div" | "load" | "store") => view.stations.filter((station) => station.kind === kind);
  const serial = ops.reduce((sum, op) => sum + op.latency, 0);
  if (!preset) return null;
  const mark = (id: string) => guideFocus === id ? "aca-guide-on" : undefined;
  const liveBus = view.cdb.find((event) => event.cycle === play.cycle);
  const tagged = view.stations.some((station) => station.qj || station.qk);
  const hint = liveBus
    ? `The CDB is broadcasting ${liveBus.tag}. Watch a matching Qj or Qk become a value.`
    : tagged
      ? "A reservation station is holding a producer tag in Qj or Qk. Step until that tag is on the CDB."
      : "Step through issue and see whether the station captures Vj/Vk or a tag.";
  return (
    <LabChrome lab="tomasulo" hint={hint} kicker="Labs > Lab 3" title="Lab 3 — Tomasulo Algorithm Simulator" subtitle="Reservation stations hold a value or a tag. The common data bus broadcasts one result per cycle. A later write renames the register, so only a true RAW dependence waits." badge="RISC-V FP · Tomasulo">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Issue captures Vj/Vk when the register is ready, otherwise Qj/Qk. Latencies: add/sub 2, multiply 6, divide 12, load 2. One CDB, so two finished stations never broadcast together.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : play.cycle >= full.cycles ? "Completed" : `Cycle ${play.cycle}`}</p></article>
        <article><h2>{preset.label}</h2><p>{preset.blurb}</p></article>
      </div>
      <div className="vl-split">
        <section className="vl-panel">
          <header><h2>Instruction Queue</h2><button type="button" onClick={() => { setLines(`${lines.trim()}\nADD.D F6, F2, F4`); play.reset(); }}>Add instruction</button></header>
          <textarea aria-label="Custom instruction sequence" rows={8} value={lines} onChange={(event) => { setLines(event.target.value); play.reset(); }} />
          <table>
            <thead><tr><th>#</th><th>Instruction</th><th>Comment</th></tr></thead>
            <tbody>{ops.map((op, index) => <tr key={`${op.text}-${index}`} className={(view.issue[index] ?? 99) <= play.cycle ? "on" : ""}><td>{index + 1}</td><td>{op.text}</td><td>{op.comment}</td></tr>)}</tbody>
          </table>
        </section>
        <section className={`vl-panel ${mark("stations") ?? ""}`}>
          <header><h2>Reservation Stations</h2></header>
          <div className="vl-stations">
            {[{ title: "Add / Sub", kind: "add" as const }, { title: "Mul / Div", kind: "mul" as const }, { title: "Load / Store", kind: "load" as const }].map((block) => (
              <table key={block.title}>
                <caption>{block.title}</caption>
                <thead><tr><th>Name</th><th>Busy</th><th>Op</th><th>Vj</th><th>Vk</th><th>Qj</th><th>Qk</th><th>A</th></tr></thead>
                <tbody>
                  {(block.kind === "mul" ? [...group("mul"), ...group("div")] : block.kind === "load" ? [...group("load"), ...group("store")] : group("add")).map((station) => (
                    <tr key={station.name}><td>{station.name}</td><td>{station.busy ? "Yes" : "No"}</td><td>{station.op}</td><td>{showTags ? station.vj : ""}</td><td>{station.vk}</td><td>{showTags ? station.qj : ""}</td><td>{station.qk}</td><td>{station.address}</td></tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </section>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Register File / Tag Status</h2>
          <table>
            <thead><tr><th>Register</th><th>Value</th><th>Qi</th></tr></thead>
            <tbody>{view.regs.map((reg) => <tr key={reg.name}><td>{reg.name}</td><td>{reg.value}</td><td>{showTags ? reg.qi : "-"}</td></tr>)}</tbody>
          </table>
        </article>
        <article className={mark("cdb")}>
          <h2>Common Data Bus</h2>
          <CdbBroadcast
            tag={view.cdb.find((event) => event.cycle === play.cycle)?.tag ?? ""}
            value={view.cdb.find((event) => event.cycle === play.cycle)?.value ?? ""}
            dest={view.cdb.find((event) => event.cycle === play.cycle)?.dest ?? ""}
            live={showCdb && view.cdb.some((event) => event.cycle === play.cycle)}
            speed={play.speed}
            cycle={play.cycle}
          />
          <table>
            <thead><tr><th>Cycle</th><th>Tag</th><th>Value</th><th>Dest</th></tr></thead>
            <tbody>{(showCdb ? view.cdb : []).map((event) => <tr key={`${event.tag}-${event.cycle}`}><td>{event.cycle}</td><td>{event.tag}</td><td>{event.value}</td><td>{event.dest}</td></tr>)}</tbody>
          </table>
        </article>
        <article>
          <h2>Example Programs</h2>
          <p>{preset.blurb}</p>
          {TOMA_PRESETS.map((item) => <button type="button" key={item.id} className={item.id === presetId ? "on" : ""} onClick={() => { setPresetId(item.id); setLines(item.ops.map((op) => op.text).join("\n")); play.reset(); }}>{item.label}</button>)}
        </article>
      </div>
      <section className="vl-panel">
        <header><h2>Execution Timeline</h2><b>Cycle {Math.max(play.cycle, 1)} / {full.cycles}</b></header>
        <div className="vl-scroll">
          <table className="vl-time">
            <thead><tr><th>Instruction</th>{Array.from({ length: full.cycles }, (_, index) => <th key={index}>{index + 1}</th>)}</tr></thead>
            <tbody>
              {ops.map((op, index) => (
                <tr key={`${op.text}-line`}><td>{op.text}</td>{Array.from({ length: full.cycles }, (_, cell) => <td key={cell} className={cell < play.cycle ? `st ${full.cells[index]?.[cell] ?? ""}` : ""}>{cell < play.cycle ? full.cells[index]?.[cell] ?? "" : ""}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="vl-legend"><i className="st IF" /> IF <i className="st ID" /> ID <i className="st IS" /> IS <i className="st EX" /> EX <i className="st WB" /> WB</p>
      </section>
      <div className="vl-cards three">
        <article>
          <h2>Simulation Controls</h2>
          <label>Add / Sub stations
            <select aria-label="Add stations" value={addStations} onChange={(event) => { setAddStations(Number(event.target.value)); play.reset(); }}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <label>Multiply latency
            <input aria-label="Multiply latency" type="number" min={1} max={20} value={mulLatency} onChange={(event) => { setMulLatency(Math.max(1, Math.min(20, Number(event.target.value) || 1))); play.reset(); }} />
          </label>
          <Toggle on={showTags} label="Show Reservation Station Tags" onChange={setShowTags} />
          <Toggle on={showCdb} label="Show CDB Broadcasts" onChange={setShowCdb} />
          <Transport playing={play.playing} speed={play.speed} onSpeed={play.setSpeed} onPlay={() => play.setPlaying((value) => !value)} onStep={() => play.setCycle((value) => Math.min(full.cycles, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} />
        </article>
        <article>
          <h2>Results & Insights</h2>
          <p><b>{full.cycles}</b> total cycles</p>
          <p><b>{ops.length}</b> instructions</p>
          <p><b>{(serial / Math.max(1, full.cycles)).toFixed(2)}x</b> versus running each latency back to back ({serial} cycles)</p>
          <p>CDB broadcasts: {full.cdb.length}. Issue stalls from a full station group: {full.stalls}.</p>
          {full.stalls > 0 ? <p>Issue stalled: an instruction is waiting because its reservation-station group is full.</p> : null}
        </article>
        <article>
          <h2>How Tomasulo Resolves Dependences</h2>
          <p>A RAW consumer keeps the producer tag until that tag appears on the CDB. A later instruction that writes the same register receives a new station tag, so the earlier reader is not confused with the newer write. WAR and WAW do not stall issue. RAW does.</p>
        </article>
      </div>
    </LabChrome>
  );
}
