import { useState } from "react";
import { COMPLEX_GATES, cmosNand, cmosNor, complexCmos, type Bit } from "../engine";
import { NetworkSchematic } from "../diagrams";
import { Badge, BitPair, Choice, Measure, Observe, Theory, Truth, Wave } from "../widgets";

const NAND_ROWS = ["00", "01", "10", "11"].map((bits) => {
  const a = Number(bits[0] ?? "0") as Bit;
  const b = Number(bits[1] ?? "0") as Bit;
  return [String(a), String(b), String(cmosNand(a, b).y)];
});

const NOR_ROWS = ["00", "01", "10", "11"].map((bits) => {
  const a = Number(bits[0] ?? "0") as Bit;
  const b = Number(bits[1] ?? "0") as Bit;
  return [String(a), String(b), String(cmosNor(a, b).y)];
});

function activeRow(a: Bit, b: Bit): number {
  return a * 2 + b;
}

export function CmosNandLab() {
  const [a, setA] = useState<Bit>(0);
  const [b, setB] = useState<Bit>(0);
  const [vdd, setVdd] = useState(1.8);
  const [view, setView] = useState<"network" | "symbol" | "wave">("network");
  const [trace, setTrace] = useState<number[]>([1]);
  const net = cmosNand(a, b);
  const devices = {
    pa: net.devices.find((device) => device.id === "PA")?.on ?? false,
    pb: net.devices.find((device) => device.id === "PB")?.on ?? false,
    na: net.devices.find((device) => device.id === "NA")?.on ?? false,
    nb: net.devices.find((device) => device.id === "NB")?.on ?? false,
  };
  function setInput(which: "a" | "b", value: Bit) {
    const nextA = which === "a" ? value : a;
    const nextB = which === "b" ? value : b;
    if (which === "a") setA(value);
    else setB(value);
    setTrace((items) => [...items.slice(-23), cmosNand(nextA, nextB).y]);
  }
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Inputs</h2>
        <BitPair label="A" value={a} onChange={(value) => setInput("a", value)} />
        <BitPair label="B" value={b} onChange={(value) => setInput("b", value)} />
        <label className="vlsi-slider">VDD <strong>{vdd.toFixed(2)} V</strong>
          <input aria-label="VDD" type="range" min={0.8} max={3.3} step={0.1} value={vdd} onChange={(event) => setVdd(Number(event.target.value))} />
        </label>
        <Choice label="View" value={view} onChange={setView} options={[{ id: "network", label: "Transistors" }, { id: "symbol", label: "Symbol" }, { id: "wave", label: "Waveform" }]} />
        <Theory title="Why this network"><p>The output is the same NAND computed by the logic-gates engine. The VLSI view adds the complementary network: either PMOS can pull high, and both NMOS devices must be on to pull low.</p></Theory>
      </aside>
      <section className="vlsi-stage">
        <div className="vlsi-stage-bar">
          <Badge tone={net.path === "pull-up" ? "pmos" : "off"}>Pull-up {net.pullUp ? "conducting" : "open"}</Badge>
          <Badge tone={net.path === "pull-down" ? "nmos" : "off"}>Pull-down {net.pullDown ? "conducting" : "open"}</Badge>
          <Badge tone={net.y === 1 ? "on" : "info"}>Y = {net.y}</Badge>
        </div>
        {view === "network" ? <NetworkSchematic kind="nand" a={a} b={b} devicesOn={devices} /> : null}
        {view === "symbol" ? <p className="vlsi-symbol" aria-label="NAND symbol">NAND · Y = (A · B)′</p> : null}
        {view === "wave" ? <Wave traces={[{ name: "Y", color: "#4ade80", values: trace, min: 0, max: 1 }]} /> : null}
        <p className="vlsi-caption">Output level {net.y === 1 ? vdd.toFixed(2) : "0.00"} V at the chosen supply.</p>
      </section>
      <aside className="vlsi-panel vlsi-read">
        <h2>Truth table</h2>
        <Truth headers={["A", "B", "Y"]} rows={NAND_ROWS} active={activeRow(a, b)} />
        <Observe
          change="Set A and B to every combination, especially 11."
          see={net.pullDown ? "Both NMOS devices are on. The green path reaches ground and Y is 0." : "At least one PMOS is on. The output is pulled to VDD."}
          why="Series NMOS implements AND in the pull-down. Parallel PMOS is the dual, so a single low input is enough to pull up."
          experiment="Leave B at 0 and toggle A. The pull-down never closes."
          takeaway="NAND is low only when every pull-down transistor is on."
        />
      </aside>
    </div>
  );
}

export function CmosNorLab() {
  const [a, setA] = useState<Bit>(0);
  const [b, setB] = useState<Bit>(0);
  const [vdd, setVdd] = useState(1.8);
  const net = cmosNor(a, b);
  const devices = {
    pa: net.devices.find((device) => device.id === "PA")?.on ?? false,
    pb: net.devices.find((device) => device.id === "PB")?.on ?? false,
    na: net.devices.find((device) => device.id === "NA")?.on ?? false,
    nb: net.devices.find((device) => device.id === "NB")?.on ?? false,
  };
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Inputs</h2>
        <BitPair label="A" value={a} onChange={setA} />
        <BitPair label="B" value={b} onChange={setB} />
        <label className="vlsi-slider">VDD <strong>{vdd.toFixed(2)} V</strong>
          <input aria-label="VDD" type="range" min={0.8} max={3.3} step={0.1} value={vdd} onChange={(event) => setVdd(Number(event.target.value))} />
        </label>
        <Theory title="Dual of NAND"><p>NOR swaps the networks. PMOS devices are in series, so both gates must be low to pull up. Either NMOS can pull down. The logic value still comes from evalGate("NOR").</p></Theory>
      </aside>
      <section className="vlsi-stage">
        <div className="vlsi-stage-bar">
          <Badge tone={net.pullUp ? "pmos" : "off"}>Series PMOS {net.pullUp ? "ON" : "open"}</Badge>
          <Badge tone={net.pullDown ? "nmos" : "off"}>Parallel NMOS {net.pullDown ? "ON" : "open"}</Badge>
          <Badge tone="on">Y = {net.y}</Badge>
        </div>
        <NetworkSchematic kind="nor" a={a} b={b} devicesOn={devices} />
        <p className="vlsi-caption">Settled output {net.y === 1 ? vdd.toFixed(2) : "0.00"} V.</p>
      </section>
      <aside className="vlsi-panel vlsi-read">
        <Truth headers={["A", "B", "Y"]} rows={NOR_ROWS} active={activeRow(a, b)} />
        <Observe
          change="Start at 00, then raise either input."
          see={net.y === 1 ? "Both PMOS devices conduct. Y is high." : "An NMOS path to ground is on, so Y is low."}
          why="A single high input turns one NMOS on and breaks the PMOS series chain."
          experiment="Compare this picture with NAND. The series stack has moved from the bottom to the top."
          takeaway="NOR is high only when every pull-up transistor is on."
        />
      </aside>
    </div>
  );
}

export function ComplexCmosLab() {
  const [gate, setGate] = useState<(typeof COMPLEX_GATES)[number]["id"] | "custom">("aoi21");
  const [custom, setCustom] = useState<"aoi21" | "oai21">("aoi21");
  const id = gate === "custom" ? custom : gate;
  const [bits, setBits] = useState<Record<string, Bit>>({ A: 0, B: 0, C: 0, D: 0 });
  const net = complexCmos(id, bits);
  const rows = truthRows(id);
  const key = net.spec.inputs.map((name) => bits[name] ?? 0).join("");
  const active = rows.findIndex((row) => row.slice(0, -1).join("") === key);
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Gate</h2>
        <Choice label="Example" value={gate} onChange={setGate} options={[
          { id: "aoi21", label: "AOI21" },
          { id: "aoi22", label: "AOI22" },
          { id: "oai21", label: "OAI21" },
          { id: "oai22", label: "OAI22" },
          { id: "custom", label: "Build" },
        ]} />
        {gate === "custom" ? (
          <Choice label="Pull-down you build" value={custom} onChange={setCustom} options={[
            { id: "aoi21", label: "(A·B)+C" },
            { id: "oai21", label: "(A+B)·C" },
          ]} />
        ) : null}
        {net.spec.inputs.map((name) => (
          <BitPair key={name} label={name} value={bits[name] ?? 0} onChange={(value) => setBits((current) => ({ ...current, [name]: value }))} />
        ))}
        <Theory title="Duality"><p>You choose the condition that should pull the output low. The pull-up is the series/parallel dual, so exactly one network conducts in a settled state. The output is inverted because it is the pull-down condition, not the condition itself.</p></Theory>
      </aside>
      <section className="vlsi-stage">
        <p className="vlsi-symbol">{net.spec.expression}</p>
        <p className="vlsi-caption">Pull-down: {net.spec.pullDown}</p>
        <p className="vlsi-caption">Pull-up dual: {net.spec.pullUp}</p>
        <div className="vlsi-devices">
          {net.devices.map((device) => (
            <Badge key={device.id} tone={device.on ? (device.polarity === "pmos" ? "pmos" : "nmos") : "off"}>{device.id} {device.on ? "ON" : "OFF"}</Badge>
          ))}
        </div>
        <Badge tone={net.path === "pull-down" ? "nmos" : "pmos"}>{net.path} is conducting</Badge>
      </section>
      <aside className="vlsi-panel vlsi-read">
        <Measure label="Y" value={String(net.y)} />
        <Measure label="Transistors" value={String(net.spec.transistors)} />
        <Truth headers={[...net.spec.inputs, "Y"]} rows={rows} active={active} />
        <Observe
          change="Toggle the inputs that sit in series, then the one that sits in parallel."
          see={net.pullDown ? "The pull-down condition is true, so Y is 0." : "The pull-down is open. The complementary pull-up holds Y at 1."}
          why="Series means AND. Parallel means OR. Putting a bubble on that function is what the complementary pair does."
          experiment="In Build, switch the pull-down from (A·B)+C to (A+B)·C and watch which input combinations still pull low."
          takeaway="A complex CMOS gate is a pull-down condition plus its dual pull-up."
        />
      </aside>
    </div>
  );
}

function truthRows(id: (typeof COMPLEX_GATES)[number]["id"]): string[][] {
  const spec = COMPLEX_GATES.find((gate) => gate.id === id) ?? COMPLEX_GATES[0]!;
  const count = spec.inputs.length;
  const rows: string[][] = [];
  for (let index = 0; index < 2 ** count; index += 1) {
    const bits: Record<string, Bit> = {};
    spec.inputs.forEach((name, place) => {
      bits[name] = ((index >> (count - 1 - place)) & 1) === 1 ? 1 : 0;
    });
    rows.push([...spec.inputs.map((name) => String(bits[name])), String(complexCmos(id, bits).y)]);
  }
  return rows;
}
