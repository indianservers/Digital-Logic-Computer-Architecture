import { describe, expect, it } from "vitest";
import { DISAMBIG_PRESETS, LSQ_PRESETS, MEM_IMAGE, MEM_REGS, comparePolicies, runLsq } from "./lsq";
import { PRF_PRESETS, runPrf, type PrfOp } from "./prf";

function pick<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`Missing preset ${index}`);
  return item;
}

describe("lab 13 physical register file", () => {
  it("captures source tags before the destination is remapped", () => {
    const ops: PrfOp[] = [{ text: "ADD x1, x1, x2", dest: "x1", srcs: ["x1", "x2"], latency: 1, kind: "alu", imm: 0 }];
    const result = runPrf(ops);
    const row = result.rows[0];
    expect(row?.srcPhys).toEqual([1, 2]);
    expect(row?.newPhys).toBe(8);
    expect(row?.srcPhys.includes(row.newPhys ?? -1)).toBe(false);
    expect(row?.oldPhys).toBe(1);
  });

  it("keeps the old mapping until commit and then reclaims it", () => {
    const result = runPrf(pick(PRF_PRESETS, 0).ops, pick(PRF_PRESETS, 0).config);
    const renamed = result.rows[1];
    const renameShot = result.shots.find((shot) => shot.cycle === renamed?.renameCycle);
    expect(renameShot?.free.includes(renamed?.oldPhys ?? -1)).toBe(false);
    expect(renameShot?.rat.find((entry) => entry.arch === "x5")?.phys).toBe(renamed?.newPhys);
    const commitShot = result.shots.find((shot) => shot.cycle === renamed?.commitCycle);
    expect(commitShot?.free.includes(renamed?.oldPhys ?? -1)).toBe(true);
    expect(result.finalRegs).toEqual(result.sequential);
    expect(result.reclaimed).toBeGreaterThan(0);
  });

  it("preserves RAW and gives WAR and WAW different physical registers", () => {
    const mixed = runPrf(pick(PRF_PRESETS, 0).ops);
    expect(mixed.raw).toBeGreaterThan(0);
    expect(mixed.falseDeps).toBeGreaterThan(0);
    const waw = runPrf(pick(PRF_PRESETS, 3).ops);
    expect(waw.rows[0]?.newPhys).not.toBe(waw.rows[1]?.newPhys);
    expect(waw.rows[2]?.srcPhys[0]).toBe(waw.rows[1]?.newPhys);
    const names = new Set<number>();
    waw.rows.forEach((row) => { if (row.newPhys != null) names.add(row.newPhys); });
    expect(names.size).toBe(waw.rows.length);
  });

  it("stalls rename when the free list is empty and restores the commit map", () => {
    const stalled = runPrf(pick(PRF_PRESETS, 4).ops);
    expect(stalled.renameStalls).toBeGreaterThan(0);
    expect(stalled.shots.some((shot) => shot.event.includes("Free list empty"))).toBe(true);
    const recovered = runPrf(pick(PRF_PRESETS, 5).ops, pick(PRF_PRESETS, 5).config);
    const shot = recovered.shots.find((item) => item.recovered);
    expect(shot?.commitMap.map((entry) => entry.phys)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(recovered.finalRegs).toEqual(recovered.sequential);
    expect(JSON.stringify(runPrf(pick(PRF_PRESETS, 0).ops).rows)).toBe(JSON.stringify(runPrf(pick(PRF_PRESETS, 0).ops).rows));
  });
});

describe("lab 14 load-store queue", () => {
  it("reads memory for an independent load and commits a store only after it is safe", () => {
    const load = runLsq(pick(LSQ_PRESETS, 0).ops, MEM_REGS, MEM_IMAGE, { policy: "conservative" });
    expect(load.loadValues[0]?.value).toBe(0x11);
    const store = runLsq(pick(LSQ_PRESETS, 1).ops, MEM_REGS, MEM_IMAGE, { policy: "conservative" });
    expect(store.shots[0]?.memory.find((entry) => entry.addr === 0x1000)?.value).toBe(0x11);
    expect(store.memory.find((entry) => entry.addr === 0x1000)?.value).toBe(0x20);
  });

  it("forwards from the youngest older store to the same address", () => {
    const forwarded = runLsq(pick(LSQ_PRESETS, 2).ops, MEM_REGS, MEM_IMAGE);
    expect(forwarded.forwarded).toBe(1);
    expect(forwarded.loadValues[0]?.value).toBe(0x10);
    const youngest = runLsq(pick(LSQ_PRESETS, 3).ops, MEM_REGS, MEM_IMAGE);
    expect(youngest.loadValues.at(-1)?.value).toBe(0x20);
    expect(youngest.memory.find((entry) => entry.addr === 0x1000)?.value).toBe(0x20);
  });

  it("waits on an unknown older store, then replays a bypass that conflicts", () => {
    const waiting = runLsq(pick(LSQ_PRESETS, 4).ops, MEM_REGS, MEM_IMAGE, { policy: "conservative" });
    expect(waiting.stalls).toBeGreaterThan(0);
    expect(waiting.violations).toBe(0);
    const violated = runLsq(pick(LSQ_PRESETS, 5).ops, MEM_REGS, MEM_IMAGE, { policy: "bypass" });
    expect(violated.violations).toBeGreaterThan(0);
    expect(violated.replays).toBeGreaterThan(0);
    expect(violated.loadValues.find((item) => item.index === 3)?.value).toBe(0x10);
    const safe = runLsq(pick(LSQ_PRESETS, 6).ops, MEM_REGS, MEM_IMAGE, { policy: "bypass" });
    expect(safe.violations).toBe(0);
    expect(safe.loadValues.at(-1)?.value).toBe(0x55);
  });

  it("keeps program order and does not overflow the queue", () => {
    const run = runLsq(pick(LSQ_PRESETS, 3).ops, MEM_REGS, MEM_IMAGE, { lqSize: 1, sqSize: 1 });
    run.shots.forEach((shot) => {
      expect(shot.loads.filter((entry) => entry.status === "Waiting" || entry.status === "Replay").length).toBeLessThanOrEqual(1);
      expect(shot.stores.filter((entry) => entry.status !== "Committed").length).toBeLessThanOrEqual(1);
      expect(shot.loads.map((entry) => entry.age)).toEqual(shot.loads.map((entry) => entry.age).slice().sort((a, b) => a - b));
      expect(shot.stores.map((entry) => entry.age)).toEqual(shot.stores.map((entry) => entry.age).slice().sort((a, b) => a - b));
    });
    expect(JSON.stringify(run.loadValues)).toBe(JSON.stringify(runLsq(pick(LSQ_PRESETS, 3).ops, MEM_REGS, MEM_IMAGE, { lqSize: 1, sqSize: 1 }).loadValues));
  });
});

describe("lab 15 memory disambiguation", () => {
  it("blocks a conservative load and lets a bypass load proceed", () => {
    const ops = pick(DISAMBIG_PRESETS, 5).ops;
    const conservative = runLsq(ops, MEM_REGS, MEM_IMAGE, { policy: "conservative" });
    const bypass = runLsq(ops, MEM_REGS, MEM_IMAGE, { policy: "bypass" });
    expect(conservative.stalls).toBeGreaterThan(0);
    expect(conservative.violations).toBe(0);
    expect(bypass.bypasses).toBeGreaterThan(0);
    expect(bypass.violations).toBe(0);
  });

  it("detects a same-address conflict and ignores an independent address", () => {
    const conflict = runLsq(pick(LSQ_PRESETS, 5).ops, MEM_REGS, MEM_IMAGE, { policy: "bypass" });
    const clear = runLsq(pick(LSQ_PRESETS, 6).ops, MEM_REGS, MEM_IMAGE, { policy: "bypass" });
    expect(conflict.violations).toBeGreaterThan(0);
    expect(clear.violations).toBe(0);
    expect(conflict.loadValues.find((item) => item.index === 3)?.value).toBe(0x10);
  });

  it("trains the counter toward waiting after a violation and compares one workload", () => {
    const trained = runLsq(pick(DISAMBIG_PRESETS, 6).ops, MEM_REGS, MEM_IMAGE, { policy: "counter", threshold: 2 });
    const decisions = trained.shots.at(-1)?.decisions ?? [];
    const first = decisions.find((item) => item.text.startsWith("LD x7"));
    const second = decisions.find((item) => item.text.startsWith("LD x3"));
    expect(first?.action).toBe("Speculate");
    expect(second?.action).toBe("Stall/Check");
    expect(trained.replays).toBeGreaterThan(0);
    const compared = comparePolicies(pick(DISAMBIG_PRESETS, 2).ops, MEM_REGS, MEM_IMAGE);
    expect(compared.conservative.shots.length).toBeGreaterThan(0);
    expect(compared.bypass.shots.length).toBeGreaterThan(0);
    expect(compared.predictor.shots.length).toBeGreaterThan(0);
    expect(JSON.stringify(trained.shots.map((shot) => shot.replays))).toBe(JSON.stringify(runLsq(pick(DISAMBIG_PRESETS, 6).ops, MEM_REGS, MEM_IMAGE, { policy: "counter", threshold: 2 }).shots.map((shot) => shot.replays)));
  });
});
