export interface Macro {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ChipGeom {
  dieW: number;
  dieH: number;
  coreUtil: number;
  macros: Macro[];
}

export const MINI_SOC_MACROS: Macro[] = [
  { id: "cpu", name: "CPU", x: 22, y: 24, w: 34, h: 26 },
  { id: "sram", name: "SRAM", x: 78, y: 24, w: 24, h: 20 },
  { id: "npu", name: "NPU", x: 68, y: 54, w: 24, h: 18 },
  { id: "noc", name: "Interconnect", x: 40, y: 56, w: 20, h: 14 },
  { id: "io", name: "I/O", x: 8, y: 28, w: 10, h: 36 },
];

const MACRO_NETS: Array<[string, string]> = [
  ["cpu", "sram"],
  ["cpu", "noc"],
  ["npu", "sram"],
  ["io", "noc"],
];

export function coreBox(chip: ChipGeom): { x: number; y: number; w: number; h: number } {
  const util = Math.min(0.92, Math.max(0.45, chip.coreUtil));
  const margin = (1 - util) / 2;
  return {
    x: chip.dieW * margin,
    y: chip.dieH * margin,
    w: chip.dieW * util,
    h: chip.dieH * util,
  };
}

function boxesOverlap(a: Macro, b: Macro): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function macroOverlaps(macros: Macro[]): Array<{ a: string; b: string }> {
  const hits: Array<{ a: string; b: string }> = [];
  for (let i = 0; i < macros.length; i += 1) {
    for (let j = i + 1; j < macros.length; j += 1) {
      const left = macros[i];
      const right = macros[j];
      if (left && right && boxesOverlap(left, right)) hits.push({ a: left.id, b: right.id });
    }
  }
  return hits;
}

function centerOf(macro: Macro): { x: number; y: number } {
  return { x: macro.x + macro.w / 2, y: macro.y + macro.h / 2 };
}

export function estimatedWire(macros: Macro[]): number {
  let length = 0;
  for (const [from, to] of MACRO_NETS) {
    const a = macros.find((macro) => macro.id === from);
    const b = macros.find((macro) => macro.id === to);
    if (!a || !b) continue;
    const ca = centerOf(a);
    const cb = centerOf(b);
    length += Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y);
  }
  return length;
}

export function floorplanMetrics(chip: ChipGeom): {
  dieArea: number;
  coreArea: number;
  utilization: number;
  overlaps: number;
  wire: number;
  congestion: number;
} {
  const core = coreBox(chip);
  const coreArea = core.w * core.h;
  const macroArea = chip.macros.reduce((sum, macro) => sum + macro.w * macro.h, 0);
  const overlaps = macroOverlaps(chip.macros).length;
  const wire = estimatedWire(chip.macros);
  return {
    dieArea: chip.dieW * chip.dieH,
    coreArea,
    utilization: coreArea === 0 ? 0 : macroArea / coreArea,
    overlaps,
    wire,
    congestion: overlaps > 0 ? 1 : wire / Math.max(chip.dieW * chip.dieH, 1),
  };
}

export function autoFloorplan(chip: ChipGeom): Macro[] {
  const core = coreBox(chip);
  let x = core.x + 2;
  let y = core.y + 2;
  let rowH = 0;
  return chip.macros.map((macro) => {
    if (x + macro.w > core.x + core.w) {
      x = core.x + 2;
      y += rowH + 4;
      rowH = 0;
    }
    const placed = { ...macro, x, y };
    x += macro.w + 4;
    rowH = Math.max(rowH, macro.h);
    return placed;
  });
}

export interface PowerStripe {
  id: string;
  net: "VDD" | "VSS";
  axis: "h" | "v" | "ring" | "rail";
  x: number;
  y: number;
  w: number;
  h: number;
}

export function planPower(chip: ChipGeom, input: {
  strapWidth: number;
  pitch: number;
  strapCount: number;
  voltage: number;
  current: number;
}): {
  stripes: PowerStripe[];
  coverage: number;
  maxCurrent: number;
  resistance: number;
  drop: number;
  sparse: boolean;
} {
  const core = coreBox(chip);
  const stripes: PowerStripe[] = [
    { id: "vdd-ring", net: "VDD", axis: "ring", x: core.x, y: core.y, w: core.w, h: input.strapWidth },
    { id: "vss-ring", net: "VSS", axis: "ring", x: core.x, y: core.y + core.h - input.strapWidth, w: core.w, h: input.strapWidth },
  ];
  const count = Math.max(1, Math.min(Math.round(input.strapCount), Math.floor(core.h / Math.max(4, input.pitch))));
  for (let index = 0; index < count; index += 1) {
    const y = core.y + ((index + 1) * core.h) / (count + 1);
    stripes.push({
      id: `h-${index}`,
      net: index % 2 === 0 ? "VDD" : "VSS",
      axis: "h",
      x: core.x,
      y,
      w: core.w,
      h: input.strapWidth,
    });
    const x = core.x + ((index + 1) * core.w) / (count + 1);
    stripes.push({
      id: `v-${index}`,
      net: index % 2 === 0 ? "VSS" : "VDD",
      axis: "v",
      x,
      y: core.y,
      w: input.strapWidth,
      h: core.h,
    });
  }
  for (let rail = 0; rail < 4; rail += 1) {
    stripes.push({
      id: `rail-${rail}`,
      net: rail % 2 === 0 ? "VDD" : "VSS",
      axis: "rail",
      x: core.x,
      y: core.y + 8 + rail * 10,
      w: core.w,
      h: 1.2,
    });
  }
  const length = core.w + core.h;
  const resistance = 0.08 * length / Math.max(0.4, input.strapWidth);
  const maxCurrent = input.current / count;
  const drop = maxCurrent * resistance;
  const coverage = Math.min(1, (count * input.strapWidth) / Math.max(core.h, 1));
  const sparse = input.pitch > 28 || count < 3;
  return { stripes, coverage, maxCurrent, resistance, drop, sparse };
}

export interface PlacedCell {
  id: string;
  name: string;
  row: number;
  x: number;
  w: number;
  critical: boolean;
  net: string;
}

export interface PlacementResult {
  cells: PlacedCell[];
  rows: number;
  hpwl: number;
  density: number;
  maxDensity: number;
  overlaps: number;
  utilization: number;
}

function cellWidth(index: number): number {
  return index % 3 === 0 ? 6 : index % 3 === 1 ? 4 : 2;
}

export function placeStandardCells(input: {
  count: number;
  utilization: number;
  mode: "greedy" | "timing" | "congestion";
  seed: number;
  lockMacros: boolean;
}): PlacementResult {
  const count = Math.max(4, Math.min(80, Math.round(input.count)));
  const specs = Array.from({ length: count }, (_, index) => ({
    id: `c${index}`,
    name: index % 5 === 0 ? "DFF" : index % 2 === 0 ? "NAND2" : "INV",
    w: cellWidth(index),
    critical: index % 5 === 0,
    net: `n${index % 6}`,
  }));
  const ordered = input.mode === "timing"
    ? [...specs].sort((a, b) => Number(b.critical) - Number(a.critical) || a.id.localeCompare(b.id))
    : specs;
  const shift = Math.abs(Math.round(input.seed)) % ordered.length;
  const order = ordered.slice(shift).concat(ordered.slice(0, shift));
  const rowSites = Math.round(48 / Math.min(0.95, Math.max(0.35, input.utilization)));
  const gap = input.mode === "congestion" ? 2 : 0;
  const macroSpan = input.lockMacros ? { x0: 8, x1: 22 } : null;
  const cells: PlacedCell[] = [];
  let row = 0;
  let x = 0;
  for (const spec of order) {
    if (macroSpan && x < macroSpan.x1 && x + spec.w > macroSpan.x0 && row < 2) x = macroSpan.x1;
    if (x + spec.w > rowSites) {
      row += 1;
      x = macroSpan && row < 2 ? macroSpan.x1 : 0;
    }
    cells.push({ ...spec, row, x });
    x += spec.w + gap;
  }
  let overlaps = 0;
  if (!input.lockMacros) {
    for (const cell of cells) {
      if (cell.row < 2 && cell.x < 22 && cell.x + cell.w > 8) overlaps += 1;
    }
  }
  const hpwl = netHpwl(cells);
  const used = cells.reduce((sum, cell) => sum + cell.w, 0);
  const capacity = (row + 1) * rowSites;
  const perRow = new Map<number, number>();
  for (const cell of cells) perRow.set(cell.row, (perRow.get(cell.row) ?? 0) + cell.w);
  const maxDensity = Math.max(...[...perRow.values()].map((width) => width / rowSites));
  return {
    cells,
    rows: row + 1,
    hpwl,
    density: used / capacity,
    maxDensity,
    overlaps,
    utilization: used / capacity,
  };
}

function netHpwl(cells: PlacedCell[]): number {
  const groups = new Map<string, PlacedCell[]>();
  for (const cell of cells) {
    const list = groups.get(cell.net) ?? [];
    list.push(cell);
    groups.set(cell.net, list);
  }
  let length = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const xs = group.map((cell) => cell.x);
    const ys = group.map((cell) => cell.row * 8);
    length += Math.max(...xs) - Math.min(...xs) + (Math.max(...ys) - Math.min(...ys));
  }
  return length;
}

export interface PlaceState {
  order: number[];
  gap: number;
}

export function scrambledPlacement(count: number): PlaceState {
  const even: number[] = [];
  const odd: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (index % 2 === 0) even.push(index);
    else odd.push(index);
  }
  return { order: [...even, ...odd], gap: 0 };
}

export type OptTarget = "wire" | "timing" | "congestion" | "balanced";

function realize(state: PlaceState): PlacedCell[] {
  const rowSites = 64;
  const cells: PlacedCell[] = [];
  let x = 0;
  let row = 0;
  for (const id of state.order) {
    const w = 2;
    if (x + w > rowSites) {
      row += 1;
      x = 0;
    }
    cells.push({
      id: `c${id}`,
      name: "INV",
      row,
      x,
      w,
      critical: id % 5 === 0,
      net: `p${Math.floor(id / 2)}`,
    });
    x += w + state.gap;
  }
  return cells;
}

export function placementMetric(state: PlaceState, target: OptTarget): number {
  const cells = realize(state);
  if (target === "timing") return cells.filter((cell) => cell.critical).reduce((sum, cell) => sum + cell.x + cell.row * 64, 0);
  if (target === "congestion") return 2 / (2 + state.gap);
  const hpwl = netHpwl(cells);
  if (target === "balanced") return hpwl + state.gap * 4;
  return hpwl;
}

export interface CellMove {
  id: string;
  fromX: number;
  toX: number;
  fromRow: number;
  toRow: number;
}

export function stepOptimization(state: PlaceState, target: OptTarget): { state: PlaceState; moves: CellMove[] } {
  if (target === "congestion") {
    const next = { order: [...state.order], gap: Math.min(3, state.gap + 1) };
    return { state: next, moves: [] };
  }
  const order = [...state.order];
  const before = realize(state);
  if (target === "timing") {
    const index = order.findIndex((id, slot) => id % 5 === 0 && slot > 0 && (order[slot - 1] ?? 0) % 5 !== 0);
    if (index > 0) {
      const left = order[index - 1];
      const here = order[index];
      if (left !== undefined && here !== undefined) {
        order[index - 1] = here;
        order[index] = left;
      }
    }
  } else {
    let moved = false;
    for (let id = 0; id < order.length; id += 2) {
      const left = order.indexOf(id);
      const right = order.indexOf(id + 1);
      if (left < 0 || right < 0 || Math.abs(left - right) <= 1) continue;
      const far = right > left ? right : left;
      const neighborIndex = far - 1;
      const neighbor = order[neighborIndex];
      const current = order[far];
      if (neighbor === undefined || current === undefined) continue;
      order[far] = neighbor;
      order[neighborIndex] = current;
      moved = true;
      break;
    }
    if (!moved && target === "balanced" && state.gap < 1) return { state: { order, gap: 1 }, moves: [] };
  }
  const next = { order, gap: state.gap };
  const after = realize(next);
  const moves: CellMove[] = [];
  for (const cell of after) {
    const prior = before.find((item) => item.id === cell.id);
    if (!prior) continue;
    if (prior.x !== cell.x || prior.row !== cell.row) {
      moves.push({ id: cell.id, fromX: prior.x, toX: cell.x, fromRow: prior.row, toRow: cell.row });
    }
  }
  return { state: next, moves };
}

export function optimizeFully(state: PlaceState, target: OptTarget): PlaceState {
  let current = state;
  for (let step = 0; step < 80; step += 1) {
    const next = stepOptimization(current, target).state;
    if (next.order.join(",") === current.order.join(",") && next.gap === current.gap) break;
    if (placementMetric(next, target) > placementMetric(current, target)) break;
    current = next;
  }
  return current;
}

export interface RoutePoint {
  x: number;
  y: number;
}

export function routeNet(source: RoutePoint, sink: RoutePoint, input: {
  mode: "global" | "detailed";
  layers: number;
  viaCost: number;
  congestionPenalty: number;
  blocked: { x: number; y: number; w: number; h: number } | null;
}): { points: RoutePoint[]; vias: number; length: number; overflow: number; connects: boolean; cost: number } {
  const direct: RoutePoint[] = [source, { x: sink.x, y: source.y }, sink];
  const blocked = input.blocked;
  const hits = blocked ? polylineHits(direct, blocked) : false;
  let points = direct;
  if (hits && blocked) {
    const lane = blocked.y - 3;
    points = [source, { x: source.x, y: lane }, { x: sink.x, y: lane }, sink];
  }
  if (input.mode === "global") {
    points = points.map((point, index) => {
      if (index === 0 || index === points.length - 1) return point;
      return { x: Math.round(point.x / 8) * 8, y: Math.round(point.y / 8) * 8 };
    });
  }
  let length = 0;
  let vias = 0;
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const here = points[index];
    if (!prev || !here) continue;
    length += Math.abs(here.x - prev.x) + Math.abs(here.y - prev.y);
    const earlier = points[index - 2];
    if (earlier && ((earlier.x === prev.x) !== (prev.x === here.x))) vias += 1;
  }
  const first = points[0];
  const last = points[points.length - 1];
  const connects = !!first && !!last && first.x === source.x && first.y === source.y && last.x === sink.x && last.y === sink.y;
  const overflow = (Math.max(0, Math.ceil(length / 30) - input.layers) + (hits && blocked && polylineHits(points, blocked) ? 1 : 0)) * Math.max(0.2, input.congestionPenalty);
  return { points, vias, length, overflow, connects, cost: length + vias * input.viaCost };
}

function polylineHits(points: RoutePoint[], block: { x: number; y: number; w: number; h: number }): boolean {
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    if (!a || !b) continue;
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    const overlaps = minX < block.x + block.w && maxX > block.x && minY < block.y + block.h && maxY > block.y;
    if (overlaps && (a.x === b.x || a.y === b.y)) return true;
  }
  return false;
}

export interface CongestionBin {
  x: number;
  y: number;
  demand: number;
  capacity: number;
  overflow: number;
  nets: string[];
}

export function congestionGrid(input: {
  density: number;
  layers: number;
  tracks: number;
  blocked: boolean;
}): { bins: CongestionBin[]; overflow: number } {
  const bins: CongestionBin[] = [];
  let overflow = 0;
  for (let y = 0; y < 6; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const hot = x > 2 && x < 6 && y > 1 && y < 5;
      const demand = input.density * (hot ? 8 : 3);
      const blocked = input.blocked && x === 4 && y === 3;
      const capacity = blocked ? 0 : input.layers * input.tracks;
      const extra = Math.max(0, demand - capacity);
      overflow += extra;
      bins.push({
        x,
        y,
        demand,
        capacity,
        overflow: extra,
        nets: hot ? ["n0", "n1", "n2"] : ["n0"],
      });
    }
  }
  return { bins, overflow };
}

export interface ClockSink {
  id: string;
  x: number;
  y: number;
}

export interface ClockArrival {
  id: string;
  arrival: number;
  buffers: number;
}

const WIRE_NS = 0.012;
const BUF_NS = 0.08;

export function skewOf(arrivals: number[]): number {
  if (arrivals.length === 0) return 0;
  return Math.max(...arrivals) - Math.min(...arrivals);
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function clockBaseline(sinks: ClockSink[], root: { x: number; y: number }): {
  arrivals: ClockArrival[];
  skew: number;
  buffers: number;
  wire: number;
  insertion: number;
} {
  const arrivals = sinks.map((sink) => ({ id: sink.id, arrival: manhattan(root, sink) * WIRE_NS, buffers: 0 }));
  const times = arrivals.map((item) => item.arrival);
  return {
    arrivals,
    skew: skewOf(times),
    buffers: 0,
    wire: arrivals.reduce((sum, item) => sum + item.arrival / WIRE_NS, 0),
    insertion: times.length === 0 ? 0 : Math.max(...times),
  };
}

export function synthesizeClock(sinks: ClockSink[], root: { x: number; y: number }, style: "binary" | "cluster" | "h-tree"): {
  arrivals: ClockArrival[];
  skew: number;
  buffers: number;
  wire: number;
  insertion: number;
  power: number;
  buffersAt: Array<{ id: string; x: number; y: number }>;
} {
  const distances = sinks.map((sink) => manhattan(root, sink));
  const maxDistance = distances.length === 0 ? 0 : Math.max(...distances);
  const step = BUF_NS / WIRE_NS;
  const arrivals = sinks.map((sink) => {
    const distance = manhattan(root, sink);
    const buffers = Math.round((maxDistance - distance) / step);
    return { id: sink.id, arrival: distance * WIRE_NS + buffers * BUF_NS, buffers };
  });
  const times = arrivals.map((item) => item.arrival);
  const buffers = arrivals.reduce((sum, item) => sum + item.buffers, 0) + (style === "h-tree" ? 5 : style === "binary" ? 3 : 2);
  const wire = sinks.reduce((sum, sink) => sum + manhattan(root, sink) * 0.65, 0) + buffers * 4;
  const cx = sinks.reduce((sum, sink) => sum + sink.x, 0) / Math.max(1, sinks.length);
  const cy = sinks.reduce((sum, sink) => sum + sink.y, 0) / Math.max(1, sinks.length);
  const buffersAt = [
    { id: "root-buf", x: (root.x + cx) / 2, y: (root.y + cy) / 2 },
    ...sinks.map((sink) => ({ id: `buf-${sink.id}`, x: (sink.x + cx) / 2, y: (sink.y + cy) / 2 })),
  ];
  return {
    arrivals,
    skew: skewOf(times),
    buffers,
    wire,
    insertion: times.length === 0 ? 0 : Math.max(...times),
    power: buffers * 0.15 + wire * 0.004,
    buffersAt,
  };
}
