import { rippleAdd } from "./arithmetic";
import type { LogicVector } from "../../types/logic";

export type WallaceBit = 0 | 1;
export type FinalAdderKind = "ripple" | "cla";
export type OperandRadix = 2 | 10 | 16;

export interface WallaceDot {
  id: string;
  value: WallaceBit;
  weight: number;
  label: string;
}

export interface WallaceCompressor {
  id: string;
  kind: "fa" | "ha";
  stage: number;
  column: number;
  inputs: WallaceDot[];
  sum: WallaceDot;
  carry: WallaceDot;
}

export interface WallaceStage {
  index: number;
  before: WallaceDot[][];
  after: WallaceDot[][];
  compressors: WallaceCompressor[];
  value: number;
}

export interface WallaceDelay {
  levels: number;
  compressorDelay: number;
  finalDelay: number;
  total: number;
  sequential: number;
  expression: string;
  sequentialExpression: string;
  finalLabel: string;
}

export interface WallaceTree {
  width: number;
  count: number;
  values: number[];
  finalAdder: FinalAdderKind;
  resultWidth: number;
  stages: WallaceStage[];
  compressors: WallaceCompressor[];
  rowA: WallaceBit[];
  rowB: WallaceBit[];
  sumBits: WallaceBit[];
  sum: number;
  reference: number;
  fullAdders: number;
  halfAdders: number;
  levels: number;
  delay: WallaceDelay;
  error: string;
}

export const WALLACE_WIDTHS = [4, 8, 16] as const;
export const WALLACE_COUNTS = [3, 4, 5, 6, 7, 8] as const;
export const OPERAND_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

const EXAMPLE = [25, 13, 7, 9, 3, 5, 1, 2];

export function operandMax(width: number): number {
  return 2 ** width - 1;
}

export function resultWidthFor(width: number, count: number): number {
  const extra = count <= 1 ? 0 : Math.ceil(Math.log2(count));
  return width + extra;
}

export function formatOperand(value: number, radix: OperandRadix, width: number): string {
  const masked = value & operandMax(width);
  if (radix === 10) return String(masked);
  const digits = radix === 2 ? width : Math.ceil(width / 4);
  return masked.toString(radix).toUpperCase().padStart(digits, "0");
}

export function parseOperand(text: string, radix: OperandRadix, width: number): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Enter a value." };
  const pattern = radix === 2 ? /^[01]+$/ : radix === 16 ? /^[0-9a-fA-F]+$/ : /^[0-9]+$/;
  if (!pattern.test(trimmed)) return { ok: false, error: "Those digits do not match the selected representation." };
  const value = Number.parseInt(trimmed, radix);
  if (!Number.isFinite(value)) return { ok: false, error: "That value is not a number." };
  const max = operandMax(width);
  if (value > max) return { ok: false, error: `Maximum for ${width} bits is ${max}.` };
  return { ok: true, value };
}

export function exampleValues(count: number, width: number): number[] {
  const max = operandMax(width);
  return EXAMPLE.slice(0, count).map((value) => Math.min(value, max));
}

export function weightedValue(columns: WallaceDot[][]): number {
  let total = 0;
  for (const column of columns) {
    for (const dot of column) total += dot.value * 2 ** dot.weight;
  }
  return total;
}

export function nextWallaceHeight(height: number): number {
  if (height <= 2) return height;
  let allowed = 2;
  while (Math.floor((allowed * 3) / 2) < height) {
    const grown = Math.floor((allowed * 3) / 2);
    if (grown <= allowed) break;
    allowed = grown;
  }
  return allowed;
}

function makeDot(ids: { n: number }, value: WallaceBit, weight: number, label: string): WallaceDot {
  ids.n += 1;
  return { id: `d${ids.n}`, value, weight, label };
}

function columnHeight(columns: WallaceDot[][]): number {
  return columns.reduce((max, column) => Math.max(max, column.length), 0);
}

function densify(columns: WallaceDot[][]): WallaceDot[][] {
  let last = columns.length;
  while (last > 0 && (columns[last - 1]?.length ?? 0) === 0) last -= 1;
  return Array.from({ length: last }, (_, index) => columns[index] ?? []);
}

function compress(columns: WallaceDot[][], stage: number, ids: { n: number }): { compressors: WallaceCompressor[]; next: WallaceDot[][] } {
  const target = nextWallaceHeight(columnHeight(columns));
  const carryIn: WallaceDot[][] = [];
  const next: WallaceDot[][] = [];
  const compressors: WallaceCompressor[] = [];
  const last = Math.max(columns.length, 1);
  for (let weight = 0; weight < last + 4; weight += 1) {
    let pool = (columns[weight] ?? []).slice();
    const arrived = carryIn[weight] ?? [];
    if (weight >= columns.length && pool.length === 0 && arrived.length === 0) break;
    const sums: WallaceDot[] = [];
    const heightNow = () => arrived.length + sums.length + pool.length;
    while (heightNow() > target && pool.length >= 2) {
      if (pool.length >= 3) {
        const x = pool[0];
        const y = pool[1];
        const z = pool[2];
        if (!x || !y || !z) break;
        pool = pool.slice(3);
        const sumBit = ((x.value ^ y.value ^ z.value) & 1) as WallaceBit;
        const carryBit = (x.value + y.value + z.value >= 2 ? 1 : 0) as WallaceBit;
        const sum = makeDot(ids, sumBit, weight, `Sum of column ${weight}, stage ${stage + 1}`);
        const carry = makeDot(ids, carryBit, weight + 1, `Carry from column ${weight}, stage ${stage + 1}`);
        compressors.push({ id: `fa-${stage}-${weight}-${compressors.length}`, kind: "fa", stage, column: weight, inputs: [x, y, z], sum, carry });
        sums.push(sum);
        (carryIn[weight + 1] ??= []).push(carry);
      } else {
        const x = pool[0];
        const y = pool[1];
        if (!x || !y) break;
        pool = pool.slice(2);
        const sumBit = ((x.value ^ y.value) & 1) as WallaceBit;
        const carryBit = (x.value & y.value) as WallaceBit;
        const sum = makeDot(ids, sumBit, weight, `Half-adder sum, column ${weight}, stage ${stage + 1}`);
        const carry = makeDot(ids, carryBit, weight + 1, `Half-adder carry, column ${weight}, stage ${stage + 1}`);
        compressors.push({ id: `ha-${stage}-${weight}-${compressors.length}`, kind: "ha", stage, column: weight, inputs: [x, y], sum, carry });
        sums.push(sum);
        (carryIn[weight + 1] ??= []).push(carry);
      }
    }
    const merged = [...arrived, ...sums, ...pool];
    if (merged.length > 0) next[weight] = merged;
  }
  return { compressors, next: densify(next) };
}

function bitsToValue(bits: WallaceBit[]): number {
  return bits.reduce<number>((total, bit, index) => total + bit * 2 ** index, 0);
}

/** Final addend is LSB-first. CLA blocks run from the low bits so a partial top block keeps its real carry. */
function addRows(a: WallaceBit[], b: WallaceBit[], kind: FinalAdderKind): { bits: WallaceBit[]; cout: WallaceBit } {
  const width = Math.max(a.length, b.length, 1);
  const aa = Array.from({ length: width }, (_, index) => a[index] ?? 0);
  const bb = Array.from({ length: width }, (_, index) => b[index] ?? 0);
  if (kind === "ripple") {
    const added = rippleAdd(toMsb(aa), toMsb(bb), 0);
    const bits = fromMsb(added.sum);
    const cout: WallaceBit = added.cout === 1 ? 1 : 0;
    return { bits: cout === 1 ? [...bits, 1] : bits, cout };
  }
  const sum: WallaceBit[] = Array.from({ length: width }, () => 0);
  let cin: WallaceBit = 0;
  for (let start = 0; start < width; start += 4) {
    const g: WallaceBit[] = [0, 0, 0, 0];
    const p: WallaceBit[] = [0, 0, 0, 0];
    const live = Math.min(4, width - start);
    for (let local = 0; local < live; local += 1) {
      const av = aa[start + local] ?? 0;
      const bv = bb[start + local] ?? 0;
      g[local] = (av & bv) as WallaceBit;
      p[local] = ((av ^ bv) & 1) as WallaceBit;
    }
    const c0: WallaceBit = cin;
    const c1: WallaceBit = (g[0] || (p[0] && c0)) ? 1 : 0;
    const c2: WallaceBit = (g[1] || (p[1] && c1)) ? 1 : 0;
    const c3: WallaceBit = (g[2] || (p[2] && c2)) ? 1 : 0;
    const c4: WallaceBit = (g[3] || (p[3] && c3)) ? 1 : 0;
    const carries: WallaceBit[] = [c0, c1, c2, c3];
    for (let local = 0; local < live; local += 1) {
      sum[start + local] = (((p[local] ?? 0) ^ (carries[local] ?? 0)) & 1) as WallaceBit;
    }
    const outs: WallaceBit[] = [c1, c2, c3, c4];
    cin = outs[live - 1] ?? 0;
  }
  return { bits: cin === 1 ? [...sum, cin] : sum, cout: cin };
}

function toMsb(bits: WallaceBit[]): LogicVector {
  return [...bits].reverse();
}

function fromMsb(bits: LogicVector): WallaceBit[] {
  return [...bits].reverse().map((bit) => (bit === 1 ? 1 : 0));
}

export function finalDelay(kind: FinalAdderKind, bits: number): { stages: number; label: string } {
  if (kind === "ripple") return { stages: bits, label: `${bits} full-adder delays` };
  const blocks = Math.max(1, Math.ceil(bits / 4));
  const stages = 4 + Math.max(0, blocks - 1);
  return { stages, label: `${stages} estimated CLA gate stages (${blocks} blocks of 4)` };
}

export function sequentialRippleDepth(count: number, width: number): number {
  let depth = 0;
  let bits = width;
  for (let index = 1; index < count; index += 1) {
    depth += bits;
    bits += 1;
  }
  return depth;
}

function delayFor(kind: FinalAdderKind, levels: number, finalBits: number, count: number, width: number): WallaceDelay {
  const final = finalDelay(kind, finalBits);
  const sequential = sequentialRippleDepth(count, width);
  const expression = kind === "cla"
    ? `${levels} × CSA delay + CLA delay`
    : `${levels} × CSA delay + ripple delay`;
  return {
    levels,
    compressorDelay: levels,
    finalDelay: final.stages,
    total: levels + final.stages,
    sequential,
    expression,
    sequentialExpression: `${sequential} estimated full-adder delays, serial ripple`,
    finalLabel: final.label,
  };
}

export function buildWallace(input: { width: number; values: number[]; finalAdder: FinalAdderKind }): WallaceTree {
  const width = input.width;
  const values = input.values.map((value) => value & operandMax(width));
  const count = values.length;
  const reference = values.reduce((sum, value) => sum + value, 0);
  const ids = { n: 0 };
  let columns: WallaceDot[][] = Array.from({ length: resultWidthFor(width, Math.max(count, 1)) }, () => []);
  values.forEach((value, operand) => {
    const name = OPERAND_NAMES[operand] ?? `Op${operand + 1}`;
    for (let bit = 0; bit < width; bit += 1) {
      const dot = makeDot(ids, ((value >> bit) & 1) as WallaceBit, bit, `${name} bit ${bit}`);
      (columns[bit] ??= []).push(dot);
    }
  });
  columns = densify(columns);
  const stages: WallaceStage[] = [];
  let guard = 0;
  while (columnHeight(columns) > 2) {
    const before = columns.map((column) => column.slice());
    const beforeValue = weightedValue(before);
    const reduced = compress(before, stages.length, ids);
    const afterValue = weightedValue(reduced.next);
    if (beforeValue !== afterValue) {
      throw new Error(`Wallace stage ${stages.length + 1} changed the weighted value from ${beforeValue} to ${afterValue}`);
    }
    if (reduced.compressors.length === 0) {
      throw new Error(`Wallace stage ${stages.length + 1} made no progress`);
    }
    stages.push({ index: stages.length, before, after: reduced.next, compressors: reduced.compressors, value: afterValue });
    columns = reduced.next;
    guard += 1;
    if (guard > 64) throw new Error("Wallace reduction did not reach two rows");
  }
  const padded = resultWidthFor(width, Math.max(count, 1));
  const rowA: WallaceBit[] = [];
  const rowB: WallaceBit[] = [];
  const used = Math.max(columns.length, padded);
  for (let weight = 0; weight < used; weight += 1) {
    const column = columns[weight] ?? [];
    rowA.push(column[0]?.value ?? 0);
    rowB.push(column[1]?.value ?? 0);
  }
  const added = addRows(rowA, rowB, input.finalAdder);
  const sumBits = added.bits;
  const sum = bitsToValue(sumBits);
  const compressors = stages.flatMap((stage) => stage.compressors);
  const fullAdders = compressors.filter((item) => item.kind === "fa").length;
  const halfAdders = compressors.filter((item) => item.kind === "ha").length;
  const tree: WallaceTree = {
    width,
    count,
    values,
    finalAdder: input.finalAdder,
    resultWidth: sumBits.length,
    stages,
    compressors,
    rowA,
    rowB,
    sumBits,
    sum,
    reference,
    fullAdders,
    halfAdders,
    levels: stages.length,
    delay: delayFor(input.finalAdder, stages.length, sumBits.length, count, width),
    error: sum === reference ? "" : `Wallace sum ${sum} does not match arithmetic reference ${reference}`,
  };
  return tree;
}

export function playbackView(tree: WallaceTree, cycle: number): { cycle: number; active: WallaceCompressor | null; finalActive: boolean; revealed: number } {
  const clamped = Math.max(0, Math.min(cycle, tree.compressors.length));
  return {
    cycle: clamped,
    active: tree.compressors[clamped - 1] ?? null,
    finalActive: tree.compressors.length === 0 || clamped === tree.compressors.length,
    revealed: clamped,
  };
}

export function describeCompressor(node: WallaceCompressor): {
  title: string;
  inputs: string;
  sum: WallaceBit;
  carry: WallaceBit;
  column: number;
  weight: number;
  stage: number;
} {
  const title = node.kind === "fa" ? "3:2 compressor" : "2:2 compressor";
  return {
    title,
    inputs: node.inputs.map((dot) => String(dot.value)).join(", "),
    sum: node.sum.value,
    carry: node.carry.value,
    column: node.column,
    weight: 2 ** node.column,
    stage: node.stage + 1,
  };
}

export function binaryString(bits: WallaceBit[]): string {
  if (bits.length === 0) return "0";
  return [...bits].reverse().map((bit) => String(bit)).join("");
}

export function hexString(value: number): string {
  return `0x${value.toString(16).toUpperCase()}`;
}
