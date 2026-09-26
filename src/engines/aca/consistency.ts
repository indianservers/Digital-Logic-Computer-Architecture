export type MemoryModel = "sc" | "tso" | "weak" | "release";

export interface MemOp {
  kind: "store" | "load" | "fence" | "release" | "acquire";
  addr: string;
  value?: number;
  reg?: string;
}

export interface Litmus {
  id: string;
  label: string;
  threads: MemOp[][];
  memory: Record<string, number>;
  observe: string[];
}

export interface ConsState {
  done: boolean[][];
  buffers: Array<Array<{ index: number; addr: string; value: number }>>;
  memory: Record<string, number>;
  regs: Record<string, number>;
  drains: number;
  fences: number;
  acquires: number;
  releases: number;
  reorders: number;
  cycles: number;
}

export type ConsAction =
  | { type: "exec"; thread: number; index: number }
  | { type: "drain"; thread: number; slot: number };

export interface OutcomeRow {
  values: Record<string, number>;
  count: number;
  allowed: boolean;
}

export interface ConsResult {
  outcomes: OutcomeRow[];
  explored: number;
  allowed: number;
  forbidden: number;
  terminals: number;
}

const storeLike = (op: MemOp) => op.kind === "store" || op.kind === "release";

function fresh(litmus: Litmus): ConsState {
  return {
    done: litmus.threads.map((thread) => thread.map(() => false)),
    buffers: litmus.threads.map(() => []),
    memory: { ...litmus.memory },
    regs: Object.fromEntries(litmus.observe.map((name) => [name, 0])),
    drains: 0,
    fences: 0,
    acquires: 0,
    releases: 0,
    reorders: 0,
    cycles: 0,
  };
}

function earlierStorePending(state: ConsState, thread: number, index: number, addr: string, program: MemOp[]) {
  return program.slice(0, index).some((op, cursor) => storeLike(op) && op.addr === addr && !state.done[thread]?.[cursor]);
}

function blockedByBarrier(state: ConsState, thread: number, index: number, program: MemOp[], model: MemoryModel) {
  if (model === "sc" || model === "tso") {
    return program.slice(0, index).some((_, cursor) => !state.done[thread]?.[cursor]);
  }
  for (let cursor = 0; cursor < index; cursor += 1) {
    const prior = program[cursor];
    if (!prior || state.done[thread]?.[cursor]) continue;
    if (prior.kind === "fence" || prior.kind === "acquire") return true;
  }
  return false;
}

function executable(state: ConsState, thread: number, index: number, program: MemOp[], model: MemoryModel) {
  const op = program[index];
  if (!op || state.done[thread]?.[index]) return false;
  if (blockedByBarrier(state, thread, index, program, model)) return false;
  if ((op.kind === "load" || op.kind === "acquire") && earlierStorePending(state, thread, index, op.addr, program)) return false;
  const buffer = state.buffers[thread] ?? [];
  if (op.kind === "fence" && buffer.length > 0) return false;
  if (op.kind === "release" && (model === "weak" || model === "release") && buffer.length > 0) return false;
  if (model === "release" && op.kind === "release" && program.slice(0, index).some((_, cursor) => !state.done[thread]?.[cursor])) return false;
  return true;
}

export function legalActions(state: ConsState, litmus: Litmus, model: MemoryModel): ConsAction[] {
  const actions: ConsAction[] = [];
  litmus.threads.forEach((program, thread) => {
    program.forEach((_, index) => {
      if (executable(state, thread, index, program, model)) actions.push({ type: "exec", thread, index });
    });
    const buffer = state.buffers[thread] ?? [];
    if (model === "sc" || buffer.length === 0) return;
    if (model === "tso" || model === "release") actions.push({ type: "drain", thread, slot: 0 });
    else buffer.forEach((_, slot) => actions.push({ type: "drain", thread, slot }));
  });
  return actions;
}

function readValue(state: ConsState, thread: number, addr: string) {
  const buffered = (state.buffers[thread] ?? []).filter((entry) => entry.addr === addr);
  const latest = buffered[buffered.length - 1];
  return latest ? latest.value : state.memory[addr] ?? 0;
}

export function applyAction(state: ConsState, litmus: Litmus, action: ConsAction, model: MemoryModel): ConsState {
  const next: ConsState = {
    done: state.done.map((row) => row.slice()),
    buffers: state.buffers.map((buffer) => buffer.map((entry) => ({ ...entry }))),
    memory: { ...state.memory },
    regs: { ...state.regs },
    drains: state.drains,
    fences: state.fences,
    acquires: state.acquires,
    releases: state.releases,
    reorders: state.reorders,
    cycles: state.cycles + 1,
  };
  if (action.type === "drain") {
    const buffer = next.buffers[action.thread];
    const entry = buffer?.[action.slot];
    if (!buffer || !entry) return next;
    next.memory[entry.addr] = entry.value;
    buffer.splice(action.slot, 1);
    next.drains += 1;
    return next;
  }
  const program = litmus.threads[action.thread] ?? [];
  const op = program[action.index];
  if (!op) return next;
  const threadDone = next.done[action.thread];
  if (threadDone) threadDone[action.index] = true;
  if (op.kind === "load" || op.kind === "acquire") {
    if (op.reg) next.regs[op.reg] = readValue(next, action.thread, op.addr);
    if (op.kind === "acquire") next.acquires += 1;
    const buffer = next.buffers[action.thread] ?? [];
    if (model !== "sc" && buffer.some((entry) => entry.addr !== op.addr)) next.reorders += 1;
    return next;
  }
  if (op.kind === "fence") {
    next.fences += 1;
    return next;
  }
  if (op.kind === "release") next.releases += 1;
  const value = op.value ?? 0;
  if (model === "sc") next.memory[op.addr] = value;
  else next.buffers[action.thread]?.push({ index: action.index, addr: op.addr, value });
  return next;
}

function finished(state: ConsState) {
  return state.done.every((row) => row.every(Boolean)) && state.buffers.every((buffer) => buffer.length === 0);
}

function keyOf(state: ConsState) {
  return JSON.stringify({ done: state.done, buffers: state.buffers, memory: state.memory, regs: state.regs });
}

function outcomeKey(state: ConsState, names: string[]) {
  return names.map((name) => `${name}=${state.regs[name] ?? 0}`).join(",");
}

export function enumerate(litmus: Litmus, model: MemoryModel, limit = 4000): ConsResult {
  const start = fresh(litmus);
  const queue: ConsState[] = [start];
  const seen = new Set<string>([keyOf(start)]);
  const counts = new Map<string, { values: Record<string, number>; count: number }>();
  let explored = 0;
  let terminals = 0;
  while (queue.length > 0 && explored < limit) {
    const state = queue.shift();
    if (!state) break;
    explored += 1;
    if (finished(state)) {
      terminals += 1;
      const label = outcomeKey(state, litmus.observe);
      const prior = counts.get(label);
      if (prior) prior.count += 1;
      else counts.set(label, { values: Object.fromEntries(litmus.observe.map((name) => [name, state.regs[name] ?? 0])), count: 1 });
      continue;
    }
    legalActions(state, litmus, model).forEach((action) => {
      const next = applyAction(state, litmus, action, model);
      const key = keyOf(next);
      if (seen.has(key)) return;
      seen.add(key);
      queue.push(next);
    });
  }
  const domain = new Set<number>([0]);
  counts.forEach((row) => Object.values(row.values).forEach((value) => domain.add(value)));
  litmus.threads.flat().forEach((op) => { if (op.value !== undefined) domain.add(op.value); });
  const names = litmus.observe;
  const grid: OutcomeRow[] = [];
  const fill = (cursor: Record<string, number>, depth: number) => {
    if (depth >= names.length) {
      const label = names.map((name) => `${name}=${cursor[name] ?? 0}`).join(",");
      const found = counts.get(label);
      grid.push({ values: { ...cursor }, count: found?.count ?? 0, allowed: Boolean(found) });
      return;
    }
    const name = names[depth];
    if (!name) return;
    domain.forEach((value) => fill({ ...cursor, [name]: value }, depth + 1));
  };
  if (names.length > 0 && names.length <= 3 && domain.size <= 4) fill({}, 0);
  else counts.forEach((row) => grid.push({ values: row.values, count: row.count, allowed: true }));
  return {
    outcomes: grid,
    explored,
    allowed: grid.filter((row) => row.allowed).length,
    forbidden: grid.filter((row) => !row.allowed).length,
    terminals,
  };
}

export function initialState(litmus: Litmus) {
  return fresh(litmus);
}

export function insertFence(litmus: Litmus, thread: number, afterKinds: Array<MemOp["kind"]>): Litmus {
  const threads = litmus.threads.map((ops, index) => {
    if (index !== thread) return ops.map((op) => ({ ...op }));
    const next: MemOp[] = [];
    ops.forEach((op) => {
      next.push({ ...op });
      if (afterKinds.includes(op.kind)) next.push({ kind: "fence", addr: "" });
    });
    return next;
  });
  return { ...litmus, threads };
}

const store = (addr: string, value: number): MemOp => ({ kind: "store", addr, value });
const load = (addr: string, reg: string): MemOp => ({ kind: "load", addr, reg });
const release = (addr: string, value: number): MemOp => ({ kind: "release", addr, value });
const acquire = (addr: string, reg: string): MemOp => ({ kind: "acquire", addr, reg });

export const LITMUS_TESTS: Litmus[] = [
  {
    id: "sb",
    label: "Store buffering",
    threads: [[store("X", 1), load("Y", "r0")], [store("Y", 1), load("X", "r1")]],
    memory: { X: 0, Y: 0 },
    observe: ["r0", "r1"],
  },
  {
    id: "mp",
    label: "Message passing",
    threads: [[store("data", 42), store("flag", 1)], [load("flag", "r0"), load("data", "r1")]],
    memory: { data: 0, flag: 0 },
    observe: ["r0", "r1"],
  },
  {
    id: "mp-sync",
    label: "Message passing with release/acquire",
    threads: [[store("data", 42), release("flag", 1)], [acquire("flag", "r0"), load("data", "r1")]],
    memory: { data: 0, flag: 0 },
    observe: ["r0", "r1"],
  },
  {
    id: "lb",
    label: "Load buffering",
    threads: [[load("X", "r0"), store("Y", 1)], [load("Y", "r1"), store("X", 1)]],
    memory: { X: 0, Y: 0 },
    observe: ["r0", "r1"],
  },
];

export function outcomeCount(result: ConsResult, values: Record<string, number>) {
  return result.outcomes.find((row) => Object.entries(values).every(([name, value]) => row.values[name] === value))?.count ?? 0;
}

export function parseLitmus(text: string): { litmus: Litmus; error: string } {
  const threads: MemOp[][] = [[], [], [], []];
  const memory: Record<string, number> = {};
  const observe = new Set<string>();
  const errors: string[] = [];
  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const init = trimmed.match(/^init\s+(.+)$/i);
    if (init) {
      init[1]?.split(/\s+/).forEach((pair) => {
        const [name, value] = pair.split("=");
        if (name && value != null && !Number.isNaN(Number(value))) memory[name] = Number(value);
      });
      return;
    }
    const match = trimmed.match(/^(\d+)\s*:\s*(.+)$/);
    if (!match) {
      errors.push(`Line ${index + 1}: expected 0: X = 1`);
      return;
    }
    const thread = Number(match[1]);
    const body = (match[2] ?? "").trim();
    if (thread < 0 || thread > 3) {
      errors.push(`Line ${index + 1}: thread must be 0 to 3`);
      return;
    }
    const program = threads[thread];
    if (!program) return;
    if (/^fence$/i.test(body)) {
      program.push({ kind: "fence", addr: "" });
      return;
    }
    const release = body.match(/^release\s+([A-Za-z]\w*)\s*=\s*(-?\d+)$/i);
    if (release?.[1]) {
      program.push({ kind: "release", addr: release[1], value: Number(release[2]) });
      memory[release[1]] = memory[release[1]] ?? 0;
      return;
    }
    const acquire = body.match(/^acquire\s+([A-Za-z]\w*)\s+([A-Za-z]\w*)$/i) ?? body.match(/^([A-Za-z]\w*)\s*=\s*acquire\s+([A-Za-z]\w*)$/i);
    if (acquire?.[1] && acquire[2]) {
      const reg = acquire[1].startsWith("r") ? acquire[1] : acquire[2];
      const addr = acquire[1].startsWith("r") ? acquire[2] : acquire[1];
      program.push({ kind: "acquire", addr, reg });
      observe.add(reg);
      memory[addr] = memory[addr] ?? 0;
      return;
    }
    const store = body.match(/^([A-Za-z]\w*)\s*=\s*(-?\d+)$/);
    if (store?.[1]) {
      program.push({ kind: "store", addr: store[1], value: Number(store[2]) });
      memory[store[1]] = memory[store[1]] ?? 0;
      return;
    }
    const loadMatch = /^([A-Za-z]\w*)\s*=\s*([A-Za-z]\w*)$/.exec(body);
    if (loadMatch?.[1] && loadMatch[2]) {
      program.push({ kind: "load", addr: loadMatch[2], reg: loadMatch[1] });
      observe.add(loadMatch[1]);
      memory[loadMatch[2]] = memory[loadMatch[2]] ?? 0;
      return;
    }
    errors.push(`Line ${index + 1}: use X = 1, r1 = Y, fence, release, or acquire`);
  });
  const used = threads.filter((thread) => thread.length > 0);
  if (used.length < 2) errors.push("Write at least two threads, for example 0: and 1:");
  return {
    litmus: { id: "custom", label: "Student litmus", threads: used.length ? used : [[], []], memory, observe: [...observe] },
    error: errors[0] ?? "",
  };
}
