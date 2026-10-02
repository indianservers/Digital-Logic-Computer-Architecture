import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { adc, AVERAGE, codeVal, DEMO, idealCode, NO_REINIT, P25_DEFAULT, resValue, setCodeVal, world25, WRONG_SCALE, type P25 } from "./L25sim";

function boot(src: string, p: Partial<P25> = {}) {
  const params = { ...P25_DEFAULT, ...p };
  const m = new Mcu({ part: "F401", clock: 84e6, ips: 400_000 });
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s; t += 0.001) { world25(m, 0.001, params); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  return { m, run, params };
}
const g = (m: Mcu, k: string) => m.fw!.num(k);

describe("lab 25 ADC", () => {
  it("reads 1.65 V on PA0 as 2048 at 12 bit and converts back to 1.650 V", () => {
    const { m, run } = boot(DEMO);
    run(0.3);
    expect(g(m, "adcValue")).toBe(2048);
    expect(g(m, "voltage")).toBeCloseTo(1.65, 2);
    expect(m.uart.text).toContain("ADC Lab - Reading analog input...");
    expect(m.uart.text).toContain("ADC: 2048  Voltage: 1.650 V");
  });

  it("samples at the configured period (5 ms = 200 S/s)", () => {
    const { m, run } = boot(DEMO);
    run(0.5);
    const s = adc(m).samples;
    const dts = s.slice(1).map((x, i) => x.t - s[i]!.t);
    const mean = dts.reduce((a, b) => a + b, 0) / dts.length;
    expect(mean).toBeGreaterThan(0.0049);
    expect(mean).toBeLessThan(0.0056);
  });

  it("re-initialises for a new resolution and channel at run time", () => {
    const { m, run } = boot(DEMO, { pot: 2.0 });
    run(0.1);
    m.fw!.setGlobal("resolution", resValue(8));
    run(0.05);
    expect(g(m, "adcValue")).toBe(idealCode(2.0, 8, 3.3));
    expect(g(m, "voltage")).toBeCloseTo(2.0, 1);
    m.fw!.setGlobal("channel", 17);
    run(0.05);
    expect(g(m, "adcValue")).toBe(idealCode(1.21, 8, 3.3));
  });

  it("without re-init the ADC stays at 12 bit and the converted voltage is wrong", () => {
    const { m, run } = boot(NO_REINIT, { pot: 2.0 });
    run(0.1);
    m.fw!.setGlobal("resolution", resValue(8));
    run(0.05);
    expect(g(m, "adcValue")).toBe(idealCode(2.0, 12, 3.3));
    expect(g(m, "voltage")).toBeGreaterThan(20);
  });

  it("a lower reference raises the count; the code's 3.3 V assumption then mis-scales", () => {
    const { m, run } = boot(DEMO, { pot: 1.0, vref: 1 });
    run(0.1);
    expect(g(m, "adcValue")).toBe(idealCode(1.0, 12, 2.5));
    expect(g(m, "voltage")).toBeCloseTo(1.32, 2);
  });

  it("over-range input clips at full scale", () => {
    const { m, run } = boot(DEMO, { pot: 3.0, fiveVolt: true });
    run(0.1);
    expect(g(m, "adcValue")).toBe(4095);
  });

  it("averaging 16 samples reduces noise", () => {
    const spread = (src: string) => {
      const { m, run } = boot(src, { noisy: true });
      run(0.6);
      const c = adc(m).samples.slice(5).map((s) => s.code);
      const mean = c.reduce((a, b) => a + b, 0) / c.length;
      return Math.sqrt(c.reduce((a, b) => a + (b - mean) ** 2, 0) / c.length);
    };
    const raw = spread(DEMO), avg = spread(AVERAGE);
    expect(raw).toBeGreaterThan(5);
    expect(avg).toBeLessThan(raw / 2.5);
  });

  it("tracks a 10 Hz sine and the wrong-scale bug reads 5 V full scale", () => {
    const { m, run } = boot(DEMO, { source: "sine" });
    run(0.3);
    const s = adc(m).samples;
    const v = s.map((x) => x.volts);
    expect(Math.max(...v)).toBeGreaterThan(2.7);
    expect(Math.min(...v)).toBeLessThan(0.6);
    for (const x of s.slice(-10)) expect(Math.abs(x.volts - x.vin)).toBeLessThan(0.01);
    const w = boot(WRONG_SCALE);
    w.run(0.1);
    expect(g(w.m, "voltage")).toBeCloseTo(2.5, 2);
  });

  it("reads and rewrites resolution, channel and sample period in the source", () => {
    expect(codeVal(DEMO, "resolution")).toBe(0);
    expect(codeVal(DEMO, "channel")).toBe(0);
    expect(codeVal(DEMO, "samplePeriod")).toBe(5);
    const next = setCodeVal(setCodeVal(setCodeVal(DEMO, "resolution", resValue(10)), "channel", 16), "samplePeriod", 20);
    expect(next).toContain("uint32_t resolution = ADC_RESOLUTION_10B;");
    expect(next).toContain("uint32_t channel = ADC_CHANNEL_16;");
    expect(next).toContain("uint32_t samplePeriod = 20;");
  });
});
