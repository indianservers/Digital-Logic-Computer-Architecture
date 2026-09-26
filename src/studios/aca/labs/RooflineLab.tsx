import { useMemo, useState } from "react";
import { MACHINE_DEFAULTS, ROOF_PRESETS, analyzeWorkload, applyOptimizations, ridgePoint, type Machine, type Workload } from "../../../engines/aca/roofline";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";
import { RoofPoint } from "../animation/phase3Views";
import { useGuideFocus } from "../guide/focus";

function num(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "unbounded";
  if (Math.abs(value) >= 1e6 || (Math.abs(value) > 0 && Math.abs(value) < 0.01)) return value.toExponential(2);
  return value.toFixed(digits);
}

const X0 = 40;
const Y0 = 12;
const W = 280;
const H = 150;

function xOf(ai: number) {
  const value = Math.log10(Math.min(1000, Math.max(0.01, ai)));
  return X0 + ((value + 2) / 5) * W;
}

function yOf(perf: number) {
  const value = Math.log10(Math.min(10000, Math.max(0.1, perf)));
  return Y0 + H - ((value + 1) / 5) * H;
}

export function RooflineLab() {
  const [machine, setMachine] = useState<Machine>(MACHINE_DEFAULTS);
  const [preset, setPreset] = useState("gemm");
  const [flops, setFlops] = useState(2.15e9);
  const [bytes, setBytes] = useState(1.075e9);
  const [observedText, setObservedText] = useState("");
  const [blocking, setBlocking] = useState(false);
  const [locality, setLocality] = useState(false);
  const play = usePlayback(ROOF_PRESETS.length - 1);
  const selected = ROOF_PRESETS[play.cycle] ?? ROOF_PRESETS[0];
  const base = useMemo<Workload>(() => {
    const chosen = ROOF_PRESETS.find((item) => item.id === preset) ?? ROOF_PRESETS[0]!;
    const source = play.playing || play.cycle > 0 ? (selected ?? chosen) : chosen;
    return { id: source.id, name: source.name, flops: source.id === "custom" || preset === source.id ? flops : source.flops, bytes: source.id === "custom" || preset === source.id ? bytes : source.bytes, observed: observedText === "" ? null : Number(observedText) };
  }, [preset, flops, bytes, observedText, play.playing, play.cycle, selected]);
  const tuned = useMemo(() => applyOptimizations(base, { blocking, locality }), [base, blocking, locality]);
  const result = useMemo(() => analyzeWorkload(tuned, machine), [tuned, machine]);
  const ridge = ridgePoint(machine);
  const { id: guideFocus, setId: setGuideFocus } = useGuideFocus();
  const library = ROOF_PRESETS.filter((item) => item.id !== "custom").map((item) => analyzeWorkload(item, machine));
  const roofLine = [0.01, ridge, 1000].filter((ai) => Number.isFinite(ai) && ai > 0);
  const load = (id: string) => {
    const next = ROOF_PRESETS.find((item) => item.id === id);
    setPreset(id);
    if (next && next.id !== "custom") {
      setFlops(next.flops);
      setBytes(next.bytes);
      setObservedText("");
      setBlocking(false);
      setLocality(false);
    }
    play.reset();
  };
  const hint = result.bound === "memory"
    ? "The workload is memory-bound. Raising peak compute does not move it onto the flat roof."
    : result.bound === "compute"
      ? "The workload is past the ridge. The compute roof is the limit."
      : "Read arithmetic intensity against the ridge point.";
  const reading = `${tuned.name}: ${result.bound}. Intensity ${num(result.ai)}. Ridge ${num(ridge)}.`;
  return (
    <LabChrome lab="roofline" kicker="Labs > Lab 29" title="Lab 29 — Roofline Analysis" subtitle="Decide whether a workload is limited by compute throughput or by memory bandwidth." badge="RISC-V (5-Stage Pipeline)" hint={hint} reading={reading}>
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Attainable performance is the minimum of peak compute and arithmetic intensity times bandwidth. With decimal SI units, 1 FLOP/byte times 1 GB/s is 1 GFLOP/s.</p></article>
        <article><h2>Experiment Status</h2><p>{tuned.name} is {result.bound === "memory" ? "memory-bound" : result.bound === "compute" ? "compute-bound" : result.bound === "transition" ? "near the ridge" : "idle"} under these roofs.</p></article>
        <article className={guideFocus === "ridge" ? "aca-guide-on" : undefined}><h2>Ridge</h2><p>The roofs meet at {num(ridge)} FLOP/byte. Raising bandwidth moves that point left. Raising peak compute moves it right and lifts the horizontal roof.</p>
          <RoofPoint bound={result.bound} intensity={result.ai} attained={result.attained} speed={play.speed} cycle={play.cycle} />
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Machine and workload</h2>
          <label>Example
            <select aria-label="Roofline example" value={preset} onChange={(event) => load(event.target.value)}>
              {ROOF_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Peak compute (GFLOP/s)
            <input aria-label="Peak compute" type="number" min={1} value={machine.peak} onChange={(event) => setMachine({ ...machine, peak: Math.max(1, Number(event.target.value) || 1) })} />
          </label>
          <label>Memory bandwidth (GB/s)
            <input aria-label="Memory bandwidth" type="number" min={0.1} step={0.1} value={machine.bandwidth} onChange={(event) => setMachine({ ...machine, bandwidth: Math.max(0.1, Number(event.target.value) || 0.1) })} />
          </label>
          <label>Operations (FLOP)
            <input aria-label="Operations" type="number" min={0} value={flops} onChange={(event) => { setFlops(Math.max(0, Number(event.target.value) || 0)); setPreset("custom"); }} />
          </label>
          <label>Bytes transferred
            <input aria-label="Bytes transferred" type="number" min={0} value={bytes} onChange={(event) => { setBytes(Math.max(0, Number(event.target.value) || 0)); setPreset("custom"); }} />
          </label>
          <label>Observed performance (GFLOP/s)
            <input aria-label="Observed performance" type="number" min={0} placeholder="optional" value={observedText} onChange={(event) => setObservedText(event.target.value)} />
          </label>
          <Toggle on={blocking} label="Cache blocking (half the bytes)" onChange={setBlocking} />
          <Toggle on={locality} label="Extra reuse (20% fewer bytes)" onChange={setLocality} />
        </article>
        <article>
          <h2 className={guideFocus === "chart" ? "aca-guide-on" : undefined}>Roofline</h2>
          <svg viewBox="0 0 340 190" role="img" aria-label="Roofline chart">
            <line x1={X0} y1={Y0} x2={X0} y2={Y0 + H} stroke="#cbd5e1" />
            <line x1={X0} y1={Y0 + H} x2={X0 + W} y2={Y0 + H} stroke="#cbd5e1" />
            <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={roofLine.map((ai) => {
              const perf = Math.min(machine.peak, ai * machine.bandwidth);
              return `${xOf(ai)},${yOf(perf)}`;
            }).join(" ")} />
            <line x1={xOf(ridge)} y1={yOf(machine.peak)} x2={xOf(ridge)} y2={Y0 + H} stroke="#f59e0b" strokeDasharray="3 3" />
            {library.map((item, index) => <circle key={ROOF_PRESETS[index]?.id ?? index} cx={xOf(item.ai)} cy={yOf(item.roof)} r="3" fill="#94a3b8" />)}
            <circle cx={xOf(result.ai)} cy={yOf(result.attained)} r="5" fill="#dc2626" />
            <text x="150" y="184" textAnchor="middle" fontSize="10">Arithmetic intensity (FLOP/byte), log</text>
          </svg>
          <p className="tiny">Grey dots are the example workloads at their ceilings. The red dot is the workload being edited. Axes are logarithmic.</p>
          {result.inconsistent ? <p>Inconsistent with current roof assumptions. The entered observation is above the configured roof.</p> : null}
        </article>
        <article>
          <h2>Library</h2>
          <table>
            <thead><tr><th>Workload</th><th>AI</th><th>Ceiling</th><th>Bound</th></tr></thead>
            <tbody>
              {ROOF_PRESETS.filter((item) => item.id !== "custom").map((item) => {
                const row = analyzeWorkload(item, machine);
                return (
                  <tr key={item.id} className={item.id === tuned.id ? "on" : ""} onClick={() => load(item.id)}>
                    <td>{item.name}</td>
                    <td>{num(row.ai)}</td>
                    <td>{num(row.roof, 1)}</td>
                    <td>{row.bound}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>
      </div>
      <div className="vl-metrics">
        <div><strong>{num(result.ai)}</strong><span>Arithmetic intensity (FLOP/byte)</span></div>
        <div><strong>{num(machine.peak, 1)}</strong><span>Peak compute (GFLOP/s)</span></div>
        <div><strong>{num(machine.bandwidth, 1)}</strong><span>Bandwidth (GB/s)</span></div>
        <div><strong>{num(ridge)}</strong><span>Ridge point (FLOP/byte)</span></div>
        <div><strong>{num(result.roof, 1)}</strong><span>Theoretical ceiling (GFLOP/s)</span></div>
        <div><strong>{result.observed === null ? "—" : num(result.observed, 1)}</strong><span>Observed (GFLOP/s)</span></div>
        <div><strong>{result.observed === null ? "—" : `${num(result.efficiency * 100, 1)}%`}</strong><span>Roof efficiency</span></div>
        <div><strong>{result.observed === null ? "—" : num(result.headroom, 1)}</strong><span>Headroom (GFLOP/s)</span></div>
        <div><strong>{result.bound}</strong><span>Bound type</span></div>
      </div>
      <Transport playing={play.playing} onPlay={() => play.setPlaying((value) => !value)} onStep={() => play.setCycle((value) => Math.min(ROOF_PRESETS.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={() => { setGuideFocus(""); play.reset(); load("gemm"); }} speed={play.speed} onSpeed={play.setSpeed} />
    </LabChrome>
  );
}
