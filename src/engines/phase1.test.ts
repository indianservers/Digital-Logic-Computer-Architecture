import { describe, expect, it } from "vitest";
import { evalBoolean, parseBoolean } from "./boolean/ast";
import { algebraicSimplify } from "./boolean/simplify";
import { cellMinterm, grayCodes, rectsForImplicant } from "./kmap/map";
import { quineMcCluskey } from "./kmap/quine";
import { binaryArithmetic } from "./numbers/arithmetic";
import { binaryToGray, excess3FromDecimal, grayToBinary, parityBit, parityCheck, toBcd } from "./numbers/codes";
import { formatBase, parseBase, placeValues } from "./numbers/convert";
import { decodeFloatBits, numberToFloatBits } from "./numbers/ieee754";
import { encodeHamming, flipBit, syndromeOf } from "./numbers/hamming";
import { addTwos, decodeSigned, encodeSigned } from "./numbers/signed";
import { evalGate } from "../simulation/digital/gates";
import { expressionToMaxterms, expressionToMinterms, generateTruthTable, minimizeOutputs, truthTableToCanonicalPOS, truthTableToCanonicalSOP } from "./truth/table";

describe("number systems", () => {
  it("converts decimal, binary, octal and hex", () => {
    expect(formatBase(173, 2)).toBe("10101101");
    expect(formatBase(173, 8)).toBe("255");
    expect(formatBase(173, 16)).toBe("AD");
    expect(parseBase("AD", 16)).toBe(173);
    expect(parseBase("255", 8)).toBe(173);
  });

  it("shows active place values", () => {
    const places = placeValues("10101101", 2);
    const sum = places.filter((p) => p.active).reduce((s, p) => s + p.contribution, 0);
    expect(sum).toBe(173);
  });

  it("encodes two's complement and detects overflow", () => {
    expect(encodeSigned(-5, 8, "twos")?.join("")).toBe("11111011");
    expect(decodeSigned(encodeSigned(-5, 8, "twos") ?? [], "twos")).toBe(-5);
    expect(encodeSigned(5, 8, "sign-magnitude")?.join("")).toBe("00000101");
    expect(encodeSigned(-5, 8, "ones")?.join("")).toBe("11111010");
    const overflow = addTwos(127, 1, 8);
    expect(overflow.signed).toBe(-128);
    expect(overflow.signedOverflow).toBe(true);
  });

  it("adds with a visible carry", () => {
    const result = binaryArithmetic(0b1011, 0b0110, 4, "add");
    expect(result.resultPattern).toBe("0001");
    expect(result.overflow).toBe(true);
    expect(result.steps[0]?.rows.join("\n")).toContain("Carry");
  });

  it("converts Gray code and checks parity", () => {
    expect(grayToBinary(binaryToGray(0b1010))).toBe(0b1010);
    for (let n = 0; n < 16; n += 1) {
      const a = binaryToGray(n).toString(2);
      const b = binaryToGray((n + 1) % 16).toString(2).padStart(a.length, "0");
      const paddedA = a.padStart(b.length, "0");
      const distance = [...paddedA].filter((bit, i) => bit !== b[i]).length;
      expect(distance).toBe(1);
    }
    expect(toBcd("173")).toEqual(["0001", "0111", "0011"]);
    expect(excess3FromDecimal("1")).toEqual(["0100"]);
    const data: Array<0 | 1> = [1, 0, 1, 1];
    const bit = parityBit(data, false);
    expect(parityCheck([...data, bit], false).ok).toBe(true);
    const flipped = [...data, bit];
    flipped[0] = flipped[0] === 1 ? 0 : 1;
    expect(parityCheck(flipped, false).ok).toBe(false);
  });

  it("corrects a Hamming(7,4) error", () => {
    const word = encodeHamming([1, 0, 1, 1]);
    expect(word.bits).toEqual([0, 1, 1, 0, 0, 1, 1]);
    expect(syndromeOf(word.bits).syndrome).toBe(0);
    const damaged = flipBit(word.bits, 5);
    const found = syndromeOf(damaged);
    expect(found.syndrome).toBe(6);
    expect(found.corrected).toEqual(word.bits);
  });

  it("builds IEEE-754 single precision for 6.5", () => {
    const bits = numberToFloatBits(6.5, 32);
    const parts = decodeFloatBits(bits);
    expect(parts.sign).toBe(0);
    expect(parts.exponentBits).toBe("10000001");
    expect(parts.fractionBits.startsWith("101")).toBe(true);
    expect(parts.trueExponent).toBe(2);
    expect(decodeFloatBits(numberToFloatBits(Number.POSITIVE_INFINITY, 32)).classification).toBe("infinity");
    expect(decodeFloatBits(numberToFloatBits(-0, 32)).sign).toBe(1);
    expect(decodeFloatBits(numberToFloatBits(Number.NaN, 32)).classification).toBe("nan");
  });
});

describe("boolean and truth tables", () => {
  it("parses and evaluates both syntaxes", () => {
    const a = parseBoolean("(A AND B) OR (NOT C)");
    const b = parseBoolean("(A & B) | !C");
    const assign = { A: 1 as const, B: 0 as const, C: 1 as const };
    expect(evalBoolean(a.ast, assign)).toBe(0);
    expect(evalBoolean(b.ast, assign)).toBe(0);
    expect(a.variables).toEqual(["A", "B", "C"]);
  });

  it("simplifies A + AB with absorption", () => {
    const parsed = parseBoolean("A + A B");
    const simplified = algebraicSimplify(parsed.ast);
    expect(simplified.steps.some((step) => step.law === "Absorption")).toBe(true);
    expect(simplified.ast).toEqual({ type: "VAR", name: "A" });
  });

  it("builds canonical SOP and POS", () => {
    const table = generateTruthTable(parseBoolean("A B + C").ast);
    expect(table.rows).toHaveLength(8);
    expect(expressionToMinterms("A·B + A·B'")).toEqual([2, 3]);
    expect(expressionToMaxterms("A·B + A·B'")).toEqual([0, 1]);
    expect(truthTableToCanonicalSOP(table).length).toBeGreaterThan(0);
    expect(truthTableToCanonicalPOS(table).includes("(")).toBe(true);
    const zeros = [0, 0, 0, 0, 0, 0, 0, 0] as Array<0 | 1>;
    const ones = [1, 1, 1, 1, 1, 1, 1, 1] as Array<0 | 1>;
    expect(minimizeOutputs(["A", "B", "C"], zeros, "sop")).toBe("0");
    expect(minimizeOutputs(["A", "B", "C"], zeros, "pos")).toBe("0");
    expect(minimizeOutputs(["A", "B", "C"], ones, "sop")).toBe("1");
    expect(minimizeOutputs(["A", "B", "C"], ones, "pos")).toBe("1");
  });

  it("matches gate truth tables", () => {
    expect(evalGate("AND", [1, 1])).toBe(1);
    expect(evalGate("AND", [1, 0])).toBe(0);
    expect(evalGate("OR", [0, 0])).toBe(0);
    expect(evalGate("XOR", [1, 0])).toBe(1);
    expect(evalGate("XOR", [1, 1])).toBe(0);
    expect(evalGate("NAND", [1, 1])).toBe(0);
    expect(evalGate("NOR", [0, 0])).toBe(1);
    expect(evalGate("XNOR", [1, 1])).toBe(1);
    expect(evalGate("NOT", [0])).toBe(1);
    expect(evalGate("TRI", [1, 0])).toBe("Z");
    expect(evalGate("TRI", [1, 1])).toBe(1);
    expect(evalGate("AND", [0, "X"])).toBe(0);
  });
});

describe("K-map and Quine-McCluskey", () => {
  it("uses Gray-code headers and wraparound cells", () => {
    expect(grayCodes(2)).toEqual([0, 1, 3, 2]);
    expect(cellMinterm(4, 0, 0, 3)).toBe(2);
    expect(cellMinterm(4, 0, 3, 0)).toBe(8);
    expect(cellMinterm(3, 0, 0, 0)).toBe(0);
    expect(cellMinterm(3, 0, 0, 3)).toBe(2);
  });

  it("minimizes known functions and marks essentials", () => {
    const two = quineMcCluskey([2, 3], [], 2, ["A", "B"]);
    expect(two.expression.replace(/\s/g, "")).toBe("A");
    const three = quineMcCluskey([0, 1, 2, 3], [], 3, ["A", "B", "C"]);
    expect(three.expression.replace(/\s/g, "")).toBe("A'");
    const wrapped = quineMcCluskey([0, 2], [], 3, ["A", "B", "C"]);
    expect(wrapped.expression.replace(/\s/g, "")).toBe("A'·C'");
    const withDont = quineMcCluskey([1, 3], [0, 2], 3, ["A", "B", "C"]);
    expect(withDont.expression.replace(/\s/g, "")).toBe("A'");
    expect(withDont.implicants.some((im) => im.essential && im.selected)).toBe(true);
  });

  it("draws a wraparound group as more than one rectangle", () => {
    const result = quineMcCluskey([0, 2], [], 3, ["A", "B", "C"]);
    const implicant = result.selected[0];
    expect(implicant).toBeDefined();
    if (!implicant) return;
    const rects = rectsForImplicant(implicant, 3, "G1");
    expect(rects.length).toBeGreaterThan(1);
    expect(rects.some((rect) => rect.wrap)).toBe(true);
  });
});
