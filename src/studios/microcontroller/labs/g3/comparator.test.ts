import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { BUG_ACD, BUG_NO_SEI, DEMO, expectedDuty, front, P28_DEFAULT, POLLING, RISING, world28, type P28 } from "./L28sim";

function boot(src: string, over: Partial<P28> = {}) {
  const p: P28 = { ...P28_DEFAULT, noise: 0, ...over };
  const m = new Mcu({ family: "avr" });
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s - 1e-9; t += 0.001) { world28(m, 0.001, p); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  return { m, p, run };
}
const irqs = (m: Mcu) => m.irqCount.get("ANALOG_COMP") ?? 0;

describe("lab 28 analog comparator", () => {
  it("interrupt on every toggle mirrors the comparator output on PB0 at the crossing times", () => {
    const { m, run } = boot(DEMO);
    run(0.1);
    const f = front(m);
    expect(f.edges.length).toBeGreaterThanOrEqual(19);
    expect(f.edges.length).toBeLessThanOrEqual(21);
    expect(irqs(m)).toBe(f.edges.length);
    expect(m.fw!.num("edges")).toBe(f.edges.length);
    const led = m.edges.get("PB0") ?? [];
    expect(led.length).toBe(f.edges.length);
    led.forEach(([t, lv], i) => { expect(lv).toBe(f.edges[i]![1]); expect(t - f.edges[i]![0]).toBeLessThan(50e-6); expect(t).toBeGreaterThanOrEqual(f.edges[i]![0] - 1e-9); });
    expect(m.read("ACSR") & 0x20).toBe(m.acOut ? 0x20 : 0);
  });

  it("rising-edge mode interrupts once per cycle and toggles the LED at half the rate", () => {
    const { m, run } = boot(RISING);
    run(0.1);
    expect(irqs(m)).toBeGreaterThanOrEqual(9);
    expect(irqs(m)).toBeLessThanOrEqual(11);
    expect((m.edges.get("PB0") ?? []).length).toBe(irqs(m));
  });

  it("noise without hysteresis chatters; hysteresis removes the extra edges", () => {
    const a = boot(DEMO, { noise: 0.15, hyst: 0 }); a.run(0.1);
    expect(front(a.m).edges.length).toBeGreaterThan(40);
    const b = boot(DEMO, { noise: 0.15, hyst: 0.8 }); b.run(0.1);
    expect(front(b.m).edges.length).toBeLessThanOrEqual(21);
  });

  it("bugs: no sei() leaves ACI set and the LED dark; ACD turns the comparator off", () => {
    const a = boot(BUG_NO_SEI); a.run(0.05);
    expect(a.m.edges.get("PB0")?.length ?? 0).toBe(0);
    expect(a.m.read("ACSR") & 0x10).toBe(0x10);
    const b = boot(BUG_ACD); b.run(0.05);
    expect(irqs(b.m)).toBe(0);
    expect(b.m.read("ACSR") & 0x20).toBe(0);
  });

  it("polling every 4 ms misses edges of a fast signal", () => {
    const slow = boot(POLLING, { freq: 25 }); slow.run(0.2);
    expect(slow.m.fw!.num("edges")).toBeGreaterThanOrEqual(front(slow.m).edges.length - 1);
    const fast = boot(POLLING, { freq: 500 }); fast.run(0.1);
    expect(fast.m.fw!.num("edges")).toBeLessThan(front(fast.m).edges.length / 2);
  });

  it("writing ACI = 1 clears it; expected duty follows acos for a sine", () => {
    const m = new Mcu({ family: "avr" });
    m.write("ACSR", 0); m.setComparator(1);
    expect(m.read("ACSR") & 0x30).toBe(0x30);
    m.write("ACSR", 0x10);
    expect(m.read("ACSR") & 0x10).toBe(0);
    expect(expectedDuty(P28_DEFAULT)).toBeCloseTo(0.5, 6);
    expect(expectedDuty({ ...P28_DEFAULT, vref: 3.5 })).toBeCloseTo(1 / 3, 6);
    expect(expectedDuty({ ...P28_DEFAULT, vref: 4.9 })).toBe(0);
  });
});
