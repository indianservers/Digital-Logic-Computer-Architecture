import { useMemo, useState } from "react";
import { engineering } from "../engine";
import { VlsiGrid } from "../shell";
import { Badge, Chart, Choice, Measure, Observe, Slider, Wave } from "../widgets";
import { crosstalk, delayVersusStages, fanoutLoad, logicalEffort, sizingDelay, wireElmore } from "../timingModel";

export function LogicalEffortLab() {
  const [load, setLoad] = useState(8);
  const [stages, setStages] = useState(3);
  const [gate, setGate] = useState<"inv" | "nand2" | "nor2">("nand2");
  const [cin, setCin] = useState(1);
  const [branch, setBranch] = useState(1);
  const gates = ["inv", gate, "inv"].slice(0, stages);
  while (gates.length < stages) gates.push("inv");
  const effort = logicalEffort({ gates, cin, load, branch, stages });
  const curve = useMemo(() => delayVersusStages(effort.F, effort.parasitic), [effort.F, effort.parasitic]);
  const best = curve.reduce((winner, point) => (point.delay < winner.delay ? point : winner), curve[0]!);
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>Path effort</h2>
              <Badge tone="info">Optimum near {effort.optimum} stages</Badge>
            </div>
            <p className="vlsi-callout">{gates.join(" → ")} · F = GBH = {effort.F.toFixed(2)} · stage effort f = {effort.f.toFixed(2)}</p>
            <Chart
              ariaLabel="Estimated delay against stage count"
              xMin={1}
              xMax={8}
              yMax={Math.max(...curve.map((point) => point.delay)) * 1.1}
              xLabel="Stages"
              yLabel="Delay (τ)"
              series={[{ name: "D(N)", color: "#2dd4bf", points: curve.map((point) => ({ x: point.stages, y: point.delay })) }]}
              marker={{ x: best.stages, y: best.delay, label: `${best.stages} stages` }}
            />
          </div>
        }
        controls={
          <>
            <Slider label="Load capacitance" value={load} min={1} max={32} step={1} text={`${load.toFixed(0)} Cin units`} onChange={setLoad} />
            <Slider label="Stage count" value={stages} min={1} max={6} step={1} text={String(stages)} onChange={setStages} />
            <Choice label="Middle gate" value={gate} options={[{ id: "inv", label: "Inverter" }, { id: "nand2", label: "NAND2" }, { id: "nor2", label: "NOR2" }]} onChange={setGate} />
            <Slider label="Input capacitance" value={cin} min={0.5} max={4} step={0.5} text={cin.toFixed(1)} onChange={setCin} />
            <Slider label="Branching" value={branch} min={1} max={4} step={0.5} text={branch.toFixed(1)} onChange={setBranch} />
          </>
        }
        readouts={
          <>
            <Measure label="Logical effort g" value={effort.g.map((value) => value.toFixed(2)).join(" · ")} />
            <Measure label="Electrical effort h" value={effort.H.toFixed(2)} />
            <Measure label="Branching effort b" value={effort.B.toFixed(2)} />
            <Measure label="Path effort F" value={effort.F.toFixed(2)} />
            <Measure label="Stage effort f" value={effort.f.toFixed(2)} />
            <Measure label="Estimated delay" value={`${effort.delay.toFixed(2)} τ`} />
            <Measure label="Poor sizing" value={`${sizingDelay("poor", effort.F, stages, effort.parasitic).toFixed(2)} τ`} />
            <Measure label="Uniform sizing" value={`${sizingDelay("uniform", effort.F, stages, effort.parasitic).toFixed(2)} τ`} />
            <Measure label="Logical-effort sizing" value={`${sizingDelay("optimized", effort.F, stages, effort.parasitic).toFixed(2)} τ`} />
            <p>g is 1, 4/3, and 5/3 for INV, NAND2, and NOR2. Delay is N·F^(1/N) plus parasitic delay.</p>
          </>
        }
        footer={
          <Observe
            change="Increase the load, then step the stage count across the marker."
            see="Path effort grows with electrical effort. Delay falls, then rises, near ln(F) stages."
            why="Each added stage costs a parasitic delay but reduces the effort per stage."
            experiment="Swap the middle gate from INV to NOR2 and watch g and F move."
            takeaway="Logical effort picks a stage effort. It does not replace the delay simulation of a real netlist."
          />
        }
      />
    </>
  );
}

export function FanoutLab() {
  const [loads, setLoads] = useState(4);
  const [cap, setCap] = useState(8);
  const [driver, setDriver] = useState(1);
  const [slew, setSlew] = useState(40);
  const [vdd, setVdd] = useState(1.2);
  const [style, setStyle] = useState<"direct" | "buffered">("direct");
  const result = fanoutLoad(loads, cap * 1e-15, driver, slew * 1e-12, vdd, style);
  const samples = Array.from({ length: 40 }, (_, index) => {
    const t = index / 39;
    const tau = result.tpHL * 4;
    return Math.exp(-t / Math.max(tau, 1e-15));
  });
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>{style === "direct" ? "Direct drive" : "Buffered tree"}</h2>
              <Badge tone="info">{loads} loads</Badge>
            </div>
            <svg className="vlsi-schematic" viewBox="0 0 360 160" role="img" aria-label="Driver and capacitive loads">
              <rect x="16" y="58" width="70" height="40" rx="8" className="vlsi-gate on" />
              <text x="51" y="82" textAnchor="middle" className="vlsi-svg-label">Driver</text>
              {Array.from({ length: loads }, (_, index) => {
                const y = 16 + index * (120 / Math.max(1, loads - 1));
                return <circle key={index} cx={240} cy={loads === 1 ? 78 : y} r="8" className="vlsi-on" />;
              })}
              <line x1="86" y1="78" x2="220" y2="78" className="vlsi-wire on" />
            </svg>
            <Wave traces={[{ name: "Vout", color: "#34d399", values: samples, min: 0, max: 1 }]} />
          </div>
        }
        controls={
          <>
            <Choice label="Drive style" value={style} options={[{ id: "direct", label: "Direct drive" }, { id: "buffered", label: "Buffered tree" }]} onChange={setStyle} />
            <Slider label="Number of loads" value={loads} min={1} max={12} step={1} text={String(loads)} onChange={setLoads} />
            <Slider label="Load per sink" value={cap} min={1} max={20} step={1} text={`${cap} fF`} onChange={setCap} />
            <Slider label="Driver size" value={driver} min={0.5} max={8} step={0.5} text={`${driver.toFixed(1)} µm`} onChange={setDriver} />
            <Slider label="Input slew" value={slew} min={5} max={120} step={5} text={`${slew} ps`} onChange={setSlew} />
            <Slider label="VDD" value={vdd} min={0.8} max={1.8} step={0.1} text={`${vdd.toFixed(1)} V`} onChange={setVdd} />
          </>
        }
        readouts={
          <>
            <Measure label="Equivalent CL" value={engineering(result.cl, "F")} />
            <Measure label="tpHL" value={engineering(result.tpHL, "s")} />
            <Measure label="tpLH" value={engineering(result.tpLH, "s")} />
            <Measure label="Rise" value={engineering(result.rise, "s")} />
            <Measure label="Fall" value={engineering(result.fall, "s")} />
            <Measure label="Direct delay" value={engineering(result.direct, "s")} />
            <Measure label="Buffered delay" value={engineering(result.buffered, "s")} />
          </>
        }
        footer={
          <Observe
            change="Add loads, then switch to the buffered tree."
            see="The falling edge stretches because CL grew. A wider second stage can pull that delay back down."
            why="Delay uses the same 0.69 Req CL model as the propagation-delay lab. Req falls when the driver is wider."
            experiment="Compare the direct and buffered readouts at 1 load and at 12 loads."
            takeaway="Fan-out is capacitance. Capacitance is delay, until the driver or a buffer is resized."
          />
        }
      />
    </>
  );
}

export function InterconnectLab() {
  const [length, setLength] = useState(80);
  const [width, setWidth] = useState(0.2);
  const [layer, setLayer] = useState<"m1" | "m2" | "m3">("m2");
  const [rPer, setRPer] = useState(0.08);
  const [cPer, setCPer] = useState(0.2);
  const [load, setLoad] = useState(5);
  const [driverR, setDriverR] = useState(200);
  const [segments, setSegments] = useState(1);
  const layerScale = layer === "m1" ? 1.4 : layer === "m3" ? 0.7 : 1;
  const widthScale = 0.2 / Math.max(0.05, width);
  const wire = wireElmore({
    lengthUm: length,
    rPerUm: rPer * layerScale * widthScale,
    cPerUm: (cPer * 1e-15) * (layer === "m3" ? 0.8 : 1) * (width / 0.2),
    loadF: load * 1e-15,
    driverR,
    segments,
  });
  const samples = Array.from({ length: 36 }, (_, index) => Math.exp(-(index / 35) / Math.max(wire.delay, 1e-18)));
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>{wire.lumped ? "Lumped RC" : `${segments}-segment Elmore`}</h2>
              <Badge tone="info">{layer.toUpperCase()}</Badge>
            </div>
            <svg className="vlsi-schematic" viewBox="0 0 360 120" role="img" aria-label="RC wire from driver to load">
              {Array.from({ length: Math.max(1, segments) }, (_, index) => {
                const x = 40 + index * (240 / Math.max(1, segments));
                return (
                  <g key={index}>
                    <rect x={x} y="28" width="28" height="14" className="vlsi-gate" />
                    <text x={x + 14} y="38" textAnchor="middle" className="vlsi-svg-label">R</text>
                    <line x1={x + 14} y1="42" x2={x + 14} y2="78" className="vlsi-wire" />
                    <line x1={x + 4} y1="78" x2={x + 24} y2="78" className="vlsi-wire on" />
                  </g>
                );
              })}
              <text x="20" y="24" className="vlsi-svg-label">Vin</text>
              <text x="320" y="24" className="vlsi-svg-label">Vout</text>
            </svg>
            <Wave traces={[
              { name: "Vin", color: "#fbbf24", values: Array.from({ length: 36 }, (_, index) => (index > 2 ? 1 : 0)), min: 0, max: 1 },
              { name: "Vout", color: "#38bdf8", values: samples.map((value) => 1 - value), min: 0, max: 1 },
            ]} />
            <p className="vlsi-callout">{wire.lumped ? "Lumped delay uses td ≈ 0.69 · (Rdriver + Rwire) · (Cwire + CL)." : "Segmented delay is the Elmore sum of each resistance times the capacitance downstream."}</p>
          </div>
        }
        controls={
          <>
            <Choice label="Metal layer" value={layer} options={[{ id: "m1", label: "Metal1" }, { id: "m2", label: "Metal2" }, { id: "m3", label: "Metal3" }]} onChange={setLayer} />
            <Slider label="Wire length" value={length} min={10} max={400} step={10} text={`${length} µm`} onChange={setLength} />
            <Slider label="Wire width" value={width} min={0.05} max={1} step={0.05} text={`${width.toFixed(2)} µm`} onChange={setWidth} />
            <Slider label="R per µm" value={rPer} min={0.02} max={0.4} step={0.02} text={`${rPer.toFixed(2)} Ω/µm`} onChange={setRPer} />
            <Slider label="C per µm" value={cPer} min={0.05} max={0.8} step={0.05} text={`${cPer.toFixed(2)} fF/µm`} onChange={setCPer} />
            <Slider label="Load capacitance" value={load} min={0} max={30} step={1} text={`${load} fF`} onChange={setLoad} />
            <Slider label="Driver resistance" value={driverR} min={50} max={800} step={10} text={`${driverR} Ω`} onChange={setDriverR} />
            <Slider label="Segments" value={segments} min={1} max={8} step={1} text={segments === 1 ? "Lumped" : String(segments)} onChange={setSegments} />
          </>
        }
        readouts={
          <>
            <Measure label="R total" value={engineering(wire.rTotal, "Ω")} />
            <Measure label="C total" value={engineering(wire.cTotal, "F")} />
            <Measure label="Delay" value={engineering(wire.delay, "s")} />
          </>
        }
        footer={
          <Observe
            change="Lengthen the wire, then raise the segment count above 1."
            see="R and C both grow with length, and the output edge slows."
            why="A longer wire stores more charge behind more resistance. Elmore delay counts that charge at every segment."
            experiment="Widen the wire. Resistance falls and capacitance rises, so the delay does not move in only one direction."
            takeaway="Interconnect delay is an RC product, not a gate delay with a different name."
          />
        }
      />
    </>
  );
}

export function CrosstalkLab() {
  const [spacing, setSpacing] = useState(0.2);
  const [length, setLength] = useState(40);
  const [edge, setEdge] = useState(20);
  const [victim, setVictim] = useState<0 | 1>(0);
  const [rising, setRising] = useState(true);
  const [same, setSame] = useState(false);
  const [mitigation, setMitigation] = useState<"none" | "shield" | "layer" | "buffer" | "slew">("none");
  const edgePs = mitigation === "slew" ? edge * 3 : edge;
  const result = crosstalk({
    spacingUm: mitigation === "shield" ? spacing * 1.8 : spacing,
    lengthUm: length,
    edgePs,
    vdd: 1.2,
    victim,
    rising,
    sameDirection: same,
    shield: mitigation === "shield",
    layerRelief: mitigation === "layer",
    buffered: mitigation === "buffer",
  });
  const aggressor = Array.from({ length: 36 }, (_, index) => {
    const start = 8;
    const width = Math.max(2, edgePs / 8);
    if (!rising) return index < start ? 1 : index < start + width ? 1 - (index - start) / width : 0;
    return index < start ? 0 : index < start + width ? (index - start) / width : 1;
  });
  const coupled = aggressor.map((value, index) => {
    const delta = (rising ? value : 1 - value) * (result.amplitude / 1.2) * (result.positive ? 1 : -1);
    const base = victim === 1 ? 1 : 0;
    return Math.max(0, Math.min(1.3, base + (index > 6 ? delta : 0)));
  });
  const quiet = Array.from({ length: 36 }, () => (victim === 1 ? 1 : 0));
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>{result.positive ? "Positive glitch" : "Negative glitch"}</h2>
              <Badge tone={result.amplitude > 0.15 ? "warn" : "on"}>{result.delayFactor >= 1 ? "Delay up" : "Delay down"}</Badge>
            </div>
            <svg className="vlsi-schematic" viewBox="0 0 360 90" role="img" aria-label="Aggressor and victim wires with coupling capacitance">
              <line x1="20" y1="28" x2="300" y2="28" className="vlsi-wire on" />
              <line x1="20" y1="62" x2="300" y2="62" className="vlsi-wire" />
              <text x="310" y="32" className="vlsi-svg-label">Aggressor</text>
              <text x="310" y="66" className="vlsi-svg-label">Victim</text>
              <text x="160" y="52" textAnchor="middle" className="vlsi-svg-label">Cc {engineering(result.cc, "F")}</text>
            </svg>
            <Wave traces={[
              { name: "Agg", color: "#fb7185", values: aggressor, min: 0, max: 1.2 },
              { name: "Quiet", color: "#94a3b8", values: quiet, min: 0, max: 1.2 },
              { name: "Victim", color: "#38bdf8", values: coupled, min: 0, max: 1.2 },
            ]} />
          </div>
        }
        controls={
          <>
            <Slider label="Wire spacing" value={spacing} min={0.08} max={1} step={0.02} text={`${spacing.toFixed(2)} µm`} onChange={setSpacing} />
            <Slider label="Parallel length" value={length} min={5} max={120} step={5} text={`${length} µm`} onChange={setLength} />
            <Slider label="Edge rate" value={edge} min={5} max={80} step={5} text={`${edge} ps`} onChange={setEdge} />
            <Choice label="Aggressor" value={rising ? "rise" : "fall"} options={[{ id: "rise", label: "Rising" }, { id: "fall", label: "Falling" }]} onChange={(value) => setRising(value === "rise")} />
            <Choice label="Victim initial" value={victim === 0 ? "0" : "1"} options={[{ id: "0", label: "Victim 0" }, { id: "1", label: "Victim 1" }]} onChange={(value) => setVictim(value === "1" ? 1 : 0)} />
            <Choice label="Switching" value={same ? "same" : "opposite"} options={[{ id: "opposite", label: "Opposite" }, { id: "same", label: "Same direction" }]} onChange={(value) => setSame(value === "same")} />
            <Choice label="Mitigation" value={mitigation} options={[
              { id: "none", label: "None" },
              { id: "shield", label: "Shield" },
              { id: "layer", label: "Change layer" },
              { id: "buffer", label: "Buffer" },
              { id: "slew", label: "Slow the edge" },
            ]} onChange={setMitigation} />
          </>
        }
        readouts={
          <>
            <Measure label="Coupling" value={engineering(result.cc, "F")} />
            <Measure label="Victim disturbance" value={engineering(result.amplitude, "V")} />
            <Measure label="Delay factor" value={result.delayFactor.toFixed(2)} hint={same ? "Same-direction switching" : "Opposite switching"} />
            <p>Closer spacing, a longer parallel run, a faster edge, and a larger Cc all increase the glitch. Shielding, a quieter layer, a buffer, and a slower slew each reduce the capacitance or the edge that the model uses.</p>
          </>
        }
        footer={
          <Observe
            change="Tighten the spacing, then turn on a shield."
            see="The victim trace jumps, then the jump shrinks when the shield cuts Cc."
            why="The glitch is the aggressor step shared across Cc and the victim’s capacitance to ground."
            experiment="Switch same-direction and opposite switching and compare the delay factor."
            takeaway="Crosstalk is a layout choice. The mitigation controls change the same capacitance the glitch is drawn from."
          />
        }
      />
    </>
  );
}
