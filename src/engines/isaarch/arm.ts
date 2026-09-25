import { u32 } from "./bits";
import { vectorAdd } from "../arch/parallel";

export const ARM_REGS = Array.from({ length: 31 }, (_, index) => ({
  id: `X${index}`,
  role: index === 30 ? "Link register (LR / X30) in this teaching view" : "General-purpose 64-bit register (teaching AArch64 view)",
}));

export type ArmMnemonic = "ADD" | "SUB" | "LDR" | "STR" | "B" | "BL" | "RET" | "MOV";

export interface ArmState {
  x: number[];
  sp: number;
  pc: number;
  lr: number;
  flags: { n: 0 | 1; z: 0 | 1; c: 0 | 1; v: 0 | 1 };
  mem: number[];
  trace: string[];
}

export function blankArm(): ArmState {
  return { x: Array.from({ length: 31 }, () => 0), sp: 0x100, pc: 0, lr: 0, flags: { n: 0, z: 1, c: 0, v: 0 }, mem: Array.from({ length: 64 }, () => 0), trace: [] };
}

function flagsFrom(result: number, a: number, b: number, sub: boolean): ArmState["flags"] {
  const r = result | 0;
  const aa = a | 0;
  const bb = b | 0;
  const n = r < 0 ? 1 : 0;
  const z = r === 0 ? 1 : 0;
  const unsigned = sub ? u32(a) < u32(b) : u32(a) + u32(b) > 0xffffffff;
  const c = unsigned ? (sub ? 0 : 1) : (sub ? 1 : 0);
  const v = sub ? ((aa < 0) !== (bb < 0) && (r < 0) !== (aa < 0) ? 1 : 0) : ((aa < 0) === (bb < 0) && (r < 0) !== (aa < 0) ? 1 : 0);
  return { n, z, c, v };
}

export function stepArm(state: ArmState, op: ArmMnemonic, rd: number, rn: number, rm: number, imm = 0): ArmState {
  const next: ArmState = { ...state, x: state.x.slice(), mem: state.mem.slice(), flags: { ...state.flags }, trace: state.trace.slice() };
  const a = next.x[rn] ?? 0;
  const b = op === "MOV" || op === "LDR" || op === "STR" || op === "ADD" && imm !== 0 && rm < 0 ? imm : (next.x[rm] ?? 0);
  if (op === "ADD") {
    const result = u32(a + (rm < 0 ? imm : b));
    if (rd >= 0 && rd < 31) next.x[rd] = result;
    next.flags = flagsFrom(result, a, rm < 0 ? imm : b, false);
    next.trace.push(`ADD X${rd}, X${rn}, ${rm < 0 ? `#${imm}` : `X${rm}`}`);
  } else if (op === "SUB") {
    const result = u32(a - b);
    if (rd >= 0 && rd < 31) next.x[rd] = result;
    next.flags = flagsFrom(result, a, b, true);
    next.trace.push(`SUB X${rd}, X${rn}, X${rm}`);
  } else if (op === "MOV") {
    if (rd >= 0 && rd < 31) next.x[rd] = u32(imm);
    next.trace.push(`MOV X${rd}, #${imm}`);
  } else if (op === "LDR") {
    const addr = u32(a + imm);
    const word = next.mem[addr] ?? 0;
    if (rd >= 0 && rd < 31) next.x[rd] = word;
    next.trace.push(`LDR X${rd}, [X${rn}, #${imm}]  EA=${addr}`);
  } else if (op === "STR") {
    const addr = u32(a + imm);
    if (addr >= 0 && addr < next.mem.length) next.mem[addr] = next.x[rd] ?? 0;
    next.trace.push(`STR X${rd}, [X${rn}, #${imm}]  EA=${addr}`);
  } else if (op === "B") {
    next.pc = imm;
    next.trace.push(`B ${imm}`);
    return next;
  } else if (op === "BL") {
    next.lr = next.pc + 4;
    next.x[30] = next.lr;
    next.pc = imm;
    next.trace.push(`BL ${imm}  LR=${next.lr}`);
    return next;
  } else if (op === "RET") {
    next.pc = next.lr || (next.x[30] ?? 0);
    next.trace.push(`RET to ${next.pc}`);
    return next;
  }
  next.pc += 4;
  return next;
}

export function neonAdd(left: number[], right: number[]): number[] {
  return vectorAdd(left, right);
}

export const EL_LEVELS = [
  { id: "EL0", title: "Application", note: "User programs run here in the teaching model." },
  { id: "EL1", title: "OS kernel", note: "Typical operating-system privilege." },
  { id: "EL2", title: "Hypervisor", note: "Optional virtualization layer." },
  { id: "EL3", title: "Secure monitor", note: "Highest conceptual exception level in AArch64." },
];

export const ARM_SOC_BLOCKS = ["CPU cluster", "GPU", "NPU", "ISP", "DSP", "Memory", "I/O"];

const MASK64 = (1n << 64n) - 1n;

export function xName(index: number): string {
  if (index === 29) return "X29 / FP";
  if (index === 30) return "X30 / LR";
  return `X${index}`;
}

export function writeWn(regs: bigint[], index: number, value: number): bigint[] {
  const next = regs.slice();
  if (index >= 0 && index < 31) next[index] = BigInt(value >>> 0);
  return next;
}

export function writeXn(regs: bigint[], index: number, value: bigint): bigint[] {
  const next = regs.slice();
  if (index >= 0 && index < 31) next[index] = value & MASK64;
  return next;
}

export function encodeAddReg(rd: number, rn: number, rm: number, sets = false): number {
  return (0x8b000000 | (sets ? 0x20000000 : 0) | ((rm & 31) << 16) | ((rn & 31) << 5) | (rd & 31)) >>> 0;
}

export function encodeSubReg(rd: number, rn: number, rm: number, sets = false): number {
  return (encodeAddReg(rd, rn, rm, sets) | 0x40000000) >>> 0;
}

export function encodeLdr(rt: number, rn: number, byteOffset: number): number {
  const imm12 = (byteOffset / 8) & 0xfff;
  return (0xf9400000 | (imm12 << 10) | ((rn & 31) << 5) | (rt & 31)) >>> 0;
}

export function encodeStr(rt: number, rn: number, byteOffset: number): number {
  return (encodeLdr(rt, rn, byteOffset) & ~0x00400000) >>> 0;
}

export function encodeB(wordOffset: number): number {
  return (0x14000000 | (wordOffset & 0x03ffffff)) >>> 0;
}

export function encodeBl(wordOffset: number): number {
  return (0x94000000 | (wordOffset & 0x03ffffff)) >>> 0;
}

export interface A64Decoded { mnemonic: string; word: number; rd: number; rn: number; rm: number; imm: number; sets: boolean; text: string }

export function decodeA64(word: number): A64Decoded {
  const w = word >>> 0;
  const rd = w & 31;
  const rn = (w >>> 5) & 31;
  const rm = (w >>> 16) & 31;
  const sets = ((w >>> 29) & 1) === 1;
  const dataOp = (w & 0xffe0fc00) >>> 0;
  if (dataOp === 0x8b000000 || dataOp === 0xab000000 || dataOp === 0xcb000000 || dataOp === 0xeb000000) {
    const sub = (w & 0x40000000) !== 0;
    const mnemonic = sub ? (sets ? "SUBS" : "SUB") : (sets ? "ADDS" : "ADD");
    return { mnemonic, word: w, rd, rn, rm, imm: 0, sets, text: `${mnemonic} X${rd}, X${rn}, X${rm}` };
  }
  if (((w & 0xffc00000) >>> 0) === 0xf9400000) {
    const imm = ((w >>> 10) & 0xfff) * 8;
    return { mnemonic: "LDR", word: w, rd, rn, rm: 0, imm, sets: false, text: `LDR X${rd}, [X${rn}, #${imm}]` };
  }
  if (((w & 0xffc00000) >>> 0) === 0xf9000000) {
    const imm = ((w >>> 10) & 0xfff) * 8;
    return { mnemonic: "STR", word: w, rd, rn, rm: 0, imm, sets: false, text: `STR X${rd}, [X${rn}, #${imm}]` };
  }
  if (((w & 0xfc000000) >>> 0) === 0x14000000) {
    let off = w & 0x03ffffff;
    if (off & 0x02000000) off -= 0x04000000;
    return { mnemonic: "B", word: w, rd: 0, rn: 0, rm: 0, imm: off, sets: false, text: `B ${off}` };
  }
  if (((w & 0xfc000000) >>> 0) === 0x94000000) {
    let off = w & 0x03ffffff;
    if (off & 0x02000000) off -= 0x04000000;
    return { mnemonic: "BL", word: w, rd: 0, rn: 0, rm: 0, imm: off, sets: false, text: `BL ${off}` };
  }
  if (w === 0xd65f03c0) return { mnemonic: "RET", word: w, rd: 0, rn: 30, rm: 0, imm: 0, sets: false, text: "RET" };
  if (w === 0xd503201f) return { mnemonic: "NOP", word: w, rd: 0, rn: 0, rm: 0, imm: 0, sets: false, text: "NOP" };
  if ((w & 0xffe0001f) === 0xd4000001) return { mnemonic: "SVC", word: w, rd: 0, rn: 0, rm: 0, imm: (w >>> 5) & 0xffff, sets: false, text: `SVC #${(w >>> 5) & 0xffff}` };
  return { mnemonic: "unknown", word: w, rd, rn, rm, imm: 0, sets: false, text: "unknown" };
}

export interface A64Cpu {
  x: bigint[];
  sp: bigint;
  pc: number;
  flags: { n: 0 | 1; z: 0 | 1; c: 0 | 1; v: 0 | 1 };
  mem: Uint8Array;
  el: 0 | 1 | 2 | 3;
  elr: number;
  spsr: number;
  esr: number;
  vbar: number;
  console: string[];
  halted: boolean;
  cycles: number;
  retired: number;
  ir: number;
  trace: string[];
  decoded: A64Decoded | null;
}

export function blankA64(): A64Cpu {
  return {
    x: Array.from({ length: 31 }, () => 0n), sp: 0x400n, pc: 0, flags: { n: 0, z: 1, c: 0, v: 0 }, mem: new Uint8Array(512),
    el: 0, elr: 0, spsr: 0, esr: 0, vbar: 0x200, console: [], halted: false, cycles: 0, retired: 0, ir: 0, trace: [], decoded: null,
  };
}

function regOf(token: string): number | null {
  const text = token.toLowerCase().replace(/,$/, "");
  if (text === "sp") return 31;
  if (text === "lr") return 30;
  if (text === "fp") return 29;
  if (text === "xzr" || text === "wzr") return 32;
  const match = text.match(/^[xw](\d+)$/);
  if (!match) return null;
  const index = Number(match[1]);
  return index >= 0 && index <= 30 ? index : null;
}

export function assembleA64(source: string): { ok: true; words: number[]; listing: string[] } | { ok: false; errors: string[] } {
  const labels: Record<string, number> = {};
  const lines: string[] = [];
  source.split(/\r?\n/).forEach((raw) => {
    const text = (raw.split("//")[0] ?? "").trim();
    if (!text) return;
    const labeled = text.match(/^([A-Za-z_]\w*):(?:\s*(.*))?$/);
    if (labeled) {
      labels[(labeled[1] ?? "").toLowerCase()] = lines.length * 4;
      if ((labeled[2] ?? "").trim()) lines.push((labeled[2] ?? "").trim());
      return;
    }
    lines.push(text);
  });
  const words: number[] = [];
  const listing: string[] = [];
  const errors: string[] = [];
  lines.forEach((text, index) => {
    const parts = text.split(/[\s,]+/).filter(Boolean);
    const op = (parts[0] ?? "").toUpperCase();
    const pc = index * 4;
    const labelAt = (token: string) => labels[token.toLowerCase()];
    let word = 0;
    if (op === "ADD" || op === "ADDS" || op === "SUB" || op === "SUBS" || op === "CMP") {
      const rd = op === "CMP" ? 31 : regOf(parts[1] ?? "");
      const rn = regOf(parts[op === "CMP" ? 1 : 2] ?? "");
      const src = parts[op === "CMP" ? 2 : 3] ?? "";
      const rm = src.startsWith("#") ? -1 : regOf(src);
      if (rd === null || rn === null || (rm === null && !src.startsWith("#"))) { errors.push(`Line ${index + 1}: ${text}`); return; }
      const sets = op.endsWith("S") || op === "CMP";
      word = op.startsWith("SUB") || op === "CMP" ? encodeSubReg(rd === 32 || rd === 31 ? 31 : rd, rn === 32 ? 31 : rn, rm === null || rm < 0 ? 31 : rm, sets) : encodeAddReg(rd === 32 ? 31 : rd, rn === 32 ? 31 : rn, rm === null || rm < 0 ? 31 : rm, sets);
    } else if (op === "LDR" || op === "STR") {
      const rt = regOf(parts[1] ?? "");
      const mem = text.match(/\[(X\d+|SP)\s*,\s*#(-?\d+)\]/i);
      if (rt === null || !mem) { errors.push(`Line ${index + 1}: use LDR Xt, [Xn, #imm]`); return; }
      const rn = regOf(mem[1] ?? "");
      if (rn === null) { errors.push(`Line ${index + 1}: bad base`); return; }
      word = op === "LDR" ? encodeLdr(rt, rn, Number(mem[2])) : encodeStr(rt, rn, Number(mem[2]));
    } else if (op === "B" || op === "BL") {
      const target = parts[1] ?? "";
      const found = labelAt(target);
      const off = found === undefined ? Number(target) : (found - pc) >> 2;
      if (!Number.isFinite(off)) { errors.push(`Line ${index + 1}: bad branch`); return; }
      word = op === "B" ? encodeB(off) : encodeBl(off);
    } else if (op === "RET") word = 0xd65f03c0;
    else if (op === "NOP") word = 0xd503201f;
    else if (op === "SVC") word = (0xd4000001 | ((Number(parts[1]?.replace("#", "")) || 0) << 5)) >>> 0;
    else if (op === "MOV") {
      const rd = regOf(parts[1] ?? "");
      const imm = Number((parts[2] ?? "").replace("#", ""));
      if (rd === null || !Number.isFinite(imm)) { errors.push(`Line ${index + 1}: MOV`); return; }
      word = encodeAddReg(rd, 31, 31);
    } else { errors.push(`Line ${index + 1}: unsupported ${op}`); return; }
    words.push(word);
    listing.push(decodeA64(word).text);
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, words, listing };
}

function read64(mem: Uint8Array, addr: number): bigint | string {
  if (addr < 0 || addr + 7 >= mem.length || addr % 8 !== 0) return "Address is out of range or not 8-byte aligned.";
  let value = 0n;
  for (let i = 0; i < 8; i += 1) value |= BigInt(mem[addr + i] ?? 0) << BigInt(8 * i);
  return value;
}

function write64(mem: Uint8Array, addr: number, value: bigint): string | null {
  if (addr < 0 || addr + 7 >= mem.length || addr % 8 !== 0) return "Address is out of range or not 8-byte aligned.";
  for (let i = 0; i < 8; i += 1) mem[addr + i] = Number((value >> BigInt(8 * i)) & 0xffn);
  return null;
}

function gpr(cpu: A64Cpu, index: number): bigint {
  if (index === 31 || index === 32) return 0n;
  return cpu.x[index] ?? 0n;
}

export function stepA64(cpu: A64Cpu): A64Cpu {
  if (cpu.halted) return cpu;
  const next: A64Cpu = { ...cpu, x: cpu.x.slice(), mem: cpu.mem.slice(), flags: { ...cpu.flags }, console: cpu.console.slice(), trace: cpu.trace.slice() };
  next.cycles += 1;
  const word = read32(next.mem, next.pc);
  if (typeof word !== "number" || word === 0) { next.halted = true; next.trace.push("Stop."); return next; }
  const decoded = decodeA64(word);
  next.ir = word;
  next.decoded = decoded;
  if (decoded.mnemonic === "unknown") { next.halted = true; next.trace.push("Unsupported opcode."); return next; }
  const rn = gpr(next, decoded.rn);
  const rm = gpr(next, decoded.rm);
  let pc = next.pc + 4;
  if (decoded.mnemonic === "ADD" || decoded.mnemonic === "ADDS" || decoded.mnemonic === "SUB" || decoded.mnemonic === "SUBS") {
    const sub = decoded.mnemonic.startsWith("SUB");
    const result = sub ? (rn - rm) & MASK64 : (rn + rm) & MASK64;
    if (decoded.rd < 31) next.x[decoded.rd] = result;
    if (decoded.sets) {
      const signed = BigInt.asIntN(64, result);
      next.flags = { n: signed < 0n ? 1 : 0, z: result === 0n ? 1 : 0, c: sub ? (rn >= rm ? 1 : 0) : (result < rn ? 1 : 0), v: 0 };
    }
  } else if (decoded.mnemonic === "LDR") {
    const loaded = read64(next.mem, Number(rn) + decoded.imm);
    if (typeof loaded !== "bigint") { next.halted = true; next.trace.push(loaded); return next; }
    if (decoded.rd < 31) next.x[decoded.rd] = loaded;
  } else if (decoded.mnemonic === "STR") {
    const fault = write64(next.mem, Number(rn) + decoded.imm, gpr(next, decoded.rd));
    if (fault) { next.halted = true; next.trace.push(fault); return next; }
  } else if (decoded.mnemonic === "B") pc = next.pc + decoded.imm * 4;
  else if (decoded.mnemonic === "BL") { next.x[30] = BigInt(next.pc + 4); pc = next.pc + decoded.imm * 4; }
  else if (decoded.mnemonic === "RET") pc = Number(next.x[30] ?? 0n);
  else if (decoded.mnemonic === "SVC") {
    next.el = 1;
    next.elr = next.pc + 4;
    next.spsr = next.el;
    next.esr = decoded.imm;
    pc = next.vbar;
    next.console.push(`SVC #${decoded.imm} entered EL1`);
  }
  next.pc = pc;
  next.retired += 1;
  next.trace.push(decoded.text);
  return next;
}

function read32(mem: Uint8Array, addr: number): number | string {
  if (addr < 0 || addr + 3 >= mem.length || addr % 4 !== 0) return "bad pc";
  return (mem[addr]! | (mem[addr + 1]! << 8) | (mem[addr + 2]! << 16) | (mem[addr + 3]! << 24)) >>> 0;
}

export function loadA64(source: string): A64Cpu | { ok: false; error: string } {
  const built = assembleA64(source);
  if (!built.ok) return { ok: false, error: built.errors.join("\n") };
  const cpu = blankA64();
  built.words.forEach((word, index) => {
    const addr = index * 4;
    cpu.mem[addr] = word & 0xff;
    cpu.mem[addr + 1] = (word >>> 8) & 0xff;
    cpu.mem[addr + 2] = (word >>> 16) & 0xff;
    cpu.mem[addr + 3] = (word >>> 24) & 0xff;
  });
  return cpu;
}

export function armPipe(lines: string[], forwarding: boolean): { cycles: number; stalls: number; notes: string[]; grid: string[][] } {
  const notes: string[] = [];
  let stalls = 0;
  const start: number[] = [];
  lines.forEach((line, index) => {
    let at = index === 0 ? 0 : (start[index - 1] ?? 0) + 1;
    const prev = (lines[index - 1] ?? "").toUpperCase();
    const cur = line.toUpperCase();
    const producer = prev.match(/X(\d+)/);
    const uses = cur.includes(producer ? `X${producer[1]}` : "___");
    if (index > 0 && producer && uses && producer[1] !== "31") {
      const penalty = prev.startsWith("LDR") ? 1 : forwarding ? 0 : 2;
      if (penalty) { stalls += penalty; at += penalty; notes.push(`${line.trim()} waits on X${producer[1]}.`); }
    }
    start.push(at);
  });
  const cycles = lines.length === 0 ? 0 : (start[lines.length - 1] ?? 0) + 5;
  const grid = lines.map((_, index) => {
    const row = Array.from({ length: cycles }, () => "");
    ["IF", "ID", "EX", "MEM", "WB"].forEach((stage, offset) => { row[(start[index] ?? 0) + offset] = stage; });
    return row;
  });
  return { cycles, stalls, notes, grid };
}

export function triggerSvc(cpu: A64Cpu, imm = 0): A64Cpu {
  return { ...cpu, el: 1, elr: cpu.pc, spsr: cpu.el, esr: imm, pc: cpu.vbar, trace: [...cpu.trace, `SVC from EL${cpu.el}`] };
}

export function eret(cpu: A64Cpu): A64Cpu {
  return { ...cpu, el: (cpu.spsr & 3) as 0 | 1 | 2 | 3, pc: cpu.elr, trace: [...cpu.trace, "ERET"] };
}
