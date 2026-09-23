import { alu, type AluOp } from "../digital/arithmetic";
import { shiftVector } from "../digital/arithmetic";
import { fromUnsigned, signExtend, toSigned, toUnsigned } from "../digital/vector";

export const MEM_WORDS = 256;
export const REG_COUNT = 8;
export const WORD_BITS = 16;

export type Format = "R" | "I" | "S" | "B" | "J" | "N";
export type Category = "system" | "arithmetic" | "logical" | "shift" | "compare" | "memory" | "branch" | "jump" | "stack";

export interface Decoded {
  word: number;
  opcode: number;
  mnemonic: string;
  category: Category;
  format: Format;
  rd: number;
  rs1: number;
  rs2: number;
  imm: number;
  funct: number;
  regWrite: boolean;
  memRead: boolean;
  memWrite: boolean;
  aluSrc: "reg" | "imm";
  aluOp: string;
  branch: boolean;
  jump: boolean;
  memToReg: boolean;
  explain: string;
}

export interface FieldSlice {
  name: string;
  hi: number;
  lo: number;
  meaning: string;
}

export const FUNCT: Record<string, number> = {
  ADD: 0, SUB: 1, AND: 2, OR: 3, XOR: 4, SLL: 5, SRL: 6, SRA: 7,
};

export const OP = {
  NOP: 0,
  ALU: 1,
  SLT: 2,
  ADDI: 3,
  LOAD: 4,
  STORE: 5,
  BEQ: 6,
  BNE: 7,
  J: 8,
  CALL: 9,
  RET: 10,
  HALT: 11,
} as const;

const ALU_NAME = ["ADD", "SUB", "AND", "OR", "XOR", "SLL", "SRL", "SRA"] as const;

export function bits(word: number, hi: number, lo: number): number {
  return (word >>> lo) & ((1 << (hi - lo + 1)) - 1);
}

export function sextBits(value: number, width: number): number {
  const masked = value & ((1 << width) - 1);
  const narrow = fromUnsigned(masked, width);
  const wide = signExtend(narrow, WORD_BITS);
  return toSigned(wide) ?? 0;
}

export function fitSigned(value: number, width: number): number | null {
  const min = -(1 << (width - 1));
  const max = (1 << (width - 1)) - 1;
  if (value < min || value > max) return null;
  return value & ((1 << width) - 1);
}

export function encodeR(mnemonic: string, rd: number, rs1: number, rs2: number): number {
  const funct = FUNCT[mnemonic] ?? 0;
  const opcode = mnemonic === "SLT" ? OP.SLT : OP.ALU;
  return ((opcode & 0xf) << 12) | ((rd & 7) << 9) | ((rs1 & 7) << 6) | ((rs2 & 7) << 3) | (funct & 7);
}

export function encodeI(opcode: number, rd: number, rs1: number, imm: number): number {
  const field = fitSigned(imm, 6) ?? (imm & 0x3f);
  return ((opcode & 0xf) << 12) | ((rd & 7) << 9) | ((rs1 & 7) << 6) | (field & 0x3f);
}

export function encodeS(rs2: number, rs1: number, imm: number): number {
  const field = fitSigned(imm, 6) ?? (imm & 0x3f);
  return (OP.STORE << 12) | ((rs2 & 7) << 9) | ((rs1 & 7) << 6) | (field & 0x3f);
}

export function encodeB(opcode: number, rs1: number, rs2: number, imm: number): number {
  const field = fitSigned(imm, 6) ?? (imm & 0x3f);
  return ((opcode & 0xf) << 12) | ((rs1 & 7) << 9) | ((rs2 & 7) << 6) | (field & 0x3f);
}

export function encodeJ(opcode: number, imm: number): number {
  const field = fitSigned(imm, 12) ?? (imm & 0xfff);
  return ((opcode & 0xf) << 12) | (field & 0xfff);
}

function intent(mnemonic: string): Pick<Decoded, "category" | "format" | "regWrite" | "memRead" | "memWrite" | "aluSrc" | "aluOp" | "branch" | "jump" | "memToReg" | "explain"> {
  const table: Record<string, Pick<Decoded, "category" | "format" | "regWrite" | "memRead" | "memWrite" | "aluSrc" | "aluOp" | "branch" | "jump" | "memToReg" | "explain">> = {
    NOP: { category: "system", format: "N", regWrite: false, memRead: false, memWrite: false, aluSrc: "reg", aluOp: "NONE", branch: false, jump: false, memToReg: false, explain: "NOP advances the PC and changes no register." },
    HALT: { category: "system", format: "N", regWrite: false, memRead: false, memWrite: false, aluSrc: "reg", aluOp: "NONE", branch: false, jump: false, memToReg: false, explain: "HALT stops the fetch of further instructions." },
    ADD: { category: "arithmetic", format: "R", regWrite: true, memRead: false, memWrite: false, aluSrc: "reg", aluOp: "ADD", branch: false, jump: false, memToReg: false, explain: "ADD reads two registers, adds them, and writes the destination." },
    SUB: { category: "arithmetic", format: "R", regWrite: true, memRead: false, memWrite: false, aluSrc: "reg", aluOp: "SUB", branch: false, jump: false, memToReg: false, explain: "SUB subtracts the second source from the first." },
    ADDI: { category: "arithmetic", format: "I", regWrite: true, memRead: false, memWrite: false, aluSrc: "imm", aluOp: "ADD", branch: false, jump: false, memToReg: false, explain: "ADDI adds a sign-extended immediate. The immediate is not a memory access." },
    AND: { category: "logical", format: "R", regWrite: true, memRead: false, memWrite: false, aluSrc: "reg", aluOp: "AND", branch: false, jump: false, memToReg: false, explain: "AND combines two registers bitwise." },
    OR: { category: "logical", format: "R", regWrite: true, memRead: false, memWrite: false, aluSrc: "reg", aluOp: "OR", branch: false, jump: false, memToReg: false, explain: "OR combines two registers bitwise." },
    XOR: { category: "logical", format: "R", regWrite: true, memRead: false, memWrite: false, aluSrc: "reg", aluOp: "XOR", branch: false, jump: false, memToReg: false, explain: "XOR combines two registers bitwise." },
    SLL: { category: "shift", format: "R", regWrite: true, memRead: false, memWrite: false, aluSrc: "reg", aluOp: "SLL", branch: false, jump: false, memToReg: false, explain: "SLL shifts rs1 left by the low bits of rs2." },
    SRL: { category: "shift", format: "R", regWrite: true, memRead: false, memWrite: false, aluSrc: "reg", aluOp: "SRL", branch: false, jump: false, memToReg: false, explain: "SRL shifts rs1 right, filling zeros." },
    SRA: { category: "shift", format: "R", regWrite: true, memRead: false, memWrite: false, aluSrc: "reg", aluOp: "SRA", branch: false, jump: false, memToReg: false, explain: "SRA shifts rs1 right and keeps the sign bit." },
    SLT: { category: "compare", format: "R", regWrite: true, memRead: false, memWrite: false, aluSrc: "reg", aluOp: "SLT", branch: false, jump: false, memToReg: false, explain: "SLT writes 1 when the signed value in rs1 is less than rs2." },
    LOAD: { category: "memory", format: "I", regWrite: true, memRead: true, memWrite: false, aluSrc: "imm", aluOp: "ADD", branch: false, jump: false, memToReg: true, explain: "LOAD uses rs1 plus the offset as the address and writes the word into rd." },
    STORE: { category: "memory", format: "S", regWrite: false, memRead: false, memWrite: true, aluSrc: "imm", aluOp: "ADD", branch: false, jump: false, memToReg: false, explain: "STORE writes rs2 to memory. It does not write a destination register." },
    BEQ: { category: "branch", format: "B", regWrite: false, memRead: false, memWrite: false, aluSrc: "reg", aluOp: "SUB", branch: true, jump: false, memToReg: false, explain: "BEQ compares two registers. The target is this instruction's address plus a signed offset." },
    BNE: { category: "branch", format: "B", regWrite: false, memRead: false, memWrite: false, aluSrc: "reg", aluOp: "SUB", branch: true, jump: false, memToReg: false, explain: "BNE branches when the two registers differ." },
    J: { category: "jump", format: "J", regWrite: false, memRead: false, memWrite: false, aluSrc: "imm", aluOp: "NONE", branch: false, jump: true, memToReg: false, explain: "J sets the PC to this instruction's address plus a 12-bit signed offset." },
    CALL: { category: "stack", format: "J", regWrite: true, memRead: false, memWrite: true, aluSrc: "imm", aluOp: "NONE", branch: false, jump: true, memToReg: false, explain: "CALL decrements R7, stores the return address at Mem[R7], then jumps. R7 is the stack pointer." },
    RET: { category: "stack", format: "N", regWrite: true, memRead: true, memWrite: false, aluSrc: "reg", aluOp: "NONE", branch: false, jump: true, memToReg: false, explain: "RET loads the PC from Mem[R7], then increments R7." },
  };
  return table[mnemonic] ?? table.NOP!;
}

export function decode(word: number): Decoded {
  const clean = word & 0xffff;
  const opcode = bits(clean, 15, 12);
  const a = bits(clean, 11, 9);
  const b = bits(clean, 8, 6);
  const c = bits(clean, 5, 3);
  const funct = bits(clean, 2, 0);
  let mnemonic = "NOP";
  if (opcode === OP.ALU) mnemonic = ALU_NAME[funct] ?? "ADD";
  else if (opcode === OP.SLT) mnemonic = "SLT";
  else if (opcode === OP.ADDI) mnemonic = "ADDI";
  else if (opcode === OP.LOAD) mnemonic = "LOAD";
  else if (opcode === OP.STORE) mnemonic = "STORE";
  else if (opcode === OP.BEQ) mnemonic = "BEQ";
  else if (opcode === OP.BNE) mnemonic = "BNE";
  else if (opcode === OP.J) mnemonic = "J";
  else if (opcode === OP.CALL) mnemonic = "CALL";
  else if (opcode === OP.RET) mnemonic = "RET";
  else if (opcode === OP.HALT) mnemonic = "HALT";
  const info = intent(mnemonic);
  const imm = info.format === "J" ? sextBits(bits(clean, 11, 0), 12) : info.format === "N" ? 0 : sextBits(bits(clean, 5, 0), 6);
  const rd = info.format === "S" || info.format === "B" || info.format === "J" || info.format === "N" ? (mnemonic === "CALL" || mnemonic === "RET" ? 7 : 0) : a;
  const rs1 = info.format === "J" || info.format === "N" ? (mnemonic === "RET" ? 7 : 0) : info.format === "B" ? a : b;
  const rs2 = info.format === "R" || info.format === "B" ? (info.format === "B" ? b : c) : info.format === "S" ? a : 0;
  return { word: clean, opcode, mnemonic, ...info, rd, rs1, rs2, imm, funct };
}

export function fieldsOf(decoded: Decoded): FieldSlice[] {
  if (decoded.format === "R") {
    return [
      { name: "opcode", hi: 15, lo: 12, meaning: `${decoded.mnemonic} opcode ${decoded.opcode}` },
      { name: "rd", hi: 11, lo: 9, meaning: `Destination R${decoded.rd}` },
      { name: "rs1", hi: 8, lo: 6, meaning: `Source R${decoded.rs1}` },
      { name: "rs2", hi: 5, lo: 3, meaning: `Source R${decoded.rs2}` },
      { name: "funct", hi: 2, lo: 0, meaning: `Function ${decoded.funct}` },
    ];
  }
  if (decoded.format === "I") {
    return [
      { name: "opcode", hi: 15, lo: 12, meaning: `${decoded.mnemonic} opcode ${decoded.opcode}` },
      { name: "rd", hi: 11, lo: 9, meaning: `Destination R${decoded.rd}` },
      { name: "rs1", hi: 8, lo: 6, meaning: `Base or source R${decoded.rs1}` },
      { name: "imm", hi: 5, lo: 0, meaning: `Signed immediate ${decoded.imm}` },
    ];
  }
  if (decoded.format === "S" || decoded.format === "B") {
    return [
      { name: "opcode", hi: 15, lo: 12, meaning: `${decoded.mnemonic} opcode ${decoded.opcode}` },
      { name: decoded.format === "S" ? "rs2" : "rs1", hi: 11, lo: 9, meaning: decoded.format === "S" ? `Stored value R${decoded.rs2}` : `Compared R${decoded.rs1}` },
      { name: decoded.format === "S" ? "rs1" : "rs2", hi: 8, lo: 6, meaning: decoded.format === "S" ? `Base R${decoded.rs1}` : `Compared R${decoded.rs2}` },
      { name: "imm", hi: 5, lo: 0, meaning: decoded.format === "B" ? `PC offset ${decoded.imm}` : `Address offset ${decoded.imm}` },
    ];
  }
  if (decoded.format === "J") {
    return [
      { name: "opcode", hi: 15, lo: 12, meaning: `${decoded.mnemonic} opcode ${decoded.opcode}` },
      { name: "offset", hi: 11, lo: 0, meaning: `PC-relative offset ${decoded.imm}` },
    ];
  }
  return [{ name: "opcode", hi: 15, lo: 12, meaning: decoded.explain }];
}

export function binaryWord(word: number): string {
  return (word & 0xffff).toString(2).padStart(16, "0");
}

export function fieldValue(word: number, field: FieldSlice): string {
  return bits(word, field.hi, field.lo).toString(2).padStart(field.hi - field.lo + 1, "0");
}

export interface AluStep {
  result: number;
  z: 0 | 1;
  n: 0 | 1;
  c: 0 | 1;
  v: 0 | 1;
}

export function operate(op: string, left: number, right: number): AluStep {
  const a = fromUnsigned(left & 0xffff, WORD_BITS);
  const b = fromUnsigned(right & 0xffff, WORD_BITS);
  if (op === "SLL" || op === "SRL" || op === "SRA") {
    const kind = op === "SLL" ? "logical-left" : op === "SRA" ? "arithmetic-right" : "logical-right";
    const shifted = shiftVector(a, kind, right & 0xf);
    const result = toUnsigned(shifted.result) ?? 0;
    return { result, z: result === 0 ? 1 : 0, n: shifted.result[0] === 1 ? 1 : 0, c: shifted.shiftedOut === 1 ? 1 : 0, v: 0 };
  }
  if (op === "SLT") {
    const result = (toSigned(a) ?? 0) < (toSigned(b) ?? 0) ? 1 : 0;
    return { result, z: result === 0 ? 1 : 0, n: 0, c: 0, v: 0 };
  }
  const aluOp: AluOp = op === "SUB" ? "SUB" : op === "AND" ? "AND" : op === "OR" ? "OR" : op === "XOR" ? "XOR" : "ADD";
  const computed = alu(a, b, aluOp);
  return {
    result: toUnsigned(computed.result) ?? 0,
    z: computed.zero,
    n: computed.negative,
    c: computed.carry,
    v: computed.overflow,
  };
}

export const CATEGORIES: Array<{ id: Category; title: string; note: string; examples: string[] }> = [
  { id: "memory", title: "Data transfer", note: "LOAD and STORE move words between registers and data memory.", examples: ["LOAD R1, 0(R2)", "STORE R3, 4(R0)"] },
  { id: "arithmetic", title: "Arithmetic", note: "ADD, SUB, and ADDI use the ALU on register or immediate operands.", examples: ["ADD R3, R1, R2", "ADDI R1, R0, 5"] },
  { id: "logical", title: "Logical", note: "AND, OR, and XOR stay inside the register file and ALU.", examples: ["AND R4, R1, R2"] },
  { id: "shift", title: "Shift", note: "The Phase 2 shifter supplies logical and arithmetic shifts.", examples: ["SLL R1, R2, R3"] },
  { id: "compare", title: "Compare", note: "SLT writes 1 or 0. Branches compare registers directly.", examples: ["SLT R1, R2, R3"] },
  { id: "branch", title: "Branch", note: "BEQ and BNE add a signed offset to the branch's own PC.", examples: ["BEQ R1, R2, DONE"] },
  { id: "jump", title: "Jump", note: "J replaces the PC with a PC-relative target.", examples: ["J LOOP"] },
  { id: "stack", title: "Call and return", note: "CALL and RET use R7 as the stack pointer.", examples: ["CALL SUBR", "RET"] },
  { id: "system", title: "System", note: "NOP and HALT are the only system operations in this set.", examples: ["NOP", "HALT"] },
];

export const ADDRESSING = [
  { id: "imm", title: "Immediate", sample: "ADDI R1, R2, 5", formula: "Operand = 5", note: "The value is in the instruction. No memory lookup is required for it." },
  { id: "reg", title: "Register", sample: "ADD R1, R2, R3", formula: "Operand = R3", note: "The register file supplies the value directly." },
  { id: "direct", title: "Direct", sample: "LOAD R1, 20(R0)", formula: "EA = 20", note: "With R0 = 0, the address field is the effective address." },
  { id: "indirect", title: "Indirect", sample: "LOAD R4, 0(R1) after a pointer load", formula: "pointer = Mem[1000]; value = Mem[pointer]", note: "One load reads an address. The next load reads the final word." },
  { id: "regind", title: "Register indirect", sample: "LOAD R1, 0(R2)", formula: "EA = R2", note: "The register holds the address. The offset is zero." },
  { id: "index", title: "Indexed", sample: "LOAD R1, 0(R2) with R2 = base + index", formula: "EA = base + index", note: "The sum is formed in a register, then used as the address." },
  { id: "base", title: "Base + displacement", sample: "LOAD R1, 20(R2)", formula: "EA = R2 + 20", note: "The ALU adds the base register and the immediate offset." },
  { id: "relative", title: "PC-relative", sample: "BEQ R1, R2, SKIP", formula: "target = PC + offset", note: "The offset is measured from the branch instruction itself." },
  { id: "stack", title: "Stack", sample: "CALL SUBR / RET", formula: "Mem[R7] holds the return address", note: "R7 is the architectural stack pointer. CALL writes that memory word. RET reads it." },
] as const;
