import { describe, expect, it } from "vitest";
import { MSHR_DEFAULTS, compareBlocking, runMshr } from "./mshr";
import { PREFETCH_DEFAULTS, comparePrefetchers, runPrefetch } from "./prefetch";
import { FABRIC_PRESETS, compareFabric, scaleTraffic } from "./snoopCompare";

function preset<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

describe("lab 22 snooping versus directory", () => {
  it("broadcasts a snoop and keeps the directory targeted on the same values", () => {
    const item = preset(FABRIC_PRESETS, "private");
    const result = compareFabric(item.cores, item.requests, item.seed);
    expect(result.value).toBe(20);
    expect(result.memory).toBe(10);
    expect(result.final.probes).toBeGreaterThan(result.final.invalidations);
    expect(result.final.snoopMessages).toBeGreaterThan(result.final.directoryMessages);
    expect(result.directoryBits).toBe(8);
    expect(result.snoopBits).toBe(0);
    const again = compareFabric(item.cores, item.requests, item.seed);
    expect(again.value).toBe(result.value);
    expect(again.final.snoopMessages).toBe(result.final.snoopMessages);
  });

  it("invalidates only the sharers while every cache still snoops", () => {
    const item = preset(FABRIC_PRESETS, "writer");
    const result = compareFabric(item.cores, item.requests, item.seed);
    expect(result.final.invalidations).toBe(3);
    expect(result.final.probes).toBeGreaterThan(result.final.invalidations);
    const last = result.shots[result.shots.length - 1];
    expect(last?.step.some((event) => event.model === "snoop" && event.event === "Invalidate")).toBe(true);
    expect(last?.step.some((event) => event.model === "directory" && event.event === "Inv")).toBe(true);
    const wide = scaleTraffic(2);
    expect(wide[3]?.snoopMessages).toBeGreaterThan(wide[0]?.snoopMessages ?? 0);
    expect(wide[0]?.directoryMessages).toBe(wide[3]?.directoryMessages);
    expect(wide[3]?.directoryLatency).toBeLessThan(wide[3]?.snoopLatency ?? 0);
  });
});

describe("lab 23 non-blocking cache", () => {
  it("allocates one MSHR for a miss and merges later loads of that block", () => {
    const merged = runMshr([
      { address: 0x1000, op: "read", core: 0 },
      { address: 0x1010, op: "read", core: 0 },
      { address: 0x1020, op: "read", core: 0 },
    ], { ...MSHR_DEFAULTS, missLatency: 4 });
    expect(merged.final.allocations).toBe(1);
    expect(merged.final.merged).toBe(2);
    expect(merged.final.misses).toBe(1);
    expect(merged.final.entries.every((entry) => !entry.busy)).toBe(true);
    expect(merged.final.rows.every((row) => row.complete !== null)).toBe(true);
  });

  it("allows a hit under a miss only when the cache is non-blocking", () => {
    const accesses = [
      { address: 0x1000, op: "read" as const, core: 0 },
      { address: 0x2000, op: "read" as const, core: 0 },
    ];
    const compared = compareBlocking(accesses, { ...MSHR_DEFAULTS, missLatency: 4, hitUnderMiss: true }, [0x2000]);
    expect(compared.relaxed.final.hitUnderMiss).toBe(1);
    expect(compared.blocking.final.hitUnderMiss).toBe(0);
    expect(compared.relaxed.final.cycle).toBeLessThan(compared.blocking.final.cycle);
    expect(compared.stallReduction).toBeGreaterThan(0);
  });

  it("uses a second MSHR for another block and stalls when none remain", () => {
    const pair = runMshr([
      { address: 0x1000, op: "read", core: 0 },
      { address: 0x2000, op: "read", core: 0 },
    ], { ...MSHR_DEFAULTS, missLatency: 4, mshrs: 2 });
    expect(pair.final.allocations).toBe(2);
    expect(pair.final.missUnderMiss).toBe(1);
    expect(pair.final.peakOutstanding).toBe(2);
    const full = runMshr([
      { address: 0x1000, op: "read", core: 0 },
      { address: 0x2000, op: "read", core: 0 },
      { address: 0x3000, op: "read", core: 0 },
    ], { ...MSHR_DEFAULTS, missLatency: 4, mshrs: 1 });
    expect(full.final.exhausted).toBeGreaterThan(0);
    expect(full.final.peakOutstanding).toBe(1);
    const again = runMshr([
      { address: 0x1000, op: "read", core: 0 },
      { address: 0x2000, op: "read", core: 0 },
    ], { ...MSHR_DEFAULTS, missLatency: 4, mshrs: 2 });
    expect(again.final.cycle).toBe(pair.final.cycle);
  });
});

describe("lab 24 hardware prefetch", () => {
  it("issues the next line, a learned stride, a stream, and a correlated block", () => {
    const next = runPrefetch("next", [0x1000, 0x1040], { ...PREFETCH_DEFAULTS, missLatency: 0 });
    expect(next.issuedAddresses).toContain(0x1040);
    expect(next.useful).toBe(1);
    expect(next.issued).toBe(2);
    expect(next.accuracy).toBe(0.5);
    expect(next.demandMisses).toBe(1);
    const stride = runPrefetch("stride", [0x1000, 0x1080, 0x1100, 0x1180], { ...PREFETCH_DEFAULTS, missLatency: 0, confidence: 0.5 });
    expect(stride.issuedAddresses).toContain(0x1180);
    const stream = runPrefetch("stream", [0x1000, 0x1040, 0x1080], { ...PREFETCH_DEFAULTS, degree: 2, missLatency: 0 });
    expect(stream.issuedAddresses).toEqual(expect.arrayContaining([0x1080, 0x10c0]));
    const linked = runPrefetch("correlation", [0x1000, 0x1800, 0x1000, 0x1800, 0x1000], { ...PREFETCH_DEFAULTS, missLatency: 0, cacheLines: 1 });
    expect(linked.issuedAddresses).toContain(0x1800);
    const quiet = runPrefetch("none", [0x1000, 0x1040], PREFETCH_DEFAULTS);
    expect(quiet.issued).toBe(0);
    expect(quiet.accuracy).toBe(0);
  });

  it("separates useful, late, and useless prefetches and counts pollution once", () => {
    const late = runPrefetch("next", [0x1000, 0x1040], { ...PREFETCH_DEFAULTS, missLatency: 5 });
    expect(late.late).toBe(1);
    expect(late.useful).toBe(0);
    const unused = runPrefetch("next", [0x1000], { ...PREFETCH_DEFAULTS, missLatency: 0 });
    expect(unused.useless).toBe(1);
    expect(unused.accuracy).toBe(0);
    const twice = runPrefetch("next", [0x1000, 0x1000], { ...PREFETCH_DEFAULTS, missLatency: 5 });
    expect(twice.issued).toBe(1);
    const polluted = runPrefetch("next", [0x1000, 0x2000, 0x1000], { ...PREFETCH_DEFAULTS, cacheLines: 1, missLatency: 0, degree: 1 });
    expect(polluted.pollution).toBeGreaterThan(0);
    const compared = comparePrefetchers([0x1000, 0x1040], { ...PREFETCH_DEFAULTS, missLatency: 0, degree: 2 });
    expect(compared.results.next.coverage).toBeGreaterThan(0);
    expect(compared.results.next.accuracy).toBeGreaterThan(0);
    expect(compared.results.next.coverage).not.toBe(compared.results.next.accuracy);
    const again = runPrefetch("next", [0x1000, 0x1040], { ...PREFETCH_DEFAULTS, missLatency: 0 });
    expect(again.useful).toBe(nextUseful(compared));
  });
});

function nextUseful(compared: ReturnType<typeof comparePrefetchers>) {
  return compared.results.next.useful;
}
