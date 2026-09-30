import { useEffect, useMemo, useState } from "react";
import { cmosDelay, cmosInverter, cmosPower, deviceK, engineering, noiseMargins, voltageTransfer, type InverterBias } from "../engine";

function inverterBias(vin: number, vdd: number, wn: number, wp: number, vtn = 0.45, vtp = 0.45): InverterBias {
  return { vdd, vin, kn: deviceK("nmos", wn, 0.18), kp: deviceK("pmos", wp, 0.18), vtn, vtp };
}
import { InverterSchematic } from "../diagrams";
import { Badge, Chart, Choice, Measure, Observe, PlayControls, Slider, Theory, Wave, useTicker } from "../widgets";

export function CmosInverterLab() {
  const [vin, setVin] = useState(0);
  const [vdd, setVdd] = useState(1.8);
  const [wn, setWn] = useState(1);
  const [wp, setWp] = useState(2.5);
  const [playing, setPlaying] = useState(false);
  const [trace, setTrace] = useState<Array<{ vin: number; vout: number }>>([{ vin: 0, vout: 1.8 }]);
  const point = cmosInverter(inverterBias(vin, vdd, wn, wp));
  useEffect(() => {
    setTrace((items) => [...items.slice(-31), { vin, vout: point.vout }]);
  }, [vin, point.vout]);
  useTicker(playing, () => {
    setVin((value) => (value >= vdd ? 0 : Math.min(vdd, value + vdd / 16)));
  }, 280);
  const mid = point.pmosOn && point.nmosOn;
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Inverter bias</h2>
        <Slider label="Vin" value={vin} min={0} max={vdd} step={vdd / 40} text={engineering(vin, "V")} onChange={setVin} />
        <Slider label="VDD" value={vdd} min={0.8} max={3.3} step={0.05} text={engineering(vdd, "V")} onChange={setVdd} />
        <Slider label="NMOS width" value={wn} min={0.4} max={6} step={0.1} text={`${wn.toFixed(1)} µm`} onChange={setWn} />
        <Slider label="PMOS width" value={wp} min={0.4} max={8} step={0.1} text={`${wp.toFixed(1)} µm`} onChange={setWp} />
        <PlayControls playing={playing} onToggle={() => setPlaying((value) => !value)} onStep={() => setVin((value) => Math.min(vdd, value + vdd / 16))} />
        <Theory title="Logic check"><p>At the rails this uses the same NOT rule as the logic-gates engine: input 0 gives output 1, input 1 gives output 0. Between the rails both transistors conduct and the output is solved so the NMOS and PMOS currents match.</p></Theory>
      </aside>
      <section className="vlsi-stage">
        <div className="vlsi-stage-bar">
          <Badge tone={point.pmosOn ? "pmos" : "off"}>PMOS {point.pmosOn ? "ON" : "OFF"}</Badge>
          <Badge tone={point.nmosOn ? "nmos" : "off"}>NMOS {point.nmosOn ? "ON" : "OFF"}</Badge>
          <Badge tone={point.logic === 1 ? "on" : "info"}>Y = {point.logic}</Badge>
        </div>
        <InverterSchematic vdd={vdd} vin={vin} vout={point.vout} pmosOn={point.pmosOn} nmosOn={point.nmosOn} current={point.current > 1e-8} />
      </section>
      <aside className="vlsi-panel vlsi-read">
        <h2>Readings</h2>
        <Measure label="Vout" value={point.vout} unit="V" />
        <Measure label="Supply current" value={point.current} unit="A" hint={mid ? "Crowbar through both devices" : "Only the charging path"} />
        <Wave traces={[
          { name: "Vin", color: "#60a5fa", values: trace.map((item) => item.vin), min: 0, max: vdd },
          { name: "Vout", color: "#4ade80", values: trace.map((item) => item.vout), min: 0, max: vdd },
        ]} />
        <Observe
          change="Set Vin to 0, then to VDD, then stop halfway."
          see={point.pmosOn && !point.nmosOn ? "PMOS pulls the output all the way to VDD. NMOS is off." : !point.pmosOn && point.nmosOn ? "NMOS pulls the output to ground. PMOS is off." : "Both devices are on. Current flows from VDD to ground while Vout sits between the rails."}
          why="A low gate turns the PMOS on and the NMOS off. A high gate does the opposite. There is no stable state where both are off."
          experiment="Widen only the NMOS and watch the mid-rail output fall."
          takeaway="A CMOS inverter restores a full level because exactly one network is on in a settled state."
        />
      </aside>
    </div>
  );
}

export function CmosVtcLab() {
  const [vdd, setVdd] = useState(1.8);
  const [wn, setWn] = useState(1);
  const [wp, setWp] = useState(2.5);
  const [vtn, setVtn] = useState(0.45);
  const [vtp, setVtp] = useState(0.45);
  const [vin, setVin] = useState(0.9);
  const curve = useMemo(() => voltageTransfer({ vdd, kn: deviceK("nmos", wn, 0.18), kp: deviceK("pmos", wp, 0.18), vtn, vtp }), [vdd, wn, wp, vtn, vtp]);
  const margins = useMemo(() => noiseMargins(curve, vdd), [curve, vdd]);
  const nearest = curve.reduce((best, sample) => Math.abs(sample.vin - vin) < Math.abs(best.vin - vin) ? sample : best, curve[0]!);
  const point = cmosInverter(inverterBias(vin, vdd, wn, wp, vtn, vtp));
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Transfer curve</h2>
        <Slider label="VDD" value={vdd} min={0.9} max={3.3} step={0.05} text={engineering(vdd, "V")} onChange={setVdd} />
        <Slider label="NMOS width" value={wn} min={0.4} max={6} step={0.1} text={`${wn.toFixed(1)} µm`} onChange={setWn} />
        <Slider label="PMOS width" value={wp} min={0.4} max={8} step={0.1} text={`${wp.toFixed(1)} µm`} onChange={setWp} />
        <Slider label="NMOS VTH" value={vtn} min={0.2} max={0.9} step={0.01} text={engineering(vtn, "V")} onChange={setVtn} />
        <Slider label="|PMOS VTH|" value={vtp} min={0.2} max={0.9} step={0.01} text={engineering(vtp, "V")} onChange={setVtp} />
        <Theory title="Noise margins"><p>VIL and VIH are the points where the slope reaches −1. VM is where the curve crosses Vout = Vin. Wider PMOS raises VM. Wider NMOS lowers it.</p></Theory>
      </aside>
      <section className="vlsi-stage">
        <Chart
          ariaLabel="CMOS voltage transfer characteristic"
          xLabel="Vin (V)"
          yLabel="Vout"
          xMax={vdd}
          yMax={vdd * 1.05}
          series={[
            { name: "VTC", color: "#4ade80", points: curve.map((sample) => ({ x: sample.vin, y: sample.vout })) },
            { name: "unity", color: "#64748b", points: [{ x: 0, y: 0 }, { x: vdd, y: vdd }] },
          ]}
          marker={{ x: nearest.vin, y: nearest.vout, label: `gain ${nearest.gain.toFixed(1)}` }}
          onPick={(x) => setVin(x)}
        />
        <Slider label="Operating Vin" value={vin} min={0} max={vdd} step={0.02} text={engineering(vin, "V")} onChange={setVin} />
        <div className="vlsi-stage-bar">
          <Badge tone={point.pmosOn && !point.nmosOn ? "pmos" : "off"}>PMOS region</Badge>
          <Badge tone={point.pmosOn && point.nmosOn ? "warn" : "off"}>Transition</Badge>
          <Badge tone={point.nmosOn && !point.pmosOn ? "nmos" : "off"}>NMOS region</Badge>
        </div>
      </section>
      <aside className="vlsi-panel vlsi-read">
        <h2>Critical points</h2>
        <Measure label="VOH" value={margins.voh} unit="V" />
        <Measure label="VOL" value={margins.vol} unit="V" />
        <Measure label="VIL" value={margins.vil} unit="V" />
        <Measure label="VIH" value={margins.vih} unit="V" />
        <Measure label="VM" value={margins.vm} unit="V" />
        <Measure label="NML" value={margins.nml} unit="V" />
        <Measure label="NMH" value={margins.nmh} unit="V" />
        <Measure label="dVout/dVin" value={nearest.gain} unit="" />
        <Observe
          change="Drag the marker or widen one transistor."
          see={`VM sits at ${margins.vm.toFixed(2)} V. The selected gain is ${nearest.gain.toFixed(2)}.`}
          why="The output is the voltage where NMOS current equals PMOS current. A stronger pull-down wins, so VM falls."
          experiment="Set Wp/Wn very large and watch VM climb toward VDD."
          takeaway="Noise margins are read from the slope of a calculated curve, not from a drawn textbook sketch."
        />
      </aside>
    </div>
  );
}

export function CmosPowerLab() {
  const [vdd, setVdd] = useState(1.2);
  const [frequency, setFrequency] = useState(200e6);
  const [alpha, setAlpha] = useState(0.2);
  const [load, setLoad] = useState(20);
  const [temp, setTemp] = useState(27);
  const [vth, setVth] = useState(0.4);
  const [width, setWidth] = useState(1);
  const [showDyn, setShowDyn] = useState(true);
  const [showShort, setShowShort] = useState(true);
  const [showLeak, setShowLeak] = useState(true);
  const parts = cmosPower({ vdd, frequency, alpha, capacitance: load * 1e-15, celsius: temp, vth, widthUm: width });
  const total = (showDyn ? parts.dynamic : 0) + (showShort ? parts.shortCircuit : 0) + (showLeak ? parts.leakage : 0);
  const trend = useMemo(() => {
    const points = [];
    for (let index = 1; index <= 12; index += 1) {
      const supply = 0.3 * index;
      const sample = cmosPower({ vdd: supply, frequency, alpha, capacitance: load * 1e-15, celsius: temp, vth, widthUm: width });
      points.push({ x: supply, y: (showDyn ? sample.dynamic : 0) + (showShort ? sample.shortCircuit : 0) + (showLeak ? sample.leakage : 0) });
    }
    return points;
  }, [frequency, alpha, load, temp, vth, width, showDyn, showShort, showLeak]);
  const yMax = Math.max(total, ...trend.map((point) => point.y), 1e-12) * 1.15;
  const share = (value: number) => total > 0 ? `${((value / total) * 100).toFixed(0)}%` : "0%";
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Activity and supply</h2>
        <Slider label="VDD" value={vdd} min={0.4} max={2.5} step={0.05} text={engineering(vdd, "V")} onChange={setVdd} />
        <Slider label="Frequency" value={frequency / 1e6} min={1} max={2000} step={1} text={engineering(frequency, "Hz")} onChange={(value) => setFrequency(value * 1e6)} />
        <Slider label="Activity α" value={alpha} min={0} max={1} step={0.01} text={alpha.toFixed(2)} onChange={setAlpha} />
        <Slider label="Load" value={load} min={1} max={200} step={1} text={`${load.toFixed(0)} fF`} onChange={setLoad} />
        <Slider label="Temperature" value={temp} min={0} max={125} step={1} text={`${temp.toFixed(0)} °C`} onChange={setTemp} />
        <Slider label="VTH" value={vth} min={0.15} max={0.8} step={0.01} text={engineering(vth, "V")} onChange={setVth} />
        <Slider label="Device width" value={width} min={0.4} max={8} step={0.1} text={`${width.toFixed(1)} µm`} onChange={setWidth} />
        <div className="vlsi-choice" role="group" aria-label="Power terms">
          <button type="button" className={showDyn ? "on" : ""} aria-pressed={showDyn} onClick={() => setShowDyn((value) => !value)}>Dynamic</button>
          <button type="button" className={showShort ? "on" : ""} aria-pressed={showShort} onClick={() => setShowShort((value) => !value)}>Short-circuit</button>
          <button type="button" className={showLeak ? "on" : ""} aria-pressed={showLeak} onClick={() => setShowLeak((value) => !value)}>Leakage</button>
        </div>
      </aside>
      <section className="vlsi-stage">
        <div className="vlsi-split" aria-label="Power contribution">
          <span style={{ flex: Math.max(parts.dynamic, 0) }}>{showDyn ? "Dynamic" : ""}</span>
          <span className="short" style={{ flex: Math.max(showShort ? parts.shortCircuit : 0, 0) }}>{showShort ? "Short" : ""}</span>
          <span className="leak" style={{ flex: Math.max(showLeak ? parts.leakage : 0, 0) }}>{showLeak ? "Leak" : ""}</span>
        </div>
        <Chart ariaLabel="Power versus supply" series={[{ name: "P", color: "#f59e0b", points: trend }]} xMax={3.6} yMax={yMax} xLabel="VDD (V)" yLabel="Power" marker={{ x: vdd, y: total, label: engineering(total, "W") }} />
        <p className="vlsi-caption">Dynamic power uses α C VDD² f. The curve bends upward because of VDD².</p>
      </section>
      <aside className="vlsi-panel vlsi-read">
        <h2>Breakdown</h2>
        <Measure label="Dynamic" value={showDyn ? parts.dynamic : 0} unit="W" hint={share(showDyn ? parts.dynamic : 0)} />
        <Measure label="Short-circuit" value={showShort ? parts.shortCircuit : 0} unit="W" hint={share(showShort ? parts.shortCircuit : 0)} />
        <Measure label="Leakage" value={showLeak ? parts.leakage : 0} unit="W" hint={share(showLeak ? parts.leakage : 0)} />
        <Measure label="Total" value={total} unit="W" />
        <Observe
          change="Double VDD, then double frequency, then raise temperature with α at zero."
          see={`Dynamic is ${engineering(parts.dynamic, "W")}. Leakage is ${engineering(parts.leakage, "W")}.`}
          why="Charging a capacitor costs C V² each swing. Short-circuit current exists only while both transistors are briefly on. Leakage grows with temperature and does not need switching."
          experiment="Turn dynamic off. The remaining curve is much flatter in VDD."
          takeaway="Most active CMOS energy is dynamic, and it tracks the square of the supply."
        />
      </aside>
    </div>
  );
}

export function PropagationDelayLab() {
  const [kind, setKind] = useState<"rising" | "falling">("falling");
  const [slew, setSlew] = useState(50);
  const [load, setLoad] = useState(20);
  const [wn, setWn] = useState(1);
  const [wp, setWp] = useState(2.5);
  const [vdd, setVdd] = useState(1.2);
  const delay = cmosDelay({ vdd, vth: 0.4, capacitance: load * 1e-15, wn, ln: 0.18, wp, lp: 0.18, slew: slew * 1e-12 });
  const loadSweep = useMemo(() => {
    const points = [];
    for (let index = 1; index <= 12; index += 1) {
      const sample = cmosDelay({ vdd, vth: 0.4, capacitance: index * 15e-15, wn, ln: 0.18, wp, lp: 0.18, slew: slew * 1e-12 });
      points.push({ x: index * 15, y: (kind === "falling" ? sample.tpHL : sample.tpLH) * 1e12 });
    }
    return points;
  }, [wn, wp, vdd, slew, kind]);
  const vin = kind === "falling"
    ? [0, 0, vdd * 0.1, vdd * 0.5, vdd, vdd, vdd, vdd]
    : [vdd, vdd, vdd * 0.9, vdd * 0.5, 0, 0, 0, 0];
  const vout = kind === "falling"
    ? [vdd, vdd, vdd * 0.9, vdd * 0.5, vdd * 0.1, 0, 0, 0]
    : [0, 0, vdd * 0.1, vdd * 0.5, vdd * 0.9, vdd, vdd, vdd];
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Load and strength</h2>
        <Choice label="Input edge" value={kind} onChange={setKind} options={[{ id: "falling", label: "Output falling" }, { id: "rising", label: "Output rising" }]} />
        <Slider label="Input slew" value={slew} min={5} max={400} step={5} text={`${slew.toFixed(0)} ps`} onChange={setSlew} />
        <Slider label="Load CL" value={load} min={1} max={150} step={1} text={`${load.toFixed(0)} fF`} onChange={setLoad} />
        <Slider label="NMOS width" value={wn} min={0.4} max={8} step={0.1} text={`${wn.toFixed(1)} µm`} onChange={setWn} />
        <Slider label="PMOS width" value={wp} min={0.4} max={8} step={0.1} text={`${wp.toFixed(1)} µm`} onChange={setWp} />
        <Slider label="VDD" value={vdd} min={0.6} max={1.8} step={0.05} text={engineering(vdd, "V")} onChange={setVdd} />
        <Theory title="Delay model"><p>Req is VDD divided by the saturation current of the switching device at VGS = VDS = VDD, using the same square-law model as the MOSFET labs. tp ≈ 0.69 Req CL, plus a tenth of the input slew. 10%, 50%, and 90% are the usual waveform marks.</p></Theory>
      </aside>
      <section className="vlsi-stage">
        <Wave traces={[
          { name: "Vin", color: "#60a5fa", values: vin, min: 0, max: vdd },
          { name: "Vout", color: "#4ade80", values: vout, min: 0, max: vdd },
        ]} />
        <p className="vlsi-caption">Markers: 10% {engineering(vdd * 0.1, "V")} · 50% {engineering(vdd * 0.5, "V")} · 90% {engineering(vdd * 0.9, "V")}</p>
        <Chart ariaLabel="Delay versus load" series={[{ name: "tp", color: "#22d3ee", points: loadSweep }]} xMax={180} yMax={Math.max(...loadSweep.map((point) => point.y)) * 1.15} xLabel="CL (fF)" yLabel="tp (ps)" marker={{ x: load, y: (kind === "falling" ? delay.tpHL : delay.tpLH) * 1e12, label: kind }} />
      </section>
      <aside className="vlsi-panel vlsi-read">
        <h2>Times</h2>
        <Measure label="tpHL" value={delay.tpHL} unit="s" />
        <Measure label="tpLH" value={delay.tpLH} unit="s" />
        <Measure label="Fall time" value={delay.fall} unit="s" />
        <Measure label="Rise time" value={delay.rise} unit="s" />
        <Measure label="Req NMOS" value={delay.reqN} unit="Ω" />
        <Measure label="Req PMOS" value={delay.reqP} unit="Ω" />
        <Observe
          change="Increase the load, then widen the transistor that is doing the switching."
          see={kind === "falling" ? `Falling delay is ${engineering(delay.tpHL, "s")}.` : `Rising delay is ${engineering(delay.tpLH, "s")}.`}
          why="A larger capacitor takes longer to charge through the same resistance. A wider device raises current, lowers Req, and shortens the edge."
          experiment="Make the PMOS narrow and compare tpLH with tpHL."
          takeaway="Delay here is an RC time, and the resistance comes from the MOSFET current, not from a logic-tick slider."
        />
      </aside>
    </div>
  );
}
