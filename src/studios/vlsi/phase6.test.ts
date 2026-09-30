import { describe, expect, it } from "vitest";
import { faultObserved, generatePattern, lfsrStep, scanCapture, shiftScan, tapNext, bistRun } from "./dftModel";
import { emptyFlow, GDS_STAGES, invalidateDownstream, runStage, runThrough } from "./gdsFlow";
import { chipletLink, dieTemperatures, explorePpa, moveBlock, nocRoute, PPA_PRESETS, SOC_FLOOR, socWireLength } from "./systemModel";

describe("phase 6 dft and system flow", () => {
  it("shifts a scan bit into the chain and out the far end", () => {
    const once = shiftScan([1, 0, 1, 0], 1);
    expect(once.cells).toEqual([1, 1, 0, 1]);
    expect(once.scanOut).toBe(0);
    expect(shiftScan(once.cells, 0).cells).toEqual([0, 1, 1, 0]);
  });

  it("captures a different scan response when the cloud is faulty", () => {
    const good = scanCapture([1, 1, 0], null);
    const faulty = scanCapture([1, 1, 0], { index: 2, stuck: 0 });
    expect(good[2]).toBe(1);
    expect(faulty[2]).toBe(0);
    expect(faulty).not.toEqual(good);
  });

  it("generates a vector that detects a stuck-at fault", () => {
    const found = generatePattern({ net: "n1", stuck: 0 });
    expect(found.detects).toBe(true);
    expect(found.vector).not.toBeNull();
    if (found.vector) expect(faultObserved(found.vector, { net: "n1", stuck: 0 })).toBe(true);
  });

  it("forces stuck-at 0 and stuck-at 1 onto the simulated net", () => {
    const pins = { a: 1 as const, b: 1 as const, c: 0 as const };
    expect(generatePattern({ net: "dead", stuck: 0 }).detects).toBe(false);
    expect(faultObserved(pins, { net: "y", stuck: 0 })).toBe(true);
    expect(faultObserved(pins, { net: "a", stuck: 0 })).toBe(true);
  });

  it("follows the TAP transition table", () => {
    expect(tapNext("Test-Logic-Reset", 0)).toBe("Run-Test/Idle");
    expect(tapNext("Run-Test/Idle", 1)).toBe("Select-DR-Scan");
    expect(tapNext("Select-DR-Scan", 0)).toBe("Capture-DR");
    expect(tapNext("Select-DR-Scan", 1)).toBe("Select-IR-Scan");
    expect(tapNext("Shift-DR", 0)).toBe("Shift-DR");
    expect(tapNext("Shift-IR", 1)).toBe("Exit1-IR");
    expect(tapNext("Update-DR", 0)).toBe("Run-Test/Idle");
  });

  it("repeats an LFSR sequence and signature for the same seed", () => {
    const first = bistRun(9, 8, false);
    const second = bistRun(9, 8, false);
    expect(second.vectors).toEqual(first.vectors);
    expect(second.signature).toBe(first.signature);
    expect(bistRun(9, 8, true).signature).not.toBe(first.signature);
    expect(lfsrStep(first.vectors[0] ?? 1)).toBe(first.vectors[1]);
  });

  it("changes interconnect length when a macro moves", () => {
    const before = socWireLength(SOC_FLOOR);
    const after = socWireLength(moveBlock(SOC_FLOOR, "gpu", 70, 40));
    expect(after).not.toBe(before);
  });

  it("routes a packet to its destination", () => {
    const report = nocRoute([{ src: { r: 0, c: 0 }, dst: { r: 2, c: 2 }, size: 1 }], "xy");
    expect(report.arrived).toBe(true);
    expect(report.hops[0]).toBe(4);
  });

  it("adds latency when two flows share a link", () => {
    const alone = nocRoute([{ src: { r: 0, c: 0 }, dst: { r: 0, c: 2 }, size: 1 }], "xy");
    const shared = nocRoute([
      { src: { r: 0, c: 0 }, dst: { r: 0, c: 2 }, size: 1 },
      { src: { r: 0, c: 0 }, dst: { r: 0, c: 2 }, size: 1 },
    ], "xy");
    expect(shared.contested).toBe(true);
    expect(shared.latency[0] ?? 0).toBeGreaterThan(alone.latency[0] ?? 0);
  });

  it("raises link utilization as inter-die traffic rises", () => {
    expect(chipletLink(8, 4, 2).utilization).toBeGreaterThan(chipletLink(2, 4, 2).utilization);
  });

  it("heats a block when its power rises", () => {
    const cool = dieTemperatures([1, 1], 25, 1);
    const hot = dieTemperatures([6, 1], 25, 1);
    expect(hot[0] ?? 0).toBeGreaterThan(cool[0] ?? 0);
    expect(hot[1] ?? 0).toBeGreaterThan(cool[1] ?? 0);
  });

  it("raises power and performance when VDD rises", () => {
    const low = explorePpa(PPA_PRESETS.low);
    const high = explorePpa({ ...PPA_PRESETS.low, vdd: 1.1 });
    expect(high.power).toBeGreaterThan(low.power);
    expect(high.performance).toBeGreaterThan(low.performance);
  });

  it("refuses a stage before its predecessor and keeps later results tied to earlier ones", () => {
    const blocked = runStage(emptyFlow("mux"), "map");
    expect(blocked.status.map).toBe("fail");
    const done = runThrough(emptyFlow("adder4"), "gds");
    expect(GDS_STAGES.every((stage) => done.status[stage] !== "not-run")).toBe(true);
    expect(done.placed).toBe(done.mapped.length);
    expect(done.log.some((line) => line.includes("standard cells"))).toBe(true);
    const invalidated = invalidateDownstream(done, "floor");
    expect(invalidated.status.floor).toBe("not-run");
    expect(invalidated.status.place).toBe("not-run");
    expect(invalidated.status.gds).toBe("not-run");
    expect(invalidated.status.map).toBe("pass");
  });
});
