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
