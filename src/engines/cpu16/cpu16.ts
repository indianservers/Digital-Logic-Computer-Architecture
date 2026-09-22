import { createRegisterFile, writePort } from "../cpu/registerFile";
import { loadProgram, stepStage, type CpuState } from "../isa/cpu";

export interface InterruptLab {
  cpu: CpuState;
  irq: boolean;
  inHandler: boolean;
  savedPc: number | null;
  handler: number;
  note: string;
}

function fileOf(regs: number[]) {
  return { ...createRegisterFile(8, 16), values: regs.slice() };
}

export function wrapCpu(cpu: CpuState, extra?: Partial<InterruptLab>): InterruptLab {
  return {
    cpu,
    irq: extra?.irq ?? false,
    inHandler: extra?.inHandler ?? false,
    savedPc: extra?.savedPc ?? null,
    handler: extra?.handler ?? 16,
    note: extra?.note ?? "Educational interrupt model. It is not a specific ISA's exception hardware.",
  };
}

export function load16(source: string, data: Record<number, number> = {}): InterruptLab | { error: string } {
  const cpu = loadProgram(source, data);
  if ("error" in cpu) return cpu;
  return wrapCpu(cpu);
}

export function step16(lab: InterruptLab): InterruptLab {
  if (lab.cpu.halted && lab.cpu.stage === "done") return lab;
  if (lab.irq && lab.cpu.stage === "IF" && !lab.inHandler && !lab.cpu.halted) {
    return serviceInterrupt(lab);
  }
  return { ...lab, cpu: stepStage(lab.cpu) };
}

export function run16(source: string, data: Record<number, number> = {}, limit = 400): InterruptLab | { error: string } {
  const loaded = load16(source, data);
  if ("error" in loaded) return loaded;
  let lab = loaded;
  let guard = 0;
  while (!(lab.cpu.halted && lab.cpu.stage === "done") && guard < limit) {
    lab = step16(lab);
    guard += 1;
  }
  return lab;
}

export function requestIrq(lab: InterruptLab): InterruptLab {
  return { ...lab, irq: true, note: "IRQ is pending. It is taken at the next instruction boundary (IF)." };
}

export function serviceInterrupt(lab: InterruptLab): InterruptLab {
  const cpu = { ...lab.cpu, regs: lab.cpu.regs.slice(), dmem: lab.cpu.dmem.slice(), trace: lab.cpu.trace.slice(), diff: [] as string[] };
  const saved = cpu.pc & 0xff;
  const sp = ((cpu.regs[7] ?? 0) - 1) & 0xff;
  cpu.dmem[sp] = saved;
  cpu.regs = writePort(fileOf(cpu.regs), 7, sp, true).values.slice();
  cpu.pc = lab.handler & 0xff;
  cpu.trace.push(`Educational IRQ: save PC ${saved} at R7=${sp}, jump to handler ${cpu.pc}.`);
  cpu.diff.push(`R7 → ${sp}`);
  cpu.cycles += 1;
  return {
    ...lab,
    cpu,
    irq: false,
    inHandler: true,
    savedPc: saved,
    note: "Context saved on the software stack (R7). This is an educational abstraction.",
  };
}

export function returnFromInterrupt(lab: InterruptLab): InterruptLab {
  const cpu = { ...lab.cpu, regs: lab.cpu.regs.slice(), dmem: lab.cpu.dmem.slice(), trace: lab.cpu.trace.slice(), diff: [] as string[] };
  const sp = cpu.regs[7] ?? 0;
  if (lab.savedPc === null && cpu.dmem[sp & 0xff] === undefined) {
    cpu.trace.push("Stack underflow.");
    return { ...lab, cpu, note: "Stack underflow" };
  }
  const target = cpu.dmem[sp & 0xff] ?? lab.savedPc ?? 0;
  cpu.pc = target & 0xff;
  cpu.regs = writePort(fileOf(cpu.regs), 7, (sp + 1) & 0xff, true).values.slice();
  cpu.stage = "IF";
  cpu.trace.push(`Return from interrupt to PC ${cpu.pc}.`);
  return {
    ...lab,
    cpu,
    inHandler: false,
    savedPc: null,
    note: "Program resumes after the interrupted instruction boundary.",
  };
}

export function pushReg(cpu: CpuState, index: number): CpuState | { error: string } {
  if (index < 0 || index > 7) return { error: "Unknown register" };
  const next = { ...cpu, regs: cpu.regs.slice(), dmem: cpu.dmem.slice(), trace: cpu.trace.slice(), diff: [] as string[] };
  const sp = ((next.regs[7] ?? 0) - 1) & 0xff;
  next.dmem[sp] = (next.regs[index] ?? 0) & 0xffff;
  next.regs = writePort(fileOf(next.regs), 7, sp, true).values.slice();
  next.trace.push(`PUSH R${index} to MEM[${sp}].`);
  next.diff.push(`R7 → ${sp}`);
  return next;
}

export function popReg(cpu: CpuState, index: number): CpuState | { error: string } {
  if (index < 0 || index > 7) return { error: "Unknown register" };
  const sp = cpu.regs[7] ?? 0;
  if (sp === 0 && cpu.dmem[0] === 0 && (cpu.trace.includes("empty-stack-guard") || false)) {
    return { error: "Stack underflow" };
  }
  const next = { ...cpu, regs: cpu.regs.slice(), dmem: cpu.dmem.slice(), trace: cpu.trace.slice(), diff: [] as string[] };
  const value = next.dmem[sp & 0xff] ?? 0;
  next.regs = writePort(fileOf(next.regs), index, value, true).values.slice();
  next.regs = writePort(fileOf(next.regs), 7, (sp + 1) & 0xff, true).values.slice();
  next.trace.push(`POP R${index} from MEM[${sp}].`);
  return next;
}

export function compareWidths(): Array<{ trait: string; eight: string; sixteen: string }> {
  return [
    { trait: "Datapath width", eight: "8 bits", sixteen: "16 bits" },
    { trait: "Register width", eight: "A and B are 8-bit", sixteen: "R0–R7 are 16-bit" },
    { trait: "Address space", eight: "256 bytes (8-bit address)", sixteen: "256 words (8-bit word address in this teaching CPU)" },
    { trait: "Instruction complexity", eight: "Accumulator ISA, 1–2 bytes", sixteen: "Register-register ISA with immediates" },
    { trait: "Register file", eight: "Two working registers", sixteen: "Eight general-purpose registers" },
    { trait: "Stack support", eight: "Not required in the 8-bit teaching set", sixteen: "R7 is the stack pointer for CALL/RET" },
    { trait: "Call / return", eight: "Can be built from JMP and memory", sixteen: "CALL and RET are first-class" },
  ];
}
