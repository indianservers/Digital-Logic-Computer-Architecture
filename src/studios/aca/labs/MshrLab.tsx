import { useMemo, useState } from "react";
import { MSHR_DEFAULTS, MSHR_PRESETS, compareBlocking, runMshr, type MemAccess, type MshrConfig } from "../../../engines/aca/mshr";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";

export function MshrLab() {
  const initial = MSHR_PRESETS[1];
  const [presetId, setPresetId] = useState(initial?.id ?? "hum");
  const [accesses, setAccesses] = useState<MemAccess[]>(initial?.accesses ?? []);
  const [warm, setWarm] = useState<number[]>(initial?.warm ?? []);
  const [blocking, setBlocking] = useState(false);
  const [mshrs, setMshrs] = useState(4);
  const [hitUnder, setHitUnder] = useState(true);
  const [missUnder, setMissUnder] = useState(true);
  const [cacheBytes, setCacheBytes] = useState(MSHR_DEFAULTS.cacheBytes);
  const [blockBytes, setBlockBytes] = useState(64);
  const [latency, setLatency] = useState(8);
  const [replacement, setReplacement] = useState<"lru" | "fifo">("lru");
  const [showCache, setShowCache] = useState(true);
  const [showMshr, setShowMshr] = useState(true);
  const [showQueue, setShowQueue] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [auto, setAuto] = useState(true);
  const config = useMemo<MshrConfig>(() => ({
    ...MSHR_DEFAULTS,
    mshrs, missLatency: latency, cacheBytes, blockBytes, replacement, blocking, hitUnderMiss: hitUnder, missUnderMiss: missUnder,
  }), [mshrs, latency, cacheBytes, blockBytes, replacement, blocking, hitUnder, missUnder]);
  const result = useMemo(() => runMshr(accesses, config, warm), [accesses, config, warm]);
  const compared = useMemo(() => compareBlocking(accesses, { ...config, hitUnderMiss: true, missUnderMiss: true }, warm), [accesses, config, warm]);
  const play = usePlayback(Math.max(0, result.shots.length - 1));
  const shot = result.shots[Math.min(play.cycle, result.shots.length - 1)];
  if (!shot) return null;
  const occupancy = shot.entries.filter((entry) => entry.busy).length;
  return (
    <LabChrome lab="mshr" kicker="Labs > Lab 23" title="Lab 23 — Non-Blocking Cache & MSHR Lab" subtitle="Explore how non-blocking caches use MSHRs to tolerate multiple outstanding misses and improve performance." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>See a blocking cache wait out one miss, then a non-blocking cache serve a hit or a second miss while that fill is still in flight. Memory-level parallelism here is outstanding misses, not instruction-level parallelism.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : shot.event}</p><p>{shot.blocked ? "A miss is active and the cache is blocked." : occupancy ? `${occupancy} miss${occupancy === 1 ? "" : "es"} outstanding.` : "No miss is outstanding."}</p></article>
        <article><h2>MSHRs</h2><p>A second load of a block already in an MSHR joins that entry. It does not start another memory request. A new block needs a free MSHR.</p></article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Cache Configuration</h2>
          <div className="vl-pills">
            <button type="button" className={blocking ? "on" : ""} onClick={() => { setBlocking(true); play.reset(); }}>Blocking</button>
            <button type="button" className={!blocking ? "on" : ""} onClick={() => { setBlocking(false); play.reset(); }}>Non-blocking</button>
          </div>
          <label>Number of MSHRs
            <select aria-label="MSHR count" value={mshrs} onChange={(event) => { setMshrs(Number(event.target.value)); play.reset(); }}>
              {[1, 2, 4, 8].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <Toggle on={hitUnder} label="Enable Hit-Under-Miss" onChange={(next) => { setHitUnder(next); play.reset(); }} />
          <Toggle on={missUnder} label="Enable Miss-Under-Miss" onChange={(next) => { setMissUnder(next); play.reset(); }} />
          <label>Cache size
            <select aria-label="Cache size" value={cacheBytes} onChange={(event) => { setCacheBytes(Number(event.target.value)); play.reset(); }}>
              <option value={256}>256 B</option>
              <option value={1024}>1 KB</option>
              <option value={32768}>32 KB</option>
            </select>
          </label>
          <label>Block size
            <select aria-label="Block size" value={blockBytes} onChange={(event) => { setBlockBytes(Number(event.target.value)); play.reset(); }}>
              <option value={32}>32 bytes</option>
              <option value={64}>64 bytes</option>
            </select>
          </label>
          <label>Memory latency
            <input aria-label="Memory latency" type="number" min={1} max={64} value={latency} onChange={(event) => { setLatency(Math.max(1, Math.min(64, Number(event.target.value) || 1))); play.reset(); }} />
          </label>
          <label>Replacement
            <select aria-label="Replacement" value={replacement} onChange={(event) => { setReplacement(event.target.value === "fifo" ? "fifo" : "lru"); play.reset(); }}>
              <option value="lru">LRU</option>
              <option value="fifo">FIFO</option>
            </select>
          </label>
          <label>Example
            <select aria-label="Load example" value={presetId} onChange={(event) => {
              const next = MSHR_PRESETS.find((item) => item.id === event.target.value);
              setPresetId(event.target.value);
              if (next) {
                setAccesses(next.accesses);
                setWarm(next.warm);
                setMshrs(next.config.mshrs ?? MSHR_DEFAULTS.mshrs);
                setLatency(next.config.missLatency ?? MSHR_DEFAULTS.missLatency);
                setHitUnder(next.config.hitUnderMiss ?? true);
                setMissUnder(next.config.missUnderMiss ?? true);
                setBlocking(next.config.blocking ?? false);
              }
              play.reset();
            }}>
              {MSHR_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </article>
        {showMshr ? (
          <article>
            <h2>MSHR Table ({shot.entries.length} entries)</h2>
            <table>
              <thead><tr><th>Idx</th><th>Block</th><th>State</th><th>Wait</th><th>Requester</th></tr></thead>
              <tbody>
                {shot.entries.map((entry) => (
                  <tr key={entry.id} className={highlight && entry.busy ? "on" : ""}>
                    <td>{entry.id}</td>
                    <td>{entry.block === null ? "—" : `0x${entry.block.toString(16)}`}</td>
                    <td>{entry.busy ? "Pending" : "Idle"}</td>
                    <td>{entry.busy ? entry.remaining : "—"}</td>
                    <td>{entry.core === null ? "—" : `Core ${entry.core}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="vl-usage" aria-label="MSHR usage"><i style={{ width: `${shot.entries.length ? (occupancy / shot.entries.length) * 100 : 0}%` }} /></div>
            <p>MSHR usage {occupancy} / {shot.entries.length} ({shot.entries.length ? Math.round((occupancy / shot.entries.length) * 100) : 0}%).</p>
          </article>
        ) : null}
        <article>
          <h2>Outstanding Misses</h2>
          <table>
            <thead><tr><th>#</th><th>Block</th><th>Arrival</th><th>Age</th><th>State</th></tr></thead>
            <tbody>
              {shot.outstanding.map((item, index) => (
                <tr key={`${item.block}-${index}`}><td>{index}</td><td>0x{item.block.toString(16)}</td><td>{item.arrival}</td><td>{item.age}</td><td>{item.state}</td></tr>
              ))}
              {shot.queued > 0 ? <tr><td>{shot.outstanding.length}</td><td>next</td><td>—</td><td>—</td><td>Queued {shot.queued}</td></tr> : null}
            </tbody>
          </table>
        </article>
      </div>
      <div className="vl-cards two">
        <article>
          <h2>Hit-Under-Miss and Miss-Under-Miss</h2>
          <div className="vl-dual">
            <div>
              <b>Hit under miss</b>
              <p>Hits finished while a miss was still in an MSHR: {shot.hitUnderMiss}.</p>
              <div className="vl-gantt">{shot.rows.filter((row) => row.status === "Hit").map((row) => <i key={row.index} style={{ width: "40%", background: "#86efac" }} title={`0x${row.address.toString(16)}`} />)}</div>
            </div>
            <div>
              <b>Miss under miss</b>
              <p>Extra misses started while another MSHR was busy: {shot.missUnderMiss}.</p>
              <div className="vl-gantt" aria-label="Outstanding miss spans">
                {shot.outstanding.map((item) => <i key={item.block} style={{ width: `${Math.min(100, Math.max(12, item.age * 8))}%`, background: "#fb7185" }} title={`0x${item.block.toString(16)} age ${item.age}`} />)}
              </div>
            </div>
          </div>
          <p>Same trace, blocking mode finishes at cycle {compared.blocking.final.cycle}. Non-blocking finishes at cycle {compared.relaxed.final.cycle}. Stall cycles change by {compared.stallReduction}%.</p>
        </article>
        {showQueue ? (
          <article>
            <h2>Cache Request Queue</h2>
            <table>
              <thead><tr><th>#</th><th>Issue</th><th>Address</th><th>Op</th><th>Status</th></tr></thead>
              <tbody>
                {shot.rows.map((row) => (
                  <tr key={row.index} className={highlight && row.cycle === play.cycle ? "on" : ""}>
                    <td>{row.index + 1}</td><td>{row.cycle}</td><td>0x{row.address.toString(16)}</td><td>{row.op === "read" ? "R" : "W"}</td><td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ) : null}
      </div>
      <div className="vl-cards three">
        {showCache ? (
          <article>
            <h2>Memory Access Timeline</h2>
            <p>Each row is one access. A completed hit is short. A miss stays out for the memory latency.</p>
            <div className="vl-bytes">
              {shot.rows.map((row) => <span key={row.index} style={{ background: row.status === "Hit" || row.status === "Completed" ? "#86efac" : row.status === "Stalled" ? "#fecaca" : "#fde68a", flex: 1 }}>{row.status}</span>)}
            </div>
          </article>
        ) : null}
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={showCache} label="Show Cache Requests" onChange={setShowCache} />
          <Toggle on={showMshr} label="Show MSHR Activity" onChange={setShowMshr} />
          <Toggle on={showQueue} label="Show Memory Accesses" onChange={setShowQueue} />
          <Toggle on={highlight} label="Highlight Hits" onChange={setHighlight} />
          <Toggle on={auto} label="Auto Advance" onChange={setAuto} />
          <Transport playing={play.playing} onPlay={() => { if (!auto) { play.setCycle((value) => Math.min(result.shots.length - 1, value + 1)); return; } play.setPlaying((value) => !value); }} onStep={() => play.setCycle((value) => Math.min(result.shots.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} speed={play.speed} onSpeed={play.setSpeed} />
        </article>
        <article>
          <h2>Results & Insights</h2>
          <div className="vl-metrics">
            <div><strong>{shot.hits + shot.misses ? Math.round((shot.hits / (shot.hits + shot.misses)) * 100) : 0}%</strong><span>Hit rate so far</span></div>
            <div><strong>{shot.avgOutstanding.toFixed(2)}</strong><span>Avg outstanding misses</span></div>
            <div><strong>{shot.peakOutstanding}</strong><span>Peak memory-level parallelism</span></div>
            <div><strong>{compared.stallReduction}%</strong><span>Stall change vs blocking</span></div>
          </div>
          <p>Hits {shot.hits}. Misses {shot.misses}. Merged {shot.merged}. MSHR allocations {shot.allocations}. Exhaustion events {shot.exhausted}. Average access latency {shot.avgLatency.toFixed(1)} cycles. Blocking takes {compared.blocking.final.cycle} cycles and non-blocking takes {compared.relaxed.final.cycle} on this trace.</p>
        </article>
      </div>
    </LabChrome>
  );
}
