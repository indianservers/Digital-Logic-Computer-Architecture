import { describe, expect, it } from "vitest";
import { grayCodes } from "../../engines/kmap/map";
import { cellMinterm } from "../../engines/kmap/map";
import { applyExpression, answerMatches, cellsFromAst, derive, parseSpec, validateGroup, validateNames } from "./logic";
import { parseBoolean } from "../../engines/boolean/ast";

describe("truth workbench", () => {
  it("builds Σm(0,3,4,5,6,7) and minimizes it", () => {
    const parsed = parseSpec("F(A,B,C) = Σm(0,3,4,5,6,7)", 3);
    expect(parsed.error).toBeUndefined();
    const model = derive({ names: ["A", "B", "C"], cells: parsed.cells, output: "F", extras: [] });
    expect(model.minterms).toEqual([0, 3, 4, 5, 6, 7]);
    expect(model.maxterms).toEqual([1, 2]);
    expect(model.canonicalPos).toContain("(A + B + C')");
    expect(model.equivalent).toBe(true);
    expect(model.sop.expression.split("+").map((term) => term.trim()).sort()).toEqual(["A", "B'·C'", "B·C"].sort());
    expect(model.covers.some((cover) => cover.literals === 5)).toBe(true);
  });

  it("rejects bad lists and conflicting don't cares", () => {
    expect(parseSpec("Σm(0,0)", 3).error).toMatch(/twice/i);
    expect(parseSpec("Σm(9)", 3).error).toMatch(/outside/i);
    expect(parseSpec("Σm(1) + d(1)", 3).error).toMatch(/both/i);
    expect(parseSpec("ΠM(1,2)", 3).cells[1]).toBe(0);
    expect(parseSpec("ΠM(1,2)", 3).cells[0]).toBe(1);
  });

  it("parses expressions without eval and reports a position", () => {
    const applied = applyExpression("!A && B || A && C", ["A", "B", "C"]);
    expect(applied.error).toBeUndefined();
    expect(applied.state?.cells[2]).toBe(1);
    expect(applied.state?.cells[5]).toBe(1);
    expect(applyExpression("A XOR B", ["A", "B"]).state?.cells).toEqual([0, 1, 1, 0]);
    expect(applyExpression("NOT A AND B OR A AND C", ["A", "B", "C"]).error).toBeUndefined();
    expect(applyExpression("A $ B", ["A", "B"]).error).toMatch(/position/i);
    const nand = cellsFromAst(parseBoolean("(A NAND B)").ast, ["A", "B"]);
    expect(nand).toEqual([1, 1, 1, 0]);
  });

  it("uses Gray-code K-map order and wrap adjacency", () => {
    expect(grayCodes(2)).toEqual([0, 1, 3, 2]);
    expect(cellMinterm(3, 0, 0, 0)).toBe(0);
    expect(cellMinterm(3, 0, 0, 3)).toBe(2);
    expect(cellMinterm(5, 1, 0, 0)).toBe(1);
    const cells = [1, 0, 1, 0, 1, 0, 1, 0] as Array<0 | 1 | "X">;
    expect(validateGroup(cells, [0, 2, 4, 6], 3).ok).toBe(true);
    expect(validateGroup(cells, [0, 1], 3).ok).toBe(false);
    expect(validateGroup([1, 0, 0, 0], [0, 1], 2).ok).toBe(false);
  });

  it("uses a don't care only when it helps, and checks practice answers", () => {
    const withCare = derive({ names: ["A", "B", "C"], cells: [0, 1, 0, 1, 0, 1, "X", 1], output: "F", extras: [] });
    expect(withCare.equivalent).toBe(true);
    expect(withCare.sop.expression.replaceAll(" ", "")).toBe("C");
    expect(answerMatches("C", ["A", "B", "C"], [1, 3, 5, 7], [6])).toBeNull();
    expect(answerMatches("A", ["A", "B", "C"], [1, 3, 5, 7], [6])).toMatch(/Row/);
  });

  it("rejects duplicate variable names", () => {
    expect(validateNames(["Enable", "Enable"])).toMatch(/already/i);
    expect(validateNames(["A", "AND"])).toMatch(/operator/i);
  });
});
