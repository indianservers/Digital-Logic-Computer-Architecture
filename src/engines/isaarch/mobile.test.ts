import { describe, expect, it } from "vitest";
import { initialThermal, profileLoad, stepThermal, THERMAL_DEFAULTS } from "./mobile";

const stress = { cpu: 100, gpu: 100, npu: 100 };
const idle = { cpu: 0, gpu: 0, npu: 0 };
describe("transient mobile thermal model", () => {
  it("conserves input energy before significant heat escapes to ambient", () => {
    const p = THERMAL_DEFAULTS;
    const s = stepThermal(initialThermal(25), stress, p, 0.1);
    const stored = (s.junction - 25) * p.junctionCapacity + (s.enclosure - 25) * p.caseCapacity;
    expect(stored).toBeCloseTo(s.energy, 6);
    expect(s.junction).toBeGreaterThan(s.enclosure);
    expect(s.power).toBeCloseTo(14.4);
  });
  it("converges to the unthrottled two-node steady state", () => {
    const p = { ...THERMAL_DEFAULTS, limit: 200 };
    const s = stepThermal(initialThermal(25), { cpu: 10, gpu: 0, npu: 0 }, p, 3600);
    expect(s.enclosure).toBeCloseTo(25 + 0.9 * p.ambientResistance, 1);
    expect(s.junction).toBeCloseTo(25 + 0.9 * (p.ambientResistance + p.junctionResistance), 1);
  });
  it("throttles with hysteresis and recovers during cooldown", () => {
    const p = { ...THERMAL_DEFAULTS, limit: 55 };
    const hot = stepThermal({ ...initialThermal(25), junction: 56, enclosure: 40 }, stress, p, 1);
    expect(hot.throttle).toBe(true);
    expect(hot.frequency).toBe(.55);
    const held = stepThermal({ ...hot, junction: 52 }, idle, p, .1);
    expect(held.throttle).toBe(true);
    const cooled = stepThermal(hot, idle, p, 600);
    expect(cooled.throttle).toBe(false);
    expect(cooled.junction).toBeLessThan(hot.junction);
  });
  it("distinguishes burst and sustained workloads and models cooling resistance", () => {
    const start = initialThermal(25);
    const sustained = stepThermal(start, stress, { ...THERMAL_DEFAULTS, limit: 200 }, 600);
    const burst = stepThermal(start, stress, { ...THERMAL_DEFAULTS, limit: 200 }, 600, "burst");
    const cooled = stepThermal(start, stress, { ...THERMAL_DEFAULTS, limit: 200, ambientResistance: 2 }, 600);
    expect(burst.energy).toBeLessThan(sustained.energy / 2);
    expect(burst.junction).toBeLessThan(sustained.junction);
    expect(cooled.junction).toBeLessThan(sustained.junction);
    expect(profileLoad(stress, 120, "cooldown")).toEqual(idle);
  });
  it("does not overshoot at equilibrium and rejects invalid time or parameters", () => {
    const s = initialThermal(25);
    expect(stepThermal(s, stress, THERMAL_DEFAULTS, 0)).toEqual(s);
    expect(() => stepThermal(s, stress, THERMAL_DEFAULTS, -1)).toThrow(RangeError);
    expect(() => stepThermal(s, stress, { ...THERMAL_DEFAULTS, junctionCapacity: 0 })).toThrow(RangeError);
  });
});
