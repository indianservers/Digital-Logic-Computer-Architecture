export type SyncKind = "tas" | "ticket" | "cas" | "faa" | "llsc" | "lost";

export interface SyncConfig {
  threads: number;
  cs: number;
  think: number;
  rounds: number;
}

export interface ThreadView {
  id: number;
  phase: string;
  ticket: number | null;
  acquires: number;
  fails: number;
  spin: number;
  wait: number;
}

export interface SyncEvent {
  cycle: number;
  thread: number;
  event: string;
  detail: string;
}

export interface SyncShot {
  cycle: number;
  event: string;
  threads: ThreadView[];
  lock: number;
  owner: number | null;
  counter: number;
  nextTicket: number;
  serving: number;
  queue: number[];
  log: SyncEvent[];
  atomic: number;
  acquires: number;
  fails: number;
  casFails: number;
  scFails: number;
  spin: number;
  avgWait: number;
  maxWait: number;
  entries: number;
  throughput: number;
  fairness: number;
  order: number[];
}

export interface SyncResult {
  shots: SyncShot[];
  final: SyncShot;
  order: number[];
  perThread: ThreadView[];
}

export const SYNC_DEFAULTS: SyncConfig = { threads: 4, cs: 3, think: 0, rounds: 2 };

interface Thread {
  id: number;
  phase: "spin" | "cas" | "ll" | "cs" | "think" | "done";
  ticket: number | null;
  local: number;
  acquires: number;
  fails: number;
  spin: number;
  wait: number;
  thinkLeft: number;
  csLeft: number;
}

function stdev(values: number[]) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function viewOf(thread: Thread): ThreadView {
  const phase = thread.phase === "cs" ? "In critical section" : thread.phase === "spin" || thread.phase === "ll" || thread.phase === "cas" ? "Spinning" : thread.phase === "think" ? "Thinking" : "Done";
  return { id: thread.id, phase, ticket: thread.ticket, acquires: thread.acquires, fails: thread.fails, spin: thread.spin, wait: thread.wait };
}

export function runSync(kind: SyncKind, config: SyncConfig = SYNC_DEFAULTS): SyncResult {
  const width = Math.max(1, config.threads);
  const rounds = Math.max(1, config.rounds);
  const threads: Thread[] = Array.from({ length: width }, (_, id) => ({
    id, phase: "spin", ticket: null, local: 0, acquires: 0, fails: 0, spin: 0, wait: 0, thinkLeft: 0, csLeft: 0,
  }));
  let lock = 0;
  let owner: number | null = null;
  let counter = 0;
  let nextTicket = 0;
  let serving = 0;
  let reservation: { thread: number; value: number } | null = null;
  const log: SyncEvent[] = [];
  const order: number[] = [];
  const shots: SyncShot[] = [];
  const totals = { atomic: 0, casFails: 0, scFails: 0 };
  const note = (cycle: number, thread: number, event: string, detail: string) => {
    log.push({ cycle, thread, event, detail });
  };
  const enter = (thread: Thread, cycle: number) => {
    thread.phase = "cs";
    thread.csLeft = Math.max(1, config.cs);
    thread.acquires += 1;
    owner = thread.id;
    order.push(thread.id);
    note(cycle, thread.id, "Enter critical section", `Acquire ${thread.acquires}`);
  };
  const release = (thread: Thread, cycle: number) => {
    if (kind === "tas") lock = 0;
    if (kind === "ticket") serving += 1;
    owner = null;
    thread.ticket = null;
    note(cycle, thread.id, "Release", kind === "ticket" ? `Now serving ${serving}` : "Lock is free");
    if (thread.acquires >= rounds) thread.phase = "done";
    else if (config.think <= 0) thread.phase = "spin";
    else { thread.phase = "think"; thread.thinkLeft = config.think; }
  };
  const snapshot = (cycle: number, event: string): SyncShot => {
    const waits = threads.map((thread) => thread.wait);
    const acquires = threads.reduce((sum, thread) => sum + thread.acquires, 0);
    const fails = threads.reduce((sum, thread) => sum + thread.fails, 0);
    const spin = threads.reduce((sum, thread) => sum + thread.spin, 0);
    return {
      cycle,
      event,
      threads: threads.map(viewOf),
      lock,
      owner,
      counter,
      nextTicket,
      serving,
      queue: threads.filter((thread) => thread.phase === "spin" || thread.phase === "ll" || thread.phase === "cas").map((thread) => thread.id),
      log: log.slice(-12),
      atomic: totals.atomic,
      acquires,
      fails,
      casFails: totals.casFails,
      scFails: totals.scFails,
      spin,
      avgWait: waits.length ? waits.reduce((sum, value) => sum + value, 0) / waits.length : 0,
      maxWait: waits.length ? Math.max(...waits) : 0,
      entries: acquires,
      throughput: cycle ? acquires / cycle : 0,
      fairness: stdev(waits),
      order: order.slice(),
    };
  };
  shots.push(snapshot(0, "Threads are waiting to enter"));
  let cycle = 0;
  const limit = width * rounds * (Math.max(1, config.cs) + config.think + 4) + 8;
  const workLeft = () => threads.some((thread) => thread.phase !== "done") && (kind === "tas" || kind === "ticket" || threads.some((thread) => thread.acquires < rounds));
  while (workLeft() && cycle < limit) {
    let event = "Clock";
    threads.forEach((thread) => {
      if (thread.phase === "done" || thread.phase === "cs") return;
      if (thread.phase === "think") {
        thread.thinkLeft -= 1;
        if (thread.thinkLeft <= 0) thread.phase = "spin";
        return;
      }
      if (kind === "lost") return;
      totals.atomic += 1;
      if (kind === "tas") {
        const old = lock;
        lock = 1;
        if (old === 0) { enter(thread, cycle); event = `T${thread.id} TAS success`; }
        else { thread.fails += 1; thread.spin += 1; thread.wait += 1; event = `T${thread.id} TAS fail`; }
        return;
      }
      if (kind === "ticket") {
        if (thread.ticket === null) {
          thread.ticket = nextTicket;
          nextTicket += 1;
          note(cycle, thread.id, "Ticket", `Ticket ${thread.ticket}`);
        }
        if (serving === thread.ticket) { enter(thread, cycle); event = `T${thread.id} ticket ${thread.ticket}`; }
        else { thread.spin += 1; thread.wait += 1; }
        return;
      }
      if (kind === "faa") {
        const old = counter;
        counter = old + 1;
        thread.acquires += 1;
        note(cycle, thread.id, "Fetch-and-add", `Returned ${old}, counter ${counter}`);
        if (thread.acquires >= rounds) thread.phase = "done";
        event = `T${thread.id} FAA`;
        return;
      }
      if (kind === "cas") {
        if (thread.phase === "spin") {
          thread.local = counter;
          thread.phase = "cas";
          note(cycle, thread.id, "Load", `Expected ${thread.local}`);
          return;
        }
        if (counter === thread.local) {
          counter = thread.local + 1;
          thread.acquires += 1;
          note(cycle, thread.id, "CAS success", `Counter ${counter}`);
          thread.phase = thread.acquires >= rounds ? "done" : "spin";
          event = `T${thread.id} CAS success`;
        } else {
          totals.casFails += 1;
          thread.fails += 1;
          thread.phase = "spin";
          note(cycle, thread.id, "CAS failure", `Memory is ${counter}, expected ${thread.local}`);
          event = `T${thread.id} CAS failure`;
        }
        return;
      }
      if (thread.phase === "spin") {
        reservation = { thread: thread.id, value: counter };
        thread.phase = "ll";
        note(cycle, thread.id, "Load-linked", `Value ${counter}`);
        return;
      }
      if (reservation && reservation.thread === thread.id && reservation.value === counter) {
        counter = reservation.value + 1;
        reservation = null;
        thread.acquires += 1;
        thread.phase = thread.acquires >= rounds ? "done" : "spin";
        note(cycle, thread.id, "Store-conditional success", `Counter ${counter}`);
        event = `T${thread.id} SC success`;
      } else {
        totals.scFails += 1;
        thread.fails += 1;
        if (reservation?.thread === thread.id) reservation = null;
        thread.phase = "spin";
        note(cycle, thread.id, "Store-conditional failure", "Reservation was lost");
        event = `T${thread.id} SC failure`;
      }
    });
    threads.forEach((thread) => {
      if (thread.phase !== "cs") return;
      thread.csLeft -= 1;
      if (thread.csLeft <= 0) release(thread, cycle);
    });
    if (kind === "lost" && cycle === 0) {
      threads.forEach((thread) => { thread.local = counter; note(cycle, thread.id, "Non-atomic read", `Saw ${thread.local}`); });
    }
    if (kind === "lost" && cycle === 1) {
      threads.forEach((thread) => {
        counter = thread.local + 1;
        thread.acquires += 1;
        thread.phase = "done";
        note(cycle, thread.id, "Non-atomic write", `Wrote ${counter}`);
      });
      event = "Lost update";
    }
    cycle += 1;
    shots.push(snapshot(cycle, event));
    const owners = threads.filter((thread) => thread.phase === "cs").length;
    if (owners > 1) note(cycle, -1, "Mutual exclusion broken", `${owners} threads in the critical section`);
  }
  const final = shots[shots.length - 1] ?? shots[0]!;
  return { shots, final, order, perThread: threads.map(viewOf) };
}

export function compareLocks(config: SyncConfig = SYNC_DEFAULTS) {
  return { tas: runSync("tas", config), ticket: runSync("ticket", config) };
}

export function compareCounters(config: SyncConfig = SYNC_DEFAULTS) {
  return { lost: runSync("lost", config), atomic: runSync("faa", config) };
}

export function waitByWidth(kind: "tas" | "ticket", widths: number[], config: SyncConfig = SYNC_DEFAULTS) {
  return widths.map((threads) => {
    const result = runSync(kind, { ...config, threads });
    return { threads, avgWait: result.final.avgWait, maxWait: result.final.maxWait, fairness: result.final.fairness };
  });
}

export const SYNC_PRESETS: Array<{ id: string; label: string; kind: SyncKind; config: SyncConfig }> = [
  { id: "tas-2", label: "TAS lock, 2 threads", kind: "tas", config: { threads: 2, cs: 3, think: 1, rounds: 2 } },
  { id: "tas-hot", label: "TAS lock, high contention", kind: "tas", config: { threads: 4, cs: 4, think: 0, rounds: 3 } },
  { id: "cas", label: "CAS counter", kind: "cas", config: { threads: 4, cs: 1, think: 0, rounds: 2 } },
  { id: "faa", label: "Fetch-and-add counter", kind: "faa", config: { threads: 4, cs: 1, think: 0, rounds: 2 } },
  { id: "llsc", label: "LL/SC retry", kind: "llsc", config: { threads: 3, cs: 1, think: 0, rounds: 2 } },
  { id: "ticket", label: "Ticket lock fairness", kind: "ticket", config: { threads: 4, cs: 3, think: 0, rounds: 2 } },
  { id: "lost", label: "Non-atomic lost update", kind: "lost", config: { threads: 2, cs: 1, think: 0, rounds: 1 } },
  { id: "versus", label: "Atomic versus non-atomic counter", kind: "faa", config: { threads: 4, cs: 1, think: 0, rounds: 1 } },
];
