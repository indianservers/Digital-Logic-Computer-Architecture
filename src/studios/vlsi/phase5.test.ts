import { describe, expect, it } from "vitest";
import {
  FAB_STEPS,
  cmpSurface,
  etchProfile,
  fabStack,
  filmGrowth,
  finfetMetrics,
  gaaMetrics,
  implantProfile,
  murphyYield,
  poissonYield,
  resistPattern,
  scalingNode,
  viaConnects,
  waferMap,
  wellFit,
} from "./processModel";

describe("phase 5 devices and process", () => {
  it("raises FinFET drive with more fins", () => {
    expect(finfetMetrics(3, 40, 8).weff).toBeGreaterThan(finfetMetrics(1, 40, 8).weff);
    expect(finfetMetrics(3, 40, 8).drive).toBeGreaterThan(finfetMetrics(1, 40, 8).drive);
  });

  it("raises nanosheet width with more sheets", () => {
    expect(gaaMetrics(3, 20, 5).weff).toBeGreaterThan(gaaMetrics(1, 20, 5).weff);
  });

  it("maps technology nodes onto device families", () => {
    expect(scalingNode("180").device).toBe("planar");
    expect(scalingNode("16").device).toBe("finfet");
    expect(scalingNode("3").device).toBe("gaa");
  });

  it("keeps the fabrication sequence stable", () => {
    expect(FAB_STEPS.map((step) => step.id)).toEqual([
      "wafer", "oxidation", "resist", "lithography", "etch", "well", "implant", "gate-oxide", "gate", "source-drain", "dielectric", "contacts", "metal", "passivation",
    ]);
    expect(fabStack(0).some((layer) => layer.material === "passivation")).toBe(false);
    expect(fabStack(13).some((layer) => layer.id === "passivation")).toBe(true);
    expect(fabStack(13).some((layer) => layer.id === "metal")).toBe(true);
  });

  it("inverts the retained resist between positive and negative tone", () => {
    const mask = [true, false, true];
    const positive = resistPattern("positive", 1, mask);
    const negative = resistPattern("negative", 1, mask);
    expect(positive).toEqual([false, true, false]);
    expect(negative).toEqual(mask);
  });

  it("drives the implant deeper at higher energy", () => {
    expect(implantProfile(80, 1, 0.2).depth).toBeGreaterThan(implantProfile(20, 1, 0.2).depth);
  });

  it("marks the N-well as the PMOS region", () => {
    expect(wellFit("n", "pmos", "well").ok).toBe(true);
    expect(wellFit("n", "pmos", "substrate").ok).toBe(false);
  });

  it("grows a thicker film with more time", () => {
    expect(filmGrowth("cvd", 10, 400).thickness).toBeGreaterThan(filmGrowth("cvd", 2, 400).thickness);
    expect(filmGrowth("oxidation", 8, 900).consumed).toBeGreaterThan(0);
    expect(filmGrowth("cvd", 8, 900).consumed).toBe(0);
  });

  it("removes more material with a longer etch", () => {
    const brief = etchProfile("anisotropic", 1, 0.4, 1, 1);
    const long = etchProfile("anisotropic", 4, 0.4, 1, 1);
    expect(long.vertical).toBeGreaterThan(brief.vertical);
    expect(etchProfile("isotropic", 2, 0.4, 1, 1).undercut).toBeGreaterThan(etchProfile("anisotropic", 2, 0.4, 1, 1).undercut);
  });

  it("reduces topography as polish approaches the target", () => {
    const rough = cmpSurface(0.1, 0.4, 1);
    const flat = cmpSurface(2, 0.4, 1);
    expect(flat.variation).toBeLessThan(rough.variation);
  });

  it("connects adjacent metals only when a via is present", () => {
    expect(viaConnects(0, 1, [true, false])).toBe(true);
    expect(viaConnects(1, 2, [true, false])).toBe(false);
  });

  it("repeats a seeded wafer map", () => {
    const input = { diameter: 20, dieW: 4, dieH: 4, edge: 1, density: 0.02, seed: 9 };
    const first = waferMap(input);
    const second = waferMap(input);
    expect(second.dies.map((die) => die.kind)).toEqual(first.dies.map((die) => die.kind));
  });

  it("lowers Poisson yield when defects or die area rise", () => {
    expect(poissonYield(2, 0.4)).toBeLessThan(poissonYield(2, 0.1));
    expect(poissonYield(8, 0.1)).toBeLessThan(poissonYield(2, 0.1));
    expect(murphyYield(2, 0.2)).toBeGreaterThan(0);
  });
});
