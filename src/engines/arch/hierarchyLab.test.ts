import { describe, expect, it } from "vitest";
import {
  acceptLatency,
  buildPattern,
  createMiniCache,
  DEFAULT_LATENCIES,
  freshLevelMemory,
  hierarchyAmat,
  localityReport,
  runMiniCache,
  stepMiniCache,
  traceHierarchyAccess,
} from "./hierarchyLab";

describe("hierarchy lab", () => {
  it("resets latencies and rejects invalid edits", () => {
    expect(DEFAULT_LATENCIES).toMatchObject({ register: 1, l1: 3, l2: 10, ram: 80, storage: 1_000_000 });
    expect(acceptLatency("120", 80)).toEqual({ ok: true, value: 120 });
    expect(acceptLatency("0", 80).ok).toBe(false);
    expect(acceptLatency("nope", 80).ok).toBe(false);
  });

  it("serves L1, RAM, then a filled L1, and storage", () => {
    const memory = freshLevelMemory();
    const l1 = traceHierarchyAccess(memory, 0x1a3f, "read", DEFAULT_LATENCIES);
    expect(l1.level).toBe("L1");
    expect(l1.cycles).toBe(3);
    const cold = traceHierarchyAccess(memory, 0x0100, "read", DEFAULT_LATENCIES);
    expect(cold.level).toBe("RAM");
    expect(cold.cycles).toBe(80);
    expect(cold.filled).toEqual(["L1", "L2"]);
    const again = traceHierarchyAccess(cold.memory, 0x0100, "read", DEFAULT_LATENCIES);
    expect(again.level).toBe("L1");
    const disk = traceHierarchyAccess(memory, 0x20000, "read", DEFAULT_LATENCIES);
    expect(disk.level).toBe("Storage");
    expect(disk.cycles).toBe(1_000_000);
  });

  it("recomputes AMAT from the active latencies and miss rates", () => {
    const quiet = hierarchyAmat(DEFAULT_LATENCIES, { l1Miss: 0.05, l2Miss: 0.1, ramMiss: 0 });
    expect(quiet).toBeCloseTo(3 + 0.05 * (10 + 0.1 * 80));
    const withDisk = hierarchyAmat({ ...DEFAULT_LATENCIES, ram: 120 }, { l1Miss: 0, l2Miss: 0, ramMiss: 0 });
    expect(withDisk).toBe(3);
  });

  it("builds sequential, repeated, and strided patterns and scores locality", () => {
    expect(buildPattern("sequential", 16, 1, 4)).toEqual([16, 17, 18, 19]);
    expect(buildPattern("repeated", 16, 1, 3)).toEqual([16, 16, 16]);
    expect(buildPattern("strided", 16, 8, 3)).toEqual([16, 24, 32]);
    const sequential = localityReport([16, 17, 18, 19, 16], 4);
    expect(sequential.repeats).toBe(1);
    expect(sequential.spatial).toBe(1);
    expect(sequential.temporal).toBeGreaterThan(0);
    const random = localityReport([1, 80, 3, 90], 4);
    expect(random.spatial).toBeLessThan(sequential.spatial);
    const same = buildPattern("random", 0, 1, 6, 4);
    expect(buildPattern("random", 0, 1, 6, 4)).toEqual(same);
  });

  it("hits, misses, and classifies a direct-mapped cache", () => {
    const first = stepMiniCache(createMiniCache(4, 16, 1, "lru"), 0, 1);
    expect(first.hit).toBe(false);
    expect(first.kind).toBe("compulsory");
    expect(first.block).toBe(0);
    expect(first.set).toBe(0);
    const sameBlock = stepMiniCache(first.cache, 4, 1);
    expect(sameBlock.block).toBe(0);
    expect(sameBlock.hit).toBe(true);
    const mapped = stepMiniCache(createMiniCache(2, 16, 1, "lru"), 0, 1);
    const rival = stepMiniCache(mapped.cache, 32, 1);
    const conflict = stepMiniCache(rival.cache, 0, 1);
    expect(conflict.kind).toBe("conflict");
    expect(conflict.hit).toBe(false);
  });

  it("uses 2-way sets and LRU versus FIFO victims", () => {
    const ways = createMiniCache(2, 16, 2, "lru");
    expect(ways.sets).toBe(1);
    expect(ways.ways).toBe(2);
    const a = stepMiniCache(ways, 0, 1);
    const b = stepMiniCache(a.cache, 16, 1);
    const reuse = stepMiniCache(b.cache, 0, 1);
    expect(reuse.hit).toBe(true);
    const lruMiss = stepMiniCache(reuse.cache, 32, 1);
    expect(lruMiss.evicted).toBe(1);
    const fifoA = stepMiniCache(createMiniCache(2, 16, 2, "fifo"), 0, 1);
    const fifoB = stepMiniCache(fifoA.cache, 16, 1);
    const fifoTouch = stepMiniCache(fifoB.cache, 0, 1);
    const fifoMiss = stepMiniCache(fifoTouch.cache, 32, 1);
    expect(fifoMiss.evicted).toBe(0);
  });

  it("marks a capacity miss when a same-size fully associative cache also lost the block", () => {
    const steps = runMiniCache(2, 16, 2, "lru", [0, 16, 0, 32, 16], 1);
    expect(steps[0]?.kind).toBe("compulsory");
    expect(steps[1]?.kind).toBe("compulsory");
    expect(steps[2]?.kind).toBe("hit");
    expect(steps[4]?.kind).toBe("capacity");
  });
});
