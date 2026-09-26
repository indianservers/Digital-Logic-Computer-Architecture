import { useMemo, useState } from "react";
import { DRAM_DEFAULTS, DRAM_PRESETS, DRAM_TIMING, compareSchedulers, runDram, type DramAccess, type DramConfig, type DramTiming } from "../../../engines/aca/dram";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";

const BANK_COLORS = ["#dbeafe", "#dcfce7", "#fef3c7", "#f3e8ff", "#ffe4e6", "#e0f2fe", "#fef9c7", "#ede9fe"];

function commandColor(command: string) {
  if (command === "ACT") return "#93c5fd";
  if (command === "RD") return "#86efac";
  if (command === "WR") return "#f9a8d4";
  if (command === "PRE") return "#fde68a";
  return "#e2e8f0";
}

export function DramLab() {
  const initial = DRAM_PRESETS[5];
  const [presetId, setPresetId] = useState(initial?.id ?? "ready");
  const [accesses, setAccesses] = useState<DramAccess[]>(initial?.accesses ?? []);
  const [channels, setChannels] = useState(DRAM_DEFAULTS.channels);
  const [ranks, setRanks] = useState(DRAM_DEFAULTS.ranks);
  const [banks, setBanks] = useState(DRAM_DEFAULTS.banks);
  const [rows, setRows] = useState(DRAM_DEFAULTS.rows);
  const [columns, setColumns] = useState(DRAM_DEFAULTS.columns);
  const [policy, setPolicy] = useState<DramConfig["policy"]>(initial?.config.policy ?? "frfcfs");
  const [timing, setTiming] = useState<DramTiming>(initial?.config.timing ? { ...DRAM_TIMING, ...initial.config.timing } : DRAM_TIMING);
  const [selected, setSelected] = useState(0);
  const [showTiming, setShowTiming] = useState(true);
  const [showBuffer, setShowBuffer] = useState(true);
  const [highlightHits, setHighlightHits] = useState(true);
  const [auto, setAuto] = useState(true);
  const config = useMemo<DramConfig>(() => ({ channels, ranks, banks, rows, columns, policy, timing }), [channels, ranks, banks, rows, columns, policy, timing]);
  const result = useMemo(() => runDram(accesses, config), [accesses, config]);
  const compared = useMemo(() => compareSchedulers(accesses, config), [accesses, config]);
  const play = usePlayback(Math.max(0, result.shots.length - 1));
  const shot = result.shots[Math.min(play.cycle, result.shots.length - 1)];
  if (!shot) return null;
  const focus = shot.rows[selected] ?? shot.rows[0];
  const issued = result.rows.length || 1;
  const hitRate = result.final.hits / issued;
  const sequence = focus?.kind === "conflict" ? ["PRE", "ACT", focus.op === "write" ? "WR" : "RD"] : focus?.kind === "closed" ? ["ACT", focus.op === "write" ? "WR" : "RD"] : [focus?.op === "write" ? "WR" : "RD"];
  const peak = Math.max(...result.active, 1);
  return (
    <LabChrome lab="dram-controller" kicker="Labs > Lab 25" title="Lab 25 — DRAM Bank & Memory Controller Simulator" subtitle="Explore DRAM organization, row buffer behavior, and memory-controller scheduling." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>A row hit reads the open row. A closed bank needs an activate. A different open row needs a precharge first. Those are three different cases. FR-FCFS prefers a ready hit, then the older request.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : shot.event}</p><p>tRCD, tCL, tRP, and tRAS are this lab's timing assumptions, not a DRAM datasheet.</p></article>
        <article><h2>Scheduling</h2><p>FCFS on this trace averages {compared.fcfs.final.avgLatency.toFixed(1)} cycles. FR-FCFS averages {compared.ready.final.avgLatency.toFixed(1)}. A lower average is not a win on every goal: an age cap exists so a hit stream cannot hold an old conflict forever.</p></article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>DRAM Organization</h2>
          <label>Channels
            <select aria-label="Channels" value={channels} onChange={(event) => { setChannels(Number(event.target.value)); play.reset(); }}>
              {[1, 2].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <label>Ranks
            <select aria-label="Ranks" value={ranks} onChange={(event) => { setRanks(Number(event.target.value)); play.reset(); }}>
              {[1, 2].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <label>Banks
            <select aria-label="Banks" value={banks} onChange={(event) => { setBanks(Number(event.target.value)); play.reset(); }}>
              {[2, 4, 8].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <label>Rows
            <select aria-label="Rows" value={rows} onChange={(event) => { setRows(Number(event.target.value)); play.reset(); }}>
              {[16, 256, 1024].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <label>Columns
            <select aria-label="Columns" value={columns} onChange={(event) => { setColumns(Number(event.target.value)); play.reset(); }}>
              {[64, 256, 1024].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <p>Low bits are the column, then the bank, then the row, then rank and channel. Every panel uses that decode.</p>
          <div className="vl-cores">
            {shot.banks.slice(0, 4).map((bank) => (
              <div key={bank.unit} style={{ background: BANK_COLORS[bank.unit % BANK_COLORS.length] }}>
                <b>Bank {bank.bank}</b>
                <span>{bank.channel > 0 ? `Ch ${bank.channel}` : "Row buffer"}</span>
              </div>
            ))}
          </div>
        </article>
        <article>
          <h2>Request Queue</h2>
          <label>Trace
            <select aria-label="Load trace" value={presetId} onChange={(event) => {
              const next = DRAM_PRESETS.find((item) => item.id === event.target.value);
              setPresetId(event.target.value);
              if (next) {
                setAccesses(next.accesses);
                setPolicy(next.config.policy ?? "frfcfs");
                setTiming({ ...DRAM_TIMING, ...next.config.timing });
              }
              play.reset();
            }}>
              {DRAM_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <table>
            <thead><tr><th>#</th><th>Arrival</th><th>Op</th><th>Address</th><th>Bank</th><th>Row</th><th>Col</th><th>Kind</th></tr></thead>
            <tbody>
              {shot.rows.map((row) => (
                <tr key={row.id} className={row.id === selected ? "on" : ""} onClick={() => setSelected(row.id)}>
                  <td>{row.id}</td><td>{row.arrival}</td><td>{row.op === "read" ? "RD" : "WR"}</td><td>0x{row.address.toString(16)}</td><td>{row.bank}</td><td>0x{row.row.toString(16)}</td><td>0x{row.column.toString(16)}</td><td>{highlightHits && row.kind === "hit" ? "Hit" : row.kind === "conflict" ? "Conflict" : row.kind === "closed" ? "Closed" : row.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        {showBuffer ? (
          <article>
            <h2>Row Buffer State</h2>
            <table>
              <thead><tr><th>Bank</th><th>Open row</th><th>Command</th><th>Queue</th></tr></thead>
              <tbody>
                {shot.banks.map((bank) => (
                  <tr key={bank.unit}><td>Bank {bank.bank}{bank.channel ? ` / ch ${bank.channel}` : ""}</td><td>{bank.open === null ? "Closed" : `0x${bank.open.toString(16)}`}</td><td>{bank.command}</td><td>{bank.queued}</td></tr>
                ))}
              </tbody>
            </table>
            <p>Row hits {shot.hits}. Closed-bank activates {shot.closed}. Row conflicts {shot.conflicts}. Requests {shot.rows.length}.</p>
          </article>
        ) : null}
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Scheduler Configuration</h2>
          <label>Policy
            <select aria-label="Scheduling policy" value={policy} onChange={(event) => { setPolicy(event.target.value === "fcfs" ? "fcfs" : "frfcfs"); play.reset(); }}>
              <option value="fcfs">FCFS</option>
              <option value="frfcfs">FR-FCFS</option>
            </select>
          </label>
          <p>{policy === "frfcfs" ? "First-ready, first-come. An open-row request is ready. Among ready requests, the older one goes." : "First-come, first-served. The oldest queued request for a free bank goes, even when it closes the open row."}</p>
          <label>Age threshold (0 disables the fairness cap)
            <input aria-label="Age threshold" type="number" min={0} max={32} value={timing.ageThreshold} onChange={(event) => { setTiming({ ...timing, ageThreshold: Math.max(0, Number(event.target.value) || 0) }); play.reset(); }} />
          </label>
          <label>tRCD <input aria-label="tRCD" type="number" min={1} max={20} value={timing.tRCD} onChange={(event) => { setTiming({ ...timing, tRCD: Math.max(1, Number(event.target.value) || 1) }); play.reset(); }} /></label>
          <label>tCL <input aria-label="tCL" type="number" min={1} max={20} value={timing.tCL} onChange={(event) => { setTiming({ ...timing, tCL: Math.max(1, Number(event.target.value) || 1) }); play.reset(); }} /></label>
          <label>tRP <input aria-label="tRP" type="number" min={1} max={20} value={timing.tRP} onChange={(event) => { setTiming({ ...timing, tRP: Math.max(1, Number(event.target.value) || 1) }); play.reset(); }} /></label>
        </article>
        <article>
          <h2>Bank Activity</h2>
          <div className="vl-bytes" aria-label="Commands issued this cycle">
            {(result.commands[Math.max(0, play.cycle - 1)] ?? []).slice(0, 8).map((command, index) => (
              <span key={index} style={{ flex: 1, background: commandColor(command) }}>{command || "idle"}</span>
            ))}
          </div>
          <p className="vl-legend"><span>ACT</span><span>RD</span><span>WR</span><span>PRE</span></p>
          <p>Active banks this cycle {shot.active}. Average bank-level parallelism {shot.blp.toFixed(2)}. That average is the mean number of banks with a command in flight.</p>
        </article>
        {showTiming && focus ? (
          <article>
            <h2>Memory Timing</h2>
            <p>Request {focus.id} is {focus.kind ?? "still queued"}. Address 0x{focus.address.toString(16)}, bank {focus.bank}, row 0x{focus.row.toString(16)}.</p>
            <div className="vl-bytes">
              {sequence.map((command) => <span key={command} style={{ flex: 1, background: commandColor(command) }}>{command}</span>)}
            </div>
            <p>Closed row costs tRCD + tCL = {timing.tRCD + timing.tCL}. A conflict adds tRP, so {timing.tRP + timing.tRCD + timing.tCL}. A hit is tCL = {timing.tCL}. This request finished in {focus.complete === null ? "—" : focus.complete - focus.arrival} cycles from arrival.</p>
          </article>
        ) : null}
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Bank-Level Parallelism</h2>
          <svg viewBox="0 0 220 80" role="img" aria-label="Active banks over time">
            <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={result.active.map((value, index) => `${12 + (result.active.length <= 1 ? 0 : (index / (result.active.length - 1)) * 190)},${70 - (value / peak) * 60}`).join(" ")} />
          </svg>
          <p>Average active banks {result.final.blp.toFixed(2)} / {shot.banks.length}.</p>
        </article>
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={showTiming} label="Show Timing Details" onChange={setShowTiming} />
          <Toggle on={showBuffer} label="Show Row Buffer" onChange={setShowBuffer} />
          <Toggle on={highlightHits} label="Highlight Row Hits" onChange={setHighlightHits} />
          <Toggle on={auto} label="Auto Advance Requests" onChange={setAuto} />
          <Transport playing={play.playing} onPlay={() => { if (!auto) { play.setCycle((value) => Math.min(result.shots.length - 1, value + 1)); return; } play.setPlaying((value) => !value); }} onStep={() => play.setCycle((value) => Math.min(result.shots.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} speed={play.speed} onSpeed={play.setSpeed} />
        </article>
        <article>
          <h2>Results & Insights</h2>
          <div className="vl-metrics">
            <div><strong>{result.final.avgLatency.toFixed(1)}</strong><span>Avg latency</span></div>
            <div><strong>{result.final.throughput.toFixed(2)}</strong><span>Throughput</span></div>
            <div><strong>{Math.round(hitRate * 100)}%</strong><span>Row hit rate</span></div>
            <div><strong>{result.final.blp.toFixed(2)}</strong><span>Bank parallelism</span></div>
          </div>
          <p>Reads {result.final.reads}. Writes {result.final.writes}. Max latency {result.final.maxLatency}. Queue average {result.final.queue.toFixed(1)}. Bank utilization {Math.round(result.final.bankUtil * 100)}%. FCFS hit rate {compared.fcfs.final.hits}/{issued}. FR-FCFS hit rate {compared.ready.final.hits}/{issued}.</p>
        </article>
      </div>
    </LabChrome>
  );
}
