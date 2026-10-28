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
    asm: "mov rax, [rbx+rcx*4+8]",
    bytes: [0x48, 0x8b, 0x44, 0x8b, 0x08],
    fields: [
      { name: "Prefix", bytes: "48", note: "REX.W — 64-bit operand size" },
      { name: "Opcode", bytes: "8B", note: "MOV r64, r/m64" },
      { name: "ModRM", bytes: "44", note: "mod=01 (disp8), reg=RAX, r/m=SIB" },
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
  if (id === "mov-sib") return ["LEA t, [RBX+RCX*4+8]", "LOAD RAX, [t]"];
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
  else if (name === "INC" || name === "DEC") flags.of = (name === "INC" ? result === sign : a === sign) ? 1 : 0;
  flags.af = Number((a ^ b ^ result) & 0x10n) !== 0 ? 1 : 0;
  return { result: name === "CMP" ? a : result, flags };
}

const INTEL = [0, 3, 1, 2, 6, 7, 5, 4, 8, 9, 10, 11, 12, 13, 14, 15];
const REG: Record<string, number> = { rax: 0, rbx: 1, rcx: 2, rdx: 3, rsi: 4, rdi: 5, rbp: 6, rsp: 7, r8: 8, r9: 9, r10: 10, r11: 11, r12: 12, r13: 13, r14: 14, r15: 15, eax: 0, ebx: 1, ecx: 2, edx: 3, esi: 4, edi: 5, ebp: 6, esp: 7 };

export function regOf(token: string): { index: number; width: 32 | 64 } | null {
  const name = token.toLowerCase();
  const index = REG[name] ?? (/^r(?:[89]|1[0-5])d$/.test(name) ? REG[name.slice(0, -1)] : undefined);
  if (index === undefined) return null;
  return { index, width: name.startsWith("e") || name === "esi" || name === "edi" || name === "ebp" || name === "esp" || /^r(?:[89]|1[0-5])d$/.test(name) ? 32 : 64 };
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

export interface AsmInsn { text: string; bytes: number[]; op: string; a: number; b: number; imm: number; target: number; width: 32 | 64; immediate?: boolean }

export function assembleX86(source: string): { ok: true; insns: AsmInsn[] } | { ok: false; errors: string[] } {
  const labels: Record<string, number> = Object.create(null), lines: Array<{ text: string; line: number }> = [], errors: string[] = [];
  source.split(/\r?\n/).forEach((raw, line) => {
    let text = (raw.split(";")[0] ?? "").trim();
    if (!text) return;
    const labeled = text.match(/^([A-Za-z_]\w*):\s*(.*)$/);
    if (labeled) {
      const name = labeled[1]!.toLowerCase();
      if (name in labels) errors.push("Line " + (line + 1) + ": duplicate label " + name);
      labels[name] = lines.length; text = labeled[2]!.trim();
    }
    if (text) lines.push({ text, line: line + 1 });
  });
  if (!lines.length) errors.push("Enter at least one supported instruction.");
  if (lines.length > 512) return { ok: false, errors: [...errors, "Use at most 512 instructions."] };
  const insns: AsmInsn[] = [];
  const code = (index: number) => INTEL[index] ?? index;
  const le32 = (value: number) => Array.from({ length: 4 }, (_, i) => (value >>> (i * 8)) & 255);
  for (const { text, line } of lines) {
    const match = text.match(/^(\w+)(?:\s+(.*))?$/), op = match?.[1]?.toLowerCase() ?? "";
    const operands = match?.[2]?.split(",").map(v => v.trim()) ?? [];
    const dst = regOf(operands[0] ?? ""), src = regOf(operands[1] ?? "");
    const token = operands[1] ?? "", numeric = /^-?(?:0x[0-9a-f]+|\d+)$/i.test(token);
    const imm = numeric ? (token.startsWith("-0x") ? -Number(token.slice(1)) : Number(token)) : 0;
    const item: AsmInsn = { text, op, bytes: [], a: dst?.index ?? 0, b: src?.index ?? 0, imm, target: -1, width: dst?.width ?? 64, immediate: numeric };
    const fail = (message: string) => errors.push("Line " + line + ": " + message);
    if (op === "ret" && operands.length === 0) item.bytes = [0xc3];
    else if ((op === "jmp" || op === "jle") && operands.length === 1 && operands[0]!.toLowerCase() in labels) {
      item.target = labels[operands[0]!.toLowerCase()] ?? -1; item.bytes = [op === "jmp" ? 0xeb : 0x7e, 0];
    } else if (dst && op === "inc" && operands.length === 1) {
      const rex = (dst.width === 64 ? 0x48 : 0x40) | (code(dst.index) > 7 ? 1 : 0);
      item.bytes = [...(rex !== 0x40 ? [rex] : []), 0xff, 0xc0 | (code(dst.index) & 7)];
    } else if (dst && src && operands.length === 2 && ["mov", "xor", "add", "cmp"].includes(op)) {
      if (dst.width !== src.width) fail("Operand widths must match.");
      const rex = (dst.width === 64 ? 0x48 : 0x40) | (code(src.index) > 7 ? 4 : 0) | (code(dst.index) > 7 ? 1 : 0);
      const opcode = { mov: 0x89, xor: 0x31, add: 0x01, cmp: 0x39 }[op]!;
      item.bytes = [...(rex !== 0x40 ? [rex] : []), opcode, 0xc0 | ((code(src.index) & 7) << 3) | (code(dst.index) & 7)];
    } else if (op === "mov" && dst && numeric && operands.length === 2) {
      if (!Number.isSafeInteger(imm) || imm < -2147483648 || imm > (dst.width === 32 ? 4294967295 : 2147483647)) fail("Immediate is outside this form's 32-bit range.");
      const extension = code(dst.index) > 7 ? 1 : 0;
      item.bytes = dst.width === 32 ? [...(extension ? [0x41] : []), 0xb8 + (code(dst.index) & 7), ...le32(imm)] : [0x48 | extension, 0xc7, 0xc0 | (code(dst.index) & 7), ...le32(imm)];
    } else fail("Unsupported instruction or operands: " + text);
    insns.push(item);
  }
  insns.forEach((insn, index) => {
    if (insn.op !== "jmp" && insn.op !== "jle") return;
    const from = insns.slice(0, index + 1).reduce((n, i) => n + i.bytes.length, 0);
    const to = insns.slice(0, insn.target).reduce((n, i) => n + i.bytes.length, 0);
    const displacement = to - from;
    if (displacement < -128 || displacement > 127) errors.push("Instruction " + (index + 1) + ": branch exceeds the supported signed disp8 range.");
    insn.bytes[1] = displacement & 255;
  });
  return errors.length ? { ok: false, errors } : { ok: true, insns };
}

export function disassembleBytes(text: string): string {
  const tokens = text.trim().split(/\s+/);
  if (!tokens.length || tokens.some(t => !/^[0-9a-f]{2}$/i.test(t))) return "Enter complete hex bytes, such as 48 89 D8.";
  const bytes = tokens.map(t => Number.parseInt(t, 16));
  if (bytes.length === 1 && bytes[0] === 0xc3) return "ret";
  if (bytes.length === 2 && [0x7e, 0xeb].includes(bytes[0]!)) return (bytes[0] === 0xeb ? "jmp" : "jle") + " rel " + ((bytes[1]! << 24) >> 24);
  let at = 0, rex = 0;
  if (bytes[0]! >= 0x40 && bytes[0]! <= 0x4f) rex = bytes[at++]!;
  const opcode = bytes[at++]!, modrm = bytes[at], width = (rex & 8) ? 64 : 32;
  const r64 = ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi", "r8", "r9", "r10", "r11", "r12", "r13", "r14", "r15"];
  const r32 = ["eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi", "r8d", "r9d", "r10d", "r11d", "r12d", "r13d", "r14d", "r15d"];
  const names = width === 64 ? r64 : r32;
  const imm32 = (pos: number) => (bytes[pos]! | (bytes[pos+1]! << 8) | (bytes[pos+2]! << 16) | (bytes[pos+3]! << 24));
  if (opcode >= 0xb8 && opcode <= 0xbf && width === 32 && bytes.length === at + 4) return "mov " + r32[opcode - 0xb8 + ((rex & 1) ? 8 : 0)] + ", " + (imm32(at) >>> 0);
  if (modrm !== undefined && (modrm & 0xc0) === 0xc0) {
    const dst = (modrm & 7) + ((rex & 1) ? 8 : 0), src = ((modrm >> 3) & 7) + ((rex & 4) ? 8 : 0);
    if ([0x89, 0x31, 0x01, 0x39].includes(opcode) && bytes.length === at + 1) return ({ 137:"mov", 49:"xor", 1:"add", 57:"cmp" }[opcode] ?? "") + " " + names[dst] + ", " + names[src];
    if (opcode === 0xff && ((modrm >> 3) & 7) === 0 && bytes.length === at + 1) return "inc " + names[dst];
    if (opcode === 0xc7 && ((modrm >> 3) & 7) === 0 && bytes.length === at + 5) return "mov " + names[dst] + ", " + imm32(at + 1);
  }
  return "Unsupported or incomplete instruction in this teaching decoder.";
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
  else if (insn.op === "mov") next.gpr[insn.a] = writeSlice(a, insn.width, insn.immediate ? BigInt(insn.imm) : b);
  else if (insn.op === "xor" || insn.op === "add") {
    const alu = applyAlu(insn.op, a, b, insn.width);
    next.gpr[insn.a] = alu.result;
    next.flags = { ...next.flags, ...alu.flags, tf: next.flags.tf, if: next.flags.if, df: next.flags.df };
  } else if (insn.op === "inc") {
    const carry = next.flags.cf;
    const alu = applyAlu("INC", a, 0n, insn.width);
    next.gpr[insn.a] = alu.result;
    next.flags = { ...next.flags, ...alu.flags, cf: carry, tf: next.flags.tf, if: next.flags.if, df: next.flags.df };
  } else if (insn.op === "cmp") {
    const alu = applyAlu("CMP", a, b, insn.width);
    next.flags = { ...next.flags, ...alu.flags, tf: next.flags.tf, if: next.flags.if, df: next.flags.df };
  } else if (insn.op === "jmp" || insn.op === "jle") {
    const taken = insn.op === "jmp" || next.flags.zf === 1 || next.flags.sf !== next.flags.of;
    next.rip = taken ? insn.target : next.rip + 1;
    next.retired += 1;
    next.trace.push(insn.text);
    return next;
  }
  if (insn.width === 32 && ["mov", "add", "xor", "inc"].includes(insn.op)) next.gpr[insn.a] = writeSlice(a, 32, next.gpr[insn.a] ?? 0n);
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
