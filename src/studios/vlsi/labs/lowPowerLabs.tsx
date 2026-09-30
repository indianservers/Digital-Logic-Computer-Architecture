import { useState } from "react";
import { clockGate, powerGate, suggestVt, voltageIsland, vtPath, type VtClass } from "../reliabilityModel";
import { VlsiGrid } from "../shell";
import { Badge, Choice, Measure, Observe, Slider, Wave } from "../widgets";

export function PowerGatingLab() {
  const [sleep, setSleep] = useState(false);
  const [header, setHeader] = useState(true);
  const [load, setLoad] = useState(4);
  const [retention, setRetention] = useState(true);
  const [slew, setSlew] = useState(1);
  const gate = powerGate({ sleep, header, load, retention, slew });
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Sleep enable" value={sleep ? "sleep" : "active"} options={[{ id: "active", label: "Active" }, { id: "sleep", label: "Sleep" }]} onChange={(value) => setSleep(value === "sleep")} />
          <Choice label="Switch" value={header ? "header" : "footer"} options={[{ id: "header", label: "Header" }, { id: "footer", label: "Footer" }]} onChange={(value) => setHeader(value === "header")} />
          <Slider label="Load" value={load} min={1} max={12} step={1} text={`${load}`} onChange={setLoad} />
          <Choice label="Retention" value={retention ? "on" : "off"} options={[{ id: "on", label: "On" }, { id: "off", label: "Off" }]} onChange={(value) => setRetention(value === "on")} />
          <Slider label="Wake slew" value={slew} min={0.2} max={4} step={0.2} text={slew.toFixed(1)} onChange={setSlew} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 180" role="img" aria-label="Header sleep transistor and virtual rail">
          <rect x="40" y="24" width="240" height="16" fill="#fbbf24" />
          <text x="48" y="36" fill="#111827">VDD</text>
          <rect x="140" y="48" width="36" height="28" fill={sleep ? "#334155" : "#22d3ee"} />
          <text x="146" y="66" fill="#0f172a">{header ? "HDR" : "FTR"}</text>
          <rect x="70" y={100 - gate.virtualRail * 40} width="180" height={16 + gate.virtualRail * 40} fill="#38bdf8" />
          <text x="78" y="150" fill="#e2e8f0">Virtual rail {gate.virtualRail.toFixed(2)} V</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Active leakage" value={gate.activeLeakage} unit="A" />
          <Measure label="Sleep leakage" value={gate.sleepLeakage} unit="A" />
          <Measure label="Wake-up" value={`${gate.wakeup.toFixed(2)} ns`} />
          <Measure label="Inrush" value={gate.inrush.toFixed(2)} />
          <Badge tone={sleep ? "warn" : "on"}>{sleep ? (retention ? "Retention" : "Rail collapsed") : "Active"}</Badge>
          <Observe change="Switch from active to sleep." see="Sleep leakage falls and the virtual rail collapses." why="The sleep device disconnects the block from the real rail. Retention keeps a fraction of that rail." experiment="Turn retention off, then wake with a short slew and read inrush." takeaway="Sleep trades a wake-up current for a much smaller leakage estimate." />
        </>
      }
    />
  );
}

export function ClockGatingLab() {
  const [enabled, setEnabled] = useState(true);
  const [style, setStyle] = useState<"naive" | "icg">("icg");
  const [freq, setFreq] = useState(200);
  const [activity, setActivity] = useState(0.3);
  const [registers, setRegisters] = useState(16);
  const [enableAt, setEnableAt] = useState(1);
  const gate = clockGate({ enabled, style, frequencyMHz: freq, activity, registers, enableAt });
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Enable" value={enabled ? "on" : "off"} options={[{ id: "on", label: "On" }, { id: "off", label: "Off" }]} onChange={(value) => setEnabled(value === "on")} />
          <Choice label="Gating cell" value={style} options={[{ id: "naive", label: "Naïve AND" }, { id: "icg", label: "Integrated" }]} onChange={setStyle} />
          <Slider label="Frequency" value={freq} min={50} max={800} step={50} text={`${freq.toFixed(0)} MHz`} onChange={setFreq} />
          <Slider label="Activity" value={activity} min={0.05} max={1} step={0.05} text={activity.toFixed(2)} onChange={setActivity} />
          <Slider label="Registers" value={registers} min={1} max={64} step={1} text={`${registers}`} onChange={setRegisters} />
          <Slider label="Enable timing" value={enableAt} min={0} max={12} step={1} text={`${enableAt}`} onChange={setEnableAt} />
        </>
      }
      stage={<Wave traces={[
        { name: "CLK", color: "#94a3b8", values: gate.clock, min: 0, max: 1 },
        { name: "GCLK", color: "#22d3ee", values: gate.gated, min: 0, max: 1 },
      ]} />}
      readouts={
        <>
          <Measure label="Downstream edges" value={`${gate.edges}`} />
          <Measure label="Dynamic power" value={gate.dynamic} unit="W" />
          <Badge tone={gate.glitch ? "bad" : "on"}>{gate.glitch ? "Naïve AND can glitch" : "Glitch-free sample"}</Badge>
          <Observe change="Turn enable off, then compare a naïve AND with the integrated gate while enable rises mid-cycle." see="Downstream edges and dynamic power go to zero when enable is off. The naïve gate can show a glitch." why="The integrated cell latches enable only while the clock is low. A plain AND copies enable immediately." experiment="Set enable timing to 1 with the naïve AND." takeaway="Clock gating saves dynamic power only when the gated clock actually stops." />
        </>
      }
    />
  );
}

const NAMES = ["INV", "NAND", "NOR", "BUF"];

export function MultiVtLab() {
  const [cells, setCells] = useState<VtClass[]>(["HVT", "SVT", "HVT", "HVT"]);
  const [load, setLoad] = useState(8);
  const [target, setTarget] = useState(70);
  const path = vtPath(cells, load);
  const cycle = (index: number) => {
    const order: VtClass[] = ["HVT", "SVT", "LVT"];
    const current = cells[index] ?? "SVT";
    const next = order[(order.indexOf(current) + 1) % order.length] ?? "SVT";
    setCells(cells.map((item, itemIndex) => itemIndex === index ? next : item));
  };
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Load" value={load} min={2} max={20} step={1} text={`${load.toFixed(0)} fF`} onChange={setLoad} />
          <Slider label="Target delay" value={target} min={40} max={120} step={2} text={`${target.toFixed(0)} ps`} onChange={setTarget} />
          <button type="button" onClick={() => setCells(suggestVt(cells, load, target))}>Suggest Vt</button>
        </>
      }
      stage={
        <div className="vlsi-path-row">
          {cells.map((vt, index) => (
            <button key={NAMES[index]} type="button" className={vt === "LVT" ? "on" : ""} onClick={() => cycle(index)}>
              {NAMES[index]}
              <strong>{vt}</strong>
              <i style={{ width: `${vt === "LVT" ? 90 : vt === "SVT" ? 60 : 35}%` }} />
            </button>
          ))}
        </div>
      }
      readouts={
        <>
          <Measure label="Path delay" value={`${path.delay.toFixed(1)} ps`} />
          <Measure label="Leakage" value={path.leakage} unit="A" />
          <Measure label="Slack vs 80 ps" value={`${path.slack.toFixed(1)} ps`} />
          <Badge tone={path.delay <= target ? "on" : "warn"}>{path.delay <= target ? "Meets target" : "Over target"}</Badge>
          <Observe change="Click a cell to cycle HVT, SVT, and LVT, or press Suggest Vt." see="Path delay falls and leakage rises as cells move toward LVT." why="LVT uses a lower threshold, so it switches faster and leaks more." experiment="Set every cell to HVT, lower the target, and run Suggest." takeaway="Suggest only promotes the current slowest cell, one step at a time." />
        </>
      }
    />
  );
}

export function MultiVddLab() {
  const [vddA, setA] = useState(1);
  const [vddB, setB] = useState(0.7);
  const [aOn, setAOn] = useState(true);
  const [bOn, setBOn] = useState(true);
  const cross = voltageIsland({ vddA, vddB, aOn, bOn });
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="VDD A" value={vddA} min={0.6} max={1.2} step={0.05} text={`${vddA.toFixed(2)} V`} onChange={setA} />
          <Slider label="VDD B" value={vddB} min={0.6} max={1.2} step={0.05} text={`${vddB.toFixed(2)} V`} onChange={setB} />
          <Choice label="Island A" value={aOn ? "on" : "off"} options={[{ id: "on", label: "On" }, { id: "off", label: "Off" }]} onChange={(value) => setAOn(value === "on")} />
          <Choice label="Island B" value={bOn ? "on" : "off"} options={[{ id: "on", label: "On" }, { id: "off", label: "Off" }]} onChange={(value) => setBOn(value === "on")} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 180" role="img" aria-label="Voltage islands, level shifter, and isolation">
          <rect x="16" y="30" width="110" height="100" fill={aOn ? "#0e7490" : "#1e293b"} stroke="#e2e8f0" />
          <text x="28" y="80" fill="#f8fafc">Island A {cross.before.toFixed(2)} V</text>
          <rect x="140" y="60" width="40" height="36" fill={cross.shifter ? "#fbbf24" : "#334155"} />
          <text x="146" y="82" fill="#111827">LS</text>
          <rect x="194" y="30" width="110" height="100" fill={bOn ? "#155e75" : "#1e293b"} stroke="#e2e8f0" />
          <text x="206" y="80" fill="#f8fafc">Island B {cross.after.toFixed(2)} V</text>
          <rect x="140" y="110" width="40" height="22" fill={cross.isolation ? "#fb7185" : "#334155"} />
          <text x="148" y="125" fill="#111827">ISO</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Before" value={`${cross.before.toFixed(2)} V`} />
          <Measure label="After" value={`${cross.after.toFixed(2)} V`} />
          <Badge tone={cross.shifter ? "warn" : "on"}>{cross.shifter ? "Level shifter required" : "Same-voltage crossing"}</Badge>
          <Badge tone={cross.isolation ? "bad" : "info"}>{cross.isolation ? "Isolation required" : "Both domains match power"}</Badge>
          <Observe change="Separate VDD A from VDD B, then turn one island off." see="The level shifter lights when the live voltages differ. Isolation lights when one domain is off." why="A receiver built for one rail cannot safely take a different amplitude or a floating driver." experiment="Match both voltages with both islands on." takeaway="The waveform amplitudes are the configured rail voltages." />
        </>
      }
    />
  );
}
