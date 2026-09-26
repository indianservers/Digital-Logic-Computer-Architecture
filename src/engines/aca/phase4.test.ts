import { describe, expect, it } from "vitest";
import { IQ_PRESETS, issueEdges, runIssue } from "./issueQueue";
import { SPEC_PRESETS, runSpeculation, sequentialRegs } from "./speculate";
import { SUPER_PRESETS, runSuper, type SuperOp, type SuperWidths } from "./superscalar";

function pick<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`Missing preset ${index}`);
  return item;
}

const wrong = pick(SPEC_PRESETS, 0);
const correct = pick(SPEC_PRESETS, 1);
const wide: SuperWidths = { fetch: 4, decode: 4, dispatch: 4, execute: 4, retire: 4 };
const scalar: SuperWidths = { fetch: 1, decode: 1, dispatch: 1, execute: 1, retire: 1 };

function maxToken(cells: Array<Array<string | null>>, token: string) {
  let max = 0;
  const width = cells.reduce((best, row) => Math.max(best, row.length), 0);
  for (let cycle = 0; cycle < width; cycle += 1) {
    let count = 0;
    cells.forEach((row) => { if (row[cycle] === token) count += 1; });
    if (count > max) max = count;
  }
  return max;
}

describe("lab 10 speculative execution", () => {
  it("does not flush when the prediction is correct", () => {
    const result = runSpeculation(correct.ops, correct.config);
    expect(result.mispredictions).toBe(0);
    expect(result.squashed).toBe(0);
    expect(result.steps.some((step) => step.flushed > 0)).toBe(false);
    expect(result.finalRegs).toEqual(result.sequentialRegs);
  });

  it("flushes only the younger wrong path and keeps older instructions", () => {
    const result = runSpeculation(wrong.ops, wrong.config);
    const last = result.steps.at(-1);
    expect(result.mispredictions).toBe(1);
    expect(last?.committed[0]).toBe(true);
    expect(last?.committed[1]).toBe(true);
    expect(last?.committed[2]).toBe(true);
    expect(last?.squashed[3]).toBe(true);
    expect(last?.squashed[4]).toBe(true);
    expect(last?.squashed[5]).toBe(true);
    expect(last?.committed[6]).toBe(true);
    expect(last?.committed[7]).toBe(true);
    expect(result.steps.some((step) => step.redirect === 6)).toBe(true);
  });

  it("never commits a squashed result and matches sequential execution", () => {
    SPEC_PRESETS.forEach((preset) => {
      const result = runSpeculation(preset.ops, preset.config);
      expect(result.finalRegs).toEqual(sequentialRegs(preset.ops));
      expect(result.finalRegs.find((reg) => reg.name === "x4")).toBeUndefined();
    });
  });

  it("restores the checkpoint taken before the mispredicted branch", () => {
    const result = runSpeculation(wrong.ops, wrong.config);
    const snap = result.steps.find((step) => step.redirect === 6);
    expect(snap?.regs.find((reg) => reg.name === "x1")?.value).toBe(1);
    expect(snap?.regs.find((reg) => reg.name === "x3")?.value).toBe(1);
    expect(snap?.regs.find((reg) => reg.name === "x4")?.note).toBe("speculated (squashed)");
    expect(snap?.committed[0]).toBe(true);
    expect(snap?.squashed[3]).toBe(true);
    expect(result.recoveryCycles).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    const first = runSpeculation(wrong.ops, wrong.config);
    const second = runSpeculation(wrong.ops, wrong.config);
    expect(JSON.stringify(first.steps)).toBe(JSON.stringify(second.steps));
  });
});

describe("lab 11 superscalar pipeline", () => {
  it("retires more than one independent instruction per cycle when the width allows it", () => {
    const free = pick(SUPER_PRESETS, 0);
    const broad = runSuper(free.ops, wide);
    const narrow = runSuper(free.ops, scalar);
    expect(broad.cycles).toBeLessThan(narrow.cycles);
    expect(broad.ipc).toBeGreaterThan(narrow.ipc);
    expect(broad.ipc).toBeCloseTo(broad.retired / broad.cycles);
    expect(broad.retired).toBe(free.ops.length);
  });

  it("enforces fetch, decode, and retire width", () => {
    const limited = runSuper(pick(SUPER_PRESETS, 0).ops, { fetch: 2, decode: 2, dispatch: 2, execute: 2, retire: 2 });
    expect(maxToken(limited.cells, "IF")).toBeLessThanOrEqual(2);
    expect(maxToken(limited.cells, "ID")).toBeLessThanOrEqual(2);
    expect(maxToken(limited.cells, "WB")).toBeLessThanOrEqual(2);
  });

  it("stops issue at a dependence and retires in program order", () => {
    const ops: SuperOp[] = [
      { text: "MUL x1, x2, x3", comment: "slow", dest: "x1", srcs: ["x2", "x3"], latency: 5, fu: "mul" },
      { text: "ADD x4, x5, x6", comment: "independent", dest: "x4", srcs: ["x5", "x6"], latency: 1, fu: "alu" },
      { text: "ADD x7, x1, x8", comment: "uses x1", dest: "x7", srcs: ["x1", "x8"], latency: 1, fu: "alu" },
    ];
    const run = runSuper(ops, { ...wide, retire: 1 });
    expect(run.retireAt[0]).not.toBeNull();
    expect(run.retireAt[1] ?? 0).toBeGreaterThan(run.retireAt[0] ?? 0);
    expect(run.retireAt[2] ?? 0).toBeGreaterThan(run.retireAt[1] ?? 0);
    const chain = runSuper(pick(SUPER_PRESETS, 1).ops, wide);
    expect(chain.cycles).toBeGreaterThan(runSuper(pick(SUPER_PRESETS, 0).ops.slice(0, 4), wide).cycles);
  });

  it("shows a decode bottleneck and a deterministic reset", () => {
    const ops = pick(SUPER_PRESETS, 0).ops;
    const balanced = runSuper(ops, wide);
    const front = runSuper(ops, { fetch: 4, decode: 1, dispatch: 1, execute: 4, retire: 4 });
    const back = runSuper(ops, { fetch: 4, decode: 4, dispatch: 4, execute: 1, retire: 4 });
    expect(front.cycles).toBeGreaterThan(balanced.cycles);
    expect(back.cycles).toBeGreaterThan(balanced.cycles);
    expect(JSON.stringify(runSuper(ops, wide).retireAt)).toBe(JSON.stringify(balanced.retireAt));
  });
});

describe("lab 12 issue queue", () => {
  it("wakes only consumers of the completed tag", () => {
    const preset = pick(IQ_PRESETS, 0);
    const run = runIssue(preset.ops, preset.config);
    const wake = run.shots.find((shot) => shot.woken.length > 0);
    expect(wake?.woken).toContain(1);
    expect(wake?.woken).not.toContain(3);
    expect(issueEdges(preset.ops).some((edge) => edge.from === 0 && edge.to === 1 && edge.reg === "x1")).toBe(true);
    expect(issueEdges(preset.ops).some((edge) => edge.to === 3 && edge.reg === "x1")).toBe(false);
  });

  it("does not mark an instruction ready while a source is waiting", () => {
    const preset = pick(IQ_PRESETS, 2);
    const run = runIssue(preset.ops, preset.config);
    run.shots.forEach((shot) => {
      const second = shot.entries[1];
      if (!second) return;
      if (second.waiting.length > 0) expect(second.ready).toBe(false);
    });
  });

  it("issues the oldest ready instruction and respects the ALU and issue limits", () => {
    const competing = pick(IQ_PRESETS, 3);
    const run = runIssue(competing.ops, competing.config);
    const firstIssue = run.shots.find((shot) => shot.issuedNow.length > 0);
    expect(firstIssue?.issuedNow).toEqual([0]);
    run.shots.forEach((shot) => expect(shot.issuedNow.length).toBeLessThanOrEqual(1));
    const independent = pick(IQ_PRESETS, 1);
    const narrow = runIssue(independent.ops, { ...independent.config, issueWidth: 1, alu: 2 });
    narrow.shots.forEach((shot) => expect(shot.issuedNow.length).toBeLessThanOrEqual(1));
  });

  it("stalls dispatch when the window is full and stays deterministic", () => {
    const small = pick(IQ_PRESETS, 5);
    const run = runIssue(small.ops, small.config);
    expect(run.stalls).toBeGreaterThan(0);
    run.shots.forEach((shot) => expect(shot.occupancy).toBeLessThanOrEqual(small.config.window));
    expect(JSON.stringify(runIssue(small.ops, small.config).shots.map((shot) => shot.issuedNow))).toBe(JSON.stringify(run.shots.map((shot) => shot.issuedNow)));
  });
});
