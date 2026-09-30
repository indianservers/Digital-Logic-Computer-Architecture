import { capture, clockSamples, edges, frequencyMHz, holdViolated, periodNs, setupViolated } from "../../engines/digital/timing";
import { cmosDelay } from "./engine";

export { clockSamples, edges, frequencyMHz, periodNs };

/** Times are nanoseconds. Slack is positive when the constraint is met. */
export interface SampleReport {
  tSetup: number;
  tHold: number;
  dataArrival: number;
  clockEdge: number;
  setupSlack: number;
  holdSlack: number;
  setupViolated: boolean;
  holdViolated: boolean;
  violated: boolean;
  captured: "0" | "1" | "X";
  reason: string;
}

export function sampleFlipFlop(changeNs: number, edgeNs: number, tSetup: number, tHold: number, dBefore: 0 | 1): SampleReport {
  const setup = setupViolated(changeNs, edgeNs, tSetup);
  const hold = holdViolated(changeNs, edgeNs, tHold);
  const sampled = capture(dBefore, changeNs, edgeNs, tSetup, tHold);
  const setupSlack = edgeNs - tSetup - changeNs;
  const holdSlack = changeNs <= edgeNs ? tHold : changeNs - edgeNs - tHold;
  return {
    tSetup,
    tHold,
    dataArrival: changeNs,
    clockEdge: edgeNs,
    setupSlack,
    holdSlack,
    setupViolated: setup,
    holdViolated: hold,
    violated: setup || hold,
    captured: sampled.value === "X" ? "X" : sampled.value === 1 ? "1" : "0",
    reason: sampled.reason,
  };
}

/**
 * Educational metastability. A missed window starts Q at mid-level.
 * A labeled disturbance decides which rail it resolves toward. Zero disturbance stays unresolved.
 * This is not an MTBF calculation.
 */
export interface MetaState {
  violated: boolean;
  metastable: boolean;
  resolvesTo: 0 | 1 | null;
  safe: boolean;
  note: string;
}

export function metastableState(changeNs: number, edgeNs: number, tSetup: number, tHold: number, disturbance: number): MetaState {
  const report = sampleFlipFlop(changeNs, edgeNs, tSetup, tHold, 0);
  if (!report.violated) {
    return {
      violated: false,
      metastable: false,
      resolvesTo: report.captured === "1" ? 1 : 0,
      safe: true,
      note: "D is stable through the window, so the latch regenerates a legal level.",
    };
  }
  if (Math.abs(disturbance) < 0.08) {
    return {
      violated: true,
      metastable: true,
      resolvesTo: null,
      safe: false,
      note: "The cross-coupled latch is balanced. With no disturbance it stays between 0 and 1 for this view.",
    };
  }
  return {
    violated: true,
    metastable: true,
    resolvesTo: disturbance > 0 ? 1 : 0,
    safe: false,
    note: "The latch leaves the metastable point toward the rail selected by the educational disturbance.",
  };
}

/** Q(t) from the edge. tauNs is the regeneration time constant. */
export function metastableLevel(tNs: number, edgeNs: number, tauNs: number, state: MetaState): number {
  if (!state.metastable) return tNs >= edgeNs ? (state.resolvesTo ?? 0) : 0;
  if (tNs < edgeNs) return 0;
  if (state.resolvesTo === null) return 0.5;
  const grown = 0.5 * Math.exp((tNs - edgeNs) / Math.max(0.2, tauNs));
  const signed = state.resolvesTo === 1 ? 0.5 + (grown - 0.5) : 0.5 - (grown - 0.5);
  return Math.min(1, Math.max(0, signed));
}

export interface SinkClock {
  id: string;
  arrival: number;
}

export function clockSinkArrivals(input: {
  sinks: number;
  sourceLatency: number;
  sinkLatency: number;
  skew: number;
  mode: "ideal" | "skewed" | "jittered";
}): SinkClock[] {
  const count = Math.max(2, Math.min(4, Math.round(input.sinks)));
  return Array.from({ length: count }, (_, index) => {
    const spread = input.mode === "ideal" ? 0 : input.skew * (index - (count - 1) / 2);
    return { id: `S${index + 1}`, arrival: input.sourceLatency + input.sinkLatency + spread };
  });
}

export function skewOf(arrivals: number[]): { min: number; max: number; skew: number } {
  const min = Math.min(...arrivals);
  const max = Math.max(...arrivals);
  return { min, max, skew: max - min };
}

export interface TreeSink {
  id: string;
  arrival: number;
  branch: number;
}

/** Educational clock tree. Not a clock-tree synthesis optimizer. */
export function clockTree(input: {
  sinks: number;
  bufferDelay: number;
  wireDelay: number;
  asymmetry: number;
  style: "balanced" | "unbalanced" | "h-tree";
}): { sinks: TreeSink[]; skew: number; insertion: number } {
  const count = Math.max(2, Math.min(8, Math.round(input.sinks)));
  const depth = Math.max(1, Math.ceil(Math.log2(count)));
  const sinks = Array.from({ length: count }, (_, index) => {
    const extra = input.style === "balanced" ? 0 : input.asymmetry * (index % 2 === 0 ? 0 : 1) * (input.style === "h-tree" ? 0.5 : 1);
    const wires = input.style === "h-tree" ? depth : depth + (input.style === "unbalanced" ? index % depth : 0);
    const arrival = depth * input.bufferDelay + wires * input.wireDelay + extra;
    return { id: `FF${index + 1}`, arrival, branch: index % 2 };
  });
  const times = sinks.map((sink) => sink.arrival);
  const skew = skewOf(times).skew;
  const insertion = Math.max(...times);
  return { sinks, skew, insertion };
}

export interface LogicPath {
  id: string;
  name: string;
  gates: string[];
  delay: number;
  depth: number;
}

export function combinationalPaths(input: { gateScale: number; netScale: number; fanout: number; slowGate?: "nor" | "nand" | "inv" }): LogicPath[] {
  const g = input.gateScale;
  const n = input.netScale * (1 + 0.15 * (input.fanout - 1));
  const first = input.slowGate === "inv" ? 1.1 : input.slowGate === "nand" ? 2.1 : 2.8;
  const firstName = input.slowGate === "inv" ? "INV" : input.slowGate === "nand" ? "NAND" : "NOR";
  const paths: LogicPath[] = [
    { id: "p-fast", name: "A → INV → Y", gates: ["INV1"], delay: 1.2 * g + 0.3 * n, depth: 1 },
    { id: "p-mid", name: "B → NAND → INV → Y", gates: ["NAND1", "INV2"], delay: (2.4 + 1.4) * g + (0.4 + 0.35) * n, depth: 2 },
    { id: "p-slow", name: `A → ${firstName} → NAND → INV → Y`, gates: ["G1", "NAND2", "INV3"], delay: (first + 2.2 + 1.3) * g + (0.45 + 0.5 + 0.3) * n, depth: 3 },
  ];
  return paths;
}

export function criticalPath(paths: LogicPath[]): { slow: LogicPath; fast: LogicPath } {
  const ordered = [...paths].sort((a, b) => a.delay - b.delay);
  const fast = ordered[0] ?? paths[0]!;
  const slow = ordered[ordered.length - 1] ?? paths[0]!;
  return { slow, fast };
}

export interface StaStep {
  id: string;
  name: string;
  kind: "cell" | "net";
  incremental: number;
  arrival: number;
  required: number;
  slack: number;
}

export interface StaResult {
  arrival: number;
  required: number;
  slack: number;
  pass: boolean;
  points: StaStep[];
}

const SETUP_STEPS = [
  { id: "ckq", name: "Launch FF CLK→Q", kind: "cell" as const, delay: 0.18 },
  { id: "n1", name: "net n1", kind: "net" as const, delay: 0.04 },
  { id: "inv", name: "INV", kind: "cell" as const, delay: 0.11 },
  { id: "n2", name: "net n2", kind: "net" as const, delay: 0.06 },
  { id: "nand", name: "NAND2", kind: "cell" as const, delay: 0.16 },
  { id: "n3", name: "net n3", kind: "net" as const, delay: 0.05 },
  { id: "cap", name: "Capture FF D", kind: "cell" as const, delay: 0 },
];

export function analyzeSta(input: {
  period: number;
  uncertainty: number;
  cellScale: number;
  netScale: number;
  analysis: "setup" | "hold";
  tSetup?: number;
  tHold?: number;
}): StaResult {
  const tSetup = input.tSetup ?? 0.08;
  const tHold = input.tHold ?? 0.05;
  let arrival = 0;
  const scaled = SETUP_STEPS.map((step) => {
    const factor = step.kind === "cell" ? input.cellScale : input.netScale;
    const incremental = step.delay * factor * (input.analysis === "hold" ? 0.55 : 1);
    arrival += incremental;
    return { id: step.id, name: step.name, kind: step.kind, incremental, arrival };
  });
  const requiredEnd = input.analysis === "setup"
    ? input.period - input.uncertainty - tSetup
    : tHold + input.uncertainty;
  let required = requiredEnd;
  const reversed = [...scaled].reverse().map((point) => {
    const row: StaStep = { ...point, required, slack: input.analysis === "setup" ? required - point.arrival : point.arrival - required };
    required -= point.incremental;
    return row;
  });
  const points = reversed.reverse();
  const slack = input.analysis === "setup" ? requiredEnd - arrival : arrival - requiredEnd;
  return { arrival, required: requiredEnd, slack, pass: slack >= 0, points };
}

export function worstPaths(input: { period: number; uncertainty: number; cellScale: number; netScale: number }): Array<{ name: string; slack: number; pass: boolean }> {
  const base = analyzeSta({ ...input, analysis: "setup" });
  const hold = analyzeSta({ ...input, analysis: "hold" });
  const side = analyzeSta({ ...input, analysis: "setup", cellScale: input.cellScale * 0.72 });
  return [
    { name: "FF1/CLK → FF2/D setup", slack: base.slack, pass: base.pass },
    { name: "FF1/CLK → FF2/D hold", slack: hold.slack, pass: hold.pass },
    { name: "FF3/CLK → FF2/D setup", slack: side.slack, pass: side.pass },
  ].sort((a, b) => a.slack - b.slack);
}

export type PathKind = "setup" | "hold" | "in2reg" | "reg2out";

export function explorerPath(kind: PathKind, cellScale: number, netScale: number, period: number): StaResult & { label: string } {
  if (kind === "hold") return { ...analyzeSta({ period, uncertainty: 0.04, cellScale, netScale, analysis: "hold" }), label: "Hold: launch CLK to capture D, minimum delay" };
  if (kind === "in2reg") {
    const result = analyzeSta({ period, uncertainty: 0.02, cellScale: cellScale * 0.8, netScale, analysis: "setup" });
    return { ...result, label: "Input port to the first register" };
  }
  if (kind === "reg2out") {
    const result = analyzeSta({ period, uncertainty: 0.02, cellScale: cellScale * 0.65, netScale: netScale * 1.2, analysis: "setup" });
    return { ...result, label: "Register to an output port" };
  }
  return { ...analyzeSta({ period, uncertainty: 0.05, cellScale, netScale, analysis: "setup" }), label: "Setup: launch CLK to capture D" };
}

const GATE_G: Record<string, number> = { inv: 1, nand2: 4 / 3, nor2: 5 / 3 };
const GATE_P: Record<string, number> = { inv: 1, nand2: 2, nor2: 2 };

export function logicalEffort(input: { gates: string[]; cin: number; load: number; branch: number; stages: number }): {
  g: number[];
  h: number;
  b: number;
  G: number;
  B: number;
  H: number;
  F: number;
  f: number;
  parasitic: number;
  delay: number;
  optimum: number;
} {
  const gates = input.gates.slice(0, Math.max(1, input.stages));
  while (gates.length < input.stages) gates.push("inv");
  const g = gates.map((gate) => GATE_G[gate] ?? 1);
  const G = g.reduce((product, value) => product * value, 1);
  const H = Math.max(0.2, input.load) / Math.max(0.2, input.cin);
  const B = Math.max(1, input.branch);
  const F = G * B * H;
  const n = Math.max(1, gates.length);
  const f = F ** (1 / n);
  const parasitic = gates.reduce((sum, gate) => sum + (GATE_P[gate] ?? 1), 0);
  const delay = n * f + parasitic;
  const optimum = Math.max(1, Math.round(Math.log(Math.max(F, 1.01))));
  return { g, h: H, b: B, G, B, H, F, f, parasitic, delay, optimum };
}

export function sizingDelay(mode: "poor" | "uniform" | "optimized", effort: number, stages: number, parasitic: number): number {
  const n = Math.max(1, stages);
  if (mode === "poor") return effort + (n - 1) + parasitic;
  if (mode === "uniform") return n * (effort / n + 1) * 0.55 + parasitic;
  return n * (effort ** (1 / n)) + parasitic;
}

export function delayVersusStages(effort: number, parasitic: number): Array<{ stages: number; delay: number }> {
  return Array.from({ length: 8 }, (_, index) => {
    const stages = index + 1;
    return { stages, delay: stages * (effort ** (1 / stages)) + parasitic };
  });
}

export function fanoutLoad(loads: number, capEach: number, driverUm: number, slew: number, vdd: number, style: "direct" | "buffered"): {
  cl: number;
  tpHL: number;
  tpLH: number;
  rise: number;
  fall: number;
  direct: number;
  buffered: number;
} {
  const cl = Math.max(1, loads) * capEach;
  const direct = cmosDelay({ vdd, vth: 0.45, capacitance: cl, wn: driverUm, ln: 0.18, wp: driverUm * 2, lp: 0.18, slew });
  const branches = Math.max(1, Math.ceil(Math.sqrt(loads)));
  const first = cmosDelay({ vdd, vth: 0.45, capacitance: branches * capEach * 0.25, wn: driverUm, ln: 0.18, wp: driverUm * 2, lp: 0.18, slew });
  const second = cmosDelay({ vdd, vth: 0.45, capacitance: cl, wn: driverUm * 4, ln: 0.18, wp: driverUm * 8, lp: 0.18, slew });
  const buffered = first.tpHL + second.tpHL;
  const chosen = style === "buffered" ? second : direct;
  const tpHL = style === "buffered" ? buffered : direct.tpHL;
  return { cl, tpHL, tpLH: style === "buffered" ? first.tpLH + second.tpLH : direct.tpLH, rise: chosen.rise, fall: chosen.fall, direct: direct.tpHL, buffered };
}

export function wireElmore(input: { lengthUm: number; rPerUm: number; cPerUm: number; loadF: number; driverR: number; segments: number }): {
  rTotal: number;
  cTotal: number;
  delay: number;
  lumped: boolean;
} {
  const rTotal = input.rPerUm * input.lengthUm;
  const cTotal = input.cPerUm * input.lengthUm;
  const segments = Math.max(1, Math.round(input.segments));
  if (segments <= 1) {
    return { rTotal, cTotal, delay: 0.69 * (input.driverR + rTotal) * (cTotal + input.loadF), lumped: true };
  }
  const rSeg = rTotal / segments;
  const cSeg = cTotal / segments;
  let distributed = input.driverR * (cTotal + input.loadF);
  for (let index = 0; index < segments; index += 1) {
    distributed += rSeg * ((segments - index) * cSeg + input.loadF);
  }
  return { rTotal, cTotal, delay: distributed, lumped: false };
}

export function crosstalk(input: {
  spacingUm: number;
  lengthUm: number;
  edgePs: number;
  vdd: number;
  victim: 0 | 1;
  rising: boolean;
  sameDirection: boolean;
  shield: boolean;
  layerRelief: boolean;
  buffered: boolean;
}): { cc: number; amplitude: number; positive: boolean; delayFactor: number } {
  const spacing = Math.max(0.05, input.spacingUm);
  let cc = (input.lengthUm / spacing) * 0.15e-15;
  if (input.shield) cc *= 0.22;
  if (input.layerRelief) cc *= 0.45;
  if (input.buffered) cc *= 0.5;
  const ground = 1.8e-15;
  const edge = 24 / Math.max(4, input.edgePs);
  const amplitude = Math.min(input.vdd, (cc / (cc + ground)) * input.vdd * Math.min(1.4, edge));
  const positive = input.rising ? input.victim === 0 : input.victim === 1;
  const ratio = cc / (cc + ground);
  const delayFactor = input.sameDirection ? 1 - 0.35 * ratio : 1 + 0.55 * ratio;
  return { cc, amplitude, positive, delayFactor };
}
