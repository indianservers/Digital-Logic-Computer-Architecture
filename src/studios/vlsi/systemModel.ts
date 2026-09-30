import { contention, linksOf, manhattan, shortestPath, type Point } from "../../engines/soc/soc";
import { cmosDelay, cmosPower } from "./engine";
import { designGates, mapNetwork, mappedCost } from "./flowModel";
import { poissonYield } from "./processModel";

export interface FloorBlock {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  power: number;
  domain: string;
}

export const SOC_FLOOR: FloorBlock[] = [
  { id: "cpu", name: "CPU cluster", x: 8, y: 8, w: 28, h: 22, power: 4.2, domain: "CPU" },
  { id: "gpu", name: "GPU", x: 42, y: 8, w: 30, h: 24, power: 6.5, domain: "GPU" },
  { id: "npu", name: "NPU", x: 8, y: 36, w: 22, h: 18, power: 3.4, domain: "NPU" },
  { id: "sram", name: "SRAM / cache", x: 36, y: 38, w: 24, h: 16, power: 1.2, domain: "CPU" },
  { id: "noc", name: "NoC", x: 64, y: 28, w: 16, h: 28, power: 1.6, domain: "Always-on" },
  { id: "mc", name: "Memory controller", x: 84, y: 8, w: 22, h: 16, power: 2.1, domain: "Always-on" },
  { id: "io", name: "I/O", x: 84, y: 30, w: 20, h: 14, power: 0.8, domain: "Always-on" },
  { id: "sec", name: "Security", x: 84, y: 50, w: 18, h: 12, power: 0.5, domain: "Always-on" },
  { id: "dsp", name: "DSP", x: 8, y: 60, w: 20, h: 14, power: 1.4, domain: "Media" },
];

function center(block: FloorBlock): { x: number; y: number } {
  return { x: block.x + block.w / 2, y: block.y + block.h / 2 };
}

export function socWireLength(blocks: FloorBlock[]): number {
  const hub = blocks.find((block) => block.id === "noc") ?? blocks[0];
  if (!hub) return 0;
  const origin = center(hub);
  return blocks.reduce((sum, block) => {
    if (block.id === hub.id) return sum;
    const point = center(block);
    return sum + Math.abs(point.x - origin.x) + Math.abs(point.y - origin.y);
  }, 0);
}

export function moveBlock(blocks: FloorBlock[], id: string, x: number, y: number): FloorBlock[] {
  return blocks.map((block) => (block.id === id ? { ...block, x, y } : block));
}

export interface NocFlow {
  src: Point;
  dst: Point;
  size: number;
}

function columnFirst(src: Point, dst: Point): Point[] {
  const path: Point[] = [{ ...src }];
  let r = src.r;
  let c = src.c;
  while (c !== dst.c) {
    c += c < dst.c ? 1 : -1;
    path.push({ r, c });
  }
  while (r !== dst.r) {
    r += r < dst.r ? 1 : -1;
    path.push({ r, c });
  }
  return path;
}

export function nocRoute(flows: NocFlow[], mode: "xy" | "adaptive"): {
  paths: Point[][];
  latency: number[];
  hops: number[];
  avgLatency: number;
  maxLatency: number;
  hotspot: string;
  arrived: boolean;
  contested: boolean;
} {
  const ordered = flows.map((flow) => shortestPath(flow.src, flow.dst));
  const alternate = flows.map((flow) => columnFirst(flow.src, flow.dst));
  const first = contention(ordered);
  const paths = flows.map((flow, index) => {
    const xy = ordered[index] ?? shortestPath(flow.src, flow.dst);
    if (mode === "xy") return xy;
    const yx = alternate[index] ?? xy;
    const xyBusy = linksOf(xy).some((link) => first.busy.includes(link));
    return xyBusy ? yx : xy;
  });
  const pressure = contention(paths);
  const counts = new Map<string, number>();
  paths.forEach((path) => {
    linksOf(path).forEach((link) => counts.set(link, (counts.get(link) ?? 0) + 1));
  });
  const latency = flows.map((flow, index) => {
    const path = paths[index] ?? [];
    const hops = Math.max(0, path.length - 1);
    const shared = linksOf(path).filter((link) => (counts.get(link) ?? 0) > 1).length;
    return hops * (1 + flow.size * 0.15) + shared * 2;
  });
  const hops = paths.map((path) => Math.max(0, path.length - 1));
  const avgLatency = latency.reduce((sum, value) => sum + value, 0) / Math.max(1, latency.length);
  const maxLatency = latency.reduce((max, value) => Math.max(max, value), 0);
  let hotspot = "none";
  let hottest = 0;
  counts.forEach((count, link) => {
    if (count > hottest) {
      hottest = count;
      hotspot = link;
    }
  });
  const arrived = flows.every((flow, index) => {
    const path = paths[index] ?? [];
    const end = path[path.length - 1];
    return end?.r === flow.dst.r && end?.c === flow.dst.c;
  });
  return { paths, latency, hops, avgLatency, maxLatency, hotspot, arrived, contested: pressure.contested };
}

export function chipletLink(traffic: number, bandwidth: number, hopLatency: number, span = 1): {
  utilization: number;
  latency: number;
  power: number;
} {
  const utilization = traffic / Math.max(0.1, bandwidth);
  const reach = Math.max(0.6, span);
  return {
    utilization,
    latency: hopLatency * (1 + Math.max(0, utilization - 0.7)) * reach,
    power: 0.15 * traffic * reach + 0.04 * bandwidth,
  };
}

export function assemblyCompare(dieArea: number, defectDensity: number): {
  monolithic: { yield: number; latency: number; packaging: number; modularity: number };
  chiplet: { yield: number; latency: number; packaging: number; modularity: number };
} {
  const slices = 4;
  const chipletYield = poissonYield(dieArea / slices, defectDensity) ** slices;
  return {
    monolithic: { yield: poissonYield(dieArea, defectDensity), latency: 1, packaging: 0.3, modularity: 0.2 },
    chiplet: { yield: chipletYield, latency: 1.8, packaging: 1, modularity: 1 },
  };
}

export interface PackageDie {
  id: string;
  power: number;
}

export function packageStack(mode: "2.5d" | "3d", dies: number, tsv: number, power: number): {
  count: number;
  linkLength: number;
  vertical: number;
  thermalRise: number;
} {
  const count = Math.max(1, Math.min(6, Math.round(dies)));
  const each = power / count;
  if (mode === "2.5d") {
    return { count, linkLength: (count - 1) * 4.5, vertical: 0, thermalRise: each * 3.2 };
  }
  const height = count * 0.08;
  return { count, linkLength: height, vertical: Math.max(1, Math.round(tsv)), thermalRise: each * (4 + count * 0.8) };
}

export function dieTemperatures(powers: number[], ambient: number, cooling: number, resistance = 8): number[] {
  const sink = Math.max(0.35, cooling);
  const rth = Math.max(1, resistance);
  return powers.map((power, index) => {
    const couple = powers.reduce((sum, other, otherIndex) => (otherIndex === index ? sum : sum + other * 0.08), 0);
    return ambient + ((power + couple) * rth) / sink;
  });
}

export interface PpaInput {
  vdd: number;
  frequency: number;
  drive: number;
  vt: number;
  pipeline: number;
  utilization: number;
  buffering: number;
  clockGate: boolean;
  powerGate: boolean;
}

export interface PpaResult {
  power: number;
  performance: number;
  area: number;
  delayPs: number;
  leakage: number;
  dynamic: number;
  slackPs: number;
  cells: number;
}

export const PPA_PRESETS: Record<"low" | "balanced" | "fast" | "small", PpaInput> = {
  low: { vdd: 0.7, frequency: 4e8, drive: 1, vt: 0.5, pipeline: 4, utilization: 0.85, buffering: 0.4, clockGate: true, powerGate: true },
  balanced: { vdd: 0.9, frequency: 8e8, drive: 2, vt: 0.4, pipeline: 3, utilization: 0.7, buffering: 1, clockGate: true, powerGate: false },
  fast: { vdd: 1.1, frequency: 1.4e9, drive: 4, vt: 0.32, pipeline: 5, utilization: 0.55, buffering: 1.6, clockGate: false, powerGate: false },
  small: { vdd: 0.85, frequency: 6e8, drive: 1, vt: 0.42, pipeline: 2, utilization: 0.92, buffering: 0.5, clockGate: true, powerGate: false },
};

export function explorePpa(input: PpaInput): PpaResult {
  const stages = Math.max(1, Math.round(input.pipeline));
  const drive = Math.max(1, input.drive);
  const delay = cmosDelay({
    vdd: input.vdd,
    vth: input.vt,
    capacitance: 12e-15 / drive,
    wn: drive,
    ln: 0.18,
    wp: drive * 2,
    lp: 0.18,
    slew: 15e-12 / stages,
  });
  const stageDelay = delay.tpHL / stages;
  const delayPs = stageDelay * 1e12;
  const period = 1 / Math.max(1, input.frequency);
  const slackPs = (period - stageDelay) * 1e12;
  const alpha = input.clockGate ? 0.25 : 0.7;
  const power = cmosPower({
    vdd: input.vdd,
    frequency: input.frequency,
    alpha,
    capacitance: 20e-15 * drive,
    celsius: 27,
    vth: input.vt,
    widthUm: drive * 4,
  });
  const leakage = input.powerGate ? power.leakage * 0.08 : power.leakage;
  const cells = Math.round(40 * stages * (1 + input.buffering * 0.3));
  const area = (cells * (2 + drive)) / Math.max(0.35, input.utilization);
  const performance = 1 / Math.max(stageDelay, 1e-15);
  return {
    power: power.dynamic + leakage,
    performance,
    area,
    delayPs,
    leakage,
    dynamic: power.dynamic,
    slackPs,
    cells,
  };
}

export function fabricCompare(kind: "adder" | "counter" | "alu", width: number): {
  fpga: { luts: number; area: number; delay: number; power: number; flexibility: number; nre: number; unit: number; ttm: number };
  asic: { cells: number; area: number; delay: number; power: number; flexibility: number; nre: number; unit: number; ttm: number };
} {
  const bits = Math.max(1, Math.min(8, Math.round(width)));
  const base = kind === "adder" ? designGates("adder") : kind === "counter" ? designGates("counter") : designGates("mux");
  const mapped = mapNetwork(base, "balanced");
  const cost = mappedCost(mapped, 4);
  const luts = base.length * bits;
  const cells = mapped.length * bits;
  return {
    fpga: {
      luts,
      area: luts * 9,
      delay: base.length * 180,
      power: luts * 0.08,
      flexibility: 1,
      nre: 0.15,
      unit: 1.4 + bits * 0.05,
      ttm: 0.35,
    },
    asic: {
      cells,
      area: cost.area * bits,
      delay: cost.delay,
      power: cost.power * bits,
      flexibility: 0.2,
      nre: 1,
      unit: 0.35 + bits * 0.02,
      ttm: 1,
    },
  };
}

export function hopCount(src: Point, dst: Point): number {
  return manhattan(src, dst);
}
