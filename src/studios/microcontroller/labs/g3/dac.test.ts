import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { BUG_ALIGN, BUG_NOSTART, codeVal, DC_ONLY, DEMO, history, P27_DEFAULT, pinVolts, setCodeVal, shape, world27, type P27 } from "./L27sim";

function boot(src: string, over: Partial<P27> = {}) {
  const p = { ...P27_DEFAULT, ...over };
  const m = new Mcu({ part: "F401", clock: 84e6, ips: 3_000_000 });
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s; t += 0.001) { world27(m, 0.001, p); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  return { m, run, p };
}

describe("lab 27 DAC", () => {
  it("DC mode holds the code and converts it to Vout = code / 4095 x 3.3 V", () => {
    const { m, run, p } = boot(DC_ONLY);
    run(0.05);
    expect(m.dac[0]).toBe(1241);
    expect(pinVolts(m, p, 0)).toBeCloseTo(1.0, 3);
    expect(m.dacEnabled[0]).toBe(true);
  });

  it("generates a 20 Hz sine at 1 kS/s spanning almost the full range", () => {
    const { m, run } = boot(DEMO);
    run(0.2);
    const h = history(m, 0, 0.1);
    expect(h.length).toBeGreaterThan(95);
    expect(h.length).toBeLessThan(106);
    const codes = h.map((s) => s.code);
    expect(Math.max(...codes)).toBeGreaterThan(4080);
    expect(Math.min(...codes)).toBeLessThan(15);
    const dts = h.slice(1).map((s, i) => s.t - h[i]!.t);
    expect(dts.reduce((a, b) => a + b, 0) / dts.length).toBeCloseTo(0.001, 4);
  });

  it("changing the update rate at run time speeds the output up", () => {
    const { m, run } = boot(DEMO);
    run(0.05);
    m.fw!.setGlobal("updateRateHz", 5000);
    run(0.06);
    const n = history(m, 0, 0.05).length;
    expect(n).toBeGreaterThan(235);
    expect(n).toBeLessThanOrEqual(252);
  });

  it("switching channels stops DAC1 and drives DAC2 on PA5", () => {
    const { m, run, p } = boot(DC_ONLY);
    run(0.02);
    m.fw!.setGlobal("channel", 0x10);
    run(0.02);
    expect(m.dacEnabled).toEqual([false, true]);
    expect(pinVolts(m, p, 0)).toBe(0);
    expect(pinVolts(m, p, 0x10)).toBeCloseTo(1.0, 3);
  });

  it("faults: load divides the output, a sagging reference scales it", () => {
    const a = boot(DC_ONLY, { load: true }); a.run(0.02);
    expect(pinVolts(a.m, a.p, 0)).toBeCloseTo(0.4, 3);
    const b = boot(DC_ONLY, { sag: true }); b.run(0.02);
    expect(pinVolts(b.m, b.p, 0)).toBeCloseTo(1241 / 4095 * 3.0, 3);
  });

  it("bugs: no HAL_DAC_Start leaves 0 V; 8-bit alignment scrambles the code", () => {
    const a = boot(BUG_NOSTART); a.run(0.05);
    expect(a.m.dacEnabled[0]).toBe(false);
    expect(pinVolts(a.m, a.p, 0)).toBe(0);
    const b = boot(BUG_ALIGN); b.run(0.05);
    const code = b.m.fw!.num("code");
    expect(b.m.dac[0]).toBe((code & 0xff) << 4);
  });

  it("reads and rewrites the code globals; preview shapes", () => {
    expect(codeVal(DEMO, "channel")).toBe(0);
    expect(codeVal(DEMO, "waveform")).toBe(1);
    expect(codeVal(DEMO, "level")).toBe(2048);
    expect(codeVal(DEMO, "updateRateHz")).toBe(1000);
    const n = setCodeVal(setCodeVal(DEMO, "channel", 0x10), "updateRateHz", 5000);
    expect(n).toContain("uint32_t channel = DAC_CHANNEL_2;");
    expect(n).toContain("uint32_t updateRateHz = 5000;");
    expect(shape(2, 2048, 4)).toEqual([4095, 4095, 1, 1]);
    expect(shape(0, 1000, 3)).toEqual([1000, 1000, 1000]);
  });
});
