import { useMemo, useState } from "react";
import { SHARE_PRESETS, repeatOps } from "../../../engines/aca/falseSharing";
import { analyzeBus, analyzeDirectory, analyzeLayout, filterTraffic, type TrafficCategory, type TrafficRow } from "../../../engines/aca/traffic";
import { runCoherence, type Access, type Protocol } from "../../../engines/aca/coherenceLab";
import { runDirectory } from "../../../engines/aca/directory";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";

const COLORS: Record<string, string> = {
  read: "#60a5fa", write: "#4ade80", invalidation: "#f87171", upgrade: "#c084fc", writeback: "#fbbf24", data: "#22d3ee", ack: "#94a3b8", directory: "#818cf8", migration: "#fb7185", silent: "#cbd5e1", hit: "#e2e8f0",
};
const CORE_COLOR = ["#f3e8ff", "#dbeafe", "#dcfce7", "#fef9c3"];

function tally(rows: TrafficRow[]) {
  const count = (category: TrafficCategory) => rows.filter((item) => item.category === category).length;
  const bytes = rows.reduce((sum, item) => sum + item.bytes, 0);
  return {
    messages: rows.filter((item) => item.bytes > 0).length,
    reads: count("read"),
    writes: count("write"),
    invalidations: count("invalidation"),
    upgrades: count("upgrade"),
    writebacks: count("writeback"),
    migrations: count("migration"),
    data: count("data"),
    bytes,
  };
}

export function TrafficLab() {
  const [protocol, setProtocol] = useState<Protocol | "directory">("mesi");
  const [presetId, setPresetId] = useState("producer");
  const [accesses, setAccesses] = useState<Access[]>([
    { core: 0, op: "read", address: 0x1000 },
    { core: 0, op: "write", address: 0x1000, value: 25 },
    { core: 1, op: "read", address: 0x1000 },
  ]);
  const [seed, setSeed] = useState<Record<number, number>>({ 0x1000: 10 });
  const [cores, setCores] = useState(4);
  const [layout, setLayout] = useState(false);
  const [writeAllocate, setWriteAllocate] = useState(true);
  const [silent, setSilent] = useState(true);
  const [showAddr, setShowAddr] = useState(true);
  const [messagesOn, setMessagesOn] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [logOn, setLogOn] = useState(true);
  const [auto, setAuto] = useState(true);
  const [filterCore, setFilterCore] = useState<number | "all">("all");
  const [filterKind, setFilterKind] = useState<TrafficCategory | "all">("all");
  const [actor, setActor] = useState(0);
  const [operation, setOperation] = useState<"read" | "write">("read");
  const [address, setAddress] = useState("0x1000");
  const options = useMemo(() => ({ writeAllocate, silentUpgrades: silent }), [writeAllocate, silent]);
  const limited = useMemo(() => accesses.filter((item) => item.core < cores), [accesses, cores]);
  const report = useMemo(() => {
    if (layout) {
      const same = SHARE_PRESETS.find((item) => item.id === "same");
      return analyzeLayout(same?.variables ?? [], repeatOps(same?.variables ?? [], 6), 64, false);
    }
    if (protocol === "directory") return analyzeDirectory(cores, limited.filter((item) => item.op !== "evict").map((item) => ({ core: item.core, op: item.op === "write" ? "write" as const : "read" as const, address: item.address, value: item.value })), seed, options);
    return analyzeBus(protocol, cores, limited, seed, options);
  }, [layout, protocol, cores, limited, seed, options]);
  const states = useMemo(() => {
    if (layout || protocol === "directory") return runDirectory(cores, limited.filter((item) => item.op !== "evict").map((item) => ({ core: item.core, op: item.op === "write" ? "write" as const : "read" as const, address: item.address, value: item.value })), seed);
    return runCoherence(protocol, cores, limited, seed);
  }, [layout, protocol, cores, limited, seed]);
  const lastCycle = report.rows.reduce((max, item) => Math.max(max, item.cycle), 0);
  const play = usePlayback(lastCycle);
  const visible = report.rows.filter((item) => item.cycle <= play.cycle);
  const filtered = filterTraffic(visible, { core: filterCore === "all" ? null : filterCore, category: filterKind });
  const stats = tally(filtered.length || play.cycle === 0 ? filtered : visible);
  const shown = filterKind === "all" && filterCore === "all" ? tally(visible) : stats;
  const parts = (["read", "write", "invalidation", "upgrade", "writeback", "data"] as TrafficCategory[]).map((category) => ({ category, count: visible.filter((item) => item.category === category).length }));
  const totalParts = parts.reduce((sum, item) => sum + item.count, 0) || 1;
  let cursor = 0;
  const gradient = parts.map((item) => {
    const start = cursor;
    cursor += (item.count / totalParts) * 100;
    return `${COLORS[item.category]} ${start}% ${cursor}%`;
  }).join(", ");
  const shot = states.shots[Math.min(play.cycle, states.shots.length - 1)];
  const focus = shot?.lines.find((item) => item.address === 0x1000) ?? shot?.lines[0];
  const add = () => {
    const parsed = Number(address);
    setLayout(false);
    setAccesses((current) => [...current, { core: actor, op: operation, address: Number.isNaN(parsed) ? 0x1000 : parsed, value: operation === "write" ? 1 : undefined }]);
    play.setCycle(lastCycle + 1);
  };
  return (
    <LabChrome lab="coherence-traffic" kicker="Labs > Lab 21" title="Lab 21 — Cache-Coherence Traffic Analyzer" subtitle="Inspect and quantify coherence messages generated by multicore workloads." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Understand how shared-memory coherence generates messages, quantify traffic for different workloads, and compare what a bus protocol records with what a directory records.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : visible.at(-1)?.cause ?? "Stepping the trace"}</p><p>Control messages are estimated at 8 bytes. A data payload is one 64-byte line. This is a lab estimate, not a packet format from a specific interconnect.</p></article>
        <article><h2>Traffic</h2><p>Sharing tells a story about who had the line and who had to give it up. A private trace stays quiet. A ping-pong of writes moves ownership.</p></article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Protocol & Workload</h2>
          <label>Coherence protocol
            <select aria-label="Coherence protocol" value={protocol} onChange={(event) => { setProtocol(event.target.value as Protocol | "directory"); setLayout(false); play.reset(); }}>
              <option value="msi">MSI</option>
              <option value="mesi">MESI</option>
              <option value="moesi">MOESI</option>
              <option value="directory">Directory</option>
            </select>
          </label>
          <label>Workload
            <select aria-label="Workload" value={presetId} onChange={(event) => {
              const next = ["private", "share", "producer", "true", "false", "ping", "readmostly", "write"].includes(event.target.value) ? event.target.value : "producer";
              setPresetId(next);
              setLayout(next === "false");
              if (next === "private") setAccesses([{ core: 0, op: "read", address: 0x1000 }, { core: 0, op: "write", address: 0x1000, value: 20 }]);
              if (next === "share") setAccesses([{ core: 0, op: "read", address: 0x1000 }, { core: 1, op: "read", address: 0x1000 }, { core: 2, op: "read", address: 0x1000 }]);
              if (next === "producer") { setAccesses([{ core: 0, op: "read", address: 0x1000 }, { core: 0, op: "write", address: 0x1000, value: 25 }, { core: 1, op: "read", address: 0x1000 }]); setSeed({ 0x1000: 10 }); }
              if (next === "true") setAccesses([{ core: 0, op: "write", address: 0x1000, value: 1 }, { core: 1, op: "read", address: 0x1000 }, { core: 1, op: "write", address: 0x1000, value: 2 }]);
              if (next === "ping") setAccesses([{ core: 0, op: "write", address: 0x1000, value: 1 }, { core: 1, op: "write", address: 0x1000, value: 2 }, { core: 0, op: "write", address: 0x1000, value: 3 }]);
              if (next === "readmostly") setAccesses([{ core: 0, op: "read", address: 0x1000 }, { core: 1, op: "read", address: 0x1000 }, { core: 2, op: "read", address: 0x1000 }, { core: 3, op: "read", address: 0x1000 }, { core: 0, op: "write", address: 0x1000, value: 4 }]);
              if (next === "write") setAccesses([0, 1, 2, 3].map((core) => ({ core, op: "write" as const, address: 0x1000, value: core + 1 })));
              play.reset();
            }}>
              <option value="private">Private data</option>
              <option value="share">Read sharing</option>
              <option value="producer">Producer / consumer</option>
              <option value="true">True sharing</option>
              <option value="false">False sharing</option>
              <option value="ping">Ping-pong ownership</option>
              <option value="readmostly">Read-mostly</option>
              <option value="write">Write-intensive</option>
            </select>
          </label>
          <label>Number of cores
            <select aria-label="Number of cores" value={cores} onChange={(event) => { setCores(Number(event.target.value)); play.reset(); }}>
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
            </select>
          </label>
          <p>Trace length {layout ? "12 layout writes" : `${limited.length} operations`}.</p>
          <Toggle on={writeAllocate} label="Enable Write-Allocate" onChange={(next) => { setWriteAllocate(next); play.reset(); }} />
          <Toggle on={silent} label="Enable Silent Upgrades" onChange={(next) => { setSilent(next); play.reset(); }} />
          <Toggle on={showAddr} label="Show Addresses" onChange={setShowAddr} />
          <p>Write-allocate includes a 64-byte fill on a read-for-ownership. Turning it off keeps the ownership request and drops that fill from the estimate. Silent upgrades stay off the bus unless the toggle counts them.</p>
        </article>
        <article>
          <h2>Multicore System Overview</h2>
          <div className="vl-cores">
            {Array.from({ length: Math.min(cores, 4) }, (_, core) => {
              const copy = focus?.copies[core];
              return (
                <div key={core} style={{ background: CORE_COLOR[core] }}>
                  <b>Core {core}</b>
                  <span>L1</span>
                  {copy ? <span className={`cst ${copy.state}`}>{copy.state}</span> : <span>{layout ? "line owner" : "—"}</span>}
                </div>
              );
            })}
          </div>
          <p>{protocol === "directory" || layout ? "Directory or line-ownership path. Messages go to the owner and the recorded sharers." : "Shared bus. A request is visible to every cache, which is why the invalidation count can include every holder."}</p>
          <p>{layout ? "False sharing here is two counters, 8 bytes apart, on one 64-byte line." : "Main memory backs the line. A dirty owner supplies the newest value."}</p>
        </article>
        <article>
          <h2>Coherence Traffic Counters</h2>
          <div className="vl-metrics">
            <div><strong>{shown.reads}</strong><span>Read traffic</span></div>
            <div><strong>{shown.writes}</strong><span>Write traffic</span></div>
            <div><strong>{shown.invalidations}</strong><span>Invalidations</span></div>
            <div><strong>{shown.upgrades}</strong><span>Upgrades</span></div>
            <div><strong>{shown.writebacks}</strong><span>Writebacks</span></div>
            <div><strong>{shown.migrations}</strong><span>Line migrations</span></div>
          </div>
          <p>Counters include events through cycle {play.cycle}. Estimated bytes {shown.bytes}.</p>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Message Type Breakdown</h2>
          <div className="vl-pie" style={{ background: totalParts ? `conic-gradient(${gradient})` : "#e2e8f0" }} role="img" aria-label="Message categories" />
          <ul>
            {parts.map((item) => <li key={item.category}>{item.category} {item.count} ({Math.round((item.count / totalParts) * 100)}%)</li>)}
          </ul>
        </article>
        <article>
          <h2>Per-Core Coherence Traffic Timeline</h2>
          {messagesOn ? (
            <div className="vl-bytes" aria-label="Traffic timeline">
              {visible.filter((item) => item.bytes > 0).slice(-40).map((item, index) => (
                <span key={`${item.cycle}-${item.message}-${index}`} title={`${item.message} C${item.core}`} style={{ background: COLORS[item.category], flex: 1, minWidth: 6 }} />
              ))}
            </div>
          ) : <p>Timeline hidden.</p>}
          <p className="vl-legend">{Object.entries(COLORS).slice(0, 5).map(([name, color]) => <span key={name}><i style={{ background: color, width: 10, height: 10, display: "inline-block" }} /> {name}</span>)}</p>
        </article>
        <article>
          <h2>Coherence Traffic per Core</h2>
          <div className="vl-stack">
            {report.cores.slice(0, cores).map((core) => {
              const height = Math.max(core.read + core.write + core.invalidate + core.upgrade + core.writebacks, 1);
              return (
                <b key={core.core}>C{core.core}
                  <i style={{ height: `${(core.writebacks / height) * 80}px`, background: COLORS.writeback }} />
                  <i style={{ height: `${(core.upgrade / height) * 80}px`, background: COLORS.upgrade }} />
                  <i style={{ height: `${(core.invalidate / height) * 80}px`, background: COLORS.invalidation }} />
                  <i style={{ height: `${(core.write / height) * 80}px`, background: COLORS.write }} />
                  <i style={{ height: `${(core.read / height) * 80}px`, background: COLORS.read }} />
                </b>
              );
            })}
          </div>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Event Log</h2>
          {logOn ? (
            <table>
              <thead><tr><th>#</th><th>Cycle</th><th>Core</th><th>Message</th>{showAddr ? <th>Address</th> : null}<th>Details</th></tr></thead>
              <tbody>
                {filtered.slice(-8).map((item, index) => (
                  <tr key={`${item.cycle}-${item.message}-${index}`} className={highlight && item.cycle === play.cycle ? "on" : ""}>
                    <td>{index + 1}</td><td>{item.cycle}</td><td>C{item.core}</td><td>{item.message}</td>{showAddr ? <td>0x{item.address.toString(16)}</td> : null}<td>{item.cause}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p>Event log hidden.</p>}
          <label>Core filter
            <select aria-label="Filter by core" value={filterCore} onChange={(event) => setFilterCore(event.target.value === "all" ? "all" : Number(event.target.value))}>
              <option value="all">All cores</option>
              {Array.from({ length: cores }, (_, core) => <option key={core} value={core}>Core {core}</option>)}
            </select>
          </label>
          <label>Message filter
            <select aria-label="Filter by message" value={filterKind} onChange={(event) => setFilterKind(event.target.value as TrafficCategory | "all")}>
              <option value="all">All messages</option>
              <option value="read">Reads</option>
              <option value="write">Writes</option>
              <option value="invalidation">Invalidations</option>
              <option value="upgrade">Upgrades</option>
              <option value="writeback">Writebacks</option>
              <option value="data">Data</option>
              <option value="migration">Migrations</option>
            </select>
          </label>
        </article>
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={messagesOn} label="Show Coherence Messages" onChange={setMessagesOn} />
          <Toggle on={highlight} label="Highlight Active Core" onChange={setHighlight} />
          <Toggle on={logOn} label="Auto Scroll Event Log" onChange={setLogOn} />
          <Toggle on={auto} label="Auto Advance" onChange={setAuto} />
          <label>Core <select aria-label="Edit core" value={actor} onChange={(event) => setActor(Number(event.target.value))}>{Array.from({ length: cores }, (_, core) => <option key={core} value={core}>Core {core}</option>)}</select></label>
          <div className="vl-pills">
            <button type="button" className={operation === "read" ? "on" : ""} onClick={() => setOperation("read")}>Read</button>
            <button type="button" className={operation === "write" ? "on" : ""} onClick={() => setOperation("write")}>Write</button>
          </div>
          <label>Address <input aria-label="Edit address" value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          <button type="button" onClick={add}>Edit Workload</button>
          <Transport playing={play.playing} onPlay={() => { if (!auto) { play.setCycle((value) => Math.min(lastCycle, value + 1)); return; } play.setPlaying((value) => !value); }} onStep={() => play.setCycle((value) => Math.min(lastCycle, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} speed={play.speed} onSpeed={play.setSpeed} />
        </article>
        <article>
          <h2>Results & Insights</h2>
          <div className="vl-metrics">
            <div><strong>{shown.messages}</strong><span>Messages so far</span></div>
            <div><strong>{shown.messages ? (shown.bytes / shown.messages).toFixed(1) : "0"}</strong><span>Avg. bytes / message</span></div>
            <div><strong>{shown.messages ? Math.round((shown.invalidations / shown.messages) * 100) : 0}%</strong><span>Invalidation share</span></div>
          </div>
          <p>Hot line {report.hotspot ? `0x${report.hotspot.address.toString(16)} · ${report.hotspot.messages} messages · ${report.hotspot.invalidations} invalidations · ${report.hotspot.migrations} migrations` : "none yet"}. Control bytes and data bytes are estimated separately. A protocol is not ranked here: a read-heavy trace and a write-heavy trace stress different messages.</p>
        </article>
      </div>
    </LabChrome>
  );
}
