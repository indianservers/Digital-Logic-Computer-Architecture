import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { ANALOG_BUG, attached, codeAngle, DEFAULT_RANGE, DEMO, P22_DEFAULT, servo, setCodeAngle, SWEEP, world22, type P22 } from "./L22sim";

function boot(src: string, p: Partial<P22> = {}) {
  const params = { ...P22_DEFAULT, ...p };
  const m = new Mcu({ ips: 120_000 });
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s; t += 0.001) { m.tick(0.001); world22(m, 0.001, params); } expect(m.fw?.error).toBeUndefined(); };
  return { m, run, params };
}

describe("lab 22 servo", () => {
  it("drives a 50 Hz frame on D9 and centres at 1.5 ms", () => {
    const { m, run } = boot(DEMO);
    run(0.3);
    const s = servo(m);
    expect(s.valid).toBe(true);
    expect(s.freq).toBe(50);
    expect(s.pulseUs).toBeCloseTo(1500, 6);
    expect(s.duty).toBeCloseTo(0.075, 6);
    expect(s.angle).toBeCloseTo(90, 3);
    expect(attached(m)).toMatchObject({ name: "myServo", pin: "PC7", min: 500, max: 2500 });
    expect(m.uart.text).toContain("Servo angle: 90");
  });

  it("a live write to angle moves the horn at the SG90 slew rate", () => {
    const { m, run } = boot(DEMO);
    run(0.3);
    expect(m.fw!.setGlobal("angle", 180)).toBe(true);
    run(0.26);
    expect(servo(m).pulseUs).toBeCloseTo(2500, 6);
    const mid = servo(m).angle;
    expect(mid).toBeGreaterThan(90);
    expect(mid).toBeLessThan(180);
    run(0.4);
    expect(servo(m).angle).toBeCloseTo(180, 1);
    m.fw!.setGlobal("angle", 300);
    run(0.3);
    expect(servo(m).pulseUs).toBeCloseTo(2500, 6);
    expect(m.fw!.num("angle")).toBe(180);
  });

  it("load and weak supply slow the response", () => {
    const fast = boot(DEMO), slow = boot(DEMO, { load: 1, weakSupply: true });
    for (const b of [fast, slow]) { b.run(0.3); b.m.fw!.setGlobal("angle", 0); b.run(0.55); }
    expect(servo(fast.m).angle).toBeLessThan(1);
    expect(servo(slow.m).angle).toBeGreaterThan(30);
    expect(servo(slow.m).supplyV).toBeLessThan(4.5);
  });

  it("library default range gives 1472 us for 90 deg", () => {
    const { m, run } = boot(DEFAULT_RANGE);
    run(0.6);
    expect(servo(m).pulseUs).toBe(1472);
    expect(servo(m).angle).toBeCloseTo(87.5, 1);
  });

  it("analogWrite is rejected as a servo signal", () => {
    const { m, run } = boot(ANALOG_BUG);
    run(0.3);
    const s = servo(m);
    expect(s.valid).toBe(false);
    expect(s.freq).toBe(1000);
    expect(s.reason).toMatch(/not a servo frame/);
  });

  it("missing ground ignores the signal", () => {
    const { m, run } = boot(DEMO, { noGround: true });
    run(0.3);
    m.fw!.setGlobal("angle", 0);
    run(0.5);
    expect(servo(m).valid).toBe(false);
    for (let i = 0; i < 20; i++) { run(0.05); expect(Math.abs(servo(m).angle - 90)).toBeLessThan(2.5); }
  });

  it("sweep visits both ends", () => {
    const { m, run } = boot(SWEEP);
    let lo = 180, hi = 0;
    for (let i = 0; i < 60; i++) { run(0.1); lo = Math.min(lo, servo(m).angle); hi = Math.max(hi, servo(m).angle); }
    expect(lo).toBeLessThan(3);
    expect(hi).toBeGreaterThan(177);
  });

  it("code angle helpers round-trip", () => {
    expect(codeAngle(DEMO)).toBe(90);
    const r = setCodeAngle(DEMO, 45);
    expect(codeAngle(r)).toBe(45);
    expect(r.split("\n").length).toBe(DEMO.split("\n").length);
    expect(codeAngle(SWEEP)).toBeNull();
  });
});
