import { useMemo, useState } from "react";
import { CORE_COUNTS, SCALE_DEFAULTS, SCALE_PRESETS, scaleAt, scaleSeries, theoreticalLimit, type ScaleInput } from "../../../engines/aca/scaling";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";

function num(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "unbounded";
  return value.toFixed(digits);
}

export function AmdahlLab() {
  const [input, setInput] = useState<ScaleInput>(SCALE_DEFAULTS);
  const [preset, setPreset] = useState("strong");
  const [showIdeal, setShowIdeal] = useState(true);
  const [showWork, setShowWork] = useState(true);
  const [auto, setAuto] = useState(false);
  const play = usePlayback(CORE_COUNTS.length - 1);
  const cores = auto ? (CORE_COUNTS[play.cycle] ?? input.cores) : input.cores;
  const active = useMemo(() => ({ ...input, cores }), [input, cores]);
  const point = useMemo(() => scaleAt(active, cores), [active, cores]);
  const series = useMemo(() => scaleSeries(active), [active]);
  const limit = theoreticalLimit(input.serial);
  const peak = Math.max(...series.map((item) => Math.max(item.ideal, item.speedup)), 1);
  const parts = [
    { label: "Serial", value: point.serial, color: "#f59e0b" },
    { label: "Parallel", value: point.parallel, color: "#60a5fa" },
    { label: "Communication", value: point.communication, color: "#a78bfa" },
    { label: "Synchronization", value: point.synchronization, color: "#f87171" },
    { label: "Idle", value: point.idle, color: "#94a3b8" },
  ];
  const pie = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  let cursor = 0;
  const gradient = parts.map((part) => {
    const start = (cursor / pie) * 100;
    cursor += part.value;
    return `${part.color} ${start}% ${(cursor / pie) * 100}%`;
  }).join(", ");
  const shownCores = Math.min(cores, 16);
  const patch = (next: Partial<ScaleInput>) => { setInput((current) => ({ ...current, ...next })); setPreset("custom"); };
  return (
    <LabChrome lab="amdahl" kicker="Labs > Lab 28" title="Lab 28 — Multicore Scaling & Amdahl's Law" subtitle="See why extra cores stop helping once serial work, communication, and synchronization dominate." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Strong scaling keeps the total problem fixed. Weak scaling keeps the work per core fixed. Speedup(N) = 1 / (f + (1−f)/N) when overhead is off. The extra terms below are a lab model, not a hardware law.</p></article>
        <article><h2>Experiment Status</h2><p>{input.mode === "strong" ? "Strong scaling: fixed total workload." : "Weak scaling: fixed workload per core, so the total problem grows with N."}</p><p>{auto ? `Sweeping core counts. Now ${cores} ${cores === 1 ? "core" : "cores"}.` : `${cores} ${cores === 1 ? "core" : "cores"} selected.`}</p></article>
        <article><h2>Limit</h2><p>As N grows and overhead is ignored, the pure Amdahl limit is {num(limit)}×. Ideal linear speedup is N. This configuration does not reach it.</p></article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Scaling setup</h2>
          <label>Example
            <select aria-label="Scaling example" value={preset} onChange={(event) => {
              const next = SCALE_PRESETS.find((item) => item.id === event.target.value);
              setPreset(event.target.value);
              if (next) setInput((current) => ({ ...current, ...next.input }));
              play.reset();
            }}>
              <option value="custom">Current settings</option>
              {SCALE_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <div className="vl-pills">
            <button type="button" className={input.mode === "strong" ? "on" : ""} onClick={() => patch({ mode: "strong" })}>Strong</button>
            <button type="button" className={input.mode === "weak" ? "on" : ""} onClick={() => patch({ mode: "weak" })}>Weak</button>
          </div>
          <div className="vl-pills">
            {CORE_COUNTS.map((count) => <button key={count} type="button" className={cores === count ? "on" : ""} onClick={() => { setAuto(false); patch({ cores: count }); }}>{count}</button>)}
          </div>
          <label>Serial fraction f
            <input aria-label="Serial fraction" type="range" min={0} max={1} step={0.01} value={input.serial} onChange={(event) => patch({ serial: Number(event.target.value) })} />
            <span>{num(input.serial)}</span>
          </label>
          <label>Parallel fraction
            <span>{num(1 - input.serial)}</span>
          </label>
          <label>Communication overhead, relative
            <input aria-label="Communication cost" type="range" min={0} max={0.2} step={0.001} value={input.commPerCore} onChange={(event) => patch({ commPerCore: Number(event.target.value) })} />
            <span>{num(input.commPerCore, 3)}</span>
          </label>
          <label>Synchronization cost per barrier
            <input aria-label="Synchronization cost" type="range" min={0} max={0.2} step={0.001} value={input.syncPerBarrier} onChange={(event) => patch({ syncPerBarrier: Number(event.target.value) })} />
            <span>{num(input.syncPerBarrier, 3)}</span>
          </label>
          <label>Barriers
            <input aria-label="Barrier count" type="number" min={0} max={32} value={input.barriers} onChange={(event) => patch({ barriers: Math.max(0, Number(event.target.value) || 0) })} />
          </label>
          <label>Load imbalance
            <input aria-label="Load imbalance" type="range" min={0} max={1} step={0.05} value={input.imbalance} onChange={(event) => patch({ imbalance: Number(event.target.value) })} />
            <span>{num(input.imbalance)}</span>
          </label>
          <Toggle on={showIdeal} label="Show ideal" onChange={setShowIdeal} />
          <Toggle on={input.includeComm} label="Include communication" onChange={(next) => patch({ includeComm: next })} />
          <Toggle on={input.includeSync} label="Include synchronization" onChange={(next) => patch({ includeSync: next })} />
          <Toggle on={showWork} label="Show work breakdown" onChange={setShowWork} />
          <Toggle on={auto} label="Sweep core counts" onChange={setAuto} />
        </article>
        <article>
          <h2>Speedup</h2>
          <p>S(N) = 1 / (f + (1−f)/N + Ccomm + Csync). For this lab model, Ccomm is the communication slider and Csync is the barrier cost times the barrier count. Both terms are 0 at one core, so speedup starts at 1. They are relative overheads, not a hardware law.</p>
          <svg viewBox="0 0 320 180" role="img" aria-label="Speedup versus cores">
            <line x1="28" y1="10" x2="28" y2="150" stroke="#cbd5e1" />
            <line x1="28" y1="150" x2="310" y2="150" stroke="#cbd5e1" />
            {showIdeal ? <polyline fill="none" stroke="#94a3b8" strokeDasharray="4 3" points={series.map((item, index) => `${36 + index * 42},${150 - (item.ideal / peak) * 130}`).join(" ")} /> : null}
            <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={series.map((item, index) => `${36 + index * 42},${150 - (item.amdahl / peak) * 130}`).join(" ")} />
            <polyline fill="none" stroke="#dc2626" strokeWidth="2" points={series.map((item, index) => `${36 + index * 42},${150 - (item.speedup / peak) * 130}`).join(" ")} />
            {series.map((item, index) => <text key={item.cores} x={36 + index * 42} y="166" textAnchor="middle" fontSize="10">{item.cores}</text>)}
          </svg>
          <p className="tiny">Grey dashed is ideal N. Blue is pure Amdahl. Red is this configuration, including the overhead terms that are switched on.</p>
        </article>
        <article>
          <h2>Efficiency</h2>
          <div className="vl-bars">
            {series.map((item) => (
              <b key={item.cores}>{num(item.efficiency * 100, 0)}%<i style={{ height: `${Math.max(4, item.efficiency * 100)}%` }} className={item.cores === cores ? "two" : ""} /></b>
            ))}
          </div>
          <p className="tiny">Efficiency = speedup / N. The highlighted bar is the selected core count.</p>
          {showWork ? <div className="vl-pie" style={{ background: `conic-gradient(${gradient})` }} /> : null}
          {showWork ? <ul>{parts.map((part) => <li key={part.label}>{part.label}: {num((part.value / pie) * 100, 1)}% of the critical path</li>)}</ul> : null}
        </article>
      </div>
      <section className="vl-panel">
        <header><h2>Core timeline</h2></header>
        <p>Core 0 carries the serial fraction. Every core does an equal parallel share, then pays communication and the barrier. Imbalance lengthens the slowest core and leaves the others idle.</p>
        <div className="vl-stack">
          {Array.from({ length: shownCores }, (_, core) => {
            const slowest = core === shownCores - 1 && input.imbalance > 0;
            const serial = core === 0 ? point.serial : 0;
            const waiting = core === 0 ? 0 : point.serial;
            const parallel = point.parallel * (slowest ? 1 + input.imbalance : 1);
            const idle = slowest ? 0 : point.idle;
            const total = Math.max(point.time, serial + waiting + parallel + point.communication + point.synchronization + idle, 0.001);
            const slice = (value: number, color: string) => <i style={{ height: `${(value / total) * 100}%`, background: color }} />;
            return <b key={core}>C{core}{slice(idle, "#94a3b8")}{slice(point.synchronization, "#f87171")}{slice(point.communication, "#a78bfa")}{slice(waiting, "#fde68a")}{slice(parallel, "#60a5fa")}{slice(serial, "#f59e0b")}</b>;
          })}
        </div>
        {cores > shownCores ? <p className="tiny">The timeline shows 16 of {cores} cores. The metrics still use all {cores}.</p> : null}
      </section>
      <div className="vl-metrics">
        <div><strong>{cores}</strong><span>Cores</span></div>
        <div><strong>{num(input.serial)}</strong><span>Serial fraction</span></div>
        <div><strong>{num(1 - input.serial)}</strong><span>Parallel fraction</span></div>
        <div><strong>{num(point.speedup)}×</strong><span>Speedup</span></div>
        <div><strong>{num(limit)}×</strong><span>Maximum theoretical speedup</span></div>
        <div><strong>{num(point.efficiency * 100, 1)}%</strong><span>Efficiency</span></div>
        <div><strong>{num(point.time, 3)}</strong><span>Execution time, relative to one core</span></div>
        <div><strong>{num(point.communication, 3)}</strong><span>Communication time</span></div>
        <div><strong>{num(point.synchronization, 3)}</strong><span>Synchronization time</span></div>
        <div><strong>{num(point.idle, 3)}</strong><span>Idle time</span></div>
        <div><strong>{num(point.parallel, 3)}</strong><span>Parallel work per core</span></div>
        <div><strong>{num(point.amdahl)}×</strong><span>Pure Amdahl, overhead off</span></div>
      </div>
      <Transport playing={play.playing} onPlay={() => { setAuto(true); play.setPlaying((value) => !value); }} onStep={() => { setAuto(true); play.setCycle((value) => Math.min(CORE_COUNTS.length - 1, value + 1)); }} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={() => { setAuto(false); setInput((current) => ({ ...current, cores: 16 })); play.reset(); }} speed={play.speed} onSpeed={play.setSpeed} />
    </LabChrome>
  );
}
