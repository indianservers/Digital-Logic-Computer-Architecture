import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { advanceDesktop, desktopConfig, desktopJob, DESKTOP_DEFAULTS, DESKTOP_JOBS, DESKTOP_MODEL_VERSION, initialDesktop, type DesktopConfig, type DesktopSample } from "../../engines/isaarch/desktopExperiment";
import "./experiment.css";

export function useDesktopExperiment() {
  const [config, setConfig] = useState<DesktopConfig>({ ...DESKTOP_DEFAULTS });
  const [state, setState] = useState(() => initialDesktop(DESKTOP_DEFAULTS));
  const [running, setRunning] = useState(false);
  const [baseline, setBaseline] = useState<{ time: number; energy: number; work: number; temperature: number; frequency: number; config: DesktopConfig } | null>(null);
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setState(s => advanceDesktop(s, config, 0.5)), 100); return () => clearInterval(timer); }, [running, config]);
  useSimulatorCapture("Desktop package experiment", () => ({ config, state, running, baseline }), DESKTOP_MODEL_VERSION);
  return { config, setConfig, state, running, setRunning, baseline, setBaseline,
    advance: (seconds: number) => { setRunning(false); setState(s => advanceDesktop(s, config, seconds)); },
    resetRun: () => { setRunning(false); setState(initialDesktop(config)); },
    reset: () => { setRunning(false); setConfig({ ...DESKTOP_DEFAULTS }); setState(initialDesktop(DESKTOP_DEFAULTS)); setBaseline(null); } };
}
type Experiment = ReturnType<typeof useDesktopExperiment>;
const n = (value: number, digits = 1) => (Math.abs(value) < .5 * 10 ** -digits ? 0 : value).toLocaleString(undefined, { maximumFractionDigits: digits });
function Trace({ samples, field, label, unit, color }: { samples: DesktopSample[]; field: "power" | "temperature" | "frequency"; label: string; unit: string; color: string }) {
  const max = Math.max(1, ...samples.map(s => s[field])) * 1.1;
  const start = samples[0]!.time, end = samples[samples.length - 1]!.time;
  const points = samples.map(s => `${40 + (s.time - start) / Math.max(.1, end - start) * 540},${112 - s[field] / max * 95}`).join(" ");
  return <figure><figcaption>{label} · {n(max)} {unit} full scale</figcaption><svg viewBox="0 0 600 140" role="img" aria-label={`${label} against simulated seconds`}><path d="M40 10V112H580" fill="none" stroke="currentColor" opacity=".3" /><polyline points={points} fill="none" stroke={color} strokeWidth="2.5" /><text x="40" y="132">{n(start)} s</text><text x="525" y="132">{n(end)} s</text><text x="5" y="115">0</text></svg></figure>;
}
export function DesktopExperiment({ experiment: e, view }: { experiment: Experiment; view: string }) {
  const { config: c, state: s } = e, p = s.sample;
  const pending = JSON.stringify(desktopConfig(c)) !== JSON.stringify(s.applied);
  function control(key: keyof DesktopConfig, label: string, min: number, max: number, step = 1) {
    return <label>{label}<input type="number" min={min} max={max} step={step} value={c[key] as number} onChange={event => e.setConfig(desktopConfig({ ...c, workload: "custom", [key]: event.target.valueAsNumber }))} /></label>;
  }
  function exportCSV() {
    const keys: (keyof DesktopSample)[] = ["time", "temperature", "frequency", "power", "throughput", "bandwidth", "powerLimit", "memoryLimited", "powerLimited", "thermalLimited"];
    const blob = new Blob(["# desktop-package-1; seconds,C,GHz,W,million work/s,GB/s,W; last 120 seconds maximum\n" + keys.join(",") + "\n" + s.samples.map(row => keys.map(key => row[key]).join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "desktop-experiment.csv"; a.click(); URL.revokeObjectURL(url);
  }
  return <section className="desktop-experiment">
    <nav aria-label="Coupled experiment views" className="de-tabs">{[["boost-power", "1 · Power"], ["thermal", "2 · Cooling"], ["workloads", "3 · Workloads"]].map(([id, title]) => <Link key={id} aria-current={view === id ? "page" : undefined} to={`/architecture/desktop/${id}`}>{title}</Link>)}</nav>
    <p className="de-notice">One shared experiment · generic homogeneous core model · modeled work units, not processor benchmark scores.</p>
    <div className="de-toolbar"><button onClick={() => e.setRunning(!e.running)}>{e.running ? "Pause" : "Run"}</button><button onClick={() => e.advance(.1)}>Step 100 ms</button><button onClick={() => e.advance(10)}>Advance 10 s</button><button onClick={() => e.advance(60)}>Advance 60 s</button><button onClick={e.resetRun}>Reset run</button><button onClick={exportCSV}>Export trace CSV</button><span>Playback 5× · fixed 100 ms integration</span></div>
    {pending && <p role="status">Settings changed. Advance to apply them, or reset the run to start at ambient temperature.</p>}
    <div className="de-metrics">{[["Simulated time", `${n(s.time)} s`], ["Frequency", `${n(p.frequency, 2)} GHz`], ["Package", `${n(p.power)} W`], ["Temperature", `${n(s.temperature)} °C`], ["Energy", `${n(s.energy)} J`], ["Completed work", `${n(s.work)} M units`], ["Throughput", `${n(p.throughput)} M units/s`], ["Memory traffic", `${n(p.bandwidth)} GB/s`]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
    <p className="de-limit" role="status">Active cap: {n(p.powerLimit)} W · {p.powerLimited ? "Power limited" : "Power headroom"} · {p.thermalLimited ? "Thermal frequency reduction" : "Thermal headroom"} · {p.memoryLimited ? "Memory bandwidth limited" : "Compute limited"}</p>
    <div className="de-layout"><div>
      <section className="de-card"><h2>{view === "thermal" ? "Cooling experiment" : view === "workloads" ? "Workload experiment" : "Power policy experiment"}</h2><p>Choose a workload, change one setting, then run both trials for the same simulated duration.</p>
      <label>Workload preset<select value={c.workload} onChange={event => e.setConfig(desktopJob(c, event.target.value))}><option value="custom">Custom</option>{DESKTOP_JOBS.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}</select></label>
      <div className="de-controls">
      {view === "boost-power" && <>{control("sustained", "Sustained limit (W)", 15, 250)}{control("burst", "Burst limit (W)", c.sustained, 300)}{control("burstSeconds", "Burst window (s)", 0, 60)}{control("maxGHz", "Maximum frequency (GHz)", 1, 6, .1)}</>}
      {view === "thermal" && <>{control("ambient", "Ambient (°C)", 10, 45)}{control("resistance", "Cooler resistance (K/W)", .15, 1.5, .05)}{control("capacitance", "Thermal capacitance (J/K)", 10, 200)}{control("fan", "Fan duty (%)", 20, 100)}{control("thermalLimit", "Thermal target (°C)", 60, 105)}</>}
      {view === "workloads" && <>{control("cores", "Physical cores", 1, 16)}{control("threads", "Runnable threads", 1, 32)}{control("load", "CPU demand (%)", 0, 100)}{control("gpu", "Integrated GPU duty (%)", 0, 100)}{control("bandwidth", "Memory bandwidth (GB/s)", 5, 120)}{control("bytes", "Bytes per work unit", 1, 256)}<label><input type="checkbox" checked={c.smt} onChange={event => e.setConfig({ ...c, smt: event.target.checked })} /> SMT enabled</label></>}
      </div><p>Configured: {c.cores} cores / {c.threads} threads · {c.sustained}/{c.burst} W · {c.bandwidth} GB/s · {c.ambient} °C ambient. Settings persist between these three views.</p></section>
      <section className="de-card"><h2>Package activity</h2><div className="de-cores">{Array.from({ length: s.applied.cores }, (_, i) => <div key={i} className={i < p.activeCores ? "active" : ""}>Core {i}<strong>{i < p.activeCores ? `${n(p.utilization * 100)}%` : "Idle"}</strong></div>)}</div><p>Activity includes demand and modeled memory stalls. SMT shares physical cores.</p>{[["CPU", p.cpuPower], ["Integrated GPU", p.gpuPower], ["Uncore", p.uncorePower], ["Leakage", p.leakage]].map(([label, value]) => <div className="de-power" key={label}><span>{label}</span><meter min={0} max={Math.max(1, p.power)} value={value as number} /><b>{n(value as number)} W</b></div>)}</section>
    </div><div><section className="de-card"><h2>Measured trace</h2><p>Separate scales · last {n(s.samples[s.samples.length - 1]!.time - s.samples[0]!.time)} simulated seconds · values sampled after each integration interval.</p><Trace samples={s.samples} field="power" label="Package power" unit="W" color="#22c55e" /><Trace samples={s.samples} field="temperature" label="Junction temperature" unit="°C" color="#f59e0b" /><Trace samples={s.samples} field="frequency" label="Core frequency" unit="GHz" color="#38bdf8" /></section></div></div>
    <section className="de-card"><h2>Compare a controlled trial</h2><button onClick={() => { e.setRunning(false); e.setBaseline({ time: s.time, energy: s.energy, work: s.work, temperature: s.temperature, frequency: p.frequency, config: s.applied }); }} disabled={!s.time}>Save baseline</button>{e.baseline ? <><p>Baseline: {n(e.baseline.time)} s · {n(e.baseline.energy)} J · {n(e.baseline.work)} M work units · {n(e.baseline.temperature)} °C · {n(e.baseline.frequency, 2)} GHz · {e.baseline.config.sustained} W sustained / {e.baseline.config.bandwidth} GB/s.</p>{Math.abs(e.baseline.time - s.time) < .001 ? <p>Same-duration comparison: energy {n(s.energy - e.baseline.energy)} J; work {n(s.work - e.baseline.work)} M units; temperature {n(s.temperature - e.baseline.temperature)} °C; frequency {n(p.frequency - e.baseline.frequency, 2)} GHz versus baseline.</p> : <p>Run the new trial to {n(e.baseline.time)} s before comparing totals. Reset run preserves the baseline.</p>}</> : <p>Run a trial, save its baseline, change one setting, then reset and run again. Use Notebook to capture the full simulator state and configuration.</p>}</section>
    <details className="de-card"><summary>Model assumptions and equations</summary><p>This is a generic educational package, with homogeneous cores and a shared integrated GPU power budget. It does not predict a particular commercial CPU. CPU work = 250 million modeled units per active core-GHz × demand, with at most 20% modeled SMT gain. Throughput is capped by memory bandwidth divided by bytes per unit.</p><p>CPU dynamic power scales with activity × frequency × voltage²; voltage = 0.65 + 0.1 × GHz. The controller fits CPU and GPU activity inside the burst or sustained package budget. Thermal control reduces frequency starting 5 °C below the target; this is a soft controller, not a hard temperature clamp.</p><p>Cooling uses an RC model: Tnext = Tambient + (T − Tambient) exp(−dt/RC) + P R (1 − exp(−dt/RC)). Fan duty scales effective resistance. Energy integrates watts over seconds; work integrates measured throughput. Reset the run after changing settings for a clean trial; live edits retain previous history.</p></details>
  </section>;
}
