import { useMemo, useState } from "react";
import { MOESI_PRESETS, STATE_TEXT, compareProtocols, runCoherence, type Access, type LineState } from "../../../engines/aca/coherenceLab";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";

const CORE_COLOR = ["#dbeafe", "#dcfce7", "#ffedd5", "#f3e8ff"];
const STATES: LineState[] = ["M", "O", "E", "S", "I"];

export function MoesiLab() {
  const [presetId, setPresetId] = useState(MOESI_PRESETS[1]?.id ?? "owned");
  const [accesses, setAccesses] = useState<Access[]>(MOESI_PRESETS[1]?.accesses ?? []);
  const [seed, setSeed] = useState<Record<number, number>>(MOESI_PRESETS[1]?.seed ?? { 0x1000: 10 });
  const [actor, setActor] = useState(0);
  const [operation, setOperation] = useState<"read" | "write" | "evict">("read");
  const [address, setAddress] = useState("0x1000");
  const [written, setWritten] = useState(25);
  const [picked, setPicked] = useState<LineState>("O");
  const [arrows, setArrows] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [auto, setAuto] = useState(true);
  const parsed = Number(address);
  const lineAddress = Number.isFinite(parsed) ? parsed : 0x1000;
  const result = useMemo(() => runCoherence("moesi", 4, accesses, seed), [accesses, seed]);
  const compared = useMemo(() => compareProtocols(4, accesses, seed), [accesses, seed]);
  const play = usePlayback(Math.max(0, result.shots.length - 1));
  const shot = result.shots[Math.min(play.cycle, result.shots.length - 1)];
  if (!shot) return null;
  const focus = shot.lines.find((item) => item.address === lineAddress) ?? shot.lines[0];
  const transfer = [...shot.log].reverse().find((item) => item.source.startsWith("Core") && item.bus === "BusRd");
  const baseline = compared.mesi.final.writebacks;
  const reduction = baseline === 0 ? 0 : Math.max(0, Math.round(((baseline - shot.writebacks) / baseline) * 100));
  const apply = (next: Access[]) => { setAccesses(next); play.reset(); };
  const add = () => {
    setAccesses((current) => [...current, { core: actor, op: operation, address: lineAddress, value: operation === "write" ? written : undefined }]);
    play.setCycle(accesses.length + 1);
  };
  return (
    <LabChrome lab="moesi" kicker="Labs > Lab 18" title="Lab 18 — MOESI Coherence Simulator" subtitle="Experiment with the Modified, Owned, Exclusive, Shared, and Invalid states and observe cache-to-cache transfers." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Understand the Owned state. A dirty line can be shared, and the owner supplies the newest data, so memory does not have to be written on every remote read.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : shot.event}</p><p>4 cores. Cache block size 64 bytes. Write-back memory. An Owned line may sit beside Shared copies. Only one owner is allowed.</p></article>
        <article><h2>Owned state</h2><p>Coherence here is about who supplies the block. The owner is authoritative while memory can still hold the old word.</p></article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>System Configuration</h2>
          <div className="vl-cores">
            {CORE_COLOR.map((color, core) => {
              const copy = focus?.copies[core];
              return (
                <div key={color} style={{ background: color }} className={highlight && copy?.state === "O" ? "on" : ""}>
                  <b>Core {core}</b>
                  <span>L1 cache (MOESI)</span>
                  <span className={`cst ${copy?.state ?? "I"}`}>{copy?.state ?? "I"}</span>
                </div>
              );
            })}
          </div>
          <p>Interconnect / coherence bus, directory-less snooping.</p>
          <p>Main memory {focus ? `0x${focus.address.toString(16)} = 0x${focus.memory.toString(16)}` : "—"} {focus?.stale ? "· stale, owner is authoritative" : "· matches the caches or is unused"}.</p>
        </article>
        <article>
          <h2>MOESI State Legend</h2>
          <div className="vl-pills">
            {STATES.map((state) => <button type="button" key={state} className={picked === state ? "on" : ""} onClick={() => setPicked(state)}>{state}</button>)}
          </div>
          <p>{STATE_TEXT[picked]}</p>
          <svg viewBox="0 0 260 70" role="img" aria-label="MOESI states">
            {STATES.map((state, index) => {
              const hot = focus?.copies.some((copy) => copy.state === state);
              return <g key={state} onClick={() => setPicked(state)}><circle cx={26 + index * 48} cy={32} r={16} fill={hot ? "#fef3c7" : "#fff"} stroke={picked === state ? "#d97706" : "#94a3b8"} /><text x={26 + index * 48} y={36} textAnchor="middle" fontSize="12">{state}</text></g>;
            })}
          </svg>
        </article>
        <article>
          <h2>Memory Operations</h2>
          <div className="vl-pills">
            <button type="button" className={operation === "read" ? "on" : ""} onClick={() => setOperation("read")}>Read</button>
            <button type="button" className={operation === "write" ? "on" : ""} onClick={() => setOperation("write")}>Write</button>
            <button type="button" className={operation === "evict" ? "on" : ""} onClick={() => setOperation("evict")}>Evict</button>
          </div>
          <label>Core
            <select aria-label="Core" value={actor} onChange={(event) => setActor(Number(event.target.value))}>
              {[0, 1, 2, 3].map((core) => <option key={core} value={core}>Core {core}</option>)}
            </select>
          </label>
          <label>Address (hex) <input aria-label="Address" value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          {operation === "write" ? <label>Value <input aria-label="Store value" type="number" value={written} onChange={(event) => setWritten(Number(event.target.value))} /></label> : null}
          <button type="button" onClick={add}>Add to Trace</button>
          <h2>Quick Examples</h2>
          {MOESI_PRESETS.map((item) => (
            <button type="button" key={item.id} className={presetId === item.id ? "on" : ""} onClick={() => { setPresetId(item.id); setSeed(item.seed ?? {}); apply(item.accesses); setAddress(`0x${(item.accesses[0]?.address ?? 0x1000).toString(16)}`); }}>
              {item.label}
            </button>
          ))}
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Cache Line States</h2>
          <table>
            <thead><tr><th>Address</th><th>Core 0</th><th>Core 1</th><th>Core 2</th><th>Core 3</th><th>Memory</th></tr></thead>
            <tbody>
              {shot.lines.map((item) => (
                <tr key={item.address} className={item.address === focus?.address ? "on" : ""}>
                  <td>0x{item.address.toString(16)}</td>
                  {item.copies.map((copy, core) => <td key={core}><span className={`cst ${copy.state}`}>{copy.state}</span></td>)}
                  <td>{item.stale ? "stale" : "current"} 0x{item.memory.toString(16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article>
          <h2>Cache-to-Cache Transfer</h2>
          {arrows && transfer ? (
            <p>Core {transfer.source.replace("Core ", "")} supplies 0x{focus?.copies[transfer.core]?.value?.toString(16) ?? "?"} to Core {transfer.core}. {transfer.detail}</p>
          ) : <p>No cache-to-cache transfer in the steps shown.</p>}
          <p>Transfers so far: {shot.cacheToCache}. Invalidations: {shot.invalidations}. Memory reads: {shot.memoryReads}.</p>
        </article>
        <article>
          <header><h2>Traffic Log</h2><button type="button" onClick={() => { setAccesses([]); setSeed({}); play.reset(); }}>Clear Log</button></header>
          <table>
            <thead><tr><th>#</th><th>Time</th><th>Event</th></tr></thead>
            <tbody>
              {shot.log.slice(-8).map((item, index) => <tr key={`${item.cycle}-${index}`}><td>{index + 1}</td><td>{item.cycle}</td><td>{item.bus}: {item.detail}</td></tr>)}
            </tbody>
          </table>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={arrows} label="Show Cache-to-Cache Arrows" onChange={setArrows} />
          <Toggle on={highlight} label="Highlight MOESI Transitions" onChange={setHighlight} />
          <Toggle on={auto} label="Auto Execute Next" onChange={setAuto} />
          <Transport playing={play.playing} onPlay={() => { if (!auto) { play.setCycle((value) => Math.min(result.shots.length - 1, value + 1)); return; } play.setPlaying((value) => !value); }} onStep={() => play.setCycle((value) => Math.min(result.shots.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} speed={play.speed} onSpeed={play.setSpeed} />
        </article>
        <article>
          <h2>Results & Insights</h2>
          <div className="vl-metrics">
            <div><strong>{shot.cycle}</strong><span>Total operations</span></div>
            <div><strong>{shot.writebacks}</strong><span>Memory writebacks</span></div>
            <div><strong>{shot.cacheToCache}</strong><span>Cache-to-cache</span></div>
            <div><strong>{reduction}%</strong><span>Writeback reduction vs MESI</span></div>
          </div>
          <p>The same trace under MESI writes memory back {baseline} time{baseline === 1 ? "" : "s"}. MOESI writes it back {shot.writebacks} time{shot.writebacks === 1 ? "" : "s"}. Owned entries seen: {shot.owned}.</p>
        </article>
        <article>
          <h2>The Owned state reduces writebacks</h2>
          <p>On the remote-read example, MESI turns Modified into Shared and updates memory. MOESI turns Modified into Owned, gives the reader Shared, and leaves memory stale until the owner is evicted or a later writeback. A later writer still invalidates the owner and every sharer before it enters Modified.</p>
        </article>
      </div>
    </LabChrome>
  );
}
