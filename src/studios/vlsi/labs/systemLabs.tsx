import { useMemo, useState } from "react";
import { emptyFlow, GDS_STAGES, runThrough, type DesignId } from "../gdsFlow";
import {
  assemblyCompare,
  chipletLink,
  dieTemperatures,
  explorePpa,
  fabricCompare,
  moveBlock,
  nocRoute,
  packageStack,
  PPA_PRESETS,
  SOC_FLOOR,
  socWireLength,
  type FloorBlock,
  type PpaInput,
} from "../systemModel";
import { VlsiGrid } from "../shell";
import { Badge, Choice, Measure, Observe, Slider } from "../widgets";

const DESIGNS: DesignId[] = ["adder2", "adder4", "counter", "mux", "fsm", "alu"];

export function AsicFlowLab() {
  const [design, setDesign] = useState<DesignId>("adder4");
  const [stage, setStage] = useState(0);
  const flow = useMemo(() => runThrough(emptyFlow(design), GDS_STAGES[stage] ?? "rtl"), [design, stage]);
  const id = GDS_STAGES[stage] ?? "rtl";
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Design" value={design} options={DESIGNS.map((item) => ({ id: item, label: item }))} onChange={setDesign} />
          <Slider label="Stage" value={stage} min={0} max={GDS_STAGES.length - 1} step={1} text={id} onChange={setStage} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 360 200" role="img" aria-label="ASIC flow stages">
          {GDS_STAGES.map((item, index) => (
            <g key={item}>
              <rect x={12 + (index % 5) * 70} y={20 + Math.floor(index / 5) * 52} width="62" height="36" rx="8" fill={index === stage ? "#22d3ee" : flow.status[item] === "pass" ? "#14532d" : "#1e293b"} />
              <text x={18 + (index % 5) * 70} y={42 + Math.floor(index / 5) * 52} fill={index === stage ? "#082f49" : "#e2e8f0"} fontSize="9">{item}</text>
            </g>
          ))}
        </svg>
      }
      readouts={
        <>
          <Measure label="Cells" value={`${flow.mapped.length}`} />
          <Measure label="Area" value={flow.floorArea.toFixed(1)} />
          <Measure label="Worst slack" value={`${flow.slackNs.toFixed(2)} ns`} />
          <Measure label="Wire" value={flow.wire.toFixed(1)} />
          <Measure label="DRC" value={`${flow.drc}`} />
          <Measure label="LVS" value={flow.lvs} />
          <Badge tone={flow.status[id] === "pass" ? "on" : flow.status[id] === "fail" ? "bad" : "warn"}>{flow.status[id]}</Badge>
          <Observe change="Move the stage from RTL toward GDS." see="Each stage consumes the previous result: mapped cells set the floorplan, placement, and the slack." why="This overview runs the same flow engine as the final lab, with the balanced preset." experiment="Switch from the 4-bit adder to the mux and compare cell count." takeaway={flow.log[flow.log.length - 1] ?? "Run a stage."} />
        </>
      }
    />
  );
}

export function FpgaAsicLab() {
  const [kind, setKind] = useState<"adder" | "counter" | "alu">("adder");
  const [width, setWidth] = useState(4);
  const both = fabricCompare(kind, width);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Function" value={kind} options={[{ id: "adder", label: "Adder" }, { id: "counter", label: "Counter" }, { id: "alu", label: "ALU slice" }]} onChange={setKind} />
          <Slider label="Bit width" value={width} min={1} max={8} step={1} text={`${width}`} onChange={setWidth} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 360 180" role="img" aria-label="FPGA fabric beside an ASIC standard-cell row">
          {Array.from({ length: Math.min(8, both.fpga.luts) }, (_, index) => (
            <rect key={`lut-${index}`} x={16 + (index % 4) * 36} y={36 + Math.floor(index / 4) * 36} width="28" height="24" fill="#312e81" stroke="#a5b4fc" />
          ))}
          <text x="16" y="24" fill="#c7d2fe">FPGA LUTs</text>
          {Array.from({ length: Math.min(8, both.asic.cells) }, (_, index) => (
            <rect key={`cell-${index}`} x={190 + index * 18} y="70" width="14" height="36" fill="#7f1d1d" stroke="#fda4af" />
          ))}
          <text x="190" y="24" fill="#fecdd3">ASIC cells</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="FPGA area" value={both.fpga.area.toFixed(0)} />
          <Measure label="ASIC area" value={both.asic.area.toFixed(0)} />
          <Measure label="FPGA delay" value={both.fpga.delay.toFixed(0)} />
          <Measure label="ASIC delay" value={both.asic.delay.toFixed(0)} />
          <Measure label="FPGA NRE" value={both.fpga.nre.toFixed(2)} />
          <Measure label="ASIC NRE" value={both.asic.nre.toFixed(2)} />
          <Badge tone="info">Normalized educational units</Badge>
          <Observe change="Widen the function." see="Both fabrics grow from the same gate network. The FPGA pays LUT and routing area. The ASIC pays NRE and a longer time-to-market." why="LUT count follows the generic gates times width. ASIC cell count follows the mapped library times width." experiment="Compare the counter with the adder at the same width." takeaway="Flexibility stays with the FPGA. Unit cost falls on the ASIC only after the mask cost is paid." />
        </>
      }
    />
  );
}

export function SocFloorLab() {
  const [blocks, setBlocks] = useState<FloorBlock[]>(SOC_FLOOR);
  const [id, setId] = useState("gpu");
  const selected = blocks.find((block) => block.id === id) ?? blocks[0]!;
  const wire = socWireLength(blocks);
  const domains = new Set(blocks.map((block) => block.domain)).size;
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Block" value={selected.id} options={blocks.map((block) => ({ id: block.id, label: block.name }))} onChange={setId} />
          <Slider label="X" value={selected.x} min={0} max={90} step={2} text={`${selected.x}`} onChange={(value) => setBlocks((current) => moveBlock(current, selected.id, value, selected.y))} />
          <Slider label="Y" value={selected.y} min={0} max={70} step={2} text={`${selected.y}`} onChange={(value) => setBlocks((current) => moveBlock(current, selected.id, selected.x, value))} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 220 160" role="img" aria-label="SoC floorplan">
          <rect x="4" y="4" width="200" height="148" fill="#0f172a" stroke="#334155" />
          {blocks.map((block) => (
            <g key={block.id} onClick={() => setId(block.id)}>
              <rect x={block.x * 1.6 + 8} y={block.y * 1.4 + 8} width={block.w * 1.2} height={block.h} fill={block.id === selected.id ? "#22d3ee" : "#1e3a5f"} stroke="#e2e8f0" />
              <text x={block.x * 1.6 + 10} y={block.y * 1.4 + 20} fill="#f8fafc" fontSize="8">{block.name.split(" ")[0] ?? block.id}</text>
            </g>
          ))}
        </svg>
      }
      readouts={
        <>
          <Measure label="NoC wire" value={wire.toFixed(0)} />
          <Measure label="Power domains" value={`${domains}`} />
          <Measure label="Block power" value={`${selected.power.toFixed(1)}`} />
          <Badge tone="info">{selected.domain}</Badge>
          <Observe change="Drag a block with the X and Y sliders." see="Wire length is the Manhattan distance from every block to the NoC." why="A floorplan that pulls high-bandwidth blocks toward the NoC shortens the estimated interconnect." experiment="Move the GPU far from the NoC and watch the wire number rise." takeaway="Same blocks as the system SoC list, placed as a physical floorplan." />
        </>
      }
    />
  );
}

export function NocLab() {
  const [sr, setSr] = useState(0);
  const [sc, setSc] = useState(0);
  const [dr, setDr] = useState(2);
  const [dc, setDc] = useState(2);
  const [size, setSize] = useState(2);
  const [injection, setInjection] = useState(1);
  const [mode, setMode] = useState<"xy" | "adaptive">("xy");
  const [second, setSecond] = useState(true);
  const flows = Array.from({ length: injection }, () => ({ src: { r: sr, c: sc }, dst: { r: dr, c: dc }, size }));
  if (second) flows.push({ src: { r: 0, c: 0 }, dst: { r: 0, c: 2 }, size: 1 });
  const report = nocRoute(flows, mode);
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Source row" value={sr} min={0} max={2} step={1} text={`${sr}`} onChange={setSr} />
          <Slider label="Source column" value={sc} min={0} max={2} step={1} text={`${sc}`} onChange={setSc} />
          <Slider label="Dest row" value={dr} min={0} max={2} step={1} text={`${dr}`} onChange={setDr} />
          <Slider label="Dest column" value={dc} min={0} max={2} step={1} text={`${dc}`} onChange={setDc} />
          <Slider label="Packet size" value={size} min={1} max={8} step={1} text={`${size}`} onChange={setSize} />
          <Slider label="Injection" value={injection} min={1} max={3} step={1} text={`${injection}`} onChange={setInjection} />
          <Choice label="Routing" value={mode} options={[{ id: "xy", label: "XY" }, { id: "adaptive", label: "Adaptive" }]} onChange={setMode} />
          <Choice label="Second flow" value={second ? "on" : "off"} options={[{ id: "on", label: "On" }, { id: "off", label: "Off" }]} onChange={(value) => setSecond(value === "on")} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 220 180" role="img" aria-label="3 by 3 mesh">
          {[0, 1, 2].map((row) => [0, 1, 2].map((col) => (
            <rect key={`${row}-${col}`} x={30 + col * 50} y={30 + row * 44} width="28" height="28" fill="#1e293b" stroke="#94a3b8" />
          )))}
          {report.paths.map((path, pathIndex) => path.map((point, index) => (
            <circle key={`${pathIndex}-${index}`} cx={44 + point.c * 50} cy={44 + point.r * 44} r="5" fill={pathIndex === 0 ? "#22d3ee" : "#fb7185"} />
          )))}
        </svg>
      }
      readouts={
        <>
          <Measure label="Average latency" value={(report.avgLatency).toFixed(2)} />
          <Measure label="Max latency" value={report.maxLatency.toFixed(2)} />
          <Measure label="Hops" value={`${report.hops[0] ?? 0}`} />
          <Measure label="Packets" value={`${flows.length}`} />
          <Measure label="Hotspot" value={report.hotspot} />
          <Badge tone={report.arrived ? "on" : "bad"}>{report.arrived ? "Delivered" : "Lost"}</Badge>
          <Observe change="Turn on the second flow along the top row." see="Shared links raise latency. Adaptive routing leaves a busy XY path when a column-first path is free." why="XY finishes the row, then the column. Contention is a link used by more than one flow." experiment="Send both flows to the same corner." takeaway="Latency includes hops, packet size, and a penalty per shared link." />
        </>
      }
    />
  );
}

export function ChipletLab() {
  const [traffic, setTraffic] = useState(3);
  const [bandwidth, setBandwidth] = useState(4);
  const [latency, setLatency] = useState(2);
  const [span, setSpan] = useState(1);
  const link = chipletLink(traffic, bandwidth, latency, span);
  const compare = assemblyCompare(8, 0.08);
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Traffic" value={traffic} min={0.5} max={10} step={0.5} text={traffic.toFixed(1)} onChange={setTraffic} />
          <Slider label="Link bandwidth" value={bandwidth} min={1} max={10} step={0.5} text={bandwidth.toFixed(1)} onChange={setBandwidth} />
          <Slider label="Hop latency" value={latency} min={1} max={6} step={0.5} text={latency.toFixed(1)} onChange={setLatency} />
          <Slider label="Die spacing" value={span} min={0.6} max={2.4} step={0.2} text={span.toFixed(1)} onChange={setSpan} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 400 160" role="img" aria-label="Chiplets on an interposer">
          <rect x="20" y="70" width="360" height="28" fill="#334155" />
          {["Compute", "I/O", "Memory", "Accel"].map((name, index) => (
            <g key={name}>
              <rect x={28 + index * (52 + span * 16)} y="28" width="48" height="36" fill={index === 0 ? "#22d3ee" : "#1e293b"} stroke="#e2e8f0" />
              <text x={32 + index * (52 + span * 16)} y="50" fill="#f8fafc" fontSize="8">{name}</text>
            </g>
          ))}
          <text x="36" y="120" fill="#e2e8f0">Interposer</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Utilization" value={link.utilization.toFixed(2)} />
          <Measure label="Latency" value={link.latency.toFixed(2)} />
          <Measure label="Link power" value={link.power.toFixed(2)} />
          <Measure label="Monolithic yield" value={`${(compare.monolithic.yield * 100).toFixed(0)} %`} />
          <Measure label="Chiplet yield" value={`${(compare.chiplet.yield * 100).toFixed(0)} %`} />
          <Badge tone="info">Normalized</Badge>
          <Observe change="Raise traffic toward the link bandwidth." see="Utilization and latency climb. The chiplet yield uses four smaller Poisson dies against one large die." why="Splitting the die improves yield and modularity. The package adds latency and interconnect power." experiment="Lower bandwidth until utilization passes 1." takeaway="Educational comparison, not a package quote." />
        </>
      }
    />
  );
}

export function PackageLab() {
  const [mode, setMode] = useState<"2.5d" | "3d">("2.5d");
  const [dies, setDies] = useState(3);
  const [tsv, setTsv] = useState(16);
  const [power, setPower] = useState(6);
  const stack = packageStack(mode, dies, tsv, power);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Package" value={mode} options={[{ id: "2.5d", label: "2.5D interposer" }, { id: "3d", label: "3D stack" }]} onChange={setMode} />
          <Slider label="Dies" value={dies} min={1} max={6} step={1} text={`${dies}`} onChange={setDies} />
          <Slider label="TSVs" value={tsv} min={4} max={64} step={4} text={`${tsv}`} onChange={setTsv} />
          <Slider label="Power" value={power} min={1} max={12} step={0.5} text={power.toFixed(1)} onChange={setPower} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 180" role="img" aria-label="2.5D or 3D package">
          <rect x="30" y="130" width="260" height="18" fill="#44403c" />
          {mode === "2.5d" ? (
            <>
              <rect x="40" y="100" width="240" height="16" fill="#64748b" />
              {Array.from({ length: stack.count }, (_, index) => (
                <rect key={index} x={50 + index * 40} y="60" width="32" height="28" fill="#22d3ee" />
              ))}
            </>
          ) : Array.from({ length: stack.count }, (_, index) => (
            <rect key={index} x="120" y={110 - index * 22} width="80" height="18" fill={index === stack.count - 1 ? "#fbbf24" : "#22d3ee"} />
          ))}
          <text x="30" y="28" fill="#e2e8f0">{mode === "2.5d" ? "Dies sit side by side on the interposer" : "Dies stack. TSVs are the vertical path"}</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Link length" value={stack.linkLength.toFixed(2)} />
          <Measure label="Vertical links" value={`${stack.vertical}`} />
          <Measure label="Thermal rise" value={stack.thermalRise.toFixed(1)} />
          <Observe change="Switch from 2.5D to 3D and add a die." see="2.5D length grows sideways. 3D length is the stack height, and the thermal rise grows with the pile." why="An interposer connects neighbors horizontally. A stack connects them with TSVs or hybrid bonds, and upper dies are harder to cool." experiment="Raise power and compare the thermal rise of the two modes." takeaway="HBM-style memory is the yellow cap on the 3D stack. This is a teaching picture." />
        </>
      }
    />
  );
}

export function ThermalLab() {
  const [powers, setPowers] = useState([4, 6, 2, 1]);
  const [index, setIndex] = useState(0);
  const [ambient, setAmbient] = useState(25);
  const [cooling, setCooling] = useState(1);
  const [coolingName, setCoolingName] = useState<"poor" | "nominal" | "enhanced" | "custom">("nominal");
  const [resistance, setResistance] = useState(8);
  const [activity, setActivity] = useState(1);
  const names = ["CPU", "GPU", "NPU", "SRAM"];
  const temps = dieTemperatures(powers.map((power) => power * activity), ambient, cooling, resistance);
  const max = Math.max(...temps);
  const min = Math.min(...temps);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Block" value={`${index}`} options={names.map((name, item) => ({ id: `${item}`, label: name }))} onChange={(value) => setIndex(Number(value))} />
          <Slider label="Block power" value={powers[index] ?? 1} min={0.2} max={10} step={0.2} text={(powers[index] ?? 1).toFixed(1)} onChange={(value) => setPowers((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))} />
          <Slider label="Ambient" value={ambient} min={15} max={45} step={1} text={`${ambient} °C`} onChange={setAmbient} />
          <Slider label="Cooling" value={cooling} min={0.4} max={2} step={0.1} text={cooling.toFixed(1)} onChange={(value) => { setCoolingName("custom"); setCooling(value); }} />
          <Choice label="Cooling preset" value={coolingName} options={[{ id: "poor", label: "Poor" }, { id: "nominal", label: "Nominal" }, { id: "enhanced", label: "Enhanced" }, { id: "custom", label: "Custom" }]} onChange={(value) => { setCoolingName(value); if (value !== "custom") setCooling(value === "poor" ? 0.4 : value === "enhanced" ? 1.6 : 1); }} />
          <Slider label="Thermal resistance" value={resistance} min={2} max={16} step={1} text={`${resistance}`} onChange={setResistance} />
          <Slider label="Activity" value={activity} min={0.2} max={1} step={0.1} text={activity.toFixed(1)} onChange={setActivity} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 150" role="img" aria-label="Die thermal map">
          {temps.map((temp, item) => {
            const heat = Math.min(1, Math.max(0, (temp - ambient) / 40));
            return (
              <g key={names[item] ?? item}>
                <rect x={20 + item * 74} y="36" width="64" height="70" fill={`rgb(${Math.round(40 + heat * 180)}, ${Math.round(80 - heat * 40)}, ${Math.round(120 - heat * 80)})`} />
                <text x={28 + item * 74} y="70" fill="#f8fafc">{names[item]}</text>
                <text x={28 + item * 74} y="88" fill="#f8fafc">{temp.toFixed(0)}°</text>
              </g>
            );
          })}
        </svg>
      }
      readouts={
        <>
          <Measure label="Hottest" value={`${max.toFixed(1)} °C`} />
          <Measure label="Gradient" value={`${(max - min).toFixed(1)} °C`} />
          <Badge tone={max > 85 ? "bad" : max > 70 ? "warn" : "on"}>{max > 85 ? "Throttle" : "Within range"}</Badge>
          <Observe change="Raise GPU power, then improve cooling." see="The GPU tile heats up, and the neighbors rise a little from coupling." why="Each block's temperature is ambient plus its own power and a fraction of the others, divided by cooling." experiment="Set cooling to 0.4 and watch the throttle badge." takeaway="Educational thermal resistance, not a signoff solver." />
        </>
      }
    />
  );
}

export function PpaLab() {
  const [input, setInput] = useState<PpaInput>(PPA_PRESETS.balanced);
  const [preset, setPreset] = useState<"custom" | "low" | "balanced" | "fast" | "small">("balanced");
  const [saved, setSaved] = useState<Array<{ name: string; result: ReturnType<typeof explorePpa> }>>([]);
  const result = explorePpa(input);
  const patch = (partial: Partial<PpaInput>) => {
    setPreset("custom");
    setInput((current) => ({ ...current, ...partial }));
  };
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Preset" value={preset} options={[
            { id: "custom", label: "Custom" },
            { id: "low", label: "Low power" },
            { id: "balanced", label: "Balanced" },
            { id: "fast", label: "High performance" },
            { id: "small", label: "Small area" },
          ]} onChange={(value) => {
            setPreset(value);
            if (value !== "custom") setInput(PPA_PRESETS[value]);
          }} />
          <Slider label="VDD" value={input.vdd} min={0.6} max={1.2} step={0.05} text={`${input.vdd.toFixed(2)} V`} onChange={(value) => patch({ vdd: value })} />
          <Slider label="Frequency" value={input.frequency / 1e8} min={2} max={16} step={1} text={`${(input.frequency / 1e9).toFixed(2)} GHz`} onChange={(value) => patch({ frequency: value * 1e8 })} />
          <Slider label="Drive" value={input.drive} min={1} max={4} step={1} text={`${input.drive}`} onChange={(value) => patch({ drive: value })} />
          <Slider label="Pipeline" value={input.pipeline} min={1} max={6} step={1} text={`${input.pipeline}`} onChange={(value) => patch({ pipeline: value })} />
          <Slider label="Vt" value={input.vt} min={0.25} max={0.55} step={0.01} text={`${input.vt.toFixed(2)} V`} onChange={(value) => patch({ vt: value })} />
          <Slider label="Utilization" value={input.utilization} min={0.4} max={0.95} step={0.05} text={input.utilization.toFixed(2)} onChange={(value) => patch({ utilization: value })} />
          <Slider label="Buffering" value={input.buffering} min={0} max={2} step={0.1} text={input.buffering.toFixed(1)} onChange={(value) => patch({ buffering: value })} />
          <Choice label="Clock gate" value={input.clockGate ? "on" : "off"} options={[{ id: "on", label: "On" }, { id: "off", label: "Off" }]} onChange={(value) => patch({ clockGate: value === "on" })} />
          <Choice label="Power gate" value={input.powerGate ? "on" : "off"} options={[{ id: "on", label: "On" }, { id: "off", label: "Off" }]} onChange={(value) => patch({ powerGate: value === "on" })} />
          <button type="button" onClick={() => setSaved((current) => [...current, { name: `V${input.vdd.toFixed(2)}`, result }].slice(-4))}>Save comparison</button>
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 160" role="img" aria-label="Power performance and area bars">
          <rect x="40" y={120 - Math.min(90, result.power * 1e6)} width="40" height={Math.min(90, result.power * 1e6)} fill="#fb7185" />
          <rect x="120" y={120 - Math.min(90, result.performance / 1e9)} width="40" height={Math.min(90, result.performance / 1e9)} fill="#22d3ee" />
          <rect x="200" y={120 - Math.min(90, result.area / 8)} width="40" height={Math.min(90, result.area / 8)} fill="#fbbf24" />
          <text x="40" y="140" fill="#fecdd3">Power</text>
          <text x="110" y="140" fill="#a5f3fc">Perf</text>
          <text x="200" y="140" fill="#fde68a">Area</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Power" value={`${(result.power * 1e6).toFixed(2)} µW`} />
          <Measure label="Dynamic" value={`${(result.dynamic * 1e6).toFixed(2)} µW`} />
          <Measure label="Leakage" value={`${(result.leakage * 1e9).toFixed(2)} nW`} />
          <Measure label="Stage delay" value={`${result.delayPs.toFixed(1)} ps`} />
          <Measure label="Slack" value={`${result.slackPs.toFixed(0)} ps`} />
          <Measure label="Area" value={result.area.toFixed(0)} />
          <Measure label="Cells" value={`${result.cells}`} />
          <Measure label="Saved" value={`${saved.length}`} />
          <Badge tone={result.slackPs >= 0 ? "on" : "bad"}>{result.slackPs >= 0 ? "Timing met" : "Timing missed"}</Badge>
          <Observe change="Apply High performance, then Low power." see="The preset writes VDD, frequency, drive, pipeline, and gating, and the bars recalculate." why="Delay comes from the square-law CMOS delay. Dynamic power comes from the CMOS power equation. Area grows with drive and pipeline and shrinks as utilization rises." experiment="Save two settings and compare the saved count." takeaway="Session comparison only. Nothing is stored on a server." />
        </>
      }
    />
  );
}
