import { dFlipFlop, dLatch, srNor, type Edge, type Level } from "../../engines/digital/sequential";
import { evalGate, resolveDrivers } from "../../simulation/digital/gates";
import type { LogicValue } from "../../types/logic";

/** Educational long-channel model. Not a foundry SPICE deck. */
export const MOS_MODEL_NOTE = "Square-law long-channel MOSFET. k′n = 200 µA/V², k′p = 80 µA/V², λ = 0.04 V⁻¹. Body effect uses γ = 0.45 V½ and 2φF = 0.6 V. CMOS power and delay reuse this current. Values are for learning, not a process design kit.";

export type MosRegion = "cutoff" | "linear" | "saturation";
export type Polarity = "nmos" | "pmos";

export interface MosPoint {
  vgs: number;
  vds: number;
  vth: number;
  id: number;
  region: MosRegion;
  overdrive: number;
  gm: number;
}

const KN_PRIME = 200e-6;
const KP_PRIME = 80e-6;
const LAMBDA = 0.04;

export function processTransconductance(polarity: Polarity): number {
  return polarity === "nmos" ? KN_PRIME : KP_PRIME;
}

export function deviceK(polarity: Polarity, widthUm: number, lengthUm: number): number {
  const length = Math.max(0.05, lengthUm);
  return processTransconductance(polarity) * (Math.max(0.05, widthUm) / length);
}

/** Reverse source-body bias raises |VTH|. */
export function bodyEffect(vth0: number, vsb: number): number {
  const gamma = 0.45;
  const phi = 0.3;
  const reverse = Math.max(0, vsb);
  return vth0 + gamma * (Math.sqrt(phi + reverse) - Math.sqrt(phi));
}

export function thresholdAtTemperature(vth0: number, celsius: number): number {
  return Math.max(0.05, vth0 - 0.0015 * (celsius - 27));
}

export function squareLaw(vgs: number, vds: number, vth: number, k: number, lambda = LAMBDA): MosPoint {
  const drive = Math.max(0, vds);
  if (vgs <= vth) {
    return { vgs, vds, vth, id: 0, region: "cutoff", overdrive: vgs - vth, gm: 0 };
  }
  const overdrive = vgs - vth;
  if (drive < overdrive) {
    const id = k * (overdrive * drive - 0.5 * drive * drive);
    return { vgs, vds, vth, id: Math.max(0, id), region: "linear", overdrive, gm: k * drive };
  }
  const id = 0.5 * k * overdrive * overdrive * (1 + lambda * drive);
  return { vgs, vds, vth, id, region: "saturation", overdrive, gm: k * overdrive * (1 + lambda * drive) };
}

export function mosfet(polarity: Polarity, vgsMagnitude: number, vdsMagnitude: number, vth: number, k: number): MosPoint {
  void polarity;
  return squareLaw(vgsMagnitude, vdsMagnitude, vth, k);
}

export interface CurvePoint {
  x: number;
  y: number;
}

export function idVdsFamily(vgsValues: number[], vdsMax: number, vth: number, k: number, samples = 48): Array<{ vgs: number; points: CurvePoint[] }> {
  return vgsValues.map((vgs) => {
    const points: CurvePoint[] = [];
    for (let index = 0; index <= samples; index += 1) {
      const vds = (vdsMax * index) / samples;
      points.push({ x: vds, y: squareLaw(vgs, vds, vth, k).id });
    }
    return { vgs, points };
  });
}

export function idVgsCurve(vds: number, vgsMax: number, vth: number, k: number, samples = 48): CurvePoint[] {
  const points: CurvePoint[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const vgs = (vgsMax * index) / samples;
    points.push({ x: vgs, y: squareLaw(vgs, vds, vth, k).id });
  }
  return points;
}

export type CapState = "accumulation" | "depletion" | "inversion";

export interface MosCapResult {
  state: CapState;
  vth: number;
  depletionNm: number;
  coxFf: number;
  capFf: number;
  bend: number;
  carriers: string;
}

/** 1 µm × 1 µm MOS capacitor on the chosen substrate. Low-frequency C–V. */
export function mosCapacitor(gateVolts: number, toxNm: number, doping: number, body: "p" | "n", celsius = 27): MosCapResult {
  const tox = Math.max(1, toxNm);
  const dose = Math.max(1e14, doping);
  const vth = Math.max(0.12, 0.35 + 0.06 * Math.log10(dose / 1e15) + 0.004 * tox - 0.0015 * (celsius - 27));
  const surface = body === "p" ? gateVolts : -gateVolts;
  const coxFf = 34.5 / tox;
  let state: CapState = "depletion";
  if (surface < 0) state = "accumulation";
  else if (surface >= vth) state = "inversion";
  const depletionNm = state === "accumulation" ? 0 : Math.min(280, 40 * Math.sqrt(Math.max(0.05, Math.min(surface, vth))));
  const cdep = depletionNm < 1 ? coxFf * 20 : 11.7 * 8.85e-3 / (depletionNm * 1e-3);
  const series = state === "depletion" ? 1 / (1 / coxFf + 1 / Math.max(cdep, 0.01)) : coxFf;
  const carriers = body === "p"
    ? state === "accumulation" ? "Holes gather at the oxide" : state === "inversion" ? "Electrons invert the surface" : "A hole-depleted layer widens"
    : state === "accumulation" ? "Electrons gather at the oxide" : state === "inversion" ? "Holes invert the surface" : "An electron-depleted layer widens";
  return { state, vth, depletionNm, coxFf, capFf: series, bend: Math.max(-1, Math.min(1, surface / Math.max(0.4, vth))), carriers };
}

export interface InverterBias {
  vdd: number;
  vin: number;
  kn: number;
  kp: number;
  vtn: number;
  vtp: number;
}

export interface InverterPoint {
  vout: number;
  nmos: MosPoint;
  pmos: MosPoint;
  current: number;
  nmosOn: boolean;
  pmosOn: boolean;
  logic: 0 | 1;
}

export function cmosInverter(bias: InverterBias): InverterPoint {
  const { vdd, vin, kn, kp, vtn, vtp } = bias;
  const nOn = vin > vtn;
  const pOn = vdd - vin > vtp;
  if (!nOn) {
    const nmos = squareLaw(vin, vdd, vtn, kn);
    const pmos = squareLaw(vdd - vin, 0, vtp, kp);
    return { vout: vdd, nmos, pmos, current: 0, nmosOn: false, pmosOn: true, logic: 1 };
  }
  if (!pOn) {
    const nmos = squareLaw(vin, 0, vtn, kn);
    const pmos = squareLaw(vdd - vin, vdd, vtp, kp);
    return { vout: 0, nmos, pmos, current: 0, nmosOn: true, pmosOn: false, logic: 0 };
  }
  let low = 0;
  let high = vdd;
  for (let step = 0; step < 36; step += 1) {
    const mid = (low + high) / 2;
    const idn = squareLaw(vin, mid, vtn, kn).id;
    const idp = squareLaw(vdd - vin, vdd - mid, vtp, kp).id;
    if (idn > idp) high = mid;
    else low = mid;
  }
  const vout = (low + high) / 2;
  const nmos = squareLaw(vin, vout, vtn, kn);
  const pmos = squareLaw(vdd - vin, vdd - vout, vtp, kp);
  return { vout, nmos, pmos, current: Math.min(nmos.id, pmos.id), nmosOn: true, pmosOn: true, logic: vout >= vdd / 2 ? 1 : 0 };
}

export interface VtcSample {
  vin: number;
  vout: number;
  gain: number;
  nmosOn: boolean;
  pmosOn: boolean;
}

export function voltageTransfer(bias: Omit<InverterBias, "vin">, samples = 61): VtcSample[] {
  const rows: VtcSample[] = [];
  for (let index = 0; index < samples; index += 1) {
    const vin = (bias.vdd * index) / (samples - 1);
    const point = cmosInverter({ ...bias, vin });
    rows.push({ vin, vout: point.vout, gain: 0, nmosOn: point.nmosOn, pmosOn: point.pmosOn });
  }
  for (let index = 0; index < rows.length - 1; index += 1) {
    const left = rows[index];
    const right = rows[index + 1];
    if (!left || !right) continue;
    const span = right.vin - left.vin;
    const gain = span === 0 ? 0 : (right.vout - left.vout) / span;
    left.gain = gain;
    if (index === rows.length - 2) right.gain = gain;
  }
  return rows;
}

export interface NoiseMargins {
  voh: number;
  vol: number;
  vil: number;
  vih: number;
  vm: number;
  nml: number;
  nmh: number;
}

export function noiseMargins(curve: VtcSample[], vdd: number): NoiseMargins {
  const first = curve[0];
  const last = curve[curve.length - 1];
  let vil = first?.vin ?? 0;
  let vih = last?.vin ?? vdd;
  let entered = false;
  for (const sample of curve) {
    if (!entered && sample.gain <= -1) {
      vil = sample.vin;
      entered = true;
    } else if (entered && sample.gain > -1) {
      vih = sample.vin;
      break;
    }
  }
  let vm = vdd / 2;
  let best = Number.POSITIVE_INFINITY;
  for (const sample of curve) {
    const gap = Math.abs(sample.vin - sample.vout);
    if (gap < best) {
      best = gap;
      vm = sample.vin;
    }
  }
  const voh = first?.vout ?? vdd;
  const vol = last?.vout ?? 0;
  return { voh, vol, vil, vih, vm, nml: vil - vol, nmh: voh - vih };
}

export interface PowerParts {
  dynamic: number;
  shortCircuit: number;
  leakage: number;
  total: number;
}

export function cmosPower(input: { vdd: number; frequency: number; alpha: number; capacitance: number; celsius: number; vth: number; widthUm: number }): PowerParts {
  const dynamic = input.alpha * input.capacitance * input.vdd * input.vdd * input.frequency;
  const headroom = Math.max(0, input.vdd - 2 * input.vth);
  const shortCircuit = input.alpha * input.frequency * (KN_PRIME * input.widthUm / 12) * headroom ** 3 * 80e-12;
  const leakage = 1.5e-9 * input.widthUm * input.vdd * Math.exp(0.035 * (input.celsius - 27));
  return { dynamic, shortCircuit, leakage, total: dynamic + shortCircuit + leakage };
}

export interface DelayResult {
  tpHL: number;
  tpLH: number;
  fall: number;
  rise: number;
  reqN: number;
  reqP: number;
}

/** td ≈ 0.69 Req CL, with Req = VDD / Id,sat from the same square-law model. Input slew adds 10% of its duration. */
export function cmosDelay(input: { vdd: number; vth: number; capacitance: number; wn: number; ln: number; wp: number; lp: number; slew: number }): DelayResult {
  const kn = deviceK("nmos", input.wn, input.ln);
  const kp = deviceK("pmos", input.wp, input.lp);
  const idn = Math.max(1e-12, squareLaw(input.vdd, input.vdd, input.vth, kn).id);
  const idp = Math.max(1e-12, squareLaw(input.vdd, input.vdd, input.vth, kp).id);
  const reqN = input.vdd / idn;
  const reqP = input.vdd / idp;
  const slew = 0.1 * Math.max(0, input.slew);
  return {
    reqN,
    reqP,
    tpHL: 0.69 * reqN * input.capacitance + slew,
    tpLH: 0.69 * reqP * input.capacitance + slew,
    fall: 2.2 * reqN * input.capacitance,
    rise: 2.2 * reqP * input.capacitance,
  };
}

export type Bit = 0 | 1;

export interface CmosNetwork {
  y: Bit;
  devices: Array<{ id: string; polarity: Polarity; on: boolean; input: string }>;
  pullUp: boolean;
  pullDown: boolean;
  path: "pull-up" | "pull-down";
}

function asBit(value: LogicValue): Bit {
  return value === 1 ? 1 : 0;
}

export function cmosNand(a: Bit, b: Bit): CmosNetwork {
  const y = asBit(evalGate("NAND", [a, b]));
  const devices = [
    { id: "PA", polarity: "pmos" as const, on: a === 0, input: "A" },
    { id: "PB", polarity: "pmos" as const, on: b === 0, input: "B" },
    { id: "NA", polarity: "nmos" as const, on: a === 1, input: "A" },
    { id: "NB", polarity: "nmos" as const, on: b === 1, input: "B" },
  ];
  const pullUp = a === 0 || b === 0;
  const pullDown = a === 1 && b === 1;
  return { y, devices, pullUp, pullDown, path: pullDown ? "pull-down" : "pull-up" };
}

export function cmosNor(a: Bit, b: Bit): CmosNetwork {
  const y = asBit(evalGate("NOR", [a, b]));
  const devices = [
    { id: "PA", polarity: "pmos" as const, on: a === 0, input: "A" },
    { id: "PB", polarity: "pmos" as const, on: b === 0, input: "B" },
    { id: "NA", polarity: "nmos" as const, on: a === 1, input: "A" },
    { id: "NB", polarity: "nmos" as const, on: b === 1, input: "B" },
  ];
  const pullUp = a === 0 && b === 0;
  const pullDown = a === 1 || b === 1;
  return { y, devices, pullUp, pullDown, path: pullDown ? "pull-down" : "pull-up" };
}

export interface ComplexGateSpec {
  id: "aoi21" | "aoi22" | "oai21" | "oai22";
  name: string;
  expression: string;
  inputs: string[];
  pullDown: string;
  pullUp: string;
  transistors: number;
}

export const COMPLEX_GATES: ComplexGateSpec[] = [
  { id: "aoi21", name: "AOI21", expression: "Y = ((A · B) + C)′", inputs: ["A", "B", "C"], pullDown: "(A series B) parallel C", pullUp: "(A parallel B) series C", transistors: 6 },
  { id: "aoi22", name: "AOI22", expression: "Y = ((A · B) + (C · D))′", inputs: ["A", "B", "C", "D"], pullDown: "(A series B) parallel (C series D)", pullUp: "(A parallel B) series (C parallel D)", transistors: 8 },
  { id: "oai21", name: "OAI21", expression: "Y = ((A + B) · C)′", inputs: ["A", "B", "C"], pullDown: "(A parallel B) series C", pullUp: "(A series B) parallel C", transistors: 6 },
  { id: "oai22", name: "OAI22", expression: "Y = ((A + B) · (C + D))′", inputs: ["A", "B", "C", "D"], pullDown: "(A parallel B) series (C parallel D)", pullUp: "(A series B) parallel (C series D)", transistors: 8 },
];

function bitOf(bits: Record<string, Bit>, name: string): Bit {
  return bits[name] === 1 ? 1 : 0;
}

export function complexCmos(id: ComplexGateSpec["id"], bits: Record<string, Bit>): CmosNetwork & { spec: ComplexGateSpec } {
  const spec = COMPLEX_GATES.find((gate) => gate.id === id) ?? COMPLEX_GATES[0]!;
  const a = bitOf(bits, "A");
  const b = bitOf(bits, "B");
  const c = bitOf(bits, "C");
  const d = bitOf(bits, "D");
  let pullDown = false;
  if (id === "aoi21") pullDown = (a === 1 && b === 1) || c === 1;
  if (id === "aoi22") pullDown = (a === 1 && b === 1) || (c === 1 && d === 1);
  if (id === "oai21") pullDown = (a === 1 || b === 1) && c === 1;
  if (id === "oai22") pullDown = (a === 1 || b === 1) && (c === 1 || d === 1);
  const devices = spec.inputs.flatMap((input) => ([
    { id: `P${input}`, polarity: "pmos" as const, on: bitOf(bits, input) === 0, input },
    { id: `N${input}`, polarity: "nmos" as const, on: bitOf(bits, input) === 1, input },
  ]));
  return { spec, y: pullDown ? 0 : 1, devices, pullUp: !pullDown, pullDown, path: pullDown ? "pull-down" : "pull-up" };
}

export function transmissionGate(enabled: Bit, source: number): { vout: number | "Z"; conducting: boolean } {
  if (enabled === 0) return { vout: "Z", conducting: false };
  return { vout: source, conducting: true };
}

export interface PassResult {
  vout: number | "Z";
  note: string;
  conducting: boolean;
  degraded: boolean;
}

/** NMOS passes a strong 0 and a 1 no higher than Vgate − VTH. PMOS does the complement. The transmission gate passes the input. */
export function passTransistor(kind: "nmos" | "pmos" | "tg", vin: number, gate: number, vdd: number, vth: number): PassResult {
  if (kind === "tg") {
    const enabled = gate >= vdd / 2;
    return enabled
      ? { vout: vin, conducting: true, degraded: false, note: "Both devices conduct. The output follows the input." }
      : { vout: "Z", conducting: false, degraded: false, note: "The transmission gate is off. The output floats." };
  }
  if (kind === "nmos") {
    if (gate <= vth) return { vout: "Z", conducting: false, degraded: false, note: "NMOS is off. Gate is not above threshold." };
    const limit = gate - vth;
    const vout = Math.min(vin, Math.max(0, limit));
    const degraded = vin > limit + 1e-6;
    return { vout, conducting: true, degraded, note: degraded ? "Strong 0 would pass. This 1 stops near Vgate − VTH." : "NMOS passes this low level without a threshold drop." };
  }
  if (gate >= vdd - vth) return { vout: "Z", conducting: false, degraded: false, note: "PMOS is off. Its gate is not low enough." };
  const floor = gate + vth;
  const vout = Math.max(vin, Math.min(vdd, floor));
  const degraded = vin < floor - 1e-6;
  return { vout, conducting: true, degraded, note: degraded ? "Strong 1 would pass. This 0 cannot fall below Vgate + |VTH|." : "PMOS passes this high level cleanly." };
}

export function triStateOutput(data: Bit, enable: Bit): LogicValue {
  return evalGate("TRI", [data, enable]);
}

export function sharedWire(drivers: LogicValue[]): LogicValue {
  return resolveDrivers(drivers);
}

export function latchSr(s: Bit, r: Bit, q: Level) {
  return srNor(s, r, q);
}

export function latchD(d: Bit, enable: Bit, q: Level) {
  return dLatch(d, enable, q);
}

export function flipFlopD(d: Bit, clock: Bit, previousClock: Bit, q: Level, edge: Edge, reset: Bit) {
  return dFlipFlop(d, clock, previousClock, q, edge, reset);
}

/** Rising-edge D flip-flop made from two D latches. Master is transparent while CLK is low. */
export function dMasterSlave(d: Bit, clock: Bit, master: Level, slave: Level): { master: Level; slave: Level; q: Level; qn: Level; phase: string } {
  if (clock === 0) {
    const nextMaster = dLatch(d, 1, master);
    const held = dLatch(0, 0, slave);
    return { master: nextMaster.q, slave: held.q, q: held.q, qn: held.qn, phase: "CLK low: master follows D, slave holds Q" };
  }
  const heldMaster = dLatch(0, 0, master);
  const sample = heldMaster.q === 0 || heldMaster.q === 1 ? heldMaster.q : "X";
  const nextSlave = dLatch(sample, 1, slave);
  return { master: heldMaster.q, slave: nextSlave.q, q: nextSlave.q, qn: nextSlave.qn, phase: "CLK high: master holds, slave copies it" };
}

const SI = [
  { scale: 1e12, prefix: "T" },
  { scale: 1e9, prefix: "G" },
  { scale: 1e6, prefix: "M" },
  { scale: 1e3, prefix: "k" },
  { scale: 1, prefix: "" },
  { scale: 1e-3, prefix: "m" },
  { scale: 1e-6, prefix: "µ" },
  { scale: 1e-9, prefix: "n" },
  { scale: 1e-12, prefix: "p" },
  { scale: 1e-15, prefix: "f" },
];

export function engineering(value: number, unit: string, digits = 2): string {
  if (!Number.isFinite(value)) return `— ${unit}`;
  const magnitude = Math.abs(value);
  if (magnitude === 0) return `0 ${unit}`;
  const chosen = SI.find((row) => magnitude >= row.scale) ?? SI[SI.length - 1]!;
  const scaled = value / chosen.scale;
  const text = Math.abs(scaled) >= 100 ? scaled.toFixed(0) : Math.abs(scaled) >= 10 ? scaled.toFixed(1) : scaled.toFixed(digits);
  return `${text} ${chosen.prefix}${unit}`;
}

export function regionLabel(region: MosRegion): string {
  if (region === "linear") return "Linear (triode)";
  if (region === "saturation") return "Saturation";
  return "Cutoff";
}
