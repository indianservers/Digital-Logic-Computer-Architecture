import { useMemo, useState } from "react";
import { CELL_LIBRARY, CELL_NAMES, sizeCell, type CellName, type Drive } from "../cellLibrary";
import { FLOW_STAGES, flowSnapshot } from "../flowModel";
import { VlsiGrid } from "../shell";
import { Badge, Choice, Measure, Observe, Slider } from "../widgets";

const DRIVES: Drive[] = [1, 2, 4];

function Scatter({ points, xLabel, yLabel }: { points: Array<{ x: number; y: number; label: string }>; xLabel: string; yLabel: string }) {
  const maxX = Math.max(1, ...points.map((point) => point.x));
  const maxY = Math.max(1, ...points.map((point) => point.y));
  return (
    <svg className="vlsi-layout" viewBox="0 0 360 200" role="img" aria-label={`${yLabel} versus ${xLabel}`}>
      <text className="vlsi-svg-label" x="180" y="192" textAnchor="middle">{xLabel}</text>
      <text className="vlsi-svg-label" x="16" y="100">{yLabel}</text>
      {points.map((point) => {
        const cx = 48 + (point.x / maxX) * 280;
        const cy = 160 - (point.y / maxY) * 130;
        return (
          <g key={point.label}>
            <circle cx={cx} cy={cy} r="5" fill="#22d3ee" />
            <text className="vlsi-svg-label" x={cx + 8} y={cy - 6}>{point.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function StandardCellLab() {
  const [name, setName] = useState<CellName>("NAND2");
  const [drive, setDrive] = useState<Drive>(1);
  const [load, setLoad] = useState(8);
  const [view, setView] = useState<"symbol" | "transistors" | "layout" | "timing" | "power">("symbol");
  const sized = sizeCell(name, drive, load);
  const spec = CELL_LIBRARY[name];
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Cell" value={name} options={CELL_NAMES.map((id) => ({ id, label: id }))} onChange={setName} />
          <Choice label="Drive" value={String(drive) as "1" | "2" | "4"} options={DRIVES.map((id) => ({ id: String(id) as "1" | "2" | "4", label: `X${id}` }))} onChange={(value) => setDrive(Number(value) as Drive)} />
          <Slider label="Load" value={load} min={1} max={32} step={1} text={`${load.toFixed(0)} fF`} onChange={setLoad} />
          <Choice label="View" value={view} options={[{ id: "symbol", label: "Symbol" }, { id: "transistors", label: "Transistors" }, { id: "layout", label: "Layout" }, { id: "timing", label: "Timing" }, { id: "power", label: "Power" }]} onChange={setView} />
          <Observe
            change="Switch drive from X1 to X4 with the load fixed."
            see="Area and input capacitance grow. Rise delay falls because pull resistance drops faster than the extra pin cap."
            why="Drive strength widens the same cell. Delay is 0.69 · R/X · (Cload + self)."
            experiment="Compare INV X1 and INV X4 at 16 fF."
            takeaway="This is an educational library. The sizes stay consistent with each other."
          />
        </>
      }
      stage={
        <>
          <div className="vlsi-stage-head">
            <h2>{name} X{drive}</h2>
            <Badge tone="info">{spec.function}</Badge>
          </div>
          {view === "symbol" ? <SymbolView name={name} /> : null}
          {view === "transistors" ? <TransistorView name={name} drive={drive} /> : null}
          {view === "layout" ? (
            <svg className="vlsi-layout" viewBox="0 0 220 90" role="img" aria-label="Cell outline">
              <rect x="8" y="8" width="204" height="8" fill="#f59e0b" />
              <rect x="8" y="70" width="204" height="8" fill="#38bdf8" />
              <rect x="16" y="22" width={30 + sized.area * 8} height="40" className="vlsi-gate on" />
              <text className="vlsi-svg-label" x="22" y="46">{name} X{drive}</text>
            </svg>
          ) : null}
          {view === "timing" ? (
            <svg className="vlsi-layout" viewBox="0 0 220 90" role="img" aria-label="Rise and fall delay">
              <rect x="20" y="18" width={Math.min(180, sized.risePs)} height="16" fill="#22d3ee" />
              <text className="vlsi-svg-label" x="24" y="30">rise {sized.risePs.toFixed(1)} ps</text>
              <rect x="20" y="48" width={Math.min(180, sized.fallPs)} height="16" fill="#fbbf24" />
              <text className="vlsi-svg-label" x="24" y="60">fall {sized.fallPs.toFixed(1)} ps</text>
            </svg>
          ) : null}
          {view === "power" ? (
            <svg className="vlsi-layout" viewBox="0 0 220 90" role="img" aria-label="Leakage and dynamic energy">
              <rect x="20" y="18" width={Math.min(180, sized.leakageUw * 400)} height="16" fill="#a78bfa" />
              <text className="vlsi-svg-label" x="24" y="30">leakage {sized.leakageUw.toFixed(3)} µW</text>
              <rect x="20" y="48" width={Math.min(180, sized.dynamicFj * 4)} height="16" fill="#fb7185" />
              <text className="vlsi-svg-label" x="24" y="60">dynamic {sized.dynamicFj.toFixed(2)} fJ</text>
            </svg>
          ) : null}
        </>
      }
      readouts={
        <>
          <Measure label="Area" value={sized.area.toFixed(2)} />
          <Measure label="Input capacitance" value={`${sized.cinFf.toFixed(2)} fF`} />
          <Measure label="Rise delay" value={`${sized.risePs.toFixed(1)} ps`} />
          <Measure label="Fall delay" value={`${sized.fallPs.toFixed(1)} ps`} />
          <Measure label="Leakage" value={`${sized.leakageUw.toFixed(3)} µW`} />
          <Measure label="Dynamic energy" value={`${sized.dynamicFj.toFixed(2)} fJ`} />
          <Measure label="Max load" value={`${sized.maxLoadFf.toFixed(0)} fF`} />
        </>
      }
    />
  );
}

function TransistorView({ name, drive }: { name: CellName; drive: Drive }) {
  const network = name === "NAND2"
    ? { p: `${drive}× PMOS in parallel`, n: "NMOS in series" }
    : name === "NOR2"
      ? { p: "PMOS in series", n: `${drive}× NMOS in parallel` }
      : name === "DFF"
        ? { p: "Master latch", n: "Slave latch" }
        : { p: `${drive}× PMOS`, n: `${drive}× NMOS` };
  return (
    <svg className="vlsi-layout" viewBox="0 0 260 120" role="img" aria-label="Transistor stack">
      <text className="vlsi-svg-label" x="16" y="20">{CELL_LIBRARY[name].function}</text>
      <rect x="24" y="36" width="100" height="24" fill="#be123c" />
      <text className="vlsi-svg-label" x="30" y="52">{network.p}</text>
      <rect x="24" y="72" width="100" height="24" fill="#0e7490" />
      <text className="vlsi-svg-label" x="30" y="88">{network.n}</text>
      <text className="vlsi-svg-label" x="150" y="52">to VDD</text>
      <text className="vlsi-svg-label" x="150" y="88">to GND</text>
    </svg>
  );
}

function SymbolView({ name }: { name: CellName }) {
  const pins = CELL_LIBRARY[name].pins;
  return (
    <svg className="vlsi-layout" viewBox="0 0 220 120" role="img" aria-label={`${name} symbol`}>
      <rect x="70" y="20" width="80" height="70" className="vlsi-gate" />
      <text className="vlsi-svg-label" x="110" y="58" textAnchor="middle">{name}</text>
      {pins.map((pin, index) => (
        <text key={pin.name} className="vlsi-svg-label" x={pin.direction === "out" ? 160 : 20} y={36 + index * 16}>{pin.name}</text>
      ))}
    </svg>
  );
}

type PlotMode = "delay-area" | "power-delay" | "area-drive" | "ppa";
type Family = "all" | "combo" | "seq";

export function CellLibraryLab() {
  const [family, setFamily] = useState<Family>("all");
  const [drive, setDrive] = useState<"all" | "1" | "2" | "4">("all");
  const [sort, setSort] = useState<"area" | "delay" | "power" | "inputs">("delay");
  const [plot, setPlot] = useState<PlotMode>("delay-area");
  const [picked, setPicked] = useState<string[]>(["INV-1", "NAND2-1", "XOR2-1"]);
  const rows = useMemo(() => {
    const list = CELL_NAMES.flatMap((name) => DRIVES.map((strength) => {
      const sized = sizeCell(name, strength, 8);
      return { key: `${name}-${strength}`, sized, inputs: sized.pins.filter((pin) => pin.direction === "in" || pin.direction === "clk").length };
    }));
    return list.filter((row) => {
      if (family === "seq" && row.sized.name !== "DFF") return false;
      if (family === "combo" && row.sized.name === "DFF") return false;
      if (drive !== "all" && row.sized.drive !== Number(drive)) return false;
      return true;
    }).sort((a, b) => {
      if (sort === "area") return a.sized.area - b.sized.area;
      if (sort === "power") return a.sized.leakageUw - b.sized.leakageUw;
      if (sort === "inputs") return a.inputs - b.inputs;
      return a.sized.risePs - b.sized.risePs;
    });
  }, [family, drive, sort]);
  const chosen = rows.filter((row) => picked.includes(row.key)).slice(0, 4);
  const points = chosen.map((row) => {
    if (plot === "power-delay") return { x: row.sized.risePs, y: row.sized.leakageUw, label: row.key };
    if (plot === "area-drive") return { x: row.sized.drive, y: row.sized.area, label: row.key };
    return { x: row.sized.area, y: row.sized.risePs, label: row.key };
  });
  function toggle(key: string) {
    setPicked((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      return [...current, key].slice(-4);
    });
  }
  return (
    <VlsiGrid
      controls={
        <>
          <p>Educational standard-cell library. Not foundry liberty data.</p>
          <Choice label="Cell type" value={family} options={[{ id: "all", label: "All" }, { id: "combo", label: "Combinational" }, { id: "seq", label: "Sequential" }]} onChange={setFamily} />
          <Choice label="Drive" value={drive} options={[{ id: "all", label: "Any" }, { id: "1", label: "X1" }, { id: "2", label: "X2" }, { id: "4", label: "X4" }]} onChange={setDrive} />
          <Choice label="Sort" value={sort} options={[{ id: "delay", label: "Delay" }, { id: "area", label: "Area" }, { id: "power", label: "Power" }, { id: "inputs", label: "Inputs" }]} onChange={setSort} />
          <Choice label="Plot" value={plot} options={[{ id: "delay-area", label: "Delay vs area" }, { id: "power-delay", label: "Power vs delay" }, { id: "area-drive", label: "Area vs drive" }, { id: "ppa", label: "PPA" }]} onChange={setPlot} />
          <Observe
            change="Select two to four cells."
            see="The plot and the comparison use the same sized-cell numbers as the explorer."
            why="Area, pin cap, delay, and leakage all move together when drive changes."
            experiment="Compare INV X1 with INV X4."
            takeaway="A faster cell usually spends area and leakage to get there."
          />
        </>
      }
      stage={
        <>
          <h2>{plot === "ppa" ? "PPA bars" : "Library comparison"}</h2>
          {plot === "ppa" ? (
            <ul className="vlsi-drc-list">
              {chosen.map((row) => (
                <li key={row.key} className="vlsi-callout">{row.key} · area {row.sized.area.toFixed(1)} · delay {row.sized.risePs.toFixed(1)} ps · leakage {row.sized.leakageUw.toFixed(3)} µW</li>
              ))}
            </ul>
          ) : <Scatter points={points} xLabel={plot === "power-delay" ? "Rise delay" : plot === "area-drive" ? "Drive" : "Area"} yLabel={plot === "power-delay" ? "Leakage" : plot === "area-drive" ? "Area" : "Rise delay"} />}
        </>
      }
      readouts={
        <>
          <h3>Library</h3>
          <ul className="vlsi-drc-list">
            {rows.map((row) => (
              <li key={row.key}>
                <button type="button" className={picked.includes(row.key) ? "on" : ""} aria-pressed={picked.includes(row.key)} onClick={() => toggle(row.key)}>
                  {row.key} · {row.sized.risePs.toFixed(1)} ps · area {row.sized.area.toFixed(1)}
                </button>
              </li>
            ))}
          </ul>
        </>
      }
      footer={
        <div className="vlsi-triple">
          {chosen.map((row) => (
            <section key={row.key}>
              <h3>{row.key}</h3>
              <Measure label="Area" value={row.sized.area.toFixed(2)} />
              <Measure label="Delay" value={`${row.sized.risePs.toFixed(1)} ps`} />
              <Measure label="Leakage" value={`${row.sized.leakageUw.toFixed(3)} µW`} />
              <Measure label="Dynamic" value={`${row.sized.dynamicFj.toFixed(2)} fJ`} />
              <Measure label="Cin" value={`${row.sized.cinFf.toFixed(2)} fF`} />
              <Measure label="Max load" value={`${row.sized.maxLoadFf.toFixed(0)} fF`} />
              <Measure label="Drive" value={`X${row.sized.drive}`} />
            </section>
          ))}
        </div>
      }
    />
  );
}

export function FlowLab() {
  const [design, setDesign] = useState<"adder" | "mux" | "counter">("mux");
  const [stage, setStage] = useState(0);
  const [util, setUtil] = useState(0.6);
  const snap = flowSnapshot(design, stage, util);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Design" value={design} options={[{ id: "adder", label: "2-bit adder" }, { id: "counter", label: "Counter" }, { id: "mux", label: "Mux network" }]} onChange={setDesign} />
          <Choice label="Stage" value={String(stage)} options={FLOW_STAGES.map((label, index) => ({ id: String(index), label }))} onChange={(value) => setStage(Number(value))} />
          <Slider label="Placement utilization" value={util} min={0.4} max={0.9} step={0.05} text={`${Math.round(util * 100)}%`} onChange={setUtil} />
          <Observe
            change="Step from RTL to layout, and switch the example design."
            see="Gate count follows the elaborated network. Wire length follows mapped cells and utilization."
            why="Each stage reads the same gate, cell, and cost models."
            experiment="Compare the adder with the mux at the mapped-cell stage."
            takeaway="Implementation is a chain of transformations, not a new drawing at each step."
          />
        </>
      }
      stage={
        <>
          <div className="vlsi-stage-head">
            <h2>{snap.title}</h2>
            <Badge tone="info">{design}</Badge>
          </div>
          <p className="vlsi-callout">Input: {snap.input}</p>
          <p className="vlsi-callout">Transformation: {snap.transform}</p>
          <p className="vlsi-callout">Output: {snap.output}</p>
        </>
      }
      readouts={
        <>
          <Measure label="Gate count" value={String(snap.gateCount)} />
          <Measure label="Cell count" value={String(snap.cellCount)} />
          <Measure label="Area" value={snap.area.toFixed(1)} />
          <Measure label="Wire length" value={snap.wire.toFixed(1)} />
          <Measure label="Critical delay" value={`${snap.delay.toFixed(1)} ps`} />
          <Measure label="Power estimate" value={snap.power.toFixed(2)} />
        </>
      }
    />
  );
}
