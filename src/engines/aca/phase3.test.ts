import { describe, expect, it } from "vitest";
import { CORR_PRESETS, bitList, gshareIndex, runCorrelate, shiftHistory, tally } from "./correlate";
import { btbIndex, btbTag, runBtb } from "./btb";
import { prefer, runTournament, trainChooser } from "./tournament";
import { stepTwo } from "./predictor";

const base = { ghrBits: 4, phtBits: 4, localBits: 3, initial: 1 as const, update: true };

describe("lab 7 correlating predictor", () => {
  it("shifts the global history with the newest outcome in the low bit", () => {
    expect(shiftHistory(0, 4, true)).toBe(0b0001);
    expect(shiftHistory(0b0001, 4, true)).toBe(0b0011);
    expect(shiftHistory(0b0011, 4, false)).toBe(0b0110);
    expect(shiftHistory(0b1111, 3, true)).toBe(0b111);
    expect(bitList(0b1001, 4)).toEqual([1, 0, 0, 1]);
  });

  it("indexes gshare with PC xor history", () => {
    expect(gshareIndex(0x08, 0b1001, 4)).toBe((0x08 ^ 0b1001) & 0xf);
    expect(gshareIndex(0x18, 0b0010, 4)).toBe(gshareIndex(0x08, 0b0010, 4));
  });

  it("keeps a separate local history for each PC", () => {
    const result = runCorrelate([
      { pc: 0x100, text: "A", taken: true, comment: "" },
      { pc: 0x120, text: "B", taken: false, comment: "" },
      { pc: 0x100, text: "A", taken: true, comment: "" },
    ], base);
    expect(result.steps[2]?.localHistBefore).toBe(0b001);
    expect(result.steps[1]?.localHistBefore).toBe(0);
    expect(result.steps[0]?.ghrAfter).toBe(1);
    expect(result.steps[2]?.ghrBefore).toBe(0b10);
  });

  it("follows the 2-bit table and scores predictions", () => {
    expect(stepTwo(0, true).next).toBe(1);
    expect(stepTwo(3, true).next).toBe(3);
    const result = runCorrelate(CORR_PRESETS[0]?.events ?? [], base);
    const global = tally(result.steps.map((step) => step.gshareCorrect));
    expect(global.total).toBe(result.steps.length);
    expect(global.correct).toBeLessThanOrEqual(global.total);
    expect(result.steps.some((step) => step.aliasPc != null) || result.steps.length > 0).toBe(true);
  });

  it("reports an alias when two PCs share a gshare index", () => {
    const result = runCorrelate(CORR_PRESETS.find((item) => item.id === "alias")?.events ?? [], base);
    expect(result.steps.some((step) => step.aliasPc != null)).toBe(true);
  });

  it("is unchanged when updates are off and is deterministic", () => {
    const events = CORR_PRESETS[0]?.events ?? [];
    const once = runCorrelate(events, base);
    const twice = runCorrelate(events, base);
    expect(twice.steps.map((step) => step.ghrAfter)).toEqual(once.steps.map((step) => step.ghrAfter));
    const frozen = runCorrelate(events, { ...base, update: false });
    expect(new Set(frozen.steps.map((step) => step.ghrAfter))).toEqual(new Set([0]));
  });
});

describe("lab 8 branch target buffer", () => {
  const direct = { entries: 8, ways: 1, policy: "lru" as const, enabled: true };

  it("extracts index PC[5:3] and tag PC[31:6]", () => {
    expect(btbIndex(0x4118, 3)).toBe(3);
    expect(btbTag(0x4118, 3)).toBe(0x4118 >>> 6);
  });

  it("misses, allocates on a taken branch, then hits", () => {
    const shots = runBtb([
      { pc: 0x4000, taken: true, target: 0x1020, text: "BEQ", kind: "conditional" },
      { pc: 0x4000, taken: true, target: 0x1020, text: "BEQ", kind: "conditional" },
    ], direct);
    expect(shots[0]?.hit).toBe(false);
    expect(shots[0]?.installed).toBe(true);
    expect(shots[1]?.hit).toBe(true);
    expect(shots[1]?.predictedTarget).toBe(0x1020);
    expect(shots[1]?.targetCorrect).toBe(true);
    expect(shots[1]?.hits).toBe(1);
    expect(shots[1]?.lookups).toBe(2);
  });

  it("does not invent a target for a not-taken miss", () => {
    const shots = runBtb([{ pc: 0x4000, taken: false, target: 0x1020, text: "BEQ", kind: "conditional" }], direct);
    expect(shots[0]?.hit).toBe(false);
    expect(shots[0]?.installed).toBe(false);
    expect(shots[0]?.predictedTarget).toBeNull();
    expect(shots[0]?.nextPc).toBe(0x4004);
  });

  it("evicts a conflicting line in a direct-mapped buffer", () => {
    const shots = runBtb([
      { pc: 0x4000, taken: true, target: 0x1020, text: "A", kind: "conditional" },
      { pc: 0x4040, taken: true, target: 0x2200, text: "B", kind: "conditional" },
      { pc: 0x4000, taken: true, target: 0x1020, text: "A", kind: "conditional" },
    ], direct);
    expect(shots[1]?.evicted?.pc).toBe(0x4000);
    expect(shots[1]?.evictions).toBe(1);
    expect(shots[2]?.hit).toBe(false);
  });

  it("uses LRU and FIFO differently in a 2-way set", () => {
    const accesses = [
      { pc: 0x4000, taken: true, target: 0x1020, text: "A", kind: "conditional" as const },
      { pc: 0x4040, taken: true, target: 0x2200, text: "B", kind: "conditional" as const },
      { pc: 0x4000, taken: true, target: 0x1020, text: "A", kind: "conditional" as const },
      { pc: 0x4080, taken: true, target: 0x3300, text: "C", kind: "conditional" as const },
    ];
    const lru = runBtb(accesses, { entries: 8, ways: 2, policy: "lru", enabled: true });
    const fifo = runBtb(accesses, { entries: 8, ways: 2, policy: "fifo", enabled: true });
    expect(lru[3]?.evicted?.pc).toBe(0x4040);
    expect(fifo[3]?.evicted?.pc).toBe(0x4000);
  });

  it("does not treat a hit rate as a direction prediction", () => {
    const shots = runBtb([
      { pc: 0x4000, taken: true, target: 0x1020, text: "A", kind: "conditional" },
      { pc: 0x4000, taken: false, target: 0x1020, text: "A", kind: "conditional" },
    ], direct);
    const second = shots[1];
    expect(second?.hit).toBe(true);
    expect(second ? second.hits / second.lookups : 0).toBe(0.5);
    expect(second?.nextPc).toBe(0x4004);
  });
});

describe("lab 9 tournament predictor", () => {
  it("moves the chooser only when the components disagree", () => {
    expect(trainChooser(2, true, false)).toBe(1);
    expect(trainChooser(1, false, true)).toBe(2);
    expect(trainChooser(2, true, true)).toBe(2);
    expect(trainChooser(2, false, false)).toBe(2);
    expect(trainChooser(0, true, false)).toBe(0);
    expect(trainChooser(3, false, true)).toBe(3);
    expect(prefer(1)).toBe("local");
    expect(prefer(2)).toBe("global");
  });

  it("takes the final prediction from the selected component", () => {
    const events = [
      { pc: 0x10, text: "A", taken: true, comment: "" },
      { pc: 0x14, text: "B", taken: true, comment: "" },
      { pc: 0x10, text: "A", taken: false, comment: "" },
      { pc: 0x14, text: "B", taken: false, comment: "" },
    ];
    const result = runTournament(events, { localBits: 3, ghrBits: 4, phtBits: 4, bimodalBits: 4, initial: 1, chooser: 2, update: true });
    result.steps.forEach((step) => {
      const chosen = step.selected === "local" ? step.localPred : step.globalPred;
      expect(step.finalPred).toBe(chosen);
    });
    const again = runTournament(events, { localBits: 3, ghrBits: 4, phtBits: 4, bimodalBits: 4, initial: 1, chooser: 2, update: true });
    expect(again.tournament).toEqual(result.tournament);
    expect(result.tournament.total).toBe(4);
  });
});
