import type { CellName } from "./cellLibrary";
import { cmosPower } from "./engine";
import {
  classifyRtl,
  designGates,
  mapNetwork,
  mappedCost,
  optimizeNetwork,
  type GenericGate,
  type MapTarget,
  type MappedInstance,
} from "./flowModel";
import { planPower, placeStandardCells, synthesizeClock, type ChipGeom } from "./physicalModel";

export type DesignId = "adder2" | "adder4" | "counter" | "mux" | "fsm" | "alu";

export const GDS_STAGES = [
  "rtl",
  "elab",
  "synth",
  "opt",
  "map",
  "floor",
  "power",
  "place",
  "cts",
  "route",
  "extract",
  "sta",
  "drc",
  "lvs",
  "gds",
] as const;

export type GdsStage = (typeof GDS_STAGES)[number];
export type StageStatus = "not-run" | "pass" | "warn" | "fail";

export interface GdsParams {
  goal: MapTarget;
  utilization: number;
  aspect: number;
  placeMode: "greedy" | "timing" | "congestion";
  layers: number;
  periodNs: number;
  vdd: number;
  skewBudget: number;
}

export interface GdsState {
  design: DesignId;
  params: GdsParams;
  status: Record<GdsStage, StageStatus>;
  log: string[];
  rtl: string;
  lines: number;
  gates: GenericGate[];
  optimized: GenericGate[];
  mapped: MappedInstance[];
  floorArea: number;
  wire: number;
  placed: number;
  skew: number;
  vias: number;
  slackNs: number;
  dynamic: number;
  leakage: number;
  drc: number;
  lvs: "not-run" | "pass" | "fail";
  cells: Array<{ id: string; x: number; y: number; w: number; name: string }>;
}

export interface DesignBundle {
  rtl: string;
  gates: GenericGate[];
  primary: string[];
  pins: string[];
  output: string;
}

function repeatBits(bits: number, make: (index: number) => GenericGate[]): GenericGate[] {
  return Array.from({ length: bits }, (_, index) => make(index)).flat();
}

export function designBundle(design: DesignId): DesignBundle {
  if (design === "adder2") {
    return {
      rtl: "module add2(input a, b, output sum, cout);\n  assign sum = a ^ b;\n  assign cout = a & b;\nendmodule",
      gates: designGates("adder"),
      primary: ["sum", "cout"],
      pins: ["a", "b"],
      output: "sum",
    };
  }
  if (design === "adder4") {
    return {
      rtl: "module add4(input [3:0] a, b, output [3:0] sum, output cout);\n  assign {cout, sum} = a + b;\nendmodule",
      gates: repeatBits(4, (index) => [
        { id: `xor-${index}`, op: "xor", inputs: [`a${index}`, `b${index}`], output: `sum${index}` },
        { id: `and-${index}`, op: "and", inputs: [`a${index}`, `b${index}`], output: `c${index}` },
      ]),
      primary: ["sum0", "sum1", "sum2", "sum3"],
      pins: ["a0", "b0"],
      output: "sum0",
    };
  }
  if (design === "counter") {
    return {
      rtl: "module cnt(input clk, output reg [1:0] q);\n  always @(posedge clk) q <= q + 1;\nendmodule",
      gates: designGates("counter"),
      primary: ["n0", "n1"],
      pins: ["q0", "q1", "one"],
      output: "n0",
    };
  }
  if (design === "mux") {
    return {
      rtl: "module mux(input a, b, s, output y);\n  assign y = s ? b : a;\nendmodule",
      gates: designGates("mux"),
      primary: ["y"],
      pins: ["a", "b", "s"],
      output: "y",
    };
  }
  if (design === "fsm") {
    return {
      rtl: "module fsm(input clk, x, output reg y);\n  always @(posedge clk) case (y)\n    0: y <= x;\n    default: y <= 0;\n  endcase\nendmodule",
      gates: [
        { id: "n", op: "not", inputs: ["q"], output: "qn" },
        { id: "a", op: "and", inputs: ["x", "qn"], output: "n0" },
        { id: "o", op: "or", inputs: ["n0", "q"], output: "y" },
      ],
      primary: ["y"],
      pins: ["x", "q"],
      output: "y",
    };
  }
  return {
    rtl: "module alu(input a, b, output y, z);\n  assign y = a ^ b;\n  assign z = a & b;\nendmodule",
    gates: [
      { id: "xor", op: "xor", inputs: ["a", "b"], output: "y" },
      { id: "and", op: "and", inputs: ["a", "b"], output: "z" },
    ],
    primary: ["y", "z"],
    pins: ["a", "b"],
    output: "y",
  };
}

function blankStatus(): Record<GdsStage, StageStatus> {
  return {
    rtl: "not-run", elab: "not-run", synth: "not-run", opt: "not-run", map: "not-run",
    floor: "not-run", power: "not-run", place: "not-run", cts: "not-run", route: "not-run",
    extract: "not-run", sta: "not-run", drc: "not-run", lvs: "not-run", gds: "not-run",
  };
}

export function emptyFlow(design: DesignId, params?: Partial<GdsParams>): GdsState {
  const bundle = designBundle(design);
  return {
    design,
    params: {
      goal: "balanced",
      utilization: 0.7,
      aspect: 1,
      placeMode: "timing",
      layers: 4,
      periodNs: 2,
      vdd: 0.9,
      skewBudget: 0.4,
      ...params,
    },
    status: blankStatus(),
    log: [],
    rtl: bundle.rtl,
    lines: bundle.rtl.split("\n").length,
    gates: [],
    optimized: [],
    mapped: [],
    floorArea: 0,
    wire: 0,
    placed: 0,
    skew: 0,
    vias: 0,
    slackNs: 0,
    dynamic: 0,
    leakage: 0,
    drc: 0,
    lvs: "not-run",
    cells: [],
  };
}

export function invalidateDownstream(state: GdsState, stage: GdsStage): GdsState {
  const start = GDS_STAGES.indexOf(stage);
  const status = { ...state.status };
  for (let index = start; index < GDS_STAGES.length; index += 1) {
    const id = GDS_STAGES[index];
    if (id) status[id] = "not-run";
  }
  return { ...state, status, lvs: start <= GDS_STAGES.indexOf("lvs") ? "not-run" : state.lvs };
}

function previousReady(state: GdsState, stage: GdsStage): boolean {
  const index = GDS_STAGES.indexOf(stage);
  if (index <= 0) return true;
  const prior = GDS_STAGES[index - 1];
  return prior !== undefined && state.status[prior] !== "not-run" && state.status[prior] !== "fail";
}

export function runStage(state: GdsState, stage: GdsStage): GdsState {
  if (!previousReady(state, stage)) {
    const prior = GDS_STAGES[GDS_STAGES.indexOf(stage) - 1] ?? "rtl";
    return {
      ...state,
      status: { ...state.status, [stage]: "fail" },
      log: [...state.log, `${stage} is blocked until ${prior} passes`],
    };
  }
  const bundle = designBundle(state.design);
  const next: GdsState = { ...state, status: { ...state.status }, log: [...state.log], cells: state.cells.map((cell) => ({ ...cell })) };
  const mark = (status: StageStatus, line: string) => {
    next.status[stage] = status;
    next.log = [...next.log, line];
  };
  if (stage === "rtl") {
    const parsed = classifyRtl(bundle.rtl);
    mark(parsed.supported ? "pass" : "fail", parsed.supported ? `Accepted ${bundle.rtl.split("\n").length} RTL lines` : parsed.reason);
    next.rtl = bundle.rtl;
    next.lines = bundle.rtl.split("\n").length;
  } else if (stage === "elab") {
    next.gates = bundle.gates.map((gate) => ({ ...gate, inputs: [...gate.inputs] }));
    mark("pass", `Elaborated ${next.gates.length} generic gates`);
  } else if (stage === "synth") {
    next.gates = state.gates.map((gate) => ({ ...gate, inputs: [...gate.inputs] }));
    mark("pass", `Synthesis kept ${next.gates.length} gates from elaboration`);
  } else if (stage === "opt") {
    const optimized = optimizeNetwork(state.gates, bundle.primary);
    next.optimized = optimized.gates;
    mark("pass", optimized.steps.length > 0 ? optimized.steps.join("; ") : `Optimization left ${optimized.gates.length} gates`);
  } else if (stage === "map") {
    next.mapped = mapNetwork(state.optimized, state.params.goal);
    mark("pass", `Mapped ${state.optimized.length} generic gates to ${next.mapped.length} standard cells`);
  } else if (stage === "floor") {
    const cost = mappedCost(state.mapped, 6);
    next.floorArea = (cost.area / Math.max(0.35, state.params.utilization)) * state.params.aspect;
    mark("pass", `Core area ${next.floorArea.toFixed(1)} from ${state.mapped.length} mapped cells`);
  } else if (stage === "power") {
    const chip: ChipGeom = { dieW: 120, dieH: 80, coreUtil: state.params.utilization, macros: [] };
    const grid = planPower(chip, { strapWidth: 2, pitch: 12, strapCount: 4, voltage: state.params.vdd, current: 20 });
    mark(grid.sparse ? "warn" : "pass", `Power grid drop ${grid.drop.toFixed(2)} from ${grid.stripes.length} stripes`);
  } else if (stage === "place") {
    const placed = placeStandardCells({
      count: state.mapped.length,
      utilization: state.params.utilization,
      mode: state.params.placeMode,
      seed: 3,
      lockMacros: false,
    });
    next.placed = state.mapped.length;
    next.cells = placed.cells.map((cell, index) => ({
      id: cell.id,
      x: cell.x,
      y: cell.row * 8,
      w: cell.w,
      name: state.mapped[index]?.cell ?? cell.name,
    }));
    let span = 0;
    for (let index = 1; index < next.cells.length; index += 1) {
      const left = next.cells[index - 1];
      const right = next.cells[index];
      if (!left || !right) continue;
      span += Math.abs(right.x - left.x) + Math.abs(right.y - left.y);
    }
    next.wire = placed.hpwl > 0 ? placed.hpwl : span;
    mark(placed.overlaps > 0 ? "warn" : "pass", `Placed ${next.cells.length} sites for ${state.mapped.length} mapped cells, HPWL ${placed.hpwl.toFixed(1)}`);
  } else if (stage === "cts") {
    const sinks = state.cells.slice(0, 8).map((cell) => ({ id: cell.id, x: cell.x, y: cell.y }));
    const tree = synthesizeClock(sinks.length > 0 ? sinks : [{ id: "s0", x: 4, y: 4 }], { x: 0, y: 0 }, "binary");
    next.skew = tree.skew;
    mark(tree.skew <= state.params.skewBudget ? "pass" : "warn", `Clock skew ${tree.skew.toFixed(3)} against budget ${state.params.skewBudget.toFixed(3)} on ${sinks.length} sinks`);
  } else if (stage === "route") {
    const layerFactor = 1 + Math.max(0, 6 - state.params.layers) * 0.12;
    next.wire = state.wire * layerFactor;
    next.vias = Math.round(state.cells.length * Math.max(1, state.params.layers - 1) * 0.5);
    mark("pass", `Routed length ${next.wire.toFixed(1)} and ${next.vias} vias on ${state.params.layers} layers`);
  } else if (stage === "extract") {
    mark("pass", `Extracted ${(state.wire * 0.08).toFixed(2)} resistance units from routed length ${state.wire.toFixed(1)}`);
  } else if (stage === "sta") {
    const cost = mappedCost(state.mapped, 8);
    const delayNs = cost.delay / 1000 + state.wire * 0.002;
    next.slackNs = state.params.periodNs - delayNs;
    const power = cmosPower({
      vdd: state.params.vdd,
      frequency: 1e9 / Math.max(0.2, state.params.periodNs),
      alpha: 0.2,
      capacitance: 8e-15 * Math.max(1, state.mapped.length),
      celsius: 27,
      vth: 0.4,
      widthUm: 2,
    });
    next.dynamic = power.dynamic;
    next.leakage = power.leakage;
    mark(next.slackNs >= 0 ? "pass" : "fail", `Worst slack ${next.slackNs.toFixed(3)} ns from mapped delay and routed wire`);
  } else if (stage === "drc") {
    next.drc = state.params.utilization > 0.9 ? 2 : 0;
    mark(next.drc === 0 ? "pass" : "warn", next.drc === 0 ? "DRC clean on this educational deck" : `${next.drc} spacing warnings at high utilization`);
  } else if (stage === "lvs") {
    next.lvs = state.mapped.length > 0 && state.cells.length > 0 ? "pass" : "fail";
    mark(next.lvs === "pass" ? "pass" : "fail", next.lvs === "pass" ? "LVS matched mapped outputs to placed cells" : "LVS failed: mapping or placement is empty");
  } else {
    const ready = state.mapped.length > 0 && state.cells.length > 0 && state.lvs === "pass";
    mark(ready ? "pass" : "fail", ready ? `GDS view uses ${state.cells.length} placed cells and ${state.vias} vias` : "GDS view needs a passing LVS");
  }
  return next;
}

export function runThrough(state: GdsState, stage: GdsStage): GdsState {
  let current = state;
  for (const id of GDS_STAGES) {
    current = runStage(current, id);
    if (id === stage) break;
  }
  return current;
}

export function cellColor(name: string): string {
  const kind = name as CellName;
  if (kind === "DFF") return "#fbbf24";
  if (kind === "INV") return "#38bdf8";
  return "#fb7185";
}
