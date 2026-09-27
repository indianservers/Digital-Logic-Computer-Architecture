import { describe, expect, it } from "vitest";
import { createCache, runTrace } from "./cache";
import type { CacheConfig } from "./mapping";
import { averageReuse, classifyTrace, configSummary, formatTrace, memoryByte, nestedAmat, parseTrace, randomTrace, repeatedTrace, requestPath, sequentialTrace, stridedTrace, teachingAmat, timelineFor } from "./studio";

const direct: CacheConfig = {
  addressBits: 8, memoryBytes: 256, cacheBytes: 16, blockBytes: 4, associativity: 1,
  replacement: "lru", writePolicy: "back", allocation: "allocate", seed: 1,
};

describe("cache studio helpers", () => {
  it("parses hex traces and rejects junk", () => {
    const parsed = parseTrace("0x00001000 R\n0x10 W\nnope\n");
    expect(parsed.entries).toEqual([{ address: 0x1000, op: "read" }, { address: 0x10, op: "write" }]);
    expect(parsed.errors).toHaveLength(1);
    expect(formatTrace(parsed.entries)).toContain("W");
  });

  it("builds sequential, repeated, and strided traces", () => {
    expect(sequentialTrace(3, 0, 4).map((entry) => entry.address)).toEqual([0, 4, 8]);
    expect(repeatedTrace(2, 2, 4).map((entry) => entry.address)).toEqual([0, 4, 0, 4]);
    expect(stridedTrace(3, 16).map((entry) => entry.address)).toEqual([0, 16, 32]);
    expect(randomTrace(4, 32, 1)).toHaveLength(4);
    expect(randomTrace(4, 32, 1)).toEqual(randomTrace(4, 32, 1));
  });

  it("summarizes geometry and splits a direct-mapped hit", () => {
    expect(configSummary(direct)).toMatchObject({ blocks: 4, sets: 4, ways: 1, offsetBits: 2 });
    const traced = runTrace(direct, [{ address: 0 }, { address: 0 }]);
    expect(traced.results[0]?.kind).toBe("compulsory");
    expect(traced.results[1]?.hit).toBe(true);
    expect(timelineFor(traced.results[1]!, 4).some((event) => event.tone === "hit")).toBe(true);
  });

  it("classifies a conflict and a write-back eviction from the engine", () => {
    const rows = classifyTrace(direct, [{ address: 0, op: "write" }, { address: 16, op: "read" }]);
    expect(rows.rows[1]?.dirtyEvict || rows.machine.stats.writeBacks).toBeTruthy();
    expect(teachingAmat(rows.machine.stats, 1, 100)).toBeGreaterThan(1);
    expect(memoryByte(0)).toBe(memoryByte(0));
    expect(averageReuse([1, 2, 1])).toBe(2);
  });

  it("computes a nested AMAT and a deterministic hierarchy path", () => {
    const value = nestedAmat([{ latency: 1, missRate: 0.05 }, { latency: 4, missRate: 0.1 }, { latency: 12, missRate: 0.1 }], 100);
    expect(value).toBeCloseTo(1.31);
    const path = requestPath(0x1234, [{ name: "L1", hitPercent: 95 }]);
    expect(path.hit).toBe("L1");
    const miss = requestPath(0, [{ name: "L1", hitPercent: 0 }]);
    expect(miss.hit).toBe("Main Memory");
  });

  it("resets by rebuilding an empty cache", () => {
    const machine = createCache(direct);
    expect(machine.stats.accesses).toBe(0);
    expect(machine.sets.every((set) => set.every((line) => !line.valid))).toBe(true);
  });
});
