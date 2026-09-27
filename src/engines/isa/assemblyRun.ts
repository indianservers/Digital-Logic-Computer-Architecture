import { formatInstruction } from "./assembler";
import { stepStage, type CpuState, type Flags } from "./cpu";
import { decode } from "./spec";

export const SAMPLE_ADD = `ADDI R1, R0, 5   ; R1 = 5
ADDI R2, R0, 3   ; R2 = 3
ADD R3, R1, R2   ; R3 = R1 + R2
STORE R3, 8(R0)  ; Mem[8] = R3
HALT
`;

export const SAMPLE_LOOP = `ADDI R1, R0, 5   ; counter = 5
ADDI R2, R0, 0   ; sum = 0
ADDI R4, R0, 1   ; step = 1
LOOP:
ADD R2, R2, R1   ; sum += counter
SUB R1, R1, R4   ; counter -= 1
BNE R1, R0, LOOP ; loop while R1 != 0
STORE R2, 8(R0)  ; store the sum
HALT
`;

export interface TraceRow {
  index: number;
  pc: number;
  pcAfter: number;
  text: string;
  regs: string[];
  mem: string[];
  flags: string;
}

export function wordHex(value: number): string {
  return `0x${(value & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
}

function flagText(before: Flags, after: Flags): string {
  const parts: string[] = [];
  if (before.n !== after.n) parts.push(`N ${before.n}→${after.n}`);
  if (before.z !== after.z) parts.push(`Z ${before.z}→${after.z}`);
  if (before.c !== after.c) parts.push(`C ${before.c}→${after.c}`);
  if (before.v !== after.v) parts.push(`V ${before.v}→${after.v}`);
  return parts.join(" ");
}

export function stepInstruction(state: CpuState, index: number): { state: CpuState; row: TraceRow | null } {
  if (state.halted && state.stage === "done") return { state, row: null };
  const pc = state.stage === "IF" ? state.pc : state.instPc;
  const flagsBefore = { ...state.flags };
  const diffs: string[] = [];
  let next = state;
  let guard = 0;
  do {
    next = stepStage(next);
    diffs.push(...next.diff);
    guard += 1;
  } while (next.stage !== "IF" && next.stage !== "done" && guard < 8);
  const decoded = next.decoded ?? decode(next.ir);
  const sequential = (pc + 1) & 0xff;
  const changes = diffs.slice();
  if (!next.halted && next.pc !== sequential) changes.push(`PC: ${wordHex(sequential)} → ${wordHex(next.pc)}`);
  return {
    state: next,
    row: {
      index,
      pc,
      pcAfter: next.pc,
      text: formatInstruction(decoded),
      regs: changes.filter((line) => line.startsWith("R") || line.startsWith("PC")),
      mem: changes.filter((line) => line.startsWith("M")),
      flags: flagText(flagsBefore, next.flags),
    },
  };
}

export function runUntil(state: CpuState, breakpoints: number[], startIndex = 1, limit = 80, resume = false): { state: CpuState; rows: TraceRow[]; pausedAt: number | null } {
  const rows: TraceRow[] = [];
  let current = state;
  let skipOnce = resume;
  while (current.stage !== "done" && rows.length < limit) {
    if (current.stage === "IF" && breakpoints.includes(current.pc)) {
      if (skipOnce) skipOnce = false;
      else return { state: current, rows, pausedAt: current.pc };
    }
    const stepped = stepInstruction(current, startIndex + rows.length);
    if (!stepped.row) break;
    rows.push(stepped.row);
    current = stepped.state;
  }
  return { state: current, rows, pausedAt: null };
}

export function stepOver(state: CpuState, index: number): { state: CpuState; rows: TraceRow[] } {
  const pc = state.stage === "IF" ? state.pc : state.instPc;
  const word = state.stage === "IF" ? (state.imem[pc] ?? 0) : state.ir;
  const first = stepInstruction(state, index);
  if (!first.row || decode(word).mnemonic !== "CALL") return { state: first.state, rows: first.row ? [first.row] : [] };
  const returned = runUntil(first.state, [(pc + 1) & 0xff], index + 1, 40);
  return { state: returned.state, rows: [first.row, ...returned.rows] };
}

export function stepFetch(state: CpuState): { state: CpuState; row: TraceRow | null } {
  if (state.halted && state.stage === "done") return { state, row: null };
  if (state.stage !== "IF") {
    const finished = stepInstruction(state, 0);
    let next = finished.state;
    if (next.stage === "IF" && !next.halted) next = stepStage(next);
    return { state: next, row: finished.row };
  }
  return { state: stepStage(state), row: null };
}
