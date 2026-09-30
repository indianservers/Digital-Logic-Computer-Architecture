import { cmosDelay, cmosPower } from "./engine";
import { crosstalk } from "./timingModel";

/** Educational IR drop on a resistive strap grid. Not a signoff solver. */
export function educationalIrDrop(input: {
  vdd: number;
  strapWidth: number;
  pitch: number;
  sheet: number;
  currentMa: number;
  straps: number;
}): {
  nodes: Array<{ x: number; y: number; voltage: number; drop: number }>;
  worst: number;
  average: number;
  hotspot: { x: number; y: number };
  nominal: number;
  resistance: number;
} {
  const span = 80;
  const fitted = Math.max(1, Math.min(Math.round(input.straps), Math.floor(span / Math.max(4, input.pitch))));
  const resistance = input.sheet * (span / Math.max(0.3, input.strapWidth));
  const worst = (input.currentMa / 1000) * resistance / fitted;
  const nodes: Array<{ x: number; y: number; voltage: number; drop: number }> = [];
  let hotspot = { x: 0, y: 0 };
  let peak = -1;
  let sum = 0;
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 6; x += 1) {
      const edge = Math.min(x, 5 - x) / 2.5 + Math.min(y, 3 - y) / 1.5;
      const factor = Math.min(1, edge / 1.2);
      const drop = worst * (0.25 + 0.75 * factor);
      const voltage = input.vdd - drop;
      nodes.push({ x, y, voltage, drop });
      sum += drop;
      if (drop > peak) {
        peak = drop;
        hotspot = { x, y };
      }
    }
  }
  return { nodes, worst, average: sum / nodes.length, hotspot, nominal: input.vdd, resistance };
}

const METAL = {
  copper: { jMax: 2.2, ea: 0.7 },
  aluminum: { jMax: 1.1, ea: 0.55 },
} as const;

/** Simplified Black’s equation. Lifetime is a trend, not a foundry qualification. */
export function electromigration(input: {
  currentMa: number;
  widthUm: number;
  thicknessUm: number;
  celsius: number;
  metal: "copper" | "aluminum";
}): { density: number; risk: number; lifetime: number; state: "safe" | "warning" | "high" } {
  const spec = METAL[input.metal];
  const area = Math.max(0.02, input.widthUm * input.thicknessUm);
  const density = input.currentMa / area;
  const kelvin = input.celsius + 273;
  const thermal = Math.exp(spec.ea / 8.62e-5 * (1 / 300 - 1 / kelvin));
  const lifetime = (spec.jMax / Math.max(0.05, density)) ** 2 * thermal;
  const risk = (density / spec.jMax) * Math.exp(0.02 * (input.celsius - 27));
  const state = risk < 0.6 ? "safe" : risk < 1 ? "warning" : "high";
  return { density, risk, lifetime, state };
}

export function signalIntegrity(input: {
  driver: "weak" | "strong";
  impedance: number;
  loadFf: number;
  couplingFf: number;
  edgePs: number;
  termination: "none" | "series";
}): { ideal: number[]; actual: number[]; victim: number[]; overshoot: number; noiseMargin: number } {
  const vdd = 1;
  const coupled = crosstalk({
    spacingUm: Math.max(0.15, 1.2 / Math.max(0.2, input.couplingFf)),
    lengthUm: 24,
    edgePs: input.edgePs,
    vdd,
    victim: 0,
    rising: true,
    sameDirection: false,
    shield: input.termination === "series",
    layerRelief: false,
    buffered: input.driver === "strong",
  });
  const edge = input.driver === "strong" ? 4 : 8;
  const ring = input.termination === "none" ? 0.18 * (input.impedance / 50) * (input.driver === "strong" ? 1.25 : 0.7) : 0.03;
  const ideal: number[] = [];
  const actual: number[] = [];
  const victim: number[] = [];
  for (let sample = 0; sample < 24; sample += 1) {
    const step = sample >= 8 ? vdd : 0;
    ideal.push(step);
    const rise = Math.min(1, Math.max(0, (sample - 8) / edge));
    const bounce = sample > 8 + edge ? ring * Math.exp(-(sample - 8 - edge) / 4) * Math.sin((sample - 8) * 1.3) : 0;
    const loadSlow = input.loadFf / 40;
    actual.push(Math.max(-0.2, Math.min(1.4, vdd * Math.min(1, rise / (1 + loadSlow * 0.15)) + bounce)));
    const bump = sample > 8 && sample < 16 ? coupled.amplitude : 0;
    victim.push(bump);
  }
  const peak = Math.max(...actual);
  return { ideal, actual, victim, overshoot: Math.max(0, peak - vdd), noiseMargin: Math.max(0, 0.35 - coupled.amplitude) };
}

export type Corner = "SS" | "TT" | "FF" | "SF" | "FS";

const CORNER = {
  SS: { vth: 1.18, drive: 0.72, leak: 0.4 },
  TT: { vth: 1, drive: 1, leak: 1 },
  FF: { vth: 0.82, drive: 1.28, leak: 2.6 },
  SF: { vth: 1.08, drive: 0.9, leak: 1.15 },
  FS: { vth: 0.92, drive: 1.1, leak: 1.45 },
} as const;

export function pvtSample(corner: Corner, vdd: number, celsius: number, loadFf: number): {
  delay: number;
  leakage: number;
  dynamic: number;
  noiseMargin: number;
  drive: number;
} {
  const scale = CORNER[corner];
  const timing = cmosDelay({
    vdd,
    vth: 0.4 * scale.vth,
    capacitance: loadFf * 1e-15,
    wn: scale.drive,
    ln: 0.18,
    wp: 2 * scale.drive,
    lp: 0.18,
    slew: 20e-12,
  });
  const power = cmosPower({
    vdd,
    frequency: 1e9,
    alpha: 0.2,
    capacitance: loadFf * 1e-15,
    celsius,
    vth: 0.4 * scale.vth,
    widthUm: scale.drive,
  });
  return {
    delay: timing.tpHL,
    leakage: power.leakage * scale.leak,
    dynamic: power.dynamic,
    noiseMargin: Math.max(0, vdd * 0.2 * scale.drive),
    drive: scale.drive,
  };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function monteCarlo(input: { samples: number; sigma: number; seed: number; targetPs: number }): {
  delays: number[];
  mean: number;
  sigma: number;
  min: number;
  max: number;
  yield: number;
} {
  const count = Math.max(8, Math.min(200, Math.round(input.samples)));
  const rng = mulberry32(input.seed);
  const nominal = pvtSample("TT", 1, 27, 10).delay * 1e12;
  const delays = Array.from({ length: count }, () => Math.max(1, nominal * (1 + gaussian(rng) * input.sigma)));
  const mean = delays.reduce((sum, value) => sum + value, 0) / delays.length;
  const variance = delays.reduce((sum, value) => sum + (value - mean) ** 2, 0) / delays.length;
  const sigma = Math.sqrt(variance);
  const pass = delays.filter((value) => value < input.targetPs).length;
  return { delays, mean, sigma, min: Math.min(...delays), max: Math.max(...delays), yield: pass / delays.length };
}

export function powerGate(input: { sleep: boolean; header: boolean; load: number; retention: boolean; slew: number }): {
  activeLeakage: number;
  sleepLeakage: number;
  virtualRail: number;
  wakeup: number;
  inrush: number;
} {
  const activeLeakage = cmosPower({ vdd: 1, frequency: 1e8, alpha: 0, capacitance: 1e-15, celsius: 27, vth: 0.4, widthUm: input.load }).leakage;
  const sleepLeakage = input.sleep ? activeLeakage * (input.header ? 0.03 : 0.12) : activeLeakage;
  const virtualRail = input.sleep ? (input.retention ? 0.35 : 0.04) : 1;
  const wakeup = input.sleep ? input.slew * (input.retention ? 0.6 : 1) : 0;
  const inrush = input.load / Math.max(0.2, input.slew);
  return { activeLeakage, sleepLeakage, virtualRail, wakeup, inrush };
}

export function clockGate(input: {
  enabled: boolean;
  style: "naive" | "icg";
  frequencyMHz: number;
  activity: number;
  registers: number;
  enableAt: number;
}): { clock: number[]; gated: number[]; edges: number; dynamic: number; glitch: boolean } {
  const clock = Array.from({ length: 16 }, (_, index) => (index % 4 < 2 ? 1 : 0));
  let latched = false;
  const gated = clock.map((level, index) => {
    if (!input.enabled) return 0;
    if (input.style === "naive") return index >= input.enableAt ? level : 0;
    if (level === 0 && index >= input.enableAt) latched = true;
    return latched ? level : 0;
  });
  let edges = 0;
  for (let index = 1; index < gated.length; index += 1) {
    if ((gated[index - 1] ?? 0) === 0 && gated[index] === 1) edges += 1;
  }
  const dynamic = cmosPower({
    vdd: 1,
    frequency: input.frequencyMHz * 1e6,
    alpha: input.enabled ? input.activity : 0,
    capacitance: input.registers * 2e-15,
    celsius: 27,
    vth: 0.4,
    widthUm: 1,
  }).dynamic;
  const glitch = input.style === "naive" && input.enabled && input.enableAt > 0 && (clock[Math.min(15, input.enableAt)] ?? 0) === 1;
  return { clock, gated, edges, dynamic, glitch };
}

export type VtClass = "LVT" | "SVT" | "HVT";

const VT = {
  LVT: { delay: 0.72, leak: 4 },
  SVT: { delay: 1, leak: 1 },
  HVT: { delay: 1.45, leak: 0.22 },
} as const;

export function vtPath(assignments: VtClass[], loadFf: number): { delay: number; leakage: number; slack: number } {
  let delay = 0;
  let leakage = 0;
  for (const vt of assignments) {
    delay += VT[vt].delay * (8 + loadFf);
    leakage += VT[vt].leak * 1e-9;
  }
  return { delay, leakage, slack: 80 - delay };
}

export function suggestVt(assignments: VtClass[], loadFf: number, targetDelay: number): VtClass[] {
  const next = [...assignments];
  let guard = 0;
  while (vtPath(next, loadFf).delay > targetDelay && guard < next.length) {
    let slowest = 0;
    for (let index = 1; index < next.length; index += 1) {
      const current = VT[next[index] ?? "SVT"].delay;
      const best = VT[next[slowest] ?? "SVT"].delay;
      if (current > best) slowest = index;
    }
    const chosen = next[slowest];
    if (chosen === "HVT") next[slowest] = "SVT";
    else if (chosen === "SVT") next[slowest] = "LVT";
    else break;
    guard += 1;
  }
  return next;
}

export function voltageIsland(input: { vddA: number; vddB: number; aOn: boolean; bOn: boolean }): {
  shifter: boolean;
  isolation: boolean;
  before: number;
  after: number;
} {
  const shifter = input.aOn && input.bOn && Math.abs(input.vddA - input.vddB) > 0.05;
  const isolation = input.aOn !== input.bOn;
  const before = input.aOn ? input.vddA : 0;
  let after = before;
  if (!input.bOn) after = 0;
  else if (shifter) after = input.vddB;
  else if (!input.aOn) after = 0;
  return { shifter, isolation, before, after };
}
