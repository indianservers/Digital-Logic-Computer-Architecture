import { driveBus, type BusDriver, type BusResult } from "./buses";

export interface BlockCpu {
  pc: number;
  ir: number;
  mar: number;
  mdr: number;
  sp: number;
  regs: number[];
  z: 0 | 1;
  n: 0 | 1;
  c: 0 | 1;
  v: 0 | 1;
}

export type AluOp = "pass" | "add" | "sub" | "and" | "or" | "xor";
export type ExtendOp = "sign" | "zero" | "shl" | "shr" | "sar" | "rol" | "ror";

export function freshCpu(): BlockCpu {
  return { pc: 4, ir: 0, mar: 0, mdr: 0, sp: 0, regs: [0, 0, 0, 0, 0, 0, 0, 0], z: 1, n: 0, c: 0, v: 0 };
}

export function u32(value: number): number {
  return Number(BigInt(Math.trunc(value)) & 0xffffffffn);
}

export function toHex(value: number, digits = 8): string {
  return `0x${u32(value).toString(16).toUpperCase().padStart(digits, "0")}`;
}

export function toBinary(value: number, width = 32): string {
  const bits = Math.min(32, Math.max(1, Math.trunc(width)));
  const mask = bits === 32 ? 0xffffffffn : (1n << BigInt(bits)) - 1n;
  return (BigInt(u32(value)) & mask).toString(2).padStart(bits, "0");
}

export function toSigned(value: number, width = 32): number {
  const bits = Math.min(32, Math.max(1, Math.trunc(width)));
  const masked = bits === 32 ? u32(value) : u32(value) & ((1 << bits) - 1);
  if (bits === 32) return masked >= 0x80000000 ? masked - 0x100000000 : masked;
  const sign = 1 << (bits - 1);
  return masked & sign ? masked - (sign * 2) : masked;
}

export function parseWord(text: string, radix: "hex" | "dec" | "bin"): { ok: true; value: number } | { ok: false; error: string } {
  const cleaned = text.trim().replace(/^0x/i, "");
  if (radix === "bin") {
    if (!/^[01]+$/.test(cleaned)) return { ok: false, error: "Binary uses only 0 and 1." };
    if (cleaned.length > 32) return { ok: false, error: "That value is wider than 32 bits." };
    return { ok: true, value: Number.parseInt(cleaned, 2) };
  }
  if (radix === "hex") {
    if (!/^[0-9a-f]+$/i.test(cleaned)) return { ok: false, error: "Enter a hexadecimal value." };
    if (cleaned.length > 8) return { ok: false, error: "That value is wider than 32 bits." };
    return { ok: true, value: Number.parseInt(cleaned, 16) };
  }
  if (!/^-?\d+$/.test(text.trim())) return { ok: false, error: "Enter a decimal integer." };
  const value = Number(text.trim());
  if (value < -2147483648 || value > 4294967295) return { ok: false, error: "That value does not fit in 32 bits." };
  return { ok: true, value: value < 0 ? u32(value + 4294967296) : u32(value) };
}

export function presetRegisters(kind: "zero" | "ones" | "inc" | "pow" | "pattern" | "seed", seed = 1): number[] {
  if (kind === "ones") return Array.from({ length: 8 }, () => 0xffffffff);
  if (kind === "inc") return Array.from({ length: 8 }, (_, index) => index);
  if (kind === "pow") return Array.from({ length: 8 }, (_, index) => 1 << index);
  if (kind === "pattern") return Array.from({ length: 8 }, () => 0xa5a5a5a5);
  if (kind === "seed") {
    let cursor = seed >>> 0 || 1;
    return Array.from({ length: 8 }, () => {
      cursor = (Math.imul(cursor, 1664525) + 1013904223) >>> 0;
      return cursor;
    });
  }
  return Array.from({ length: 8 }, () => 0);
}

export function writeRegister(cpu: BlockCpu, index: number, value: number): BlockCpu {
  if (index < 0 || index > 7) return cpu;
  const regs = cpu.regs.slice();
  regs[index] = u32(value);
  return { ...cpu, regs };
}

export function executeAlu(op: AluOp, a: number, b: number): { result: number; z: 0 | 1; n: 0 | 1; c: 0 | 1; v: 0 | 1 } {
  const left = BigInt(u32(a));
  const right = BigInt(u32(b));
  let wide = left;
  let carry = 0n;
  if (op === "add") wide = left + right;
  else if (op === "sub") wide = left - right;
  else if (op === "and") wide = left & right;
  else if (op === "or") wide = left | right;
  else if (op === "xor") wide = left ^ right;
  if (op === "add") carry = wide > 0xffffffffn ? 1n : 0n;
  if (op === "sub") carry = left >= right ? 1n : 0n;
  const result = Number(wide & 0xffffffffn);
  const sa = toSigned(Number(left));
  const sb = toSigned(Number(right));
  const sr = toSigned(result);
  const overflow = op === "add" ? (sa >= 0 && sb >= 0 && sr < 0) || (sa < 0 && sb < 0 && sr >= 0) : op === "sub" ? (sa >= 0 && sb < 0 && sr < 0) || (sa < 0 && sb >= 0 && sr >= 0) : false;
  return { result, z: result === 0 ? 1 : 0, n: result >>> 31 ? 1 : 0, c: carry ? 1 : 0, v: overflow ? 1 : 0 };
}

export function applyAlu(cpu: BlockCpu, op: AluOp, a: number, b: number, dest: number | null): { cpu: BlockCpu; result: number } {
  const alu = executeAlu(op, a, b);
  let next: BlockCpu = { ...cpu, z: alu.z, n: alu.n, c: alu.c, v: alu.v };
  if (dest !== null) next = writeRegister(next, dest, alu.result);
  return { cpu: next, result: alu.result };
}

export function captureBus(drivers: BusDriver[]): BusResult {
  return driveBus(drivers);
}

export function signExtendBits(value: number, inputWidth: number, outputWidth: number): number {
  const m = clamp(inputWidth, 1, 32);
  const n = Math.max(m, clamp(outputWidth, 1, 32));
  const masked = BigInt(u32(value)) & ((1n << BigInt(m)) - 1n);
  const sign = (masked >> BigInt(m - 1)) & 1n;
  if (sign === 0n) return Number(masked);
  const fill = ((1n << BigInt(n - m)) - 1n) << BigInt(m);
  return Number((masked | fill) & ((1n << BigInt(n)) - 1n));
}

export function zeroExtendBits(value: number, inputWidth: number, outputWidth: number): number {
  const m = clamp(inputWidth, 1, 32);
  const n = Math.max(m, clamp(outputWidth, 1, 32));
  const masked = BigInt(u32(value)) & ((1n << BigInt(m)) - 1n);
  return Number(masked & ((1n << BigInt(n)) - 1n));
}

export function shiftLeftBits(value: number, width: number, amount: number): { result: number; shiftedOut: number } {
  const bits = clamp(width, 1, 32);
  const shift = clamp(amount, 0, bits);
  const mask = (1n << BigInt(bits)) - 1n;
  const masked = BigInt(u32(value)) & mask;
  const shiftedOut = shift === 0 ? 0 : Number((masked >> BigInt(bits - shift)) & ((1n << BigInt(shift)) - 1n));
  return { result: Number((masked << BigInt(shift)) & mask), shiftedOut };
}

export function shiftRightLogicalBits(value: number, width: number, amount: number): { result: number; shiftedOut: number } {
  const bits = clamp(width, 1, 32);
  const shift = clamp(amount, 0, bits);
  const mask = (1n << BigInt(bits)) - 1n;
  const masked = BigInt(u32(value)) & mask;
  const shiftedOut = shift === 0 ? 0 : Number(masked & ((1n << BigInt(shift)) - 1n));
  return { result: Number((masked >> BigInt(shift)) & mask), shiftedOut };
}

export function shiftRightArithmeticBits(value: number, width: number, amount: number): { result: number; shiftedOut: number } {
  const logical = shiftRightLogicalBits(value, width, amount);
  const bits = clamp(width, 1, 32);
  const shift = clamp(amount, 0, bits);
  const sign = (BigInt(u32(value)) >> BigInt(bits - 1)) & 1n;
  if (sign === 0n || shift === 0) return logical;
  const fill = ((1n << BigInt(shift)) - 1n) << BigInt(bits - shift);
  const mask = (1n << BigInt(bits)) - 1n;
  return { result: Number((BigInt(logical.result) | fill) & mask), shiftedOut: logical.shiftedOut };
}

export function rotateLeftBits(value: number, width: number, amount: number): number {
  const bits = clamp(width, 1, 32);
  const shift = ((amount % bits) + bits) % bits;
  const mask = (1n << BigInt(bits)) - 1n;
  const masked = BigInt(u32(value)) & mask;
  if (shift === 0) return Number(masked);
  return Number(((masked << BigInt(shift)) | (masked >> BigInt(bits - shift))) & mask);
}

export function rotateRightBits(value: number, width: number, amount: number): number {
  const bits = clamp(width, 1, 32);
  const shift = ((amount % bits) + bits) % bits;
  return rotateLeftBits(value, bits, bits - shift);
}

export interface ClockMachine {
  level: 0 | 1;
  cycle: number;
  q: number;
  data: number;
  enable: boolean;
  mode: "rising" | "falling";
}

export function freshClock(): ClockMachine {
  return { level: 0, cycle: 0, q: 0, data: 0, enable: true, mode: "rising" };
}

export function stepClock(machine: ClockMachine, data = machine.data, enable = machine.enable): { machine: ClockMachine; edge: "rising" | "falling" | null; captured: boolean; event: string } {
  const nextLevel: 0 | 1 = machine.level === 0 ? 1 : 0;
  const edge = machine.level === 0 && nextLevel === 1 ? "rising" : machine.level === 1 && nextLevel === 0 ? "falling" : null;
  const active = edge === machine.mode && enable;
  const q = active ? u32(data) : machine.q;
  const cycle = edge === "rising" ? machine.cycle + 1 : machine.cycle;
  const event = active ? `Register captured ${toHex(q, 1)}` : enable ? "No update between edges" : "Enable low — no update";
  return { machine: { ...machine, level: nextLevel, cycle, q, data: u32(data), enable }, edge, captured: active, event };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
