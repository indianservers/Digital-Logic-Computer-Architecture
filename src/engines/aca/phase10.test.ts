import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ACA_LABS } from "../../data/acaLabs";
import { AcaStudio } from "../../studios/aca/AcaStudio";
import { amdahlSpeedup, scaleAt, SCALE_DEFAULTS, theoreticalLimit } from "./scaling";
import { analyzeWorkload, arithmeticIntensity, ceilings, classify, ridgePoint } from "./roofline";
import { analyzeCpi, applyWhatIf, cyclesFromRates, CPI_RATES, speedup } from "./cpi";
import { COUNTER_PRESETS, derive, interval, sampleAt, totalsFor } from "./counters";

describe("multicore scaling", () => {
  it("gives speedup 1 on one core and ideal speedup with no serial work", () => {
    expect(amdahlSpeedup(0.2, 1)).toBe(1);
    expect(amdahlSpeedup(1, 64)).toBe(1);
    expect(amdahlSpeedup(0, 8)).toBe(8);
  });

  it("approaches 1/S and reports efficiency", () => {
    expect(theoreticalLimit(0.1)).toBe(10);
    expect(amdahlSpeedup(0.1, 1_000_000)).toBeCloseTo(10, 2);
    const point = scaleAt({ ...SCALE_DEFAULTS, serial: 0.1, cores: 8, includeComm: false, includeSync: false, imbalance: 0 }, 8);
    expect(point.speedup).toBeCloseTo(amdahlSpeedup(0.1, 8), 6);
    expect(point.efficiency).toBeCloseTo(point.speedup / 8, 6);
  });

  it("keeps strong work fixed and weak work per core fixed", () => {
    const strong = scaleAt({ ...SCALE_DEFAULTS, mode: "strong", includeComm: false, includeSync: false, imbalance: 0 }, 4);
    const weak = scaleAt({ ...SCALE_DEFAULTS, mode: "weak", includeComm: false, includeSync: false, imbalance: 0 }, 4);
    expect(strong.parallel).toBeCloseTo((1 - 0.05) / 4, 6);
    expect(weak.parallel).toBeCloseTo(1 - 0.05, 6);
    expect(weak.speedup).toBeGreaterThan(strong.speedup);
  });

  it("adds communication and synchronization to the critical path", () => {
    const plain = scaleAt({ ...SCALE_DEFAULTS, includeComm: false, includeSync: false }, 16);
    const busy = scaleAt({ ...SCALE_DEFAULTS, includeComm: true, includeSync: true, commPerCore: 0.02, barriers: 4 }, 16);
    expect(busy.time).toBeGreaterThan(plain.time);
    expect(busy.speedup).toBeLessThan(plain.speedup);
  });
});

describe("roofline", () => {
  const machine = { peak: 1000, bandwidth: 100, lineBytes: 64 };

  it("uses FLOP per byte and the minimum of the two roofs", () => {
    expect(arithmeticIntensity(1_000_000, 500_000)).toBe(2);
    expect(arithmeticIntensity(10, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(arithmeticIntensity(0, 0)).toBe(0);
    expect(ridgePoint(machine)).toBe(10);
    expect(ceilings(2, machine).roof).toBe(200);
    expect(ceilings(20, machine).roof).toBe(1000);
    expect(classify(2, machine)).toBe("memory");
    expect(classify(20, machine)).toBe("compute");
  });

  it("flags an observed point above the roof", () => {
    const result = analyzeWorkload({ id: "x", name: "x", flops: 200, bytes: 100, observed: 500 }, machine);
    expect(result.inconsistent).toBe(true);
    expect(result.efficiency).toBeLessThanOrEqual(1);
  });
});

describe("cpi and ipc", () => {
  it("keeps IPC as the reciprocal of CPI for the same interval", () => {
    const result = analyzeCpi(cyclesFromRates(CPI_RATES), CPI_RATES.instructions);
    expect(result.cpi * result.ipc).toBeCloseTo(1, 6);
    expect(result.totalCycles).toBe(result.cycles.useful + result.cycles.frontend + result.cycles.branch + result.cycles.execution + result.cycles.cache + result.cycles.memory);
    expect(result.cycles.branch).toBeCloseTo(100000 * 0.2 * 0.08 * 12, 4);
  });

  it("recomputes speedup from the new cycle count only", () => {
    const before = analyzeCpi(cyclesFromRates(CPI_RATES), CPI_RATES.instructions);
    const after = analyzeCpi(applyWhatIf(before.cycles, { frontend: 1, branch: 0.5, execution: 1, cache: 1, memory: 0.75 }), CPI_RATES.instructions);
    expect(speedup(before.totalCycles, after.totalCycles)).toBeCloseTo(before.totalCycles / after.totalCycles, 6);
    expect(after.ipc).toBeGreaterThan(before.ipc);
  });
});

describe("performance counters", () => {
  it("keeps misses inside their accesses and derives rates from the same totals", () => {
    for (const preset of COUNTER_PRESETS) {
      const totals = totalsFor(preset);
      const derived = derive(totals);
      expect(totals.mispredictions).toBeLessThanOrEqual(totals.branches + 1e-6);
      expect(totals.l1Misses).toBeLessThanOrEqual(totals.l1Accesses + 1e-6);
      expect(totals.llcMisses).toBeLessThanOrEqual(totals.llcAccesses + 1e-6);
      expect(totals.dtlbMisses).toBeLessThanOrEqual(totals.dtlbAccesses + 1e-6);
      expect(derived.cpi * derived.ipc).toBeCloseTo(1, 6);
      expect(totals.time).toBeCloseTo(totals.cycles / preset.frequencyHz, 6);
    }
  });

  it("renders every advanced-architecture lab route", () => {
    for (const lab of ACA_LABS) {
      const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [`/studios/advanced-computer-architecture/${lab.slug}`] },
        createElement(Routes, null, createElement(Route, { path: "/studios/advanced-computer-architecture/:labId", element: createElement(AcaStudio) })),
      ));
      const title = lab.title.replaceAll("&", "&amp;").replaceAll("'", "&#x27;");
      expect(html).toContain(title);
      expect(html).not.toContain("No results are shown yet");
    }
  });

  it("uses the interval delta rather than the cumulative total", () => {
    const profile = COUNTER_PRESETS[0]!;
    const early = sampleAt(profile, 0.25).totals;
    const later = sampleAt(profile, 0.5).totals;
    const slice = interval(early, later);
    expect(slice.derived.ipc).toBeCloseTo(derive(totalsFor(profile)).ipc, 6);
    expect(slice.delta.instructions).toBeCloseTo(profile.instructions * 0.25, 4);
  });
});
