import { renameOps, stepRob, vectorAdd, type MiniOp, type RobEntry } from "../arch/parallel";

export interface X86Example {
  id: string;
  asm: string;
  bytes: number[];
  fields: Array<{ name: string; bytes: string; note: string }>;
  note: string;
}

export const X86_EXAMPLES: X86Example[] = [
  {
    id: "add-reg",
    asm: "add eax, ebx",
    bytes: [0x03, 0xc3],
    fields: [
      { name: "Opcode", bytes: "03", note: "ADD r32, r/m32" },
      { name: "ModRM", bytes: "C3", note: "mod=11 (register), reg=EAX, r/m=EBX" },
    ],
    note: "Two-byte teaching example. Prefix, SIB, displacement, and immediate are absent.",
  },
  {
    id: "mov-sib",
    asm: "mov eax, [rbx+rcx*4+8]",
    bytes: [0x48, 0x8b, 0x44, 0x8b, 0x08],
    fields: [
      { name: "Prefix", bytes: "48", note: "REX.W — 64-bit operand size" },
      { name: "Opcode", bytes: "8B", note: "MOV r64, r/m64" },
      { name: "ModRM", bytes: "44", note: "mod=01 (disp8), reg=EAX, r/m=SIB" },
      { name: "SIB", bytes: "8B", note: "scale=4, index=RCX, base=RBX" },
      { name: "Displacement", bytes: "08", note: "+8" },
    ],
    note: "Variable-length: REX + opcode + ModRM + SIB + disp8. Not every instruction has every field.",
  },
  {
    id: "add-mem",
    asm: "add dword ptr [rax], ebx",
    bytes: [0x01, 0x18],
    fields: [
      { name: "Opcode", bytes: "01", note: "ADD r/m32, r32" },
      { name: "ModRM", bytes: "18", note: "mod=00, reg=EBX, r/m=RAX (memory)" },
    ],
    note: "The memory operand is in the instruction. A load/store ISA would split this into load, add, store.",
  },
];

export function effectiveAddress(base: number, index: number, scale: number, disp: number): number {
  return (base + index * scale + disp) >>> 0;
}

export function parseExample(id: string): X86Example | undefined {
  return X86_EXAMPLES.find((item) => item.id === id);
}

export function microOps(id: string): string[] {
  if (id === "add-reg") return ["ADD EAX, EBX"];
  if (id === "add-mem") return ["LOAD t, [RAX]", "ADD t, EBX", "STORE [RAX], t"];
  if (id === "mov-sib") return ["LEA t, [RBX+RCX*4+8]", "LOAD EAX, [t]"];
  return ["(implementation-defined)"];
}

export const X86_REGS = [
  { full: "RAX", parts: "EAX / AX / AL", role: "Accumulator" },
  { full: "RBX", parts: "EBX / BX / BL", role: "Base" },
  { full: "RCX", parts: "ECX / CX / CL", role: "Counter" },
  { full: "RDX", parts: "EDX / DX / DL", role: "Data" },
  { full: "RSI", parts: "ESI", role: "Source index" },
  { full: "RDI", parts: "EDI", role: "Destination index" },
  { full: "RBP", parts: "EBP", role: "Frame pointer (conventional)" },
  { full: "RSP", parts: "ESP", role: "Stack pointer" },
  { full: "R8–R15", parts: "R8D…", role: "Extra GPRs in x86-64" },
];

export function ooeDemo(): { renamed: ReturnType<typeof renameOps>; rob: RobEntry[] } {
  const ops: MiniOp[] = [
    { text: "add eax, ebx", dest: "eax", sources: ["eax", "ebx"] },
    { text: "mov ecx, [rax]", dest: "ecx", sources: ["rax"] },
    { text: "add edx, ecx", dest: "edx", sources: ["edx", "ecx"] },
  ];
  return {
    renamed: renameOps(ops),
    rob: stepRob([
      { text: "add eax, ebx", status: "done" },
      { text: "mov ecx, [rax]", status: "execute" },
      { text: "add edx, ecx", status: "wait" },
    ]),
  };
}

export function x86Simd(left: number[], right: number[]): number[] {
  return vectorAdd(left, right);
}

export const RINGS = [
  { id: "ring3", title: "User (Ring 3)", note: "Application code. Cannot run privileged instructions in this teaching view." },
  { id: "ring0", title: "Privileged (Ring 0)", note: "OS kernel conceptually. Hardware-specific rings exist; this is a high-level split." },
];

export const GPR_NAMES = ["RAX", "RBX", "RCX", "RDX", "RSI", "RDI", "RBP", "RSP", "R8", "R9", "R10", "R11", "R12", "R13", "R14", "R15"] as const;

export interface X86Flags { cf: number; pf: number; af: number; zf: number; sf: number; tf: number; if: number; df: number; of: number }

export interface X86Cpu {
  gpr: bigint[];
  rip: number;
  flags: X86Flags;
  cycles: number;
  retired: number;
  halted: boolean;
  trace: string[];
  current: string;
}

export function blankFlags(): X86Flags {
  return { cf: 0, pf: 0, af: 0, zf: 0, sf: 0, tf: 0, if: 1, df: 0, of: 0 };
}

export function blankX86(): X86Cpu {
  return { gpr: Array.from({ length: 16 }, () => 0n), rip: 0, flags: blankFlags(), cycles: 0, retired: 0, halted: false, trace: [], current: "" };
}

const WIDTH_MASK: Record<8 | 16 | 32 | 64, bigint> = { 8: 0xffn, 16: 0xffffn, 32: 0xffffffffn, 64: 0xffffffffffffffffn };

export function readSlice(value: bigint, width: 8 | 16 | 32 | 64, high = false): bigint {
  const shifted = high ? value >> 8n : value;
  return shifted & (WIDTH_MASK[width] ?? 0xffn);
}

export function writeSlice(value: bigint, width: 8 | 16 | 32 | 64, next: bigint, high = false): bigint {
  const clean = next & (WIDTH_MASK[width] ?? 0xffn);
  if (width === 32) return clean;
  if (width === 64) return clean;
  if (high) return (value & ~0xff00n) | (clean << 8n);
  const mask = WIDTH_MASK[width] ?? 0xffn;
  return (value & ~mask) | clean;
}

function parity(value: bigint): number {
  let bits = Number(value & 0xffn);
  let count = 0;
  while (bits) { count += bits & 1; bits >>= 1; }
  return count % 2 === 0 ? 1 : 0;
}

export function applyAlu(op: string, left: bigint, right: bigint, width: 8 | 16 | 32 | 64): { result: bigint; flags: X86Flags } {
  const mask = WIDTH_MASK[width];
  const sign = 1n << BigInt(width - 1);
  const a = left & mask;
  const b = right & mask;
  const name = op.toUpperCase();
  let wide = 0n;
  if (name === "ADD" || name === "INC") wide = a + (name === "INC" ? 1n : b);
  else if (name === "SUB" || name === "CMP" || name === "DEC") wide = a - (name === "DEC" ? 1n : b);
  else if (name === "AND") wide = a & b;
  else if (name === "OR") wide = a | b;
  else if (name === "XOR") wide = a ^ b;
  else if (name === "SHL") wide = a << (b & 63n);
  else if (name === "SHR") wide = a >> (b & 63n);
  const result = wide & mask;
  const flags = blankFlags();
  flags.zf = result === 0n ? 1 : 0;
  flags.sf = (result & sign) !== 0n ? 1 : 0;
  flags.pf = parity(result);
  const logic = name === "AND" || name === "OR" || name === "XOR";
  if (logic) { flags.cf = 0; flags.of = 0; }
  else if (name === "SHL") flags.cf = ((a << ((b & 63n) - 1n)) & sign) !== 0n ? 1 : 0;
  else if (name === "SHR") flags.cf = (a & 1n) !== 0n ? 1 : 0;
  else if (name === "ADD") { flags.cf = wide > mask ? 1 : 0; flags.of = ((a ^ result) & (b ^ result) & sign) !== 0n ? 1 : 0; }
  else if (name === "SUB" || name === "CMP") { flags.cf = b > a ? 1 : 0; flags.of = ((a ^ b) & (a ^ result) & sign) !== 0n ? 1 : 0; }
  else if (name === "INC" || name === "DEC") flags.of = ((a ^ result) & sign) !== 0n && ((name === "INC" ? a : result) & sign) !== 0n ? 1 : 0;
  flags.af = Number((a ^ b ^ result) & 0x10n) !== 0 ? 1 : 0;
  return { result: name === "CMP" ? a : result, flags };
}

const INTEL = [0, 3, 1, 2, 6, 7, 5, 4, 8, 9, 10, 11, 12, 13, 14, 15];
const REG: Record<string, number> = { rax: 0, rbx: 1, rcx: 2, rdx: 3, rsi: 4, rdi: 5, rbp: 6, rsp: 7, r8: 8, r9: 9, r10: 10, r11: 11, r12: 12, r13: 13, r14: 14, r15: 15, eax: 0, ebx: 1, ecx: 2, edx: 3, esi: 4, edi: 5, ebp: 6, esp: 7 };

export function regOf(token: string): { index: number; width: 32 | 64 } | null {
  const name = token.toLowerCase();
  const index = REG[name];
  if (index === undefined) return null;
  return { index, width: name.startsWith("e") || name === "esi" || name === "edi" || name === "ebp" || name === "esp" ? 32 : 64 };
}

export interface EncodedField { name: string; byte: string; bits: string; note: string }

export function encodeMovMem(dest: number, base: number, index: number, scale: number, disp: number): { bytes: number[]; fields: EncodedField[]; asm: string } {
  const id = INTEL[dest] ?? dest;
  const ib = INTEL[base] ?? base;
  const ix = INTEL[index] ?? index;
  const rex = 0x40 | 0x08 | ((id > 7 ? 4 : 0) | (ix > 7 ? 2 : 0) | (ib > 7 ? 1 : 0));
  const ss = scale === 8 ? 3 : scale === 4 ? 2 : scale === 2 ? 1 : 0;
  const modrm = (1 << 6) | ((id & 7) << 3) | 4;
  const sib = (ss << 6) | ((ix & 7) << 3) | (ib & 7);
  const disp8 = disp & 0xff;
  const bytes = [rex, 0x8b, modrm, sib, disp8];
  const hex = (value: number) => value.toString(16).padStart(2, "0").toUpperCase();
  const bits = (value: number) => value.toString(2).padStart(8, "0");
  return {
    bytes,
    asm: `MOV ${GPR_NAMES[dest] ?? "RAX"}, [${GPR_NAMES[base] ?? "RBX"} + ${GPR_NAMES[index] ?? "RCX"}*${scale} + 0x${disp.toString(16)}]`,
    fields: [
      { name: "REX", byte: hex(rex), bits: bits(rex), note: "W=1 → 64-bit operand" },
      { name: "Opcode", byte: "8B", bits: bits(0x8b), note: "MOV r64, r/m64" },
      { name: "ModR/M", byte: hex(modrm), bits: bits(modrm), note: "disp8 + SIB" },
      { name: "SIB", byte: hex(sib), bits: bits(sib), note: `scale ${scale}, index ${GPR_NAMES[index]}, base ${GPR_NAMES[base]}` },
      { name: "Disp8", byte: hex(disp8), bits: bits(disp8), note: `+0x${disp.toString(16)}` },
    ],
  };
}

export interface AsmInsn { text: string; bytes: number[]; op: string; a: number; b: number; imm: number; target: number; width: 32 | 64 }

export function assembleX86(source: string): { ok: true; insns: AsmInsn[] } | { ok: false; errors: string[] } {
  const labels: Record<string, number> = {};
  const lines: string[] = [];
  source.split(/\r?\n/).forEach((raw) => {
    const text = (raw.split(";")[0] ?? "").trim();
    if (!text || text.startsWith(".") || text.startsWith("section") || text.startsWith("global")) return;
    const labeled = text.match(/^([A-Za-z_]\w*):\s*(.*)$/);
    if (labeled) { labels[(labeled[1] ?? "").toLowerCase()] = lines.length; if ((labeled[2] ?? "").trim()) lines.push((labeled[2] ?? "").trim()); return; }
    lines.push(text);
  });
  const errors: string[] = [];
  const insns: AsmInsn[] = [];
  lines.forEach((text, index) => {
    const parts = text.split(/[\s,]+/).filter(Boolean);
    const op = (parts[0] ?? "").toLowerCase();
    const dst = regOf(parts[1] ?? "");
    const src = regOf(parts[2] ?? "");
    const imm = Number((parts[2] ?? parts[1] ?? "0").replace("#", ""));
    const item: AsmInsn = { text, bytes: [], op, a: dst?.index ?? 0, b: src?.index ?? 0, imm: Number.isFinite(imm) ? imm : 0, target: labels[(parts[1] ?? "").toLowerCase()] ?? -1, width: dst?.width ?? 64 };
    const code = (index: number) => (INTEL[index] ?? index) & 7;
    if (op === "ret") item.bytes = [0xc3];
    else if (op === "xor" && dst && src) item.bytes = [0x48, 0x31, 0xc0 | (code(src.index) << 3) | code(dst.index)];
    else if (op === "add" && dst && src) item.bytes = [0x48, 0x01, 0xc0 | (code(src.index) << 3) | code(dst.index)];
    else if (op === "cmp" && dst && src) item.bytes = [0x48, 0x39, 0xc0 | (code(src.index) << 3) | code(dst.index)];
    else if (op === "inc" && dst) item.bytes = [0x48, 0xff, 0xc0 | code(dst.index)];
    else if (op === "mov" && dst && parts[2]?.match(/^-?\d/)) item.bytes = dst.width === 32 ? [0xb8 + code(dst.index), item.imm & 0xff, 0, 0, 0] : [0x48, 0xc7, 0xc0 | code(dst.index), item.imm & 0xff, 0, 0, 0];
    else if (op === "mov" && dst && src) item.bytes = [0x48, 0x89, 0xc0 | (code(src.index) << 3) | code(dst.index)];
    else if ((op === "jle" || op === "jmp") && item.target >= 0) item.bytes = [op === "jle" ? 0x7e : 0xeb, 0];
    else errors.push(`Line ${index + 1}: unsupported ${text}`);
    insns.push(item);
  });
  insns.forEach((insn, index) => {
    if (insn.op === "jle" || insn.op === "jmp") {
      const from = insns.slice(0, index + 1).reduce((sum, item) => sum + item.bytes.length, 0);
      const to = insns.slice(0, insn.target).reduce((sum, item) => sum + item.bytes.length, 0);
      insn.bytes[1] = (to - from) & 0xff;
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true, insns };
}

export function disassembleBytes(text: string): string {
  const bytes = text.trim().split(/\s+/).map((item) => Number.parseInt(item, 16));
  if (bytes.some((item) => !Number.isFinite(item))) return "Enter hex bytes such as 48 89 D8.";
  if (bytes[0] === 0xc3) return "ret";
  const named = ["RAX", "RCX", "RDX", "RBX", "RSP", "RBP", "RSI", "RDI"];
  if (bytes[0] === 0x48 && bytes[1] === 0x89) return `mov ${named[bytes[2]! & 7]}, ${named[(bytes[2]! >> 3) & 7]}`;
  if (bytes[0] === 0x48 && bytes[1] === 0x31) return `xor ${named[bytes[2]! & 7]}, ${named[(bytes[2]! >> 3) & 7]}`;
  if (bytes[0] === 0x48 && bytes[1] === 0x01) return `add ${named[bytes[2]! & 7]}, ${named[(bytes[2]! >> 3) & 7]}`;
  if (bytes.length >= 5 && bytes[0]! >= 0xb8 && bytes[0]! <= 0xbf) return `mov ${["eax", "ebx", "ecx", "edx", "esi", "edi", "ebp", "esp"][bytes[0]! - 0xb8]}, ${bytes[1]}`;
  return "This teaching disassembler knows the studio's MOV, ADD, XOR, and RET forms.";
}

export function stepX86(cpu: X86Cpu, insns: AsmInsn[]): X86Cpu {
  if (cpu.halted || cpu.rip >= insns.length) return { ...cpu, halted: true, current: "Halted" };
  const next: X86Cpu = { ...cpu, gpr: cpu.gpr.slice(), flags: { ...cpu.flags }, trace: cpu.trace.slice() };
  const insn = insns[cpu.rip];
  if (!insn) return { ...next, halted: true };
  next.cycles += 1;
  next.current = insn.text;
  const a = next.gpr[insn.a] ?? 0n;
  const b = next.gpr[insn.b] ?? 0n;
  if (insn.op === "ret") { next.halted = true; next.trace.push("ret"); }
  else if (insn.op === "mov" && insn.bytes[0] !== 0x48) next.gpr[insn.a] = BigInt(insn.imm >>> 0);
  else if (insn.op === "mov" && insn.bytes[1] === 0x89) next.gpr[insn.a] = b;
  else if (insn.op === "mov") next.gpr[insn.a] = BigInt(insn.imm);
  else if (insn.op === "xor" || insn.op === "add") {
    const alu = applyAlu(insn.op, a, b, 64);
    next.gpr[insn.a] = alu.result;
    next.flags = { ...next.flags, ...alu.flags, tf: next.flags.tf, if: next.flags.if, df: next.flags.df };
  } else if (insn.op === "inc") {
    const carry = next.flags.cf;
    const alu = applyAlu("INC", a, 0n, 64);
    next.gpr[insn.a] = alu.result;
    next.flags = { ...alu.flags, cf: carry };
  } else if (insn.op === "cmp") {
    const alu = applyAlu("CMP", a, b, 64);
    next.flags = { ...next.flags, ...alu.flags, tf: next.flags.tf, if: next.flags.if, df: next.flags.df };
  } else if (insn.op === "jle") {
    const taken = next.flags.zf === 1 || next.flags.sf !== next.flags.of;
    next.rip = taken ? insn.target : next.rip + 1;
    next.retired += 1;
    next.trace.push(insn.text);
    return next;
  }
  next.rip += 1;
  next.retired += 1;
  next.trace.push(insn.text);
  return next;
}

export interface Uop { name: string; detail: string; tone: string }

export function crackUops(kind: string): { title: string; uops: Uop[]; chain: string } {
  if (kind === "mov") return { title: "MOV RAX, [MEM]", uops: [{ name: "AGU", detail: "EA = base + disp", tone: "agu" }, { name: "LOAD", detail: "RAX ← MEM[EA]", tone: "load" }], chain: "AGU → LOAD · 2 µOps" };
  if (kind === "push") return { title: "PUSH RAX", uops: [{ name: "ALU", detail: "RSP ← RSP − 8", tone: "alu" }, { name: "STORE", detail: "MEM[RSP] ← RAX", tone: "store" }], chain: "ALU → STORE · 2 µOps" };
  if (kind === "rep") return { title: "REP MOVSB", uops: [{ name: "LOAD", detail: "tmp ← MEM[RSI]", tone: "load" }, { name: "STORE", detail: "MEM[RDI] ← tmp", tone: "store" }, { name: "ALU", detail: "RSI/RDI/RCX update", tone: "alu" }], chain: "microcoded loop · many µOps" };
  if (kind === "reg") return { title: "ADD RAX, RBX", uops: [{ name: "ALU", detail: "RAX ← RAX + RBX", tone: "alu" }], chain: "ALU · 1 µOp" };
  return { title: "ADD QWORD PTR [RAX+8], RBX", uops: [{ name: "AGU", detail: "EA = RAX + 8", tone: "agu" }, { name: "LOAD", detail: "tmp ← MEM[EA]", tone: "load" }, { name: "ALU", detail: "tmp ← tmp + RBX", tone: "alu" }, { name: "STORE", detail: "MEM[EA] ← tmp", tone: "store" }], chain: "AGU → LOAD → ALU → STORE · 4 µOps" };
}

export interface CacheProbe { tlb: "Hit" | "Miss"; l1: "Hit" | "Miss"; l2: "Hit" | "Miss"; l3: "Hit" | "Miss"; cycles: number; pa: string }

export function probeCache(address: bigint, warm: boolean): CacheProbe {
  const page = address >> 12n;
  const known = page === 0x7fffn;
  const line = address & ~63n;
  const l1 = warm && known;
  const l2 = known;
  return {
    tlb: known ? "Hit" : "Miss",
    l1: l1 ? "Hit" : "Miss",
    l2: l2 ? "Hit" : "Miss",
    l3: known || warm ? "Hit" : "Miss",
    cycles: l1 ? 4 : l2 ? 12 : known ? 40 : 200,
    pa: `0x${(line & 0xffffffffffn).toString(16)}`,
  };
}
