import { describe, expect, it } from "vitest";
import { advanceDesktop, desktopConfig, desktopJob, DESKTOP_DEFAULTS as d, initialDesktop } from "./desktopExperiment";
describe("coupled desktop experiment", () => {
  it("is deterministic across playback chunk sizes", () => {
    const whole = advanceDesktop(initialDesktop(d), d, 20);
    let chunks = initialDesktop(d);
    for (let i = 0; i < 200; i++) chunks = advanceDesktop(chunks, d, .1);
    expect(chunks.temperature).toBeCloseTo(whole.temperature, 8);
    expect(chunks.energy).toBeCloseTo(whole.energy, 8);
    expect(chunks.work).toBeCloseTo(whole.work, 8);
  });
  it("switches from burst to sustained and respects the power budget", () => {
    const s = advanceDesktop(initialDesktop(d), d, 11);
    expect(s.sample.powerLimit).toBe(65);
    expect(s.sample.power).toBeLessThanOrEqual(65.00001);
    expect(s.samples.find(x => x.time === 1)!.powerLimit).toBe(125);
  });
  it("integrates interval power and throughput into energy and work", () => {
    const s = advanceDesktop(initialDesktop(d), d, 1);
    expect(s.energy).toBeCloseTo(s.samples.slice(1).reduce((v, p) => v + p.power * .1, 0), 8);
    expect(s.work).toBeCloseTo(s.samples.slice(1).reduce((v, p) => v + p.throughput * .1, 0), 8);
  });
  it("includes GPU activity in a constrained package budget", () => {
    const c = desktopConfig({ ...desktopJob(d, "game"), sustained: 15, burst: 15 });
    const s = advanceDesktop(initialDesktop(c), c, 60);
    expect(s.sample.power).toBeLessThanOrEqual(15.00001);
    expect(s.sample.gpuPower).toBeGreaterThan(0);
    expect(s.sample.powerLimited).toBe(true);
  });
  it("stronger cooling lowers temperature and weak cooling reduces frequency", () => {
    const weak = desktopConfig({ ...d, sustained: 200, burst: 200, resistance: 1.5, fan: 20, thermalLimit: 70 });
    const strong = { ...weak, resistance: .15, fan: 100 };
    const a = advanceDesktop(initialDesktop(weak), weak, 120), b = advanceDesktop(initialDesktop(strong), strong, 120);
    expect(a.temperature).toBeGreaterThan(b.temperature);
    expect(a.sample.frequency).toBeLessThan(b.sample.frequency);
    expect(a.sample.thermalLimited).toBe(true);
  });
  it("memory streaming saturates bandwidth and benefits from more bandwidth", () => {
    const c = desktopJob(d, "memory");
    const a = advanceDesktop(initialDesktop(c), c, 1);
    const fast = { ...c, bandwidth: 80 };
    const b = advanceDesktop(initialDesktop(fast), fast, 1);
    expect(a.sample.memoryLimited).toBe(true);
    expect(a.sample.bandwidth).toBeCloseTo(c.bandwidth);
    expect(b.work).toBeGreaterThan(a.work);
  });
  it("idle cools a hot processor and completes no work", () => {
    const hot = advanceDesktop(initialDesktop(d), d, 60), idle = desktopJob(d, "idle");
    const s = advanceDesktop(hot, idle, 60);
    expect(s.temperature).toBeLessThan(hot.temperature);
    expect(s.work).toBe(hot.work);
    expect(s.sample.frequency).toBe(0);
  });
  it("bounds invalid configuration and retains only the last 120 seconds of samples", () => {
    const c = desktopConfig({ ...d, cores: NaN, bandwidth: -1, burst: 0 });
    expect(c.cores).toBe(8); expect(c.bandwidth).toBe(5); expect(c.burst).toBe(c.sustained);
    const s = advanceDesktop(initialDesktop(c), c, 180);
    expect(s.samples).toHaveLength(1200);
    expect(s.time).toBe(180); expect(s.energy).toBeGreaterThan(0);
  });
});
