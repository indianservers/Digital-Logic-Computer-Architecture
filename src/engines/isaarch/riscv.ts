import { bits, signExtend, slice, toBin32, toHex32, u32, type FieldSlice } from "./bits";

export const RV_MEM_BYTES = 1024;
export const RV_REGS = 32;

export type RvFormat = "R" | "I" | "S" | "B" | "U" | "J";

export const ABI: Record<number, string> = {
  0: "zero", 1: "ra", 2: "sp", 3: "gp", 4: "tp", 5: "t0", 6: "t1", 7: "t2",
  8: "s0", 9: "s1", 10: "a0", 11: "a1", 12: "a2", 13: "a3", 14: "a4", 15: "a5",
  16: "a6", 17: "a7", 18: "s2", 19: "s3", 20: "s4", 21: "s5", 22: "s6", 23: "s7",
  24: "s8", 25: "s9", 26: "s10", 27: "s11", 28: "t3", 29: "t4", 30: "t5", 31: "t6",
};

const ABI_NUM: Record<string, number> = Object.fromEntries(
  Object.entries(ABI).map(([number, name]) => [name, Number(number)]),
);
ABI_NUM.fp = 8;
ABI_NUM.zero = 0;

export function xName(index: number): string {
  return `x${index}`;
}

export interface RvDecoded {
  word: number;
  mnemonic: string;
  format: RvFormat;
  opcode: number;
  rd: number;
  rs1: number;
  rs2: number;
  funct3: number;
  funct7: number;
  imm: number;
  text: string;
  error: string | null;
}

export const RV_FORMATS: Record<RvFormat, Array<{ name: string; hi: number; lo: number; color: string; meaning: string }>> = {
  R: [
    { name: "funct7", hi: 31, lo: 25, color: "#c4b5fd", meaning: "Function code (extended)" },
    { name: "rs2", hi: 24, lo: 20, color: "#86efac", meaning: "Source register 2" },
    { name: "rs1", hi: 19, lo: 15, color: "#93c5fd", meaning: "Source register 1" },
    { name: "funct3", hi: 14, lo: 12, color: "#fde68a", meaning: "Function code" },
    { name: "rd", hi: 11, lo: 7, color: "#fdba74", meaning: "Destination register" },
    { name: "opcode", hi: 6, lo: 0, color: "#f9a8d4", meaning: "Opcode (0x33 for OP)" },
  ],
  I: [
    { name: "imm[11:0]", hi: 31, lo: 20, color: "#c4b5fd", meaning: "I-immediate" },
    { name: "rs1", hi: 19, lo: 15, color: "#93c5fd", meaning: "Source register 1" },
    { name: "funct3", hi: 14, lo: 12, color: "#fde68a", meaning: "Function code" },
    { name: "rd", hi: 11, lo: 7, color: "#fdba74", meaning: "Destination register" },
    { name: "opcode", hi: 6, lo: 0, color: "#f9a8d4", meaning: "Opcode" },
  ],
  S: [
    { name: "imm[11:5]", hi: 31, lo: 25, color: "#c4b5fd", meaning: "Store immediate high" },
    { name: "rs2", hi: 24, lo: 20, color: "#86efac", meaning: "Store data register" },
    { name: "rs1", hi: 19, lo: 15, color: "#93c5fd", meaning: "Base register" },
    { name: "funct3", hi: 14, lo: 12, color: "#fde68a", meaning: "Width" },
    { name: "imm[4:0]", hi: 11, lo: 7, color: "#fdba74", meaning: "Store immediate low" },
    { name: "opcode", hi: 6, lo: 0, color: "#f9a8d4", meaning: "Opcode (0x23)" },
  ],
  B: [
    { name: "imm[12]", hi: 31, lo: 31, color: "#c4b5fd", meaning: "Branch imm bit 12" },
    { name: "imm[10:5]", hi: 30, lo: 25, color: "#ddd6fe", meaning: "Branch imm 10:5" },
    { name: "rs2", hi: 24, lo: 20, color: "#86efac", meaning: "Compare register 2" },
    { name: "rs1", hi: 19, lo: 15, color: "#93c5fd", meaning: "Compare register 1" },
    { name: "funct3", hi: 14, lo: 12, color: "#fde68a", meaning: "Branch type" },
    { name: "imm[4:1]", hi: 11, lo: 8, color: "#fdba74", meaning: "Branch imm 4:1" },
    { name: "imm[11]", hi: 7, lo: 7, color: "#fb923c", meaning: "Branch imm bit 11" },
    { name: "opcode", hi: 6, lo: 0, color: "#f9a8d4", meaning: "Opcode (0x63)" },
  ],
  U: [
    { name: "imm[31:12]", hi: 31, lo: 12, color: "#c4b5fd", meaning: "Upper immediate" },
    { name: "rd", hi: 11, lo: 7, color: "#fdba74", meaning: "Destination register" },
    { name: "opcode", hi: 6, lo: 0, color: "#f9a8d4", meaning: "Opcode" },
  ],
  J: [
    { name: "imm[20]", hi: 31, lo: 31, color: "#c4b5fd", meaning: "Jump imm bit 20" },
    { name: "imm[10:1]", hi: 30, lo: 21, color: "#ddd6fe", meaning: "Jump imm 10:1" },
    { name: "imm[11]", hi: 20, lo: 20, color: "#93c5fd", meaning: "Jump imm bit 11" },
    { name: "imm[19:12]", hi: 19, lo: 12, color: "#fde68a", meaning: "Jump imm 19:12" },
    { name: "rd", hi: 11, lo: 7, color: "#fdba74", meaning: "Link register" },
    { name: "opcode", hi: 6, lo: 0, color: "#f9a8d4", meaning: "Opcode (0x6F)" },
  ],
};

export function immI(word: number): number {
  return signExtend(bits(word, 31, 20), 12);
}

export function immS(word: number): number {
  return signExtend((bits(word, 31, 25) << 5) | bits(word, 11, 7), 12);
}

export function immB(word: number): number {
  const value = (bits(word, 31, 31) << 12) | (bits(word, 7, 7) << 11) | (bits(word, 30, 25) << 5) | (bits(word, 11, 8) << 1);
  return signExtend(value, 13);
}

export function immU(word: number): number {
  return (word & 0xfffff000) >>> 0;
}

export function immJ(word: number): number {
  const value = (bits(word, 31, 31) << 20) | (bits(word, 19, 12) << 12) | (bits(word, 20, 20) << 11) | (bits(word, 30, 21) << 1);
  return signExtend(value, 21);
}

export function fieldsOf(format: RvFormat, word: number): FieldSlice[] {
  return RV_FORMATS[format].map((field) => slice(word, field.name, field.hi, field.lo, field.meaning, field.color));
}

export function encodeR(funct7: number, rs2: number, rs1: number, funct3: number, rd: number, opcode: number): number {
  return u32((funct7 << 25) | (rs2 << 20) | (rs1 << 15) | (funct3 << 12) | (rd << 7) | opcode);
}

export function encodeI(imm: number, rs1: number, funct3: number, rd: number, opcode: number): number {
  return u32(((imm & 0xfff) << 20) | (rs1 << 15) | (funct3 << 12) | (rd << 7) | opcode);
}

export function encodeS(imm: number, rs2: number, rs1: number, funct3: number): number {
  const value = imm & 0xfff;
  return u32(((value >> 5) << 25) | (rs2 << 20) | (rs1 << 15) | (funct3 << 12) | ((value & 0x1f) << 7) | 0x23);
}

export function encodeB(imm: number, rs2: number, rs1: number, funct3: number): number {
  const value = imm & 0x1fff;
  return u32(
    (((value >> 12) & 1) << 31) |
    (((value >> 5) & 0x3f) << 25) |
    (rs2 << 20) | (rs1 << 15) | (funct3 << 12) |
    (((value >> 1) & 0xf) << 8) |
    (((value >> 11) & 1) << 7) |
    0x63,
  );
}

export function encodeU(imm: number, rd: number, opcode: number): number {
  return u32((imm & 0xfffff000) | (rd << 7) | opcode);
}

export function encodeJ(imm: number, rd: number): number {
  const value = imm & 0x1fffff;
  return u32(
    (((value >> 20) & 1) << 31) |
    (((value >> 1) & 0x3ff) << 21) |
    (((value >> 11) & 1) << 20) |
    (((value >> 12) & 0xff) << 12) |
    (rd << 7) |
    0x6f,
  );
}

const OP = { LOAD: 0x03, MISC: 0x13, AUIPC: 0x17, STORE: 0x23, OP: 0x33, LUI: 0x37, BRANCH: 0x63, JALR: 0x67, JAL: 0x6f };

export function decode(word: number): RvDecoded {
  const clean = u32(word);
  const opcode = bits(clean, 6, 0);
  const rd = bits(clean, 11, 7);
  const funct3 = bits(clean, 14, 12);
  const rs1 = bits(clean, 19, 15);
  const rs2 = bits(clean, 24, 20);
  const funct7 = bits(clean, 31, 25);
  let mnemonic = "unknown";
  let format: RvFormat = "R";
  let imm = 0;
  if (opcode === OP.OP) {
    format = "R";
    const key = `${funct3}:${funct7}`;
    const map: Record<string, string> = { "0:0": "add", "0:32": "sub", "7:0": "and", "6:0": "or", "4:0": "xor", "1:0": "sll", "5:0": "srl", "5:32": "sra", "2:0": "slt", "3:0": "sltu" };
    mnemonic = map[key] ?? "unknown";
  } else if (opcode === OP.MISC) {
    format = "I";
    imm = immI(clean);
    if (funct3 === 0) mnemonic = "addi";
    else if (funct3 === 7) mnemonic = "andi";
    else if (funct3 === 6) mnemonic = "ori";
    else if (funct3 === 4) mnemonic = "xori";
    else if (funct3 === 2) mnemonic = "slti";
    else if (funct3 === 1) mnemonic = "slli";
    else if (funct3 === 5) mnemonic = bits(clean, 31, 25) === 32 ? "srai" : "srli";
    else mnemonic = "unknown";
    if (mnemonic === "slli" || mnemonic === "srli" || mnemonic === "srai") imm = bits(clean, 24, 20);
  } else if (opcode === OP.LOAD) {
    format = "I";
    imm = immI(clean);
    mnemonic = funct3 === 2 ? "lw" : "unknown";
  } else if (opcode === OP.STORE) {
    format = "S";
    imm = immS(clean);
    mnemonic = funct3 === 2 ? "sw" : "unknown";
  } else if (opcode === OP.BRANCH) {
    format = "B";
    imm = immB(clean);
    const branches: Record<number, string> = { 0: "beq", 1: "bne", 4: "blt", 5: "bge", 6: "bltu", 7: "bgeu" };
    mnemonic = branches[funct3] ?? "unknown";
  } else if (opcode === OP.JAL) {
    format = "J";
    imm = immJ(clean);
    mnemonic = "jal";
  } else if (opcode === OP.JALR) {
    format = "I";
    imm = immI(clean);
    mnemonic = "jalr";
  } else if (opcode === OP.LUI) {
    format = "U";
    imm = immU(clean);
    mnemonic = "lui";
  } else if (opcode === OP.AUIPC) {
    format = "U";
    imm = immU(clean);
    mnemonic = "auipc";
  }
  const text = formatText(mnemonic, format, rd, rs1, rs2, imm);
  return { word: clean, mnemonic, format, opcode, rd, rs1, rs2, funct3, funct7, imm, text, error: mnemonic === "unknown" ? "Unsupported opcode in this RV32I teaching subset." : null };
}

function formatText(mnemonic: string, format: RvFormat, rd: number, rs1: number, rs2: number, imm: number): string {
  if (mnemonic === "unknown") return "unknown";
  if (format === "R") return `${mnemonic} x${rd}, x${rs1}, x${rs2}`;
  if (mnemonic === "lw") return `lw x${rd}, ${imm}(x${rs1})`;
  if (mnemonic === "sw") return `sw x${rs2}, ${imm}(x${rs1})`;
  if (mnemonic === "jalr") return `jalr x${rd}, ${imm}(x${rs1})`;
  if (format === "I") return `${mnemonic} x${rd}, x${rs1}, ${imm}`;
  if (format === "B") return `${mnemonic} x${rs1}, x${rs2}, ${imm}`;
  if (format === "J") return `jal x${rd}, ${imm}`;
  if (mnemonic === "lui" || mnemonic === "auipc") return `${mnemonic} x${rd}, ${imm >>> 12}`;
  return mnemonic;
}

export interface AsmError { line: number; message: string }

export type AsmResult =
  | { ok: true; words: number[]; listing: Array<{ line: number; pc: number; text: string; word: number }>; labels: Record<string, number> }
  | { ok: false; errors: AsmError[] };

function strip(text: string): string {
  return (text.split(/[#;]/)[0] ?? "").trim();
}

export function parseReg(token: string): number | null {
  const t = token.trim().toLowerCase();
  if (/^x([0-9]|[12][0-9]|3[01])$/.test(t)) return Number(t.slice(1));
  if (ABI_NUM[t] !== undefined) return ABI_NUM[t] ?? null;
  return null;
}

function numberToken(token: string): number | null {
  const t = token.trim().toLowerCase();
  if (/^0x[0-9a-f]+$/.test(t)) return Number.parseInt(t.slice(2), 16);
  if (/^-?\d+$/.test(t)) return Number(t);
  return null;
}

export function assemble(source: string): AsmResult {
  const errors: AsmError[] = [];
  const labels: Record<string, number> = {};
  const pending: Array<{ line: number; text: string }> = [];
  let pc = 0;
  source.split(/\r?\n/).forEach((original, index) => {
    const line = index + 1;
    let text = strip(original);
    if (!text) return;
    const labeled = text.match(/^([A-Za-z_]\w*):(?:\s*(.*))?$/);
    if (labeled) {
      const name = (labeled[1] ?? "").toLowerCase();
      if (labels[name] !== undefined) errors.push({ line, message: `Duplicate label ${name}.` });
      else labels[name] = pc;
      text = (labeled[2] ?? "").trim();
      if (!text) return;
    }
    pending.push({ line, text });
    pc += 4;
  });
  const words: number[] = [];
  const listing: Array<{ line: number; pc: number; text: string; word: number }> = [];
  pending.forEach((item, index) => {
    const address = index * 4;
    const word = encodeLine(item.text, item.line, address, labels, errors);
    if (word === null) return;
    words.push(word);
    listing.push({ line: item.line, pc: address, text: item.text, word });
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, words, listing, labels };
}

function resolve(token: string, line: number, pc: number, labels: Record<string, number>, errors: AsmError[], pcRel: boolean): number | null {
  const num = numberToken(token);
  if (num !== null) return num;
  const found = labels[token.toLowerCase()];
  if (found === undefined) {
    errors.push({ line, message: `Undefined label ${token}.` });
    return null;
  }
  return pcRel ? found - pc : found;
}

function encodeLine(text: string, line: number, pc: number, labels: Record<string, number>, errors: AsmError[]): number | null {
  const parts = text.split(/[\s,]+/).filter(Boolean);
  const mnemonic = (parts[0] ?? "").toLowerCase();
  const args = parts.slice(1);
  const reg = (token: string) => {
    const value = parseReg(token);
    if (value === null) errors.push({ line, message: `Unknown register "${token}". Use x0–x31 or an ABI alias.` });
    return value;
  };
  const need = (count: number) => {
    if (args.length !== count) {
      errors.push({ line, message: `${mnemonic} expects ${count} operand${count === 1 ? "" : "s"}.` });
      return false;
    }
    return true;
  };
  if (mnemonic === "nop") return need(0) ? encodeI(0, 0, 0, 0, OP.MISC) : null;
  if (mnemonic === "ret") return need(0) ? encodeI(0, 1, 0, 0, OP.JALR) : null;
  if (mnemonic === "li") {
    if (!need(2)) return null;
    const rd = reg(args[0] ?? "");
    const imm = numberToken(args[1] ?? "");
    if (rd === null || imm === null) {
      if (imm === null) errors.push({ line, message: "Malformed immediate." });
      return null;
    }
    if (imm < -2048 || imm > 2047) {
      errors.push({ line, message: "Immediate value exceeds field width (−2048..2047 for ADDI)." });
      return null;
    }
    return encodeI(imm, 0, 0, rd, OP.MISC);
  }
  if (mnemonic === "mv") {
    if (!need(2)) return null;
    const rd = reg(args[0] ?? "");
    const rs = reg(args[1] ?? "");
    if (rd === null || rs === null) return null;
    return encodeI(0, rs, 0, rd, OP.MISC);
  }
  const rType: Record<string, { f3: number; f7: number }> = {
    add: { f3: 0, f7: 0 }, sub: { f3: 0, f7: 32 }, and: { f3: 7, f7: 0 }, or: { f3: 6, f7: 0 }, xor: { f3: 4, f7: 0 },
    sll: { f3: 1, f7: 0 }, srl: { f3: 5, f7: 0 }, sra: { f3: 5, f7: 32 }, slt: { f3: 2, f7: 0 }, sltu: { f3: 3, f7: 0 },
  };
  if (rType[mnemonic]) {
    if (!need(3)) return null;
    const rd = reg(args[0] ?? ""); const rs1 = reg(args[1] ?? ""); const rs2 = reg(args[2] ?? "");
    const spec = rType[mnemonic];
    if (rd === null || rs1 === null || rs2 === null || !spec) return null;
    return encodeR(spec.f7, rs2, rs1, spec.f3, rd, OP.OP);
  }
  const iType: Record<string, number> = { addi: 0, andi: 7, ori: 6, xori: 4, slti: 2, slli: 1, srli: 5, srai: 5 };
  if (iType[mnemonic] !== undefined) {
    if (!need(3)) return null;
    const rd = reg(args[0] ?? ""); const rs1 = reg(args[1] ?? "");
    const imm = numberToken(args[2] ?? "");
    if (rd === null || rs1 === null || imm === null) {
      if (imm === null) errors.push({ line, message: "Malformed immediate." });
      return null;
    }
    const isShiftImm = mnemonic === "slli" || mnemonic === "srli" || mnemonic === "srai";
    if (!isShiftImm && (imm < -2048 || imm > 2047)) {
      errors.push({ line, message: "Immediate value exceeds field width (−2048..2047)." });
      return null;
    }
    if (isShiftImm && (imm < 0 || imm > 31)) {
      errors.push({ line, message: "Shift amount exceeds field width (0..31)." });
      return null;
    }
    const f3 = iType[mnemonic] ?? 0;
    if (mnemonic === "srai") return encodeI((32 << 5) | (imm & 31), rs1, 5, rd, OP.MISC);
    if (mnemonic === "slli" || mnemonic === "srli") return encodeI(imm & 31, rs1, f3, rd, OP.MISC);
    return encodeI(imm, rs1, f3, rd, OP.MISC);
  }
  if (mnemonic === "lw" || mnemonic === "sw" || mnemonic === "jalr") {
    if (!need(2)) return null;
    const dest = mnemonic === "sw" ? parseReg(args[0] ?? "") : parseReg(args[0] ?? "");
    const mem = (args[1] ?? "").match(/^(-?(?:0x)?[0-9a-fA-F]+)\(\s*([^)]+)\s*\)$/);
    if (dest === null) {
      errors.push({ line, message: `Unknown register "${args[0]}".` });
      return null;
    }
    if (!mem) {
      errors.push({ line, message: `Malformed memory operand "${args[1]}". Use imm(reg).` });
      return null;
    }
    const imm = numberToken(mem[1] ?? "");
    const base = parseReg(mem[2] ?? "");
    if (imm === null || base === null) {
      errors.push({ line, message: "Malformed memory operand." });
      return null;
    }
    if (imm < -2048 || imm > 2047) {
      errors.push({ line, message: "Immediate value exceeds field width." });
      return null;
    }
    if (mnemonic === "lw") return encodeI(imm, base, 2, dest, OP.LOAD);
    if (mnemonic === "sw") return encodeS(imm, dest, base, 2);
    return encodeI(imm, base, 0, dest, OP.JALR);
  }
  const branchFunct: Record<string, number> = { beq: 0, bne: 1, blt: 4, bge: 5, bltu: 6, bgeu: 7 };
  if (mnemonic in branchFunct) {
    if (!need(3)) return null;
    const rs1 = reg(args[0] ?? ""); const rs2 = reg(args[1] ?? "");
    const offset = resolve(args[2] ?? "", line, pc, labels, errors, true);
    if (rs1 === null || rs2 === null || offset === null) return null;
    if (offset < -4096 || offset > 4094 || offset % 2 !== 0) {
      errors.push({ line, message: "Branch offset does not fit in B-immediate." });
      return null;
    }
    return encodeB(offset, rs2, rs1, branchFunct[mnemonic] ?? 0);
  }
  if (mnemonic === "jal") {
    if (args.length === 1) {
      const offset = resolve(args[0] ?? "", line, pc, labels, errors, true);
      if (offset === null) return null;
      return encodeJ(offset, 1);
    }
    if (!need(2)) return null;
    const rd = reg(args[0] ?? "");
    const offset = resolve(args[1] ?? "", line, pc, labels, errors, true);
    if (rd === null || offset === null) return null;
    return encodeJ(offset, rd);
  }
  if (mnemonic === "lui" || mnemonic === "auipc") {
    if (!need(2)) return null;
    const rd = reg(args[0] ?? "");
    const imm = numberToken(args[1] ?? "");
    if (rd === null || imm === null) {
      if (imm === null) errors.push({ line, message: "Malformed immediate." });
      return null;
    }
    if (imm < 0 || imm > 0xfffff) {
      errors.push({ line, message: "Upper immediate exceeds 20 bits." });
      return null;
    }
    return encodeU(imm << 12, rd, mnemonic === "lui" ? OP.LUI : OP.AUIPC);
  }
  errors.push({ line, message: `Invalid instruction "${mnemonic}".` });
  return null;
}

export interface RvState {
  pc: number;
  regs: number[];
  mem: Uint32Array;
  ir: number;
  decoded: RvDecoded | null;
  halted: boolean;
  cycles: number;
  retired: number;
  trace: string[];
  error: string | null;
}

export function blankRv(): RvState {
  return { pc: 0, regs: Array.from({ length: RV_REGS }, () => 0), mem: new Uint32Array(RV_MEM_BYTES / 4), ir: 0, decoded: null, halted: false, cycles: 0, retired: 0, trace: [], error: null };
}

export function writeX(regs: number[], rd: number, value: number): number[] {
  const next = regs.slice();
  if (rd !== 0) next[rd] = u32(value);
  next[0] = 0;
  return next;
}

export function parseHexWord(text: string): number | null {
  const token = text.trim().toLowerCase();
  const hex = token.startsWith("0x") ? token.slice(2) : token;
  if (!/^[0-9a-f]{1,8}$/.test(hex)) return null;
  return Number.parseInt(hex, 16) >>> 0;
}

export function loadRv(source: string): RvState | { ok: false; error: string } {
  const built = assemble(source);
  if (!built.ok) return { ok: false, error: built.errors.map((item) => `Line ${item.line}: ${item.message}`).join("\n") };
  const state = blankRv();
  built.words.forEach((word, index) => {
    if (index < state.mem.length) state.mem[index] = word;
  });
  return state;
}

function readWord(mem: Uint32Array, addr: number): number | { error: string } {
  if (addr < 0 || addr + 3 >= RV_MEM_BYTES || addr % 4 !== 0) return { error: "Memory address out of range or unaligned." };
  return mem[addr / 4] ?? 0;
}

function writeWord(mem: Uint32Array, addr: number, value: number): string | null {
  if (addr < 0 || addr + 3 >= RV_MEM_BYTES || addr % 4 !== 0) return "Memory address out of range or unaligned.";
  mem[addr / 4] = u32(value);
  return null;
}

function signed(value: number): number {
  return value | 0;
}

export function stepRv(state: RvState): RvState {
  if (state.halted) return state;
  const next: RvState = { ...state, regs: state.regs.slice(), mem: state.mem.slice(), trace: state.trace.slice() };
  next.cycles += 1;
  const fetched = readWord(next.mem, next.pc);
  if (typeof fetched !== "number") {
    next.error = fetched.error;
    next.halted = true;
    return next;
  }
  if (fetched === 0 && next.retired > 0) {
    next.halted = true;
    next.trace.push("Stop: following word is 0 (teaching halt).");
    return next;
  }
  next.ir = fetched;
  const decoded = decode(fetched);
  next.decoded = decoded;
  if (decoded.error) {
    next.error = decoded.error;
    next.halted = true;
    return next;
  }
  const rs1 = next.regs[decoded.rs1] ?? 0;
  const rs2 = next.regs[decoded.rs2] ?? 0;
  const pc = next.pc;
  let target = pc + 4;
  let wb: number | null = null;
  const m = decoded.mnemonic;
  if (m === "add") wb = u32(rs1 + rs2);
  else if (m === "sub") wb = u32(rs1 - rs2);
  else if (m === "and") wb = rs1 & rs2;
  else if (m === "or") wb = rs1 | rs2;
  else if (m === "xor") wb = rs1 ^ rs2;
  else if (m === "sll") wb = u32(rs1 << (rs2 & 31));
  else if (m === "srl") wb = u32(rs1) >>> (rs2 & 31);
  else if (m === "sra") wb = u32(signed(rs1) >> (rs2 & 31));
  else if (m === "slt") wb = signed(rs1) < signed(rs2) ? 1 : 0;
  else if (m === "sltu") wb = u32(rs1) < u32(rs2) ? 1 : 0;
  else if (m === "addi") wb = u32(rs1 + decoded.imm);
  else if (m === "andi") wb = rs1 & decoded.imm;
  else if (m === "ori") wb = rs1 | decoded.imm;
  else if (m === "xori") wb = rs1 ^ decoded.imm;
  else if (m === "slti") wb = signed(rs1) < decoded.imm ? 1 : 0;
  else if (m === "slli") wb = u32(rs1 << (decoded.imm & 31));
  else if (m === "srli") wb = u32(rs1) >>> (decoded.imm & 31);
  else if (m === "srai") wb = u32(signed(rs1) >> (decoded.imm & 31));
  else if (m === "lw") {
    const loaded = readWord(next.mem, u32(rs1 + decoded.imm));
    if (typeof loaded !== "number") {
      next.error = loaded.error;
      next.halted = true;
      return next;
    }
    wb = loaded;
  } else if (m === "sw") {
    const fault = writeWord(next.mem, u32(rs1 + decoded.imm), rs2);
    if (fault) {
      next.error = fault;
      next.halted = true;
      return next;
    }
  } else if (m === "beq") {
    if (rs1 === rs2) target = pc + decoded.imm;
  } else if (m === "bne") {
    if (rs1 !== rs2) target = pc + decoded.imm;
  } else if (m === "blt") {
    if (signed(rs1) < signed(rs2)) target = pc + decoded.imm;
  } else if (m === "bge") {
    if (signed(rs1) >= signed(rs2)) target = pc + decoded.imm;
  } else if (m === "bltu") {
    if (u32(rs1) < u32(rs2)) target = pc + decoded.imm;
  } else if (m === "bgeu") {
    if (u32(rs1) >= u32(rs2)) target = pc + decoded.imm;
  } else if (m === "jal") {
    wb = pc + 4;
    target = pc + decoded.imm;
  } else if (m === "jalr") {
    wb = pc + 4;
    target = (rs1 + decoded.imm) & ~1;
  } else if (m === "lui") wb = decoded.imm;
  else if (m === "auipc") wb = u32(pc + decoded.imm);
  if (wb !== null) next.regs = writeX(next.regs, decoded.rd, wb);
  next.regs[0] = 0;
  next.pc = u32(target);
  next.retired += 1;
  next.trace.push(`${decoded.text} @ ${pc}`);
  if (next.pc >= RV_MEM_BYTES) {
    next.halted = true;
    next.error = "Memory address out of range";
  }
  return next;
}

export function runRv(source: string, limit = 400): RvState {
  const loaded = loadRv(source);
  if ("ok" in loaded) {
    const failed = blankRv();
    failed.error = loaded.error;
    failed.halted = true;
    return failed;
  }
  let state = loaded;
  let guard = 0;
  while (!state.halted && guard < limit) {
    const before = state.pc;
    state = stepRv(state);
    if (state.pc === before && state.decoded?.mnemonic !== "jal" && state.decoded?.mnemonic !== "beq" && state.decoded?.mnemonic !== "bne" && state.decoded?.mnemonic !== "jalr") {
      /* continue */
    }
    guard += 1;
  }
  return state;
}

export function datapathNodes(decoded: RvDecoded | null): string[] {
  if (!decoded) return ["pc", "imem"];
  const nodes = ["pc", "imem", "decode", "regs"];
  if (decoded.format === "I" || decoded.format === "S" || decoded.format === "B" || decoded.format === "U" || decoded.format === "J") nodes.push("immgen");
  nodes.push("alu");
  if (decoded.mnemonic === "lw" || decoded.mnemonic === "sw") nodes.push("dmem");
  if (decoded.format === "B") nodes.push("branch");
  if (decoded.mnemonic === "jal" || decoded.mnemonic === "jalr") nodes.push("jump");
  if (decoded.rd !== 0 && decoded.mnemonic !== "sw" && decoded.mnemonic !== "beq" && decoded.mnemonic !== "bne") nodes.push("wb");
  nodes.push("pcnext");
  return nodes;
}

export function immBits(format: RvFormat, word: number): Array<{ src: string; dst: string; value: 0 | 1 }> {
  const w = toBin32(word);
  const bit = (index: number) => (w[31 - index] === "1" ? 1 : 0) as 0 | 1;
  if (format === "I") return Array.from({ length: 12 }, (_, i) => ({ src: `inst[${20 + i}]`, dst: `imm[${i}]`, value: bit(20 + i) }));
  if (format === "S") {
    const low = Array.from({ length: 5 }, (_, i) => ({ src: `inst[${7 + i}]`, dst: `imm[${i}]`, value: bit(7 + i) }));
    const high = Array.from({ length: 7 }, (_, i) => ({ src: `inst[${25 + i}]`, dst: `imm[${5 + i}]`, value: bit(25 + i) }));
    return [...low, ...high];
  }
  if (format === "B") {
    return [
      { src: "0", dst: "imm[0]", value: 0 },
      ...Array.from({ length: 4 }, (_, i) => ({ src: `inst[${8 + i}]`, dst: `imm[${1 + i}]`, value: bit(8 + i) })),
      ...Array.from({ length: 6 }, (_, i) => ({ src: `inst[${25 + i}]`, dst: `imm[${5 + i}]`, value: bit(25 + i) })),
      { src: "inst[7]", dst: "imm[11]", value: bit(7) },
      { src: "inst[31]", dst: "imm[12]", value: bit(31) },
    ];
  }
  if (format === "U") return Array.from({ length: 20 }, (_, i) => ({ src: `inst[${12 + i}]`, dst: `imm[${12 + i}]`, value: bit(12 + i) }));
  return [
    { src: "0", dst: "imm[0]", value: 0 },
    ...Array.from({ length: 10 }, (_, i) => ({ src: `inst[${21 + i}]`, dst: `imm[${1 + i}]`, value: bit(21 + i) })),
    { src: "inst[20]", dst: "imm[11]", value: bit(20) },
    ...Array.from({ length: 8 }, (_, i) => ({ src: `inst[${12 + i}]`, dst: `imm[${12 + i}]`, value: bit(12 + i) })),
    { src: "inst[31]", dst: "imm[20]", value: bit(31) },
  ];
}

export function hazardTrace(forwarding: boolean): { rows: Array<{ text: string; cells: string[] }>; stalls: number; forwards: number } {
  const inst = ["lw x1, 0(x0)", "add x2, x1, x3", "add x4, x2, x5"];
  const stalls = forwarding ? 1 : 2;
  const forwards = forwarding ? 2 : 0;
  const rows = inst.map((text, index) => {
    const cells = Array.from({ length: 8 }, () => "");
    const start = index === 0 ? 0 : index === 1 ? 1 + stalls : 2 + stalls;
    ["IF", "ID", "EX", "MEM", "WB"].forEach((stage, s) => {
      cells[start + s] = stage;
    });
    if (index === 1 && stalls > 0) cells[start - 1] = "stall";
    return { text, cells };
  });
  return { rows, stalls, forwards };
}

export { toHex32, toBin32 };
