import { useEffect, useState } from "react";
import { initialThermal, stepThermal, THERMAL_DEFAULTS, type ThermalParameters, type ThermalProfile, type ThermalState } from "../../engines/isaarch/mobile";
import "./thermalLab.css";

const LOADS = [{ name: "Idle", cpu: 0, gpu: 0, npu: 0 }, { name: "Web browsing", cpu: 35, gpu: 15, npu: 0 }, { name: "Gaming", cpu: 70, gpu: 90, npu: 5 }, { name: "Camera + AI", cpu: 40, gpu: 20, npu: 70 }, { name: "Compute stress", cpu: 100, gpu: 100, npu: 100 }];
export function ThermalLab() {
  const [parameters, setParameters] = useState<ThermalParameters>(THERMAL_DEFAULTS);
  const [load, setLoad] = useState(2);
  const [profile, setProfile] = useState<ThermalProfile>("sustained");
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState<ThermalState[]>(() => [initialThermal(25)]);
  const selected = LOADS[load]!;
  const state = samples[samples.length - 1]!;
  const advance = (seconds: number) => setSamples(rows => {
    const next = [...rows];
    for (let i = 0; i < seconds && next.length <= 1800; i++) next.push(stepThermal(next[next.length - 1]!, selected, parameters, 1, profile));
    return next;
  });
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSamples(rows => rows.length > 1800 ? rows : [...rows, stepThermal(rows[rows.length - 1]!, selected, parameters, 1, profile)]), 100);
    return () => window.clearInterval(timer);
  }, [running, selected, parameters, profile]);
  useEffect(() => { if (samples.length > 1800) setRunning(false); }, [samples.length]);
  const reset = () => { setRunning(false); setSamples([initialThermal(parameters.ambient)]); };
  const change = (key: keyof ThermalParameters, value: number) => { setRunning(false); setParameters(p => ({ ...p, [key]: value })); setSamples([initialThermal(key === "ambient" ? value : parameters.ambient)]); };
  const exportCsv = () => {
    const blob = new Blob([`# Generic two-node RC thermal model\n# parameters=${JSON.stringify(parameters)}\n# workload=${selected.name}; profile=${profile}\ntime_s,junction_C,enclosure_C,power_W,energy_J,frequency_scale,throttled\n` + samples.map(s => [s.time.toFixed(2), s.junction.toFixed(3), s.enclosure.toFixed(3), s.power.toFixed(3), s.energy.toFixed(3), s.frequency, s.throttle].join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "thermal-experiment.csv"; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const yMin = Math.min(parameters.ambient - 5, 20); const yMax = Math.max(110, ...samples.map(s => s.junction + 5));
  const x = (time: number) => 55 + time / Math.max(180, state.time) * 620;
  const y = (temp: number) => 235 - (temp - yMin) / (yMax - yMin) * 210;
  const line = (key: "junction" | "enclosure") => samples.filter((_, i) => i % Math.max(1, Math.floor(samples.length / 600)) === 0 || i === samples.length - 1).map(s => `${x(s.time)},${y(s[key])}`).join(" ");
  return <div className="thermal-lab">
    <div className="thermal-intro"><div><span>EXPERIMENT 08 / THERMAL DYNAMICS</span><h2>Follow the heat.</h2><p>Compare a short burst with a sustained load. Watch heat accumulate, frequency drop, and the enclosure cool.</p></div><span className={`thermal-status ${state.throttle ? "hot" : ""}`}>{running ? "● ACQUIRING" : "○ PAUSED"} · {state.throttle ? "THROTTLED" : "NOMINAL"}</span></div>
    <div className="thermal-metrics">{[["Junction", `${state.junction.toFixed(1)} °C`], ["Enclosure", `${state.enclosure.toFixed(1)} °C`], ["SoC power", `${state.power.toFixed(2)} W`], ["Frequency", `${(state.frequency * 100).toFixed(0)} %`], ["Energy", `${state.energy.toFixed(1)} J`]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="thermal-bench"><section className="thermal-controls"><h3>01 / Configure</h3><label>Workload<select value={load} onChange={e => { setLoad(Number(e.target.value)); reset(); }}>{LOADS.map((l, i) => <option value={i} key={l.name}>{l.name}</option>)}</select></label><label>Load profile<select value={profile} onChange={e => { setProfile(e.target.value as ThermalProfile); reset(); }}><option value="sustained">Sustained load</option><option value="burst">15 s burst / 45 s idle</option><option value="cooldown">120 s load → cooldown</option></select></label><p>CPU {selected.cpu}% · GPU {selected.gpu}% · NPU {selected.npu}%</p>
      {([['ambient', 'Ambient', 10, 45, 1, '°C'], ['ambientResistance', 'Case → air resistance', 2, 15, .5, 'K/W'], ['junctionCapacity', 'Junction heat capacity', 2, 20, 1, 'J/K'], ['caseCapacity', 'Case heat capacity', 20, 100, 5, 'J/K'], ['limit', 'Throttle threshold', 55, 100, 1, '°C']] as const).map(([key, label, min, max, step, unit]) => <label key={key}>{label}<output>{parameters[key]} {unit}</output><input type="range" min={min} max={max} step={step} value={parameters[key]} onChange={e => change(key, Number(e.target.value))}/></label>)}<small>Configuration changes start a fresh experiment.</small></section>
    <section className="thermal-scope"><div className="thermal-scope-head"><h3>02 / Measure</h3><span>{state.time.toFixed(0)} / 1800 s · 10× playback</span></div><svg viewBox="0 0 710 280" role="img" aria-label={`Temperature over time. Junction ${state.junction.toFixed(1)} degrees Celsius, enclosure ${state.enclosure.toFixed(1)} degrees Celsius at ${state.time.toFixed(0)} seconds.`}>
      {[0, 1, 2, 3, 4].map(i => { const temp = yMin + i * (yMax - yMin) / 4; return <g key={i}><line x1="55" x2="675" y1={y(temp)} y2={y(temp)} stroke="#dce6ee"/><text x="45" y={y(temp) + 4} textAnchor="end">{temp.toFixed(0)}°</text></g>; })}
      <line x1="55" x2="675" y1={y(parameters.limit)} y2={y(parameters.limit)} stroke="#de6c42" strokeDasharray="6 5"/><text x="675" y={y(parameters.limit) - 6} textAnchor="end">Throttle {parameters.limit}°C</text><polyline points={line("enclosure")} stroke="#8497b1" fill="none" strokeWidth="2.5"/><polyline points={line("junction")} stroke="#008c87" fill="none" strokeWidth="3"/>{[0, 1, 2, 3].map(i => <text key={i} x={55 + i / 3 * 620} y="258" textAnchor="middle">{Math.round(i / 3 * Math.max(180, state.time))} s</text>)}<text x="16" y="16">°C</text>
    </svg><div className="thermal-legend"><span>● Junction</span><span>● Enclosure</span><span>– – Throttle limit</span></div><div className="thermal-actions"><button onClick={() => setRunning(v => !v)} disabled={samples.length > 1800}>{running ? "Pause" : "▶ Run experiment"}</button><button disabled={running || samples.length > 1800} onClick={() => advance(30)}>Step +30 s</button><button onClick={reset}>Reset</button><button onClick={exportCsv}>Export CSV ↓</button></div><p>Peak junction: {Math.max(...samples.map(s => s.junction)).toFixed(1)} °C · Throttled samples: {samples.filter(s => s.throttle).length} s · Recovery below {parameters.limit - parameters.hysteresis} °C</p><div className="thermal-procedure"><strong>Try this experiment</strong><p>Run Gaming for 600 s. Export the run, then lower case-to-air resistance and repeat. Compare peak junction temperature and time spent throttling.</p></div></section></div>
    <details className="thermal-notes"><summary>03 / Model, units & assumptions</summary><p>Two-node lumped RC model: Cj·dTj/dt = P − (Tj−Tc)/Rjc; Cc·dTc/dt = (Tj−Tc)/Rjc − (Tc−Ta)/Rca. Explicit integration uses substeps ≤0.1 s; samples are recorded every simulated second.</p><p>Rjc = {parameters.junctionResistance} K/W. Idle power = 0.4 W; full-load CPU/GPU/NPU = 5/6/3 W. Dynamic power scales with frequency³ as an assumed DVFS approximation. Throttling selects 55% frequency, with {parameters.hysteresis} °C hysteresis. Bursts use 5% load between peaks. Other domains, radiation, spatial hotspots, battery and temperature-dependent leakage are omitted.</p><p>All coefficients are stated teaching assumptions, without handset calibration. Enclosure temperature is a lumped thermal node. This experiment predicts trends rather than a specific product’s temperature or governor.</p></details>
  </div>;
}
