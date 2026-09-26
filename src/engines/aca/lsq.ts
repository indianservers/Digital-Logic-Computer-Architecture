export interface LsqOp {
  pc: number;
  text: string;
  comment: string;
  kind: "load" | "store";
  dest: string | null;
  dataReg: string | null;
  immData: number | null;
  base: string;
  offset: number;
  latency: number;
}

export type MemPolicy = "conservative" | "bypass" | "counter" | "storeSet";

export interface LsqConfig {
  policy: MemPolicy;
  forwarding: boolean;
  checks: boolean;
  lqSize: number;
  sqSize: number;
  threshold: number;
}

interface Live {
  index: number;
  address: number | null;
  addressReady: boolean;
  addressCycle: number | null;
  data: number | null;
  dataReady: boolean;
  dispatched: number | null;
  executed: number | null;
  committed: number | null;
  forwardedFrom: number | null;
  value: number | null;
  speculative: boolean;
  replayed: boolean;
  waitPredicted: boolean | null;
  trained: boolean;
  conflict: boolean | null;
  baseOp: { value: number; ready: number } | null;
  dataOp: { value: number; ready: number } | null;
}

export interface LsqEntry {
  index: number;
  text: string;
  kind: "load" | "store";
  dest: string;
  src: string;
  address: string;
  data: string;
  status: string;
  age: number;
  value: number | null;
}

export interface LsqLog { cycle: number; event: string; detail: string }

export interface LsqShot {
  cycle: number;
  loads: LsqEntry[];
  stores: LsqEntry[];
  memory: Array<{ addr: number; value: number; mark: string }>;
  log: LsqLog[];
  cells: Array<Array<string | null>>;
  event: string;
  forwarded: number;
  replays: number;
  stalls: number;
  reads: number;
  violations: number;
  waits: number;
  bypasses: number;
  decisions: Array<{ index: number; pc: number; text: string; predictedDep: boolean; confidence: number; action: string; outcome: string }>;
  accuracy: number[];
  misrate: number[];
}

export interface LsqResult {
  shots: LsqShot[];
  cycles: number;
  forwarded: number;
  replays: number;
  stalls: number;
  reads: number;
  violations: number;
  waits: number;
  bypasses: number;
  correct: number;
  wrong: number;
  memory: Array<{ addr: number; value: number }>;
  loadValues: Array<{ index: number; value: number | null }>;
}

const DEFAULTS: LsqConfig = { policy: "conservative", forwarding: true, checks: true, lqSize: 8, sqSize: 8, threshold: 2 };

function confidenceOf(state: number, bypass: boolean) {
  return bypass ? 0.5 + state * 0.12 : 0.5 + (3 - state) * 0.12;
}

export function runLsq(ops: LsqOp[], regsInit: Record<string, number>, memoryInit: Record<number, number>, config: Partial<LsqConfig> = {}): LsqResult {
  const cfg = { ...DEFAULTS, ...config };
  const regs = new Map<string, { value: number; ready: number }>(Object.entries(regsInit).map(([name, value]) => [name, { value, ready: 0 }]));
  const memory = new Map<number, number>(Object.entries(memoryInit).map(([addr, value]) => [Number(addr), value]));
  const marks = new Map<number, string>();
  const live: Live[] = ops.map((_, index) => ({
    index, address: null, addressReady: false, addressCycle: null, data: null, dataReady: false, dispatched: null, executed: null, committed: null, forwardedFrom: null, value: null, speculative: false, replayed: false, waitPredicted: null, trained: false, conflict: null, baseOp: null, dataOp: null,
  }));
  const counters = new Map<number, number>();
  const storeSets = new Map<number, Set<number>>();
  const cells = ops.map(() => [] as Array<string | null>);
  const shots: LsqShot[] = [];
  const log: LsqLog[] = [];
  let forwarded = 0;
  let replays = 0;
  let stalls = 0;
  let reads = 0;
  let violations = 0;
  let waits = 0;
  let bypasses = 0;
  let correct = 0;
  let wrong = 0;
  const accuracy: number[] = [];
  const misrate: number[] = [];
  const stamp = (index: number, cycle: number, token: string) => {
    const row = cells[index];
    if (row && row[cycle - 1] == null) row[cycle - 1] = token;
  };
  const entry = (item: Live): LsqEntry => {
    const op = ops[item.index];
    let status = "Waiting";
    if (op?.kind === "store" && item.committed != null) status = "Committed";
    else if (op?.kind === "store" && !item.addressReady) status = "Addr. Resv";
    else if (op?.kind === "store") status = "Pending";
    else if (item.replayed && item.executed == null) status = "Replay";
    else if (item.forwardedFrom != null) status = "Forwarded";
    else if (item.executed != null) status = "Resolved";
    return {
      index: item.index,
      text: op?.text ?? "",
      kind: op?.kind ?? "load",
      dest: op?.dest ?? "—",
      src: op?.dataReg ?? "—",
      address: item.addressReady && item.address != null ? `0x${item.address.toString(16)}` : "?",
      data: item.dataReady && item.data != null ? `0x${(item.data >>> 0).toString(16)}` : "?",
      status,
      age: item.index,
      value: item.value,
    };
  };
  for (let cycle = 1; cycle <= 80; cycle += 1) {
    let event = "Memory pipeline advances";
    live.forEach((item) => {
      const op = ops[item.index];
      if (!op || item.dispatched == null) return;
      if (!item.addressReady && item.baseOp && item.baseOp.ready < cycle) {
        item.address = item.baseOp.value + op.offset;
        item.addressReady = true;
        item.addressCycle = cycle;
        stamp(item.index, cycle, "ID");
        log.push({ cycle, event: "Addr Resolve", detail: `${op.text} → 0x${item.address.toString(16)}` });
      }
      if (op.kind === "store" && !item.dataReady && (op.immData != null || (item.dataOp != null && item.dataOp.ready < cycle))) {
        item.data = op.immData != null ? op.immData : (item.dataOp?.value ?? 0);
        item.dataReady = true;
        log.push({ cycle, event: "Data Ready", detail: op.text });
      }
    });
    if (cfg.checks) {
      live.forEach((store) => {
        const storeOp = ops[store.index];
        if (!storeOp || storeOp.kind !== "store" || !store.addressReady || store.addressCycle !== cycle) return;
        live.forEach((load) => {
          const loadOp = ops[load.index];
          if (!loadOp || loadOp.kind !== "load" || load.index < store.index || load.executed == null || load.address !== store.address) return;
          if (load.forwardedFrom != null && load.forwardedFrom >= store.index) return;
          load.executed = null;
          load.value = null;
          load.speculative = false;
          load.forwardedFrom = null;
          load.replayed = true;
          violations += 1;
          replays += 1;
          if (!load.trained && load.waitPredicted != null) {
            const state = counters.get(loadOp.pc) ?? 2;
            counters.set(loadOp.pc, Math.max(0, state - 1));
            const set = storeSets.get(loadOp.pc) ?? new Set<number>();
            set.add(storeOp.pc);
            storeSets.set(loadOp.pc, set);
            load.conflict = true;
            load.trained = true;
            if (load.waitPredicted) correct += 1;
            else wrong += 1;
            const decided = correct + wrong;
            accuracy.push(decided ? correct / decided : 0);
            misrate.push(decided ? wrong / decided : 0);
          }
          event = `Memory violation. ${loadOp.text} must replay after ${storeOp.text}.`;
          log.push({ cycle, event: "Violation", detail: `${loadOp.text} used a stale value at 0x${store.address?.toString(16)}` });
          log.push({ cycle, event: "Replay", detail: `${loadOp.text} will re-execute` });
          stamp(load.index, cycle, "Replay");
        });
      });
    }
    live.forEach((load) => {
      const op = ops[load.index];
      if (!op || op.kind !== "load" || load.dispatched == null || load.executed != null || !load.addressReady) return;
      const older = live.filter((item) => ops[item.index]?.kind === "store" && item.index < load.index && item.dispatched != null);
      const unknown = older.filter((item) => !item.addressReady);
      const matches = older.filter((item) => item.addressReady && item.address === load.address);
      const youngest = matches[matches.length - 1];
      const state = counters.get(op.pc) ?? 2;
      const set = storeSets.get(op.pc) ?? new Set<number>();
      const predictWait = unknown.length === 0 ? false : cfg.policy === "conservative" ? true : cfg.policy === "bypass" ? false : cfg.policy === "counter" ? state < cfg.threshold : unknown.some((item) => set.has(ops[item.index]?.pc ?? -1));
      if (load.waitPredicted == null && unknown.length > 0) {
        load.waitPredicted = predictWait;
        if (predictWait) waits += 1;
        else bypasses += 1;
      }
      if (predictWait) {
        stalls += 1;
        event = `${op.text} waits for an older store with an unknown address.`;
        return;
      }
      if (youngest && !youngest.dataReady) {
        stalls += 1;
        event = `${op.text} waits for store data.`;
        return;
      }
      if (youngest && !cfg.forwarding && youngest.committed == null) {
        stalls += 1;
        return;
      }
      if (youngest && cfg.forwarding && youngest.data != null) {
        load.value = youngest.data;
        load.forwardedFrom = youngest.index;
        load.executed = cycle;
        load.speculative = false;
        forwarded += 1;
        if (op.dest) regs.set(op.dest, { value: youngest.data, ready: cycle + op.latency });
        event = `${op.text} forwarded from I${youngest.index + 1}.`;
        log.push({ cycle, event: "Forward", detail: `${op.text} ← I${youngest.index + 1}` });
        stamp(load.index, cycle, "MEM");
        return;
      }
      const value = memory.get(load.address ?? 0) ?? 0;
      marks.set(load.address ?? 0, "read");
      load.value = value;
      load.executed = cycle;
      load.speculative = unknown.length > 0;
      reads += 1;
      if (op.dest) regs.set(op.dest, { value, ready: cycle + op.latency });
      stamp(load.index, cycle, "MEM");
      log.push({ cycle, event: "Memory Read", detail: `${op.text} = 0x${value.toString(16)}` });
    });
    live.forEach((load) => {
      const op = ops[load.index];
      if (!op || op.kind !== "load" || load.trained || load.waitPredicted == null || load.executed == null) return;
      const older = live.filter((item) => ops[item.index]?.kind === "store" && item.index < load.index);
      if (older.some((item) => !item.addressReady)) return;
      const conflict = older.find((item) => item.address === load.address);
      const state = counters.get(op.pc) ?? 2;
      load.conflict = Boolean(conflict);
      if (conflict) {
        counters.set(op.pc, Math.max(0, state - 1));
        const set = storeSets.get(op.pc) ?? new Set<number>();
        set.add(ops[conflict.index]?.pc ?? -1);
        storeSets.set(op.pc, set);
        if (load.waitPredicted) correct += 1;
        else wrong += 1;
      } else {
        counters.set(op.pc, Math.min(3, state + 1));
        if (load.waitPredicted) wrong += 1;
        else correct += 1;
      }
      load.trained = true;
      const decided = correct + wrong;
      accuracy.push(decided ? correct / decided : 0);
      misrate.push(decided ? wrong / decided : 0);
    });
    const pendingStore = live.find((item) => ops[item.index]?.kind === "store" && item.committed == null);
    if (pendingStore && pendingStore.addressReady && pendingStore.dataReady && pendingStore.data != null && pendingStore.address != null && live.every((item) => item.index >= pendingStore.index || ops[item.index]?.kind !== "store" || item.committed != null)) {
      memory.set(pendingStore.address, pendingStore.data);
      marks.set(pendingStore.address, "commit");
      pendingStore.committed = cycle;
      stamp(pendingStore.index, cycle, "WB");
      log.push({ cycle, event: "Commit", detail: `${ops[pendingStore.index]?.text} wrote 0x${pendingStore.address.toString(16)}` });
    }
    const lq = live.filter((item) => ops[item.index]?.kind === "load" && item.dispatched != null && item.executed == null).length;
    const sq = live.filter((item) => ops[item.index]?.kind === "store" && item.dispatched != null && item.committed == null).length;
    const nextIndex = live.findIndex((item) => item.dispatched == null);
    const next = ops[nextIndex];
    const nextLive = live[nextIndex];
    if (next && nextLive && ((next.kind === "load" && lq < cfg.lqSize) || (next.kind === "store" && sq < cfg.sqSize))) {
      nextLive.dispatched = cycle;
      nextLive.baseOp = regs.get(next.base) ?? { value: 0, ready: 0 };
      nextLive.dataOp = next.dataReg ? (regs.get(next.dataReg) ?? { value: 0, ready: 0 }) : null;
      stamp(nextIndex, cycle, "IF");
      log.push({ cycle, event: "Dispatch", detail: next.text });
    }
    const decisions = live.filter((item) => ops[item.index]?.kind === "load" && item.waitPredicted != null).map((item) => {
      const op = ops[item.index];
      const state = counters.get(op?.pc ?? 0) ?? 2;
      const predictedDep = item.waitPredicted === true;
      const outcome = !item.trained ? "pending" : predictedDep ? (item.conflict ? "correct-wait" : "unnecessary-wait") : item.replayed || item.conflict ? "false-bypass" : "correct-bypass";
      return {
        index: item.index,
        pc: op?.pc ?? 0,
        text: op?.text ?? "",
        predictedDep,
        confidence: confidenceOf(state, !predictedDep),
        action: predictedDep ? "Stall/Check" : "Speculate",
        outcome,
      };
    });
    shots.push({
      cycle,
      loads: live.filter((item) => ops[item.index]?.kind === "load" && item.dispatched != null).map((item) => entry(item)),
      stores: live.filter((item) => ops[item.index]?.kind === "store" && item.dispatched != null).map((item) => entry(item)),
      memory: [...memory.entries()].map(([addr, value]) => ({ addr, value, mark: marks.get(addr) ?? "init" })),
      log: log.slice(),
      cells: cells.map((row) => row.slice()),
      event,
      forwarded,
      replays,
      stalls,
      reads,
      violations,
      waits,
      bypasses,
      decisions,
      accuracy: accuracy.slice(),
      misrate: misrate.slice(),
    });
    const done = live.every((item) => item.dispatched != null && (ops[item.index]?.kind === "load" ? item.executed != null : item.committed != null));
    if (done) break;
  }
  return {
    shots,
    cycles: shots.length,
    forwarded,
    replays,
    stalls,
    reads,
    violations,
    waits,
    bypasses,
    correct,
    wrong,
    memory: [...memory.entries()].map(([addr, value]) => ({ addr, value })),
    loadValues: live.filter((item) => ops[item.index]?.kind === "load").map((item) => ({ index: item.index, value: item.value })),
  };
}

export function comparePolicies(ops: LsqOp[], regs: Record<string, number>, memory: Record<number, number>, threshold = 2) {
  return {
    conservative: runLsq(ops, regs, memory, { policy: "conservative", threshold }),
    bypass: runLsq(ops, regs, memory, { policy: "bypass", threshold }),
    predictor: runLsq(ops, regs, memory, { policy: "counter", threshold }),
  };
}

function mem(pc: number, text: string, comment: string, kind: LsqOp["kind"], base: string, offset: number, extra: Partial<LsqOp> = {}): LsqOp {
  return { pc, text, comment, kind, dest: extra.dest ?? null, dataReg: extra.dataReg ?? null, immData: extra.immData ?? null, base, offset, latency: extra.latency ?? 0 };
}

export function parseLsqProgram(text: string): { ops: LsqOp[]; regs: Record<string, number>; memory: Record<number, number>; errors: string[] } {
  const ops: LsqOp[] = [];
  const errors: string[] = [];
  const regs: Record<string, number> = { ...MEM_REGS };
  const memory: Record<number, number> = {};
  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const clean = trimmed.replace(/[\[\],]/g, " ").replace(/\s+/g, " ");
    const parts = clean.split(" ");
    const op = (parts[0] ?? "").toUpperCase();
    const hex = parts.map((part) => part.replace(/^0x/i, "")).find((part) => /^[0-9a-f]+$/i.test(part) && /[a-f]/i.test(part) || /^[0-9a-f]{3,}$/i.test(part));
    const address = hex ? Number.parseInt(hex, 16) : null;
    const regsIn = parts.filter((part) => /^[xr]\d+$/i.test(part)).map((part) => part.replace(/^r/i, "x"));
    const immediate = parts.map((part) => Number(part)).find((value) => Number.isFinite(value) && value < 0x100);
    if ((op === "LOAD" || op === "LD" || op === "LW") && regsIn[0]) {
      const base = address != null ? "x0" : (regsIn[1] ?? "x1");
      ops.push(mem(0x1000 + index * 4, trimmed, "student load", "load", base, address ?? 0, { dest: regsIn[0] }));
      if (address != null) memory[address] = memory[address] ?? 0;
      return;
    }
    if ((op === "STORE" || op === "SD" || op === "SW")) {
      const base = address != null ? "x0" : (regsIn[0] ?? "x1");
      const data = immediate ?? 1;
      ops.push(mem(0x1000 + index * 4, trimmed, "student store", "store", base, address ?? 0, { immData: data, dataReg: address == null ? (regsIn[1] ?? null) : null }));
      return;
    }
    errors.push(`Line ${index + 1}: use LOAD x1, 0x100 or STORE 0x100, 42 or STORE x2, 7`);
  });
  regs.x0 = 0;
  return { ops, regs, memory, errors };
}

export const MEM_REGS: Record<string, number> = { x1: 0x1000, x2: 0x1000, x3: 0x1004, x5: 0x10, x6: 0x20, x8: 0x2000, x10: 0x1000, x11: 0x3000, x12: 0x2000 };
export const MEM_IMAGE: Record<number, number> = { 0x1000: 0x11, 0x1004: 0x22, 0x2000: 0x2000, 0x2008: 0x44, 0x3000: 0x55 };

export const LSQ_PRESETS: Array<{ id: string; label: string; ops: LsqOp[]; policy: MemPolicy }> = [
  { id: "load", label: "Independent load", policy: "conservative", ops: [mem(0x2000, "LD x5, 0(x1)", "read 0x1000", "load", "x1", 0, { dest: "x5" })] },
  { id: "store", label: "Independent store", policy: "conservative", ops: [mem(0x2004, "SD x6, 0(x1)", "write 0x1000", "store", "x1", 0, { dataReg: "x6" })] },
  { id: "forward", label: "Store-to-load forwarding", policy: "conservative", ops: [mem(0x2010, "SD x5, 0(x1)", "store 0x10", "store", "x1", 0, { dataReg: "x5" }), mem(0x2014, "LD x7, 0(x1)", "load same address", "load", "x1", 0, { dest: "x7" })] },
  { id: "young", label: "Two stores, same address", policy: "conservative", ops: [mem(0x2020, "SD x5, 0(x1)", "older value 0x10", "store", "x1", 0, { dataReg: "x5" }), mem(0x2024, "SD x6, 0(x1)", "younger value 0x20", "store", "x1", 0, { dataReg: "x6" }), mem(0x2028, "LD x7, 0(x1)", "must see 0x20", "load", "x1", 0, { dest: "x7" })] },
  { id: "unknown", label: "Unknown older store", policy: "conservative", ops: [mem(0x2030, "LD x2, 0(x1)", "produces the store address", "load", "x1", 0, { dest: "x2", latency: 4 }), mem(0x2034, "SD x5, 0(x2)", "address unknown until x2 is ready", "store", "x2", 0, { dataReg: "x5" }), mem(0x2038, "LD x6, 0(x8)", "different address, but an older store is unknown", "load", "x8", 0, { dest: "x6" })] },
  { id: "violate", label: "Memory violation and replay", policy: "bypass", ops: [mem(0x2040, "LD x2, 0(x8)", "x2 becomes 0x2000", "load", "x8", 0, { dest: "x2", latency: 4 }), mem(0x2044, "SD x5, 0(x2)", "later resolves to 0x2000", "store", "x2", 0, { dataReg: "x5" }), mem(0x2048, "LD x6, 8(x8)", "0x2008, no conflict", "load", "x8", 8, { dest: "x6" }), mem(0x204c, "LD x7, 0(x12)", "0x2000, conflicts with the store", "load", "x12", 0, { dest: "x7" })] },
  { id: "safe", label: "Non-conflicting out-of-order load", policy: "bypass", ops: [mem(0x2050, "LD x2, 0(x1)", "x2 becomes 0x1000", "load", "x1", 0, { dest: "x2" }), mem(0x2054, "SD x5, 0(x2)", "will be 0x1000", "store", "x2", 0, { dataReg: "x5" }), mem(0x2058, "LD x6, 0(x11)", "0x3000, independent", "load", "x11", 0, { dest: "x6" })] },
];

export const DISAMBIG_PRESETS: Array<{ id: string; label: string; ops: LsqOp[] }> = [
  { id: "none", label: "No memory conflicts", ops: LSQ_PRESETS[6]?.ops ?? [] },
  { id: "same", label: "Frequent same-address dependence", ops: [mem(0x3000, "SD x5, 0(x1)", "S1", "store", "x1", 0, { dataReg: "x5" }), mem(0x3004, "LD x7, 0(x1)", "depends on S1", "load", "x1", 0, { dest: "x7" }), mem(0x3008, "SD x6, 0(x1)", "S2", "store", "x1", 0, { dataReg: "x6" }), mem(0x300c, "LD x3, 0(x1)", "depends on S2", "load", "x1", 0, { dest: "x3" })] },
  { id: "mixed", label: "Mixed conflicts", ops: LSQ_PRESETS[5]?.ops ?? [] },
  { id: "learn", label: "Repeating load-store relationship", ops: [0, 1, 2].flatMap((slot) => [mem(0x3100 + slot * 8, `SD x5, ${slot * 4}(x1)`, `store ${slot}`, "store", "x1", slot * 4, { dataReg: "x5" }), mem(0x3104 + slot * 8, `LD x6, ${slot * 4}(x1)`, `load ${slot}`, "load", "x1", slot * 4, { dest: "x6" })]) },
  { id: "phase", label: "Phase-changing workload", ops: [mem(0x3200, "LD x6, 0(x11)", "independent", "load", "x11", 0, { dest: "x6" }), mem(0x3204, "SD x5, 0(x1)", "later dependence", "store", "x1", 0, { dataReg: "x5" }), mem(0x3208, "LD x7, 0(x1)", "same address", "load", "x1", 0, { dest: "x7" })] },
  { id: "stress", label: "Conservative-policy stress", ops: LSQ_PRESETS[4]?.ops ?? [] },
  { id: "train", label: "Predictor-learning case", ops: [mem(0x3300, "LD x2, 0(x8)", "address producer", "load", "x8", 0, { dest: "x2", latency: 4 }), mem(0x3304, "SD x5, 0(x2)", "unknown then conflicting", "store", "x2", 0, { dataReg: "x5" }), mem(0x3308, "LD x7, 0(x12)", "first dynamic instance bypasses", "load", "x12", 0, { dest: "x7" }), mem(0x3300, "LD x2, 0(x8)", "second iteration", "load", "x8", 0, { dest: "x2", latency: 4 }), mem(0x3304, "SD x6, 0(x2)", "same store PC", "store", "x2", 0, { dataReg: "x6" }), mem(0x3308, "LD x3, 0(x12)", "same load PC should be more cautious", "load", "x12", 0, { dest: "x3" })] },
];
