import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import {
  applyConfig, bench20, CLK20, codeConfig, DEMO, FROZEN, lastPair, NO_WRAP, P20_DEFAULT, readout, RISING_ONLY, setup20, world20, writeCcr2, type P20,
} from "./L20sim";

function boot(src: string, p: Partial<P20> = {}) {
  const params = { ...P20_DEFAULT, ...p };
  const m = new Mcu({ ips: 120_000, clock: CLK20, strictClock: true });
  setup20(m, params);
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s; t += 0.001) { world20(m, 0.001, params); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  return { m, run, b: bench20(m), params };
}
const num = (m: Mcu, n: string) => m.fw!.num(n);

describe("lab 20 input capture and output compare", () => {
  it("captures both edges: 1.84 ms pulse is 18400 ticks, 244.1 Hz is 40967 ticks", () => {
    const { m, run, b } = boot(DEMO);
    run(0.1);
    expect(num(m, "captures")).toBeGreaterThan(40);
    expect(Math.abs(num(m, "pulse_ticks") - 18400)).toBeLessThanOrEqual(1);
    expect(Math.abs(num(m, "period_ticks") - 40967)).toBeLessThanOrEqual(1);
    expect(num(m, "pulse_us")).toBeGreaterThanOrEqual(1839);
    const r = readout(m, 100);
    expect(r.pulseS! * 1e3).toBeCloseTo(1.84, 2);
    expect(r.freqHz!).toBeCloseTo(244.1, 0);
    expect(r.compareS! * 1e3).toBeCloseTo(3.5, 6);
    const { rise, fall } = lastPair(b);
    expect(rise && fall).toBeTruthy();
    expect(((fall!.ccr - rise!.ccr) & 0xffff)).toBeGreaterThanOrEqual(18399);
  });

  it("tracks the pulse width slider live", () => {
    const { m, run, params } = boot(DEMO);
    run(0.05);
    params.width = 0.75e-3;
    run(0.05);
    expect(Math.abs(num(m, "pulse_ticks") - 7500)).toBeLessThanOrEqual(1);
  });

  it("rising-only capture measures frequency but never a width", () => {
    const { m, run } = boot(RISING_ONLY);
    run(0.1);
    expect(num(m, "pulse_ticks")).toBe(0);
    expect(Math.abs(num(m, "period_ticks") - 40967)).toBeLessThanOrEqual(1);
  });

  it("without the 16-bit mask a capture spanning the wrap gives garbage", () => {
    const { m, run } = boot(NO_WRAP);
    let bad = 0;
    for (let k = 0; k < 40; k++) { run(0.005); const v = num(m, "pulse_ticks"); if (v !== 0 && Math.abs(v - 18400) > 2) bad++; }
    expect(bad).toBeGreaterThan(0);
  });

  it("CH2 toggles once per counter cycle at CCR2, and the compare IRQ counts", () => {
    const { m, run, b } = boot(DEMO);
    run(0.1);
    const out = b.out;
    expect(out.length).toBeGreaterThanOrEqual(14);
    const gaps = out.slice(1).map((e, i) => e[0] - out[i]![0]);
    for (const g of gaps) expect(g).toBeCloseTo(65536e-7, 7);
    expect(num(m, "compare_events")).toBe(out.length);
    const shift = out[out.length - 1]![0];
    writeCcr2(m, 10000);
    run(0.03);
    const next = b.out.find((e) => e[0] > shift)!;
    expect(((next[0] - shift) % 65536e-7) / 1e-7).toBeCloseTo((10000 - 35000 + 65536) % 65536, -1);
  });

  it("frozen mode keeps PA7 still but still raises CC2IF", () => {
    const { m, run, b } = boot(FROZEN);
    run(0.05);
    expect(b.out.length).toBe(0);
    expect(num(m, "compare_events")).toBeGreaterThan(5);
  });

  it("faults: a glitch corrupts the width, no TIM3 clock captures nothing", () => {
    const g = boot(DEMO, { glitch: true });
    g.run(0.1);
    expect(Math.abs(num(g.m, "pulse_ticks") - 18400)).toBeGreaterThan(5000);
    const n = boot(DEMO, { noClock: true });
    n.run(0.05);
    expect(num(n.m, "captures")).toBe(0);
  });

  it("controls rewrite the right register lines", () => {
    expect(codeConfig(DEMO)).toEqual({ edge: "both", oc2m: 3, psc: 7, tickNs: 100, ccr2: 35000 });
    const r = applyConfig(DEMO, { edge: "falling", oc2m: 0, tickNs: 1000, ccr2: 12000 })!;
    expect(codeConfig(r)).toEqual({ edge: "falling", oc2m: 0, psc: 79, tickNs: 1000, ccr2: 12000 });
    expect(r.split("\n").length).toBe(DEMO.split("\n").length);
    expect(codeConfig(applyConfig(r, { edge: "off" })!).edge).toBe("off");
    expect(applyConfig("int main(void){}", { edge: "rising" })).toBeNull();
    const { m, run } = boot(r);
    run(0.2);
    expect(num(m, "period_ticks")).toBe(0);
    expect(Math.abs(num(m, "pulse_ticks") - 1840)).toBeGreaterThan(10);
    const f = boot(applyConfig(DEMO, { tickNs: 1000 })!);
    f.run(0.1);
    expect(Math.abs(num(f.m, "pulse_ticks") - 1840)).toBeLessThanOrEqual(1);
    expect(num(f.m, "pulse_us")).toBe(1840);
  });
});
