import { alu, type AluOp } from "../digital/arithmetic";
import { mux } from "../digital/routing";
import { fromUnsigned, signExtend, toUnsigned, zeroExtend } from "../digital/vector";
import { readPorts, writePort, type RegisterFile } from "./registerFile";
import { maskWidth, type CpuRegisters } from "./registers";

export interface ControlSignals {
  pcWrite: boolean;
  irWrite: boolean;
  regWrite: boolean;
  aluSrc: 0 | 1;
  memRead: boolean;
  memWrite: boolean;
  pcSource: 0 | 1;
  writeSource: 0 | 1;
}

export const idleControls = (): ControlSignals => ({
  pcWrite: false,
  irWrite: false,
  regWrite: false,
  aluSrc: 0,
  memRead: false,
  memWrite: false,
  pcSource: 0,
  writeSource: 0,
});

export function extendBits(bits: string, width: number, signed: boolean): string {
  const vector = bits.split("").map((bit) => (bit === "1" ? 1 : 0));
  const extended = signed ? signExtend(vector, width) : zeroExtend(vector, width);
  return extended.map((bit) => (bit === 1 ? "1" : "0")).join("");
}

export function aluSource(registerB: number, immediate: number, width: number, aluSrc: 0 | 1): { value: number; explain: string } {
  const left = fromUnsigned(registerB, width);
  const right = fromUnsigned(immediate, width);
  const picked = left.map((bit, index) => {
    const chosen = mux([bit, right[index] ?? 0], [aluSrc]).y;
    return chosen === 1 ? 1 as const : 0 as const;
  });
  const value = toUnsigned(picked) ?? 0;
  return {
    value,
    explain: aluSrc === 0
      ? "ALUSrc selects register B, so the ALU receives both register outputs."
      : "ALUSrc selects the immediate, so the ALU receives register A and the extended immediate.",
  };
}

export interface DatapathView {
  registers: CpuRegisters;
  file: RegisterFile;
  result: number;
  flags: CpuRegisters["flags"];
  explain: string[];
}

export function manualDatapath(args: {
  registers: CpuRegisters;
  file: RegisterFile;
  readA: number;
  readB: number;
  writeAddress: number;
  immediate: number;
  op: AluOp;
  controls: ControlSignals;
  memory: Record<string, number>;
}): DatapathView & { memory: Record<string, number> } {
  const notes: string[] = [];
  let registers = args.registers;
  let file = args.file;
  let memory = { ...args.memory };
  const reads = readPorts(file, args.readA, args.readB);
  const source = aluSource(reads.b, args.immediate, file.width, args.controls.aluSrc);
  notes.push(source.explain);
  const left = fromUnsigned(reads.a, file.width);
  const right = fromUnsigned(source.value, file.width);
  const computed = alu(left, right, args.op);
  const result = toUnsigned(computed.result) ?? 0;
  notes.push(`ALU ${args.op} produces ${result}.`);
  if (args.controls.memRead) {
    const data = memory[String(registers.mar)] ?? 0;
    registers = { ...registers, mdr: data & maskWidth(registers.width), mdrDirection: "read" };
    notes.push(`MemRead loads MDR from address ${registers.mar}.`);
  }
  if (args.controls.memWrite) {
    memory[String(registers.mar)] = registers.mdr;
    registers = { ...registers, mdrDirection: "write" };
    notes.push(`MemWrite stores MDR at address ${registers.mar}.`);
  }
  const writeData = args.controls.writeSource === 0 ? result : registers.mdr;
  if (args.controls.regWrite) {
    file = writePort(file, args.writeAddress, writeData, true);
    notes.push("RegWrite stores the selected result in the destination register.");
  }
  if (args.controls.irWrite) {
    registers = { ...registers, ir: writeData & maskWidth(registers.width) };
    notes.push("IRWrite captures the current word into the instruction register.");
  }
  if (args.controls.pcWrite) {
    const next = args.controls.pcSource === 0 ? (registers.pc + registers.pcStep) & maskWidth(registers.width) : result;
    registers = { ...registers, pc: next };
    notes.push(args.controls.pcSource === 0 ? "PCWrite increments the program counter." : "PCWrite loads the ALU result into the program counter.");
  }
  registers = { ...registers, flags: { z: computed.zero, n: computed.negative, c: computed.carry, v: computed.overflow } };
  return { registers, file, result, flags: registers.flags, explain: notes, memory };
}
