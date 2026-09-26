import { describe, expect, it } from "vitest";
import {
  addBits, arithmeticShiftRight, bitsToHex, boothAction, buildBooth, formatBooth, fromBits, negateBits,
  parseBooth, signExtend, signedRange, toBits, viewAt,
} from "./booth";

describe("two's-complement helpers", () => {
  it("converts signed values, sign-extends, adds, negates, and shifts", () => {
    expect(fromBits(toBits(-3, 4))).toBe(-3);
    expect(fromBits(toBits(7, 4))).toBe(7);
    expect(fromBits(toBits(-8, 4))).toBe(-8);
    expect(signExtend(toBits(-3, 4), 5)).toEqual([1, 0, 1, 1, 1]);
    expect(fromBits(addBits(toBits(5, 4), toBits(-3, 4)).bits)).toBe(2);
    expect(fromBits(negateBits(signExtend(toBits(-8, 4), 5)))).toBe(8);
    const shifted = arithmeticShiftRight(toBits(-4, 4));
    expect(shifted[shifted.length - 1]).toBe(1);
    expect(fromBits(shifted)).toBe(-2);
    expect(bitsToHex(toBits(-15, 8))).toBe("0xF1");
  });

  it("parses signed decimal, binary, and hex into the same integer", () => {
    const range = signedRange(4);
    expect(range).toEqual({ min: -8, max: 7 });
    expect(parseBooth("-3", "signed", 4)).toEqual({ ok: true, value: -3 });
    expect(parseBooth("9", "signed", 4).ok).toBe(false);
    expect(parseBooth("1101", 2, 4)).toEqual({ ok: true, value: -3 });
    expect(parseBooth("D", 16, 4)).toEqual({ ok: true, value: -3 });
    expect(formatBooth(-3, 2, 4)).toBe("1101");
    expect(formatBooth(-3, 16, 4)).toBe("D");
  });
});

describe("Booth multiplication", () => {
  it("matches every 4-bit signed pair", () => {
    for (let m = -8; m <= 7; m += 1) {
      for (let q = -8; q <= 7; q += 1) {
        const trace = buildBooth({ width: 4, m, q });
        expect(trace.error, `${m} × ${q}`).toBe("");
        expect(trace.product).toBe(m * q === 0 ? 0 : m * q);
        expect(trace.productBits).toHaveLength(8);
        expect(trace.additions + trace.subtractions + trace.noOps).toBe(4);
      }
    }
  });

  it("covers the named examples and the minimum negative multiplicand", () => {
    expect(buildBooth({ width: 4, m: 5, q: 3 }).product).toBe(15);
    expect(buildBooth({ width: 4, m: -3, q: 5 }).product).toBe(-15);
    expect(buildBooth({ width: 4, m: 7, q: -2 }).product).toBe(-14);
    expect(buildBooth({ width: 4, m: -4, q: -3 }).product).toBe(12);
    expect(buildBooth({ width: 4, m: 6, q: 3 }).product).toBe(18);
    const extreme = buildBooth({ width: 4, m: -8, q: -8 });
    expect(extreme.product).toBe(64);
    expect(extreme.negMFits).toBe(false);
    expect(extreme.negMValue).toBe(8);
    expect(buildBooth({ width: 8, m: -128, q: 1 }).product).toBe(-128);
    expect(buildBooth({ width: 8, m: -128, q: -1 }).product).toBe(128);
    expect(buildBooth({ width: 8, m: 0, q: -128 }).product).toBe(0);
    expect(buildBooth({ width: 8, m: -1, q: 127 }).product).toBe(-127);
  });

  it("matches random pairs at 5, 6, and 8 bits", () => {
    let seed = 34;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed;
    };
    for (const width of [5, 6, 8]) {
      const span = 2 ** (width - 1);
      for (let trial = 0; trial < 40; trial += 1) {
        const m = (next() % (span * 2)) - span;
        const q = (next() % (span * 2)) - span;
        const trace = buildBooth({ width, m, q });
        expect(trace.error, `${width}-bit ${m} × ${q}`).toBe("");
        expect(trace.product).toBe(m * q === 0 ? 0 : m * q);
        expect(trace.productBits).toHaveLength(width * 2);
      }
    }
  });

  it("keeps the Booth decision, the shift, and the register widths", () => {
    const trace = buildBooth({ width: 4, m: -3, q: 5 });
    expect(trace.steps).toHaveLength(4);
    for (const step of trace.steps) {
      expect(step.aBefore).toHaveLength(4);
      expect(step.qBefore).toHaveLength(4);
      expect(step.qMinus1Before === 0 || step.qMinus1Before === 1).toBe(true);
      expect(step.action).toBe(boothAction(step.q0, step.qMinus1Before));
      expect(step.qMinus1After).toBe(step.q0);
      expect(step.aAfter[3]).toBe(step.opSign);
      expect(step.qAfter[3]).toBe(step.aAfterOp[0]);
    }
    expect(viewAt(trace, 0).qMinus1).toBe(0);
    expect(viewAt(trace, 4).cycle).toBe(4);
    expect(fromBits([...viewAt(trace, 4).q, ...viewAt(trace, 4).a])).toBe(-15);
  });
});
