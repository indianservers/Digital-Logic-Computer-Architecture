import { createRegisterFile, writePort, type RegisterFile } from "../cpu/registerFile";
import { createRegisters, stepProgramCounter } from "../cpu/registers";
import { assemble } from "./assembler";
import { decode, MEM_WORDS, operate, type Decoded } from "./spec";

export interface Flags {
  z: 0 | 1;
  n: 0 | 1;
  c: 0 | 1;
  v: 0 | 1;
}

export interface CpuState {
  pc: number;
  instPc: number;
  ir: number;
  mar: number;
  mdr: number;
  regs: number[];
  imem: number[];
  dmem: number[];
  flags: Flags;
  halted: boolean;
  stage: "IF" | "ID" | "EX" | "MEM" | "WB" | "done";
  decoded: Decoded | null;
  alu: number;
  effective: number;
  cycles: number;
  retired: number;
  trace: string[];
  diff: string[];
}

export interface StageSignals {
  regWrite: 0 | 1;
  memRead: 0 | 1;
  memWrite: 0 | 1;
  aluSrc: "reg" | "imm" | "off";
  aluOp: string;
  pcWrite: 0 | 1;
  stage: CpuState["stage"];
}

const blankFlags = (): Flags => ({ z: 1, n: 0, c: 0, v: 0 });

export function blankMemory(): number[] {
  return Array.from({ length: MEM_WORDS }, () => 0);
}

export function loadProgram(source: string, data: Record<number, number> = {}): CpuState | { error: string } {
  const built = assemble(source);
  if (!built.ok) return { error: built.errors.map((item) => `Line ${item.line}: ${item.message}`).join("\n") };
  const imem = blankMemory();
  built.words.forEach((word, address) => {
    imem[address] = word;
  });
  const dmem = blankMemory();
  Object.entries(data).forEach(([address, value]) => {
    dmem[Number(address)] = value & 0xffff;
  });
  const machine = createRegisters(16, 1);
  const file = createRegisterFile(8, 16);
  return {
    pc: machine.pc,
    instPc: 0,
    ir: machine.ir,
    mar: machine.mar,
    mdr: machine.mdr,
    regs: file.values.slice(),
    imem,
    dmem,
    flags: { ...machine.flags },
    halted: false,
    stage: "IF",
    decoded: null,
    alu: 0,
    effective: 0,
    cycles: 0,
    retired: 0,
    trace: [],
    diff: [],
  };
}

export function signalsFor(decoded: Decoded | null, stage: CpuState["stage"]): StageSignals {
  const base: StageSignals = { regWrite: 0, memRead: 0, memWrite: 0, aluSrc: "off", aluOp: "NONE", pcWrite: 0, stage };
  if (!decoded) return stage === "IF" ? { ...base, memRead: 1, pcWrite: 1 } : base;
  if (stage === "IF") return { ...base, memRead: 1, pcWrite: 1, aluOp: "NONE" };
  if (stage === "ID") return { ...base, aluOp: decoded.aluOp };
  if (stage === "EX") return { ...base, aluSrc: decoded.aluSrc, aluOp: decoded.aluOp };
  if (stage === "MEM") return { ...base, memRead: decoded.memRead ? 1 : 0, memWrite: decoded.memWrite ? 1 : 0, aluOp: decoded.aluOp };
  if (stage === "WB") return { ...base, regWrite: decoded.regWrite ? 1 : 0, aluOp: decoded.aluOp };
  return base;
}

function writeReg(file: RegisterFile, index: number, value: number): number[] {
  return writePort(file, index, value & 0xffff, true).values.slice();
}

function fileOf(regs: number[]): RegisterFile {
  return { ...createRegisterFile(8, 16), values: regs.slice() };
}

export function stepStage(state: CpuState): CpuState {
  if (state.halted && state.stage === "done") return state;
  const next = { ...state, regs: state.regs.slice(), imem: state.imem.slice(), dmem: state.dmem.slice(), trace: state.trace.slice(), diff: [] as string[], flags: { ...state.flags } };
  next.cycles += 1;
  if (next.stage === "IF") {
    if (next.halted) {
      next.stage = "done";
      return next;
    }
    const machine = stepProgramCounter({ ...createRegisters(16, 1), pc: next.pc }, "increment");
    next.instPc = next.pc;
    next.mar = next.pc;
    next.mdr = next.imem[next.pc] ?? 0;
    next.ir = next.mdr;
    next.pc = machine.pc & 0xff;
    next.decoded = decode(next.ir);
    next.trace.push(`Fetch ${next.decoded.mnemonic} from address ${next.instPc}.`);
    next.stage = "ID";
    return next;
  }
  const decoded = next.decoded ?? decode(next.ir);
  if (next.stage === "ID") {
    next.trace.push(`Decode opcode ${decoded.opcode} as ${decoded.mnemonic}. ${decoded.explain}`);
    next.stage = "EX";
    return next;
  }
  if (next.stage === "EX") {
    const left = next.regs[decoded.rs1] ?? 0;
    const right = decoded.aluSrc === "imm" ? decoded.imm : (next.regs[decoded.rs2] ?? 0);
    if (decoded.aluOp !== "NONE") {
      const computed = operate(decoded.aluOp, left, right);
      next.alu = computed.result;
      next.flags = { z: computed.z, n: computed.n, c: computed.c, v: computed.v };
    } else next.alu = left;
    next.effective = ((next.regs[decoded.rs1] ?? 0) + decoded.imm) & 0xff;
    next.trace.push(`Execute ${decoded.mnemonic}. ALU/address result ${next.alu}.`);
    next.stage = "MEM";
    return next;
  }
  if (next.stage === "MEM") {
    if (decoded.mnemonic === "LOAD") {
      next.mar = next.effective;
      next.mdr = next.dmem[next.effective] ?? 0;
      next.trace.push(`Memory read at ${next.effective} returns ${next.mdr}.`);
    } else if (decoded.mnemonic === "STORE") {
      next.mar = next.effective;
      next.mdr = next.regs[decoded.rs2] ?? 0;
      const before = next.dmem[next.effective] ?? 0;
      next.dmem[next.effective] = next.mdr & 0xffff;
      next.diff.push(`M[${next.effective}]: ${before} → ${next.mdr & 0xffff}`);
      next.trace.push(`Memory write stores R${decoded.rs2} at ${next.effective}.`);
    } else if (decoded.mnemonic === "CALL") {
      const sp = ((next.regs[7] ?? 0) - 1) & 0xff;
      next.dmem[sp] = next.pc & 0xffff;
      next.regs = writeReg(fileOf(next.regs), 7, sp);
      next.pc = (next.instPc + decoded.imm) & 0xff;
      next.diff.push(`R7: ${(next.regs[7] ?? 0) + 1 & 0xff} → ${sp}`);
      next.trace.push(`CALL saves return ${next.dmem[sp]} at Mem[${sp}] and jumps.`);
    } else if (decoded.mnemonic === "RET") {
      const sp = next.regs[7] ?? 0;
      const target = next.dmem[sp & 0xff] ?? 0;
      next.pc = target & 0xff;
      next.regs = writeReg(fileOf(next.regs), 7, (sp + 1) & 0xff);
      next.trace.push(`RET loads PC ${target} from the stack.`);
    } else if (decoded.branch) {
      const equal = (next.regs[decoded.rs1] ?? 0) === (next.regs[decoded.rs2] ?? 0);
      const taken = decoded.mnemonic === "BEQ" ? equal : !equal;
      if (taken) next.pc = (next.instPc + decoded.imm) & 0xff;
      next.trace.push(taken ? `Branch taken to ${next.pc}.` : "Branch not taken.");
    } else if (decoded.mnemonic === "J") {
      next.pc = (next.instPc + decoded.imm) & 0xff;
      next.trace.push(`Jump to ${next.pc}.`);
    } else next.trace.push("Memory stage is idle for this instruction.");
    next.stage = "WB";
    return next;
  }
  if (decoded.regWrite && decoded.mnemonic !== "CALL" && decoded.mnemonic !== "RET") {
    const value = decoded.memToReg ? next.mdr : next.alu;
    const before = next.regs[decoded.rd] ?? 0;
    next.regs = writeReg(fileOf(next.regs), decoded.rd, value);
    next.diff.push(`R${decoded.rd}: ${before} → ${value & 0xffff}`);
    next.trace.push(`Write back ${value & 0xffff} into R${decoded.rd}.`);
  } else next.trace.push(decoded.regWrite ? "Stack pointer already updated." : "No register write-back.");
  next.retired += 1;
  if (decoded.mnemonic === "HALT") {
    next.halted = true;
    next.stage = "done";
    next.pc = next.instPc;
  } else next.stage = "IF";
  return next;
}

export function runToHalt(source: string, data: Record<number, number> = {}, limit = 400): CpuState {
  const loaded = loadProgram(source, data);
  if ("error" in loaded) {
    return { ...emptyState(), trace: [loaded.error] };
  }
  let state = loaded;
  let guard = 0;
  while (state.stage !== "done" && guard < limit) {
    state = stepStage(state);
    guard += 1;
  }
  return state;
}

function emptyState(): CpuState {
  return {
    pc: 0, instPc: 0, ir: 0, mar: 0, mdr: 0, regs: Array.from({ length: 8 }, () => 0), imem: blankMemory(), dmem: blankMemory(),
    flags: blankFlags(), halted: false, stage: "done", decoded: null, alu: 0, effective: 0, cycles: 0, retired: 0, trace: [], diff: [],
  };
}

export function architecturalRun(source: string, data: Record<number, number> = {}): CpuState {
  return runToHalt(source, data);
}
