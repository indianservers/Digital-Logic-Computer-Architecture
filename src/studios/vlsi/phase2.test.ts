import { describe, expect, it } from "vitest";
import { devicesFromLayout, drcDemo, inverterTemplate, pmosInsideWell, runDrc } from "./layoutModel";
import { analyzeSta, clockSinkArrivals, combinationalPaths, criticalPath, crosstalk, fanoutLoad, logicalEffort, metastableState, sampleFlipFlop, skewOf, wireElmore } from "./timingModel";

describe("phase 2 timing", () => {
  it("flags a data transition inside the setup window", () => {
    const missed = sampleFlipFlop(18, 20, 5, 4, 0);
    const safe = sampleFlipFlop(10, 20, 5, 4, 0);
    expect(missed.setupViolated).toBe(true);
    expect(missed.violated).toBe(true);
    expect(missed.captured).toBe("X");
    expect(safe.violated).toBe(false);
  });

  it("enters a metastable state when the window is missed", () => {
    const state = metastableState(19, 20, 3, 2, 0);
    expect(state.violated).toBe(true);
    expect(state.metastable).toBe(true);
    expect(state.resolvesTo).toBeNull();
  });

  it("defines skew as the spread of sink arrivals", () => {
    const sinks = clockSinkArrivals({ sinks: 4, sourceLatency: 1, sinkLatency: 2, skew: 1.5, mode: "skewed" });
    const span = skewOf(sinks.map((sink) => sink.arrival));
    expect(span.skew).toBeCloseTo(span.max - span.min);
    expect(span.skew).toBeGreaterThan(0);
  });

  it("selects the combinational path with the greatest delay", () => {
    const paths = combinationalPaths({ gateScale: 1, netScale: 1, fanout: 1 });
    const ends = criticalPath(paths);
    const max = Math.max(...paths.map((path) => path.delay));
    expect(ends.slow.delay).toBeCloseTo(max);
  });

  it("reports negative slack when arrival is after the required time", () => {
    const fail = analyzeSta({ period: 0.4, uncertainty: 0.05, cellScale: 1, netScale: 1, analysis: "setup" });
    expect(fail.arrival).toBeGreaterThan(fail.required);
    expect(fail.slack).toBeLessThan(0);
    expect(fail.pass).toBe(false);
  });

  it("reports positive slack when arrival is before the required time", () => {
    const pass = analyzeSta({ period: 2, uncertainty: 0.05, cellScale: 1, netScale: 1, analysis: "setup" });
    expect(pass.arrival).toBeLessThan(pass.required);
    expect(pass.slack).toBeGreaterThan(0);
    expect(pass.pass).toBe(true);
  });

  it("increases path effort when electrical effort increases", () => {
    const light = logicalEffort({ gates: ["inv", "nand2", "inv"], cin: 1, load: 2, branch: 1, stages: 3 });
    const heavy = logicalEffort({ gates: ["inv", "nand2", "inv"], cin: 1, load: 16, branch: 1, stages: 3 });
    expect(heavy.F).toBeGreaterThan(light.F);
    expect(heavy.H).toBeGreaterThan(light.H);
  });

  it("increases delay when the load capacitance grows", () => {
    const one = fanoutLoad(1, 5e-15, 1, 20e-12, 1.2, "direct");
    const many = fanoutLoad(8, 5e-15, 1, 20e-12, 1.2, "direct");
    expect(many.cl).toBeGreaterThan(one.cl);
    expect(many.tpHL).toBeGreaterThan(one.tpHL);
  });

  it("increases wire resistance, capacitance, and delay with length", () => {
    const short = wireElmore({ lengthUm: 20, rPerUm: 0.1, cPerUm: 0.2e-15, loadF: 1e-15, driverR: 100, segments: 1 });
    const long = wireElmore({ lengthUm: 200, rPerUm: 0.1, cPerUm: 0.2e-15, loadF: 1e-15, driverR: 100, segments: 1 });
    expect(long.rTotal).toBeGreaterThan(short.rTotal);
    expect(long.cTotal).toBeGreaterThan(short.cTotal);
    expect(long.delay).toBeGreaterThan(short.delay);
  });

  it("increases the victim disturbance when coupling increases", () => {
    const far = crosstalk({ spacingUm: 1, lengthUm: 40, edgePs: 20, vdd: 1.2, victim: 0, rising: true, sameDirection: false, shield: false, layerRelief: false, buffered: false });
    const close = crosstalk({ spacingUm: 0.1, lengthUm: 40, edgePs: 20, vdd: 1.2, victim: 0, rising: true, sameDirection: false, shield: false, layerRelief: false, buffered: false });
    expect(close.cc).toBeGreaterThan(far.cc);
    expect(close.amplitude).toBeGreaterThan(far.amplitude);
  });
});

describe("phase 2 layout", () => {
  it("maps poly crossing diffusion to transistors", () => {
    const devices = devicesFromLayout(inverterTemplate());
    expect(devices.some((device) => device.kind === "pmos")).toBe(true);
    expect(devices.some((device) => device.kind === "nmos")).toBe(true);
    expect(pmosInsideWell(inverterTemplate())).toBe(true);
  });

  it("reports a spacing violation for geometry that is too close", () => {
    const violations = runDrc(drcDemo(1, 1, 0));
    expect(violations.some((item) => item.rule.includes("spacing"))).toBe(true);
    expect(violations.some((item) => item.rule.includes("width"))).toBe(true);
  });

  it("passes the checked rules when the geometry meets them", () => {
    const violations = runDrc(drcDemo(4, 4, 2));
    expect(violations.filter((item) => item.rule.includes("spacing") || item.rule.includes("width") || item.rule.includes("enclosure"))).toEqual([]);
  });
});
