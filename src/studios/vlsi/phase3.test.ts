import { describe, expect, it } from "vitest";
import { sizeCell } from "./cellLibrary";
import {
  applyFault,
  compareGraphs,
  extractFromLayout,
  extractParasitics,
  inverterSchematic,
  nandLayout,
  nandSchematic,
} from "./verifyModel";
import { inverterTemplate, type LayoutRect } from "./layoutModel";
import {
  fsmHardware,
  mapNetwork,
  optimizeBoolean,
  optimizeNetwork,
  synthesisDemo,
  truthEquivalent,
} from "./flowModel";
import type { GenericGate } from "./flowModel";
import {
  congestionGrid,
  clockBaseline,
  estimatedWire,
  floorplanMetrics,
  macroOverlaps,
  MINI_SOC_MACROS,
  optimizeFully,
  placeStandardCells,
  placementMetric,
  routeNet,
  scrambledPlacement,
  skewOf,
  synthesizeClock,
} from "./physicalModel";

function metal(length: number, width: number): LayoutRect[] {
  return [{ id: "m", layer: "metal1", net: "OUT", x: 0, y: 0, w: length, h: width, purpose: "wire" }];
}

describe("phase 3 VLSI models", () => {
  it("matches an extracted inverter to its schematic", () => {
    const result = compareGraphs(inverterSchematic(), extractFromLayout(inverterTemplate()));
    expect(result.pass).toBe(true);
  });

  it("matches an extracted NAND to its schematic", () => {
    const result = compareGraphs(nandSchematic(), extractFromLayout(nandLayout()));
    expect(result.pass).toBe(true);
  });

  it("fails LVS when a PMOS is missing", () => {
    const extracted = applyFault(extractFromLayout(inverterTemplate()), "missing-pmos");
    const result = compareGraphs(inverterSchematic(), extracted);
    expect(result.pass).toBe(false);
    expect(result.mismatches.some((item) => item.kind === "missing")).toBe(true);
  });

  it("fails LVS when a drain lands on the wrong net", () => {
    const extracted = applyFault(extractFromLayout(inverterTemplate()), "output-short");
    const result = compareGraphs(inverterSchematic(), extracted);
    expect(result.pass).toBe(false);
    expect(result.mismatches.some((item) => item.kind === "pin" || item.kind === "short")).toBe(true);
  });

  it("raises resistance when the metal run is longer", () => {
    const model = { rPerSquare: 0.1, cPerArea: 0.02, coupling: false, contactOhm: 0 };
    const shortR = extractParasitics(metal(10, 4), model)[0]?.resistance ?? 0;
    const longR = extractParasitics(metal(30, 4), model)[0]?.resistance ?? 0;
    expect(longR).toBeGreaterThan(shortR);
  });

  it("lowers resistance when the wire is wider", () => {
    const model = { rPerSquare: 0.1, cPerArea: 0.02, coupling: false, contactOhm: 0 };
    const narrow = extractParasitics(metal(20, 2), model)[0]?.resistance ?? 0;
    const wide = extractParasitics(metal(20, 8), model)[0]?.resistance ?? 0;
    expect(wide).toBeLessThan(narrow);
  });

  it("makes an X4 cell faster than X1 under the same load", () => {
    const x1 = sizeCell("INV", 1, 16);
    const x4 = sizeCell("INV", 4, 16);
    expect(x4.risePs).toBeLessThan(x1.risePs);
    expect(x4.area).toBeGreaterThan(x1.area);
    expect(x4.cinFf).toBeGreaterThan(x1.cinFf);
  });

  it("preserves NAND truth after technology mapping", () => {
    const gates: GenericGate[] = [
      { id: "and1", op: "and", inputs: ["a", "b"], output: "ab" },
      { id: "inv1", op: "not", inputs: ["ab"], output: "y" },
    ];
    const mapped = mapNetwork(gates, "timing");
    expect(mapped.some((cell) => cell.cell === "NAND2")).toBe(true);
    expect(truthEquivalent(gates, mapped, ["a", "b"], "y")).toBe(true);
  });

  it("reduces gate count through the existing Boolean simplifier", () => {
    const result = optimizeBoolean("!!a");
    expect(result.afterGates).toBeLessThan(result.beforeGates);
  });

  it("removes dead logic and a double inversion in synthesis", () => {
    const demo = synthesisDemo();
    expect(demo.after.length).toBeLessThan(demo.before.length);
    expect(demo.steps.some((step) => step.includes("Dead") || step.includes("Involution"))).toBe(true);
    const folded = optimizeNetwork([{ id: "g", op: "and", inputs: ["a", "1"], output: "y" }], ["y"]);
    expect(folded.steps).toContain("Constant propagation");
  });

  it("counts flip-flops from the encoding", () => {
    expect(fsmHardware("binary").flipFlops).toBe(2);
    expect(fsmHardware("gray").flipFlops).toBe(2);
    expect(fsmHardware("one-hot").flipFlops).toBe(4);
  });

  it("detects overlapping macros", () => {
    const separated = macroOverlaps(MINI_SOC_MACROS);
    expect(separated).toHaveLength(0);
    const piled = MINI_SOC_MACROS.map((macro) => ({ ...macro, x: 10, y: 10 }));
    expect(macroOverlaps(piled).length).toBeGreaterThan(0);
    expect(floorplanMetrics({ dieW: 100, dieH: 80, coreUtil: 0.7, macros: piled }).overlaps).toBeGreaterThan(0);
  });

  it("shortens the CPU to SRAM estimate when SRAM moves closer", () => {
    const far = estimatedWire(MINI_SOC_MACROS);
    const near = estimatedWire(MINI_SOC_MACROS.map((macro) => macro.id === "sram" ? { ...macro, x: 50, y: 30 } : macro));
    expect(near).toBeLessThan(far);
  });

  it("places cells without illegal overlap when macros are locked", () => {
    const placed = placeStandardCells({ count: 24, utilization: 0.7, mode: "greedy", seed: 1, lockMacros: true });
    expect(placed.overlaps).toBe(0);
    expect(placed.cells.length).toBe(24);
  });

  it("improves wire length when optimization targets wirelength", () => {
    const start = scrambledPlacement(8);
    const done = optimizeFully(start, "wire");
    expect(placementMetric(done, "wire")).toBeLessThan(placementMetric(start, "wire"));
  });

  it("connects a routed source to its sink", () => {
    const routed = routeNet({ x: 2, y: 4 }, { x: 40, y: 28 }, { mode: "detailed", layers: 3, viaCost: 1, congestionPenalty: 1, blocked: { x: 16, y: 2, w: 10, h: 8 } });
    expect(routed.connects).toBe(true);
    expect(routed.points[0]).toEqual({ x: 2, y: 4 });
    expect(routed.points[routed.points.length - 1]).toEqual({ x: 40, y: 28 });
    const open = routeNet({ x: 2, y: 4 }, { x: 40, y: 28 }, { mode: "detailed", layers: 3, viaCost: 1, congestionPenalty: 1, blocked: null });
    expect(routed.length).not.toBe(open.length);
  });

  it("reports overflow when demand exceeds capacity", () => {
    const hot = congestionGrid({ density: 1, layers: 1, tracks: 1, blocked: true });
    const cool = congestionGrid({ density: 0.2, layers: 4, tracks: 8, blocked: false });
    expect(hot.overflow).toBeGreaterThan(0);
    expect(cool.overflow).toBe(0);
  });

  it("reduces skew with clock tree synthesis", () => {
    const root = { x: 0, y: 0 };
    const sinks = [
      { id: "s0", x: 10, y: 0 },
      { id: "s1", x: 90, y: 0 },
      { id: "s2", x: 10, y: 50 },
      { id: "s3", x: 90, y: 40 },
    ];
    const before = clockBaseline(sinks, root);
    const after = synthesizeClock(sinks, root, "h-tree");
    expect(before.skew).toBe(skewOf(before.arrivals.map((item) => item.arrival)));
    expect(after.skew).toBe(skewOf(after.arrivals.map((item) => item.arrival)));
    expect(after.skew).toBeLessThan(before.skew);
    expect(after.buffers).toBeGreaterThan(before.buffers);
  });
});
