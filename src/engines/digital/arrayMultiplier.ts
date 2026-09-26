import { buildWallace } from "./wallace";
import { formatOperand, operandMax, parseOperand, type OperandRadix } from "./wallace";

export type MultBit = 0 | 1;

export const MULTIPLIER_WIDTHS = [2, 3, 4, 5, 6, 8] as const;

export interface AndGate {
  id: string;
  aIndex: number;
  bIndex: number;
  value: MultBit;
  weight: number;
  wireId: string;
}

export interface CellInput {
  name: string;
  value: MultBit;
  wireId: string;
}

export interface AdderCell {
  id: string;
  kind: "ha" | "fa";
  row: number;
  column: number;
  weight: number;
  inputs: CellInput[];
  sum: MultBit;
  carry: MultBit;
  sumWireId: string;
  carryWireId: string;
}

export interface PartialRow {
  index: number;
  bits: MultBit[];
  value: number;
  shift: number;
  suppressed: boolean;
}

export interface ArrayMultiplier {
  aWidth: number;
  bWidth: number;
  a: number;
  b: number;
  aBits: MultBit[];
  bBits: MultBit[];
  ands: AndGate[];
  cells: AdderCell[];
  rows: PartialRow[];
  productBits: MultBit[];
  product: number;
  reference: number;
  productWidth: number;
  andCount: number;
  halfAdders: number;
  fullAdders: number;
  depth: number;
  depthExpression: string;
  shiftAddSteps: number;
  wallaceLevels: number;
  error: string;
  productWire: string[];
}

export { formatOperand, operandMax, parseOperand, type OperandRadix };

function bitsOf(value: number, width: number): MultBit[] {
  return Array.from({ length: width }, (_, index) => (((value >> index) & 1) === 1 ? 1 : 0));
}

function bitsToValue(bits: MultBit[]): number {
  return bits.reduce<number>((total, bit, index) => total + bit * 2 ** index, 0);
}

export function examplePair(aWidth: number, bWidth: number): { a: number; b: number } {
  return { a: 0b1011 & operandMax(aWidth), b: 0b0110 & operandMax(bWidth) };
}

export function stepLimit(net: ArrayMultiplier): number {
  return 1 + Math.max(0, net.bWidth - 1) + 1;
}

export function multiplierView(net: ArrayMultiplier, cycle: number): { cycle: number; ands: boolean; rows: number; product: boolean } {
  const max = stepLimit(net);
  const clamped = Math.max(0, Math.min(cycle, max));
  return {
    cycle: clamped,
    ands: clamped >= 1,
    rows: Math.max(0, Math.min(clamped - 1, Math.max(0, net.bWidth - 1))),
    product: clamped === max,
  };
}

export function buildArrayMultiplier(input: { aWidth: number; bWidth: number; a: number; b: number }): ArrayMultiplier {
  const aWidth = input.aWidth;
  const bWidth = input.bWidth;
  const a = input.a & operandMax(aWidth);
  const b = input.b & operandMax(bWidth);
  const aBits = bitsOf(a, aWidth);
  const bBits = bitsOf(b, bWidth);
  const productWidth = aWidth + bWidth;
  const reference = a * b;
  const ands: AndGate[] = [];
  for (let j = 0; j < bWidth; j += 1) {
    for (let i = 0; i < aWidth; i += 1) {
      const value = ((aBits[i] ?? 0) & (bBits[j] ?? 0)) as MultBit;
      ands.push({ id: `and-${j}-${i}`, aIndex: i, bIndex: j, value, weight: i + j, wireId: `and-${j}-${i}` });
    }
  }
  const rows: PartialRow[] = [];
  for (let j = 0; j < bWidth; j += 1) {
    const bits = Array.from({ length: productWidth }, (_, weight) => {
      const i = weight - j;
      if (i < 0 || i >= aWidth) return 0;
      return ands.find((gate) => gate.bIndex === j && gate.aIndex === i)?.value ?? 0;
    });
    rows.push({ index: j, bits, value: bitsToValue(bits), shift: j, suppressed: (bBits[j] ?? 0) === 0 });
  }
  const down = new Map<number, { value: MultBit; wireId: string }>();
  for (let i = 0; i < aWidth; i += 1) {
    const gate = ands.find((item) => item.bIndex === 0 && item.aIndex === i);
    if (gate) down.set(i, { value: gate.value, wireId: gate.wireId });
  }
  const cells: AdderCell[] = [];
  const productBits: MultBit[] = Array.from({ length: productWidth }, () => 0);
  const productWire: string[] = Array.from({ length: productWidth }, () => "");
  productBits[0] = down.get(0)?.value ?? 0;
  productWire[0] = down.get(0)?.wireId ?? "";
  let current = down;
  for (let j = 1; j < bWidth; j += 1) {
    let cin: { value: MultBit; wireId: string } | null = null;
    const next = new Map<number, { value: MultBit; wireId: string }>();
    for (let i = 0; i < aWidth; i += 1) {
      const weight = i + j;
      const gate = ands.find((item) => item.bIndex === j && item.aIndex === i);
      const y = gate?.value ?? 0;
      const yWire = gate?.wireId ?? "";
      const above = current.get(weight) ?? null;
      if (i === 0) {
        const x = above?.value ?? 0;
        const sum = ((x ^ y) & 1) as MultBit;
        const carry = (x & y) as MultBit;
        const cell: AdderCell = {
          id: `ha-${j}-${i}`,
          kind: "ha",
          row: j,
          column: i,
          weight,
          inputs: [
            { name: "x", value: x, wireId: above?.wireId ?? "" },
            { name: "y", value: y, wireId: yWire },
          ],
          sum,
          carry,
          sumWireId: `sum-${j}-${i}`,
          carryWireId: `carry-${j}-${i}`,
        };
        cells.push(cell);
        next.set(weight, { value: sum, wireId: cell.sumWireId });
        cin = { value: carry, wireId: cell.carryWireId };
      } else {
        const x = above?.value ?? 0;
        const c = cin?.value ?? 0;
        const sum = ((x ^ y ^ c) & 1) as MultBit;
        const carry = (x + y + c >= 2 ? 1 : 0) as MultBit;
        const cell: AdderCell = {
          id: `fa-${j}-${i}`,
          kind: "fa",
          row: j,
          column: i,
          weight,
          inputs: [
            { name: "x", value: x, wireId: above?.wireId ?? "" },
            { name: "y", value: y, wireId: yWire },
            { name: "cin", value: c, wireId: cin?.wireId ?? "" },
          ],
          sum,
          carry,
          sumWireId: `sum-${j}-${i}`,
          carryWireId: `carry-${j}-${i}`,
        };
        cells.push(cell);
        next.set(weight, { value: sum, wireId: cell.sumWireId });
        cin = { value: carry, wireId: cell.carryWireId };
      }
    }
    if (cin) next.set(aWidth + j, cin);
    productBits[j] = next.get(j)?.value ?? 0;
    productWire[j] = next.get(j)?.wireId ?? "";
    current = next;
  }
  for (let weight = bWidth; weight < productWidth; weight += 1) {
    productBits[weight] = current.get(weight)?.value ?? 0;
    productWire[weight] = current.get(weight)?.wireId ?? "";
  }
  const product = bitsToValue(productBits);
  const halfAdders = cells.filter((cell) => cell.kind === "ha").length;
  const fullAdders = cells.filter((cell) => cell.kind === "fa").length;
  const adderStages = Math.max(0, aWidth + bWidth - 2);
  let wallaceLevels = 0;
  if (rows.length > 0) {
    wallaceLevels = buildWallace({ width: productWidth, values: rows.map((row) => row.value), finalAdder: "cla" }).levels;
  }
  return {
    aWidth,
    bWidth,
    a,
    b,
    aBits,
    bBits,
    ands,
    cells,
    rows,
    productBits,
    product,
    reference,
    productWidth,
    andCount: ands.length,
    halfAdders,
    fullAdders,
    depth: 1 + adderStages,
    depthExpression: `AND delay + ${adderStages} × adder delay`,
    shiftAddSteps: bWidth,
    wallaceLevels,
    error: product === reference ? "" : `Array product ${product} does not match ${reference}`,
    productWire,
  };
}

export function describeCell(cell: AdderCell): { title: string; inputs: string; sum: MultBit; carry: MultBit; weight: number } {
  return {
    title: cell.kind === "fa" ? "Full adder" : "Half adder",
    inputs: cell.inputs.map((item) => String(item.value)).join(", "),
    sum: cell.sum,
    carry: cell.carry,
    weight: 2 ** cell.weight,
  };
}

export function forwardCone(net: ArrayMultiplier, origin: { a?: number; b?: number; andId?: string }): string[] {
  const seeds = net.ands.filter((gate) => {
    if (origin.andId) return gate.id === origin.andId;
    if (origin.a !== undefined) return gate.aIndex === origin.a;
    if (origin.b !== undefined) return gate.bIndex === origin.b;
    return false;
  });
  const ids = new Set(seeds.map((gate) => gate.id));
  const wires = new Set(seeds.map((gate) => gate.wireId));
  let grew = true;
  while (grew) {
    grew = false;
    for (const cell of net.cells) {
      if (cell.inputs.some((item) => wires.has(item.wireId)) && !ids.has(cell.id)) {
        ids.add(cell.id);
        wires.add(cell.sumWireId);
        wires.add(cell.carryWireId);
        grew = true;
      }
    }
  }
  net.productWire.forEach((wire, bit) => {
    if (wires.has(wire)) ids.add(`p-${bit}`);
  });
  return [...ids];
}

export function productCone(net: ArrayMultiplier, bit: number): string[] {
  const start = net.productWire[bit] ?? "";
  const ids = new Set<string>([`p-${bit}`]);
  const pending = [start];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const wire = pending.pop() ?? "";
    if (!wire || seen.has(wire)) continue;
    seen.add(wire);
    const gate = net.ands.find((item) => item.wireId === wire);
    if (gate) ids.add(gate.id);
    const cell = net.cells.find((item) => item.sumWireId === wire || item.carryWireId === wire);
    if (cell) {
      ids.add(cell.id);
      for (const input of cell.inputs) pending.push(input.wireId);
    }
  }
  return [...ids];
}

export function smallTruth(aWidth: number, bWidth: number): Array<{ a: number; b: number; product: MultBit[] }> | null {
  if (aWidth !== 2 || bWidth !== 2) return null;
  const rows = [];
  for (let a = 0; a < 4; a += 1) {
    for (let b = 0; b < 4; b += 1) {
      const net = buildArrayMultiplier({ aWidth: 2, bWidth: 2, a, b });
      rows.push({ a, b, product: net.productBits });
    }
  }
  return rows;
}
