import { bits as rvBits, toBin32, toHex32 } from "../isaarch/bits";
import { encodeB, encodeI as rvI, encodeR as rvR, encodeS as rvS } from "../isaarch/riscv";
import { binaryWord, bits, encodeI, encodeR, encodeS, OP } from "./spec";

/** Teaching registers stay in 32-bit two's complement. The 16-bit encoder is separate. */
export function i32(value: number): number {
  const bits32 = BigInt(Math.trunc(value)) & 0xffffffffn;
  return bits32 >= 0x80000000n ? Number(bits32 - 0x100000000n) : Number(bits32);
}

export const TEACH_OPS = ["ADD", "SUB", "AND", "OR", "XOR", "ADDI", "LOAD", "STORE"] as const;
export type TeachOp = (typeof TEACH_OPS)[number];

export interface TeachMachine {
  regs: number[];
  mem: Record<number, number>;
}

export function freshMachine(): TeachMachine {
  return { regs: [0, 0, 10, 20, 0, 0, 0, 0], mem: { 100: 42, 104: 17, 108: 255, 112: 0 } };
}

export function cloneMachine(machine: TeachMachine): TeachMachine {
  return { regs: machine.regs.slice(), mem: { ...machine.mem } };
}

export interface TeachResult {
  next: TeachMachine;
  value: number;
  address: number | null;
  wroteReg: number | null;
  wroteMem: number | null;
  summary: string;
}

export function executeTeach(machine: TeachMachine, op: TeachOp, rd: number, rs1: number, rs2: number, imm: number): TeachResult {
  const next = cloneMachine(machine);
  const left = next.regs[rs1] ?? 0;
  const right = next.regs[rs2] ?? 0;
  const address = i32(left + imm);
  let value = 0;
  let wroteReg: number | null = rd;
  let wroteMem: number | null = null;
  if (op === "ADD") value = i32(left + right);
  else if (op === "SUB") value = i32(left - right);
  else if (op === "AND") value = i32(left & right);
  else if (op === "OR") value = i32(left | right);
  else if (op === "XOR") value = i32(left ^ right);
  else if (op === "ADDI") value = i32(left + imm);
  else if (op === "LOAD") value = i32(next.mem[address] ?? 0);
  else {
    value = right;
    wroteReg = null;
    wroteMem = address;
    next.mem[address] = value;
  }
  if (wroteReg !== null) next.regs[wroteReg] = value;
  const summary = op === "STORE"
    ? `Stored ${value} at address ${address}.`
    : op === "LOAD"
      ? `Loaded Mem[${address}] = ${value} into R${rd}.`
      : `Wrote ${value} into R${rd}.`;
  return { next, value, address: op === "LOAD" || op === "STORE" ? address : null, wroteReg, wroteMem, summary };
}

export interface AnatomyField {
  id: "opcode" | "rd" | "rs1" | "imm";
  label: string;
  bits: string;
  range: string;
  purpose: string;
}

const ANATOMY_COPY: Record<AnatomyField["id"], { label: string; range: string; purpose: string }> = {
  opcode: { label: "Opcode", range: "15–12", purpose: "Selects the operation (ADD, SUB, LOAD, STORE, and the rest). The other fields keep their places." },
  rd: { label: "Rd", range: "11–9", purpose: "Destination register. The result is written here, except for STORE, which has no register write." },
  rs1: { label: "Rs1", range: "8–6", purpose: "First source register, or the base register for a load or store." },
  imm: { label: "Rs2 / Immediate", range: "5–0", purpose: "Second source register for register operations, or a signed immediate for ADDI, LOAD, and STORE." },
};

export function encodeAnatomy(op: TeachOp, rd: number, rs1: number, rs2: number, imm: number): number {
  if (op === "ADDI") return encodeI(OP.ADDI, rd, rs1, imm);
  if (op === "LOAD") return encodeI(OP.LOAD, rd, rs1, imm);
  if (op === "STORE") return encodeS(rs2, rs1, imm);
  return encodeR(op, rd, rs1, rs2);
}

export function anatomyFields(word: number, op: TeachOp): AnatomyField[] {
  const chunks: Array<[AnatomyField["id"], number, number]> = [["opcode", 15, 12], ["rd", 11, 9], ["rs1", 8, 6], ["imm", 5, 0]];
  return chunks.map(([id, hi, lo]) => {
    const copy = ANATOMY_COPY[id];
    const raw = bits(word, hi, lo).toString(2).padStart(hi - lo + 1, "0");
    const purpose = id === "imm" && (op === "ADD" || op === "SUB" || op === "AND" || op === "OR" || op === "XOR")
      ? `Register form: the high 3 bits are Rs2 and the low 3 bits are the function code. This word holds ${raw}.`
      : copy.purpose;
    return { id, label: copy.label, bits: raw, range: copy.range, purpose };
  });
}

export function anatomyBinary(word: number): string {
  return binaryWord(word);
}

export type RvTeachFormat = "R" | "I" | "S" | "B";

export interface RvField {
  name: string;
  hi: number;
  lo: number;
  bits: string;
  hex: string;
  meaning: string;
}

export interface RvExample {
  format: RvTeachFormat;
  asm: string;
  equation: string;
  word: number;
  hex: string;
  binary: string;
  fields: RvField[];
}

const RV_MEANING: Record<string, string> = {
  funct7: "Extra function code. ADD is 0000000; SUB is 0100000.",
  rs2: "Second source register.",
  rs1: "First source register, or the base for a memory operation.",
  funct3: "Function or width code that distinguishes operations with the same opcode.",
  rd: "Destination register.",
  opcode: "Primary opcode. It selects the format family.",
  "imm[11:0]": "12-bit signed immediate.",
  "imm[11:5]": "High bits of the store offset.",
  "imm[4:0]": "Low bits of the store offset.",
  "imm[12|10:5]": "High bits of the branch offset, with bit 12 in the top position.",
  "imm[4:1|11]": "Low bits of the branch offset. Bit 0 is not stored; branches are halfword-aligned.",
};

function pack(word: number, name: string, hi: number, lo: number): RvField {
  const width = hi - lo + 1;
  const value = rvBits(word, hi, lo);
  return {
    name,
    hi,
    lo,
    bits: value.toString(2).padStart(width, "0"),
    hex: `0x${value.toString(16)}`,
    meaning: RV_MEANING[name] ?? name,
  };
}

export function encodeRvTeach(format: RvTeachFormat, rd: number, rs1: number, rs2: number, imm: number, variant: "add" | "sub" = "add"): RvExample {
  const d = rd & 31;
  const a = rs1 & 31;
  const b = rs2 & 31;
  let word = 0;
  let asm = "";
  let equation = "";
  let layout: Array<[string, number, number]> = [];
  if (format === "R") {
    const sub = variant === "sub";
    word = rvR(sub ? 0x20 : 0, b, a, 0, d, 0x33);
    asm = `${sub ? "SUB" : "ADD"} x${d}, x${a}, x${b}`;
    equation = sub ? `x${d} = x${a} - x${b}` : `x${d} = x${a} + x${b}`;
    layout = [["funct7", 31, 25], ["rs2", 24, 20], ["rs1", 19, 15], ["funct3", 14, 12], ["rd", 11, 7], ["opcode", 6, 0]];
  } else if (format === "I") {
    word = rvI(imm, a, 0, d, 0x13);
    asm = `ADDI x${d}, x${a}, ${i32(imm)}`;
    equation = `x${d} = x${a} + ${i32(imm)}`;
    layout = [["imm[11:0]", 31, 20], ["rs1", 19, 15], ["funct3", 14, 12], ["rd", 11, 7], ["opcode", 6, 0]];
  } else if (format === "S") {
    word = rvS(imm, b, a, 2);
    asm = `SW x${b}, ${i32(imm)}(x${a})`;
    equation = `Mem[x${a} + ${i32(imm)}] = x${b}`;
    layout = [["imm[11:5]", 31, 25], ["rs2", 24, 20], ["rs1", 19, 15], ["funct3", 14, 12], ["imm[4:0]", 11, 7], ["opcode", 6, 0]];
  } else {
    word = encodeB(imm, b, a, 0);
    asm = `BEQ x${a}, x${b}, ${i32(imm)}`;
    equation = `if (x${a} == x${b}) PC = PC + ${i32(imm)}`;
    layout = [["imm[12|10:5]", 31, 25], ["rs2", 24, 20], ["rs1", 19, 15], ["funct3", 14, 12], ["imm[4:1|11]", 11, 7], ["opcode", 6, 0]];
  }
  return { format, asm, equation, word, hex: toHex32(word), binary: toBin32(word), fields: layout.map(([name, hi, lo]) => pack(word, name, hi, lo)) };
}

export interface CompareExample {
  id: string;
  title: string;
  risc: string[];
  cisc: string[];
  memNote: string;
  stageNote: string;
}

export const COMPARE_EXAMPLES: CompareExample[] = [
  {
    id: "add-mem",
    title: "Example 1: Add to memory",
    risc: ["lw x5, 0(x10)      # load the memory word", "add x5, x5, x6     # add the register", "sw x5, 0(x10)      # store the result"],
    cisc: ["add DWORD PTR [eax], ebx   # one memory-operand add"],
    memNote: "RISC: one load and one store. CISC: the add itself names a memory operand.",
    stageNote: "The RISC form is three fixed-width instructions. A modern x86 core may still crack the memory form into internal micro-ops. This is a code-shape comparison, not a speed claim.",
  },
  {
    id: "increment",
    title: "Example 2: Increment memory",
    risc: ["lw x5, 0(x10)", "addi x5, x5, 1", "sw x5, 0(x10)"],
    cisc: ["inc DWORD PTR [eax]"],
    memNote: "RISC touches memory twice. CISC folds the increment into one memory-operand instruction.",
    stageNote: "Fewer instructions in the listing is not the same as fewer internal operations.",
  },
  {
    id: "array",
    title: "Example 3: Array element",
    risc: ["slli x6, x6, 2        # scale the index", "add x6, x10, x6      # base + scaled index", "lw x5, 0(x6)"],
    cisc: ["mov eax, DWORD PTR [ebx + ecx*4]"],
    memNote: "RISC computes the address in registers, then loads. CISC can scale an index inside the address.",
    stageNote: "Both still calculate base + index × scale. The difference is where that arithmetic is written.",
  },
  {
    id: "call",
    title: "Example 4: Function call",
    risc: ["jal ra, function"],
    cisc: ["call function"],
    memNote: "Both save a return address. RISC names the link register. x86 CALL pushes it.",
    stageNote: "The visible instruction counts match. The calling convention around them does not.",
  },
  {
    id: "branch",
    title: "Example 5: Conditional branch",
    risc: ["blt x5, x6, taken"],
    cisc: ["cmp eax, ebx", "jl taken"],
    memNote: "RISC compares and branches in one instruction. Classic x86 compares, then branches on flags.",
    stageNote: "Flag-based branches and compare-and-branch are different contracts, not different amounts of 'power'.",
  },
];

export type AddressMode = "immediate" | "register" | "direct" | "indirect" | "base" | "indexed";

export interface AddressInput {
  literal: number;
  register: number;
  direct: number;
  pointer: number;
  base: number;
  index: number;
  offset: number;
  mem: Record<number, number>;
}

export interface AddressResolution {
  ea: number | null;
  value: number;
  memory: boolean;
  steps: string[];
}

export function freshAddressInput(): AddressInput {
  return { literal: 42, register: 10, direct: 100, pointer: 100, base: 100, index: 4, offset: 8, mem: { 100: 42, 104: 17, 108: 255, 112: 7 } };
}

export function resolveAddress(mode: AddressMode, input: AddressInput): AddressResolution {
  const mem = input.mem;
  if (mode === "immediate") {
    return { ea: null, value: i32(input.literal), memory: false, steps: [`Operand = ${i32(input.literal)}`, "The value is in the instruction. There is no effective address."] };
  }
  if (mode === "register") {
    return { ea: null, value: i32(input.register), memory: false, steps: [`Operand = R = ${i32(input.register)}`, "The register already holds the operand."] };
  }
  if (mode === "direct") {
    const ea = i32(input.direct);
    return { ea, value: i32(mem[ea] ?? 0), memory: true, steps: [`EA = ${ea}`, `Operand = Mem[${ea}] = ${i32(mem[ea] ?? 0)}`] };
  }
  if (mode === "indirect") {
    const ea = i32(input.pointer);
    return { ea, value: i32(mem[ea] ?? 0), memory: true, steps: [`Pointer register = ${ea}`, `EA = ${ea}`, `Operand = Mem[${ea}] = ${i32(mem[ea] ?? 0)}`] };
  }
  if (mode === "base") {
    const ea = i32(input.base + input.offset);
    return { ea, value: i32(mem[ea] ?? 0), memory: true, steps: [`Base = ${i32(input.base)}`, `Offset = ${i32(input.offset)}`, `EA = ${i32(input.base)} + ${i32(input.offset)} = ${ea}`, `Operand = Mem[${ea}] = ${i32(mem[ea] ?? 0)}`] };
  }
  const ea = i32(input.base + input.index + input.offset);
  return { ea, value: i32(mem[ea] ?? 0), memory: true, steps: [`Base = ${i32(input.base)}`, `Index = ${i32(input.index)}`, `Displacement = ${i32(input.offset)}`, `EA = ${i32(input.base)} + ${i32(input.index)} + ${i32(input.offset)} = ${ea}`, `Operand = Mem[${ea}] = ${i32(mem[ea] ?? 0)}`] };
}

export type CategoryId = "arithmetic" | "logic" | "transfer" | "control" | "compare" | "shift";
export type IsaFamily = "generic" | "riscv" | "arm" | "x86";

export interface CategoryDemo {
  id: CategoryId;
  title: string;
  blurb: string;
  purpose: string;
  names: Record<IsaFamily, string[]>;
  lines: Record<IsaFamily, string[]>;
  run: (left: number, right: number) => { text: string; value: number };
}

export const CATEGORIES: CategoryDemo[] = [
  {
    id: "arithmetic",
    title: "Arithmetic",
    blurb: "Add, subtract, multiply, divide",
    purpose: "Compute a new integer and write it to a register.",
    names: { generic: ["ADD", "SUB", "MUL", "DIV"], riscv: ["add", "sub", "mul", "div"], arm: ["ADD", "SUB", "MUL", "SDIV"], x86: ["ADD", "SUB", "IMUL", "IDIV"] },
    lines: {
      generic: ["ADD rd, rs1, rs2    # rd = rs1 + rs2", "SUB rd, rs1, rs2    # rd = rs1 - rs2"],
      riscv: ["add rd, rs1, rs2    # rd = rs1 + rs2", "sub rd, rs1, rs2    # rd = rs1 - rs2", "mul rd, rs1, rs2    # rd = rs1 * rs2"],
      arm: ["ADD Rd, Rn, Rm", "SUB Rd, Rn, Rm"],
      x86: ["add eax, ebx", "sub eax, ebx"],
    },
    run: (left, right) => ({ text: `${left} + ${right}`, value: i32(left + right) }),
  },
  {
    id: "logic",
    title: "Logic",
    blurb: "AND, OR, XOR, NOT",
    purpose: "Combine bits without arithmetic carry.",
    names: { generic: ["AND", "OR", "XOR", "NOT"], riscv: ["and", "or", "xor", "xori"], arm: ["AND", "ORR", "EOR", "MVN"], x86: ["AND", "OR", "XOR", "NOT"] },
    lines: {
      generic: ["AND rd, rs1, rs2", "XOR rd, rs1, rs2"],
      riscv: ["and rd, rs1, rs2", "xor rd, rs1, rs2"],
      arm: ["AND Rd, Rn, Rm", "EOR Rd, Rn, Rm"],
      x86: ["and eax, ebx", "xor eax, ebx"],
    },
    run: (left, right) => ({ text: `${left} XOR ${right}`, value: i32(left ^ right) }),
  },
  {
    id: "transfer",
    title: "Data Transfer",
    blurb: "Move data between registers and memory",
    purpose: "Copy a value. In a load/store ISA, only these instructions touch data memory.",
    names: { generic: ["LOAD", "STORE", "MOVE"], riscv: ["lw", "sw", "mv"], arm: ["LDR", "STR", "MOV"], x86: ["MOV", "PUSH", "POP"] },
    lines: {
      generic: ["LOAD rd, offset(rs1)", "STORE rs2, offset(rs1)"],
      riscv: ["lw rd, offset(rs1)", "sw rs2, offset(rs1)"],
      arm: ["LDR Rd, [Rn, #offset]", "STR Rd, [Rn, #offset]"],
      x86: ["mov eax, DWORD PTR [ebx]", "mov DWORD PTR [ebx], eax"],
    },
    run: (left) => ({ text: `copy ${left}`, value: i32(left) }),
  },
  {
    id: "control",
    title: "Control Flow",
    blurb: "Jumps, branches, calls, returns",
    purpose: "Choose the next instruction instead of falling through.",
    names: { generic: ["JUMP", "BRANCH", "CALL", "RET"], riscv: ["jal", "beq", "jal", "ret"], arm: ["B", "BEQ", "BL", "RET"], x86: ["JMP", "JE", "CALL", "RET"] },
    lines: {
      generic: ["BEQ rs1, rs2, offset", "CALL function"],
      riscv: ["beq rs1, rs2, offset", "jal ra, function"],
      arm: ["BEQ Rn, Rm, label", "BL function"],
      x86: ["cmp eax, ebx", "je label", "call function"],
    },
    run: (left, right) => ({ text: left === right ? "branch taken" : "fall through", value: left === right ? 1 : 0 }),
  },
  {
    id: "compare",
    title: "Compare / Test",
    blurb: "Set flags, compare values",
    purpose: "Record a relationship. RISC-V writes 0 or 1 into a register. x86 and classic ARM also set flags.",
    names: { generic: ["SLT", "CMP"], riscv: ["slt", "sltu"], arm: ["CMP", "CMN"], x86: ["CMP", "TEST"] },
    lines: {
      generic: ["SLT rd, rs1, rs2    # rd = 1 if rs1 < rs2"],
      riscv: ["slt rd, rs1, rs2     # rd = 1 if rs1 < rs2"],
      arm: ["CMP Rn, Rm           # flags, not a destination"],
      x86: ["cmp eax, ebx         # flags"],
    },
    run: (left, right) => ({ text: `${left} < ${right}`, value: left < right ? 1 : 0 }),
  },
  {
    id: "shift",
    title: "Shift / Rotate",
    blurb: "Shift or rotate bits",
    purpose: "Move bits inside a register. Arithmetic right shift keeps the sign.",
    names: { generic: ["SLL", "SRL", "SRA"], riscv: ["sll", "srl", "sra"], arm: ["LSL", "LSR", "ASR"], x86: ["SHL", "SHR", "SAR"] },
    lines: {
      generic: ["SLL rd, rs1, 1", "SRA rd, rs1, 1"],
      riscv: ["sll rd, rs1, rs2", "sra rd, rs1, rs2"],
      arm: ["LSL Rd, Rn, #1", "ASR Rd, Rn, #1"],
      x86: ["shl eax, 1", "sar eax, 1"],
    },
    run: (left) => ({ text: `${left} << 1`, value: i32(left << 1) }),
  },
];

export function loadStoreDemo(): { before: TeachMachine; after: TeachMachine } {
  const before: TeachMachine = { regs: [0, 0, 100, 0, 0, 0, 0, 0], mem: { 100: 42, 104: 17, 108: 255, 112: 0 } };
  const loaded = executeTeach(before, "LOAD", 1, 0, 0, 100);
  const stored = executeTeach(loaded.next, "STORE", 0, 0, 2, 104);
  return { before, after: stored.next };
}
