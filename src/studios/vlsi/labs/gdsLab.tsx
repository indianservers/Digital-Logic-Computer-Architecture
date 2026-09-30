import { useState } from "react";
import { cellColor, emptyFlow, GDS_STAGES, invalidateDownstream, runStage, runThrough, type DesignId, type GdsStage, type GdsState } from "../gdsFlow";
import { VlsiGrid } from "../shell";
import { Badge, Choice, Measure, Observe, Slider } from "../widgets";

const DESIGNS: DesignId[] = ["adder2", "adder4", "counter", "mux", "fsm", "alu"];

export function RtlGdsLab() {
  const [state, setState] = useState<GdsState>(() => emptyFlow("adder4"));
  const [focus, setFocus] = useState<GdsStage>("rtl");
  const [layers, setLayers] = useState({ cells: true, metal: true, clock: true, power: true, vias: true });
  const apply = (next: GdsState) => setState(next);
  const run = (stage: GdsStage) => apply(runStage(state, stage));
  const changeDesign = (design: DesignId) => apply(emptyFlow(design, state.params));
  const changeParam = (partial: Partial<GdsState["params"]>, from: GdsStage) => {
    apply(invalidateDownstream({ ...state, params: { ...state.params, ...partial } }, from));
  };
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Design" value={state.design} options={DESIGNS.map((id) => ({ id, label: id }))} onChange={changeDesign} />
          <Choice label="Stage" value={focus} options={GDS_STAGES.map((id) => ({ id, label: id }))} onChange={setFocus} />
          <Choice label="Map goal" value={state.params.goal} options={[{ id: "area", label: "Area" }, { id: "timing", label: "Timing" }, { id: "balanced", label: "Balanced" }]} onChange={(goal) => changeParam({ goal }, "map")} />
          <Slider label="Utilization" value={state.params.utilization} min={0.4} max={0.95} step={0.05} text={state.params.utilization.toFixed(2)} onChange={(value) => changeParam({ utilization: value }, "floor")} />
          <Slider label="Aspect" value={state.params.aspect} min={0.6} max={1.8} step={0.1} text={state.params.aspect.toFixed(1)} onChange={(value) => changeParam({ aspect: value }, "floor")} />
          <Choice label="Placement" value={state.params.placeMode} options={[{ id: "timing", label: "Timing" }, { id: "congestion", label: "Congestion" }, { id: "greedy", label: "Greedy" }]} onChange={(placeMode) => changeParam({ placeMode }, "place")} />
          <Slider label="Skew budget" value={state.params.skewBudget} min={0.05} max={1} step={0.05} text={state.params.skewBudget.toFixed(2)} onChange={(value) => changeParam({ skewBudget: value }, "cts")} />
          <Slider label="Clock period" value={state.params.periodNs} min={0.5} max={5} step={0.1} text={`${state.params.periodNs.toFixed(1)} ns`} onChange={(value) => changeParam({ periodNs: value }, "sta")} />
          <Slider label="VDD" value={state.params.vdd} min={0.6} max={1.2} step={0.05} text={`${state.params.vdd.toFixed(2)} V`} onChange={(value) => changeParam({ vdd: value }, "power")} />
          <Slider label="Metal layers" value={state.params.layers} min={2} max={6} step={1} text={`${state.params.layers}`} onChange={(value) => changeParam({ layers: value }, "route")} />
          <button type="button" onClick={() => run(focus)}>Run stage</button>
          <button type="button" onClick={() => apply(runThrough(invalidateDownstream(state, "rtl"), focus))}>Run through here</button>
        </>
      }
      stage={
        <>
          <div className="vlsi-path-row">
            {GDS_STAGES.map((stage) => (
              <button key={stage} type="button" className={stage === focus ? "on" : ""} onClick={() => setFocus(stage)}>{stage}<i /></button>
            ))}
          </div>
          <div className="vlsi-choice">
            {(["cells", "metal", "clock", "power", "vias"] as const).map((layer) => (
              <button key={layer} type="button" className={layers[layer] ? "on" : ""} onClick={() => setLayers((current) => ({ ...current, [layer]: !current[layer] }))}>{layer}</button>
            ))}
          </div>
          <svg className="vlsi-layout" viewBox="0 0 320 180" role="img" aria-label="Educational GDS layout">
            <rect x="16" y="16" width="280" height="148" fill="#020617" stroke="#334155" />
            {layers.power ? <rect x="24" y="24" width="264" height="8" fill="#b45309" /> : null}
            {layers.cells ? state.cells.slice(0, 40).map((cell) => (
              <rect key={cell.id} x={30 + (cell.x % 48) * 4} y={40 + cell.y} width={Math.max(6, cell.w * 2)} height="6" fill={cellColor(cell.name)} />
            )) : null}
            {layers.metal ? <path d="M40 80 H260" stroke="#fbbf24" strokeWidth="2" /> : null}
            {layers.clock ? <path d="M40 100 H180 V130" stroke="#22d3ee" fill="none" /> : null}
            {layers.vias ? state.cells.slice(0, Math.min(12, state.vias)).map((cell) => (
              <rect key={`via-${cell.id}`} x={32 + (cell.x % 48) * 4} y={78} width="3" height="3" fill="#f8fafc" />
            )) : null}
          </svg>
        </>
      }
      readouts={
        <>
          <Measure label="RTL lines" value={`${state.lines}`} />
          <Measure label="Gates" value={`${state.gates.length}`} />
          <Measure label="Cells" value={`${state.mapped.length}`} />
          <Measure label="Placed" value={`${state.placed}`} />
          <Measure label="Wire" value={state.wire.toFixed(1)} />
          <Measure label="Vias" value={`${state.vias}`} />
          <Measure label="Slack" value={`${state.slackNs.toFixed(2)} ns`} />
          <Measure label="Dynamic" value={`${(state.dynamic * 1e6).toFixed(2)} µW`} />
          <Measure label="Leakage" value={`${(state.leakage * 1e9).toFixed(2)} nW`} />
          <Measure label="Skew" value={state.skew.toFixed(3)} />
          <Measure label="DRC" value={`${state.drc}`} />
          <Measure label="LVS" value={state.lvs} />
          <Badge tone={state.status[focus] === "pass" ? "on" : state.status[focus] === "fail" ? "bad" : state.status[focus] === "warn" ? "warn" : "info"}>{state.status[focus]}</Badge>
          <Observe change="Run through mapping, then lower utilization." see="Floorplan and everything after it return to not-run. Mapping stays." why="Downstream stages read the mapped cell list, the placed coordinates, and the routed length. They are not a fresh random design." experiment="Run through GDS, then shorten the clock period and rerun STA." takeaway={state.log[state.log.length - 1] ?? "Pick a stage and run it."} />
        </>
      }
    />
  );
}
