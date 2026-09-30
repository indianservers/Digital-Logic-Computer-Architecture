import { useState } from "react";
import { engineering, passTransistor, sharedWire, transmissionGate, triStateOutput, type Bit } from "../engine";
import { Badge, BitPair, Choice, Measure, Observe, PlayControls, Slider, Theory, Wave, useTicker } from "../widgets";

export function TransmissionGateLab() {
  const [enabled, setEnabled] = useState<Bit>(1);
  const [direction, setDirection] = useState<"ab" | "ba">("ab");
  const [source, setSource] = useState(1.2);
  const [vdd, setVdd] = useState(1.8);
  const [playing, setPlaying] = useState(false);
  const [held, setHeld] = useState(1.2);
  const [trace, setTrace] = useState<number[]>([1.2]);
  const gate = transmissionGate(enabled, source);
  const shown = gate.vout === "Z" ? held : gate.vout;
  useTicker(playing, () => {
    setSource((value) => {
      const next = value >= vdd ? 0 : Math.min(vdd, value + vdd / 12);
      const passed = transmissionGate(enabled, next);
      const level = passed.vout === "Z" ? held : passed.vout;
      if (passed.vout !== "Z") setHeld(passed.vout);
      setTrace((items) => [...items.slice(-31), level]);
      return next;
    });
  }, 260);
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Enable and direction</h2>
        <BitPair label="EN" value={enabled} onChange={setEnabled} />
        <p className="vlsi-caption">EN-bar is {enabled === 1 ? 0 : 1}. The PMOS gate sees the complement.</p>
        <Choice label="Direction" value={direction} onChange={setDirection} options={[{ id: "ab", label: "A → B" }, { id: "ba", label: "B → A" }]} />
        <Slider label="Input voltage" value={source} min={0} max={vdd} step={0.05} text={engineering(source, "V")} onChange={(value) => { setSource(value); if (enabled === 1) setHeld(value); }} />
        <Slider label="VDD" value={vdd} min={0.8} max={1.8} step={0.05} text={engineering(vdd, "V")} onChange={setVdd} />
        <PlayControls playing={playing} onToggle={() => setPlaying((value) => !value)} onStep={() => setSource((value) => Math.min(vdd, value + 0.1))} />
        <Theory title="Why both devices"><p>An NMOS alone cannot pass a strong 1, and a PMOS alone cannot pass a strong 0. Together they conduct for the whole range, in either direction. With EN low the channel is gone and the far side is high impedance.</p></Theory>
      </aside>
      <section className="vlsi-stage">
        <div className="vlsi-stage-bar">
          <Badge tone={gate.conducting ? "on" : "warn"}>{gate.conducting ? "ON, full swing" : "OFF, high-Z"}</Badge>
          <Badge tone="info">{direction === "ab" ? "Driving A, watching B" : "Driving B, watching A"}</Badge>
        </div>
        <svg className="vlsi-device" viewBox="0 0 420 180" role="img" aria-label="Transmission gate">
          <text x="40" y="90" fill="#93c5fd" fontSize="14">{direction === "ab" ? "A" : "B"} {source.toFixed(2)} V</text>
          <line x1="110" y1="84" x2="180" y2="84" stroke={gate.conducting ? "#4ade80" : "#64748b"} strokeWidth={gate.conducting ? 4 : 2} />
          <rect x="180" y="48" width="70" height="28" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="3" />
          <rect x="180" y="92" width="70" height="28" rx="6" fill="#1e293b" stroke="#fb7185" strokeWidth="3" />
          <text x="215" y="66" textAnchor="middle" fill="#7dd3fc" fontSize="11">NMOS</text>
          <text x="215" y="110" textAnchor="middle" fill="#fda4af" fontSize="11">PMOS</text>
          <line x1="250" y1="84" x2="320" y2="84" stroke={gate.conducting ? "#4ade80" : "#64748b"} strokeWidth={gate.conducting ? 4 : 2} />
          <text x="328" y="90" fill="#6ee7b7" fontSize="14">{direction === "ab" ? "B" : "A"} {gate.vout === "Z" ? "Z" : `${shown.toFixed(2)} V`}</text>
        </svg>
        <Wave traces={[
          { name: "in", color: "#60a5fa", values: trace.map(() => source), min: 0, max: vdd },
          { name: "out", color: "#4ade80", values: trace, min: 0, max: vdd },
        ]} />
      </section>
      <aside className="vlsi-panel vlsi-read">
        <Measure label="Output" value={gate.vout === "Z" ? "Z" : shown} unit={gate.vout === "Z" ? "" : "V"} hint={gate.vout === "Z" ? `Last driven ${engineering(held, "V")}, now floating` : "Passed without a threshold drop"} />
        <Observe
          change="Pass 0 V and VDD with EN high, then drop EN."
          see={gate.conducting ? "The output equals the input. Direction does not change the level." : "The output is Z. Nothing restores or fights the floating node."}
          why="EN high turns the NMOS on and EN-bar low turns the PMOS on. Either polarity of input finds a device that passes it well."
          experiment="Compare this with the pass-transistor lab at the same high input."
          takeaway="A transmission gate is bidirectional and full-swing. One MOSFET is not."
        />
      </aside>
    </div>
  );
}

export function PassTransistorLab() {
  const [kind, setKind] = useState<"nmos" | "pmos" | "tg">("nmos");
  const [vin, setVin] = useState(1.8);
  const [gate, setGate] = useState(1.8);
  const [vth, setVth] = useState(0.45);
  const [vdd, setVdd] = useState(1.8);
  const result = passTransistor(kind, vin, gate, vdd, vth);
  const compare = (["nmos", "pmos", "tg"] as const).map((item) => ({ item, result: passTransistor(item, vin, item === "tg" ? vdd : gate, vdd, vth) }));
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Device</h2>
        <Choice label="Pass device" value={kind} onChange={setKind} options={[{ id: "nmos", label: "NMOS" }, { id: "pmos", label: "PMOS" }, { id: "tg", label: "TG" }]} />
        <Slider label="Input" value={vin} min={0} max={vdd} step={0.05} text={engineering(vin, "V")} onChange={setVin} />
        <Slider label={kind === "tg" ? "EN (uses VDD/2)" : "Gate voltage"} value={gate} min={0} max={vdd} step={0.05} text={engineering(gate, "V")} onChange={setGate} />
        <Slider label="|VTH|" value={vth} min={0.15} max={0.8} step={0.01} text={engineering(vth, "V")} onChange={setVth} />
        <Slider label="VDD" value={vdd} min={0.8} max={1.8} step={0.05} text={engineering(vdd, "V")} onChange={setVdd} />
      </aside>
      <section className="vlsi-stage">
        <Badge tone={result.conducting ? (result.degraded ? "warn" : "on") : "off"}>{result.conducting ? (result.degraded ? "Degraded level" : "Strong level") : "Off"}</Badge>
        <div className="vlsi-bars" aria-label="Output comparison">
          {compare.map((row) => {
            const level = row.result.vout === "Z" ? 0 : row.result.vout;
            return (
              <div key={row.item} className={row.item === kind ? "on" : ""}>
                <span>{row.item.toUpperCase()}</span>
                <i style={{ height: `${row.result.vout === "Z" ? 4 : (level / vdd) * 100}%` }} />
                <b>{row.result.vout === "Z" ? "Z" : engineering(level, "V")}</b>
              </div>
            );
          })}
        </div>
        <p className="vlsi-caption">{result.note}</p>
      </section>
      <aside className="vlsi-panel vlsi-read">
        <Measure label="Vout" value={result.vout === "Z" ? "Z" : result.vout} unit={result.vout === "Z" ? "" : "V"} />
        <Measure label="VDD − VTH" value={Math.max(0, vdd - vth)} unit="V" hint="NMOS high-level ceiling when the gate is at VDD" />
        <Observe
          change="Put a full VDD on an NMOS whose gate is also VDD. Then switch to the transmission gate."
          see={result.note}
          why="The NMOS channel collapses once the source side rises to Vgate − VTH. The PMOS has the same problem for a falling level. The transmission gate keeps one device healthy across the swing."
          experiment="Lower VTH and watch the NMOS high level climb toward VDD."
          takeaway="A lone pass transistor drops a threshold. A transmission gate does not."
        />
      </aside>
    </div>
  );
}

export function TriStateLab() {
  const [dataA, setDataA] = useState<Bit>(1);
  const [enA, setEnA] = useState<Bit>(1);
  const [dataB, setDataB] = useState<Bit>(0);
  const [enB, setEnB] = useState<Bit>(0);
  const a = triStateOutput(dataA, enA);
  const b = triStateOutput(dataB, enB);
  const wire = sharedWire([a, b]);
  const tone = wire === "X" ? "bad" : wire === "Z" ? "warn" : wire === 1 ? "on" : "info";
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Driver A</h2>
        <BitPair label="Data A" value={dataA} onChange={setDataA} />
        <BitPair label="Enable A" value={enA} onChange={setEnA} />
        <h2>Driver B</h2>
        <BitPair label="Data B" value={dataB} onChange={setDataB} />
        <BitPair label="Enable B" value={enB} onChange={setEnB} />
        <Theory title="Same bus rules"><p>Each driver uses the tri-state buffer from the logic engine: enable 0 yields Z, enable 1 yields the data. The shared wire uses the same contention rule as the RTL and CPU buses. Two different driven values become X.</p></Theory>
      </aside>
      <section className="vlsi-stage">
        <div className="vlsi-stage-bar">
          <Badge tone={a === "Z" ? "off" : "nmos"}>A drives {String(a)}</Badge>
          <Badge tone={b === "Z" ? "off" : "pmos"}>B drives {String(b)}</Badge>
          <Badge tone={tone}>Bus {String(wire)}</Badge>
        </div>
        <svg className="vlsi-device" viewBox="0 0 440 200" role="img" aria-label="Two tri-state drivers on one wire">
          <rect x="30" y="40" width="90" height="40" rx="8" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
          <text x="75" y="64" textAnchor="middle" fill="#e2e8f0" fontSize="12">A EN={enA}</text>
          <rect x="30" y="120" width="90" height="40" rx="8" fill="#1e293b" stroke="#fb7185" strokeWidth="2" />
          <text x="75" y="144" textAnchor="middle" fill="#e2e8f0" fontSize="12">B EN={enB}</text>
          <line x1="120" y1="60" x2="250" y2="100" stroke={a === "Z" ? "#64748b" : "#4ade80"} strokeWidth="3" />
          <line x1="120" y1="140" x2="250" y2="100" stroke={b === "Z" ? "#64748b" : "#4ade80"} strokeWidth="3" />
          <line x1="250" y1="100" x2="340" y2="100" stroke={wire === "X" ? "#f87171" : wire === "Z" ? "#fbbf24" : "#4ade80"} strokeWidth="4" />
          <text x="348" y="104" fill="#e2e8f0" fontSize="16">Bus {String(wire)}</text>
        </svg>
        <p className="vlsi-caption">Inside each enabled driver, a transmission gate connects the data. Disable opens that gate.</p>
      </section>
      <aside className="vlsi-panel vlsi-read">
        <Measure label="Output" value={String(wire)} hint={wire === "X" ? "Contention" : wire === "Z" ? "No driver" : "One driver"} />
        <Observe
          change="Enable only A, then only B, then both with opposite data, then neither."
          see={wire === "X" ? "Both drivers fight. The wire is X." : wire === "Z" ? "Nobody drives the wire. It is Z." : `The bus follows the enabled driver and is ${wire}.`}
          why="Z means the transistor path is open. X means two low-impedance paths want different voltages."
          experiment="Enable both drivers with the same data. The wire is still a valid 0 or 1."
          takeaway="A shared VLSI net needs exactly one strong driver, or an agreed value."
        />
      </aside>
    </div>
  );
}
