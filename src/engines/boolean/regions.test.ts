import { describe, expect, it } from "vitest";
import { evalBoolean, parseBoolean } from "./ast";
import { algebraicSimplify } from "./simplify";
import { cubeEdges, maxtermLiteral, mintermLiteral, vennTone } from "./regions";
import { assignments, generateTruthTable } from "../truth/table";

describe("boolean studio regions", () => {
  it("keeps every 3-set region a different color", () => {
    const fills = ["000", "100", "010", "001", "110", "101", "011", "111"].map((bits) => vennTone(bits, 1).fill);
    expect(new Set(fills).size).toBe(8);
    expect(vennTone("100", 0).fill).not.toBe(vennTone("100", 1).fill);
    expect(vennTone("010", 1).fill).not.toBe(vennTone("001", 1).fill);
  });

  it("derives minterm and maxterm polarity from 101", () => {
    expect(mintermLiteral(["A", "B", "C"], [1, 0, 1])).toBe("AB'C");
    expect(maxtermLiteral(["A", "B", "C"], [1, 0, 1])).toBe("A' + B + C'");
    expect(mintermLiteral(["A", "B", "C"], [0, 0, 0])).toBe("A'B'C'");
  });

  it("connects cube vertices that differ by one bit", () => {
    const vertices: Array<[0 | 1, 0 | 1, 0 | 1]> = [];
    for (let index = 0; index < 8; index += 1) vertices.push([(index >> 2) & 1, (index >> 1) & 1, index & 1] as [0 | 1, 0 | 1, 0 | 1]);
    const edges = cubeEdges(vertices);
    expect(edges).toHaveLength(12);
    expect(edges.every(([from, to]) => from.filter((bit, index) => bit !== to[index]).length === 1)).toBe(true);
  });

  it("proves absorption, De Morgan, and a counterexample", () => {
    const absorbed = algebraicSimplify(parseBoolean("A + A B").ast);
    expect(assignments(["A", "B"]).every((row) => evalBoolean(parseBoolean("A + A B").ast, row) === evalBoolean(absorbed.ast, row))).toBe(true);
    const left = parseBoolean("(A · B)'");
    const right = parseBoolean("A' + B'");
    expect(assignments(["A", "B"]).every((row) => evalBoolean(left.ast, row) === evalBoolean(right.ast, row))).toBe(true);
    const differ = assignments(["A", "B"]).find((row) => evalBoolean(parseBoolean("A + B").ast, row) !== evalBoolean(parseBoolean("A B").ast, row));
    expect(differ).toBeTruthy();
    const table = generateTruthTable(parseBoolean("(A & B) | !C").ast);
    const live = table.rows.find((row) => row.values.join("") === "111");
    expect(live?.output).toBe(1);
  });
});
