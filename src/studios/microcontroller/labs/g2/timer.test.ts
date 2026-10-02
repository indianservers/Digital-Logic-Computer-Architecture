import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import {
  bench19, CLK19, cntAt, codeValue, DEMO, measuredPeriod, NO_CEN, OFF_BY_ONE, overflowS, P19_DEFAULT, POLLING, resetCnt, setCodeValue, setCompare,
  setCompareIrq, setup19, start, timerHz, world19, writeArr, writePsc, type P19,
} from "./L19sim";

function boot(src: string, p: Partial<P19> = {}) {
  const params = { ...P19_DEFAULT, ...p };
  const m = new Mcu({ ips: 120_000, clock: CLK19, strictClock: true });
  setup19(m, params);
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s; t += 0.001) { world19(m, 0.001, params); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  return { m, run, b: bench19(m) };
}
const num = (m: Mcu, n: string) => m.fw!.num(n);

describe("lab 19 timers and counters", () => {
  it("PSC 7199 / ARR 4999 at 72 MHz overflows every 500 ms", () => {
    const { m, run, b } = boot(DEMO);
    run(2.05);
    expect(timerHz(m)).toBeCloseTo(10_000, 6);
    expect(overflowS(m)).toBeCloseTo(0.5, 9);
    expect(num(m, "overflow_count")).toBe(4);
    expect(measuredPeriod(b)!).toBeCloseTo(0.5, 4);
    expect(m.peek("TIM2.CNT")).toBeGreaterThan(400);
    expect(Math.abs(cntAt(b, m.time) - m.peek("TIM2.CNT"))).toBeLessThan(15);
  });

  it("off-by-one PSC/ARR drifts: 7201 x 5001 ticks is 500.2 ms", () => {
    const { run, b } = boot(OFF_BY_ONE);
    run(2.6);
    expect(measuredPeriod(b)! * 1000).toBeCloseTo(500.2, 1);
  });

  it("PSC is preloaded until the next update; ARR without ARPE is immediate", () => {
    const { m, run, b } = boot(DEMO);
    run(0.6);
    writePsc(m, 3599);
    run(0.05);
    expect(m.peek("TIM2.PSC")).toBe(7199);
    run(0.5);
    expect(m.peek("TIM2.PSC")).toBe(3599);
    run(1.1);
    expect(measuredPeriod(b)!).toBeCloseTo(0.25, 3);
    run(0.1);
    expect(writeArr(m, 1)).toBe(true);
    writeArr(m, 9999);
    expect(overflowS(m)).toBeCloseTo(0.5, 6);
  });

  it("start/stop freezes CNT and EGR.UG resets it", () => {
    const { m, run } = boot(DEMO);
    run(0.3);
    start(m, false);
    const c = m.peek("TIM2.CNT");
    run(0.2);
    expect(m.peek("TIM2.CNT")).toBe(c);
    resetCnt(m);
    expect(m.peek("TIM2.CNT")).toBe(0);
    start(m, true);
    run(0.1);
    expect(m.peek("TIM2.CNT")).toBeGreaterThan(900);
  });

  it("compare CH1 interrupts once per period when CC1IE is set", () => {
    const { m, run } = boot(DEMO);
    run(0.2);
    setCompare(m, true);
    run(1.5);
    expect(num(m, "compare_count")).toBe(3);
    expect(setCompareIrq(DEMO, true)).toContain("TIM_DIER_CC1IE");
    expect(setCompareIrq(setCompareIrq(DEMO, true), false)).toBe(DEMO);
  });

  it("faults and buggy variants: no CEN, no clock, halved kernel clock, polling", () => {
    expect(boot(NO_CEN).m.peek("TIM2.CNT")).toBe(0);
    const n = boot(NO_CEN); n.run(0.5); expect(n.m.peek("TIM2.CNT")).toBe(0);
    const g = boot(DEMO, { noClock: true }); g.run(0.6); expect(num(g.m, "overflow_count")).toBe(0); expect(g.m.peek("TIM2.PSC")).toBe(0);
    const h = boot(DEMO, { halfClock: true }); h.run(3.1); expect(measuredPeriod(h.b)!).toBeCloseTo(1, 3);
    const p = boot(POLLING); p.run(1.1); expect(num(p.m, "overflow_count")).toBe(2);
    expect(codeValue(DEMO, "psc")).toBe(7199);
    expect(codeValue(setCodeValue(DEMO, "arr", 999), "arr")).toBe(999);
    expect(setCodeValue(DEMO, "arr", 999)).toMatch(/TIM2->ARR = 999;/);
    expect(setCodeValue(DEMO, "arr", 999).split("\n").length).toBe(DEMO.split("\n").length);
  });
});
