export interface SequenceStep {
  isa: "RISC-V" | "ARM" | "x86";
  lines: string[];
  note: string;
}

export const TASKS: Record<string, { title: string; steps: SequenceStep[] }> = {
  add: {
    title: "C = A + B",
    steps: [
      { isa: "RISC-V", lines: ["add x3, x1, x2"], note: "Register-register. Teaching sequence, not a compiler guarantee." },
      { isa: "ARM", lines: ["ADD X3, X1, X2"], note: "Same architectural idea: dest, src1, src2. Teaching AArch64-style syntax." },
      { isa: "x86", lines: ["add eax, ebx"], note: "Two-operand form: EAX becomes A+B. Source EAX is overwritten." },
    ],
  },
  loadaddstore: {
    title: "Load, add constant, store",
    steps: [
      { isa: "RISC-V", lines: ["lw x1, 0(x2)", "addi x1, x1, 5", "sw x1, 0(x2)"], note: "Explicit load and store. Immediate add is a separate instruction." },
      { isa: "ARM", lines: ["LDR X1, [X2]", "ADD X1, X1, #5", "STR X1, [X2]"], note: "Load/store architecture with an immediate arithmetic form." },
      { isa: "x86", lines: ["add dword ptr [rdx], 5"], note: "One instruction can add a constant into a memory operand. Internally it may become several micro-ops." },
    ],
  },
};

export const ENCODING_NOTES = [
  { isa: "RISC-V", length: "32-bit base (RV32I)", shape: "Fixed fields; B/J immediates are scrambled then sign-extended." },
  { isa: "ARM", length: "32-bit AArch64 teaching examples", shape: "Fixed-width in this explorer. Historical ARM/Thumb length mixing is out of scope." },
  { isa: "x86", length: "1–15 bytes typical", shape: "Optional prefix, opcode, ModRM, SIB, displacement, immediate." },
];

export const REG_MODELS = [
  { isa: "RISC-V", count: "32 × x0–x31 (RV32I)", note: "x0 is hardwired zero. ABI names are aliases, not extra registers." },
  { isa: "ARM", count: "31 × X0–X30 + SP (teaching AArch64)", note: "XZR/SP share encoding 31 depending on context. This lab keeps them conceptually distinct." },
  { isa: "x86", count: "16 × RAX–R15 in x86-64", note: "Legacy 8-bit/16-bit/32-bit views overlay the same architectural register." },
];

export const MEMORY_MODELS = [
  { isa: "RISC-V", style: "Load/store", note: "ALU instructions use registers. Memory is only lw/sw in this subset." },
  { isa: "ARM", style: "Load/store", note: "LDR/STR move between registers and memory. Addressing modes are richer than this lab." },
  { isa: "x86", style: "Register or memory operand", note: "Many ALU ops can name a memory operand. Flexibility is not a ranking." },
];

export const ECOSYSTEM = [
  { isa: "RISC-V", role: "Open ISA ecosystem and customizable implementations, from teaching cores to SoCs." },
  { isa: "ARM", role: "Broad use in mobile, embedded, and server contexts via licensed microarchitectures." },
  { isa: "x86", role: "Broad desktop and server legacy, with a large existing software ecosystem." },
];
