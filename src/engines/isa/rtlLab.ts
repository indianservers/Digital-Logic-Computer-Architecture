import { driveBus, type BusResult } from "../cpu/buses";
import { evalRtl, parseRtl, type RtlOp } from "./rtl";

export const RTL_PRESETS = [
  "R3 ← R1 + R2",
  "R3 ← R1 - R2",
  "R4 ← R2 - R1",
  "R5 ← R1 & R2",
  "R6 ← R1 | R2",
  "R7 ← R1 ^ R2",
  "R3 ← R1",
] as const;

const ALU_CODE: Record<string, string> = {
  ADD: "000",
  SUB: "001",
  AND: "010",
  OR: "011",
  XOR: "100",
  MOVE: "101",
};

export function bits3(index: number): string {
  return (index & 7).toString(2).padStart(3, "0");
}

export function mask16(value: number): number {
  return Math.trunc(value) & 0xffff;
}

export type RtlStage = "idle" | "read-a" | "read-b" | "alu" | "drive" | "write" | "done";

export function stagesFor(op: string): RtlStage[] {
  if (op === "MOVE") return ["read-a", "drive", "write", "done"];
  return ["read-a", "read-b", "alu", "drive", "write", "done"];
}

export interface ControlSignal {
  id: string;
  label: string;
  on: boolean;
  detail: string;
}

export interface ControlWordView {
  line: string;
  sa: string;
  sb: string;
  da: string;
  alu: string;
  aluName: string;
  mb: string;
  rw: string;
  grouped: string;
  hex: string;
  signals: ControlSignal[];
  before: number;
  after: number;
}

export function controlWord(regs: number[], line: string): ControlWordView | { error: string } {
  const parsed = parseRtl(line);
  if ("error" in parsed) return parsed;
  const stepped = evalRtl(regs, line);
  if (stepped.error) return { error: stepped.error };
  const view = fieldsOf(parsed);
  const before = regs[parsed.dest] ?? 0;
  const after = stepped.regs[parsed.dest] ?? 0;
  return { ...view, before, after };
}

function fieldsOf(parsed: RtlOp): Omit<ControlWordView, "before" | "after"> {
  const sa = bits3(parsed.left);
  const sb = bits3(parsed.right ?? 0);
  const da = bits3(parsed.dest);
  const alu = ALU_CODE[parsed.op] ?? "000";
  const mb = "0";
  const rw = "1";
  const packed = Number.parseInt(`${sa}${sb}${da}${alu}${mb}${rw}`, 2);
  const move = parsed.op === "MOVE";
  const signals: ControlSignal[] = [
    { id: "a-out", label: `R${parsed.left}_out`, on: true, detail: `R${parsed.left} drives source A.` },
    { id: "b-out", label: parsed.right === null ? "SB unused" : `R${parsed.right}_out`, on: !move, detail: move ? "A move does not read a second register." : `R${parsed.right} drives source B.` },
    { id: "alu-add", label: "ALU_ADD", on: parsed.op === "ADD", detail: "ADD is active only for addition." },
    { id: "alu-sub", label: "ALU_SUB", on: parsed.op === "SUB", detail: "SUB is active only for subtraction." },
    { id: "alu-and", label: "ALU_AND", on: parsed.op === "AND", detail: "AND is the bitwise operation." },
    { id: "alu-or", label: "ALU_OR", on: parsed.op === "OR", detail: "OR is the bitwise operation." },
    { id: "alu-xor", label: "ALU_XOR", on: parsed.op === "XOR", detail: "XOR is the bitwise operation." },
    { id: "alu-pass", label: "ALU_PASS", on: move, detail: "A move bypasses arithmetic. The ALU passes source A." },
    { id: "dest-in", label: `R${parsed.dest}_in`, on: true, detail: `R${parsed.dest} is the only register load-enabled.` },
    { id: "reg-write", label: "REG_WRITE", on: true, detail: "The destination captures the result on the clock edge." },
    { id: "mem-read", label: "MEM_READ", on: false, detail: "This micro-operation does not read memory." },
    { id: "mem-write", label: "MEM_WRITE", on: false, detail: "This micro-operation does not write memory." },
  ];
  return {
    line: `R${parsed.dest} ← R${parsed.left}${move ? "" : ` ${symbol(parsed.op)} R${parsed.right}`}`,
    sa,
    sb: move ? "000" : sb,
    da,
    alu,
    aluName: parsed.op === "MOVE" ? "PASS" : parsed.op,
    mb,
    rw,
    grouped: `${sa} ${move ? "000" : sb} ${da} ${alu} ${mb} ${rw}`,
    hex: `0x${packed.toString(16).toUpperCase()}`,
    signals,
  };
}

function verb(op: string): string {
  if (op === "ADD") return "adds";
  if (op === "SUB") return "subtracts";
  return "combines";
}

function symbol(op: string): string {
  if (op === "SUB") return "-";
  if (op === "AND") return "&";
  if (op === "OR") return "|";
  if (op === "XOR") return "^";
  return "+";
}

export function previewRtl(regs: number[], line: string): { dest: number; before: number; after: number; left: number; right: number | null; op: string; leftName: number; rightName: number | null; explain: string } | { error: string } {
  const parsed = parseRtl(line);
  if ("error" in parsed) return parsed;
  const stepped = evalRtl(regs, line);
  if (stepped.error) return { error: stepped.error };
  const before = regs[parsed.dest] ?? 0;
  const after = stepped.regs[parsed.dest] ?? 0;
  const left = regs[parsed.left] ?? 0;
  const right = parsed.right === null ? null : (regs[parsed.right] ?? 0);
  const explain = parsed.op === "MOVE"
    ? `R${parsed.dest} copies R${parsed.left} (${left}). The ALU passes the value through. R${parsed.left} is read and not modified.`
    : `The ALU ${verb(parsed.op)} R${parsed.left} (${left}) and R${parsed.right} (${right}). R${parsed.dest} changes from ${before} to ${after}. The sources are read and not modified.`;
  return { dest: parsed.dest, before, after, left, right, op: parsed.op, leftName: parsed.left, rightName: parsed.right, explain };
}

export function busValue(drivers: Array<{ name: string; enabled: boolean; value: number }>): BusResult {
  return driveBus(drivers);
}

export function applyBusWrite(regs: number[], destination: number | null, bus: BusResult): { regs: number[]; note: string } {
  if (bus.contention || bus.value === "X") return { regs, note: "The bus is in conflict, so no register captures a value." };
  if (bus.value === "Z" || destination === null) return { regs, note: "The bus is driven, and no destination load-enable is on." };
  const next = regs.slice();
  next[destination] = mask16(bus.value);
  return { regs: next, note: `R${destination} captured ${mask16(bus.value)} from the bus. Other registers stayed put.` };
}
