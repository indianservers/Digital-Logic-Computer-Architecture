import { useMemo, useState } from "react";
import { MATERIALS, STACK_PARTS, murphyYield, poissonYield, viaConnects, waferMap } from "../processModel";
import { VlsiGrid } from "../shell";
import { Badge, Chart, Choice, Measure, Observe, Slider } from "../widgets";

const LEVELS = ["device", "cell", "stack", "full"] as const;

export function MetallizationLab() {
  const [layers, setLayers] = useState(4);
  const [width, setWidth] = useState(18);
  const [vias, setVias] = useState(3);
  const [net, setNet] = useState(1);
  const [shown, setShown] = useState(6);
  const flags = Array.from({ length: Math.max(0, layers - 1) }, (_, index) => index < vias);
  const connected = viaConnects(0, 1, flags);
  const drawn = Math.min(layers, shown);
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Metal layers" value={layers} min={2} max={6} step={1} text={`${layers}`} onChange={setLayers} />
          <Slider label="Wire width" value={width} min={8} max={36} step={1} text={`${width}`} onChange={setWidth} />
          <Slider label="Vias present" value={vias} min={0} max={5} step={1} text={`${vias}`} onChange={setVias} />
          <Slider label="Layers visible" value={shown} min={1} max={6} step={1} text={`${Math.min(shown, layers)}`} onChange={setShown} />
          <Slider label="Selected net" value={net} min={0} max={2} step={1} text={`Net ${net}`} onChange={setNet} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 210" role="img" aria-label="Metal and via stack">
          {Array.from({ length: drawn }, (_, index) => {
            const y = 170 - index * 28;
            const span = width + index * 10;
            const hot = index === net || (index > 0 && flags[index - 1] && index - 1 <= net);
            return (
              <g key={index}>
                <rect x={40} y={y} width={span + 80} height="12" fill={hot ? "#fde68a" : MATERIALS.metal.color}>
                  {hot ? <animate attributeName="opacity" values="0.65;1;0.65" dur="1.4s" repeatCount="indefinite" /> : null}
                </rect>
                <text x={span + 130} y={y + 10} fill="#e2e8f0">{index === 0 ? "Local" : index < 3 ? "Intermediate" : "Global"}</text>
                {index < drawn - 1 && flags[index] ? <rect x={70 + index * 18} y={y - 16} width="10" height="16" fill={MATERIALS.via.color} /> : null}
              </g>
            );
          })}
        </svg>
      }
      readouts={
        <>
          <Measure label="M1–M2" value={connected ? "Via connects them" : "Open between M1 and M2"} />
          <Badge tone="info">Lower metals are finer. Upper metals are wider.</Badge>
          <Observe change="Remove vias, then add them back." see="A via is the only vertical connection between neighboring metals. The selected net lights the metals it can reach." why="Local routes stay on the lower, narrower layers. Global routes use the upper, wider layers. This is the same idea as the routing labs, drawn as a stack." experiment="Set four metals and only one via." takeaway="Educational stack. Not a process design kit." />
        </>
      }
    />
  );
}

export function CrossSectionLab() {
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("full");
  const [selected, setSelected] = useState("channel");
  const rank = { device: 0, cell: 1, stack: 2, full: 3 } as const;
  const visible = STACK_PARTS.filter((part) => rank[part.level] <= rank[level]);
  const part = visible.find((item) => item.id === selected) ?? visible[0] ?? STACK_PARTS[0]!;
  return (
    <VlsiGrid
      controls={
        <Choice label="Zoom" value={level} options={LEVELS.map((item) => ({ id: item, label: item === "stack" ? "Interconnect" : item === "full" ? "Full section" : item === "device" ? "Device" : "Cell" }))} onChange={setLevel} />
      }
      stage={
        <>
          <div className="vlsi-path-row">
            {visible.map((item) => (
              <button key={item.id} type="button" className={item.id === part.id ? "on" : ""} onClick={() => setSelected(item.id)}>{item.name}</button>
            ))}
          </div>
          <svg className="vlsi-layout" viewBox="0 0 320 210" role="img" aria-label="Chip cross-section from transistor to passivation">
            {visible.map((item) => (
              <rect key={item.id} x="40" y={item.y} width="200" height="16" fill={MATERIALS[item.material].color} stroke={item.id === part.id ? "#22d3ee" : "#0f172a"} onClick={() => setSelected(item.id)} />
            ))}
          </svg>
        </>
      }
      readouts={
        <>
          <Measure label="Name" value={part.name} />
          <Measure label="Zone" value={part.zone.toUpperCase()} />
          <Measure label="Material" value={MATERIALS[part.material].name} />
          <Measure label="Purpose" value={part.purpose} />
          <Badge tone="info">{part.zone === "feol" ? "Devices" : part.zone === "mol" ? "Contacts" : "Metals"}</Badge>
          <Observe change="Zoom from the device to the full section, then click a stripe." see="FEOL is the transistor, MOL is the contact and local metal, BEOL is the via and metal stack up to passivation." why="Each stripe is a named layer in the shared stack, so the same materials appear in the fabrication labs." experiment="Select the via and read its purpose." takeaway="Click a layer. The readout is that layer, not a generic card." />
        </>
      }
    />
  );
}

export function WaferLab() {
  const [diameter, setDiameter] = useState(30);
  const [dieW, setDieW] = useState(4);
  const [dieH, setDieH] = useState(4);
  const [edge, setEdge] = useState(2);
  const [density, setDensity] = useState(0.01);
  const [seed, setSeed] = useState(4);
  const [picked, setPicked] = useState(0);
  const map = useMemo(() => waferMap({ diameter, dieW, dieH, edge, density, seed }), [diameter, dieW, dieH, edge, density, seed]);
  const die = map.dies[Math.min(picked, Math.max(0, map.dies.length - 1))];
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Wafer diameter" value={diameter} min={20} max={40} step={2} text={`${diameter} cm`} onChange={setDiameter} />
          <Slider label="Die width" value={dieW} min={3} max={8} step={1} text={`${dieW}`} onChange={setDieW} />
          <Slider label="Die height" value={dieH} min={3} max={8} step={1} text={`${dieH}`} onChange={setDieH} />
          <Slider label="Edge exclusion" value={edge} min={0} max={6} step={1} text={`${edge}`} onChange={setEdge} />
          <Slider label="Defect density" value={density} min={0} max={0.04} step={0.005} text={density.toFixed(3)} onChange={setDensity} />
          <Slider label="Seed" value={seed} min={1} max={40} step={1} text={`${seed}`} onChange={setSeed} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 220 220" role="img" aria-label="Wafer with dies and defects">
          <circle cx="110" cy="110" r="96" fill="#334155" stroke="#94a3b8" />
          {map.dies.map((item, index) => (
            <rect key={`${item.col}-${item.row}`} x={110 + item.x * 4 - 4} y={110 + item.y * 4 - 4} width="7" height="7" fill={item.kind === "good" ? "#34d399" : item.kind === "failed" ? "#fb7185" : "#64748b"} stroke={index === picked ? "#f8fafc" : "none"} onClick={() => setPicked(index)} />
          ))}
        </svg>
      }
      readouts={
        <>
          <Measure label="Gross dies" value={`${map.gross}`} />
          <Measure label="Edge dies" value={`${map.edge}`} />
          <Measure label="Good dies" value={`${map.good}`} />
          <Measure label="Failed dies" value={`${map.failed}`} />
          <Measure label="Wafer yield" value={`${(map.yield * 100).toFixed(0)} %`} />
          <Measure label="Selected die" value={die ? `${die.col}, ${die.row} · ${die.kind} · ${die.defects} defects` : "None"} />
          <Observe change="Raise defect density or change the seed." see="Red dies are failed full dies. Gray dies are clipped by the edge. The same seed rebuilds the same map." why="Defects are placed with a seeded generator inside the usable wafer." experiment="Click a die and read its coordinates." takeaway="Yield here is good full dies divided by all full dies." />
        </>
      }
    />
  );
}

export function YieldLab() {
  const [area, setArea] = useState(2);
  const [density, setDensity] = useState(0.08);
  const [diameter, setDiameter] = useState(30);
  const [model, setModel] = useState<"poisson" | "murphy">("poisson");
  const analytical = model === "poisson" ? poissonYield(area, density) : murphyYield(area, density);
  const side = Math.max(1.2, Math.sqrt(area));
  const map = useMemo(() => waferMap({ diameter, dieW: side, dieH: side, edge: 1.5, density, seed: 5 }), [diameter, area, density, side]);
  const areaSeries = Array.from({ length: 12 }, (_, index) => {
    const sample = 0.4 + index * 0.6;
    return { x: sample, y: (model === "poisson" ? poissonYield(sample, density) : murphyYield(sample, density)) * 100 };
  });
  const defectSeries = Array.from({ length: 12 }, (_, index) => {
    const sample = index * 0.03;
    return { x: sample, y: (model === "poisson" ? poissonYield(area, sample) : murphyYield(area, sample)) * 100 };
  });
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Model" value={model} options={[{ id: "poisson", label: "Poisson" }, { id: "murphy", label: "Murphy" }]} onChange={setModel} />
          <Slider label="Die area" value={area} min={0.4} max={8} step={0.2} text={area.toFixed(1)} onChange={setArea} />
          <Slider label="Defect density" value={density} min={0.01} max={0.3} step={0.01} text={density.toFixed(2)} onChange={setDensity} />
          <Slider label="Wafer diameter" value={diameter} min={20} max={40} step={2} text={`${diameter}`} onChange={setDiameter} />
        </>
      }
      stage={
        <div className="vlsi-split">
          <svg className="vlsi-layout" viewBox="0 0 220 220" role="img" aria-label="Wafer map for the current yield settings">
            <circle cx="110" cy="110" r="96" fill="#334155" stroke="#94a3b8" />
            {map.dies.map((item) => {
              const scale = 90 / Math.max(1, diameter / 2);
              const mark = Math.max(2.5, side * scale - 1);
              return <rect key={`${item.col}-${item.row}`} x={110 + item.x * scale - mark / 2} y={110 + item.y * scale - mark / 2} width={mark} height={mark} fill={item.kind === "good" ? "#34d399" : item.kind === "failed" ? "#fb7185" : "#64748b"} />;
            })}
          </svg>
          <div>
            <Chart series={[{ name: "Area", color: "#22d3ee", points: areaSeries }]} xMax={8} yMax={100} xLabel="Die area" yLabel="Yield %" ariaLabel="Yield versus die area" />
            <Chart series={[{ name: "Defects", color: "#fb7185", points: defectSeries }]} xMax={0.36} yMax={100} xLabel="Defect density" yLabel="Yield %" ariaLabel="Yield versus defect density" />
          </div>
        </div>
      }
      readouts={
        <>
          <Measure label="Model yield" value={`${(analytical * 100).toFixed(1)} %`} />
          <Measure label="Good dies on map" value={`${map.good}`} />
          <Measure label="Failed dies on map" value={`${map.failed}`} />
          <Measure label="Map yield" value={`${(map.yield * 100).toFixed(0)} %`} />
          <Badge tone="info">{model === "poisson" ? "Y = exp(−AD)" : "Murphy comparison"}</Badge>
          <Observe change="Increase defect density, then increase die area." see="Both the formula and the wafer map lose good dies." why="Poisson yield is exp(−AD). A larger die is more likely to contain a defect. The map uses the same wafer function as the wafer lab, with seed 5." experiment="Switch to the Murphy curve. It falls more slowly than Poisson." takeaway="Educational yield. Not a factory cost model." />
        </>
      }
    />
  );
}
