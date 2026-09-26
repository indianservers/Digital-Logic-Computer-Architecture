import { useMemo, useState } from "react";
import { CPI_PRESETS, CPI_RATES, analyzeCpi, applyWhatIf, cyclesFromRates, speedup, type StallRates, type WhatIf } from "../../../engines/aca/cpi";
import { LabChrome, Transport, usePlayback } from "./HazardLab";
import { CpiStack } from "../animation/phase3Views";
import { useGuideFocus } from "../guide/focus";

const LABELS: Record<string, string> = {
  useful: "Useful",
  frontend: "Front-end",
  branch: "Branch",
  execution: "Execution",
  cache: "Cache",
  memory: "Memory",
};

const COLORS: Record<string, string> = {
  useful: "#86efac",
  frontend: "#93c5fd",
  branch: "#fde68a",
  execution: "#c4b5fd",
  cache: "#fdba74",
  memory: "#fca5a5",
};

function num(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "unbounded";
  return value.toFixed(digits);
}

export function CpiLab() {
  const [rates, setRates] = useState<StallRates>(CPI_RATES);
  const [preset, setPreset] = useState("balanced");
  const [memoryCut, setMemoryCut] = useState(0);
  const [branchCut, setBranchCut] = useState(0);
  const play = usePlayback(10);
  const sweep = play.playing ? play.cycle * 10 : memoryCut;
  const factors: WhatIf = { frontend: 1, branch: 1 - branchCut / 100, execution: 1, cache: 1, memory: 1 - sweep / 100 };
  const baseCycles = useMemo(() => cyclesFromRates(rates), [rates]);
  const before = useMemo(() => analyzeCpi(baseCycles, rates.instructions), [baseCycles, rates.instructions]);
  const after = useMemo(() => analyzeCpi(applyWhatIf(baseCycles, factors), rates.instructions), [baseCycles, factors, rates.instructions]);
  const curve = useMemo(() => Array.from({ length: 11 }, (_, step) => {
    const cut = step * 10;
    return analyzeCpi(applyWhatIf(baseCycles, { ...factors, memory: 1 - cut / 100 }), rates.instructions).ipc;
  }), [baseCycles, factors, rates.instructions]);
  const peak = Math.max(...curve, 0.01);
  const stack = (["useful", "frontend", "branch", "execution", "cache", "memory"] as const).map((id) => ({ id, cycles: after.cycles[id] }));
  const largest = LABELS[after.largest] ?? after.largest;
  const { id: guideFocus, setId: setGuideFocus } = useGuideFocus();
  const hint = `${largest} is the largest stall bucket. IPC is ${num(after.ipc, 3)}.`;
  const reading = `CPI ${num(after.cpi, 3)}. IPC ${num(after.ipc, 3)}. Largest stall: ${largest}.`;
  const patch = (next: Partial<StallRates>) => { setRates((current) => ({ ...current, ...next })); setPreset("custom"); };
  return (
    <LabChrome lab="cpi-ipc" kicker="Labs > Lab 30" title="Lab 30 — CPI / IPC Bottleneck Analyzer" subtitle="See how exclusive stall buckets change cycles per instruction and instructions per cycle." badge="RISC-V (5-Stage Pipeline)" hint={hint} reading={reading}>
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>CPI is cycles divided by retired instructions. IPC is the reciprocal for the same interval. A superscalar machine can retire more than one instruction per cycle, so CPI can be below 1. These buckets do not overlap.</p></article>
        <article><h2>Experiment Status</h2><p>{largest} stalls are the largest measured stall component in this workload. That names the biggest bucket, not a deeper hardware cause.</p></article>
        <article><h2>What-if</h2><p>Cutting a bucket changes only that bucket. Speedup is the original cycle count divided by the new one. The cuts are not added together as percentages.</p>
          <CpiStack parts={stack} highlight={after.largest} cpi={after.cpi} ipc={after.ipc} speed={play.speed} cycle={play.cycle} />
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Workload</h2>
          <label>Example
            <select aria-label="CPI example" value={preset} onChange={(event) => {
              const next = CPI_PRESETS.find((item) => item.id === event.target.value);
              setPreset(event.target.value);
              if (next) setRates((current) => ({ ...CPI_RATES, ...next.rates, instructions: current.instructions }));
            }}>
              {CPI_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              <option value="custom">Current settings</option>
            </select>
          </label>
          <label>Instructions retired
            <input aria-label="Instructions retired" type="number" min={1} value={rates.instructions} onChange={(event) => patch({ instructions: Math.max(1, Number(event.target.value) || 1) })} />
          </label>
          <label>Base CPI
            <input aria-label="Base CPI" type="number" min={0.1} step={0.1} value={rates.baseCpi} onChange={(event) => patch({ baseCpi: Math.max(0.1, Number(event.target.value) || 0.1) })} />
          </label>
          <label>Front-end stall cycles per instruction
            <input aria-label="Front-end stalls" type="range" min={0} max={1} step={0.01} value={rates.frontendPerInst} onChange={(event) => patch({ frontendPerInst: Number(event.target.value) })} />
          </label>
          <label>Branch frequency
            <input aria-label="Branch frequency" type="range" min={0} max={0.4} step={0.01} value={rates.branchFrequency} onChange={(event) => patch({ branchFrequency: Number(event.target.value) })} />
          </label>
          <label>Misprediction rate
            <input aria-label="Misprediction rate" type="range" min={0} max={0.5} step={0.01} value={rates.mispredictRate} onChange={(event) => patch({ mispredictRate: Number(event.target.value) })} />
          </label>
          <label>Penalty per misprediction
            <input aria-label="Branch penalty" type="number" min={0} value={rates.branchPenalty} onChange={(event) => patch({ branchPenalty: Math.max(0, Number(event.target.value) || 0) })} />
          </label>
          <label>L1 miss rate
            <input aria-label="L1 miss rate" type="range" min={0} max={0.3} step={0.01} value={rates.l1MissRate} onChange={(event) => patch({ l1MissRate: Number(event.target.value) })} />
          </label>
          <label>Memory accesses per instruction
            <input aria-label="Memory ratio" type="range" min={0} max={0.2} step={0.005} value={rates.memoryRatio} onChange={(event) => patch({ memoryRatio: Number(event.target.value) })} />
          </label>
          <p className="tiny">Branch stall cycles = instructions × branch frequency × misprediction rate × penalty. Cache stall cycles = instructions × L1 miss rate × L1 penalty. An L1 hit is not also charged as memory.</p>
        </article>
        <article>
          <h2 className={guideFocus === "stack" ? "aca-guide-on" : undefined}>CPI stack</h2>
          <div className="vl-bytes" style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden" }}>
            {stack.map((part) => <i key={part.id} style={{ display: "block", width: `${(part.cycles / after.totalCycles) * 100}%`, background: COLORS[part.id] }} title={LABELS[part.id]} />)}
          </div>
          <ul>
            {stack.map((part) => <li key={part.id}>{LABELS[part.id]}: {num(part.cycles / rates.instructions, 3)} CPI · {num(part.cycles, 0)} cycles</li>)}
          </ul>
          <h2>IPC while memory stalls shrink</h2>
          <svg viewBox="0 0 320 140" role="img" aria-label="IPC sensitivity">
            <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={curve.map((ipc, index) => `${20 + index * 28},${120 - (ipc / peak) * 100}`).join(" ")} />
          </svg>
          <p className="tiny">Each step removes another 10% of the memory-stall bucket. Once another bucket is larger, further memory cuts move IPC less.</p>
        </article>
        <article>
          <h2>Optimization</h2>
          <label>Memory stall reduction
            <input aria-label="Memory stall reduction" type="range" min={0} max={100} value={sweep} onChange={(event) => { setMemoryCut(Number(event.target.value)); play.setPlaying(false); }} />
            <span>{sweep}%</span>
          </label>
          <label>Branch stall reduction
            <input aria-label="Branch stall reduction" type="range" min={0} max={100} value={branchCut} onChange={(event) => setBranchCut(Number(event.target.value))} />
            <span>{branchCut}%</span>
          </label>
          <div className={guideFocus === "ipc" ? "vl-metrics aca-guide-on" : "vl-metrics"}>
            <div><strong>{num(before.ipc, 3)}</strong><span>IPC before</span></div>
            <div><strong>{num(after.ipc, 3)}</strong><span>IPC after</span></div>
            <div><strong>{num(before.cpi, 3)}</strong><span>CPI before</span></div>
            <div><strong>{num(after.cpi, 3)}</strong><span>CPI after</span></div>
            <div><strong>{num(speedup(before.totalCycles, after.totalCycles))}×</strong><span>Speedup</span></div>
            <div><strong>{largest}</strong><span>Largest stall</span></div>
          </div>
        </article>
      </div>
      <div className="vl-metrics">
        <div><strong>{rates.instructions.toLocaleString()}</strong><span>Instructions retired</span></div>
        <div><strong>{num(after.totalCycles, 0)}</strong><span>Cycles</span></div>
        <div><strong>{num(after.cpi, 3)}</strong><span>CPI</span></div>
        <div><strong>{num(after.ipc, 3)}</strong><span>IPC</span></div>
        <div><strong>{num(after.cycles.frontend, 0)}</strong><span>Front-end stall cycles</span></div>
        <div><strong>{num(after.cycles.branch, 0)}</strong><span>Branch stall cycles</span></div>
        <div><strong>{num(after.cycles.execution, 0)}</strong><span>Execution stall cycles</span></div>
        <div><strong>{num(after.cycles.cache, 0)}</strong><span>Cache stall cycles</span></div>
        <div><strong>{num(after.cycles.memory, 0)}</strong><span>Memory stall cycles</span></div>
      </div>
      <Transport playing={play.playing} onPlay={() => play.setPlaying((value) => !value)} onStep={() => play.setCycle((value) => Math.min(10, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={() => { setGuideFocus(""); play.reset(); setMemoryCut(0); setBranchCut(0); }} speed={play.speed} onSpeed={play.setSpeed} />
    </LabChrome>
  );
}
