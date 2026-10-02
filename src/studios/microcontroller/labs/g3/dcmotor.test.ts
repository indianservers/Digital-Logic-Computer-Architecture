import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { CLK23, codeVals, DEMO, dutyFor, LOW_FREQ, motor, P23_DEFAULT, RPM, rpmFor, SAFE_REVERSE, setCodeVals, SOFT_START, world23, type P23 } from "./L23sim";

function boot(src: string, p: Partial<P23> = {}) {
  const params = { ...P23_DEFAULT, ...p };
  const m = new Mcu({ part: "F103", clock: CLK23, ips: 120_000 });
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s; t += 0.001) { m.tick(0.001); world23(m, 0.001, params); } expect(m.fw?.error).toBeUndefined(); };
  return { m, run, params };
}
const rpm = (m: Mcu) => motor(m).w * RPM;

describe("lab 23 DC motor", () => {
  it("drives ENA at 20 kHz / 60 % and spins forward near 2900 RPM", () => {
    const { m, run } = boot(DEMO);
    run(1.5);
    const s = motor(m);
    expect(s.freq).toBeCloseTo(20000, 3);
    expect(s.en).toBeCloseTo(0.6, 6);
    expect(s.mode).toBe("forward");
    expect(m.level("PB0")).toBe(1);
    expect(m.level("PB1")).toBe(0);
    expect(rpm(m)).toBeGreaterThan(2700);
    expect(rpm(m)).toBeLessThan(3200);
    expect(Math.abs(rpm(m) - rpmFor(60, 0))).toBeLessThan(30);
    expect(s.i).toBeGreaterThan(0.2);
    expect(s.i).toBeLessThan(0.6);
    expect(s.vm).toBeGreaterThan(11.85);
    expect(s.vm).toBeLessThan(12);
  });

  it("duty scales speed and load slows it", () => {
    const a = boot(DEMO), b = boot(DEMO, { load: 3 });
    a.run(0.3); a.m.fw!.setGlobal("duty", 100); a.run(1.5);
    b.run(0.3); b.m.fw!.setGlobal("duty", 100); b.run(1.5);
    expect(rpm(a.m)).toBeGreaterThan(4700);
    expect(rpm(b.m)).toBeLessThan(rpm(a.m) - 1000);
    expect(motor(b.m).i).toBeGreaterThan(1.8);
  });

  it("instant reversal spikes the current past the L298N rating; braking first avoids it", () => {
    const hard = boot(DEMO), soft = boot(SAFE_REVERSE);
    for (const b of [hard, soft]) { b.run(1.2); b.m.fw!.setGlobal("dir", 1); b.run(0.05); }
    expect(motor(hard.m).peak).toBeGreaterThan(3);
    expect(motor(soft.m).peak).toBeLessThan(2.2);
    for (const b of [hard, soft]) b.run(2);
    expect(rpm(hard.m)).toBeLessThan(-2500);
    expect(rpm(soft.m)).toBeLessThan(-2500);
  });

  it("dutyFor inverts the steady-state model", () => {
    for (const load of [0, 1, 2]) {
      const d = dutyFor(2500, load);
      expect(rpmFor(d, load)).toBeGreaterThan(2350);
      expect(rpmFor(d, load)).toBeLessThan(2650);
    }
  });

  it("soft start ramps the applied duty", () => {
    const { m, run } = boot(SOFT_START);
    run(0.4);
    expect(motor(m).en).toBeLessThan(0.25);
    run(1.2);
    expect(motor(m).en).toBeCloseTo(0.6, 6);
  });

  it("1 kHz PWM gives large current ripple", () => {
    const fast = boot(DEMO), slow = boot(LOW_FREQ);
    fast.run(1); slow.run(1);
    expect(motor(slow.m).freq).toBeCloseTo(1000, 3);
    expect(motor(slow.m).ripple).toBeGreaterThan(motor(fast.m).ripple * 15);
  });

  it("faults: open IN2 brakes forward, VM off coasts", () => {
    const a = boot(DEMO, { in2Open: true });
    a.run(1);
    expect(motor(a.m).mode).toBe("brake");
    expect(rpm(a.m)).toBe(0);
    a.m.fw!.setGlobal("dir", 1); a.run(1);
    expect(rpm(a.m)).toBeLessThan(-2000);
    const b = boot(DEMO); b.run(1);
    const b2 = { ...b, params: { ...b.params, vmOff: true } };
    for (let t = 0; t < 0.3; t += 0.001) { b2.m.tick(0.001); world23(b2.m, 0.001, b2.params); }
    expect(motor(b.m).vm).toBe(0);
    expect(rpm(b.m)).toBeGreaterThan(0);
    expect(rpm(b.m)).toBeLessThan(2500);
  });

  it("code values round-trip", () => {
    expect(codeVals(DEMO)).toEqual({ dir: 0, duty: 60 });
    const r = setCodeVals(DEMO, { dir: 1, duty: 85 });
    expect(codeVals(r)).toEqual({ dir: 1, duty: 85 });
    expect(r.split("\n").length).toBe(DEMO.split("\n").length);
  });
});
