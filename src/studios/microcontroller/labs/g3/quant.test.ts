import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import {
  BITS16, BUG_U8, codeDefine, DEMO, enob, fmtV, idealSnr, lsb, mcu26, OVERSAMPLE, P26_DEFAULT, quantize, rmsQuantError, run26, setCodeDefine, window26, world26, type P26,
} from "./L26sim";

function boot(src: string, over: Partial<P26> = {}) {
  const p = { ...P26_DEFAULT, ...over };
  const m = new Mcu(mcu26(p));
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s; t += 0.001) { world26(m, 0.001, p); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  return { m, run, p };
}
const lines = (m: Mcu) => m.uart.text.split("\n").filter((l) => l.startsWith("ADC:"));
const parse = (l: string) => { const x = /ADC:\s+(\d+)\s+Voltage: ([\d.]+) V/.exec(l)!; return { code: Number(x[1]), volts: Number(x[2]) }; };

describe("lab 26 ADC resolution and quantization", () => {
  it("quantizes with LSB = Vref / 2^N and clips to the code range", () => {
    const p = { ...P26_DEFAULT, noise: 0 };
    expect(lsb(8, 5)).toBeCloseTo(0.01953125, 8);
    expect(quantize(3.05, 8, p)).toBe(156);
    expect(quantize(3.0518, 12, p)).toBe(2500);
    expect(quantize(-0.3, 10, p)).toBe(0);
    expect(quantize(6, 10, p)).toBe(1023);
    expect(quantize(1.0, 12, { ...p, sag: true })).toBe(Math.round(1.0 / (4.5 / 4096)));
    expect(quantize(4 * lsb(12, 5), 12, { ...p, stuck: true })).toBe(0);
  });

  it("runs the firmware: 12-bit codes print with code x LSB voltages every 100 ms", () => {
    const { m, run } = boot(DEMO, { wave: "dc", offset: 3.0518, noise: 0 });
    run(0.55);
    expect(m.uart.text).toContain("ADC Reading (12-bit):");
    const ls = lines(m);
    expect(ls.length).toBeGreaterThanOrEqual(5);
    expect(ls.length).toBeLessThanOrEqual(7);
    const last = parse(ls[ls.length - 1]!);
    expect(last.code).toBe(2500);
    expect(last.volts).toBeCloseTo(2500 * 5 / 4096, 3);
    expect(m.adcBits).toBe(12);
  });

  it("16-bit firmware resolves 76 uV steps", () => {
    const { m, run } = boot(BITS16, { wave: "dc", offset: 1.2345, noise: 0 });
    run(0.15);
    const last = parse(lines(m).pop()!);
    expect(last.code).toBe(Math.round(1.2345 / lsb(16, 5)));
    expect(Math.abs(last.volts - 1.2345)).toBeLessThan(1e-4);
  });

  it("a uint8_t result keeps only the low 8 bits", () => {
    const { m, run } = boot(BUG_U8, { wave: "dc", offset: 3.0518, noise: 0 });
    run(0.15);
    expect(parse(lines(m).pop()!).code).toBe(2500 & 0xff);
    expect(run26(m)!.last!.code).toBe(2500);
  });

  it("oversampling 16x with noise gains resolution beyond 12 bits", () => {
    const { m, run } = boot(OVERSAMPLE, { wave: "dc", offset: 1.00037, noise: 0.002 });
    run(1.05);
    const vs = lines(m).slice(2).map((l) => parse(l).volts);
    const mean = vs.reduce((a, b) => a + b, 0) / vs.length;
    expect(Math.abs(mean - 1.00037)).toBeLessThan(lsb(12, 5) / 2);
  });

  it("measured RMS quantization error follows LSB / sqrt(12)", () => {
    const p = { ...P26_DEFAULT, fs: 20000 };
    const w = window26(p, 1.0);
    expect(w.ts.length).toBe(401);
    for (const b of [8, 10, 12]) {
      const e = rmsQuantError(w, b, p), th = lsb(b, 5) / Math.sqrt(12);
      expect(e).toBeGreaterThan(th * 0.8);
      expect(e).toBeLessThan(th * 1.2);
    }
    expect(idealSnr(8)).toBeCloseTo(49.92, 1);
    expect(idealSnr(16)).toBeCloseTo(98.08, 1);
  });

  it("triggered window starts on a cycle boundary and is repeatable", () => {
    const p = { ...P26_DEFAULT };
    const a = window26(p, 0.537), b = window26(p, 0.537);
    expect(a.vin).toEqual(b.vin);
    expect((a.start * p.freq) % 1).toBeCloseTo(0, 6);
    expect(a.start).toBeLessThanOrEqual(0.537 - 0.02);
  });

  it("noise caps the effective number of bits", () => {
    expect(enob(16, { ...P26_DEFAULT, noise: 0 })).toBeCloseTo(16, 1);
    expect(enob(16, { ...P26_DEFAULT, noise: 0.01 })).toBeLessThan(8);
  });

  it("formats volts and rewrites the code defines", () => {
    expect(fmtV(0.01953)).toBe("19.53 mV");
    expect(fmtV(0.000352)).toBe("352 µV");
    expect(fmtV(76.3e-6)).toBe("76.3 µV");
    expect(codeDefine(DEMO, "ADC_BITS")).toBe(12);
    expect(codeDefine(DEMO, "VREF")).toBe(5);
    const next = setCodeDefine(setCodeDefine(DEMO, "ADC_BITS", 10), "VREF", 3.3);
    expect(next).toContain("#define ADC_BITS 10 ");
    expect(next).toContain("#define VREF 3.3f ");
  });
});
