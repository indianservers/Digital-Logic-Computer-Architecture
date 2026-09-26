import { useMemo, useState } from "react";
import { COUNTER_PRESETS, derive, evidence, interval, perCore, sampleAt, toCsv, totalsFor, type CounterProfile, type DerivedCounters } from "../../../engines/aca/counters";
import { LabChrome, Transport, usePlayback } from "./HazardLab";
import { CounterDerive } from "../animation/phase3Views";
import { useGuideFocus } from "../guide/focus";

const SAMPLES = 8;

function num(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return value.toFixed(digits);
}

interface SavedRun {
  label: string;
  derived: DerivedCounters;
}

export function CounterLab() {
  const [profile, setProfile] = useState<CounterProfile>(COUNTER_PRESETS[7] ?? COUNTER_PRESETS[0]!);
  const [saved, setSaved] = useState<SavedRun[]>([]);
  const [compare, setCompare] = useState(0);
  const play = usePlayback(SAMPLES - 1);
  const fraction = (play.cycle + 1) / SAMPLES;
  const current = useMemo(() => sampleAt(profile, fraction), [profile, fraction]);
  const previous = useMemo(() => sampleAt(profile, Math.max(0, play.cycle) / SAMPLES), [profile, play.cycle]);
  const slice = useMemo(() => interval(previous.totals, current.totals), [previous, current]);
  const { id: guideFocus, setId: setGuideFocus } = useGuideFocus();
  const full = useMemo(() => derive(totalsFor(profile)), [profile]);
  const cores = useMemo(() => perCore(profile), [profile]);
  const report = useMemo(() => evidence(profile), [profile]);
  const history = useMemo(() => Array.from({ length: play.cycle + 1 }, (_, index) => sampleAt(profile, (index + 1) / SAMPLES).derived.ipc), [profile, play.cycle]);
  const rows = [
    ["Cycles", current.totals.cycles, slice.delta.cycles],
    ["Instructions retired", current.totals.instructions, slice.delta.instructions],
    ["Branches", current.totals.branches, slice.delta.branches],
    ["Branch mispredictions", current.totals.mispredictions, slice.delta.mispredictions],
    ["L1 accesses", current.totals.l1Accesses, slice.delta.l1Accesses],
    ["L1 misses", current.totals.l1Misses, slice.delta.l1Misses],
    ["LLC accesses", current.totals.llcAccesses, slice.delta.llcAccesses],
    ["LLC misses", current.totals.llcMisses, slice.delta.llcMisses],
    ["DTLB misses", current.totals.dtlbMisses, slice.delta.dtlbMisses],
    ["ITLB misses", current.totals.itlbMisses, slice.delta.itlbMisses],
    ["Front-end stall cycles", current.totals.frontendStalls, slice.delta.frontendStalls],
    ["Back-end stall cycles", current.totals.backendStalls, slice.delta.backendStalls],
    ["Memory stall cycles", current.totals.memoryStalls, slice.delta.memoryStalls],
  ] as const;
  const download = (kind: "csv" | "json") => {
    const body = kind === "csv"
      ? toCsv(rows.map(([name, value, delta]) => ({ counter: name, value, delta })))
      : JSON.stringify({ profile: profile.label, cumulative: current.totals, interval: slice.delta, derived: slice.derived }, null, 2);
    const blob = new Blob([body], { type: kind === "csv" ? "text/csv" : "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `counters.${kind}`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const hint = slice.derived.stallShare.memory > 0.25
    ? "Memory stalls are a large share of cycles. IPC does not name that share."
    : `IPC ${num(slice.derived.ipc, 3)}. L1 MPKI ${num(slice.derived.l1Mpki, 2)}.`;
  const reading = `${profile.label}: IPC ${num(slice.derived.ipc, 3)}, L1 MPKI ${num(slice.derived.l1Mpki, 2)}, bandwidth ${num(slice.derived.bandwidth, 2)} GB/s.`;
  return (
    <LabChrome lab="performance-counters" kicker="Labs > Lab 31" title="Lab 31 — CPU Performance Counter Laboratory" subtitle="Collect a coherent counter sample, derive rates from the interval, and read the evidence." badge="RISC-V (5-Stage Pipeline)" hint={hint} reading={reading}>
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Interval IPC uses the change in instructions and the change in cycles since the previous sample. Stall shares in this lab are exclusive slices of the cycle count. They are a model, not overlapping hardware events.</p></article>
        <article><h2>Sample</h2><p>Sample {play.cycle + 1} of {SAMPLES}. Elapsed time is cycles divided by {num(profile.frequencyHz / 1e9, 1)} GHz.</p>
          <CounterDerive ipc={slice.derived.ipc} mpki={slice.derived.l1Mpki} bandwidth={slice.derived.bandwidth} memoryShare={slice.derived.stallShare.memory} speed={play.speed} cycle={play.cycle} />
        </article>
        <article><h2>Evidence</h2>{report.notes.map((note) => <p key={note}>{note}</p>)}</article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Workload</h2>
          <label>Example
            <select aria-label="Counter workload" value={profile.id} onChange={(event) => {
              const next = COUNTER_PRESETS.find((item) => item.id === event.target.value);
              if (next) setProfile(next);
              play.reset();
            }}>
              {COUNTER_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label>Threads
            <select aria-label="Thread count" value={profile.threads} onChange={(event) => setProfile({ ...profile, threads: Number(event.target.value) })}>
              {[1, 2, 4, 8].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <label>Frequency (GHz)
            <input aria-label="Frequency" type="number" min={0.5} max={6} step={0.1} value={profile.frequencyHz / 1e9} onChange={(event) => setProfile({ ...profile, frequencyHz: Math.max(0.5, Number(event.target.value) || 0.5) * 1e9 })} />
          </label>
          <button type="button" onClick={() => setSaved((items) => [...items, { label: `${profile.label} #${items.length + 1}`, derived: full }].slice(-6))}>Save run</button>
          <button type="button" onClick={() => download("csv")}>Export CSV</button>
          <button type="button" onClick={() => download("json")}>Export JSON</button>
        </article>
        <article>
          <h2>Interval IPC</h2>
          <svg viewBox="0 0 320 120" role="img" aria-label="IPC across samples">
            <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={history.map((ipc, index) => `${24 + index * 36},${100 - ipc * 40}`).join(" ")} />
          </svg>
          <p className="tiny">A steady workload keeps the same interval IPC. The line moves only when the underlying profile changes.</p>
          <div className="vl-bytes" style={{ display: "flex", height: 22, borderRadius: 8, overflow: "hidden" }}>
            <i style={{ width: `${full.stallShare.frontend * 100}%`, background: "#93c5fd" }} />
            <i style={{ width: `${full.stallShare.backend * 100}%`, background: "#c4b5fd" }} />
            <i style={{ width: `${full.stallShare.memory * 100}%`, background: "#fca5a5" }} />
          </div>
          <p className="tiny">Blue front-end, purple back-end, red memory. Shares are of the stall cycles, which themselves are exclusive portions of total cycles.</p>
        </article>
        <article>
          <h2 className={guideFocus === "derived" ? "aca-guide-on" : undefined}>Derived, this interval</h2>
          <div className="vl-metrics">
            <div><strong>{num(slice.derived.ipc, 3)}</strong><span>IPC</span></div>
            <div><strong>{num(slice.derived.cpi, 3)}</strong><span>CPI</span></div>
            <div><strong>{num(slice.derived.mispredictRate * 100, 2)}%</strong><span>Branch mispredict rate</span></div>
            <div><strong>{num(slice.derived.branchMpki, 2)}</strong><span>Branch MPKI</span></div>
            <div><strong>{num(slice.derived.l1Mpki, 2)}</strong><span>L1 MPKI</span></div>
            <div><strong>{num(slice.derived.llcMpki, 2)}</strong><span>LLC MPKI</span></div>
            <div><strong>{num(slice.derived.tlbMpki, 2)}</strong><span>TLB MPKI</span></div>
            <div><strong>{num(slice.derived.bandwidth, 2)}</strong><span>Bandwidth (GB/s)</span></div>
          </div>
        </article>
      </div>
      <section className="vl-panel">
        <header className={guideFocus === "raw" ? "aca-guide-on" : undefined}><h2>Counters</h2></header>
        <table>
          <thead><tr><th>Counter</th><th>Cumulative</th><th>Delta since previous sample</th></tr></thead>
          <tbody>
            {rows.map(([name, value, delta]) => (
              <tr key={name}><td>{name}</td><td>{num(value, 0)}</td><td>{num(delta, 0)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="vl-panel">
        <header><h2>Per core</h2></header>
        <p>Work is split across threads with a small fixed imbalance. Bandwidth uses each core’s bytes over the same wall-clock time.</p>
        <table>
          <thead><tr><th>Core</th><th>Instructions</th><th>IPC</th><th>Bandwidth (GB/s)</th></tr></thead>
          <tbody>
            {cores.map((core) => (
              <tr key={core.core}><td>{core.core}</td><td>{num(core.totals.instructions, 0)}</td><td>{num(core.derived.ipc, 3)}</td><td>{num(core.derived.bandwidth, 3)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      {saved.length > 1 ? (
        <section className="vl-panel">
          <header><h2>Saved runs</h2></header>
          <label>Compare with
            <select aria-label="Comparison run" value={compare} onChange={(event) => setCompare(Number(event.target.value))}>
              {saved.map((run, index) => <option key={run.label} value={index}>{run.label}</option>)}
            </select>
          </label>
          <table>
            <thead><tr><th>Metric</th>{saved.map((run) => <th key={run.label}>{run.label}</th>)}</tr></thead>
            <tbody>
              {([
                ["IPC", (run: SavedRun) => num(run.derived.ipc, 3)],
                ["CPI", (run: SavedRun) => num(run.derived.cpi, 3)],
                ["Branch MPKI", (run: SavedRun) => num(run.derived.branchMpki, 2)],
                ["L1 MPKI", (run: SavedRun) => num(run.derived.l1Mpki, 2)],
                ["LLC MPKI", (run: SavedRun) => num(run.derived.llcMpki, 2)],
                ["TLB MPKI", (run: SavedRun) => num(run.derived.tlbMpki, 2)],
                ["Bandwidth GB/s", (run: SavedRun) => num(run.derived.bandwidth, 2)],
              ] as const).map(([label, read]) => (
                <tr key={label} className={saved[compare] && label === "IPC" ? "on" : ""}><td>{label}</td>{saved.map((run) => <td key={run.label}>{read(run)}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <p className="tiny">The table is a profile comparison. It does not rank a winner.</p>
        </section>
      ) : null}
      <Transport playing={play.playing} onPlay={() => play.setPlaying((value) => !value)} onStep={() => play.setCycle((value) => Math.min(SAMPLES - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={() => { setGuideFocus(""); play.reset(); }} speed={play.speed} onSpeed={play.setSpeed} />
    </LabChrome>
  );
}
