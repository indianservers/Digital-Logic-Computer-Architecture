import type { Mcu } from "../core/mcu";

/** ULN2003 IN1 - IN4 are wired to Arduino D8 - D11, which are PB0 - PB3 on the ATmega328P. */
export const COIL_PINS = ["PB0", "PB1", "PB2", "PB3"] as const;
export const COIL_ARD = [8, 9, 10, 11] as const;

export const DEMO = `// Lab 24: Stepper Motor Control (28BYJ-48 + ULN2003)

const int IN1 = 8;
const int IN2 = 9;
const int IN3 = 10;
const int IN4 = 11;
const int pins[4] = {IN1, IN2, IN3, IN4};

const long stepsPerRev = 2048;  // full steps per output turn (32 x 64:1 gearbox)
int rpm = 12;                   // output shaft speed
int dir = 1;                    // 1 = clockwise, -1 = counter-clockwise
int mode = 0;                   // 0 = full step, 1 = two-coil full step, 2 = half step
long stepsToMove = 2048;        // length of the current move
long stepsTaken = 0;            // steps done so far
int phase = 0;

// Full-step sequence: one coil at a time (4 steps)
int sequence[4][4] = {
  {1, 0, 0, 0},
  {0, 1, 0, 0},
  {0, 0, 1, 0},
  {0, 0, 0, 1}
};

// Two coils at a time: same step size, ~1.4x the torque
int twoCoil[4][4] = {
  {1, 1, 0, 0},
  {0, 1, 1, 0},
  {0, 0, 1, 1},
  {1, 0, 0, 1}
};

// Half-step sequence (8 steps): half the step angle, smoother
int halfStep[8][4] = {
  {1, 0, 0, 0},
  {1, 1, 0, 0},
  {0, 1, 0, 0},
  {0, 1, 1, 0},
  {0, 0, 1, 0},
  {0, 0, 1, 1},
  {0, 0, 0, 1},
  {1, 0, 0, 1}
};

void setup() {
  for (int i = 0; i < 4; i++) pinMode(pins[i], OUTPUT);
  Serial.begin(9600);
  Serial.println("Lab 24: Stepper Motor Control");
}

void writeCoils() {
  for (int i = 0; i < 4; i++) {
    int on;
    if (mode == 2) on = halfStep[phase][i];
    else if (mode == 1) on = twoCoil[phase][i];
    else on = sequence[phase][i];
    digitalWrite(pins[i], on);
  }
}

void loop() {
  if (stepsTaken < stepsToMove) {
    int n = (mode == 2) ? 8 : 4;
    phase = (phase + dir + n) % n;
    writeCoils();
    stepsTaken++;
    long perRev = (mode == 2) ? stepsPerRev * 2 : stepsPerRev;
    delayMicroseconds(60000000L / (perRev * rpm));
  }
}
`;

export const HALF = DEMO.replace("int mode = 0;                   // 0 = full step", "int mode = 2;                   // 0 = full step")
  .replace("long stepsToMove = 2048;        // length of the current move", "long stepsToMove = 4096;        // one turn in half steps");

export const FAST = DEMO.replace("int rpm = 12;                   // output shaft speed", "int rpm = 40;                   // BUG? faster than the rotor can follow");

export const WRONG_ORDER = DEMO.replace(`int sequence[4][4] = {
  {1, 0, 0, 0},
  {0, 1, 0, 0},
  {0, 0, 1, 0},
  {0, 0, 0, 1}
};`, `int sequence[4][4] = {   // BUG: coils 2 and 3 swapped
  {1, 0, 0, 0},
  {0, 0, 1, 0},
  {0, 1, 0, 0},
  {0, 0, 0, 1}
};`);

const RE = {
  rpm: /^(int rpm = )(\d+)(;.*)$/m,
  dir: /^(int dir = )(-?\d+)(;.*)$/m,
  mode: /^(int mode = )(\d+)(;.*)$/m,
} as const;
export type CodeKey = keyof typeof RE;
export function codeVal(src: string, k: CodeKey): number | null { const m = RE[k].exec(src); return m ? Number(m[2]) : null; }
export function setCodeVal(src: string, k: CodeKey, v: number): string {
  return src.replace(RE[k], (_, h: string, _v: string, rest: string) => `${h}${Math.round(v)}${rest}`);
}

/**
 * Rotor model per electrical radian: k = single-coil stiffness, c = viscous damping (ζ ≈ 0.5),
 * wc = speed at which winding inductance and back-EMF halve the available torque.
 */
export interface Motor { label: string; name: string; fullPerRev: number; cycles: number; k: number; c: number; wc: number; coilMa: number }
export const MOTORS: Motor[] = [
  { label: "5.625° (28BYJ-48)", name: "28BYJ-48 (5 V, 1:64 gearbox)", fullPerRev: 2048, cycles: 512, k: 1.86e6, c: 1365, wc: 1670, coilMa: 100 },
  { label: "1.8° (200-step unipolar)", name: "200-step unipolar (5 V)", fullPerRev: 200, cycles: 50, k: 8.2e6, c: 2870, wc: 3000, coilMa: 250 },
];
export const LOADS = ["None", "Light", "Heavy"] as const;
const LOAD_FRAC = [0, 0.12, 0.4];
const FRICTION = 0.03;

export type P24 = { motor: number; load: number; vccOff: boolean; swap23: boolean };
export const P24_DEFAULT: P24 = { motor: 0, load: 0, vccOff: false, swap23: false };

export type Status24 = "Stopped" | "Running" | "Holding" | "Stalled" | "No power";
export interface Step24 {
  /** Rotor and commanded field angles, unwrapped, in electrical radians. */
  theta: number; omega: number; cmd: number;
  inputs: number[]; coils: number[]; mag: number;
  events: number[]; lastStep: number; lastSlip: number;
  /** Start of the current burst of steps, and the rotor's net (signed) speed averaged over ~0.1 s. */
  runStart: number; vNet: number;
  rate: number; rpm: number; outDeg: number; lost: number; current: number; status: Status24;
}
const ST = new WeakMap<Mcu, Step24>();
const blank = (): Step24 => ({ theta: 0, omega: 0, cmd: 0, inputs: [0, 0, 0, 0], coils: [0, 0, 0, 0], mag: 0, events: [], lastStep: -1, lastSlip: -1, runStart: 0, vNet: 0, rate: 0, rpm: 0, outDeg: 0, lost: 0, current: 0, status: "Stopped" });
export function stepper(m: Mcu): Step24 { return ST.get(m) ?? blank(); }

const wrapPi = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

export function world24(m: Mcu, dt: number, p: P24) {
  const s = { ...stepper(m) };
  const mo = MOTORS[p.motor] ?? MOTORS[0]!;
  // The ULN2003 input has a 7.2 kΩ pulldown, so an undriven pin reads as off.
  const inputs = COIL_PINS.map((k) => { const pn = m.pin(k); return m.fw && (pn.mode === "out" || pn.mode === "af") ? m.level(k) : 0; });
  const routed = p.swap23 ? [inputs[0]!, inputs[2]!, inputs[1]!, inputs[3]!] : inputs;
  const coils = p.vccOff ? [0, 0, 0, 0] : routed;
  let sx = 0, sy = 0;
  coils.forEach((on, i) => { if (on) { sx += Math.cos((i * Math.PI) / 2); sy += Math.sin((i * Math.PI) / 2); } });
  const mag = Math.hypot(sx, sy);
  const changed = coils.some((c, i) => c !== s.coils[i]);
  if (mag > 1e-6 && changed) {
    const tgt = Math.atan2(sy, sx);
    if (s.mag < 1e-6 && s.omega === 0) {
      // A resting rotor sits in a detent; the first energized pattern only pulls it to the nearest equilibrium.
      s.theta += wrapPi(tgt - s.theta);
      s.cmd = s.theta;
    } else {
      const d = wrapPi(tgt - s.cmd);
      s.cmd += Math.abs(Math.abs(d) - Math.PI) < 1e-6 ? 0 : d;
    }
    s.events = [...s.events.filter((t) => m.now - t < 0.25), m.now];
    if (s.lastStep < 0 || m.now - s.lastStep > 0.1) s.runStart = m.now;
    s.lastStep = m.now;
  }
  const load = LOAD_FRAC[p.load] ?? 0;
  const H = 1e-4;
  for (let t = 0; t < dt - 1e-9; t += H) {
    const h = Math.min(H, dt - t);
    const drive = mag > 1e-6 ? (mo.k * mag * Math.sin(s.cmd - s.theta)) / (1 + Math.abs(s.omega) / mo.wc) : 0;
    const stick = mo.k * (FRICTION + load);
    let a: number;
    if (Math.abs(s.omega) < 1e-3 && Math.abs(drive) <= stick) { s.omega = 0; a = 0; }
    else a = drive - mo.c * s.omega - Math.sign(s.omega || drive) * stick;
    const w0 = s.omega;
    s.omega += a * h;
    if (w0 !== 0 && Math.sign(s.omega) !== Math.sign(w0) && Math.abs(drive) <= stick) s.omega = 0;
    s.theta += s.omega * h;
  }
  const slip = s.cmd - s.theta;
  const lost = Math.round(slip / (2 * Math.PI)) * 4;
  if (mag > 1e-6 && (lost !== s.lost || Math.abs(wrapPi(slip)) > 1.9)) s.lastSlip = m.now;
  s.events = s.events.filter((t) => m.now - t < 0.25);
  s.rate = s.events.length >= 2 ? (s.events.length - 1) / Math.max(1e-3, s.events[s.events.length - 1]! - s.events[0]!) : 0;
  if (m.now - s.lastStep > 0.25) s.rate = 0;
  s.rpm = (s.omega / (2 * Math.PI) / mo.cycles) * 60;
  s.outDeg = ((s.theta / mo.cycles) * 180) / Math.PI;
  s.lost = lost;
  s.inputs = inputs;
  s.coils = coils;
  s.mag = mag;
  s.current = coils.reduce((n, c) => n + c, 0) * mo.coilMa;
  s.vNet += (s.omega - s.vNet) * Math.min(1, dt / 0.1);
  const recentStep = s.lastStep >= 0 && m.now - s.lastStep < 0.08;
  // Steps keep arriving but the shaft makes no net progress: it is buzzing in place.
  const buzzing = recentStep && m.now - s.runStart > 0.12 && s.rate > 5 && Math.abs(s.vNet) < s.rate * (Math.PI / 4) * 0.3;
  s.status = !m.fw ? "Stopped" : p.vccOff && inputs.some(Boolean) ? "No power"
    : (s.lastSlip >= 0 && m.now - s.lastSlip < 0.3) || buzzing ? "Stalled"
    : recentStep ? "Running" : mag > 1e-6 ? "Holding" : "Stopped";
  ST.set(m, s);
}

/** Output-shaft speed for a given sketch rpm, or the step rate it implies on another motor. */
export function stepRate(rpm: number, mode: number) { return (rpm * 2048 * (mode === 2 ? 2 : 1)) / 60; }
/** Highest steady output speed (RPM) the rotor can hold in sync, from the torque - speed balance. */
export function pullOutRpm(p: P24, mode: number) {
  const mo = MOTORS[p.motor] ?? MOTORS[0]!;
  const mag = mode === 1 ? Math.SQRT2 : mode === 2 ? 1.2 : 1;
  const spare = (w: number) => mag / (1 + w / mo.wc) - (mo.c / mo.k) * w - FRICTION - (LOAD_FRAC[p.load] ?? 0);
  if (spare(0) <= 0) return 0;
  let lo = 0, hi = 1e5;
  for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (spare(mid) > 0) lo = mid; else hi = mid; }
  return (lo / (2 * Math.PI) / mo.cycles) * 60;
}
export const wrap360 = (d: number) => ((d % 360) + 360) % 360;
