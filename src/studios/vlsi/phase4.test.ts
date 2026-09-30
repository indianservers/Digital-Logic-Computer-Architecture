import { describe, expect, it } from "vitest";
import { decayCharge, senseDram } from "../../engines/memory/fundamentals";
import { decodeMemory, dramCycle, nonvolatileView, senseAmplifier, sram6t } from "./memoryModel";
import {
  clockGate,
  educationalIrDrop,
  electromigration,
  monteCarlo,
  powerGate,
  pvtSample,
  signalIntegrity,
  voltageIsland,
  vtPath,
} from "./reliabilityModel";

describe("phase 4 power and memory", () => {
  it("raises IR drop when load current rises", () => {
    const low = educationalIrDrop({ vdd: 1, strapWidth: 2, pitch: 12, sheet: 0.08, currentMa: 10, straps: 4 });
    const high = educationalIrDrop({ vdd: 1, strapWidth: 2, pitch: 12, sheet: 0.08, currentMa: 80, straps: 4 });
    expect(high.worst).toBeGreaterThan(low.worst);
  });

  it("lowers strap resistance and drop when the strap is wider", () => {
    const narrow = educationalIrDrop({ vdd: 1, strapWidth: 0.5, pitch: 12, sheet: 0.08, currentMa: 40, straps: 4 });
    const wide = educationalIrDrop({ vdd: 1, strapWidth: 6, pitch: 12, sheet: 0.08, currentMa: 40, straps: 4 });
    expect(wide.resistance).toBeLessThan(narrow.resistance);
    expect(wide.worst).toBeLessThan(narrow.worst);
  });

  it("raises electromigration risk with current density", () => {
    const mild = electromigration({ currentMa: 0.4, widthUm: 2, thicknessUm: 0.4, celsius: 27, metal: "copper" });
    const crowded = electromigration({ currentMa: 2, widthUm: 0.3, thicknessUm: 0.4, celsius: 27, metal: "copper" });
    expect(crowded.density).toBeGreaterThan(mild.density);
    expect(crowded.risk).toBeGreaterThan(mild.risk);
  });

  it("makes the slow corner slower than typical", () => {
    const ss = pvtSample("SS", 0.8, 125, 10);
    const tt = pvtSample("TT", 1, 27, 10);
    expect(ss.delay).toBeGreaterThan(tt.delay);
  });

  it("repeats a seeded variation run", () => {
    const first = monteCarlo({ samples: 32, sigma: 0.08, seed: 11, targetPs: 60 });
    const second = monteCarlo({ samples: 32, sigma: 0.08, seed: 11, targetPs: 60 });
    expect(second.mean).toBe(first.mean);
    expect(second.delays).toEqual(first.delays);
    const wider = monteCarlo({ samples: 32, sigma: 0.35, seed: 11, targetPs: 60 });
    expect(wider.sigma).toBeGreaterThan(first.sigma);
  });

  it("cuts leakage when the sleep transistor is off", () => {
    const active = powerGate({ sleep: false, header: true, load: 4, retention: true, slew: 1 });
    const sleep = powerGate({ sleep: true, header: true, load: 4, retention: false, slew: 1 });
    expect(sleep.sleepLeakage).toBeLessThan(active.activeLeakage);
    expect(sleep.virtualRail).toBeLessThan(active.virtualRail);
  });

  it("suppresses downstream clock edges when gating is disabled", () => {
    const off = clockGate({ enabled: false, style: "icg", frequencyMHz: 200, activity: 0.4, registers: 8, enableAt: 0 });
    const on = clockGate({ enabled: true, style: "icg", frequencyMHz: 200, activity: 0.4, registers: 8, enableAt: 0 });
    expect(off.edges).toBe(0);
    expect(off.dynamic).toBe(0);
    expect(on.edges).toBeGreaterThan(0);
    expect(clockGate({ enabled: true, style: "naive", frequencyMHz: 200, activity: 0.4, registers: 8, enableAt: 1 }).glitch).toBe(true);
  });

  it("trades delay for leakage across Vt classes", () => {
    const lvt = vtPath(["LVT"], 8);
    const hvt = vtPath(["HVT"], 8);
    expect(lvt.delay).toBeLessThan(hvt.delay);
    expect(lvt.leakage).toBeGreaterThan(hvt.leakage);
  });

  it("requires a level shifter when island voltages differ", () => {
    expect(voltageIsland({ vddA: 1, vddB: 0.7, aOn: true, bOn: true }).shifter).toBe(true);
    expect(voltageIsland({ vddA: 1, vddB: 1, aOn: true, bOn: true }).shifter).toBe(false);
    expect(voltageIsland({ vddA: 1, vddB: 0.8, aOn: false, bOn: true }).isolation).toBe(true);
  });

  it("damps overshoot with series termination", () => {
    const open = signalIntegrity({ driver: "strong", impedance: 70, loadFf: 8, couplingFf: 1.2, edgePs: 20, termination: "none" });
    const series = signalIntegrity({ driver: "strong", impedance: 70, loadFf: 8, couplingFf: 1.2, edgePs: 20, termination: "series" });
    expect(series.overshoot).toBeLessThan(open.overshoot);
  });

  it("keeps the stored SRAM bit on a valid read and writes when the driver is strong", () => {
    expect(sram6t(1, "read", 1, 1, 2).preserved).toBe(true);
    expect(sram6t(1, "read", 1, 1, 2).q).toBe(1);
    expect(sram6t(0, "write1", 1.5, 1, 2).q).toBe(1);
    expect(sram6t(0, "write1", 0.3, 1, 0.4).q).toBe(0);
  });

  it("resolves a positive bitline differential to 1", () => {
    expect(senseAmplifier(40, 0, 5).bit).toBe(1);
    expect(senseAmplifier(-30, 0, 5).bit).toBe(0);
  });

  it("reuses DRAM charge decay and sensing", () => {
    expect(decayCharge(80, 10)).toBe(70);
    expect(senseDram(100, 1).bit).toBe(1);
    expect(dramCycle(80, 1, 10, "hold").charge).toBeLessThan(80);
  });

  it("activates exactly one decoder row", () => {
    const decoded = decodeMemory(21, 8, 8);
    const rows = Array.from({ length: 8 }, (_, index) => index === decoded.row);
    expect(decoded.activeRows).toBe(1);
    expect(rows.filter(Boolean)).toHaveLength(1);
    expect(decoded.row).toBe(2);
    expect(decoded.col).toBe(5);
  });

  it("reuses ROM and Flash program rules", () => {
    expect(nonvolatileView("rom", "slc").programOk).toBe(false);
    expect(nonvolatileView("nand", "slc").programOk).toBe(false);
    expect(nonvolatileView("nor", "mlc").levels).toBe(4);
  });
});
