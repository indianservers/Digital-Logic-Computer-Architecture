import { useMemo, useState } from "react";
import { FABRIC_PRESETS, compareFabric, type FabricRequest } from "../../../engines/aca/snoopCompare";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";

const COLORS = ["#dbeafe", "#dcfce7", "#fef3c7", "#f3e8ff", "#ffe4e6", "#e0f2fe", "#fef9c7", "#ede9fe"];

export function SnoopLab() {
  const initial = FABRIC_PRESETS[2];
  const [presetId, setPresetId] = useState(initial?.id ?? "writer");
  const [cores, setCores] = useState(initial?.cores ?? 8);
  const [requests, setRequests] = useState<FabricRequest[]>(initial?.requests ?? []);
  const [seed, setSeed] = useState<Record<number, number>>(initial?.seed ?? { 0x1000: 10 });
  const [showSnoop, setShowSnoop] = useState(true);
  const [showDirectory, setShowDirectory] = useState(true);
  const [messagesOn, setMessagesOn] = useState(true);
  const [animate, setAnimate] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [auto, setAuto] = useState(true);
  const [actor, setActor] = useState(0);
  const [operation, setOperation] = useState<"read" | "write">("read");
  const [address, setAddress] = useState("0x1000");
  const [written, setWritten] = useState(1);
  const result = useMemo(() => compareFabric(cores, requests.filter((item) => item.core < cores), seed), [cores, requests, seed]);
  const play = usePlayback(Math.max(0, result.shots.length - 1));
  const shot = result.shots[Math.min(play.cycle, result.shots.length - 1)];
  if (!shot) return null;
  const peak = Math.max(...result.scale.map((point) => Math.max(point.snoopLatency, point.directoryLatency)), 1);
  const messagePeak = Math.max(...result.scale.map((point) => point.snoopMessages), 1);
  const narrow = result.scale[0];
  const wide = result.scale[result.scale.length - 1];
  const snoopGrowth = narrow && wide && narrow.snoopMessages ? wide.snoopMessages / narrow.snoopMessages : 1;
  const directoryGrowth = narrow && wide && narrow.directoryMessages ? wide.directoryMessages / narrow.directoryMessages : 1;
  const issue = () => {
    const parsed = Number(address);
    setRequests((current) => [...current, { core: actor, op: operation, address: Number.isNaN(parsed) ? 0x1000 : parsed, value: operation === "write" ? written : undefined }]);
    play.setCycle(requests.length + 1);
  };
  return (
    <LabChrome lab="snooping-vs-directory" kicker="Labs > Lab 22" title="Lab 22 — Snooping vs Directory Coherence" subtitle="Compare snooping-based and directory-based cache coherence, and understand why directory scales to larger systems." badge="RISC-V (Multi-Core)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Compare snooping and directory-based coherence on one trace. Both use the same MSI-style transitions, so the architectural values match. The difference is who is contacted.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : shot.event}</p><p>Latency numbers are lab assumptions: a bus probe costs {1} unit per other cache, and a directory lookup is a fixed hop plus a slow growth with core count. They are not a chip's cycle time.</p></article>
        <article><h2>Scale</h2><p>A design that is quiet at 4 cores can flood a 32-core bus. Directory traffic follows the sharer count, and the lookup can make it slower on a small machine.</p></article>
      </div>
      <div className="vl-cards three">
        {showSnoop ? (
          <article>
            <h2>Snooping-Based Coherence</h2>
            <div className="vl-cores">
              {Array.from({ length: Math.min(cores, 4) }, (_, core) => <div key={core} style={{ background: COLORS[core] }}><b>Core {core}</b><span>L1 cache</span></div>)}
            </div>
            <div className="vl-bus">Shared interconnect. Every other cache snoops the request.</div>
            <p>Each miss is visible to the other {Math.max(0, cores - 1)} caches. {cores > 4 ? `${cores} cores participate. Four are drawn.` : "Snooping stays quiet on a small machine and floods a large bus."}</p>
          </article>
        ) : null}
        {showDirectory ? (
          <article>
            <h2>Directory-Based Coherence</h2>
            <div className="vl-cores">
              {Array.from({ length: Math.min(cores, 4) }, (_, core) => <div key={core} style={{ background: COLORS[core] }}><b>Core {core}</b><span>L1 cache</span></div>)}
            </div>
            <div className="vl-dirbox">Directory controller. Messages go to the owner and the recorded sharers.</div>
            <p>A full bit-vector needs {result.directoryBits} sharer bits per line. Snooping keeps {result.snoopBits} central sharer bits. This is a simplified storage picture.</p>
          </article>
        ) : null}
        <article>
          <h2>Simulation Configuration</h2>
          <label>Number of cores
            <select aria-label="Number of cores" value={cores} onChange={(event) => { setCores(Number(event.target.value)); play.reset(); }}>
              {[4, 8, 16, 32].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <label>Workload
            <select aria-label="Workload" value={presetId} onChange={(event) => {
              const next = FABRIC_PRESETS.find((item) => item.id === event.target.value);
              setPresetId(event.target.value);
              if (next) { setCores(next.cores); setRequests(next.requests); setSeed(next.seed); }
              play.reset();
            }}>
              {FABRIC_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <Toggle on={showSnoop} label="Snooping (bus-based)" onChange={setShowSnoop} />
          <Toggle on={showDirectory} label="Directory-based" onChange={setShowDirectory} />
          <p>Trace length {requests.filter((item) => item.core < cores).length} requests. Both columns run this list.</p>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Protocol Message Flow</h2>
          {messagesOn ? (
            <div className="vl-dual">
              <div>
                <b>Snooping</b>
                {shot.step.filter((item) => item.model === "snoop").map((item, index) => <div key={`s${index}`} className={`vl-msg s${index % 4}`}>{animate ? `${index + 1}. ` : ""}{item.event}. {item.detail}</div>)}
              </div>
              <div>
                <b>Directory</b>
                {shot.step.filter((item) => item.model === "directory").map((item, index) => <div key={`d${index}`} className={`vl-msg s${index % 4}`}>{animate ? `${index + 1}. ` : ""}{item.event}. {item.detail}</div>)}
              </div>
            </div>
          ) : <p>Message flow is hidden.</p>}
        </article>
        <article>
          <h2>Latency Comparison</h2>
          <div className="vl-bars">
            {result.scale.map((point) => (
              <b key={point.cores}>{point.cores}
                <i style={{ height: `${Math.max(6, (point.snoopLatency / peak) * 80)}px` }} title={`Snoop ${point.snoopLatency}`} />
                <i className="two" style={{ height: `${Math.max(6, (point.directoryLatency / peak) * 80)}px` }} title={`Directory ${point.directoryLatency}`} />
              </b>
            ))}
          </div>
          <p className="vl-legend"><span>Pale: snooping</span><span>Dark: directory</span></p>
          <p>Lab latency model, not a chip timing. The sharer count of this trace stays fixed while the machine grows, so directory latency rises only with the lookup hop.</p>
        </article>
        <article>
          <h2>Coherence Traffic Comparison</h2>
          <svg viewBox="0 0 220 90" role="img" aria-label="Messages versus core count">
            <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={result.scale.map((point, index) => `${20 + index * 60},${80 - (point.snoopMessages / messagePeak) * 70}`).join(" ")} />
            <polyline fill="none" stroke="#16a34a" strokeWidth="2" points={result.scale.map((point, index) => `${20 + index * 60},${80 - (point.directoryMessages / messagePeak) * 70}`).join(" ")} />
            {result.scale.map((point, index) => <text key={point.cores} x={20 + index * 60} y={88} fontSize="8" textAnchor="middle">{point.cores}</text>)}
          </svg>
          <p className="vl-legend"><span>Blue: snooping</span><span>Green: directory</span></p>
          <p>One miss, same sharer count, wider machines. This trace so far: snooping {shot.snoopMessages} messages, directory {shot.directoryMessages}.</p>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Issue a Request</h2>
          <label>Core
            <select aria-label="Core" value={actor} onChange={(event) => setActor(Number(event.target.value))}>
              {Array.from({ length: cores }, (_, core) => <option key={core} value={core}>Core {core}</option>)}
            </select>
          </label>
          <div className="vl-pills">
            <button type="button" className={operation === "read" ? "on" : ""} onClick={() => setOperation("read")}>Read</button>
            <button type="button" className={operation === "write" ? "on" : ""} onClick={() => setOperation("write")}>Write</button>
          </div>
          <label>Address <input aria-label="Address" value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          {operation === "write" ? <label>Value <input aria-label="Store value" type="number" value={written} onChange={(event) => setWritten(Number(event.target.value))} /></label> : null}
          <button type="button" className="vl-step" onClick={issue}>Issue Request</button>
          <button type="button" onClick={() => { setRequests([]); play.reset(); }}>Clear Log</button>
        </article>
        <article>
          <h2>Event Log</h2>
          <table>
            <thead><tr><th>#</th><th>Cycle</th><th>Model</th><th>Event</th><th>Details</th></tr></thead>
            <tbody>
              {shot.log.slice(-8).map((item, index) => (
                <tr key={`${item.cycle}-${item.event}-${index}`} className={highlight && item.cycle === play.cycle ? "on" : ""}>
                  <td>{index + 1}</td><td>{item.cycle}</td><td>{item.model}</td><td>{item.event}</td><td>{item.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={messagesOn} label="Show Message Arrows" onChange={setMessagesOn} />
          <Toggle on={animate} label="Animate Requests" onChange={setAnimate} />
          <Toggle on={highlight} label="Highlight Active Core" onChange={setHighlight} />
          <Toggle on={auto} label="Auto Advance Requests" onChange={setAuto} />
          <Transport playing={play.playing} onPlay={() => { if (!auto) { play.setCycle((value) => Math.min(result.shots.length - 1, value + 1)); return; } play.setPlaying((value) => !value); }} onStep={() => play.setCycle((value) => Math.min(result.shots.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} speed={play.speed} onSpeed={play.setSpeed} />
        </article>
      </div>
      <article className="vl-panel">
        <h2>Results & Insights</h2>
        <div className="vl-metrics">
          <div><strong>{shot.snoopMessages}</strong><span>Snoop messages</span></div>
          <div><strong>{shot.directoryMessages}</strong><span>Directory messages</span></div>
          <div><strong>{shot.snoopLatency.toFixed(1)}</strong><span>Avg snoop latency</span></div>
          <div><strong>{shot.directoryLatency.toFixed(1)}</strong><span>Avg directory latency</span></div>
          <div><strong>{snoopGrowth.toFixed(1)}×</strong><span>Snoop growth, 4 to 32</span></div>
          <div><strong>{directoryGrowth.toFixed(1)}×</strong><span>Directory growth, 4 to 32</span></div>
        </div>
        <p>Broadcasts {shot.broadcasts}. Snoop probes {shot.probes}. Directory lookups {shot.lookups}. Invalidations {shot.invalidations}. Acks {shot.acks}. Data transfers {shot.dataTransfers}. Average sharers touched on a miss {shot.avgSharers.toFixed(2)}. Estimated bytes: snoop {shot.snoopBytes}, directory {shot.directoryBytes}. Memory at the first address is 0x{result.memory.toString(16)}. Owner value 0x{result.value.toString(16)}. Same transitions, different fan-out.</p>
      </article>
    </LabChrome>
  );
}
