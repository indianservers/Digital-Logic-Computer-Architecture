import { useMemo, useState } from "react";
import { MOS_MODEL_NOTE, bodyEffect, deviceK, engineering, idVdsFamily, idVgsCurve, mosCapacitor, mosfet, regionLabel, thresholdAtTemperature, type Polarity } from "../engine";
import { BandSketch, CapSection, MosSection } from "../diagrams";
import { Badge, Chart, Choice, Measure, Observe, PlayControls, Slider, Theory, useTicker } from "../widgets";

const COLORS = ["#22d3ee", "#38bdf8", "#a3e635", "#facc15", "#fb923c", "#f472b6", "#c084fc"];

export function MosfetFundamentalsLab() {
  const [polarity, setPolarity] = useState<Polarity>("nmos");
  const [mode, setMode] = useState<"structure" | "channel" | "regions" | "current" | "bands">("channel");
  const [vgs, setVgs] = useState(1.2);
  const [vds, setVds] = useState(0.8);
  const [vth0, setVth0] = useState(0.45);
  const [vsb, setVsb] = useState(0);
  const [temp, setTemp] = useState(27);
  const [playing, setPlaying] = useState(false);
  const vth = bodyEffect(thresholdAtTemperature(vth0, temp), vsb);
  const point = mosfet(polarity, vgs, vds, vth, deviceK(polarity, 1, 0.18));
  const channel = Math.max(0, Math.min(1, (vgs - vth) / 0.7));
  useTicker(playing, () => setVgs((value) => (value >= 2 ? 0 : Math.round((value + 0.1) * 10) / 10)));
  const see = point.region === "cutoff"
    ? "The channel stays off and drain current is zero."
    : point.region === "linear"
      ? "A continuous channel carries current that still rises with VDS."
      : "The channel pinches at the drain. Current levels off.";
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Device and bias</h2>
        <Choice label="Device type" value={polarity} onChange={setPolarity} options={[{ id: "nmos", label: "NMOS" }, { id: "pmos", label: "PMOS" }]} />
        <Choice label="View" value={mode} onChange={setMode} options={[
          { id: "structure", label: "Structure" },
          { id: "channel", label: "Channel" },
          { id: "regions", label: "Regions" },
          { id: "current", label: "Current" },
          { id: "bands", label: "Bands" },
        ]} />
        <Slider label={polarity === "nmos" ? "VGS" : "|VSG|"} value={vgs} min={0} max={2} step={0.05} text={engineering(vgs, "V")} onChange={setVgs} />
        <Slider label={polarity === "nmos" ? "VDS" : "|VSD|"} value={vds} min={0} max={2} step={0.05} text={engineering(vds, "V")} onChange={setVds} />
        <Slider label="VTH0" value={vth0} min={0.2} max={0.9} step={0.01} text={engineering(vth0, "V")} onChange={setVth0} />
        <Slider label="VSB reverse" value={vsb} min={0} max={1} step={0.05} text={engineering(vsb, "V")} onChange={setVsb} />
        <Slider label="Temperature" value={temp} min={-20} max={120} step={1} text={`${temp.toFixed(0)} °C`} onChange={setTemp} />
        <PlayControls playing={playing} onToggle={() => setPlaying((value) => !value)} onStep={() => setVgs((value) => Math.min(2, Math.round((value + 0.1) * 10) / 10))} />
        <Theory title="Model assumptions"><p>{MOS_MODEL_NOTE} Sliders are voltage magnitudes. A PMOS conducts when |VSG| exceeds |VTH|.</p></Theory>
      </aside>
      <section className="vlsi-stage">
        <div className="vlsi-stage-bar">
          <Badge tone={polarity === "nmos" ? "nmos" : "pmos"}>{polarity.toUpperCase()}</Badge>
          <Badge tone={point.region === "cutoff" ? "off" : "on"}>{regionLabel(point.region)}</Badge>
        </div>
        {mode === "bands" ? <BandSketch bend={polarity === "nmos" ? channel : -channel} body={polarity === "nmos" ? "p" : "n"} /> : (
          <MosSection polarity={polarity} channel={mode === "structure" ? 0.15 : channel} region={point.region} vgs={vgs} vds={vds} vth={vth} flowing={mode !== "structure" && point.id > 1e-8} />
        )}
        <p className="vlsi-caption">{mode === "regions" ? `Boundary VDS,sat = VGS − VTH = ${Math.max(0, vgs - vth).toFixed(2)} V.` : "Gate voltage gathers the inversion charge. Drain voltage sweeps it toward the drain."}</p>
      </section>
      <aside className="vlsi-panel vlsi-read">
        <h2>Live readings</h2>
        <Measure label="VTH" value={vth} unit="V" hint="Includes body effect and temperature" />
        <Measure label="ID" value={point.id} unit="A" />
        <Measure label="gm" value={point.gm} unit="S" />
        <Measure label="Overdrive" value={point.overdrive} unit="V" />
        <Observe
          change="Raise VGS through VTH, then raise VDS."
          see={see}
          why="Below threshold there is no inversion charge. In triode the channel is a resistor. In saturation the drain end pinches off."
          experiment="Cool the device, or reverse-bias the body, and watch VTH climb until the same VGS falls into cutoff."
          takeaway="The gate decides whether a channel exists. The drain decides how hard that channel is driven."
        />
      </aside>
    </div>
  );
}

export function MosfetIvLab() {
  const [polarity, setPolarity] = useState<Polarity>("nmos");
  const [plot, setPlot] = useState<"output" | "transfer">("output");
  const [start, setStart] = useState(0.5);
  const [stop, setStop] = useState(2.5);
  const [step, setStep] = useState(0.5);
  const [vdsMax, setVdsMax] = useState(3);
  const [vth0, setVth0] = useState(0.45);
  const [width, setWidth] = useState(2);
  const [opVgs, setOpVgs] = useState(1.5);
  const [opVds, setOpVds] = useState(1.2);
  const k = deviceK(polarity, width, 0.18);
  const gates = useMemo(() => {
    const values: number[] = [];
    const span = Math.max(step, stop - start);
    const count = Math.min(6, Math.max(1, Math.round(span / Math.max(0.1, step)) + 1));
    for (let index = 0; index < count; index += 1) values.push(start + (count === 1 ? 0 : (index * (stop - start)) / (count - 1)));
    return values;
  }, [start, stop, step]);
  const family = useMemo(() => idVdsFamily(gates, vdsMax, vth0, k), [gates, vdsMax, vth0, k]);
  const transfer = useMemo(() => idVgsCurve(opVds, Math.max(stop, opVgs), vth0, k), [opVds, stop, opVgs, vth0, k]);
  const point = mosfet(polarity, opVgs, opVds, vth0, k);
  const yMax = Math.max(point.id, ...family.flatMap((curve) => curve.points.map((item) => item.y)), ...transfer.map((item) => item.y), 1e-6) * 1.1;
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Sweep</h2>
        <Choice label="Device" value={polarity} onChange={setPolarity} options={[{ id: "nmos", label: "NMOS" }, { id: "pmos", label: "PMOS" }]} />
        <Choice label="Plot" value={plot} onChange={setPlot} options={[{ id: "output", label: "ID–VDS" }, { id: "transfer", label: "ID–VGS" }]} />
        <Slider label="VGS start" value={start} min={0} max={2} step={0.1} text={engineering(start, "V")} onChange={setStart} />
        <Slider label="VGS stop" value={stop} min={0.4} max={3} step={0.1} text={engineering(stop, "V")} onChange={setStop} />
        <Slider label="VGS step" value={step} min={0.2} max={1} step={0.1} text={engineering(step, "V")} onChange={setStep} />
        <Slider label="VDS max" value={vdsMax} min={0.5} max={5} step={0.1} text={engineering(vdsMax, "V")} onChange={setVdsMax} />
        <Slider label="VTH" value={vth0} min={0.2} max={1.2} step={0.01} text={engineering(vth0, "V")} onChange={setVth0} />
        <Slider label="Width" value={width} min={0.5} max={8} step={0.1} text={`${width.toFixed(1)} µm`} onChange={setWidth} />
        <Theory title="What the curves are"><p>{MOS_MODEL_NOTE} Click a plot to move the operating point. k = k′ W/L = {engineering(k, "A/V²")}.</p></Theory>
      </aside>
      <section className="vlsi-stage">
        {plot === "output" ? (
          <Chart
            ariaLabel="Drain current versus drain voltage"
            xLabel="VDS (V)"
            yLabel="ID"
            xMax={vdsMax}
            yMax={yMax}
            series={family.map((curve, index) => ({ name: `VGS ${curve.vgs.toFixed(2)}`, color: COLORS[index % COLORS.length] ?? "#38bdf8", points: curve.points }))}
            marker={{ x: opVds, y: point.id, label: regionLabel(point.region) }}
            onPick={(x) => setOpVds(x)}
          />
        ) : (
          <Chart
            ariaLabel="Drain current versus gate voltage"
            xLabel="VGS (V)"
            yLabel="ID"
            xMax={Math.max(stop, 0.2)}
            yMax={yMax}
            series={[{ name: "transfer", color: "#22d3ee", points: transfer }]}
            marker={{ x: opVgs, y: point.id, label: regionLabel(point.region) }}
            onPick={(x) => setOpVgs(x)}
          />
        )}
        <div className="vlsi-legend">
          {family.map((curve, index) => <span key={curve.vgs} style={{ color: COLORS[index % COLORS.length] }}>VGS {curve.vgs.toFixed(2)} V</span>)}
        </div>
        <Slider label="Operating VGS" value={opVgs} min={0} max={Math.max(stop, 0.2)} step={0.05} text={engineering(opVgs, "V")} onChange={setOpVgs} />
        <Slider label="Operating VDS" value={opVds} min={0} max={vdsMax} step={0.05} text={engineering(opVds, "V")} onChange={setOpVds} />
      </section>
      <aside className="vlsi-panel vlsi-read">
        <h2>Operating point</h2>
        <Measure label="VGS" value={opVgs} unit="V" />
        <Measure label="VDS" value={opVds} unit="V" />
        <Measure label="ID" value={point.id} unit="A" />
        <Measure label="gm" value={point.gm} unit="S" />
        <Badge tone={point.region === "cutoff" ? "off" : point.region === "linear" ? "info" : "on"}>{regionLabel(point.region)}</Badge>
        <Observe
          change="Move VDS across VGS − VTH on one curve, then pick a higher VGS."
          see={point.region === "saturation" ? "Current flattens. The dashed idea of VDS,sat has been passed." : point.region === "linear" ? "Current still climbs almost linearly with VDS." : "The whole family sits near zero until VGS exceeds VTH."}
          why="Triode is VDS < VGS − VTH. Saturation is the pinch-off side of that line. gm is the slope of the transfer curve."
          experiment="Raise VTH until the lowest curve disappears into cutoff."
          takeaway="One equation draws every curve. The region is a comparison of voltages, not a separate picture."
        />
      </aside>
    </div>
  );
}

export function MosCapacitorLab() {
  const [vg, setVg] = useState(0.2);
  const [body, setBody] = useState<"p" | "n">("p");
  const [tox, setTox] = useState(4);
  const [doping, setDoping] = useState(1e16);
  const [temp, setTemp] = useState(27);
  const cap = mosCapacitor(vg, tox, doping, body, temp);
  const curve = useMemo(() => {
    const points = [];
    for (let index = 0; index <= 40; index += 1) {
      const gate = -1.5 + (3 * index) / 40;
      points.push({ x: gate, y: mosCapacitor(gate, tox, doping, body, temp).capFf });
    }
    return points;
  }, [tox, doping, body, temp]);
  const yMax = Math.max(...curve.map((point) => point.y), cap.capFf) * 1.15;
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Gate stack</h2>
        <Choice label="Body" value={body} onChange={setBody} options={[{ id: "p", label: "P-type" }, { id: "n", label: "N-type" }]} />
        <Slider label="Gate voltage" value={vg} min={-1.5} max={1.5} step={0.05} text={engineering(vg, "V")} onChange={setVg} />
        <Slider label="Oxide thickness" value={tox} min={1.5} max={12} step={0.1} text={`${tox.toFixed(1)} nm`} onChange={setTox} />
        <Slider label="Doping" value={Math.log10(doping)} min={15} max={18} step={0.1} text={`${doping.toExponential(1)} cm⁻³`} onChange={(value) => setDoping(10 ** value)} />
        <Slider label="Temperature" value={temp} min={0} max={125} step={1} text={`${temp.toFixed(0)} °C`} onChange={setTemp} />
        <Theory title="Why the surface changes"><p>On a P-type body a negative gate attracts holes (accumulation). A small positive gate pushes holes away (depletion). Past threshold, electrons invert the surface. An N-type body reverses the voltage signs. Low-frequency C–V returns toward Cox in inversion.</p></Theory>
      </aside>
      <section className="vlsi-stage">
        <div className="vlsi-stage-bar"><Badge tone={cap.state === "inversion" ? "on" : cap.state === "accumulation" ? "pmos" : "info"}>{cap.state}</Badge></div>
        <CapSection state={cap.state} depletion={cap.depletionNm} body={body} />
        <BandSketch bend={cap.bend} body={body} />
      </section>
      <aside className="vlsi-panel vlsi-read">
        <h2>Surface</h2>
        <Measure label="VTH" value={cap.vth} unit="V" />
        <Measure label="Cox" value={cap.coxFf * 1e-15} unit="F" hint="per µm²" />
        <Measure label="C" value={cap.capFf * 1e-15} unit="F" hint="low-frequency, per µm²" />
        <p className="vlsi-caption">{cap.carriers}</p>
        <Chart ariaLabel="Capacitance versus gate voltage" series={[{ name: "C-V", color: "#22d3ee", points: curve }]} xMin={-1.5} xMax={1.5} yMax={yMax} xLabel="Gate voltage (V)" yLabel="C" marker={{ x: vg, y: cap.capFf, label: cap.state }} />
        <Observe
          change="Sweep the gate from negative to positive."
          see={`${cap.state} is on screen. Depletion width is ${cap.depletionNm.toFixed(0)} nm.`}
          why={cap.carriers}
          experiment="Thicken the oxide and watch Cox fall. Raise doping and the inversion threshold moves."
          takeaway="The MOS capacitor is the gate of every MOSFET. Inversion is the channel waiting for a source and a drain."
        />
      </aside>
    </div>
  );
}
