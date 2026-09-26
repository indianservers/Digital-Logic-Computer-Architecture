import { describe, expect, it } from "vitest";
import { DRAM_DEFAULTS, DRAM_PRESETS, DRAM_TIMING, compareSchedulers, decodeAddress, runDram } from "./dram";
import { LITMUS_TESTS, enumerate, initialState, insertFence, legalActions, outcomeCount, applyAction, parseLitmus } from "./consistency";
import { SYNC_DEFAULTS, compareCounters, compareLocks, runSync } from "./sync";

function preset<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

describe("lab 25 dram controller", () => {
  it("decodes column, then bank, then row", () => {
    const place = decodeAddress(0x0400, DRAM_DEFAULTS);
    expect(place.column).toBe(0);
    expect(place.bank).toBe(0);
    expect(place.row).toBe(1);
    expect(decodeAddress(0x0100, DRAM_DEFAULTS).bank).toBe(1);
    expect(decodeAddress(0x0010, DRAM_DEFAULTS)).toMatchObject({ bank: 0, row: 0, column: 0x10 });
  });

  it("treats a closed bank as an activation and a later same row as a hit", () => {
    const item = preset(DRAM_PRESETS, "hits");
    const result = runDram(item.accesses, { ...DRAM_DEFAULTS, policy: "fcfs" });
    expect(result.final.closed).toBe(1);
    expect(result.final.hits).toBe(3);
    expect(result.final.conflicts).toBe(0);
    const first = result.rows[0];
    expect(first?.complete).toBe(DRAM_TIMING.tRCD + DRAM_TIMING.tCL);
    expect(result.commands.some((row) => row[0] === "ACT")).toBe(true);
    expect(result.commands.some((row) => row[0] === "RD")).toBe(true);
  });

  it("precharges a conflicting row and queues the same bank", () => {
    const item = preset(DRAM_PRESETS, "conflicts");
    const result = runDram(item.accesses, { ...DRAM_DEFAULTS, policy: "fcfs" });
    expect(result.final.conflicts).toBe(3);
    expect(result.final.closed).toBe(1);
    expect(result.commands.some((row) => row.includes("PRE"))).toBe(true);
    const completes = result.rows.map((row) => row.complete ?? 0);
    expect(completes[1]).toBeGreaterThan(completes[0] ?? 0);
    expect(result.final.cycle).toBeGreaterThan(DRAM_TIMING.tRCD + DRAM_TIMING.tCL);
  });

  it("services different banks in the same cycles", () => {
    const item = preset(DRAM_PRESETS, "parallel");
    const result = runDram(item.accesses, DRAM_DEFAULTS);
    expect(result.final.conflicts).toBe(0);
    expect(result.final.closed).toBe(4);
    expect(Math.max(...result.active)).toBe(4);
    expect(result.final.cycle).toBeLessThan(4 * (DRAM_TIMING.tRCD + DRAM_TIMING.tCL));
    expect(result.final.blp).toBeGreaterThan(1);
  });

  it("lets FR-FCFS prefer an open-row hit over an older conflict", () => {
    const item = preset(DRAM_PRESETS, "ready");
    const compared = compareSchedulers(item.accesses, DRAM_DEFAULTS);
    expect(compared.fcfs.final.hits).toBe(1);
    expect(compared.ready.final.hits).toBe(2);
    expect(compared.ready.final.avgLatency).toBeLessThan(compared.fcfs.final.avgLatency);
    const again = runDram(item.accesses, { ...DRAM_DEFAULTS, policy: "frfcfs" });
    expect(again.final.hits).toBe(compared.ready.final.hits);
    expect(again.final.cycle).toBe(compared.ready.final.cycle);
  });

  it("lets an age threshold pull a starved conflict ahead of new hits", () => {
    const item = preset(DRAM_PRESETS, "starve");
    const patient = runDram(item.accesses, { ...DRAM_DEFAULTS, policy: "frfcfs", timing: { ...DRAM_TIMING, ageThreshold: 0 } });
    const fair = runDram(item.accesses, { ...DRAM_DEFAULTS, policy: "frfcfs", timing: { ...DRAM_TIMING, ageThreshold: 4 } });
    const waited = (result: typeof patient) => result.rows.find((row) => row.address === 0x0400)?.complete ?? 0;
    expect(waited(fair)).toBeLessThan(waited(patient));
  });
});

describe("lab 26 memory consistency", () => {
  const sb = preset(LITMUS_TESTS, "sb");
  const mp = preset(LITMUS_TESTS, "mp");
  const synced = preset(LITMUS_TESTS, "mp-sync");
  const lb = preset(LITMUS_TESTS, "lb");

  it("forbids the store-buffer outcome under sequential consistency", () => {
    const result = enumerate(sb, "sc");
    expect(outcomeCount(result, { r0: 0, r1: 0 })).toBe(0);
    expect(outcomeCount(result, { r0: 0, r1: 1 })).toBeGreaterThan(0);
    expect(outcomeCount(result, { r0: 1, r1: 0 })).toBeGreaterThan(0);
  });

  it("allows the store-buffer outcome under TSO and forwards a buffered store", () => {
    const result = enumerate(sb, "tso");
    expect(outcomeCount(result, { r0: 0, r1: 0 })).toBeGreaterThan(0);
    const forward = enumerate({
      id: "fwd",
      label: "Forward",
      threads: [[{ kind: "store", addr: "X", value: 1 }, { kind: "load", addr: "X", reg: "r0" }]],
      memory: { X: 0 },
      observe: ["r0"],
    }, "tso");
    expect(outcomeCount(forward, { r0: 1 })).toBeGreaterThan(0);
    expect(outcomeCount(forward, { r0: 0 })).toBe(0);
    const again = enumerate(sb, "tso");
    expect(again.terminals).toBe(result.terminals);
  });

  it("makes a fence drain the store buffer before the load", () => {
    const fenced = insertFence(insertFence(sb, 0, ["store"]), 1, ["store"]);
    const result = enumerate(fenced, "tso");
    expect(outcomeCount(result, { r0: 0, r1: 0 })).toBe(0);
  });

  it("keeps message passing ordered under TSO and release/acquire, and broken under weak plain stores", () => {
    expect(outcomeCount(enumerate(mp, "tso"), { r0: 1, r1: 0 })).toBe(0);
    expect(outcomeCount(enumerate(mp, "weak"), { r0: 1, r1: 0 })).toBeGreaterThan(0);
    expect(outcomeCount(enumerate(synced, "release"), { r0: 1, r1: 0 })).toBe(0);
    expect(outcomeCount(enumerate(synced, "release"), { r0: 1, r1: 42 })).toBeGreaterThan(0);
    expect(outcomeCount(enumerate(lb, "tso"), { r0: 1, r1: 1 })).toBe(0);
    expect(outcomeCount(enumerate(lb, "weak"), { r0: 1, r1: 1 })).toBeGreaterThan(0);
    const start = initialState(sb);
    const action = legalActions(start, sb, "tso").find((item) => item.type === "exec" && item.thread === 0);
    expect(action).toBeTruthy();
    if (action) {
      const next = applyAction(start, sb, action, "tso");
      expect(next.buffers[0]?.length).toBe(1);
      expect(next.memory.X).toBe(0);
    }
  });

  it("enumerates a student litmus under SC and TSO", () => {
    const built = parseLitmus("init X=0 Y=0\n0: X = 1\n0: r1 = Y\n1: Y = 1\n1: r2 = X");
    expect(built.error).toBe("");
    expect(outcomeCount(enumerate(built.litmus, "sc"), { r1: 0, r2: 0 })).toBe(0);
    expect(outcomeCount(enumerate(built.litmus, "tso"), { r1: 0, r2: 0 })).toBeGreaterThan(0);
  });
});

describe("lab 27 atomics and locks", () => {
  it("keeps a TAS spinlock to one owner and a ticket lock to FIFO order", () => {
    const config = { threads: 4, cs: 2, think: 0, rounds: 2 };
    const locks = compareLocks(config);
    locks.tas.shots.forEach((shot) => {
      expect(shot.threads.filter((thread) => thread.phase === "In critical section").length).toBeLessThanOrEqual(1);
    });
    expect(locks.tas.order.slice(0, config.rounds).every((id) => id === 0)).toBe(true);
    expect(locks.ticket.order.slice(0, config.threads)).toEqual([0, 1, 2, 3]);
    expect(locks.ticket.final.fairness).toBeLessThan(locks.tas.final.fairness);
    expect(locks.tas.final.entries).toBe(config.threads * config.rounds);
    const again = runSync("ticket", config);
    expect(again.order).toEqual(locks.ticket.order);
  });

  it("fails a mismatched CAS, increments with FAA, and retries a lost LL/SC reservation", () => {
    const cas = runSync("cas", { ...SYNC_DEFAULTS, threads: 3, rounds: 2 });
    expect(cas.final.counter).toBe(6);
    expect(cas.final.casFails).toBeGreaterThan(0);
    const faa = runSync("faa", { threads: 4, cs: 1, think: 0, rounds: 2 });
    expect(faa.final.counter).toBe(8);
    expect(faa.final.fails).toBe(0);
    const linked = runSync("llsc", { threads: 3, cs: 1, think: 0, rounds: 2 });
    expect(linked.final.counter).toBe(6);
    expect(linked.final.scFails).toBeGreaterThan(0);
  });

  it("loses a non-atomic increment and keeps every atomic increment", () => {
    const compared = compareCounters({ threads: 4, cs: 1, think: 0, rounds: 1 });
    expect(compared.lost.final.counter).toBe(1);
    expect(compared.atomic.final.counter).toBe(4);
    const again = runSync("lost", { threads: 2, cs: 1, think: 0, rounds: 1 });
    expect(again.final.counter).toBe(1);
  });
});
