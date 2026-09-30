import { useMemo, useState } from "react";
import type { PointerEvent } from "react";
import {
  MINI_SOC_MACROS,
  autoFloorplan,
  clockBaseline,
  congestionGrid,
  coreBox,
  estimatedWire,
  floorplanMetrics,
  optimizeFully,
  placementMetric,
  planPower,
  placeStandardCells,
  routeNet,
  scrambledPlacement,
  stepOptimization,
  synthesizeClock,
  type CellMove,
  type ClockSink,
  type Macro,
  type OptTarget,
  type PlaceState,
  type PlacementResult,
} from "../physicalModel";
import { VlsiGrid } from "../shell";
import { Badge, Choice, Measure, Observe, Slider } from "../widgets";

function useChip(macros: Macro[], dieW: number, dieH: number, coreUtil: number) {
  return useMemo(() => ({ dieW, dieH, coreUtil, macros }), [dieW, dieH, coreUtil, macros]);
}

export function FloorplanLab() {
  const [dieW, setDieW] = useState(120);
  const [dieH, setDieH] = useState(96);
  const [coreUtil, setCore] = useState(0.72);
  const [macros, setMacros] = useState<Macro[]>(MINI_SOC_MACROS);
  const [selected, setSelected] = useState("sram");
  const [drag, setDrag] = useState<string | null>(null);
  const chip = useChip(macros, dieW, dieH, coreUtil);
  const metrics = floorplanMetrics(chip);
  const core = coreBox(chip);
  const current = macros.find((macro) => macro.id === selected) ?? macros[0];
  function move(id: string, x: number, y: number) {
    setMacros((items) => items.map((macro) => macro.id === id ? { ...macro, x, y } : macro));
  }
  function onMove(event: PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * dieW;
    const y = ((event.clientY - bounds.top) / bounds.height) * dieH;
    const macro = macros.find((item) => item.id === drag);
    if (!macro) return;
    move(drag, Math.max(0, Math.min(dieW - macro.w, x - macro.w / 2)), Math.max(0, Math.min(dieH - macro.h, y - macro.h / 2)));
  }
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Die width" value={dieW} min={90} max={160} step={2} text={`${dieW.toFixed(0)}`} onChange={setDieW} />
          <Slider label="Die height" value={dieH} min={70} max={140} step={2} text={`${dieH.toFixed(0)}`} onChange={setDieH} />
          <Slider label="Core utilization" value={coreUtil} min={0.5} max={0.9} step={0.02} text={`${Math.round(coreUtil * 100)}%`} onChange={setCore} />
          <Choice label="Macro" value={selected} options={macros.map((macro) => ({ id: macro.id, label: macro.name }))} onChange={setSelected} />
          {current ? <Slider label="Macro X" value={current.x} min={0} max={dieW - current.w} step={1} text={current.x.toFixed(0)} onChange={(value) => move(current.id, value, current.y)} /> : null}
          {current ? <Slider label="Macro Y" value={current.y} min={0} max={dieH - current.h} step={1} text={current.y.toFixed(0)} onChange={(value) => move(current.id, current.x, value)} /> : null}
          <button type="button" onClick={() => setMacros(autoFloorplan(chip))}>Auto floorplan</button>
          <Observe
            change="Drag SRAM toward the CPU, or use the X slider."
            see="Estimated wire length drops when those centers get closer, and overlap turns the badge to a warning."
            why="Wire length is the sum of Manhattan distances on the MiniSoC nets."
            experiment="Slide SRAM left until it touches the CPU."
            takeaway="Floorplan quality here is geometry, not a hidden score."
          />
        </>
      }
      stage={
        <>
          <div className="vlsi-stage-head">
            <h2>MiniSoC floorplan</h2>
            <Badge tone={metrics.overlaps > 0 ? "bad" : "on"}>{metrics.overlaps > 0 ? `${metrics.overlaps} overlaps` : "No overlap"}</Badge>
          </div>
          <svg className="vlsi-chip" viewBox={`0 0 ${dieW} ${dieH}`} role="img" aria-label="Chip floorplan" onPointerMove={onMove} onPointerUp={() => setDrag(null)}>
            <rect x="0" y="0" width={dieW} height={dieH} fill="#111827" />
            <rect x={core.x} y={core.y} width={core.w} height={core.h} fill="none" stroke="#64748b" strokeDasharray="2 2" />
            {macros.map((macro) => (
              <g key={macro.id} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDrag(macro.id); setSelected(macro.id); }}>
                <rect x={macro.x} y={macro.y} width={macro.w} height={macro.h} className={macro.id === selected ? "vlsi-gate on" : "vlsi-gate"} />
                <text className="vlsi-svg-label" x={macro.x + 2} y={macro.y + 10}>{macro.name}</text>
              </g>
            ))}
          </svg>
        </>
      }
      readouts={
        <>
          <Measure label="Die area" value={metrics.dieArea.toFixed(0)} />
          <Measure label="Core area" value={metrics.coreArea.toFixed(0)} />
          <Measure label="Macro utilization" value={`${Math.round(metrics.utilization * 100)}%`} />
          <Measure label="Overlaps" value={String(metrics.overlaps)} />
          <Measure label="Estimated wire" value={estimatedWire(macros).toFixed(1)} />
          <Measure label="Congestion risk" value={metrics.congestion.toFixed(3)} />
        </>
      }
    />
  );
}

export function PowerPlanLab() {
  const [strapWidth, setWidth] = useState(3);
  const [pitch, setPitch] = useState(18);
  const [straps, setStraps] = useState(4);
  const [voltage, setVoltage] = useState(1);
  const [current, setCurrent] = useState(40);
  const chip = useChip(MINI_SOC_MACROS, 120, 96, 0.72);
  const plan = planPower(chip, { strapWidth, pitch, strapCount: straps, voltage, current });
  const core = coreBox(chip);
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Strap width" value={strapWidth} min={1} max={8} step={0.5} text={strapWidth.toFixed(1)} onChange={setWidth} />
          <Slider label="Strap pitch" value={pitch} min={8} max={40} step={1} text={pitch.toFixed(0)} onChange={setPitch} />
          <Slider label="Strap count" value={straps} min={1} max={8} step={1} text={String(straps)} onChange={setStraps} />
          <Slider label="Voltage" value={voltage} min={0.6} max={1.2} step={0.05} text={`${voltage.toFixed(2)} V`} onChange={setVoltage} />
          <Slider label="Estimated current" value={current} min={10} max={120} step={5} text={`${current.toFixed(0)} mA`} onChange={setCurrent} />
          <Observe
            change="Widen the straps or add more of them."
            see="Resistance and the drop indicator fall. A large pitch or fewer than three straps raises the sparse warning."
            why="Each strap shares the current. Resistance falls as the strap gets wider."
            experiment="Set the count to 1 and the pitch to 36."
            takeaway="This is a grid preview. Signoff IR drop is a later lab."
          />
        </>
      }
      stage={
        <>
          <div className="vlsi-stage-head">
            <h2>Power grid</h2>
            <Badge tone={plan.sparse ? "warn" : "on"}>{plan.sparse ? "Sparse grid" : "Grid covers the core"}</Badge>
          </div>
          <svg className="vlsi-chip" viewBox="0 0 120 96" role="img" aria-label="Power straps">
            <rect x="0" y="0" width="120" height="96" fill="#111827" />
            <rect x={core.x} y={core.y} width={core.w} height={core.h} fill="none" stroke="#334155" />
            {plan.stripes.map((stripe) => (
              <rect key={stripe.id} x={stripe.x} y={stripe.y} width={stripe.w} height={stripe.h} fill={stripe.net === "VDD" ? "#f59e0b" : "#38bdf8"} opacity={stripe.axis === "rail" ? 0.45 : 0.8} />
            ))}
          </svg>
          <p className="vlsi-callout">Amber is VDD. Blue is VSS. Thin lines are cell rails. Rings sit on the core boundary.</p>
        </>
      }
      readouts={
        <>
          <Measure label="Grid coverage" value={`${Math.round(plan.coverage * 100)}%`} />
          <Measure label="Current per strap" value={`${plan.maxCurrent.toFixed(1)} mA`} />
          <Measure label="Approx resistance" value={`${plan.resistance.toFixed(2)} Ω`} />
          <Measure label="Approx drop" value={`${plan.drop.toFixed(1)} mV`} hint={`${voltage.toFixed(2)} V supply`} />
        </>
      }
    />
  );
}

export function PlacementLab() {
  const [count, setCount] = useState(24);
  const [util, setUtil] = useState(0.7);
  const [mode, setMode] = useState<"greedy" | "timing" | "congestion">("greedy");
  const [seed, setSeed] = useState(1);
  const [lock, setLock] = useState(true);
  const [current, setCurrent] = useState<PlacementResult | null>(null);
  const [previous, setPrevious] = useState<PlacementResult | null>(null);
  function run() {
    setPrevious(current);
    setCurrent(placeStandardCells({ count, utilization: util, mode, seed, lockMacros: lock }));
  }
  const shown = current;
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Cell count" value={count} min={8} max={60} step={1} text={String(count)} onChange={setCount} />
          <Slider label="Target utilization" value={util} min={0.4} max={0.9} step={0.05} text={`${Math.round(util * 100)}%`} onChange={setUtil} />
          <Slider label="Seed" value={seed} min={0} max={12} step={1} text={String(seed)} onChange={setSeed} />
          <Choice label="Mode" value={mode} options={[{ id: "greedy", label: "Greedy" }, { id: "timing", label: "Timing aware" }, { id: "congestion", label: "Spread" }]} onChange={setMode} />
          <Choice label="Macros" value={lock ? "lock" : "free"} options={[{ id: "lock", label: "Lock macros" }, { id: "free", label: "Allow overlap" }]} onChange={(value) => setLock(value === "lock")} />
          <button type="button" onClick={run}>Run placement</button>
          <button type="button" onClick={() => { setCurrent(null); setPrevious(null); }}>Reset</button>
          <Observe
            change="Run placement, then raise utilization or unlock the macros."
            see="Locked macros keep cells out of the reserved sites, so overlap stays at zero. Unlocked placement counts cells sitting on that region."
            why="Rows fill left to right. Timing mode pulls critical cells forward. Spread mode inserts gaps."
            experiment="Run once locked, then again unlocked, and compare overlap."
            takeaway="A legal result is a packing with no cell-to-cell overlap."
          />
        </>
      }
      stage={
        <>
          <h2>Standard-cell rows</h2>
          {shown ? <CellCanvas cells={shown} /> : <p className="vlsi-callout">Run placement to pack the MiniSoC rows.</p>}
        </>
      }
      readouts={
        <>
          <Measure label="Cells" value={shown ? String(shown.cells.length) : "—"} />
          <Measure label="Utilization" value={shown ? `${Math.round(shown.utilization * 100)}%` : "—"} />
          <Measure label="HPWL" value={shown ? shown.hpwl.toFixed(1) : "—"} hint={previous ? `previous ${previous.hpwl.toFixed(1)}` : undefined} />
          <Measure label="Density" value={shown ? shown.density.toFixed(2) : "—"} />
          <Measure label="Max local density" value={shown ? shown.maxDensity.toFixed(2) : "—"} />
          <Measure label="Overlaps" value={shown ? String(shown.overlaps) : "—"} />
        </>
      }
    />
  );
}

function CellCanvas({ cells }: { cells: PlacementResult }) {
  const width = 68;
  const height = Math.max(24, cells.rows * 10 + 8);
  return (
    <svg className="vlsi-chip" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Placed cells">
      <rect x="0" y="0" width={width} height={height} fill="#111827" />
      {Array.from({ length: cells.rows }, (_, row) => <line key={row} x1="2" x2={width - 2} y1={6 + row * 10} y2={6 + row * 10} className="vlsi-wire" />)}
      {cells.cells.map((cell) => (
        <rect key={cell.id} x={2 + cell.x} y={2 + cell.row * 10} width={cell.w} height="6" className={cell.critical ? "vlsi-gate crit" : "vlsi-gate on"} />
      ))}
    </svg>
  );
}

export function PlacementOptLab() {
  const [target, setTarget] = useState<OptTarget>("wire");
  const [start] = useState<PlaceState>(() => scrambledPlacement(12));
  const [state, setState] = useState<PlaceState>(start);
  const [moves, setMoves] = useState<CellMove[]>([]);
  const before = placementMetric(start, target);
  const after = placementMetric(state, target);
  function step() {
    const next = stepOptimization(state, target);
    setState(next.state);
    setMoves(next.moves);
  }
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Target" value={target} options={[{ id: "wire", label: "Wirelength" }, { id: "timing", label: "Timing" }, { id: "congestion", label: "Congestion" }, { id: "balanced", label: "Balanced" }]} onChange={setTarget} />
          <button type="button" onClick={step}>Step</button>
          <button type="button" onClick={() => { setState(optimizeFully(state, target)); setMoves([]); }}>Run to end</button>
          <button type="button" onClick={() => { setState(start); setMoves([]); }}>Reset</button>
          <Observe
            change="Step the wirelength target."
            see="Paired cells walk toward each other and HPWL falls. Congestion increases the gap, which lowers the density metric."
            why="Each step is one swap or one wider gap, measured again from the coordinates."
            experiment="Reset, note HPWL, then step several times."
            takeaway="The improvement is the metric of the target you selected."
          />
        </>
      }
      stage={
        <>
          <h2>Optimization heatmap</h2>
          <OptCanvas state={state} moves={moves} />
          <p className="vlsi-callout">{moves.length > 0 ? moves.map((move) => `${move.id} ${move.fromX}→${move.toX}`).join(", ") : "No cell moved on the last step."}</p>
        </>
      }
      readouts={
        <>
          <Measure label="Objective before" value={before.toFixed(2)} />
          <Measure label="Objective now" value={after.toFixed(2)} />
          <Measure label="HPWL" value={placementMetric(state, "wire").toFixed(1)} />
          <Measure label="Timing cost" value={placementMetric(state, "timing").toFixed(1)} />
          <Measure label="Density metric" value={placementMetric(state, "congestion").toFixed(2)} />
        </>
      }
    />
  );
}

function OptCanvas({ state, moves }: { state: PlaceState; moves: CellMove[] }) {
  const width = 70;
  return (
    <svg className="vlsi-chip" viewBox={`0 0 ${width} 36`} role="img" aria-label="Cell movement">
      <rect width={width} height="36" fill="#111827" />
      {state.order.map((id, index) => {
        const moved = moves.some((move) => move.id === `c${id}`);
        const x = 2 + (index % 16) * 4;
        const y = 6 + Math.floor(index / 16) * 12;
        return <rect key={`${id}-${index}`} x={x} y={y} width="3" height="8" fill={moved ? "#f87171" : id % 5 === 0 ? "#fb7185" : "#22d3ee"} />;
      })}
    </svg>
  );
}

export function RoutingLab() {
  const [mode, setMode] = useState<"global" | "detailed">("detailed");
  const [layers, setLayers] = useState(3);
  const [viaCost, setVia] = useState(1);
  const [penalty, setPenalty] = useState(1);
  const [blocked, setBlocked] = useState(true);
  const source = { x: 8, y: 20 };
  const sink = { x: 90, y: 70 };
  const block = blocked ? { x: 36, y: 14, w: 22, h: 16 } : null;
  const route = routeNet(source, sink, { mode, layers, viaCost, congestionPenalty: penalty, blocked: block });
  const points = route.points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Mode" value={mode} options={[{ id: "global", label: "Global" }, { id: "detailed", label: "Detailed" }]} onChange={setMode} />
          <Slider label="Routing layers" value={layers} min={1} max={6} step={1} text={String(layers)} onChange={setLayers} />
          <Slider label="Via cost" value={viaCost} min={0} max={5} step={0.5} text={viaCost.toFixed(1)} onChange={setVia} />
          <Slider label="Congestion penalty" value={penalty} min={0.2} max={3} step={0.2} text={penalty.toFixed(1)} onChange={setPenalty} />
          <Choice label="Blockage" value={blocked ? "on" : "off"} options={[{ id: "on", label: "Block channel" }, { id: "off", label: "Open" }]} onChange={(value) => setBlocked(value === "on")} />
          <Observe
            change="Block the channel."
            see="The route leaves the straight line and reconnects at the same sink. Length changes."
            why="Global mode snaps bends to a coarse grid. Detailed mode keeps the bend coordinates."
            experiment="Toggle the blockage and watch length and via count."
            takeaway="This router lives in VLSI Studio. It is not the logic-routing studio."
          />
        </>
      }
      stage={
        <>
          <h2>{mode === "global" ? "Global routing" : "Detailed routing"}</h2>
          <svg className="vlsi-chip" viewBox="0 0 110 90" role="img" aria-label="Routed net">
            <rect width="110" height="90" fill="#111827" />
            {block ? <rect x={block.x} y={block.y} width={block.w} height={block.h} fill="#7f1d1d" opacity="0.8" /> : null}
            <polyline points={points} className="vlsi-wire on" />
            <circle cx={source.x} cy={source.y} r="2.5" fill="#4ade80" />
            <circle cx={sink.x} cy={sink.y} r="2.5" fill="#fbbf24" />
          </svg>
        </>
      }
      readouts={
        <>
          <Measure label="Connects" value={route.connects ? "yes" : "no"} />
          <Measure label="Wire length" value={route.length.toFixed(1)} />
          <Measure label="Vias" value={String(route.vias)} />
          <Measure label="Route cost" value={route.cost.toFixed(1)} />
          <Measure label="Overflow" value={route.overflow.toFixed(2)} />
        </>
      }
    />
  );
}

export function CongestionLab() {
  const [density, setDensity] = useState(0.8);
  const [layers, setLayers] = useState(2);
  const [tracks, setTracks] = useState(2);
  const [blocked, setBlocked] = useState(true);
  const [pick, setPick] = useState(20);
  const grid = congestionGrid({ density, layers, tracks, blocked });
  const bin = grid.bins[pick] ?? grid.bins[0];
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Placement density" value={density} min={0.2} max={1.4} step={0.1} text={density.toFixed(1)} onChange={setDensity} />
          <Slider label="Routing layers" value={layers} min={1} max={4} step={1} text={String(layers)} onChange={setLayers} />
          <Slider label="Tracks per bin" value={tracks} min={1} max={8} step={1} text={String(tracks)} onChange={setTracks} />
          <Choice label="Macro blockage" value={blocked ? "on" : "off"} options={[{ id: "on", label: "Block one bin" }, { id: "off", label: "No blockage" }]} onChange={(value) => setBlocked(value === "on")} />
          <Observe
            change="Lower the track count."
            see="Bins whose demand exceeds capacity turn hot, and total overflow rises."
            why="Demand follows placement density. Capacity is layers times tracks, and a blocked bin has none."
            experiment="Set tracks to 8, then back to 1."
            takeaway="Congestion is demand minus capacity, summed where that difference is positive."
          />
        </>
      }
      stage={
        <>
          <h2>Routing demand</h2>
          <svg className="vlsi-heat" viewBox="0 0 160 120" role="img" aria-label="Congestion heatmap">
            {grid.bins.map((item, index) => {
              const tone = item.overflow <= 0 ? 150 : Math.min(255, 80 + item.overflow * 30);
              return (
                <rect
                  key={`${item.x}-${item.y}`}
                  x={item.x * 20}
                  y={item.y * 20}
                  width="18"
                  height="18"
                  fill={item.overflow <= 0 ? "#115e59" : `rgb(${tone}, 40, 50)`}
                  stroke={index === pick ? "#f8fafc" : "transparent"}
                  onClick={() => setPick(index)}
                />
              );
            })}
          </svg>
        </>
      }
      readouts={
        <>
          <Measure label="Overflow" value={grid.overflow.toFixed(1)} />
          <Measure label="Selected demand" value={bin ? bin.demand.toFixed(1) : "—"} />
          <Measure label="Selected capacity" value={bin ? bin.capacity.toFixed(1) : "—"} />
          <Measure label="Selected overflow" value={bin ? bin.overflow.toFixed(1) : "—"} />
          <Measure label="Nets in bin" value={bin ? bin.nets.join(", ") : "—"} />
        </>
      }
    />
  );
}

const ROOT = { x: 12, y: 48 };

export function ClockTreeSynthLab() {
  const [style, setStyle] = useState<"binary" | "cluster" | "h-tree">("h-tree");
  const [mode, setMode] = useState<"before" | "after">("after");
  const [sinks, setSinks] = useState<ClockSink[]>([
    { id: "s0", x: 30, y: 16 },
    { id: "s1", x: 100, y: 18 },
    { id: "s2", x: 36, y: 78 },
    { id: "s3", x: 104, y: 80 },
  ]);
  const [which, setWhich] = useState("s1");
  const before = clockBaseline(sinks, ROOT);
  const after = synthesizeClock(sinks, ROOT, style);
  const shown = mode === "before" ? before : after;
  const selected = sinks.find((sink) => sink.id === which) ?? sinks[0];
  function move(axis: "x" | "y", value: number) {
    setSinks((items) => items.map((sink) => sink.id === which ? { ...sink, [axis]: value } : sink));
  }
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="View" value={mode} options={[{ id: "before", label: "Before CTS" }, { id: "after", label: "After CTS" }]} onChange={setMode} />
          <Choice label="Tree" value={style} options={[{ id: "h-tree", label: "H-tree" }, { id: "binary", label: "Balanced binary" }, { id: "cluster", label: "Clustered" }]} onChange={setStyle} />
          <Choice label="Sink" value={which} options={sinks.map((sink) => ({ id: sink.id, label: sink.id }))} onChange={setWhich} />
          {selected ? <Slider label="Sink X" value={selected.x} min={16} max={110} step={2} text={selected.x.toFixed(0)} onChange={(value) => move("x", value)} /> : null}
          {selected ? <Slider label="Sink Y" value={selected.y} min={8} max={88} step={2} text={selected.y.toFixed(0)} onChange={(value) => move("y", value)} /> : null}
          <Observe
            change="Move a near sink farther from the root, then look at Before CTS."
            see="Skew is the latest arrival minus the earliest. After CTS, buffers pad the short branches."
            why="Baseline delay is wire distance only. Synthesis inserts buffers so arrivals meet near the longest branch."
            experiment="Compare max skew before and after with the default sinks."
            takeaway="Lab 20 shows a clock tree. This lab builds one to cut skew."
          />
        </>
      }
      stage={
        <>
          <div className="vlsi-stage-head">
            <h2>{mode === "before" ? "Unbalanced star" : "Buffered tree"}</h2>
            <Badge tone="info">{style}</Badge>
          </div>
          <svg className="vlsi-chip" viewBox="0 0 120 96" role="img" aria-label="Clock tree">
            <rect width="120" height="96" fill="#111827" />
            {mode === "after" ? after.buffersAt.map((buffer) => (
              <g key={buffer.id}>
                <line x1={ROOT.x} y1={ROOT.y} x2={buffer.x} y2={buffer.y} className="vlsi-wire on" />
                <rect x={buffer.x - 2} y={buffer.y - 2} width="4" height="4" fill="#fbbf24" />
              </g>
            )) : null}
            {sinks.map((sink) => (
              <g key={sink.id}>
                <line x1={mode === "before" ? ROOT.x : (after.buffersAt.find((buffer) => buffer.id === `buf-${sink.id}`)?.x ?? ROOT.x)} y1={mode === "before" ? ROOT.y : (after.buffersAt.find((buffer) => buffer.id === `buf-${sink.id}`)?.y ?? ROOT.y)} x2={sink.x} y2={sink.y} className="vlsi-wire on" />
                <circle cx={sink.x} cy={sink.y} r="2.4" fill={sink.id === which ? "#f8fafc" : "#22d3ee"} />
              </g>
            ))}
            <rect x={ROOT.x - 3} y={ROOT.y - 3} width="6" height="6" fill="#4ade80" />
          </svg>
        </>
      }
      readouts={
        <>
          <Measure label="Skew" value={`${shown.skew.toFixed(3)} ns`} hint={`before ${before.skew.toFixed(3)} · after ${after.skew.toFixed(3)}`} />
          <Measure label="Insertion delay" value={`${shown.insertion.toFixed(3)} ns`} />
          <Measure label="Buffers" value={String(shown.buffers)} />
          <Measure label="Clock wire" value={shown.wire.toFixed(1)} />
          <Measure label="Clock power" value={mode === "after" ? after.power.toFixed(2) : "0"} />
          {shown.arrivals.map((item) => <Measure key={item.id} label={`${item.id} arrival`} value={`${item.arrival.toFixed(3)} ns`} />)}
        </>
      }
    />
  );
}
