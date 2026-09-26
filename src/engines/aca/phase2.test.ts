import { describe, expect, it } from "vitest";
import { RENAME_EXAMPLE, runRename } from "./rename";
import { OOO_EXAMPLE, runOoo } from "./ooo";
import { accuracy, runTrace, stepOne, stepTwo } from "./predictor";

describe("lab 4 renaming", () => {
  const result = runRename(RENAME_EXAMPLE);

  it("keeps RAW and removes WAW by giving the second write a new physical register", () => {
    expect(result.waw).toBeGreaterThan(0);
    expect(result.rows[0]?.physDest).not.toBe(result.rows[2]?.physDest);
    expect(result.rows[1]?.physSrcs).toContain(result.rows[0]?.physDest ?? "");
  });

  it("does not allocate the same physical destination twice", () => {
    const dests = result.rows.map((row) => row.physDest).filter((name) => name !== "—");
    expect(new Set(dests).size).toBe(dests.length);
  });

  it("frees only registers that are not mapped", () => {
    const mapped = new Set(result.map.map((item) => item.phys));
    expect(result.free.every((name) => !mapped.has(name))).toBe(true);
  });

  it("lets the renamed scoreboard finish with fewer stall events", () => {
    expect(result.renamedStalls).toBeLessThan(result.baselineStalls);
    expect(result.renamedCycles).toBeLessThanOrEqual(result.baselineCycles);
  });

  it("reports a rename stall when the free list runs out", () => {
    const tight = runRename(RENAME_EXAMPLE, 2);
    expect(tight.renameStalls).toBeGreaterThan(0);
    expect(tight.rows.some((row) => row.physDest === "stall")).toBe(true);
  });
});

describe("lab 5 reorder buffer", () => {
  const shots = runOoo(OOO_EXAMPLE);
  const last = shots.at(-1);

  it("executes an independent instruction before an older multiply finishes", () => {
    const subWb = shots.find((shot) => shot.entries[3]?.state === "WB" || shot.entries[3]?.state === "C")?.cycle ?? 99;
    const mulWb = shots.find((shot) => shot.entries[2]?.state === "WB" || shot.entries[2]?.state === "C")?.cycle ?? 0;
    expect(subWb).toBeLessThan(mulWb);
  });

  it("commits in program order", () => {
    const commits = last?.entries.map((entry) => entry.committed);
    expect(commits?.every(Boolean)).toBe(true);
    const order = shots.flatMap((shot) => shot.entries.filter((entry) => shot.commit === entry.text).map((entry) => entry.index));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("flushes younger instructions when the head faults", () => {
    const faulted = runOoo(OOO_EXAMPLE, 1);
    const end = faulted.at(-1);
    expect(end?.exception).toContain("ADD");
    expect(end?.entries[2]?.state).toBe("FLUSH");
    expect(end?.entries[0]?.committed).toBe(true);
  });

  it("takes longer when the reorder buffer holds only two instructions", () => {
    const wide = runOoo(OOO_EXAMPLE, null, 16).at(-1)?.cycle ?? 0;
    const narrow = runOoo(OOO_EXAMPLE, null, 2).at(-1)?.cycle ?? 0;
    expect(narrow).toBeGreaterThan(wide);
  });
});

describe("lab 6 predictors", () => {
  it("follows the 1-bit and 2-bit transition tables", () => {
    expect(stepOne(1, false).next).toBe(0);
    expect(stepOne(0, true).next).toBe(1);
    expect(stepTwo(0, true).next).toBe(1);
    expect(stepTwo(1, true).next).toBe(2);
    expect(stepTwo(2, true).next).toBe(3);
    expect(stepTwo(3, true).next).toBe(3);
    expect(stepTwo(3, false).next).toBe(2);
    expect(stepTwo(2, false).next).toBe(1);
    expect(stepTwo(1, false).next).toBe(0);
    expect(stepTwo(0, false).next).toBe(0);
  });

  it("scores a repeated loop from real predictions", () => {
    const trace = Array.from({ length: 4 }, () => [true, true, true, true, false]).flat();
    const rows = runTrace(trace, 1, 3);
    expect(accuracy(rows, "bit")).toEqual({ correct: 13, total: 20, percent: 65 });
    expect(accuracy(rows, "two").correct).toBeGreaterThan(accuracy(rows, "bit").correct);
  });
});
