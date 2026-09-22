import { alu, type AluOp } from "../digital/arithmetic";
import { fromUnsigned, toBinary, toUnsigned } from "../digital/vector";
import { createRegisters, maskWidth, stepProgramCounter } from "../cpu/registers";

export const RAM_SIZE = 256;
export const HISTORY = 64;

export const OP8 = {
  LDI_A: 0x10,
  LDI_B: 0x11,
  ADD: 0x20,
  SUB: 0x21,
  AND: 0x22,
  OR: 0x23,
  XOR: 0x24,
  NOT: 0x25,
  INC: 0x26,
  DEC: 0x27,
  CMP: 0x28,
  LOAD: 0x30,
  STORE: 0x31,
  JMP: 0x40,
  JZ: 0x41,
  JC: 0x42,
  HLT: 0xff,
} as const;

export type Stage8 = "MAR←PC" | "IR←MEM" | "OP←MEM" | "DECODE" | "EXECUTE" | "HALT";

export interface Flags8 {
  z: 0 | 1;
  c: 0 | 1;
  n: 0 | 1;
  v: 0 | 1;
}

export interface Cpu8State {
  a: number;
  b: number;
  pc: number;
  ir: number;
  mar: number;
  mdr: number;
  operand: number;
  flags: Flags8;
  ram: number[];
  bus: number;
  stage: Stage8;
  micro: string;
  signals: string[];
  halted: boolean;
  cycles: number;
  error: string | null;
  twoByte: boolean;
}

export interface Cpu8Snap {
  a: number;
  b: number;
  pc: number;
  ir: number;
  mar: number;
  flags: Flags8;
  bus: number;
  stage: Stage8;
  micro: string;
}

export interface Asm8Error {
  line: number;
  message: string;
}

export interface Asm8Line {
  line: number;
  address: number;
  text: string;
  bytes: number[];
}

export type Asm8Result =
  | { ok: true; bytes: number[]; listing: Asm8Line[]; labels: Record<string, number> }
  | { ok: false; errors: Asm8Error[] };

const TWO_BYTE = new Set<number>([OP8.LDI_A, OP8.LDI_B, OP8.LOAD, OP8.STORE, OP8.JMP, OP8.JZ, OP8.JC]);

export function formatReg(value: number, width = 8): { binary: string; hex: string; decimal: number } {
  const mask = maskWidth(width);
  const bits = fromUnsigned(value & mask, width);
  const unsigned = toUnsigned(bits) ?? 0;
  const hex = (unsigned).toString(16).toUpperCase().padStart(Math.ceil(width / 4), "0");
  return { binary: toBinary(bits), hex, decimal: unsigned };
}

function strip(text: string): string {
  return (text.split(/[;#]/)[0] ?? "").trim();
}

function parseNumber(token: string, line: number, errors: Asm8Error[], max = 255): number | null {
  const text = token.trim().toLowerCase();
  const value = text.startsWith("0x") ? Number.parseInt(text.slice(2), 16) : Number.parseInt(text, 10);
  if (!Number.isFinite(value)) {
    errors.push({ line, message: `Malformed immediate "${token}".` });
    return null;
  }
  if (value < 0 || value > max) {
    errors.push({ line, message: `Immediate value exceeds field width (${max}).` });
    return null;
  }
  return value;
}

function regToken(token: string, line: number, errors: Asm8Error[]): "A" | "B" | null {
  const name = token.trim().toUpperCase();
  if (name === "A" || name === "B") return name;
  errors.push({ line, message: `Unknown register "${token}". Use A or B.` });
  return null;
}

export function assemble8(source: string): Asm8Result {
  const errors: Asm8Error[] = [];
  const raw = source.split(/\r?\n/);
  const labels: Record<string, number> = {};
  const pending: Array<{ line: number; text: string }> = [];
  let address = 0;
  raw.forEach((original, index) => {
    const line = index + 1;
    let text = strip(original);
    if (!text) return;
    const labeled = text.match(/^([A-Za-z_]\w*):(?:\s*(.*))?$/);
    if (labeled) {
      const name = (labeled[1] ?? "").toUpperCase();
      if (labels[name] !== undefined) errors.push({ line, message: `Duplicate label ${name}.` });
      else labels[name] = address;
      text = (labeled[2] ?? "").trim();
      if (!text) return;
    }
    pending.push({ line, text });
    const mnemonic = (text.split(/[\s,]+/).filter(Boolean)[0] ?? "").toUpperCase();
    address += mnemonic === "HLT" || ["ADD", "SUB", "AND", "OR", "XOR", "NOT", "INC", "DEC", "CMP"].includes(mnemonic) ? 1 : 2;
  });
  const bytes: number[] = [];
  const listing: Asm8Line[] = [];
  let cursor = 0;
  pending.forEach((item) => {
    const parts = item.text.split(/[\s,]+/).filter(Boolean);
    const mnemonic = (parts[0] ?? "").toUpperCase();
    const args = parts.slice(1);
    const encoded = encode8(mnemonic, args, item.line, labels, errors);
    if (!encoded) return;
    if (cursor + encoded.length > RAM_SIZE) {
      errors.push({ line: item.line, message: "Memory address out of range." });
      return;
    }
    listing.push({ line: item.line, address: cursor, text: item.text, bytes: encoded });
    encoded.forEach((value) => {
      bytes[cursor] = value;
      cursor += 1;
    });
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, bytes, listing, labels };
}

function resolveLabel(token: string, line: number, labels: Record<string, number>, errors: Asm8Error[]): number | null {
  if (/^(0x[0-9a-f]+|\d+)$/i.test(token)) return parseNumber(token, line, errors);
  const found = labels[token.toUpperCase()];
  if (found === undefined) {
    errors.push({ line, message: `Undefined label ${token}.` });
    return null;
  }
  return found;
}

function encode8(mnemonic: string, args: string[], line: number, labels: Record<string, number>, errors: Asm8Error[]): number[] | null {
  const need = (count: number) => {
    if (args.length !== count) {
      errors.push({ line, message: `${mnemonic} expects ${count} operand${count === 1 ? "" : "s"}.` });
      return false;
    }
    return true;
  };
  if (mnemonic === "HLT") return need(0) ? [OP8.HLT] : null;
  if (mnemonic === "LDI") {
    if (!need(2)) return null;
    const dest = regToken(args[0] ?? "", line, errors);
    const imm = parseNumber(args[1] ?? "", line, errors);
    if (!dest || imm === null) return null;
    return [dest === "A" ? OP8.LDI_A : OP8.LDI_B, imm];
  }
  if (mnemonic === "ADD" || mnemonic === "SUB" || mnemonic === "AND" || mnemonic === "OR" || mnemonic === "XOR" || mnemonic === "CMP") {
    if (!need(2)) return null;
    if (regToken(args[0] ?? "", line, errors) !== "A" || regToken(args[1] ?? "", line, errors) !== "B") return null;
    const map = { ADD: OP8.ADD, SUB: OP8.SUB, AND: OP8.AND, OR: OP8.OR, XOR: OP8.XOR, CMP: OP8.CMP };
    return [map[mnemonic]];
  }
  if (mnemonic === "NOT" || mnemonic === "INC" || mnemonic === "DEC") {
    if (!need(1)) return null;
    if (regToken(args[0] ?? "", line, errors) !== "A") return null;
    return [mnemonic === "NOT" ? OP8.NOT : mnemonic === "INC" ? OP8.INC : OP8.DEC];
  }
  if (mnemonic === "LOAD" || mnemonic === "STORE") {
    if (!need(2)) return null;
    if (regToken(args[0] ?? "", line, errors) !== "A") return null;
    const addr = resolveLabel(args[1] ?? "", line, labels, errors);
    if (addr === null) return null;
    if (addr >= RAM_SIZE) {
      errors.push({ line, message: "Memory address out of range." });
      return null;
    }
    return [mnemonic === "LOAD" ? OP8.LOAD : OP8.STORE, addr];
  }
  if (mnemonic === "JMP" || mnemonic === "JZ" || mnemonic === "JC") {
    if (!need(1)) return null;
    const addr = resolveLabel(args[0] ?? "", line, labels, errors);
    if (addr === null) return null;
    return [mnemonic === "JMP" ? OP8.JMP : mnemonic === "JZ" ? OP8.JZ : OP8.JC, addr];
  }
  errors.push({ line, message: "Invalid instruction." });
  return null;
}

export function decode8(opcode: number): { mnemonic: string; twoByte: boolean; explain: string } {
  const table: Record<number, { mnemonic: string; twoByte: boolean; explain: string }> = {
    [OP8.LDI_A]: { mnemonic: "LDI A, imm", twoByte: true, explain: "Load immediate into A." },
    [OP8.LDI_B]: { mnemonic: "LDI B, imm", twoByte: true, explain: "Load immediate into B." },
    [OP8.ADD]: { mnemonic: "ADD A, B", twoByte: false, explain: "A ← A + B." },
    [OP8.SUB]: { mnemonic: "SUB A, B", twoByte: false, explain: "A ← A − B." },
    [OP8.AND]: { mnemonic: "AND A, B", twoByte: false, explain: "A ← A AND B." },
    [OP8.OR]: { mnemonic: "OR A, B", twoByte: false, explain: "A ← A OR B." },
    [OP8.XOR]: { mnemonic: "XOR A, B", twoByte: false, explain: "A ← A XOR B." },
    [OP8.NOT]: { mnemonic: "NOT A", twoByte: false, explain: "A ← NOT A." },
    [OP8.INC]: { mnemonic: "INC A", twoByte: false, explain: "A ← A + 1." },
    [OP8.DEC]: { mnemonic: "DEC A", twoByte: false, explain: "A ← A − 1." },
    [OP8.CMP]: { mnemonic: "CMP A, B", twoByte: false, explain: "Set flags from A − B." },
    [OP8.LOAD]: { mnemonic: "LOAD A, addr", twoByte: true, explain: "A ← MEM[addr]." },
    [OP8.STORE]: { mnemonic: "STORE A, addr", twoByte: true, explain: "MEM[addr] ← A." },
    [OP8.JMP]: { mnemonic: "JMP addr", twoByte: true, explain: "PC ← addr." },
    [OP8.JZ]: { mnemonic: "JZ addr", twoByte: true, explain: "If Z, PC ← addr." },
    [OP8.JC]: { mnemonic: "JC addr", twoByte: true, explain: "If C, PC ← addr." },
    [OP8.HLT]: { mnemonic: "HLT", twoByte: false, explain: "Stop the clock." },
  };
  return table[opcode] ?? { mnemonic: "Invalid instruction", twoByte: false, explain: "Opcode is not in the teaching ISA." };
}

function alu8(op: AluOp, left: number, right: number): { value: number; flags: Flags8 } {
  const result = alu(fromUnsigned(left & 0xff, 8), fromUnsigned(right & 0xff, 8), op);
  return {
    value: toUnsigned(result.result.map((bit) => (bit === 1 ? 1 : 0)) as Array<0 | 1>) ?? 0,
    flags: { z: result.zero, c: result.carry, n: result.negative, v: result.overflow },
  };
}

export function blank8(): Cpu8State {
  const machine = createRegisters(8, 1);
  return {
    a: 0, b: 0, pc: 0, ir: 0, mar: 0, mdr: 0, operand: 0,
    flags: { ...machine.flags },
    ram: Array.from({ length: RAM_SIZE }, () => 0),
    bus: 0, stage: "MAR←PC", micro: "Idle.", signals: [], halted: false, cycles: 0, error: null, twoByte: false,
  };
}

export function load8(source: string, data: Record<number, number> = {}): Cpu8State | { ok: false; error: string } {
  const built = assemble8(source);
  if (!built.ok) return { ok: false, error: built.errors.map((item) => `Line ${item.line}: ${item.message}`).join("\n") };
  const state = blank8();
  built.bytes.forEach((value, address) => {
    state.ram[address] = value & 0xff;
  });
  Object.entries(data).forEach(([address, value]) => {
    const index = Number(address);
    if (index < 0 || index >= RAM_SIZE) {
      return;
    }
    state.ram[index] = value & 0xff;
  });
  return state;
}

export function microStep(state: Cpu8State): Cpu8State {
  if (state.halted && state.stage === "HALT") return state;
  const next: Cpu8State = { ...state, ram: state.ram.slice(), flags: { ...state.flags }, signals: [], error: null };
  next.cycles += 1;
  if (next.stage === "MAR←PC") {
    next.mar = next.pc & 0xff;
    next.bus = next.pc & 0xff;
    next.micro = "MAR ← PC";
    next.signals = ["PC_OUT", "MAR_LOAD"];
    next.stage = "IR←MEM";
    return next;
  }
  if (next.stage === "IR←MEM") {
    next.mdr = next.ram[next.mar] ?? 0;
    next.bus = next.mdr;
    next.ir = next.mdr;
    const decoded = decode8(next.ir);
    if (decoded.mnemonic === "Invalid instruction") {
      next.error = "Invalid instruction";
      next.halted = true;
      next.stage = "HALT";
      next.micro = "Invalid instruction.";
      return next;
    }
    next.twoByte = TWO_BYTE.has(next.ir);
    const advanced = stepProgramCounter({ ...createRegisters(8, 1), pc: next.pc }, "increment");
    next.pc = advanced.pc;
    next.micro = "IR ← MEM[MAR]; PC ← PC + 1";
    next.signals = ["MEM_READ", "IR_LOAD", "PC_INC"];
    next.stage = next.twoByte ? "OP←MEM" : "DECODE";
    return next;
  }
  if (next.stage === "OP←MEM") {
    next.mar = next.pc & 0xff;
    next.mdr = next.ram[next.mar] ?? 0;
    next.operand = next.mdr;
    next.bus = next.mdr;
    const advanced = stepProgramCounter({ ...createRegisters(8, 1), pc: next.pc }, "increment");
    next.pc = advanced.pc;
    next.micro = "operand ← MEM[PC]; PC ← PC + 1";
    next.signals = ["PC_OUT", "MAR_LOAD", "MEM_READ", "PC_INC"];
    next.stage = "DECODE";
    return next;
  }
  if (next.stage === "DECODE") {
    const decoded = decode8(next.ir);
    next.micro = `Decode ${decoded.mnemonic}. ${decoded.explain}`;
    next.signals = ["DECODE"];
    next.stage = "EXECUTE";
    return next;
  }
  const opcode = next.ir;
  if (opcode === OP8.HLT) {
    next.halted = true;
    next.stage = "HALT";
    next.micro = "HLT";
    next.signals = ["HALT"];
    return next;
  }
  if (opcode === OP8.LDI_A) {
    next.a = next.operand & 0xff;
    next.bus = next.a;
    next.micro = "A ← imm";
    next.signals = ["IMM_OUT", "A_LOAD"];
  } else if (opcode === OP8.LDI_B) {
    next.b = next.operand & 0xff;
    next.bus = next.b;
    next.micro = "B ← imm";
    next.signals = ["IMM_OUT", "B_LOAD"];
  } else if (opcode === OP8.ADD || opcode === OP8.SUB || opcode === OP8.AND || opcode === OP8.OR || opcode === OP8.XOR) {
    const op: AluOp = opcode === OP8.ADD ? "ADD" : opcode === OP8.SUB ? "SUB" : opcode === OP8.AND ? "AND" : opcode === OP8.OR ? "OR" : "XOR";
    const computed = alu8(op, next.a, next.b);
    next.a = computed.value;
    next.flags = computed.flags;
    next.bus = next.a;
    next.micro = `A ← A ${op} B`;
    next.signals = ["A_OUT", "B_OUT", "ALU", "A_LOAD"];
  } else if (opcode === OP8.NOT || opcode === OP8.INC || opcode === OP8.DEC) {
    const op: AluOp = opcode === OP8.NOT ? "NOT" : opcode === OP8.INC ? "INC" : "DEC";
    const computed = alu8(op, next.a, 0);
    next.a = computed.value;
    next.flags = computed.flags;
    next.bus = next.a;
    next.micro = `A ← ${op} A`;
    next.signals = ["A_OUT", "ALU", "A_LOAD"];
  } else if (opcode === OP8.CMP) {
    const computed = alu8("SUB", next.a, next.b);
    next.flags = computed.flags;
    next.micro = "FLAGS ← A − B";
    next.signals = ["A_OUT", "B_OUT", "ALU"];
  } else if (opcode === OP8.LOAD) {
    if (next.operand >= RAM_SIZE) {
      next.error = "Memory address out of range";
      next.halted = true;
      next.stage = "HALT";
      return next;
    }
    next.mar = next.operand;
    next.mdr = next.ram[next.mar] ?? 0;
    next.a = next.mdr;
    next.bus = next.a;
    next.micro = "A ← MEM[addr]";
    next.signals = ["ADDR_OUT", "MEM_READ", "A_LOAD"];
  } else if (opcode === OP8.STORE) {
    if (next.operand >= RAM_SIZE) {
      next.error = "Memory address out of range";
      next.halted = true;
      next.stage = "HALT";
      return next;
    }
    next.mar = next.operand;
    next.mdr = next.a;
    next.ram[next.mar] = next.a & 0xff;
    next.bus = next.a;
    next.micro = "MEM[addr] ← A";
    next.signals = ["A_OUT", "ADDR_OUT", "MEM_WRITE"];
  } else if (opcode === OP8.JMP || opcode === OP8.JZ || opcode === OP8.JC) {
    const take = opcode === OP8.JMP || (opcode === OP8.JZ && next.flags.z === 1) || (opcode === OP8.JC && next.flags.c === 1);
    if (take) next.pc = next.operand & 0xff;
    next.micro = take ? "PC ← addr" : "Branch not taken";
    next.signals = take ? ["ADDR_OUT", "PC_LOAD"] : [];
  }
  next.stage = "MAR←PC";
  return next;
}

export function instructionStep(state: Cpu8State): Cpu8State {
  let next = state;
  const start = state.cycles;
  do {
    next = microStep(next);
  } while (!next.halted && next.stage !== "MAR←PC" && next.cycles - start < 8);
  return next;
}

export function run8(source: string, data: Record<number, number> = {}, limit = 400): Cpu8State {
  const loaded = load8(source, data);
  if ("ok" in loaded) {
    const failed = blank8();
    failed.error = loaded.error;
    failed.halted = true;
    failed.stage = "HALT";
    return failed;
  }
  let state = loaded;
  let guard = 0;
  while (!state.halted && guard < limit) {
    state = microStep(state);
    guard += 1;
  }
  return state;
}

export function snap8(state: Cpu8State): Cpu8Snap {
  return { a: state.a, b: state.b, pc: state.pc, ir: state.ir, mar: state.mar, flags: { ...state.flags }, bus: state.bus, stage: state.stage, micro: state.micro };
}

export function encodeFields(opcode: number, operand: number): { opcodeBits: string; operandBits: string; word: string } {
  const op = opcode & 0xff;
  const imm = operand & 0xff;
  return {
    opcodeBits: op.toString(2).padStart(8, "0"),
    operandBits: imm.toString(2).padStart(8, "0"),
    word: `${op.toString(2).padStart(8, "0")} ${imm.toString(2).padStart(8, "0")}`,
  };
}
