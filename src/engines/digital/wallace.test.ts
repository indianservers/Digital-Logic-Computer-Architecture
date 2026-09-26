import { describe, expect, it } from "vitest";
import {
  buildWallace, describeCompressor, exampleValues, formatOperand, nextWallaceHeight, parseOperand, playbackView,
  sequentialRippleDepth, weightedValue, type FinalAdderKind,
} from "./wallace";

function expectMatch(width: number, values: number[], finalAdder: FinalAdderKind = "cla") {
  const tree = buildWallace({ width, values, finalAdder });
  const reference = values.reduce((sum, value) => sum + (value & (2 ** width - 1)), 0);
  expect(tree.error).toBe("");
  expect(tree.sum).toBe(reference);
  expect(tree.reference).toBe(reference);
  expect(weightedValue(tree.stages[0]?.before ?? []) || reference).toBe(reference);
  let previous = reference;
  for (const stage of tree.stages) {
    expect(weightedValue(stage.before)).toBe(previous);
    expect(weightedValue(stage.after)).toBe(previous);
    expect(stage.value).toBe(previous);
    for (const [index, column] of stage.after.entries()) {
      for (const dot of column) expect(dot.weight).toBe(index);
    }
    previous = stage.value;
  }
  const tail = tree.stages.at(-1)?.after;
  if (tail) expect(weightedValue(tail)).toBe(reference);
  const rowWeight = tree.rowA.reduce<number>((sum, bit, index) => sum + bit * 2 ** index, 0)
    + tree.rowB.reduce<number>((sum, bit, index) => sum + bit * 2 ** index, 0);
  expect(rowWeight).toBe(reference);
  expect(Math.max(tree.rowA.length, 0)).toBeGreaterThan(0);
  return tree;
}

describe("Wallace tree", () => {
  it("adds zeros, one live operand, the maximum, and an alternating pattern", () => {
    expectMatch(8, [0, 0, 0, 0]);
    expectMatch(8, [0, 41, 0, 0]);
    expectMatch(4, [15, 15, 15, 15, 15, 15, 15, 15]);
    expectMatch(8, [0b10101010, 0b01010101, 0b11110000, 0b00001111]);
  });

  it("matches ordinary addition at 4, 8, and 16 bits", () => {
    for (const width of [4, 8, 16]) {
      for (const count of [3, 4, 5, 8]) {
        const values = exampleValues(count, width);
        expectMatch(width, values, "ripple");
        expectMatch(width, values, "cla");
      }
    }
  });

  it("matches many random combinations", () => {
    let seed = 17;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed;
    };
    for (let trial = 0; trial < 40; trial += 1) {
      const width = [4, 8, 16][next() % 3] ?? 8;
      const count = 3 + (next() % 6);
      const values = Array.from({ length: count }, () => next() % 2 ** width);
      expectMatch(width, values, trial % 2 === 0 ? "cla" : "ripple");
    }
  });

  it("uses a full adder as a 3:2 compressor and a half adder as a 2:2 compressor", () => {
    const tree = expectMatch(4, [1, 1, 1]);
    const fa = tree.compressors.find((item) => item.kind === "fa");
    expect(fa).toBeDefined();
    if (!fa) return;
    const info = describeCompressor(fa);
    expect(info.title).toBe("3:2 compressor");
    expect(info.sum).toBe(((fa.inputs[0]?.value ?? 0) ^ (fa.inputs[1]?.value ?? 0) ^ (fa.inputs[2]?.value ?? 0)) & 1);
    expect(info.carry).toBe((fa.inputs.reduce((sum, dot) => sum + dot.value, 0) >= 2 ? 1 : 0));
    expect(fa.carry.weight).toBe(fa.column + 1);
    expect(fa.sum.weight).toBe(fa.column);
  });

  it("changes the delay expression when the final adder changes", () => {
    const cla = buildWallace({ width: 8, values: [25, 13, 7, 9], finalAdder: "cla" });
    const ripple = buildWallace({ width: 8, values: [25, 13, 7, 9], finalAdder: "ripple" });
    expect(cla.sum).toBe(54);
    expect(ripple.sum).toBe(54);
    expect(cla.delay.expression).toContain("CLA");
    expect(ripple.delay.expression).toContain("ripple");
    expect(ripple.delay.finalDelay).not.toBe(cla.delay.finalDelay);
    expect(cla.delay.sequentialExpression).toContain(String(sequentialRippleDepth(4, 8)));
  });

  it("rejects digits that do not fit the representation or the width", () => {
    expect(parseOperand("", 10, 8).ok).toBe(false);
    expect(parseOperand("102", 2, 8).ok).toBe(false);
    expect(parseOperand("256", 10, 8).ok).toBe(false);
    expect(parseOperand("GG", 16, 8).ok).toBe(false);
    const binary = parseOperand("00011001", 2, 8);
    expect(binary.ok && binary.value).toBe(25);
    expect(formatOperand(25, 16, 8)).toBe("19");
  });

  it("steps the playback cursor and rebuilds when width or operand count changes", () => {
    const tree = buildWallace({ width: 8, values: [25, 13, 7, 9], finalAdder: "cla" });
    expect(playbackView(tree, 0).active).toBeNull();
    expect(playbackView(tree, 1).active?.id).toBe(tree.compressors[0]?.id);
    expect(playbackView(tree, tree.compressors.length).finalActive).toBe(true);
    expect(playbackView(tree, 1).revealed).toBe(1);
    const narrow = buildWallace({ width: 4, values: [1, 2, 3], finalAdder: "cla" });
    const wide = buildWallace({ width: 16, values: [1, 2, 3, 4, 5, 6, 7, 8], finalAdder: "cla" });
    expect(narrow.width).toBe(4);
    expect(wide.count).toBe(8);
    expect(wide.compressors.length).toBeGreaterThan(narrow.compressors.length);
    const node = wide.compressors[0];
    expect(node).toBeDefined();
    if (!node) return;
    const info = describeCompressor(node);
    expect(info.inputs.split(", ").length).toBe(node.inputs.length);
    expect(info.stage).toBe(node.stage + 1);
  });

  it("keeps the Wallace height sequence used by a stage", () => {
    expect(nextWallaceHeight(2)).toBe(2);
    expect(nextWallaceHeight(3)).toBe(2);
    expect(nextWallaceHeight(4)).toBe(3);
    expect(nextWallaceHeight(6)).toBe(4);
    expect(nextWallaceHeight(8)).toBe(6);
  });
});
