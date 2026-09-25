import { describe, expect, it } from "vitest";
import { LAB_LEVELS, L1_PRESET, temporalReuse, spatialReuse, walkTrace } from "./arch/hierarchy";
import { installPage, splitTwoLevel, translate, translateTwoLevel, type PageEntry } from "./arch/vm";
import { addressSpace, classifyException, cpuCopy, createDma, handlerFor, highestPriority, interruptTimeline, MMIO, pollTransfer, stepDma, type IoDevice } from "./arch/io";
import { addressReach, asyncHandshake, bandwidthBytes, grantBus, syncEdge, transferValue } from "./arch/busarch";
import { FLYNN, independent, issueCycles, renameOps, smtIssue, speculate, stepRob, vectorAdd, type MiniOp } from "./arch/parallel";
import { directoryRead, directoryWrite, falseShareInvalidations, invalidateCached, mesiStep, moesiStep, msiStep, readShared, warmCache } from "./arch/coherence";
import { LOOP_TRACE, SCHEDULE_OPS, SCORE_OPS, branchScore, listSchedule, roofline, runRob, runScoreboard, staticCycles } from "./arch/aca";
import { accessCache } from "./cache/cache";
import { validGeometry } from "./cache/mapping";

const page = (frame: number, write = true): PageEntry => ({ frame, valid: true, read: true, write, exec: false });

describe("memory hierarchy", () => {
  it("uses lab latencies and the cache engine", () => {
    expect(validGeometry(L1_PRESET)).toBe(true);
    expect(LAB_LEVELS.map((level) => level.name)).toEqual(["Registers", "L1", "L2", "RAM", "Storage"]);
    const traced = walkTrace([0, 0], [], 256, { register: 1, l1: 3, l2: 12, ram: 80, storage: 1000 });
    expect(traced.hops[0]?.level).toBe("RAM");
    expect(traced.hops[1]?.level).toBe("L1");
    expect(traced.hops[1]?.cycles).toBe(3);
    const resident = walkTrace([4], [4], 256, { register: 1, l1: 3, l2: 12, ram: 80, storage: 1000 });
    expect(resident.hops[0]?.level).toBe("Registers");
    expect(resident.l1.stats.accesses).toBe(0);
  });

  it("scores temporal and spatial reuse", () => {
    expect(temporalReuse([1, 2, 1, 1])).toBe(0.5);
    expect(spatialReuse([100, 101, 102, 103], 4)).toBe(1);
    expect(spatialReuse([100, 200], 4)).toBe(0);
  });
});

describe("virtual memory", () => {
  it("translates, faults, protects, and fills the TLB", () => {
    const table = [page(0), page(4, false)];
    const first = translate(0x103, 8, table, [], "read");
    expect(first.result.status).toBe("page-hit");
    expect(first.result.physical).toBe((4 << 8) | 3);
    const second = translate(0x103, 8, table, first.tlb, "read");
    expect(second.result.status).toBe("tlb-hit");
    expect(translate(0x103, 8, table, first.tlb, "write").result.status).toBe("protection");
    expect(translate(0x200, 8, table, [], "read").result.status).toBe("fault");
  });

  it("walks a two-level table and installs a missing page", () => {
    const parts = splitTwoLevel(99, 4, 2, 2);
    expect(parts).toMatchObject({ directory: 1, index: 2, offset: 3 });
    const directory: Array<PageEntry[] | null> = [null, [page(0), page(0), page(5)]];
    const walked = translateTwoLevel(99, 4, 2, 2, directory, "read");
    expect(walked.physical).toBe((5 << 4) | 3);
    const installed = installPage([page(0, false)], 2, 9);
    expect(installed[2]?.valid).toBe(true);
    expect(installed[2]?.frame).toBe(9);
  });
});

describe("io, interrupts, and dma", () => {
  it("separates mapped and isolated spaces and counts poll waste", () => {
    expect(addressSpace("mapped", MMIO.data)).toBe("io");
    expect(addressSpace("mapped", 0x20)).toBe("memory");
    expect(addressSpace("isolated", 0x20)).toBe("memory");
    expect(addressSpace("isolated", 0xff10)).toBe("io");
    expect(pollTransfer(3).wasted).toBe(3);
    expect(pollTransfer(Number.NaN).wasted).toBe(0);
  });

  it("saves the PC, picks a priority, and classifies exceptions", () => {
    const timeline = interruptTimeline([10, 11, 12], 1, [0x100]);
    expect(timeline.map((step) => step.phase)).toEqual(["run", "save", "handler", "return", "run", "run"]);
    const devices: IoDevice[] = [
      { name: "Keyboard", irq: 1, priority: 2, vector: 0x100, pending: true, status: 1, data: 65 },
      { name: "Timer", irq: 0, priority: 0, vector: 0x200, pending: true, status: 1, data: 0 },
    ];
    expect(highestPriority(devices)?.name).toBe("Timer");
    expect(handlerFor([{ irq: 3, handler: 0x1000 }, { irq: 5, handler: 0x2000 }], 5)).toBe(0x2000);
    expect(classifyException("protect").resumes).toBe(false);
  });

  it("copies with the CPU or the DMA controller", () => {
    const programmed = cpuCopy([0, 0, 0, 0], [9, 8, 7], 1, 3);
    expect(programmed.memory).toEqual([0, 9, 8, 7]);
    expect(programmed.cpuCycles).toBe(6);
    let dma = createDma([0, 0, 0, 0], [9, 8, 7], 0, 1, 3, "to-memory");
    dma = stepDma(dma);
    expect(dma.owner).toBe("dma");
    dma = stepDma(stepDma(stepDma(dma)));
    expect(dma.memory).toEqual([0, 9, 8, 7]);
    expect(dma.done).toBe(true);
    expect(dma.interrupt).toBe(true);
    expect(dma.owner).toBe("cpu");
    expect(dma.cpuCycles).toBeLessThan(programmed.cpuCycles);
  });
});

describe("bus architecture", () => {
  it("computes reach, bandwidth, grants, and handshake", () => {
    expect(addressReach(16).count).toBe(65536);
    expect(addressReach(Number.NaN).count).toBe(1);
    expect(bandwidthBytes(32, 100, 1)).toBe(400);
    expect(Number.isFinite(bandwidthBytes(Number.NaN, 100, 1))).toBe(true);
    const masters = [
      { name: "CPU", request: true, priority: 1 },
      { name: "DMA", request: true, priority: 0 },
      { name: "GPU", request: false, priority: 2 },
    ];
    expect(grantBus("daisy", masters, 0)?.name).toBe("CPU");
    expect(grantBus("central", masters, 0)?.name).toBe("DMA");
    expect(grantBus("distributed", masters, 0)?.name).toBe("DMA");
    expect(transferValue([{ name: "CPU", enabled: true, value: 1 }, { name: "DMA", enabled: true, value: 2 }]).value).toBe("X");
    expect(syncEdge(true).moved).toBe(true);
    expect(asyncHandshake(true, false).moved).toBe(false);
    expect(asyncHandshake(true, true).moved).toBe(true);
  });
});

describe("parallel execution model", () => {
  const ops: MiniOp[] = [
    { text: "ADD", dest: "R1", sources: ["R2", "R3"] },
    { text: "SUB", dest: "R4", sources: ["R5", "R6"] },
    { text: "AND", dest: "R7", sources: ["R1"] },
  ];

  it("issues by width, renames, retires in order, and adds lanes", () => {
    expect(FLYNN).toHaveLength(4);
    expect(independent(ops[0]!, ops[1]!)).toBe(true);
    expect(issueCycles(ops, 2)).toEqual([0, 0, 1]);
    expect(issueCycles(ops, 1)).toEqual([0, 1, 2]);
    const renamed = renameOps([
      { text: "ADD", dest: "R1", sources: ["R2"] },
      { text: "SUB", dest: "R1", sources: ["R1"] },
    ]);
    expect(renamed[1]?.sources).toEqual(["p1"]);
    expect(renamed[1]?.dest).toBe("p2");
    const retired = stepRob([{ text: "A", status: "done" }, { text: "B", status: "done" }]);
    expect(retired.map((entry) => entry.status)).toEqual(["retire", "done"]);
    expect(speculate(false, true, 2)).toEqual({ correct: false, flushed: 2 });
    expect(vectorAdd([1, 2, 3, 4], [10, 20, 30, 40])).toEqual([11, 22, 33, 44]);
    expect(smtIssue(1, 2, 2).cycles).toBe(4);
    expect(smtIssue(2, 2, 2).cycles).toBe(2);
  });
});

describe("coherence", () => {
  it("steps MESI and MSI and counts false sharing", () => {
    const exclusive = mesiStep(["I", "I"], 0, "read");
    expect(exclusive.states).toEqual(["E", "I"]);
    const modified = mesiStep(exclusive.states, 0, "write");
    expect(modified.bus).toBe("silent upgrade");
    const shared = mesiStep(modified.states, 1, "read");
    expect(shared.states).toEqual(["S", "S"]);
    expect(shared.bus).toContain("WriteBack");
    expect(msiStep(["I", "I"], 0, "read").states[0]).toBe("S");
    expect(falseShareInvalidations(4, [{ core: 0, address: 0 }, { core: 1, address: 1 }])).toBe(1);
    expect(falseShareInvalidations(4, [{ core: 0, address: 0 }, { core: 1, address: 16 }])).toBe(0);
  });

  it("tracks a directory, shared memory, and a DMA invalidation", () => {
    const read = directoryRead({ owner: null, sharers: [] }, 0);
    const written = directoryWrite(read, 1);
    expect(written.invalidated).toBe(1);
    expect(written.entry.owner).toBe(1);
    expect(readShared("distributed", 1, 0, [5], [[1], [9]])?.value).toBe(9);
    const warm = warmCache(0);
    const again = accessCache(warm, 0, "read");
    expect(again.result.hit).toBe(true);
    const cold = accessCache(invalidateCached(warm, 0), 0, "read");
    expect(cold.result.hit).toBe(false);
  });

  it("keeps a dirty shared line Owned in MOESI", () => {
    const exclusive = moesiStep(["I", "I"], 0, "read");
    const modified = moesiStep(exclusive.states, 0, "write");
    const shared = moesiStep(modified.states, 1, "read");
    expect(shared.states).toEqual(["O", "S"]);
  });
});

describe("advanced computer architecture", () => {
  it("hides a load latency by scheduling an independent instruction", () => {
    const program = staticCycles(SCHEDULE_OPS);
    const scheduled = staticCycles(listSchedule(SCHEDULE_OPS));
    expect(scheduled.stalls).toBeLessThan(program.stalls);
  });

  it("removes WAW stalls when the scoreboard renames", () => {
    expect(runScoreboard(SCORE_OPS, false).waw).toBeGreaterThan(0);
    expect(runScoreboard(SCORE_OPS, true).waw).toBe(0);
  });

  it("commits the reorder buffer in program order", () => {
    const rob = runRob(SCORE_OPS);
    expect(rob.commitOrder[0]).toBe(SCORE_OPS[0]?.text);
    expect(rob.execOrder[0]).not.toBe(rob.commitOrder[0]);
  });

  it("lets a correlating predictor beat a two-bit counter on a loop exit", () => {
    expect(branchScore(LOOP_TRACE, "correlating").correct).toBeGreaterThan(branchScore(LOOP_TRACE, "two").correct);
  });

  it("places a low-intensity kernel under the ridge", () => {
    expect(roofline(8, 64, 64, 16).bound).toBe("memory");
    expect(roofline(128, 2, 64, 16).bound).toBe("compute");
  });
});
