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

const FUNCT: Record<number, string> = {
  0x00: "sll", 0x02: "srl", 0x03: "sra", 0x08: "jr", 0x0c: "syscall",
  0x20: "add", 0x21: "addu", 0x22: "sub", 0x23: "subu", 0x24: "and", 0x25: "or", 0x26: "xor", 0x27: "nor", 0x2a: "slt", 0x2b: "sltu",
};
const IOP: Record<number, string> = {
  0x04: "beq", 0x05: "bne", 0x08: "addi", 0x09: "addiu", 0x0a: "slti", 0x0b: "sltiu", 0x0c: "andi", 0x0d: "ori", 0x0e: "xori", 0x0f: "lui",
  0x20: "lb", 0x21: "lh", 0x23: "lw", 0x24: "lbu", 0x25: "lhu", 0x28: "sb", 0x29: "sh", 0x2b: "sw",
};

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
  } else if (opcode === 2 || opcode === 3) {
    format = "J";
    mnemonic = opcode === 2 ? "j" : "jal";
  } else {
    format = "I";
    mnemonic = IOP[opcode] ?? "unknown";
  }
  const memOp = ["lb", "lbu", "lh", "lhu", "lw", "sb", "sh", "sw"].includes(mnemonic);
  const text = mnemonic === "syscall" ? "syscall"
    : mnemonic === "jr" ? `jr $${rs}`
      : mnemonic === "sll" || mnemonic === "srl" || mnemonic === "sra" ? `${mnemonic} $${rd}, $${rt}, ${shamt}`
        : format === "R" ? `${mnemonic} $${rd}, $${rs}, $${rt}`
          : memOp ? `${mnemonic} $${rt}, ${imm}($${rs})`
            : mnemonic === "beq" || mnemonic === "bne" ? `${mnemonic} $${rs}, $${rt}, ${imm}`
              : mnemonic === "lui" ? `lui $${rt}, ${imm & 0xffff}`
                : format === "J" ? `${mnemonic} ${target}`
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
  if (op === "xor") return (a ^ b) >>> 0;
  if (op === "nor") return (~(a | b)) >>> 0;
  if (op === "slt") return (a | 0) < (b | 0) ? 1 : 0;
  if (op === "sltu") return (a >>> 0) < (b >>> 0) ? 1 : 0;
  if (op === "sll") return (a << (b & 31)) >>> 0;
  if (op === "srl") return (a >>> 0) >>> (b & 31);
  if (op === "sra") return ((a | 0) >> (b & 31)) >>> 0;
  return u32(a + b);
}

const REG_NUM: Record<string, number> = {
  zero: 0, at: 1, v0: 2, v1: 3, a0: 4, a1: 5, a2: 6, a3: 7,
  t0: 8, t1: 9, t2: 10, t3: 11, t4: 12, t5: 13, t6: 14, t7: 15,
  s0: 16, s1: 17, s2: 18, s3: 19, s4: 20, s5: 21, s6: 22, s7: 23,
  t8: 24, t9: 25, k0: 26, k1: 27, gp: 28, sp: 29,   fp: 30, s8: 30, ra: 31,
};

export const MIPS_NAMES = ["$zero", "$at", "$v0", "$v1", "$a0", "$a1", "$a2", "$a3", "$t0", "$t1", "$t2", "$t3", "$t4", "$t5", "$t6", "$t7", "$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7", "$t8", "$t9", "$k0", "$k1", "$gp", "$sp", "$fp", "$ra"];

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
  const rType: Record<string, number> = { add: 0x20, addu: 0x21, sub: 0x22, subu: 0x23, and: 0x24, or: 0x25, xor: 0x26, nor: 0x27, slt: 0x2a, sltu: 0x2b };
  if (rType[mnemonic] !== undefined) {
    const rd = parseMipsReg(parts[1] ?? "");
    const rs = parseMipsReg(parts[2] ?? "");
    const rt = parseMipsReg(parts[3] ?? "");
    if (rd === null || rs === null || rt === null) return { error: "Use $t0-style names or $0–$31." };
    return decodeMips(encodeR(rs, rt, rd, rType[mnemonic] ?? 0x20));
  }
  if (mnemonic === "sll" || mnemonic === "srl" || mnemonic === "sra") {
    const rd = parseMipsReg(parts[1] ?? "");
    const rt = parseMipsReg(parts[2] ?? "");
    const shamt = Number(parts[3]);
    const funct = mnemonic === "sll" ? 0 : mnemonic === "srl" ? 2 : 3;
    if (rd === null || rt === null || !Number.isFinite(shamt)) return { error: "Shift needs $rd, $rt, shamt." };
    return decodeMips(encodeR(0, rt, rd, funct, shamt & 31));
  }
  if (mnemonic === "jr") {
    const rs = parseMipsReg(parts[1] ?? "");
    if (rs === null) return { error: "jr needs a register." };
    return decodeMips(encodeR(rs, 0, 0, 0x08));
  }
  if (mnemonic === "syscall" || mnemonic === "nop") {
    return decodeMips(mnemonic === "nop" ? encodeR(0, 0, 0, 0) : encodeR(0, 0, 0, 0x0c));
  }
  if (["lb", "lbu", "lh", "lhu", "lw", "sb", "sh", "sw"].includes(mnemonic)) {
    const rt = parseMipsReg(parts[1] ?? "");
    const mem = (parts[2] ?? "").match(/^(-?\d+)\(([^)]+)\)$/);
    const rs = parseMipsReg(mem?.[2] ?? "");
    const imm = Number(mem?.[1]);
    if (rt === null || rs === null || !Number.isFinite(imm)) return { error: "Use lw/sw $rt, imm($rs)." };
    const op: Record<string, number> = { lb: 0x20, lh: 0x21, lw: 0x23, lbu: 0x24, lhu: 0x25, sb: 0x28, sh: 0x29, sw: 0x2b };
    return decodeMips(encodeI(op[mnemonic] ?? 0x23, rs, rt, imm));
  }
  if (mnemonic === "lui") {
    const rt = parseMipsReg(parts[1] ?? "");
    const imm = Number(parts[2]);
    if (rt === null || !Number.isFinite(imm)) return { error: "lui needs $rt, imm." };
    return decodeMips(encodeI(0x0f, 0, rt, imm));
  }
  if (mnemonic === "beq" || mnemonic === "bne" || mnemonic === "addi") {
    const a = parseMipsReg(parts[1] ?? "");
    const b = parseMipsReg(parts[2] ?? "");
    const imm = Number(parts[3]);
    if (a === null || b === null || !Number.isFinite(imm)) return { error: "Malformed I-type operands." };
    const opcode = mnemonic === "addi" ? 0x08 : mnemonic === "beq" ? 0x04 : 0x05;
    return decodeMips(encodeI(opcode, mnemonic === "addi" ? b : a, mnemonic === "addi" ? a : b, imm));
  }
  if (mnemonic === "j" || mnemonic === "jal") {
    const target = Number(parts[1]);
    if (!Number.isFinite(target)) return { error: "Jump needs a word target or a label resolved by the assembler." };
    return decodeMips(encodeJ(mnemonic === "jal" ? 3 : 2, target));
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

export const MIPS_MEM = 1024;

export interface MipsCpu {
  pc: number;
  regs: number[];
  mem: Uint8Array;
  ir: number;
  cycles: number;
  retired: number;
  halted: boolean;
  console: string[];
  trace: string[];
  error: string | null;
  decoded: MipsDecoded | null;
}

export function blankMips(): MipsCpu {
  const regs = Array.from({ length: 32 }, () => 0);
  regs[29] = MIPS_MEM - 4;
  return { pc: 0, regs, mem: new Uint8Array(MIPS_MEM), ir: 0, cycles: 0, retired: 0, halted: false, console: [], trace: [], error: null, decoded: null };
}

export function writeMipsReg(regs: number[], index: number, value: number): number[] {
  const next = regs.slice();
  if (index !== 0) next[index] = u32(value);
  next[0] = 0;
  return next;
}

export function readWord(mem: Uint8Array, addr: number): number | string {
  if (addr < 0 || addr + 3 >= mem.length || addr % 4 !== 0) return "Address is out of range or not word-aligned.";
  return (((mem[addr] ?? 0) << 24) | ((mem[addr + 1] ?? 0) << 16) | ((mem[addr + 2] ?? 0) << 8) | (mem[addr + 3] ?? 0)) >>> 0;
}

export function writeWord(mem: Uint8Array, addr: number, value: number): string | null {
  if (addr < 0 || addr + 3 >= mem.length || addr % 4 !== 0) return "Address is out of range or not word-aligned.";
  mem[addr] = (value >>> 24) & 0xff;
  mem[addr + 1] = (value >>> 16) & 0xff;
  mem[addr + 2] = (value >>> 8) & 0xff;
  mem[addr + 3] = value & 0xff;
  return null;
}

export interface MipsListing { line: number; pc: number; source: string; word: number; expanded: string }

export function assembleMips(source: string): { ok: true; words: number[]; listing: MipsListing[] } | { ok: false; errors: Array<{ line: number; message: string }> } {
  const errors: Array<{ line: number; message: string }> = [];
  const labels: Record<string, number> = {};
  const pending: Array<{ line: number; text: string }> = [];
  let pc = 0;
  source.split(/\r?\n/).forEach((original, index) => {
    const line = index + 1;
    let text = (original.split(/[#;]/)[0] ?? "").trim();
    if (!text) return;
    const labeled = text.match(/^([A-Za-z_]\w*):(?:\s*(.*))?$/);
    if (labeled) {
      labels[(labeled[1] ?? "").toLowerCase()] = pc;
      text = (labeled[2] ?? "").trim();
      if (!text) return;
    }
    pending.push({ line, text });
    pc += 4;
  });
  const words: number[] = [];
  const listing: MipsListing[] = [];
  pending.forEach((item, index) => {
    const address = index * 4;
    const resolved = resolveMips(item.text, address, labels);
    const parsed = parseMipsAsm(resolved.text);
    if ("error" in parsed) {
      errors.push({ line: item.line, message: parsed.error });
      return;
    }
    words.push(parsed.word);
    listing.push({ line: item.line, pc: address, source: item.text, word: parsed.word, expanded: resolved.text });
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, words, listing };
}

function resolveMips(text: string, pc: number, labels: Record<string, number>): { text: string } {
  const parts = text.split(/[\s,]+/).filter(Boolean);
  const mnemonic = (parts[0] ?? "").toLowerCase();
  const labelOf = (token: string) => labels[token.toLowerCase()];
  if (mnemonic === "move" && parts.length === 3) return { text: `add ${parts[1]}, ${parts[2]}, $zero` };
  if (mnemonic === "li" && parts.length === 3) return { text: `addi ${parts[1]}, $zero, ${parts[2]}` };
  if ((mnemonic === "b" || mnemonic === "beq" || mnemonic === "bne" || mnemonic === "blt" || mnemonic === "ble" || mnemonic === "bgt" || mnemonic === "bge") && parts.length >= 2) {
    const target = parts[parts.length - 1] ?? "";
    const found = labelOf(target);
    if (found !== undefined) {
      const offset = (found - (pc + 4)) >> 2;
      if (mnemonic === "b") return { text: `beq $zero, $zero, ${offset}` };
      if (mnemonic === "blt") return { text: `slt $at, ${parts[1]}, ${parts[2]}` };
      const head = parts.slice(0, -1).join(", ");
      return { text: `${head}, ${offset}` };
    }
  }
  if ((mnemonic === "j" || mnemonic === "jal") && parts[1] && labelOf(parts[1]) !== undefined) {
    return { text: `${mnemonic} ${(labelOf(parts[1] ?? "") ?? 0) >> 2}` };
  }
  return { text };
}

export function loadMips(source: string): MipsCpu | { ok: false; error: string } {
  const built = assembleMips(source);
  if (!built.ok) return { ok: false, error: built.errors.map((item) => `Line ${item.line}: ${item.message}`).join("\n") };
  const cpu = blankMips();
  built.words.forEach((word, index) => writeWord(cpu.mem, index * 4, word));
  return cpu;
}

export function stepMips(cpu: MipsCpu): MipsCpu {
  if (cpu.halted) return cpu;
  const next: MipsCpu = { ...cpu, regs: cpu.regs.slice(), mem: cpu.mem.slice(), console: cpu.console.slice(), trace: cpu.trace.slice() };
  next.cycles += 1;
  const fetched = readWord(next.mem, next.pc);
  if (typeof fetched !== "number") {
    next.error = fetched;
    next.halted = true;
    return next;
  }
  if (fetched === 0 && next.retired > 0) {
    next.halted = true;
    next.trace.push("Stop: following word is 0.");
    return next;
  }
  next.ir = fetched;
  const decoded = decodeMips(fetched);
  next.decoded = decoded;
  if (decoded.mnemonic === "unknown") {
    next.error = "Unsupported opcode in this MIPS32 teaching subset.";
    next.halted = true;
    return next;
  }
  const rs = next.regs[decoded.rs] ?? 0;
  const rt = next.regs[decoded.rt] ?? 0;
  const pc = next.pc;
  let target = pc + 4;
  let wb: number | null = null;
  let dest = decoded.rd;
  const m = decoded.mnemonic;
  if (m === "add" || m === "addu") wb = u32(rs + rt);
  else if (m === "sub" || m === "subu") wb = u32(rs - rt);
  else if (m === "and") wb = rs & rt;
  else if (m === "or") wb = rs | rt;
  else if (m === "xor") wb = rs ^ rt;
  else if (m === "nor") wb = ~(rs | rt);
  else if (m === "slt") wb = (rs | 0) < (rt | 0) ? 1 : 0;
  else if (m === "sltu") wb = (rs >>> 0) < (rt >>> 0) ? 1 : 0;
  else if (m === "sll") { wb = u32(rt << decoded.shamt); }
  else if (m === "srl") wb = (rt >>> 0) >>> decoded.shamt;
  else if (m === "sra") wb = ((rt | 0) >> decoded.shamt) >>> 0;
  else if (m === "jr") target = rs;
  else if (m === "addi" || m === "addiu") { wb = u32(rs + decoded.imm); dest = decoded.rt; }
  else if (m === "andi") { wb = rs & (decoded.imm & 0xffff); dest = decoded.rt; }
  else if (m === "ori") { wb = rs | (decoded.imm & 0xffff); dest = decoded.rt; }
  else if (m === "xori") { wb = rs ^ (decoded.imm & 0xffff); dest = decoded.rt; }
  else if (m === "slti") { wb = (rs | 0) < decoded.imm ? 1 : 0; dest = decoded.rt; }
  else if (m === "lui") { wb = (decoded.imm & 0xffff) << 12; dest = decoded.rt; }
  else if (m === "lw") {
    const loaded = readWord(next.mem, u32(rs + decoded.imm));
    if (typeof loaded !== "number") { next.error = loaded; next.halted = true; return next; }
    wb = loaded;
    dest = decoded.rt;
  } else if (m === "sw") {
    const fault = writeWord(next.mem, u32(rs + decoded.imm), rt);
    if (fault) { next.error = fault; next.halted = true; return next; }
  } else if (m === "beq") { if (rs === rt) target = branchTarget(pc, decoded.imm); }
  else if (m === "bne") { if (rs !== rt) target = branchTarget(pc, decoded.imm); }
  else if (m === "j") target = jumpTarget(pc, decoded.target);
  else if (m === "jal") { wb = pc + 4; dest = 31; target = jumpTarget(pc, decoded.target); }
  else if (m === "syscall") {
    const service = next.regs[2] ?? 0;
    const arg = next.regs[4] ?? 0;
    if (service === 1) next.console.push(String(arg | 0));
    else if (service === 11) next.console.push(String.fromCharCode(arg & 0xff));
    else if (service === 4) {
      let text = "";
      for (let i = arg; i < next.mem.length && next.mem[i] !== 0; i += 1) text += String.fromCharCode(next.mem[i] ?? 0);
      next.console.push(text);
    } else if (service === 10) next.halted = true;
    else next.console.push(`syscall ${service}`);
  }
  if (wb !== null) next.regs = writeMipsReg(next.regs, dest, wb);
  next.regs[0] = 0;
  next.pc = u32(target);
  next.retired += 1;
  next.trace.push(`${decoded.text} @ ${toHex32(pc)}`);
  return next;
}

export function mipsPipe(lines: string[], forwarding: boolean): { grid: string[][]; cycles: number; stalls: number; notes: string[] } {
  const parsed = lines.map((line) => parseMipsAsm(line.trim())).filter((item): item is MipsDecoded => !("error" in item));
  const writes = parsed.map((item) => item.format === "I" && item.mnemonic !== "beq" && item.mnemonic !== "bne" && item.mnemonic !== "sw" && item.mnemonic !== "sb" && item.mnemonic !== "sh" ? item.rt : item.format === "J" && item.mnemonic === "jal" ? 31 : item.format === "R" && item.mnemonic !== "jr" && item.mnemonic !== "syscall" ? item.rd : -1);
  const reads = parsed.map((item) => [item.rs, item.rt].filter((reg) => reg !== 0));
  const start: number[] = [];
  const notes: string[] = [];
  let stalls = 0;
  parsed.forEach((_, index) => {
    let at = index === 0 ? 0 : (start[index - 1] ?? 0) + 1;
    const producer = index > 0 ? writes[index - 1] ?? -1 : -1;
    if (producer > 0 && (reads[index] ?? []).includes(producer)) {
      const load = parsed[index - 1]?.mnemonic === "lw";
      const penalty = forwarding ? (load ? 1 : 0) : 2;
      if (penalty > 0) {
        stalls += penalty;
        at += penalty;
        notes.push(`${parsed[index]?.text ?? "next"} waits on $${producer}${load ? " (load-use)" : forwarding ? "" : " (no forwarding)"}.`);
      }
    }
    start.push(at);
  });
  const cycles = parsed.length === 0 ? 0 : (start[parsed.length - 1] ?? 0) + 5;
  const grid = parsed.map((_, index) => {
    const row = Array.from({ length: cycles }, () => "");
    ["IF", "ID", "EX", "MEM", "WB"].forEach((stage, offset) => { row[(start[index] ?? 0) + offset] = stage; });
    return row;
  });
  return { grid, cycles, stalls, notes };
}
