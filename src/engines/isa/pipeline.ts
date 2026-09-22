import { decode, operate, type Decoded } from "./spec";
import { loadProgram } from "./cpu";

export type Policy = "not-taken" | "taken" | "btfnt" | "one-bit" | "two-bit";

export interface Slot {
  kind: "empty" | "bubble" | "inst";
  pc: number;
  word: number;
  text: string;
  decoded: Decoded | null;
  v1: number;
  v2: number;
  alu: number;
  loaded: number;
  predicted: boolean;
  mark: string;
}

export interface PipeState {
  pc: number;
  regs: number[];
  imem: number[];
  dmem: number[];
  IF: Slot;
  ID: Slot;
  EX: Slot;
  MEM: Slot;
  WB: Slot;
  cycles: number;
  retired: number;
  stalls: number;
  bubbles: number;
  forwards: number;
  flushes: number;
  branches: number;
  correct: number;
  mispredicts: number;
  halted: boolean;
  forwarding: boolean;
  unified: boolean;
  policy: Policy;
  bht: number[];
  rows: Array<{ text: string; cells: string[] }>;
  log: string[];
}

const NAMES = ["SNT", "WNT", "WT", "ST"];

export function predictorName(state: number, policy: Policy): string {
  if (policy === "one-bit") return state >= 1 ? "Taken" : "Not taken";
  return NAMES[Math.max(0, Math.min(3, state))] ?? "WNT";
}

export function updatePredictor(state: number, taken: boolean, policy: Policy): number {
  if (policy === "one-bit") return taken ? 1 : 0;
  if (policy === "two-bit") return taken ? Math.min(3, state + 1) : Math.max(0, state - 1);
  return state;
}

function empty(): Slot {
  return { kind: "empty", pc: -1, word: 0, text: "", decoded: null, v1: 0, v2: 0, alu: 0, loaded: 0, predicted: false, mark: "" };
}

function bubble(mark = "bubble"): Slot {
  return { ...empty(), kind: "bubble", text: "BUBBLE", mark };
}

function reads(slot: Slot): number[] {
  const decoded = slot.decoded;
  if (!decoded || slot.kind !== "inst") return [];
  if (["ADD", "SUB", "AND", "OR", "XOR", "SLL", "SRL", "SRA", "SLT", "BEQ", "BNE"].includes(decoded.mnemonic)) return [decoded.rs1, decoded.rs2];
  if (decoded.mnemonic === "STORE") return [decoded.rs1, decoded.rs2];
  if (decoded.mnemonic === "ADDI" || decoded.mnemonic === "LOAD") return [decoded.rs1];
  if (decoded.mnemonic === "CALL" || decoded.mnemonic === "RET") return [7];
  return [];
}

function writes(slot: Slot): number | null {
  const decoded = slot.decoded;
  if (!decoded || slot.kind !== "inst" || !decoded.regWrite) return null;
  return decoded.rd;
}

function conflicts(reader: Slot, writer: Slot): boolean {
  const dest = writes(writer);
  if (dest === null) return false;
  return reads(reader).includes(dest);
}

function guess(decoded: Decoded, pc: number, policy: Policy, bht: number[]): boolean {
  if (decoded.mnemonic === "J" || decoded.mnemonic === "CALL") return true;
  if (!decoded.branch) return false;
  if (policy === "taken") return true;
  if (policy === "btfnt") return decoded.imm < 0;
  const entry = bht[pc & 7] ?? (policy === "two-bit" ? 1 : 0);
  if (policy === "one-bit") return entry >= 1;
  return entry >= 2;
}

export function createPipe(source: string, options: { forwarding?: boolean; unified?: boolean; policy?: Policy; data?: Record<number, number> } = {}): PipeState | { error: string } {
  const loaded = loadProgram(source, options.data);
  if ("error" in loaded) return loaded;
  const dmem = options.unified ? loaded.imem.map((word, index) => loaded.dmem[index] || word) : loaded.dmem;
  return {
    pc: 0,
    regs: loaded.regs.slice(),
    imem: loaded.imem.slice(),
    dmem,
    IF: empty(), ID: empty(), EX: empty(), MEM: empty(), WB: empty(),
    cycles: 0, retired: 0, stalls: 0, bubbles: 0, forwards: 0, flushes: 0, branches: 0, correct: 0, mispredicts: 0,
    halted: false,
    forwarding: options.forwarding ?? true,
    unified: options.unified ?? false,
    policy: options.policy ?? "not-taken",
    bht: Array.from({ length: 8 }, () => options.policy === "two-bit" ? 1 : 0),
    rows: [],
    log: [],
  };
}

function fetchSlot(state: PipeState, pc: number): { slot: Slot; nextPc: number } {
  const word = (state.unified ? state.dmem[pc] : state.imem[pc]) ?? 0;
  const decoded = decode(word);
  const predicted = guess(decoded, pc, state.policy, state.bht);
  const slot: Slot = { kind: "inst", pc, word, text: decoded.mnemonic, decoded, v1: 0, v2: 0, alu: 0, loaded: 0, predicted, mark: "" };
  let nextPc = (pc + 1) & 0xff;
  if (decoded.mnemonic === "HALT") nextPc = pc;
  else if (predicted && (decoded.branch || decoded.mnemonic === "J" || decoded.mnemonic === "CALL")) nextPc = (pc + decoded.imm) & 0xff;
  return { slot, nextPc };
}

function compute(slot: Slot): Slot {
  const decoded = slot.decoded;
  if (!decoded || slot.kind !== "inst") return slot;
  if (decoded.aluOp === "NONE") return { ...slot, alu: slot.v1 };
  const right = decoded.aluSrc === "imm" ? decoded.imm : slot.v2;
  const computed = operate(decoded.aluOp, slot.v1, right);
  return { ...slot, alu: computed.result };
}

function addressOf(slot: Slot): number {
  const decoded = slot.decoded;
  if (!decoded) return 0;
  return (slot.v1 + decoded.imm) & 0xff;
}

export function stepPipe(state: PipeState): PipeState {
  if (state.halted) return state;
  const next: PipeState = {
    ...state,
    regs: state.regs.slice(),
    imem: state.imem.slice(),
    dmem: state.dmem.slice(),
    bht: state.bht.slice(),
    rows: state.rows.map((row) => ({ text: row.text, cells: row.cells.slice() })),
    log: state.log.slice(),
  };
  next.cycles += 1;
  const exComputed = compute(state.EX);
  let stall = false;
  let forward = "";
  if (conflicts(state.ID, state.EX)) {
    if (next.forwarding && state.EX.decoded?.mnemonic !== "LOAD") forward = "EX/MEM";
    else stall = true;
  } else if (conflicts(state.ID, state.MEM)) {
    if (next.forwarding) forward = "MEM/WB";
    else stall = true;
  }
  if (stall) next.stalls += 1;
  if (forward) next.forwards += 1;

  const memSlot = { ...state.MEM };
  if (memSlot.kind === "inst" && memSlot.decoded?.mnemonic === "LOAD") {
    memSlot.loaded = next.dmem[addressOf(memSlot)] ?? 0;
  }
  if (memSlot.kind === "inst" && memSlot.decoded?.mnemonic === "STORE") {
    next.dmem[addressOf(memSlot)] = memSlot.v2 & 0xffff;
  }
  if (memSlot.kind === "inst" && memSlot.decoded?.mnemonic === "CALL") {
    const sp = ((next.regs[7] ?? 0) - 1) & 0xff;
    next.dmem[sp] = ((memSlot.pc + 1) & 0xff);
    next.regs[7] = sp;
  }
  if (memSlot.kind === "inst" && memSlot.decoded?.mnemonic === "RET") {
    const sp = next.regs[7] ?? 0;
    memSlot.loaded = next.dmem[sp] ?? 0;
    next.regs[7] = (sp + 1) & 0xff;
    next.pc = memSlot.loaded & 0xff;
  }

  let flush = false;
  let redirect = next.pc;
  const branch = exComputed.decoded;
  if (exComputed.kind === "inst" && branch?.branch) {
    next.branches += 1;
    const equal = exComputed.v1 === exComputed.v2;
    const taken = branch.mnemonic === "BEQ" ? equal : !equal;
    const index = exComputed.pc & 7;
    next.bht[index] = updatePredictor(next.bht[index] ?? 0, taken, next.policy);
    const correctTarget = taken ? (exComputed.pc + branch.imm) & 0xff : (exComputed.pc + 1) & 0xff;
    if (taken !== exComputed.predicted) {
      flush = true;
      redirect = correctTarget;
      next.mispredicts += 1;
      next.flushes += 1;
      next.log.push(`Prediction was ${exComputed.predicted ? "taken" : "not taken"}, but the branch resolved ${taken ? "taken" : "not taken"}. Wrong-path instructions are flushed.`);
    } else next.correct += 1;
  }

  const wb = memSlot;
  if (wb.kind === "inst" && wb.decoded?.regWrite && wb.decoded.mnemonic !== "CALL" && wb.decoded.mnemonic !== "RET") {
    const value = wb.decoded.memToReg ? wb.loaded : wb.alu;
    next.regs[wb.decoded.rd] = value & 0xffff;
  }
  if (wb.kind === "inst") {
    next.retired += 1;
    if (wb.decoded?.mnemonic === "HALT") {
      next.halted = true;
      next.pc = wb.pc;
    }
  }

  const capture = (slot: Slot): Slot => {
    if (slot.kind !== "inst" || !slot.decoded) return slot;
    let v1 = next.regs[slot.decoded.rs1] ?? 0;
    let v2 = next.regs[slot.decoded.rs2] ?? 0;
    const apply = (producer: Slot, label: string) => {
      const dest = writes(producer);
      if (dest === null) return;
      const produced = producer.decoded?.memToReg ? producer.loaded : producer.decoded?.mnemonic === "LOAD" ? producer.loaded : (producer === exComputed ? exComputed.alu : producer.alu);
      if (slot.decoded?.rs1 === dest) {
        v1 = produced;
        forward = label;
      }
      if (slot.decoded?.rs2 === dest && slot.decoded.aluSrc !== "imm" || (slot.decoded?.mnemonic === "STORE" && slot.decoded.rs2 === dest)) {
        if (slot.decoded.rs2 === dest) v2 = produced;
      }
    };
    if (forward === "EX/MEM") apply(exComputed, "EX/MEM");
    if (forward === "MEM/WB") apply(memSlot, "MEM/WB");
    return { ...slot, v1, v2, mark: forward || slot.mark };
  };

  const structural = next.unified && ((memSlot.decoded?.memRead ?? false) || (memSlot.decoded?.memWrite ?? false)) && !stall && !flush;
  if (structural) {
    next.stalls += 1;
    next.log.push("Instruction fetch and data memory want the same memory in this cycle, so fetch waits.");
  }

  next.WB = wb.kind === "inst" ? { ...wb, mark: wb.mark || "WB" } : wb;
  next.MEM = exComputed.kind === "empty" ? empty() : { ...exComputed, mark: exComputed.mark };
  next.EX = stall || flush || state.ID.kind !== "inst" ? (stall || flush ? bubble(flush ? "flush" : "bubble") : empty()) : capture(state.ID);
  if (next.EX.kind === "bubble") next.bubbles += 1;

  if (flush) {
    next.ID = bubble("flush");
    next.IF = bubble("flush");
    next.pc = redirect;
    next.bubbles += 2;
  } else if (stall) {
    next.ID = { ...state.ID, mark: "stall" };
    next.IF = { ...state.IF, mark: "stall" };
  } else if (structural) {
    next.ID = state.IF.kind === "inst" ? { ...state.IF, mark: "" } : empty();
    next.IF = bubble("bubble");
    next.bubbles += 1;
  } else if (!next.halted) {
    const fetched = fetchSlot(next, next.pc);
    next.IF = fetched.slot;
    next.ID = state.IF.kind === "inst" ? { ...state.IF } : empty();
    if (fetched.slot.decoded?.mnemonic !== "HALT") next.pc = fetched.nextPc;
  } else {
    next.ID = empty();
    next.IF = empty();
  }

  const live = [next.IF, next.ID, next.EX, next.MEM, next.WB];
  for (const slot of live) {
    if (slot.kind !== "inst") continue;
    let row = next.rows.find((item) => item.text === `${slot.text} @${slot.pc}`);
    if (!row) {
      row = { text: `${slot.text} @${slot.pc}`, cells: [] };
      next.rows.push(row);
    }
    while (row.cells.length < next.cycles - 1) row.cells.push("");
    const stage = slot === next.IF ? "IF" : slot === next.ID ? (slot.mark === "stall" ? "ST" : "ID") : slot === next.EX ? "EX" : slot === next.MEM ? "MEM" : "WB";
    row.cells[next.cycles - 1] = slot.mark === "stall" && stage === "ID" ? "ST" : stage;
  }
  return next;
}

export function runPipe(source: string, options: { forwarding?: boolean; unified?: boolean; policy?: Policy; data?: Record<number, number> } = {}, limit = 400): PipeState {
  const created = createPipe(source, options);
  if ("error" in created) {
    return {
      pc: 0, regs: [], imem: [], dmem: [], IF: empty(), ID: empty(), EX: empty(), MEM: empty(), WB: empty(),
      cycles: 0, retired: 0, stalls: 0, bubbles: 0, forwards: 0, flushes: 0, branches: 0, correct: 0, mispredicts: 0,
      halted: true, forwarding: true, unified: false, policy: "not-taken", bht: [], rows: [], log: [created.error],
    };
  }
  let state = created;
  let guard = 0;
  while (!state.halted && guard < limit) {
    const busy = [state.IF, state.ID, state.EX, state.MEM, state.WB].some((slot) => slot.kind === "inst");
    if (state.cycles > 0 && !busy) break;
    state = stepPipe(state);
    guard += 1;
  }
  return state;
}

export function nonPipelinedCycles(instructions: number): number {
  return instructions * 5;
}

export function speedup(nonPipelined: number, pipelined: number): number {
  if (pipelined === 0) return 0;
  return nonPipelined / pipelined;
}
