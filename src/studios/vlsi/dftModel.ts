export type Bit = 0 | 1;

export function shiftScan(cells: Bit[], scanIn: Bit): { cells: Bit[]; scanOut: Bit } {
  const scanOut = cells[cells.length - 1] ?? 0;
  return { cells: [scanIn, ...cells.slice(0, -1)], scanOut };
}

export function shiftMany(cells: Bit[], bits: Bit[]): { cells: Bit[]; outputs: Bit[] } {
  let current = cells;
  const outputs: Bit[] = [];
  for (const bit of bits) {
    const step = shiftScan(current, bit);
    current = step.cells;
    outputs.push(step.scanOut);
  }
  return { cells: current, outputs };
}

/** Combinational cloud between scan cells: y = a AND b. Index 2 is the captured response. */
export function scanCapture(cells: Bit[], fault: { index: number; stuck: Bit } | null): Bit[] {
  const a = fault?.index === 0 ? fault.stuck : (cells[0] ?? 0);
  const b = fault?.index === 1 ? fault.stuck : (cells[1] ?? 0);
  let y: Bit = a === 1 && b === 1 ? 1 : 0;
  if (fault?.index === 2) y = fault.stuck;
  return [a, b, y];
}

export interface StuckFault {
  net: string;
  stuck: Bit;
}

export interface CircuitValue {
  values: Record<string, Bit>;
  output: Bit;
}

/** y = (a AND b) OR c. Net "dead" is a AND c and is not observed. */
export function simulateStuck(pins: Record<string, Bit>, fault: StuckFault | null): CircuitValue {
  const read = (net: string, computed: Bit): Bit => (fault?.net === net ? fault.stuck : computed);
  const a = read("a", pins.a ?? 0);
  const b = read("b", pins.b ?? 0);
  const c = read("c", pins.c ?? 0);
  const n1 = read("n1", a === 1 && b === 1 ? 1 : 0);
  const dead = read("dead", a === 1 && c === 1 ? 1 : 0);
  const y = read("y", n1 === 1 || c === 1 ? 1 : 0);
  return { values: { a, b, c, n1, dead, y }, output: y };
}

export const STUCK_NETS = ["a", "b", "c", "n1", "dead", "y"] as const;

export function faultObserved(pins: Record<string, Bit>, fault: StuckFault): boolean {
  return simulateStuck(pins, null).output !== simulateStuck(pins, fault).output;
}

export function generatePattern(fault: StuckFault): { vector: Record<string, Bit> | null; detects: boolean } {
  for (let mask = 0; mask < 8; mask += 1) {
    const vector: Record<string, Bit> = {
      a: (mask & 1) === 0 ? 0 : 1,
      b: (mask & 2) === 0 ? 0 : 1,
      c: (mask & 4) === 0 ? 0 : 1,
    };
    if (faultObserved(vector, fault)) return { vector, detects: true };
  }
  return { vector: null, detects: false };
}

export const TAP_STATES = [
  "Test-Logic-Reset",
  "Run-Test/Idle",
  "Select-DR-Scan",
  "Capture-DR",
  "Shift-DR",
  "Exit1-DR",
  "Pause-DR",
  "Exit2-DR",
  "Update-DR",
  "Select-IR-Scan",
  "Capture-IR",
  "Shift-IR",
  "Exit1-IR",
  "Pause-IR",
  "Exit2-IR",
  "Update-IR",
] as const;

export type TapState = (typeof TAP_STATES)[number];

const TAP_NEXT: Record<TapState, [TapState, TapState]> = {
  "Test-Logic-Reset": ["Run-Test/Idle", "Test-Logic-Reset"],
  "Run-Test/Idle": ["Run-Test/Idle", "Select-DR-Scan"],
  "Select-DR-Scan": ["Capture-DR", "Select-IR-Scan"],
  "Capture-DR": ["Shift-DR", "Exit1-DR"],
  "Shift-DR": ["Shift-DR", "Exit1-DR"],
  "Exit1-DR": ["Pause-DR", "Update-DR"],
  "Pause-DR": ["Pause-DR", "Exit2-DR"],
  "Exit2-DR": ["Shift-DR", "Update-DR"],
  "Update-DR": ["Run-Test/Idle", "Select-DR-Scan"],
  "Select-IR-Scan": ["Capture-IR", "Test-Logic-Reset"],
  "Capture-IR": ["Shift-IR", "Exit1-IR"],
  "Shift-IR": ["Shift-IR", "Exit1-IR"],
  "Exit1-IR": ["Pause-IR", "Update-IR"],
  "Pause-IR": ["Pause-IR", "Exit2-IR"],
  "Exit2-IR": ["Shift-IR", "Update-IR"],
  "Update-IR": ["Run-Test/Idle", "Select-DR-Scan"],
};

export function tapNext(state: TapState, tms: Bit): TapState {
  const pair = TAP_NEXT[state];
  return tms === 0 ? pair[0] : pair[1];
}

export type JtagInstruction = "BYPASS" | "SAMPLE" | "EXTEST";

export function instructionOf(ir: number): JtagInstruction {
  if ((ir & 0xf) === 0) return "EXTEST";
  if ((ir & 0xf) === 0b0010) return "SAMPLE";
  return "BYPASS";
}

export interface TapMachine {
  state: TapState;
  ir: number;
  irShift: number;
  dr: number;
  tdo: Bit;
  instruction: JtagInstruction;
}

export function freshTap(): TapMachine {
  return { state: "Test-Logic-Reset", ir: 0b1111, irShift: 0b1111, dr: 0, tdo: 1, instruction: "BYPASS" };
}

export function tapClock(machine: TapMachine, tms: Bit, tdi: Bit): TapMachine {
  let { ir, irShift, dr, instruction } = machine;
  let tdo: Bit = machine.tdo;
  if (machine.state === "Shift-DR") {
    tdo = (dr & 1) as Bit;
    const width = instruction === "BYPASS" ? 1 : 4;
    const mask = (1 << width) - 1;
    dr = ((dr >> 1) | (tdi << (width - 1))) & mask;
  }
  if (machine.state === "Shift-IR") {
    tdo = (irShift & 1) as Bit;
    irShift = ((irShift >> 1) | (tdi << 3)) & 0xf;
  }
  if (machine.state === "Capture-DR") dr = instruction === "BYPASS" ? 0 : 0b1010;
  if (machine.state === "Capture-IR") irShift = 0b0001;
  if (machine.state === "Update-IR") {
    ir = irShift;
    instruction = instructionOf(ir);
  }
  return { state: tapNext(machine.state, tms), ir, irShift, dr, tdo, instruction };
}

export function lfsrStep(state: number): number {
  const feedback = ((state >> 3) ^ state) & 1;
  return ((state << 1) | feedback) & 0xf;
}

export function misrStep(signature: number, bit: Bit): number {
  const mixed = ((signature << 1) | bit) & 0xff;
  return (mixed & 0x80) !== 0 ? (mixed ^ 0b10000111) & 0xff : mixed;
}

export function bistRun(seed: number, cycles: number, fault: boolean): { vectors: number[]; signature: number } {
  let state = seed & 0xf;
  if (state === 0) state = 1;
  let signature = 0;
  const vectors: number[] = [];
  const limit = Math.max(1, Math.min(32, Math.round(cycles)));
  for (let index = 0; index < limit; index += 1) {
    vectors.push(state);
    const raw: Bit = ((state ^ (state >> 1)) & 1) === 1 ? 1 : 0;
    const bit: Bit = fault ? (raw === 1 ? 0 : 1) : raw;
    signature = misrStep(signature, bit);
    state = lfsrStep(state);
  }
  return { vectors, signature };
}
