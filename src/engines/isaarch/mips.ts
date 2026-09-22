import { bits, signExtend, slice, toBin32, toHex32, u32, type FieldSlice } from "./bits";

export const MIPS_REGS = [
  { n: 0, name: "$zero", role: "Hardwired zero (ABI name, not a second ISA id)" },
  { n: 2, name: "$v0", role: "Return value (ABI)" },
  { n: 4, name: "$a0", role: "Argument (ABI)" },
  { n: 8, name: "$t0", role: "Temporary (ABI)" },
  { n: 9, name: "$t1", role: "Temporary (ABI)" },
  { n: 10, name: "$t2", role: "Temporary (ABI)" },
  { n: 16, name: "$s0", role: "Saved (ABI)" },
  { n: 29, name: "$sp", role: "Stack pointer (ABI)" },
  { n: 31, name: "$ra", role: "Return address (ABI)" },
];

export type MipsFormat = "R" | "I" | "J";

export const MIPS_LAYOUT: Record<MipsFormat, Array<{ name: string; hi: number; lo: number; color: string; meaning: string }>> = {
  R: [
    { name: "opcode", hi: 31, lo: 26, color: "#f9a8d4", meaning: "0 for R-type" },
    { name: "rs", hi: 25, lo: 21, color: "#93c5fd", meaning: "Source register" },
    { name: "rt", hi: 20, lo: 16, color: "#86efac", meaning: "Source / second operand" },
    { name: "rd", hi: 15, lo: 11, color: "#fdba74", meaning: "Destination register" },
    { name: "shamt", hi: 10, lo: 6, color: "#fde68a", meaning: "Shift amount" },
    { name: "funct", hi: 5, lo: 0, color: "#c4b5fd", meaning: "Function code" },
  ],
  I: [
    { name: "opcode", hi: 31, lo: 26, color: "#f9a8d4", meaning: "I-type opcode" },
    { name: "rs", hi: 25, lo: 21, color: "#93c5fd", meaning: "Base / compare register" },
    { name: "rt", hi: 20, lo: 16, color: "#86efac", meaning: "Source or destination" },
    { name: "immediate", hi: 15, lo: 0, color: "#c4b5fd", meaning: "16-bit immediate" },
  ],
  J: [
    { name: "opcode", hi: 31, lo: 26, color: "#f9a8d4", meaning: "J-type opcode" },
    { name: "target", hi: 25, lo: 0, color: "#c4b5fd", meaning: "Word target (PC region)" },
  ],
};

export interface MipsDecoded {
  word: number;
  mnemonic: string;
  format: MipsFormat;
  opcode: number;
  rs: number;
  rt: number;
  rd: number;
  shamt: number;
  funct: number;
  imm: number;
  target: number;
  text: string;
}

const FUNCT: Record<number, string> = { 0x20: "add", 0x22: "sub", 0x24: "and", 0x25: "or", 0x2a: "slt" };
const IOP: Record<number, string> = { 0x08: "addi", 0x23: "lw", 0x2b: "sw", 0x04: "beq", 0x05: "bne" };

export function encodeR(rs: number, rt: number, rd: number, funct: number, shamt = 0): number {
  return u32((rs << 21) | (rt << 16) | (rd << 11) | (shamt << 6) | funct);
}

export function encodeI(opcode: number, rs: number, rt: number, imm: number): number {
  return u32((opcode << 26) | (rs << 21) | (rt << 16) | (imm & 0xffff));
}

export function encodeJ(opcode: number, target: number): number {
  return u32((opcode << 26) | (target & 0x3ffffff));
}

export function decodeMips(word: number): MipsDecoded {
  const clean = u32(word);
  const opcode = bits(clean, 31, 26);
  const rs = bits(clean, 25, 21);
  const rt = bits(clean, 20, 16);
  const rd = bits(clean, 15, 11);
  const shamt = bits(clean, 10, 6);
  const funct = bits(clean, 5, 0);
  const imm = signExtend(bits(clean, 15, 0), 16);
  const target = bits(clean, 25, 0);
  let mnemonic = "unknown";
  let format: MipsFormat = "R";
  if (opcode === 0) {
    format = "R";
    mnemonic = FUNCT[funct] ?? "unknown";
  } else if (opcode === 2) {
    format = "J";
    mnemonic = "j";
  } else {
    format = "I";
    mnemonic = IOP[opcode] ?? "unknown";
  }
  const text = format === "R" ? `${mnemonic} $${rd}, $${rs}, $${rt}`
    : mnemonic === "lw" || mnemonic === "sw" ? `${mnemonic} $${rt}, ${imm}($${rs})`
      : mnemonic === "beq" || mnemonic === "bne" ? `${mnemonic} $${rs}, $${rt}, ${imm}`
        : mnemonic === "j" ? `j ${target}`
          : `${mnemonic} $${rt}, $${rs}, ${imm}`;
  return { word: clean, mnemonic, format, opcode, rs, rt, rd, shamt, funct, imm, target, text };
}

export function fieldsMips(word: number): FieldSlice[] {
  const decoded = decodeMips(word);
  return MIPS_LAYOUT[decoded.format].map((field) => slice(word, field.name, field.hi, field.lo, field.meaning, field.color));
}

export interface MipsControls {
  RegDst: 0 | 1;
  ALUSrc: 0 | 1;
  MemRead: 0 | 1;
  MemWrite: 0 | 1;
  MemtoReg: 0 | 1;
  RegWrite: 0 | 1;
  Branch: 0 | 1;
  Jump: 0 | 1;
  ALUOp: "add" | "sub" | "and" | "or" | "slt" | "fun";
}

export function mipsControls(mnemonic: string): MipsControls {
  const off: MipsControls = { RegDst: 0, ALUSrc: 0, MemRead: 0, MemWrite: 0, MemtoReg: 0, RegWrite: 0, Branch: 0, Jump: 0, ALUOp: "add" };
  if (["add", "sub", "and", "or", "slt"].includes(mnemonic)) return { ...off, RegDst: 1, RegWrite: 1, ALUOp: "fun" };
  if (mnemonic === "addi") return { ...off, ALUSrc: 1, RegWrite: 1, ALUOp: "add" };
  if (mnemonic === "lw") return { ...off, ALUSrc: 1, MemRead: 1, MemtoReg: 1, RegWrite: 1, ALUOp: "add" };
  if (mnemonic === "sw") return { ...off, ALUSrc: 1, MemWrite: 1, ALUOp: "add" };
  if (mnemonic === "beq" || mnemonic === "bne") return { ...off, Branch: 1, ALUOp: "sub" };
  if (mnemonic === "j") return { ...off, Jump: 1 };
  return off;
}

export function mipsRoute(mnemonic: string): string[] {
  const nodes = ["pc", "imem", "decode"];
  if (mnemonic === "j") return [...nodes, "jump", "pcnext"];
  nodes.push("regfile");
  if (["addi", "lw", "sw"].includes(mnemonic)) nodes.push("signext");
  nodes.push("alusrc", "alu");
  if (mnemonic === "lw" || mnemonic === "sw") nodes.push("dmem");
  if (mnemonic === "beq" || mnemonic === "bne") nodes.push("branch");
  if (mnemonic !== "sw" && mnemonic !== "beq" && mnemonic !== "bne") nodes.push("wb");
  nodes.push("pcnext");
  return nodes;
}

export function ea(rs: number, imm: number): number {
  return u32(rs + imm);
}

export function branchTarget(pc: number, imm: number): number {
  return u32((pc + 4) + (imm << 2));
}

export function jumpTarget(pc: number, target: number): number {
  return u32(((pc + 4) & 0xf0000000) | (target << 2));
}

export function aluMips(op: string, a: number, b: number): number {
  if (op === "sub") return u32(a - b);
  if (op === "and") return a & b;
  if (op === "or") return a | b;
  if (op === "slt") return (a | 0) < (b | 0) ? 1 : 0;
  return u32(a + b);
}

const REG_NUM: Record<string, number> = {
  zero: 0, at: 1, v0: 2, v1: 3, a0: 4, a1: 5, a2: 6, a3: 7,
  t0: 8, t1: 9, t2: 10, t3: 11, t4: 12, t5: 13, t6: 14, t7: 15,
  s0: 16, s1: 17, s2: 18, s3: 19, s4: 20, s5: 21, s6: 22, s7: 23,
  t8: 24, t9: 25, k0: 26, k1: 27, gp: 28, sp: 29, fp: 30, ra: 31,
};

export function parseMipsReg(token: string): number | null {
  const t = token.trim().toLowerCase().replace(/^\$/, "");
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    return n >= 0 && n <= 31 ? n : null;
  }
  return REG_NUM[t] ?? null;
}

export function parseMipsAsm(line: string): MipsDecoded | { error: string } {
  const text = line.split(/[#;]/)[0]?.trim() ?? "";
  const parts = text.split(/[\s,]+/).filter(Boolean);
  const mnemonic = (parts[0] ?? "").toLowerCase();
  const known = MIPS_EXAMPLES.find((item) => item.asm.toLowerCase() === text.toLowerCase());
  if (known) return decodeMips(known.word);
  const rType: Record<string, number> = { add: 0x20, sub: 0x22, and: 0x24, or: 0x25, slt: 0x2a };
  if (rType[mnemonic] !== undefined) {
    const rd = parseMipsReg(parts[1] ?? "");
    const rs = parseMipsReg(parts[2] ?? "");
    const rt = parseMipsReg(parts[3] ?? "");
    if (rd === null || rs === null || rt === null) return { error: "Use $t0-style names or $0–$31." };
    return decodeMips(encodeR(rs, rt, rd, rType[mnemonic] ?? 0x20));
  }
  if (mnemonic === "lw" || mnemonic === "sw") {
    const rt = parseMipsReg(parts[1] ?? "");
    const mem = (parts[2] ?? "").match(/^(-?\d+)\(([^)]+)\)$/);
    const rs = parseMipsReg(mem?.[2] ?? "");
    const imm = Number(mem?.[1]);
    if (rt === null || rs === null || !Number.isFinite(imm)) return { error: "Use lw/sw $rt, imm($rs)." };
    return decodeMips(encodeI(mnemonic === "lw" ? 0x23 : 0x2b, rs, rt, imm));
  }
  if (mnemonic === "beq" || mnemonic === "bne" || mnemonic === "addi") {
    const a = parseMipsReg(parts[1] ?? "");
    const b = parseMipsReg(parts[2] ?? "");
    const imm = Number(parts[3]);
    if (a === null || b === null || !Number.isFinite(imm)) return { error: "Malformed I-type operands." };
    const opcode = mnemonic === "addi" ? 0x08 : mnemonic === "beq" ? 0x04 : 0x05;
    return decodeMips(encodeI(opcode, mnemonic === "addi" ? b : a, mnemonic === "addi" ? a : b, imm));
  }
  if (mnemonic === "j") {
    const target = Number(parts[1]);
    if (!Number.isFinite(target)) return { error: "Jump needs a word target." };
    return decodeMips(encodeJ(2, target));
  }
  return { error: `Unsupported MIPS teaching mnemonic "${mnemonic}".` };
}

export const MIPS_EXAMPLES = [
  { asm: "add $t0, $t1, $t2", word: encodeR(9, 10, 8, 0x20) },
  { asm: "sub $t0, $t1, $t2", word: encodeR(9, 10, 8, 0x22) },
  { asm: "lw $t0, 4($t1)", word: encodeI(0x23, 9, 8, 4) },
  { asm: "sw $t0, 8($t1)", word: encodeI(0x2b, 9, 8, 8) },
  { asm: "beq $t0, $t1, 3", word: encodeI(0x04, 8, 9, 3) },
  { asm: "j 0x10", word: encodeJ(2, 0x10) },
];

export { toHex32, toBin32 };
