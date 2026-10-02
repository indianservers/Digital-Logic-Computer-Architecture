import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { codeVal, DEMO, FAST, HALF, P24_DEFAULT, setCodeVal, stepper, world24, WRONG_ORDER, type P24 } from "./L24sim";

function boot(src: string, p: Partial<P24> = {}) {
  const params = { ...P24_DEFAULT, ...p };
  const m = new Mcu({ family: "avr", clock: 16e6, ips: 1_000_000 });
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s; t += 0.001) { world24(m, 0.001, params); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  return { m, run, params };
}
const taken = (m: Mcu) => m.fw!.num("stepsTaken");

describe("lab 24 stepper", () => {
  it("full-steps D8 - D11 at 12 RPM (409.6 steps/s) and the rotor keeps up", () => {
    const { m, run } = boot(DEMO);
    run(2);
    const s = stepper(m);
    expect(taken(m)).toBeGreaterThan(800);
    expect(taken(m)).toBeLessThan(830);
    expect(s.rate).toBeGreaterThan(395);
    expect(s.rate).toBeLessThan(425);
    expect(s.lost).toBe(0);
    expect(s.status).toBe("Running");
    expect(s.coils.reduce((a, b) => a + b, 0)).toBe(1);
    expect(s.current).toBe(100);
    expect(s.outDeg).toBeGreaterThan(138);
    expect(s.outDeg).toBeLessThan(150);
  });

  it("finishes one revolution (2048 steps) in about 5 s, then holds", () => {
    const { m, run } = boot(DEMO);
    run(5.6);
    const s = stepper(m);
    expect(taken(m)).toBe(2048);
    expect(s.outDeg).toBeGreaterThan(359);
    expect(s.outDeg).toBeLessThan(361);
    expect(s.status).toBe("Holding");
  });

  it("reverses when dir = -1 and half-steps 4096 per turn", () => {
    const r = boot(setCodeVal(DEMO, "dir", -1));
    r.run(1);
    expect(stepper(r.m).outDeg).toBeLessThan(-60);
    const h = boot(HALF);
    h.run(5.6);
    expect(taken(h.m)).toBe(4096);
    expect(stepper(h.m).outDeg).toBeGreaterThan(359);
    expect(stepper(h.m).outDeg).toBeLessThan(361);
  });

  it("misses steps when driven too fast", () => {
    const { m, run } = boot(FAST);
    run(1.5);
    const s = stepper(m);
    const commanded = (taken(m) / 2048) * 360;
    expect(s.lost).not.toBe(0);
    expect(Math.abs(s.outDeg)).toBeLessThan(commanded * 0.5);
  });

  it("a heavy load stalls single-coil stepping but two-coil keeps sync", () => {
    const wave = boot(DEMO, { load: 2 });
    wave.run(1.5);
    expect(stepper(wave.m).lost).not.toBe(0);
    const two = boot(setCodeVal(DEMO, "mode", 1), { load: 2 });
    two.run(1.5);
    expect(stepper(two.m).lost).toBe(0);
    expect(stepper(two.m).current).toBe(200);
  });

  it("recovers after a stall: the position error stays but the status clears", () => {
    const { m, run } = boot(DEMO, { load: 2 });
    run(1);
    expect(stepper(m).status).toBe("Stalled");
    const err = stepper(m).lost;
    m.fw!.setGlobal("mode", 1);
    m.fw!.setGlobal("stepsTaken", 0);
    m.fw!.setGlobal("stepsToMove", 400);
    run(2);
    expect(stepper(m).status).toBe("Holding");
    expect(Math.abs(stepper(m).lost)).toBeGreaterThanOrEqual(Math.abs(err) - 8);
  });

  it("a wrong coil order or swapped wires only make it vibrate", () => {
    const w = boot(WRONG_ORDER);
    w.run(2);
    expect(Math.abs(stepper(w.m).outDeg)).toBeLessThan(15);
    expect(stepper(w.m).status).toBe("Stalled");
    const s = boot(DEMO, { swap23: true });
    s.run(2);
    expect(Math.abs(stepper(s.m).outDeg)).toBeLessThan(15);
    expect(stepper(s.m).status).toBe("Stalled");
    const two = boot(setCodeVal(DEMO, "mode", 1), { swap23: true });
    two.run(1);
    expect(stepper(two.m).status).toBe("Stalled");
  });

  it("no driver supply means no torque", () => {
    const { m, run } = boot(DEMO, { vccOff: true });
    run(1);
    expect(stepper(m).outDeg).toBe(0);
    expect(stepper(m).status).toBe("No power");
    expect(stepper(m).current).toBe(0);
  });

  it("a 200-step motor turns 10.24x further for the same 2048-step move", () => {
    const { m, run } = boot(DEMO, { motor: 1 });
    run(5.6);
    expect(stepper(m).outDeg).toBeGreaterThan(3680);
    expect(stepper(m).outDeg).toBeLessThan(3690);
  });

  it("reads and rewrites rpm, dir and mode in the source", () => {
    expect(codeVal(DEMO, "rpm")).toBe(12);
    expect(codeVal(DEMO, "dir")).toBe(1);
    expect(codeVal(HALF, "mode")).toBe(2);
    const next = setCodeVal(setCodeVal(DEMO, "rpm", 7), "dir", -1);
    expect(codeVal(next, "rpm")).toBe(7);
    expect(codeVal(next, "dir")).toBe(-1);
    expect(next).toContain("int rpm = 7;");
  });
});
