import { MORE_EXAMPLES } from "./examples-more";
import { addNode, connect, emptyDoc, exampleDff, exampleFullAdder, exampleHalfAdder, exampleMux, exampleSr, starterAndOr } from "./engine";
import type { CircuitDoc } from "./types";

export interface CircuitExample {
  id: string;
  name: string;
  category: string;
  build: () => CircuitDoc;
}

type Part = { type: string; x: number; y: number; label: string; params?: Record<string, number | string> };
type Link = [string, string, string, string];

function circuit(parts: Part[], links: Link[]): CircuitDoc {
  let doc = emptyDoc();
  const ids = new Map<string, string>();
  for (const part of parts) {
    const id = `n${doc.nextId}`;
    doc = addNode(doc, part.type, part.x, part.y, part.label, part.params);
    ids.set(part.label, id);
  }
  for (const [from, fromPort, to, toPort] of links) {
    const source = ids.get(from);
    const sink = ids.get(to);
    if (!source || !sink) continue;
    const next = connect(doc, source, fromPort, sink, toPort);
    doc = next.doc;
  }
  return doc;
}

function lit(type: string, name: string, values: number[], extra?: Record<string, number>): CircuitDoc {
  const parts: Part[] = values.map((value, index) => ({
    type: "input",
    x: 28,
    y: 28 + index * 72,
    label: String.fromCharCode(65 + index),
    params: { value },
  }));
  parts.push({ type, x: 190, y: 48, label: name, params: extra });
  parts.push({ type: "led", x: 360, y: 64, label: "LED" });
  const links: Link[] = values.map((_, index) => [String.fromCharCode(65 + index), "Y", name, String.fromCharCode(65 + index)]);
  links.push([name, "Y", "LED", "A"]);
  return circuit(parts, links);
}

export const CIRCUIT_EXAMPLES: CircuitExample[] = [
  { id: "and-or", name: "AND / OR network", category: "Networks", build: starterAndOr },
  { id: "not", name: "NOT inverter", category: "Gates", build: () => lit("not", "NOT", [1]) },
  { id: "buf", name: "Buffer", category: "Gates", build: () => lit("buf", "BUF", [1]) },
  { id: "and", name: "2-input AND", category: "Gates", build: () => lit("and", "AND", [1, 1]) },
  { id: "or", name: "2-input OR", category: "Gates", build: () => lit("or", "OR", [0, 1]) },
  { id: "nand", name: "2-input NAND", category: "Gates", build: () => lit("nand", "NAND", [1, 1]) },
  { id: "nor", name: "2-input NOR", category: "Gates", build: () => lit("nor", "NOR", [0, 0]) },
  { id: "xor", name: "2-input XOR", category: "Gates", build: () => lit("xor", "XOR", [1, 0]) },
  { id: "xnor", name: "2-input XNOR", category: "Gates", build: () => lit("xnor", "XNOR", [1, 1]) },
  { id: "and3", name: "3-input AND", category: "Gates", build: () => lit("and", "AND3", [1, 1, 0], { inputs: 3 }) },
  { id: "or3", name: "3-input OR", category: "Gates", build: () => lit("or", "OR3", [0, 0, 1], { inputs: 3 }) },
  { id: "nand3", name: "3-input NAND", category: "Gates", build: () => lit("nand", "NAND3", [1, 1, 1], { inputs: 3 }) },
  { id: "nor3", name: "3-input NOR", category: "Gates", build: () => lit("nor", "NOR3", [0, 1, 0], { inputs: 3 }) },
  { id: "xor3", name: "3-input XOR parity", category: "Gates", build: () => lit("xor", "XOR3", [1, 1, 1], { inputs: 3 }) },
  { id: "and4", name: "4-input AND", category: "Gates", build: () => lit("and", "AND4", [1, 1, 1, 1], { inputs: 4 }) },
  { id: "or4", name: "4-input OR", category: "Gates", build: () => lit("or", "OR4", [0, 0, 0, 1], { inputs: 4 }) },
  { id: "nand-not", name: "NAND used as NOT", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 28, y: 70, label: "A", params: { value: 1 } },
      { type: "nand", x: 180, y: 48, label: "U" },
      { type: "led", x: 360, y: 64, label: "LED" },
    ],
    [["A", "Y", "U", "A"], ["A", "Y", "U", "B"], ["U", "Y", "LED", "A"]],
  ) },
  { id: "nor-not", name: "NOR used as NOT", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 28, y: 70, label: "A", params: { value: 0 } },
      { type: "nor", x: 180, y: 48, label: "U" },
      { type: "led", x: 360, y: 64, label: "LED" },
    ],
    [["A", "Y", "U", "A"], ["A", "Y", "U", "B"], ["U", "Y", "LED", "A"]],
  ) },
  { id: "nand-and", name: "AND from NAND", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 24, y: 36, label: "A", params: { value: 1 } },
      { type: "input", x: 24, y: 130, label: "B", params: { value: 1 } },
      { type: "nand", x: 170, y: 60, label: "N1" },
      { type: "nand", x: 330, y: 60, label: "N2" },
      { type: "led", x: 500, y: 76, label: "LED" },
    ],
    [["A", "Y", "N1", "A"], ["B", "Y", "N1", "B"], ["N1", "Y", "N2", "A"], ["N1", "Y", "N2", "B"], ["N2", "Y", "LED", "A"]],
  ) },
  { id: "nor-or", name: "OR from NOR", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 24, y: 36, label: "A", params: { value: 0 } },
      { type: "input", x: 24, y: 130, label: "B", params: { value: 1 } },
      { type: "nor", x: 170, y: 60, label: "N1" },
      { type: "nor", x: 330, y: 60, label: "N2" },
      { type: "led", x: 500, y: 76, label: "LED" },
    ],
    [["A", "Y", "N1", "A"], ["B", "Y", "N1", "B"], ["N1", "Y", "N2", "A"], ["N1", "Y", "N2", "B"], ["N2", "Y", "LED", "A"]],
  ) },
  { id: "inhibit", name: "Inhibit A · B'", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 24, y: 36, label: "A", params: { value: 1 } },
      { type: "input", x: 24, y: 140, label: "B", params: { value: 0 } },
      { type: "not", x: 160, y: 140, label: "INV" },
      { type: "and", x: 320, y: 70, label: "U" },
      { type: "led", x: 490, y: 86, label: "LED" },
    ],
    [["B", "Y", "INV", "A"], ["A", "Y", "U", "A"], ["INV", "Y", "U", "B"], ["U", "Y", "LED", "A"]],
  ) },
  { id: "imply", name: "Implication A' + B", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 24, y: 36, label: "A", params: { value: 0 } },
      { type: "input", x: 24, y: 140, label: "B", params: { value: 0 } },
      { type: "not", x: 160, y: 28, label: "INV" },
      { type: "or", x: 320, y: 70, label: "U" },
      { type: "led", x: 490, y: 86, label: "LED" },
    ],
    [["A", "Y", "INV", "A"], ["INV", "Y", "U", "A"], ["B", "Y", "U", "B"], ["U", "Y", "LED", "A"]],
  ) },
  { id: "majority", name: "3-input majority", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 20, y: 20, label: "A", params: { value: 1 } },
      { type: "input", x: 20, y: 100, label: "B", params: { value: 1 } },
      { type: "input", x: 20, y: 180, label: "C", params: { value: 0 } },
      { type: "and", x: 160, y: 16, label: "AB" },
      { type: "and", x: 160, y: 100, label: "BC" },
      { type: "and", x: 160, y: 184, label: "AC" },
      { type: "or", x: 340, y: 70, label: "OR", params: { inputs: 3 } },
      { type: "output", x: 520, y: 90, label: "Y" },
    ],
    [
      ["A", "Y", "AB", "A"], ["B", "Y", "AB", "B"],
      ["B", "Y", "BC", "A"], ["C", "Y", "BC", "B"],
      ["A", "Y", "AC", "A"], ["C", "Y", "AC", "B"],
      ["AB", "Y", "OR", "A"], ["BC", "Y", "OR", "B"], ["AC", "Y", "OR", "C"],
      ["OR", "Y", "Y", "A"],
    ],
  ) },
  { id: "or-and", name: "OR into AND", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 24, y: 24, label: "A", params: { value: 1 } },
      { type: "input", x: 24, y: 100, label: "B", params: { value: 0 } },
      { type: "input", x: 24, y: 190, label: "C", params: { value: 1 } },
      { type: "or", x: 170, y: 40, label: "OR" },
      { type: "and", x: 340, y: 100, label: "AND" },
      { type: "led", x: 510, y: 116, label: "LED" },
    ],
    [["A", "Y", "OR", "A"], ["B", "Y", "OR", "B"], ["OR", "Y", "AND", "A"], ["C", "Y", "AND", "B"], ["AND", "Y", "LED", "A"]],
  ) },
  { id: "xor-gates", name: "XOR from AND / OR / NOT", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 16, y: 30, label: "A", params: { value: 1 } },
      { type: "input", x: 16, y: 160, label: "B", params: { value: 0 } },
      { type: "not", x: 140, y: 16, label: "NA" },
      { type: "not", x: 140, y: 150, label: "NB" },
      { type: "and", x: 280, y: 40, label: "P" },
      { type: "and", x: 280, y: 150, label: "Q" },
      { type: "or", x: 450, y: 90, label: "OR" },
      { type: "led", x: 620, y: 106, label: "LED" },
    ],
    [
      ["A", "Y", "NA", "A"], ["B", "Y", "NB", "A"],
      ["A", "Y", "P", "A"], ["NB", "Y", "P", "B"],
      ["NA", "Y", "Q", "A"], ["B", "Y", "Q", "B"],
      ["P", "Y", "OR", "A"], ["Q", "Y", "OR", "B"],
      ["OR", "Y", "LED", "A"],
    ],
  ) },
  { id: "double-xor", name: "XOR twice restores A", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 24, y: 40, label: "A", params: { value: 1 } },
      { type: "const", x: 24, y: 140, label: "K", params: { value: 1 } },
      { type: "xor", x: 170, y: 50, label: "X1" },
      { type: "xor", x: 340, y: 50, label: "X2" },
      { type: "led", x: 510, y: 66, label: "LED" },
    ],
    [["A", "Y", "X1", "A"], ["K", "Y", "X1", "B"], ["X1", "Y", "X2", "A"], ["K", "Y", "X2", "B"], ["X2", "Y", "LED", "A"]],
  ) },
  { id: "fanout", name: "One input, three gates", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 24, y: 110, label: "A", params: { value: 1 } },
      { type: "not", x: 180, y: 20, label: "N" },
      { type: "buf", x: 180, y: 110, label: "B" },
      { type: "and", x: 180, y: 200, label: "G" },
      { type: "led", x: 360, y: 28, label: "L1" },
      { type: "led", x: 360, y: 118, label: "L2" },
      { type: "led", x: 360, y: 216, label: "L3" },
    ],
    [
      ["A", "Y", "N", "A"], ["A", "Y", "B", "A"], ["A", "Y", "G", "A"], ["A", "Y", "G", "B"],
      ["N", "Y", "L1", "A"], ["B", "Y", "L2", "A"], ["G", "Y", "L3", "A"],
    ],
  ) },
  { id: "buf-chain", name: "Buffer chain", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 20, y: 70, label: "A", params: { value: 1 } },
      { type: "buf", x: 140, y: 56, label: "B1" },
      { type: "buf", x: 280, y: 56, label: "B2" },
      { type: "buf", x: 420, y: 56, label: "B3" },
      { type: "led", x: 560, y: 64, label: "LED" },
    ],
    [["A", "Y", "B1", "A"], ["B1", "Y", "B2", "A"], ["B2", "Y", "B3", "A"], ["B3", "Y", "LED", "A"]],
  ) },
  { id: "not-chain", name: "Three inverters", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 20, y: 70, label: "A", params: { value: 0 } },
      { type: "not", x: 140, y: 56, label: "N1" },
      { type: "not", x: 280, y: 56, label: "N2" },
      { type: "not", x: 420, y: 56, label: "N3" },
      { type: "led", x: 560, y: 64, label: "LED" },
    ],
    [["A", "Y", "N1", "A"], ["N1", "Y", "N2", "A"], ["N2", "Y", "N3", "A"], ["N3", "Y", "LED", "A"]],
  ) },
  { id: "demorgan-and", name: "De Morgan (AB)'", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 20, y: 36, label: "A", params: { value: 1 } },
      { type: "input", x: 20, y: 130, label: "B", params: { value: 0 } },
      { type: "nand", x: 180, y: 60, label: "ND" },
      { type: "led", x: 360, y: 76, label: "LED" },
    ],
    [["A", "Y", "ND", "A"], ["B", "Y", "ND", "B"], ["ND", "Y", "LED", "A"]],
  ) },
  { id: "demorgan-or", name: "De Morgan A' + B'", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 16, y: 30, label: "A", params: { value: 1 } },
      { type: "input", x: 16, y: 150, label: "B", params: { value: 0 } },
      { type: "not", x: 140, y: 16, label: "NA" },
      { type: "not", x: 140, y: 140, label: "NB" },
      { type: "or", x: 300, y: 70, label: "OR" },
      { type: "led", x: 470, y: 86, label: "LED" },
    ],
    [["A", "Y", "NA", "A"], ["B", "Y", "NB", "A"], ["NA", "Y", "OR", "A"], ["NB", "Y", "OR", "B"], ["OR", "Y", "LED", "A"]],
  ) },
  { id: "consensus", name: "Consensus AB + A'C + BC", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 12, y: 16, label: "A", params: { value: 1 } },
      { type: "input", x: 12, y: 100, label: "B", params: { value: 1 } },
      { type: "input", x: 12, y: 184, label: "C", params: { value: 1 } },
      { type: "not", x: 130, y: 8, label: "NA" },
      { type: "and", x: 240, y: 8, label: "AB" },
      { type: "and", x: 240, y: 96, label: "AC" },
      { type: "and", x: 240, y: 184, label: "BC" },
      { type: "or", x: 420, y: 80, label: "OR", params: { inputs: 3 } },
      { type: "output", x: 590, y: 100, label: "Y" },
    ],
    [
      ["A", "Y", "NA", "A"], ["A", "Y", "AB", "A"], ["B", "Y", "AB", "B"],
      ["NA", "Y", "AC", "A"], ["C", "Y", "AC", "B"],
      ["B", "Y", "BC", "A"], ["C", "Y", "BC", "B"],
      ["AB", "Y", "OR", "A"], ["AC", "Y", "OR", "B"], ["BC", "Y", "OR", "C"],
      ["OR", "Y", "Y", "A"],
    ],
  ) },
  { id: "half", name: "Half adder", category: "Arithmetic", build: exampleHalfAdder },
  { id: "full", name: "Full adder", category: "Arithmetic", build: exampleFullAdder },
  { id: "half-led", name: "Half adder with LEDs", category: "Arithmetic", build: () => circuit(
    [
      { type: "input", x: 24, y: 36, label: "A", params: { value: 1 } },
      { type: "input", x: 24, y: 140, label: "B", params: { value: 1 } },
      { type: "ha", x: 180, y: 60, label: "HA" },
      { type: "led", x: 380, y: 48, label: "SUM" },
      { type: "led", x: 380, y: 140, label: "CRY" },
    ],
    [["A", "Y", "HA", "A"], ["B", "Y", "HA", "B"], ["HA", "S", "SUM", "A"], ["HA", "C", "CRY", "A"]],
  ) },
  { id: "full-led", name: "Full adder with LEDs", category: "Arithmetic", build: () => circuit(
    [
      { type: "input", x: 20, y: 24, label: "A", params: { value: 1 } },
      { type: "input", x: 20, y: 100, label: "B", params: { value: 1 } },
      { type: "input", x: 20, y: 176, label: "Cin", params: { value: 1 } },
      { type: "fa", x: 170, y: 70, label: "FA" },
      { type: "led", x: 380, y: 56, label: "SUM" },
      { type: "led", x: 380, y: 150, label: "CRY" },
    ],
    [["A", "Y", "FA", "A"], ["B", "Y", "FA", "B"], ["Cin", "Y", "FA", "CIN"], ["FA", "S", "SUM", "A"], ["FA", "COUT", "CRY", "A"]],
  ) },
  { id: "hsub", name: "Half subtractor", category: "Arithmetic", build: () => circuit(
    [
      { type: "input", x: 24, y: 36, label: "A", params: { value: 1 } },
      { type: "input", x: 24, y: 140, label: "B", params: { value: 0 } },
      { type: "hsub", x: 180, y: 60, label: "HS" },
      { type: "output", x: 400, y: 48, label: "D" },
      { type: "output", x: 400, y: 140, label: "Bo" },
    ],
    [["A", "Y", "HS", "A"], ["B", "Y", "HS", "B"], ["HS", "D", "D", "A"], ["HS", "BO", "Bo", "A"]],
  ) },
  { id: "fsub", name: "Full subtractor", category: "Arithmetic", build: () => circuit(
    [
      { type: "input", x: 20, y: 24, label: "A", params: { value: 0 } },
      { type: "input", x: 20, y: 100, label: "B", params: { value: 1 } },
      { type: "input", x: 20, y: 176, label: "Bin", params: { value: 1 } },
      { type: "fsub", x: 170, y: 70, label: "FS" },
      { type: "led", x: 400, y: 56, label: "D" },
      { type: "led", x: 400, y: 150, label: "Bo" },
    ],
    [["A", "Y", "FS", "A"], ["B", "Y", "FS", "B"], ["Bin", "Y", "FS", "BIN"], ["FS", "D", "D", "A"], ["FS", "BOUT", "Bo", "A"]],
  ) },
  { id: "ripple", name: "Full adder from half adders", category: "Arithmetic", build: () => circuit(
    [
      { type: "input", x: 12, y: 24, label: "A", params: { value: 1 } },
      { type: "input", x: 12, y: 110, label: "B", params: { value: 1 } },
      { type: "input", x: 12, y: 210, label: "Cin", params: { value: 1 } },
      { type: "ha", x: 150, y: 30, label: "H1" },
      { type: "ha", x: 340, y: 120, label: "H2" },
      { type: "or", x: 520, y: 40, label: "OR" },
      { type: "output", x: 700, y: 150, label: "S" },
      { type: "output", x: 700, y: 50, label: "C" },
    ],
    [
      ["A", "Y", "H1", "A"], ["B", "Y", "H1", "B"],
      ["H1", "S", "H2", "A"], ["Cin", "Y", "H2", "B"],
      ["H1", "C", "OR", "A"], ["H2", "C", "OR", "B"],
      ["H2", "S", "S", "A"], ["OR", "Y", "C", "A"],
    ],
  ) },
  { id: "compare", name: "1-bit compare", category: "Arithmetic", build: () => circuit(
    [
      { type: "input", x: 24, y: 40, label: "A", params: { value: 1 } },
      { type: "input", x: 24, y: 140, label: "B", params: { value: 1 } },
      { type: "xnor", x: 180, y: 70, label: "EQ" },
      { type: "led", x: 370, y: 86, label: "LED" },
    ],
    [["A", "Y", "EQ", "A"], ["B", "Y", "EQ", "B"], ["EQ", "Y", "LED", "A"]],
  ) },
  { id: "inc", name: "Increment A with XOR and AND", category: "Arithmetic", build: () => circuit(
    [
      { type: "input", x: 20, y: 40, label: "A", params: { value: 1 } },
      { type: "const", x: 20, y: 140, label: "1", params: { value: 1 } },
      { type: "xor", x: 180, y: 30, label: "S" },
      { type: "and", x: 180, y: 140, label: "C" },
      { type: "led", x: 370, y: 46, label: "SUM" },
      { type: "led", x: 370, y: 156, label: "CRY" },
    ],
    [["A", "Y", "S", "A"], ["1", "Y", "S", "B"], ["A", "Y", "C", "A"], ["1", "Y", "C", "B"], ["S", "Y", "SUM", "A"], ["C", "Y", "CRY", "A"]],
  ) },
  { id: "mux", name: "2:1 multiplexer", category: "Routing", build: exampleMux },
  { id: "mux-gates", name: "MUX from AND / OR / NOT", category: "Routing", build: () => circuit(
    [
      { type: "input", x: 12, y: 16, label: "I0", params: { value: 1 } },
      { type: "input", x: 12, y: 100, label: "I1", params: { value: 0 } },
      { type: "input", x: 12, y: 190, label: "S", params: { value: 0 } },
      { type: "not", x: 140, y: 180, label: "NS" },
      { type: "and", x: 280, y: 24, label: "A0" },
      { type: "and", x: 280, y: 130, label: "A1" },
      { type: "or", x: 460, y: 80, label: "OR" },
      { type: "led", x: 630, y: 96, label: "LED" },
    ],
    [
      ["S", "Y", "NS", "A"],
      ["I0", "Y", "A0", "A"], ["NS", "Y", "A0", "B"],
      ["I1", "Y", "A1", "A"], ["S", "Y", "A1", "B"],
      ["A0", "Y", "OR", "A"], ["A1", "Y", "OR", "B"],
      ["OR", "Y", "LED", "A"],
    ],
  ) },
  { id: "dec", name: "2-to-4 decoder", category: "Routing", build: () => circuit(
    [
      { type: "input", x: 20, y: 40, label: "A", params: { value: 1 } },
      { type: "input", x: 20, y: 130, label: "B", params: { value: 0 } },
      { type: "dec2", x: 170, y: 40, label: "DEC" },
      { type: "led", x: 380, y: 16, label: "Y0" },
      { type: "led", x: 380, y: 80, label: "Y1" },
      { type: "led", x: 380, y: 144, label: "Y2" },
      { type: "led", x: 380, y: 208, label: "Y3" },
    ],
    [
      ["A", "Y", "DEC", "A"], ["B", "Y", "DEC", "B"],
      ["DEC", "Y0", "Y0", "A"], ["DEC", "Y1", "Y1", "A"], ["DEC", "Y2", "Y2", "A"], ["DEC", "Y3", "Y3", "A"],
    ],
  ) },
  { id: "enable", name: "AND enable", category: "Routing", build: () => circuit(
    [
      { type: "input", x: 24, y: 40, label: "D", params: { value: 1 } },
      { type: "input", x: 24, y: 140, label: "EN", params: { value: 1 } },
      { type: "and", x: 180, y: 70, label: "U" },
      { type: "led", x: 360, y: 86, label: "LED" },
    ],
    [["D", "Y", "U", "A"], ["EN", "Y", "U", "B"], ["U", "Y", "LED", "A"]],
  ) },
  { id: "select0", name: "MUX selecting I0", category: "Routing", build: () => circuit(
    [
      { type: "input", x: 24, y: 24, label: "I0", params: { value: 1 } },
      { type: "input", x: 24, y: 110, label: "I1", params: { value: 0 } },
      { type: "const", x: 24, y: 196, label: "S", params: { value: 0 } },
      { type: "mux2", x: 180, y: 80, label: "MUX" },
      { type: "probe", x: 380, y: 100, label: "Y" },
    ],
    [["I0", "Y", "MUX", "I0"], ["I1", "Y", "MUX", "I1"], ["S", "Y", "MUX", "S"], ["MUX", "Y", "Y", "A"]],
  ) },
  { id: "sr", name: "SR latch", category: "Sequential", build: exampleSr },
  { id: "sr-led", name: "SR latch with Q and Q'", category: "Sequential", build: () => circuit(
    [
      { type: "input", x: 24, y: 36, label: "S", params: { value: 1 } },
      { type: "input", x: 24, y: 140, label: "R", params: { value: 0 } },
      { type: "sr", x: 180, y: 60, label: "SR" },
      { type: "led", x: 380, y: 40, label: "Q" },
      { type: "led", x: 380, y: 130, label: "Qn" },
    ],
    [["S", "Y", "SR", "S"], ["R", "Y", "SR", "R"], ["SR", "Q", "Q", "A"], ["SR", "QN", "Qn", "A"]],
  ) },
  { id: "dlatch", name: "D latch", category: "Sequential", build: () => circuit(
    [
      { type: "input", x: 24, y: 40, label: "D", params: { value: 1 } },
      { type: "input", x: 24, y: 140, label: "EN", params: { value: 1 } },
      { type: "dlatch", x: 180, y: 60, label: "DL" },
      { type: "led", x: 380, y: 76, label: "Q" },
    ],
    [["D", "Y", "DL", "D"], ["EN", "Y", "DL", "EN"], ["DL", "Q", "Q", "A"]],
  ) },
  { id: "dff", name: "D flip-flop", category: "Sequential", build: exampleDff },
  { id: "jk", name: "JK flip-flop", category: "Sequential", build: () => circuit(
    [
      { type: "input", x: 20, y: 24, label: "J", params: { value: 1 } },
      { type: "input", x: 20, y: 110, label: "K", params: { value: 1 } },
      { type: "clock", x: 20, y: 196, label: "CLK", params: { level: 0 } },
      { type: "jkff", x: 180, y: 70, label: "JK" },
      { type: "led", x: 390, y: 90, label: "Q" },
    ],
    [["J", "Y", "JK", "J"], ["K", "Y", "JK", "K"], ["CLK", "Y", "JK", "CLK"], ["JK", "Q", "Q", "A"]],
  ) },
  { id: "tff", name: "T flip-flop", category: "Sequential", build: () => circuit(
    [
      { type: "const", x: 24, y: 40, label: "T", params: { value: 1 } },
      { type: "clock", x: 24, y: 140, label: "CLK", params: { level: 0 } },
      { type: "tff", x: 180, y: 60, label: "TFF" },
      { type: "led", x: 380, y: 76, label: "Q" },
    ],
    [["T", "Y", "TFF", "T"], ["CLK", "Y", "TFF", "CLK"], ["TFF", "Q", "Q", "A"]],
  ) },
  { id: "clock-led", name: "Clock driving an LED", category: "Sequential", build: () => circuit(
    [
      { type: "clock", x: 40, y: 70, label: "CLK", params: { level: 1 } },
      { type: "led", x: 220, y: 70, label: "LED" },
    ],
    [["CLK", "Y", "LED", "A"]],
  ) },
  { id: "delay", name: "Delay line", category: "Timing", build: () => circuit(
    [
      { type: "input", x: 24, y: 70, label: "A", params: { value: 1 } },
      { type: "delay", x: 170, y: 64, label: "DLY" },
      { type: "probe", x: 340, y: 66, label: "P" },
    ],
    [["A", "Y", "DLY", "A"], ["DLY", "Y", "P", "A"]],
  ) },
  { id: "delay-chain", name: "Two delays in series", category: "Timing", build: () => circuit(
    [
      { type: "input", x: 20, y: 70, label: "A", params: { value: 1 } },
      { type: "delay", x: 150, y: 64, label: "D1" },
      { type: "delay", x: 300, y: 64, label: "D2" },
      { type: "led", x: 460, y: 64, label: "LED" },
    ],
    [["A", "Y", "D1", "A"], ["D1", "Y", "D2", "A"], ["D2", "Y", "LED", "A"]],
  ) },
  { id: "led-on", name: "LED tied high", category: "Displays", build: () => circuit(
    [
      { type: "const", x: 40, y: 70, label: "1", params: { value: 1 } },
      { type: "led", x: 200, y: 70, label: "LED" },
    ],
    [["1", "Y", "LED", "A"]],
  ) },
  { id: "led-off", name: "LED tied low", category: "Displays", build: () => circuit(
    [
      { type: "const", x: 40, y: 70, label: "0", params: { value: 0 } },
      { type: "led", x: 200, y: 70, label: "LED" },
    ],
    [["0", "Y", "LED", "A"]],
  ) },
  { id: "button", name: "Button and LED", category: "Displays", build: () => circuit(
    [
      { type: "button", x: 40, y: 70, label: "BTN", params: { pressed: 1 } },
      { type: "led", x: 200, y: 70, label: "LED" },
    ],
    [["BTN", "Y", "LED", "A"]],
  ) },
  { id: "probe", name: "Probe on an AND", category: "Displays", build: () => circuit(
    [
      { type: "input", x: 24, y: 36, label: "A", params: { value: 1 } },
      { type: "input", x: 24, y: 130, label: "B", params: { value: 0 } },
      { type: "and", x: 170, y: 60, label: "U" },
      { type: "probe", x: 350, y: 70, label: "P" },
    ],
    [["A", "Y", "U", "A"], ["B", "Y", "U", "B"], ["U", "Y", "P", "A"]],
  ) },
  { id: "const-pair", name: "Tied 0 and tied 1", category: "Displays", build: () => circuit(
    [
      { type: "const", x: 30, y: 30, label: "LO", params: { value: 0 } },
      { type: "const", x: 30, y: 130, label: "HI", params: { value: 1 } },
      { type: "led", x: 200, y: 30, label: "L0" },
      { type: "led", x: 200, y: 130, label: "L1" },
    ],
    [["LO", "Y", "L0", "A"], ["HI", "Y", "L1", "A"]],
  ) },
  { id: "odd-parity", name: "Odd parity of three bits", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 20, y: 24, label: "A", params: { value: 1 } },
      { type: "input", x: 20, y: 100, label: "B", params: { value: 0 } },
      { type: "input", x: 20, y: 176, label: "C", params: { value: 1 } },
      { type: "xor", x: 160, y: 40, label: "X1" },
      { type: "xor", x: 330, y: 90, label: "X2" },
      { type: "led", x: 500, y: 106, label: "LED" },
    ],
    [["A", "Y", "X1", "A"], ["B", "Y", "X1", "B"], ["X1", "Y", "X2", "A"], ["C", "Y", "X2", "B"], ["X2", "Y", "LED", "A"]],
  ) },
  { id: "even-parity", name: "Even parity check", category: "Networks", build: () => circuit(
    [
      { type: "input", x: 20, y: 24, label: "A", params: { value: 1 } },
      { type: "input", x: 20, y: 100, label: "B", params: { value: 1 } },
      { type: "input", x: 20, y: 176, label: "C", params: { value: 0 } },
      { type: "xor", x: 160, y: 40, label: "X1" },
      { type: "xnor", x: 330, y: 90, label: "XN" },
      { type: "led", x: 510, y: 106, label: "LED" },
    ],
    [["A", "Y", "X1", "A"], ["B", "Y", "X1", "B"], ["X1", "Y", "XN", "A"], ["C", "Y", "XN", "B"], ["XN", "Y", "LED", "A"]],
  ) },
  ...MORE_EXAMPLES,
];
