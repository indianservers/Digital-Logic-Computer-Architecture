import { describe, expect, it } from "vitest";
import { buildArrayMultiplier, describeCell, forwardCone, multiplierView, productCone, smallTruth } from "./arrayMultiplier";

function expectProduct(aWidth: number, bWidth: number, a: number, b: number) {
  const maskA = a & (2 ** aWidth - 1);
  const maskB = b & (2 ** bWidth - 1);
  const net = buildArrayMultiplier({ aWidth, bWidth, a: maskA, b: maskB });
  expect(net.error).toBe("");
  expect(net.product).toBe(maskA * maskB);
  const weighted = net.ands.reduce((sum, gate) => sum + gate.value * 2 ** gate.weight, 0);
  expect(weighted).toBe(maskA * maskB);
  for (const gate of net.ands) {
    const aBit = (maskA >> gate.aIndex) & 1;
    const bBit = (maskB >> gate.bIndex) & 1;
    expect(gate.value).toBe(aBit & bBit);
  }
  for (const cell of net.cells) {
    const values = cell.inputs.map((item) => item.value);
    if (cell.kind === "ha") {
      const x = values[0] ?? 0;
      const y = values[1] ?? 0;
      expect(cell.sum).toBe((x ^ y) & 1);
      expect(cell.carry).toBe(x & y);
    } else {
      const x = values[0] ?? 0;
      const y = values[1] ?? 0;
      const cin = values[2] ?? 0;
      expect(cell.sum).toBe((x ^ y ^ cin) & 1);
      expect(cell.carry).toBe(x + y + cin >= 2 ? 1 : 0);
    }
  }
  return net;
}

describe("combinational array multiplier", () => {
  it("matches ordinary multiplication at several widths", () => {
    for (const size of [2, 3, 4]) expectProduct(size, size, 0b1011, 0b0110);
    expectProduct(4, 6, 13, 21);
    expectProduct(8, 8, 200, 33);
  });

  it("covers zeros, one, the maximum, powers of two, and alternating bits", () => {
    expectProduct(4, 4, 0, 0);
    expectProduct(8, 4, 0, 15);
    expectProduct(4, 4, 1, 13);
    expectProduct(4, 4, 15, 15);
    expectProduct(8, 8, 255, 255);
    expectProduct(8, 8, 128, 64);
    expectProduct(8, 8, 0b10101010, 0b01010101);
  });

  it("matches many random unsigned pairs", () => {
    let seed = 11;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed;
    };
    for (let trial = 0; trial < 40; trial += 1) {
      const aWidth = [2, 3, 4, 6, 8][next() % 5] ?? 4;
      const bWidth = [2, 4, 6, 8][next() % 4] ?? 4;
      expectProduct(aWidth, bWidth, next(), next());
    }
  });

  it("counts a 4×4 array as 16 AND gates and 12 adder cells", () => {
    const net = expectProduct(4, 4, 11, 6);
    expect(net.andCount).toBe(16);
    expect(net.halfAdders + net.fullAdders).toBe(12);
    expect(net.product).toBe(66);
    expect(net.productWidth).toBe(8);
    const fa = net.cells.find((cell) => cell.kind === "fa");
    expect(fa).toBeDefined();
    if (!fa) return;
    const info = describeCell(fa);
    expect(info.title).toBe("Full adder");
    expect(info.weight).toBe(2 ** fa.weight);
  });

  it("steps through AND generation, adder rows, and the product", () => {
    const net = buildArrayMultiplier({ aWidth: 4, bWidth: 4, a: 11, b: 6 });
    expect(multiplierView(net, 0).ands).toBe(false);
    expect(multiplierView(net, 1).ands).toBe(true);
    expect(multiplierView(net, 1).rows).toBe(0);
    expect(multiplierView(net, 2).rows).toBe(1);
    expect(multiplierView(net, 5).product).toBe(true);
    const wide = buildArrayMultiplier({ aWidth: 8, bWidth: 8, a: 3, b: 5 });
    expect(wide.andCount).toBe(64);
    expect(wide.andCount).toBeGreaterThan(net.andCount);
  });

  it("traces an operand bit forward and a product bit backward", () => {
    const net = buildArrayMultiplier({ aWidth: 4, bWidth: 4, a: 11, b: 6 });
    const fromA = forwardCone(net, { a: 0 });
    expect(fromA.some((id) => id.startsWith("and-"))).toBe(true);
    const back = productCone(net, 1);
    expect(back.length).toBeGreaterThan(1);
  });

  it("builds the 2×2 truth table and refuses a larger one", () => {
    const table = smallTruth(2, 2);
    expect(table).toHaveLength(16);
    expect(table?.[15]?.product.reduce<number>((sum, bit, index) => sum + bit * 2 ** index, 0)).toBe(9);
    expect(smallTruth(4, 4)).toBeNull();
  });
});
