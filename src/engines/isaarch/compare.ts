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

export interface SumSim {
  values: number[];
  base: number;
  ptr: number;
  sum: number;
  count: number;
  temp: number;
  step: number;
  index: number;
}

export const SUM_STEPS = [
  { n: 1, title: "Initialize the result", detail: "The sum register starts at zero before any element is read." },
  { n: 2, title: "Initialize the count", detail: "The counter register is the number of 32-bit elements." },
  { n: 3, title: "Establish the array pointer", detail: "The pointer register holds the address of the first element." },
  { n: 4, title: "Load the current array element", detail: "Each ISA loads a 32-bit value from the pointer into a temporary register." },
  { n: 5, title: "Add the item into the sum", detail: "The temporary is added to the running sum." },
  { n: 6, title: "Advance the pointer", detail: "The pointer moves forward by 4 bytes, one 32-bit integer." },
  { n: 7, title: "Decrement the count", detail: "One element has been consumed." },
  { n: 8, title: "Branch if elements remain", detail: "A non-zero count returns to the load. Zero falls through." },
  { n: 9, title: "Finish", detail: "The sum register holds the total of the array." },
];

export function blankSum(values: number[], base = 0x1000): SumSim {
  return { values: values.slice(), base, ptr: base, sum: 0, count: values.length, temp: 0, step: 0, index: 0 };
}

export function stepSum(state: SumSim): SumSim {
  if (state.step === 9 || state.values.length === 0) return state.step === 9 ? state : { ...state, step: 9, sum: 0, count: 0 };
  let step = state.step + 1;
  if (state.step === 8) step = state.count > 0 ? 4 : 9;
  const next: SumSim = { ...state, values: state.values.slice(), step };
  if (step === 1) {
    next.sum = 0;
    next.count = state.values.length;
    next.ptr = state.base;
    next.temp = 0;
    next.index = 0;
  } else if (step === 2) next.count = state.values.length;
  else if (step === 3) {
    next.ptr = state.base;
    next.index = 0;
  } else if (step === 4) next.temp = state.values[next.index] ?? 0;
  else if (step === 5) next.sum = state.sum + next.temp;
  else if (step === 6) next.ptr = state.ptr + 4;
  else if (step === 7) next.count = state.count - 1;
  else if (step === 8 && next.count > 0) next.index = state.index + 1;
  return next;
}

export function runSum(values: number[]): number {
  let state = blankSum(values);
  for (let i = 0; i < values.length * 8 + 6; i += 1) {
    state = stepSum(state);
    if (state.step === 9) break;
  }
  return state.sum;
}
