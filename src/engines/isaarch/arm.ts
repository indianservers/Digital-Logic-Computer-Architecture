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

export interface A64Decoded { width?: 32 | 64; immediate?: boolean; mode?: "offset" | "pre" | "post"; condition?: number; mnemonic: string; word: number; rd: number; rn: number; rm: number; imm: number; sets: boolean; text: string }

export function decodeA64(word: number): A64Decoded {
  const w = word >>> 0;
  const rd = w & 31;
  const rn = (w >>> 5) & 31;
  const rm = (w >>> 16) & 31;
  const sets = ((w >>> 29) & 1) === 1;
  const width = w >>> 31 ? 64 : 32;
  const prefix = width === 64 ? "X" : "W";
  const dataOp = ((w | 0x80000000) & 0xffe0fc00) >>> 0;
  if (dataOp === 0x8b000000 || dataOp === 0xab000000 || dataOp === 0xcb000000 || dataOp === 0xeb000000) {
    const sub = (w & 0x40000000) !== 0;
    const mnemonic = sub ? (sets ? "SUBS" : "SUB") : (sets ? "ADDS" : "ADD");
    return { mnemonic, width, word: w, rd, rn, rm, imm: 0, sets, text: `${mnemonic} ${prefix}${rd}, ${prefix}${rn}, ${prefix}${rm}` };
  }
  if (((w & 0x1f800000) >>> 0) === 0x11000000 && !(w & 0x00400000)) {
    const sub = !!(w & 0x40000000), imm = (w >>> 10) & 0xfff;
    const mnemonic = sub ? (sets ? "SUBS" : "SUB") : (sets ? "ADDS" : "ADD");
    return { mnemonic, width, immediate: true, word: w, rd, rn, rm: 0, imm, sets, text: `${mnemonic} ${rd === 31 && !sets ? "SP" : prefix + rd}, ${rn === 31 ? "SP" : prefix + rn}, #${imm}` };
  }
  if (((w & 0x7fe00000) >>> 0) === 0x52800000) {
    const imm = (w >>> 5) & 0xffff;
    return { mnemonic: "MOV", width, word: w, rd, rn: 31, rm: 31, imm, sets: false, text: `MOV ${prefix}${rd}, #${imm}` };
  }
  if (((w & 0xff200c00) >>> 0) === 0xf8000c00 || ((w & 0xff200c00) >>> 0) === 0xf8000400) {
    const load = !!(w & 0x00400000), mode = (w & 0xc00) === 0xc00 ? "pre" : "post";
    const imm = ((w >>> 12) & 0x1ff) << 23 >> 23, mnemonic = load ? "LDR" : "STR", base = rn === 31 ? "SP" : `X${rn}`;
    return { mnemonic, mode, word: w, rd, rn, rm: 0, imm, sets: false, text: `${mnemonic} X${rd}, ${mode === "pre" ? `[${base}, #${imm}]!` : `[${base}], #${imm}`}` };
  }
  if (((w & 0xff000010) >>> 0) === 0x54000000) {
    const condition = w & 15, imm = ((w >>> 5) & 0x7ffff) << 13 >> 13;
    return { mnemonic: "B.cond", condition, word: w, rd: 0, rn: 0, rm: 0, imm, sets: false, text: `B.${A64_CONDITIONS[condition]} ${imm}` };
  }
  if (w === 0xd69f03e0) return { mnemonic: "ERET", word: w, rd: 0, rn: 0, rm: 0, imm: 0, sets: false, text: "ERET" };
  if (((w & 0xffc00000) >>> 0) === 0xf9400000) {
    const imm = ((w >>> 10) & 0xfff) * 8;
    return { mnemonic: "LDR", word: w, rd, rn, rm: 0, imm, sets: false, text: `LDR ${rd === 31 ? "XZR" : `X${rd}`}, [${rn === 31 ? "SP" : `X${rn}`}, #${imm}]` };
  }
  if (((w & 0xffc00000) >>> 0) === 0xf9000000) {
    const imm = ((w >>> 10) & 0xfff) * 8;
    return { mnemonic: "STR", word: w, rd, rn, rm: 0, imm, sets: false, text: `STR ${rd === 31 ? "XZR" : `X${rd}`}, [${rn === 31 ? "SP" : `X${rn}`}, #${imm}]` };
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
  if (((w & 0xffe0001f) >>> 0) === 0xd4000001) return { mnemonic: "SVC", word: w, rd: 0, rn: 0, rm: 0, imm: (w >>> 5) & 0xffff, sets: false, text: `SVC #${(w >>> 5) & 0xffff}` };
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
  exception?: { kind: A64ExceptionKind; from: number; vector: number; returnPc: number };
}

export function blankA64(): A64Cpu {
  return {
    x: Array.from({ length: 31 }, () => 0n), sp: 0x400n, pc: 0, flags: { n: 0, z: 1, c: 0, v: 0 }, mem: new Uint8Array(4096),
    el: 0, elr: 0, spsr: 0, esr: 0, vbar: 0x800, console: [], halted: false, cycles: 0, retired: 0, ir: 0, trace: [], decoded: null,
  };
}

export const A64_CONDITIONS = ["EQ", "NE", "CS", "CC", "MI", "PL", "VS", "VC", "HI", "LS", "GE", "LT", "GT", "LE", "AL", "NV"];
export function a64Condition(condition: number, f: A64Cpu["flags"]): boolean {
  return [f.z === 1, f.z === 0, f.c === 1, f.c === 0, f.n === 1, f.n === 0, f.v === 1, f.v === 0, f.c === 1 && f.z === 0, f.c === 0 || f.z === 1, f.n === f.v, f.n !== f.v, f.z === 0 && f.n === f.v, f.z === 1 || f.n !== f.v, true, true][condition] ?? false;
}
export function assembleA64(source: string): { ok: true; words: number[]; listing: string[] } | { ok: false; errors: string[] } {
  const labels = new Map<string, number>(), lines: { text: string; line: number }[] = [], errors: string[] = [];
  source.split(/\r?\n/).forEach((raw, i) => {
    let text = (raw.split("//")[0] ?? "").trim();
    const label = text.match(/^([A-Za-z_]\w*):/);
    if (label) { const key = label[1]!.toLowerCase(); if (labels.has(key)) errors.push(`Line ${i + 1}: duplicate label ${key}`); labels.set(key, lines.length * 4); text = text.slice(label[0].length).trim(); }
    if (text) lines.push({ text, line: i + 1 });
  });
  const words: number[] = [];
  const reg = (text: string, allowSP = false): number => {
    if (/^(XZR|WZR)$/i.test(text)) return 31;
    if (allowSP && /^SP$/i.test(text)) return 31;
    if (!/^[XW](?:[0-9]|[12][0-9]|30)$/i.test(text)) throw Error("use X0–X30, W0–W30, or a legal SP/zero-register operand");
    return Number(text.slice(1));
  };
  const integer = (text: string, min: number, max: number) => { const v = Number(text.replace(/^#/, "")); if (!text || !Number.isInteger(v) || v < min || v > max) throw Error(`immediate must be an integer in ${min}…${max}`); return v; };
  lines.forEach(({ text, line }, index) => {
    try {
      const match = text.match(/^(\S+)(?:\s+(.*))?$/)!, op = match[1]!.toUpperCase(), args = (match[2] ?? "").split(/\s*,\s*/).filter(Boolean);
      let word: number;
      const count = (n: number) => { if (args.length !== n) throw Error(`expected ${n} operands`); };
      if (["ADD", "ADDS", "SUB", "SUBS", "CMP"].includes(op)) {
        const cmp = op === "CMP", sets = cmp || op.endsWith("S"), sub = cmp || op.startsWith("SUB");
        count(cmp ? 2 : 3);
        const dest = cmp ? (/^W/i.test(args[0]!) ? "WZR" : "XZR") : args[0]!, left = args[cmp ? 0 : 1]!, right = args[cmp ? 1 : 2]!;
        const immediate = right.startsWith("#"), rd = reg(dest, immediate && !sets), rn = reg(left, immediate);
        const width = /^W/i.test(left) ? 32 : 64;
        if ((!/^SP$/i.test(dest) && /^W/i.test(dest) !== (width === 32)) || (!immediate && /^W/i.test(right) !== (width === 32))) throw Error("register widths must match");
        if (immediate) { if (/ZR$/i.test(left) || (!sets && /ZR$/i.test(dest))) throw Error("encoding 31 means SP in this immediate form"); word = (0x11000000 | (width === 64 ? 0x80000000 : 0) | (sub ? 0x40000000 : 0) | (sets ? 0x20000000 : 0) | (integer(right, 0, 4095) << 10) | (rn << 5) | rd) >>> 0; }
        else word = ((sub ? encodeSubReg(rd, rn, reg(right), sets) : encodeAddReg(rd, rn, reg(right), sets)) & (width === 32 ? 0x7fffffff : 0xffffffff)) >>> 0;
      } else if (op === "LDR" || op === "STR") {
        const m = text.match(/^(?:LDR|STR)\s+(X(?:[0-9]|[12][0-9]|30)|XZR)\s*,\s*\[(X(?:[0-9]|[12][0-9]|30)|SP)(?:\s*,\s*#(-?(?:0x[0-9a-f]+|\d+)))?\](!)?(?:\s*,\s*#(-?(?:0x[0-9a-f]+|\d+)))?$/i);
        if (!m || (m[5] && (m[3] || m[4]))) throw Error("use LDR/STR Xt, [Xn|SP, #offset], [Xn, #offset]!, or [Xn], #offset");
        const rt = reg(m[1]!), rn = reg(m[2]!, true), mode = m[5] ? "post" : m[4] ? "pre" : "offset", offset = integer(m[5] ?? m[3] ?? "0", mode === "offset" ? 0 : -256, mode === "offset" ? 32760 : 255);
        if (mode === "offset") { if (offset % 8) throw Error("unsigned 64-bit offset must be a multiple of 8"); word = op === "LDR" ? encodeLdr(rt, rn, offset) : encodeStr(rt, rn, offset); }
        else { if (rt === rn && rn !== 31) throw Error("writeback base must differ from transfer register"); word = (0xf8000000 | (op === "LDR" ? 0x400000 : 0) | ((offset & 511) << 12) | (mode === "pre" ? 0xc00 : 0x400) | (rn << 5) | rt) >>> 0; }
      } else if (op === "MOV") {
        count(2); const rd = reg(args[0]!), imm = integer(args[1]!, 0, 65535);
        if (!args[1]!.startsWith("#")) throw Error("this MOV subset accepts #0…#65535");
        word = (0x52800000 | (/^X/i.test(args[0]!) ? 0x80000000 : 0) | (imm << 5) | rd) >>> 0;
      } else if (op === "B" || op === "BL" || op.startsWith("B.")) {
        count(1); const target = args[0]!, address = labels.get(target.toLowerCase());
        const off = address === undefined ? integer(target, -33554432, 33554431) : (address - index * 4) / 4;
        if (op.startsWith("B.")) { const condition = A64_CONDITIONS.indexOf(op.slice(2)); if (condition < 0 || off < -262144 || off > 262143) throw Error("invalid branch condition or offset"); word = (0x54000000 | ((off & 0x7ffff) << 5) | condition) >>> 0; }
        else word = op === "B" ? encodeB(off) : encodeBl(off);
      } else if (op === "SVC") { count(1); word = (0xd4000001 | (integer(args[0]!, 0, 65535) << 5)) >>> 0; }
      else if (["RET", "NOP", "ERET"].includes(op)) { count(0); word = op === "RET" ? 0xd65f03c0 : op === "ERET" ? 0xd69f03e0 : 0xd503201f; }
      else throw Error(`unsupported ${op}`);
      words.push(word);
    } catch (error) { errors.push(`Line ${line}: ${(error as Error).message}`); }
  });
  if (lines.length * 4 > 0x800) errors.push("Program exceeds the 2 KiB user-code region.");
  return errors.length ? { ok: false, errors } : { ok: true, words, listing: words.map(w => decodeA64(w).text) };
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
  if (typeof word !== "number" || word === 0) { next.halted = true; next.decoded = null; next.ir = 0; next.trace.push("Stop: empty instruction slot or invalid PC."); return next; }
  const decoded = decodeA64(word);
  next.ir = word;
  next.decoded = decoded;
  if (decoded.mnemonic === "unknown") { next.halted = true; next.trace.push("Unsupported opcode."); return next; }
  const width = decoded.width ?? 64;
  const rn = BigInt.asUintN(width, (decoded.immediate || ["LDR", "STR"].includes(decoded.mnemonic)) && decoded.rn === 31 ? next.sp : gpr(next, decoded.rn));
  const rm = decoded.immediate ? BigInt(decoded.imm) : BigInt.asUintN(width, gpr(next, decoded.rm));
  let pc = next.pc + 4;
  if (decoded.mnemonic === "ADD" || decoded.mnemonic === "ADDS" || decoded.mnemonic === "SUB" || decoded.mnemonic === "SUBS") {
    const sub = decoded.mnemonic.startsWith("SUB");
    const result = BigInt.asUintN(width, sub ? rn - rm : rn + rm);
    if (decoded.rd < 31) next.x[decoded.rd] = result;
    else if (decoded.immediate && !decoded.sets) next.sp = result;
    if (decoded.sets) {
      const sign = 1n << BigInt(width - 1);
      const overflow = sub ? ((rn ^ rm) & (rn ^ result) & sign) !== 0n : ((~(rn ^ rm)) & (rn ^ result) & sign) !== 0n;
      next.flags = { n: (result & sign) ? 1 : 0, z: result === 0n ? 1 : 0, c: sub ? (rn >= rm ? 1 : 0) : (rn + rm >= (1n << BigInt(width)) ? 1 : 0), v: overflow ? 1 : 0 };
    }
  } else if (decoded.mnemonic === "LDR") {
    const loaded = read64(next.mem, Number(rn + BigInt(decoded.mode === "post" ? 0 : decoded.imm)));
    if (typeof loaded !== "bigint") { next.halted = true; next.trace.push(loaded); return next; }
    if (decoded.rd < 31) next.x[decoded.rd] = loaded;
    if (decoded.mode) { if (decoded.rn === 31) next.sp = BigInt.asUintN(64, rn + BigInt(decoded.imm)); else next.x[decoded.rn] = BigInt.asUintN(64, rn + BigInt(decoded.imm)); }
  } else if (decoded.mnemonic === "STR") {
    const fault = write64(next.mem, Number(rn + BigInt(decoded.mode === "post" ? 0 : decoded.imm)), gpr(next, decoded.rd));
    if (fault) { next.halted = true; next.trace.push(fault); return next; }
    if (decoded.mode) { if (decoded.rn === 31) next.sp = BigInt.asUintN(64, rn + BigInt(decoded.imm)); else next.x[decoded.rn] = BigInt.asUintN(64, rn + BigInt(decoded.imm)); }
  } else if (decoded.mnemonic === "MOV") { if (decoded.rd < 31) next.x[decoded.rd] = BigInt(decoded.imm);
  } else if (decoded.mnemonic === "B.cond") { if (a64Condition(decoded.condition!, next.flags)) pc = next.pc + decoded.imm * 4;
  } else if (decoded.mnemonic === "B") pc = next.pc + decoded.imm * 4;
  else if (decoded.mnemonic === "BL") { next.x[30] = BigInt(next.pc + 4); pc = next.pc + decoded.imm * 4; }
  else if (decoded.mnemonic === "RET") pc = Number(next.x[30] ?? 0n);
  else if (decoded.mnemonic === "SVC") {
    const entered = enterA64Exception(next, "SVC", decoded.imm, next.pc + 4);
    if (entered.halted) return entered;
    return { ...entered, retired: next.retired + 1, trace: [...entered.trace, decoded.text] };
  } else if (decoded.mnemonic === "ERET") {
    const returned = eret(next);
    return returned.halted ? returned : { ...returned, retired: next.retired + 1 };
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

export type A64ExceptionKind = "SVC" | "IRQ" | "FIQ" | "SError";
export function enterA64Exception(cpu: A64Cpu, kind: A64ExceptionKind, imm = 0, returnPc = cpu.pc): A64Cpu {
  if (cpu.el > 1 || cpu.exception) return { ...cpu, halted: true, trace: [...cpu.trace, "This subset supports one EL0/EL1 exception at a time; reset before entering another."] };
  const offsets = { SVC: 0, IRQ: 0x80, FIQ: 0x100, SError: 0x180 };
  const vector = cpu.vbar + (cpu.el === 0 ? 0x400 : 0x200) + offsets[kind];
  const f = cpu.flags;
  const spsr = ((f.n << 31) | (f.z << 30) | (f.c << 29) | (f.v << 28) | (cpu.el === 1 ? 5 : 0)) >>> 0;
  return { ...cpu, el: 1, elr: returnPc, spsr, esr: kind === "SVC" ? ((0x15 << 26) | (1 << 25) | (imm & 0xffff)) >>> 0 : cpu.esr,
    pc: vector, halted: false, exception: { kind, from: cpu.el, vector, returnPc }, trace: [...cpu.trace, `${kind}: EL${cpu.el} → EL1, PC=0x${vector.toString(16)}, ELR=0x${returnPc.toString(16)}`] };
}
export function triggerSvc(cpu: A64Cpu, imm = 0): A64Cpu { return enterA64Exception(cpu, "SVC", imm, cpu.pc + 4); }
export function eret(cpu: A64Cpu): A64Cpu {
  if (cpu.el !== 1 || !cpu.exception) return { ...cpu, halted: true, trace: [...cpu.trace, "ERET requires an active EL1 exception in this subset."] };
  const mode = cpu.spsr & 15;
  if (mode !== 0 && mode !== 5) return { ...cpu, halted: true, trace: [...cpu.trace, "Unsupported saved mode."] };
  return { ...cpu, el: mode === 0 ? 0 : 1, pc: cpu.elr, exception: undefined, flags: { n: (cpu.spsr >>> 31) as 0 | 1, z: ((cpu.spsr >>> 30) & 1) as 0 | 1, c: ((cpu.spsr >>> 29) & 1) as 0 | 1, v: ((cpu.spsr >>> 28) & 1) as 0 | 1 }, trace: [...cpu.trace, "ERET: restore NZCV, exception level, and PC"] };
}
