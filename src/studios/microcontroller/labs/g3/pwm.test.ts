import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import {
  applyConfig, ARR_BUG, BREATHING, CCR_BUG, channel, CLK21, codeConfig, DEMO, liveConfig, P21_DEFAULT, setDuty, setEnabled, setFreq, setMode, setup21, world21, type P21,
} from "./L21sim";

function boot(src: string, p: Partial<P21> = {}) {
  const params = { ...P21_DEFAULT, ...p };
  const m = new Mcu({ part: "F103", clock: CLK21, ips: 120_000 });
  setup21(m, params);
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s; t += 0.001) { world21(m, 0.001, params); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  return { m, run, params };
}

describe("lab 21 PWM generator", () => {
  it("HAL init gives 1 kHz at 50 % on PA8, CH2 configured but not started", () => {
    const { m, run } = boot(DEMO);
    run(0.02);
    const c1 = channel(m, 1);
    expect(c1.enabled).toBe(true);
    expect(c1.freq).toBeCloseTo(1000, 6);
    expect(c1.duty).toBeCloseTo(0.5, 6);
    expect(c1.pulse * 1e3).toBeCloseTo(0.5, 6);
    expect(m.pin("PA8").mode).toBe("af");
    expect(m.pwmInfo("PA8")!.duty).toBeCloseTo(0.5, 6);
    expect(channel(m, 2).enabled).toBe(false);
    expect(m.peek("TIM1.CCR2")).toBe(250);
    let high = 0;
    for (let k = 0; k < 100; k++) { m.tick(0.0000137); high += m.level("PA8"); }
    expect(high).toBeGreaterThan(30);
    expect(high).toBeLessThan(70);
  });

  it("live duty, frequency, mode and channel-enable writes", () => {
    const { m, run } = boot(DEMO);
    run(0.01);
    setDuty(m, 1, 25);
    expect(channel(m, 1).duty).toBeCloseTo(0.25, 6);
    setFreq(m, 5000);
    expect(m.peek("TIM1.ARR")).toBe(199);
    expect(channel(m, 1).freq).toBeCloseTo(5000, 6);
    expect(channel(m, 1).duty).toBeCloseTo(0.25, 6);
    setMode(m, 1, 2);
    expect(channel(m, 1).duty).toBeCloseTo(0.75, 6);
    setEnabled(m, 2, true);
    expect(channel(m, 2).enabled).toBe(true);
    expect(m.pwmInfo("PA9")!.duty).toBeCloseTo(0.25, 2);
    expect(liveConfig(m)).toMatchObject({ arr: 199, mode1: 2, en2: true });
  });

  it("bugs: ARR without -1, CCR above ARR, halved clock, inverted polarity", () => {
    const a = boot(ARR_BUG); a.run(0.01);
    expect(channel(a.m, 1).freq).toBeCloseTo(999.0, 1);
    const c = boot(CCR_BUG); c.run(0.01);
    expect(channel(c.m, 1).duty).toBe(1);
    const h = boot(DEMO, { halfClock: true }); h.run(0.01);
    expect(channel(h.m, 1).freq).toBeCloseTo(500, 6);
    const p = boot(DEMO, { polarity: true }); p.run(0.01);
    expect(channel(p.m, 1).duty).toBeCloseTo(0.5, 6);
    setDuty(p.m, 1, 20);
    expect(channel(p.m, 1).duty).toBeCloseTo(0.8, 6);
    p.params.polarity = false; p.run(0.002);
    expect(channel(p.m, 1).duty).toBeCloseTo(0.2, 6);
  });

  it("breathing LED sweeps the compare value", () => {
    const { m, run } = boot(BREATHING);
    const seen = new Set<number>();
    for (let k = 0; k < 30; k++) { run(0.05); seen.add(Math.round(channel(m, 1).duty * 10)); }
    expect(seen.size).toBeGreaterThan(6);
  });

  it("code rewrite round-trips every control", () => {
    expect(codeConfig(DEMO)).toEqual({ psc: 71, arr: 999, ccr1: 500, ccr2: 250, mode1: 1, mode2: 1, en1: true, en2: false });
    const r = applyConfig(DEMO, { psc: 35, arr: 499, ccr1: 100, ccr2: 400, mode1: 2, mode2: 1, en1: true, en2: true });
    expect(codeConfig(r)).toEqual({ psc: 35, arr: 499, ccr1: 100, ccr2: 400, mode1: 2, mode2: 1, en1: true, en2: true });
    expect(r.split("\n").length).toBe(DEMO.split("\n").length);
    expect(r).toContain("// 72 MHz / (35 + 1) = 2 MHz timer clock");
    expect(r).toContain("// 2 MHz / (499 + 1) = 4 kHz PWM");
    const { m, run } = boot(r);
    run(0.01);
    expect(channel(m, 1).freq).toBeCloseTo(4000, 6);
    expect(channel(m, 1).duty).toBeCloseTo(0.8, 6);
    expect(channel(m, 2).duty).toBeCloseTo(0.8, 6);
  });
});
