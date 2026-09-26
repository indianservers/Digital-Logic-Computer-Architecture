import { stepTwo, type Two } from "./predictor";

export type SpecKind = "alu" | "load" | "store" | "branch";
export type PredictorMode = "alwaysT" | "alwaysN" | "one" | "two";

export interface SpecOp {
  text: string;
  comment: string;
  dest: string | null;
  srcs: string[];
  kind: SpecKind;
  imm: number;
  target: number | null;
  loadValue: number;
}

export interface SpecConfig {
  mode: PredictorMode;
  initial: Two;
  fetchAhead: number;
  resolveAfter?: number;
}

interface Flight {
  index: number;
  mask: number[];
  stage: number;
  hold: number;
}

export interface SpecStep {
  cycle: number;
  pc: number;
  cells: Array<Array<string | null>>;
  speculative: boolean[];
  squashed: boolean[];
  committed: boolean[];
  skipped: boolean[];
  regs: Array<{ name: string; value: number; note: string }>;
  event: string;
  flushed: number;
  redirect: number | null;
  predicted: boolean | null;
  actual: boolean | null;
  branchIndex: number | null;
}

export interface SpecResult {
  steps: SpecStep[];
  cycles: number;
  idealCycles: number;
  baselineCycles: number;
  branches: number;
  correct: number;
  mispredictions: number;
  speculativeFetched: number;
  squashed: number;
  recoveryCycles: number;
  finalRegs: Array<{ name: string; value: number }>;
  sequentialRegs: Array<{ name: string; value: number }>;
}

const copyRegs = (regs: Map<string, number>) => new Map(regs);

export function predictDirection(mode: PredictorMode, state: Two, bit: 0 | 1): boolean {
  if (mode === "alwaysT") return true;
  if (mode === "alwaysN") return false;
  if (mode === "one") return bit === 1;
  return state >= 2;
}

function learn(mode: PredictorMode, state: Two, bit: 0 | 1, taken: boolean): { state: Two; bit: 0 | 1 } {
  if (mode === "two") return { state: stepTwo(state, taken).next, bit };
  if (mode === "one") return { state, bit: taken ? 1 : 0 };
  return { state, bit };
}

export function parseSpec(line: string): SpecOp | null {
  const clean = line.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (!clean || clean.startsWith("#")) return null;
  const parts = clean.split(" ");
  const op = (parts[0] ?? "").toUpperCase();
  const regs = parts.filter((part) => /^[xr]\d+$/i.test(part)).map((part) => part.replace(/^r/i, "x"));
  const target = Number(parts.find((part) => /^\d+$/.test(part)) ?? "");
  if (op === "BEQ" || op === "BNE") {
    return { text: clean, comment: "", dest: null, srcs: regs.slice(0, 2), kind: "branch", imm: 0, target: Number.isFinite(target) ? Math.max(0, target - 1) : null, loadValue: 0 };
  }
  if (op === "LD" || op === "LW" || op === "LOAD") {
    return { text: clean, comment: "", dest: regs[0] ?? "x1", srcs: regs.slice(1, 2), kind: "load", imm: 0, target: null, loadValue: 1 };
  }
  if (op === "SD" || op === "SW" || op === "STORE") {
    return { text: clean, comment: "", dest: null, srcs: regs, kind: "store", imm: 0, target: null, loadValue: 0 };
  }
  if (op === "ADD" || op === "SUB" || op === "AND" || op === "OR") {
    return { text: clean, comment: "", dest: regs[0] ?? null, srcs: regs.slice(1), kind: "alu", imm: 0, target: null, loadValue: 0 };
  }
  return null;
}

export function parseSpecProgram(text: string): { ops: SpecOp[]; errors: string[] } {
  const ops: SpecOp[] = [];
  const errors: string[] = [];
  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const op = parseSpec(trimmed);
    if (!op) errors.push(`Line ${index + 1}: use ADD, LOAD, STORE, BEQ, or BNE`);
    else ops.push(op);
  });
  return { ops, errors };
}

export function branchTaken(op: SpecOp, regs: Map<string, number>): boolean {
  const left = regs.get(op.srcs[0] ?? "") ?? 0;
  const right = regs.get(op.srcs[1] ?? "") ?? 0;
  const equal = left === right;
  return op.text.toUpperCase().startsWith("BNE") ? !equal : equal;
}

function writeValue(op: SpecOp, regs: Map<string, number>): number {
  if (op.kind === "load") return op.loadValue;
  if (op.imm !== 0 || op.text.toUpperCase().startsWith("ADDI")) return (regs.get(op.srcs[0] ?? "") ?? 0) + op.imm;
  return (regs.get(op.srcs[0] ?? "") ?? 0) + (regs.get(op.srcs[1] ?? "") ?? 0) + 1;
}

export function sequentialRegs(ops: SpecOp[]): Array<{ name: string; value: number }> {
  const regs = new Map<string, number>();
  let pc = 0;
  let guard = 0;
  while (pc >= 0 && pc < ops.length && guard < 200) {
    guard += 1;
    const op = ops[pc];
    if (!op) break;
    if (op.kind === "branch") pc = branchTaken(op, regs) ? (op.target ?? pc + 1) : pc + 1;
    else {
      if (op.dest) regs.set(op.dest, writeValue(op, regs));
      pc += 1;
    }
  }
  return [...regs.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function outcomes(ops: SpecOp[]): Map<number, boolean> {
  const regs = new Map<string, number>();
  const found = new Map<number, boolean>();
  let pc = 0;
  let guard = 0;
  while (pc >= 0 && pc < ops.length && guard < 200) {
    guard += 1;
    const op = ops[pc];
    if (!op) break;
    if (op.kind === "branch") {
      const taken = branchTaken(op, regs);
      found.set(pc, taken);
      pc = taken ? (op.target ?? pc + 1) : pc + 1;
    } else {
      if (op.dest) regs.set(op.dest, writeValue(op, regs));
      pc += 1;
    }
  }
  return found;
}

function runOnce(ops: SpecOp[], config: SpecConfig, oracle: boolean): Omit<SpecResult, "idealCycles" | "baselineCycles" | "finalRegs" | "sequentialRegs"> & { finalRegs: Map<string, number> } {
  const known = outcomes(ops);
  const cells = ops.map(() => [] as Array<string | null>);
  const squashed = ops.map(() => false);
  const committed = ops.map(() => false);
  const skipped = ops.map(() => false);
  const predictedTaken = ops.map(() => false);
  const actualTaken = ops.map(() => null as boolean | null);
  let regs = new Map<string, number>();
  const checkpoints = new Map<number, Map<string, number>>();
  let state: Two = config.initial;
  let bit: 0 | 1 = config.initial >= 2 ? 1 : 0;
  let pc = 0;
  const flight: Flight[] = [];
  const blocking: number[] = [];
  const steps: SpecStep[] = [];
  let branches = 0;
  let correct = 0;
  let mispredictions = 0;
  let speculativeFetched = 0;
  let squashedCount = 0;
  let recoveryCycles = 0;
  let recoverFrom: number | null = null;
  const stamp = (index: number, cycle: number, token: string) => {
    const row = cells[index];
    if (row && row[cycle - 1] == null) row[cycle - 1] = token;
  };
  const noteFor = (name: string) => {
    const writer = ops.findIndex((op) => op.dest === name);
    if (writer >= 0 && squashed[writer]) return "speculated (squashed)";
    if (regs.has(name)) return ops[writer]?.kind === "load" ? "loaded value" : "architectural";
    return "unchanged";
  };
  for (let cycle = 1; cycle <= 80; cycle += 1) {
    let event = "Pipeline advances";
    let flushed = 0;
    let redirect: number | null = null;
    let predicted: boolean | null = null;
    let actual: boolean | null = null;
    let branchIndex: number | null = null;
    const resolving = flight.filter((item) => ops[item.index]?.kind === "branch" && item.stage === 4 && !squashed[item.index]);
    resolving.forEach((item) => {
      const op = ops[item.index];
      if (!op) return;
      const taken = branchTaken(op, regs);
      const guessed = predictedTaken[item.index] ?? false;
      actualTaken[item.index] = taken;
      branches += 1;
      branchIndex = item.index;
      predicted = guessed;
      actual = taken;
      const learned = learn(config.mode, state, bit, taken);
      state = learned.state;
      bit = learned.bit;
      const blockAt = blocking.indexOf(item.index);
      if (blockAt >= 0) blocking.splice(blockAt, 1);
      const saved = checkpoints.get(item.index);
      checkpoints.delete(item.index);
      if (taken === guessed) {
        correct += 1;
        flight.forEach((other) => { other.mask = other.mask.filter((id) => id !== item.index); });
        event = `Branch I${item.index + 1} resolved correctly (${taken ? "taken" : "not taken"})`;
      } else {
        mispredictions += 1;
        if (saved) regs = copyRegs(saved);
        flight.forEach((other) => { other.mask = other.mask.filter((id) => id !== item.index); });
        const target = op.target ?? item.index + 1;
        const wrong = (index: number) => (taken ? index > item.index && index < target : index >= target);
        if (!taken) {
          for (let index = item.index + 1; index < target; index += 1) skipped[index] = false;
        }
        flight.slice().forEach((other) => {
          if (!wrong(other.index)) return;
          if (!squashed[other.index]) {
            squashed[other.index] = true;
            squashedCount += 1;
            flushed += 1;
            stamp(other.index, cycle, "FLUSH");
          }
        });
        for (let cursor = flight.length - 1; cursor >= 0; cursor -= 1) {
          const other = flight[cursor];
          if (other && wrong(other.index)) flight.splice(cursor, 1);
        }
        for (let index = 0; index < ops.length; index += 1) {
          if (wrong(index) && !committed[index] && !flight.some((other) => other.index === index)) skipped[index] = true;
        }
        for (let cursor = blocking.length - 1; cursor >= 0; cursor -= 1) {
          const id = blocking[cursor];
          if (id != null && wrong(id)) blocking.splice(cursor, 1);
        }
        pc = taken ? target : item.index + 1;
        redirect = pc;
        recoverFrom = cycle;
        event = `Misprediction at I${item.index + 1}. Flush ${flushed}. Redirect to I${pc + 1}`;
      }
    });
    const graduating = flight.filter((item) => item.stage === 4 && item.mask.length === 0);
    graduating.forEach((item) => {
      const op = ops[item.index];
      if (!op || squashed[item.index]) return;
      if (op.dest && op.kind !== "branch") {
        const value = writeValue(op, regs);
        regs.set(op.dest, value);
        checkpoints.forEach((snap, branch) => { if (item.index < branch) snap.set(op.dest ?? "", value); });
      }
      committed[item.index] = true;
    });
    for (let cursor = flight.length - 1; cursor >= 0; cursor -= 1) {
      const item = flight[cursor];
      if (item?.stage === 4 && item.mask.length === 0) flight.splice(cursor, 1);
    }
    flight.forEach((item) => {
      if (squashed[item.index]) return;
      const op = ops[item.index];
      if (op?.kind === "branch" && item.stage === 3 && item.hold > 0) {
        item.hold -= 1;
        stamp(item.index, cycle, "BR");
        return;
      }
      if (item.stage === 4 && item.mask.length > 0) {
        stamp(item.index, cycle, "WB");
        return;
      }
      item.stage += 1;
      if (item.stage === 1) stamp(item.index, cycle, "ID");
      else if (item.stage === 2) stamp(item.index, cycle, op?.kind === "branch" ? "BR" : "EX");
      else if (item.stage === 3) stamp(item.index, cycle, "MEM");
      else if (item.stage === 4) stamp(item.index, cycle, "WB");
    });
    while (pc < ops.length && (skipped[pc] || committed[pc] || squashed[pc])) pc += 1;
    const fetchFree = !flight.some((item) => item.stage === 0);
    if (fetchFree) {
      while (pc < ops.length && (skipped[pc] || committed[pc] || squashed[pc] || flight.some((item) => item.index === pc))) pc += 1;
    }
    const speculativeCount = flight.filter((item) => item.mask.length > 0).length;
    const room = blocking.length === 0 || speculativeCount < config.fetchAhead;
    if (room && fetchFree && pc >= 0 && pc < ops.length && !committed[pc] && !squashed[pc] && !flight.some((item) => item.index === pc)) {
      const op = ops[pc];
      if (op) {
        const mask = blocking.slice();
        if (mask.length) speculativeFetched += 1;
        flight.push({ index: pc, mask, stage: 0, hold: op.kind === "branch" ? (config.resolveAfter ?? 0) : 0 });
        stamp(pc, cycle, "IF");
        if (recoverFrom != null && mask.length === 0) {
          recoveryCycles += Math.max(1, cycle - recoverFrom);
          recoverFrom = null;
        }
        if (op.kind === "branch") {
          checkpoints.set(pc, copyRegs(regs));
          const guessed = oracle ? (known.get(pc) ?? branchTaken(op, regs)) : predictDirection(config.mode, state, bit);
          predictedTaken[pc] = guessed;
          blocking.push(pc);
          const fetched = pc;
          if (guessed && op.target != null) {
            for (let index = fetched + 1; index < op.target; index += 1) skipped[index] = true;
            pc = op.target;
          } else pc = fetched + 1;
        } else pc += 1;
      }
    }
    const names = new Set<string>([...regs.keys(), ...ops.flatMap((op) => op.dest ? [op.dest] : [])]);
    steps.push({
      cycle,
      pc,
      cells: cells.map((row) => row.slice()),
      speculative: ops.map((_, index) => squashed[index] || flight.some((item) => item.index === index && item.mask.length > 0)),
      squashed: squashed.slice(),
      committed: committed.slice(),
      skipped: skipped.slice(),
      regs: [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((name) => ({ name, value: regs.get(name) ?? 0, note: noteFor(name) })),
      event,
      flushed,
      redirect,
      predicted,
      actual,
      branchIndex,
    });
    const settled = ops.every((_, index) => committed[index] || squashed[index] || skipped[index]);
    if (settled && flight.length === 0) break;
  }
  return { steps, cycles: steps.length, branches, correct, mispredictions, speculativeFetched, squashed: squashedCount, recoveryCycles, finalRegs: regs };
}

export function runSpeculation(ops: SpecOp[], config: SpecConfig): SpecResult {
  const live = runOnce(ops, config, false);
  const ideal = runOnce(ops, config, true);
  const baseline = runOnce(ops, { ...config, fetchAhead: 0 }, false);
  const finalRegs = [...live.finalRegs.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return {
    steps: live.steps,
    cycles: live.cycles,
    idealCycles: ideal.cycles,
    baselineCycles: baseline.cycles,
    branches: live.branches,
    correct: live.correct,
    mispredictions: live.mispredictions,
    speculativeFetched: live.speculativeFetched,
    squashed: live.squashed,
    recoveryCycles: live.recoveryCycles,
    finalRegs,
    sequentialRegs: sequentialRegs(ops),
  };
}

function op(text: string, comment: string, kind: SpecKind, dest: string | null, srcs: string[], extra: Partial<SpecOp> = {}): SpecOp {
  return { text, comment, dest, srcs, kind, imm: extra.imm ?? 0, target: extra.target ?? null, loadValue: extra.loadValue ?? 0 };
}

export const SPEC_PRESETS: Array<{ id: string; label: string; ops: SpecOp[]; config: SpecConfig }> = [
  {
    id: "wrong",
    label: "Single misprediction",
    config: { mode: "two", initial: 1, fetchAhead: 4 },
    ops: [
      op("LW x1, 0(x2)", "load value", "load", "x1", ["x2"], { loadValue: 1 }),
      op("ADDI x3, x0, 1", "x3 = 1", "alu", "x3", [], { imm: 1 }),
      op("BEQ x1, x3, TARGET", "taken: x1 equals x3", "branch", null, ["x1", "x3"], { target: 6 }),
      op("ADD x4, x5, x6", "wrong path", "alu", "x4", ["x5", "x6"]),
      op("SUB x7, x8, x9", "wrong path", "alu", "x7", ["x8", "x9"]),
      op("AND x10, x11, x12", "wrong path", "alu", "x10", ["x11", "x12"]),
      op("OR x13, x14, x15", "target", "alu", "x13", ["x14", "x15"]),
      op("ADDI x16, x16, 1", "continue", "alu", "x16", ["x16"], { imm: 1 }),
    ],
  },
  {
    id: "correct",
    label: "Correct speculation",
    config: { mode: "two", initial: 2, fetchAhead: 4 },
    ops: [
      op("LW x1, 0(x2)", "load value", "load", "x1", ["x2"], { loadValue: 1 }),
      op("ADDI x3, x0, 1", "x3 = 1", "alu", "x3", [], { imm: 1 }),
      op("BEQ x1, x3, TARGET", "predictor agrees", "branch", null, ["x1", "x3"], { target: 6 }),
      op("ADD x4, x5, x6", "not on the predicted path", "alu", "x4", ["x5", "x6"]),
      op("SUB x7, x8, x9", "not on the predicted path", "alu", "x7", ["x8", "x9"]),
      op("AND x10, x11, x12", "not on the predicted path", "alu", "x10", ["x11", "x12"]),
      op("OR x13, x14, x15", "target", "alu", "x13", ["x14", "x15"]),
      op("ADDI x16, x16, 1", "continue", "alu", "x16", ["x16"], { imm: 1 }),
    ],
  },
  {
    id: "deep",
    label: "Deep speculative window",
    config: { mode: "alwaysN", initial: 0, fetchAhead: 6 },
    ops: [
      op("LW x1, 0(x2)", "load", "load", "x1", ["x2"], { loadValue: 1 }),
      op("BEQ x1, x1, TARGET", "always taken", "branch", null, ["x1", "x1"], { target: 6 }),
      op("ADD x4, x5, x6", "wrong 1", "alu", "x4", ["x5", "x6"]),
      op("SUB x7, x8, x9", "wrong 2", "alu", "x7", ["x8", "x9"]),
      op("AND x10, x11, x12", "wrong 3", "alu", "x10", ["x11", "x12"]),
      op("XOR x20, x21, x22", "wrong 4", "alu", "x20", ["x21", "x22"]),
      op("OR x13, x14, x15", "target", "alu", "x13", ["x14", "x15"]),
      op("ADDI x16, x16, 1", "continue", "alu", "x16", ["x16"], { imm: 1 }),
    ],
  },
  {
    id: "pair",
    label: "Back-to-back branches",
    config: { mode: "alwaysN", initial: 0, fetchAhead: 4 },
    ops: [
      op("ADDI x1, x0, 1", "x1 = 1", "alu", "x1", [], { imm: 1 }),
      op("BEQ x1, x1, T1", "first taken", "branch", null, ["x1", "x1"], { target: 3 }),
      op("ADD x2, x3, x4", "wrong", "alu", "x2", ["x3", "x4"]),
      op("BEQ x1, x1, T2", "second taken", "branch", null, ["x1", "x1"], { target: 5 }),
      op("SUB x5, x6, x7", "wrong", "alu", "x5", ["x6", "x7"]),
      op("OR x8, x9, x10", "resume", "alu", "x8", ["x9", "x10"]),
    ],
  },
  {
    id: "nested",
    label: "Nested unresolved branches",
    config: { mode: "alwaysN", initial: 0, fetchAhead: 4 },
    ops: [
      op("ADDI x1, x0, 2", "x1 = 2", "alu", "x1", [], { imm: 2 }),
      op("ADDI x2, x0, 3", "x2 = 3", "alu", "x2", [], { imm: 3 }),
      op("BEQ x1, x2, FAR", "not taken", "branch", null, ["x1", "x2"], { target: 5 }),
      op("BEQ x1, x1, NEAR", "taken", "branch", null, ["x1", "x1"], { target: 6 }),
      op("ADD x4, x5, x6", "wrong for second", "alu", "x4", ["x5", "x6"]),
      op("SUB x7, x8, x9", "far target", "alu", "x7", ["x8", "x9"]),
      op("OR x10, x11, x12", "near target", "alu", "x10", ["x11", "x12"]),
    ],
  },
  {
    id: "long",
    label: "Long-latency branch resolution",
    config: { mode: "alwaysN", initial: 0, fetchAhead: 5 },
    ops: [
      op("LW x1, 0(x2)", "value arrives at writeback", "load", "x1", ["x2"], { loadValue: 4 }),
      op("LW x3, 4(x2)", "value arrives at writeback", "load", "x3", ["x2"], { loadValue: 4 }),
      op("BEQ x1, x3, TARGET", "taken once loads commit", "branch", null, ["x1", "x3"], { target: 5 }),
      op("ADD x4, x5, x6", "wrong path", "alu", "x4", ["x5", "x6"]),
      op("SUB x7, x8, x9", "wrong path", "alu", "x7", ["x8", "x9"]),
      op("OR x13, x14, x15", "target", "alu", "x13", ["x14", "x15"]),
    ],
  },
];
