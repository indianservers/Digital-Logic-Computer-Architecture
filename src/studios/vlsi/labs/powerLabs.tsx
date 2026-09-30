import { useMemo, useState } from "react";
import {
  educationalIrDrop,
  electromigration,
  monteCarlo,
  pvtSample,
  signalIntegrity,
  type Corner,
} from "../reliabilityModel";
import { VlsiGrid } from "../shell";
import { Badge, Choice, Measure, Observe, Slider, Wave } from "../widgets";

function heat(voltage: number, vdd: number): string {
  const t = Math.max(0, Math.min(1, voltage / Math.max(0.2, vdd)));
  const red = Math.round(180 * (1 - t) + 20);
  const green = Math.round(70 + 150 * t);
  return `rgb(${red},${green},110)`;
}

export function IrDropLab() {
  const [vdd, setVdd] = useState(1);
  const [width, setWidth] = useState(2);
  const [pitch, setPitch] = useState(12);
  const [sheet, setSheet] = useState(0.08);
  const [current, setCurrent] = useState(40);
  const [straps, setStraps] = useState(4);
  const live = educationalIrDrop({ vdd, strapWidth: width, pitch, sheet, currentMa: current, straps });
  const before = educationalIrDrop({ vdd, strapWidth: 1, pitch: 24, sheet, currentMa: current, straps: 2 });
  const draw = (grid: typeof live, label: string) => (
    <svg className="vlsi-heat" viewBox="0 0 180 130" role="img" aria-label={label}>
      {grid.nodes.map((node) => (
        <rect key={`${label}-${node.x}-${node.y}`} x={12 + node.x * 26} y={18 + node.y * 24} width="22" height="18" rx="3" fill={heat(node.voltage, vdd)} />
      ))}
      {Array.from({ length: Math.min(straps, 6) }, (_, index) => (
        <rect key={`strap-${label}-${index}`} x={20 + index * 24} y="10" width={Math.max(2, width)} height="108" fill="#94a3b8" opacity="0.45" />
      ))}
      <circle cx={18 + grid.hotspot.x * 26} cy={27 + grid.hotspot.y * 24} r="4" fill="#f43f5e" />
    </svg>
  );
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Supply voltage" value={vdd} min={0.7} max={1.2} step={0.05} text={`${vdd.toFixed(2)} V`} onChange={setVdd} />
          <Slider label="Strap width" value={width} min={0.5} max={6} step={0.5} text={`${width.toFixed(1)} µm`} onChange={setWidth} />
          <Slider label="Strap pitch" value={pitch} min={6} max={28} step={2} text={`${pitch.toFixed(0)} µm`} onChange={setPitch} />
          <Slider label="Sheet resistance" value={sheet} min={0.02} max={0.2} step={0.02} text={`${sheet.toFixed(2)} Ω/sq`} onChange={setSheet} />
          <Slider label="Load current" value={current} min={5} max={120} step={5} text={`${current.toFixed(0)} mA`} onChange={setCurrent} />
          <Slider label="Strap count" value={straps} min={1} max={8} step={1} text={`${straps}`} onChange={setStraps} />
        </>
      }
      stage={
        <div className="vlsi-split">
          <section>{draw(before, "Baseline grid with narrow straps")}<p>Baseline</p></section>
          <section>{draw(live, "Educational IR-drop voltage heatmap")}<p>Current grid</p></section>
        </div>
      }
      readouts={
        <>
          <Measure label="Nominal VDD" value={`${vdd.toFixed(2)} V`} />
          <Measure label="Worst local VDD" value={`${(vdd - live.worst).toFixed(3)} V`} />
          <Measure label="Worst drop" value={`${(live.worst * 1000).toFixed(1)} mV`} />
          <Measure label="Average drop" value={`${(live.average * 1000).toFixed(1)} mV`} />
          <Measure label="Hotspot" value={`${live.hotspot.x}, ${live.hotspot.y}`} />
          <Badge tone={live.worst < before.worst ? "on" : "warn"}>{live.worst < before.worst ? "Better than baseline" : "Worse than baseline"}</Badge>
          <Observe change="Raise load current, then widen the straps or add more of them." see="Worst drop and the hotspot color move together." why="Each strap shares the current, and a wider strap has lower resistance." experiment="Compare the baseline grid with the live grid after doubling strap width." takeaway="This is an educational resistive grid, not a signoff IR solver." />
        </>
      }
    />
  );
}

export function ElectromigrationLab() {
  const [current, setCurrent] = useState(0.5);
  const [width, setWidth] = useState(1.6);
  const [thickness, setThickness] = useState(0.4);
  const [temp, setTemp] = useState(45);
  const [metal, setMetal] = useState<"copper" | "aluminum">("copper");
  const wire = electromigration({ currentMa: current, widthUm: width, thicknessUm: thickness, celsius: temp, metal });
  const via = electromigration({ currentMa: current, widthUm: width * 0.45, thicknessUm: thickness, celsius: temp, metal });
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Current" value={current} min={0.2} max={8} step={0.2} text={`${current.toFixed(1)} mA`} onChange={setCurrent} />
          <Slider label="Wire width" value={width} min={0.2} max={3} step={0.1} text={`${width.toFixed(1)} µm`} onChange={setWidth} />
          <Slider label="Wire thickness" value={thickness} min={0.1} max={0.8} step={0.05} text={`${thickness.toFixed(2)} µm`} onChange={setThickness} />
          <Slider label="Temperature" value={temp} min={25} max={125} step={5} text={`${temp.toFixed(0)} °C`} onChange={setTemp} />
          <Choice label="Metal" value={metal} options={[{ id: "copper", label: "Copper" }, { id: "aluminum", label: "Aluminum" }]} onChange={setMetal} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 160" role="img" aria-label="Metal segment with electron wind">
          <rect x="30" y="68" width="220" height={Math.max(8, width * 28)} fill={wire.state === "high" ? "#fb7185" : wire.state === "warning" ? "#fbbf24" : "#34d399"} />
          <polygon points="250,78 280,88 250,98" fill="#e2e8f0" />
          <text x="40" y="40" fill="#e2e8f0">Electron wind</text>
          <text x="40" y="140" fill="#94a3b8">Via J {via.density.toFixed(1)} mA/µm²</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Current density" value={`${wire.density.toFixed(2)} mA/µm²`} />
          <Measure label="Relative risk" value={wire.risk.toFixed(2)} />
          <Measure label="Lifetime trend" value={wire.lifetime.toFixed(2)} hint="Simplified Black’s equation" />
          <Badge tone={wire.state === "safe" ? "on" : wire.state === "warning" ? "warn" : "bad"}>{wire.state}</Badge>
          <Observe change="Narrow the wire or raise the current and temperature." see="Current density and the risk state climb." why="J = I / area, and the simplified Black trend falls as temperature rises." experiment="Switch copper to aluminum at the same current." takeaway="The lifetime number is an educational trend, not a foundry qualification." />
        </>
      }
    />
  );
}

export function SignalIntegrityLab() {
  const [driver, setDriver] = useState<"weak" | "strong">("strong");
  const [impedance, setZ] = useState(50);
  const [load, setLoad] = useState(20);
  const [coupling, setCc] = useState(1);
  const [edge, setEdge] = useState(40);
  const [termination, setTerm] = useState<"none" | "series">("none");
  const wave = signalIntegrity({ driver, impedance, loadFf: load, couplingFf: coupling, edgePs: edge, termination });
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Driver" value={driver} options={[{ id: "weak", label: "Weak" }, { id: "strong", label: "Strong" }]} onChange={setDriver} />
          <Slider label="Wire impedance" value={impedance} min={25} max={90} step={5} text={`${impedance.toFixed(0)} Ω`} onChange={setZ} />
          <Slider label="Load capacitance" value={load} min={2} max={80} step={2} text={`${load.toFixed(0)} fF`} onChange={setLoad} />
          <Slider label="Coupling" value={coupling} min={0.2} max={4} step={0.2} text={`${coupling.toFixed(1)} fF`} onChange={setCc} />
          <Slider label="Edge rate" value={edge} min={10} max={120} step={5} text={`${edge.toFixed(0)} ps`} onChange={setEdge} />
          <Choice label="Termination" value={termination} options={[{ id: "none", label: "Unterminated" }, { id: "series", label: "Series" }]} onChange={setTerm} />
        </>
      }
      stage={<Wave traces={[
        { name: "Ideal", color: "#94a3b8", values: wave.ideal, min: -0.2, max: 1.4 },
        { name: "Actual", color: "#22d3ee", values: wave.actual, min: -0.2, max: 1.4 },
        { name: "Victim", color: "#fb7185", values: wave.victim, min: 0, max: 1 },
      ]} />}
      readouts={
        <>
          <Measure label="Overshoot" value={`${(wave.overshoot * 1000).toFixed(0)} mV`} />
          <Measure label="Noise margin left" value={`${(wave.noiseMargin * 1000).toFixed(0)} mV`} />
          <Badge tone={wave.overshoot > 0.12 ? "warn" : "on"}>{termination === "none" ? "Ringing visible" : "Series termination damps the edge"}</Badge>
          <Observe change="Leave the line unterminated, then switch to series termination." see="Overshoot and the victim bump shrink." why="The waveform uses the existing crosstalk capacitance plus a bounded ringing term." experiment="Compare a strong driver with a weak one at 70 Ω." takeaway="This is a lumped educational model, not a transmission-line signoff." />
        </>
      }
    />
  );
}

const CORNERS: Corner[] = ["SS", "TT", "FF", "SF", "FS"];

export function PvtLab() {
  const [corner, setCorner] = useState<Corner>("TT");
  const [vdd, setVdd] = useState(1);
  const [temp, setTemp] = useState(27);
  const [load, setLoad] = useState(12);
  const rows = useMemo(() => CORNERS.map((item) => ({ item, sample: pvtSample(item, item === "SS" ? 0.8 : item === "FF" ? 1.1 : vdd, item === "SS" ? 125 : item === "FF" ? 0 : temp, load) })), [vdd, temp, load]);
  const selected = pvtSample(corner, vdd, temp, load);
  const maxDelay = Math.max(...rows.map((row) => row.sample.delay));
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Corner" value={corner} options={CORNERS.map((item) => ({ id: item, label: item }))} onChange={setCorner} />
          <Slider label="VDD" value={vdd} min={0.7} max={1.2} step={0.05} text={`${vdd.toFixed(2)} V`} onChange={setVdd} />
          <Slider label="Temperature" value={temp} min={0} max={125} step={5} text={`${temp.toFixed(0)} °C`} onChange={setTemp} />
          <Slider label="Load" value={load} min={2} max={40} step={1} text={`${load.toFixed(0)} fF`} onChange={setLoad} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 180" role="img" aria-label="Delay by PVT corner">
          {rows.map((row, index) => (
            <rect key={row.item} x="40" y={16 + index * 32} width={Math.max(8, (row.sample.delay / maxDelay) * 240)} height="18" fill={row.item === corner ? "#22d3ee" : "#334155"} />
          ))}
          {rows.map((row, index) => <text key={`${row.item}-label`} x="8" y={30 + index * 32} fill="#e2e8f0">{row.item}</text>)}
        </svg>
      }
      readouts={
        <>
          <Measure label="Delay" value={selected.delay} unit="s" />
          <Measure label="Leakage" value={selected.leakage} unit="A" />
          <Measure label="Dynamic power" value={selected.dynamic} unit="W" />
          <Measure label="Noise margin" value={`${(selected.noiseMargin * 1000).toFixed(0)} mV`} />
          <Measure label="Drive scale" value={selected.drive.toFixed(2)} />
          <Observe change="Select SS, then TT, then FF." see="The delay bar grows on SS and shrinks on FF." why="SS raises threshold and weakens drive. FF does the opposite, and the chart also uses a low-VDD hot SS and a high-VDD cold FF." experiment="Raise temperature on TT and watch leakage." takeaway="The same inverter is slower at the slow corner in this educational model." />
        </>
      }
    />
  );
}

export function VariationLab() {
  const [samples, setSamples] = useState(48);
  const [sigma, setSigma] = useState(0.08);
  const [seed, setSeed] = useState(7);
  const [target, setTarget] = useState(40);
  const run = monteCarlo({ samples, sigma, seed, targetPs: target });
  const bins = Array.from({ length: 8 }, () => 0);
  const span = Math.max(1e-6, run.max - run.min);
  for (const delay of run.delays) {
    const index = Math.min(7, Math.floor(((delay - run.min) / span) * 8));
    bins[index] = (bins[index] ?? 0) + 1;
  }
  const peak = Math.max(1, ...bins);
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Samples" value={samples} min={16} max={120} step={8} text={`${samples}`} onChange={setSamples} />
          <Slider label="Sigma" value={sigma} min={0.02} max={0.4} step={0.02} text={sigma.toFixed(2)} onChange={setSigma} />
          <Slider label="Seed" value={seed} min={1} max={99} step={1} text={`${seed}`} onChange={setSeed} />
          <Slider label="Delay spec" value={target} min={10} max={80} step={1} text={`${target.toFixed(0)} ps`} onChange={setTarget} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 180" role="img" aria-label="Seeded delay histogram">
          {bins.map((count, index) => (
            <rect key={index} x={24 + index * 36} y={150 - (count / peak) * 120} width="24" height={(count / peak) * 120} fill="#22d3ee" />
          ))}
        </svg>
      }
      readouts={
        <>
          <Measure label="Mean" value={`${run.mean.toFixed(1)} ps`} />
          <Measure label="Sigma" value={`${run.sigma.toFixed(2)} ps`} />
          <Measure label="Min" value={`${run.min.toFixed(1)} ps`} />
          <Measure label="Max" value={`${run.max.toFixed(1)} ps`} />
          <Measure label="Yield" value={`${(run.yield * 100).toFixed(0)} %`} hint="Delay under the spec" />
          <Observe change="Increase sigma, then return the seed to the same number." see="The histogram widens, and the same seed rebuilds the same mean." why="Samples are drawn from a seeded generator and scaled around the typical-corner delay." experiment="Tighten the delay spec and watch yield fall." takeaway="Reruns stay reproducible because the seed is an input, not a hidden random call." />
        </>
      }
    />
  );
}
