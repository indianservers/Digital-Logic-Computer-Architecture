import { useMemo, useState } from "react";
import { LSQ_PRESETS, MEM_IMAGE, MEM_REGS, parseLsqProgram, runLsq, type LsqShot, type MemPolicy } from "../../../engines/aca/lsq";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";
import { MemoryFlow } from "../animation/phase2Views";
import { useGuideFocus } from "../guide/focus";

function statusClass(status: string) {
  return `tag ${status.replace(/[^A-Za-z]/g, "")}`;
}

function averageLatency(shot: LsqShot) {
  const samples = shot.cells.map((row) => {
    const start = row.findIndex((cell) => cell != null);
    const done = row.findIndex((cell) => cell === "MEM");
    if (start < 0 || done < 0) return null;
    return done - start + 1;
  }).filter((value): value is number => value != null);
  if (!samples.length) return 0;
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

export function LsqLab() {
  const [presetId, setPresetId] = useState(LSQ_PRESETS[2]?.id ?? "forward");
  const [forwardOn, setForwardOn] = useState(true);
  const [matchOn, setMatchOn] = useState(true);
  const [partialOn, setPartialOn] = useState(false);
  const [showForward, setShowForward] = useState(true);
  const [orderOn, setOrderOn] = useState(true);
  const [detectOn, setDetectOn] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [auto, setAuto] = useState(true);
  const [selected, setSelected] = useState(0);
  const [lqSize, setLqSize] = useState(8);
  const [sqSize, setSqSize] = useState(8);
  const [delay, setDelay] = useState(0);
  const [policy, setPolicy] = useState<MemPolicy>("conservative");
  const [program, setProgram] = useState("STORE [0x100], 42\nLOAD R1, [0x100]\nLOAD R2, [0x200]");
  const [custom, setCustom] = useState(false);
  const preset = LSQ_PRESETS.find((item) => item.id === presetId) ?? LSQ_PRESETS[0];
  const parsed = useMemo(() => (custom ? parseLsqProgram(program) : null), [custom, program]);
  const ops = (parsed && parsed.ops.length ? parsed.ops : (preset?.ops ?? [])).map((op) => (
    custom && delay > 0 && op.kind === "load" ? { ...op, latency: delay } : op
  ));
  const regs = parsed && parsed.ops.length ? parsed.regs : MEM_REGS;
  const memory = parsed && parsed.ops.length ? { ...MEM_IMAGE, ...parsed.memory } : MEM_IMAGE;
  const result = useMemo(() => runLsq(ops, regs, memory, {
    policy,
    forwarding: forwardOn && matchOn,
    checks: orderOn && detectOn,
    lqSize,
    sqSize,
  }), [ops, regs, memory, policy, forwardOn, matchOn, orderOn, detectOn, lqSize, sqSize]);
  const play = usePlayback(Math.max(0, result.shots.length - 1));
  const { id: guideFocus, setId: setGuideFocus } = useGuideFocus();
  if (!preset) return null;
  const shot = result.shots[Math.min(play.cycle, result.shots.length - 1)];
  if (!shot) return null;
  const chosen = ops[selected] ?? ops[0];
  const chosenEntry = [...shot.loads, ...shot.stores].find((entry) => entry.index === selected);
  const forwarded = shot.loads.find((entry) => entry.status === "Forwarded");
  const violation = shot.log.filter((item) => item.event === "Violation").at(-1);
  const log = shot.log.filter((item) => (showForward || item.event !== "Forward") && (showEvents || (item.event !== "Violation" && item.event !== "Replay")));
  const latency = averageLatency(shot);
  const columns = Math.max(shot.cycle, 1);
  const replayed = shot.replays > (result.shots[play.cycle - 1]?.replays ?? 0);
  const hint = replayed
    ? "The load executed before the older store's address was known. Their addresses later matched."
    : forwarded
      ? "This load took its data from the store queue."
      : shot.event.toLowerCase().includes("full")
        ? "A queue is full, so the next memory instruction cannot allocate an entry."
        : "Step and compare known addresses with entries that are still unknown.";
  return (
    <LabChrome lab="load-store-queue" kicker="Labs > Lab 14" title="Lab 14 — Load / Store Queue Simulator" subtitle="Experiment with memory ordering, address resolution, and store-to-load forwarding in an out-of-order core." badge="RISC-V (5-Stage Pipeline)" hint={hint}>
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Understand how load and store queues keep program order, resolve addresses, forward store data, and detect a memory ordering violation.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : shot.event}</p><p>Policy for this example: {preset.policy}. Stores update architectural memory only when they commit.</p></article>
        <article><h2>Memory ordering</h2><p>Memory ordering is enforced by the queues. A younger load sees the youngest older store to the same address, or memory if no such store exists.</p></article>
      </div>
      <div className="vl-cards three">
        <article>
          <header><h2>Load Queue (LQ)</h2><b>Entries: {shot.loads.length} / {lqSize}</b></header>
          <table>
            <thead><tr><th>#</th><th>Instr.</th><th>Dest</th><th>Address</th><th>Status</th><th>Age</th></tr></thead>
            <tbody>
              {shot.loads.map((entry) => (
                <tr key={entry.index} className={selected === entry.index ? "on" : ""} onClick={() => setSelected(entry.index)}>
                  <td>{entry.index}</td><td>{entry.text.split(" ")[0]}</td><td>{entry.dest}</td><td>{entry.address}</td><td className={statusClass(entry.status)}>{entry.status}</td><td>{entry.age}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article>
          <header><h2>Store Queue (SQ)</h2><b>Entries: {shot.stores.length} / {sqSize}</b></header>
          <table>
            <thead><tr><th>#</th><th>Instr.</th><th>Src</th><th>Address</th><th>Data</th><th>Status</th><th>Age</th></tr></thead>
            <tbody>
              {shot.stores.map((entry) => (
                <tr key={entry.index} className={selected === entry.index ? "on" : ""} onClick={() => setSelected(entry.index)}>
                  <td>{entry.index}</td><td>{entry.text.split(" ")[0]}</td><td>{entry.src}</td><td>{entry.address}</td><td>{entry.data}</td><td className={statusClass(entry.status)}>{entry.status}</td><td>{entry.age}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article>
          <h2>Address Resolution</h2>
          <label>Selected Entry
            <select aria-label="Selected queue entry" value={selected} onChange={(event) => setSelected(Number(event.target.value))}>
              {ops.map((op, index) => <option key={`${op.pc}-${index}`} value={index}>{op.kind === "load" ? "LQ" : "SQ"}[{index}] {op.text}</option>)}
            </select>
          </label>
          <p>Base Register ({chosen?.base ?? "—"}) {chosen ? hexReg(chosen.base, regs) : ""}</p>
          <p>Offset {chosen ? `0x${chosen.offset.toString(16)}` : "—"}</p>
          <p>{chosenEntry?.address && chosenEntry.address !== "?" ? `Address resolved: ${chosenEntry.address}.` : "The address is still unknown on this cycle."}</p>
          <button type="button" onClick={() => {
            const found = result.shots.findIndex((item) => [...item.loads, ...item.stores].some((entry) => entry.index === selected && entry.address !== "?"));
            if (found >= 0) play.setCycle(found);
          }}>Resolve</button>
          <h2>Memory</h2>
          <table>
            <thead><tr><th>Address</th><th>Value</th><th>Mark</th></tr></thead>
            <tbody>
              {shot.memory.map((entry) => <tr key={entry.addr}><td>0x{entry.addr.toString(16)}</td><td>0x{entry.value.toString(16)}</td><td>{entry.mark}</td></tr>)}
            </tbody>
          </table>
        </article>
      </div>
      <div className="vl-cards three">
        <article className={guideFocus === "forward" ? "aca-guide-on" : undefined}>
          <h2>Store-to-Load Forwarding</h2>
          <Toggle on={forwardOn} label="Enable Store-to-Load Forwarding" onChange={(next) => { setForwardOn(next); play.reset(); }} />
          <Toggle on={matchOn} label="Check for Matching Addresses" onChange={(next) => { setMatchOn(next); play.reset(); }} />
          <Toggle on={partialOn} label="Forward on Partial Match (Byte/Half)" onChange={setPartialOn} />
          <Toggle on={showForward} label="Show Forwarding Events" onChange={setShowForward} />
          <p>{forwarded ? `${forwarded.text} received ${forwarded.address} from the youngest older store. Store queue entry → load queue entry. The load did not read stale memory.` : "No store-to-load forward is active this cycle."}</p>
          <MemoryFlow
            mode={shot.replays > (result.shots[play.cycle - 1]?.replays ?? 0) ? "replay" : forwarded ? "forward" : shot.loads.some((entry) => entry.address === "?" && entry.status.toLowerCase().includes("spec")) || shot.event.toLowerCase().includes("unknown") ? "speculative" : shot.event.toLowerCase().includes("full") ? "full" : [...shot.loads, ...shot.stores].some((entry) => entry.address !== "?" && entry.address !== "") ? "resolve" : "idle"}
            text={shot.replays > (result.shots[play.cycle - 1]?.replays ?? 0) ? "The older store address matched a younger load. That load and its dependents replay." : forwarded ? "The store data travels to the load. It does not go through memory." : shot.event.toLowerCase().includes("full") ? "A queue is full, so the next memory instruction cannot allocate an entry." : shot.loads.some((entry) => entry.address === "?") ? "A load address is still unknown, so the load stays speculative until older stores resolve." : "Address tokens update the queue entry that the engine resolved on this step."}
            speed={play.speed}
            cycle={play.cycle}
          />
          <p>{partialOn ? "Partial byte and half forwarding is not applied. Addresses in this lab are full words." : "Full-word address match is required before a store can forward."}</p>
        </article>
        <article>
          <h2>Memory Violation Detection</h2>
          <Toggle on={orderOn} label="Enable Memory Ordering Checks" onChange={(next) => { setOrderOn(next); play.reset(); }} />
          <Toggle on={detectOn} label="Detect Load-Store Violations" onChange={(next) => { setDetectOn(next); play.reset(); }} />
          <Toggle on={showEvents} label="Show Violation Events" onChange={setShowEvents} />
          <p>{violation ? `Older store resolved, the younger load conflicts, and dependent work replays. ${violation.detail}` : "No violations detected. Memory ordering is maintained for the loads that have executed."}</p>
          <p>Replay count {shot.replays}. A replay clears the bad load and executes it again once the older store address is known.</p>
        </article>
        <article className={guideFocus === "replay" ? "aca-guide-on" : undefined}>
          <h2>Replay / Recovery Log</h2>
          <table>
            <thead><tr><th>#</th><th>Cycle</th><th>Event</th><th>Details</th></tr></thead>
            <tbody>
              {log.slice(-6).map((item, index) => <tr key={`${item.cycle}-${item.event}-${index}`}><td>{index + 1}</td><td>{item.cycle}</td><td>{item.event}</td><td>{item.detail}</td></tr>)}
            </tbody>
          </table>
        </article>
      </div>
      <div className="vl-split">
        <section className="vl-panel">
          <header><h2>Memory Operation Timeline</h2><b>Cycle {shot.cycle} / {result.cycles}</b></header>
          <div className="vl-scroll">
            <table className="vl-time">
              <thead><tr><th>Instr.</th>{Array.from({ length: columns }, (_, cell) => <th key={cell} className={cell + 1 === shot.cycle ? "now" : ""}>{cell + 1}</th>)}</tr></thead>
              <tbody>
                {ops.map((op, index) => (
                  <tr key={`${op.pc}-${index}`}>
                    <td>{op.text}</td>
                    {Array.from({ length: columns }, (_, cell) => {
                      const token = shot.cells[index]?.[cell];
                      return <td key={cell}>{token ? <span className={`st ${token}`}>{token}</span> : ""}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="vl-legend"><span className="st IF">IF</span> Dispatch <span className="st ID">ID</span> Address <span className="st MEM">MEM</span> Memory <span className="st WB">WB</span> Commit <span className="st Replay">Replay</span></p>
        </section>
        <section className="vl-panel">
          <h2>Simulation Controls</h2>
          <label>Memory program
            <textarea aria-label="Memory instruction builder" rows={5} value={custom ? program : ops.map((op) => op.text).join("\n")} onChange={(event) => { setCustom(true); setProgram(event.target.value); setSelected(0); play.reset(); }} spellCheck={false} />
          </label>
          {parsed?.errors[0] ? <p className="vl-bad">{parsed.errors[0]}</p> : null}
          <label>Load queue
            <select aria-label="Load queue size" value={lqSize} onChange={(event) => { setLqSize(Number(event.target.value)); play.reset(); }}>
              {[1, 2, 4, 8].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Store queue
            <select aria-label="Store queue size" value={sqSize} onChange={(event) => { setSqSize(Number(event.target.value)); play.reset(); }}>
              {[1, 2, 4, 8].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Ordering policy
            <select aria-label="Memory ordering policy" value={policy} onChange={(event) => { setPolicy(event.target.value as MemPolicy); play.reset(); }}>
              <option value="conservative">Wait for unknown older stores</option>
              <option value="bypass">Speculative load bypass</option>
              <option value="counter">Predictor</option>
            </select>
          </label>
          <label>Load address delay
            <select aria-label="Address resolution delay" value={delay} onChange={(event) => { setDelay(Number(event.target.value)); play.reset(); }}>
              {[0, 2, 4, 6].map((value) => <option key={value} value={value}>{value} cycles</option>)}
            </select>
          </label>
          <select aria-label="Load example" value={preset.id} onChange={(event) => { setPresetId(event.target.value); setCustom(false); setPolicy((LSQ_PRESETS.find((item) => item.id === event.target.value) ?? preset).policy); setSelected(0); play.reset(); }}>
            {LSQ_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <Toggle on={auto} label="Auto Advance Cycle" onChange={setAuto} />
          <Transport
            playing={play.playing}
            onPlay={() => { if (!auto) { play.setCycle((value) => Math.min(result.shots.length - 1, value + 1)); return; } play.setPlaying((value) => !value); }}
            onStep={() => play.setCycle((value) => Math.min(result.shots.length - 1, value + 1))}
            onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={() => { setGuideFocus(""); play.reset(); }}
            speed={play.speed}
            onSpeed={play.setSpeed}
          />
          <h2>Results & Insights</h2>
          <div className="vl-metrics">
            <div><strong>{shot.forwarded}</strong><span>Forwarded Loads</span></div>
            <div><strong>{shot.replays}</strong><span>Replays</span></div>
            <div><strong>{shot.stalls}</strong><span>Memory Stalls</span></div>
            <div><strong>{latency.toFixed(1)}</strong><span>Average LQ Latency</span></div>
          </div>
        </section>
      </div>
    </LabChrome>
  );
}

function hexReg(name: string, regs: Record<string, number>) {
  const value = regs[name];
  return value == null ? "" : `0x${value.toString(16)}`;
}
