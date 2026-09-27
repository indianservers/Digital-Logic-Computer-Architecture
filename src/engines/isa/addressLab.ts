import { toHex32 } from "../isaarch/bits";
import { encodeI, encodeR } from "../isaarch/riscv";
import { i32 } from "./teach";

export const ADDR_MODES = ["immediate", "register", "direct", "indirect", "base-offset", "indexed"] as const;
export type AddrMode = (typeof ADDR_MODES)[number];

export const ALU_OPS = ["ADD", "SUB", "AND", "OR", "XOR"] as const;
export type AluOp = (typeof ALU_OPS)[number];

export interface AddrState {
  rd: number;
  rs1: number;
  rs2: number;
  imm: number;
  address: number;
  pointer: number;
  base: number;
  index: number;
  offset: number;
  op: AluOp;
  regs: number[];
  mem: Record<number, number>;
}

export interface FieldView {
  name: string;
  hi: number;
  lo: number;
  tone: "imm" | "rs1" | "rs2" | "funct" | "rd" | "op";
}

export interface MemRow {
  address: number;
  value: number;
  role: "idle" | "pointer" | "target";
}

export interface RegRow {
  index: number;
  value: number;
  role: "source" | "source2" | "dest" | "base" | "index";
}

export interface AddrView {
  assembly: string;
  meaning: string;
  fields: FieldView[] | null;
  word: number | null;
  steps: string[];
  regs: RegRow[];
  memory: MemRow[] | null;
  ea: number | null;
  operand: number;
  equation: string;
  loaded: string;
  note: string;
  error: string | null;
  memAccess: boolean;
}

const I_FIELDS = (immName: string): FieldView[] => [
  { name: immName, hi: 31, lo: 20, tone: "imm" },
  { name: "rs1", hi: 19, lo: 15, tone: "rs1" },
  { name: "funct3", hi: 14, lo: 12, tone: "funct" },
  { name: "rd", hi: 11, lo: 7, tone: "rd" },
  { name: "opcode", hi: 6, lo: 0, tone: "op" },
];

const R_FIELDS: FieldView[] = [
  { name: "funct7", hi: 31, lo: 25, tone: "funct" },
  { name: "rs2", hi: 24, lo: 20, tone: "rs2" },
  { name: "rs1", hi: 19, lo: 15, tone: "rs1" },
  { name: "funct3", hi: 14, lo: 12, tone: "funct" },
  { name: "rd", hi: 11, lo: 7, tone: "rd" },
  { name: "opcode", hi: 6, lo: 0, tone: "op" },
];

export function parseAddrMode(raw: string | null): AddrMode {
  if (raw === "base" || raw === "base-offset") return "base-offset";
  if (raw && (ADDR_MODES as readonly string[]).includes(raw)) return raw as AddrMode;
  return "immediate";
}

export function regIndex(value: number): number {
  const index = Math.trunc(value);
  if (!Number.isFinite(index) || index < 0 || index > 7) return 0;
  return index;
}

export function hex32(value: number): string {
  return toHex32(i32(value));
}

export function alu(op: AluOp, left: number, right: number): number {
  if (op === "ADD") return i32(left + right);
  if (op === "SUB") return i32(left - right);
  if (op === "AND") return i32(left & right);
  if (op === "OR") return i32(left | right);
  return i32(left ^ right);
}

function blankRegs(seed: Record<number, number>): number[] {
  const regs = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const [key, value] of Object.entries(seed)) {
    const index = Number(key);
    if (index > 0 && index < 8) regs[index] = i32(value);
  }
  return regs;
}

export function freshAddr(mode: AddrMode): AddrState {
  const shared = { rd: 5, rs1: 3, rs2: 2, imm: 10, address: 100, pointer: 100, base: 2, index: 3, offset: 8, op: "ADD" as const };
  if (mode === "immediate") {
    return { ...shared, rs1: 3, imm: 10, regs: blankRegs({ 3: 25 }), mem: {} };
  }
  if (mode === "register") {
    return { ...shared, rs1: 1, rs2: 2, regs: blankRegs({ 1: 12, 2: 30 }), mem: {} };
  }
  if (mode === "direct") {
    return { ...shared, address: 100, regs: blankRegs({}), mem: { 96: 0, 100: 250, 104: 15, 108: 0 } };
  }
  if (mode === "indirect") {
    return { ...shared, pointer: 100, regs: blankRegs({}), mem: { 100: 200, 200: 123, 204: 0, 208: 0 } };
  }
  if (mode === "base-offset") {
    return { ...shared, base: 2, offset: 8, regs: blankRegs({ 2: 100 }), mem: { 104: 0, 108: 77, 112: 0 } };
  }
  return { ...shared, base: 2, index: 3, offset: 0, regs: blankRegs({ 2: 100, 3: 12 }), mem: { 108: 0, 112: 55, 116: 0 } };
}

export function readReg(regs: number[], index: number): number {
  if (index === 0) return 0;
  return i32(regs[index] ?? 0);
}

export function writeReg(regs: number[], index: number, value: number): number[] {
  const next = regs.slice(0, 8);
  while (next.length < 8) next.push(0);
  if (index === 0) return next;
  next[index] = i32(value);
  return next;
}

function memAt(mem: Record<number, number>, address: number): number {
  return i32(mem[address] ?? 0);
}

function rowsAround(addresses: number[], mem: Record<number, number>, target: number | null, pointer: number | null): MemRow[] {
  const unique = [...new Set(addresses)].sort((a, b) => a - b);
  return unique.map((address) => ({
    address,
    value: memAt(mem, address),
    role: pointer !== null && address === pointer ? "pointer" : target !== null && address === target ? "target" : "idle",
  }));
}

function immError(value: number): string | null {
  if (!Number.isFinite(value) || value < -2048 || value > 2047) return "This immediate is a 12-bit signed field (−2048 to 2047).";
  return null;
}

export function resolveImmediate(rs1: number, imm: number): number {
  return alu("ADD", rs1, imm);
}

export function resolveRegister(op: AluOp, rs1: number, rs2: number): number {
  return alu(op, rs1, rs2);
}

export function resolveDirect(address: number, mem: Record<number, number>): { ea: number; value: number } {
  const ea = i32(address);
  return { ea, value: memAt(mem, ea) };
}

export function resolveIndirect(pointerAddress: number, mem: Record<number, number>): { pointer: number; ea: number; value: number } {
  const pointer = memAt(mem, i32(pointerAddress));
  const ea = i32(pointer);
  return { pointer, ea, value: memAt(mem, ea) };
}

export function resolveRegisterIndirect(pointer: number, mem: Record<number, number>): { ea: number; value: number } {
  const ea = i32(pointer);
  return { ea, value: memAt(mem, ea) };
}

export function resolveBaseOffset(base: number, offset: number, mem: Record<number, number>): { ea: number; value: number } {
  const ea = i32(base + offset);
  return { ea, value: memAt(mem, ea) };
}

export function resolveIndexed(base: number, index: number, offset: number, mem: Record<number, number>): { ea: number; value: number } {
  const ea = i32(base + index + offset);
  return { ea, value: memAt(mem, ea) };
}

function rFunct(op: AluOp): { funct7: number; funct3: number } {
  if (op === "SUB") return { funct7: 0x20, funct3: 0 };
  if (op === "AND") return { funct7: 0, funct3: 7 };
  if (op === "OR") return { funct7: 0, funct3: 6 };
  if (op === "XOR") return { funct7: 0, funct3: 4 };
  return { funct7: 0, funct3: 0 };
}

export function viewAddr(mode: AddrMode, state: AddrState): AddrView {
  const rd = regIndex(state.rd);
  const rs1 = regIndex(state.rs1);
  const rs2 = regIndex(state.rs2);
  const base = regIndex(state.base);
  const index = regIndex(state.index);
  const left = readReg(state.regs, rs1);
  const right = readReg(state.regs, rs2);
  const baseValue = readReg(state.regs, base);
  const indexValue = readReg(state.regs, index);

  if (mode === "immediate") {
    const error = immError(state.imm);
    const operand = resolveImmediate(left, state.imm);
    return {
      assembly: `ADDI x${rd}, x${rs1}, ${state.imm}`,
      meaning: `x${rd} ← x${rs1} + ${state.imm}`,
      fields: I_FIELDS("imm[11:0]"),
      word: error ? null : encodeI(state.imm, rs1, 0, rd, 0x13),
      steps: [
        `Immediate value (${state.imm}) is part of the instruction.`,
        `Read register x${rs1}.`,
        "ALU adds the register value and the immediate.",
        `Write the result to register x${rd}.`,
      ],
      regs: ([
        { index: rs1, value: left, role: "source" as const },
        { index: rd, value: readReg(state.regs, rd), role: "dest" as const },
      ]).filter((row, at, list) => list.findIndex((item) => item.index === row.index) === at),
      memory: null,
      ea: null,
      operand,
      equation: `${left} + ${state.imm} = ${operand}`,
      loaded: `x${rd} = ${operand}`,
      note: "The operand is available immediately — no memory access is needed.",
      error,
      memAccess: false,
    };
  }

  if (mode === "register") {
    const operand = resolveRegister(state.op, left, right);
    const symbol = state.op === "ADD" ? "+" : state.op === "SUB" ? "−" : state.op === "AND" ? "&" : state.op === "OR" ? "|" : "^";
    const coded = rFunct(state.op);
    return {
      assembly: `${state.op} x${rd}, x${rs1}, x${rs2}`,
      meaning: `x${rd} ← x${rs1} ${symbol} x${rs2}`,
      fields: R_FIELDS,
      word: encodeR(coded.funct7, rs2, rs1, coded.funct3, rd, 0x33),
      steps: [
        "Read values from the source registers.",
        "ALU performs the operation.",
        `Write the result to register x${rd}.`,
      ],
      regs: [rs1, rs2, rd].filter((item, at, list) => list.indexOf(item) === at).map((item) => ({
        index: item,
        value: readReg(state.regs, item),
        role: item === rd ? "dest" as const : item === rs2 ? "source2" as const : "source" as const,
      })),
      memory: null,
      ea: null,
      operand,
      equation: `${left} ${symbol} ${right} = ${operand}`,
      loaded: `x${rd} = ${operand}`,
      note: "All operands are in registers — no memory access is required.",
      error: null,
      memAccess: false,
    };
  }

  if (mode === "direct") {
    const found = resolveDirect(state.address, state.mem);
    return {
      assembly: `LW x${rd}, ${found.ea}`,
      meaning: `x${rd} ← Mem[${found.ea}]`,
      fields: I_FIELDS("address"),
      word: immError(found.ea) ? null : encodeI(found.ea, 0, 2, rd, 0x03),
      steps: [
        `Read the memory address (${found.ea}) from the instruction.`,
        "Access memory at that address.",
        `Load the value into register x${rd}.`,
      ],
      regs: [{ index: rd, value: readReg(state.regs, rd), role: "dest" }],
      memory: rowsAround([found.ea - 4, found.ea, found.ea + 4, found.ea + 8], state.mem, found.ea, null),
      ea: found.ea,
      operand: found.value,
      equation: `Mem[${found.ea}] = ${found.value}`,
      loaded: `x${rd} = ${found.value}`,
      note: "The effective address is explicitly specified in the instruction. This is a generic ISA example. RISC-V writes the same idea as lw with base x0.",
      error: immError(found.ea) ? "The address field shown here is a 12-bit immediate, the same width RISC-V uses for lw xN, address(x0)." : null,
      memAccess: true,
    };
  }

  if (mode === "indirect") {
    const found = resolveIndirect(state.pointer, state.mem);
    return {
      assembly: `LW x${rd}, (${i32(state.pointer)})`,
      meaning: `x${rd} ← Mem[ Mem[${i32(state.pointer)}] ]`,
      fields: null,
      word: null,
      steps: [
        `Read the address (${i32(state.pointer)}) from the instruction.`,
        `Access memory at ${i32(state.pointer)} to get the pointer.`,
        "Use that pointer as the effective address.",
        `Load the value from that address into x${rd}.`,
      ],
      regs: [{ index: rd, value: readReg(state.regs, rd), role: "dest" }],
      memory: rowsAround([i32(state.pointer), found.ea, found.ea + 4, found.ea + 8], state.mem, found.ea, i32(state.pointer)),
      ea: found.ea,
      operand: found.value,
      equation: `Mem[ Mem[${i32(state.pointer)}] ] = ${found.value}`,
      loaded: `x${rd} = ${found.value}`,
      note: "This adds an extra memory access. The instruction names a cell, and that cell holds the real address. Direct addressing skips that extra lookup.",
      error: null,
      memAccess: true,
    };
  }

  if (mode === "base-offset") {
    const error = immError(state.offset);
    const found = resolveBaseOffset(baseValue, state.offset, state.mem);
    return {
      assembly: `LW x${rd}, ${state.offset}(x${base})`,
      meaning: `x${rd} ← Mem[ x${base} + ${state.offset} ]`,
      fields: I_FIELDS("imm[11:0]"),
      word: error ? null : encodeI(state.offset, base, 2, rd, 0x03),
      steps: [
        `Read base register x${base}.`,
        `Sign-extend and add the offset (${state.offset}).`,
        "Access memory at the effective address.",
        `Load the value into register x${rd}.`,
      ],
      regs: [base, rd].filter((item, at, list) => list.indexOf(item) === at).map((item) => ({
        index: item,
        value: readReg(state.regs, item),
        role: item === rd ? "dest" as const : "base" as const,
      })),
      memory: rowsAround([found.ea - 4, found.ea, found.ea + 4], state.mem, found.ea, null),
      ea: found.ea,
      operand: found.value,
      equation: `${baseValue} + ${state.offset} = ${found.ea}`,
      loaded: `Mem[${baseValue} + ${state.offset}] = Mem[${found.ea}] = ${found.value}`,
      note: "Commonly used for arrays, structures, and stack data. The offset is a constant displacement, not a second register.",
      error,
      memAccess: true,
    };
  }

  const found = resolveIndexed(baseValue, indexValue, state.offset, state.mem);
  return {
    assembly: `LW x${rd}, ${state.offset}(x${base}, x${index})`,
    meaning: `x${rd} ← Mem[ x${base} + x${index}${state.offset ? ` + ${state.offset}` : ""} ]`,
    fields: null,
    word: null,
    steps: [
      `Read base register x${base}.`,
      `Read index register x${index}.`,
      "Add base + index + offset.",
      "Access memory at the effective address.",
      `Load the value into register x${rd}.`,
    ],
    regs: [base, index, rd].filter((item, at, list) => list.indexOf(item) === at).map((item) => ({
      index: item,
      value: readReg(state.regs, item),
      role: item === rd ? "dest" as const : item === index ? "index" as const : "base" as const,
    })),
    memory: rowsAround([found.ea - 4, found.ea, found.ea + 4], state.mem, found.ea, null),
    ea: found.ea,
    operand: found.value,
    equation: `${baseValue} + ${indexValue} + ${state.offset} = ${found.ea}`,
    loaded: `Mem[${baseValue} + ${indexValue}${state.offset ? ` + ${state.offset}` : ""}] = Mem[${found.ea}] = ${found.value}`,
    note: "The index is a register, so the address can change with the data. RISC-V’s base integer ISA has no scaled index; a program adds the scaled index first, then uses base + offset.",
    error: immError(state.offset),
    memAccess: true,
  };
}

export function commitAddr(mode: AddrMode, state: AddrState): AddrState | null {
  const view = viewAddr(mode, state);
  if (view.error) return null;
  return { ...state, regs: writeReg(state.regs, regIndex(state.rd), view.operand) };
}
