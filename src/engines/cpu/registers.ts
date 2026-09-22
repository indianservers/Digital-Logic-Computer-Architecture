export interface CpuRegisters {
  width: number;
  pc: number;
  pcStep: number;
  ir: number;
  mar: number;
  mdr: number;
  mdrDirection: "read" | "write";
  sp: number;
  stackBase: number;
  flags: { z: 0 | 1; n: 0 | 1; c: 0 | 1; v: 0 | 1 };
}

export function createRegisters(width = 16, pcStep = 4): CpuRegisters {
  return {
    width,
    pc: 0,
    pcStep,
    ir: 0,
    mar: 0,
    mdr: 0,
    mdrDirection: "read",
    sp: 0x100,
    stackBase: 0x100,
    flags: { z: 1, n: 0, c: 0, v: 0 },
  };
}

export function maskWidth(width: number): number {
  if (width >= 31) return 0x7fffffff;
  return (1 << width) - 1;
}

export function stepProgramCounter(registers: CpuRegisters, mode: "increment" | "load" | "reset", loaded = 0): CpuRegisters {
  const mask = maskWidth(registers.width);
  if (mode === "reset") return { ...registers, pc: 0 };
  if (mode === "load") return { ...registers, pc: loaded & mask };
  return { ...registers, pc: (registers.pc + registers.pcStep) & mask };
}

export function loadRegister(registers: CpuRegisters, name: "ir" | "mar" | "mdr", value: number, enabled = true): CpuRegisters {
  if (!enabled) return registers;
  const stored = value & maskWidth(registers.width);
  return { ...registers, [name]: stored };
}

export interface StackChange {
  registers: CpuRegisters;
  memory: Record<string, number>;
  explain: string;
}

export function pushStack(registers: CpuRegisters, memory: Record<string, number>, value: number): StackChange {
  const sp = (registers.sp - 1) & maskWidth(registers.width);
  return {
    registers: { ...registers, sp },
    memory: { ...memory, [String(sp)]: value & maskWidth(registers.width) },
    explain: `Push writes the value and moves SP from ${registers.sp} to ${sp}.`,
  };
}

export function popStack(registers: CpuRegisters, memory: Record<string, number>): StackChange & { value: number | null } {
  const value = memory[String(registers.sp)] ?? null;
  const sp = (registers.sp + 1) & maskWidth(registers.width);
  return {
    registers: { ...registers, sp },
    memory,
    value,
    explain: `Pop reads address ${registers.sp} and moves SP to ${sp}.`,
  };
}
