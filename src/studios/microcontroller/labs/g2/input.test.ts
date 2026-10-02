import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { bench12, INTEGRATOR, NAIVE, P12_DEFAULT, TIMER, world12, type P12 } from "./L12sim";

function boot(src: string) {
  const m = new Mcu({ ips: 120_000 });
  expect(m.load(src)).toEqual([]);
  return m;
}
function run(m: Mcu, p: P12, seconds: number) {
  for (let t = 0; t < seconds; t += 0.001) { world12(m, 0.001, p); m.tick(0.001); }
}
function pressN(m: Mcu, n: number, base: Partial<P12> = {}) {
  const p = { ...P12_DEFAULT, ...base };
  run(m, p, 0.05);
  for (let i = 0; i < n; i++) { run(m, { ...p, sw1: true }, 0.15); run(m, { ...p, sw1: false }, 0.15); }
  return { presses: m.fw?.field("presses") ?? 0, raw: m.fw?.field("rawEdges") ?? 0, physical: bench12(m).physical };
}

describe("lab 12 digital input / debounce", () => {
  it("bouncing contacts make the naive firmware over-count", () => {
    const m = boot(NAIVE);
    const r = pressN(m, 5, { bounce: 8 });
    expect(m.fw?.error).toBeUndefined();
    expect(r.physical).toBe(5);
    expect(r.raw).toBeGreaterThan(10);
    expect(r.presses).toBeGreaterThan(5);
  });

  it("timer debounce counts every press exactly once", () => {
    const m = boot(TIMER);
    const r = pressN(m, 5, { bounce: 8 });
    expect(r.raw).toBeGreaterThan(10);
    expect(r.presses).toBe(5);
    expect((m.edges.get("PA5") ?? []).length).toBe(5);
  });

  it("integrator debounce also counts exactly", () => {
    const r = pressN(boot(INTEGRATOR), 4, { bounce: 8 });
    expect(r.presses).toBe(4);
  });

  it("a debounce window shorter than the bounce lets double counts through", () => {
    const m = boot(TIMER.replace("#define DEBOUNCE_MS 20", "#define DEBOUNCE_MS 1"));
    const r = pressN(m, 8, { bounce: 15 });
    expect(r.presses).toBeGreaterThan(8);
  });

  it("missing pull-up leaves PA0 floating and the counters go wild", () => {
    const m = boot(TIMER.replace("#define DEBOUNCE_MS 20", "#define DEBOUNCE_MS 0"));
    run(m, { ...P12_DEFAULT, noPull: true }, 0.3);
    expect(m.isFloating("PA0")).toBe(true);
    expect(m.fw?.field("rawEdges") ?? 0).toBeGreaterThan(20);
  });

  it("SW3 clears the firmware counters", () => {
    const m = boot(TIMER);
    pressN(m, 2);
    run(m, { ...P12_DEFAULT, sw3: true }, 0.02);
    expect(m.fw?.field("presses")).toBe(0);
    expect(bench12(m).physical).toBe(0);
  });
});
