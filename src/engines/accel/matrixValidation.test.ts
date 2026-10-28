import { describe, expect, it } from "vitest";
import { matMul, matMulScalarSteps, matMulVectorSteps, matMulSystolicSteps, systolicCells, parseMatrix } from "./accelerator";
describe("matrix input contracts", () => {
  const engines = [matMul, matMulScalarSteps, matMulVectorSteps, matMulSystolicSteps, (a: number[][], b: number[][]) => systolicCells(a, b, 20)];
  it.each(engines)("rejects incompatible, ragged, empty and non-finite matrices in every engine", engine => {
    for (const [a, b] of [
      [[[1, 2, 3]], [[5, 6], [7, 8]]], [[[1, 2], [3]], [[1], [2]]],
      [[], [[1]]], [[[1]], []], [[[NaN]], [[1]]], [[[1]], [[Infinity]]],
    ]) expect(() => engine(a!, b!)).toThrow();
  });
  it("supports rectangular products consistently across execution schedules", () => {
    const a = [[1, 2, 3], [4, 5, 6]], b = [[7, 8], [9, 10], [11, 12]], expected = [[58, 64], [139, 154]];
    expect(matMul(a, b)).toEqual(expected);
    for (const engine of [matMulScalarSteps, matMulVectorSteps, matMulSystolicSteps]) expect(engine(a, b).result).toEqual(expected);
    expect(systolicCells(a, b, 20).result).toEqual(expected);
  });
  it("parses finite numeric grids and rejects malformed entries", () => {
    expect(parseMatrix("1, 2\n-3 4.5")).toEqual([[1, 2], [-3, 4.5]]);
    for (const text of ["", "1 2\n3", "1,,2", "1, ", "1\n\n2", "nope", "Infinity", "1e999"]) expect(() => parseMatrix(text)).toThrow();
  });
});
